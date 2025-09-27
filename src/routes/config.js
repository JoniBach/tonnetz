import { presets, scales } from './patterns.js';

export const CONFIG = {
	// Core geometry
	baseTriangleSize: 100,
	gridExtent: 20,
	zoomRange: 1.5,

	// Visual styling
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

	// Typography
	label: {
		title: { fontSize: 8, color: '#666', fontFamily: 'Arial, sans-serif' },
		subtitle: { fontSize: 6, color: '#555', fontFamily: 'Arial, sans-serif' },
		spacing: 10
	},
	vertexLabel: { fontSize: 6, color: '#555', fontFamily: 'Arial, sans-serif' },

	// Music theory
	music: {
		rootNote: 'C',
		showMusicalLabels: true,
		singleOctave: true,
		octaveRange: { min: 0, max: 8 }
	},
	tonnetz: {
		qInterval: 7,
		rInterval: 4,
		name: 'Neo-Riemannian',
		presets: {
			'Neo-Riemannian': { qInterval: 7, rInterval: 4 },
			Chromatic: { qInterval: 1, rInterval: 1 },
			'Whole Tone': { qInterval: 2, rInterval: 2 },
			Quartal: { qInterval: 5, rInterval: 5 },
			Augmented: { qInterval: 4, rInterval: 8 },
			'Shepard Tone': { qInterval: 12, rInterval: 7 }
		}
	},

	// Highlighting
	highlight: {
		color: '#ff6b35',
		strokeWidth: 2,
		fillOpacity: 0.1,
		transitionDuration: 0.1,
		easing: 'ease'
	},

	// Patterns and scales
	chordPatterns: { presets },
	scales,
	modes: {
		'Ionian (Major)': 0,
		Dorian: -1,
		Phrygian: -2,
		Lydian: 1,
		Mixolydian: -1,
		'Aeolian (Minor)': -2,
		Locrian: -3
	},

	// Audio configuration
	audio: {
		volume: 10, // Volume in dB
		tempo: 120, // BPM
		playbackMode: 'arpeggio', // 'sequential', 'arpeggio', 'chord'
		noteDuration: 'quarter', // 'whole', 'half', 'quarter', 'eighth', 'sixteenth'
		instrument: 'synth', // 'synth', 'piano', 'guitar', 'bass'
		instruments: {
			synth: {
				oscillator: { type: 'triangle' },
				envelope: { attack: 0.1, decay: 0.2, sustain: 0.3, release: 1 }
			},
			piano: {
				oscillator: { type: 'sine' },
				envelope: { attack: 0.02, decay: 0.1, sustain: 0.2, release: 0.5 }
			},
			guitar: {
				oscillator: { type: 'sawtooth' },
				envelope: { attack: 0.01, decay: 0.3, sustain: 0.1, release: 2 }
			},
			bass: {
				oscillator: { type: 'square' },
				envelope: { attack: 0.1, decay: 0.3, sustain: 0.4, release: 1.5 }
			}
		},
		effects: {
			reverb: { roomSize: 0.3, dampening: 3000 },
			delay: { delayTime: 0.25, feedback: 0.1, wet: 0.1 }
		}
	},

	background: '#1a1a1a'
};
