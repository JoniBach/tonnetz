import type { Midi } from '@tonejs/midi';
import * as Tone from 'tone';

export class MidiPlayer {
	synth: Tone.PolySynth | null = null;
	midiData: Midi | null = null;
	isPlaying = false;
	activeNotes = new Set<string>();
	onUpdate?: (notes: Set<string>) => void;

	constructor(volume = -10, onUpdate?: (notes: Set<string>) => void) {
		this.onUpdate = onUpdate;

		if (typeof window !== 'undefined') {
			// Only create synth on client
			this.synth = new Tone.PolySynth({
				voice: Tone.Synth,
				volume: volume
			}).toDestination();
		}
	}

	async load(file: File) {
		const buffer = await file.arrayBuffer();

		// Dynamically import @tonejs/midi only on client
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
		if (this.onUpdate) this.onUpdate(new Set(this.activeNotes));
	}

	dispose() {
		if (this.synth) this.synth.dispose();
		this.synth = null;
	}
}
