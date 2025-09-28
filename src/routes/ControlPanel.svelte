<script>
	import { CONFIG } from './config.js';
	import { NOTES, INTERVAL_NAMES } from './constants.js';
	import {
		initAudio,
		sustainNotes,
		stopSustainedNotes,
		updateAudioSettings,
		disposeAudio
	} from './simple-audio.js';
	import { onDestroy } from 'svelte';

	// Audio state
	let isPlaying = false;
	let audioConfig = {
		playbackMode: CONFIG.audio.playbackMode,
		instrument: CONFIG.audio.instrument,
		volume: CONFIG.audio.volume,
		tempo: CONFIG.audio.tempo
	};

	// Update sustained audio based on current selection
	const updateSustainedAudio = async () => {
		try {
			await initAudio();
			const notes = getCurrentNotes();

			if (notes.length > 0) {
				isPlaying = true;
				await sustainNotes(notes);
			} else {
				isPlaying = false;
				stopSustainedNotes();
			}
		} catch (error) {
			console.error('Error updating sustained audio:', error);
			isPlaying = false;
		}
	};

	// Auto-update sustained audio when selection changes (minimal debouncing for responsiveness)
	let autoPlayTimeout = null;
	const debouncedAudioUpdate = () => {
		if (autoPlayTimeout) clearTimeout(autoPlayTimeout);
		autoPlayTimeout = setTimeout(() => {
			updateSustainedAudio();
		}, 16); // 16ms debounce (~60fps) for instant feel
	};

	// Watch for changes in highlighted notes and update sustained audio
	$: {
		const hasHighlighted = highlightedNote !== null;
		const hasSelected = selectedNotes && selectedNotes.size > 0;
		const hasPattern = highlightedPatternNotes && highlightedPatternNotes.size > 0;

		if (hasHighlighted || hasSelected || hasPattern) {
			debouncedAudioUpdate();
		} else {
			if (isPlaying) {
				// Only stop if we were playing
				stopSustainedNotes();
				isPlaying = false;
			}
		}
	}

	// Export the play function so parent can call it
	export const playAudio = updateSustainedAudio;

	// Stop current playback
	const stopPlayback = () => {
		stopSustainedNotes();
		isPlaying = false;
	};

	// Calculate chord tones from root note and chord type
	const getChordTones = (root, isMinor = false) => {
		const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
		const rootIndex = notes.indexOf(root);
		if (rootIndex === -1) return [root];

		// Major triad: root, major third (4 semitones), perfect fifth (7 semitones)
		// Minor triad: root, minor third (3 semitones), perfect fifth (7 semitones)
		const thirdInterval = isMinor ? 3 : 4;
		const fifthInterval = 7;

		return [root, notes[(rootIndex + thirdInterval) % 12], notes[(rootIndex + fifthInterval) % 12]];
	};

	// Get current notes to play
	// In ControlPanel.svelte, update the getCurrentNotes function:
	const getCurrentNotes = () => {
		// First priority: Individual note selections
		if (selectedNotes.size > 0) {
			return Array.from(selectedNotes);
		}
		// Second priority: Single highlighted note
		else if (highlightedNote) {
			return [highlightedNote];
		}
		// Third priority: Highlighted chords (triangles)
		else if (getHighlightedChords().length > 0) {
			// Extract all chord tones from highlighted chords
			const allChordTones = [];
			for (const chord of getHighlightedChords()) {
				const [root, orientation] = chord.split('-');
				const isMinor = orientation === 'up'; // up triangles are minor, down are major
				const chordTones = getChordTones(root, isMinor);
				allChordTones.push(...chordTones);
			}
			// Remove duplicates
			return [...new Set(allChordTones)];
		}
		// Last priority: Pattern notes
		else if (highlightedPatternNotes.size > 0) {
			return Array.from(highlightedPatternNotes);
		}
		return [];
	};
	// Update audio settings when config changes
	$: {
		updateAudioSettings(audioConfig);
	}

	// Cleanup on component destroy
	onDestroy(() => {
		disposeAudio();
	});

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
	export let midiFile;

	let fileInput;

	function handleFileInputChange(event) {
		const file = event.target.files[0];
		if (file) {
			const reader = new FileReader();
			reader.onload = (e) => {
				const arrayBuffer = e.target.result;
				const midiData = new Uint8Array(arrayBuffer);

				midiFile = midiData;
			};
			reader.readAsArrayBuffer(file);
		}
	}
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

	<!-- Audio Status -->
	<div class="control-row audio-status">
		<span>🔊 Audio: {isPlaying ? 'Playing' : 'Ready'}</span>
	</div>

	<div class="control-row">
		<div class="file-input">
			<input type="file" id="file" accept=".mid" on:change={handleFileInputChange} />
			<label for="file" class="file-label"
				>{fileInput ? fileInput.files[0].name : 'No file selected'}</label
			>
		</div>
	</div>

	<!-- Audio Settings -->
	<div class="audio-settings">
		<label>
			Playback Mode:
			<select bind:value={audioConfig.playbackMode}>
				<option value="chord">Chord (simultaneous)</option>
				<option value="arpeggio">Arpeggio (overlapping)</option>
				<option value="sequential">Sequential</option>
			</select>
		</label>

		<label>
			Instrument:
			<select bind:value={audioConfig.instrument}>
				<option value="synth">Synth</option>
				<option value="piano">Piano</option>
				<option value="guitar">Guitar</option>
				<option value="bass">Bass</option>
			</select>
		</label>

		<label>
			Tempo:
			<input type="range" min="60" max="200" bind:value={audioConfig.tempo} />
			<span class="tempo-display">{audioConfig.tempo} BPM</span>
		</label>

		<label>
			Volume:
			<input type="range" min="-40" max="0" bind:value={audioConfig.volume} />
			<span class="volume-display">{audioConfig.volume} dB</span>
		</label>
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
				on:change={(e) => changeTonnetzPreset(e.target?.value || '')}
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
