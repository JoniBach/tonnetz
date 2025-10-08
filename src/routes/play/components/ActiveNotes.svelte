<script lang="ts">
	import { get } from 'svelte/store';
	import { gridStore } from '../stores/gridStore';
	import { uiStore } from '../stores/uiStore';
	import { onMount } from 'svelte';

	let activeNotes = new Set<string>();

	function updateActiveNotes() {
		const $gridStore = get(gridStore);
		const $uiStore = get(uiStore);
		const newActiveNotes = new Set<string>();

		for (const [id, point] of $gridStore.points.entries()) {
			const nodeState = $uiStore.nodeStates[id];
			if (nodeState?.interaction === 'active') newActiveNotes.add(point.note);
		}

		activeNotes = newActiveNotes;
	}

	onMount(() => {
		const unsubscribeGrid = gridStore.subscribe(updateActiveNotes);
		const unsubscribeUI = uiStore.subscribe(updateActiveNotes);

		updateActiveNotes();

		return () => {
			unsubscribeGrid();
			unsubscribeUI();
		};
	});
</script>

{#if activeNotes.size > 0}
	<div class="active-notes">
		{Array.from(activeNotes).sort().join(', ')}
	</div>
{/if}

<style>
	.active-notes {
		position: fixed;
		top: 0;
		left: 0;
		width: 100%;
		background: white;
		color: black;
		font-size: 0.85rem;
		padding: 0.25rem 0.5rem;
		text-align: center;
		pointer-events: none;
		z-index: 1000;
		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
	}
</style>
