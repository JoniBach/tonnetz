import { writable, get } from 'svelte/store';
import { gridStore, type Point, type Triangle } from './gridStore';

export type ElementRef = { id: string; type: 'point' | 'triangle' };
export type ElementState = 'ready' | 'active' | 'inactive' | 'drag-prev';
export type InteractionContext = { shiftPressed: boolean; dragging: boolean };

export interface NodeState {
	interaction: ElementState; // ready | active | hint | etc.
	dragging?: boolean; // whether it's currently being dragged
	previousInteraction?: ElementState; // what it was before activation
}

interface UIStoreState {
	nodeStates: Record<string, NodeState>;
	current: ElementRef | null;
	previous: ElementRef | null;
	context: InteractionContext;
	draggedNodes?: Set<string>;
}

const initialState: UIStoreState = {
	nodeStates: {},
	current: null,
	previous: null,
	context: { shiftPressed: false, dragging: false },
	draggedNodes: new Set()
};

export const uiStore = (() => {
	const { subscribe, update, set } = writable<UIStoreState>(initialState);

	function togglePoint(id: string) {
		update((s) => {
			const state = s.nodeStates[id]?.interaction || 'ready';
			s.nodeStates[id] = {
				...(s.nodeStates[id] || {}),
				interaction: state === 'active' ? 'inactive' : 'active'
			};
			return s;
		});
	}

	function toggleTriangle(id: string) {
		const tri = gridStore.getTriangleById(id);
		if (!tri) return;
		const states = tri.points.map((pid) => get(uiStore).nodeStates[pid]?.interaction || 'ready');
		const allActive = states.every((s) => s === 'active');
		const newState = allActive ? 'inactive' : 'active';
		for (const pid of tri.points) {
			setInteraction(pid, newState);
		}
	}

	function setInteraction(id: string, state: ElementState) {
		update((s) => {
			for (const id of ids) {
				if (!s.nodeStates[id]) s.nodeStates[id] = { interaction: 'ready' };
				const node = s.nodeStates[id];

				if (newState === 'active') {
					// Remember what it was before activating
					node.previousInteraction = node.interaction;
					node.interaction = 'active';
				} else if (newState === 'ready') {
					// Restore to hint if it used to be a hint
					node.interaction = node.previousInteraction === 'hint' ? 'hint' : 'ready';
					node.previousInteraction = undefined;
				} else {
					node.interaction = newState;
				}
			}
			return s;
		});
	}

	return {
		subscribe,
		reset: () => set(initialState),
		setInteraction,

		handleMouseDown(el: ElementRef) {
			const { shiftPressed } = get(uiStore).context;
			if (shiftPressed) {
				if (el.type === 'point') togglePoint(el.id);
				else if (el.type === 'triangle') toggleTriangle(el.id);
			} else {
				if (el.type === 'point') this.startDrag(el);
				else if (el.type === 'triangle') {
					const tri = gridStore.getTriangleById(el.id);
					if (tri) this.startDrag(tri.points.map((id) => ({ id, type: 'point' })));
				}
			}
		},

		handleMouseEnter(el: ElementRef) {
			if (!get(uiStore).context.dragging) return;
			const targets =
				el.type === 'point'
					? [el]
					: (gridStore.getTriangleById(el.id)?.points.map((id) => ({ id, type: 'point' })) ?? []);
			this.updateDrag(targets);
		},

		handleMouseLeave(el: ElementRef) {
			if (!get(uiStore).context.dragging) return;
			const targets =
				el.type === 'point'
					? [el]
					: (gridStore.getTriangleById(el.id)?.points.map((id) => ({ id, type: 'point' })) ?? []);
			this.updateDrag(targets);
		},

		handleMouseUp() {
			if (get(uiStore).context.dragging) {
				this.endDrag();
				update((s) => ({ ...s, context: { ...s.context, dragging: false } }));
			}
		},

		handleKeyDown(e: KeyboardEvent) {
			update((s) => {
				if (e.key === 'Shift') s.context.shiftPressed = true;
				if (e.key === 'Escape') {
					Object.keys(s.nodeStates).forEach((id) => (s.nodeStates[id].interaction = 'ready'));
				}
				return s;
			});
		},

		handleKeyUp(e: KeyboardEvent) {
			if (e.key === 'Shift')
				update((s) => ({ ...s, context: { ...s.context, shiftPressed: false } }));
		},

		startDrag(els: ElementRef | ElementRef[]) {
			update((s) => {
				const elements = Array.isArray(els) ? els : [els];
				s.context.dragging = true;
				s.draggedNodes = new Set(elements.map((el) => el.id));
				elements.forEach((el) => {
					const prev = s.nodeStates[el.id]?.interaction;
					s.nodeStates[el.id] = {
						...(s.nodeStates[el.id] || {}),
						previousInteraction: prev, // 👈 remember old state
						interaction: 'active',
						dragging: true
					};
				});
				return s;
			});
		},

		updateDrag(els: ElementRef | ElementRef[]) {
			update((s) => {
				if (!s.context.dragging) return s;

				const elements = Array.isArray(els) ? els : [els];
				const newIds = new Set(elements.map((el) => el.id));

				// 🔸 Handle nodes that were in the previous drag set but not in the new one
				s.draggedNodes?.forEach((id) => {
					const node = s.nodeStates[id];
					if (!node) return;

					if (!newIds.has(id)) {
						// If it was a hint before activation → restore it to hint
						if (node.previousInteraction === 'hint') {
							node.interaction = 'hint';
						} else {
							// Otherwise show drag-prev (orange trail)
							node.interaction = 'drag-prev';
						}
						node.previousInteraction = undefined;
						node.dragging = false;
					}
				});

				// 🔸 Activate newly hovered nodes
				elements.forEach((el) => {
					const node = s.nodeStates[el.id] || { interaction: 'ready' };
					node.previousInteraction = node.previousInteraction ?? node.interaction;
					node.interaction = 'active';
					node.dragging = true;
					s.nodeStates[el.id] = node;
				});

				s.draggedNodes = newIds;
				return s;
			});
		},

		endDrag() {
			update((s) => {
				s.draggedNodes?.forEach((id) => {
					const node = s.nodeStates[id];
					if (!node) return;

					if (node.previousInteraction === 'hint') {
						node.interaction = 'hint';
					} else {
						node.interaction = 'inactive';
					}

					node.previousInteraction = undefined;
					node.dragging = false;
				});

				// clean up old 'drag-prev' states
				Object.keys(s.nodeStates).forEach((id) => {
					const node = s.nodeStates[id];
					if (node.interaction === 'drag-prev') {
						node.interaction = node.previousInteraction === 'hint' ? 'hint' : 'inactive';
						node.previousInteraction = undefined;
					}
				});

				s.context.dragging = false;
				s.draggedNodes = new Set();
				return s;
			});
		},
		setHints(hintIds: string[]) {
			update((s) => {
				// Reset all previous hint states back to ready
				for (const [id, node] of Object.entries(s.nodeStates)) {
					if (node.interaction === 'hint') {
						node.interaction = node.previousInteraction === 'hint' ? 'hint' : 'ready';
						node.previousInteraction = undefined;
					}
				}

				// Apply new hints
				for (const id of hintIds) {
					if (!s.nodeStates[id]) s.nodeStates[id] = { interaction: 'ready' };
					s.nodeStates[id].interaction = 'hint';
				}

				return s;
			});
		}
	};
})();
