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

		startDrag: (el: ElementRef) =>
			update((s) => {
				s.dragging = true;
				s.current = el;
				s.previous = null;
				s.nodeStates[el.id] = {
					...(s.nodeStates[el.id] || {}),
					interaction: 'active',
					dragging: true
				};
				// Initialize a dragged set
				s.draggedNodes = new Set([el.id]);
				return s;
			}),

		updateDrag: (el: ElementRef) =>
			update((s) => {
				if (!s.dragging) return s;

				if (s.current && s.current.id !== el.id) {
					// mark previous element as drag-prev
					s.nodeStates[s.current.id] = {
						...(s.nodeStates[s.current.id] || {}),
						interaction: 'drag-prev',
						dragging: false
					};
					s.draggedNodes?.add(s.current.id);
				}

				s.previous = s.current;
				s.current = el;
				s.nodeStates[el.id] = {
					...(s.nodeStates[el.id] || {}),
					interaction: 'active',
					dragging: true
				};
				s.draggedNodes?.add(el.id);
				return s;
			}),

		endDrag: () =>
			update((s) => {
				// mark all dragged nodes as inactive
				s.draggedNodes?.forEach((id) => {
					s.nodeStates[id] = {
						...(s.nodeStates[id] || {}),
						interaction: 'inactive',
						dragging: false
					};
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
