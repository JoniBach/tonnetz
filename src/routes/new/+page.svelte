<script lang="ts">
	import { onMount } from 'svelte';
	import * as d3 from 'd3';

	let container: HTMLDivElement;
	let svg: d3.Selection<SVGSVGElement, unknown, null, undefined>;
	let gridGroup: d3.Selection<SVGGElement, unknown, null, undefined>;

	const CONFIG = {
		baseTriangleSize: 100,
		gridExtent: 50,
		zoomRange: 2,
		triangle: { strokeWidth: 0.3, strokeColor: '#333', opacity: 1 },
		vertex: { diameter: 30, color: '#1a1a1a', opacity: 1 },
		innerTriangle: {
			size: 80,
			strokeWidth: 0.2,
			strokeColor: '#222',
			fillColor: '#111',
			opacity: 0.8
		},
		innerCircle: {
			diameter: 20,
			strokeWidth: 0.2,
			strokeColor: '#222',
			fillColor: '#111',
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
		background: '#1a1a1a'
	};

	// Reactive variables
	let currentRootNote = CONFIG.music.rootNote;
	let showMusicalLabels = true;

	// Cached constants for performance
	const SQRT3 = Math.sqrt(3);
	const triangleHeight = (CONFIG.baseTriangleSize * SQRT3) / 2;
	const spacing = { row: triangleHeight, col: CONFIG.baseTriangleSize / 2 };
	const gridBounds = {
		width: CONFIG.gridExtent * spacing.col,
		height: CONFIG.gridExtent * spacing.row
	};
	const half = CONFIG.baseTriangleSize / 2;
	const scale = CONFIG.innerTriangle.size / CONFIG.baseTriangleSize;
	const hexSize = CONFIG.baseTriangleSize;
	const hexYFactor = (hexSize * SQRT3) / 2;

	// Reactive statement to update grid when root note changes
	$: if (svg && (currentRootNote || showMusicalLabels !== undefined)) {
		updateViewport(currentTransform);
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
			.on('contextmenu', (e: Event) => e.preventDefault());

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
				// Throttle viewport updates to avoid excessive re-rendering
				clearTimeout(viewportUpdateTimeout);
				viewportUpdateTimeout = setTimeout(() => updateViewport(e.transform), 100);
			});

	let viewportUpdateTimeout: ReturnType<typeof setTimeout>;
	let currentTransform: d3.ZoomTransform = d3.zoomIdentity;

	// Utility functions
	const getTriangleVertices = (pos: { x: number; y: number }, up: boolean) => {
		const { x, y } = pos;
		return up
			? [
					{ x, y },
					{ x: x - half, y: y + triangleHeight },
					{ x: x + half, y: y + triangleHeight }
				]
			: [
					{ x: x - half, y },
					{ x: x + half, y },
					{ x, y: y + triangleHeight }
				];
	};

	const getCentroid = (vertices: { x: number; y: number }[]) => ({
		x: (vertices[0].x + vertices[1].x + vertices[2].x) / 3,
		y: (vertices[0].y + vertices[1].y + vertices[2].y) / 3
	});

	const isVisible = (
		pos: { x: number; y: number },
		transform: d3.ZoomTransform,
		bufferSize: number
	) => {
		const screenPos = transform.apply([pos.x, pos.y]);
		const [width, height] = [window.innerWidth, window.innerHeight];
		const buffer = bufferSize * transform.k;
		return (
			screenPos[0] > -buffer &&
			screenPos[0] < width + buffer &&
			screenPos[1] > -buffer &&
			screenPos[1] < height + buffer
		);
	};

	// Tonnetz Mathematical Formula Implementation
	// Based on: Pitch(q, r; root) = (root + 7q + 4r) mod 12
	const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
	const NOTE_TO_SEMITONE = Object.fromEntries(NOTES.map((note, i) => [note, i]));

	// Optimized modulo and tonnetz functions
	const mod = (n: number, m: number = 12) => ((n % m) + m) % m;
	const pitchClass = (q: number, r: number, root: number = 0) => mod(root + 7 * q + 4 * r);
	const pcToName = (pc: number) => NOTES[mod(pc)];

	// Get note from tonnetz coordinates
	function getNoteFromCoords(q: number, r: number, rootNote: string): string {
		const rootSemitone = NOTE_TO_SEMITONE[rootNote];
		return pcToName(pitchClass(q, r, rootSemitone));
	}

	// Convert cartesian to hex coordinates (optimized)
	function cartesianToHex(x: number, y: number): { q: number; r: number } {
		const r = Math.round(y / hexYFactor);
		const q = Math.round(x / hexSize - r / 2);
		return { q, r };
	}

	// Get chord information for triangle by analyzing all three notes
	function getTriangleChord(row: number, col: number, isUp: boolean): string {
		const pos = { x: col * spacing.col, y: row * spacing.row };
		const vertices = getTriangleVertices(pos, isUp);

		// Get all three notes
		const notes = vertices.map((v) => {
			const { q, r } = cartesianToHex(v.x, v.y);
			return getNoteFromCoords(q, r, currentRootNote);
		});

		// Get pitch classes (unsorted to preserve order)
		const pitchClasses = notes.map((note) => NOTE_TO_SEMITONE[note]);

		// Try each note as potential root and check if it forms a major or minor triad
		for (let i = 0; i < 3; i++) {
			const root = pitchClasses[i];
			const otherNotes = pitchClasses.filter((_, idx) => idx !== i);

			// Calculate intervals from this potential root
			const intervals = otherNotes.map((note) => mod(note - root)).sort((a, b) => a - b);

			// Check for major triad: root + major third (4) + perfect fifth (7)
			if (intervals.length === 2 && intervals[0] === 4 && intervals[1] === 7) {
				return NOTES[root]; // Major chord
			}

			// Check for minor triad: root + minor third (3) + perfect fifth (7)
			if (intervals.length === 2 && intervals[0] === 3 && intervals[1] === 7) {
				return `${NOTES[root]}`; // Minor chord
			}
		}

		// If no standard triad found, return first note with ?
		return `${notes[0]}?`;
	}

	function createGrid() {
		updateViewport(currentTransform);
	}

	function updateViewport(transform: d3.ZoomTransform) {
		currentTransform = transform;
		gridGroup.selectAll('*').remove();
		const [triangles, vertices, innerTriangles, innerCircles, labels, vertexLabels] = Array(6)
			.fill(0)
			.map(() => gridGroup.append('g'));
		const uniqueVertices = new Set<string>();

		// Optimized grid rendering with viewport culling
		const viewBounds = getVisibleBounds(transform);
		for (let row = viewBounds.minRow; row <= viewBounds.maxRow; row++) {
			for (let col = viewBounds.minCol; col <= viewBounds.maxCol; col++) {
				const pos = { x: col * spacing.col, y: row * spacing.row };
				const isUp = (row + col) % 2 === 0;

				// Create triangles and extract vertices
				createTriangleWithHover(triangles, innerTriangles, pos, isUp, row, col).forEach((v) => {
					const key = `${v.x.toFixed(2)},${v.y.toFixed(2)}`;
					if (!uniqueVertices.has(key)) {
						uniqueVertices.add(key);

						// Convert to hex coordinates and get label
						const { q, r } = cartesianToHex(v.x, v.y);
						const vertexLabel = showMusicalLabels
							? getNoteFromCoords(q, r, currentRootNote)
							: `(${q},${r})`;

						createVertexWithHover(vertices, innerCircles, v);
						createVertexLabel(vertexLabels, v, vertexLabel);
					}
				});

				// Create triangle labels
				if (isTriangleVisible(pos, transform)) {
					const triangleInfo = showMusicalLabels
						? getTriangleChord(row, col, isUp)
						: `(${row},${col})`;
					const subtitle = showMusicalLabels ? (isUp ? 'major' : 'minor') : isUp ? 'UP' : 'DOWN';
					createLabel(labels, pos, isUp, triangleInfo, subtitle);
				}
			}
		}
	}

	const isVertexVisible = (pos: { x: number; y: number }, transform: d3.ZoomTransform) =>
		isVisible(pos, transform, CONFIG.vertex.diameter);

	function getVisibleBounds(transform: d3.ZoomTransform) {
		const [width, height] = [window.innerWidth, window.innerHeight];

		// Calculate world coordinates of screen bounds
		const topLeft = transform.invert([0, 0]);
		const bottomRight = transform.invert([width, height]);

		// Add buffer for smooth scrolling (render slightly outside viewport)
		const buffer = Math.max(CONFIG.baseTriangleSize * 2, 200);

		// Convert to grid coordinates with buffer
		return {
			minRow: Math.floor((topLeft[1] - buffer) / spacing.row) - 1,
			maxRow: Math.ceil((bottomRight[1] + buffer) / spacing.row) + 1,
			minCol: Math.floor((topLeft[0] - buffer) / spacing.col) - 1,
			maxCol: Math.ceil((bottomRight[0] + buffer) / spacing.col) + 1
		};
	}

	const isTriangleVisible = (pos: { x: number; y: number }, transform: d3.ZoomTransform) =>
		isVisible(pos, transform, CONFIG.baseTriangleSize);

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
			.on('mouseenter', () => {
				if (!innerTriangleElement) {
					innerTriangleElement = createInnerTriangleElement(innerTriangleParent, pos, up);
				}
			})
			.on('mouseleave', () => {
				if (innerTriangleElement) {
					innerTriangleElement.remove();
					innerTriangleElement = null;
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
			.on('mouseenter', () => {
				if (!innerCircleElement) {
					innerCircleElement = createInnerCircleElement(innerCircleParent, pos);
				}
			})
			.on('mouseleave', () => {
				if (innerCircleElement) {
					innerCircleElement.remove();
					innerCircleElement = null;
				}
			});
	}

	// Optimized inner circle creation
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

	// Optimized vertex label creation
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
	<label>
		Root Note:
		<select bind:value={currentRootNote}>
			{#each NOTES as note}
				<option value={note}>{note}</option>
			{/each}
		</select>
	</label>

	<label>
		<input type="checkbox" bind:checked={showMusicalLabels} />
		Show Musical Labels
	</label>
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
		top: 20px;
		left: 20px;
		z-index: 1000;
		background: rgba(0, 0, 0, 0.8);
		padding: 15px;
		border-radius: 8px;
		color: white;
		font-family: Arial, sans-serif;
		font-size: 14px;
		display: flex;
		gap: 20px;
		align-items: center;
	}

	.control-panel label {
		display: flex;
		align-items: center;
		gap: 8px;
		cursor: pointer;
	}

	.control-panel select {
		padding: 4px 8px;
		border-radius: 4px;
		border: 1px solid #555;
		background: #333;
		color: white;
		font-size: 14px;
	}

	.control-panel input[type='checkbox'] {
		transform: scale(1.2);
	}

	.tonnetz-container {
		--bg-color: #1a1a1a;
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
</style>
