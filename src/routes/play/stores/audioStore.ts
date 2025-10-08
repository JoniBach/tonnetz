import { writable } from 'svelte/store';
import type { Envelope, FilterType } from 'tone';

export type OscillatorType = 'sine' | 'square' | 'triangle' | 'sawtooth';
export type FilterTypes =
	| 'lowpass'
	| 'highpass'
	| 'bandpass'
	| 'lowshelf'
	| 'highshelf'
	| 'notch'
	| 'allpass'
	| 'peaking';

export interface AudioConfig {
	oscillatorType: OscillatorType;
	volume: number; // dB
	portamento: number; // time between notes
	envelope: EnvelopeParams;
	filter?: FilterParams;
}

export interface EnvelopeParams {
	attack: number;
	decay: number;
	sustain: number;
	release: number;
}

export interface FilterParams {
	type: FilterTypes;
	frequency: number;
	Q: number;
}

function createAudioStore() {
	const { subscribe, update, set } = writable<AudioConfig>({
		oscillatorType: 'sine',
		volume: -12,
		portamento: 0,
		envelope: { attack: 0.05, decay: 0.2, sustain: 0.5, release: 0.1 },
		filter: { type: 'lowpass', frequency: 1000, Q: 1 }
	});

	return {
		subscribe,

		// Oscillator
		setOscillatorType: (type: OscillatorType) =>
			update((cfg) => ({ ...cfg, oscillatorType: type })),

		// Volume
		setVolume: (dB: number) => update((cfg) => ({ ...cfg, volume: dB })),

		// Portamento
		setPortamento: (time: number) => update((cfg) => ({ ...cfg, portamento: time })),

		// Envelope
		setEnvelope: (env: Partial<EnvelopeParams>) =>
			update((cfg) => ({ ...cfg, envelope: { ...cfg.envelope, ...env } })),
		setAttack: (value: number) =>
			update((cfg) => ({ ...cfg, envelope: { ...cfg.envelope, attack: value } })),
		setDecay: (value: number) =>
			update((cfg) => ({ ...cfg, envelope: { ...cfg.envelope, decay: value } })),
		setSustain: (value: number) =>
			update((cfg) => ({ ...cfg, envelope: { ...cfg.envelope, sustain: value } })),
		setRelease: (value: number) =>
			update((cfg) => ({ ...cfg, envelope: { ...cfg.envelope, release: value } })),

		// Filter
		setFilter: (filter: Partial<FilterParams>) =>
			update((cfg) => ({ ...cfg, filter: { ...cfg.filter, ...filter } })),

		setFilterType: (type: FilterTypes) =>
			update((cfg) => ({ ...cfg, filter: { ...cfg.filter, type } })),
		setFilterFreq: (freq: number) =>
			update((cfg) => ({ ...cfg, filter: { ...cfg.filter, frequency: freq } })),
		setFilterQ: (Q: number) => update((cfg) => ({ ...cfg, filter: { ...cfg.filter, Q } })),

		// Replace entire config
		setConfig: (cfg: AudioConfig) => set(cfg)
	};
}

export const audioStore = createAudioStore();
