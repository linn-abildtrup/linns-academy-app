<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import {
		DIET_LABELS,
		formatMaengde,
		KATEGORI_LABELS,
		skalerMaengde,
		type Opskrift
	} from '$lib/content/opskrifter';
	import { hentOpskrift } from '$lib/firestore/opskrifter';
	import Icon from '$lib/components/Icon.svelte';

	const opskriftId = $derived(page.params.id ?? '');

	let opskrift = $state<Opskrift | null>(null);
	let loading = $state(true);
	let fejl = $state<string | null>(null);
	let portioner = $state(0);

	onMount(async () => {
		try {
			const o = await hentOpskrift(opskriftId);
			if (!o) {
				fejl = 'Opskriften blev ikke fundet.';
				loading = false;
				return;
			}
			opskrift = o;
			portioner = o.defaultPortioner || 4;
		} catch (e) {
			console.error(e);
			fejl = 'Kunne ikke hente opskriften.';
		} finally {
			loading = false;
		}
	});

	function aendrePortioner(delta: number) {
		const ny = Math.max(1, Math.min(20, portioner + delta));
		portioner = ny;
	}
</script>

<div class="page">
	<header class="page-header">
		<a class="back" href="/app/moduler/30-30-3/opskrifter">
			<Icon name="arrow-l" size={14} color="var(--text2)" />
			<span>Opskrifter</span>
		</a>
	</header>

	{#if loading}
		<div class="status-besked">Henter opskrift...</div>
	{:else if fejl}
		<div class="status-besked fejl">{fejl}</div>
	{:else if opskrift}
		<div class="hero">
			{#if opskrift.billedeUrl}
				<img class="hero-img" src={opskrift.billedeUrl} alt={opskrift.titel} />
			{:else}
				<div class="hero-emoji">🍽️</div>
			{/if}
		</div>

		<h1>{opskrift.titel}</h1>
		{#if opskrift.kategorier.length > 0 || (opskrift.dietTags && opskrift.dietTags.length > 0)}
			<div class="kategorier">
				{#each opskrift.kategorier as k (k)}
					<span class="kategori-badge">{KATEGORI_LABELS[k]}</span>
				{/each}
				{#each opskrift.dietTags ?? [] as t (t)}
					<span class="kategori-badge diet">{DIET_LABELS[t]}</span>
				{/each}
			</div>
		{/if}
		{#if opskrift.beskrivelse}
			<p class="beskrivelse">{opskrift.beskrivelse}</p>
		{/if}

		{#if opskrift.ingredienser.length > 0}
			<section class="card">
				<div class="section-label">Ingredienser</div>
				<div class="portion-rad">
					<button
						class="portion-knap"
						type="button"
						onclick={() => aendrePortioner(-1)}
						disabled={portioner <= 1}
						aria-label="Færre portioner"
					>
						−
					</button>
					<div class="portion-num">{portioner}</div>
					<button
						class="portion-knap"
						type="button"
						onclick={() => aendrePortioner(1)}
						aria-label="Flere portioner"
					>
						+
					</button>
					<div class="portion-label">
						person{portioner === 1 ? '' : 'er'}
					</div>
				</div>

				<div class="ingredienser">
					{#each opskrift.ingredienser as ing (ing.navn)}
						{@const skala = skalerMaengde(ing.maengde, opskrift.defaultPortioner, portioner)}
						<div class="ing-row">
							<div class="ing-mængde">
								{formatMaengde(skala)}
								{ing.enhed}
							</div>
							<div class="ing-navn">{ing.navn}</div>
						</div>
					{/each}
				</div>
			</section>
		{/if}

		{#if opskrift.instruktioner.trim()}
			<section class="card">
				<div class="section-label">Fremgangsmåde</div>
				<div class="instruktioner">{opskrift.instruktioner}</div>
			</section>
		{/if}
	{/if}
</div>

<style>
	.page {
		padding: 18px 18px 100px;
		max-width: 520px;
		margin: 0 auto;
	}

	.page-header {
		margin-bottom: 12px;
	}

	.back {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-size: 12px;
		color: var(--text2);
		text-decoration: none;
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

	.hero {
		aspect-ratio: 16 / 10;
		background: var(--bg2);
		border-radius: 16px;
		overflow: hidden;
		display: flex;
		align-items: center;
		justify-content: center;
		margin-bottom: 14px;
	}

	.hero-img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.hero-emoji {
		font-size: 56px;
		opacity: 0.4;
	}

	h1 {
		font-family: var(--ff-d);
		font-size: 28px;
		font-weight: 600;
		letter-spacing: -0.02em;
		margin: 0 0 8px;
		line-height: 1.1;
		color: var(--text);
	}

	.kategorier {
		display: flex;
		gap: 6px;
		flex-wrap: wrap;
		margin-bottom: 10px;
	}

	.kategori-badge {
		font-size: 10.5px;
		letter-spacing: 0.06em;
		color: var(--terra);
		background: var(--tdim);
		padding: 3px 9px;
		border-radius: 99px;
		font-weight: 500;
	}

	.kategori-badge.diet {
		color: var(--sage);
		background: var(--sdim);
	}

	.beskrivelse {
		font-size: 13.5px;
		color: var(--text2);
		line-height: 1.55;
		margin: 0 0 16px;
	}

	.card {
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 14px;
		padding: 16px;
		margin-bottom: 14px;
	}

	.section-label {
		font-size: 10px;
		font-weight: 600;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: var(--text3);
		margin-bottom: 12px;
	}

	.portion-rad {
		display: flex;
		align-items: center;
		gap: 10px;
		margin-bottom: 14px;
	}

	.portion-knap {
		width: 32px;
		height: 32px;
		border-radius: 50%;
		background: var(--bg2);
		border: 1px solid var(--border);
		font-size: 18px;
		color: var(--text2);
		cursor: pointer;
		font-family: var(--ff-b);
	}

	.portion-knap:hover:not(:disabled) {
		background: var(--terra);
		color: #fff;
		border-color: var(--terra);
	}

	.portion-knap:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.portion-num {
		font-family: var(--ff-d);
		font-size: 22px;
		font-weight: 600;
		color: var(--text);
		min-width: 32px;
		text-align: center;
	}

	.portion-label {
		font-size: 13px;
		color: var(--text3);
	}

	.ingredienser {
		display: flex;
		flex-direction: column;
	}

	.ing-row {
		display: grid;
		grid-template-columns: 100px 1fr;
		gap: 12px;
		padding: 10px 0;
		border-top: 1px solid var(--border);
		font-size: 14px;
	}

	.ing-row:first-child {
		border-top: none;
	}

	.ing-mængde {
		color: var(--terra);
		font-weight: 600;
	}

	.ing-navn {
		color: var(--text);
	}

	.instruktioner {
		font-size: 14px;
		line-height: 1.6;
		color: var(--text);
		white-space: pre-wrap;
	}
</style>
