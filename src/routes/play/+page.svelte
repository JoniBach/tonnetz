<script lang="ts">
	import { onMount } from 'svelte';
	import { gridStore, type Point, type Triangle } from './stores/gridStore';
	import * as d3 from 'd3';

	let svgEl: SVGSVGElement;
	const size = 50;
	const range = 4;

	// fallback for SSR
	let width = 800;
	let height = 600;

	function drawGrid() {
		if (!svgEl) return;

		// Get latest state from store
		let state: any;
		gridStore.subscribe((s) => (state = s))();

		const { x: xScale, y: yScale } = gridStore.computeScales(width, height);

		const svg = d3.select(svgEl);

		// Draw triangles
		svg
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

		// Draw points
		svg
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

		// Draw labels
		svg
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
		// Now safe to use window
		width = window.innerWidth;
		height = window.innerHeight;

		gridStore.generateGrid(range, size);

		// Draw grid initially and subscribe for updates
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
