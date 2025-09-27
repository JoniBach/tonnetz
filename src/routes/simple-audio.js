// Simple audio integration for tonnetz - focused on working functionality
import * as Tone from 'tone';

let synth = null;
let isInitialized = false;
let currentlyPlayingNotes = new Set();
let sustainedNotes = new Map(); // Map of note -> voice for sustained playback

/**
 * Initialize Tone.js audio context
 */
export const initAudio = async () => {
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
export const sustainNotes = async (notes) => {
	if (!isInitialized) {
		await initAudio();
	}
	
	if (!synth || !notes) return;
	
	// Convert notes to proper format (add octave if missing) - optimized
	const toneNotes = notes.map(note => 
		note.match(/\d/) ? note : `${note}4`
	);
	
	// Quick check if notes have actually changed to avoid unnecessary work
	const newNotesSet = new Set(toneNotes);
	const currentNotesSet = new Set(sustainedNotes.keys());
	
	// Only proceed if there are actual changes
	if (newNotesSet.size === currentNotesSet.size && 
		[...newNotesSet].every(note => currentNotesSet.has(note))) {
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
export const stopSustainedNotes = () => {
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
export const playNotes = async (notes, mode = 'arpeggio') => {
	await sustainNotes(notes);
};

/**
 * Stop all currently playing notes
 */
export const stopAudio = () => {
	stopSustainedNotes();
	if (synth) {
		synth.releaseAll();
	}
};

/**
 * Update audio settings
 */
export const updateAudioSettings = (settings) => {
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
export const disposeAudio = () => {
	if (synth) {
		synth.dispose();
		synth = null;
	}
	isInitialized = false;
};
