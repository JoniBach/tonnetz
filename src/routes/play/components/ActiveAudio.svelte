<script lang="ts">
	import { get } from 'svelte/store';
	import { gridStore } from '../stores/gridStore';
	import { uiStore } from '../stores/uiStore';
	import { onMount, onDestroy } from 'svelte';
	import * as Tone from 'tone';

	let polySynth: Tone.PolySynth;
	let heldNotes = new Set<string>();

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
		for (const note of newActive) {
			if (!heldNotes.has(note)) {
				startNote(note);
			}
		}

		// Stop notes no longer active
		for (const note of heldNotes) {
			if (!newActive.has(note)) {
				stopNote(note);
			}
		}
	}

	async function startNote(note: string) {
		await Tone.start();
		polySynth.triggerAttack(note);
		heldNotes.add(note);
	}

	function stopNote(note: string) {
		polySynth.triggerRelease(note);
		heldNotes.delete(note);
	}

	onMount(() => {
		polySynth = new Tone.PolySynth(Tone.Synth, {
			maxPolyphony: 16,
			oscillator: { type: 'sine' },
			envelope: { attack: 0.05, decay: 0.2, sustain: 0.5, release: 0.1 },
			volume: -12
		}).toDestination();

		const unsubGrid = gridStore.subscribe(updateActiveNotes);
		const unsubUI = uiStore.subscribe(updateActiveNotes);

		updateActiveNotes();

		onDestroy(() => {
			unsubGrid();
			unsubUI();
			for (const note of heldNotes) {
				polySynth.triggerRelease(note);
			}
			heldNotes.clear();
			polySynth.dispose();
		});
	});
</script>
