<script context="module" lang="ts">
	export interface TonnetzControlsData {
		numOctaves: number;
		baseOctave: number;
		gridRadius: number;
		zoomScale: number;
		startingNote: string;
		oscillatorType: 'sine' | 'square' | 'sawtooth' | 'triangle';
		showChordNames: boolean;
		showRomanNumerals: boolean;
		showRootHighlight: boolean;
		showTriangles: boolean;
		showDyads: boolean;
		showNoteLabels: boolean;
		showLegend: boolean;
		showOnlyKeyTriangles: boolean;
		showMajorTriangles: boolean;
		showMinorTriangles: boolean;
		triadFilter: (string | number)[];
		showUniqueTriadsOnly: boolean;
		showUniqueNotesOnly: boolean;
		hideOrphanNotes: boolean;
		hideFilteredElements: boolean;
	}
</script>

<script lang="ts">
	import { createEventDispatcher } from 'svelte';

	// Props
	export let controls: TonnetzControlsData;

	// Event dispatcher
	const dispatch = createEventDispatcher<{
		regenerate: void;
		zoomChange: void;
		oscillatorChange: void;
	}>();

	// Note options
	const NOTE_OPTIONS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

	// Event handlers
	const handleRegenerate = () => {
		dispatch('regenerate');
	};

	const handleZoomChange = () => {
		dispatch('zoomChange');
	};

	const handleOscillatorChange = () => {
		dispatch('oscillatorChange');
	};

	const handleTriadFilterChange = (event: Event) => {
		const target = event.target as HTMLInputElement;
		const inputValue = target.value.trim();
		
		if (!inputValue) {
			controls.triadFilter = [];
		} else {
			// Parse comma-separated values, handling both numbers and note names
			controls.triadFilter = inputValue
				.split(',')
				.map(item => item.trim())
				.filter(item => item.length > 0)
				.map(item => {
					// Try to parse as number first, otherwise keep as string
					const num = parseInt(item, 10);
					return !isNaN(num) && num.toString() === item ? num : item;
				});
		}
		
		handleRegenerate();
	};
</script>

<div class="controls">
	<div class="control-group">
		<label for="octaves">Number of Octaves:</label>
		<input
			id="octaves"
			type="range"
			min="1"
			max="4"
			bind:value={controls.numOctaves}
			on:input={handleRegenerate}
		/>
		<span>{controls.numOctaves}</span>
	</div>
	
	<div class="control-group">
		<label for="baseOctave">Base Octave:</label>
		<input
			id="baseOctave"
			type="range"
			min="2"
			max="6"
			bind:value={controls.baseOctave}
			on:input={handleRegenerate}
		/>
		<span>{controls.baseOctave}</span>
	</div>
	
	<div class="control-group">
		<label for="gridRadius">Grid Size:</label>
		<input
			id="gridRadius"
			type="range"
			min="2"
			max="5"
			bind:value={controls.gridRadius}
			on:input={handleRegenerate}
		/>
		<span>{controls.gridRadius}</span>
	</div>
	
	<div class="control-group">
		<label for="zoom">Zoom:</label>
		<input
			id="zoom"
			type="range"
			min="0.5"
			max="3.0"
			step="0.1"
			bind:value={controls.zoomScale}
			on:input={handleZoomChange}
		/>
		<span>{controls.zoomScale.toFixed(1)}x</span>
	</div>
	
	<div class="control-group">
		<label for="startingNote">Starting Note:</label>
		<select id="startingNote" bind:value={controls.startingNote} on:change={handleRegenerate}>
			{#each NOTE_OPTIONS as note}
				<option value={note}>{note}</option>
			{/each}
		</select>
	</div>
	
	<div class="control-group">
		<label for="oscillator">Oscillator:</label>
		<select id="oscillator" bind:value={controls.oscillatorType} on:change={handleOscillatorChange}>
			<option value="sine">Sine</option>
			<option value="square">Square</option>
			<option value="sawtooth">Sawtooth</option>
			<option value="triangle">Triangle</option>
		</select>
	</div>
	
	<div class="control-group">
		<label for="showChordNames">
			<input
				id="showChordNames"
				type="checkbox"
				bind:checked={controls.showChordNames}
				on:change={handleRegenerate}
			/>
			Show Chord Names
		</label>
	</div>
	
	<div class="control-group">
		<label for="showRomanNumerals">
			<input
				id="showRomanNumerals"
				type="checkbox"
				bind:checked={controls.showRomanNumerals}
				on:change={handleRegenerate}
			/>
			Show Roman Numerals
		</label>
	</div>
	
	<div class="control-group">
		<label for="showRootHighlight">
			<input
				id="showRootHighlight"
				type="checkbox"
				bind:checked={controls.showRootHighlight}
				on:change={handleRegenerate}
			/>
			Highlight Root Note
		</label>
	</div>
	
	<div class="control-group">
		<label for="showTriangles">
			<input
				id="showTriangles"
				type="checkbox"
				bind:checked={controls.showTriangles}
				on:change={handleRegenerate}
			/>
			Show Triangles
		</label>
	</div>
	
	<div class="control-group">
		<label for="showDyads">
			<input
				id="showDyads"
				type="checkbox"
				bind:checked={controls.showDyads}
				on:change={handleRegenerate}
			/>
			Show Dyads
		</label>
	</div>
	
	<div class="control-group">
		<label for="showNoteLabels">
			<input
				id="showNoteLabels"
				type="checkbox"
				bind:checked={controls.showNoteLabels}
				on:change={handleRegenerate}
			/>
			Show Note Labels
		</label>
	</div>
	
	<div class="control-group">
		<label for="showLegend">
			<input
				id="showLegend"
				type="checkbox"
				bind:checked={controls.showLegend}
				on:change={handleRegenerate}
			/>
			Show Legend
		</label>
	</div>
	
	<div class="control-group">
		<label for="showOnlyKeyTriangles">
			<input
				id="showOnlyKeyTriangles"
				type="checkbox"
				bind:checked={controls.showOnlyKeyTriangles}
				on:change={handleRegenerate}
			/>
			Show Only Key Triangles
		</label>
	</div>
	
	<div class="control-group">
		<label for="showMajorTriangles">
			<input
				id="showMajorTriangles"
				type="checkbox"
				bind:checked={controls.showMajorTriangles}
				on:change={handleRegenerate}
			/>
			Show Major Triangles
		</label>
	</div>
	
	<div class="control-group">
		<label for="showMinorTriangles">
			<input
				id="showMinorTriangles"
				type="checkbox"
				bind:checked={controls.showMinorTriangles}
				on:change={handleRegenerate}
			/>
			Show Minor Triangles
		</label>
	</div>
	
	<div class="control-group">
		<label for="triadFilter">Filter Triads:</label>
		<input
			id="triadFilter"
			type="text"
			value={controls.triadFilter.join(', ')}
			on:input={handleTriadFilterChange}
			placeholder="e.g., 1, 5, 2 or C, G, D"
			style="min-width: 150px;"
		/>
	</div>
	
	<div class="control-group">
		<label for="showUniqueTriadsOnly">
			<input
				id="showUniqueTriadsOnly"
				type="checkbox"
				bind:checked={controls.showUniqueTriadsOnly}
				on:change={handleRegenerate}
			/>
			Show Unique Triads Only
		</label>
	</div>
	
	<div class="control-group">
		<label for="showUniqueNotesOnly">
			<input
				id="showUniqueNotesOnly"
				type="checkbox"
				bind:checked={controls.showUniqueNotesOnly}
				on:change={handleRegenerate}
			/>
			Show Unique Notes Only
		</label>
	</div>
	
	<div class="control-group">
		<label for="hideOrphanNotes">
			<input
				id="hideOrphanNotes"
				type="checkbox"
				bind:checked={controls.hideOrphanNotes}
				on:change={handleRegenerate}
			/>
			Hide Orphan Notes
		</label>
	</div>
	
	<div class="control-group">
		<label for="hideFilteredElements">
			<input
				id="hideFilteredElements"
				type="checkbox"
				bind:checked={controls.hideFilteredElements}
				on:change={handleRegenerate}
			/>
			Hide Filtered Elements
		</label>
	</div>
</div>

<style>
	.controls {
		margin: 20px 0;
		padding: 15px;
		background: #f8f9fa;
		border-radius: 8px;
		border: 1px solid #dee2e6;
		display: flex;
		gap: 20px;
		flex-wrap: wrap;
		align-items: center;
	}

	.control-group {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.control-group label {
		font-weight: 500;
		min-width: 100px;
	}

	.control-group input[type='range'] {
		width: 100px;
	}

	.control-group span {
		font-weight: bold;
		min-width: 20px;
		text-align: center;
	}
</style>
