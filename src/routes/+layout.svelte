<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';
	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />

	<!-- Import Montserrat from Google Fonts -->
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
	<link
		href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;700&display=swap"
		rel="stylesheet"
	/>

	<style>
		/* Set Montserrat as the default font */
		body {
			font-family: 'Montserrat', sans-serif;
		}
	</style>
</svelte:head>

{@render children?.()}

<style>
	@font-face {
		font-family: 'Bravura';
		src: url('/fonts/Bravura.otf') format('opentype');
	}
	@font-face {
		font-family: 'BravuraText';
		src: url('/fonts/BravuraText.otf') format('opentype');
	}

	:global(.smuFL) {
		font-family: 'Bravura';
	}

	:global(body) {
		font-family: 'Roboto', sans-serif;
		box-sizing: border-box;
		margin: 0;
		padding: 0;
	}

	:global(*) {
		box-sizing: border-box;
	}
</style>
