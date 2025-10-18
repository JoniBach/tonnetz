/**
 * MIDI-to-Notation Converter
 * Converts MIDI JSON format to renderable notation elements
 * Handles barlines, measure calculations, and time-based positioning
 */

import type { MidiData, MidiNote, TimeSignature, NotationElement } from '../types/midi-types';
import { secondsToDuration } from '../types/midi-types';

export type RenderableNote = {
	type: 'note';
	midiNote: MidiNote;
	duration: string; // Quarter, Half, etc.
	pitch: string;
	lyric?: string;
	measureNumber: number;
	beatInMeasure: number;
};

export type RenderableBarline = {
	type: 'barline';
	style: 'single' | 'double' | 'final' | 'repeat';
	measureNumber: number;
	time: number;
};

export type RenderableElement = RenderableNote | RenderableBarline;

/**
 * Calculates measure duration in seconds based on time signature and BPM
 */
export function calculateMeasureDuration(
	timeSignature: TimeSignature,
	bpm: number
): number {
	const beatsPerMeasure = timeSignature.numerator;
	const beatValue = timeSignature.denominator;
	
	// Quarter note duration in seconds
	const quarterNoteDuration = 60 / bpm;
	
	// Adjust for beat value (e.g., if denominator is 8, half the duration)
	const beatDuration = quarterNoteDuration * (4 / beatValue);
	
	return beatsPerMeasure * beatDuration;
}

/**
 * Determines which measure a note belongs to
 */
export function getMeasureNumber(
	time: number,
	measureDuration: number
): number {
	return Math.floor(time / measureDuration);
}

/**
 * Calculates beat position within a measure
 */
export function getBeatInMeasure(
	time: number,
	measureDuration: number,
	beatsPerMeasure: number
): number {
	const timeInMeasure = time % measureDuration;
	return (timeInMeasure / measureDuration) * beatsPerMeasure;
}

/**
 * Generates barline positions based on measures
 */
export function generateBarlines(
	duration: number,
	measureDuration: number,
	startMeasure: number = 0
): RenderableBarline[] {
	const barlines: RenderableBarline[] = [];
	const totalMeasures = Math.ceil(duration / measureDuration);
	
	// Add barline at the start
	barlines.push({
		type: 'barline',
		style: 'single',
		measureNumber: startMeasure,
		time: 0
	});
	
	// Add barlines between measures
	for (let i = 1; i < totalMeasures; i++) {
		barlines.push({
			type: 'barline',
			style: 'single',
			measureNumber: startMeasure + i,
			time: i * measureDuration
		});
	}
	
	// Add final barline
	barlines.push({
		type: 'barline',
		style: 'final',
		measureNumber: startMeasure + totalMeasures,
		time: duration
	});
	
	return barlines;
}

/**
 * Converts MIDI notes to renderable notes with measure information
 */
export function convertMidiNotesToRenderable(
	notes: MidiNote[],
	bpm: number,
	timeSignature: TimeSignature
): RenderableNote[] {
	const measureDuration = calculateMeasureDuration(timeSignature, bpm);
	const beatsPerMeasure = timeSignature.numerator;
	
	return notes.map((midiNote) => {
		const measureNumber = getMeasureNumber(midiNote.time, measureDuration);
		const beatInMeasure = getBeatInMeasure(midiNote.time, measureDuration, beatsPerMeasure);
		const duration = secondsToDuration(midiNote.duration, bpm);
		
		return {
			type: 'note',
			midiNote,
			duration,
			pitch: midiNote.name,
			lyric: midiNote.lyric,
			measureNumber,
			beatInMeasure
		};
	});
}

/**
 * Merges notes and barlines in chronological order
 */
export function mergeNotesAndBarlines(
	notes: RenderableNote[],
	barlines: RenderableBarline[]
): RenderableElement[] {
	const elements: RenderableElement[] = [];
	let noteIndex = 0;
	let barlineIndex = 0;
	
	while (noteIndex < notes.length || barlineIndex < barlines.length) {
		const note = notes[noteIndex];
		const barline = barlines[barlineIndex];
		
		// Determine which comes first
		if (!note) {
			// No more notes, add remaining barlines
			elements.push(barline);
			barlineIndex++;
		} else if (!barline) {
			// No more barlines, add remaining notes
			elements.push(note);
			noteIndex++;
		} else {
			// Compare times
			const noteTime = note.midiNote.time;
			const barlineTime = barline.time;
			
			if (barlineTime <= noteTime) {
				elements.push(barline);
				barlineIndex++;
			} else {
				elements.push(note);
				noteIndex++;
			}
		}
	}
	
	return elements;
}

/**
 * Main converter: MIDI data to renderable notation elements
 */
export function convertMidiToNotation(midiData: MidiData, trackIndex: number = 0): RenderableElement[] {
	const track = midiData.tracks[trackIndex];
	if (!track) {
		throw new Error(`Track ${trackIndex} not found`);
	}
	
	const bpm = midiData.header.bpm;
	const timeSignature = midiData.timeSignature[0] || {
		numerator: midiData.header.timeSignature[0],
		denominator: midiData.header.timeSignature[1],
		absoluteTime: 0,
		seconds: 0
	};
	
	// Calculate measure duration
	const measureDuration = calculateMeasureDuration(timeSignature, bpm);
	
	// Convert notes
	const renderableNotes = convertMidiNotesToRenderable(track.notes, bpm, timeSignature);
	
	// Generate barlines
	const barlines = generateBarlines(track.duration, measureDuration);
	
	// Merge and sort
	const elements = mergeNotesAndBarlines(renderableNotes, barlines);
	
	return elements;
}

/**
 * Groups elements by measure for easier rendering
 */
export function groupByMeasure(elements: RenderableElement[]): Map<number, RenderableElement[]> {
	const measures = new Map<number, RenderableElement[]>();
	
	for (const element of elements) {
		const measureNumber = element.measureNumber;
		if (!measures.has(measureNumber)) {
			measures.set(measureNumber, []);
		}
		measures.get(measureNumber)!.push(element);
	}
	
	return measures;
}

/**
 * Calculates horizontal spacing for notes based on time
 */
export function calculateNoteSpacing(
	elements: RenderableElement[],
	pixelsPerSecond: number = 100
): Array<RenderableElement & { x: number }> {
	return elements.map((element) => {
		const time = element.type === 'note' ? element.midiNote.time : element.time;
		return {
			...element,
			x: time * pixelsPerSecond
		};
	});
}
