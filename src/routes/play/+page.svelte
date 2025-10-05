<script lang="ts">
	import { inputStore } from './stores/inputStore';
	import { onMount, onDestroy } from 'svelte';

	onMount(() => inputStore.addListeners());
	onDestroy(() => inputStore.removeListeners());
</script>

<div style="display: grid; grid-template-columns: repeat(10, 50px); gap: 5px;">
	{#each Array(100) as _, i}
		<div
			data-id={'cell-' + i}
			style="width:50px;height:50px;border:1px solid #999;"
			class:selected={$inputStore.hoveredElementId === 'cell-' + i}
		>
			{i}
		</div>
	{/each}
</div>
<h3>Active Input Events:</h3>
<ul>
	{#each $inputStore.activeEvents as e}
		<li>{e.name}{e.targetId ? ` (on ${e.targetId})` : ''}</li>
	{/each}
</ul>

<style>
	.selected {
		background-color: #ffa;
	}
</style>
