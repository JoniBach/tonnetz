<script lang="ts">
	import { onMount } from 'svelte';
	import * as d3 from 'd3';

	let container: HTMLDivElement;
	let svg: d3.Selection<SVGSVGElement, unknown, null, undefined>;
	let gridGroup: d3.Selection<SVGGElement, unknown, null, undefined>;

	const CONFIG = {
		baseTriangleSize: 100,
		gridExtent: 20,
		zoomRange: 1.5,
		triangle: { strokeWidth: 0.3, strokeColor: '#333', opacity: 1 },
		vertex: { diameter: 30, color: '#1a1a1a', opacity: 1 },
		innerTriangle: {
			size: 80,
			strokeWidth: 0.2,
			strokeColor: '#111',
			fillColor: '#1f1f1f',
			opacity: 0.8
		},
		innerCircle: {
			diameter: 25,
			strokeWidth: 0.2,
			strokeColor: '#111',
			fillColor: '#1f1f1f',
			opacity: 0.9
		},
		label: {
			title: { fontSize: 8, color: '#666', fontFamily: 'Arial, sans-serif' },
			subtitle: { fontSize: 6, color: '#555', fontFamily: 'Arial, sans-serif' },
			spacing: 10 // Vertical spacing between title and subtitle
		},
		vertexLabel: {
			fontSize: 6,
			color: '#555',
			fontFamily: 'Arial, sans-serif'
		},
		music: {
			rootNote: 'C', // Configurable root note
			showMusicalLabels: true, // Toggle between musical and coordinate labels
			singleOctave: true, // Toggle between single octave (C, D, E...) and multi-octave (C2, D3, E4...)
			octaveRange: { min: 0, max: 8 } // Range of octaves to display when singleOctave is false
		},
		tonnetz: {
			// Configurable tonnetz formula: pitchClass = root + qInterval * q + rInterval * r
			qInterval: 7, // Perfect fifth (7 semitones) - horizontal movement
			rInterval: 4, // Major third (4 semitones) - diagonal movement
			name: 'Neo-Riemannian', // Display name for current configuration
			presets: {
				'Neo-Riemannian': { qInterval: 7, rInterval: 4 }, // Classic 3,4,5 tonnetz
				Chromatic: { qInterval: 1, rInterval: 1 }, // Chromatic lattice
				'Whole Tone': { qInterval: 2, rInterval: 2 }, // Whole tone lattice
				Quartal: { qInterval: 5, rInterval: 5 }, // Fourth-based lattice
				Augmented: { qInterval: 4, rInterval: 8 }, // Augmented triad lattice
				'Shepard Tone': { qInterval: 12, rInterval: 7 } // Octave + fifth lattice
			}
		},
		highlight: {
			// Highlight colors and styling
			color: '#ff6b35', // Orange highlight color
			strokeWidth: 2, // Highlighted stroke width
			fillOpacity: 0.1, // Fill opacity for highlighted triangles
			// Animation settings
			transitionDuration: 0.1, // CSS transition duration in seconds
			easing: 'ease' // CSS transition easing
		},
		chordPatterns: {
			// Chord pattern recipes as coordinate offsets from root (0,0)
			presets: {
				Major: [
					[0, 0],
					[0, 1],
					[1, 0]
				],
				Minor: [
					[0, 0],
					[1, -1],
					[1, 0]
				],
				'Minor 7': [
					[0, 0],
					[1, -1],
					[1, 0],
					[2, -1]
				],
				'Major 7': [
					[0, 0],
					[0, 1],
					[1, 0],
					[1, 1]
				],
				'Minor Major 7': [
					[0, 0],
					[1, -1],
					[1, 0],
					[1, 1]
				],
				'Major 6': [
					[0, 0],
					[0, 1],
					[1, 0],
					[3, 0]
				],
				'Minor 6': [
					[0, 0],
					[1, -1],
					[1, 0],
					[3, 0]
				],
				'Suspended 2': [
					[0, 0],
					[1, 0],
					[2, 0]
				],
				'Suspended 4': [
					[-3, 1],
					[-2, 1],
					[0, 0]
				],
				Diminished: [
					[0, 0],
					[1, -1],
					[2, 1]
				],
				Augmented: [
					[0, -1],
					[0, 0],
					[0, 1]
				],
				'Diminished 7': [
					[0, 0],
					[1, -1],
					[2, 1],
					[3, 0]
				],
				'Augmented Major 7': [
					[0, -1],
					[0, 0],
					[0, 1],
					[1, 1]
				],
				'Half Diminished 7': [
					[0, 0],
					[1, -1],
					[2, -1],
					[2, 1]
				],
				'Dominant 7': [
					[0, 0],
					[0, 1],
					[1, 0],
					[2, -1]
				]
			}
		},
		scales: {
			'Pentatonic Minor': [
				[0, 0],
				[1, 0],
				[2, -1],
				[2, 0],
				[3, -1]
			],
			'Pentatonic Major': [
				[0, 0],
				[0, 1],
				[1, 0],
				[2, 0],
				[3, 0]
			],
			'Melodic Minor': [
				[0, 0],
				[1, -1],
				[1, 0],
				[1, 1],
				[2, 0],
				[3, -1],
				[3, 0]
			],
			'Melodic Major': [
				[0, -1],
				[0, 0],
				[0, 1],
				[1, 0],
				[2, -1],
				[2, 0],
				[3, -1]
			],
			'Harmonic Minor': [
				[0, 0],
				[0, 1],
				[1, 0],
				[1, 1],
				[1, 2],
				[2, 1],
				[3, 0]
			],
			'Harmonic Major': [
				[0, 0],
				[0, 1],
				[0, 2],
				[1, 1],
				[1, 2],
				[2, 1],
				[3, 0]
			],
			'Hungarian Minor': [
				[-1, 0],
				[-1, 1],
				[0, 0],
				[0, 1],
				[0, 2],
				[1, 1],
				[1, 2]
			],
			'Hungarian Major': [
				[0, 0],
				[0, 1],
				[1, -1],
				[1, 0],
				[2, -1],
				[2, 1],
				[3, 0]
			],
			'Spanish Heptatonic': [
				[0, 0],
				[0, 1],
				[0, 2],
				[1, 0],
				[1, 1],
				[2, 0],
				[3, 0],
				[3, 2]
			],
			Flamenco: [
				[0, 0],
				[0, 1],
				[1, -1],
				[1, 0],
				[2, -1],
				[2, 1],
				[3, 1]
			],
			Blues: [
				[-1, 1],
				[0, 0],
				[0, 1],
				[1, 0],
				[1, 2],
				[2, 0]
			],
			Enigmatic: [
				[0, -1],
				[0, 0],
				[0, 1],
				[1, 1],
				[2, -1],
				[2, 1],
				[3, 1]
			],
			'Major Scale': [
				[0, 0],
				[0, 1],
				[1, 0],
				[1, 1],
				[2, 0],
				[2, 1],
				[3, 0]
			]
		},
		modes: {
			'Ionian (Major)': 0,
			Dorian: -1,
			Phrygian: -2,
			Lydian: 1,
			Mixolydian: -1,
			'Aeolian (Minor)': -2,
			Locrian: -3
		},
		// Subtle highlighting colors for scales
		highlightColors: {
			primary: '#4a90e2', // Blue
			secondary: '#7ed321', // Green
			tertiary: '#f5a623' // Orange
		},
		background: '#1a1a1a'
	};

	// Reactive variables
	let currentRootNote = CONFIG.music.rootNote;
	let showMusicalLabels = true;
	let singleOctave = CONFIG.music.singleOctave;
	let currentTonnetzName = CONFIG.tonnetz.name;
	let qInterval = CONFIG.tonnetz.qInterval;
	let rInterval = CONFIG.tonnetz.rInterval;

	// Highlight state - notes are the single source of truth
	let highlightedNote: string | null = null;
	let isDragging = false;
	let isShiftPressed = false;
	let selectedNotes = new Set<string>();

	// Chord pattern state
	let selectedChordPattern: string | null = null;
	let chordPatternRoot: string | null = null;
	let highlightedPatternNotes = new Set<string>();

	// Scale highlighting state
	let selectedScale: string | null = null;
	let selectedMode: string | null = null;
	let scaleRoot: string | null = null;
	let highlightedScaleNotes = new Set<string>();

	// No longer need MODES constant since modes are now direct patterns

	// Cached constants for performance
	const SQRT3 = Math.sqrt(3);
	const { baseTriangleSize, gridExtent, innerTriangle } = CONFIG;
	const HALF_SIZE = baseTriangleSize * 0.5;
	const TRI_HEIGHT = baseTriangleSize * SQRT3 * 0.5;
	const spacing = { row: TRI_HEIGHT, col: HALF_SIZE };
	const scale = innerTriangle.size / baseTriangleSize;

	// Reactive grid updates (but not during dragging to prevent flicker)
	$: if (
		svg &&
		!isDragging &&
		(currentRootNote ||
			showMusicalLabels !== undefined ||
			singleOctave !== undefined ||
			qInterval ||
			rInterval ||
			selectedNotes ||
			selectedScale ||
			selectedMode)
	) {
		updateViewport(currentTransform);
	}

	// Separate reactive update for highlights (immediate, no redraw)
	$: if (svg && gridGroup && (highlightedNote !== null || selectedScale || selectedMode)) {
		// Update highlights without full grid redraw
		updateHighlightsOnly();
	}

	// Update CSS custom properties
	$: if (container) {
		const { color, strokeWidth, fillOpacity, transitionDuration, easing } = CONFIG.highlight;
		const hex = color.slice(1);
		const r = parseInt(hex.slice(0, 2), 16);
		const g = parseInt(hex.slice(2, 4), 16);
		const b = parseInt(hex.slice(4, 6), 16);

		Object.assign(container.style, {
			'--highlight-color-value': color,
			'--highlight-stroke-width-value': strokeWidth.toString(),
			'--highlight-fill-value': `rgba(${r}, ${g}, ${b}, ${fillOpacity})`,
			'--highlight-transition-duration-value': `${transitionDuration}s`,
			'--highlight-easing-value': easing
		});
	}

	onMount(() => {
		const [width, height] = [window.innerWidth, window.innerHeight];
		const zoom = createZoomBehavior();

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
			.on('mouseup', () => {
				isDragging = false;
				if (!isShiftPressed) {
					highlightedNote = null;
					selectedNotes.clear();
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
	});

	const createZoomBehavior = () =>
		d3
			.zoom()
			.scaleExtent([1 / CONFIG.zoomRange, CONFIG.zoomRange])
			.translateExtent([
				[-(gridExtent * spacing.col) / 2, -(gridExtent * spacing.row) / 2],
				[(gridExtent * spacing.col) / 2, (gridExtent * spacing.row) / 2]
			])
			.filter((e: any) => e.button === 2 || e.type === 'wheel' || e.type === 'dblclick')
			.on('zoom', (e: d3.D3ZoomEvent<SVGSVGElement, unknown>) => {
				gridGroup.attr('transform', e.transform);
				clearTimeout(viewportUpdateTimeout);
				viewportUpdateTimeout = setTimeout(() => updateViewport(e.transform), 100);
			});

	let viewportUpdateTimeout: ReturnType<typeof setTimeout>;
	let currentTransform: d3.ZoomTransform = d3.zoomIdentity;

	// Optimized utility functions
	const getTriangleVertices = (pos: { x: number; y: number }, up: boolean) => {
		const { x, y } = pos;
		return up
			? [
					{ x, y },
					{ x: x - HALF_SIZE, y: y + TRI_HEIGHT },
					{ x: x + HALF_SIZE, y: y + TRI_HEIGHT }
				]
			: [
					{ x: x - HALF_SIZE, y },
					{ x: x + HALF_SIZE, y },
					{ x, y: y + TRI_HEIGHT }
				];
	};

	const getCentroid = (vertices: { x: number; y: number }[]) => ({
		x: vertices.reduce((sum, v) => sum + v.x, 0) / 3,
		y: vertices.reduce((sum, v) => sum + v.y, 0) / 3
	});

	// Fast visibility check
	const isVisible = (
		pos: { x: number; y: number },
		transform: d3.ZoomTransform,
		bufferSize: number
	) => {
		const screenPos = transform.apply([pos.x, pos.y]);
		const buffer = bufferSize * transform.k;
		return (
			screenPos[0] > -buffer &&
			screenPos[0] < window.innerWidth + buffer &&
			screenPos[1] > -buffer &&
			screenPos[1] < window.innerHeight + buffer
		);
	};

	// Music theory constants - optimized lookups
	const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;
	const NOTE_TO_SEMITONE: Record<string, number> = {
		C: 0,
		'C#': 1,
		D: 2,
		'D#': 3,
		E: 4,
		F: 5,
		'F#': 6,
		G: 7,
		'G#': 8,
		A: 9,
		'A#': 10,
		B: 11
	};

	// Fast math functions
	const mod12 = (n: number) => ((n % 12) + 12) % 12;
	const pitchClass = (q: number, r: number, root = 0) => root + qInterval * q + rInterval * r;
	const getPitchWithOctave = (q: number, r: number, rootNote: string) => {
		const fullPitch = pitchClass(q, r, NOTE_TO_SEMITONE[rootNote]);
		if (singleOctave) {
			return NOTES[mod12(fullPitch)];
		} else {
			const octave = Math.floor(fullPitch / 12) + 4; // Center around octave 4
			const noteClass = mod12(fullPitch);
			return `${NOTES[noteClass]}${octave}`;
		}
	};
	const cartesianToHex = (x: number, y: number) => {
		const r = Math.round(y / TRI_HEIGHT);
		return { q: Math.round(x / baseTriangleSize - r * 0.5), r };
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

	const INTERVAL_NAMES = [
		'Unison',
		'Minor 2nd',
		'Major 2nd',
		'Minor 3rd',
		'Major 3rd',
		'Perfect 4th',
		'Tritone',
		'Perfect 5th',
		'Minor 6th',
		'Major 6th',
		'Minor 7th',
		'Major 7th'
	];
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
		} else {
			// Normal single selection: clear everything and select chord notes
			highlightedNote = null;
			selectedNotes.clear();
			chordNotes.forEach((note) => selectedNotes.add(note));
			selectedNotes = new Set(selectedNotes); // Trigger reactivity

			// Force immediate highlight update during drag
			if (isDragging && gridGroup) {
				updateHighlightsOnly();
			}
		}
	};

	const highlightNote = (name: string) => {
		if (isShiftPressed) {
			// Toggle selection when shift is held
			if (selectedNotes.has(name)) {
				selectedNotes.delete(name);
			} else {
				selectedNotes.add(name);
			}
			selectedNotes = new Set(selectedNotes); // Trigger reactivity
		} else {
			// Normal single selection
			highlightedNote = name;
			selectedNotes.clear();
			// Force immediate highlight update during drag
			if (isDragging && gridGroup) {
				updateHighlightsOnly();
			}
		}
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

	// Get all possible 3-note combinations from an array
	const getCombinations = (arr: string[], size: number): string[][] => {
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
		// Get all currently highlighted/selected notes
		const allNotes = getAllHighlightedNotes();

		// Add chord pattern notes to the check
		const allNotesToCheck = [...allNotes];
		if (highlightedPatternNotes.size > 0) {
			for (const patternNote of highlightedPatternNotes) {
				if (!allNotesToCheck.includes(patternNote)) {
					allNotesToCheck.push(patternNote);
				}
			}
		}

		// Check if any 3-note combination forms this chord
		if (allNotesToCheck.length >= 3) {
			const combinations = getCombinations(allNotesToCheck, 3);
			for (const combination of combinations) {
				const formedChord = getChordFromNotes(combination);
				if (formedChord === name) return true;
			}
		}

		return false;
	};

	const isNoteHighlighted = (name: string) => {
		// Direct note highlighting
		if (highlightedNote === name || selectedNotes.has(name)) {
			return true;
		}

		// Check if this note is part of chord pattern highlighting
		if (highlightedPatternNotes.has(name)) {
			return true;
		}

		// Note: With simplified system, chord highlighting is automatic based on selected notes
		// No need to check for chord-specific highlighting since notes are the source of truth

		return false;
	};

	// Check if a note is part of scale highlighting
	const isScaleHighlighted = (name: string): boolean => {
		return highlightedScaleNotes.has(name);
	};

	// Check if a triangle should be scale-highlighted (if ALL three vertices are in the scale)
	const isTriangleScaleHighlighted = (row: number, col: number, isUp: boolean): boolean => {
		if (highlightedScaleNotes.size === 0) return false;

		const pos = { x: col * spacing.col, y: row * spacing.row };
		const vertices = getTriangleVertices(pos, isUp);

		// Check if ALL vertices of the triangle are in the highlighted scale
		for (const vertex of vertices) {
			const { q, r } = cartesianToHex(vertex.x, vertex.y);
			const noteName = getPitchWithOctave(q, r, currentRootNote);
			if (!highlightedScaleNotes.has(noteName)) {
				return false; // If any vertex is NOT in the scale, don't highlight
			}
		}

		return true; // All vertices are in the scale
	};

	// Get all currently highlighted/selected notes
	const getAllHighlightedNotes = (): string[] => {
		const notes = new Set<string>();

		// Add directly highlighted note
		if (highlightedNote) notes.add(highlightedNote);

		// Add selected notes
		for (const note of selectedNotes) {
			notes.add(note);
		}

		return Array.from(notes);
	};

	// Get all chords that are currently highlighted (formed by selected notes)
	const getHighlightedChords = (): string[] => {
		const allNotes = getAllHighlightedNotes();
		const allNotesToCheck = [...allNotes];

		// Add chord pattern notes to the check
		if (highlightedPatternNotes.size > 0) {
			for (const patternNote of highlightedPatternNotes) {
				if (!allNotesToCheck.includes(patternNote)) {
					allNotesToCheck.push(patternNote);
				}
			}
		}

		const highlightedChords: string[] = [];

		// Check if any 3-note combination forms a chord
		if (allNotesToCheck.length >= 3) {
			const combinations = getCombinations(allNotesToCheck, 3);
			for (const combination of combinations) {
				const formedChord = getChordFromNotes(combination);
				if (formedChord && !highlightedChords.includes(formedChord)) {
					highlightedChords.push(formedChord);
				}
			}
		}

		return highlightedChords;
	};

	// Get coordinate pattern from selected notes
	const getCoordinatePattern = (): string => {
		const allNotes = getAllHighlightedNotes();
		if (allNotes.length === 0 && highlightedPatternNotes.size === 0) return '';

		// Get coordinates for all highlighted notes
		const coordinates: Array<[number, number]> = [];
		const notesToCheck =
			highlightedPatternNotes.size > 0 ? Array.from(highlightedPatternNotes) : allNotes;

		// Find all note coordinates first - use a more direct approach
		const noteCoords: Array<{ note: string; q: number; r: number }> = [];

		// Search through visible grid area to find coordinates for each note
		for (const noteName of notesToCheck) {
			let found = false;
			// Search in a reasonable range around the current view
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

		// First try to find (0,0) as root
		const zeroZero = noteCoords.find((nc) => nc.q === 0 && nc.r === 0);
		if (zeroZero) {
			rootCoords = { q: 0, r: 0 };
		} else {
			// Otherwise use the first note in the list as root
			if (noteCoords.length > 0) {
				rootCoords = { q: noteCoords[0].q, r: noteCoords[0].r };
			}
		}

		if (!rootCoords) return '';

		// Calculate relative coordinates from root
		for (const { q, r } of noteCoords) {
			coordinates.push([q - rootCoords.q, r - rootCoords.r]);
		}

		// Sort coordinates for consistent display
		coordinates.sort((a, b) => (a[0] === b[0] ? a[1] - b[1] : a[0] - b[0]));

		return JSON.stringify(coordinates);
	};

	// Get coordinate for a single note
	const getCoordinateForNote = (noteName: string): string => {
		// Find this note's coordinates
		for (let row = -10; row <= 10; row++) {
			for (let col = -10; col <= 10; col++) {
				const pos = { x: col * spacing.col, y: row * spacing.row };
				const { q, r } = cartesianToHex(pos.x, pos.y);
				const foundNote = getPitchWithOctave(q, r, currentRootNote);
				if (foundNote === noteName) {
					return `(${q},${r})`;
				}
			}
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

	// Chord pattern functions
	const applyChordPattern = (patternName: string, rootNote: string) => {
		const pattern =
			CONFIG.chordPatterns.presets[patternName as keyof typeof CONFIG.chordPatterns.presets];
		if (!pattern) return;

		selectedChordPattern = patternName;
		chordPatternRoot = rootNote;

		// Find root note coordinates
		let rootCoords: { q: number; r: number } | null = null;
		for (let row = -10; row <= 10; row++) {
			for (let col = -10; col <= 10; col++) {
				const pos = { x: col * spacing.col, y: row * spacing.row };
				const { q, r } = cartesianToHex(pos.x, pos.y);
				const noteName = getPitchWithOctave(q, r, currentRootNote);
				if (noteName === rootNote) {
					rootCoords = { q, r };
					break;
				}
			}
			if (rootCoords) break;
		}

		if (!rootCoords) return;

		// Calculate pattern notes
		const patternNotes = new Set<string>();
		for (const [qOffset, rOffset] of pattern) {
			const noteQ = rootCoords.q + qOffset;
			const noteR = rootCoords.r + rOffset;
			const noteName = getPitchWithOctave(noteQ, noteR, currentRootNote);
			patternNotes.add(noteName);
		}

		highlightedPatternNotes = patternNotes;
		// Force update
		if (gridGroup) updateHighlightsOnly();
	};

	const clearChordPattern = () => {
		selectedChordPattern = null;
		chordPatternRoot = null;
		highlightedPatternNotes.clear();
		if (gridGroup) updateHighlightsOnly();
	};

	// Scale highlighting functions
	const applyScale = (scaleName: string, rootNote: string) => {
		const pattern = CONFIG.scales[scaleName as keyof typeof CONFIG.scales];
		if (!pattern || pattern.length === 0) return;

		selectedScale = scaleName;
		selectedMode = null; // Clear mode when selecting scale
		scaleRoot = rootNote;

		// Find root note coordinates
		let rootCoords: { q: number; r: number } | null = null;
		for (let q = -20; q <= 20; q++) {
			for (let r = -20; r <= 20; r++) {
				const foundNote = getPitchWithOctave(q, r, currentRootNote);
				if (foundNote === rootNote) {
					rootCoords = { q, r };
					break;
				}
			}
			if (rootCoords) break;
		}

		if (!rootCoords) return;

		// Calculate scale notes
		const scaleNotes = new Set<string>();
		for (const [qOffset, rOffset] of pattern) {
			const noteQ = rootCoords.q + qOffset;
			const noteR = rootCoords.r + rOffset;
			const noteName = getPitchWithOctave(noteQ, noteR, currentRootNote);
			scaleNotes.add(noteName);
		}

		highlightedScaleNotes = scaleNotes;

		// Force update
		if (gridGroup) updateHighlightsOnly();
	};

	// Apply mode by shifting the major scale pattern
	const applyMode = (modeName: string, rootNote: string) => {
		const modeOffset = CONFIG.modes[modeName as keyof typeof CONFIG.modes];
		if (modeOffset === undefined) return;

		// Get major scale pattern and shift it
		const majorPattern = CONFIG.scales['Major Scale'];
		if (!majorPattern) return;

		// Shift the pattern coordinates by the mode offset
		const shiftedPattern = majorPattern.map(([q, r]) => [
			q + modeOffset, // Shift horizontally by mode offset
			r
		]);

		selectedMode = modeName;
		selectedScale = null; // Clear scale when selecting mode
		scaleRoot = rootNote;

		// Find root note coordinates
		let rootCoords: { q: number; r: number } | null = null;
		for (let q = -20; q <= 20; q++) {
			for (let r = -20; r <= 20; r++) {
				const foundNote = getPitchWithOctave(q, r, currentRootNote);
				if (foundNote === rootNote) {
					rootCoords = { q, r };
					break;
				}
			}
			if (rootCoords) break;
		}

		if (!rootCoords) return;

		// Calculate scale notes using shifted pattern
		const scaleNotes = new Set<string>();
		for (const [qOffset, rOffset] of shiftedPattern) {
			const noteQ = rootCoords.q + qOffset;
			const noteR = rootCoords.r + rOffset;
			const noteName = getPitchWithOctave(noteQ, noteR, currentRootNote);
			scaleNotes.add(noteName);
		}

		highlightedScaleNotes = scaleNotes;

		// Force update
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

	// Fast highlight updates without full redraw
	function updateHighlightsOnly() {
		if (!gridGroup) return;

		// Update triangle highlights
		gridGroup
			.selectAll('polygon')
			.classed('highlighted-triangle', (d: any, i: number, nodes: any[]) => {
				const element = d3.select(nodes[i]);
				const triangleType = element.attr('data-triangle-type');
				return triangleType && isChordHighlighted(triangleType);
			})
			.classed('scale-highlight', (d: any, i: number, nodes: any[]) => {
				const element = d3.select(nodes[i]);
				const triangleType = element.attr('data-triangle-type');
				if (!triangleType) return false;

				// Parse triangle type to get row, col, isUp
				const [, orientation] = triangleType.split('-');
				if (!orientation) return false;

				// We need to find the triangle's position - this is a bit tricky from the DOM
				// Let's use a different approach: check if any vertex notes are highlighted
				const points = element.attr('points');
				if (!points) return false;

				const coords = points.split(' ').map((point: string) => {
					const [x, y] = point.split(',').map(Number);
					return { x, y };
				});

				// Check if ALL vertices are in the scale
				for (const coord of coords) {
					const { q, r } = cartesianToHex(coord.x, coord.y);
					const noteName = getPitchWithOctave(q, r, currentRootNote);
					if (!highlightedScaleNotes.has(noteName)) {
						return false; // If any vertex is NOT in the scale, don't highlight
					}
				}

				return true; // All vertices are in the scale
			});

		// Update vertex highlights
		gridGroup
			.selectAll('circle')
			.classed('highlighted-vertex', (d: any, i: number, nodes: any[]) => {
				const element = d3.select(nodes[i]);
				const noteName = element.attr('data-note');
				return noteName && isNoteHighlighted(noteName);
			})
			.classed('scale-highlight', (d: any, i: number, nodes: any[]) => {
				const element = d3.select(nodes[i]);
				const noteName = element.attr('data-note');
				return noteName && isScaleHighlighted(noteName);
			});
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
		isVisible(pos, transform, baseTriangleSize);

	const getVisibleBounds = (transform: d3.ZoomTransform) => {
		const [width, height] = [window.innerWidth, window.innerHeight];
		const [topLeft, bottomRight] = [transform.invert([0, 0]), transform.invert([width, height])];
		const buffer = baseTriangleSize * 1.5;

		return {
			minRow: Math.floor((topLeft[1] - buffer) / spacing.row),
			maxRow: Math.ceil((bottomRight[1] + buffer) / spacing.row),
			minCol: Math.floor((topLeft[0] - buffer) / spacing.col),
			maxCol: Math.ceil((bottomRight[0] + buffer) / spacing.col)
		};
	};

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
				isDragging = true;
				const triangleType = getTriangleType(row, col, up);
				highlightChord(triangleType);
			})
			.on('mouseenter', () => {
				if (isDragging && !isShiftPressed) {
					// Highlight during drag (only in normal mode, not multi-select)
					const triangleType = getTriangleType(row, col, up);
					// Select the triangle's notes instead of highlighting chord directly
					highlightChord(triangleType);
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
					// Highlight during drag (only in normal mode, not multi-select)
					const { q, r } = cartesianToHex(pos.x, pos.y);
					const noteName = getPitchWithOctave(q, r, currentRootNote);
					highlightedNote = noteName;
					// Force immediate update during drag
					setTimeout(() => updateHighlightsOnly(), 0);
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

	function createLabel(
		parent: d3.Selection<SVGGElement, unknown, null, undefined>,
		gridPos: { x: number; y: number },
		gridUp: boolean,
		title: string,
		subtitle: string
	) {
		const vertices = getTriangleVertices(gridPos, gridUp);
		const center = getCentroid(vertices);

		// Create title and subtitle text
		[
			{ text: title, y: center.y - CONFIG.label.spacing / 2, config: CONFIG.label.title },
			{ text: subtitle, y: center.y + CONFIG.label.spacing / 2, config: CONFIG.label.subtitle }
		].forEach(({ text, y, config }) => {
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
				.text(text);
		});
	}
</script>

<!-- Control Panel -->
<div class="control-panel">
	<div
		class="highlight-info sticky"
		class:inactive={!highlightedNote &&
			selectedNotes.size === 0 &&
			highlightedPatternNotes.size === 0}
	>
		{#if getHighlightedChords().length > 0}
			<span
				>Playing: {showMusicalLabels
					? getHighlightedChords()
							.map((c) => `${c.split('-')[0]} ${c.includes('-up') ? '(minor)' : '(major)'}`)
							.join(', ')
					: getCoordinatePattern()}</span
			>
		{:else if highlightedNote}
			<span
				>Playing: {showMusicalLabels
					? highlightedNote
					: getCoordinateForNote(highlightedNote)}</span
			>
		{:else if selectedNotes.size > 0}
			<span
				>Selected: {showMusicalLabels
					? Array.from(selectedNotes).join(', ')
					: getCoordinatePattern()} ({selectedNotes.size} notes)</span
			>
		{:else if selectedChordPattern && chordPatternRoot}
			<span
				>Pattern: {selectedChordPattern}
				{showMusicalLabels ? `chord on ${chordPatternRoot}` : getCoordinatePattern()} ({highlightedPatternNotes.size}
				notes)</span
			>
		{:else}
			<span>Nothing playing{isShiftPressed ? ' - Hold Shift + Click to multi-select' : ''}</span>
		{/if}
	</div>
	<label>
		<input type="checkbox" bind:checked={showMusicalLabels} />
		Show Musical Labels
	</label>

	<label>
		<input type="checkbox" bind:checked={singleOctave} />
		Single Octave
	</label>
	<div class="control-row">
		<label>
			Root Note:
			<select bind:value={currentRootNote}>
				{#each NOTES as note}
					<option value={note}>{note}</option>
				{/each}
			</select>
		</label>
	</div>

	<div class="control-row">
		<label>
			Tonnetz Type:
			<select
				bind:value={currentTonnetzName}
				on:change={(e) => changeTonnetzPreset((e.target as HTMLSelectElement)?.value || '')}
			>
				{#each Object.keys(CONFIG.tonnetz.presets) as presetName}
					<option value={presetName}>{presetName}</option>
				{/each}
			</select>
		</label>
	</div>

	<div class="control-row custom-intervals">
		<label>
			Q Interval:
			<input type="number" min="1" max="11" bind:value={qInterval} />
			<span class="interval-desc">{getIntervalDescription(qInterval)}</span>
		</label>

		<label>
			R Interval:
			<input type="number" min="1" max="11" bind:value={rInterval} />
			<span class="interval-desc">{getIntervalDescription(rInterval)}</span>
		</label>
	</div>

	<div class="control-row chord-patterns">
		<span>Chord Patterns:</span>
		<div class="pattern-grid">
			{#each Object.keys(CONFIG.chordPatterns.presets) as patternName}
				<button
					class="pattern-btn"
					class:active={selectedChordPattern === patternName}
					on:click={() => {
						if (selectedChordPattern === patternName) {
							clearChordPattern();
						} else if (highlightedNote) {
							applyChordPattern(patternName, highlightedNote);
						} else {
							// Default to C if no note selected
							applyChordPattern(patternName, singleOctave ? 'C' : 'C4');
						}
					}}
				>
					{patternName}
				</button>
			{/each}
		</div>
		{#if selectedChordPattern}
			<div class="pattern-info">
				<small
					>Click a note to apply {selectedChordPattern} pattern, or click the button again to clear</small
				>
			</div>
		{/if}
	</div>

	<div class="control-row scale-patterns">
		<span>Scale Patterns:</span>
		<div class="pattern-grid">
			{#each Object.keys(CONFIG.scales) as scaleName}
				<button
					class="pattern-btn scale-btn"
					class:active={selectedScale === scaleName}
					on:click={() => {
						if (selectedScale === scaleName) {
							clearScale();
						} else {
							// Use current root note or default to C
							const rootNote = highlightedNote || (singleOctave ? 'C' : 'C4');
							applyScale(scaleName, rootNote);
						}
					}}
				>
					{scaleName}
				</button>
			{/each}
		</div>
		{#if selectedScale && scaleRoot}
			<div class="pattern-info">
				<small>{selectedScale} scale on {scaleRoot}</small>
			</div>
		{/if}
	</div>

	<div class="control-row mode-patterns">
		<span>Mode Patterns:</span>
		<div class="pattern-grid">
			{#each Object.keys(CONFIG.modes) as modeName}
				<button
					class="pattern-btn mode-btn"
					class:active={selectedMode === modeName}
					on:click={() => {
						if (selectedMode === modeName) {
							clearScale();
						} else {
							// Use current root note or default to C
							const rootNote = highlightedNote || (singleOctave ? 'C' : 'C4');
							applyMode(modeName, rootNote);
						}
					}}
				>
					{modeName}
				</button>
			{/each}
		</div>
		{#if selectedMode && scaleRoot}
			<div class="pattern-info">
				<small>{selectedMode} mode on {scaleRoot}</small>
			</div>
		{/if}
	</div>
</div>

<div bind:this={container} class="tonnetz-container">
	<!-- SVG will be appended here by D3 -->
</div>

<style>
	:global(body) {
		margin: 0;
		padding: 0;
		overflow: hidden;
		background: var(--bg-color);
	}

	.sticky {
		position: sticky;
		top: 0;
		z-index: 1000;
	}

	.control-panel {
		position: fixed;
		top: 10px;
		left: 10px;
		z-index: 1000;
		background: rgba(0, 0, 0, 0.9);
		padding: 12px;
		border-radius: 8px;
		color: white;
		font:
			11px Arial,
			sans-serif;
		display: flex;
		flex-direction: column;
		gap: 8px;
		min-width: 100px;
		box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
		max-height: 90vh;
		overflow-y: auto;
	}

	.highlight-info {
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgb(84, 35, 17);
		border: 1px solid #ff6b35;
		border-radius: 4px;
		padding: 6px 8px;
		font-size: 10px;
		color: #ff6b35;
		font-weight: bold;
		transition: all 0.2s ease;
	}

	.highlight-info.inactive {
		background: rgb(31, 31, 31);
		border: 1px solid #666;
		color: #888;
		font-weight: normal;
	}

	.control-row {
		display: flex;
		gap: 12px;
		align-items: center;
		flex-wrap: wrap;
	}

	.custom-intervals {
		flex-direction: column;
		gap: 6px;
		padding-top: 6px;
		border-top: 1px solid #444;
	}

	.control-panel label {
		display: flex;
		align-items: center;
		gap: 6px;
		cursor: pointer;
	}

	.control-panel select,
	.control-panel input[type='number'] {
		padding: 4px 6px;
		border-radius: 4px;
		border: 1px solid #555;
		background: #333;
		color: white;
		font-size: 10px;
		min-width: 45px;
	}

	.control-panel input[type='number'] {
		width: 45px;
		text-align: center;
	}

	.interval-desc {
		font: italic 9px Arial;
		color: #aaa;
		margin-left: 4px;
		white-space: nowrap;
	}

	.chord-patterns {
		flex-direction: column;
		gap: 8px;
		padding-top: 8px;
		border-top: 1px solid #444;
	}

	.pattern-grid {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 4px;
	}

	.pattern-btn {
		padding: 4px 6px;
		border: 1px solid #555;
		border-radius: 3px;
		background: #333;
		color: white;
		font-size: 9px;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.pattern-btn:hover {
		background: #444;
		border-color: #666;
	}

	.pattern-btn.active {
		background: #ff6b35;
		border-color: #ff6b35;
		color: white;
	}

	.pattern-info {
		color: #aaa;
		font-size: 8px;
		line-height: 1.2;
	}

	.scale-patterns,
	.mode-patterns {
		flex-direction: column;
		gap: 8px;
		padding-top: 8px;
		border-top: 1px solid #444;
	}

	.scale-btn {
		background: #2a4a2a;
		border-color: #4a7c59;
	}

	.scale-btn:hover {
		background: #3a5a3a;
		border-color: #5a8c69;
	}

	.scale-btn.active {
		background: #4a90e2;
		border-color: #4a90e2;
		color: white;
	}

	.mode-btn {
		background: #4a3a2a;
		border-color: #7c5a4a;
	}

	.mode-btn:hover {
		background: #5a4a3a;
		border-color: #8c6a5a;
	}

	.mode-btn.active {
		background: #f5a623;
		border-color: #f5a623;
		color: white;
	}

	.control-panel select:focus,
	.control-panel input:focus {
		outline: none;
		border-color: #666;
	}

	/* Scale highlighting styles */
	:global(.scale-highlight) {
		fill: rgba(74, 144, 226, 0.2) !important; /* Blue with 20% opacity */
		stroke: rgba(74, 144, 226, 0.6) !important;
		stroke-width: 1 !important;
	}

	/* Scale highlighting for triangles */
	:global(polygon.scale-highlight) {
		fill: rgba(74, 144, 226, 0.1) !important; /* More subtle for triangles */
		stroke: rgba(74, 144, 226, 0.3) !important;
		stroke-width: 0.5 !important;
	}

	.tonnetz-container {
		--bg-color: #1a1a1a;
		--highlight-color: var(--highlight-color-value, #ff6b35);
		--highlight-stroke-width: var(--highlight-stroke-width-value, 2);
		--highlight-fill: var(--highlight-fill-value, rgba(255, 107, 53, 0.1));
		--highlight-transition-duration: var(--highlight-transition-duration-value, 0.1s);
		--highlight-easing: var(--highlight-easing-value, ease);
		width: 100vw;
		height: 100vh;
		position: fixed;
		top: 0;
		left: 0;
		background: var(--bg-color);
		user-select: none; /* Prevent text selection */
		-webkit-user-select: none; /* Safari */
		-moz-user-select: none; /* Firefox */
		-ms-user-select: none; /* IE/Edge */
	}

	/* Highlight styles */
	:global(.highlighted-triangle) {
		stroke: var(--highlight-color, #ff6b35) !important;
		stroke-width: var(--highlight-stroke-width, 2) !important;
		fill: var(--highlight-fill, rgba(255, 107, 53, 0.1)) !important;
		transition: all var(--highlight-transition-duration, 0.1s) var(--highlight-easing, ease);
	}

	:global(.highlighted-vertex) {
		fill: var(--highlight-color, #ff6b35) !important;
		stroke: var(--highlight-color, #ff6b35) !important;
		stroke-width: var(--highlight-stroke-width, 2) !important;
		transition: all var(--highlight-transition-duration, 0.1s) var(--highlight-easing, ease);
	}
</style>
