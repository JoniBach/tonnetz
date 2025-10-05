<script>
	import { CONFIG } from './config.js';
	import { NOTES, INTERVAL_NAMES } from './constants.js';

	// Props - data passed from parent component
	// export let tonnetzSystemState.highlightedNote;

	let {
		tonnetzSystemState = $bindable(),

		getHighlightedChords,
		getCoordinatePattern,
		getCoordinateForNote,
		changeTonnetzPreset,
		getIntervalDescription,
		applyChordPattern,
		clearChordPattern,
		applyScale,
		applyMode,
		clearScale,
		triggerUpdate,
		handleFileInputChange,
		toggleMidiPlay
	} = $props();

	// Audio state
	let isPlaying = $state(false);
	let audioConfig = $state({
		playbackMode: CONFIG.audio.playbackMode,
		instrument: CONFIG.audio.instrument,
		volume: CONFIG.audio.volume,
		tempo: CONFIG.audio.tempo
	});
	let fileInput = $state(null);

	// Derived state for highlighted chords
	const highlightedChords = $derived(() => getHighlightedChords(tonnetzSystemState));

	// Format the chords for display
	const formattedChords = $derived(() => {
		return highlightedChords
			.map((c) => `${c.split('-')[0]} ${c.includes('-up') ? '(minor)' : '(major)'}`)
			.join(', ');
	});
</script>

<div class="control-panel">
	<div
		class="highlight-info sticky"
		class:inactive={!tonnetzSystemState.highlightedNote &&
			tonnetzSystemState.selectedNotes.size === 0 &&
			tonnetzSystemState.highlightedPatternNotes.size === 0}
	>
		{#if highlightedChords.length > 0}
			<span
				>Playing: {tonnetzSystemState.showMusicalLabels
					? formattedChords
					: getCoordinatePattern(tonnetzSystemState)}</span
			>
		{:else if tonnetzSystemState.highlightedNote}
			<span
				>Playing: {tonnetzSystemState.showMusicalLabels
					? tonnetzSystemState.highlightedNote
					: getCoordinateForNote(tonnetzSystemState.highlightedNote)}</span
			>
		{:else if tonnetzSystemState.selectedNotes.size > 0}
			<span
				>Selected: {tonnetzSystemState.showMusicalLabels
					? Array.from(tonnetzSystemState.selectedNotes).join(', ')
					: getCoordinatePattern(tonnetzSystemState)} ({tonnetzSystemState.selectedNotes.size} notes)</span
			>
		{:else if tonnetzSystemState.selectedChordPattern && tonnetzSystemState.chordPatternRoot}
			<span
				>Pattern: {tonnetzSystemState.selectedChordPattern}
				{tonnetzSystemState.showMusicalLabels
					? ` chord on ${tonnetzSystemState.chordPatternRoot}`
					: getCoordinatePattern(tonnetzSystemState)} ({tonnetzSystemState.highlightedPatternNotes
					.size} notes)</span
			>
		{:else}
			<span
				>Nothing playing{tonnetzSystemState.isShiftPressed
					? ' - Hold Shift + Click to multi-select'
					: ''}</span
			>
		{/if}
	</div>

	<!-- Audio Status -->
	<div class="control-row audio-status">
		<span>🔊 Audio: {isPlaying ? 'Playing' : 'Ready'}</span>
	</div>

	<div class="control-row">
		<div class="file-input">
			<input
				type="file"
				id="file"
				accept=".mid"
				onchange={(e) => handleFileInputChange(e, tonnetzSystemState)}
			/>
			<label for="file" class="file-label"
				>{tonnetzSystemState.midiFile
					? tonnetzSystemState.midiFile.name
					: 'No file selected'}</label
			>
		</div>
	</div>

	<button
		onclick={(e) => toggleMidiPlay(e, tonnetzSystemState)}
		disabled={!tonnetzSystemState.midiPlayer}
	>
		{tonnetzSystemState.isMidiPlaying ? '⏹ Stop MIDI' : '▶ Play MIDI'}
	</button>

	<!-- Audio Settings -->
	<div class="audio-settings">
		<label>
			Playback Mode:
			<select bind:value={audioConfig.playbackMode} onchange={triggerUpdate}>
				<option value="chord">Chord (simultaneous)</option>
				<option value="arpeggio">Arpeggio (overlapping)</option>
				<option value="sequential">Sequential</option>
			</select>
		</label>

		<label>
			Instrument:
			<select bind:value={audioConfig.instrument} onchange={triggerUpdate}>
				<option value="synth">Synth</option>
				<option value="piano">Piano</option>
				<option value="guitar">Guitar</option>
				<option value="bass">Bass</option>
			</select>
		</label>

		<label>
			Tempo:
			<input
				type="range"
				min="60"
				max="200"
				bind:value={audioConfig.tempo}
				onchange={triggerUpdate}
			/>
			<span class="tempo-display">{audioConfig.tempo} BPM</span>
		</label>

		<label>
			Volume:
			<input
				type="range"
				min="-40"
				max="0"
				bind:value={audioConfig.volume}
				onchange={triggerUpdate}
			/>
			<span class="volume-display">{audioConfig.volume} dB</span>
		</label>
	</div>

	<label>
		<input
			type="checkbox"
			bind:checked={tonnetzSystemState.showMusicalLabels}
			onchange={triggerUpdate}
		/>
		Show Musical Labels
	</label>

	<label>
		<input
			type="checkbox"
			bind:checked={tonnetzSystemState.singleOctave}
			onchange={triggerUpdate}
		/>
		Single Octave
	</label>

	<div class="control-row">
		<label>
			Root Note:
			<select
				bind:value={tonnetzSystemState.currentRootNote}
				onchange={(e) => {
					tonnetzSystemState.currentRootNote = e.target?.value || '';
					triggerUpdate();
				}}
			>
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
				bind:value={tonnetzSystemState.currentTonnetzName}
				onchange={(e) => {
					changeTonnetzPreset(e.target?.value || '', tonnetzSystemState);
					triggerUpdate();
				}}
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
			<input
				type="number"
				min="1"
				max="11"
				bind:value={tonnetzSystemState.qInterval}
				oninput={(e) => {
					tonnetzSystemState.qInterval = parseInt(e.target.value) || 7;
					triggerUpdate();
				}}
			/>
			<span class="interval-desc">{getIntervalDescription(tonnetzSystemState.qInterval)}</span>
		</label>

		<label>
			R Interval:
			<input
				type="number"
				min="1"
				max="11"
				bind:value={tonnetzSystemState.rInterval}
				oninput={(e) => {
					tonnetzSystemState.rInterval = parseInt(e.target.value) || 4;
					triggerUpdate();
				}}
			/>
			<span class="interval-desc">{getIntervalDescription(tonnetzSystemState.rInterval)}</span>
		</label>
	</div>
	<div class="control-row chord-patterns">
		<span>Chord Patterns:</span>
		<div class="pattern-grid">
			{#each Object.keys(CONFIG.chordPatterns.presets) as patternName}
				<button
					class="pattern-btn"
					class:active={tonnetzSystemState.selectedChordPattern === patternName}
					onclick={() => {
						if (tonnetzSystemState.selectedChordPattern === patternName) {
							clearChordPattern(tonnetzSystemState);
						} else if (tonnetzSystemState.highlightedNote) {
							applyChordPattern(
								patternName,
								tonnetzSystemState.highlightedNote,
								tonnetzSystemState
							);
						} else {
							// Default to C if no note selected
							applyChordPattern(
								patternName,
								tonnetzSystemState.singleOctave ? 'C' : 'C4',
								tonnetzSystemState
							);
						}
					}}
				>
					{patternName}
				</button>
			{/each}
		</div>
		{#if tonnetzSystemState.selectedChordPattern}
			<div class="pattern-info">
				<small
					>Click a note to apply {tonnetzSystemState.selectedChordPattern} pattern, or click the button
					again to clear</small
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
					class:active={tonnetzSystemState.selectedScale === scaleName}
					onclick={() => {
						if (tonnetzSystemState.selectedScale === scaleName) {
							clearScale(tonnetzSystemState);
						} else {
							console.log(tonnetzSystemState.highlightedNote);
							// Use current root note or default to C
							const rootNote =
								tonnetzSystemState.highlightedNote ||
								(tonnetzSystemState.singleOctave ? 'C' : 'C4');
							applyScale(scaleName, rootNote, tonnetzSystemState);
						}
					}}
				>
					{scaleName}
				</button>
			{/each}
		</div>
		{#if tonnetzSystemState.selectedScale && tonnetzSystemState.scaleRoot}
			<div class="pattern-info">
				<small>{tonnetzSystemState.selectedScale} scale on {tonnetzSystemState.scaleRoot}</small>
			</div>
		{/if}
	</div>

	<div class="control-row mode-patterns">
		<span>Mode Patterns:</span>
		<div class="pattern-grid">
			{#each Object.keys(CONFIG.modes) as modeName}
				<button
					class="pattern-btn mode-btn"
					class:active={tonnetzSystemState.selectedMode === modeName}
					onclick={() => {
						if (tonnetzSystemState.selectedMode === modeName) {
							clearScale(tonnetzSystemState);
						} else {
							// Use current root note or default to C
							const rootNote =
								tonnetzSystemState.highlightedNote ||
								(tonnetzSystemState.singleOctave ? 'C' : 'C4');
							applyMode(modeName, rootNote, tonnetzSystemState);
						}
					}}
				>
					{modeName}
				</button>
			{/each}
		</div>
		{#if tonnetzSystemState.selectedMode && tonnetzSystemState.scaleRoot}
			<div class="pattern-info">
				<small>{tonnetzSystemState.selectedMode} mode on {tonnetzSystemState.scaleRoot}</small>
			</div>
		{/if}
	</div>
</div>
