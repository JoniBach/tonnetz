<script lang="ts">
	import { get } from 'svelte/store';
	import { gridStore } from '../stores/gridStore';
	import { uiStore } from '../stores/uiStore';
	import { onMount, onDestroy } from 'svelte';
	import * as Tone from 'tone';
	import { audioStore } from '../stores/audioStore';

	let polySynth: Tone.PolySynth;
	let heldNotes = new Set<string>();
	let config: any;

	// Subscribe to audio store and update synth safely
	const unsubscribeConfig = audioStore.subscribe((c) => {
		// Ensure envelope fields exist and are valid
		const envelope = {
			attack: c.envelope?.attack ?? 0.05,
			decay: c.envelope?.decay ?? 0.2,
			sustain: Math.min(Math.max(c.envelope?.sustain ?? 0.5, 0), 1),
			release: c.envelope?.release ?? 0.1
		};

		config = { ...c, envelope };

		if (polySynth) {
			polySynth.set({
				oscillator: { type: config.oscillatorType ?? 'sine' },
				envelope,
				volume: config.volume ?? -12, // safe default volume
				portamento: config.portamento ?? 0 // default glide
			});

			if (config.filter) {
				polySynth.set({
					filter: {
						type: config.filter.type ?? 'lowpass',
						frequency: config.filter.frequency ?? 20000,
						Q: config.filter.Q ?? 1
					}
				});
			}
		}
	});

	// Update currently active notes
	function updateActiveNotes() {
		const $gridStore = get(gridStore);
		const $uiStore = get(uiStore);
		const newActive = new Set<string>();

		for (const [id, point] of $gridStore.points.entries()) {
			if ($uiStore.nodeStates[id]?.interaction === 'active') {
				newActive.add(point.note);
			}
		}

		// Start new notes
		Array.from(newActive)
			.filter((n) => !heldNotes.has(n))
			.forEach((note) => startNote(note));

		// Stop notes no longer active
		Array.from(heldNotes)
			.filter((n) => !newActive.has(n))
			.forEach((note) => stopNote(note));
	}

	async function startNote(note: string) {
		await Tone.start();
		const fullNote = note.match(/\d/) ? note : note + '4';
		polySynth.triggerAttack(fullNote);
		heldNotes.add(note);
	}

	function stopNote(note: string) {
		const fullNote = note.match(/\d/) ? note : note + '4';
		polySynth.triggerRelease(fullNote);
		heldNotes.delete(note);
	}

	onMount(() => {
		// Initialize PolySynth with safe defaults
		polySynth = new Tone.PolySynth(Tone.Synth, {
			maxPolyphony: 16,
			oscillator: { type: 'sine' },
			envelope: { attack: 0.05, decay: 0.2, sustain: 0.5, release: 0.1 },
			volume: -12 // default volume in dB
		}).toDestination();

		const unsubscribeGrid = gridStore.subscribe(updateActiveNotes);
		const unsubscribeUI = uiStore.subscribe(updateActiveNotes);

		// Initial note update
		updateActiveNotes();

		onDestroy(() => {
			unsubscribeGrid();
			unsubscribeUI();
			unsubscribeConfig();
			heldNotes.forEach((note) => {
				const fullNote = note.match(/\d/) ? note : note + '4';
				polySynth.triggerRelease(fullNote);
			});
			heldNotes.clear();
			polySynth.dispose();
		});
	});
</script>
