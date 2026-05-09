<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import {
		DIET_LABELS,
		formatMaengde,
		KATEGORI_LABELS,
		skalerMaengde,
		type Opskrift
	} from '$lib/content/opskrifter';
	import { hentOpskrift } from '$lib/firestore/opskrifter';
	import { hentAlleFodevarer } from '$lib/firestore/kost';
	import {
		matchIngredienserMaltid,
		type Fodevare,
		type MaaltidsItem
	} from '$lib/content/kost';
	import Icon from '$lib/components/Icon.svelte';
	import Loading from '$lib/components/Loading.svelte';

	const STORAGE_KEY = 'la_30303_maaltid_v1';

	const opskriftId = $derived(page.params.id ?? '');

	let opskrift = $state<Opskrift | null>(null);
	let foods = $state<Fodevare[]>([]);
	let loading = $state(true);
	let fejl = $state<string | null>(null);
	let portioner = $state(0);

	let tilfoejer = $state(false);
	let tilfoejBesked = $state<{ tekst: string; type: 'ok' | 'advarsel' } | null>(null);

	onMount(async () => {
		try {
			const [o, allFoods] = await Promise.all([
				hentOpskrift(opskriftId),
				hentAlleFodevarer()
			]);
			if (!o) {
				fejl = 'Opskriften blev ikke fundet.';
				loading = false;
				return;
			}
			opskrift = o;
			foods = allFoods;
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

	async function tilfoejTilMaaltid() {
		if (!opskrift || tilfoejer) return;
		tilfoejer = true;
		tilfoejBesked = null;
		try {
			const skaleredeIngredienser = opskrift.ingredienser.map((ing) => ({
				...ing,
				maengde: skalerMaengde(ing.maengde, opskrift!.defaultPortioner, portioner)
			}));
			const { items, ikkeMatchede } = matchIngredienserMaltid(skaleredeIngredienser, foods);

			let nuvaerende: MaaltidsItem[] = [];
			try {
				const raw = localStorage.getItem(STORAGE_KEY);
				if (raw) {
					const parsed = JSON.parse(raw);
					if (Array.isArray(parsed)) nuvaerende = parsed;
				}
			} catch {
				// ignorer fejl ved læsning
			}
			const opdateret = [...nuvaerende, ...items];
			localStorage.setItem(STORAGE_KEY, JSON.stringify(opdateret));

			const matchede = items.length - ikkeMatchede.length;
			if (ikkeMatchede.length === 0) {
				tilfoejBesked = {
					tekst: `${items.length} ingredienser tilføjet til dit måltid.`,
					type: 'ok'
				};
			} else {
				tilfoejBesked = {
					tekst:
						`${items.length} ingredienser tilføjet (${matchede} med protein/fiber-beregning, ${ikkeMatchede.length} manuelle). ` +
						`Klik på de manuelle for at koble dem til en fødevare i databasen.`,
					type: 'advarsel'
				};
			}
			setTimeout(() => goto('/app/moduler/30-30-3?tab=maaltid'), 1500);
		} catch (e) {
			console.error(e);
			tilfoejBesked = { tekst: 'Kunne ikke tilføje til måltid. Prøv igen.', type: 'advarsel' };
			tilfoejer = false;
		}
	}
</script>

<div class="page">
	<header class="page-header">
		<a class="back" href="/app/moduler/30-30-3?tab=opskrifter">
			<Icon name="arrow-l" size={14} color="var(--text2)" />
			<span>Opskrifter</span>
		</a>
	</header>

	{#if loading}
		<Loading tekst="Henter opskrift..." />
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

		{#if opskrift.ingredienser.length > 0}
			{#if tilfoejBesked}
				<div class="tilfoej-besked {tilfoejBesked.type}">{tilfoejBesked.tekst}</div>
			{/if}
			<button
				class="primary-knap"
				type="button"
				onclick={tilfoejTilMaaltid}
				disabled={tilfoejer}
			>
				{tilfoejer ? 'Tilføjer...' : `+ Tilføj til byg-måltid (${portioner} portion${portioner === 1 ? '' : 'er'})`}
			</button>
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
		font-size: calc(12px * var(--fs-scale, 1));
		color: var(--text2);
		text-decoration: none;
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
		font-size: calc(56px * var(--fs-scale, 1));
		opacity: 0.4;
	}

	h1 {
		font-family: var(--ff-d);
		font-size: calc(28px * var(--fs-scale, 1));
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
		font-size: calc(10.5px * var(--fs-scale, 1));
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
		font-size: calc(13.5px * var(--fs-scale, 1));
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
		font-size: calc(10px * var(--fs-scale, 1));
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
		font-size: calc(18px * var(--fs-scale, 1));
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
		font-size: calc(22px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--text);
		min-width: 32px;
		text-align: center;
	}

	.portion-label {
		font-size: calc(13px * var(--fs-scale, 1));
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
		font-size: calc(14px * var(--fs-scale, 1));
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
		font-size: calc(14px * var(--fs-scale, 1));
		line-height: 1.6;
		color: var(--text);
		white-space: pre-wrap;
	}

	.primary-knap {
		display: block;
		width: 100%;
		padding: 14px;
		background: var(--terra);
		color: #fff;
		font-size: calc(14px * var(--fs-scale, 1));
		font-weight: 600;
		border-radius: 12px;
		border: none;
		cursor: pointer;
		font-family: var(--ff-b);
		margin-top: 8px;
	}

	.primary-knap:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.tilfoej-besked {
		padding: 12px 14px;
		border-radius: 10px;
		font-size: calc(12.5px * var(--fs-scale, 1));
		line-height: 1.5;
		margin-bottom: 10px;
	}

	.tilfoej-besked.ok {
		background: var(--sdim);
		color: var(--sage);
	}

	.tilfoej-besked.advarsel {
		background: #fdf3e7;
		color: #8a6a3c;
		border: 1px solid #ecd9b8;
	}
</style>
