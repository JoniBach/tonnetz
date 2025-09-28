import * as d3 from 'd3';

// Event System
type EventHandler<T = any> = (data: T) => void;
type EventHandlers = Map<string, Set<EventHandler>>;

// Add these at the top of the file, outside createTonnetzSystem
let audioContext: AudioContext | null = null;
const activeOscillators = new Set<OscillatorNode>();
const activeAudioBuffers = new Set<AudioBufferSourceNode>();

class EventSystem {
	private handlers: EventHandlers = new Map();
	private static instance: EventSystem;

	private constructor() {}

	public static getInstance(): EventSystem {
		if (!EventSystem.instance) {
			EventSystem.instance = new EventSystem();
		}
		return EventSystem.instance;
	}

	on<T = any>(event: string, handler: EventHandler<T>): () => void {
		if (!this.handlers.has(event)) {
			this.handlers.set(event, new Set());
		}
		const handlers = this.handlers.get(event)!;
		handlers.add(handler);
		return () => this.off(event, handler);
	}

	off(event: string, handler: EventHandler): void {
		if (!this.handlers.has(event)) return;
		const handlers = this.handlers.get(event)!;
		handlers.delete(handler);
		if (handlers.size === 0) {
			this.handlers.delete(event);
		}
	}

	emit<T = any>(event: string, data?: T): void {
		if (!this.handlers.has(event)) return;
		const handlers = new Set(this.handlers.get(event));
		handlers.forEach((handler) => {
			try {
				handler(data);
			} catch (error) {
				console.error(`Error in event handler for ${event}:`, error);
			}
		});
	}

	clear(): void {
		this.handlers.clear();
	}
}

export const createTonnetzSystem = (config) => {
	const eventSystem = EventSystem.getInstance();
	let debouncedChordTimeout: ReturnType<typeof setTimeout> | null = null;
	let throttledDragTimeout: ReturnType<typeof setTimeout> | null = null;

	const state = {
		// Your existing state
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
		// Performance caches
		coordinateCache: new Map<string, { q: number; r: number }>(),
		coordinatePatternCache: new Map<string, string>(),
		highlightedChordsCache: new Set<string>(),
		lastSelectedNotesHash: '',
		debouncedChordTimeout: null,
		throttledDragTimeout: null,
		// ... rest of your state

		// Event handlers
		handleMouseDown: (event: MouseEvent) => {
			if (event.button !== 0) return;
			eventSystem.emit('MOUSE_DOWN', {
				x: event.clientX,
				y: event.clientY,
				target: event.target,
				shiftKey: event.shiftKey
			});
		},

		handleGlobalMouseUp: (event: MouseEvent) => {
			if (state.isDragging) {
				state.isDragging = false;
				eventSystem.emit('MOUSE_UP', {
					x: event.clientX,
					y: event.clientY,
					target: event.target
				});
			}
		},

		handleKeyDown: (event: KeyboardEvent) => {
			if (event.key === 'Shift') {
				state.isShiftPressed = true;
			}
			eventSystem.emit('KEY_DOWN', { key: event.key });
		},

		handleKeyUp: (event: KeyboardEvent) => {
			if (event.key === 'Shift') {
				state.isShiftPressed = false;
			}
			eventSystem.emit('KEY_UP', { key: event.key });
		},

		// Setup function to be called from component's onMount
		setupEventListeners: (container: HTMLElement, svg: SVGSVGElement) => {
			// Set up global listeners
			window.addEventListener('mouseup', state.handleGlobalMouseUp);
			window.addEventListener('keydown', state.handleKeyDown);
			window.addEventListener('keyup', state.handleKeyUp);

			// Set up SVG listeners
			d3.select(svg).on('mousedown', state.handleMouseDown);

			// Set up reactive updates
			const unsubscribe = eventSystem.on('STATE_UPDATE', () => {
				// This will be triggered whenever state changes
				eventSystem.emit('UPDATE_VIEW');
			});

			// Return cleanup function
			return () => {
				window.removeEventListener('mouseup', state.handleGlobalMouseUp);
				window.removeEventListener('keydown', state.handleKeyDown);
				window.removeEventListener('keyup', state.handleKeyUp);
				d3.select(svg).on('mousedown', null);
				unsubscribe();
			};
		},

		// Cleanup
		cleanup: () => {
			// Stop all audio
			if (typeof Tone !== 'undefined') {
				Tone.Transport.cancel();
				if (window.audioManager) {
					window.audioManager.stop();
				}
			}

			// Clear any timeouts
			if (state.debouncedChordTimeout) clearTimeout(state.debouncedChordTimeout);
			if (state.throttledDragTimeout) clearTimeout(state.throttledDragTimeout);
		}
	};

	return state;
};

// Export EventSystem for use in components
export { EventSystem };

// export const createTonnetzSystem = (config) => {
// 	return {
// 		currentRootNote: config.music.rootNote,
// 		showMusicalLabels: true,
// 		singleOctave: config.music.singleOctave,
// 		currentTonnetzName: config.tonnetz.name,
// 		qInterval: config.tonnetz.qInterval,
// 		rInterval: config.tonnetz.rInterval,
// 		highlightedNote: null,
// 		isDragging: false,
// 		isShiftPressed: false,
// 		selectedNotes: new Set<string>(),
// 		selectedChordPattern: null,
// 		chordPatternRoot: null,
// 		highlightedPatternNotes: new Set<string>(),
// 		selectedScale: null,
// 		selectedMode: null,
// 		scaleRoot: null,
// 		highlightedScaleNotes: new Set<string>(),
// 		// Performance caches
// 		coordinateCache: new Map<string, { q: number; r: number }>(),
// 		coordinatePatternCache: new Map<string, string>(),
// 		highlightedChordsCache: new Set<string>(),
// 		lastSelectedNotesHash: '',
// 		debouncedChordTimeout: null,
// 		throttledDragTimeout: null
// 	};
// };

// let currentRootNote = CONFIG.music.rootNote,
// 	showMusicalLabels = true,
// 	singleOctave = CONFIG.music.singleOctave,
// 	currentTonnetzName = CONFIG.tonnetz.name,
// 	qInterval = CONFIG.tonnetz.qInterval,
// 	rInterval = CONFIG.tonnetz.rInterval,
// 	highlightedNote: string | null = null,
// 	isDragging = false,
// 	isShiftPressed = false,
// 	selectedNotes = new Set<string>(),
// 	selectedChordPattern: string | null = null,
// 	chordPatternRoot: string | null = null,
// 	highlightedPatternNotes = new Set<string>(),
// 	selectedScale: string | null = null,
// 	selectedMode: string | null = null,
// 	scaleRoot: string | null = null,
// 	highlightedScaleNotes = new Set<string>(),
// 	// Performance caches
// 	coordinateCache = new Map<string, { q: number; r: number }>(),
// 	coordinatePatternCache = new Map<string, string>(),
// 	highlightedChordsCache = new Set<string>(),
// 	lastSelectedNotesHash = '',
// 	debouncedChordTimeout: ReturnType<typeof setTimeout> | null = null,
// 	throttledDragTimeout: ReturnType<typeof setTimeout> | null = null;

// let currentRootNote = /*state*/currentRootNote;
// let showMusicalLabels = /*state*/showMusicalLabels;
// let singleOctave = /*state*/singleOctave;
// let currentTonnetzName = /*state*/currentTonnetzName;
// let qInterval = /*state*/qInterval;
// let rInterval = /*state*/rInterval;
// let highlightedNote = /*state*/highlightedNote;
// let isDragging = /*state*/isDragging;
// let isShiftPressed = /*state*/isShiftPressed;
// let selectedNotes = /*state*/selectedNotes;
// let selectedChordPattern = /*state*/selectedChordPattern;
// let chordPatternRoot = /*state*/chordPatternRoot;
// let highlightedPatternNotes = /*state*/highlightedPatternNotes;
// let selectedScale = /*state*/selectedScale;
// let selectedMode = /*state*/selectedMode;
// let scaleRoot = /*state*/scaleRoot;
// let highlightedScaleNotes = /*state*/highlightedScaleNotes;
// let coordinateCache = /*state*/coordinateCache;
// let coordinatePatternCache = /*state*/coordinatePatternCache;
// let highlightedChordsCache = /*state*/highlightedChordsCache;
// let lastSelectedNotesHash = /*state*/lastSelectedNotesHash;
// let debouncedChordTimeout = /*state*/debouncedChordTimeout;
// let throttledDragTimeout = /*state*/throttledDragTimeout;

// import { writable } from 'svelte/store';

// export interface Coordinate {
// 	q: number;
// 	r: number;
// }

// export interface TonnetzSystem {
// 	currentRootNote: typeof writable<number>;
// 	showMusicalLabels: typeof writable<boolean>;
// 	singleOctave: typeof writable<boolean>;
// 	currentTonnetzName: typeof writable<string>;
// 	qInterval: typeof writable<number>;
// 	rInterval: typeof writable<number>;
// 	highlightedNote: typeof writable<string | null>;
// 	isDragging: typeof writable<boolean>;
// 	isShiftPressed: typeof writable<boolean>;
// 	selectedNotes: typeof writable<Set<string>>;
// 	selectedChordPattern: typeof writable<string | null>;
// 	chordPatternRoot: typeof writable<string | null>;
// 	highlightedPatternNotes: typeof writable<Set<string>>;
// 	selectedScale: typeof writable<string | null>;
// 	selectedMode: typeof writable<string | null>;
// 	scaleRoot: typeof writable<string | null>;
// 	highlightedScaleNotes: typeof writable<Set<string>>;
// 	// Performance caches (not reactive)
// 	_coordinateCache: Map<string, Coordinate>;
// 	_coordinatePatternCache: Map<string, string>;
// 	_highlightedChordsCache: Set<string>;
// 	_lastSelectedNotesHash: string;
// 	_debouncedChordTimeout: ReturnType<typeof setTimeout> | null;
// 	_throttledDragTimeout: ReturnType<typeof setTimeout> | null;
// }

// export const createTonnetzSystem = (config): TonnetzSystem => {
// 	// Create reactive stores for UI state
// 	const state = {
// 		currentRootNote: writable(config.music.rootNote),
// 		showMusicalLabels: writable(true),
// 		singleOctave: writable(config.music.singleOctave),
// 		currentTonnetzName: writable(config.tonnetz.name),
// 		qInterval: writable(config.tonnetz.qInterval),
// 		rInterval: writable(config.tonnetz.rInterval),
// 		highlightedNote: writable<string | null>(null),
// 		isDragging: writable(false),
// 		isShiftPressed: writable(false),
// 		selectedNotes: writable(new Set<string>()),
// 		selectedChordPattern: writable<string | null>(null),
// 		chordPatternRoot: writable<string | null>(null),
// 		highlightedPatternNotes: writable(new Set<string>()),
// 		selectedScale: writable<string | null>(null),
// 		selectedMode: writable<string | null>(null),
// 		scaleRoot: writable<string | null>(null),
// 		highlightedScaleNotes: writable(new Set<string>())
// 	};

// 	// Non-reactive internal state (prefixed with _)
// 	const internalState = {
// 		_coordinateCache: new Map<string, Coordinate>(),
// 		_coordinatePatternCache: new Map<string, string>(),
// 		_highlightedChordsCache: new Set<string>(),
// 		_lastSelectedNotesHash: '',
// 		_debouncedChordTimeout: null as ReturnType<typeof setTimeout> | null,
// 		_throttledDragTimeout: null as ReturnType<typeof setTimeout> | null
// 	};

// 	// Return combined state
// 	return {
// 		...state,
// 		...internalState
// 	};
// };
