<script lang="ts">
	import { useNotePosition, determineStemDirection } from './note/note-position.svelte';
	import { useNoteGlyph } from './note/note-glyph.svelte';

	type NoteType = {
		note?: string;
		type: string;
		duration?: string;
		y?: number;
		pitch?: string;
		entity?: string;
		numerator?: number;
		denominator?: number;
		lyric?: string;
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

	let {
		thoroughbass = false,
		isBass = false,
		note,
		staff,
		data = null,
		fontSize = 70,
		variant = '',
		hideNoteName = false,
		transpose = 0
	}: {
		thoroughbass?: boolean;
		isBass?: boolean;
		note: NoteType;
		staff: string;
		data?: SMUFLData | null;
		fontSize?: number;
		variant?: string;
		hideNoteName?: boolean;
		transpose?: number;
	} = $props();

	// Use composable utilities for clean separation of concerns
	const {
		staffLineSpacing,
		yPosition,
		verticalPixelOffset,
		ledgerLineDetails,
		displayPitch,
		isBassNote,
		isTrebleNote
	} = useNotePosition(note, transpose, fontSize);

	const { getGlyph, buildNoteName } = useNoteGlyph(data);

	// Derived values
	const normalVariant = $derived(variant !== 'single' && variant !== 'dual');

	const stemDirection = $derived(determineStemDirection(yPosition));

	const glyphName = $derived(
		buildNoteName(note.type, note.duration || '', yPosition, stemDirection)
	);

	const hideNote = $derived(
		note.type === 'note' && thoroughbass && ((isBass && isBassNote) || (!isBass && isTrebleNote))
	);
</script>

{#snippet ledgerLine(position: number, type: 'upper' | 'lower')}
	<div class="ledger-line {type} noselect {hideNote ? 'hide' : ''}" style="top: {position}px">
		{@html getGlyph('staff1Line')}
	</div>
{/snippet}

{#snippet staffLine(glyphName: string, className: string = '')}
	<div class="stave {className} noselect" unselectable="on">
		{@html getGlyph(glyphName)}
	</div>
{/snippet}

{#snippet noteRenderer(glyphName: string, offset: number, hidden: boolean = false)}
	<div class="note {hidden ? 'hide' : ''}" style="top: {offset}px">
		{@html getGlyph(glyphName)}
	</div>
{/snippet}

<div class="stave-note">
	<div class="note-wrapper">
		<div class="note-container">
			<!-- Variant-specific staff lines -->
			{#if variant === 'dual'}
				{@render staffLine('staff1Line', 'ledger-line upper')}
				<div class="stave ledger-line upper noselect" style="top: {staffLineSpacing * 6 * 2}px">
					{@html getGlyph('staff1Line')}
				</div>
			{/if}

			{#if variant === 'single'}
				<div class="stave ledger-line upper noselect" style="top: {staffLineSpacing * 4.5 * 2}px">
					{@html getGlyph('staff1Line')}
				</div>
			{/if}

			<!-- Main staff -->
			{#if staff && normalVariant}
				{@render staffLine(staff + 'Wide')}
			{/if}

			<!-- Note type renderers -->
			{#if note.type === 'note'}
				{@render noteRenderer(glyphName, verticalPixelOffset, hideNote)}
			{/if}

			{#if note.type === 'clef' && note.entity}
				{@render noteRenderer(note.entity, verticalPixelOffset, hideNote)}
			{/if}

			{#if note.type === 'chant' && note.duration}
				{@render noteRenderer(note.duration, verticalPixelOffset)}
			{/if}

			{#if note.type === 'any' && note.entity}
				{@render noteRenderer(note.entity, verticalPixelOffset)}
			{/if}

			{#if note.type === 'barline' && note.duration}
				{@render noteRenderer('barline' + note.duration, verticalPixelOffset)}
			{/if}

			{#if note.type === 'timeSig' && note.numerator && note.denominator}
				<div class="timesig">
					<div class="numerator" style="top: {verticalPixelOffset + staffLineSpacing * -4}px">
						{@html getGlyph('timeSig' + note.numerator)}
					</div>
					<div class="denominator" style="top: {verticalPixelOffset}px">
						{@html getGlyph('timeSig' + note.denominator)}
					</div>
				</div>
			{/if}

			{#if note.type === 'rest' && note.duration}
				{@render noteRenderer('rest' + note.duration, verticalPixelOffset)}
			{/if}

			<!-- Ledger lines -->
			{#if ledgerLineDetails.showLower && note.type === 'note'}
				{#each Array.from({ length: ledgerLineDetails.lowerCount }) as _, index}
					{@render ledgerLine(staffLineSpacing * (index + 0.5) * 2, 'lower')}
				{/each}
			{/if}

			{#if ledgerLineDetails.showUpper && note.type === 'note'}
				{#each Array.from({ length: ledgerLineDetails.upperCount }) as _, index}
					{@render ledgerLine(staffLineSpacing * -(index + 0.5) * 2, 'upper')}
				{/each}
			{/if}

			<!-- Note metadata -->
			{#if note.type === 'note' && !hideNoteName}
				<div class="note-name">{displayPitch}</div>
			{/if}

			{#if note.lyric && !hideNoteName}
				<div class="note-lyric">{note.lyric}</div>
			{/if}
		</div>
	</div>

	<!-- Staff gaps -->
	{#if !data?.ranges?.beamedGroupsOfNotes?.glyphs?.includes(note.note)}
		<div class="gap noselect">
			<div style="visibility: {normalVariant ? 'visible' : 'hidden'}">
				{@html getGlyph(staff + 'Narrow')}
			</div>
		</div>

		{#if note.type === 'timeSig'}
			<div class="gap noselect">
				<div style="visibility: {normalVariant ? 'visible' : 'hidden'}">
					{@html getGlyph(staff + 'Wide')}
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
