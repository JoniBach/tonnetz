<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';

	let canvas: HTMLCanvasElement;
	let ctx: CanvasRenderingContext2D;
	let width = 0;
	let height = 0;

	const size = 80;
	// middle values
	let repulsionRange = 175; // (50 + 300)/2
	let repulsionForce = 1.05; // (0.1 + 2)/2

	const spring = 0.05;
	const damping = 0.85;
	const maxVel = 5;

	interface Point {
		x: number;
		y: number;
		restX: number;
		restY: number;
		vx: number;
		vy: number;
	}

	let points: Point[] = [];
	let triangles: Point[][] = [];
	let mouse = { x: -1000, y: -1000 };

	function generateGrid() {
		const cols = Math.ceil(width / size) + 1;
		const rows = Math.ceil(height / ((size * Math.sqrt(3)) / 2)) + 1;

		points = [];
		for (let r = 0; r < rows; r++) {
			for (let c = 0; c < cols; c++) {
				const x = c * size + (r % 2) * (size / 2);
				const y = (r * (size * Math.sqrt(3))) / 2;
				points.push({ x, y, restX: x, restY: y, vx: 0, vy: 0 });
			}
		}

		triangles = [];
		for (let r = 0; r < rows - 1; r++) {
			for (let c = 0; c < cols - 1; c++) {
				const idx = r * cols + c;
				const right = idx + 1;
				const down = idx + cols;
				const downRight = down + 1;

				const p0 = points[idx];
				const p1 = points[right];
				const p2 = points[down];
				const p3 = points[downRight];
				if (!p0 || !p1 || !p2 || !p3) continue;

				if (r % 2 === 0) {
					triangles.push([p0, p2, p1]);
					triangles.push([p1, p2, p3]);
				} else {
					triangles.push([p0, p2, p3]);
					triangles.push([p0, p3, p1]);
				}
			}
		}
	}

	function updatePoints() {
		const rSq = repulsionRange * repulsionRange;

		for (const p of points) {
			const dx = p.x - mouse.x;
			const dy = p.y - mouse.y;
			const distSq = dx * dx + dy * dy;

			if (distSq < rSq && distSq > 0.001) {
				const dist = Math.sqrt(distSq);
				const force = ((repulsionRange - dist) / repulsionRange) * repulsionForce;
				p.vx += (dx / dist) * force;
				p.vy += (dy / dist) * force;
			}

			p.vx += (p.restX - p.x) * spring;
			p.vy += (p.restY - p.y) * spring;

			p.vx *= damping;
			p.vy *= damping;

			p.vx = Math.max(Math.min(p.vx, maxVel), -maxVel);
			p.vy = Math.max(Math.min(p.vy, maxVel), -maxVel);

			p.x += p.vx;
			p.y += p.vy;
		}
	}

	function draw() {
		if (!ctx) return;
		ctx.clearRect(0, 0, width, height);

		ctx.strokeStyle = '#555';
		ctx.lineWidth = 1;
		ctx.globalAlpha = 1;
		for (const tri of triangles) {
			ctx.beginPath();
			ctx.moveTo(tri[0].x, tri[0].y);
			ctx.lineTo(tri[1].x, tri[1].y);
			ctx.lineTo(tri[2].x, tri[2].y);
			ctx.closePath();
			ctx.stroke();
		}

		ctx.fillStyle = '#222';
		ctx.strokeStyle = '#555';
		ctx.globalAlpha = 1;
		for (const p of points) {
			ctx.beginPath();
			ctx.arc(p.x, p.y, 14, 0, Math.PI * 2);
			ctx.fill();
			ctx.stroke();
		}
	}

	function animate() {
		updatePoints();
		draw();
		requestAnimationFrame(animate);
	}

	onMount(() => {
		width = window.innerWidth;
		height = window.innerHeight;
		canvas.width = width;
		canvas.height = height;
		ctx = canvas.getContext('2d');

		generateGrid();
		animate();

		window.addEventListener('mousemove', (e) => {
			mouse.x = e.clientX;
			mouse.y = e.clientY;
		});

		window.addEventListener('resize', () => {
			width = window.innerWidth;
			height = window.innerHeight;
			canvas.width = width;
			canvas.height = height;
			generateGrid();
		});
	});

	function goToPlay() {
		goto('/play');
	}
</script>

<canvas bind:this={canvas} {width} {height}></canvas>

<div class="overlay-card">
	<h1>Interactive Tonnetz</h1>
	<p>
		Dive into an interactive musical lattice where each point represents a note. Experiment with
		harmony, discover patterns, and hear the relationships between pitches come alive. Move your
		mouse across the grid to influence the nodes and explore the geometry of music in real time.
	</p>

	<button on:click={goToPlay}>Play Now</button>

	<input class="border-slider top" type="range" min="50" max="300" bind:value={repulsionRange} />
	<input
		class="border-slider bottom"
		type="range"
		min="0.1"
		max="2"
		step="0.01"
		bind:value={repulsionForce}
	/>
</div>

<style>
	canvas {
		position: fixed;
		top: 0;
		left: 0;
		width: 100vw;
		height: 100vh;
		background: #222;
		z-index: 0;
	}

	.overlay-card {
		position: fixed; /* keep this */
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		background: rgba(255, 255, 255, 0.95);
		box-shadow: 0 8px 20px rgba(0, 0, 0, 0.25);
		text-align: center;
		z-index: 10;
		width: 320px;
		/* position: relative;  <-- remove this */
		border-radius: 0;
		display: flex;
		flex-direction: column;
		align-items: stretch;
		padding: 1.5rem 1rem;
	}

	.overlay-card h1 {
		font-size: 1.5rem;
		color: #333;
		text-align: center;
		margin: 1rem 0 0.5rem;
	}

	.overlay-card p {
		font-size: 1rem;
		color: #555;
		text-align: center;
		margin-bottom: 1rem;
	}

	.overlay-card button {
		background: #f39c12;
		color: white;
		border: none;
		padding: 0.6rem 1.2rem;
		border-radius: 0;
		cursor: pointer;
		font-size: 1rem;
		transition: background 0.2s;
		margin: 0.5rem 0;
	}

	.overlay-card button:hover {
		background: #e67e22;
	}
	.border-slider {
		position: absolute;
		left: 0;
		width: 100%;
		margin: 0;
		-webkit-appearance: none;
		height: 8px;
		background: #f39c12;
		cursor: pointer;
	}

	/* WebKit browsers (Chrome, Safari, Edge) */
	.border-slider::-webkit-slider-thumb {
		-webkit-appearance: none;
		width: 14px;
		height: 14px;
		background: #fff;
		border: 4px solid #f39c12;
		border-radius: 50%;
		cursor: pointer;
		transform: translateY(1%);
	}

	/* Firefox */
	.border-slider::-moz-range-thumb {
		width: 14px;
		height: 14px;
		background: #fff;
		border: 2px solid #f39c12;
		border-radius: 50%;
		cursor: pointer;
		transform: translateY(0%);
	}

	/* Optional top/bottom positioning for multiple sliders */
	.border-slider.top {
		top: 0;
	}

	.border-slider.bottom {
		bottom: 0;
	}
</style>
