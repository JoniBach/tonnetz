<script lang="ts">
	import { onMount } from 'svelte';
	import { gridStore, type Point, type Triangle } from './stores/gridStore';
	import * as d3 from 'd3';

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
	let lastDrawState: any = null;

	// --- Efficient redraw: batch updates in rAF ---
	function scheduleDraw(state: any) {
		lastDrawState = state;
		if (animationFrame) return;
		animationFrame = requestAnimationFrame(() => {
			drawGrid(lastDrawState);
			animationFrame = null;
		});
	}

	function drawGrid(state: any) {
		if (!triangleLayer || !pointLayer || !labelLayer) return;

		const xScale = (x: number) => x * zoomTransform.k;
		const yScale = (y: number) => y * zoomTransform.k;

		// --- Triangles ---
		const triangles = triangleLayer
			.selectAll<SVGPolygonElement, Triangle>('polygon')
			.data(state.triangles, (d) => d.points.sort().join('|'));

		const enterTriangles = triangles
			.enter()
			.append('polygon')
			.attr('stroke', 'black')
			.attr('fill', 'white')
			.style('cursor', 'pointer')
			.on('mouseenter', function (_, d) {
				d3.select(this).classed('hovered', true);
				gridStore.highlightTriangle(d.points.sort().join('|'));
			})
			.on('mouseleave', function () {
				d3.select(this).classed('hovered', false);
			});

		triangles.exit().remove();

		enterTriangles
			.merge(triangles as any)
			.attr('points', (d) =>
				d.points
					.map((id) => {
						const p = state.points.get(id);
						return p ? `${xScale(p.x)},${yScale(p.y)}` : '';
					})
					.join(' ')
			)
			.attr('fill', (d) =>
				state.highlightedTriangles.has(d.points.sort().join('|')) ? 'orange' : 'white'
			);

		// --- Points ---
		const points = pointLayer
			.selectAll<SVGCircleElement, Point>('circle')
			.data(Array.from(state.points.values()), (d) => `${d.q},${d.r}`);

		const enterPoints = points
			.enter()
			.append('circle')
			.attr('stroke', 'black')
			.attr('r', 15)
			.attr('fill', 'white')
			.style('cursor', 'pointer')
			.on('mouseenter', function (_, d) {
				d3.select(this).classed('hovered', true);
				gridStore.selectNote(d.note);
			})
			.on('mouseleave', function () {
				d3.select(this).classed('hovered', false);
			});

		points.exit().remove();

		enterPoints
			.merge(points as any)
			.attr('cx', (d) => xScale(d.x))
			.attr('cy', (d) => yScale(d.y))
			.attr('fill', (d) => (state.selectedNotes.has(d.note) ? 'orange' : 'white'));

		// --- Labels ---
		const labels = labelLayer
			.selectAll<SVGTextElement, Point>('text')
			.data(Array.from(state.points.values()), (d) => `${d.q},${d.r}`);

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

	onMount(() => {
		width = window.innerWidth;
		height = window.innerHeight;

		const svg = d3.select(svgEl);
		svg.selectAll('*').remove();

		triangleLayer = svg.append('g').attr('class', 'triangle-layer');
		pointLayer = svg.append('g').attr('class', 'point-layer');
		labelLayer = svg.append('g').attr('class', 'label-layer');

		// 🔥 Optimized redraw subscription
		gridStore.subscribe(scheduleDraw);

		// Initial lazy load
		gridStore.lazyLoadViewport(width, height, zoomTransform, size, 6);

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

	.hovered {
		stroke-width: 2;
		stroke: orange;
	}
</style>
