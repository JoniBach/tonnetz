<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';
	import * as Tone from 'tone';

	// ========================
	// 🎵 Local MidiPlayer class (browser-safe)
	// ========================
	class MidiPlayer {
		synth: Tone.PolySynth | null = null;
		midiData: any = null;
		isPlaying = false;
		activeNotes = new Set<string>();
		onUpdate?: (notes: Set<string>) => void;
		volume: number;

		constructor(volume = -10) {
			this.volume = volume;

			if (browser) {
				this.synth = new Tone.PolySynth(Tone.Synth).toDestination();
				this.synth.volume.value = volume;
			}
		}

		async load(file: File) {
			const buffer = await file.arrayBuffer();
			if (!browser) return;

			// Dynamic import for @tonejs/midi (avoids SSR issues)
			const pkg = await import('@tonejs/midi');
			const { Midi } = pkg;
			this.midiData = new Midi(buffer);
		}

		async play() {
			if (!this.midiData || !this.synth) return;
			await Tone.start();
			this.isPlaying = true;
			this.activeNotes.clear();
			this.update();

			const now = Tone.now();
			for (const track of this.midiData.tracks) {
				for (const note of track.notes) {
					this.synth.triggerAttack(note.name, now + note.time, note.velocity);
					setTimeout(() => this.add(note.name), note.time * 1000);

					this.synth.triggerRelease(note.name, now + note.time + note.duration);
					setTimeout(() => this.remove(note.name), (note.time + note.duration) * 1000);
				}
			}
		}

		stop() {
			if (this.synth) this.synth.releaseAll();
			this.activeNotes.clear();
			this.isPlaying = false;
			this.update();
		}

		setVolume(value: number) {
			if (this.synth) this.synth.volume.value = value;
			this.volume = value;
		}

		private add(note: string) {
			this.activeNotes.add(note);
			this.update();
		}

		private remove(note: string) {
			this.activeNotes.delete(note);
			this.update();
		}

		private update() {
			this.onUpdate?.(new Set(this.activeNotes));
		}

		dispose() {
			if (this.synth) this.synth.dispose();
			this.synth = null;
		}
	}

	// ========================
	// 🧠 Svelte UI logic
	// ========================
	let player: MidiPlayer | null = null;
	let midiFile: File | null = null;
	let isPlaying = false;
	let activeNotes: Set<string> = new Set();
	let activeNotesJSON = '[]';
	let volume = -10;
	let error: string | null = null;

	onMount(() => {
		if (!browser) return;
		player = new MidiPlayer(volume);
		player.onUpdate = (notes) => {
			activeNotes = notes;
			activeNotesJSON = JSON.stringify(Array.from(notes), null, 2);
		};
	});

	onDestroy(() => {
		if (browser && player) player.dispose();
	});

	async function handleFileSelect(e: Event) {
		if (!browser || !player) return;
		const input = e.target as HTMLInputElement;
		if (!input.files?.length) return;

		try {
			midiFile = input.files[0];
			await player.load(midiFile);
			error = null;
		} catch {
			error = 'Failed to load MIDI file';
		}
	}

	async function togglePlay() {
		if (!browser || !player || !midiFile) return;
		if (isPlaying) player.stop();
		else await player.play();
		isPlaying = !isPlaying;
	}

	function handleVolumeChange(e: Event) {
		if (!browser || !player) return;
		const value = parseFloat((e.target as HTMLInputElement).value);
		volume = value;
		player.setVolume(value);
	}
</script>

<!-- ========================
     UI
======================== -->
<div class="container">
	<h1>MIDI Player</h1>

	<div class="controls">
		<input type="file" accept=".mid,.midi" on:change={handleFileSelect} />
		<button on:click={togglePlay} disabled={!midiFile}>
			{isPlaying ? '⏹️ Stop' : '▶️ Play'}
		</button>

		<div class="volume-control">
			<span>🔊</span>
			<input
				type="range"
				min="-60"
				max="0"
				step="1"
				bind:value={volume}
				on:input={handleVolumeChange}
			/>
			<span>{Math.round(volume)}dB</span>
		</div>
	</div>

	{#if error}
		<div class="error">{error}</div>
	{/if}

	{#if isPlaying}
		<div class="active-notes">
			<h3>Active Notes (JSON)</h3>
			<pre>{activeNotesJSON}</pre>
		</div>
	{/if}
</div>
