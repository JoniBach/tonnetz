<script lang="ts">
	import { onMount } from 'svelte';
	import Staff from '../components/Staff.svelte';

	let loading = $state(true);

	let data = $state({
		classes: null,
		glyphnames: null,
		ranges: null,
		metadata: null
	});

	let error = $state<string | null>(null);

	let mozartTwinkle = [
		{ type: 'barline', duration: 'Single' },

		// Bar 1: C C G G
		{ type: 'note', duration: 'Quarter', pitch: 'C4', lyric: 'Twin' },
		{ type: 'note', duration: 'Quarter', pitch: 'C4', lyric: 'kle' },
		{ type: 'note', duration: 'Quarter', pitch: 'G4', lyric: 'twin' },
		{ type: 'note', duration: 'Quarter', pitch: 'G4', lyric: 'kle' },
		{ type: 'barline', duration: 'Single' },

		// Bar 2: A A G (half note)
		{ type: 'note', duration: 'Quarter', pitch: 'A5', lyric: 'lit' },
		{ type: 'note', duration: 'Quarter', pitch: 'A5', lyric: 'tle' },
		{ type: 'note', duration: 'Half', pitch: 'G4', lyric: 'star' },

		{ type: 'barline', duration: 'Single' },

		// Bar 3: F F E E
		{ type: 'note', duration: 'Quarter', pitch: 'F4', lyric: 'How' },
		{ type: 'note', duration: 'Quarter', pitch: 'F4', lyric: 'I' },
		{ type: 'note', duration: 'Quarter', pitch: 'E4', lyric: 'won' },
		{ type: 'note', duration: 'Quarter', pitch: 'E4', lyric: 'der' },
		{ type: 'barline', duration: 'Single' },

		// Bar 4: D D C (half note)
		{ type: 'note', duration: 'Quarter', pitch: 'D4', lyric: 'what' },
		{ type: 'note', duration: 'Quarter', pitch: 'D4', lyric: 'you' },
		{ type: 'note', duration: 'Half', pitch: 'C4', lyric: 'are' },

		{ type: 'barline', duration: 'Final' }
	];

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
			<Staff
				title="Twinkle Twinkle Little Star"
				subtitle="A simple melody using modern staff notation"
				timeSignature={{ numerator: 4, denominator: 4 }}
				fontSize={50}
				notes={mozartTwinkle}
				{data}
				staff="staff5Lines"
				clef="gClef"
			/>
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
