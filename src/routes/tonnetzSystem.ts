import * as d3 from 'd3';
import * as Tone from 'tone';
import type { MidiPlayer } from './midiPlayer';

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
	midiPlayer: MidiPlayer | null;
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

// MIDI Player

// EventSystem export
export { EventSystem };
