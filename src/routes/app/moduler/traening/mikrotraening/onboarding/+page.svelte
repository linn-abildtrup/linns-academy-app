<script lang="ts">
	import { getContext, onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import type { User } from 'firebase/auth';
	import type { UserDoc } from '$lib/types';
	import type { TrainingProgram, UserProduct } from '$lib/content/mikrotraening';
	import {
		gemProgramValg,
		hentForlobsProgrammer,
		hentUserProduct
	} from '$lib/firestore/mikrotraening';
	import { hentAktivProduktType } from '$lib/firestore/forlob';
	import Icon, { type IconName } from '$lib/components/Icon.svelte';
	import Loading from '$lib/components/Loading.svelte';

	const getUser = getContext<() => User | null>('user');
	const getUserDoc = getContext<() => UserDoc | null>('userDoc');
	const user = $derived(getUser());
	const userDoc = $derived(getUserDoc());

	let programmer = $state<TrainingProgram[]>([]);
	let loading = $state(true);
	let fejl = $state<string | null>(null);
	let gemmer = $state<string | null>(null);
	let produktType = $state<'kickstart' | 'premiumforløb'>('kickstart');

	function ikonForUdstyr(udstyr: string[]): IconName {
		if (udstyr.includes('kettlebell')) return 'kettlebell';
		if (udstyr.includes('haandvaegte')) return 'kettlebell';
		return 'stretch';
	}

	onMount(async () => {
		const u = user;
		if (!u) {
			fejl = 'Du skal være logget ind.';
			loading = false;
			return;
		}
		try {
			produktType = await hentAktivProduktType(userDoc?.forlobIds ?? []);
			const up = await hentUserProduct(u.uid, produktType);
			if (!up) {
				fejl = 'Du har ikke adgang til mikrotræning endnu.';
				loading = false;
				return;
			}
			if (up.programValg?.mikrotraening) {
				goto('/app/moduler/traening/mikrotraening');
				return;
			}

			const forlobId = (up as UserProduct & { forlobId?: string }).forlobId;
			if (!forlobId) {
				fejl = 'Du er ikke tilknyttet et forløb endnu. Kontakt Linn.';
				loading = false;
				return;
			}

			const alle = await hentForlobsProgrammer(forlobId);
			programmer = alle.filter((p) => p.aktiv);
			if (programmer.length === 0) {
				fejl = 'Der er ikke lagt nogen mikrotræningsprogrammer op for dit forløb endnu.';
			}
		} catch (e) {
			console.error(e);
			fejl = 'Kunne ikke hente data. Prøv igen.';
		} finally {
			loading = false;
		}
	});

	async function vaelg(programId: string) {
		const u = user;
		if (!u || gemmer) return;
		gemmer = programId;
		fejl = null;
		try {
			await gemProgramValg(u.uid, produktType, 'mikrotraening', programId);
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
		<div class="header-ikon">
			<Icon name="lightning" size={32} color="var(--terra)" />
		</div>
		<h1>Inden vi starter</h1>
		<p class="page-sub">
			Vælg det program der passer til dit udstyr. Du kan altid ændre det senere i din profil.
		</p>
	</header>

	{#if loading}
		<Loading tekst="Henter dine programvalg..." />
	{:else if fejl}
		<div class="status-besked fejl">{fejl}</div>
	{:else}
		<div class="valg-liste">
			{#each programmer as p (p.id)}
				<button
					class="valg-knap"
					type="button"
					onclick={() => vaelg(p.id)}
					disabled={gemmer !== null}
				>
					<span class="valg-ikon">
						<Icon name={ikonForUdstyr(p.udstyr)} size={26} color="var(--terra)" />
					</span>
					<span class="valg-titel">{p.navn}</span>
					{#if p.beskrivelse}
						<span class="valg-sub">{p.beskrivelse}</span>
					{/if}
					{#if gemmer === p.id}
						<span class="valg-status">Gemmer...</span>
					{/if}
				</button>
			{/each}
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
		font-size: calc(12px * var(--fs-scale, 1));
		color: var(--text2);
		text-decoration: none;
		margin-bottom: 22px;
		float: left;
	}

	.back:hover {
		color: var(--text);
	}

	.header-ikon {
		width: 64px;
		height: 64px;
		border-radius: 50%;
		background: var(--bg2);
		display: flex;
		align-items: center;
		justify-content: center;
		margin: 0 auto 14px;
	}

	h1 {
		font-family: var(--ff-d);
		font-size: calc(30px * var(--fs-scale, 1));
		font-weight: 600;
		letter-spacing: -0.02em;
		margin: 0;
		line-height: 1.05;
		color: var(--text);
	}

	.page-sub {
		font-size: calc(13px * var(--fs-scale, 1));
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
		font-size: calc(13px * var(--fs-scale, 1));
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

	.valg-ikon {
		width: 48px;
		height: 48px;
		border-radius: 50%;
		background: var(--bg2);
		display: flex;
		align-items: center;
		justify-content: center;
		margin-bottom: 4px;
	}

	.valg-titel {
		font-size: calc(16px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--text);
	}

	.valg-sub {
		font-size: calc(12px * var(--fs-scale, 1));
		color: var(--text3);
	}

	.valg-status {
		font-size: calc(11px * var(--fs-scale, 1));
		color: var(--terra);
		margin-top: 4px;
		font-weight: 500;
	}
</style>
