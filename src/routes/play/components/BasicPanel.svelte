<script lang="ts">
	let open = false;
	let selected: Record<string, string> = {};
</script>

<div class="panel-wrapper">
	<button class="toggle-button" on:click={() => (open = !open)}>
		{open ? 'Close' : 'Open Panel'}
	</button>

	{#if open}
		<div class="panel">
			<!-- Example group 1 -->
			<fieldset>
				<legend>Group 1</legend>
				<label>
					<input type="radio" name="group1" bind:group={selected.group1} />
					Option 1
				</label>
				<label>
					<input type="radio" name="group1" bind:group={selected.group1} />
					Option 2
				</label>
			</fieldset>

			<button class="clear-button" on:click={() => (selected = {})}>Clear</button>
		</div>
	{/if}
</div>

<style>
	.panel-wrapper {
		position: fixed;
		right: 1rem;
		top: 6rem;
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

	.panel {
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
