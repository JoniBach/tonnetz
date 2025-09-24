<script lang="ts">
	import { onMount } from 'svelte';
	import * as d3 from 'd3';

	let container: HTMLDivElement;
	let svg: d3.Selection<SVGSVGElement, unknown, null, undefined>;
	let gridGroup: d3.Selection<SVGGElement, unknown, null, undefined>;
	let width: number, height: number;

	const CONFIG = {
		baseTriangleSize: 100,
		gridExtent: 50,
		zoomRange: 2,
		triangle: { strokeWidth: 0.3, strokeColor: '#333', opacity: 1 },
		vertex: { diameter: 30, color: '#1a1a1a', opacity: 1 },
		innerTriangle: {
			size: 80, // Size of inner triangles (independent of grid)
			strokeWidth: 0.2,
			strokeColor: '#222',
			fillColor: '#111',
			opacity: 0.8
		},
		innerCircle: {
			diameter: 20, // Size of inner circles (independent of vertex size)
			strokeWidth: 0.2,
			strokeColor: '#222',
			fillColor: '#111',
			opacity: 0.9
		},
		background: '#1a1a1a'
	} as const;

	// Derived values
	const triangleHeight = (CONFIG.baseTriangleSize * Math.sqrt(3)) / 2;
	const spacing = { row: triangleHeight, col: CONFIG.baseTriangleSize / 2 };
	const gridBounds = {
		width: CONFIG.gridExtent * 2 * spacing.col,
		height: CONFIG.gridExtent * 2 * spacing.row
	};

	onMount(() => {
		[width, height] = [window.innerWidth, window.innerHeight];

		svg = d3
			.select(container)
			.append('svg')
			.attr('width', width)
			.attr('height', height)
			.style('background', CONFIG.background)
			.call(createZoomBehavior())
			.on('contextmenu', (e: Event) => e.preventDefault());

		gridGroup = svg.append('g');

		// Center view and create grid
		svg.call(createZoomBehavior().transform, d3.zoomIdentity.translate(width / 2, height / 2));
		createTriangularGrid();

		const handleResize = () => {
			[width, height] = [window.innerWidth, window.innerHeight];
			svg.attr('width', width).attr('height', height);
		};

		window.addEventListener('resize', handleResize);
		return () => window.removeEventListener('resize', handleResize);
	});

	// Helper functions
	const createZoomBehavior = () =>
		d3
			.zoom()
			.scaleExtent([1 / CONFIG.zoomRange, CONFIG.zoomRange])
			.translateExtent([
				[-gridBounds.width / 2, -gridBounds.height / 2],
				[gridBounds.width / 2, gridBounds.height / 2]
			])
			.filter((e: any) => e.button === 2 || e.type === 'wheel' || e.type === 'dblclick')
			.on('zoom', (e: d3.D3ZoomEvent<SVGSVGElement, unknown>) =>
				gridGroup.attr('transform', e.transform)
			);

	function createTriangularGrid() {
		gridGroup.selectAll('*').remove();
		const [triangles, vertices, innerTriangles, innerCircles] = [
			gridGroup.append('g'),
			gridGroup.append('g'),
			gridGroup.append('g'),
			gridGroup.append('g')
		];
		const uniqueVertices = new Set<string>();
		const vertexPositions: { x: number; y: number }[] = [];

		for (let row = -CONFIG.gridExtent; row < CONFIG.gridExtent; row++) {
			for (let col = -CONFIG.gridExtent; col < CONFIG.gridExtent; col++) {
				const pos = { x: col * spacing.col, y: row * spacing.row };
				const isUp = (row + col) % 2 === 0;

				// Create grid triangle
				createTriangle(triangles, pos, isUp).forEach((v) => {
					const key = `${v.x.toFixed(2)},${v.y.toFixed(2)}`;
					if (!uniqueVertices.has(key)) {
						uniqueVertices.add(key);
						createVertex(vertices, v);
						vertexPositions.push(v);
					}
				});

				// Create inner triangle at the center of the grid space
				createInnerTriangle(innerTriangles, pos, isUp);
			}
		}

		// Create inner circles at all vertex positions
		vertexPositions.forEach((pos) => {
			createInnerCircle(innerCircles, pos);
		});
	}

	function createTriangle(
		parent: d3.Selection<SVGGElement, unknown, null, undefined>,
		pos: { x: number; y: number },
		up: boolean
	) {
		const { x, y } = pos;
		const half = CONFIG.baseTriangleSize / 2;
		const vertices = up
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

		parent
			.append('polygon')
			.attr('points', vertices.map((v) => `${v.x},${v.y}`).join(' '))
			.attr('fill', 'none')
			.attr('stroke', CONFIG.triangle.strokeColor)
			.attr('stroke-width', CONFIG.triangle.strokeWidth)
			.attr('opacity', CONFIG.triangle.opacity);

		return vertices;
	}

	function createVertex(
		parent: d3.Selection<SVGGElement, unknown, null, undefined>,
		pos: { x: number; y: number }
	) {
		parent
			.append('circle')
			.attr('cx', pos.x)
			.attr('cy', pos.y)
			.attr('r', CONFIG.vertex.diameter / 2)
			.attr('fill', CONFIG.vertex.color)
			.attr('opacity', CONFIG.vertex.opacity);
	}

	function createInnerTriangle(
		parent: d3.Selection<SVGGElement, unknown, null, undefined>,
		gridPos: { x: number; y: number },
		gridUp: boolean
	) {
		// Use the EXACT same vertex calculation as createTriangle to ensure consistency
		const { x, y } = gridPos;
		const gridHalf = CONFIG.baseTriangleSize / 2;

		// Get the exact same vertices as the grid triangle
		const gridVertices = gridUp
			? [
					{ x, y }, // tip
					{ x: x - gridHalf, y: y + triangleHeight }, // bottom left
					{ x: x + gridHalf, y: y + triangleHeight } // bottom right
				]
			: [
					{ x: x - gridHalf, y }, // top left
					{ x: x + gridHalf, y }, // top right
					{ x, y: y + triangleHeight } // bottom tip
				];

		// Calculate centroid (geometric center)
		const centerX = (gridVertices[0].x + gridVertices[1].x + gridVertices[2].x) / 3;
		const centerY = (gridVertices[0].y + gridVertices[1].y + gridVertices[2].y) / 3;

		// Create inner triangle vertices centered at the centroid
		const innerHalf = CONFIG.innerTriangle.size / 2;
		const innerHeight = (CONFIG.innerTriangle.size * Math.sqrt(3)) / 2;

		// Create inner triangle with same proportional positioning as grid triangle
		// but scaled down and centered at the centroid
		const scale = CONFIG.innerTriangle.size / CONFIG.baseTriangleSize;

		const innerVertices = gridVertices.map((vertex) => ({
			x: centerX + (vertex.x - centerX) * scale,
			y: centerY + (vertex.y - centerY) * scale
		}));

		parent
			.append('polygon')
			.attr('points', innerVertices.map((v) => `${v.x},${v.y}`).join(' '))
			.attr('fill', CONFIG.innerTriangle.fillColor)
			.attr('stroke', CONFIG.innerTriangle.strokeColor)
			.attr('stroke-width', CONFIG.innerTriangle.strokeWidth)
			.attr('opacity', CONFIG.innerTriangle.opacity);
	}

	function createInnerCircle(
		parent: d3.Selection<SVGGElement, unknown, null, undefined>,
		pos: { x: number; y: number }
	) {
		parent
			.append('circle')
			.attr('cx', pos.x)
			.attr('cy', pos.y)
			.attr('r', CONFIG.innerCircle.diameter / 2)
			.attr('fill', CONFIG.innerCircle.fillColor)
			.attr('stroke', CONFIG.innerCircle.strokeColor)
			.attr('stroke-width', CONFIG.innerCircle.strokeWidth)
			.attr('opacity', CONFIG.innerCircle.opacity);
	}
</script>

<svelte:window bind:innerWidth={width} bind:innerHeight={height} />

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
	}
</style>
