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
		background: '#1a1a1a'
	} as const;

	// Computed constants
	const triangleHeight = (CONFIG.baseTriangleSize * Math.sqrt(3)) / 2;
	const spacing = { row: triangleHeight, col: CONFIG.baseTriangleSize / 2 };
	const gridBounds = { width: CONFIG.gridExtent * spacing.col, height: CONFIG.gridExtent * spacing.row };
	const half = CONFIG.baseTriangleSize / 2;
	const scale = CONFIG.innerTriangle.size / CONFIG.baseTriangleSize;

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
			? [{ x, y }, { x: x - half, y: y + triangleHeight }, { x: x + half, y: y + triangleHeight }]
			: [{ x: x - half, y }, { x: x + half, y }, { x, y: y + triangleHeight }];
	};

	const getCentroid = (vertices: { x: number; y: number }[]) => ({
		x: (vertices[0].x + vertices[1].x + vertices[2].x) / 3,
		y: (vertices[0].y + vertices[1].y + vertices[2].y) / 3
	});

	const isVisible = (pos: { x: number; y: number }, transform: d3.ZoomTransform, bufferSize: number) => {
		const screenPos = transform.apply([pos.x, pos.y]);
		const [width, height] = [window.innerWidth, window.innerHeight];
		const buffer = bufferSize * transform.k;
		return screenPos[0] > -buffer && screenPos[0] < width + buffer && screenPos[1] > -buffer && screenPos[1] < height + buffer;
	};

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
		const vertexPositions: { x: number; y: number; label: string }[] = [];

		// Render base template (always visible)
		for (let row = -CONFIG.gridExtent; row < CONFIG.gridExtent; row++) {
			for (let col = -CONFIG.gridExtent; col < CONFIG.gridExtent; col++) {
				const pos = { x: col * spacing.col, y: row * spacing.row };
				const isUp = (row + col) % 2 === 0;
				createTriangleWithHover(triangles, innerTriangles, pos, isUp, row, col).forEach((v, index) => {
					const key = `${v.x.toFixed(2)},${v.y.toFixed(2)}`;
					if (!uniqueVertices.has(key)) {
						uniqueVertices.add(key);
						// Create a simple label based on grid position
						const vertexLabel = `${Math.round(v.x / spacing.col)},${Math.round(v.y / spacing.row)}`;
						createVertexWithHover(vertices, innerCircles, v);
						createVertexLabel(vertexLabels, v, vertexLabel);
						vertexPositions.push({ ...v, label: vertexLabel });
					}
				});
			}
		}

		// Render detail features (culled) - labels only, inner triangles on hover
		const viewBounds = getVisibleBounds(transform);
		for (let row = viewBounds.minRow; row <= viewBounds.maxRow; row++) {
			for (let col = viewBounds.minCol; col <= viewBounds.maxCol; col++) {
				const pos = { x: col * spacing.col, y: row * spacing.row };
				const isUp = (row + col) % 2 === 0;
				if (isTriangleVisible(pos, transform)) {
					createLabel(labels, pos, isUp, `${row},${col}`, isUp ? 'UP' : 'DOWN');
				}
			}
		}

		// Inner circles will be created on hover, not here
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

	// Remove unused createTriangle function - using createTriangleWithHover instead

	function createTriangleWithHover(
		triangleParent: d3.Selection<SVGGElement, unknown, null, undefined>,
		innerTriangleParent: d3.Selection<SVGGElement, unknown, null, undefined>,
		pos: { x: number; y: number },
		up: boolean,
		row: number,
		col: number
	) {
		const vertices = getTriangleVertices(pos, up);
		let innerTriangleElement: d3.Selection<SVGPolygonElement, unknown, null, undefined> | null = null;

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

	// Remove unused createVertex function - using createVertexWithHover instead

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

	function createInnerCircleElement(
		parent: d3.Selection<SVGGElement, unknown, null, undefined>,
		pos: { x: number; y: number }
	) {
		return parent
			.append('circle')
			.attr('cx', pos.x)
			.attr('cy', pos.y)
			.attr('r', CONFIG.innerCircle.diameter / 2)
			.attr('fill', CONFIG.innerCircle.fillColor)
			.attr('stroke', CONFIG.innerCircle.strokeColor)
			.attr('stroke-width', CONFIG.innerCircle.strokeWidth)
			.attr('opacity', CONFIG.innerCircle.opacity)
			.style('pointer-events', 'none'); // Don't interfere with vertex interactions
	}

	function createVertexLabel(
		parent: d3.Selection<SVGGElement, unknown, null, undefined>,
		pos: { x: number; y: number },
		label: string
	) {
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
	}

	// Remove unused createInnerTriangle function - using createInnerTriangleElement instead

	// Remove unused createInnerCircle function - using createInnerCircleElement instead

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
		[{text: title, y: center.y - CONFIG.label.spacing / 2, config: CONFIG.label.title},
		 {text: subtitle, y: center.y + CONFIG.label.spacing / 2, config: CONFIG.label.subtitle}]
			.forEach(({text, y, config}) => {
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
