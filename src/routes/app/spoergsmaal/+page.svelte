<script lang="ts">
	// Spørgsmål-flowet er flyttet til /app/beskeder. Denne route bevares
	// som redirect så gamle links og notifikationer fortsat virker.
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';

	onMount(() => {
		void goto('/app/beskeder', { replaceState: true });
	});
</script>
