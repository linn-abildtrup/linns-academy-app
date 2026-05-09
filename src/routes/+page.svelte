<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { onAuthStateChanged } from 'firebase/auth';
	import { auth } from '$lib/firebase';

	onMount(() => {
		const unsubscribe = onAuthStateChanged(auth, (user) => {
			if (user) {
				goto('/app');
			} else {
				goto('/login');
			}
		});

		return unsubscribe;
	});
</script>

<div class="splash">
	<p>Et øjeblik...</p>
</div>

<style>
	.splash {
		min-height: 100vh;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--bg);
		font-family: var(--ff-b);
		color: var(--text3);
		font-size: calc(14px * var(--fs-scale, 1));
	}
</style>
