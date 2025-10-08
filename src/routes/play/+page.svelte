<script lang="ts">
	import { onMount } from 'svelte';
	import * as d3 from 'd3';
	import { browser } from '$app/environment';
	import { get } from 'svelte/store';

	import { gridStore, type Point, type Triangle } from './stores/gridStore';
	import { uiStore } from './stores/uiStore';
	import type { ElementRef, InteractionContext } from './stores/interactionTypes';
	import { COLORS } from './stores/interactionTypes';

	let svgEl: SVGElement;
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
		if (!triangleLayer || !pointLayer || !gridState || !uiState) return;

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
			.on('mousedown', (_, d) =>
				handleMouseDown({ id: d.points.sort().join('|'), type: 'triangle' })
			)
			.on('mouseenter', (_, d) =>
				handleMouseEnter({ id: d.points.sort().join('|'), type: 'triangle' })
			)
			.on('mouseleave', (_, d) =>
				handleMouseLeave({ id: d.points.sort().join('|'), type: 'triangle' })
			);

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
				const states = d.points.map((pid) => uiState.nodeStates[pid]?.interaction || 'ready');
				const allActive = states.every((s) => s === 'active');
				return allActive ? COLORS['active'] : COLORS['ready'];
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
			.on('mousedown', (_, d) => handleMouseDown({ id: `${d.q},${d.r}`, type: 'point' }))
			.on('mouseenter', (_, d) => handleMouseEnter({ id: `${d.q},${d.r}`, type: 'point' }))
			.on('mouseleave', (_, d) => handleMouseLeave({ id: `${d.q},${d.r}`, type: 'point' }));

		points.exit().remove();

		enterPoints
			.merge(points as any)
			.attr('cx', (d) => xScale(d.x))
			.attr('cy', (d) => yScale(d.y))
			.attr('fill', (d) => {
				const id = `${d.q},${d.r}`;
				return COLORS[uiState.nodeStates[id]?.interaction || 'ready'];
			})
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

	// --- Interaction handlers ---
	let context: InteractionContext = { shiftPressed: false, dragging: false };
	function handleMouseDown(el: ElementRef) {
		if (context.shiftPressed) {
			// Shift+Click toggles points individually
			if (el.type === 'point') {
				const state = get(uiStore).nodeStates[el.id]?.interaction;
				uiStore.setInteraction(el.id, state === 'active' ? 'inactive' : 'active');
			} else if (el.type === 'triangle') {
				const tri = gridState.triangles.find((t) => t.points.sort().join('|') === el.id);
				if (tri) {
					const allActive = tri.points.every(
						(pid) => get(uiStore).nodeStates[pid]?.interaction === 'active'
					);
					const newState = allActive ? 'inactive' : 'active';
					for (const pid of tri.points) {
						uiStore.setInteraction(pid, newState);
					}
				}
			}
		} else {
			// Click-and-drag without shift
			if (el.type === 'point') {
				uiStore.startDrag(el);
				context.dragging = true;
			}
			if (el.type === 'triangle') {
				const tri = gridState.triangles.find((t) => t.points.sort().join('|') === el.id);
				if (tri) {
					const pointRefs = tri.points.map((pid) => ({ id: pid, type: 'point' }));
					uiStore.startDrag(pointRefs);
					context.dragging = true;
				}
			}
		}
		scheduleDraw();
	}

	function handleMouseEnter(el: ElementRef) {
		if (context.dragging) {
			const dragTargets =
				el.type === 'point'
					? [el]
					: gridState.triangles
							.find((t) => t.points.sort().join('|') === el.id)
							?.points.map((pid) => ({ id: pid, type: 'point' }));
			if (dragTargets.length) {
				uiStore.updateDrag(dragTargets);
				scheduleDraw();
			}
		}
	}

	function handleMouseLeave(el: ElementRef) {
		if (context.dragging) {
			const dragTargets =
				el.type === 'point'
					? [el]
					: gridState.triangles
							.find((t) => t.points.sort().join('|') === el.id)
							?.points.map((pid) => ({ id: pid, type: 'point' }));
			if (dragTargets.length) {
				uiStore.updateDrag(dragTargets);
				scheduleDraw();
			}
		}
	}

	function handleMouseUp() {
		if (context.dragging) {
			uiStore.endDrag();
			context.dragging = false;
			scheduleDraw();
		}
	}

	function handleKeyDown(e: KeyboardEvent) {
		if (e.key === 'Shift') context.shiftPressed = true;
		if (e.key === 'Escape') uiStore.clearInteractions();
		scheduleDraw();
	}

	function handleKeyUp(e: KeyboardEvent) {
		if (e.key === 'Shift') context.shiftPressed = false;
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

		gridState.points.forEach((p: Point) => {
			const id = `${p.q},${p.r}`;
			if (!uiState.nodeStates[id]) uiStore.setInteraction(id, 'ready');
		});

		scheduleDraw();

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
				scheduleDraw();
			});

		svg.call(zoom);

		svgEl.addEventListener('contextmenu', (e) => e.preventDefault());
		svgEl.addEventListener('mouseup', handleMouseUp);
		window.addEventListener('keydown', handleKeyDown);
		window.addEventListener('keyup', handleKeyUp);
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
