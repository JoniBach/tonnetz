<script lang="ts">
	import { onMount } from 'svelte';
	import * as d3 from 'd3';

	let container: HTMLDivElement;
	let svg: d3.Selection<SVGSVGElement, unknown, null, undefined>;
	let gridGroup: d3.Selection<SVGGElement, unknown, null, undefined>;

	const CONFIG = {
		baseTriangleSize: 100,
		gridExtent: 50,
		zoomRange: 1.5,
		triangle: { strokeWidth: 0.3, strokeColor: '#333', opacity: 1 },
		vertex: { diameter: 30, color: '#1a1a1a', opacity: 1 },
		innerTriangle: {
			size: 80,
			strokeWidth: 0.2,
			strokeColor: '#111',
			fillColor: '#1f1f1f',
			opacity: 0.8
		},
		innerCircle: {
			diameter: 25,
			strokeWidth: 0.2,
			strokeColor: '#111',
			fillColor: '#1f1f1f',
			opacity: 0.9
		},
		label: {
			title: { fontSize: 8, color: '#666', fontFamily: 'Arial, sans-serif' },
			subtitle: { fontSize: 6, color: '#555', fontFamily: 'Arial, sans-serif' },
			spacing: 10 // Vertical spacing between title and subtitle
		},
		vertexLabel: {
			fontSize: 6,
			color: '#555',
			fontFamily: 'Arial, sans-serif'
		},
		music: {
			rootNote: 'C', // Configurable root note
			showMusicalLabels: true // Toggle between musical and coordinate labels
		},
		tonnetz: {
			// Configurable tonnetz formula: pitchClass = root + qInterval * q + rInterval * r
			qInterval: 7, // Perfect fifth (7 semitones) - horizontal movement
			rInterval: 4, // Major third (4 semitones) - diagonal movement
			name: 'Neo-Riemannian', // Display name for current configuration
			presets: {
				'Neo-Riemannian': { qInterval: 7, rInterval: 4 }, // Classic 3,4,5 tonnetz
				Chromatic: { qInterval: 1, rInterval: 1 }, // Chromatic lattice
				'Whole Tone': { qInterval: 2, rInterval: 2 }, // Whole tone lattice
				Quartal: { qInterval: 5, rInterval: 5 }, // Fourth-based lattice
				Augmented: { qInterval: 4, rInterval: 8 }, // Augmented triad lattice
				'Shepard Tone': { qInterval: 12, rInterval: 7 } // Octave + fifth lattice
			}
		},
		highlight: {
			// Highlight colors and styling
			color: '#ff6b35', // Orange highlight color
			strokeWidth: 2, // Highlighted stroke width
			fillOpacity: 0.1, // Fill opacity for highlighted triangles
			// Animation settings
			transitionDuration: 0.1, // CSS transition duration in seconds
			easing: 'ease' // CSS transition easing
		},
		background: '#1a1a1a'
	};

	// Reactive variables
	let currentRootNote = CONFIG.music.rootNote;
	let showMusicalLabels = true;
	let currentTonnetzName = CONFIG.tonnetz.name;
	let qInterval = CONFIG.tonnetz.qInterval;
	let rInterval = CONFIG.tonnetz.rInterval;

	// Highlight state
	let highlightedChord: string | null = null;
	let highlightedNote: string | null = null;
	let isDragging = false;

	// Performance constants - cached once
	const SQRT3 = Math.sqrt(3);
	const { baseTriangleSize, gridExtent, innerTriangle } = CONFIG;
	const HALF_SIZE = baseTriangleSize * 0.5;
	const TRI_HEIGHT = baseTriangleSize * SQRT3 * 0.5;
	const spacing = { row: TRI_HEIGHT, col: HALF_SIZE };
	const gridBounds = { width: gridExtent * spacing.col, height: gridExtent * spacing.row };
	const scale = innerTriangle.size / baseTriangleSize;
	const HEX_Y_FACTOR = TRI_HEIGHT;

	// Reactive statement to update grid when parameters change
	$: if (
		svg &&
		(currentRootNote ||
			showMusicalLabels !== undefined ||
			qInterval ||
			rInterval ||
			highlightedChord ||
			highlightedNote)
	) {
		updateViewport(currentTransform);
	}

	// Reactive statement to update CSS custom properties for highlights
	$: if (container) {
		const fillColor = CONFIG.highlight.color.replace('#', '');
		const r = parseInt(fillColor.substr(0, 2), 16);
		const g = parseInt(fillColor.substr(2, 2), 16);
		const b = parseInt(fillColor.substr(4, 2), 16);
		const fillRgba = `rgba(${r}, ${g}, ${b}, ${CONFIG.highlight.fillOpacity})`;

		container.style.setProperty('--highlight-color-value', CONFIG.highlight.color);
		container.style.setProperty(
			'--highlight-stroke-width-value',
			CONFIG.highlight.strokeWidth.toString()
		);
		container.style.setProperty('--highlight-fill-value', fillRgba);
		container.style.setProperty(
			'--highlight-transition-duration-value',
			`${CONFIG.highlight.transitionDuration}s`
		);
		container.style.setProperty('--highlight-easing-value', CONFIG.highlight.easing);
	}

	onMount(() => {
		const [width, height] = [window.innerWidth, window.innerHeight];
		const zoom = createZoomBehavior();

		svg = d3
			.select(container)
			.append('svg')
			.attr('width', width)
			.attr('height', height)
			.style('background', CONFIG.background)
			.style('user-select', 'none')
			.style('-webkit-user-select', 'none')
			.style('-moz-user-select', 'none')
			.style('-ms-user-select', 'none')
			.call(zoom)
			.on('contextmenu', (e: Event) => e.preventDefault())
			.on('mouseup', () => {
				isDragging = false;
				highlightedChord = null;
				highlightedNote = null;
			});

		gridGroup = svg.append('g');
		svg.call(zoom.transform, d3.zoomIdentity.translate(width / 2, height / 2));
		createGrid();

		const handleResize = () =>
			svg.attr('width', window.innerWidth).attr('height', window.innerHeight);
		window.addEventListener('resize', handleResize);
		return () => window.removeEventListener('resize', handleResize);
	});

	const createZoomBehavior = () =>
		d3
			.zoom()
			.scaleExtent([1 / CONFIG.zoomRange, CONFIG.zoomRange])
			.translateExtent([
				[-gridBounds.width / 2, -gridBounds.height / 2],
				[gridBounds.width / 2, gridBounds.height / 2]
			])
			.filter((e: any) => e.button === 2 || e.type === 'wheel' || e.type === 'dblclick')
			.on('zoom', (e: d3.D3ZoomEvent<SVGSVGElement, unknown>) => {
				gridGroup.attr('transform', e.transform);
				clearTimeout(viewportUpdateTimeout);
				viewportUpdateTimeout = setTimeout(() => updateViewport(e.transform), 100);
			});

	let viewportUpdateTimeout: ReturnType<typeof setTimeout>;
	let currentTransform: d3.ZoomTransform = d3.zoomIdentity;

	// Optimized utility functions
	const getTriangleVertices = (pos: { x: number; y: number }, up: boolean) => {
		const { x, y } = pos;
		return up ? [
			{ x, y }, { x: x - HALF_SIZE, y: y + TRI_HEIGHT }, { x: x + HALF_SIZE, y: y + TRI_HEIGHT }
		] : [
			{ x: x - HALF_SIZE, y }, { x: x + HALF_SIZE, y }, { x, y: y + TRI_HEIGHT }
		];
	};

	const getCentroid = (vertices: { x: number; y: number }[]) => ({
		x: vertices.reduce((sum, v) => sum + v.x, 0) / 3,
		y: vertices.reduce((sum, v) => sum + v.y, 0) / 3
	});

	// Fast visibility check
	const isVisible = (pos: { x: number; y: number }, transform: d3.ZoomTransform, bufferSize: number) => {
		const screenPos = transform.apply([pos.x, pos.y]);
		const buffer = bufferSize * transform.k;
		return screenPos[0] > -buffer && screenPos[0] < window.innerWidth + buffer &&
			   screenPos[1] > -buffer && screenPos[1] < window.innerHeight + buffer;
	};

	// Music theory constants - optimized lookups
	const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;
	const NOTE_TO_SEMITONE: Record<string, number> = {
		'C': 0, 'C#': 1, 'D': 2, 'D#': 3, 'E': 4, 'F': 5,
		'F#': 6, 'G': 7, 'G#': 8, 'A': 9, 'A#': 10, 'B': 11
	};

	// Fast math functions
	const mod12 = (n: number) => ((n % 12) + 12) % 12;
	const pitchClass = (q: number, r: number, root = 0) => mod12(root + qInterval * q + rInterval * r);
	const getNoteFromCoords = (q: number, r: number, rootNote: string) => NOTES[pitchClass(q, r, NOTE_TO_SEMITONE[rootNote])];
	const cartesianToHex = (x: number, y: number) => {
		const r = Math.round(y / HEX_Y_FACTOR);
		return { q: Math.round(x / baseTriangleSize - r * 0.5), r };
	};

	// Optimized chord detection with major/minor distinction
	function getTriangleChord(row: number, col: number, isUp: boolean): string {
		const pos = { x: col * spacing.col, y: row * spacing.row };
		const vertices = getTriangleVertices(pos, isUp);
		const pitchClasses = vertices.map((v) => {
			const { q, r } = cartesianToHex(v.x, v.y);
			return NOTE_TO_SEMITONE[getNoteFromCoords(q, r, currentRootNote)];
		});

		// Check each note as potential root
		for (const [i, root] of pitchClasses.entries()) {
			const intervals = pitchClasses
				.filter((_, idx) => idx !== i)
				.map((note) => mod12(note - root))
				.sort((a, b) => a - b);

			if (intervals.length === 2) {
				if (intervals[0] === 4 && intervals[1] === 7) return `${NOTES[root]}`; // Major triad
				if (intervals[0] === 3 && intervals[1] === 7) return `${NOTES[root]}`; // Minor triad (no 'm' suffix)
			}
		}

		return `${NOTES[pitchClasses[0]]}?`;
	}

	// Get triangle type (major/minor) for more specific identification
	function getTriangleType(row: number, col: number, isUp: boolean): string {
		const chordName = getTriangleChord(row, col, isUp);
		const triangleOrientation = isUp ? 'up' : 'down';
		return `${chordName}-${triangleOrientation}`;
	}

	// Function to handle tonnetz preset changes
	// Optimized preset and interval functions
	const changeTonnetzPreset = (presetName: string) => {
		const preset = CONFIG.tonnetz.presets[presetName as keyof typeof CONFIG.tonnetz.presets];
		if (preset) {
			currentTonnetzName = presetName;
			qInterval = preset.qInterval;
			rInterval = preset.rInterval;
		}
	};

	const INTERVAL_NAMES = ['Unison', 'Minor 2nd', 'Major 2nd', 'Minor 3rd', 'Major 3rd', 
		'Perfect 4th', 'Tritone', 'Perfect 5th', 'Minor 6th', 'Major 6th', 'Minor 7th', 'Major 7th'];
	const getIntervalDescription = (semitones: number) => INTERVAL_NAMES[semitones] || `${semitones} semitones`;

	// Simplified highlight functions
	const highlightChord = (name: string) => { highlightedChord = name; highlightedNote = null; };
	const highlightNote = (name: string) => { highlightedNote = name; highlightedChord = null; };
	const isChordHighlighted = (name: string) => highlightedChord === name;
	const isNoteHighlighted = (name: string) => highlightedNote === name;

	function createGrid() {
		updateViewport(currentTransform);
	}

	function updateViewport(transform: d3.ZoomTransform) {
		currentTransform = transform;
		gridGroup.selectAll('*').remove();
		
		// Create groups once
		const triangles = gridGroup.append('g').attr('class', 'triangles');
		const vertices = gridGroup.append('g').attr('class', 'vertices');
		const innerTriangles = gridGroup.append('g').attr('class', 'inner-triangles');
		const innerCircles = gridGroup.append('g').attr('class', 'inner-circles');
		const labels = gridGroup.append('g').attr('class', 'labels');
		const vertexLabels = gridGroup.append('g').attr('class', 'vertex-labels');
		
		const uniqueVertices = new Set<string>();
		const viewBounds = getVisibleBounds(transform);
		
		// Batch DOM operations for better performance
		const triangleData: Array<{pos: {x: number, y: number}, isUp: boolean, row: number, col: number}> = [];
		const vertexData: Array<{pos: {x: number, y: number}, label: string}> = [];
		
		// Collect data first
		for (let row = viewBounds.minRow; row <= viewBounds.maxRow; row++) {
			for (let col = viewBounds.minCol; col <= viewBounds.maxCol; col++) {
				const pos = { x: col * spacing.col, y: row * spacing.row };
				const isUp = (row + col) % 2 === 0;
				
				triangleData.push({pos, isUp, row, col});
				
				// Collect unique vertices
				getTriangleVertices(pos, isUp).forEach((v) => {
					const key = `${v.x.toFixed(1)},${v.y.toFixed(1)}`;
					if (!uniqueVertices.has(key)) {
						uniqueVertices.add(key);
						const { q, r } = cartesianToHex(v.x, v.y);
						const label = showMusicalLabels ? getNoteFromCoords(q, r, currentRootNote) : `(${q},${r})`;
						vertexData.push({pos: v, label});
					}
				});
			}
		}
		
		// Batch create triangles
		triangleData.forEach(({pos, isUp, row, col}) => {
			createTriangleWithHover(triangles, innerTriangles, pos, isUp, row, col);
			if (isTriangleVisible(pos, transform)) {
				const info = showMusicalLabels ? getTriangleChord(row, col, isUp) : `(${row},${col})`;
				const subtitle = showMusicalLabels ? (isUp ? 'major' : 'minor') : (isUp ? 'UP' : 'DOWN');
				createLabel(labels, pos, isUp, info, subtitle);
			}
		});
		
		// Batch create vertices
		vertexData.forEach(({pos, label}) => {
			createVertexWithHover(vertices, innerCircles, pos);
			createVertexLabel(vertexLabels, pos, label);
		});
	}

	// Optimized visibility functions
	const isTriangleVisible = (pos: { x: number; y: number }, transform: d3.ZoomTransform) =>
		isVisible(pos, transform, baseTriangleSize);

	function getVisibleBounds(transform: d3.ZoomTransform) {
		const [width, height] = [window.innerWidth, window.innerHeight];
		const [topLeft, bottomRight] = [transform.invert([0, 0]), transform.invert([width, height])];
		const buffer = baseTriangleSize * 1.5; // Reduced buffer for better performance

		return {
			minRow: Math.floor((topLeft[1] - buffer) / spacing.row),
			maxRow: Math.ceil((bottomRight[1] + buffer) / spacing.row),
			minCol: Math.floor((topLeft[0] - buffer) / spacing.col),
			maxCol: Math.ceil((bottomRight[0] + buffer) / spacing.col)
		};
	}

	function createTriangleWithHover(
		triangleParent: d3.Selection<SVGGElement, unknown, null, undefined>,
		innerTriangleParent: d3.Selection<SVGGElement, unknown, null, undefined>,
		pos: { x: number; y: number },
		up: boolean,
		row: number,
		col: number
	) {
		const vertices = getTriangleVertices(pos, up);
		let innerTriangleElement: d3.Selection<SVGPolygonElement, unknown, null, undefined> | null =
			null;

		triangleParent
			.append('polygon')
			.attr('points', vertices.map((v) => `${v.x},${v.y}`).join(' '))
			.attr('fill', 'transparent')
			.attr('stroke', CONFIG.triangle.strokeColor)
			.attr('stroke-width', CONFIG.triangle.strokeWidth)
			.attr('opacity', CONFIG.triangle.opacity)
			.style('cursor', 'pointer')
			.classed('highlighted-triangle', () => {
				const triangleType = getTriangleType(row, col, up);
				return isChordHighlighted(triangleType);
			})
			.on('mouseleave', () => {
				if (innerTriangleElement) {
					innerTriangleElement.remove();
					innerTriangleElement = null;
				}
			})
			.on('mousedown', (event: MouseEvent) => {
				event.preventDefault();
				isDragging = true;
				const triangleType = getTriangleType(row, col, up);
				highlightChord(triangleType);
			})
			.on('mouseenter', () => {
				if (isDragging) {
					// Highlight during drag
					const triangleType = getTriangleType(row, col, up);
					highlightChord(triangleType);
				}
				if (!innerTriangleElement) {
					innerTriangleElement = createInnerTriangleElement(innerTriangleParent, pos, up);
				}
			});

		return vertices;
	}

	// Optimized inner triangle creation
	function createInnerTriangleElement(
		parent: d3.Selection<SVGGElement, unknown, null, undefined>,
		gridPos: { x: number; y: number },
		gridUp: boolean
	) {
		const vertices = getTriangleVertices(gridPos, gridUp);
		const center = getCentroid(vertices);
		const innerVertices = vertices.map((vertex) => ({
			x: center.x + (vertex.x - center.x) * scale,
			y: center.y + (vertex.y - center.y) * scale
		}));

		return parent
			.append('polygon')
			.attr('points', innerVertices.map((v) => `${v.x},${v.y}`).join(' '))
			.attr('fill', CONFIG.innerTriangle.fillColor)
			.attr('stroke', CONFIG.innerTriangle.strokeColor)
			.attr('stroke-width', CONFIG.innerTriangle.strokeWidth)
			.attr('opacity', CONFIG.innerTriangle.opacity)
			.style('pointer-events', 'none');
	}

	function createVertexWithHover(
		vertexParent: d3.Selection<SVGGElement, unknown, null, undefined>,
		innerCircleParent: d3.Selection<SVGGElement, unknown, null, undefined>,
		pos: { x: number; y: number }
	) {
		let innerCircleElement: d3.Selection<SVGCircleElement, unknown, null, undefined> | null = null;

		vertexParent
			.append('circle')
			.attr('cx', pos.x)
			.attr('cy', pos.y)
			.attr('r', CONFIG.vertex.diameter / 2)
			.attr('fill', CONFIG.vertex.color)
			.attr('opacity', CONFIG.vertex.opacity)
			.style('cursor', 'pointer')
			.classed('highlighted-vertex', () => {
				const { q, r } = cartesianToHex(pos.x, pos.y);
				const noteName = getNoteFromCoords(q, r, currentRootNote);
				return isNoteHighlighted(noteName);
			})
			.on('mouseleave', () => {
				if (innerCircleElement) {
					innerCircleElement.remove();
					innerCircleElement = null;
				}
			})
			.on('mousedown', (event: MouseEvent) => {
				event.preventDefault();
				isDragging = true;
				const { q, r } = cartesianToHex(pos.x, pos.y);
				const noteName = getNoteFromCoords(q, r, currentRootNote);
				highlightNote(noteName);
			})
			.on('mouseenter', () => {
				if (isDragging) {
					// Highlight during drag
					const { q, r } = cartesianToHex(pos.x, pos.y);
					const noteName = getNoteFromCoords(q, r, currentRootNote);
					highlightNote(noteName);
				}
				if (!innerCircleElement) {
					innerCircleElement = createInnerCircleElement(innerCircleParent, pos);
				}
			});
	}

	// Optimized element creation functions
	const createInnerCircleElement = (
		parent: d3.Selection<SVGGElement, unknown, null, undefined>,
		pos: { x: number; y: number }
	) =>
		parent
			.append('circle')
			.attr('cx', pos.x)
			.attr('cy', pos.y)
			.attr('r', CONFIG.innerCircle.diameter / 2)
			.attr('fill', CONFIG.innerCircle.fillColor)
			.attr('stroke', CONFIG.innerCircle.strokeColor)
			.attr('stroke-width', CONFIG.innerCircle.strokeWidth)
			.attr('opacity', CONFIG.innerCircle.opacity)
			.style('pointer-events', 'none');

	const createVertexLabel = (
		parent: d3.Selection<SVGGElement, unknown, null, undefined>,
		pos: { x: number; y: number },
		label: string
	) =>
		parent
			.append('text')
			.attr('x', pos.x)
			.attr('y', pos.y)
			.attr('text-anchor', 'middle')
			.attr('dominant-baseline', 'middle')
			.attr('font-size', CONFIG.vertexLabel.fontSize)
			.attr('font-family', CONFIG.vertexLabel.fontFamily)
			.attr('fill', CONFIG.vertexLabel.color)
			.style('pointer-events', 'none')
			.text(label);

	function createLabel(
		parent: d3.Selection<SVGGElement, unknown, null, undefined>,
		gridPos: { x: number; y: number },
		gridUp: boolean,
		title: string,
		subtitle: string
	) {
		const vertices = getTriangleVertices(gridPos, gridUp);
		const center = getCentroid(vertices);

		// Create title and subtitle text
		[
			{ text: title, y: center.y - CONFIG.label.spacing / 2, config: CONFIG.label.title },
			{ text: subtitle, y: center.y + CONFIG.label.spacing / 2, config: CONFIG.label.subtitle }
		].forEach(({ text, y, config }) => {
			parent
				.append('text')
				.attr('x', center.x)
				.attr('y', y)
				.attr('text-anchor', 'middle')
				.attr('dominant-baseline', 'middle')
				.attr('font-size', config.fontSize)
				.attr('font-family', config.fontFamily)
				.attr('fill', config.color)
				.style('pointer-events', 'none')
				.text(text);
		});
	}
</script>

<!-- Control Panel -->
<div class="control-panel">
	<div class="highlight-info" class:inactive={!highlightedChord && !highlightedNote}>
		{#if highlightedChord}
			<span
				>Playing: {highlightedChord.split('-')[0]}
				{highlightedChord.includes('-up') ? '(major)' : '(minor)'}</span
			>
		{:else if highlightedNote}
			<span>Playing: {highlightedNote}</span>
		{:else}
			<span>Nothing playing</span>
		{/if}
	</div>
	<div class="control-row">
		<label>
			<input type="checkbox" bind:checked={showMusicalLabels} />
			Show Musical Labels
		</label>
	</div>
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
				on:change={(e) => changeTonnetzPreset((e.target as HTMLSelectElement)?.value || '')}
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
</div>

<div bind:this={container} class="tonnetz-container">
	<!-- SVG will be appended here by D3 -->
</div>

<style>
	:global(body) {
		margin: 0;
		padding: 0;
		overflow: hidden;
		background: var(--bg-color);
	}

	.control-panel {
		position: fixed;
		top: 10px;
		left: 10px;
		z-index: 1000;
		background: rgba(0, 0, 0, 0.9);
		padding: 12px;
		border-radius: 8px;
		color: white;
		font-family: Arial, sans-serif;
		font-size: 11px;
		display: flex;
		flex-direction: column;
		gap: 8px;
		min-width: 240px;
		box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
	}

	.highlight-info {
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(255, 107, 53, 0.1);
		border: 1px solid #ff6b35;
		border-radius: 4px;
		padding: 6px 8px;
		font-size: 10px;
		color: #ff6b35;
		font-weight: bold;
		transition: all 0.2s ease;
	}

	.highlight-info.inactive {
		background: rgba(128, 128, 128, 0.1);
		border: 1px solid #666;
		color: #888;
		font-weight: normal;
	}

	.control-row {
		display: flex;
		gap: 12px;
		align-items: center;
		flex-wrap: wrap;
	}

	.custom-intervals {
		flex-direction: column;
		gap: 6px;
		padding-top: 6px;
		border-top: 1px solid #444;
	}

	.control-panel label {
		display: flex;
		align-items: center;
		gap: 6px;
		cursor: pointer;
		font-size: 11px;
	}

	.control-panel select,
	.control-panel input[type='number'] {
		padding: 4px 6px;
		border-radius: 4px;
		border: 1px solid #555;
		background: #333;
		color: white;
		font-size: 10px;
		min-width: 45px;
	}

	.control-panel input[type='number'] {
		width: 45px;
		text-align: center;
	}

	.interval-desc {
		font-size: 9px;
		color: #aaa;
		margin-left: 4px;
		font-style: italic;
		white-space: nowrap;
	}

	.control-panel input[type='checkbox'] {
		transform: scale(1);
	}

	.control-panel select:focus,
	.control-panel input:focus {
		outline: none;
		border-color: #666;
		box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.1);
	}

	.tonnetz-container {
		--bg-color: #1a1a1a;
		--highlight-color: var(--highlight-color-value, #ff6b35);
		--highlight-stroke-width: var(--highlight-stroke-width-value, 2);
		--highlight-fill: var(--highlight-fill-value, rgba(255, 107, 53, 0.1));
		--highlight-transition-duration: var(--highlight-transition-duration-value, 0.1s);
		--highlight-easing: var(--highlight-easing-value, ease);
		width: 100vw;
		height: 100vh;
		position: fixed;
		top: 0;
		left: 0;
		background: var(--bg-color);
		user-select: none; /* Prevent text selection */
		-webkit-user-select: none; /* Safari */
		-moz-user-select: none; /* Firefox */
		-ms-user-select: none; /* IE/Edge */
	}

	/* Highlight styles - using CONFIG values */
	:global(.highlighted-triangle) {
		stroke: var(--highlight-color, #ff6b35) !important;
		stroke-width: var(--highlight-stroke-width, 2) !important;
		fill: var(--highlight-fill, rgba(255, 107, 53, 0.1)) !important;
		opacity: 1 !important;
		transition: all var(--highlight-transition-duration, 0.1s) var(--highlight-easing, ease);
	}

	:global(.highlighted-vertex) {
		fill: var(--highlight-color, #ff6b35) !important;
		stroke: var(--highlight-color, #ff6b35) !important;
		stroke-width: var(--highlight-stroke-width, 2) !important;
		opacity: 1 !important;
		transition: all var(--highlight-transition-duration, 0.1s) var(--highlight-easing, ease);
	}

	/* Hover effects during selection */
	:global(.tonnetz-container) {
		cursor: default;
	}

	:global(.tonnetz-container.dragging) {
		cursor: crosshair;
	}
</style>
