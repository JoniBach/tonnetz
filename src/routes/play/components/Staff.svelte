<script lang="ts">
	import Note from './Note.svelte';
	import type { MidiData, StaffConfig } from './types/midi-types';
	import { convertMidiToNotation } from './utils/midi-to-notation';

	type SMuFLData = {
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
	} | null;

	let {
		midiData,
		trackIndex = 0,
		config,
		thoroughbass = false,
		data = null
	}: {
		midiData: MidiData;
		trackIndex?: number;
		config: StaffConfig;
		thoroughbass?: boolean;
		data?: SMuFLData;
	} = $props();

	// Convert MIDI data to renderable notation elements
	const notationElements = $derived(convertMidiToNotation(midiData, trackIndex));

	// Extract time signature from MIDI data
	const timeSignature = $derived(
		midiData.timeSignature[0] || {
			numerator: midiData.header.timeSignature[0],
			denominator: midiData.header.timeSignature[1]
		}
	);
</script>

<div class="sheet-music">
	{#if config.title || config.subtitle}
		<div class="title">
			{#if config.title}
				<h2>{config.title}</h2>
			{/if}
			{#if config.subtitle}
				<h3>{config.subtitle}</h3>
			{/if}
		</div>
	{/if}
	<div class="smuFL score" style="font-size: {config.fontSize}px;">
		<!-- Clef -->
		{#if config.clef && !thoroughbass}
			<Note
				note={{
					type: 'clef',
					entity: typeof config.clef === 'string' ? config.clef : 'gClef',
					pitch: 'G4'
				} as any}
				{data}
				staff={config.staff}
				fontSize={config.fontSize}
				variant={config.variant || ''}
				isBass={false}
			/>
		{/if}

		{#if thoroughbass && config.clef}
			<div class="stave-note">
				<Note
					note={{
						type: 'clef',
						entity: 'gClef',
						pitch: 'G4'
					} as any}
					{data}
					staff={config.staff}
					fontSize={config.fontSize}
					variant={config.variant || ''}
					isBass={false}
				/>
				<Note
					note={{
						type: 'clef',
						entity: 'fClef',
						pitch: 'F3'
					} as any}
					{data}
					staff={config.staff}
					fontSize={config.fontSize}
					variant={config.variant || ''}
					transpose={12}
					{thoroughbass}
					isBass
				/>
			</div>
		{/if}

		<!-- Time Signature -->
		{#if timeSignature}
			<Note
				note={{
					type: 'timeSig',
					numerator: timeSignature.numerator,
					denominator: timeSignature.denominator,
					pitch: 'G4'
				} as any}
				{data}
				staff={config.staff}
				fontSize={config.fontSize}
				variant={config.variant || ''}
				isBass={false}
			/>
		{/if}

		<!-- Render notation elements (notes and barlines) -->
		{#each notationElements as element}
			{#if element.type === 'note'}
				<div class="stave-note">
					<Note
						note={{
							type: 'note',
							duration: element.duration,
							pitch: element.pitch,
							lyric: element.lyric
						} as any}
						{data}
						staff={config.staff}
						fontSize={config.fontSize}
						variant={config.variant || ''}
						hideNoteName={thoroughbass}
						{thoroughbass}
						isBass={false}
					/>
					{#if thoroughbass}
						<Note
							note={{
								type: 'note',
								duration: element.duration,
								pitch: element.pitch,
								lyric: element.lyric
							} as any}
							{data}
							staff={config.staff}
							fontSize={config.fontSize}
							variant={config.variant || ''}
							transpose={12}
							{thoroughbass}
							isBass
						/>
					{/if}
				</div>
			{:else if element.type === 'barline'}
				<Note
					note={{
						type: 'barline',
						duration: element.style === 'single' ? 'Single' : element.style === 'double' ? 'Double' : element.style === 'final' ? 'Final' : 'Single'
					} as any}
					{data}
					staff={config.staff}
					fontSize={config.fontSize}
					variant={config.variant || ''}
					isBass={false}
				/>
			{/if}
		{/each}
	</div>
</div>

<style>
	.sheet-music {
		display: flex;
		flex-direction: column;
		margin: 1rem;
		padding: 1rem;
		border-radius: 5px;
		box-shadow:
			rgba(0, 0, 0, 0.1) 0px 0px 5px 0px,
			rgba(0, 0, 0, 0.1) 0px 0px 1px 0px;
		background-color: #f5f5f5; /* eggshell */
	}

	.score {
		display: flex;
		flex-direction: row;
		flex-wrap: wrap;
	}

	.title {
		display: flex;
		flex-direction: column;
		align-items: center;
		font-size: 1rem;
		margin-top: 1rem;
	}

	.title h2 {
		font-size: 1.2rem;
		margin: 0;
		margin-bottom: 0.5rem;
		padding: 0;
		font-weight: bold;
	}

	.title h3 {
		font-size: 0.8rem;
		margin: 0;
		padding: 0;
		font-weight: normal;
	}
</style>
