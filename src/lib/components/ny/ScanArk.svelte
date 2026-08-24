<script lang="ts">
	// ============================================================
	// SCAN EN VARE. Se HANDOVER-3.0.md 9.51 og
	// v3 app/linns-academy-design/mockups-scan-vare.html.
	//
	// Stregkoden er varens NAVNESKILT, billedet er BEVISET for tallene.
	// Vi bruger stregkode-registret til navnet og aldrig til tallene. Det
	// var netop dér Lurpak laa med nul kalorier.
	//
	// Fire trin, og hun kan springe det foerste over:
	//   stregkode -> foto -> gennemgang -> gemt
	//
	// HUN GODKENDER ALTID TALLENE INDEN DER GEMMES. Et gaet der lander
	// direkte i dagbogen uden at hun har set det, ville vaere den forkerte
	// slags automatik i et modul der handler om praecis to tal.
	//
	// Stregkode-scanneren er den GAMLE apps komponent. Den maa laeses og
	// importeres, ikke rettes, se regel 2.
	// ============================================================

	import BarcodeScanner from '$lib/components/BarcodeScanner.svelte';
	import { lookupBarcode } from '$lib/content/openFoodFacts';
	import { laesBillede, skalerTil } from '$lib/utils/billede3';
	import {
		fraAiSvar,
		tilPr100,
		vurder,
		medFiber,
		nokTilAtGemme,
		type Deklaration,
		type FiberValg,
		type Kolonne
	} from '$lib/content/varedeklaration3';
	import { portal } from '$lib/actions/portal';

	interface Props {
		/** Kaldes med den faerdige vare naar hun trykker gem. */
		ongem: (v: {
			navn: string;
			barcode: string | null;
			tal: Deklaration;
			rettet: boolean;
		}) => Promise<void> | void;
		onluk: () => void;
	}
	let { ongem, onluk }: Props = $props();

	type Trin = 'stregkode' | 'foto' | 'laeser' | 'gennemgang';
	let trin = $state<Trin>('stregkode');
	let viserKamera = $state(false);
	let barcode = $state<string | null>(null);
	let navn = $state('');
	let fejl = $state<string | null>(null);
	let gemmer = $state(false);

	let tal = $state<Deklaration | null>(null);
	let kolonne = $state<Kolonne>('ukendt');
	let rettet = $state(false);
	let fiberValg = $state<FiberValg>('tom');
	let fiberTal = $state('');

	const vurdering = $derived(tal ? vurder(tal, kolonne) : null);

	/** Stregkoden giver kun navnet. Tallene henter vi af pakken. */
	async function efterStregkode(kode: string) {
		viserKamera = false;
		barcode = kode;
		try {
			const off = await lookupBarcode(kode);
			if (off?.navn) navn = off.navn;
		} catch {
			// Kender registret ikke varen, taster hun bare navnet selv.
		}
		trin = 'foto';
	}

	async function vaelgBillede(e: Event) {
		const fil = (e.target as HTMLInputElement).files?.[0];
		if (!fil) return;
		fejl = null;
		trin = 'laeser';
		try {
			const img = await laesBillede(fil);
			const skaleret = await skalerTil(img, 'stor');
			const base64 = await tilBase64(skaleret.blob);
			const { auth } = await import('$lib/firebase');
			const token = await auth.currentUser?.getIdToken();
			const svar = await fetch('/api/ny-varedeklaration', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
				body: JSON.stringify({ billedeBase64: base64, mediaType: skaleret.mime })
			});
			if (!svar.ok) {
				const t = (await svar.json().catch(() => null)) as { message?: string } | null;
				throw new Error(t?.message ?? 'Jeg kunne ikke læse tabellen.');
			}
			const laest = fraAiSvar(await svar.json());
			const pr100 = tilPr100(laest);
			if (!pr100) {
				throw new Error(
					'Der stod kun tal pr portion, og portionens vægt kunne ikke læses. Tag billedet igen med kolonnen pr. 100 g med.'
				);
			}
			tal = pr100;
			kolonne = laest.kolonne;
			if (laest.navn && !navn) navn = laest.navn;
			trin = 'gennemgang';
		} catch (e) {
			fejl = e instanceof Error ? e.message : 'Noget gik galt. Prøv igen.';
			trin = 'foto';
		}
	}

	function tilBase64(blob: Blob): Promise<string> {
		return new Promise((ok, nej) => {
			const l = new FileReader();
			l.onload = () => ok(String(l.result).split(',')[1] ?? '');
			l.onerror = () => nej(new Error('Kunne ikke læse billedet'));
			l.readAsDataURL(blob);
		});
	}

	/** Retter hun ét tal, er det ikke laengere pakkens, og varen deles ikke. */
	function ret(felt: keyof Deklaration, v: string) {
		if (!tal) return;
		const n = v.trim() === '' ? null : Number(v.replace(',', '.'));
		tal = { ...tal, [felt]: n !== null && Number.isFinite(n) ? n : null };
		rettet = true;
	}

	async function gem() {
		if (!tal || !navn.trim()) return;
		gemmer = true;
		try {
			const medValgtFiber =
				vurdering?.fibreMangler && fiberValg !== 'tom'
					? medFiber(tal, fiberValg, Number(fiberTal.replace(',', '.')))
					: tal;
			await ongem({ navn: navn.trim(), barcode, tal: medValgtFiber, rettet });
			onluk();
		} catch {
			fejl = 'Kunne ikke gemme varen. Prøv igen.';
			gemmer = false;
		}
	}
</script>

{#if viserKamera}
	<BarcodeScanner onDetected={efterStregkode} onClose={() => (viserKamera = false)} />
{/if}

<!-- Portalles til body for at bryde ud af et omraade der ruller paa iOS.
     ny-tokens SKAL med, ellers resolver var(--oat) til ingenting og arket
     bliver gennemsigtigt. Se faelden i HANDOVER afsnit 7. -->
<div class="ny-tokens sk-baggrund" use:portal role="presentation" onclick={onluk}></div>
<div class="ny-tokens sk-ark" use:portal role="dialog" aria-modal="true" aria-label="Scan en vare">
	<div class="sk-greb" aria-hidden="true"></div>
	<button type="button" class="sk-luk" onclick={onluk} aria-label="Luk">×</button>

	{#if trin === 'stregkode'}
		<h2 class="sk-h">Scan varen</h2>
		<p class="sk-p">
			Stregkoden fortæller hvad varen hedder. Bagefter tager du et billede af
			varedeklarationen, så får du producentens egne tal.
		</p>
		<button type="button" class="sk-knap" onclick={() => (viserKamera = true)}>
			Scan stregkoden
		</button>
		<button type="button" class="sk-knap let" onclick={() => (trin = 'foto')}>
			Der er ingen stregkode
		</button>
	{:else if trin === 'foto' || trin === 'laeser'}
		<h2 class="sk-h">Fotografér tabellen</h2>
		<p class="sk-p">
			Hele næringsindholdet skal med i billedet. Sørg for at kolonnen
			<b>pr. 100 g</b> er med, hvis pakken har to.
		</p>
		{#if fejl}
			<div class="sk-fejl">{fejl}</div>
		{/if}
		{#if trin === 'laeser'}
			<div class="sk-laeser">Læser tabellen …</div>
		{:else}
			<label class="sk-knap sk-foto">
				Tag billedet
				<input type="file" accept="image/*" capture="environment" onchange={vaelgBillede} />
			</label>
			<button type="button" class="sk-knap let" onclick={() => (trin = 'gennemgang')}>
				Skriv tallene selv
			</button>
		{/if}
	{:else if trin === 'gennemgang' && tal}
		<h2 class="sk-h">Tjek tallene</h2>
		<p class="sk-p">Sammenlign med pakken, og ret hvis noget står forkert.</p>

		<label class="sk-felt">
			<span>Varens navn</span>
			<input type="text" bind:value={navn} placeholder="Fx Cultura Kefir naturel" />
		</label>

		{#if kolonne === 'prPortion'}
			<div class="sk-baand">
				<b>Læst fra kolonnen pr. portion</b>
				Tallene er regnet om til 100 gram. Passer de ikke, så tag billedet igen med
				kolonnen pr. 100 g med.
			</div>
		{/if}

		{#if vurdering?.advarsler.length}
			<div class="sk-baand">
				<b>Noget ser forkert ud</b>
				{vurdering.advarsler.join('. ')}. Tjek tallene mod pakken. Du kan gemme
				alligevel, for du har pakken og det har vi ikke.
			</div>
		{/if}

		<div class="sk-tal">
			{#each [['protein', 'Protein'], ['fiber', 'Fiber'], ['kh', 'Kulhydrat'], ['fedt', 'Fedt'], ['kcal', 'Kalorier']] as [felt, navn2] (felt)}
				<label class="sk-t">
					<span class="sk-t-n">{navn2}</span>
					<input
						type="text"
						inputmode="decimal"
						value={tal[felt as keyof Deklaration] ?? ''}
						placeholder="—"
						oninput={(e) => ret(felt as keyof Deklaration, e.currentTarget.value)}
					/>
				</label>
			{/each}
		</div>
		<div class="sk-pr">pr 100 gram</div>

		{#if vurdering?.fibreMangler}
			<!-- FIBRE ER FRIVILLIGE paa en dansk deklaration. Vi skriver aldrig
			     et stille nul, for det er praecis den fejl hvor kunden logger
			     mindre end hun spiste. Linns tre veje ud, 24. august. -->
			<div class="sk-baand honning">
				<b>Fibrene står ikke på pakken</b>
				Producenten behøver ikke skrive dem. Vælg hvad der skal ske.
			</div>
			<div class="sk-valg">
				<label class="sk-v" class:valgt={fiberValg === 'tom'}>
					<input type="radio" bind:group={fiberValg} value="tom" />
					<span><b>Lad fibrene stå tomme</b>Varen tæller ikke med i din fiber</span>
				</label>
				<label class="sk-v" class:valgt={fiberValg === 'egen'}>
					<input type="radio" bind:group={fiberValg} value="egen" />
					<span><b>Skriv tallet selv</b>Står det et andet sted på pakken</span>
				</label>
			</div>
			{#if fiberValg === 'egen'}
				<label class="sk-felt">
					<span>Fiber pr 100 gram</span>
					<input type="text" inputmode="decimal" bind:value={fiberTal} placeholder="Fx 5,9" />
				</label>
			{/if}
		{/if}

		{#if !nokTilAtGemme(tal)}
			<div class="sk-fejl">Der mangler et protein-tal. Uden det kan varen ikke bruges.</div>
		{/if}

		<button
			type="button"
			class="sk-knap gem"
			disabled={gemmer || !navn.trim() || !nokTilAtGemme(tal)}
			onclick={gem}
		>
			{gemmer ? 'Gemmer …' : 'Gem varen'}
		</button>
		<p class="sk-kilde">
			{#if rettet}
				Du har rettet i tallene, så varen bliver kun din.
			{:else}
				Tallene kommer fra pakken, og billedet gemmes sammen med varen.
			{/if}
		</p>
	{/if}
</div>
