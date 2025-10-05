import { writable } from 'svelte/store';

const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

function axialToCartesian(q: number, r: number, size: number) {
	const x = size * Math.sqrt(3) * (q + r / 2);
	const y = size * 1.5 * r;
	return { x, y };
}

function getNote(q: number, r: number) {
	const semitone = (q * 7 + r * 4 + 120) % 12;
	return NOTES[semitone];
}

export type Point = { q: number; r: number; x: number; y: number; note: string };
export type Triangle = { points: [string, string, string]; up: boolean };

function createGridStore() {
	const { subscribe, set, update } = writable({
		points: new Map<string, Point>(),
		triangles: [] as Triangle[],
		highlightedNote: null as string | null,
		selectedNotes: new Set<string>(),
		highlightedTriangles: new Set<string>()
	});

	let pointsMap: Map<string, Point> = new Map();
	let trianglesArr: Triangle[] = [];

	return {
		subscribe,

		generateGrid(range: number, size: number) {
			pointsMap = new Map();
			trianglesArr = [];

			for (let r = -range; r <= range; r++) {
				for (let q = -range; q <= range; q++) {
					if (Math.abs(q + r) > range) continue;
					const id = `${q},${r}`;
					const { x, y } = axialToCartesian(q, r, size);
					pointsMap.set(id, { q, r, x, y, note: getNote(q, r) });
				}
			}

			pointsMap.forEach(({ q, r }) => {
				const up1 = `${q},${r + 1}`;
				const up2 = `${q + 1},${r}`;
				if (pointsMap.has(up1) && pointsMap.has(up2))
					trianglesArr.push({ points: [`${q},${r}`, up1, up2], up: true });

				const down1 = `${q},${r - 1}`;
				const down2 = `${q - 1},${r}`;
				if (pointsMap.has(down1) && pointsMap.has(down2))
					trianglesArr.push({ points: [`${q},${r}`, down1, down2], up: false });
			});

			set({
				points: pointsMap,
				triangles: trianglesArr,
				highlightedNote: null,
				selectedNotes: new Set(),
				highlightedTriangles: new Set()
			});
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

		computeScales(width: number, height: number, padding = 50) {
			const pointsArray = Array.from(pointsMap.values());
			const xs = pointsArray.map((p) => p.x);
			const ys = pointsArray.map((p) => p.y);

			const minX = Math.min(...xs),
				maxX = Math.max(...xs);
			const minY = Math.min(...ys),
				maxY = Math.max(...ys);

			const dataWidth = maxX - minX;
			const dataHeight = maxY - minY;
			const scale = Math.min(
				(width - 2 * padding) / dataWidth,
				(height - 2 * padding) / dataHeight
			);

			const xOffset = (width - dataWidth * scale) / 2 - minX * scale;
			const yOffset = (height - dataHeight * scale) / 2 - minY * scale;

			return {
				x: (x: number) => x * scale + xOffset,
				y: (y: number) => y * scale + yOffset
			};
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
