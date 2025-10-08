<script lang="ts">
	import { get } from 'svelte/store';
	import { gridStore } from '../stores/gridStore';
	import { uiStore } from '../stores/uiStore';
	import { onMount, onDestroy } from 'svelte';
	import * as Tone from 'tone';

	let activeNotes = new Set<string>();
	const playingNotes = new Map<string, Tone.Synth>();

	function updateActiveNotes() {
		const $gridStore = get(gridStore);
		const $uiStore = get(uiStore);
		const newActiveNotes = new Set<string>();

		for (const [id, point] of $gridStore.points.entries()) {
			const nodeState = $uiStore.nodeStates[id];
			if (nodeState?.interaction === 'active') {
				newActiveNotes.add(point.note);
			}
		}

		// Start newly active notes
		newActiveNotes.forEach((note) => {
			if (!activeNotes.has(note)) startNote(note);
		});

		// Stop notes no longer active
		activeNotes.forEach((note) => {
			if (!newActiveNotes.has(note)) stopNote(note);
		});

		activeNotes = newActiveNotes;
	}

	async function startNote(note: string) {
		await Tone.start();
		const fullNote = note.match(/\d/) ? note : note + '4';

		const synth = new Tone.Synth().toDestination();
		synth.triggerAttack(fullNote);
		playingNotes.set(note, synth);
	}

	function stopNote(note: string) {
		const synth = playingNotes.get(note);
		if (synth) {
			synth.triggerRelease();
			playingNotes.delete(note);
		}
	}

	onMount(() => {
		const unsubscribeGrid = gridStore.subscribe(updateActiveNotes);
		const unsubscribeUI = uiStore.subscribe(updateActiveNotes);

		updateActiveNotes();

		onDestroy(() => {
			unsubscribeGrid();
			unsubscribeUI();
			// release all notes
			playingNotes.forEach((synth) => synth.triggerRelease());
		});
	});
</script>
