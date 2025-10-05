import { writable } from 'svelte/store';

const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export type Point = { q: number; r: number; x: number; y: number; note: string };
export type Triangle = { points: [string, string, string]; up: boolean };

function axialToCartesian(q: number, r: number, size: number) {
	const x = size * Math.sqrt(3) * (q + r / 2);
	const y = size * 1.5 * r;
	return { x, y };
}

function getNote(q: number, r: number) {
	const semitone = (q * 7 + r * 4 + 120) % 12;
	return NOTES[semitone];
}

function createGridStore() {
	const { subscribe, update } = writable({
		points: new Map<string, Point>(),
		triangles: [] as Triangle[],
		highlightedNote: null as string | null,
		selectedNotes: new Set<string>(),
		highlightedTriangles: new Set<string>()
	});

	let pointsMap: Map<string, Point> = new Map();
	let trianglesArr: Triangle[] = [];
	let triangleIds: Set<string> = new Set();

	// Generated axial bounds
	let qMinGenerated = Infinity;
	let qMaxGenerated = -Infinity;
	let rMinGenerated = Infinity;
	let rMaxGenerated = -Infinity;

	return {
		subscribe,

		/**
		 * Fully store-centric lazy-load
		 * page passes screen width/height, zoomTransform, and hex size
		 */
		lazyLoadViewport(width: number, height: number, zoomTransform: any, size: number, buffer = 6) {
			// Compute visible world coordinates based on zoomTransform
			const worldX0 = -zoomTransform.x / zoomTransform.k;
			const worldY0 = -zoomTransform.y / zoomTransform.k;
			const worldX1 = worldX0 + width / zoomTransform.k;
			const worldY1 = worldY0 + height / zoomTransform.k;

			// Convert world bounds to axial coordinates with buffer
			const qMin = Math.floor(worldX0 / (Math.sqrt(3) * size)) - buffer;
			const qMax = Math.ceil(worldX1 / (Math.sqrt(3) * size)) + buffer;
			const rMin = Math.floor(worldY0 / (1.5 * size)) - buffer;
			const rMax = Math.ceil(worldY1 / (1.5 * size)) + buffer;

			// Only generate outside existing bounds
			const qStart = Math.min(qMin, qMinGenerated);
			const qEnd = Math.max(qMax, qMaxGenerated);
			const rStart = Math.min(rMin, rMinGenerated);
			const rEnd = Math.max(rMax, rMaxGenerated);

			// Update generated bounds
			qMinGenerated = Math.min(qMinGenerated, qStart);
			qMaxGenerated = Math.max(qMaxGenerated, qEnd);
			rMinGenerated = Math.min(rMinGenerated, rStart);
			rMaxGenerated = Math.max(rMaxGenerated, rEnd);

			// Generate points
			for (let r = rStart; r <= rEnd; r++) {
				for (let q = qStart; q <= qEnd; q++) {
					const id = `${q},${r}`;
					if (!pointsMap.has(id)) {
						const { x, y } = axialToCartesian(q, r, size);
						pointsMap.set(id, { q, r, x, y, note: getNote(q, r) });
					}
				}
			}

			// Generate triangles
			for (let r = rStart; r <= rEnd; r++) {
				for (let q = qStart; q <= qEnd; q++) {
					const id = `${q},${r}`;

					// Up triangle
					const up1 = `${q},${r + 1}`;
					const up2 = `${q + 1},${r}`;
					const upId = [id, up1, up2].sort().join('|');
					if (pointsMap.has(up1) && pointsMap.has(up2) && !triangleIds.has(upId)) {
						trianglesArr.push({ points: [id, up1, up2], up: true });
						triangleIds.add(upId);
					}

					// Down triangle
					const down1 = `${q},${r - 1}`;
					const down2 = `${q - 1},${r}`;
					const downId = [id, down1, down2].sort().join('|');
					if (pointsMap.has(down1) && pointsMap.has(down2) && !triangleIds.has(downId)) {
						trianglesArr.push({ points: [id, down1, down2], up: false });
						triangleIds.add(downId);
					}
				}
			}

			// Update store
			update((state) => ({
				points: pointsMap,
				triangles: trianglesArr,
				highlightedNote: state.highlightedNote,
				selectedNotes: state.selectedNotes,
				highlightedTriangles: state.highlightedTriangles
			}));
		},

		selectNote(note: string) {
			update((state) => {
				const selected = new Set(state.selectedNotes);
				selected.has(note) ? selected.delete(note) : selected.add(note);
				return { ...state, selectedNotes: selected };
			});
		},

		highlightNote(note: string | null) {
			update((state) => ({ ...state, highlightedNote: note }));
		},

		highlightTriangle(triangleId: string) {
			update((state) => {
				const highlighted = new Set(state.highlightedTriangles);
				highlighted.has(triangleId) ? highlighted.delete(triangleId) : highlighted.add(triangleId);
				return { ...state, highlightedTriangles: highlighted };
			});
		},

		getTrianglePoints(triangle: Triangle): Point[] {
			return triangle.points.map((id) => pointsMap.get(id)).filter(Boolean) as Point[];
		},

		getPointsArray() {
			return Array.from(pointsMap.values());
		},

		getTrianglesArray() {
			return trianglesArr;
		}
	};
}

export const gridStore = createGridStore();
