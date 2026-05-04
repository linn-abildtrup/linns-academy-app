<script lang="ts">
	import { getContext } from 'svelte';
	import { goto } from '$app/navigation';
	import { signOut } from 'firebase/auth';
	import { auth } from '$lib/firebase';
	import type { UserDoc } from '$lib/types';
	import type { User } from 'firebase/auth';
	import Button from '$lib/components/Button.svelte';

	const userDoc = getContext<() => UserDoc | null>('userDoc');
	const user = getContext<() => User | null>('user');

	const stateLabels: Record<string, string> = {
		modulbruger: 'Modulbruger',
		forlobskunde: 'Forløbskunde',
		udlobet: 'Udløbet adgang'
	};

	async function handleLogout() {
		await signOut(auth);
		await goto('/login');
	}
</script>

<div class="page">
	<div class="container">
		<header class="brand">
			<h1>Linn's Academy</h1>
			<p class="badge-text">App-område · beskyttet</p>
		</header>

		<div class="card">
			<p class="hello">Du er logget ind som</p>
			<p class="email">{user()?.email ?? '...'}</p>

			{#if userDoc()}
				<div class="state-row">
					<span class="state-label">Tilstand</span>
					<span class="state-value">{stateLabels[userDoc()!.state]}</span>
				</div>
				{#if userDoc()!.firstName}
					<div class="state-row">
						<span class="state-label">Fornavn</span>
						<span class="state-value">{userDoc()!.firstName}</span>
					</div>
				{/if}
			{/if}
		</div>

		<div class="actions">
			<Button variant="ghost" full onclick={handleLogout}>Log ud</Button>
		</div>
	</div>
</div>

<style>
	.page {
		min-height: 100vh;
		background: var(--bg);
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 40px 28px;
	}

	.container {
		width: 100%;
		max-width: 420px;
	}

	.brand {
		text-align: center;
		margin-bottom: 28px;
	}

	.brand h1 {
		font-family: var(--ff-d);
		font-size: 28px;
		font-weight: 700;
		color: var(--text);
		letter-spacing: -0.01em;
		margin: 0;
	}

	.badge-text {
		margin: 6px 0 0;
		font-family: var(--ff-b);
		font-size: 11px;
		font-weight: 600;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: var(--terra);
	}

	.card {
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: var(--rl);
		padding: var(--card-pad);
		text-align: center;
	}

	.hello {
		margin: 0 0 4px;
		font-family: var(--ff-b);
		font-size: 13px;
		color: var(--text3);
	}

	.email {
		margin: 0 0 20px;
		font-family: var(--ff-b);
		font-size: 16px;
		font-weight: 500;
		color: var(--text);
	}

	.state-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 10px 0;
		border-top: 1px solid var(--border);
		font-family: var(--ff-b);
		font-size: 14px;
	}

	.state-label {
		color: var(--text3);
	}

	.state-value {
		color: var(--text);
		font-weight: 500;
	}

	.actions {
		margin-top: 16px;
	}
</style>