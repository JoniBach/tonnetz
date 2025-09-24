<script lang="ts">
	import Tonnetz from '$lib/components/old/Tonnetz.svelte';
	import TonnetzControls, {
		type TonnetzControlsData
	} from '$lib/components/old/TonnetzControls.svelte';

	// State management for controls - now at page level
	let controls: TonnetzControlsData = {
		numOctaves: 1,
		baseOctave: 4,
		gridRadius: 2,
		zoomScale: 1.5,
		startingNote: 'C',
		oscillatorType: 'sawtooth',
		showChordNames: true,
		showRomanNumerals: true,
		showRootHighlight: true,
		showTriangles: true,
		showDyads: true,
		showNoteLabels: true,
		showLegend: true,
		showOnlyKeyTriangles: false,
		showMajorTriangles: true,
		showMinorTriangles: true,
		triadFilter: [],
		showUniqueTriadsOnly: true,
		showUniqueNotesOnly: false,
		hideOrphanNotes: true,
		hideFilteredElements: true
	};

	// Component references
	let tonnetzComponent: Tonnetz;

	// Event handlers for controls
	const handleRegenerate = () => {
		if (tonnetzComponent) {
			tonnetzComponent.regenerate();
		}
	};

	const handleZoomChange = () => {
		if (tonnetzComponent) {
			tonnetzComponent.applyZoomChange();
		}
	};

	const handleOscillatorChange = () => {
		if (tonnetzComponent) {
			tonnetzComponent.updateOscillatorType();
		}
	};
</script>

<svelte:head>
	<title>Tonnetz (Tone Network) - Music Visualization History</title>
	<meta
		name="description"
		content="Interactive Tonnetz lattice diagram showing pitch relationships in music theory"
	/>
</svelte:head>
<!-- Interactive Tonnetz Component with Controls -->
<TonnetzControls
	bind:controls
	on:regenerate={handleRegenerate}
	on:zoomChange={handleZoomChange}
	on:oscillatorChange={handleOscillatorChange}
/>

<Tonnetz width={800} height={600} {controls} bind:this={tonnetzComponent} />

<style>
	/* Page-specific styles - component handles its own styling */
	.timeline {
		list-style: none;
		padding-left: 0;
		margin: 1rem 0;
	}
	.timeline li {
		margin: 0.5rem 0;
		padding-left: 1rem;
		border-left: 2px solid #ccc;
	}
	.timeline strong {
		color: #333;
	}
</style>
