<script lang="ts">
	// Type definitions
	type RangeData = {
		glyphs: string[];
		range_start: string;
		description: string;
	};

	type GlyphData = {
		codepoint: string;
		description: string;
	};

	type SMUFLData = {
		ranges: Record<string, RangeData>;
		glyphnames?: Record<string, GlyphData>;
		metadata?: Record<string, any>;
	};

	type GlyphInfo = {
		name: string;
		entity: string;
		codePoint: string;
		description: string;
		symbol: string;
	};

	export let data: SMUFLData | null = null;
	export let defaultFilter: string = '';

	// Constants
	const FALLBACK_CODES: Record<string, string> = {
		staff4Lines: 'e01a',
		staff5Lines: 'e014',
		note16thUp: '1D161',
		space: 'e020'
	};

	export let searchSuggestions = ['individualNotes'];

	// Search state
	let searchQuery = '';
	$: normalizedSearchQuery = searchQuery.toLowerCase().trim();
	$: normalizedDefaultFilter = defaultFilter.toLowerCase().trim();

	// Pure utility functions
	const parseHex = (str: string): number => parseInt(str.replace('U+', ''), 16);

	const getCodePointHex = (start: string, offset: number): string =>
		'U+' + (parseHex(start) + offset).toString(16).toUpperCase();

	const getHtmlEntity = (start: string, offset: number): string =>
		`&#x${(parseHex(start) + offset).toString(16)};`;

	const getGlyphDescription = (glyphName: string): string =>
		data?.glyphnames?.[glyphName]?.description || '';

	const findGlyphByName = (glyphName: string): { codePoint: string; range: string } | null => {
		if (!data?.ranges) return null;

		for (const [rangeKey, range] of Object.entries(data.ranges)) {
			const index = range.glyphs.indexOf(glyphName);
			if (index !== -1) {
				const codePoint = getCodePointHex(range.range_start, index).replace('U+', '');
				return { codePoint, range: rangeKey };
			}
		}
		return null;
	};

	const getGlyphHtmlEntity = (glyphName: string): string => {
		const glyph = findGlyphByName(glyphName);
		if (!glyph) {
			const fallbackCode = FALLBACK_CODES[glyphName];
			return fallbackCode ? `&#x${fallbackCode};` : '';
		}
		return `&#x${glyph.codePoint};`;
	};

	// Filtering functions
	const matchesSearchTerm = (text: string, query: string): boolean =>
		text.toLowerCase().includes(query.toLowerCase().trim());

	const rangeMatchesQuery = (
		rangeKey: string,
		range: RangeData,
		normalizedQuery: string,
		isDefaultFilter: boolean = false
	): boolean => {
		return (
			matchesSearchTerm(rangeKey, normalizedQuery) ||
			matchesSearchTerm(range.description, normalizedQuery)
		);
	};

	const glyphMatchesQuery = (
		glyphName: string,
		normalizedQuery: string,
		range: RangeData,
		isDefaultFilter: boolean = false
	): boolean => {
		// Match by name
		if (matchesSearchTerm(glyphName, normalizedQuery)) return true;

		// Match by description
		const description = getGlyphDescription(glyphName);
		if (description && matchesSearchTerm(description, normalizedQuery)) return true;

		// Match by codepoint
		const index = range.glyphs.indexOf(glyphName);
		if (index !== -1) {
			const codePoint = getCodePointHex(range.range_start, index);
			if (matchesSearchTerm(codePoint, normalizedQuery)) return true;
		}

		return false;
	};

	// The filterGlyphs function has been removed as we're now using if blocks in the template
	// to conditionally show/hide glyphs based on search criteria

	// Create glyph info objects for rendering
	const createGlyphInfo = (
		glyphName: string,
		rangeKey: string,
		range: RangeData,
		index: number
	): GlyphInfo => {
		const codePoint = getCodePointHex(range.range_start, index);
		const entity = getHtmlEntity(range.range_start, index);
		return {
			name: glyphName,
			entity,
			codePoint,
			description: getGlyphDescription(glyphName),
			symbol: entity
		};
	};

	// Event handlers
	const handleSearch = (event: Event): void => {
		event.preventDefault();
	};

	const setSearchQuery = (query: string): void => {
		searchQuery = query;
	};

	// Reactive declarations
	// We're no longer using filterGlyphs and displayRanges since we're using if blocks in the template
	// Calculate counts using reduce for more functional approach
	$: totalGlyphCount = data?.ranges
		? Object.values(data.ranges).reduce((sum, range) => sum + range.glyphs.length, 0)
		: 0;

	// First filter by default filter if present
	$: defaultFilteredRanges = data?.ranges
		? Object.fromEntries(
				Object.entries(data.ranges).filter(([key, range]) => {
					// If no default filter, include all ranges
					if (!normalizedDefaultFilter) return true;

					// Check if range matches default filter
					const rangeMatches = rangeMatchesQuery(key, range, normalizedDefaultFilter, true);

					// Check if any glyphs in the range match default filter
					const hasMatchingGlyphs = range.glyphs.some((glyph) =>
						glyphMatchesQuery(glyph, normalizedDefaultFilter, range, true)
					);

					return rangeMatches || hasMatchingGlyphs;
				})
			)
		: {};

	$: defaultFilteredGlyphCount = defaultFilteredRanges
		? Object.values(defaultFilteredRanges).reduce((sum, range) => sum + range.glyphs.length, 0)
		: 0;

	$: filteredGlyphCount =
		normalizedSearchQuery && defaultFilteredRanges
			? Object.entries(defaultFilteredRanges).reduce((sum, [key, range]) => {
					const rangeMatches = rangeMatchesQuery(key, range, normalizedSearchQuery);
					const glyphInfos = range.glyphs.map((glyph, i) => ({ name: glyph }));
					const matchingGlyphsCount = glyphInfos.filter(
						(glyph) =>
							!normalizedSearchQuery ||
							rangeMatches ||
							glyphMatchesQuery(glyph.name, normalizedSearchQuery, range)
					).length;
					return sum + matchingGlyphsCount;
				}, 0)
			: defaultFilteredGlyphCount;
</script>

<!-- Search Form Component -->
<form class="search-bar" on:submit={handleSearch}>
	<input
		type="search"
		placeholder="Search by name, description or codepoint..."
		bind:value={searchQuery}
	/>
	<button type="submit">Search</button>
	{#if searchQuery.trim()}
		<button type="button" class="clear-button" on:click={() => setSearchQuery('')}> Clear </button>
	{/if}
</form>

<!-- Search Suggestions -->
<div class="search-suggestions-container">
	<ul class="search-suggestions">
		<li class="suggestion-label">Suggestions:</li>
		{#each searchSuggestions as suggestion}
			<li class="suggestion-item">
				<button class="suggestion-button" on:click={() => setSearchQuery(suggestion)}>
					{suggestion}
				</button>
			</li>
		{/each}
	</ul>
</div>

<!-- Search Results Summary -->
{#if data}
	<div class="results-count">
		{#if filteredGlyphCount === 0}
			No symbols found
		{:else}
			Showing <strong>{filteredGlyphCount}</strong> out of
			<strong>{defaultFilteredGlyphCount}</strong>
			symbols
			{#if defaultFilteredGlyphCount !== totalGlyphCount}
				(filtered from <strong>{totalGlyphCount}</strong> total)
			{/if}
		{/if}
		{#if defaultFilter && searchQuery.trim()}
			for default filter "{defaultFilter}" and query "{searchQuery}"
		{:else if defaultFilter}
			for default filter "{defaultFilter}"
		{:else if searchQuery.trim()}
			for query "{searchQuery}"
		{/if}
	</div>
{/if}

<!-- Glyph Documentation -->
<div class="documentation">
	{#each Object.entries(defaultFilteredRanges || {}) as [key, range]}
		{@const glyphInfos = range.glyphs.map((glyph, i) => createGlyphInfo(glyph, key, range, i))}
		{@const rangeMatches = normalizedSearchQuery
			? rangeMatchesQuery(key, range, normalizedSearchQuery)
			: true}

		<!-- Only show the section if there's no search or if the range/glyphs match -->
		{#if !normalizedSearchQuery || rangeMatches || glyphInfos.some( (glyph) => glyphMatchesQuery(glyph.name, normalizedSearchQuery, range) )}
			<section class="range-section">
				<h3 class="range-title">{range.description}</h3>
				<p class="range-description">{key}</p>

				<dl class="glyph-list">
					{#each glyphInfos as glyph}
						<!-- Only show the glyph if there's no search, the range matches, or the glyph matches -->
						{#if !normalizedSearchQuery || rangeMatches || glyphMatchesQuery(glyph.name, normalizedSearchQuery, range)}
							<div class="glyph-entry">
								<span class="glyph-symbol smuFL">{@html glyph.symbol}</span>
								<div class="glyph-content">
									<dt class="glyph-name">{glyph.description}</dt>
									<dd class="glyph-details">
										<span class="glyph-entity">{glyph.entity}</span>
										<span class="glyph-codepoint">{glyph.codePoint}</span>
									</dd>
									{#if glyph.description}
										<dd class="glyph-description">{glyph.name}</dd>
									{/if}
								</div>
							</div>
						{/if}
					{/each}
				</dl>
			</section>
		{/if}
	{/each}
</div>

<style>
	/* CSS Variables for DRY styling */
	:root {
		--font-family: system-ui, -apple-system, sans-serif;
		--primary-color: #0066cc;
		--secondary-color: #666;
		--text-color: #333;
		--text-light: #444;
		--text-lighter: #666;
		--bg-light: #f9f9f9;
		--border-color: #ccc;
		--border-radius: 4px;
		--spacing-xs: 0.25rem;
		--spacing-sm: 0.5rem;
		--spacing-md: 1rem;
		--spacing-lg: 2rem;
	}

	/* Base styles */
	.documentation {
		font-family: var(--font-family);
		line-height: 1.4;
		margin: var(--spacing-md);
	}

	/* Reset for description lists */
	dt,
	dd {
		margin: 0;
		padding: 0;
	}

	/* Search components */
	.search-bar {
		display: flex;
		gap: var(--spacing-sm);
		padding: var(--spacing-sm);
		border-radius: var(--border-radius);
	}

	.search-bar input {
		flex: 1;
		padding: var(--spacing-sm);
		border: 1px solid var(--border-color);
		border-radius: var(--border-radius);
		background-color: var(--bg-light);
		outline: none;
	}

	.search-bar button {
		background-color: var(--primary-color);
		color: white;
		border: none;
		border-radius: var(--border-radius);
		padding: var(--spacing-sm) var(--spacing-md);
		cursor: pointer;
	}

	.search-bar .clear-button {
		background-color: var(--secondary-color);
	}

	.search-suggestions-container {
		margin: var(--spacing-sm);
	}

	.search-suggestions {
		font-size: 0.7rem;
		display: flex;
		flex-wrap: wrap;
		gap: var(--spacing-sm);
		list-style: none;
		padding: 0;
		color: var(--text-light);
	}

	.suggestion-label {
		margin-right: var(--spacing-sm);
	}

	.suggestion-item {
		display: inline-block;
	}

	.suggestion-button {
		background: none;
		border: none;
		color: var(--primary-color);
		cursor: pointer;
		padding: 0;
		text-decoration: underline;
		font-size: 0.7rem;
	}

	/* Results info */
	.no-results,
	.results-count {
		padding: var(--spacing-sm);
		border-radius: var(--border-radius);
		color: var(--text-lighter);
		font-size: 0.7rem;
	}

	.no-results {
		font-style: italic;
	}

	.results-count strong {
		color: var(--primary-color);
		font-weight: 600;
	}

	/* Range sections */
	.range-section {
		margin-bottom: var(--spacing-lg);
	}

	.range-title {
		font-size: 1.2rem;
		font-weight: bold;
		margin-bottom: var(--spacing-xs);
		color: var(--text-color);
	}

	.range-description {
		font-size: 0.9rem;
		color: var(--text-lighter);
		margin-top: 0;
		margin-bottom: var(--spacing-md);
	}

	/* Glyph grid and items */
	.glyph-list {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
		gap: var(--spacing-sm);
		margin: 0;
	}

	.glyph-entry {
		display: flex;
		flex-direction: row;
		padding: var(--spacing-sm);
		border-radius: var(--border-radius);
		background-color: var(--bg-light);
		min-height: 4.5rem;
	}

	.glyph-content {
		display: flex;
		flex-direction: column;
		flex: 1;
	}

	.glyph-name {
		font-weight: 500;
		margin-bottom: var(--spacing-xs);
	}

	.glyph-details {
		display: flex;
		margin: 0;
	}

	.glyph-symbol {
		font-size: 2.5rem;
		margin-right: var(--spacing-md);
		min-width: 3rem;
		height: 100%;
		display: flex;
		align-self: stretch;
		place-content: center;
		text-align: center;
	}

	.glyph-entity {
		color: var(--text-lighter);
		font-size: 0.85rem;
		margin-right: 0.75rem;
	}

	.glyph-codepoint {
		color: var(--primary-color);
		font-family: monospace;
		font-size: 0.85rem;
	}

	.glyph-description {
		margin: var(--spacing-sm) 0 0 0;
		padding: 0;
		font-size: 0.8125rem;
		color: var(--text-light);
		line-height: 1.3;
		font-style: italic;
	}
</style>
