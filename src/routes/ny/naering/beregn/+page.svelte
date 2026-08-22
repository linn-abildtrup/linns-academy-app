<script lang="ts">
	// ============================================================
	// "Beregn mine maal": fem spoergsmaal paa ÉN side.
	//
	// Den gamle guide er seks skaerme i traek med en knap mellem hver.
	// Linns valg 22. august: alt paa én side, saa hun kan rette et svar
	// uden at gaa tilbage, og resultatet regner sig om mens hun svarer.
	//
	// REGNESTYKKET ER DET SAMME som den gamle apps, se content/naering.ts.
	// Vi laver ikke vores eget: to steder der regner protein forskelligt
	// er vaerre end ingen beregner.
	//
	// DET ER ET UDGANGSPUNKT, ikke en ordre. Hun kan rette bagefter, og
	// det staar paa skaermen.
	//
	// HUN SER KUN DE TAL HUN HAR SLAAET TIL. Har hun ikke udvidet
	// naering, staar der protein og fiber og intet andet. De tre andre
	// bliver GEMT alligevel, saa de staar klar den dag hun slaar dem til,
	// men et kalorietal skal ikke dukke op paa en skaerm hun ikke har
	// bedt om. Linns rettelse 22. august.
	// ============================================================

	import { getContext } from 'svelte';
	import { goto } from '$app/navigation';
	import type { User } from 'firebase/auth';
	import type { Aktivitetsniveau, BrugerProfil, MenopausalStatus, UserDoc } from '$lib/types';
	import {
		AKTIVITETS_BESKRIVELSER,
		AKTIVITETS_LABELS,
		MENOPAUS_BESKRIVELSER,
		MENOPAUS_LABELS,
		NAERING_ENHEDER,
		NAERING_LABELS,
		beregnDagligeMaal
	} from '$lib/content/naering';
	import { gemBeregnedeMaal3 } from '$lib/firestore/naeringMaal3';
	import Sidehoved from '$lib/components/ny/Sidehoved.svelte';

	const hentUser = getContext<() => User | null>('user');
	const hentUserDoc = getContext<() => UserDoc | null>('userDoc');
	const user = $derived(hentUser());
	const userDoc = $derived(hentUserDoc());

	const AKTIVITETER: Aktivitetsniveau[] = ['stille', 'let', 'moderat', 'meget'];
	const MENOPAUS: MenopausalStatus[] = ['praemenopause', 'perimenopause', 'postmenopause'];
	const SMAA = ['protein', 'fiber'] as const;
	const ALLE = ['protein', 'fiber', 'kh', 'fedt', 'kcal'] as const;

	// Startvaerdier. Har hun svaret foer, staar hendes egne svar.
	let hojde = $state(165);
	let vaegt = $state(70);
	let alder = $state(50);
	let aktivitet = $state<Aktivitetsniveau>('let');
	let menopaus = $state<MenopausalStatus>('perimenopause');
	let hentet = $state(false);
	let gemmer = $state(false);
	let fejl = $state('');

	$effect(() => {
		const p = userDoc?.brugerProfil;
		if (!p || hentet) return;
		hojde = p.hojde;
		vaegt = p.vaegt;
		alder = p.alder;
		aktivitet = p.aktivitet;
		menopaus = p.menopaus;
		hentet = true;
	});

	// Kun det hun selv har slaaet til. Se noten i toppen.
	const viste = $derived(userDoc?.visUdvidetNaering ? ALLE : SMAA);

	const profil = $derived<BrugerProfil>({ hojde, vaegt, alder, aktivitet, menopaus });
	const gyldig = $derived(
		hojde >= 100 && hojde <= 220 && vaegt >= 30 && vaegt <= 200 && alder >= 18 && alder <= 100
	);
	const forslag = $derived(gyldig ? beregnDagligeMaal(profil) : null);

	async function brug() {
		const uid = user?.uid;
		if (!uid || !forslag || gemmer) return;
		gemmer = true;
		fejl = '';
		try {
			await gemBeregnedeMaal3(uid, profil, forslag);
			await goto('/ny/naering');
		} catch (e) {
			console.error('[ny] kunne ikke gemme de beregnede maal', e);
			fejl = 'Kunne ikke gemme. Prøv igen.';
			gemmer = false;
		}
	}

	function tal(e: Event): number {
		return Number((e.target as HTMLInputElement).value.replace(',', '.'));
	}
</script>

<div class="ny-pad naering-side">
	<Sidehoved
		titel="Beregn mine mål"
		tilbage="/ny/naering"
		tilbageTekst="Dine mål"
		under="Et udgangspunkt. Du kan altid rette bagefter."
		kant={false}
	/>

	<section class="kort">
		<div class="nb-sp">
			<div class="nb-q">Hvor høj er du?</div>
			<label class="nb-tal">
				<input type="number" inputmode="numeric" min="100" max="220" value={hojde} oninput={(e) => (hojde = tal(e))} />
				<span>cm</span>
			</label>
		</div>

		<div class="nb-sp">
			<div class="nb-q">Hvad vejer du?</div>
			<label class="nb-tal">
				<input type="number" inputmode="numeric" min="30" max="200" value={vaegt} oninput={(e) => (vaegt = tal(e))} />
				<span>kg</span>
			</label>
		</div>

		<div class="nb-sp">
			<div class="nb-q">Hvor gammel er du?</div>
			<label class="nb-tal">
				<input type="number" inputmode="numeric" min="18" max="100" value={alder} oninput={(e) => (alder = tal(e))} />
				<span>år</span>
			</label>
		</div>

		<div class="nb-sp">
			<div class="nb-q">Hvor aktiv er din hverdag?</div>
			<div class="nb-chips">
				{#each AKTIVITETER as a (a)}
					<button class="nb-chip" class:valgt={aktivitet === a} onclick={() => (aktivitet = a)}>
						<span>{AKTIVITETS_LABELS[a]}</span>
						<em>{AKTIVITETS_BESKRIVELSER[a]}</em>
					</button>
				{/each}
			</div>
		</div>

		<div class="nb-sp">
			<div class="nb-q">Hvor er du i overgangsalderen?</div>
			<div class="nb-chips">
				{#each MENOPAUS as m (m)}
					<button class="nb-chip" class:valgt={menopaus === m} onclick={() => (menopaus = m)}>
						<span>{MENOPAUS_LABELS[m]}</span>
						<em>{MENOPAUS_BESKRIVELSER[m]}</em>
					</button>
				{/each}
			</div>
		</div>
	</section>

	{#if forslag}
		<section class="nb-resultat">
			<div class="nb-r-t">Så foreslår jeg</div>
			{#each viste as f (f)}
				<div class="nb-r-r">
					<span>{NAERING_LABELS[f]}</span>
					<b>{forslag[f]} {NAERING_ENHEDER[f]}</b>
				</div>
			{/each}
		</section>
	{:else}
		<div class="kort rolig">Skriv højde, vægt og alder, så regner jeg det ud.</div>
	{/if}

	{#if fejl}
		<div class="kort rolig nm-fejl">{fejl}</div>
	{/if}

	<button class="nb-knap" disabled={!forslag || gemmer} onclick={brug}>
		{gemmer ? 'Gemmer' : 'Brug de her mål'}
	</button>
</div>
