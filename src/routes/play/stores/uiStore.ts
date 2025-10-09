import { writable, get } from 'svelte/store';
import { gridStore, type Point, type Triangle } from './gridStore';

export type ElementRef = { id: string; type: 'point' | 'triangle' };
export type ElementState = 'ready' | 'active' | 'inactive' | 'drag-prev' | 'hint';
export type InteractionContext = { shiftPressed: boolean; dragging: boolean };

export interface NodeState {
	interaction: ElementState;
	dragging?: boolean;
	previousInteraction?: ElementState;
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

// --- Helper to centralize state transitions ---
function transition(node: NodeState, target: ElementState): NodeState {
	const result = { ...node };

	switch (target) {
		case 'active':
			result.previousInteraction ??= result.interaction;
			result.interaction = 'active';
			result.dragging = true;
			break;
		case 'ready':
			result.interaction = result.previousInteraction === 'hint' ? 'hint' : 'ready';
			result.previousInteraction = undefined;
			result.dragging = false;
			break;
		case 'inactive':
			result.interaction = result.previousInteraction === 'hint' ? 'hint' : 'inactive';
			result.previousInteraction = undefined;
			result.dragging = false;
			break;
		case 'drag-prev':
			result.interaction = result.previousInteraction === 'hint' ? 'hint' : 'drag-prev';
			result.dragging = false;
			break;
		case 'hint':
			result.previousInteraction ??= result.interaction;
			result.interaction = 'hint';
			result.dragging = false;
			break;
	}

	return result;
}

// --- The UI store ---
export const uiStore = (() => {
	const { subscribe, update, set } = writable<UIStoreState>(initialState);

	// --- Helper functions ---
	function setInteraction(id: string, state: ElementState) {
		update((s) => {
			if (!s.nodeStates[id]) s.nodeStates[id] = { interaction: 'ready' };
			s.nodeStates[id] = transition(s.nodeStates[id], state);
			return s;
		});
	}

	function togglePoint(id: string) {
		update((s) => {
			const state = s.nodeStates[id]?.interaction || 'ready';
			s.nodeStates[id] = transition(
				s.nodeStates[id] || { interaction: 'ready' },
				state === 'active' ? 'inactive' : 'active'
			);
			return s;
		});
	}

	function toggleTriangle(id: string) {
		const tri = gridStore.getTriangleById(id);
		if (!tri) return;
		const states = tri.points.map((pid) => get(uiStore).nodeStates[pid]?.interaction || 'ready');
		const allActive = states.every((s) => s === 'active');
		const newState: ElementState = allActive ? 'inactive' : 'active';
		for (const pid of tri.points) setInteraction(pid, newState);
	}

	// --- Drag/hover logic ---
	function startDrag(els: ElementRef | ElementRef[]) {
		update((s) => {
			const elements = Array.isArray(els) ? els : [els];
			s.context.dragging = true;
			s.draggedNodes = new Set(elements.map((el) => el.id));
			elements.forEach((el) => {
				const prev = s.nodeStates[el.id]?.interaction;
				s.nodeStates[el.id] = transition(
					{
						...(s.nodeStates[el.id] || { interaction: 'ready', previousInteraction: prev }),
						previousInteraction: prev
					},
					'active'
				);
			});
			return s;
		});
	}

	function updateDrag(els: ElementRef | ElementRef[]) {
		update((s) => {
			if (!s.context.dragging) return s;

			const elements = Array.isArray(els) ? els : [els];
			const newIds = new Set(elements.map((el) => el.id));

			// Restore previous drag nodes
			s.draggedNodes?.forEach((id) => {
				const node = s.nodeStates[id];
				if (!node || newIds.has(id)) return;
				s.nodeStates[id] = transition(node, 'drag-prev');
			});

			// Activate new drag nodes
			elements.forEach((el) => {
				const node = s.nodeStates[el.id] || { interaction: 'ready' };
				s.nodeStates[el.id] = transition(node, 'active');
			});

			s.draggedNodes = newIds;
			return s;
		});
	}

	function endDrag() {
		update((s) => {
			s.draggedNodes?.forEach((id) => {
				const node = s.nodeStates[id];
				if (!node) return;
				s.nodeStates[id] = transition(node, 'inactive');
			});

			// Clean up old drag-prev states
			Object.values(s.nodeStates).forEach((node) => {
				if (node.interaction === 'drag-prev')
					node.interaction = node.previousInteraction === 'hint' ? 'hint' : 'inactive';
				node.previousInteraction = undefined;
				node.dragging = false;
			});

			s.context.dragging = false;
			s.draggedNodes = new Set();
			return s;
		});
	}

	function setHints(hintIds: string[]) {
		update((s) => {
			// Reset all previous hints to ready
			for (const [id, node] of Object.entries(s.nodeStates)) {
				if (node.interaction === 'hint') s.nodeStates[id] = transition(node, 'ready');
			}

			// Apply new hints
			for (const id of hintIds) {
				if (!s.nodeStates[id]) s.nodeStates[id] = { interaction: 'ready' };
				s.nodeStates[id] = transition(s.nodeStates[id], 'hint');
			}

			return s;
		});
	}

	// --- Mouse/keyboard handlers ---
	function handleMouseDown(el: ElementRef) {
		const { shiftPressed } = get(uiStore).context;
		if (shiftPressed) {
			if (el.type === 'point') togglePoint(el.id);
			else if (el.type === 'triangle') toggleTriangle(el.id);
		} else {
			if (el.type === 'point') startDrag(el);
			else if (el.type === 'triangle') {
				const tri = gridStore.getTriangleById(el.id);
				if (tri) startDrag(tri.points.map((id) => ({ id, type: 'point' })));
			}
		}
	}

	function handleMouseEnter(el: ElementRef) {
		if (!get(uiStore).context.dragging) return;
		const targets =
			el.type === 'point'
				? [el]
				: (gridStore.getTriangleById(el.id)?.points.map((id) => ({ id, type: 'point' })) ?? []);
		updateDrag(targets);
	}

	function handleMouseLeave(el: ElementRef) {
		if (!get(uiStore).context.dragging) return;
		const targets =
			el.type === 'point'
				? [el]
				: (gridStore.getTriangleById(el.id)?.points.map((id) => ({ id, type: 'point' })) ?? []);
		updateDrag(targets);
	}

	function handleMouseUp() {
		if (get(uiStore).context.dragging) {
			endDrag();
			update((s) => ({ ...s, context: { ...s.context, dragging: false } }));
		}
	}

	function handleKeyDown(e: KeyboardEvent) {
		update((s) => {
			if (e.key === 'Shift') s.context.shiftPressed = true;
			if (e.key === 'Escape') {
				for (const id of Object.keys(s.nodeStates))
					s.nodeStates[id] = transition(s.nodeStates[id], 'ready');
			}
			return s;
		});
	}

	function handleKeyUp(e: KeyboardEvent) {
		if (e.key === 'Shift')
			update((s) => ({ ...s, context: { ...s.context, shiftPressed: false } }));
	}

	return {
		subscribe,
		reset: () => set(initialState),
		setInteraction,
		setHints,
		startDrag,
		updateDrag,
		endDrag,
		togglePoint,
		toggleTriangle,
		handleMouseDown,
		handleMouseEnter,
		handleMouseLeave,
		handleMouseUp,
		handleKeyDown,
		handleKeyUp
	};
})();
