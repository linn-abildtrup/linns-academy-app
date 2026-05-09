<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import { initTextScale } from '$lib/utils/textScale';

	let { children } = $props();

	onMount(() => {
		initTextScale();
	});
</script>

{@render children()}
