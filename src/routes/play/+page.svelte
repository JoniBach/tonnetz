<script lang="ts">
	import { onMount } from 'svelte';
	import { gridStore, type Point, type Triangle } from './stores/gridStore';
	import * as d3 from 'd3';

	let svgEl: SVGSVGElement;
	const size = 50;
	const range = 4;

	let width = 800; // SSR fallback
	let height = 600;

	let gridLayer: d3.Selection<SVGGElement, unknown, null, undefined>;

	// Draw grid elements once (positions only)
	function drawGrid() {
		if (!gridLayer) return;

		let state: any;
		gridStore.subscribe((s) => (state = s))();

		const { x: xScale, y: yScale } = gridStore.computeScales(width, height);

		// Triangles
		gridLayer
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

		// Points
		gridLayer
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

		// Labels
		gridLayer
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

		gridStore.generateGrid(range, size);

		const svg = d3.select(svgEl);
		svg.selectAll('*').remove(); // clear any previous content

		// Create <g> container for pan/zoom
		gridLayer = svg.append('g').attr('class', 'grid-layer');

		// Draw the grid once
		drawGrid();

		// D3 Zoom - right-click drag + scroll wheel
		const zoom = d3
			.zoom<SVGSVGElement, unknown>()
			.scaleExtent([0.5, 4])
			.filter((event) => event.button === 2 || event.type === 'wheel') // right-click or scroll only
			.on('zoom', (event) => {
				gridLayer.attr('transform', event.transform.toString());
			});

		svg.call(zoom);

		// Disable context menu for right-click
		svgEl.addEventListener('contextmenu', (e) => e.preventDefault());

		// Redraw only on store updates (selection/triangle highlight)
		gridStore.subscribe(drawGrid);

		const resizeHandler = () => {
			width = window.innerWidth;
			height = window.innerHeight;
			drawGrid();
		};

		window.addEventListener('resize', resizeHandler);
		return () => window.removeEventListener('resize', resizeHandler);
	});
</script>

<svg bind:this={svgEl} width="100vw" height="100vh"></svg>
