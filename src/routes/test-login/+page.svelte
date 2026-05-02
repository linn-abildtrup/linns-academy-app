<script lang="ts">
	import { auth } from '$lib/firebase';
	import {
		createUserWithEmailAndPassword,
		signInWithEmailAndPassword,
		signOut,
		onAuthStateChanged,
		type User
	} from 'firebase/auth';
	import { onMount } from 'svelte';

	let email = $state('');
	let password = $state('');
	let user = $state<User | null>(null);
	let message = $state('');

	onMount(() => {
		const unsubscribe = onAuthStateChanged(auth, (u) => {
			user = u;
		});
		return unsubscribe;
	});

	async function handleSignUp() {
		message = '';
		try {
			await createUserWithEmailAndPassword(auth, email, password);
			message = 'Bruger oprettet og logget ind';
			email = '';
			password = '';
		} catch (err) {
			message = `Fejl ved oprettelse: ${(err as Error).message}`;
		}
	}

	async function handleSignIn() {
		message = '';
		try {
			await signInWithEmailAndPassword(auth, email, password);
			message = 'Logget ind';
			email = '';
			password = '';
		} catch (err) {
			message = `Fejl ved login: ${(err as Error).message}`;
		}
	}

	async function handleSignOut() {
		message = '';
		try {
			await signOut(auth);
			message = 'Logget ud';
		} catch (err) {
			message = `Fejl ved udlogning: ${(err as Error).message}`;
		}
	}
</script>

<h1>Test login</h1>

{#if user}
	<p>Logget ind som: <strong>{user.email}</strong></p>
	<p>UID: <code>{user.uid}</code></p>
	<button onclick={handleSignOut}>Log ud</button>
{:else}
	<p>Ikke logget ind</p>

	<label>
		Email
		<input type="email" bind:value={email} autocomplete="email" />
	</label>

	<label>
		Adgangskode
		<input type="password" bind:value={password} autocomplete="new-password" />
	</label>

	<button onclick={handleSignUp}>Opret bruger</button>
	<button onclick={handleSignIn}>Log ind</button>
{/if}

{#if message}
	<p><em>{message}</em></p>
{/if}

<style>
	h1 {
		font-size: 1.5rem;
		margin-bottom: 1rem;
	}

	label {
		display: block;
		margin-bottom: 0.75rem;
	}

	input {
		display: block;
		margin-top: 0.25rem;
		padding: 0.5rem;
		font-size: 1rem;
		min-width: 250px;
	}

	button {
		padding: 0.5rem 1rem;
		margin-right: 0.5rem;
		margin-top: 0.5rem;
		font-size: 1rem;
		cursor: pointer;
	}

	code {
		font-family: monospace;
		background: #f0f0f0;
		padding: 0.1rem 0.3rem;
		border-radius: 3px;
		font-size: 0.85rem;
	}
</style>
