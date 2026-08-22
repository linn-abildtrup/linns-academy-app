<script lang="ts">
	// ============================================================
	// Alle opskrifter, samlet ét sted under Din side.
	//
	// HVORFOR SIDEN FINDES. Listen fandtes i forvejen, men KUN inde i
	// 30-30, som et ark der aabner naar hun er i gang med at registrere et
	// maaltid. Ville hun bare kigge, skulle hun lade som om hun spiste
	// frokost. Den gamle app havde den frie indgang under Bibliotek, og
	// den manglede i 3.0.
	//
	// DEN VIGTIGSTE GRUND, og den kom af Linns praecisering 18. august:
	// kunden i de 90 dage efter et forloeb har ikke 30-30 mere. Hun har
	// kun sin side. Laa opskrifterne kun i beregneren, kunne hun ikke se
	// dem i praecis den periode hvor hun har krav paa alt materialet. Se
	// SPEC-3.0.md afsnit 35.
	//
	// REN LAESNING. Linns valg: her kigger hun. Der er ingen "laeg i
	// maaltid" og ingen ret eller slet paa hendes egne. Registrering
	// hoerer til i 30-30, og to veje til at registrere det samme ville
	// vaere to steder at lave fejl. Begge ark er lavet saadan at de dropper
	// alle handlinger naar de ikke faar en gem-funktion med.
	//
	// INGEN BILLEDER I OVERSIGTEN. Linns valg. Raekken er navnet og
	// maaltidet. Billedet moeder hun foerst inde paa opskriften. 130
	// billeder over mobildata er ogsaa praecis det der faar en liste til
	// at hakke.
	//
	// SOEGNINGEN ER DEN SAMME SOM I BEREGNEREN, og det er vigtigt: 56 % af
	// alle soegetraeffer har IKKE ordet i titlen. Soeger hun tomat, kommer
	// der 35 frem, og paa de 31 staar ordet kun i ingredienslisten. Derfor
	// skriver raekken hvorfor den kom med, saa ingen traeffer ligner en
	// fejl. Retter du soegningen ét sted, foelger begge sider med.
	// ============================================================

	import { getContext } from 'svelte';
	import type { Adgangsbillede } from '$lib/content/adgang3';
	import type { User } from 'firebase/auth';
	import type { UserDoc } from '$lib/types';

	import {
		filtrerOpskrifter3,
		fremhaev,
		grundTekst,
		soegetermer,
		type SoegeFiltre
	} from '$lib/content/opskriftSoeg3';
	import {
		KATEGORI_NAVN,
		antalPrKategori,
		farveKategori,
		type Kategori3
	} from '$lib/content/opskriftKategori3';
	import {
		gaetKategorier,
		kategorierFor,
		tilListePost,
		type MinListePost,
		type MinOpskrift3
	} from '$lib/content/mineOpskrifter3';
	import { filtrerMine } from '$lib/content/mineOpskrifter3';
	import type { DietTag } from '$lib/content/opskrifter';

	import { hentOpskrifter3, type Opskrift3 } from '$lib/firestore/opskrifter3';
	import { hentBeregninger, type Beregninger } from '$lib/firestore/opskriftBeregning3';
	import { hentBrugteOpskrifter, hentMineOpskrifter3 } from '$lib/firestore/mineOpskrifter3';
	import { hentNaeringAdgang3 } from '$lib/firestore/naeringAdgang3';
	import { visUdvidet3 } from '$lib/content/naeringAdgang3';

	import OpskriftArk from '$lib/components/ny/OpskriftArk.svelte';
	import MinOpskriftArk from '$lib/components/ny/MinOpskriftArk.svelte';
	import OpskriftFiltre from '$lib/components/ny/OpskriftFiltre.svelte';
	import Ventetegn from '$lib/components/ny/Ventetegn.svelte';
	import Sidehoved from '$lib/components/ny/Sidehoved.svelte';

	const hentUser = getContext<() => User | null>('user');
	const hentUserDoc = getContext<() => UserDoc | null>('userDoc');
	// Forloebet afgoer om hun maa se de udvidede tal. Se HANDOVER 9.38.
	const hentAdgang = getContext<() => Adgangsbillede>('adgang');
	const user = $derived(hentUser());
	const userDoc = $derived(hentUserDoc());

	let opskrifter = $state<Opskrift3[]>([]);
	let beregninger = $state<Beregninger>({});
	let mineOpskrifter = $state<MinOpskrift3[]>([]);
	let gaettede = $state<Map<string, Kategori3[]>>(new Map());
	let visUdvidet = $state(false);
	let henter = $state(true);

	$effect(() => {
		const uid = user?.uid;
		if (!uid) return;

		let afbrudt = false;
		(async () => {
			henter = true;
			const [o, b] = await Promise.all([hentOpskrifter3(), hentBeregninger()]);
			if (afbrudt) return;
			opskrifter = o;
			beregninger = b;
			henter = false;

			// Hendes egne kommer bagefter. De maa ikke forsinke de 130.
			const mine = await hentMineOpskrifter3(uid);
			if (afbrudt) return;
			mineOpskrifter = mine;
			if (mine.length > 0) gaettede = gaetKategorier(await hentBrugteOpskrifter(uid));

			// 3.0's eget skema, ikke den gamle apps. Se HANDOVER 9.38.
			const naering = await hentNaeringAdgang3(uid, hentAdgang().aktiveForlob[0]?.forlobId ?? null);
			if (!afbrudt) visUdvidet = visUdvidet3(naering, userDoc?.visUdvidetNaering);
		})().catch((e) => {
			console.error('[ny] kunne ikke hente opskrifterne', e);
			henter = false;
		});

		return () => {
			afbrudt = true;
		};
	});

	// ── Fanerne ────────────────────────────────────────────────
	// "Mine" findes kun naar hun HAR nogen. For de fleste er der ingen, og
	// saa skal der ikke staa en tom fane og love noget.
	let fane = $state<'alle' | 'mine'>('alle');
	const mineTilListen = $derived(
		mineOpskrifter.map((m) => tilListePost(m, kategorierFor(m, gaettede)))
	);
	const harEgne = $derived(mineTilListen.length > 0);
	const visFane = $derived(harEgne ? fane : 'alle');
	const paaMine = $derived(visFane === 'mine');

	// ── Soegning og filtre ─────────────────────────────────────
	let soegeord = $state('');
	let valgteKategorier = $state<Kategori3[]>([]);
	let valgteDiet = $state<DietTag[]>([]);
	let filtreAabne = $state(false);

	const termer = $derived(soegetermer(soegeord));
	const grundliste = $derived<(Opskrift3 | MinListePost)[]>(paaMine ? mineTilListen : opskrifter);

	/**
	 * Paa hendes egne bruges filtrerMine, som er samme filtrering med ÉN
	 * undtagelse: en opskrift uden maaltid vises altid. Hendes egen mad maa
	 * ikke forsvinde fordi hun aldrig er blevet bedt om at udfylde et felt.
	 */
	function filtrer(liste: (Opskrift3 | MinListePost)[], f: SoegeFiltre) {
		return paaMine ? filtrerMine(liste, f) : filtrerOpskrifter3(liste, f);
	}

	// Tallene ud for hver knap i filter-arket taelles UDEN knappen selv, saa
	// tallet siger hvad hun faar hvis hun trykker, ikke hvad hun har.
	const udenKategori = $derived(filtrer(grundliste, { soegeord, dietTags: valgteDiet }));
	const antal = $derived(antalPrKategori(udenKategori.map((r) => r.opskrift)));

	const udenDiet = $derived(filtrer(grundliste, { soegeord, kategorier: valgteKategorier }));
	const dietAntal = $derived<Record<DietTag, number>>({
		vegetar: udenDiet.filter((r) => r.opskrift.dietTags.includes('vegetar')).length,
		glutenfri: udenDiet.filter((r) => r.opskrift.dietTags.includes('glutenfri')).length
	});

	const resultater = $derived(
		filtrer(grundliste, { soegeord, kategorier: valgteKategorier, dietTags: valgteDiet })
	);

	const antalFiltre = $derived(valgteKategorier.length + valgteDiet.length);
	const soeger = $derived(termer.length > 0);

	/**
	 * Linjen over listen. Fordi filtrene ligger bag en knap, SKAL det kunne
	 * laeses at listen er begraenset. Ellers ser 20 opskrifter ud som om
	 * det er alle der findes.
	 */
	const overskriftTekst = $derived.by(() => {
		const n = resultater.length;
		const ord = n === 1 ? '1 opskrift' : `${n} opskrifter`;
		const dele: string[] = [];
		if (soeger) dele.push(`med ${soegeord.trim()}`);
		if (valgteKategorier.length > 0) {
			dele.push(valgteKategorier.map((k) => KATEGORI_NAVN[k].toLowerCase()).join(' og '));
		}
		for (const d of valgteDiet) dele.push(d === 'vegetar' ? 'vegetar' : 'glutenfri');
		return dele.length > 0 ? `${ord} ${dele.join(' · ')}` : ord;
	});

	function nulstil() {
		valgteKategorier = [];
		valgteDiet = [];
	}

	function slaaKategori(k: Kategori3) {
		valgteKategorier = valgteKategorier.includes(k)
			? valgteKategorier.filter((x) => x !== k)
			: [...valgteKategorier, k];
	}

	function slaaDiet(d: DietTag) {
		valgteDiet = valgteDiet.includes(d) ? valgteDiet.filter((x) => x !== d) : [...valgteDiet, d];
	}

	// ── Den aabne opskrift ─────────────────────────────────────
	let aaben = $state<Opskrift3 | null>(null);
	let aabenEgen = $state<MinOpskrift3 | null>(null);

	function vaelg(id: string) {
		if (paaMine) {
			aabenEgen = mineOpskrifter.find((m) => m.id === id) ?? null;
		} else {
			aaben = opskrifter.find((o) => o.id === id) ?? null;
		}
	}

	const aabenEgenKategorier = $derived(aabenEgen ? kategorierFor(aabenEgen, gaettede) : []);
</script>

<div class="ny-pad ops-side">
	<Sidehoved titel="Opskrifter" tilbage="/ny/profil" tilbageTekst="Din side" />

	{#if harEgne}
		<div class="ll-faner" role="tablist">
			<button
				class="ll-fane"
				class:aktiv={visFane === 'alle'}
				role="tab"
				aria-selected={visFane === 'alle'}
				onclick={() => (fane = 'alle')}
			>
				Alle <span class="ll-antal">{opskrifter.length}</span>
			</button>
			<button
				class="ll-fane"
				class:aktiv={visFane === 'mine'}
				role="tab"
				aria-selected={visFane === 'mine'}
				onclick={() => (fane = 'mine')}
			>
				Mine <span class="ll-antal">{mineTilListen.length}</span>
			</button>
		</div>
	{/if}

	<div class="ops-hoved">
		<input
			class="ops-soeg"
			type="search"
			placeholder="Søg efter opskrift"
			aria-label="Søg efter opskrift"
			bind:value={soegeord}
		/>
		<button class="ops-filterknap" class:har={antalFiltre > 0} onclick={() => (filtreAabne = true)}>
			Filtre
			{#if antalFiltre > 0}<span class="ops-filtertal">{antalFiltre}</span>{/if}
		</button>
	</div>

	{#if henter}
		<div class="lektion-venter">
			<Ventetegn variant="lille" />
			<span>Henter opskrifterne</span>
		</div>
	{:else}
		<p class="ops-overskrift" aria-live="polite">{overskriftTekst}</p>

		{#if resultater.length === 0}
			<div class="kort rolig">
				{#if soeger || antalFiltre > 0}
					Der er ingen der passer. Prøv et andet ord, eller slå filtrene fra.
				{:else if paaMine}
					Du har ikke lavet nogen opskrifter endnu. Det gør du inde i 30-30.
				{:else}
					Der er ingen opskrifter endnu.
				{/if}
			</div>
		{:else}
			<div class="ops-liste">
				{#each resultater as r (r.opskrift.id)}
					{@const grund = grundTekst(r.grunde)}
					{@const kat = r.opskrift.kategorier3}
					<button class="ops-r" onclick={() => vaelg(r.opskrift.id)}>
						<span
							class="ops-prik {farveKategori(kat, valgteKategorier) ?? 'andet'}"
							aria-hidden="true"
						></span>
						<span class="ops-t">
							<span class="ops-navn">
								{#each fremhaev(r.opskrift.titel, termer) as del, i (i)}
									{#if del.traef}<mark>{del.tekst}</mark>{:else}{del.tekst}{/if}
								{/each}
							</span>
							<!-- Staar der en grund, er DEN det vigtigste hun kan laese:
							     den forklarer hvorfor en opskrift uden ordet i navnet kom
							     med. Ellers staar maaltidet der. -->
							{#if grund}
								<span class="ops-grund">{grund}</span>
							{:else if kat.length > 0}
								<span class="ops-kat">{kat.map((k) => KATEGORI_NAVN[k]).join(' · ')}</span>
							{/if}
						</span>
						<span class="ops-pil" aria-hidden="true">›</span>
					</button>
				{/each}
			</div>
		{/if}
	{/if}
</div>

{#if filtreAabne}
	<OpskriftFiltre
		{valgteKategorier}
		{valgteDiet}
		{antal}
		{dietAntal}
		resultatAntal={resultater.length}
		onkategori={slaaKategori}
		ondiet={slaaDiet}
		onnulstil={nulstil}
		onluk={() => (filtreAabne = false)}
	/>
{/if}

<!-- Ingen ongem: arket er i ren laesning og viser hverken "laeg i maaltid",
     ret eller slet. Se hovedet i filen. -->
{#if aaben}
	<OpskriftArk
		opskrift={aaben.raa}
		maaltidLabel=""
		{visUdvidet}
		{beregninger}
		ontilbage={() => (aaben = null)}
	/>
{/if}

{#if aabenEgen}
	<MinOpskriftArk
		opskrift={aabenEgen}
		kategorier={aabenEgenKategorier}
		maaltidLabel=""
		{visUdvidet}
		ontilbage={() => (aabenEgen = null)}
	/>
{/if}
