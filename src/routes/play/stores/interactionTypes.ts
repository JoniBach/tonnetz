export type ElementState = 'ready' | 'active' | 'inactive' | 'drag-prev';

export const COLORS: Record<ElementState, string> = {
	ready: '#eee',
	active: '#4caf50',
	inactive: '#999',
	'drag-prev': '#ff9800'
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
