// Audio manager for Tone.js integration - follows clean coding principles
import * as Tone from 'tone';
import { 
	notesToToneFormat, 
	sortNotesByFrequency, 
	createPlaybackTimings, 
	calculateNoteDuration,
	bpmToNoteDuration,
	delay,
	validateAudioConfig
} from './audio-utils.js';

/**
 * Audio Manager class for handling Tone.js synthesizer and playback
 */
export class AudioManager {
	constructor(config) {
		if (!validateAudioConfig(config)) {
			throw new Error('Invalid audio configuration');
		}
		
		this.config = config;
		this.synth = null;
		this.reverb = null;
		this.delayEffect = null;
		this.isInitialized = false;
		this.isPlaying = false;
		this.currentPlayback = null;
		
		// Bind methods to preserve context
		this.init = this.init.bind(this);
		this.playChord = this.playChord.bind(this);
		this.playNotes = this.playNotes.bind(this);
		this.stop = this.stop.bind(this);
		this.updateConfig = this.updateConfig.bind(this);
	}

	/**
	 * Initialize Tone.js audio context and synthesizer
	 */
	async init() {
		if (this.isInitialized) return;

		try {
			// Start Tone.js audio context
			if (Tone.context.state !== 'running') {
				await Tone.start();
			}

			// Create synthesizer with current instrument settings
			this.createSynthesizer();
			
			// Create effects chain
			this.createEffects();
			
			// Connect audio chain
			this.connectAudioChain();
			
			this.isInitialized = true;
			console.log('Audio Manager initialized successfully');
		} catch (error) {
			console.error('Failed to initialize Audio Manager:', error);
			throw error;
		}
	}

	/**
	 * Create synthesizer based on current instrument configuration
	 */
	createSynthesizer() {
		// Dispose of existing synth if it exists
		if (this.synth) {
			this.synth.dispose();
		}

		const instrumentConfig = this.config.instruments[this.config.instrument];
		
		// Create polyphonic synthesizer for chord playback
		this.synth = new Tone.PolySynth(Tone.Synth, {
			oscillator: instrumentConfig.oscillator,
			envelope: instrumentConfig.envelope,
			volume: this.config.volume
		});
	}

	/**
	 * Create audio effects
	createEffects() {
		// Dispose of existing effects
		if (this.reverb) this.reverb.dispose();
		if (this.delayEffect) this.delayEffect.dispose();

		// Create reverb with correct Tone.js parameters
		this.reverb = new Tone.Reverb({
			roomSize: this.config.effects.reverb.roomSize,
			dampening: this.config.effects.reverb.dampening
		});

		// Create delay with correct Tone.js parameters
		this.delayEffect = new Tone.FeedbackDelay({
			delayTime: this.config.effects.delay.delayTime,
			feedback: this.config.effects.delay.feedback,
			wet: this.config.effects.delay.wet
		});
	}

	/**
	 * Connect audio processing chain
{{ ... }}
	 */
	connectAudioChain() {
		// Connect: Synth -> Delay -> Reverb -> Destination
		this.synth.connect(this.delayEffect);
		this.delayEffect.connect(this.reverb);
		this.reverb.toDestination();
	}

	/**
	 * Play a chord (all notes simultaneously)
	 * @param {string[]} notes - Array of note names
	 * @param {number} duration - Duration in seconds (optional)
	 */
	async playChord(notes, duration = null) {
		if (!this.isInitialized) {
			await this.init();
		}

		if (this.isPlaying) {
			this.stop();
		}

		try {
			const toneNotes = notesToToneFormat(notes, this.config.singleOctave);
			const playDuration = duration || bpmToNoteDuration(this.config.tempo, this.config.noteDuration);
			
			this.isPlaying = true;
			
			// Play all notes at once
			this.synth.triggerAttackRelease(toneNotes, playDuration);
			
			// Set timeout to reset playing state
			this.currentPlayback = setTimeout(() => {
				this.isPlaying = false;
				this.currentPlayback = null;
			}, playDuration * 1000);
			
		} catch (error) {
			console.error('Error playing chord:', error);
			this.isPlaying = false;
		}
	}

	/**
	 * Play notes with specified playback mode (sequential, arpeggio, or chord)
	 * @param {string[]} notes - Array of note names
	 * @param {string} playbackMode - 'sequential', 'arpeggio', or 'chord'
	 * @param {number} totalDuration - Total duration for the sequence (optional)
	 */
	async playNotes(notes, playbackMode = null, totalDuration = null) {
		if (!this.isInitialized) {
			await this.init();
		}

		if (this.isPlaying) {
			this.stop();
		}

		try {
			const mode = playbackMode || this.config.playbackMode;
			const toneNotes = notesToToneFormat(notes, this.config.singleOctave);
			const sortedNotes = sortNotesByFrequency(toneNotes, this.config.singleOctave);
			
			// Calculate timing
			const baseDuration = bpmToNoteDuration(this.config.tempo, this.config.noteDuration);
			const sequenceDuration = totalDuration || baseDuration * sortedNotes.length;
			const noteDuration = calculateNoteDuration(sequenceDuration, sortedNotes.length, mode);
			const timings = createPlaybackTimings(sortedNotes.length, sequenceDuration, mode);
			
			this.isPlaying = true;

			if (mode === 'chord') {
				// Play as chord
				this.synth.triggerAttackRelease(sortedNotes, noteDuration);
			} else {
				// Play sequentially or as arpeggio
				await this.playSequence(sortedNotes, timings, noteDuration);
			}
			
			// Set timeout to reset playing state
			this.currentPlayback = setTimeout(() => {
				this.isPlaying = false;
				this.currentPlayback = null;
			}, sequenceDuration * 1000);
			
		} catch (error) {
			console.error('Error playing notes:', error);
			this.isPlaying = false;
		}
	}

	/**
	 * Play a sequence of notes with specified timings
	 * @param {string[]} notes - Array of note names
	 * @param {number[]} timings - Array of start times in seconds
	 * @param {number} noteDuration - Duration for each note
	 */
	async playSequence(notes, timings, noteDuration) {
		const promises = notes.map(async (note, index) => {
			const startTime = timings[index] * 1000; // Convert to milliseconds
			
			if (startTime > 0) {
				await delay(startTime);
			}
			
			if (this.isPlaying) { // Check if still playing
				this.synth.triggerAttackRelease(note, noteDuration);
			}
		});

		await Promise.all(promises);
	}

	/**
	 * Stop current playback
	 */
	stop() {
		if (this.currentPlayback) {
			clearTimeout(this.currentPlayback);
			this.currentPlayback = null;
		}
		
		if (this.synth) {
			this.synth.releaseAll();
		}
		
		this.isPlaying = false;
	}

	/**
	 * Update audio configuration
	 * @param {Object} newConfig - New configuration object
	 */
	updateConfig(newConfig) {
		const oldInstrument = this.config.instrument;
		this.config = { ...this.config, ...newConfig };
		
		// Recreate synthesizer if instrument changed
		if (this.isInitialized && oldInstrument !== this.config.instrument) {
			this.createSynthesizer();
			this.connectAudioChain();
		}
		
		// Update volume if synth exists
		if (this.synth) {
			this.synth.volume.value = this.config.volume;
		}
	}

	/**
	 * Get current playing state
	 * @returns {boolean} Whether audio is currently playing
	 */
	getPlayingState() {
		return this.isPlaying;
	}

	/**
	 * Dispose of all audio resources
	 */
	dispose() {
		this.stop();
		
		if (this.synth) {
			this.synth.dispose();
			this.synth = null;
		}
		
		if (this.reverb) {
			this.reverb.dispose();
			this.reverb = null;
		}
		
		if (this.delayEffect) {
			this.delayEffect.dispose();
			this.delayEffect = null;
		}
		
		this.isInitialized = false;
	}
}

/**
 * Factory function to create AudioManager instance
 * @param {Object} config - Audio configuration
 * @returns {AudioManager} New AudioManager instance
 */
export const createAudioManager = (config) => {
	return new AudioManager(config);
};

/**
 * Utility function to play a quick chord preview
 * @param {string[]} notes - Array of note names
 * @param {Object} config - Audio configuration
 */
export const playChordPreview = async (notes, config) => {
	const audioManager = createAudioManager(config);
	try {
		await audioManager.playChord(notes, 1.0); // 1 second duration
		// Auto-dispose after a short delay
		setTimeout(() => audioManager.dispose(), 2000);
	} catch (error) {
		console.error('Error playing chord preview:', error);
		audioManager.dispose();
	}
};
