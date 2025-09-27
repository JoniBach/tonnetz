// Pure utility functions - no dependencies on global scope

// Math and coordinate functions
export const getTriangleVertices = (pos, up, HALF_SIZE, TRI_HEIGHT) => {
	const { x, y } = pos;
	return up
		? [
				{ x, y },
				{ x: x - HALF_SIZE, y: y + TRI_HEIGHT },
				{ x: x + HALF_SIZE, y: y + TRI_HEIGHT }
			]
		: [
				{ x: x - HALF_SIZE, y },
				{ x: x + HALF_SIZE, y },
				{ x, y: y + TRI_HEIGHT }
			];
};

export const getCentroid = (vertices) => ({
	x: vertices.reduce((sum, v) => sum + v.x, 0) / 3,
	y: vertices.reduce((sum, v) => sum + v.y, 0) / 3
});

export const isVisible = (pos, transform, bufferSize) => {
	const screenPos = transform.apply([pos.x, pos.y]);
	const buffer = bufferSize * transform.k;
	return (
		screenPos[0] > -buffer &&
		screenPos[0] < window.innerWidth + buffer &&
		screenPos[1] > -buffer &&
		screenPos[1] < window.innerHeight + buffer
	);
};

export const cartesianToHex = (x, y, baseTriangleSize, TRI_HEIGHT) => {
	const r = Math.round(y / TRI_HEIGHT);
	return { q: Math.round(x / baseTriangleSize - r * 0.5), r };
};

// Music theory functions
export const mod12 = (n) => ((n % 12) + 12) % 12;

export const pitchClass = (q, r, root, qInterval, rInterval) => 
	root + qInterval * q + rInterval * r;

export const getPitchWithOctave = (q, r, rootNote, singleOctave, qInterval, rInterval, NOTES, NOTE_TO_SEMITONE) => {
	const fullPitch = pitchClass(q, r, NOTE_TO_SEMITONE[rootNote], qInterval, rInterval);
	return singleOctave ? NOTES[mod12(fullPitch)] : `${NOTES[mod12(fullPitch)]}${Math.floor(fullPitch / 12) + 4}`;
};

// Chord detection functions
export const getTriadCombinations = (arr) => {
	const result = [];
	for (let i = 0; i < arr.length - 2; i++) {
		for (let j = i + 1; j < arr.length - 1; j++) {
			for (let k = j + 1; k < arr.length; k++) {
				result.push([arr[i], arr[j], arr[k]]);
			}
		}
	}
	return result;
};

export const getTriangleChord = (row, col, isUp, spacing, cartesianToHexFn, pitchClassFn, mod12Fn, currentRootNote, NOTE_TO_SEMITONE, NOTES) => {
	const pos = { x: col * spacing.col, y: row * spacing.row };
	const vertices = getTriangleVertices(pos, isUp, spacing.col, spacing.row);
	const pitchClasses = vertices.map((v) => {
		const { q, r } = cartesianToHexFn(v.x, v.y);
		const fullPitch = pitchClassFn(q, r, NOTE_TO_SEMITONE[currentRootNote]);
		return mod12Fn(fullPitch);
	});

	// Check each note as potential root
	for (const [i, root] of pitchClasses.entries()) {
		const intervals = pitchClasses
			.filter((_, idx) => idx !== i)
			.map((note) => mod12Fn(note - root))
			.sort((a, b) => a - b);

		if (intervals.length === 2) {
			if (intervals[0] === 4 && intervals[1] === 7) return `${NOTES[root]}`; // Major triad
			if (intervals[0] === 3 && intervals[1] === 7) return `${NOTES[root]}`; // Minor triad
		}
	}

	return `${NOTES[pitchClasses[0]]}?`;
};

export const getTriangleType = (row, col, isUp, getTriangleChordFn) => {
	const chordName = getTriangleChordFn(row, col, isUp);
	const triangleOrientation = isUp ? 'up' : 'down';
	return `${chordName}-${triangleOrientation}`;
};

// Pattern application functions
export const applyPattern = (pattern, rootNote, getNoteCoordsFromCacheFn, getPitchWithOctaveFn, currentRootNote) => {
	const rootCoords = getNoteCoordsFromCacheFn(rootNote);
	if (!rootCoords) return new Set();
	
	const notes = new Set();
	for (const [qOffset, rOffset] of pattern) {
		const noteName = getPitchWithOctaveFn(rootCoords.q + qOffset, rootCoords.r + rOffset, currentRootNote);
		notes.add(noteName);
	}
	return notes;
};

// Cache management functions
export const createCacheKey = (noteName, currentRootNote, qInterval, rInterval) => 
	`${noteName}-${currentRootNote}-${qInterval}-${rInterval}`;

export const createCoordinatePatternCacheKey = (notesToCheck, currentRootNote, qInterval, rInterval) => 
	`${JSON.stringify([...notesToCheck].sort())}-${currentRootNote}-${qInterval}-${rInterval}`;

// Coordinate lookup with progressive search
export const findNoteCoordinates = (noteName, currentRootNote, qInterval, rInterval, getPitchWithOctaveFn) => {
	const searchRanges = [5, 10, 20];
	
	for (const range of searchRanges) {
		for (let q = -range; q <= range; q++) {
			for (let r = -range; r <= range; r++) {
				const foundNote = getPitchWithOctaveFn(q, r, currentRootNote);
				if (foundNote === noteName) {
					return { q, r };
				}
			}
		}
	}
	
	return null;
};

// Viewport calculations
export const getVisibleBounds = (transform, baseTriangleSize, spacing) => {
	const [width, height] = [window.innerWidth, window.innerHeight];
	const [topLeft, bottomRight] = [transform.invert([0, 0]), transform.invert([width, height])];
	const buffer = baseTriangleSize * 1.5;

	return {
		minRow: Math.floor((topLeft[1] - buffer) / spacing.row),
		maxRow: Math.ceil((bottomRight[1] + buffer) / spacing.row),
		minCol: Math.floor((topLeft[0] - buffer) / spacing.col),
		maxCol: Math.ceil((bottomRight[0] + buffer) / spacing.col)
	};
};

export const isTriangleVisible = (pos, transform, baseTriangleSize) =>
	isVisible(pos, transform, baseTriangleSize);

// Chord analysis functions
export const getChordFromNotes = (notes, searchTrianglesFn) => {
	if (notes.length !== 3) return null;
	return searchTrianglesFn(notes);
};

export const getAllHighlightedNotes = (highlightedNote, selectedNotes, highlightedPatternNotes) => {
	const notes = new Set();
	if (highlightedNote) notes.add(highlightedNote);
	for (const note of selectedNotes) notes.add(note);
	for (const note of highlightedPatternNotes) notes.add(note);
	return Array.from(notes);
};
