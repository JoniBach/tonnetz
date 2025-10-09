export type ElementState = 'ready' | 'active' | 'inactive' | 'drag-prev' | 'hint';

export const COLORS: Record<ElementState, string> = {
	ready: '#eee',
	active: '#4caf50',
	inactive: '#ccc',
	'drag-prev': '#ff9800',
	hint: '#4FC3F7' // light blue
};

export interface ElementRef {
	id: string;
	type: 'point' | 'triangle';
}

export interface InteractionContext {
	current?: ElementRef | null;
	previous?: ElementRef | null;
	shiftPressed: boolean;
	dragging: boolean;
}
