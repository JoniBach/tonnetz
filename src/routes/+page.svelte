<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import * as d3 from 'd3';
	import { CONFIG } from './config.js';
	import { NOTES, NOTE_TO_SEMITONE, INTERVAL_NAMES, createGeometryConstants } from './constants.js';
	import * as Utils from './utils.js';
	import ControlPanel from './ControlPanel.svelte';
	import './tonnetz.css';
	import { createTonnetzSystem } from './tonnetzSystem.js';
	import { EventSystem } from './tonnetzSystem.js';
	import { initAudio, sustainNotes, stopSustainedNotes, disposeAudio } from './simple-audio.js';
	let container: HTMLDivElement;
	let svg: d3.Selection<SVGSVGElement, unknown, null, undefined>;
	let gridGroup: d3.Selection<SVGGElement, unknown, null, undefined>;
	let midiFile: Uint8Array | null = null;

	const geometryConstants = createGeometryConstants(CONFIG);
	const eventSystem = EventSystem.getInstance();

	let tonnetzSystemState = $state(createTonnetzSystem(CONFIG));

	// Global mouse up handler
	function handleGlobalMouseUp(tonnetzSystemState) {
		tonnetzSystemState.isDragging = false;
	}

	function triggerUpdate() {
		eventSystem.emit('CONTROL_PANEL_UPDATE', tonnetzSystemState);
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
			// Replace the existing mouseup handler with:
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

		// Window resize handler
		function handleResize() {
			if (!svg) return;

			// Get new dimensions
			const containerElement = svg.node()?.parentElement;
			if (!containerElement) return;

			const newWidth = containerElement.clientWidth;
			const newHeight = containerElement.clientHeight;

			// Update SVG dimensions
			svg.attr('width', newWidth).attr('height', newHeight);

			// Update viewport with current transform
			if (currentTransform) {
				updateViewport(currentTransform, tonnetzSystemState);
			}
		}

		// Keyboard event listeners for shift key
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

		// Add event listeners
		window.addEventListener('resize', handleResize);
		window.addEventListener('keydown', tonnetzSystemState.handleKeyDown);
		window.addEventListener('keyup', tonnetzSystemState.handleKeyUp);
		window.addEventListener('mouseup', handleGlobalMouseUp);

		// Cleanup function
		const cleanup = function () {
			window.removeEventListener('resize', handleResize);
			window.removeEventListener('keydown', tonnetzSystemState.handleKeyDown);
			window.removeEventListener('keyup', tonnetzSystemState.handleKeyUp);
			window.removeEventListener('mouseup', handleGlobalMouseUp);
			// Clean up any other resources if needed
		};

		return cleanup;
	}

	onMount(function () {
		// Initialize SVG and grid
		initTonnetz(tonnetzSystemState);

		// Add this event listener
		const controlPanelUpdateUnsubscribe = eventSystem.on('CONTROL_PANEL_UPDATE', (state) => {
			// Trigger the same update logic as mouseup
			updateHighlightsOnly(tonnetzSystemState);

			// If you have any other update logic that runs on mouseup, include it here
			// For example, if you have a function called updateViewport, call it:
			if (currentTransform) {
				updateViewport(currentTransform, tonnetzSystemState);
			}
		});

		// Set up event listeners
		const cleanupListeners = tonnetzSystemState.setupEventListeners(container, svg.node()!);

		// Handle mouse up events
		const unsubscribeMouseUp = eventSystem.on('MOUSE_UP', function (data) {
			// Stop all playing notes

			if (data.wasDragging && !data.shiftKey && tonnetzSystemState.isDragging) {
				tonnetzSystemState.highlightedNote = null;
				tonnetzSystemState.selectedNotes = new Set<string>();
				tonnetzSystemState.highlightedChordsCache.clear();
				tonnetzSystemState.lastSelectedNotesHash = '';
				eventSystem.emit('STATE_UPDATE');
				tonnetzSystemState.isDragging = false;
			}

			// Update highlights if needed
			if (gridGroup && (tonnetzSystemState.selectedScale || tonnetzSystemState.selectedMode)) {
				updateHighlightsOnly(tonnetzSystemState);
			}
		});

		// Handle state updates
		const unsubscribeStateUpdate = eventSystem.on('STATE_UPDATE', function () {
			updateViewport(currentTransform, tonnetzSystemState);
			updateHighlightsOnly(tonnetzSystemState);
		});

		// Handle window resize
		const handleResize = function () {
			const [width, height] = [window.innerWidth, window.innerHeight];
			if (svg) {
				svg.attr('width', width).attr('height', height);
				eventSystem.emit('RESIZE', { width, height });
			}
		};

		// Add global mouse up handler to catch mouse up outside the SVG
		const handleGlobalMouseUp = function (tonnetzSystemState) {
			tonnetzSystemState.isDragging = false;
		};
		window.addEventListener('mouseup', handleGlobalMouseUp);

		// Initial resize
		handleResize();
		window.addEventListener('resize', handleResize);

		// Cleanup function
		return function () {
			// Cleanup all event listeners
			cleanupListeners();
			unsubscribeMouseUp();
			unsubscribeStateUpdate();
			controlPanelUpdateUnsubscribe();

			window.removeEventListener('resize', handleResize);
			window.removeEventListener('mouseup', handleGlobalMouseUp);
			// Cleanup any other resources
			tonnetzSystemState.cleanup();
		};
	});

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

	let currentTransform: d3.ZoomTransform = d3.zoomIdentity;

	// Wrapper functions that inject dependencies into pure functions
	function getTriangleVertices(pos: { x: number; y: number }, up: boolean) {
		return Utils.getTriangleVertices(
			pos,
			up,
			geometryConstants.halfSize,
			geometryConstants.triHeight
		);
	}

	function getCentroid(vertices: { x: number; y: number }[]) {
		return Utils.getCentroid(vertices);
	}

	function mod12(n: number) {
		return Utils.mod12(n);
	}

	function pitchClass(q: number, r: number, root = 0, tonnetzSystemState) {
		return Utils.pitchClass(q, r, root, tonnetzSystemState.qInterval, tonnetzSystemState.rInterval);
	}

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

	function cartesianToHex(x: number, y: number) {
		return Utils.cartesianToHex(x, y, CONFIG.baseTriangleSize, geometryConstants.triHeight);
	}

	// Coordinate lookup with caching
	const getNoteCoordsFromCache = function (noteName: string, tonnetzSystemState) {
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
	};

	// Triad combination generator
	const getTriadCombinations = function (arr: string[]) {
		return Utils.getTriadCombinations(arr);
	};

	// Debounced chord calculation to prevent excessive computation
	const debouncedChordCalculation = function (tonnetzSystemState) {
		if (tonnetzSystemState.debouncedChordTimeout) {
			clearTimeout(tonnetzSystemState.debouncedChordTimeout);
		}

		tonnetzSystemState.debouncedChordTimeout = setTimeout(function () {
			const allNotes = getAllHighlightedNotes(tonnetzSystemState);
			const currentHash = JSON.stringify([...allNotes].sort());

			// Only recalculate if notes have actually changed
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

				// Update highlights after calculation
				requestAnimationFrame(function () {
					return updateHighlightsOnly(tonnetzSystemState);
				});
			}
		}, 16); // ~60fps throttle
	};

	// Throttled drag update to prevent excessive DOM updates
	const throttledDragUpdate = function (tonnetzSystemState) {
		if (tonnetzSystemState.throttledDragTimeout) return;

		tonnetzSystemState.throttledDragTimeout = setTimeout(function () {
			updateHighlightsOnly(tonnetzSystemState);
			tonnetzSystemState.throttledDragTimeout = null;
		}, 16); // ~60fps throttle
	};

	// Optimized chord detection with major/minor distinction
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

		// Check each note as potential root
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

	// Get triangle type (major/minor) for more specific identification
	function getTriangleType(row: number, col: number, isUp: boolean): string {
		const chordName = getTriangleChord(row, col, isUp, tonnetzSystemState);
		const triangleOrientation = isUp ? 'up' : 'down';
		return `${chordName}-${triangleOrientation}`;
	}

	// Utility functions
	const changeTonnetzPreset = function (presetName: string, tonnetzSystemState) {
		const preset = CONFIG.tonnetz.presets[presetName as keyof typeof CONFIG.tonnetz.presets];
		if (preset) {
			tonnetzSystemState.currentTonnetzName = presetName;
			tonnetzSystemState.qInterval = preset.qInterval;
			tonnetzSystemState.rInterval = preset.rInterval;
		}
	};

	function getIntervalDescription(semitones: number) {
		return INTERVAL_NAMES[semitones] || `${semitones} semitones`;
	}

	// Highlight functions - simplified to work with notes only
	const highlightChord = function (chordType: string, tonnetzSystemState) {
		// Get the notes that make up this chord
		const chordNotes = getChordNotes(chordType, tonnetzSystemState);

		if (tonnetzSystemState.isShiftPressed) {
			// Toggle selection: if all notes are selected, deselect them; otherwise select all
			const allSelected = chordNotes.every(function (note) {
				return tonnetzSystemState.selectedNotes.has(note);
			});

			if (allSelected) {
				// Deselect all chord notes
				chordNotes.forEach(function (note) {
					return tonnetzSystemState.selectedNotes.delete(note);
				});
			} else {
				// Select all chord notes
				chordNotes.forEach(function (note) {
					return tonnetzSystemState.selectedNotes.add(note);
				});
			}
			tonnetzSystemState.selectedNotes = new Set(tonnetzSystemState.selectedNotes); // Trigger reactivity
			// Clear single note highlight when using multi-select
			tonnetzSystemState.highlightedNote = null;
		} else {
			// Normal single selection: clear everything and select chord notes
			tonnetzSystemState.highlightedNote = null;
			tonnetzSystemState.selectedNotes.clear();
			chordNotes.forEach(function (note) {
				return tonnetzSystemState.selectedNotes.add(note);
			});
			tonnetzSystemState.selectedNotes = new Set(tonnetzSystemState.selectedNotes); // Trigger reactivity
		}

		// Trigger debounced chord calculation and highlight update
		debouncedChordCalculation(tonnetzSystemState);
	};

	const highlightNote = function (name: string, tonnetzSystemState) {
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
	};

	// Get notes that make up a chord
	const getChordNotes = function (chordType: string, tonnetzSystemState) {
		if (!chordType || chordType === 'null') return [];

		// Parse chord type (e.g., "C-up" or "F#-down")
		const [chordName, orientation] = chordType.split('-');
		if (!chordName || !orientation) return [];

		// Find a triangle with this chord type to get its vertices
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
	};

	// Get chord type from a set of notes
	const getChordFromNotes = function (notes: string[], tonnetzSystemState) {
		if (notes.length !== 3) return null;

		// Search for triangles that contain exactly these 3 notes
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
	const getCombinations = function (arr: string[], size: number) {
		if (size === 3) {
			return getTriadCombinations(arr);
		}
		// Fallback for other sizes (rarely used)
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
	};

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

	const isTriangleScaleHighlighted = function (
		row: number,
		col: number,
		isUp: boolean,
		tonnetzSystemState
	) {
		if (tonnetzSystemState.highlightedScaleNotes.size === 0) return false;
		const pos = { x: col * geometryConstants.spacing.col, y: row * geometryConstants.spacing.row };
		const vertices = getTriangleVertices(pos, isUp);
		return vertices.every(function (v) {
			const { q, r } = cartesianToHex(v.x, v.y);
			return tonnetzSystemState.highlightedScaleNotes.has(
				getPitchWithOctave(q, r, tonnetzSystemState.currentRootNote, tonnetzSystemState)
			);
		});
	};

	// Get all currently highlighted/selected notes
	function getAllHighlightedNotes(tonnetzSystemState): string[] {
		return Utils.getAllHighlightedNotes(
			tonnetzSystemState.highlightedNote,
			tonnetzSystemState.selectedNotes,
			tonnetzSystemState.highlightedPatternNotes
		);
	}

	// Get all chords that are currently highlighted (formed by selected notes) - optimized with cache
	const getHighlightedChords = function (tonnetzSystemState) {
		// Use cached results for better performance
		if (tonnetzSystemState.highlightedChordsCache.size > 0) {
			return Array.from(tonnetzSystemState.highlightedChordsCache);
		}

		// Trigger calculation if cache is empty and we have enough notes
		const allNotes = getAllHighlightedNotes(tonnetzSystemState);
		if (allNotes.length >= 3) {
			debouncedChordCalculation(tonnetzSystemState);
		}

		return [];
	};

	// Get coordinate pattern from selected notes - optimized with caching
	const getCoordinatePattern = function (tonnetzSystemState) {
		const allNotes = getAllHighlightedNotes(tonnetzSystemState);
		if (allNotes.length === 0 && tonnetzSystemState.highlightedPatternNotes.size === 0) return '';

		const notesToCheck =
			tonnetzSystemState.highlightedPatternNotes.size > 0
				? Array.from(tonnetzSystemState.highlightedPatternNotes)
				: allNotes;

		// Create cache key
		const cacheKey = `${JSON.stringify([...notesToCheck].sort())}-${tonnetzSystemState.currentRootNote}-${tonnetzSystemState.qInterval}-${tonnetzSystemState.rInterval}`;

		if (tonnetzSystemState.coordinatePatternCache.has(cacheKey)) {
			return tonnetzSystemState.coordinatePatternCache.get(cacheKey)!;
		}

		// Find all note coordinates using optimized cache lookup
		const noteCoords: Array<{ note: string; q: number; r: number }> = [];

		for (const noteName of notesToCheck) {
			const coords = getNoteCoordsFromCache(noteName, tonnetzSystemState);
			if (coords) {
				noteCoords.push({ note: noteName, ...coords });
			}
		}

		if (noteCoords.length === 0) return '';

		// Find root note: use (0,0) if it exists, otherwise use the first note
		let rootCoords: { q: number; r: number } | null = null;

		// First try to find (0,0) as root
		const zeroZero = noteCoords.find(function (nc) {
			return nc.q === 0 && nc.r === 0;
		});
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
		coordinates.sort(function (a, b) {
			return a[0] === b[0] ? a[1] - b[1] : a[0] - b[0];
		});

		const result = JSON.stringify(coordinates);
		tonnetzSystemState.coordinatePatternCache.set(cacheKey, result);
		return result;
	};

	// Get coordinate for a single note - optimized with caching
	const getCoordinateForNote = function (noteName: string) {
		const coords = getNoteCoordsFromCache(noteName, tonnetzSystemState);
		if (coords) {
			return `(${coords.q},${coords.r})`;
		}
		return '(?,?)';
	};

	// Generic pattern applier
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

	const applyChordPattern = function (patternName: string, rootNote: string, tonnetzSystemState) {
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

		// Trigger chord detection for triangle highlighting
		debouncedChordCalculation(tonnetzSystemState);

		if (gridGroup) throttledDragUpdate(tonnetzSystemState);
	};

	const applyScale = function (scaleName: string, rootNote: string, tonnetzSystemState) {
		const pattern = CONFIG.scales[scaleName as keyof typeof CONFIG.scales] as [number, number][];
		if (!pattern?.length) return;
		tonnetzSystemState.selectedScale = scaleName;
		tonnetzSystemState.selectedMode = null;
		tonnetzSystemState.scaleRoot = rootNote;
		tonnetzSystemState.highlightedScaleNotes = applyPattern(pattern, rootNote, tonnetzSystemState);
		if (gridGroup) throttledDragUpdate(tonnetzSystemState);
	};

	const applyMode = function (modeName: string, rootNote: string, tonnetzSystemState) {
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
	};

	const clearChordPattern = function (tonnetzSystemState) {
		tonnetzSystemState.selectedChordPattern = null;
		tonnetzSystemState.chordPatternRoot = null;
		tonnetzSystemState.highlightedPatternNotes.clear();

		// Clear chord cache and trigger recalculation
		tonnetzSystemState.highlightedChordsCache.clear();
		tonnetzSystemState.lastSelectedNotesHash = '';
		debouncedChordCalculation(tonnetzSystemState);

		if (gridGroup) updateHighlightsOnly(tonnetzSystemState);
	};

	const clearScale = function (tonnetzSystemState) {
		tonnetzSystemState.selectedScale = null;
		tonnetzSystemState.selectedMode = null;
		tonnetzSystemState.scaleRoot = null;
		tonnetzSystemState.highlightedScaleNotes.clear();
		if (gridGroup) updateHighlightsOnly(tonnetzSystemState);
	};

	function createGrid() {
		updateViewport(currentTransform, tonnetzSystemState);
	}

	// Fast highlight updates without full redraw - optimized with native DOM methods
	function updateHighlightsOnly(tonnetzSystemState) {
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
			const isChordHighlight = isChordHighlighted(triangleType, tonnetzSystemState);
			triangle.classList.toggle('highlighted-triangle', isChordHighlight);

			// Update scale highlighting for triangles
			let isScaleHighlight = false;
			if (tonnetzSystemState.highlightedScaleNotes.size > 0) {
				const points = triangle.getAttribute('points');
				if (points) {
					const coords = points.split(' ').map(function (point: string) {
						const [x, y] = point.split(',').map(Number);
						return { x, y };
					});

					// Check if ALL vertices are in the scale
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

		// Update vertex highlights using native DOM
		const vertices = svgElement.querySelectorAll(
			'circle[data-note]'
		) as NodeListOf<SVGCircleElement>;
		for (const vertex of vertices) {
			const noteName = vertex.getAttribute('data-note');
			if (!noteName) continue;

			// Update note highlighting
			const isNoteHighlight = isNoteHighlighted(noteName, tonnetzSystemState);
			vertex.classList.toggle('highlighted-vertex', isNoteHighlight);

			// Update scale highlighting for vertices
			const isScaleHighlight = isScaleHighlighted(noteName, tonnetzSystemState);
			vertex.classList.toggle('scale-highlight', isScaleHighlight);
		}
	}

	function updateViewport(transform: d3.ZoomTransform, tonnetzSystemState) {
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

		// Collect data
		for (let row = viewBounds.minRow; row <= viewBounds.maxRow; row++) {
			for (let col = viewBounds.minCol; col <= viewBounds.maxCol; col++) {
				const pos = {
					x: col * geometryConstants.spacing.col,
					y: row * geometryConstants.spacing.row
				};
				const isUp = (row + col) % 2 === 0;

				triangleData.push({ pos, isUp, row, col });

				// Collect unique vertices
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

		// Create elements
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

	function handleMouseDown(
		event: MouseEvent,
		type: 'note' | 'chord',
		data: {
			// For chords
			row?: number;
			col?: number;
			up?: boolean;
			// For notes
			x?: number;
			y?: number;
			rootNote?: string;
		},
		tonnetzSystemState
	) {
		if (event.button !== 0) return;
		event.preventDefault();

		// Update shift key state from the event
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
				// Toggle note in selection
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

	// Visibility functions
	function isTriangleVisible(pos: { x: number; y: number }, transform: d3.ZoomTransform) {
		return Utils.isTriangleVisible(pos, transform, CONFIG.baseTriangleSize);
	}

	function getVisibleBounds(transform: d3.ZoomTransform) {
		return Utils.getVisibleBounds(transform, CONFIG.baseTriangleSize, geometryConstants.spacing);
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

	// Optimized inner triangle creation
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

			// Update the mousedown handler for notes
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

	// Element creation functions
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

	const createLabel = function (
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
	};

	const getCurrentNotes = (tonnetzSystemState) => {
		// First priority: Individual note selections
		if (tonnetzSystemState.selectedNotes.size > 0) {
			return Array.from(tonnetzSystemState.selectedNotes);
		}
		// Second priority: Single highlighted note
		else if (tonnetzSystemState.highlightedNote) {
			return [tonnetzSystemState.highlightedNote];
		}
		// Third priority: Highlighted chords (triangles)
		else if (getHighlightedChords(tonnetzSystemState).length > 0) {
			// Extract all chord tones from highlighted chords
			const allChordTones = [];
			for (const chord of getHighlightedChords(tonnetzSystemState)) {
				const [root, orientation] = chord.split('-');
				const isMinor = orientation === 'up'; // up triangles are minor, down are major
				const chordTones = getChordTones(root, isMinor);
				allChordTones.push(...chordTones);
			}
			// Remove duplicates
			return [...new Set(allChordTones)];
		}
		// Last priority: Pattern notes
		else if (tonnetzSystemState.highlightedPatternNotes.size > 0) {
			return Array.from(tonnetzSystemState.highlightedPatternNotes);
		}
		return [];
	};

	const debouncedAudioUpdate = () => {
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
	};

	$effect(() => {
		// Create a stable reference to the values we care about
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

		// Only run the effect when these values actually change
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
</script>

<!-- Control Panel -->
<ControlPanel
	bind:tonnetzSystemState
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
	{triggerUpdate}
/>

<div bind:this={container} class="tonnetz-container">
	<!-- SVG will be appended here by D3 -->
</div>
