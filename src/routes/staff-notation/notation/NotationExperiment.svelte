<script lang="ts">
	export let note: {
		stave: string;
		note: string;
	};

	export let data: any = null;

	function parseHex(str: string): number {
		return parseInt(str.replace('U+', ''), 16);
	}

	function getCodePointHex(start: string, offset: number): string {
		return 'U+' + (parseHex(start) + offset).toString(16).toUpperCase();
	}

	function getHtmlChar(start: string, offset: number): string {
		const code = parseHex(start) + offset;
		return String.fromCodePoint(code);
	}

	function getHtmlEntity(start: string, offset: number): string {
		const code = parseHex(start) + offset;
		return `&#x${code.toString(16)};`;
	}

	function findGlyphByName(glyphName: string): { codePoint: string; range: string } | null {
		if (!data || !data.ranges) {
			console.warn('No metadata available');
			return null;
		}

		// Search through all ranges in the metadata
		for (const [rangeKey, range] of Object.entries(data.ranges)) {
			const index = range.glyphs.indexOf(glyphName);
			if (index !== -1) {
				// Found the glyph in this range
				const codePoint = getCodePointHex(range.range_start, index).replace('U+', '');
				return { codePoint, range: rangeKey };
			}
		}

		console.warn(`Glyph name not found: ${glyphName}`);
		return null;
	}

	// Convert a glyph name to its HTML entity representation
	function getGlyphHtmlEntity(glyphName: string): string {
		const glyph = findGlyphByName(glyphName);
		if (!glyph) {
			// Fallback for common glyphs if metadata isn't loaded yet
			const fallbacks: Record<string, string> = {
				staff4Lines: 'e01a',
				staff5Lines: 'e014',
				note16thUp: '1D161',
				space: 'e020'
			};

			const fallbackCode = fallbacks[glyphName];
			if (fallbackCode) {
				return `&#x${fallbackCode};`;
			}
			return '';
		}
		return `&#x${glyph.codePoint};`;
	}

	$: ranges = data?.ranges;
	$: console.log(ranges);
</script>

<div>Semiquaver = 1D161 &#x1D161 = 1D158 &#x1D158; + 1D165 &#x1D165; + 1D16F &#x1D16F;</div>
<div class="smuFL">Stave &#xe014; &#x1D161; Note</div>

<div class="smuFL score">
	<!-- <div class="gap">{@html getGlyphHtmlEntity('staff5LinesNarrow')}</div> -->
	<div class="stave-note">
		<div class="note-container">
			<div class="stave">{@html getGlyphHtmlEntity('staff5LinesWide')}</div>
			<div class="note">{@html getGlyphHtmlEntity('barlineSingle')}</div>
		</div>
	</div>

	<div class="stave-note">
		<div class="note-container">
			<div class="stave">{@html getGlyphHtmlEntity('staff5LinesWide')}</div>
			<div class="note">{@html getGlyphHtmlEntity('note16thUp')}</div>
		</div>
	</div>

	<div class="stave-note">
		<div class="note-container">
			<div class="stave">{@html getGlyphHtmlEntity('staff5LinesWide')}</div>
			<div class="note">{@html getGlyphHtmlEntity('note16thUp')}</div>
		</div>
	</div>

	<div class="stave-note">
		<div class="note-container">
			<div class="stave">{@html getGlyphHtmlEntity('staff5LinesWide')}</div>
			<div class="note">{@html getGlyphHtmlEntity('barlineFinal')}</div>
		</div>
	</div>
</div>

<div class="smuFL score">
	<div class="stave-note">
		<div class="note-container">
			<div class="stave">{@html getGlyphHtmlEntity('staff5LinesWide')}</div>
			<div class="note">{@html getGlyphHtmlEntity('note16thUp')}</div>
		</div>
	</div>
</div>

<div class="smuFL score">
	<div class="stave-note">
		<div class="note-container">
			<div class="stave">{@html getGlyphHtmlEntity('staff5LinesWide')}</div>
			<div class="note">{@html getGlyphHtmlEntity('textBlackNoteShortStem')}</div>
		</div>
	</div>
	<div class="stave-note">
		<div class="note-container">
			<div class="stave">{@html getGlyphHtmlEntity('staff5LinesWide')}</div>
			<div class="note">{@html getGlyphHtmlEntity('textCont8thBeamShortStem')}</div>
		</div>
	</div>
	<div class="stave-note">
		<div class="note-container">
			<div class="stave">{@html getGlyphHtmlEntity('staff5LinesWide')}</div>
			<div class="note">{@html getGlyphHtmlEntity('textBlackNoteFrac8thShortStem')}</div>
		</div>
	</div>
	<div class="stave-note">
		<div class="note-container">
			<div class="stave">{@html getGlyphHtmlEntity('staff5LinesWide')}</div>
			<div class="note">{@html getGlyphHtmlEntity('textCont16thBeamShortStem')}</div>
		</div>
	</div>
	<div class="stave-note">
		<div class="note-container">
			<div class="stave">{@html getGlyphHtmlEntity('staff5LinesWide')}</div>
			<div class="note">{@html getGlyphHtmlEntity('textBlackNoteFrac16thShortStem')}</div>
		</div>
	</div>
</div>

<style>
	.list {
		display: flex;
		flex-direction: column;
		flex-wrap: wrap;
	}

	.score {
		display: flex;
		flex-direction: row;
		flex-wrap: wrap;
	}

	.stave-note {
		display: flex;
		flex-direction: row;
	}

	.note-container {
		position: relative;
		width: 100%;
		height: 100%;
	}

	.stave {
		position: absolute;
		top: 0;
		left: 0;
	}
	.note {
		position: relative;
		top: 0;
		left: 10%;
	}

	.gap {
		position: relative;
		top: 0;
		left: 0;
	}

	/* The element that appears later in the DOM will be rendered on top */
	/* Since stave comes after note in our HTML, it will appear on top */
</style>
