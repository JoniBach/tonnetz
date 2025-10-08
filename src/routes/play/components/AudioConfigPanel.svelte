<script lang="ts">
	import { audioStore } from '../stores/audioStore';
	import { onMount } from 'svelte';

	let config;
	let open = false;

	const unsubscribe = audioStore.subscribe((c) => (config = c));

	onMount(() => {
		return () => unsubscribe();
	});

	function togglePanel() {
		open = !open;
	}
</script>

<div class="audio-config-wrapper">
	<!-- Toggle button -->
	<button class="toggle-button" on:click={togglePanel}>
		{open ? 'Close' : 'Audio'}
	</button>

	{#if open}
		<div class="audio-config-panel">
			<h3>Synth Configuration</h3>

			<label>
				Waveform:
				<select
					bind:value={config.oscillatorType}
					on:change={(e) => audioStore.setOscillatorType(e.target.value)}
				>
					<option value="sine">Sine</option>
					<option value="square">Square</option>
					<option value="triangle">Triangle</option>
					<option value="sawtooth">Sawtooth</option>
				</select>
			</label>

			<label>
				Volume (dB):
				<input
					type="range"
					min="-60"
					max="0"
					step="1"
					bind:value={config.volume}
					on:input={(e) => audioStore.setVolume(+e.target.value)}
				/>
				<span>{config.volume} dB</span>
			</label>

			<label>
				Portamento (s):
				<input
					type="range"
					min="0"
					max="1"
					step="0.01"
					bind:value={config.portamento}
					on:input={(e) => audioStore.setPortamento(+e.target.value)}
				/>
				<span>{config.portamento}s</span>
			</label>

			<fieldset>
				<legend>Envelope</legend>

				<label>
					Attack:
					<input
						type="range"
						min="0"
						max="5"
						step="0.01"
						bind:value={config.envelope.attack}
						on:input={(e) => audioStore.setAttack(+e.target.value)}
					/>
					<span>{config.envelope.attack}s</span>
				</label>

				<label>
					Decay:
					<input
						type="range"
						min="0"
						max="5"
						step="0.01"
						bind:value={config.envelope.decay}
						on:input={(e) => audioStore.setDecay(+e.target.value)}
					/>
					<span>{config.envelope.decay}s</span>
				</label>

				<label>
					Sustain:
					<input
						type="range"
						min="0"
						max="1"
						step="0.01"
						bind:value={config.envelope.sustain}
						on:input={(e) => audioStore.setSustain(+e.target.value)}
					/>
					<span>{config.envelope.sustain}</span>
				</label>

				<label>
					Release:
					<input
						type="range"
						min="0"
						max="5"
						step="0.01"
						bind:value={config.envelope.release}
						on:input={(e) => audioStore.setRelease(+e.target.value)}
					/>
					<span>{config.envelope.release}s</span>
				</label>
			</fieldset>

			<fieldset>
				<legend>Filter</legend>

				<label>
					Type:
					<select
						bind:value={config.filter.type}
						on:change={(e) => audioStore.setFilterType(e.target.value)}
					>
						<option value="lowpass">Lowpass</option>
						<option value="highpass">Highpass</option>
						<option value="bandpass">Bandpass</option>
						<option value="lowshelf">Lowshelf</option>
						<option value="highshelf">Highshelf</option>
						<option value="notch">Notch</option>
						<option value="allpass">Allpass</option>
						<option value="peaking">Peaking</option>
					</select>
				</label>

				<label>
					Frequency:
					<input
						type="range"
						min="20"
						max="20000"
						step="1"
						bind:value={config.filter.frequency}
						on:input={(e) => audioStore.setFilterFreq(+e.target.value)}
					/>
					<span>{config.filter.frequency} Hz</span>
				</label>

				<label>
					Q:
					<input
						type="range"
						min="0.1"
						max="20"
						step="0.1"
						bind:value={config.filter.Q}
						on:input={(e) => audioStore.setFilterQ(+e.target.value)}
					/>
					<span>{config.filter.Q}</span>
				</label>
			</fieldset>
		</div>
	{/if}
</div>

<style>
	.audio-config-wrapper {
		position: fixed;
		right: 1rem;
		top: 1rem;
		z-index: 1000;
	}

	.toggle-button {
		background: #4a90e2;
		color: white;
		border: none;
		padding: 0.4rem 0.8rem;
		border-radius: 6px;
		cursor: pointer;
		font-size: 0.85rem;
		box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
	}

	.audio-config-panel {
		margin-top: 0.5rem;
		background: #fff;
		border: 1px solid #ccc;
		padding: 1rem;
		border-radius: 6px;
		width: 220px;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
		max-height: 90vh;
		overflow-y: auto;
	}

	label {
		display: flex;
		flex-direction: column;
		margin-bottom: 0.5rem;
	}

	fieldset {
		margin-top: 0.5rem;
		border: 1px solid #ddd;
		padding: 0.5rem;
		border-radius: 4px;
	}

	fieldset legend {
		font-size: 0.85rem;
		font-weight: bold;
		padding: 0 0.5rem;
	}
</style>
