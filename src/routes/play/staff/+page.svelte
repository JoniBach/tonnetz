<script lang="ts">
	import { onMount } from 'svelte';
	import Staff from '../components/Staff.svelte';
	import type { MidiData } from '../components/types/midi-types';

	let loading = $state(true);

	let data = $state({
		classes: null,
		glyphnames: null,
		ranges: null,
		metadata: null
	});

	let error = $state<string | null>(null);

	// MIDI-compatible data structure
	const midiData: MidiData = {
		header: {
			PPQ: 192,
			bpm: 120,
			timeSignature: [4, 4],
			name: 'Twinkle Twinkle Little Star'
		},
		tempo: [
			{
				absoluteTime: 0,
				seconds: 0,
				bpm: 120
			}
		],
		timeSignature: [
			{
				absoluteTime: 0,
				seconds: 0,
				numerator: 4,
				denominator: 4,
				click: 24,
				notesQ: 8
			}
		],
		startTime: 0,
		duration: 8.0, // 8 seconds total
		tracks: [
			{
				startTime: 0,
				duration: 8.0,
				length: 14,
				id: 0,
				name: 'Melody',
				instrument: 'Piano',
				channel: 0,
				controlChanges: {},
				notes: [
					// Bar 1: C C G G
					{ name: 'C4', midi: 60, time: 0.0, velocity: 0.8, duration: 0.5, lyric: 'Twin' },
					{ name: 'C4', midi: 60, time: 0.5, velocity: 0.8, duration: 0.5, lyric: 'kle' },
					{ name: 'G4', midi: 67, time: 1.0, velocity: 0.8, duration: 0.5, lyric: 'twin' },
					{ name: 'G4', midi: 67, time: 1.5, velocity: 0.8, duration: 0.5, lyric: 'kle' },

					// Bar 2: A A G (half note)
					{ name: 'A4', midi: 69, time: 2.0, velocity: 0.8, duration: 0.5, lyric: 'lit' },
					{ name: 'A4', midi: 69, time: 2.5, velocity: 0.8, duration: 0.5, lyric: 'tle' },
					{ name: 'G4', midi: 67, time: 3.0, velocity: 0.8, duration: 1.0, lyric: 'star' },

					// Bar 3: F F E E
					{ name: 'F4', midi: 65, time: 4.0, velocity: 0.8, duration: 0.5, lyric: 'How' },
					{ name: 'F4', midi: 65, time: 4.5, velocity: 0.8, duration: 0.5, lyric: 'I' },
					{ name: 'E4', midi: 64, time: 5.0, velocity: 0.8, duration: 0.5, lyric: 'won' },
					{ name: 'E4', midi: 64, time: 5.5, velocity: 0.8, duration: 0.5, lyric: 'der' },

					// Bar 4: D D C (half note)
					{ name: 'D4', midi: 62, time: 6.0, velocity: 0.8, duration: 0.5, lyric: 'what' },
					{ name: 'D4', midi: 62, time: 6.5, velocity: 0.8, duration: 0.5, lyric: 'you' },
					{ name: 'C4', midi: 60, time: 7.0, velocity: 0.8, duration: 1.0, lyric: 'are' }
				]
			}
		]
	};

	// Staff configuration - now using MIDI-native format!
	const staffConfig = {
		title: midiData.header.name,
		subtitle: 'A simple melody using modern staff notation',
		fontSize: 50,
		staff: 'staff5Lines',
		clef: 'gClef'
	};

	onMount(async () => {
		try {
			const [classesRes, glyphnamesRes, rangesRes, metadataRes] = await Promise.all([
				fetch('/smufl/metadata/classes.json'),
				fetch('/smufl/metadata/glyphnames.json'),
				fetch('/smufl/metadata/ranges.json'),
				fetch('/smufl/metadata/bravura_metadata.json')
			]);

			if (!classesRes.ok || !glyphnamesRes.ok || !rangesRes.ok || !metadataRes.ok) {
				throw new Error('One or more files failed to load');
			}

			data = {
				classes: await classesRes.json(),
				glyphnames: await glyphnamesRes.json(),
				ranges: await rangesRes.json(),
				metadata: await metadataRes.json()
			};
			loading = false;
		} catch (err) {
			error = err.message;
		}
	});
</script>

<div class="content">
	<h1>Modern Staff Notation: Precision in Music</h1>

	{#if loading}
		<p>Loading SMuFL metadata...</p>
	{:else if error}
		<p class="text-red-600">Error: {error}</p>
	{:else}
		<div class="harmonic-block">
			<Staff {midiData} trackIndex={0} config={staffConfig} {data} />
		</div>
	{/if}
</div>

<style>
	.content {
		display: flex;
		flex-direction: column;
		justify-content: center;
		gap: 1rem;
		max-width: 800px;
		margin: 2rem auto;
		padding: 1rem;
	}
	.harmonic-block {
		margin: 1.5rem 0;
	}
</style>
