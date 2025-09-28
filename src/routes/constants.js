// Mathematical constants
export const SQRT3 = Math.sqrt(3);

// Music theory constants
export const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const NOTE_TO_SEMITONE = Object.fromEntries(NOTES.map((note, i) => [note, i]));
export const INTERVAL_NAMES = [
	'Unison',
	'Minor 2nd',
	'Major 2nd',
	'Minor 3rd',
	'Major 3rd',
	'Perfect 4th',
	'Tritone',
	'Perfect 5th',
	'Minor 6th',
	'Major 6th',
	'Minor 7th',
	'Major 7th'
];

// Derived geometry constants (calculated from CONFIG)
export const createGeometryConstants = (CONFIG) => {
	const { baseTriangleSize, innerTriangle } = CONFIG;
	const HALF_SIZE = baseTriangleSize * 0.5;
	const TRI_HEIGHT = baseTriangleSize * SQRT3 * 0.5;

	return {
		halfSize: HALF_SIZE,
		triHeight: TRI_HEIGHT,
		spacing: { row: TRI_HEIGHT, col: HALF_SIZE },
		scale: innerTriangle.size / baseTriangleSize
	};
};
