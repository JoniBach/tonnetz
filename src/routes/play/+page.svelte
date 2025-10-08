<script lang="ts">
	import { onMount } from 'svelte';
	import * as d3 from 'd3';
	import { browser } from '$app/environment';
	import { get } from 'svelte/store';

	import { gridStore, type Point, type Triangle } from './stores/gridStore';
	import { uiStore, type ElementRef } from './stores/uiStore';
	import { COLORS } from './stores/interactionTypes';

	let svgEl: SVGSVGElement;
	const size = 50;
	let width = 800;
	let height = 600;
	let zoomTransform = d3.zoomIdentity;

	let triangleLayer: d3.Selection<SVGGElement, unknown, null, undefined>;
	let pointLayer: d3.Selection<SVGGElement, unknown, null, undefined>;
	let labelLayer: d3.Selection<SVGGElement, unknown, null, undefined>;

	let gridState: any;
	let uiState: any;
	let animationFrame: number | null = null;

	function scheduleDraw() {
		if (!browser || animationFrame) return;
		animationFrame = requestAnimationFrame(() => {
			drawGrid();
			animationFrame = null;
		});
	}

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
			.on('mousedown', (event: MouseEvent, d) => {
				if (event.button === 0) {
					uiStore.handleMouseDown({ id: d.points.sort().join('|'), type: 'triangle' });
				}
			})
			.on('mouseenter', (_, d) =>
				uiStore.handleMouseEnter({ id: d.points.sort().join('|'), type: 'triangle' })
			)
			.on('mouseleave', (_, d) =>
				uiStore.handleMouseLeave({ id: d.points.sort().join('|'), type: 'triangle' })
			);

		triangles.exit().remove();

		enterTriangles
			.merge(triangles as any)
			.attr('points', (d) =>
				d.points
					.map((pid) => {
						const p = gridState.points.get(pid);
						return p ? `${xScale(p.x)},${yScale(p.y)}` : '';
					})
					.join(' ')
			)
			.attr('fill', (d) => {
				const states = d.points.map((pid) => uiState.nodeStates[pid]?.interaction || 'ready');
				return states.every((s) => s === 'active') ? COLORS.active : COLORS.ready;
			})
			.attr('stroke', 'black');

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
			.on('mousedown', (event: MouseEvent, d) => {
				if (event.button === 0) {
					uiStore.handleMouseDown({ id: `${d.q},${d.r}`, type: 'point' });
				}
			})
			.on('mouseenter', (_, d) => uiStore.handleMouseEnter({ id: `${d.q},${d.r}`, type: 'point' }))
			.on('mouseleave', (_, d) => uiStore.handleMouseLeave({ id: `${d.q},${d.r}`, type: 'point' }));

		points.exit().remove();

		enterPoints
			.merge(points as any)
			.attr('cx', (d) => xScale(d.x))
			.attr('cy', (d) => yScale(d.y))
			.attr('fill', (d) => COLORS[uiState.nodeStates[`${d.q},${d.r}`]?.interaction || 'ready'])
			.attr('stroke', 'black');

		// --- Labels ---
		const labels = labelLayer
			.selectAll<SVGTextElement, Point>('text')
			.data(Array.from(gridState.points.values()), (d) => `${d.q},${d.r}`);

		const enterLabels = labels
			.enter()
			.append('text')
			.attr('text-anchor', 'middle')
			.attr('font-size', 12)
			.attr('pointer-events', 'none')
			.attr('fill', '#333');

		labels.exit().remove();

		enterLabels
			.merge(labels as any)
			.attr('x', (d) => xScale(d.x))
			.attr('y', (d) => yScale(d.y) + 5)
			.text((d) => d.note);
	}

	onMount(() => {
		if (!browser) return;

		width = window.innerWidth;
		height = window.innerHeight;

		const svg = d3.select(svgEl);
		svg.selectAll('*').remove();

		triangleLayer = svg.append('g').attr('class', 'triangle-layer');
		pointLayer = svg.append('g').attr('class', 'point-layer');
		labelLayer = svg.append('g').attr('class', 'label-layer');

		gridStore.lazyLoadViewport(width, height, zoomTransform, size, 6);

		gridState = get(gridStore);
		uiState = get(uiStore);

		gridStore.subscribe((s) => {
			gridState = s;
			scheduleDraw();
		});
		uiStore.subscribe((s) => {
			uiState = s;
			scheduleDraw();
		});

		const zoom = d3
			.zoom<SVGSVGElement, unknown>()
			.scaleExtent([0.5, 4])
			.filter((event) => event.button === 2 || event.type === 'wheel')
			.on('zoom', (event) => {
				zoomTransform = event.transform;
				triangleLayer.attr('transform', zoomTransform.toString());
				pointLayer.attr('transform', zoomTransform.toString());
				labelLayer.attr('transform', zoomTransform.toString());
				scheduleDraw();
			});

		svg.call(zoom);

		// Disable context menu
		svgEl.addEventListener('contextmenu', (e) => e.preventDefault());

		svgEl.addEventListener('mouseup', () => uiStore.handleMouseUp());
		window.addEventListener('keydown', (e) => uiStore.handleKeyDown(e));
		window.addEventListener('keyup', (e) => uiStore.handleKeyUp(e));
		window.addEventListener('resize', () => {
			width = window.innerWidth;
			height = window.innerHeight;
			scheduleDraw();
		});
	});
</script>

<svg bind:this={svgEl}></svg>

<style>
	:global(#svelte) {
		width: 100%;
		height: 100%;
		margin: 0;
	}

	svg {
		width: 100vw;
		height: 100vh;
		display: block;
		background: #fafafa;
	}
</style>
