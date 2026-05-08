<script lang="ts">
	import { getContext } from 'svelte';
	import type { User } from 'firebase/auth';
	import type { UserDoc } from '$lib/types';
	import Icon from '$lib/components/Icon.svelte';
	import { gemSpoergsmaal, SPOERGSMAAL_MAX_LAENGDE } from '$lib/firestore/spoergsmaal';

	const getUser = getContext<() => User | null>('user');
	const getUserDoc = getContext<() => UserDoc | null>('userDoc');
	const user = $derived(getUser());
	const userDoc = $derived(getUserDoc());

	let tekst = $state('');
	let gemmer = $state(false);
	let kvittering = $state(false);
	let fejl = $state<string | null>(null);

	const tegnAntal = $derived(tekst.length);
	const kanSende = $derived(tekst.trim().length > 0 && !gemmer && !!user);

	async function send() {
		if (!user || !kanSende) return;
		fejl = null;
		gemmer = true;
		try {
			const email = user.email ?? userDoc?.email ?? '';
			await gemSpoergsmaal(user.uid, email, tekst);
			tekst = '';
			kvittering = true;
		} catch (e) {
			console.error(e);
			fejl = 'Kunne ikke sende. Prøv igen om lidt.';
		} finally {
			gemmer = false;
		}
	}
</script>

<div class="page">
	<header class="page-header">
		<a class="back" href="/app">
			<Icon name="arrow-l" size={14} color="var(--text2)" />
			<span>Forsiden</span>
		</a>
		<div class="eyebrow">Stil et spørgsmål</div>
		<h1>Stil et <em>spørgsmål</em></h1>
	</header>

	<section class="card">
		<p class="intro">
			Skriv dit spørgsmål til Linn. Hun læser alle spørgsmål og bruger dem til at skabe videoer, live
			og kommende indhold. Du får ikke nødvendigvis et personligt svar, men du er med til at forme
			hvad der bliver lavet.
		</p>

		<label class="felt">
			<span class="felt-label">Dit spørgsmål</span>
			<textarea
				class="felt-input"
				placeholder="Skriv dit spørgsmål her..."
				maxlength={SPOERGSMAAL_MAX_LAENGDE}
				rows="7"
				bind:value={tekst}
				disabled={gemmer || kvittering}
			></textarea>
			<div class="felt-meta">
				<span>{tegnAntal} / {SPOERGSMAAL_MAX_LAENGDE} tegn</span>
			</div>
		</label>

		{#if fejl}
			<div class="status fejl">{fejl}</div>
		{/if}

		{#if kvittering}
			<div class="status ok">Tak — dit spørgsmål er modtaget.</div>
		{/if}

		<button type="button" class="primary-knap" onclick={send} disabled={!kanSende}>
			{gemmer ? 'Sender...' : 'Send spørgsmål'}
		</button>

		{#if kvittering}
			<button
				type="button"
				class="ghost-knap"
				onclick={() => {
					kvittering = false;
				}}
			>
				Stil et nyt spørgsmål
			</button>
		{/if}
	</section>
</div>

<style>
	.page {
		padding: 18px 18px 100px;
		max-width: 520px;
		margin: 0 auto;
	}

	.page-header {
		margin-bottom: 14px;
	}

	.back {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-size: 12px;
		color: var(--text2);
		text-decoration: none;
		margin-bottom: 12px;
	}

	.eyebrow {
		font-size: 10px;
		font-weight: 600;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--text3);
	}

	h1 {
		font-family: var(--ff-d);
		font-size: 26px;
		font-weight: 600;
		letter-spacing: -0.02em;
		margin: 4px 0 0;
		line-height: 1.05;
		color: var(--text);
	}

	h1 em {
		font-style: italic;
		color: var(--terra);
		font-weight: 400;
	}

	.card {
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 14px;
		padding: 16px 18px;
		display: flex;
		flex-direction: column;
		gap: 14px;
	}

	.intro {
		font-size: 13px;
		color: var(--text2);
		margin: 0;
		line-height: 1.55;
	}

	.felt {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.felt-label {
		font-size: 12px;
		font-weight: 500;
		color: var(--text2);
	}

	.felt-input {
		font-family: var(--ff-b);
		font-size: 15px;
		line-height: 1.5;
		padding: 12px 14px;
		border-radius: 10px;
		background: var(--bg2);
		border: 1px solid var(--border);
		color: var(--text);
		outline: none;
		resize: vertical;
		min-height: 140px;
	}

	.felt-input:focus {
		border-color: var(--terra);
	}

	.felt-meta {
		display: flex;
		justify-content: space-between;
		font-size: 11px;
		color: var(--text3);
	}

	.status {
		padding: 10px 14px;
		border-radius: 10px;
		font-size: 13px;
		text-align: center;
	}

	.status.ok {
		background: rgba(143, 168, 144, 0.18);
		border: 1px solid rgba(143, 168, 144, 0.4);
		color: var(--text);
	}

	.status.fejl {
		background: #fbeeea;
		border: 1px solid #f0d6cf;
		color: #8a4a3e;
	}

	.primary-knap {
		background: var(--terra);
		color: var(--white);
		border: none;
		padding: 14px;
		border-radius: 10px;
		font-family: inherit;
		font-size: 14px;
		font-weight: 600;
		cursor: pointer;
	}

	.primary-knap:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}

	.ghost-knap {
		background: transparent;
		color: var(--text2);
		border: 1px solid var(--border);
		padding: 12px;
		border-radius: 10px;
		font-family: inherit;
		font-size: 13px;
		font-weight: 500;
		cursor: pointer;
	}
</style>
