<script>
	import { CONFIG } from './config.js';
	import { NOTES, INTERVAL_NAMES } from './constants.js';

	// Props - data passed from parent component
	export let highlightedNote;
	export let selectedNotes;
	export let highlightedPatternNotes;
	export let selectedChordPattern;
	export let chordPatternRoot;
	export let selectedScale;
	export let selectedMode;
	export let scaleRoot;
	export let isShiftPressed;
	export let showMusicalLabels;
	export let singleOctave;
	export let currentRootNote;
	export let currentTonnetzName;
	export let qInterval;
	export let rInterval;

	// Event dispatchers - functions to communicate back to parent
	export let getHighlightedChords;
	export let getCoordinatePattern;
	export let getCoordinateForNote;
	export let changeTonnetzPreset;
	export let getIntervalDescription;
	export let applyChordPattern;
	export let clearChordPattern;
	export let applyScale;
	export let applyMode;
	export let clearScale;
</script>

<div class="control-panel">
	<div
		class="highlight-info sticky"
		class:inactive={!highlightedNote &&
			selectedNotes.size === 0 &&
			highlightedPatternNotes.size === 0}
	>
		{#if getHighlightedChords().length > 0}
			<span
				>Playing: {showMusicalLabels
					? getHighlightedChords()
							.map((c) => `${c.split('-')[0]} ${c.includes('-up') ? '(minor)' : '(major)'}`)
							.join(', ')
					: getCoordinatePattern()}</span
			>
		{:else if highlightedNote}
			<span
				>Playing: {showMusicalLabels
					? highlightedNote
					: getCoordinateForNote(highlightedNote)}</span
			>
		{:else if selectedNotes.size > 0}
			<span
				>Selected: {showMusicalLabels
					? Array.from(selectedNotes).join(', ')
					: getCoordinatePattern()} ({selectedNotes.size} notes)</span
			>
		{:else if selectedChordPattern && chordPatternRoot}
			<span
				>Pattern: {selectedChordPattern}
				{showMusicalLabels ? `chord on ${chordPatternRoot}` : getCoordinatePattern()} ({highlightedPatternNotes.size}
				notes)</span
			>
		{:else}
			<span>Nothing playing{isShiftPressed ? ' - Hold Shift + Click to multi-select' : ''}</span>
		{/if}
	</div>
	
	<label>
		<input type="checkbox" bind:checked={showMusicalLabels} />
		Show Musical Labels
	</label>

	<label>
		<input type="checkbox" bind:checked={singleOctave} />
		Single Octave
	</label>
	
	<div class="control-row">
		<label>
			Root Note:
			<select bind:value={currentRootNote}>
				{#each NOTES as note}
					<option value={note}>{note}</option>
				{/each}
			</select>
		</label>
	</div>

	<div class="control-row">
		<label>
			Tonnetz Type:
			<select
				bind:value={currentTonnetzName}
				on:change={(e) => changeTonnetzPreset((e.target)?.value || '')}
			>
				{#each Object.keys(CONFIG.tonnetz.presets) as presetName}
					<option value={presetName}>{presetName}</option>
				{/each}
			</select>
		</label>
	</div>

	<div class="control-row custom-intervals">
		<label>
			Q Interval:
			<input type="number" min="1" max="11" bind:value={qInterval} />
			<span class="interval-desc">{getIntervalDescription(qInterval)}</span>
		</label>

		<label>
			R Interval:
			<input type="number" min="1" max="11" bind:value={rInterval} />
			<span class="interval-desc">{getIntervalDescription(rInterval)}</span>
		</label>
	</div>

	<div class="control-row chord-patterns">
		<span>Chord Patterns:</span>
		<div class="pattern-grid">
			{#each Object.keys(CONFIG.chordPatterns.presets) as patternName}
				<button
					class="pattern-btn"
					class:active={selectedChordPattern === patternName}
					on:click={() => {
						if (selectedChordPattern === patternName) {
							clearChordPattern();
						} else if (highlightedNote) {
							applyChordPattern(patternName, highlightedNote);
						} else {
							// Default to C if no note selected
							applyChordPattern(patternName, singleOctave ? 'C' : 'C4');
						}
					}}
				>
					{patternName}
				</button>
			{/each}
		</div>
		{#if selectedChordPattern}
			<div class="pattern-info">
				<small
					>Click a note to apply {selectedChordPattern} pattern, or click the button again to clear</small
				>
			</div>
		{/if}
	</div>

	<div class="control-row scale-patterns">
		<span>Scale Patterns:</span>
		<div class="pattern-grid">
			{#each Object.keys(CONFIG.scales) as scaleName}
				<button
					class="pattern-btn scale-btn"
					class:active={selectedScale === scaleName}
					on:click={() => {
						if (selectedScale === scaleName) {
							clearScale();
						} else {
							// Use current root note or default to C
							const rootNote = highlightedNote || (singleOctave ? 'C' : 'C4');
							applyScale(scaleName, rootNote);
						}
					}}
				>
					{scaleName}
				</button>
			{/each}
		</div>
		{#if selectedScale && scaleRoot}
			<div class="pattern-info">
				<small>{selectedScale} scale on {scaleRoot}</small>
			</div>
		{/if}
	</div>

	<div class="control-row mode-patterns">
		<span>Mode Patterns:</span>
		<div class="pattern-grid">
			{#each Object.keys(CONFIG.modes) as modeName}
				<button
					class="pattern-btn mode-btn"
					class:active={selectedMode === modeName}
					on:click={() => {
						if (selectedMode === modeName) {
							clearScale();
						} else {
							// Use current root note or default to C
							const rootNote = highlightedNote || (singleOctave ? 'C' : 'C4');
							applyMode(modeName, rootNote);
						}
					}}
				>
					{modeName}
				</button>
			{/each}
		</div>
		{#if selectedMode && scaleRoot}
			<div class="pattern-info">
				<small>{selectedMode} mode on {scaleRoot}</small>
			</div>
		{/if}
	</div>
</div>
