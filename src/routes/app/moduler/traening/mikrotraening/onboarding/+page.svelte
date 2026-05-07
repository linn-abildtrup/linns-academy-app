<script lang="ts">
	import { getContext, onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import type { User } from 'firebase/auth';
	import {
		gemProgramValg,
		hentUserProduct
	} from '$lib/firestore/mikrotraening';
	import Icon from '$lib/components/Icon.svelte';

	type Valg = 'kettlebell' | 'no_kettlebell';

	const PROGRAM_ID: Record<Valg, string> = {
		kettlebell: 'mikrotraening_kettlebell',
		no_kettlebell: 'mikrotraening_no_kettlebell'
	};

	const getUser = getContext<() => User | null>('user');
	const user = $derived(getUser());

	let loading = $state(true);
	let fejl = $state<string | null>(null);
	let gemmer = $state<Valg | null>(null);

	onMount(async () => {
		const u = user;
		if (!u) {
			fejl = 'Du skal være logget ind.';
			loading = false;
			return;
		}
		try {
			const up = await hentUserProduct(u.uid, 'kickstart');
			if (!up) {
				fejl = 'Du har ikke adgang til mikrotræning endnu.';
				loading = false;
				return;
			}
			if (up.programValg?.mikrotraening) {
				goto('/app/moduler/traening/mikrotraening');
				return;
			}
		} catch (e) {
			console.error(e);
			fejl = 'Kunne ikke hente data. Prøv igen.';
		} finally {
			loading = false;
		}
	});

	async function vaelg(valg: Valg) {
		const u = user;
		if (!u || gemmer) return;
		gemmer = valg;
		fejl = null;
		try {
			await gemProgramValg(u.uid, 'kickstart', 'mikrotraening', PROGRAM_ID[valg]);
			goto('/app/moduler/traening/mikrotraening');
		} catch (e) {
			console.error(e);
			fejl = 'Kunne ikke gemme dit valg. Prøv igen.';
			gemmer = null;
		}
	}
</script>

<div class="page">
	<header class="page-header">
		<a class="back" href="/app/moduler/traening">
			<Icon name="arrow-l" size={14} color="var(--text2)" />
			<span>Træning</span>
		</a>
		<div class="emoji">🏋️</div>
		<h1>Inden vi starter</h1>
		<p class="page-sub">
			Vælg det program der passer til dit udstyr. Du kan altid ændre det senere i din profil.
		</p>
	</header>

	{#if loading}
		<div class="status-besked">Henter dine programvalg...</div>
	{:else if fejl}
		<div class="status-besked fejl">{fejl}</div>
	{:else}
		<div class="valg-liste">
			<button
				class="valg-knap"
				type="button"
				onclick={() => vaelg('kettlebell')}
				disabled={gemmer !== null}
			>
				<span class="valg-emoji">🔔</span>
				<span class="valg-titel">Ja, jeg har kettlebells</span>
				<span class="valg-sub">Program med kettlebell-øvelser</span>
				{#if gemmer === 'kettlebell'}
					<span class="valg-status">Gemmer...</span>
				{/if}
			</button>

			<button
				class="valg-knap"
				type="button"
				onclick={() => vaelg('no_kettlebell')}
				disabled={gemmer !== null}
			>
				<span class="valg-emoji">💪</span>
				<span class="valg-titel">Nej, jeg træner uden</span>
				<span class="valg-sub">Program uden udstyr</span>
				{#if gemmer === 'no_kettlebell'}
					<span class="valg-status">Gemmer...</span>
				{/if}
			</button>
		</div>
	{/if}
</div>

<style>
	.page {
		padding: 18px 18px 100px;
		max-width: 520px;
		margin: 0 auto;
	}

	.page-header {
		text-align: center;
		margin-bottom: 24px;
	}

	.back {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-size: 12px;
		color: var(--text2);
		text-decoration: none;
		margin-bottom: 22px;
		float: left;
	}

	.back:hover {
		color: var(--text);
	}

	.emoji {
		font-size: 56px;
		line-height: 1;
		margin-bottom: 14px;
	}

	h1 {
		font-family: var(--ff-d);
		font-size: 30px;
		font-weight: 600;
		letter-spacing: -0.02em;
		margin: 0;
		line-height: 1.05;
		color: var(--text);
	}

	.page-sub {
		font-size: 13px;
		color: var(--text2);
		margin: 10px auto 0;
		line-height: 1.5;
		max-width: 360px;
	}

	.status-besked {
		padding: 14px 16px;
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 12px;
		color: var(--text2);
		font-size: 13px;
		text-align: center;
	}

	.status-besked.fejl {
		color: #8a4a3e;
		background: #fbeeea;
		border-color: #f0d6cf;
	}

	.valg-liste {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.valg-knap {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6px;
		padding: 24px 18px;
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 16px;
		cursor: pointer;
		font-family: var(--ff-b);
		text-align: center;
		transition:
			border-color 0.15s ease,
			transform 0.1s ease;
	}

	.valg-knap:hover:not(:disabled) {
		border-color: var(--terra);
	}

	.valg-knap:active:not(:disabled) {
		transform: scale(0.98);
	}

	.valg-knap:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.valg-emoji {
		font-size: 28px;
		line-height: 1;
	}

	.valg-titel {
		font-size: 16px;
		font-weight: 600;
		color: var(--text);
	}

	.valg-sub {
		font-size: 12px;
		color: var(--text3);
	}

	.valg-status {
		font-size: 11px;
		color: var(--terra);
		margin-top: 4px;
		font-weight: 500;
	}
</style>
