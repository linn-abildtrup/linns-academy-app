<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount, setContext } from 'svelte';
	import { onAuthStateChanged, type User } from 'firebase/auth';
	import { auth } from '$lib/firebase';
	import { getUserDoc, createUserDoc } from '$lib/userDoc';
	import type { UserDoc } from '$lib/types';

	let { children } = $props();

	let user = $state<User | null>(null);
	let userDoc = $state<UserDoc | null>(null);
	let loading = $state(true);

	// Gør userDoc tilgængeligt for alle undersider via Svelte context
	setContext('userDoc', () => userDoc);
	setContext('user', () => user);

	onMount(() => {
		const unsubscribe = onAuthStateChanged(auth, async (u) => {
			if (!u) {
				// Ikke logget ind → send til login
				await goto('/login');
				return;
			}

			user = u;

			// Hent bruger-dokument fra Firestore
			let doc = await getUserDoc(u.uid);

			// Hvis dokumentet ikke findes (fx hvis brugeren blev oprettet før
			// vi havde Firestore-integration), opret det nu med default state
			if (!doc) {
				await createUserDoc(u.uid, u.email ?? '');
				doc = await getUserDoc(u.uid);
			}

			userDoc = doc;
			loading = false;
		});

		return unsubscribe;
	});
</script>

{#if loading}
	<div class="loading-screen">
		<p>Et øjeblik...</p>
	</div>
{:else}
	{@render children()}
{/if}

<style>
	.loading-screen {
		min-height: 100vh;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--bg);
		font-family: var(--ff-b);
		color: var(--text3);
		font-size: 14px;
	}
</style>