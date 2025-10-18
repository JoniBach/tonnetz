<script lang="ts">
	import Documentation from '../components/NotationDocs.svelte';

	import { onMount } from 'svelte';

	let data = $state({
		classes: null,
		glyphnames: null,
		ranges: null,
		metadata: null
	});

	let error: string | null = null;

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
		} catch (err) {
			error = err.message;
		}
	});

	let searchSuggestions = [
		'clefs',
		'dynamics',
		'individualNotes',
		'barlines',
		'rests',
		'note16thDown',
		'medieval'
	];
</script>

<div class="content">
	<h1>Modern Staff Notation: Precision in Music</h1>
	<Documentation {data} {searchSuggestions} />
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
</style>
