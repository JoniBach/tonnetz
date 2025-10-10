<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';
	import * as Tone from 'tone';
	import { getCoordinatesFromNote } from '../stores/gridStore';
	import { uiStore } from '../stores/uiStore';

	class MidiPlayer {
		midiData: any = null;
		isPlaying = false;
		activeNotes = new Set<string>();
		scheduledEvents: number[] = [];
		onUpdate?: (notes: Set<string>) => void;

		async load(file: File) {
			const buffer = await file.arrayBuffer();
			if (!browser) return;
			const pkg = await import('@tonejs/midi');
			const { Midi } = pkg;
			this.midiData = new Midi(buffer);
		}

		async play() {
			if (!this.midiData) return;

			await Tone.start();
			this.stop(); // Clear any existing playback
			this.isPlaying = true;
			this.activeNotes.clear();
			this.update();

			const now = Tone.now() + 0.1; // Small offset for scheduling stability

			for (const track of this.midiData.tracks) {
				for (const note of track.notes) {
					const startTime = now + note.time;
					const endTime = startTime + note.duration;

					// Schedule note on
					const startId = Tone.Transport.scheduleOnce(() => {
						if (this.isPlaying) {
							this.add(note.name);
						}
					}, startTime);

					// Schedule note off
					const endId = Tone.Transport.scheduleOnce(() => {
						if (this.isPlaying) {
							this.remove(note.name);
						}
					}, endTime);

					this.scheduledEvents.push(startId as unknown as number, endId as unknown as number);
				}
			}

			Tone.Transport.start(now);
		}

		stop() {
			// Clear all scheduled events
			for (const eventId of this.scheduledEvents) {
				Tone.Transport.clear(eventId);
			}
			this.scheduledEvents = [];

			// Stop transport
			Tone.Transport.stop();
			Tone.Transport.cancel();

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
			if (this.onUpdate) {
				this.onUpdate(new Set(this.activeNotes));
			}
		}

		dispose() {
			this.stop();
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
			try {
				const coords = Array.from(notes).map((note) => getCoordinatesFromNote(note));
				uiStore.playNotes(coords);
				activeNotes = notes;
				activeNotesJSON = JSON.stringify(Array.from(notes));
			} catch (e) {
				console.error('Error updating notes:', e);
			}
		};
	});

	onDestroy(() => {
		if (browser && player) {
			player.dispose();
		}
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
				} catch (e) {
					error = 'Failed to load MIDI file';
					console.error(e);
				}
			}
		};
		input.click();
	}

	async function togglePlay() {
		if (!player || !midiFile) return;
		if (isPlaying) {
			player.stop();
			isPlaying = false;
		} else {
			await player.play();
			isPlaying = true;
		}
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
		width: 100px;
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
