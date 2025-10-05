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

	function drawGrid(state: any) {
		const xScale = (x: number) => x * zoomTransform.k;
		const yScale = (y: number) => y * zoomTransform.k;

		triangleLayer
			.selectAll<SVGPolygonElement, Triangle>('polygon')
			.data(state.triangles, (d) => d.points.sort().join('|'))
			.join('polygon')
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
			)
			.attr('stroke', 'black')
			.style('cursor', 'pointer')
			.on('click', (_, d) => gridStore.highlightTriangle(d.points.sort().join('|')));

		pointLayer
			.selectAll<SVGCircleElement, Point>('circle')
			.data(Array.from(state.points.values()), (d) => `${d.q},${d.r}`)
			.join('circle')
			.attr('cx', (d) => xScale(d.x))
			.attr('cy', (d) => yScale(d.y))
			.attr('r', 15)
			.attr('fill', (d) => (state.selectedNotes.has(d.note) ? 'orange' : 'white'))
			.attr('stroke', 'black')
			.style('cursor', 'pointer')
			.on('click', (_, d) => gridStore.selectNote(d.note));

		labelLayer
			.selectAll<SVGTextElement, Point>('text')
			.data(Array.from(state.points.values()), (d) => `${d.q},${d.r}`)
			.join('text')
			.attr('x', (d) => xScale(d.x))
			.attr('y', (d) => yScale(d.y) + 5)
			.attr('text-anchor', 'middle')
			.attr('font-size', 12)
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

		gridStore.subscribe(drawGrid);

		// Initial lazy-load
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

<svg bind:this={svgEl} width="100vw" height="100vh"></svg>
