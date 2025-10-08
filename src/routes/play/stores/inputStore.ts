import { writable } from 'svelte/store';

export type MouseButton = 'left' | 'middle' | 'right';

export interface ActiveEvent {
	name: string;
	targetId?: string;
}

export interface InputState {
	mouseDown: boolean;
	mouseButton: MouseButton | null;
	mouseX: number | null;
	mouseY: number | null;
	dragging: boolean;
	dragStartX: number | null;
	dragStartY: number | null;
	dragEndX: number | null;
	dragEndY: number | null;
	dragStartElementId: string | null;
	dragEndElementId: string | null;
	shiftPressed: boolean;
	ctrlPressed: boolean;
	altPressed: boolean;
	activeEvents: ActiveEvent[];
	hoveredElementId: string | null;
}

const initialState: InputState = {
	mouseDown: false,
	mouseButton: null,
	mouseX: null,
	mouseY: null,
	dragging: false,
	dragStartX: null,
	dragStartY: null,
	dragEndX: null,
	dragEndY: null,
	dragStartElementId: null,
	dragEndElementId: null,
	shiftPressed: false,
	ctrlPressed: false,
	altPressed: false,
	activeEvents: [],
	hoveredElementId: null
};

const DRAG_THRESHOLD = 5;

function createInputStore() {
	const { subscribe, update, set } = writable<InputState>(initialState);
	let listeners: { name: string; callback: EventListener }[] = [];

	function checkDrag(s: InputState, x: number, y: number) {
		if (s.dragStartX === null || s.dragStartY === null) return false;
		const dx = x - s.dragStartX;
		const dy = y - s.dragStartY;
		return Math.sqrt(dx * dx + dy * dy) > DRAG_THRESHOLD;
	}

	function computeActiveEvents(s: InputState): ActiveEvent[] {
		const events: ActiveEvent[] = [];

		if (s.shiftPressed) events.push({ name: 'Shift' });
		if (s.ctrlPressed) events.push({ name: 'Ctrl' });
		if (s.altPressed) events.push({ name: 'Alt' });

		if (s.mouseDown) {
			let btnName = '';
			switch (s.mouseButton) {
				case 'left':
					btnName = 'Left Click';
					break;
				case 'middle':
					btnName = 'Middle Click';
					break;
				case 'right':
					btnName = 'Right Click';
					break;
			}
			events.push({ name: btnName, targetId: s.hoveredElementId });
			events.push({ name: 'Mouse Down', targetId: s.hoveredElementId });
		} else {
			events.push({ name: 'Mouse Up', targetId: s.hoveredElementId });
		}

		if (s.dragStartElementId && !s.dragging) {
			events.push({ name: 'Drag Start', targetId: s.dragStartElementId });
		}

		if (s.dragging) {
			events.push({
				name: 'Dragging',
				targetId: s.hoveredElementId ?? s.dragStartElementId ?? undefined
			});
		}

		if (!s.mouseDown && s.dragEndElementId) {
			events.push({ name: 'Drag End', targetId: s.dragEndElementId });
			if (s.dragStartElementId && s.dragEndElementId) {
				events.push({
					name: `Drag from ${s.dragStartElementId} → ${s.dragEndElementId}`
				});
			}
		}

		if (s.hoveredElementId) {
			events.push({ name: 'Hover', targetId: s.hoveredElementId });
		}

		return events;
	}

	// Throttled mousemove handler
	let lastMove = 0;
	const THROTTLE_MS = 16; // ~60fps

	function onMouseDown(x: number, y: number, hoveredId?: string, button: MouseButton = 'left') {
		update((s) => {
			const newState = {
				...s,
				mouseDown: true,
				mouseButton: button,
				mouseX: x,
				mouseY: y,
				dragStartX: x,
				dragStartY: y,
				dragEndX: null,
				dragEndY: null,
				dragStartElementId: hoveredId ?? s.hoveredElementId,
				dragEndElementId: null,
				dragging: false
			};
			newState.activeEvents = computeActiveEvents(newState);
			return newState;
		});
	}

	function onMouseMove(x: number, y: number, hoveredId?: string) {
		const now = performance.now();
		if (now - lastMove < THROTTLE_MS) return;
		lastMove = now;

		update((s) => {
			if (x === s.mouseX && y === s.mouseY && hoveredId === s.hoveredElementId) return s;

			let dragging = s.dragging;
			if (s.mouseDown && !s.dragging) {
				dragging = checkDrag(s, x, y);
			}

			const newState = {
				...s,
				mouseX: x,
				mouseY: y,
				dragging,
				hoveredElementId: hoveredId ?? s.hoveredElementId,
				dragEndX: dragging ? x : s.dragEndX,
				dragEndY: dragging ? y : s.dragEndY,
				dragEndElementId: dragging ? (hoveredId ?? s.hoveredElementId) : s.dragEndElementId
			};
			newState.activeEvents = computeActiveEvents(newState);
			return newState;
		});
	}

	function onMouseUp() {
		update((s) => {
			const newState = {
				...s,
				mouseDown: false,
				mouseButton: null,
				dragging: false,
				dragEndX: s.mouseX,
				dragEndY: s.mouseY,
				dragEndElementId: s.hoveredElementId
			};
			newState.activeEvents = computeActiveEvents(newState);
			return newState;
		});
	}

	function onKeyDown(key: string) {
		update((s) => {
			const newState = { ...s };
			if (key === 'Shift') newState.shiftPressed = true;
			if (key === 'Control') newState.ctrlPressed = true;
			if (key === 'Alt') newState.altPressed = true;
			newState.activeEvents = computeActiveEvents(newState);
			return newState;
		});
	}

	function onKeyUp(key: string) {
		update((s) => {
			const newState = { ...s };
			if (key === 'Shift') newState.shiftPressed = false;
			if (key === 'Control') newState.ctrlPressed = false;
			if (key === 'Alt') newState.altPressed = false;
			newState.activeEvents = computeActiveEvents(newState);
			return newState;
		});
	}

	function addListeners(container: HTMLElement = document.body) {
		removeListeners();
		const register = (name: string, callback: EventListener) => {
			container.addEventListener(name, callback, true);
			listeners.push({ name, callback });
		};

		register('mousedown', (e: MouseEvent) => {
			const targetId = (e.target as HTMLElement).dataset?.id ?? null;
			const button: MouseButton = e.button === 0 ? 'left' : e.button === 1 ? 'middle' : 'right';
			onMouseDown(e.clientX, e.clientY, targetId, button);
		});

		register('mousemove', (e: MouseEvent) => {
			const targetId = (e.target as HTMLElement).dataset?.id ?? null;
			onMouseMove(e.clientX, e.clientY, targetId);
		});

		register('mouseup', () => onMouseUp());
		register('keydown', (e: KeyboardEvent) => onKeyDown(e.key));
		register('keyup', (e: KeyboardEvent) => onKeyUp(e.key));
	}

	function removeListeners() {
		listeners.forEach((l) => document.body.removeEventListener(l.name, l.callback, true));
		listeners = [];
	}

	return {
		subscribe,
		addListeners,
		removeListeners,
		reset: () => set({ ...initialState })
	};
}

export const inputStore = createInputStore();
