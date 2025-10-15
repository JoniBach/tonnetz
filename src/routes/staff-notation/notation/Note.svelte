<script lang="ts">
	type NoteType = {
		note: string;
		type: string;
		duration: string;
		y?: number;
		pitch?: string;
	};

	type GlyphInfo = {
		codePoint: string;
		range: string;
	};

	type SMUFLData = {
		ranges: Record<
			string,
			{
				glyphs: string[];
				range_start: string;
			}
		>;
		metadata?: {
			glyphAdvanceWidths?: Record<string, number>;
		};
	};

	export let thoroughbass: boolean = false;
	export let isBass: boolean = false;
	export let note: NoteType;
	export let staff: string;
	export let data: SMUFLData | null = null;
	export let fontSize: number = 70; // Default font size in px
	export let variant: string;
	export let hideNoteName: boolean = false;
	export let transpose: number = 0;

	const STAFF_LINE_SPACING_RATIO = 9 / 70; // Original spacing (9px) / Original font size (70px)
	const STEM_REQUIRING_DURATIONS = ['Half', 'Quarter', '8th', '16th', '32nd', '64th'];
	const BOTTOM_LEDGER_THRESHOLD = -1;
	const TOP_LEDGER_THRESHOLD = 9;
	const MUSICAL_LETTER_SEQUENCE = ['E', 'F', 'G', 'A', 'B', 'C', 'D'];
	const REFERENCE_PITCH_POSITION = -3;
	const REFERENCE_OCTAVE = 4;
	const STEM_DIRECTION_BOUNDARY = 4;
	const EMERGENCY_GLYPH_CODES: Record<string, string> = {
		staff4Lines: 'e01a',
		staff5Lines: 'e014',
		note16thUp: '1D161',
		space: 'e020',
		staff1Line: 'e010'
	};

	function convertUnicodeHexToNumber(hexString: string): number {
		return parseInt(hexString.replace('U+', ''), 16);
	}

	function createUnicodePointFromBase(baseCodePoint: string, glyphOffset: number): string {
		return (
			'U+' + (convertUnicodeHexToNumber(baseCodePoint) + glyphOffset).toString(16).toUpperCase()
		);
	}

	function countVisibleLedgerLines(totalLines: number): number {
		return Math.floor(totalLines / 2) + (totalLines % 2);
	}

	function requiresStem(noteType: string, noteDuration: string): boolean {
		return STEM_REQUIRING_DURATIONS.includes(noteDuration) && noteType === 'note';
	}

	function determineStemDirection(verticalPosition: number): 'Up' | 'Down' {
		return verticalPosition < STEM_DIRECTION_BOUNDARY ? 'Up' : 'Down';
	}

	function deriveMusicalLetter(verticalPosition: number): string {
		const letterIndex = ((verticalPosition % 7) + 7) % 7;
		return MUSICAL_LETTER_SEQUENCE[letterIndex];
	}

	function calculateOctaveShift(verticalPosition: number): number {
		return Math.floor((verticalPosition - REFERENCE_PITCH_POSITION) / 7);
	}

	function formatPitchNotation(letter: string, octaveShift: number): string {
		const actualOctave = REFERENCE_OCTAVE + octaveShift;
		return `${letter}${letter === 'A' ? actualOctave + 1 : actualOctave}`;
	}

	function deriveVerticalPositionFromPitch(pitch: string): number {
		if (!pitch) return 0;

		// Extract letter and octave from pitch
		const letter = pitch.charAt(0).toUpperCase() as 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B';
		const octave = parseInt(pitch.substring(1));

		// Looking at the notes array, we need this exact mapping:
		// A4 -> undefined (should be -4 based on sequence)
		// B4 -> -3
		// C4 -> -2
		// D4 -> -1
		// E4 -> 0
		// F4 -> 1
		// G4 -> 2

		// Create a direct mapping for octave 4
		if (octave === 4) {
			switch (letter) {
				case 'A':
					return -4;
				case 'B':
					return -3;
				case 'C':
					return -2;
				case 'D':
					return -1;
				case 'E':
					return 0;
				case 'F':
					return 1;
				case 'G':
					return 2;
				default:
					return 0;
			}
		}

		// For other octaves, calculate the offset
		// First get the base position for octave 4
		let basePosition;
		switch (letter) {
			case 'A':
				basePosition = -4;
				break;
			case 'B':
				basePosition = -3;
				break;
			case 'C':
				basePosition = -2;
				break;
			case 'D':
				basePosition = -1;
				break;
			case 'E':
				basePosition = 0;
				break;
			case 'F':
				basePosition = 1;
				break;
			case 'G':
				basePosition = 2;
				break;
			default:
				basePosition = 0;
		}

		// Calculate position based on octave (7 steps per octave)
		return basePosition + (octave - 4) * 7;
	}

	function locateGlyphInMetadata(glyphName: string): GlyphInfo | null {
		if (!data || !data.ranges) {
			return null;
		}

		for (const [rangeKey, range] of Object.entries(data.ranges)) {
			const glyphIndex = range.glyphs.indexOf(glyphName);
			if (glyphIndex !== -1) {
				const codePoint = createUnicodePointFromBase(range.range_start, glyphIndex).replace(
					'U+',
					''
				);
				return { codePoint, range: rangeKey };
			}
		}

		return null;
	}

	function createHtmlEntityForGlyph(glyphName: string): string {
		const glyphInfo = locateGlyphInMetadata(glyphName);
		if (!glyphInfo) {
			const emergencyCode = EMERGENCY_GLYPH_CODES[glyphName];
			if (emergencyCode) {
				return `&#x${emergencyCode};`;
			}
			return '';
		}
		return `&#x${glyphInfo.codePoint};`;
	}

	function countRequiredLedgerLines(
		needsLedgerLines: boolean,
		verticalPosition: number,
		thresholdPosition: number
	): number {
		return needsLedgerLines ? Math.abs(verticalPosition - thresholdPosition) : 0;
	}

	function derivePitchInformation(verticalPosition?: number): { pitch: string } {
		if (verticalPosition === undefined) {
			return { pitch: '' };
		}

		const letter = deriveMusicalLetter(verticalPosition);
		const octaveShift = calculateOctaveShift(verticalPosition);
		const pitch = letter ? formatPitchNotation(letter, octaveShift) : '';

		return { pitch };
	}

	function buildGlyphName(
		noteType: string,
		noteDuration: string,
		verticalPosition?: number
	): string {
		const needsStem = requiresStem(noteType, noteDuration);
		const stemDirection =
			verticalPosition !== undefined ? determineStemDirection(verticalPosition) : 'Up';
		return noteType + noteDuration + (needsStem ? stemDirection : '');
	}

	function analyzeLedgerLineRequirements(verticalPosition?: number) {
		if (verticalPosition === undefined) {
			return {
				showLower: false,
				showUpper: false,
				lowerCount: 0,
				upperCount: 0
			};
		}

		const needsLowerLedgers = verticalPosition < BOTTOM_LEDGER_THRESHOLD;
		const needsUpperLedgers = verticalPosition > TOP_LEDGER_THRESHOLD;

		const rawLowerCount = needsLowerLedgers
			? Math.abs(verticalPosition - BOTTOM_LEDGER_THRESHOLD)
			: 0;
		const rawUpperCount = needsUpperLedgers ? Math.abs(verticalPosition - TOP_LEDGER_THRESHOLD) : 0;

		const visibleLowerCount = countVisibleLedgerLines(rawLowerCount);
		const visibleUpperCount = countVisibleLedgerLines(rawUpperCount);

		return {
			showLower: needsLowerLedgers,
			showUpper: needsUpperLedgers,
			lowerCount: visibleLowerCount,
			upperCount: visibleUpperCount
		};
	}

	// Calculate staff line spacing based on current font size
	$: staffLineSpacing = fontSize * STAFF_LINE_SPACING_RATIO;

	// Calculate y position from pitch if not provided, or use pitch from y if pitch not provided
	$: yPosition =
		(note.y !== undefined ? note.y : note.pitch ? deriveVerticalPositionFromPitch(note.pitch) : 0) +
		(note.type === 'note' ? transpose : 0);
	// Calculate vertical position in pixels based on dynamic font size
	$: verticalPixelOffset = -yPosition * staffLineSpacing;
	$: glyphName = buildGlyphName(note.type, note.duration, yPosition);
	$: ledgerLineDetails = analyzeLedgerLineRequirements(yPosition);
	// Calculate pitch from y if not provided
	$: displayPitch =
		note.pitch || (note.y !== undefined ? derivePitchInformation(note.y).pitch : '');

	$: normalVariant = variant !== 'single' && variant !== 'dual';

	$: isBassNote = yPosition > 9;
	$: isTrebleNote = yPosition < -2;

	$: hideNote =
		note.type === 'note' && thoroughbass && ((isBass && isBassNote) || (!isBass && isTrebleNote));

	// $: console.log(note.pitch, yPosition, isBass ? 'bass' : 'treble', hideNote);
</script>

<div class="stave-note">
	<div class="note-wrapper">
		<div class="note-container">
			{#if variant === 'dual'}
				<div class="stave ledger-line upper noselect" style="top: {staffLineSpacing * 3 * 2}px">
					{@html createHtmlEntityForGlyph('staff1Line')}
				</div>

				<div class="stave ledger-line upper noselect" style="top: {staffLineSpacing * 6 * 2}px">
					{@html createHtmlEntityForGlyph('staff1Line')}
				</div>
			{/if}

			{#if variant === 'single'}
				<div class="stave ledger-line upper noselect" style="top: {staffLineSpacing * 4.5 * 2}px">
					{@html createHtmlEntityForGlyph('staff1Line')}
				</div>
			{/if}

			{#if staff && normalVariant}
				<div class="stave noselect" unselectable="on">
					{@html createHtmlEntityForGlyph(staff + 'Wide')}
				</div>
			{/if}

			{#if note.type === 'note'}
				<div class="note {hideNote ? 'hide' : ''}" style="top: {verticalPixelOffset}px">
					{@html createHtmlEntityForGlyph(glyphName)}
				</div>
			{/if}

			{#if note.type === 'clef'}
			<div class="note {hideNote ? 'hide' : ''}" style="top: {verticalPixelOffset}px">
				{@html createHtmlEntityForGlyph(note.entity)}
			</div>
		{/if}

			{#if note.type === 'chant'}
				<div class="note" style="top: {verticalPixelOffset}px">
					{@html createHtmlEntityForGlyph(note.duration)}
				</div>
			{/if}

			{#if note.type === 'any'}
				<div class="note" style="top: {verticalPixelOffset}px">
					{@html createHtmlEntityForGlyph(note.entity)}
				</div>
			{/if}

			{#if note.type === 'barline'}
				<div class="note" style="top: {verticalPixelOffset}px">
					{@html createHtmlEntityForGlyph('barline' + note.duration)}
				</div>
			{/if}

			{#if note.type === 'timeSig'}
				<div class='timesig'>
					<div class=" numerator" style="top: {verticalPixelOffset + staffLineSpacing * -4}px">
						{@html createHtmlEntityForGlyph('timeSig' + note.numerator )}
					</div>
					<div class=" denominator" style="top: {verticalPixelOffset}px">
						{@html createHtmlEntityForGlyph('timeSig' + note.denominator  )}
					</div>
				</div>
			{/if}

			{#if note.type === 'rest'}
				<div class="note" style="top: {verticalPixelOffset}px">
					{@html createHtmlEntityForGlyph('rest' + note.duration)}
				</div>
			{/if}

			{#if ledgerLineDetails.showLower && note.type === 'note'}
				{#each Array.from({ length: ledgerLineDetails.lowerCount }) as _index, index}
					<div
						class="ledger-line lower noselect {hideNote ? 'hide' : ''}"
						style="top: {staffLineSpacing * (index + 0.5) * 2}px"
					>
						{@html createHtmlEntityForGlyph('staff1Line')}
					</div>
				{/each}
			{/if}

			{#if ledgerLineDetails.showUpper && note.type === 'note'}
				{#each Array.from({ length: ledgerLineDetails.upperCount }) as _index, index}
					<div
						class="ledger-line upper noselect {hideNote ? 'hide' : ''}"
						style="top: {staffLineSpacing * -(index + 0.5) * 2}px"
					>
						{@html createHtmlEntityForGlyph('staff1Line')}
					</div>
				{/each}
			{/if}
			{#if note.type === 'note' && !hideNoteName}
				<div class="note-name">
					{displayPitch}
				</div>
			{/if}

			{#if note.lyric?.length > 0 && !hideNoteName}
				<div class="note-lyric">
					{note.lyric}
				</div>
			{/if}
		</div>
	</div>

	{#if !data?.ranges?.beamedGroupsOfNotes?.glyphs?.includes(note.note)}
		<div class="gap noselect">
			<div style="visibility: {normalVariant ? 'visible' : 'hidden'}">
				{@html createHtmlEntityForGlyph(staff + 'Narrow')}
			</div>
		</div>

		{#if note.type === 'timeSig'}
		<div class="gap noselect">
			<div style="visibility: {normalVariant ? 'visible' : 'hidden'}">
				{@html createHtmlEntityForGlyph(staff + 'Wide')}
			</div>
		</div>
		{/if}
	{/if}
</div>

<style>
	.stave-note {
		display: flex;
		flex-direction: row;
	}

	.timesig {
		display: flex;
		flex-direction: column;
		position: relative;
		top: 0;
		left: 0;
	}
	.numerator {
		position: absolute;
	}
	.denominator {
		position: absolute;

	}

	.hide {
		display: none;
	}

	.note-wrapper {
		position: relative;
		display: flex;
	}

	.note-container {
		position: relative;
		width: 100%;
		height: 100%;
	}

	.note-name {
		position: absolute;
		left: 0;
		bottom: 0;
		transform: translate(0, -50%);
		font-size: 12px;
	}

	.note-lyric {
		position: absolute;
		left: 0;
		bottom: 0;
		transform: translate(0%, 0%);
		font-size: 12px;
		white-space: nowrap;
		word-spacing: 0.2em;
	}

	.stave {
		position: absolute;
		left: 0;
	}
	.note {
		position: relative;
		left: 20%;
	}
	.gap {
		position: relative;
	}

	.noselect {
		-webkit-user-select: none;
		-moz-user-select: none;
		-ms-user-select: none;
		user-select: none;
	}

	.ledger-line {
		position: absolute;
		left: 0;
	}
	.lower {
		transform: translateY(16%);
	}
	.upper {
		transform: translateY(-16%);
	}
</style>
