<script lang="ts">
	import { getContext } from 'svelte';
	import { goto } from '$app/navigation';
	import type { User } from 'firebase/auth';
	import { isAdmin } from '$lib/admin';

	let { children } = $props();

	const getUser = getContext<() => User | null>('user');
	const user = $derived(getUser());

	$effect(() => {
		if (user !== null && !isAdmin(user)) {
			goto('/app');
		}
	});

	const erAdmin = $derived(isAdmin(user));
</script>

{#if erAdmin}
	{@render children()}
{:else}
	<div class="ingen-adgang">
		<p>Tjekker adgang...</p>
	</div>
{/if}

<style>
	.ingen-adgang {
		padding: 40px 18px;
		text-align: center;
		color: var(--text3);
		font-family: var(--ff-b);
		font-size: 13px;
	}
</style>
