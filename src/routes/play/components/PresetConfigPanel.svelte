<script lang="ts">
	import { presets, scales } from '../stores/config';
	import { uiStore } from '../stores/uiStore';

	let open = false;
	let selectedPreset = '';
	let selectedScale = '';

	function togglePanel() {
		open = !open;
	}

	function selectHint(type: 'preset' | 'scale', name: string) {
		if (type === 'preset') selectedPreset = name;
		else selectedScale = name;

		const hintArray = type === 'preset' ? presets[name] : scales[name];
		uiStore.setHints(hintArray);
	}

	function clearHints() {
		selectedPreset = '';
		selectedScale = '';
		uiStore.setHints([]);
	}
</script>

<div class="hint-config-wrapper">
	<button class="toggle-button" on:click={togglePanel}>
		{open ? 'Close' : 'Hints'}
	</button>

	{#if open}
		<div class="hint-config-panel">
			<h3>Hint Presets</h3>

			<fieldset>
				<legend>Presets</legend>
				{#each Object.keys(presets) as name}
					<label>
						<input
							type="radio"
							name="hintPreset"
							value={name}
							bind:group={selectedPreset}
							on:change={() => selectHint('preset', name)}
						/>
						{name}
					</label>
				{/each}
			</fieldset>

			<hr />

			<fieldset>
				<legend>Scales</legend>
				{#each Object.keys(scales) as name}
					<label>
						<input
							type="radio"
							name="hintScale"
							value={name}
							bind:group={selectedScale}
							on:change={() => selectHint('scale', name)}
						/>
						{name}
					</label>
				{/each}
			</fieldset>

			<hr />
			<button class="clear-button" on:click={clearHints}>Clear Hints</button>
		</div>
	{/if}
</div>

<style>
	.hint-config-wrapper {
		position: fixed;
		right: 1rem;
		top: 3.5rem;
		z-index: 1000;
	}

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

	.hint-config-panel {
		margin-top: 0.5rem;
		background: #fff;
		border: 1px solid #ccc;
		padding: 1rem;
		border-radius: 6px;
		width: 220px;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
		max-height: 90vh;
		overflow-y: auto;
	}

	label {
		display: flex;
		align-items: center;
		margin-bottom: 0.3rem;
	}

	input[type='radio'] {
		margin-right: 0.5rem;
	}

	fieldset {
		margin-top: 0.5rem;
		border: 1px solid #ddd;
		padding: 0.5rem;
		border-radius: 4px;
	}

	fieldset legend {
		font-size: 0.85rem;
		font-weight: bold;
		padding: 0 0.5rem;
	}

	hr {
		margin: 0.8rem 0;
		border: 0;
		border-top: 1px solid #ccc;
	}

	.clear-button {
		background: #e74c3c;
		color: white;
		border: none;
		padding: 0.4rem 0.8rem;
		border-radius: 6px;
		cursor: pointer;
		font-size: 0.85rem;
		width: 100%;
		margin-top: 0.5rem;
	}
</style>
