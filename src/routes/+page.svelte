<script lang="ts">
	import { onMount } from 'svelte';
	import * as d3 from 'd3';
	import { CONFIG } from './config.js';
	import { NOTES, NOTE_TO_SEMITONE, INTERVAL_NAMES, createGeometryConstants } from './constants.js';
	import * as Utils from './utils.js';
	import ControlPanel from './ControlPanel.svelte';
	import './tonnetz.css';

	let container: HTMLDivElement;
	let svg: d3.Selection<SVGSVGElement, unknown, null, undefined>;
	let gridGroup: d3.Selection<SVGGElement, unknown, null, undefined>;
	let midiFile: Uint8Array | null = null;

	// Derived constants
	const { halfSize, triHeight, spacing, scale } = createGeometryConstants(CONFIG);
	// const { halfSize, triHeight, spacing, scale } = createGeometryConstants(CONFIG);

	// State variables
	let currentRootNote = CONFIG.music.rootNote,
		showMusicalLabels = true,
		singleOctave = CONFIG.music.singleOctave,
		currentTonnetzName = CONFIG.tonnetz.name,
		qInterval = CONFIG.tonnetz.qInterval,
		rInterval = CONFIG.tonnetz.rInterval,
		highlightedNote: string | null = null,
		isDragging = false,
		isShiftPressed = false,
		selectedNotes = new Set<string>(),
		selectedChordPattern: string | null = null,
		chordPatternRoot: string | null = null,
		highlightedPatternNotes = new Set<string>(),
		selectedScale: string | null = null,
		selectedMode: string | null = null,
		scaleRoot: string | null = null,
		highlightedScaleNotes = new Set<string>(),
		// Performance caches
		coordinateCache = new Map<string, { q: number; r: number }>(),
		coordinatePatternCache = new Map<string, string>(),
		highlightedChordsCache = new Set<string>(),
		lastSelectedNotesHash = '',
		debouncedChordTimeout: ReturnType<typeof setTimeout> | null = null,
		throttledDragTimeout: ReturnType<typeof setTimeout> | null = null;

	function handleMidiFileChange(event) {
		const file = event.target.files[0];
		if (file) {
			const reader = new FileReader();
			reader.onload = (e) => {
				const arrayBuffer = e.target.result;
				const uint8Array = new Uint8Array(arrayBuffer);
				midiFile = uint8Array;
			};
			reader.readAsArrayBuffer(file);
		}
	}

	$: if (midiFile) {
		console.log('MIDI file loaded:', midiFile);
	}

	// Reactive updates
	$: if (
		svg &&
		!isDragging &&
		(currentRootNote ||
			showMusicalLabels !== undefined ||
			singleOctave !== undefined ||
			qInterval ||
			rInterval)
	) {
		updateViewport(currentTransform);
	}
	$: if (
		svg &&
		gridGroup &&
		(highlightedNote !== null ||
			selectedNotes.size > 0 ||
			selectedScale ||
			selectedMode ||
			highlightedPatternNotes.size > 0)
	) {
		requestAnimationFrame(() => updateHighlightsOnly());
	}
	$: if (currentRootNote) clearCaches();
	$: if (container) {
		const { color, strokeWidth, fillOpacity, transitionDuration, easing } = CONFIG.highlight;
		const [r, g, b] = [color.slice(1, 3), color.slice(3, 5), color.slice(5, 7)].map((x) =>
			parseInt(x, 16)
		);
		Object.assign(container.style, {
			'--highlight-color-value': color,
			'--highlight-stroke-width-value': strokeWidth.toString(),
			'--highlight-fill-value': `rgba(${r}, ${g}, ${b}, ${fillOpacity})`,
			'--highlight-transition-duration-value': `${transitionDuration}s`,
			'--highlight-easing-value': easing
		});
	}

	function initTonnetz() {
		const [width, height] = [window.innerWidth, window.innerHeight];
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
			.on('contextmenu', (e: Event) => e.preventDefault())
			.on('mouseup', (event: MouseEvent) => {
				const wasDragging = isDragging;
				isDragging = false;

				// Clear selections after dragging ends (unless shift is pressed for multi-select)
				if (wasDragging && !isShiftPressed) {
					highlightedNote = null;
					selectedNotes.clear();
					selectedNotes = new Set(selectedNotes); // Trigger reactivity

					// Immediately clear chord cache when clearing selections
					highlightedChordsCache.clear();
					lastSelectedNotesHash = '';
				}

				// Force update to ensure scale/mode highlights persist
				if (gridGroup && (selectedScale || selectedMode)) {
					updateHighlightsOnly();
				}
			});

		gridGroup = svg.append('g');
		svg.call(zoom.transform, d3.zoomIdentity.translate(width / 2, height / 2));
		createGrid();

		// Keyboard event listeners for shift key
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === 'Shift') {
				isShiftPressed = true;
			}
		};

		const handleKeyUp = (e: KeyboardEvent) => {
			if (e.key === 'Shift') {
				isShiftPressed = false;
			}
		};

		const handleResize = () =>
			svg.attr('width', window.innerWidth).attr('height', window.innerHeight);

		window.addEventListener('resize', handleResize);
		window.addEventListener('keydown', handleKeyDown);
		window.addEventListener('keyup', handleKeyUp);

		return () => {
			window.removeEventListener('resize', handleResize);
			window.removeEventListener('keydown', handleKeyDown);
			window.removeEventListener('keyup', handleKeyUp);
		};
	}
	onMount(() => {
		initTonnetz();
	});

	const createZoomBehavior = (config) =>
		d3
			.zoom()
			.scaleExtent([1 / config.zoomRange, config.zoomRange])
			.translateExtent([
				[-(config.gridExtent * spacing.col) / 2, -(config.gridExtent * spacing.row) / 2],
				[(config.gridExtent * spacing.col) / 2, (config.gridExtent * spacing.row) / 2]
			])
			.filter((e: any) => e.button === 2 || e.type === 'wheel' || e.type === 'dblclick')
			.on('zoom', (e: d3.D3ZoomEvent<SVGSVGElement, unknown>) => {
				gridGroup.attr('transform', e.transform);
				clearTimeout(viewportUpdateTimeout);
				viewportUpdateTimeout = setTimeout(() => updateViewport(e.transform), 100);
			});

	let viewportUpdateTimeout: ReturnType<typeof setTimeout>;
	let currentTransform: d3.ZoomTransform = d3.zoomIdentity;

	// Wrapper functions that inject dependencies into pure functions
	const getTriangleVertices = (pos: { x: number; y: number }, up: boolean) =>
		Utils.getTriangleVertices(pos, up, halfSize, triHeight);

	const getCentroid = (vertices: { x: number; y: number }[]) => Utils.getCentroid(vertices);

	const isVisible = (
		pos: { x: number; y: number },
		transform: d3.ZoomTransform,
		bufferSize: number
	) => Utils.isVisible(pos, transform, bufferSize);

	const mod12 = (n: number) => Utils.mod12(n);

	const pitchClass = (q: number, r: number, root = 0) =>
		Utils.pitchClass(q, r, root, qInterval, rInterval);

	const getPitchWithOctave = (q: number, r: number, rootNote: string) =>
		Utils.getPitchWithOctave(
			q,
			r,
			rootNote,
			singleOctave,
			qInterval,
			rInterval,
			NOTES,
			NOTE_TO_SEMITONE
		);

	const cartesianToHex = (x: number, y: number) =>
		Utils.cartesianToHex(x, y, CONFIG.baseTriangleSize, triHeight);

	// Performance optimization functions
	const clearCaches = () => {
		coordinateCache.clear();
		coordinatePatternCache.clear();
		highlightedChordsCache.clear();
		lastSelectedNotesHash = '';
	};

	// Coordinate lookup with caching
	const getNoteCoordsFromCache = (noteName: string): { q: number; r: number } | null => {
		const cacheKey = Utils.createCacheKey(noteName, currentRootNote, qInterval, rInterval);

		if (coordinateCache.has(cacheKey)) {
			return coordinateCache.get(cacheKey)!;
		}

		const coords = Utils.findNoteCoordinates(
			noteName,
			currentRootNote,
			qInterval,
			rInterval,
			getPitchWithOctave
		);
		if (coords) {
			coordinateCache.set(cacheKey, coords);
		}
		return coords;
	};

	// Triad combination generator
	const getTriadCombinations = (arr: string[]): string[][] => Utils.getTriadCombinations(arr);

	// Debounced chord calculation to prevent excessive computation
	const debouncedChordCalculation = () => {
		if (debouncedChordTimeout) {
			clearTimeout(debouncedChordTimeout);
		}

		debouncedChordTimeout = setTimeout(() => {
			const allNotes = getAllHighlightedNotes();
			const currentHash = JSON.stringify([...allNotes].sort());

			// Only recalculate if notes have actually changed
			if (currentHash !== lastSelectedNotesHash) {
				lastSelectedNotesHash = currentHash;
				highlightedChordsCache.clear();

				if (allNotes.length >= 3) {
					const combinations = getTriadCombinations(allNotes);
					for (const combination of combinations) {
						const formedChord = getChordFromNotes(combination);
						if (formedChord) {
							highlightedChordsCache.add(formedChord);
						}
					}
				}

				// Update highlights after calculation
				requestAnimationFrame(() => updateHighlightsOnly());
			}
		}, 16); // ~60fps throttle
	};

	// Throttled drag update to prevent excessive DOM updates
	const throttledDragUpdate = () => {
		if (throttledDragTimeout) return;

		throttledDragTimeout = setTimeout(() => {
			updateHighlightsOnly();
			throttledDragTimeout = null;
		}, 16); // ~60fps throttle
	};

	// Optimized chord detection with major/minor distinction
	function getTriangleChord(row: number, col: number, isUp: boolean): string {
		const pos = { x: col * spacing.col, y: row * spacing.row };
		const vertices = getTriangleVertices(pos, isUp);
		const pitchClasses = vertices.map((v) => {
			const { q, r } = cartesianToHex(v.x, v.y);
			const fullPitch = pitchClass(q, r, NOTE_TO_SEMITONE[currentRootNote]);
			return mod12(fullPitch); // Always use mod12 for chord detection
		});

		// Check each note as potential root
		for (const [i, root] of pitchClasses.entries()) {
			const intervals = pitchClasses
				.filter((_, idx) => idx !== i)
				.map((note) => mod12(note - root))
				.sort((a, b) => a - b);

			if (intervals.length === 2) {
				if (intervals[0] === 4 && intervals[1] === 7) return `${NOTES[root]}`; // Major triad
				if (intervals[0] === 3 && intervals[1] === 7) return `${NOTES[root]}`; // Minor triad (no 'm' suffix)
			}
		}

		return `${NOTES[pitchClasses[0]]}?`;
	}

	// Get triangle type (major/minor) for more specific identification
	function getTriangleType(row: number, col: number, isUp: boolean): string {
		const chordName = getTriangleChord(row, col, isUp);
		const triangleOrientation = isUp ? 'up' : 'down';
		return `${chordName}-${triangleOrientation}`;
	}

	// Utility functions
	const changeTonnetzPreset = (presetName: string) => {
		const preset = CONFIG.tonnetz.presets[presetName as keyof typeof CONFIG.tonnetz.presets];
		if (preset) {
			currentTonnetzName = presetName;
			qInterval = preset.qInterval;
			rInterval = preset.rInterval;
		}
	};

	const getIntervalDescription = (semitones: number) =>
		INTERVAL_NAMES[semitones] || `${semitones} semitones`;

	// Highlight functions - simplified to work with notes only
	const highlightChord = (chordType: string) => {
		// Get the notes that make up this chord
		const chordNotes = getChordNotes(chordType);

		if (isShiftPressed) {
			// Toggle selection: if all notes are selected, deselect them; otherwise select all
			const allSelected = chordNotes.every((note) => selectedNotes.has(note));

			if (allSelected) {
				// Deselect all chord notes
				chordNotes.forEach((note) => selectedNotes.delete(note));
			} else {
				// Select all chord notes
				chordNotes.forEach((note) => selectedNotes.add(note));
			}
			selectedNotes = new Set(selectedNotes); // Trigger reactivity
			// Clear single note highlight when using multi-select
			highlightedNote = null;
		} else {
			// Normal single selection: clear everything and select chord notes
			highlightedNote = null;
			selectedNotes.clear();
			chordNotes.forEach((note) => selectedNotes.add(note));
			selectedNotes = new Set(selectedNotes); // Trigger reactivity
		}

		// Trigger debounced chord calculation and highlight update
		debouncedChordCalculation();
	};

	const highlightNote = (name: string) => {
		if (isShiftPressed) {
			selectedNotes.has(name) ? selectedNotes.delete(name) : selectedNotes.add(name);
			selectedNotes = new Set(selectedNotes);
			highlightedNote = null;
		} else {
			highlightedNote = name;
			selectedNotes.clear();
		}
		debouncedChordCalculation();
	};

	// Get notes that make up a chord
	const getChordNotes = (chordType: string): string[] => {
		if (!chordType || chordType === 'null') return [];

		// Parse chord type (e.g., "C-up" or "F#-down")
		const [chordName, orientation] = chordType.split('-');
		if (!chordName || !orientation) return [];

		// Find a triangle with this chord type to get its vertices
		for (let row = -5; row <= 5; row++) {
			for (let col = -5; col <= 5; col++) {
				const isUp = (row + col) % 2 === 0;
				if (getTriangleType(row, col, isUp) === chordType) {
					const pos = { x: col * spacing.col, y: row * spacing.row };
					const vertices = getTriangleVertices(pos, isUp);
					return vertices.map((v) => {
						const { q, r } = cartesianToHex(v.x, v.y);
						return getPitchWithOctave(q, r, currentRootNote);
					});
				}
			}
		}
		return [];
	};

	// Get chord type from a set of notes
	const getChordFromNotes = (notes: string[]): string | null => {
		if (notes.length !== 3) return null;

		// Search for triangles that contain exactly these 3 notes
		for (let row = -10; row <= 10; row++) {
			for (let col = -10; col <= 10; col++) {
				const isUp = (row + col) % 2 === 0;
				const pos = { x: col * spacing.col, y: row * spacing.row };
				const vertices = getTriangleVertices(pos, isUp);
				const triangleNotes = vertices.map((v) => {
					const { q, r } = cartesianToHex(v.x, v.y);
					return getPitchWithOctave(q, r, currentRootNote);
				});

				// Check if this triangle contains exactly the same notes
				const sortedTriangleNotes = [...triangleNotes].sort();
				const sortedInputNotes = [...notes].sort();

				if (JSON.stringify(sortedTriangleNotes) === JSON.stringify(sortedInputNotes)) {
					return getTriangleType(row, col, isUp);
				}
			}
		}
		return null;
	};

	// Legacy function kept for compatibility - redirects to optimized version
	const getCombinations = (arr: string[], size: number): string[][] => {
		if (size === 3) {
			return getTriadCombinations(arr);
		}
		// Fallback for other sizes (rarely used)
		if (size > arr.length) return [];
		if (size === 1) return arr.map((item) => [item]);
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
	};

	const isChordHighlighted = (name: string) => {
		if (highlightedChordsCache.has(name)) return true;
		const allNotes = getAllHighlightedNotes();
		if (allNotes.length >= 3 && highlightedChordsCache.size === 0) debouncedChordCalculation();
		return false;
	};

	const isNoteHighlighted = (name: string) =>
		highlightedNote === name || selectedNotes.has(name) || highlightedPatternNotes.has(name);

	const isScaleHighlighted = (name: string) => highlightedScaleNotes.has(name);

	const isTriangleScaleHighlighted = (row: number, col: number, isUp: boolean) => {
		if (highlightedScaleNotes.size === 0) return false;
		const pos = { x: col * spacing.col, y: row * spacing.row };
		const vertices = getTriangleVertices(pos, isUp);
		return vertices.every((v) => {
			const { q, r } = cartesianToHex(v.x, v.y);
			return highlightedScaleNotes.has(getPitchWithOctave(q, r, currentRootNote));
		});
	};

	// Get all currently highlighted/selected notes
	const getAllHighlightedNotes = (): string[] =>
		Utils.getAllHighlightedNotes(highlightedNote, selectedNotes, highlightedPatternNotes);

	// Get all chords that are currently highlighted (formed by selected notes) - optimized with cache
	const getHighlightedChords = (): string[] => {
		// Use cached results for better performance
		if (highlightedChordsCache.size > 0) {
			return Array.from(highlightedChordsCache);
		}

		// Trigger calculation if cache is empty and we have enough notes
		const allNotes = getAllHighlightedNotes();
		if (allNotes.length >= 3) {
			debouncedChordCalculation();
		}

		return [];
	};

	// Get coordinate pattern from selected notes - optimized with caching
	const getCoordinatePattern = (): string => {
		const allNotes = getAllHighlightedNotes();
		if (allNotes.length === 0 && highlightedPatternNotes.size === 0) return '';

		const notesToCheck =
			highlightedPatternNotes.size > 0 ? Array.from(highlightedPatternNotes) : allNotes;

		// Create cache key
		const cacheKey = `${JSON.stringify([...notesToCheck].sort())}-${currentRootNote}-${qInterval}-${rInterval}`;

		if (coordinatePatternCache.has(cacheKey)) {
			return coordinatePatternCache.get(cacheKey)!;
		}

		// Find all note coordinates using optimized cache lookup
		const noteCoords: Array<{ note: string; q: number; r: number }> = [];

		for (const noteName of notesToCheck) {
			const coords = getNoteCoordsFromCache(noteName);
			if (coords) {
				noteCoords.push({ note: noteName, ...coords });
			}
		}

		if (noteCoords.length === 0) return '';

		// Find root note: use (0,0) if it exists, otherwise use the first note
		let rootCoords: { q: number; r: number } | null = null;

		// First try to find (0,0) as root
		const zeroZero = noteCoords.find((nc) => nc.q === 0 && nc.r === 0);
		if (zeroZero) {
			rootCoords = { q: 0, r: 0 };
		} else {
			// Otherwise use the first note in the list as root
			rootCoords = { q: noteCoords[0].q, r: noteCoords[0].r };
		}

		// Calculate relative coordinates from root
		const coordinates: Array<[number, number]> = [];
		for (const { q, r } of noteCoords) {
			coordinates.push([q - rootCoords.q, r - rootCoords.r]);
		}

		// Sort coordinates for consistent display
		coordinates.sort((a, b) => (a[0] === b[0] ? a[1] - b[1] : a[0] - b[0]));

		const result = JSON.stringify(coordinates);
		coordinatePatternCache.set(cacheKey, result);
		return result;
	};

	// Get coordinate for a single note - optimized with caching
	const getCoordinateForNote = (noteName: string): string => {
		const coords = getNoteCoordsFromCache(noteName);
		if (coords) {
			return `(${coords.q},${coords.r})`;
		}
		return '(?,?)';
	};

	// Get coordinate representation for a chord
	const getChordCoordinates = (chordType: string): string => {
		const chordNotes = getChordNotes(chordType);
		if (chordNotes.length === 0) return 'Unknown chord';

		// Find coordinates for each note in the chord
		const noteCoords: Array<{ note: string; q: number; r: number }> = [];

		for (const noteName of chordNotes) {
			let found = false;
			for (let q = -20; q <= 20 && !found; q++) {
				for (let r = -20; r <= 20 && !found; r++) {
					const foundNote = getPitchWithOctave(q, r, currentRootNote);
					if (foundNote === noteName) {
						noteCoords.push({ note: noteName, q, r });
						found = true;
					}
				}
			}
		}

		// Find root note: use (0,0) if it exists, otherwise use the first note
		let rootCoords: { q: number; r: number } | null = null;
		const zeroZero = noteCoords.find((nc) => nc.q === 0 && nc.r === 0);
		if (zeroZero) {
			rootCoords = { q: 0, r: 0 };
		} else if (noteCoords.length > 0) {
			rootCoords = { q: noteCoords[0].q, r: noteCoords[0].r };
		}

		if (!rootCoords) return 'Unknown coordinates';

		// Calculate relative coordinates from root
		const coordinates: Array<[number, number]> = [];
		for (const { q, r } of noteCoords) {
			coordinates.push([q - rootCoords.q, r - rootCoords.r]);
		}

		// Sort coordinates for consistent display
		coordinates.sort((a, b) => (a[0] === b[0] ? a[1] - b[1] : a[0] - b[0]));

		return JSON.stringify(coordinates);
	};

	// Generic pattern applier
	const applyPattern = (pattern: [number, number][], rootNote: string) =>
		Utils.applyPattern(
			pattern,
			rootNote,
			getNoteCoordsFromCache,
			getPitchWithOctave,
			currentRootNote
		);

	const applyChordPattern = (patternName: string, rootNote: string) => {
		const pattern = CONFIG.chordPatterns.presets[
			patternName as keyof typeof CONFIG.chordPatterns.presets
		] as [number, number][];
		if (!pattern) return;
		selectedChordPattern = patternName;
		chordPatternRoot = rootNote;
		highlightedPatternNotes = applyPattern(pattern, rootNote);

		// Trigger chord detection for triangle highlighting
		debouncedChordCalculation();

		if (gridGroup) throttledDragUpdate();
	};

	const applyScale = (scaleName: string, rootNote: string) => {
		const pattern = CONFIG.scales[scaleName as keyof typeof CONFIG.scales] as [number, number][];
		if (!pattern?.length) return;
		selectedScale = scaleName;
		selectedMode = null;
		scaleRoot = rootNote;
		highlightedScaleNotes = applyPattern(pattern, rootNote);
		if (gridGroup) throttledDragUpdate();
	};

	const applyMode = (modeName: string, rootNote: string) => {
		const modeOffset = CONFIG.modes[modeName as keyof typeof CONFIG.modes];
		const majorPattern = CONFIG.scales['Major Scale'];
		if (modeOffset === undefined || !majorPattern) return;

		const shiftedPattern = majorPattern.map(([q, r]) => [q + modeOffset, r] as [number, number]);
		selectedMode = modeName;
		selectedScale = null;
		scaleRoot = rootNote;
		highlightedScaleNotes = applyPattern(shiftedPattern, rootNote);
		if (gridGroup) throttledDragUpdate();
	};

	const clearChordPattern = () => {
		selectedChordPattern = null;
		chordPatternRoot = null;
		highlightedPatternNotes.clear();

		// Clear chord cache and trigger recalculation
		highlightedChordsCache.clear();
		lastSelectedNotesHash = '';
		debouncedChordCalculation();

		if (gridGroup) updateHighlightsOnly();
	};

	const clearScale = () => {
		selectedScale = null;
		selectedMode = null;
		scaleRoot = null;
		highlightedScaleNotes.clear();
		if (gridGroup) updateHighlightsOnly();
	};

	function createGrid() {
		updateViewport(currentTransform);
	}

	// Fast highlight updates without full redraw - optimized with native DOM methods
	function updateHighlightsOnly() {
		if (!gridGroup) return;

		// Use native DOM methods for better performance
		const svgElement = gridGroup.node();
		if (!svgElement) return;

		// Update triangle highlights using native DOM
		const triangles = svgElement.querySelectorAll(
			'polygon[data-triangle-type]'
		) as NodeListOf<SVGPolygonElement>;
		for (const triangle of triangles) {
			const triangleType = triangle.getAttribute('data-triangle-type');
			if (!triangleType) continue;

			// Update chord highlighting
			const isChordHighlight = isChordHighlighted(triangleType);
			triangle.classList.toggle('highlighted-triangle', isChordHighlight);

			// Update scale highlighting for triangles
			let isScaleHighlight = false;
			if (highlightedScaleNotes.size > 0) {
				const points = triangle.getAttribute('points');
				if (points) {
					const coords = points.split(' ').map((point: string) => {
						const [x, y] = point.split(',').map(Number);
						return { x, y };
					});

					// Check if ALL vertices are in the scale
					isScaleHighlight = coords.every((coord) => {
						const { q, r } = cartesianToHex(coord.x, coord.y);
						const noteName = getPitchWithOctave(q, r, currentRootNote);
						return highlightedScaleNotes.has(noteName);
					});
				}
			}
			triangle.classList.toggle('scale-highlight', isScaleHighlight);
		}

		// Update vertex highlights using native DOM
		const vertices = svgElement.querySelectorAll(
			'circle[data-note]'
		) as NodeListOf<SVGCircleElement>;
		for (const vertex of vertices) {
			const noteName = vertex.getAttribute('data-note');
			if (!noteName) continue;

			// Update note highlighting
			const isNoteHighlight = isNoteHighlighted(noteName);
			vertex.classList.toggle('highlighted-vertex', isNoteHighlight);

			// Update scale highlighting for vertices
			const isScaleHighlight = isScaleHighlighted(noteName);
			vertex.classList.toggle('scale-highlight', isScaleHighlight);
		}
	}

	function updateViewport(transform: d3.ZoomTransform) {
		currentTransform = transform;
		gridGroup.selectAll('*').remove();

		// Create groups
		const groups = [
			'triangles',
			'vertices',
			'inner-triangles',
			'inner-circles',
			'labels',
			'vertex-labels'
		].map((cls) => gridGroup.append('g').attr('class', cls));
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

		// Collect data
		for (let row = viewBounds.minRow; row <= viewBounds.maxRow; row++) {
			for (let col = viewBounds.minCol; col <= viewBounds.maxCol; col++) {
				const pos = { x: col * spacing.col, y: row * spacing.row };
				const isUp = (row + col) % 2 === 0;

				triangleData.push({ pos, isUp, row, col });

				// Collect unique vertices
				getTriangleVertices(pos, isUp).forEach((v) => {
					const key = `${v.x.toFixed(1)},${v.y.toFixed(1)}`;
					if (!uniqueVertices.has(key)) {
						uniqueVertices.add(key);
						const { q, r } = cartesianToHex(v.x, v.y);
						const label = showMusicalLabels
							? getPitchWithOctave(q, r, currentRootNote)
							: `(${q},${r})`;
						vertexData.push({ pos: v, label });
					}
				});
			}
		}

		// Create elements
		triangleData.forEach(({ pos, isUp, row, col }) => {
			createTriangleWithHover(triangles, innerTriangles, pos, isUp, row, col);
			if (isTriangleVisible(pos, transform)) {
				const info = showMusicalLabels ? getTriangleChord(row, col, isUp) : `(${row},${col})`;
				const subtitle = showMusicalLabels ? (isUp ? 'minor' : 'major') : isUp ? 'UP' : 'DOWN';
				createLabel(labels, pos, isUp, info, subtitle);
			}
		});

		vertexData.forEach(({ pos, label }) => {
			createVertexWithHover(vertices, innerCircles, pos);
			createVertexLabel(vertexLabels, pos, label);
		});
	}

	// Visibility functions
	const isTriangleVisible = (pos: { x: number; y: number }, transform: d3.ZoomTransform) =>
		Utils.isTriangleVisible(pos, transform, CONFIG.baseTriangleSize);

	const getVisibleBounds = (transform: d3.ZoomTransform) =>
		Utils.getVisibleBounds(transform, CONFIG.baseTriangleSize, spacing);

	function createTriangleWithHover(
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
			.attr('points', vertices.map((v) => `${v.x},${v.y}`).join(' '))
			.attr('fill', 'transparent')
			.attr('stroke', CONFIG.triangle.strokeColor)
			.attr('stroke-width', CONFIG.triangle.strokeWidth)
			.attr('opacity', CONFIG.triangle.opacity)
			.style('cursor', 'pointer')
			.attr('data-triangle-type', getTriangleType(row, col, up))
			.classed('highlighted-triangle', () => {
				const triangleType = getTriangleType(row, col, up);
				return isChordHighlighted(triangleType);
			})
			.classed('scale-highlight', () => {
				return isTriangleScaleHighlighted(row, col, up);
			})
			.on('mouseleave', () => {
				if (innerTriangleElement) {
					innerTriangleElement.remove();
					innerTriangleElement = null;
				}
			})
			.on('mousedown', (event: MouseEvent) => {
				if (event.button !== 0) return; // Only respond to left-click
				event.preventDefault();
				// Removed stopPropagation to allow global mouseup handler to work
				isDragging = true;
				const triangleType = getTriangleType(row, col, up);
				highlightChord(triangleType);
			})
			.on('mouseenter', () => {
				if (isDragging && !isShiftPressed) {
					// Highlight during drag (only in normal mode, not multi-select) with throttling
					const triangleType = getTriangleType(row, col, up);
					// Select the triangle's notes instead of highlighting chord directly
					highlightChord(triangleType);
					// Use throttled update for smooth performance
					throttledDragUpdate();
				}
				if (!innerTriangleElement) {
					innerTriangleElement = createInnerTriangleElement(innerTriangleParent, pos, up);
				}
			});

		return vertices;
	}

	// Optimized inner triangle creation
	function createInnerTriangleElement(
		parent: d3.Selection<SVGGElement, unknown, null, undefined>,
		gridPos: { x: number; y: number },
		gridUp: boolean
	) {
		const vertices = getTriangleVertices(gridPos, gridUp);
		const center = getCentroid(vertices);
		const innerVertices = vertices.map((vertex) => ({
			x: center.x + (vertex.x - center.x) * scale,
			y: center.y + (vertex.y - center.y) * scale
		}));

		return parent
			.append('polygon')
			.attr('points', innerVertices.map((v) => `${v.x},${v.y}`).join(' '))
			.attr('fill', CONFIG.innerTriangle.fillColor)
			.attr('stroke', CONFIG.innerTriangle.strokeColor)
			.attr('stroke-width', CONFIG.innerTriangle.strokeWidth)
			.attr('opacity', CONFIG.innerTriangle.opacity)
			.style('pointer-events', 'none');
	}

	function createVertexWithHover(
		vertexParent: d3.Selection<SVGGElement, unknown, null, undefined>,
		innerCircleParent: d3.Selection<SVGGElement, unknown, null, undefined>,
		pos: { x: number; y: number }
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
			.attr('data-note', () => {
				const { q, r } = cartesianToHex(pos.x, pos.y);
				return getPitchWithOctave(q, r, currentRootNote);
			})
			.classed('highlighted-vertex', () => {
				const { q, r } = cartesianToHex(pos.x, pos.y);
				const noteName = getPitchWithOctave(q, r, currentRootNote);
				return isNoteHighlighted(noteName);
			})
			.classed('scale-highlight', () => {
				const { q, r } = cartesianToHex(pos.x, pos.y);
				const noteName = getPitchWithOctave(q, r, currentRootNote);
				return isScaleHighlighted(noteName);
			})
			.on('mouseleave', () => {
				if (innerCircleElement) {
					innerCircleElement.remove();
					innerCircleElement = null;
				}
			})
			.on('mousedown', (event: MouseEvent) => {
				if (event.button !== 0) return; // Only respond to left-click
				event.preventDefault();
				// Removed stopPropagation to allow global mouseup handler to work
				isDragging = true;
				const { q, r } = cartesianToHex(pos.x, pos.y);
				const noteName = getPitchWithOctave(q, r, currentRootNote);

				// If chord pattern is selected, apply it to this note
				if (selectedChordPattern) {
					applyChordPattern(selectedChordPattern, noteName);
				} else {
					highlightNote(noteName);
				}
			})
			.on('mouseenter', () => {
				if (isDragging && !isShiftPressed) {
					// Highlight during drag (only in normal mode, not multi-select) with throttling
					const { q, r } = cartesianToHex(pos.x, pos.y);
					const noteName = getPitchWithOctave(q, r, currentRootNote);
					highlightedNote = noteName;
					// Use throttled update for smooth performance
					throttledDragUpdate();
				}
				if (!innerCircleElement) {
					innerCircleElement = createInnerCircleElement(innerCircleParent, pos);
				}
			});
	}

	// Element creation functions
	const createInnerCircleElement = (
		parent: d3.Selection<SVGGElement, unknown, null, undefined>,
		pos: { x: number; y: number }
	) =>
		parent
			.append('circle')
			.attr('cx', pos.x)
			.attr('cy', pos.y)
			.attr('r', CONFIG.innerCircle.diameter / 2)
			.attr('fill', CONFIG.innerCircle.fillColor)
			.attr('stroke', CONFIG.innerCircle.strokeColor)
			.attr('stroke-width', CONFIG.innerCircle.strokeWidth)
			.attr('opacity', CONFIG.innerCircle.opacity)
			.style('pointer-events', 'none');

	const createVertexLabel = (
		parent: d3.Selection<SVGGElement, unknown, null, undefined>,
		pos: { x: number; y: number },
		label: string
	) =>
		parent
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

	const createLabel = (
		parent: d3.Selection<SVGGElement, unknown, null, undefined>,
		gridPos: { x: number; y: number },
		gridUp: boolean,
		title: string,
		subtitle: string
	) => {
		const center = getCentroid(getTriangleVertices(gridPos, gridUp));
		[
			{ text: title, y: center.y - CONFIG.label.spacing / 2, config: CONFIG.label.title },
			{ text: subtitle, y: center.y + CONFIG.label.spacing / 2, config: CONFIG.label.subtitle }
		].forEach(({ text, y, config }) =>
			parent
				.append('text')
				.attr('x', center.x)
				.attr('y', y)
				.attr('text-anchor', 'middle')
				.attr('dominant-baseline', 'middle')
				.attr('font-size', config.fontSize)
				.attr('font-family', config.fontFamily)
				.attr('fill', config.color)
				.style('pointer-events', 'none')
				.text(text)
		);
	};
</script>

<!-- Control Panel -->
<ControlPanel
	bind:highlightedNote
	bind:selectedNotes
	bind:highlightedPatternNotes
	bind:selectedChordPattern
	bind:chordPatternRoot
	bind:selectedScale
	bind:selectedMode
	bind:scaleRoot
	bind:isShiftPressed
	bind:showMusicalLabels
	bind:singleOctave
	bind:currentRootNote
	bind:currentTonnetzName
	bind:qInterval
	bind:rInterval
	bind:midiFile
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
/>

<div bind:this={container} class="tonnetz-container">
	<!-- SVG will be appended here by D3 -->
</div>
