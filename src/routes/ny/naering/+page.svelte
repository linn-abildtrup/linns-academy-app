<script lang="ts">
	// ============================================================
	// "Dine maal": protein, fiber og de tre udvidede.
	//
	// Linns valg 22. august 2026, se mockups-udvidet-naering.html.
	//
	// PROTEIN OG FIBER STAAR ALTID. I den gamle app er de to felter laast
	// bag den kontakt der handler om de TRE andre, saa hun ikke kan rette
	// sit protein-maal uden ogsaa at faa kalorier at se. Det er rettet her.
	//
	// AT MAATTE ER IKKE AT SE. Kontakten er hendes egen og staar paa fra
	// som standard. Linn bestemmer om hun MAA, se content/naeringAdgang3.
	// ============================================================

	import { getContext } from 'svelte';
	import type { User } from 'firebase/auth';
	import type { UserDoc } from '$lib/types';
	import type { Adgangsbillede } from '$lib/content/adgang3';
	import {
		NAERING_ENHEDER,
		NAERING_LABELS,
		STANDARD_DAGLIGE_MAL,
		dagligeMalForBruger
	} from '$lib/content/naering';
	import { naeringAdgangFor3 } from '$lib/content/naeringAdgang3';
	import { hentNaeringRegler3, hentNaeringUndtagelse3 } from '$lib/firestore/naeringAdgang3';
	import { gemNaeringsindstillinger } from '$lib/userDoc';
	import Sidehoved from '$lib/components/ny/Sidehoved.svelte';
	import Ventetegn from '$lib/components/ny/Ventetegn.svelte';

	const hentUser = getContext<() => User | null>('user');
	const hentUserDoc = getContext<() => UserDoc | null>('userDoc');
	const hentAdgang = getContext<() => Adgangsbillede>('adgang');
	const user = $derived(hentUser());
	const userDoc = $derived(hentUserDoc());
	const adgang = $derived(hentAdgang());
	const forlobId = $derived(adgang.aktiveForlob[0]?.forlobId ?? null);

	const SMAA = ['protein', 'fiber'] as const;
	const STORE = ['kh', 'fedt', 'kcal'] as const;

	let maaVise = $state(true);
	let maaRette = $state(true);
	let henter = $state(true);
	let gemmer = $state(false);
	let gemtLige = $state(false);
	let fejl = $state('');

	let visUdvidet = $state(false);
	let maal = $state({ ...STANDARD_DAGLIGE_MAL });

	$effect(() => {
		const uid = user?.uid;
		if (!uid) return;
		const fid = forlobId;
		let afbrudt = false;

		(async () => {
			const [regler, undtagelse] = await Promise.all([
				hentNaeringRegler3(),
				hentNaeringUndtagelse3(uid)
			]);
			if (afbrudt) return;
			const a = naeringAdgangFor3(regler, undtagelse, fid);
			maaVise = a.udvidet;
			maaRette = a.maaRette;
			henter = false;
		})().catch((e) => {
			console.error('[ny] kunne ikke hente naerings-adgangen', e);
			henter = false;
		});

		return () => {
			afbrudt = true;
		};
	});

	// Hendes gemte tal. Laeses hver gang userDoc skifter, saa guiden slaar
	// igennem naar hun kommer tilbage derfra.
	$effect(() => {
		const ud = userDoc;
		if (!ud) return;
		maal = dagligeMalForBruger(ud.dagligeMaal);
		visUdvidet = ud.visUdvidetNaering ?? false;
	});

	function kvitter() {
		gemtLige = true;
		setTimeout(() => (gemtLige = false), 1600);
	}

	async function gem() {
		const uid = user?.uid;
		if (!uid) return;
		gemmer = true;
		fejl = '';
		try {
			await gemNaeringsindstillinger(uid, visUdvidet, maal);
			kvitter();
		} catch (e) {
			console.error('[ny] kunne ikke gemme dine maal', e);
			fejl = 'Kunne ikke gemme. Prøv igen.';
		} finally {
			gemmer = false;
		}
	}

	async function skiftUdvidet() {
		if (gemmer || !maaVise) return;
		visUdvidet = !visUdvidet;
		await gem();
	}

	/** Et tal er aendret. Tomt felt bliver til standarden i stedet for nul. */
	async function saetMaal(felt: keyof typeof maal, raa: string) {
		if (!maaRette) return;
		const n = Number(raa.replace(',', '.'));
		maal = { ...maal, [felt]: Number.isFinite(n) && n > 0 ? Math.round(n) : STANDARD_DAGLIGE_MAL[felt] };
		await gem();
	}

	const felter = $derived(visUdvidet && maaVise ? [...SMAA, ...STORE] : [...SMAA]);
</script>

<div class="ny-pad naering-side">
	<Sidehoved
		titel="Dine mål"
		tilbage="/ny/profil"
		tilbageTekst="Din side"
		under="Det appen måler din dag op imod."
		kant={false}
	/>

	{#if henter}
		<div class="lektion-venter">
			<Ventetegn variant="lille" />
			<span>Henter dine mål</span>
		</div>
	{:else}
		{#if fejl}
			<div class="kort rolig nm-fejl">{fejl}</div>
		{/if}

		<section class="kort">
			<div class="nm-top">
				<span class="nm-t">Daglige mål</span>
				{#if gemtLige}<span class="nm-gemt">✓ Gemt</span>{/if}
			</div>

			<div class="nm-grid">
				{#each felter as felt (felt)}
					<label class="nm-felt">
						<span class="nm-l">{NAERING_LABELS[felt]}</span>
						<span class="nm-b" class:laast={!maaRette}>
							<input
								type="number"
								inputmode="numeric"
								min="0"
								step={felt === 'kcal' ? 50 : 5}
								value={maal[felt]}
								disabled={!maaRette || gemmer}
								onchange={(e) => saetMaal(felt, (e.target as HTMLInputElement).value)}
							/>
							<span class="nm-e">{NAERING_ENHEDER[felt]}</span>
						</span>
					</label>
				{/each}
			</div>

			{#if !maaRette}
				<div class="nm-hjaelp">Linn har sat dine mål. Skriv til hende hvis de skal ændres.</div>
			{:else}
				<!-- Guiden staar ALTID fremme. Den laa foerst bag kontakten,
				     ligesom i den gamle app, og saa kunne hun ikke faa sit
				     protein-maal beregnet uden ogsaa at slaa kalorier til.
				     Linns rettelse 22. august, se HANDOVER 9.38. -->
				<a class="nm-beregn" href="/ny/naering/beregn">
					<span class="nm-beregn-i" aria-hidden="true">✧</span>
					<span>
						<span class="nm-beregn-t">Beregn mine mål</span>
						<span class="nm-beregn-s">Fem spørgsmål, så har du et udgangspunkt</span>
					</span>
					<span class="nm-beregn-p" aria-hidden="true">›</span>
				</a>
			{/if}
		</section>

		{#if maaVise}
			<section class="kort">
				<button class="nm-kontakt" onclick={skiftUdvidet} disabled={gemmer} aria-pressed={visUdvidet}>
					<span class="nm-kontakt-tekst">
						<span class="nm-kontakt-t">Vis også kulhydrater, fedt og kalorier</span>
						<span class="nm-kontakt-s">
							{visUdvidet
								? 'Slået til'
								: 'Som standard følger du protein og fiber. Det er dem 30-30-3 handler om.'}
						</span>
					</span>
					<span class="nm-sw" class:on={visUdvidet} aria-hidden="true"><i></i></span>
				</button>
			</section>
		{/if}
	{/if}
</div>
