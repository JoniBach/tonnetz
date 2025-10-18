/**
 * Composable utility for note position calculations
 * Uses Svelte 5 runes for reactive position management
 */

const STAFF_LINE_SPACING_RATIO = 9 / 70;
const BOTTOM_LEDGER_THRESHOLD = -1;
const TOP_LEDGER_THRESHOLD = 9;
const MUSICAL_LETTER_SEQUENCE = ['E', 'F', 'G', 'A', 'B', 'C', 'D'];
const REFERENCE_PITCH_POSITION = -3;
const REFERENCE_OCTAVE = 4;
const STEM_DIRECTION_BOUNDARY = 4;

type NoteType = {
	type: string;
	y?: number;
	pitch?: string;
	duration?: string;
};

/**
 * Derives vertical position from pitch notation (e.g., "C4", "A5")
 */
export function deriveVerticalPositionFromPitch(pitch: string): number {
	if (!pitch) return 0;

	const letter = pitch.charAt(0).toUpperCase() as 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B';
	const octave = parseInt(pitch.substring(1));

	// Direct mapping for octave 4
	const basePositions: Record<string, number> = {
		A: -4,
		B: -3,
		C: -2,
		D: -1,
		E: 0,
		F: 1,
		G: 2
	};

	const basePosition = basePositions[letter] ?? 0;

	// Calculate position based on octave (7 steps per octave)
	return basePosition + (octave - 4) * 7;
}

/**
 * Derives musical letter from vertical position
 */
export function deriveMusicalLetter(verticalPosition: number): string {
	const letterIndex = ((verticalPosition % 7) + 7) % 7;
	return MUSICAL_LETTER_SEQUENCE[letterIndex];
}

/**
 * Calculates octave shift from reference
 */
export function calculateOctaveShift(verticalPosition: number): number {
	return Math.floor((verticalPosition - REFERENCE_PITCH_POSITION) / 7);
}

/**
 * Formats pitch notation from letter and octave
 */
export function formatPitchNotation(letter: string, octaveShift: number): string {
	const actualOctave = REFERENCE_OCTAVE + octaveShift;
	return `${letter}${letter === 'A' ? actualOctave + 1 : actualOctave}`;
}

/**
 * Derives pitch information from vertical position
 */
export function derivePitchInformation(verticalPosition?: number): { pitch: string } {
	if (verticalPosition === undefined) {
		return { pitch: '' };
	}

	const letter = deriveMusicalLetter(verticalPosition);
	const octaveShift = calculateOctaveShift(verticalPosition);
	const pitch = letter ? formatPitchNotation(letter, octaveShift) : '';

	return { pitch };
}

/**
 * Determines stem direction based on vertical position
 */
export function determineStemDirection(verticalPosition: number): 'Up' | 'Down' {
	return verticalPosition < STEM_DIRECTION_BOUNDARY ? 'Up' : 'Down';
}

/**
 * Counts visible ledger lines
 */
export function countVisibleLedgerLines(totalLines: number): number {
	return Math.floor(totalLines / 2) + (totalLines % 2);
}

/**
 * Analyzes ledger line requirements for a note
 */
export function analyzeLedgerLineRequirements(verticalPosition?: number) {
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

	const rawLowerCount = needsLowerLedgers ? Math.abs(verticalPosition - BOTTOM_LEDGER_THRESHOLD) : 0;
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

/**
 * Composable hook for note position calculations
 * Returns reactive position values using Svelte 5 $derived
 */
export function useNotePosition(
	note: NoteType,
	transpose: number,
	fontSize: number
) {
	const staffLineSpacing = $derived(fontSize * STAFF_LINE_SPACING_RATIO);

	const yPosition = $derived(
		(note.y !== undefined ? note.y : note.pitch ? deriveVerticalPositionFromPitch(note.pitch) : 0) +
			(note.type === 'note' ? transpose : 0)
	);

	const verticalPixelOffset = $derived(-yPosition * staffLineSpacing);

	const ledgerLineDetails = $derived(analyzeLedgerLineRequirements(yPosition));

	const displayPitch = $derived(
		note.pitch || (note.y !== undefined ? derivePitchInformation(note.y).pitch : '')
	);

	const isBassNote = $derived(yPosition > 9);
	const isTrebleNote = $derived(yPosition < -2);

	return {
		staffLineSpacing,
		yPosition,
		verticalPixelOffset,
		ledgerLineDetails,
		displayPitch,
		isBassNote,
		isTrebleNote
	};
}
