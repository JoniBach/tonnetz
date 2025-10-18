/**
 * Composable utility for SMuFL glyph management
 * Handles glyph lookup, rendering, and note head construction
 */

const STEM_REQUIRING_DURATIONS = ['Half', 'Quarter', '8th', '16th', '32nd', '64th'];

const EMERGENCY_GLYPH_CODES: Record<string, string> = {
	staff4Lines: 'e01a',
	staff5Lines: 'e014',
	note16thUp: '1D161',
	space: 'e020',
	staff1Line: 'e010'
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

/**
 * Converts Unicode hex string to number
 */
export function convertUnicodeHexToNumber(hexString: string): number {
	return parseInt(hexString.replace('U+', ''), 16);
}

/**
 * Creates Unicode point from base code point and offset
 */
export function createUnicodePointFromBase(baseCodePoint: string, glyphOffset: number): string {
	return 'U+' + (convertUnicodeHexToNumber(baseCodePoint) + glyphOffset).toString(16).toUpperCase();
}

/**
 * Locates glyph in SMuFL metadata
 */
export function locateGlyphInMetadata(glyphName: string, data: SMUFLData | null): GlyphInfo | null {
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

/**
 * Creates HTML entity for glyph rendering
 */
export function createHtmlEntityForGlyph(glyphName: string, data: SMUFLData | null): string {
	const glyphInfo = locateGlyphInMetadata(glyphName, data);
	if (!glyphInfo) {
		const emergencyCode = EMERGENCY_GLYPH_CODES[glyphName];
		if (emergencyCode) {
			return `&#x${emergencyCode};`;
		}
		return '';
	}
	return `&#x${glyphInfo.codePoint};`;
}

/**
 * Checks if note requires a stem
 */
export function requiresStem(noteType: string, noteDuration: string): boolean {
	return STEM_REQUIRING_DURATIONS.includes(noteDuration) && noteType === 'note';
}

/**
 * Builds glyph name for note rendering
 */
export function buildGlyphName(
	noteType: string,
	noteDuration: string,
	verticalPosition?: number,
	stemDirection?: 'Up' | 'Down'
): string {
	const needsStem = requiresStem(noteType, noteDuration);
	const direction = stemDirection || 'Up';
	return noteType + noteDuration + (needsStem ? direction : '');
}

/**
 * Composable hook for glyph management
 * Provides glyph rendering utilities
 */
export function useNoteGlyph(data: SMUFLData | null) {
	const getGlyph = (glyphName: string) => createHtmlEntityForGlyph(glyphName, data);

	const buildNoteName = (
		noteType: string,
		noteDuration: string,
		verticalPosition?: number,
		stemDirection?: 'Up' | 'Down'
	) => buildGlyphName(noteType, noteDuration, verticalPosition, stemDirection);

	return {
		getGlyph,
		buildNoteName,
		data
	};
}
