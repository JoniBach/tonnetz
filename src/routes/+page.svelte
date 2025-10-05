<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import * as d3 from 'd3';
	import * as Tone from 'tone';
	import * as Utils from './utils.js';
	import { CONFIG } from './config.js';
	import { NOTES, NOTE_TO_SEMITONE, INTERVAL_NAMES, createGeometryConstants } from './utils.js';
	import ControlPanel from './ControlPanel.svelte';
	import './tonnetz.css';

	// Event System
	type EventHandler<T = any> = (data: T) => void;
	type EventHandlers = Map<string, Set<EventHandler>>;

	// Audio state
	interface AudioState {
		audioContext: AudioContext | null;
		activeOscillators: Set<OscillatorNode>;
		activeAudioBuffers: Set<AudioBufferSourceNode>;
	}

	// Tonnetz state
	interface TonnetzState {
		currentRootNote: number;
		showMusicalLabels: boolean;
		singleOctave: boolean;
		currentTonnetzName: string;
		qInterval: number;
		rInterval: number;
		highlightedNote: string | null;
		isDragging: boolean;
		isShiftPressed: boolean;
		selectedNotes: Set<string>;
		selectedChordPattern: string | null;
		chordPatternRoot: string | null;
		highlightedPatternNotes: Set<string>;
		selectedScale: string | null;
		selectedMode: string | null;
		scaleRoot: string | null;
		highlightedScaleNotes: Set<string>;
		coordinateCache: Map<string, { q: number; r: number }>;
		coordinatePatternCache: Map<string, string>;
		highlightedChordsCache: Set<string>;
		lastSelectedNotesHash: string;
		debouncedChordTimeout: ReturnType<typeof setTimeout> | null;
		throttledDragTimeout: ReturnType<typeof setTimeout> | null;
		audioState: AudioState;
		autoPlayTimeout: ReturnType<typeof setTimeout> | null;
		isPlaying: boolean;
		isMidiPlaying: boolean;
	}

	// Initialize audio state
	const createAudioState = (): AudioState => ({
		audioContext: null,
		activeOscillators: new Set(),
		activeAudioBuffers: new Set()
	});

	// Event system singleton
	class EventSystem {
		private handlers: EventHandlers = new Map();
		private static instance: EventSystem;

		private constructor() {}

		public static getInstance(): EventSystem {
			if (!EventSystem.instance) EventSystem.instance = new EventSystem();
			return EventSystem.instance;
		}

		on<T = any>(event: string, handler: EventHandler<T>): () => void {
			if (!this.handlers.has(event)) this.handlers.set(event, new Set());
			const handlers = this.handlers.get(event)!;
			handlers.add(handler);
			return () => this.off(event, handler);
		}

		off(event: string, handler: EventHandler): void {
			if (!this.handlers.has(event)) return;
			const handlers = this.handlers.get(event)!;
			handlers.delete(handler);
			if (handlers.size === 0) this.handlers.delete(event);
		}

		emit<T = any>(event: string, data?: T): void {
			if (!this.handlers.has(event)) return;
			const handlers = new Set(this.handlers.get(event));
			handlers.forEach((handler) => {
				try {
					handler(data);
				} catch (err) {
					console.error(`Error in event handler for ${event}:`, err);
				}
			});
		}

		clear(): void {
			this.handlers.clear();
		}
	}

	// Tonnetz system factory
	const createTonnetzSystem = (config) => {
		const eventSystem = EventSystem.getInstance();

		const createState = (): TonnetzState => ({
			currentRootNote: config.music.rootNote,
			showMusicalLabels: true,
			singleOctave: config.music.singleOctave,
			currentTonnetzName: config.tonnetz.name,
			qInterval: config.tonnetz.qInterval,
			rInterval: config.tonnetz.rInterval,
			highlightedNote: null,
			isDragging: false,
			isShiftPressed: false,
			selectedNotes: new Set<string>(),
			selectedChordPattern: null,
			chordPatternRoot: null,
			highlightedPatternNotes: new Set<string>(),
			selectedScale: null,
			selectedMode: null,
			scaleRoot: null,
			highlightedScaleNotes: new Set<string>(),
			coordinateCache: new Map(),
			coordinatePatternCache: new Map(),
			highlightedChordsCache: new Set(),
			lastSelectedNotesHash: '',
			debouncedChordTimeout: null,
			throttledDragTimeout: null,
			audioState: createAudioState(),
			autoPlayTimeout: null,
			isPlaying: false,
			isMidiPlaying: false,
			midiPlayer: null
		});

		const state = createState();

		// Event handlers
		const handleMouseDown = (event: MouseEvent) => {
			if (event.button !== 0) return;
			eventSystem.emit('MOUSE_DOWN', {
				x: event.clientX,
				y: event.clientY,
				target: event.target,
				shiftKey: event.shiftKey
			});
		};

		const handleMouseUp = (event: MouseEvent) => {
			if (state.isDragging) {
				state.isDragging = false;
				eventSystem.emit('MOUSE_UP', { x: event.clientX, y: event.clientY, target: event.target });
			}
		};

		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === 'Shift') state.isShiftPressed = true;
			eventSystem.emit('KEY_DOWN', { key: event.key });
		};

		const handleKeyUp = (event: KeyboardEvent) => {
			if (event.key === 'Shift') state.isShiftPressed = false;
			eventSystem.emit('KEY_UP', { key: event.key });
		};

		const setupEventListeners = (container: HTMLElement, svg: SVGSVGElement) => {
			window.addEventListener('mouseup', handleMouseUp);
			window.addEventListener('keydown', handleKeyDown);
			window.addEventListener('keyup', handleKeyUp);
			d3.select(svg).on('mousedown', handleMouseDown);

			const unsubscribe = eventSystem.on('STATE_UPDATE', () => eventSystem.emit('UPDATE_VIEW'));

			return () => {
				window.removeEventListener('mouseup', handleMouseUp);
				window.removeEventListener('keydown', handleKeyDown);
				window.removeEventListener('keyup', handleKeyUp);
				d3.select(svg).on('mousedown', null);
				unsubscribe();
			};
		};

		const cleanup = () => {
			Tone.Transport.cancel();
			if (state.debouncedChordTimeout) clearTimeout(state.debouncedChordTimeout);
			if (state.throttledDragTimeout) clearTimeout(state.throttledDragTimeout);
		};

		return { ...state, setupEventListeners, cleanup };
	};

	type ElementType = 'triangle' | 'circle';

	interface HandleHoverParams {
		row?: number;
		col?: number;
		up?: boolean;
		element: d3.Selection<SVGElement, unknown, null, undefined> | null;
		parent: d3.Selection<SVGGElement, unknown, null, undefined>;
		pos: { x: number; y: number };
		type: ElementType;
		onDrag?: () => void;
	}

	let container: HTMLDivElement;
	let svg: d3.Selection<SVGSVGElement, unknown, null, undefined>;
	let gridGroup: d3.Selection<SVGGElement, unknown, null, undefined>;
	let currentTransform: d3.ZoomTransform = d3.zoomIdentity;
	let synth = null;
	let isInitialized = false;
	let currentlyPlayingNotes = new Set();
	let sustainedNotes = new Map(); // Map of note -> voice for sustained playback

	const geometryConstants = createGeometryConstants(CONFIG);
	const eventSystem = EventSystem.getInstance();

	let tonnetzSystemState = $state(createTonnetzSystem(CONFIG));

	$effect(() => {
		const notes = [
			tonnetzSystemState.highlightedNote,
			tonnetzSystemState.selectedNotes?.size || 0,
			tonnetzSystemState.highlightedPatternNotes?.size || 0,
			tonnetzSystemState.selectedChordPattern,
			tonnetzSystemState.chordPatternRoot,
			tonnetzSystemState.selectedScale,
			tonnetzSystemState.selectedMode,
			tonnetzSystemState.scaleRoot,
			tonnetzSystemState.highlightedScaleNotes?.size || 0,
			tonnetzSystemState.qInterval,
			tonnetzSystemState.rInterval
		].join('|');

		$effect.root(() => {
			const hasHighlighted = tonnetzSystemState.highlightedNote !== null;
			const hasSelected = tonnetzSystemState.selectedNotes?.size > 0;
			const hasPattern = tonnetzSystemState.highlightedPatternNotes?.size > 0;

			if (hasHighlighted || hasSelected || hasPattern) {
				debouncedAudioUpdate();
			} else if (tonnetzSystemState.isPlaying) {
				stopSustainedNotes();
				tonnetzSystemState.isPlaying = false;
			}
		});
	});

	onDestroy(() => {
		disposeAudio();
	});

	onMount(function () {
		initTonnetz(tonnetzSystemState);

		const controlPanelUpdateUnsubscribe = eventSystem.on('CONTROL_PANEL_UPDATE', (state) => {
			updateHighlightsOnly(tonnetzSystemState);

			if (currentTransform) {
				updateViewport(currentTransform, tonnetzSystemState);
			}
		});

		const cleanupListeners = tonnetzSystemState.setupEventListeners(container, svg.node()!);

		const unsubscribeMouseUp = eventSystem.on('MOUSE_UP', function (data) {
			if (data.wasDragging && !data.shiftKey && tonnetzSystemState.isDragging) {
				tonnetzSystemState.highlightedNote = null;
				tonnetzSystemState.selectedNotes = new Set<string>();
				tonnetzSystemState.highlightedChordsCache.clear();
				tonnetzSystemState.lastSelectedNotesHash = '';
				eventSystem.emit('STATE_UPDATE');
				tonnetzSystemState.isDragging = false;
			}

			if (gridGroup && (tonnetzSystemState.selectedScale || tonnetzSystemState.selectedMode)) {
				updateHighlightsOnly(tonnetzSystemState);
			}
		});

		const unsubscribeStateUpdate = eventSystem.on('STATE_UPDATE', function () {
			updateViewport(currentTransform, tonnetzSystemState);
			updateHighlightsOnly(tonnetzSystemState);
		});

		const handleResize = function () {
			const [width, height] = [window.innerWidth, window.innerHeight];
			if (svg) {
				svg.attr('width', width).attr('height', height);
				eventSystem.emit('RESIZE', { width, height });
			}
		};

		const handleGlobalMouseUp = function (tonnetzSystemState) {
			tonnetzSystemState.isDragging = false;
		};
		window.addEventListener('mouseup', handleGlobalMouseUp);

		handleResize();
		window.addEventListener('resize', handleResize);

		return function () {
			cleanupListeners();
			unsubscribeMouseUp();
			unsubscribeStateUpdate();
			controlPanelUpdateUnsubscribe();

			window.removeEventListener('resize', handleResize);
			window.removeEventListener('mouseup', handleGlobalMouseUp);
			tonnetzSystemState.cleanup();
		};
	});

	function getPitchWithOctave(q: number, r: number, rootNote: string, tonnetzSystemState) {
		return Utils.getPitchWithOctave(
			q,
			r,
			rootNote,
			tonnetzSystemState.singleOctave,
			tonnetzSystemState.qInterval,
			tonnetzSystemState.rInterval,
			NOTES,
			NOTE_TO_SEMITONE
		);
	}

	function getTriadCombinations(arr: string[]) {
		return Utils.getTriadCombinations(arr);
	}

	function applyPattern(pattern: [number, number][], rootNote: string, tonnetzSystemState) {
		return Utils.applyPattern(
			pattern,
			rootNote,
			getNoteCoordsFromCache,
			getPitchWithOctave,
			tonnetzSystemState.currentRootNote,
			tonnetzSystemState
		);
	}

	function cartesianToHex(x: number, y: number) {
		return Utils.cartesianToHex(x, y, CONFIG.baseTriangleSize, geometryConstants.triHeight);
	}

	function getAllHighlightedNotes(tonnetzSystemState): string[] {
		return Utils.getAllHighlightedNotes(
			tonnetzSystemState.highlightedNote,
			tonnetzSystemState.selectedNotes,
			tonnetzSystemState.highlightedPatternNotes
		);
	}

	function getCentroid(vertices: { x: number; y: number }[]) {
		return Utils.getCentroid(vertices);
	}

	function getTriangleVertices(pos: { x: number; y: number }, up: boolean) {
		return Utils.getTriangleVertices(
			pos,
			up,
			geometryConstants.halfSize,
			geometryConstants.triHeight
		);
	}

	function getVisibleBounds(transform: d3.ZoomTransform) {
		return Utils.getVisibleBounds(transform, CONFIG.baseTriangleSize, geometryConstants.spacing);
	}

	function isTriangleVisible(pos: { x: number; y: number }, transform: d3.ZoomTransform) {
		return Utils.isTriangleVisible(pos, transform, CONFIG.baseTriangleSize);
	}

	function mod12(n: number) {
		return Utils.mod12(n);
	}

	function pitchClass(q: number, r: number, root = 0, tonnetzSystemState) {
		return Utils.pitchClass(q, r, root, tonnetzSystemState.qInterval, tonnetzSystemState.rInterval);
	}

	/**
	 * Initialize Tone.js audio context
	 */
	const initAudio = async () => {
		if (isInitialized) return;

		try {
			// Start Tone.js audio context
			if (Tone.context.state !== 'running') {
				await Tone.start();
			}

			// Create a simple polyphonic synthesizer
			synth = new Tone.PolySynth(Tone.Synth, {
				oscillator: { type: 'triangle' },
				envelope: { attack: 0.1, decay: 0.2, sustain: 0.3, release: 1 },
				volume: -12
			}).toDestination();

			isInitialized = true;
			console.log('Audio initialized successfully');
		} catch (error) {
			console.error('Failed to initialize audio:', error);
		}
	};

	/**
	 * Start sustained playback of notes (continuous until stopped)
	 * @param {string[]} notes - Array of note names to sustain
	 */
	const sustainNotes = async (notes) => {
		if (!isInitialized) {
			await initAudio();
		}

		if (!synth || !notes) return;

		// Convert notes to proper format (add octave if missing) - optimized
		const toneNotes = notes.map((note) => (note.match(/\d/) ? note : `${note}4`));

		// Quick check if notes have actually changed to avoid unnecessary work
		const newNotesSet = new Set(toneNotes);
		const currentNotesSet = new Set(sustainedNotes.keys());

		// Only proceed if there are actual changes
		if (
			newNotesSet.size === currentNotesSet.size &&
			[...newNotesSet].every((note) => currentNotesSet.has(note))
		) {
			return; // No changes, skip processing
		}

		// Stop notes that are no longer selected
		for (const note of currentNotesSet) {
			if (!newNotesSet.has(note)) {
				synth.triggerRelease(note);
				sustainedNotes.delete(note);
			}
		}

		// Start new notes that aren't already playing
		for (const note of newNotesSet) {
			if (!currentNotesSet.has(note)) {
				synth.triggerAttack(note);
				sustainedNotes.set(note, true);
			}
		}

		currentlyPlayingNotes = newNotesSet;
	};

	/**
	 * Stop all sustained notes
	 */
	const stopSustainedNotes = () => {
		for (const [note] of sustainedNotes.entries()) {
			try {
				synth.triggerRelease(note);
			} catch (error) {
				// Note might already be released
			}
		}
		sustainedNotes.clear();
		currentlyPlayingNotes.clear();
	};

	/**
	 * Legacy function for compatibility - now triggers sustained playback
	 * @param {string[]} notes - Array of note names
	 * @param {string} mode - 'chord', 'arpeggio', or 'sequential'
	 */
	const playNotes = async (notes, mode = 'arpeggio') => {
		await sustainNotes(notes);
	};

	/**
	 * Stop all currently playing notes
	 */
	const stopAudio = () => {
		stopSustainedNotes();
		if (synth) {
			synth.releaseAll();
		}
	};

	/**
	 * Update audio settings
	 */
	const updateAudioSettings = (settings) => {
		if (synth && settings.volume !== undefined) {
			synth.volume.value = settings.volume;
		}
		if (synth && settings.instrument) {
			// Simple instrument switching by changing oscillator type
			const oscTypes = {
				synth: 'triangle',
				piano: 'sine',
				guitar: 'sawtooth',
				bass: 'square'
			};
			if (oscTypes[settings.instrument]) {
				synth.set({ oscillator: { type: oscTypes[settings.instrument] } });
			}
		}
	};

	/**
	 * Dispose of audio resources
	 */
	const disposeAudio = () => {
		if (synth) {
			synth.dispose();
			synth = null;
		}
		isInitialized = false;
	};

	function applyChordPattern(patternName: string, rootNote: string, tonnetzSystemState) {
		const pattern = CONFIG.chordPatterns.presets[
			patternName as keyof typeof CONFIG.chordPatterns.presets
		] as [number, number][];
		if (!pattern) return;
		tonnetzSystemState.selectedChordPattern = patternName;
		tonnetzSystemState.chordPatternRoot = rootNote;
		tonnetzSystemState.highlightedPatternNotes = applyPattern(
			pattern,
			rootNote,
			tonnetzSystemState
		);

		debouncedChordCalculation(tonnetzSystemState);

		if (gridGroup) throttledDragUpdate(tonnetzSystemState);
	}

	function applyMode(modeName: string, rootNote: string, tonnetzSystemState) {
		const modeOffset = CONFIG.modes[modeName as keyof typeof CONFIG.modes];
		const majorPattern = CONFIG.scales['Major Scale'];
		if (modeOffset === undefined || !majorPattern) return;

		const shiftedPattern = majorPattern.map(function ([q, r]) {
			return [q + modeOffset, r] as [number, number];
		});
		tonnetzSystemState.selectedMode = modeName;
		tonnetzSystemState.selectedScale = null;
		tonnetzSystemState.scaleRoot = rootNote;
		tonnetzSystemState.highlightedScaleNotes = applyPattern(
			shiftedPattern,
			rootNote,
			tonnetzSystemState
		);
		if (gridGroup) throttledDragUpdate(tonnetzSystemState);
	}

	function applyScale(scaleName: string, rootNote: string, tonnetzSystemState) {
		const pattern = CONFIG.scales[scaleName as keyof typeof CONFIG.scales] as [number, number][];
		if (!pattern?.length) return;
		tonnetzSystemState.selectedScale = scaleName;
		tonnetzSystemState.selectedMode = null;
		tonnetzSystemState.scaleRoot = rootNote;
		tonnetzSystemState.highlightedScaleNotes = applyPattern(pattern, rootNote, tonnetzSystemState);
		if (gridGroup) throttledDragUpdate(tonnetzSystemState);
	}

	function changeTonnetzPreset(presetName: string, tonnetzSystemState) {
		const preset = CONFIG.tonnetz.presets[presetName as keyof typeof CONFIG.tonnetz.presets];
		if (preset) {
			tonnetzSystemState.currentTonnetzName = presetName;
			tonnetzSystemState.qInterval = preset.qInterval;
			tonnetzSystemState.rInterval = preset.rInterval;
		}
	}

	function clearChordPattern(tonnetzSystemState) {
		tonnetzSystemState.selectedChordPattern = null;
		tonnetzSystemState.chordPatternRoot = null;
		tonnetzSystemState.highlightedPatternNotes.clear();

		tonnetzSystemState.highlightedChordsCache.clear();
		tonnetzSystemState.lastSelectedNotesHash = '';
		debouncedChordCalculation(tonnetzSystemState);

		if (gridGroup) updateHighlightsOnly(tonnetzSystemState);
	}

	function clearScale(tonnetzSystemState) {
		tonnetzSystemState.selectedScale = null;
		tonnetzSystemState.selectedMode = null;
		tonnetzSystemState.scaleRoot = null;
		tonnetzSystemState.highlightedScaleNotes.clear();
		if (gridGroup) updateHighlightsOnly(tonnetzSystemState);
	}

	function createCircleBase(
		vertexParent: d3.Selection<SVGGElement, unknown, null, undefined>,
		innerCircleParent: d3.Selection<SVGGElement, unknown, null, undefined>,
		pos: { x: number; y: number },
		tonnetzSystemState
	) {
		let innerCircleElement: d3.Selection<SVGCircleElement, unknown, null, undefined> | null = null;

		vertexParent
			.append('circle')
			.attr('cx', pos.x)
			.attr('cy', pos.y)
			.attr('r', CONFIG.vertex.diameter / 2)
			.attr('fill', CONFIG.vertex.color)
			.attr('opacity', CONFIG.vertex.opacity)
			.style('cursor', 'pointer')
			.attr('data-note', function () {
				const { q, r } = cartesianToHex(pos.x, pos.y);
				return getPitchWithOctave(q, r, tonnetzSystemState.currentRootNote, tonnetzSystemState);
			})
			.classed('highlighted-vertex', function () {
				const { q, r } = cartesianToHex(pos.x, pos.y);
				const noteName = getPitchWithOctave(
					q,
					r,
					tonnetzSystemState.currentRootNote,
					tonnetzSystemState
				);
				return isNoteHighlighted(noteName, tonnetzSystemState);
			})
			.classed('scale-highlight', function () {
				const { q, r } = cartesianToHex(pos.x, pos.y);
				const noteName = getPitchWithOctave(
					q,
					r,
					tonnetzSystemState.currentRootNote,
					tonnetzSystemState
				);
				return isScaleHighlighted(noteName, tonnetzSystemState);
			})

			.on('mousedown', function (event: MouseEvent) {
				handleMouseDown(
					event,
					'note',
					{
						x: pos.x,
						y: pos.y,
						rootNote: tonnetzSystemState.currentRootNote
					},
					tonnetzSystemState
				);
			})
			.on('mouseenter', function () {
				innerCircleElement = handleOnMouseEnter(
					{
						element: innerCircleElement,
						parent: innerCircleParent,
						pos,
						type: 'circle',
						onDrag: function () {
							const { q, r } = cartesianToHex(pos.x, pos.y);
							const noteName = getPitchWithOctave(
								q,
								r,
								tonnetzSystemState.currentRootNote,
								tonnetzSystemState
							);
							highlightNote(noteName, tonnetzSystemState);
						}
					},
					tonnetzSystemState
				);
			})
			.on('mouseleave', function () {
				innerCircleElement = handleOnMouseLeave({ element: innerCircleElement });
			});
	}

	function createGrid() {
		updateViewport(currentTransform, tonnetzSystemState);
	}

	function createInnerCircleElement(
		parent: d3.Selection<SVGGElement, unknown, null, undefined>,
		pos: { x: number; y: number }
	) {
		return parent
			.append('circle')
			.attr('cx', pos.x)
			.attr('cy', pos.y)
			.attr('r', CONFIG.innerCircle.diameter / 2)
			.attr('fill', CONFIG.innerCircle.fillColor)
			.attr('stroke', CONFIG.innerCircle.strokeColor)
			.attr('stroke-width', CONFIG.innerCircle.strokeWidth)
			.attr('opacity', CONFIG.innerCircle.opacity)
			.style('pointer-events', 'none');
	}

	function createInnerTriangleElement(
		parent: d3.Selection<SVGGElement, unknown, null, undefined>,
		gridPos: { x: number; y: number },
		gridUp: boolean
	) {
		const vertices = getTriangleVertices(gridPos, gridUp);
		const center = getCentroid(vertices);
		const innerVertices = vertices.map(function (vertex) {
			return {
				x: center.x + (vertex.x - center.x) * geometryConstants.scale,
				y: center.y + (vertex.y - center.y) * geometryConstants.scale
			};
		});

		return parent
			.append('polygon')
			.attr(
				'points',
				innerVertices
					.map(function (v) {
						return `${v.x},${v.y}`;
					})
					.join(' ')
			)
			.attr('fill', CONFIG.innerTriangle.fillColor)
			.attr('stroke', CONFIG.innerTriangle.strokeColor)
			.attr('stroke-width', CONFIG.innerTriangle.strokeWidth)
			.attr('opacity', CONFIG.innerTriangle.opacity)
			.style('pointer-events', 'none');
	}

	function createLabel(
		parent: d3.Selection<SVGGElement, unknown, null, undefined>,
		gridPos: { x: number; y: number },
		gridUp: boolean,
		title: string,
		subtitle: string
	) {
		const center = getCentroid(getTriangleVertices(gridPos, gridUp));
		[
			{ text: title, y: center.y - CONFIG.label.spacing / 2, config: CONFIG.label.title },
			{ text: subtitle, y: center.y + CONFIG.label.spacing / 2, config: CONFIG.label.subtitle }
		].forEach(function ({ text, y, config }) {
			return parent
				.append('text')
				.attr('x', center.x)
				.attr('y', y)
				.attr('text-anchor', 'middle')
				.attr('dominant-baseline', 'middle')
				.attr('font-size', config.fontSize)
				.attr('font-family', config.fontFamily)
				.attr('fill', config.color)
				.style('pointer-events', 'none')
				.text(text);
		});
	}

	function createTriangleBase(
		triangleParent: d3.Selection<SVGGElement, unknown, null, undefined>,
		innerTriangleParent: d3.Selection<SVGGElement, unknown, null, undefined>,
		pos: { x: number; y: number },
		up: boolean,
		row: number,
		col: number
	) {
		const vertices = getTriangleVertices(pos, up);
		let innerTriangleElement: d3.Selection<SVGPolygonElement, unknown, null, undefined> | null =
			null;

		triangleParent
			.append('polygon')
			.attr(
				'points',
				vertices
					.map(function (v) {
						return `${v.x},${v.y}`;
					})
					.join(' ')
			)
			.attr('fill', 'transparent')
			.attr('stroke', CONFIG.triangle.strokeColor)
			.attr('stroke-width', CONFIG.triangle.strokeWidth)
			.attr('opacity', CONFIG.triangle.opacity)
			.style('cursor', 'pointer')
			.attr('data-triangle-type', getTriangleType(row, col, up))
			.classed('highlighted-triangle', function () {
				const triangleType = getTriangleType(row, col, up);
				return isChordHighlighted(triangleType, tonnetzSystemState);
			})
			.classed('scale-highlight', function () {
				return isTriangleScaleHighlighted(row, col, up, tonnetzSystemState);
			})

			.on('mousedown', function (event: MouseEvent) {
				handleMouseDown(event, 'chord', { row, col, up }, tonnetzSystemState);
			})

			.on('mouseenter', function () {
				innerTriangleElement = handleOnMouseEnter(
					{
						row,
						col,
						up,
						element: innerTriangleElement,
						parent: innerTriangleParent,
						pos,
						type: 'triangle',
						onDrag: function () {
							const triangleType = getTriangleType(row, col, up);
							highlightChord(triangleType, tonnetzSystemState);
						}
					},
					tonnetzSystemState
				);
			})
			.on('mouseleave', function () {
				innerTriangleElement = handleOnMouseLeave({ element: innerTriangleElement });
			});

		return vertices;
	}

	function createVertexLabel(
		parent: d3.Selection<SVGGElement, unknown, null, undefined>,
		pos: { x: number; y: number },
		label: string
	) {
		return parent
			.append('text')
			.attr('x', pos.x)
			.attr('y', pos.y)
			.attr('text-anchor', 'middle')
			.attr('dominant-baseline', 'middle')
			.attr('font-size', CONFIG.vertexLabel.fontSize)
			.attr('font-family', CONFIG.vertexLabel.fontFamily)
			.attr('fill', CONFIG.vertexLabel.color)
			.style('pointer-events', 'none')
			.text(label);
	}

	function createZoomBehavior(config: any) {
		return d3
			.zoom()
			.scaleExtent([1 / config.zoomRange, config.zoomRange])
			.translateExtent([
				[
					-(config.gridExtent * geometryConstants.spacing.col) / 2,
					-(config.gridExtent * geometryConstants.spacing.row) / 2
				],
				[
					(config.gridExtent * geometryConstants.spacing.col) / 2,
					(config.gridExtent * geometryConstants.spacing.row) / 2
				]
			])
			.filter(function (e: any) {
				return e.button === 2 || e.type === 'wheel' || e.type === 'dblclick';
			})
			.on('zoom', function (e: d3.D3ZoomEvent<SVGSVGElement, unknown>) {
				gridGroup.attr('transform', e.transform);
				currentTransform = e.transform;
				eventSystem.emit('ZOOM', { transform: e.transform });
			})
			.on('end', function () {
				eventSystem.emit('STATE_UPDATE');
			});
	}

	function debouncedAudioUpdate() {
		if (tonnetzSystemState.autoPlayTimeout) {
			clearTimeout(tonnetzSystemState.autoPlayTimeout);
		}

		tonnetzSystemState.autoPlayTimeout = setTimeout(async () => {
			const currentNotes = getCurrentNotes(tonnetzSystemState);
			if (currentNotes.length > 0) {
				try {
					await initAudio();
					await sustainNotes(currentNotes);
					tonnetzSystemState.isPlaying = true;
				} catch (error) {
					console.error('Error in debouncedAudioUpdate:', error);
					tonnetzSystemState.isPlaying = false;
				}
			}
		}, 16);
	}

	function debouncedChordCalculation(tonnetzSystemState) {
		if (tonnetzSystemState.debouncedChordTimeout) {
			clearTimeout(tonnetzSystemState.debouncedChordTimeout);
		}

		tonnetzSystemState.debouncedChordTimeout = setTimeout(function () {
			const allNotes = getAllHighlightedNotes(tonnetzSystemState);
			const currentHash = JSON.stringify([...allNotes].sort());

			if (currentHash !== tonnetzSystemState.lastSelectedNotesHash) {
				tonnetzSystemState.lastSelectedNotesHash = currentHash;
				tonnetzSystemState.highlightedChordsCache.clear();

				if (allNotes.length >= 3) {
					const combinations = getTriadCombinations(allNotes);
					for (const combination of combinations) {
						const formedChord = getChordFromNotes(combination, tonnetzSystemState);
						if (formedChord) {
							tonnetzSystemState.highlightedChordsCache.add(formedChord);
						}
					}
				}

				requestAnimationFrame(function () {
					return updateHighlightsOnly(tonnetzSystemState);
				});
			}
		}, 16); // ~60fps throttle
	}

	function getChordFromNotes(notes: string[], tonnetzSystemState) {
		if (notes.length !== 3) return null;

		for (let row = -10; row <= 10; row++) {
			for (let col = -10; col <= 10; col++) {
				const isUp = (row + col) % 2 === 0;
				const pos = {
					x: col * geometryConstants.spacing.col,
					y: row * geometryConstants.spacing.row
				};
				const vertices = getTriangleVertices(pos, isUp);
				const triangleNotes = vertices.map(function (v) {
					const { q, r } = cartesianToHex(v.x, v.y);
					return getPitchWithOctave(q, r, tonnetzSystemState.currentRootNote, tonnetzSystemState);
				});

				const sortedTriangleNotes = [...triangleNotes].sort();
				const sortedInputNotes = [...notes].sort();

				if (JSON.stringify(sortedTriangleNotes) === JSON.stringify(sortedInputNotes)) {
					return getTriangleType(row, col, isUp);
				}
			}
		}
		return null;
	}

	function getChordNotes(chordType: string, tonnetzSystemState) {
		if (!chordType || chordType === 'null') return [];

		const [chordName, orientation] = chordType.split('-');
		if (!chordName || !orientation) return [];

		for (let row = -5; row <= 5; row++) {
			for (let col = -5; col <= 5; col++) {
				const isUp = (row + col) % 2 === 0;
				if (getTriangleType(row, col, isUp) === chordType) {
					const pos = {
						x: col * geometryConstants.spacing.col,
						y: row * geometryConstants.spacing.row
					};
					const vertices = getTriangleVertices(pos, isUp);
					return vertices.map(function (v) {
						const { q, r } = cartesianToHex(v.x, v.y);
						return getPitchWithOctave(q, r, tonnetzSystemState.currentRootNote, tonnetzSystemState);
					});
				}
			}
		}
		return [];
	}

	function getCombinations(arr: string[], size: number) {
		if (size === 3) {
			return getTriadCombinations(arr);
		}
		if (size > arr.length) return [];
		if (size === 1)
			return arr.map(function (item) {
				return [item];
			});
		if (size === arr.length) return [arr];

		const result: string[][] = [];
		for (let i = 0; i <= arr.length - size; i++) {
			const head = arr[i];
			const tailCombinations = getCombinations(arr.slice(i + 1), size - 1);
			for (const tail of tailCombinations) {
				result.push([head, ...tail]);
			}
		}
		return result;
	}

	function getCoordinateForNote(noteName: string) {
		const coords = getNoteCoordsFromCache(noteName, tonnetzSystemState);
		if (coords) {
			return `(${coords.q},${coords.r})`;
		}
		return '(?,?)';
	}

	function getCoordinatePattern(tonnetzSystemState) {
		const allNotes = getAllHighlightedNotes(tonnetzSystemState);
		if (allNotes.length === 0 && tonnetzSystemState.highlightedPatternNotes.size === 0) return '';

		const notesToCheck =
			tonnetzSystemState.highlightedPatternNotes.size > 0
				? Array.from(tonnetzSystemState.highlightedPatternNotes)
				: allNotes;

		const cacheKey = `${JSON.stringify([...notesToCheck].sort())}-${tonnetzSystemState.currentRootNote}-${tonnetzSystemState.qInterval}-${tonnetzSystemState.rInterval}`;

		if (tonnetzSystemState.coordinatePatternCache.has(cacheKey)) {
			return tonnetzSystemState.coordinatePatternCache.get(cacheKey)!;
		}

		const noteCoords: Array<{ note: string; q: number; r: number }> = [];

		for (const noteName of notesToCheck) {
			const coords = getNoteCoordsFromCache(noteName, tonnetzSystemState);
			if (coords) {
				noteCoords.push({ note: noteName, ...coords });
			}
		}

		if (noteCoords.length === 0) return '';

		let rootCoords: { q: number; r: number } | null = null;

		const zeroZero = noteCoords.find(function (nc) {
			return nc.q === 0 && nc.r === 0;
		});
		if (zeroZero) {
			rootCoords = { q: 0, r: 0 };
		} else {
			rootCoords = { q: noteCoords[0].q, r: noteCoords[0].r };
		}

		const coordinates: Array<[number, number]> = [];
		for (const { q, r } of noteCoords) {
			coordinates.push([q - rootCoords.q, r - rootCoords.r]);
		}

		coordinates.sort(function (a, b) {
			return a[0] === b[0] ? a[1] - b[1] : a[0] - b[0];
		});

		const result = JSON.stringify(coordinates);
		tonnetzSystemState.coordinatePatternCache.set(cacheKey, result);
		return result;
	}

	function getCurrentNotes(tonnetzSystemState) {
		if (tonnetzSystemState.selectedNotes.size > 0) {
			return Array.from(tonnetzSystemState.selectedNotes);
		} else if (tonnetzSystemState.highlightedNote) {
			return [tonnetzSystemState.highlightedNote];
		} else if (getHighlightedChords(tonnetzSystemState).length > 0) {
			const allChordTones = [];
			for (const chord of getHighlightedChords(tonnetzSystemState)) {
				const [root, orientation] = chord.split('-');
				const isMinor = orientation === 'up'; // up triangles are minor, down are major
				const chordTones = getChordTones(root, isMinor);
				allChordTones.push(...chordTones);
			}
			return [...new Set(allChordTones)];
		} else if (tonnetzSystemState.highlightedPatternNotes.size > 0) {
			return Array.from(tonnetzSystemState.highlightedPatternNotes);
		}
		return [];
	}

	function getHighlightedChords(tonnetzSystemState) {
		if (tonnetzSystemState.highlightedChordsCache.size > 0) {
			return Array.from(tonnetzSystemState.highlightedChordsCache);
		}

		const allNotes = getAllHighlightedNotes(tonnetzSystemState);
		if (allNotes.length >= 3) {
			debouncedChordCalculation(tonnetzSystemState);
		}

		return [];
	}

	function getIntervalDescription(semitones: number) {
		return INTERVAL_NAMES[semitones] || `${semitones} semitones`;
	}

	function getNoteCoordsFromCache(noteName: string, tonnetzSystemState) {
		const cacheKey = Utils.createCacheKey(
			noteName,
			tonnetzSystemState.currentRootNote,
			tonnetzSystemState.qInterval,
			tonnetzSystemState.rInterval
		);

		if (tonnetzSystemState.coordinateCache.has(cacheKey)) {
			return tonnetzSystemState.coordinateCache.get(cacheKey)!;
		}

		const coords = Utils.findNoteCoordinates(
			noteName,
			tonnetzSystemState.currentRootNote,
			tonnetzSystemState.qInterval,
			tonnetzSystemState.rInterval,
			getPitchWithOctave,
			tonnetzSystemState
		);
		if (coords) {
			tonnetzSystemState.coordinateCache.set(cacheKey, coords);
		}
		return coords;
	}

	function getTriangleChord(row: number, col: number, isUp: boolean, tonnetzSystemState): string {
		const pos = { x: col * geometryConstants.spacing.col, y: row * geometryConstants.spacing.row };
		const vertices = getTriangleVertices(pos, isUp);
		const pitchClasses = vertices.map(function (v) {
			const { q, r } = cartesianToHex(v.x, v.y);
			const fullPitch = pitchClass(
				q,
				r,
				NOTE_TO_SEMITONE[tonnetzSystemState.currentRootNote],
				tonnetzSystemState
			);
			return mod12(fullPitch); // Always use mod12 for chord detection
		});

		for (const [i, root] of pitchClasses.entries()) {
			const intervals = pitchClasses
				.filter(function (_, idx) {
					return idx !== i;
				})
				.map(function (note) {
					return mod12(note - root);
				})
				.sort(function (a, b) {
					return a - b;
				});

			if (intervals.length === 2) {
				if (intervals[0] === 4 && intervals[1] === 7) return `${NOTES[root]}`; // Major triad
				if (intervals[0] === 3 && intervals[1] === 7) return `${NOTES[root]}`; // Minor triad (no 'm' suffix)
			}
		}

		return `${NOTES[pitchClasses[0]]}?`;
	}

	function getTriangleType(row: number, col: number, isUp: boolean): string {
		const chordName = getTriangleChord(row, col, isUp, tonnetzSystemState);
		const triangleOrientation = isUp ? 'up' : 'down';
		return `${chordName}-${triangleOrientation}`;
	}

	function handleGlobalMouseUp(tonnetzSystemState) {
		tonnetzSystemState.isDragging = false;
	}

	function handleKeyDown(e: KeyboardEvent, tonnetzSystemState) {
		if (e.key === 'Shift') {
			tonnetzSystemState.isShiftPressed = true;
		}
	}

	function handleKeyUp(e: KeyboardEvent, tonnetzSystemState) {
		if (e.key === 'Shift') {
			tonnetzSystemState.isShiftPressed = false;
		}
	}

	function handleMouseDown(
		event: MouseEvent,
		type: 'note' | 'chord',
		data: {
			row?: number;
			col?: number;
			up?: boolean;
			x?: number;
			y?: number;
			rootNote?: string;
		},
		tonnetzSystemState
	) {
		if (event.button !== 0) return;
		event.preventDefault();

		tonnetzSystemState.isShiftPressed = event.shiftKey;
		tonnetzSystemState.isDragging = true;
		if (type === 'chord') {
			const { row, col, up } = data;
			if (row === undefined || col === undefined || up === undefined) return;

			const triangleType = getTriangleType(row, col, up);
			highlightChord(triangleType, tonnetzSystemState);
		} else if (type === 'note') {
			const { x, y, rootNote } = data;
			if (x === undefined || y === undefined || !rootNote) return;

			const { q, r } = cartesianToHex(x, y);
			const noteName = getPitchWithOctave(q, r, rootNote, tonnetzSystemState);

			if (tonnetzSystemState.isShiftPressed) {
				if (tonnetzSystemState.selectedNotes.has(noteName)) {
					tonnetzSystemState.selectedNotes.delete(noteName);
				} else {
					tonnetzSystemState.selectedNotes.add(noteName);
				}
				tonnetzSystemState.selectedNotes = new Set(tonnetzSystemState.selectedNotes);
				tonnetzSystemState.highlightedNote = null;
			} else if (tonnetzSystemState.selectedChordPattern) {
				applyChordPattern(tonnetzSystemState.selectedChordPattern, noteName, tonnetzSystemState);
			} else {
				tonnetzSystemState.highlightedNote = noteName;
				tonnetzSystemState.selectedNotes.clear();
			}
			debouncedChordCalculation(tonnetzSystemState);
		}
	}
	function handleOnMouseEnter(
		{ row, col, up, element, parent, pos, type, onDrag }: HandleHoverParams,
		tonnetzSystemState
	) {
		if (tonnetzSystemState.isDragging && !tonnetzSystemState.isShiftPressed && onDrag) {
			onDrag();
			throttledDragUpdate(tonnetzSystemState);
		}

		if (!element) {
			element =
				type === 'triangle'
					? createInnerTriangleElement(parent, pos, up as boolean)
					: createInnerCircleElement(parent, pos);
		}
		return element;
	}

	function handleOnMouseLeave({
		element
	}: {
		element: d3.Selection<SVGElement, unknown, null, undefined> | null;
	}) {
		if (element) {
			element.remove();
			element = null;
		}
		return element;
	}

	function handleResize() {
		if (!svg) return;

		const containerElement = svg.node()?.parentElement;
		if (!containerElement) return;

		const newWidth = containerElement.clientWidth;
		const newHeight = containerElement.clientHeight;

		svg.attr('width', newWidth).attr('height', newHeight);

		if (currentTransform) {
			updateViewport(currentTransform, tonnetzSystemState);
		}
	}

	function handleFileInputChange(event: Event, tonnetzSystemState) {
		const input = event.target as HTMLInputElement;
		if (!input.files?.length || !tonnetzSystemState.midiPlayer) return;

		const file = input.files[0];

		tonnetzSystemState.midiPlayer
			.load(file)
			.then(() => {
				// Reset Tonnetz state when a new file is loaded
				tonnetzSystemState.selectedNotes.clear();
				tonnetzSystemState.highlightedNote = null;
				tonnetzSystemState.isPlaying = false;
			})
			.catch((err) => {
				console.error('Failed to load MIDI:', err);
			});
	}
	async function toggleMidiPlay(e, tonnetzSystemState) {
		if (!tonnetzSystemState.midiPlayer) return;

		if (tonnetzSystemState.isPlaying) {
			tonnetzSystemState.midiPlayer.stop();
			tonnetzSystemState.isPlaying = false;
		} else {
			await tonnetzSystemState.midiPlayer.play();
			tonnetzSystemState.isPlaying = true;
		}
	}

	function highlightChord(chordType: string, tonnetzSystemState) {
		const chordNotes = getChordNotes(chordType, tonnetzSystemState);

		if (tonnetzSystemState.isShiftPressed) {
			const allSelected = chordNotes.every(function (note) {
				return tonnetzSystemState.selectedNotes.has(note);
			});

			if (allSelected) {
				chordNotes.forEach(function (note) {
					return tonnetzSystemState.selectedNotes.delete(note);
				});
			} else {
				chordNotes.forEach(function (note) {
					return tonnetzSystemState.selectedNotes.add(note);
				});
			}
			tonnetzSystemState.selectedNotes = new Set(tonnetzSystemState.selectedNotes); // Trigger reactivity
			tonnetzSystemState.highlightedNote = null;
		} else {
			tonnetzSystemState.highlightedNote = null;
			tonnetzSystemState.selectedNotes.clear();
			chordNotes.forEach(function (note) {
				return tonnetzSystemState.selectedNotes.add(note);
			});
			tonnetzSystemState.selectedNotes = new Set(tonnetzSystemState.selectedNotes); // Trigger reactivity
		}

		debouncedChordCalculation(tonnetzSystemState);
	}

	function highlightNote(name: string, tonnetzSystemState) {
		if (tonnetzSystemState.isShiftPressed) {
			tonnetzSystemState.selectedNotes.has(name)
				? tonnetzSystemState.selectedNotes.delete(name)
				: tonnetzSystemState.selectedNotes.add(name);
			tonnetzSystemState.selectedNotes = new Set(tonnetzSystemState.selectedNotes);
			tonnetzSystemState.highlightedNote = null;
		} else {
			tonnetzSystemState.highlightedNote = name;
			tonnetzSystemState.selectedNotes.clear();
		}
		debouncedChordCalculation(tonnetzSystemState);
	}

	function initTonnetz(tonnetzSystemState) {
		let width = window.innerWidth;
		let height = window.innerHeight;
		const zoom = createZoomBehavior(CONFIG);

		svg = d3
			.select(container)
			.append('svg')
			.attr('width', width)
			.attr('height', height)
			.style('background', CONFIG.background)
			.style('user-select', 'none')
			.style('-webkit-user-select', 'none')
			.style('-moz-user-select', 'none')
			.style('-ms-user-select', 'none')
			.call(zoom)
			.on('contextmenu', function (e: Event) {
				return e.preventDefault();
			})
			.on('mouseup', function (event: MouseEvent) {
				eventSystem.emit('MOUSE_UP', {
					x: event.clientX,
					y: event.clientY,
					wasDragging: true,
					shiftKey: event.shiftKey
				});
			});

		gridGroup = svg.append('g');
		svg.call(zoom.transform, d3.zoomIdentity.translate(width / 2, height / 2));
		createGrid();

		window.addEventListener('resize', handleResize);
		window.addEventListener('keydown', tonnetzSystemState.handleKeyDown);
		window.addEventListener('keyup', tonnetzSystemState.handleKeyUp);
		window.addEventListener('mouseup', handleGlobalMouseUp);

		const cleanup = function () {
			window.removeEventListener('resize', handleResize);
			window.removeEventListener('keydown', tonnetzSystemState.handleKeyDown);
			window.removeEventListener('keyup', tonnetzSystemState.handleKeyUp);
			window.removeEventListener('mouseup', handleGlobalMouseUp);
		};

		return cleanup;
	}

	function isChordHighlighted(name: string, tonnetzSystemState) {
		if (tonnetzSystemState.highlightedChordsCache.has(name)) return true;
		const allNotes = getAllHighlightedNotes(tonnetzSystemState);
		if (allNotes.length >= 3 && tonnetzSystemState.highlightedChordsCache.size === 0)
			debouncedChordCalculation(tonnetzSystemState);
		return false;
	}

	function isNoteHighlighted(name: string, tonnetzSystemState) {
		return (
			tonnetzSystemState.highlightedNote === name ||
			tonnetzSystemState.selectedNotes.has(name) ||
			tonnetzSystemState.highlightedPatternNotes.has(name)
		);
	}

	function isScaleHighlighted(name: string, tonnetzSystemState) {
		return tonnetzSystemState.highlightedScaleNotes.has(name);
	}

	function isTriangleScaleHighlighted(row: number, col: number, isUp: boolean, tonnetzSystemState) {
		if (tonnetzSystemState.highlightedScaleNotes.size === 0) return false;
		const pos = { x: col * geometryConstants.spacing.col, y: row * geometryConstants.spacing.row };
		const vertices = getTriangleVertices(pos, isUp);
		return vertices.every(function (v) {
			const { q, r } = cartesianToHex(v.x, v.y);
			return tonnetzSystemState.highlightedScaleNotes.has(
				getPitchWithOctave(q, r, tonnetzSystemState.currentRootNote, tonnetzSystemState)
			);
		});
	}

	function throttledDragUpdate(tonnetzSystemState) {
		if (tonnetzSystemState.throttledDragTimeout) return;

		tonnetzSystemState.throttledDragTimeout = setTimeout(function () {
			updateHighlightsOnly(tonnetzSystemState);
			tonnetzSystemState.throttledDragTimeout = null;
		}, 16); // ~60fps throttle
	}

	function triggerUpdate() {
		eventSystem.emit('CONTROL_PANEL_UPDATE', tonnetzSystemState);
	}

	function updateHighlightsOnly(tonnetzSystemState) {
		if (!gridGroup) return;

		const svgElement = gridGroup.node();
		if (!svgElement) return;

		const triangles = svgElement.querySelectorAll(
			'polygon[data-triangle-type]'
		) as NodeListOf<SVGPolygonElement>;
		for (const triangle of triangles) {
			const triangleType = triangle.getAttribute('data-triangle-type');
			if (!triangleType) continue;

			const isChordHighlight = isChordHighlighted(triangleType, tonnetzSystemState);
			triangle.classList.toggle('highlighted-triangle', isChordHighlight);

			let isScaleHighlight = false;
			if (tonnetzSystemState.highlightedScaleNotes.size > 0) {
				const points = triangle.getAttribute('points');
				if (points) {
					const coords = points.split(' ').map(function (point: string) {
						const [x, y] = point.split(',').map(Number);
						return { x, y };
					});

					isScaleHighlight = coords.every(function (coord) {
						const { q, r } = cartesianToHex(coord.x, coord.y);
						const noteName = getPitchWithOctave(
							q,
							r,
							tonnetzSystemState.currentRootNote,
							tonnetzSystemState
						);
						return tonnetzSystemState.highlightedScaleNotes.has(noteName);
					});
				}
			}
			triangle.classList.toggle('scale-highlight', isScaleHighlight);
		}

		const vertices = svgElement.querySelectorAll(
			'circle[data-note]'
		) as NodeListOf<SVGCircleElement>;
		for (const vertex of vertices) {
			const noteName = vertex.getAttribute('data-note');
			if (!noteName) continue;

			const isNoteHighlight = isNoteHighlighted(noteName, tonnetzSystemState);
			vertex.classList.toggle('highlighted-vertex', isNoteHighlight);

			const isScaleHighlight = isScaleHighlighted(noteName, tonnetzSystemState);
			vertex.classList.toggle('scale-highlight', isScaleHighlight);
		}
	}

	function updateViewport(transform: d3.ZoomTransform, tonnetzSystemState) {
		currentTransform = transform;
		gridGroup.selectAll('*').remove();

		const groups = [
			'triangles',
			'vertices',
			'inner-triangles',
			'inner-circles',
			'labels',
			'vertex-labels'
		].map(function (cls) {
			return gridGroup.append('g').attr('class', cls);
		});
		const [triangles, vertices, innerTriangles, innerCircles, labels, vertexLabels] = groups;

		const uniqueVertices = new Set<string>();
		const viewBounds = getVisibleBounds(transform);
		const triangleData: Array<{
			pos: { x: number; y: number };
			isUp: boolean;
			row: number;
			col: number;
		}> = [];
		const vertexData: Array<{ pos: { x: number; y: number }; label: string }> = [];

		for (let row = viewBounds.minRow; row <= viewBounds.maxRow; row++) {
			for (let col = viewBounds.minCol; col <= viewBounds.maxCol; col++) {
				const pos = {
					x: col * geometryConstants.spacing.col,
					y: row * geometryConstants.spacing.row
				};
				const isUp = (row + col) % 2 === 0;

				triangleData.push({ pos, isUp, row, col });

				getTriangleVertices(pos, isUp).forEach(function (v) {
					const key = `${v.x.toFixed(1)},${v.y.toFixed(1)}`;
					if (!uniqueVertices.has(key)) {
						uniqueVertices.add(key);
						const { q, r } = cartesianToHex(v.x, v.y);
						const label = tonnetzSystemState.showMusicalLabels
							? getPitchWithOctave(q, r, tonnetzSystemState.currentRootNote, tonnetzSystemState)
							: `(${q},${r})`;
						vertexData.push({ pos: v, label });
					}
				});
			}
		}

		triangleData.forEach(function ({ pos, isUp, row, col }) {
			createTriangleBase(triangles, innerTriangles, pos, isUp, row, col);
			if (isTriangleVisible(pos, transform)) {
				const info = tonnetzSystemState.showMusicalLabels
					? getTriangleChord(row, col, isUp, tonnetzSystemState)
					: `(${row},${col})`;
				const subtitle = tonnetzSystemState.showMusicalLabels
					? isUp
						? 'minor'
						: 'major'
					: isUp
						? 'UP'
						: 'DOWN';
				createLabel(labels, pos, isUp, info, subtitle);
			}
		});

		vertexData.forEach(function ({ pos, label }) {
			createCircleBase(vertices, innerCircles, pos, tonnetzSystemState);
			createVertexLabel(vertexLabels, pos, label);
		});
	}
</script>

<ControlPanel
	bind:tonnetzSystemState
	{getHighlightedChords}
	{getCoordinatePattern}
	{getCoordinateForNote}
	{changeTonnetzPreset}
	{getIntervalDescription}
	{applyChordPattern}
	{clearChordPattern}
	{applyScale}
	{applyMode}
	{clearScale}
	{triggerUpdate}
/>
<!-- {handleFileInputChange}
	{toggleMidiPlay} -->

<div bind:this={container} class="tonnetz-container"></div>
