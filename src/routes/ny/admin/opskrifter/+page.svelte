<script lang="ts">
	// ============================================================
	// Opskrift-listen, i det nye design.
	//
	// Syttende af de 19 gamle admin-sider, 1. september 2026.
	//
	// LISTEN OG REDIGERINGS-SIDEN FOELGES AD. Begge er lavet om, saa der
	// springes ikke mellem to udseender midt i en opgave.
	//
	// Filtrering, soegning og godkend-fluebenet blev bygget til den GAMLE
	// side tidligere samme dag. Alt det er flyttet med.
	//
	// FILTRERINGEN ER KUNDENS EGEN, altsaa filtrerOpskrifter fra
	// content/opskrifter. To steder der filtrerer hver sin vej ville betyde
	// at admin viste noget andet end kunden.
	//
	// GODKENDT ER IKKE DET SAMME SOM AKTIV. 'aktiv' styrer om kunden kan se
	// opskriften. 'godkendt' er Linns eget flueben paa at hun har set den
	// igennem, og det maa ALDRIG blive en port for hvad kunden ser.
	//
	// Den gamle side paa /app/admin/opskrifter er uroert.
	// ============================================================

	import { getContext, onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import type { User } from 'firebase/auth';
	import { isAdmin } from '$lib/admin';
	import {
		ALLE_KATEGORIER,
		KATEGORI_LABELS,
		filtrerOpskrifter,
		type Opskrift,
		type OpskriftKategori
	} from '$lib/content/opskrifter';
	import { gemOpskrift, hentAlleOpskrifter, saetOpskriftGodkendt } from '$lib/firestore/opskrifter';
	import AdmSide from '$lib/components/admin/AdmSide.svelte';
	import AdmKnap from '$lib/components/admin/AdmKnap.svelte';
	import AdmMaerkat from '$lib/components/admin/AdmMaerkat.svelte';
	import AdmSoeg from '$lib/components/admin/AdmSoeg.svelte';
	import AdmTom from '$lib/components/admin/AdmTom.svelte';

	const hentUser = getContext<() => User | null>('user');
	const maaVaereHer = $derived(isAdmin(hentUser()));

	let opskrifter = $state<Opskrift[]>([]);
	let henter = $state(true);
	let fejl = $state('');
	let opretter = $state(false);

	let soeg = $state('');
	let kategorier = $state<OpskriftKategori[]>([]);
	let kunUgodkendte = $state(false);
	let gemmerGodkendt = $state('');

	onMount(() => void indlaes());

	async function indlaes() {
		henter = true;
		fejl = '';
		try {
			opskrifter = await hentAlleOpskrifter(false);
		} catch (e) {
			console.error('[admin] opskrifter', e);
			fejl = 'Kunne ikke hente opskrifterne.';
		} finally {
			henter = false;
		}
	}

	const listen = $derived.by(() => {
		const l = filtrerOpskrifter(opskrifter, soeg, kategorier);
		return kunUgodkendte ? l.filter((o) => !o.godkendt) : l;
	});

	const antalGodkendte = $derived(opskrifter.filter((o) => o.godkendt).length);
	const udenKategori = $derived(opskrifter.filter((o) => o.kategorier.length === 0).length);

	function toggleKategori(k: OpskriftKategori) {
		kategorier = kategorier.includes(k) ? kategorier.filter((x) => x !== k) : [...kategorier, k];
	}

	async function toggleGodkendt(o: Opskrift) {
		if (gemmerGodkendt) return;
		gemmerGodkendt = o.id;
		fejl = '';
		const ny = !o.godkendt;
		try {
			await saetOpskriftGodkendt(o.id, ny);
			// Rettes paa stedet. En hel genindlaesning ville rykke listen under
			// fingeren midt i en gennemgang af 133 opskrifter.
			opskrifter = opskrifter.map((x) => (x.id === o.id ? { ...x, godkendt: ny } : x));
		} catch (e) {
			console.error('[admin] godkend', e);
			fejl = 'Kunne ikke gemme godkendelsen.';
		} finally {
			gemmerGodkendt = '';
		}
	}

	async function opretNy() {
		if (opretter) return;
		opretter = true;
		try {
			const id = `opskrift_${Date.now().toString(36)}`;
			await gemOpskrift({
				id,
				titel: 'Ny opskrift',
				beskrivelse: '',
				billedeUrl: null,
				kategorier: [],
				dietTags: [],
				// ÉN portion og ikke fire. 122 af de 133 er skrevet til én
				// person. Feltet siger hvor mange portioner INGREDIENSLISTEN
				// raekker til, og stod der 4 paa en ret skrevet til én, ville
				// kunden se en fjerdedel af hver maengde. Se SPEC 26.9.
				defaultPortioner: 1,
				ingredienser: [],
				instruktioner: '',
				aktiv: false
			});
			goto(`/ny/admin/opskrifter/${id}`);
		} catch (e) {
			console.error('[admin] opret opskrift', e);
			fejl = 'Kunne ikke oprette opskriften.';
			opretter = false;
		}
	}
</script>

<svelte:head><title>Opskrifter · Admin</title></svelte:head>

{#if !maaVaereHer}
	<p class="op-kun">Siden er kun for admin.</p>
{:else}
	<AdmSide
		titel="Opskrifter"
		under="Alle opskrifter kunderne kan se i Mad. Sæt et flueben når du har set en igennem."
		bred
	>
		{#snippet handling()}
			<AdmKnap slags="primaer" disabled={opretter} onclick={opretNy}>
				{opretter ? 'Opretter…' : 'Ny opskrift'}
			</AdmKnap>
		{/snippet}

		{#if fejl}<div class="op-fejl">{fejl}</div>{/if}

		<AdmSoeg bind:vaerdi={soeg} placeholder="Søg efter navn eller ingrediens…" />

		<div class="op-filtre">
			{#each ALLE_KATEGORIER as k (k)}
				<button
					type="button"
					class="op-chip"
					class:paa={kategorier.includes(k)}
					onclick={() => toggleKategori(k)}>{KATEGORI_LABELS[k]}</button
				>
			{/each}
			<span class="op-skel"></span>
			<button
				type="button"
				class="op-chip"
				class:paa={kunUgodkendte}
				onclick={() => (kunUgodkendte = !kunUgodkendte)}>Mangler godkendelse</button
			>
		</div>

		<p class="op-antal">
			{#if listen.length === opskrifter.length}
				{opskrifter.length} opskrifter
			{:else}
				{listen.length} af {opskrifter.length} opskrifter
			{/if}
			· {antalGodkendte} godkendt
			{#if udenKategori > 0}· {udenKategori} uden madtype{/if}
		</p>

		{#if udenKategori > 0 && kategorier.length > 0}
			<!-- En opskrift uden madtype falder ud af ethvert filter. Uden den
			     her linje ser det ud som om den er forsvundet. -->
			<p class="op-note">
				{udenKategori}
				{udenKategori === 1 ? 'opskrift har' : 'opskrifter har'} ingen madtype og vises derfor ikke så
				længe du filtrerer.
			</p>
		{/if}

		{#if henter}
			<AdmTom tekst="Henter opskrifterne…" />
		{:else if fejl && opskrifter.length === 0}
			<AdmTom tekst={fejl} fejl>
				{#snippet handling()}
					<AdmKnap onclick={indlaes}>Prøv igen</AdmKnap>
				{/snippet}
			</AdmTom>
		{:else if opskrifter.length === 0}
			<AdmTom tekst="Der er ingen opskrifter endnu. Tryk Ny opskrift for at lave den første." />
		{:else if listen.length === 0}
			<AdmTom tekst="Ingen opskrifter matcher det du har valgt." />
		{:else}
			<div class="op-liste">
				{#each listen as o (o.id)}
					<div class="op-raekke" class:godkendt={o.godkendt}>
						<!-- Godkend-knappen ligger UDEN FOR linket. En knap inde i et
						     link kan ikke trykkes uden ogsaa at aabne opskriften. -->
						<button
							type="button"
							class="op-godkend"
							class:sat={o.godkendt}
							disabled={gemmerGodkendt === o.id}
							title={o.godkendt ? 'Godkendt. Tryk for at fjerne' : 'Marker som godkendt'}
							aria-label={o.godkendt ? `Fjern godkendelsen af ${o.titel}` : `Godkend ${o.titel}`}
							aria-pressed={o.godkendt ? 'true' : 'false'}
							onclick={() => toggleGodkendt(o)}
						>
							✓
						</button>

						<a class="op-link" href="/ny/admin/opskrifter/{o.id}">
							<div class="op-billede">
								{#if o.billedeUrl}
									<img src={o.billedeUrl} alt={o.titel} />
								{:else}
									<span class="op-bogstav">{o.titel.slice(0, 1).toUpperCase()}</span>
								{/if}
							</div>
							<div class="op-tekst">
								<div class="op-navn">
									{o.titel}
									{#if !o.aktiv}<AdmMaerkat farve="stille">Skjult for kunderne</AdmMaerkat>{/if}
								</div>
								<div class="op-meta">
									{o.kategorier.map((k) => KATEGORI_LABELS[k]).join(', ') || 'Ingen madtype'}
									· {o.ingredienser.length}
									{o.ingredienser.length === 1 ? 'ingrediens' : 'ingredienser'}
									{#if o.defaultPortioner > 1}· skrevet til {o.defaultPortioner} portioner{/if}
								</div>
							</div>
							<span class="op-pil">›</span>
						</a>
					</div>
				{/each}
			</div>
		{/if}
	</AdmSide>
{/if}

<style>
	.op-kun {
		padding: 24px 18px;
		color: var(--ink-2);
		font-size: calc(14px * var(--fs-scale, 1) * var(--adm-skala, 1));
	}

	.op-fejl {
		margin-bottom: 12px;
		padding: 11px 15px;
		border-radius: 12px;
		background: var(--ler-tint, #f4e6de);
		color: var(--ler-tekst, #8a5439);
		font-size: calc(13.5px * var(--fs-scale, 1) * var(--adm-skala, 1));
		font-weight: 600;
	}

	.op-filtre {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 6px;
		margin: 10px 0;
	}

	.op-skel {
		width: 1px;
		height: 20px;
		background: var(--line, #e8dfd1);
		margin: 0 4px;
	}

	/* Baggrunden staar eksplicit, se noten i AdmKnap. */
	.op-chip {
		padding: 8px 14px;
		background: var(--paper-2, #f6f0e7);
		border: 1px solid var(--line, #e8dfd1);
		border-radius: 99px;
		color: var(--ink-2, #6f5f57);
		font-size: calc(12.5px * var(--fs-scale, 1) * var(--adm-skala, 1));
		font-family: inherit;
		font-weight: 600;
		cursor: pointer;
	}

	.op-chip.paa {
		background: var(--plum, #7c4f63);
		border-color: var(--plum, #7c4f63);
		color: #fff;
	}

	.op-antal {
		margin: 0 0 8px;
		font-size: calc(12px * var(--fs-scale, 1) * var(--adm-skala, 1));
		color: var(--ink-3, #a3948a);
	}

	.op-note {
		margin: 0 0 12px;
		padding: 10px 14px;
		background: var(--honey-tint, #f7ecd7);
		border-radius: 11px;
		color: var(--honey-deep, #b47f3e);
		font-size: calc(12px * var(--fs-scale, 1) * var(--adm-skala, 1));
		line-height: 1.45;
	}

	/* FLERE SOEJLER NAAR DER ER PLADS. 130 opskrifter i én lang stribe
	   paa en bred skaerm betoed, at man saa fem ad gangen og resten var
	   tom plads til hoejre. Nu falder de i saa mange soejler der er
	   plads til, og paa en smal skaerm bliver det én igen af sig selv. */
	.op-liste {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(330px, 1fr));
		gap: 5px 10px;
		align-content: start;
	}

	.op-raekke {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 9px 12px;
		background: var(--paper-2, #f6f0e7);
		border-radius: 13px;
	}

	/* Groen kant i venstre side paa de godkendte, saa det kan ses ved at
	   skimme og ikke kun ved at kigge paa hvert flueben. */
	.op-raekke.godkendt {
		border-left: 3px solid var(--sage, #86a188);
		padding-left: 9px;
	}

	.op-godkend {
		width: 30px;
		height: 30px;
		flex-shrink: 0;
		display: grid;
		place-items: center;
		padding: 0;
		background: var(--paper, #fbf8f2);
		border: 1px solid var(--line, #e8dfd1);
		border-radius: 9px;
		color: var(--ink-3, #a3948a);
		font-size: calc(14px * var(--fs-scale, 1) * var(--adm-skala, 1));
		line-height: 1;
		cursor: pointer;
	}

	.op-godkend.sat {
		background: var(--sage-tint, #e7efe5);
		border-color: var(--sage, #86a188);
		color: var(--sage-tekst, #46603f);
	}

	.op-godkend:disabled {
		opacity: 0.5;
		cursor: wait;
	}

	.op-link {
		display: flex;
		align-items: center;
		gap: 11px;
		flex: 1;
		min-width: 0;
		text-decoration: none;
		color: inherit;
	}

	.op-billede {
		width: 46px;
		height: 46px;
		flex-shrink: 0;
		display: grid;
		place-items: center;
		background: var(--plum-tint, #f1e5e8);
		border-radius: 10px;
		overflow: hidden;
	}

	.op-billede img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.op-bogstav {
		font-size: calc(19px * var(--fs-scale, 1) * var(--adm-skala, 1));
		font-weight: 600;
		color: var(--plum, #7c4f63);
	}

	.op-tekst {
		flex: 1;
		min-width: 0;
	}

	.op-navn {
		display: flex;
		align-items: center;
		gap: 8px;
		flex-wrap: wrap;
		font-size: calc(14px * var(--fs-scale, 1) * var(--adm-skala, 1));
		font-weight: 600;
	}

	.op-meta {
		margin-top: 2px;
		font-size: calc(11.5px * var(--fs-scale, 1) * var(--adm-skala, 1));
		color: var(--ink-3, #a3948a);
	}

	.op-pil {
		flex-shrink: 0;
		color: var(--ink-3, #a3948a);
	}
</style>
