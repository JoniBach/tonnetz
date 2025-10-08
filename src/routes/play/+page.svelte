<script lang="ts">
	import { onMount } from 'svelte';
	import * as d3 from 'd3';
	import { browser } from '$app/environment';
	import { get } from 'svelte/store';

	import { gridStore, type Point, type Triangle } from './stores/gridStore';
	import { uiStore } from './stores/uiStore';
	import { inputStore } from './stores/inputStore';

	let svgEl: SVGSVGElement;
	const size = 50;
	let width = 800;
	let height = 600;
	let zoomTransform = d3.zoomIdentity;

	let triangleLayer: d3.Selection<SVGGElement, unknown, null, undefined>;
	let pointLayer: d3.Selection<SVGGElement, unknown, null, undefined>;
	let labelLayer: d3.Selection<SVGGElement, unknown, null, undefined>;

	let lazyTimeout: any;
	let animationFrame: number | null = null;

	let gridState: any;
	let uiState: any;

	// --- Efficient redraw ---
	function scheduleDraw() {
		if (!browser) return;
		if (!triangleLayer || !pointLayer || !labelLayer) return;
		if (animationFrame) return;

		animationFrame = requestAnimationFrame(() => {
			drawGrid();
			animationFrame = null;
		});
	}

	// --- Draw ---
	function drawGrid() {
		if (!triangleLayer || !pointLayer || !labelLayer || !gridState || !uiState) return;

		const xScale = (x: number) => x * zoomTransform.k;
		const yScale = (y: number) => y * zoomTransform.k;

		// --- Triangles ---
		const triangles = triangleLayer
			.selectAll<SVGPolygonElement, Triangle>('polygon')
			.data(gridState.triangles, (d) => d.points.sort().join('|'));

		const enterTriangles = triangles
			.enter()
			.append('polygon')
			.attr('stroke-width', 1)
			.style('cursor', 'pointer')
			.on('mouseenter', (_, d) => uiStore.highlightNode(d.points.sort().join('|')))
			.on('mouseleave', (_, d) => uiStore.clearHighlight(d.points.sort().join('|')))
			.on('click', (_, d) => uiStore.selectNode(d.points.sort().join('|'), true));

		triangles.exit().remove();

		enterTriangles
			.merge(triangles as any)
			.attr('points', (d) =>
				d.points
					.map((id) => {
						const p = gridState.points.get(id);
						return p ? `${xScale(p.x)},${yScale(p.y)}` : '';
					})
					.join(' ')
			)
			.attr('fill', (d) => {
				const id = d.points.sort().join('|');
				if (uiState.nodeStates[id]?.selected) return 'orange';
				if (uiState.nodeStates[id]?.highlighted) return '#ffeb99'; // light highlight
				return 'white';
			})

			.attr('stroke', (d) =>
				uiState.nodeStates[d.points.sort().join('|')]?.highlighted ? 'orange' : 'black'
			);

		// --- Points ---
		const points = pointLayer
			.selectAll<SVGCircleElement, Point>('circle')
			.data(Array.from(gridState.points.values()), (d) => `${d.q},${d.r}`);

		const enterPoints = points
			.enter()
			.append('circle')
			.attr('r', 15)
			.attr('stroke', 'black')
			.style('cursor', 'pointer')
			.on('mouseenter', (_, d) => uiStore.highlightNode(`${d.q},${d.r}`))
			.on('mouseleave', (_, d) => uiStore.clearHighlight(`${d.q},${d.r}`))
			.on('click', (_, d) => uiStore.selectNode(`${d.q},${d.r}`, true));

		points.exit().remove();

		enterPoints
			.merge(points as any)
			.attr('cx', (d) => xScale(d.x))
			.attr('cy', (d) => yScale(d.y))
			.attr('fill', (d) => {
				const id = `${d.q},${d.r}`;
				if (uiState.nodeStates[id]?.selected) return 'orange';
				if (uiState.nodeStates[id]?.highlighted) return '#ffeb99';
				return 'white';
			})
			.attr('stroke', (d) =>
				uiState.nodeStates[`${d.q},${d.r}`]?.highlighted ? 'orange' : 'black'
			);

		// --- Labels ---
		const labels = labelLayer
			.selectAll<SVGTextElement, Point>('text')
			.data(Array.from(gridState.points.values()), (d) => `${d.q},${d.r}`);

		const enterLabels = labels
			.enter()
			.append('text')
			.attr('text-anchor', 'middle')
			.attr('font-size', 12)
			.attr('fill', '#333');

		labels.exit().remove();

		enterLabels
			.merge(labels as any)
			.attr('x', (d) => xScale(d.x))
			.attr('y', (d) => yScale(d.y) + 5)
			.text((d) => d.note);
	}

	// --- Mount & zoom ---
	onMount(() => {
		if (!browser) return;

		width = window.innerWidth;
		height = window.innerHeight;

		const svg = d3.select(svgEl);
		svg.selectAll('*').remove();

		triangleLayer = svg.append('g').attr('class', 'triangle-layer');
		pointLayer = svg.append('g').attr('class', 'point-layer');
		labelLayer = svg.append('g').attr('class', 'label-layer');

		// --- Initialize state immediately ---
		gridState = get(gridStore);
		uiState = get(uiStore);
		scheduleDraw();

		// --- Subscriptions ---
		gridStore.subscribe((s) => {
			gridState = s;
			scheduleDraw();
		});
		uiStore.subscribe((s) => {
			uiState = s;
			scheduleDraw();
		});

		// --- Lazy load viewport ---
		gridStore.lazyLoadViewport(width, height, zoomTransform, size, 6);

		// --- D3 zoom ---
		const zoom = d3
			.zoom<SVGSVGElement, unknown>()
			.scaleExtent([0.5, 4])
			.filter((event) => event.button === 2 || event.type === 'wheel')
			.on('zoom', (event) => {
				zoomTransform = event.transform;
				triangleLayer.attr('transform', zoomTransform.toString());
				pointLayer.attr('transform', zoomTransform.toString());
				labelLayer.attr('transform', zoomTransform.toString());

				clearTimeout(lazyTimeout);
				lazyTimeout = setTimeout(() => {
					gridStore.lazyLoadViewport(width, height, zoomTransform, size, 6);
				}, 50);
			});

		svg.call(zoom);
		svgEl.addEventListener('contextmenu', (e) => e.preventDefault());

		window.addEventListener('resize', () => {
			width = window.innerWidth;
			height = window.innerHeight;
			scheduleDraw();
		});
	});
</script>

<svg bind:this={svgEl}></svg>

<style>
	svg {
		width: 100vw;
		height: 100vh;
		background: #fafafa;
	}

	circle,
	polygon {
		transition:
			fill 0.1s,
			stroke 0.1s;
	}
</style>
