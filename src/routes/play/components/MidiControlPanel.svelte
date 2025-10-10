<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';
	import * as Tone from 'tone';

	class MidiPlayer {
		synth: Tone.PolySynth | null = null;
		midiData: any = null;
		isPlaying = false;
		activeNotes = new Set<string>();
		onUpdate?: (notes: Set<string>) => void;

		constructor() {
			if (browser) {
				this.synth = new Tone.PolySynth(Tone.Synth).toDestination();
			}
		}

		async load(file: File) {
			const buffer = await file.arrayBuffer();
			if (!browser) return;
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

	let open = false;
	let player: MidiPlayer | null = null;
	let midiFile: File | null = null;
	let isPlaying = false;
	let activeNotes: Set<string> = new Set();
	let activeNotesJSON = '[]';
	let error: string | null = null;

	onMount(() => {
		if (!browser) return;
		player = new MidiPlayer();
		player.onUpdate = (notes) => {
			activeNotes = notes;
			activeNotesJSON = JSON.stringify(Array.from(notes));
		};
	});

	onDestroy(() => {
		if (browser && player) player.dispose();
	});

	function uploadFile() {
		const input = document.createElement('input');
		input.type = 'file';
		input.accept = '.mid,.midi';
		input.onchange = async () => {
			if (input.files?.length && player) {
				try {
					midiFile = input.files[0];
					await player.load(midiFile);
					error = null;
				} catch {
					error = 'Failed to load MIDI file';
				}
			}
		};
		input.click();
	}

	async function togglePlay() {
		if (!player || !midiFile) return;
		if (isPlaying) player.stop();
		else await player.play();
		isPlaying = !isPlaying;
	}
</script>

<div class="panel-wrapper">
	{#if !midiFile}
		<button class="upload-button" on:click={uploadFile}> Upload MIDI File </button>
	{:else}
		<button class="toggle-button" on:click={() => (open = !open)}>
			{open ? 'Close Panel' : 'Open Panel'}
		</button>

		{#if open}
			<div class="panel">
				<div class="file-info">
					Selected file: {midiFile.name}
				</div>

				<div class="controls">
					<button on:click={togglePlay}>
						{isPlaying ? '⏹️ Stop' : '▶️ Play'}
					</button>
					<button on:click={uploadFile}>Change File</button>
				</div>

				{#if error}
					<div class="error">{error}</div>
				{/if}

				<div>
					<h3>Active Notes</h3>
					<pre>{activeNotes.size > 0 ? activeNotesJSON : ''}</pre>
				</div>
			</div>
		{/if}
	{/if}
</div>

<style>
	.panel-wrapper {
		position: fixed;
		right: 1rem;
		top: 6rem;
		z-index: 1000;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.upload-button,
	.toggle-button {
		background: #4a90e2;
		color: white;
		border: none;
		padding: 0.4rem 0.8rem;
		border-radius: 6px;
		cursor: pointer;
		font-size: 0.85rem;
		box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
	}

	.panel {
		margin-top: 0.5rem;
		background: #fff;
		border: 1px solid #ccc;
		padding: 1rem;
		border-radius: 6px;
		width: 260px;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.file-info {
		font-size: 0.85rem;
		margin-bottom: 0.5rem;
	}

	.controls button {
		background: #4a90e2;
		color: white;
		border: none;
		padding: 0.4rem 0.8rem;
		border-radius: 6px;
		cursor: pointer;
		font-size: 0.85rem;
		margin-bottom: 0.3rem;
		width: 100%;
	}

	.controls button:last-child {
		background: #e74c3c;
	}

	.error {
		color: #e74c3c;
		font-size: 0.8rem;
	}
</style>
