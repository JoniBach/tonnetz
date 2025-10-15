<script lang="ts">
	import Documentation from './notation/Documentation.svelte';
	import Notation from './notation/Notation.svelte';
	
	import { onMount } from 'svelte';

	let classes: any = null;
	let glyphnames: any = null;
	let ranges: any = null;
	let metadata: any = null;

	$: data = {
		classes,
		glyphnames,
		ranges,
		metadata
	};

	let loading = true;
	let error: string | null = null;

	let mozartTwinkle = [
    { type: 'barline', duration: 'Single' },

    // Bar 1: C C G G
    { type: 'note', duration: 'Quarter', pitch: 'C4', lyric: 'Twin' },
    { type: 'note', duration: 'Quarter', pitch: 'C4', lyric: 'kle' },
    { type: 'note', duration: 'Quarter', pitch: 'G4', lyric: 'twin' },
    { type: 'note', duration: 'Quarter', pitch: 'G4', lyric: 'kle' },
    { type: 'barline', duration: 'Single' },

    // Bar 2: A A G (half note)
    { type: 'note', duration: 'Quarter', pitch: 'A5', lyric: 'lit' },
    { type: 'note', duration: 'Quarter', pitch: 'A5', lyric: 'tle' },
    { type: 'note', duration: 'Half', pitch: 'G4', lyric: 'star' },

    { type: 'barline', duration: 'Single' },

    // Bar 3: F F E E
    { type: 'note', duration: 'Quarter', pitch: 'F4', lyric: 'How' },
    { type: 'note', duration: 'Quarter', pitch: 'F4', lyric: 'I' },
    { type: 'note', duration: 'Quarter', pitch: 'E4', lyric: 'won' },
    { type: 'note', duration: 'Quarter', pitch: 'E4', lyric: 'der' },
    { type: 'barline', duration: 'Single' },


    // Bar 4: D D C (half note)
    { type: 'note', duration: 'Quarter', pitch: 'D4', lyric: 'what' },
    { type: 'note', duration: 'Quarter', pitch: 'D4', lyric: 'you' },
    { type: 'note', duration: 'Half', pitch: 'C4', lyric: 'are' },

    { type: 'barline', duration: 'Final' }
];


	// Notes for "Ut queant laxis" on a five-line staff, showcasing modern notation
	let classicalNotes2 = [
		//
		{
			// note: 'barlineSingle',
			type: 'barline',
			duration: 'Single'
		},

		{
			// note: 'noteDoubleWhole',
			type: 'note',
			duration: 'DoubleWhole',
			// y: -1,
			pitch: 'D3',
			lyric: 'Notes of different lengths at different pitches'
		},
		{
			// note: 'noteDoubleWholeSquare',
			type: 'note',
			duration: 'DoubleWholeSquare',
			// y: 0,
			pitch: 'E3'
		},
		{
			// note: 'noteDoubleWhole',
			type: 'note',
			duration: 'DoubleWhole',
			// y: 1,
			pitch: 'F3'
		},
		{
			// note: 'noteWhole',
			type: 'note',
			duration: 'Whole',
			// y: 2,
			pitch: 'G3'
		},
		{
			// note: 'noteHalfUp',
			type: 'note',
			duration: 'Half',
			// y: 3,
			pitch: 'A4'
		},
		{
			// note: 'noteHalfDown',
			type: 'note',
			duration: 'Half',
			// y: 4,
			pitch: 'B4'
		},
		{
			// note: 'noteQuarterUp',
			type: 'note',
			duration: 'Quarter',
			// y: 4,
			pitch: 'C4'
		},
		{
			// note: 'note8thUp',
			type: 'note',
			duration: '8th',
			// y: 6,
			pitch: 'D4'
		},
		{
			// note: 'note16thUp',
			type: 'note',
			duration: '16th',
			// y: 7,
			pitch: 'E4'
		},
		{
			// note: 'note32ndUp',
			type: 'note',
			duration: '32nd',
			// y: 8,
			pitch: 'F4'
		},
		{
			// note: 'note64thUp',
			type: 'note',
			duration: '64th',
			// y: 9,
			pitch: 'G4'
		},

		{
			// note: 'barlineSingle',
			type: 'barline',
			duration: 'Single'
		},
		{
			// note: 'noteQuarterUp',
			type: 'note',
			duration: 'Quarter',
			// y: 10,
			pitch: 'A5',
			lyric: 'Extended Ledger Lines'
		},
		{
			// note: 'noteQuarterUp',
			type: 'note',
			duration: 'Quarter',
			// y: 11,
			pitch: 'B6'
		},
		{
			// note: 'noteQuarterUp',
			type: 'note',
			duration: 'Quarter',
			// y: 12,
			pitch: 'C6'
		},

		{
			// note: 'noteQuarterUp',
			type: 'note',
			duration: 'Quarter',
			// y: -4,
			pitch: 'A4'
		},
		{
			// note: 'noteQuarterUp',
			type: 'note',
			duration: 'Quarter',
			// y: -3,
			pitch: 'B4'
		},
		{
			// note: 'noteQuarterUp',
			type: 'note',
			duration: 'Quarter',
			// y: -2,
			pitch: 'C4'
		},
		{
			// note: 'barlineFinal',
			type: 'barline',
			duration: 'Double',
			pitch: ''
		},
		{
			// note: 'restQuarter',
			type: 'rest',
			duration: 'Half',
			y: 4,
			lyric: 'Rests of different lengths'
		},
		{
			// note: 'restQuarter',
			type: 'rest',
			duration: 'Quarter',
			y: 4
		},
		{
			// note: 'rest8th',
			type: 'rest',
			duration: '8th',
			y: 4
		},
		{
			// note: 'rest16th',
			type: 'rest',
			duration: '16th',
			y: 4
		},
		{
			// note: 'rest32nd',
			type: 'rest',
			duration: '32nd',
			y: 4
		},
		{
			// note: 'rest64th',
			type: 'rest',
			duration: '64th',
			y: 4
		},

		{
			// note: 'barlineFinal',
			type: 'barline',
			duration: 'Final',
			pitch: ''
		}

		// {
		// 	// note: 'barlineFinal',
		// 	type: 'any',
		// 	entity: 'mensuralRestMaxima',
		// }
	];

	let classicalNotes = [
		//
		{
			// note: 'barlineSingle',
			type: 'barline',
			duration: 'Single'
		},

		{
			// note: 'noteDoubleWhole',
			type: 'note',
			duration: 'DoubleWhole',
			// y: -1,
			pitch: 'D4',
			lyric: 'Notes of different lengths at different pitches'
		},
		{
			// note: 'noteDoubleWholeSquare',
			type: 'note',
			duration: 'DoubleWholeSquare',
			// y: 0,
			pitch: 'E4'
		},
		{
			// note: 'noteDoubleWhole',
			type: 'note',
			duration: 'DoubleWhole',
			// y: 1,
			pitch: 'F4'
		},
		{
			// note: 'noteWhole',
			type: 'note',
			duration: 'Whole',
			// y: 2,
			pitch: 'G4'
		},
		{
			// note: 'noteHalfUp',
			type: 'note',
			duration: 'Half',
			// y: 3,
			pitch: 'A5'
		},
		{
			// note: 'noteHalfDown',
			type: 'note',
			duration: 'Half',
			// y: 4,
			pitch: 'B5'
		},
		{
			// note: 'noteQuarterUp',
			type: 'note',
			duration: 'Quarter',
			// y: 5,
			pitch: 'C5'
		},
		{
			// note: 'note8thUp',
			type: 'note',
			duration: '8th',
			// y: 6,
			pitch: 'D5'
		},
		{
			// note: 'note16thUp',
			type: 'note',
			duration: '16th',
			// y: 7,
			pitch: 'E5'
		},
		{
			// note: 'note32ndUp',
			type: 'note',
			duration: '32nd',
			// y: 8,
			pitch: 'F5'
		},
		{
			// note: 'note64thUp',
			type: 'note',
			duration: '64th',
			// y: 9,
			pitch: 'G5'
		},

		{
			// note: 'barlineSingle',
			type: 'barline',
			duration: 'Single'
		},
		{
			// note: 'noteQuarterUp',
			type: 'note',
			duration: 'Quarter',
			// y: 10,
			pitch: 'A6',
			lyric: 'Extended Ledger Lines'
		},
		{
			// note: 'noteQuarterUp',
			type: 'note',
			duration: 'Quarter',
			// y: 11,
			pitch: 'B6'
		},
		{
			// note: 'noteQuarterUp',
			type: 'note',
			duration: 'Quarter',
			// y: 12,
			pitch: 'C6'
		},

		{
			// note: 'noteQuarterUp',
			type: 'note',
			duration: 'Quarter',
			// y: -4,
			pitch: 'A4'
		},
		{
			// note: 'noteQuarterUp',
			type: 'note',
			duration: 'Quarter',
			// y: -3,
			pitch: 'B4'
		},
		{
			// note: 'noteQuarterUp',
			type: 'note',
			duration: 'Quarter',
			// y: -2,
			pitch: 'C4'
		},
		{
			// note: 'barlineFinal',
			type: 'barline',
			duration: 'Double',
			pitch: ''
		},
		{
			// note: 'restQuarter',
			type: 'rest',
			duration: 'Half',
			y: 4,
			lyric: 'Rests of different lengths'
		},
		{
			// note: 'restQuarter',
			type: 'rest',
			duration: 'Quarter',
			y: 4
		},
		{
			// note: 'rest8th',
			type: 'rest',
			duration: '8th',
			y: 4
		},
		{
			// note: 'rest16th',
			type: 'rest',
			duration: '16th',
			y: 4
		},
		{
			// note: 'rest32nd',
			type: 'rest',
			duration: '32nd',
			y: 4
		},
		{
			// note: 'rest64th',
			type: 'rest',
			duration: '64th',
			y: 4
		},

		{
			// note: 'barlineFinal',
			type: 'barline',
			duration: 'Final',
			pitch: ''
		}

		// {
		// 	// note: 'barlineFinal',
		// 	type: 'any',
		// 	entity: 'mensuralRestMaxima',
		// }
	];


	onMount(async () => {
		try {
			const [classesRes, glyphnamesRes, rangesRes, metadataRes] = await Promise.all([
				fetch('/smufl/metadata/classes.json'),
				fetch('/smufl/metadata/glyphnames.json'),
				fetch('/smufl/metadata/ranges.json'),
				fetch('/smufl/metadata/bravura_metadata.json')
			]);

			if (!classesRes.ok || !glyphnamesRes.ok || !rangesRes.ok || !metadataRes.ok) {
				throw new Error('One or more files failed to load');
			}

			[classes, glyphnames, ranges, metadata] = await Promise.all([
				classesRes.json(),
				glyphnamesRes.json(),
				rangesRes.json(),
				metadataRes.json()
			]);
		} catch (err) {
			error = err.message;
		} finally {
			loading = false;
		}
	});

	let searchSuggestions = [
		'clefs',
		'dynamics',
		'individualNotes',
		'barlines',
		'rests',
		'note16thDown',
		'medieval'
	];
</script>

<div class="content">
	<h1>Modern Staff Notation: Precision in Music</h1>

	<iframe width="560" height="315" src="https://www.youtube.com/embed/ua-N1JuqO5M?si=iu90PhUpg0uIt-Bz" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>
	<h4>The foundation of Western music</h4>
	<p>
		Modern staff notation, characterized by the five-line staff, standardized note shapes, and barlines, revolutionized music by providing a precise system for notating pitch and rhythm. Evolving from the neumes of the early medieval period, this system became the universal standard for Western music, enabling complex compositions and global dissemination.
	</p>
	<h4>From neumes to the five-line staff</h4>
	<p>
		The journey began with Guido d’Arezzo’s four-line staff in the 11th century, which allowed neumes to represent exact pitches. By the 13th century, the five-line staff emerged, offering greater range and clarity. The Renaissance saw the standardization of note shapes like the semibreve and minim, along with barlines and rests, establishing the foundation for modern notation.
	</p>
	<h4>A universal language</h4>
	<p>
		Staff notation enabled composers to write intricate polyphony and share music across regions. Its clarity and flexibility made it essential for sacred and secular music, from Gregorian chants to orchestral scores, shaping musical education and performance for centuries.
	</p>

		<h4>A brief history of Western musical notation</h4>
		<p>
			The development of classical Western staff notation transformed music by providing a precise system for notating pitch and rhythm. Starting with neumes, the system evolved through key innovations, culminating in the standardized five-line staff used today.
		</p>
		<ol class="timeline">
			<li>
				<h5>c. 1025: Guido d’Arezzo’s Four-Line Staff</h5>
				<p>
					It started with neums - Guido d’Arezzo introduced the four-line staff, placing neumes on specific lines and spaces to indicate exact pitches. His hymn "Ut queant laxis" inspired the solfege system (ut, re, mi, fa, so, la), revolutionizing musical notation.
				</p>
			</li>
			<li>
				<h5>13th Century: Five-Line Staff</h5>
				<p>
					The five-line staff emerged, expanding the range of pitches that could be notated. This provided greater clarity and flexibility, becoming the standard for Western music notation.
				</p>
			</li>
			<li>
				<h5>13th–16th Centuries: Mensural Notation</h5>
				<p>
					Mensural notation introduced standardized note shapes (e.g., semibreve, minim) to indicate specific rhythmic values. This allowed composers to notate precise durations, enabling complex polyphonic music.
				</p>
			</li>
			<li>
				<h5>16th–17th Centuries: Barlines and Time Signatures</h5>
				<p>
					Barlines were introduced to divide music into measures, and time signatures standardized rhythmic organization. This structured approach facilitated ensemble performance and complex compositions.
				</p>
			</li>
			<li>
				<h5>17th–18th Centuries: Modern Notation Standardization</h5>
				<p>
					The modern system of staff notation was fully standardized, with consistent note shapes, clefs, barlines, and dynamics. This universal language enabled composers to share intricate works globally, from Baroque to Classical music.
				</p>
			</li>
		</ol>

	{#if loading}
		<p>Loading SMuFL metadata...</p>
	{:else if error}
		<p class="text-red-600">Error: {error}</p>
	{:else}
		<div class="harmonic-block">
			<h4>Ut queant laxis: The Birth of Modern Notation</h4>
			<p>
				The hymn "Ut queant laxis," attributed to Guido d’Arezzo, was instrumental in the development of modern staff notation. Its opening notes inspired the solfege system (ut, re, mi, fa, so, la), and its notation on a staff marked a leap toward precision. This example uses modern note shapes (whole, half, quarter) and barlines on a five-line staff, reflecting the standardized system of the Renaissance and beyond.
			</p>
		</div>
		<Notation
			title="Modern Staff Notation"
			subtitle="The basic notes and rests that make up modern staff notation"
			timeSignature={{ numerator: 4, denominator: 4 }}
			fontSize={50}
			notes={classicalNotes}
			{data}
			staff="staff5Lines"
		/>

		<div class="harmonic-block">
			<h4>Split Staff: Bass and Treble Staves</h4>
			<p>
				Modern staff notation uses two staves: one for the treble clef and one for the bass clef. The treble clef is used for higher pitched instruments like the violin, and the bass clef is used for lower pitched instruments like the cello. The staves are connected by a barline, which indicates the beginning of a new measure.
			</p>
		</div>


			<Notation
			title="Basic Classical Music Notation"
			subtitle="Some examples of different notes, rests, and other musical elements"
			fontSize={50}
			notes={classicalNotes2}
			{data}
			staff="staff5Lines"
			thoroughbass
		/>

		<div class="harmonic-block">
			<h4>Twinkle Twinkle Little Star</h4>
			<p>
				Twinkle Twinkle Little Star is a popular children's song that uses modern staff notation. Its simple melody and rhythmic structure make it an ideal example of the basic notes and rests used in modern staff notation.
			</p>
		</div>
		<Notation
			title="Twinkle Twinkle Little Star"
			subtitle="A simple melody using modern staff notation"
			timeSignature={{ numerator: 4, denominator: 4 }}
			fontSize={50}
			notes={mozartTwinkle}
			{data}
			staff="staff5Lines"
			clef="gClef"
			/>



		<Documentation {data} {searchSuggestions} />
	{/if}
</div>


<style>
	.content {
		display: flex;
		flex-direction: column;
		justify-content: center;
		gap: 1rem;
		max-width: 800px;
		margin: 2rem auto;
		padding: 1rem;
	}
	.harmonic-block {
		margin: 1.5rem 0;
	}
	.harmonic-block p {
		margin-bottom: 0.5rem;
	}
	.timeline {
		list-style: none;
		padding-left: 0;
		margin: 1rem 0;
	}
	.timeline li {
		margin: 0.5rem 0;
		padding-left: 1rem;
		border-left: 2px solid #ccc;
	}
	.timeline strong {
		color: #333;
	}
</style>
