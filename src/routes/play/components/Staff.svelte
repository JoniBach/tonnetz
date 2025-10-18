<script lang="ts">
	import Note from './Note.svelte';

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

	type StaffInfo = {
		title?: string;
		subtitle?: string;
		fontSize: number;
		staff: string;
		clef?: boolean | string;
		timeSignature?: {
			numerator: number;
			denominator: number;
		};
		variant?: string;
	};

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
		info,
		notes,
		thoroughbass = false,
		data = null
	}: {
		info: StaffInfo;
		notes: NoteType[];
		thoroughbass?: boolean;
		data?: SMuFLData;
	} = $props();
</script>

<div class="sheet-music">
	{#if info.title || info.subtitle}
		<div class="title">
			{#if info.title}
				<h2>{info.title}</h2>
			{/if}
			{#if info.subtitle}
				<h3>{info.subtitle}</h3>
			{/if}
		</div>
	{/if}
	<div class="smuFL score" style="font-size: {info.fontSize}px;">
		{#if info.clef && !thoroughbass}
			<Note
				note={{
					type: 'clef',
					entity: 'gClef',
					pitch: 'G4'
				} as any}
				{data}
				staff={info.staff}
				fontSize={info.fontSize}
				variant={info.variant || ''}
				isBass={false}
			/>
		{/if}

		{#if thoroughbass && info.clef}
			<div class="stave-note">
				<Note
					note={{
						type: 'clef',
						entity: 'gClef',
						pitch: 'G4'
					} as any}
					{data}
					staff={info.staff}
					fontSize={info.fontSize}
					variant={info.variant || ''}
					isBass={false}
				/>
				<Note
					note={{
						type: 'clef',
						entity: 'fClef',
						pitch: 'F3'
					} as any}
					{data}
					staff={info.staff}
					fontSize={info.fontSize}
					variant={info.variant || ''}
					transpose={12}
					{thoroughbass}
					isBass
				/>
			</div>
		{/if}
		{#if info.timeSignature}
			<Note
				note={{
					type: 'timeSig',
					numerator: info.timeSignature.numerator,
					denominator: info.timeSignature.denominator,
					pitch: 'G4'
				} as any}
				{data}
				staff={info.staff}
				fontSize={info.fontSize}
				variant={info.variant || ''}
				isBass={false}
			/>
		{/if}
		{#each notes as note}
			<div class="stave-note">
				<Note
					note={note as any}
					{data}
					staff={info.staff}
					fontSize={info.fontSize}
					variant={info.variant || ''}
					hideNoteName={thoroughbass}
					{thoroughbass}
					isBass={false}
				/>
				{#if thoroughbass}
					<Note
						note={note as any}
						{data}
						staff={info.staff}
						fontSize={info.fontSize}
						variant={info.variant || ''}
						transpose={12}
						{thoroughbass}
						isBass
					/>
				{/if}
			</div>
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
