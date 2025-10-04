import * as d3 from 'd3';

// Event System
type EventHandler<T = any> = (data: T) => void;
type EventHandlers = Map<string, Set<EventHandler>>;

// Audio context state
interface AudioState {
	audioContext: AudioContext | null;
	activeOscillators: Set<OscillatorNode>;
	activeAudioBuffers: Set<AudioBufferSourceNode>;
}

// Main application state
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
}

// Initialize audio state
const createAudioState = (): AudioState => ({
	audioContext: null,
	activeOscillators: new Set<OscillatorNode>(),
	activeAudioBuffers: new Set<AudioBufferSourceNode>()
});

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
		// Performance caches
		coordinateCache: new Map<string, { q: number; r: number }>(),
		coordinatePatternCache: new Map<string, string>(),
		highlightedChordsCache: new Set<string>(),
		lastSelectedNotesHash: '',
		debouncedChordTimeout: null,
		throttledDragTimeout: null,
		audioState: createAudioState(),
		autoPlayTimeout: null,
		isPlaying: false
		// ... rest of your state
	});

	// Event handlers
	const handleMouseDown = (state: TonnetzState, event: MouseEvent) => {
		if (event.button !== 0) return;
		eventSystem.emit('MOUSE_DOWN', {
			x: event.clientX,
			y: event.clientY,
			target: event.target,
			shiftKey: event.shiftKey
		});
	};

	const handleGlobalMouseUp = (state: TonnetzState, event: MouseEvent) => {
		if (state.isDragging) {
			state.isDragging = false;
			eventSystem.emit('MOUSE_UP', {
				x: event.clientX,
				y: event.clientY,
				target: event.target
			});
		}
	};

	const handleKeyDown = (state: TonnetzState, event: KeyboardEvent) => {
		if (event.key === 'Shift') {
			state.isShiftPressed = true;
		}
		eventSystem.emit('KEY_DOWN', { key: event.key });
		console.log('shiftdown');
	};

	const handleKeyUp = (state: TonnetzState, event: KeyboardEvent) => {
		if (event.key === 'Shift') {
			state.isShiftPressed = false;
		}
		eventSystem.emit('KEY_UP', { key: event.key });
		console.log('shiftup');
	};

	// Setup function to be called from component's onMount
	const setupEventListeners = (state: TonnetzState, container: HTMLElement, svg: SVGSVGElement) => {
		// Create bound event handlers
		const boundHandleMouseUp = (e: MouseEvent) => handleGlobalMouseUp(state, e);
		const boundHandleKeyDown = (e: KeyboardEvent) => handleKeyDown(state, e);
		const boundHandleKeyUp = (e: KeyboardEvent) => handleKeyUp(state, e);
		const boundHandleMouseDown = (e: MouseEvent) => handleMouseDown(state, e);

		// Set up global listeners
		window.addEventListener('mouseup', boundHandleMouseUp);
		window.addEventListener('keydown', boundHandleKeyDown);
		window.addEventListener('keyup', boundHandleKeyUp);

		// Set up SVG listeners
		d3.select(svg).on('mousedown', boundHandleMouseDown);

		// Set up reactive updates
		const unsubscribe = eventSystem.on('STATE_UPDATE', () => {
			eventSystem.emit('UPDATE_VIEW');
		});

		// Return cleanup function
		return () => {
			window.removeEventListener('mouseup', boundHandleMouseUp);
			window.removeEventListener('keydown', boundHandleKeyDown);
			window.removeEventListener('keyup', boundHandleKeyUp);
			d3.select(svg).on('mousedown', null);
			unsubscribe();
		};
	};

	const cleanup = (state: TonnetzState) => {
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
	};
	// Create the state instance
	const state = createState();

	// Return the state along with bound methods
	return {
		...state,
		handleMouseDown: (e: MouseEvent) => handleMouseDown(state, e),
		handleGlobalMouseUp: (e: MouseEvent) => handleGlobalMouseUp(state, e),
		handleKeyDown: (e: KeyboardEvent) => handleKeyDown(state, e),
		handleKeyUp: (e: KeyboardEvent) => handleKeyUp(state, e),
		setupEventListeners: (container: HTMLElement, svg: SVGSVGElement) =>
			setupEventListeners(state, container, svg),
		cleanup: () => cleanup(state)
	};
};

// Export EventSystem for use in components
export { EventSystem };
