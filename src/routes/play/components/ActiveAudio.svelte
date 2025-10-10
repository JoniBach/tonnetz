<script lang="ts">
	import { get } from 'svelte/store';
	import { gridStore } from '../stores/gridStore';
	import { uiStore } from '../stores/uiStore';
	import { audioStore } from '../stores/audioStore';
	import { onMount, onDestroy } from 'svelte';
	import * as Tone from 'tone';

	let polySynth: Tone.PolySynth;
	let filter: Tone.Filter;
	let heldNotes = new Set<string>();
	let audioStarted = false;
	let updateScheduled = false;

	function scheduleUpdate() {
		if (!updateScheduled) {
			updateScheduled = true;
			requestAnimationFrame(() => {
				updateScheduled = false;
				updateActiveNotes();
			});
		}
	}

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
		if (!audioStarted) {
			await Tone.start();
			audioStarted = true;
		}
		polySynth.triggerAttack(note, Tone.now());
		heldNotes.add(note);
	}

	function stopNote(note: string) {
		polySynth.triggerRelease(note, Tone.now());
		heldNotes.delete(note);
	}

	function updateSynthConfig() {
		const config = get(audioStore);

		if (polySynth) {
			polySynth.set({
				oscillator: { type: config.oscillatorType },
				envelope: config.envelope,
				volume: config.volume,
				portamento: config.portamento
			});
		}

		if (filter && config.filter) {
			filter.set({
				type: config.filter.type,
				frequency: config.filter.frequency,
				Q: config.filter.Q
			});
		}
	}

	onMount(() => {
		const config = get(audioStore);

		// Create filter
		filter = new Tone.Filter({
			type: config.filter?.type || 'lowpass',
			frequency: config.filter?.frequency || 1000,
			Q: config.filter?.Q || 1
		}).toDestination();

		// Create synth with filter
		polySynth = new Tone.PolySynth({
			maxPolyphony: 16,
			voice: Tone.Synth,
			options: {
				oscillator: { type: config.oscillatorType },
				envelope: config.envelope,
				volume: config.volume,
				portamento: config.portamento
			}
		}).connect(filter);

		// Subscribe to stores with debouncing
		const unsubGrid = gridStore.subscribe(scheduleUpdate);
		const unsubUI = uiStore.subscribe(scheduleUpdate);
		const unsubAudio = audioStore.subscribe(updateSynthConfig);

		updateActiveNotes();

		return () => {
			unsubGrid();
			unsubUI();
			unsubAudio();

			// Clean up audio
			for (const note of heldNotes) {
				polySynth.triggerRelease(note);
			}
			heldNotes.clear();

			polySynth.dispose();
			filter.dispose();
		};
	});
</script>
