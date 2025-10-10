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

// --- State transition helper ---
function transition(node: NodeState, target: ElementState): NodeState {
	const result = { ...node };
	switch (target) {
		case 'active':
			result.previousInteraction ??= result.interaction;
			result.interaction = 'active';
			result.dragging = true;
			break;
		case 'ready':
		case 'inactive':
			result.interaction = result.previousInteraction === 'hint' ? 'hint' : target;
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

// --- UI Store ---
export const uiStore = (() => {
	const { subscribe, update, set } = writable<UIStoreState>(initialState);

	// --- Node helpers ---
	const updateNode = (id: string, target: ElementState) => {
		update((s) => {
			const node = s.nodeStates[id] || { interaction: 'ready' };
			s.nodeStates[id] = transition(node, target);
			return s;
		});
	};

	const toggleElement = (id: string) => {
		update((s) => {
			const state = s.nodeStates[id]?.interaction || 'ready';
			s.nodeStates[id] = transition(
				s.nodeStates[id] || { interaction: 'ready' },
				state === 'active' ? 'inactive' : 'active'
			);
			return s;
		});
	};

	const togglePoint = (id: string) => {
		update((s) => {
			const node = s.nodeStates[id] || { interaction: 'ready' };
			const newState: ElementState = node.interaction === 'active' ? 'inactive' : 'active';
			s.nodeStates[id] = transition({ ...node, previousInteraction: node.interaction }, newState);
			return s;
		});
	};

	const toggleTriangle = (id: string) => {
		const tri = gridStore.getTriangleById(id);
		if (!tri) return;

		const states = tri.points.map((pid) => get(uiStore).nodeStates[pid]?.interaction || 'ready');
		const allActive = states.every((s) => s === 'active');
		const newState: ElementState = allActive ? 'inactive' : 'active';

		tri.points.forEach((pid) => {
			update((s) => {
				const node = s.nodeStates[pid] || { interaction: 'ready' };
				s.nodeStates[pid] = transition(
					{ ...node, previousInteraction: node.interaction },
					newState
				);
				return s;
			});
		});
	};

	// --- Drag helpers ---
	const expandToPoints = (els: ElementRef | ElementRef[]) => {
		const elements = Array.isArray(els) ? els : [els];
		return elements.flatMap((el) =>
			el.type === 'point'
				? [el]
				: (gridStore.getTriangleById(el.id)?.points.map((id) => ({ id, type: 'point' })) ?? [])
		);
	};

	const startDrag = (els: ElementRef | ElementRef[]) => {
		const allPoints = expandToPoints(els);
		update((s) => {
			s.context.dragging = true;
			s.draggedNodes = new Set(allPoints.map((el) => el.id));
			allPoints.forEach((el) => {
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
	};

	const updateDrag = (els: ElementRef | ElementRef[]) => {
		const allPoints = expandToPoints(els);
		const newIds = new Set(allPoints.map((el) => el.id));
		update((s) => {
			if (!s.context.dragging) return s;

			// Reset old drag nodes
			s.draggedNodes?.forEach((id) => {
				if (!newIds.has(id) && s.nodeStates[id]) {
					s.nodeStates[id] = transition(s.nodeStates[id], 'drag-prev');
				}
			});

			// Activate new drag nodes
			allPoints.forEach((el) => {
				const node = s.nodeStates[el.id] || { interaction: 'ready' };
				s.nodeStates[el.id] = transition(
					{ ...node, previousInteraction: node.interaction },
					'active'
				);
			});

			s.draggedNodes = newIds;
			return s;
		});
	};

	const endDrag = () => {
		update((s) => {
			s.draggedNodes?.forEach((id) => {
				const node = s.nodeStates[id];
				if (!node) return;
				s.nodeStates[id] = {
					...node,
					interaction: node.previousInteraction === 'hint' ? 'hint' : 'inactive',
					previousInteraction: undefined,
					dragging: false
				};
			});

			// Reset lingering drag-prev nodes
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
	};

	const setHints = (hintIds: string[]) => {
		update((s) => {
			// Clear old hints
			Object.entries(s.nodeStates).forEach(([id, node]) => {
				if (node.interaction === 'hint') s.nodeStates[id] = transition(node, 'ready');
			});
			// Apply new hints
			hintIds.forEach((id) => updateNode(id, 'hint'));
			return s;
		});
	};

	// --- Note helpers ---
	const changeNotes = (noteIds: string | string[], type: 'play' | 'add' | 'stop') => {
		const ids = Array.isArray(noteIds) ? noteIds : [noteIds];
		update((state) => {
			const newState = { ...state };

			if (type === 'play') {
				// Reset all active notes
				Object.keys(newState.nodeStates).forEach((id) => {
					if (newState.nodeStates[id].interaction === 'active') {
						newState.nodeStates[id] = {
							...newState.nodeStates[id],
							interaction: newState.nodeStates[id].previousInteraction || 'ready',
							previousInteraction: undefined
						};
					}
				});
			}

			if (type === 'stop') {
				(ids.length === 0 ? Object.keys(newState.nodeStates) : ids).forEach((id) => {
					const node = newState.nodeStates[id];
					if (node?.interaction === 'active')
						newState.nodeStates[id] = {
							...node,
							interaction: node.previousInteraction || 'ready',
							previousInteraction: undefined
						};
				});
			} else {
				// Add or play notes
				ids.forEach((id) => {
					const node = newState.nodeStates[id];
					newState.nodeStates[id] = node
						? { ...node, interaction: 'active', previousInteraction: node.interaction }
						: { interaction: 'active' };
				});
			}

			return newState;
		});
	};

	// --- Mouse/keyboard handlers ---
	const handleElementMouse = (el: ElementRef, action: 'down' | 'enter' | 'leave') => {
		const { shiftPressed } = get(uiStore).context;
		const points = expandToPoints(el);
		if (action === 'down') {
			if (shiftPressed) el.type === 'point' ? toggleElement(el.id) : toggleTriangle(el.id);
			else startDrag(points);
		} else if (action === 'enter' || action === 'leave') updateDrag(points);
	};

	return {
		subscribe,
		reset: () => set(initialState),
		setInteraction: updateNode,
		setHints,
		startDrag,
		updateDrag,
		endDrag,
		togglePoint,
		toggleTriangle,
		handleMouseDown: (el: ElementRef) => handleElementMouse(el, 'down'),
		handleMouseEnter: (el: ElementRef) => handleElementMouse(el, 'enter'),
		handleMouseLeave: (el: ElementRef) => handleElementMouse(el, 'leave'),
		handleMouseUp: () => {
			if (get(uiStore).context.dragging) {
				endDrag();
				update((s) => ({ ...s, context: { ...s.context, dragging: false } }));
			}
		},
		handleKeyDown: (e: KeyboardEvent) => {
			update((s) => {
				if (e.key === 'Shift') s.context.shiftPressed = true;
				if (e.key === 'Escape')
					Object.keys(s.nodeStates).forEach(
						(id) => (s.nodeStates[id] = transition(s.nodeStates[id], 'ready'))
					);
				return s;
			});
		},
		handleKeyUp: (e: KeyboardEvent) => {
			if (e.key === 'Shift')
				update((s) => ({ ...s, context: { ...s.context, shiftPressed: false } }));
		},
		addNotes: (ids: string | string[]) => changeNotes(ids, 'add'),
		removeNotes: (ids?: string | string[]) => changeNotes(ids || [], 'stop'),
		playNotes: (ids: string | string[]) => changeNotes(ids, 'play')
	};
})();
