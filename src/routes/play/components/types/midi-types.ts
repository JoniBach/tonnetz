/**
 * MIDI-compatible type definitions for musical notation
 * Based on standard MIDI JSON format (Tone.js, midi-json-parser, etc.)
 */

export type MidiNote = {
	/** Note name (e.g., "C4", "D#5", "Bb3") */
	name: string;
	/** MIDI note number (0-127) */
	midi: number;
	/** Start time in seconds */
	time: number;
	/** Note velocity (0-1) */
	velocity: number;
	/** Duration in seconds */
	duration: number;
	/** Optional lyric text */
	lyric?: string;
};

export type TimeSignature = {
	/** Absolute time in ticks */
	absoluteTime?: number;
	/** Time in seconds */
	seconds?: number;
	/** Top number (beats per measure) */
	numerator: number;
	/** Bottom number (note value) */
	denominator: number;
	/** MIDI clock ticks per click */
	click?: number;
	/** Number of 32nd notes per quarter note */
	notesQ?: number;
};

export type Tempo = {
	/** Absolute time in ticks */
	absoluteTime?: number;
	/** Time in seconds */
	seconds?: number;
	/** Beats per minute */
	bpm: number;
};

export type ControlChange = {
	/** Control change number (0-127) */
	number: number;
	/** Control change value (0-127) */
	value: number;
	/** Time in seconds */
	time: number;
};

export type Track = {
	/** Track start time in seconds */
	startTime: number;
	/** Track duration in seconds */
	duration: number;
	/** Number of events in track */
	length: number;
	/** Array of notes in the track */
	notes: MidiNote[];
	/** Control changes by CC number */
	controlChanges: Record<number, ControlChange[]>;
	/** Track ID */
	id: number;
	/** Track name */
	name: string;
	/** Instrument name (optional) */
	instrument?: string;
	/** Channel number (0-15) */
	channel?: number;
};

export type MidiHeader = {
	/** Pulses per quarter note */
	PPQ: number;
	/** Tempo in BPM */
	bpm: number;
	/** Time signature [numerator, denominator] */
	timeSignature: [number, number];
	/** Song/piece name */
	name: string;
	/** Key signature (optional) */
	keySignature?: string;
};

export type MidiData = {
	/** MIDI file header information */
	header: MidiHeader;
	/** Tempo changes throughout the piece */
	tempo: Tempo[];
	/** Time signature changes */
	timeSignature: TimeSignature[];
	/** Start time of the piece */
	startTime: number;
	/** Total duration in seconds */
	duration: number;
	/** Array of tracks */
	tracks: Track[];
};

/**
 * Notation-specific types for rendering
 */
export type NotationElement = 
	| { type: 'note'; note: MidiNote }
	| { type: 'barline'; style: 'single' | 'double' | 'final' | 'repeat' }
	| { type: 'clef'; clefType: 'treble' | 'bass' | 'alto' | 'tenor' }
	| { type: 'timeSignature'; signature: TimeSignature }
	| { type: 'rest'; duration: number; time: number }
	| { type: 'tempo'; tempo: Tempo };

/**
 * Staff configuration
 */
export type StaffConfig = {
	/** Staff title */
	title?: string;
	/** Staff subtitle */
	subtitle?: string;
	/** Font size in pixels */
	fontSize: number;
	/** Staff type */
	staff: string;
	/** Show clef */
	clef?: boolean | string;
	/** Time signature */
	timeSignature?: TimeSignature;
	/** Variant (single, dual, normal) */
	variant?: string;
	/** Key signature */
	keySignature?: string;
};

/**
 * Converts MIDI note number to note name
 */
export function midiToNoteName(midi: number): string {
	const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
	const octave = Math.floor(midi / 12) - 1;
	const noteName = noteNames[midi % 12];
	return `${noteName}${octave}`;
}

/**
 * Converts note name to MIDI number
 */
export function noteNameToMidi(name: string): number {
	const noteMap: Record<string, number> = {
		C: 0, 'C#': 1, Db: 1,
		D: 2, 'D#': 3, Eb: 3,
		E: 4,
		F: 5, 'F#': 6, Gb: 6,
		G: 7, 'G#': 8, Ab: 8,
		A: 9, 'A#': 10, Bb: 10,
		B: 11
	};
	
	const match = name.match(/^([A-G][#b]?)(\d+)$/);
	if (!match) return 60; // Default to middle C
	
	const [, note, octave] = match;
	return (parseInt(octave) + 1) * 12 + (noteMap[note] ?? 0);
}

/**
 * Converts duration in seconds to note duration name
 */
export function secondsToDuration(seconds: number, bpm: number = 120): string {
	const quarterNoteSeconds = 60 / bpm;
	const ratio = seconds / quarterNoteSeconds;
	
	if (ratio >= 3.5) return 'Whole';
	if (ratio >= 1.75) return 'Half';
	if (ratio >= 0.875) return 'Quarter';
	if (ratio >= 0.4375) return '8th';
	if (ratio >= 0.21875) return '16th';
	if (ratio >= 0.109375) return '32nd';
	return '64th';
}
