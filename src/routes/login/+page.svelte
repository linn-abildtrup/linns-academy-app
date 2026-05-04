<script lang="ts">
	import { goto } from '$app/navigation';
	import {
		createUserWithEmailAndPassword,
		signInWithEmailAndPassword,
		signOut,
		onAuthStateChanged,
		type User
	} from 'firebase/auth';
	import { auth } from '$lib/firebase';
	import Button from '$lib/components/Button.svelte';

	let mode = $state<'login' | 'signup'>('login');
	let email = $state('');
	let password = $state('');
	let error = $state('');
	let loading = $state(false);
	let user = $state<User | null>(null);

	onAuthStateChanged(auth, (u) => {
		user = u;
	});

	async function handleSubmit() {
		error = '';
		loading = true;
		try {
			if (mode === 'login') {
				await signInWithEmailAndPassword(auth, email, password);
			} else {
				await createUserWithEmailAndPassword(auth, email, password);
			}
			await goto('/');
		} catch (e) {
			error = e instanceof Error ? e.message : 'Noget gik galt';
		} finally {
			loading = false;
		}
	}

	async function handleLogout() {
		await signOut(auth);
		email = '';
		password = '';
	}
</script>

<div class="page">
	<div class="container">
		<header class="brand">
			<h1>Linn's Academy</h1>
		</header>

		{#if user}
			<div class="logged-in">
				<p class="hello">Du er logget ind som</p>
				<p class="email">{user.email}</p>
				<div class="actions">
					<Button variant="primary" full onclick={() => goto('/')}>
						Gå til forsiden
					</Button>
					<Button variant="ghost" full onclick={handleLogout}>
						Log ud
					</Button>
				</div>
			</div>
		{:else}
			<div class="tabs">
				<button
					class="tab"
					class:active={mode === 'login'}
					onclick={() => {
						mode = 'login';
						error = '';
					}}
				>
					Log ind
				</button>
				<button
					class="tab"
					class:active={mode === 'signup'}
					onclick={() => {
						mode = 'signup';
						error = '';
					}}
				>
					Opret konto
				</button>
			</div>

			<div class="form">
				<label class="field">
					<span class="label">Email</span>
					<input
						type="email"
						bind:value={email}
						placeholder="dig@eksempel.dk"
						autocomplete="email"
					/>
				</label>

				<label class="field">
					<span class="label">Adgangskode</span>
					<input
						type="password"
						bind:value={password}
						placeholder="Mindst 6 tegn"
						autocomplete={mode === 'login' ? 'current-password' : 'new-password'}
					/>
				</label>

				{#if error}
					<p class="error">{error}</p>
				{/if}

				<Button
					variant="primary"
					size="lg"
					full
					onclick={handleSubmit}
				>
					{loading ? 'Vent...' : mode === 'login' ? 'Log ind' : 'Opret konto'}
				</Button>
			</div>
		{/if}
	</div>
</div>

<style>
	.page {
		min-height: 100vh;
		background: var(--bg);
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 24px 16px;
	}

	.container {
		width: 100%;
		max-width: 420px;
	}

	.brand {
		text-align: center;
		margin-bottom: 32px;
	}

	.brand h1 {
		font-family: var(--ff-d);
		font-size: 36px;
		font-weight: 600;
		color: var(--text);
		margin: 0;
		letter-spacing: -0.01em;
	}

	.tabs {
		display: flex;
		gap: 4px;
		background: var(--bg2);
		padding: 4px;
		border-radius: var(--r);
		margin-bottom: 20px;
	}

	.tab {
		flex: 1;
		padding: 10px 16px;
		border: none;
		background: transparent;
		font-family: var(--ff-b);
		font-size: 15px;
		font-weight: 500;
		color: var(--text3);
		border-radius: calc(var(--r) - 4px);
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.tab:hover {
		color: var(--text);
	}

	.tab.active {
		background: var(--white);
		color: var(--text);
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
	}

	.form {
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: var(--rl);
		padding: var(--card-pad);
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.label {
		font-family: var(--ff-b);
		font-size: 13px;
		font-weight: 500;
		color: var(--text2);
	}

	.field input {
		width: 100%;
		padding: 12px 14px;
		border: 1px solid var(--border);
		border-radius: var(--r);
		background: var(--bg);
		font-family: var(--ff-b);
		font-size: 15px;
		color: var(--text);
		transition: border-color 0.15s ease;
		box-sizing: border-box;
	}

	.field input:focus {
		outline: none;
		border-color: var(--terra);
	}

	.field input::placeholder {
		color: var(--text4);
	}

	.error {
		margin: 0;
		padding: 10px 12px;
		background: var(--ic-rose);
		color: var(--text);
		border-radius: var(--r);
		font-family: var(--ff-b);
		font-size: 13px;
	}

	.logged-in {
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: var(--rl);
		padding: var(--card-pad);
		text-align: center;
	}

	.hello {
		margin: 0 0 4px;
		font-family: var(--ff-b);
		font-size: 14px;
		color: var(--text3);
	}

	.email {
		margin: 0 0 20px;
		font-family: var(--ff-b);
		font-size: 16px;
		font-weight: 500;
		color: var(--text);
	}

	.actions {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
</style>