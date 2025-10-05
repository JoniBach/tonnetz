import { writable } from 'svelte/store';

// Per-node state
export interface NodeState {
	selected: boolean;
	highlighted: boolean;
	dragging: boolean;
}

// The main UI state
export interface UIState {
	highlightedNote: string | null; // Optional for music apps
	hoveredNode: string | null; // Node currently hovered
	selectedNodes: string[]; // Array of selected node IDs
	draggedNodes: string[]; // Nodes currently being dragged
	dragBox: { x1: number; y1: number; x2: number; y2: number } | null; // Rectangle drag selection
	dragging: boolean;
	dragStart: { x: number; y: number } | null;
	nodeStates: Record<string, NodeState>; // Node-specific state
	tooltipNode: string | null; // Node showing a tooltip
	contextMenuNode: string | null; // Node with context menu open
}

const initialState: UIState = {
	highlightedNote: null,
	hoveredNode: null,
	selectedNodes: [],
	draggedNodes: [],
	dragBox: null,
	dragging: false,
	dragStart: null,
	nodeStates: {},
	tooltipNode: null,
	contextMenuNode: null
};

export const uiStore = (() => {
	const { subscribe, set, update } = writable<UIState>(initialState);

	return {
		subscribe,
		reset: () => set(initialState),

		// Node-level methods
		highlightNode: (id: string) =>
			update((s) => {
				s.hoveredNode = id;
				s.nodeStates[id] = { ...(s.nodeStates[id] || {}), highlighted: true };
				return s;
			}),

		clearHighlight: (id?: string) =>
			update((s) => {
				if (id) {
					if (s.nodeStates[id]) s.nodeStates[id].highlighted = false;
					if (s.hoveredNode === id) s.hoveredNode = null;
				} else {
					Object.values(s.nodeStates).forEach((n) => (n.highlighted = false));
					s.hoveredNode = null;
				}
				return s;
			}),

		selectNode: (id: string, multi = false) =>
			update((s) => {
				if (!multi) s.selectedNodes = [];
				if (!s.selectedNodes.includes(id)) s.selectedNodes.push(id);
				s.nodeStates[id] = { ...(s.nodeStates[id] || {}), selected: true };
				return s;
			}),

		deselectNode: (id: string) =>
			update((s) => {
				s.selectedNodes = s.selectedNodes.filter((n) => n !== id);
				if (s.nodeStates[id]) s.nodeStates[id].selected = false;
				return s;
			}),

		clearSelection: () =>
			update((s) => {
				s.selectedNodes = [];
				Object.values(s.nodeStates).forEach((n) => (n.selected = false));
				return s;
			}),

		// Dragging methods
		startDrag: (ids: string[], start: { x: number; y: number }) =>
			update((s) => {
				s.dragging = true;
				s.dragStart = start;
				s.draggedNodes = ids;
				ids.forEach((id) => {
					s.nodeStates[id] = { ...(s.nodeStates[id] || {}), dragging: true };
				});
				return s;
			}),

		updateDragBox: (x1: number, y1: number, x2: number, y2: number) =>
			update((s) => {
				s.dragBox = { x1, y1, x2, y2 };
				return s;
			}),

		endDrag: () =>
			update((s) => {
				s.dragging = false;
				s.dragStart = null;
				s.draggedNodes.forEach((id) => {
					if (s.nodeStates[id]) s.nodeStates[id].dragging = false;
				});
				s.draggedNodes = [];
				s.dragBox = null;
				return s;
			}),

		// Tooltip and context menu
		setTooltipNode: (id: string | null) =>
			update((s) => {
				s.tooltipNode = id;
				return s;
			}),

		setContextMenuNode: (id: string | null) =>
			update((s) => {
				s.contextMenuNode = id;
				return s;
			})
	};
})();
