// Pure utility functions for audio processing - no dependencies on global scope

/**
 * Converts a note name to a frequency in Hz
 * @param {string} noteName - Note name (e.g., 'C4', 'F#3')
 * @param {boolean} singleOctave - Whether to use single octave mode
 * @returns {number} Frequency in Hz
 */
export const noteToFrequency = (noteName, singleOctave = false) => {
	// If single octave mode, append octave 4 as default
	const fullNoteName = singleOctave && !noteName.match(/\d/) ? `${noteName}4` : noteName;
	
	// Parse note name and octave
	const noteMatch = fullNoteName.match(/^([A-G][#b]?)(\d+)$/);
	if (!noteMatch) {
		console.warn(`Invalid note name: ${fullNoteName}`);
		return 440; // Default to A4
	}
	
	const [, note, octaveStr] = noteMatch;
	const octave = parseInt(octaveStr, 10);
	
	// Note to semitone mapping (C4 = 0)
	const noteToSemitone = {
		'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3, 'E': 4, 'F': 5,
		'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8, 'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11
	};
	
	const semitone = noteToSemitone[note];
	if (typeof semitone === 'undefined') {
		console.warn(`Unknown note: ${note}`);
		return 440;
	}
	
	// Calculate frequency: A4 = 440Hz is 9 semitones above C4
	const semitonesFromC4 = (octave - 4) * 12 + semitone;
	const semitonesFromA4 = semitonesFromC4 - 9;
	
	return 440 * Math.pow(2, semitonesFromA4 / 12);
};

/**
 * Converts note names to Tone.js compatible format
 * @param {string[]} notes - Array of note names
 * @param {boolean} singleOctave - Whether to use single octave mode
 * @returns {string[]} Array of Tone.js compatible note names
 */
export const notesToToneFormat = (notes, singleOctave = false) => {
	return notes.map(note => {
		// If single octave mode and no octave specified, add octave 4
		if (singleOctave && !note.match(/\d/)) {
			return `${note}4`;
		}
		return note;
	});
};

/**
 * Sorts notes by frequency (lowest to highest)
 * @param {string[]} notes - Array of note names
 * @param {boolean} singleOctave - Whether to use single octave mode
 * @returns {string[]} Sorted array of notes
 */
export const sortNotesByFrequency = (notes, singleOctave = false) => {
	return [...notes].sort((a, b) => 
		noteToFrequency(a, singleOctave) - noteToFrequency(b, singleOctave)
	);
};

/**
 * Creates timing intervals for sequential note playback
 * @param {number} noteCount - Number of notes to play
 * @param {number} totalDuration - Total duration in seconds
 * @param {string} playbackMode - 'sequential', 'arpeggio', or 'chord'
 * @returns {number[]} Array of start times in seconds
 */
export const createPlaybackTimings = (noteCount, totalDuration, playbackMode = 'sequential') => {
	switch (playbackMode) {
		case 'chord': {
			// All notes start at the same time
			return new Array(noteCount).fill(0);
		}
		
		case 'arpeggio': {
			// Notes start at equal intervals, but overlap
			const interval = totalDuration / (noteCount + 1);
			return Array.from({ length: noteCount }, (_, i) => i * interval);
		}
		
		case 'sequential':
		default: {
			// Notes play one after another with no overlap
			const noteDuration = totalDuration / noteCount;
			return Array.from({ length: noteCount }, (_, i) => i * noteDuration);
		}
	}
};

/**
 * Calculates note duration based on playback mode
 * @param {number} totalDuration - Total duration in seconds
 * @param {number} noteCount - Number of notes
 * @param {string} playbackMode - 'sequential', 'arpeggio', or 'chord'
 * @returns {number} Duration for each note in seconds
 */
export const calculateNoteDuration = (totalDuration, noteCount, playbackMode = 'sequential') => {
	switch (playbackMode) {
		case 'chord': {
			return totalDuration; // All notes play for full duration
		}
		
		case 'arpeggio': {
			return totalDuration * 0.6; // Notes overlap with 60% of total duration
		}
		
		case 'sequential':
		default: {
			return totalDuration / noteCount; // Each note gets equal time
		}
	}
};

/**
 * Validates audio configuration
 * @param {Object} config - Audio configuration object
 * @returns {boolean} Whether configuration is valid
 */
export const validateAudioConfig = (config) => {
	const required = ['volume', 'instrument', 'playbackMode', 'tempo'];
	return required.every(key => Object.prototype.hasOwnProperty.call(config, key));
};

/**
 * Creates a delay promise for timing control
 * @param {number} ms - Milliseconds to delay
 * @returns {Promise<void>} Promise that resolves after delay
 */
export const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Converts BPM to note duration in seconds
 * @param {number} bpm - Beats per minute
 * @param {string} noteValue - Note value ('quarter', 'eighth', 'half', 'whole')
 * @returns {number} Duration in seconds
 */
export const bpmToNoteDuration = (bpm, noteValue = 'quarter') => {
	const quarterNoteDuration = 60 / bpm; // Quarter note duration in seconds
	
	const multipliers = {
		'whole': 4,
		'half': 2,
		'quarter': 1,
		'eighth': 0.5,
		'sixteenth': 0.25
	};
	
	const multiplier = multipliers[noteValue];
	return quarterNoteDuration * (typeof multiplier === 'number' ? multiplier : 1);
};

/**
 * Filters out duplicate notes (same pitch class)
 * @param {string[]} notes - Array of note names
 * @returns {string[]} Array with duplicates removed
 */
export const removeDuplicateNotes = (notes) => {
	const seen = new Set();
	return notes.filter(note => {
		const pitchClass = note.replace(/\d+$/, ''); // Remove octave number
		if (seen.has(pitchClass)) {
			return false;
		}
		seen.add(pitchClass);
		return true;
	});
};
