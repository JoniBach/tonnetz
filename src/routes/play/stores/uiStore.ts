import { writable } from 'svelte/store';
import type { ElementState, ElementRef, InteractionContext } from './interactionTypes';
import { COLORS } from './interactionTypes';

export interface NodeState {
	interaction: ElementState;
	selected?: boolean;
	highlighted?: boolean;
	dragging?: boolean;
}

export interface UIState {
	nodeStates: Record<string, NodeState>;
	current?: ElementRef | null;
	previous?: ElementRef | null;
	shiftPressed: boolean;
	dragging: boolean;
	tooltipNode?: string | null;
	contextMenuNode?: string | null;
}

const initialState: UIState = {
	nodeStates: {},
	current: null,
	previous: null,
	shiftPressed: false,
	dragging: false,
	tooltipNode: null,
	contextMenuNode: null
};

export const uiStore = (() => {
	const { subscribe, set, update } = writable<UIState>(initialState);

	return {
		subscribe,
		reset: () => set(initialState),

		// --- Element interaction ---
		setCurrent: (el: ElementRef | null) =>
			update((s) => {
				if (s.current && s.current.id !== el?.id) s.previous = s.current;
				s.current = el;
				return s;
			}),

		setPrevious: (el: ElementRef | null) =>
			update((s) => {
				s.previous = el;
				return s;
			}),

		setInteraction: (id: string, state: ElementState) =>
			update((s) => {
				s.nodeStates[id] = { ...(s.nodeStates[id] || {}), interaction: state };
				return s;
			}),

		clearInteractions: () =>
			update((s) => {
				Object.keys(s.nodeStates).forEach((id) => {
					s.nodeStates[id].interaction = 'ready';
				});
				s.current = null;
				s.previous = null;
				s.dragging = false;
				return s;
			}),

		startDrag: (els: ElementRef | ElementRef[]) =>
			update((s) => {
				const elements = Array.isArray(els) ? els : [els];
				s.dragging = true;
				s.current = elements[elements.length - 1]; // last element as current
				s.previous = null;

				s.draggedNodes = new Set(elements.map((el) => el.id));

				elements.forEach((el) => {
					s.nodeStates[el.id] = {
						...(s.nodeStates[el.id] || {}),
						interaction: 'active',
						dragging: true
					};
				});

				return s;
			}),

		updateDrag: (els: ElementRef | ElementRef[]) =>
			update((s) => {
				if (!s.dragging) return s;
				const elements = Array.isArray(els) ? els : [els];
				const newIds = new Set(elements.map((el) => el.id));

				// Mark previous dragged nodes as drag-prev if they are not currently dragged
				s.draggedNodes?.forEach((id) => {
					if (!newIds.has(id)) {
						s.nodeStates[id] = {
							...(s.nodeStates[id] || {}),
							interaction: 'drag-prev',
							dragging: false
						};
					}
				});

				// Update current dragged nodes
				elements.forEach((el) => {
					s.nodeStates[el.id] = {
						...(s.nodeStates[el.id] || {}),
						interaction: 'active',
						dragging: true
					};
				});

				s.previous = s.current;
				s.current = elements[elements.length - 1];
				s.draggedNodes = newIds; // overwrite with current set
				return s;
			}),

		endDrag: () =>
			update((s) => {
				// mark all nodes touched during drag as inactive (grey)
				if (s.draggedNodes) {
					s.draggedNodes.forEach((id) => {
						s.nodeStates[id] = {
							...(s.nodeStates[id] || {}),
							interaction: 'inactive',
							dragging: false
						};
					});
				}

				// also clear any previous drag-prev nodes that might remain
				Object.keys(s.nodeStates).forEach((id) => {
					if (s.nodeStates[id].interaction === 'drag-prev') {
						s.nodeStates[id] = {
							...s.nodeStates[id],
							interaction: 'inactive',
							dragging: false
						};
					}
				});

				s.current = null;
				s.previous = null;
				s.dragging = false;
				s.draggedNodes = new Set();
				return s;
			}),

		setShift: (pressed: boolean) =>
			update((s) => {
				s.shiftPressed = pressed;
				return s;
			})
	};
})();
