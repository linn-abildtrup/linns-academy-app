<script lang="ts">
	import { getContext } from 'svelte';
	import { goto } from '$app/navigation';
	import type { User } from 'firebase/auth';
	import { storage } from '$lib/firebase';
	import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
	import { opretMinOpskrift } from '$lib/firestore/minOpskrift';
	import {
		erGyldigAnalyse,
		DEFAULT_MAKRO,
		omberegnMakroForNytAntalPortioner,
		type MinOpskriftIngrediens,
		type MinOpskriftMakro
	} from '$lib/content/minOpskrift';
	import { ENHEDER } from '$lib/content/mineOpskrifter3';
	import { komprimerBillede, blobTilBase64 } from '$lib/utils/billede';
	import Icon from '$lib/components/Icon.svelte';
	import Loading from '$lib/components/Loading.svelte';

	const getUser = getContext<() => User | null>('user');
	const user = $derived(getUser());
	// LAASEN ER FJERNET 1. september 2026. Linns beslutning: ALLE kunder
	// skal kunne skrive en opskrift selv OG tage et billede af en. Foer den
	// dag var hele siden lukket for alle andre end premium-app og Kropsro,
	// og den laas sad om AI-laesningen.
	//
	// Den daglige pulje er stadig der, saa det ikke kan loebe loebsk: baade
	// billed-laesningen og gaettet paa en skreven opskrift traekker paa de
	// samme 20 om dagen pr kunde.

	const MAX_BILLEDER = 3;

	/**
	 * Et tomt maengde-felt. Typen siger tal, men skaermen skal kunne staa tom,
	 * og et tomt tal-felt giver undefined. Vi gemmer aldrig undefined: den
	 * bliver til nul i gem(), og tjenesten der regner springer tomme
	 * maengder over og antager en almindelig portion.
	 */
	const TOM_MAENGDE = undefined as unknown as number;

	type Tilstand = 'vaelg' | 'analyserer' | 'estimerer' | 'redigerer' | 'gemmer' | 'fejl';
	let tilstand = $state<Tilstand>('vaelg');
	let fejlBesked = $state<string | null>(null);
	let infoBesked = $state<string | null>(null);

	let billedeFiler = $state<File[]>([]);
	let billedePreviews = $state<string[]>([]);

	let navn = $state('');
	let antalPortioner = $state(4);
	let ingredienser = $state<MinOpskriftIngrediens[]>([]);
	let makro = $state<MinOpskriftMakro>({ ...DEFAULT_MAKRO });
	/** Fremgangsmaaden. Linns oenske 1. september. Kommer ikke fra et billede. */
	let fremgangsmaade = $state('');
	/** Sand naar hun skriver opskriften selv i stedet for at fotografere den. */
	let manuel = $state(false);
	/** Sat naar hun har svaret paa om appen skal gaette tallene. */
	let harSvaretPaaGaet = $state(false);
	/**
	 * Hvor langt hun er i skemaet. Omlagt 2. september 2026 efter Linns
	 * oenske: én lang side blev til tre trin i den raekkefoelge man selv
	 * taenker en opskrift — retten, indholdet, tallene.
	 *
	 * Kommer hun fra et billede, er de to foerste trin allerede udfyldt af
	 * analysen, og hun lander direkte paa trin 3. Hun kan gaa tilbage.
	 */
	let trin = $state<1 | 2 | 3>(1);
	const TRIN_TITLER = ['Hvad hedder retten?', 'Hvad er der i?', 'Næringstallene'];
	let estimatFejl = $state<string | null>(null);

	// Snapshot af AI-analyserens originale forslag — bruges af effekten
	// nedenfor til at omberegne makro-pr-portion saa total-makroen bevares
	// naar kunden retter antal portioner. Saettes naar analyseren returnerer.
	let originalAntalPortioner = $state(0);
	let originalMakro = $state<MinOpskriftMakro>({ ...DEFAULT_MAKRO });

	// Naar kunden retter antal portioner efter AI-analyse, omberegn makro
	// pr portion saa total-makroen bevares. Pure-funktionen er testet i
	// minOpskrift.test.ts. Skipper omberegning hvis analysen ikke har koert
	// endnu (originalAntalPortioner=0) eller vaerdien er uaendret.
	$effect(() => {
		if (tilstand !== 'redigerer') return;
		const nyt = antalPortioner;
		if (!Number.isFinite(nyt) || nyt <= 0) return;
		if (originalAntalPortioner <= 0) return;
		if (nyt === originalAntalPortioner) return;
		makro = omberegnMakroForNytAntalPortioner(originalMakro, originalAntalPortioner, nyt);
	});

	function tilfojFiler(filer: FileList | File[]) {
		infoBesked = null;
		const nye: File[] = [];
		for (const fil of Array.from(filer)) {
			if (!fil.type.startsWith('image/')) {
				infoBesked = 'Kun billed-filer er tilladt.';
				continue;
			}
			if (fil.size > 5 * 1024 * 1024) {
				infoBesked = `${fil.name} er for stort (max 5 MB).`;
				continue;
			}
			nye.push(fil);
		}
		const samlet = [...billedeFiler, ...nye];
		if (samlet.length > MAX_BILLEDER) {
			infoBesked = `Max ${MAX_BILLEDER} billeder pr opskrift. De første ${MAX_BILLEDER} bliver brugt.`;
		}
		const trimmet = samlet.slice(0, MAX_BILLEDER);
		// Frigiv preview-URLs for filer der fjernes
		for (let i = trimmet.length; i < billedePreviews.length; i++) {
			URL.revokeObjectURL(billedePreviews[i]);
		}
		billedeFiler = trimmet;
		billedePreviews = trimmet.map((f) => URL.createObjectURL(f));
	}

	function fjernBillede(index: number) {
		const url = billedePreviews[index];
		if (url) URL.revokeObjectURL(url);
		billedeFiler = billedeFiler.filter((_, i) => i !== index);
		billedePreviews = billedePreviews.filter((_, i) => i !== index);
	}

	/**
	 * Skriv opskriften selv. Aabner PRAECIS det samme skema som efter en
	 * billed-analyse, bare tomt. Der bygges ingen ny skaerm: skemaet fandtes
	 * allerede, der var bare ingen doer ind til det.
	 */
	function skrivSelv() {
		manuel = true;
		harSvaretPaaGaet = false;
		estimatFejl = null;
		navn = '';
		antalPortioner = 4;
		// MAENGDEN STAAR TOM, ikke paa nul. Et nul i feltet ligner et tal hun
		// allerede har skrevet, og det blev sendt videre som "nul gram".
		ingredienser = [
			{ navn: '', maengde: TOM_MAENGDE, enhed: 'g' },
			{ navn: '', maengde: TOM_MAENGDE, enhed: 'g' }
		];
		makro = { ...DEFAULT_MAKRO };
		fremgangsmaade = '';
		// Nul betyder "AI har ikke regnet paa det", saa omregningen ved
		// portions-skift holder sig vaek. Hun skriver selv tallene pr portion.
		originalAntalPortioner = 0;
		trin = 1;
		tilstand = 'redigerer';
	}

	/**
	 * Lad appen gaette naeringstallene ud fra det hun har skrevet.
	 *
	 * DEN GAETTER, og det staar paa skaermen. Tallene kommer ikke fra en
	 * database, de er et skoen ud fra ingrediensernes navne og maengder, og
	 * hun kan rette dem alle sammen bagefter.
	 */
	async function estimerFraTekst() {
		const brugbare = ingredienser.filter((i) => i.navn.trim());
		if (brugbare.length === 0) {
			estimatFejl = 'Skriv mindst én ingrediens først.';
			return;
		}
		tilstand = 'estimerer';
		estimatFejl = null;
		try {
			const idToken = await user?.getIdToken();
			const res = await fetch('/api/estimer-opskrift', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
				body: JSON.stringify({ navn, antalPortioner, ingredienser: brugbare })
			});
			if (!res.ok) {
				// SIG HVAD DER GIK GALT. Foer stod der bare "kunne ikke regne
				// paa opskriften", uanset om puljen var brugt op, om noeglen
				// manglede, eller om svaret var for langt. Saa kunne hverken
				// kunden eller vi se hvad der skulle rettes.
				const grund = await res
					.json()
					.then((d: { message?: string }) => d?.message)
					.catch(() => null);
				throw new Error(grund || `Fejl ${res.status}`);
			}
			const data = (await res.json()) as {
				makroPrPortion?: MinOpskriftMakro;
				error?: string;
			};
			if (data.error || !data.makroPrPortion) {
				estimatFejl =
					'Der var ikke nok at regne på. Skriv hvor meget der er af hver ingrediens, eller skriv tallene selv.';
			} else {
				makro = data.makroPrPortion;
				// Saa omregningen ved portions-skift virker herfra.
				originalMakro = { ...data.makroPrPortion };
				originalAntalPortioner = antalPortioner;
			}
		} catch (e) {
			console.error(e);
			const grund = e instanceof Error && e.message ? ` ${e.message}` : '';
			estimatFejl = `Kunne ikke regne på opskriften.${grund} Skriv tallene selv, eller prøv igen.`;
			// Naar det gik galt, skal hun kunne komme videre og skrive tallene
			// selv i stedet for at staa paa spoergsmaals-skaermen igen.
		} finally {
			harSvaretPaaGaet = true;
			tilstand = 'redigerer';
		}
	}

	async function analyserOpskrift() {
		const u = user;
		if (!u || billedeFiler.length === 0) return;
		tilstand = 'analyserer';
		fejlBesked = null;
		try {
			// Komprimer foer upload — goer AI-vision-kaldet markant hurtigere/billigere.
			const billeder = await Promise.all(
				billedeFiler.map(async (fil) => {
					const komp = await komprimerBillede(fil);
					return { billedeBase64: await blobTilBase64(komp), mediaType: komp.type };
				})
			);
			const idToken = await u.getIdToken();
			const res = await fetch('/api/analyser-opskrift', {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${idToken}`,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ billeder })
			});
			if (!res.ok) {
				const e = await res.json().catch(() => ({}));
				throw new Error(e.message ?? `Fejl ${res.status}`);
			}
			const data = await res.json();
			if (data.error) throw new Error(data.error);
			if (!erGyldigAnalyse(data)) throw new Error('AI returnerede ugyldigt format. Prøv igen.');

			navn = data.navn;
			antalPortioner = data.antalPortioner;
			ingredienser = data.ingredienser;
			makro = data.makroPrPortion;
			originalAntalPortioner = data.antalPortioner;
			originalMakro = { ...data.makroPrPortion };
			// Analysen har allerede fyldt trin 1 og 2 ud, saa hun lander paa
			// tallene. Trin-bjaelken viser at de to foerste er klaret, og
			// tilbage-knappen foerer hende ind i dem hvis noget skal rettes.
			harSvaretPaaGaet = true;
			trin = 3;
			tilstand = 'redigerer';
		} catch (e) {
			console.error(e);
			fejlBesked = e instanceof Error ? e.message : 'Kunne ikke analysere opskriften.';
			tilstand = 'fejl';
		}
	}

	function videre() {
		fejlBesked = null;
		if (trin < 3) trin = (trin + 1) as 1 | 2 | 3;
	}

	function tilbage() {
		fejlBesked = null;
		estimatFejl = null;
		if (trin > 1) trin = (trin - 1) as 1 | 2 | 3;
	}

	/**
	 * Sand naar der reelt ikke er noget at gemme. ALLE fem tal skal staa paa
	 * nul foer vi spaerrer — se noten i gem().
	 */
	const alleTalNul = $derived(
		!(Number(makro.protein) > 0) &&
			!(Number(makro.fiber) > 0) &&
			!(Number(makro.kh) > 0) &&
			!(Number(makro.fedt) > 0) &&
			!(Number(makro.kcal) > 0)
	);

	/**
	 * Enheds-feltet er en liste, men hun skal kunne skrive noget der ikke
	 * staar paa den. Vi holder ikke styr paa det i en ekstra tilstand: staar
	 * der en enhed vi ikke kender, ER det en egen enhed, og skrivefeltet
	 * staar aabent. Det daekker ogsaa den enhed AI'en kan finde paa at laese
	 * ud af et billede, saa hendes opskrift ikke bliver lavet om bag om
	 * ryggen paa hende.
	 */
	function erEgenEnhed(enhed: string): boolean {
		return !ENHEDER.includes((enhed ?? '').trim());
	}

	function vaelgEnhed(i: number, vaerdi: string) {
		// Tom vaerdi betyder "andet", og saa aabner skrivefeltet.
		ingredienser[i].enhed = vaerdi === ANDET ? '' : vaerdi;
	}

	const ANDET = '__andet__';

	function tilfojIngrediens() {
		ingredienser = [...ingredienser, { navn: '', maengde: TOM_MAENGDE, enhed: 'g' }];
	}

	function fjernIngrediens(i: number) {
		ingredienser = ingredienser.filter((_, idx) => idx !== i);
	}

	async function gem() {
		const u = user;
		if (!u) return;

		// SPAERREN ER LOESNET 2. september 2026. Linns beslutning: den
		// spurgte foer efter BAADE protein og fiber over nul, og saa kunne en
		// omelet med ost ikke gemmes — den har nul fiber, og det er rigtigt.
		//
		// Vi spaerrer derfor kun naar der reelt intet er at gemme: staar alle
		// fem tal paa nul, laegger retten nul i hendes dag hver gang hun
		// bruger den, og det ser rigtigt ud paa skaermen. Ét udfyldt tal er
		// nok. Et enkelt nul i fiber, fedt eller kulhydrater spaerrer aldrig.
		if (alleTalNul) {
			fejlBesked =
				'Alle tallene står på nul, så retten vil tælle nul i din dag. Udfyld mindst ét tal, eller lad appen regne dem ud.';
			return;
		}

		tilstand = 'gemmer';
		fejlBesked = null;
		try {
			// BILLEDET ER VALGFRIT nu. Skriver hun opskriften selv, er der
			// ingen, og saa faar retten et bogstav i listen. Foer den 1.
			// september gemte siden slet ikke uden et billede.
			let billedeUrl: string | undefined;
			if (billedeFiler.length > 0) {
				// Vi gemmer kun det første billede som thumbnail. AI har allerede
				// udvundet alle data fra de øvrige, så de behøver ikke gemmes.
				const thumbnail = await komprimerBillede(billedeFiler[0]);
				const billedeId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
				const sti = `users/${u.uid}/opskrift-billeder/${billedeId}`;
				const billedeRef = ref(storage, sti);
				await uploadBytes(billedeRef, thumbnail, { contentType: thumbnail.type });
				billedeUrl = await getDownloadURL(billedeRef);
			}

			await opretMinOpskrift(u.uid, {
				navn: navn.trim() || 'Min opskrift',
				billedeUrl,
				antalPortioner: Math.max(1, antalPortioner),
				ingredienser: ingredienser
					.filter((i) => i.navn.trim())
					.map((i) => ({ ...i, maengde: Number(i.maengde) || 0 })),
				makroPrPortion: makro,
				fremgangsmaade: fremgangsmaade.trim() || undefined
			});
			goto('/app/moduler/30-30-3?tab=mine');
		} catch (e) {
			console.error(e);
			fejlBesked = 'Kunne ikke gemme. Prøv igen.';
			tilstand = 'redigerer';
		}
	}

	function handleFileInput(e: Event) {
		const input = e.target as HTMLInputElement;
		if (input.files?.length) tilfojFiler(input.files);
		// Nulstil så samme fil kan vælges igen efter fjernelse
		input.value = '';
	}
</script>

<div class="page">
	<header class="page-header">
		{#if tilstand === 'redigerer' && trin > 1}
			<button class="back" type="button" onclick={tilbage}>
				<Icon name="arrow-l" size={14} color="var(--text2)" />
				<span>Trin {trin - 1}</span>
			</button>
		{:else}
			<a class="back" href="/app/moduler/30-30-3?tab=mine">
				<Icon name="arrow-l" size={14} color="var(--text2)" />
				<span>Tilbage</span>
			</a>
		{/if}
		{#if tilstand === 'redigerer'}
			<div class="eyebrow">Trin {trin} af 3</div>
			<h1>{TRIN_TITLER[trin - 1]}</h1>
			<!-- Bjaelken svarer paa det hun spurgte om foerst: hvor lang er
			     vejen, og hvor langt er jeg. -->
			<div class="trin-bar" aria-hidden="true">
				<div class={trin >= 1 ? 'on' : ''}></div>
				<div class={trin >= 2 ? 'on' : ''}></div>
				<div class={trin >= 3 ? 'on' : ''}></div>
			</div>
			<div class="trin-tekst">Retten · Indholdet · Tallene</div>
		{:else}
			<div class="eyebrow">Min opskrift</div>
			<h1>Tilføj en opskrift</h1>
		{/if}
	</header>

	{#if tilstand === 'vaelg'}
		<div class="vaelg-card">
			<p class="hint">
				Tag et billede af en opskrift, upload fra galleri, eller paste en screenshot. AI'en læser
				opskriften og estimerer makro pr portion. Du kan tilføje op til {MAX_BILLEDER} billeder hvis opskriften
				fylder over flere sider.
			</p>

			{#if billedePreviews.length > 0}
				<div class="billede-grid">
					{#each billedePreviews as preview, i (preview)}
						<div class="billede-tile">
							<img src={preview} alt="Billede {i + 1}" />
							<div class="billede-tile-nr">{i + 1}</div>
							<button
								type="button"
								class="billede-tile-slet"
								onclick={() => fjernBillede(i)}
								aria-label="Fjern billede {i + 1}"
							>
								×
							</button>
						</div>
					{/each}
				</div>
			{/if}

			{#if infoBesked}
				<div class="info-besked">{infoBesked}</div>
			{/if}

			{#if billedeFiler.length < MAX_BILLEDER}
				<label class="upload-knap">
					<Icon name="plus" size={18} color="#fff" />
					<span>
						{billedeFiler.length === 0 ? 'Vælg billede' : 'Tilføj endnu et billede'}
					</span>
					<input
						type="file"
						accept="image/*"
						capture="environment"
						multiple
						onchange={handleFileInput}
					/>
				</label>
				<label class="upload-knap sekundaer">
					<span>Vælg fra galleri</span>
					<input type="file" accept="image/*" multiple onchange={handleFileInput} />
				</label>
			{/if}

			{#if billedeFiler.length > 0}
				<button class="analyser-knap" type="button" onclick={analyserOpskrift}>
					Analysér {billedeFiler.length === 1 ? 'opskrift' : `${billedeFiler.length} billeder`}
				</button>
			{/if}

			<!-- Den anden vej ind. Billedet staar oeverst, for det er den
			     hurtigste naar hun har en kogebog foran sig, og den nye
			     mulighed skal laegge sig ved siden af og ikke skubbe noget
			     vaek. Knappen har kant og er ikke fyldt, saa det kan ses at
			     det er en ANDEN vej og ikke en tredje maade at vaelge et
			     billede paa. -->
			<div class="eller"><span>eller</span></div>
			<button class="skriv-selv-knap" type="button" onclick={skrivSelv}>
				Skriv opskriften selv
			</button>
			<p class="hint" style="margin-top: 9px">
				Har du den på papir eller i hovedet, kan du skrive den ind. Bagefter kan du vælge om appen
				skal gætte næringstallene, eller om du selv vil skrive dem.
			</p>
		</div>
	{:else if tilstand === 'estimerer'}
		<div class="analyse-card">
			<Loading tekst="Regner på opskriften..." />
			<p class="hint center">Det tager typisk 5-15 sekunder.</p>
		</div>
	{:else if tilstand === 'analyserer'}
		<div class="analyse-card">
			{#if billedePreviews.length > 0}
				<div class="billede-grid kompakt">
					{#each billedePreviews as preview, i (preview)}
						<img src={preview} alt="Billede {i + 1}" />
					{/each}
				</div>
			{/if}
			<Loading
				tekst={billedeFiler.length === 1
					? 'AI analyserer opskriften...'
					: `AI analyserer ${billedeFiler.length} billeder...`}
			/>
			<p class="hint center">
				{billedeFiler.length === 1
					? 'Det tager typisk 5-15 sekunder.'
					: 'Det tager typisk 10-25 sekunder for flere billeder.'}
			</p>
		</div>
	{:else if tilstand === 'redigerer'}
		<!-- TRIN 1 — RETTEN. Navnet og portionerne foerst, for det er dem hun
		     selv ville sige hoejt om retten. -->
		{#if trin === 1}
			<section class="card">
				{#if billedePreviews.length > 0}
					<img class="preview-billede" src={billedePreviews[0]} alt="Opskrift" />
					{#if billedePreviews.length > 1}
						<div class="hint center small">
							{billedePreviews.length} billeder brugt til analysen — kun det første gemmes som thumbnail.
						</div>
					{/if}
				{/if}
				<label class="felt">
					<span class="felt-label">Opskriftens navn</span>
					<input type="text" bind:value={navn} placeholder="fx Pasta med hytteost" />
				</label>
				<label class="felt">
					<span class="felt-label">Hvor mange portioner giver den?</span>
					<input type="number" min="1" max="20" bind:value={antalPortioner} />
				</label>
				<p class="hint">
					Portionerne bruges til at regne tallene om, så du kan tage én portion i din dag.
				</p>
			</section>

			<!-- Billedet er valgfrit paa den skrevne vej. Det bliver kun gemt
			     som lille billede i listen, det bliver ikke laest af AI'en. -->
			{#if manuel && billedeFiler.length === 0}
				<section class="card">
					<div class="card-head">
						<div class="section-label">Billede</div>
						<div class="card-tael valgfri">valgfrit</div>
					</div>
					<label class="upload-knap sekundaer">
						<span>Tilføj et billede af retten</span>
						<input type="file" accept="image/*" onchange={handleFileInput} />
					</label>
				</section>
			{:else if manuel}
				<section class="card">
					<div class="card-head">
						<div class="section-label">Billede</div>
					</div>
					<img class="preview-billede" src={billedePreviews[0]} alt="Retten" />
					<button class="annuller-btn" type="button" onclick={() => fjernBillede(0)}>
						Fjern billedet
					</button>
				</section>
			{/if}

			<button class="gem-btn" type="button" onclick={videre}>Videre</button>

			<!-- TRIN 2 — INDHOLDET. Ingredienserne skal staa foer tallene:
			     det er dem appen regner ud fra, og det er dem hun har i
			     hovedet lige efter navnet. -->
		{:else if trin === 2}
			<section class="card">
				<div class="card-head">
					<div class="section-label">Ingredienser</div>
					<div class="card-tael">{ingredienser.length}</div>
				</div>
				<!-- TO LINJER PR INGREDIENS. Foer 2. september stod navn, maengde
				     og enhed paa én linje, og da enheden blev en liste, blev
				     navnefeltet for smalt paa en telefon. Navnet faar nu hele
				     bredden, og de smaa felter staar under. -->
				{#each ingredienser as ing, i (i)}
					<div class="ing-rad">
						<input type="text" class="ing-navn" placeholder="Ingrediens" bind:value={ing.navn} />
						<div class="ing-tal">
							<input
								type="number"
								class="ing-maengde"
								placeholder="Mængde"
								min="0"
								step="any"
								bind:value={ing.maengde}
							/>
							<select
								class="ing-enhed"
								value={erEgenEnhed(ing.enhed) ? ANDET : ing.enhed.trim()}
								onchange={(e) => vaelgEnhed(i, e.currentTarget.value)}
								aria-label="Enhed"
							>
								{#each ENHEDER as e (e)}
									<option value={e}>{e}</option>
								{/each}
								<option value={ANDET}>andet</option>
							</select>
							<button
								class="ing-slet"
								type="button"
								aria-label="Fjern ingrediens"
								onclick={() => fjernIngrediens(i)}>×</button
							>
						</div>
						{#if erEgenEnhed(ing.enhed)}
							<input
								type="text"
								class="egen-enhed"
								placeholder="Skriv din egen enhed, fx pose eller glas"
								bind:value={ing.enhed}
							/>
						{/if}
					</div>
				{/each}
				<button class="tilfoj-btn" type="button" onclick={tilfojIngrediens}>
					<Icon name="plus" size={12} color="var(--text2)" /> Tilføj ingrediens
				</button>
			</section>

			<!-- Fremgangsmaaden. Linns oenske 1. september. Den kommer ALDRIG
			     fra et billede, ogsaa naar opskriften er laest af AI'en: den
			     gemmer kun ingredienser og tal. Feltet staar derfor begge veje. -->
			<section class="card">
				<div class="card-head">
					<div class="section-label">Sådan laver du den</div>
					<div class="card-tael valgfri">valgfrit</div>
				</div>
				<textarea
					class="fremgang-felt"
					rows="7"
					placeholder="Skriv fremgangsmåden her, hvis du vil kunne slå den op senere"
					bind:value={fremgangsmaade}
				></textarea>
			</section>

			<button class="gem-btn" type="button" onclick={videre}>Videre til tallene</button>

			<!-- TRIN 3 — TALLENE. Spoergsmaalet om appen skal regne staar nu
			     EFTER ingredienserne. Foer 2. september blev hun spurgt paa en
			     skaerm hvor der endnu ikke var noget at regne paa. -->
		{:else if manuel && !harSvaretPaaGaet}
			<section class="card gaet-kort">
				<p class="hint" style="margin-top: 0">
					Nu hvor ingredienserne står, kan appen prøve at regne tallene ud for dig. Den gætter ud
					fra navne og mængder, så tallene er et skøn. Du kan rette dem bagefter.
				</p>
				{#if estimatFejl}
					<div class="status-besked fejl" style="margin: 10px 0">{estimatFejl}</div>
				{/if}
				<!-- De to veje er lige gyldige, saa de skal fylde det samme.
				     Foer 2. september var den ene hoej og bred og den anden lav
				     og smal, og det saa ud som om den ene var den rigtige. -->
				<div class="valg-par">
					<button class="valg-knap" type="button" onclick={estimerFraTekst}>
						Lad appen regne tallene ud
					</button>
					<button
						class="valg-knap sekundaer"
						type="button"
						onclick={() => (harSvaretPaaGaet = true)}
					>
						Jeg skriver dem selv
					</button>
				</div>
			</section>
		{:else}
			<section class="card">
				<div class="card-head">
					<div class="section-label">Makro pr portion</div>
				</div>
				<!-- DEN VIGTIGSTE LINJE PAA SKAERMEN. Skriver hun hele rettens
				     tal paa en ret til fire, bliver hendes dag talt fire gange
				     for hoejt hver eneste gang hun bruger opskriften. Det er den
				     samme fejl der laa tre steder i to apper i august, se
				     SPEC 26.9. -->
				<div class="pr-portion-baand">
					Tallene er <b>pr portion</b> og ikke for hele retten.
				</div>
				{#if estimatFejl}
					<div class="status-besked fejl" style="margin-bottom: 10px">{estimatFejl}</div>
				{/if}
				<div class="makro-grid">
					<label class="makro-felt">
						<span>Protein (g)</span>
						<input type="number" min="0" step="0.1" bind:value={makro.protein} />
					</label>
					<label class="makro-felt">
						<span>Fiber (g)</span>
						<input type="number" min="0" step="0.1" bind:value={makro.fiber} />
					</label>
					<label class="makro-felt">
						<span>Kulhydrater (g)</span>
						<input type="number" min="0" step="0.1" bind:value={makro.kh} />
					</label>
					<label class="makro-felt">
						<span>Fedt (g)</span>
						<input type="number" min="0" step="0.1" bind:value={makro.fedt} />
					</label>
					<label class="makro-felt fuld">
						<span>Kalorier</span>
						<input type="number" min="0" bind:value={makro.kcal} />
					</label>
				</div>
				<!-- Nul fiber er rigtigt paa rigtig mange retter. Den linje her
				     staar i stedet for den spaerre der laa foer. -->
				{#if !(Number(makro.fiber) > 0) && !alleTalNul}
					<div class="rolig-note">
						Nul fiber er helt fint — mange retter har ingen. Du kan gemme alligevel.
					</div>
				{/if}
			</section>

			{#if fejlBesked}
				<div class="status-besked fejl">{fejlBesked}</div>
			{/if}

			<button class="gem-btn" type="button" onclick={gem}>Gem opskrift</button>
			<button
				class="annuller-btn"
				type="button"
				onclick={() => {
					tilstand = 'vaelg';
					trin = 1;
					manuel = false;
					harSvaretPaaGaet = false;
					for (const url of billedePreviews) URL.revokeObjectURL(url);
					billedeFiler = [];
					billedePreviews = [];
				}}
			>
				Start forfra
			</button>
		{/if}
	{:else if tilstand === 'gemmer'}
		<Loading tekst="Gemmer..." />
	{:else if tilstand === 'fejl'}
		<div class="status-besked fejl">{fejlBesked}</div>
		<button
			class="gem-btn"
			type="button"
			onclick={() => {
				tilstand = 'vaelg';
				fejlBesked = null;
			}}
		>
			Prøv igen
		</button>
	{/if}
</div>

<style>
	/* Den anden vej ind, tilfoejet 1. september 2026. */
	.eller {
		display: flex;
		align-items: center;
		gap: 10px;
		margin: 16px 0 12px;
		color: var(--text3);
		font-size: calc(11.5px * var(--fs-scale, 1));
	}

	.eller::before,
	.eller::after {
		content: '';
		flex: 1;
		height: 1px;
		background: var(--border);
	}

	/* Kant og ikke fyldt, saa det kan ses at det er en ANDEN vej og ikke en
	   tredje maade at vaelge et billede paa. Baggrunden staar eksplicit. */
	.skriv-selv-knap {
		display: block;
		width: 100%;
		padding: 13px;
		background: var(--white);
		border: 1.5px solid var(--terra);
		border-radius: 12px;
		color: var(--terra);
		font-size: calc(14px * var(--fs-scale, 1));
		font-family: var(--ff-b);
		font-weight: 600;
		cursor: pointer;
	}

	.gaet-kort {
		background: var(--gdim);
	}

	/* Den vigtigste linje paa skaermen. Se noten i markup. */
	.pr-portion-baand {
		margin-bottom: 12px;
		padding: 11px 13px;
		background: var(--gdim);
		border-radius: 11px;
		color: #8a6a3a;
		font-size: calc(12.5px * var(--fs-scale, 1));
		line-height: 1.45;
	}

	.fremgang-felt {
		display: block;
		width: 100%;
		padding: 12px 13px;
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 11px;
		color: var(--text);
		font-size: calc(14px * var(--fs-scale, 1));
		font-family: var(--ff-b);
		line-height: 1.55;
		box-sizing: border-box;
		resize: vertical;
	}

	/* De to veje til naeringstallene. Samme hoejde, samme bredde, samme
	   skrift — kun farven skiller dem ad. */
	.valg-par {
		display: flex;
		flex-direction: column;
		gap: 9px;
		margin-top: 13px;
	}

	.valg-knap {
		display: block;
		width: 100%;
		padding: 14px;
		background: var(--terra);
		color: #fff;
		font-size: max(16px, calc(14px * var(--fs-scale, 1)));
		font-weight: 600;
		font-family: var(--ff-b);
		border: 1.5px solid var(--terra);
		border-radius: 12px;
		cursor: pointer;
	}

	.valg-knap.sekundaer {
		background: var(--white);
		color: var(--terra);
	}

	/* Enheden er en liste fra 2. september 2026, ikke laengere et frit felt.
	   Den skal fylde det samme som feltet gjorde. */
	select.ing-enhed {
		/* Smallere sidekant end felterne, saa det laengste ord, knivspids,
		   kan staa helt. Skriften bliver paa 16px, ellers zoomer iPhone ind
		   naar hun rammer feltet.

		   Den lille pil er tegnet med i baggrunden. Uden den ligner feltet
		   et almindeligt skrivefelt, og saa er der ingen der opdager at der
		   er noget at vaelge imellem. */
		padding: 8px 22px 8px 8px;
		appearance: none;
		text-align: center;
		text-align-last: center;
		cursor: pointer;
		background-image: url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' fill='none' stroke='%23a08878' stroke-width='1.6' stroke-linecap='round'/%3E%3C/svg%3E");
		background-repeat: no-repeat;
		background-position: right 8px center;
	}

	.egen-enhed {
		display: block;
		width: 100%;
		padding: 9px 11px;
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 10px;
		color: var(--text);
		font-family: var(--ff-b);
		font-size: max(16px, calc(13px * var(--fs-scale, 1)));
		box-sizing: border-box;
	}

	/* Trin-bjaelken. Tilfoejet 2. september 2026 sammen med de tre trin. */
	.trin-bar {
		display: flex;
		gap: 6px;
		margin: 14px 0 0;
	}

	.trin-bar div {
		flex: 1;
		height: 4px;
		border-radius: 99px;
		background: var(--border);
	}

	.trin-bar div.on {
		background: var(--terra);
	}

	.trin-tekst {
		margin-top: 7px;
		color: var(--text3);
		font-size: calc(11px * var(--fs-scale, 1));
		font-weight: 600;
		letter-spacing: 0.04em;
	}

	/* Staar i stedet for den spaerre der laa paa fiber foer 2. september. */
	.rolig-note {
		margin-top: 11px;
		padding: 10px 12px;
		background: var(--sdim);
		border-radius: 11px;
		color: #3f6b4f;
		font-size: calc(11.5px * var(--fs-scale, 1));
		line-height: 1.5;
	}

	.card-tael.valgfri {
		background: none;
		color: var(--text3);
		font-weight: 500;
		text-transform: none;
		letter-spacing: 0;
	}

	/* Tilbage er en knap paa trin 2 og 3, et link paa trin 1. Den skal se
	   ens ud begge steder. */
	button.back {
		background: none;
		border: 0;
		padding: 0;
		font-family: var(--ff-b);
		cursor: pointer;
	}

	.page {
		padding: 18px 18px 100px;
		max-width: 520px;
		margin: 0 auto;
	}

	.page-header {
		margin-bottom: 18px;
	}

	.back {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-size: calc(12px * var(--fs-scale, 1));
		color: var(--text2);
		text-decoration: none;
		margin-bottom: 12px;
	}

	.eyebrow {
		font-size: calc(10px * var(--fs-scale, 1));
		font-weight: 600;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--text3);
	}

	h1 {
		font-family: var(--ff-d);
		font-size: calc(28px * var(--fs-scale, 1));
		font-weight: 600;
		letter-spacing: -0.02em;
		margin: 4px 0 0;
		line-height: 1.05;
		color: var(--text);
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
		background: #fbeeea;
		border-color: #f0d6cf;
		color: #8a4a3e;
	}

	.vaelg-card,
	.analyse-card {
		display: flex;
		flex-direction: column;
		align-items: stretch;
		gap: 12px;
		padding: 24px;
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 14px;
		text-align: center;
	}

	.upload-knap {
		position: relative;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		padding: 14px;
		background: var(--terra);
		color: #fff;
		font-size: max(16px, calc(14px * var(--fs-scale, 1)));
		font-weight: 600;
		border-radius: 12px;
		cursor: pointer;
		font-family: var(--ff-b);
	}

	.upload-knap.sekundaer {
		background: var(--white);
		color: var(--text);
		border: 1px solid var(--border);
	}

	.upload-knap input {
		position: absolute;
		inset: 0;
		opacity: 0;
		cursor: pointer;
	}

	.preview-billede {
		width: 100%;
		max-height: 280px;
		object-fit: cover;
		border-radius: 12px;
		margin-bottom: 12px;
	}

	.billede-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 8px;
		margin-bottom: 4px;
	}

	.billede-grid.kompakt img {
		width: 100%;
		aspect-ratio: 1 / 1;
		object-fit: cover;
		border-radius: 8px;
	}

	.billede-tile {
		position: relative;
		aspect-ratio: 1 / 1;
		border-radius: 10px;
		overflow: hidden;
		background: var(--bg2);
	}

	.billede-tile img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.billede-tile-nr {
		position: absolute;
		top: 4px;
		left: 4px;
		background: rgba(0, 0, 0, 0.6);
		color: #fff;
		font-size: 11px;
		font-weight: 700;
		padding: 2px 6px;
		border-radius: 6px;
	}

	.billede-tile-slet {
		position: absolute;
		top: 4px;
		right: 4px;
		background: rgba(0, 0, 0, 0.6);
		color: #fff;
		border: none;
		border-radius: 50%;
		width: 24px;
		height: 24px;
		font-size: 16px;
		line-height: 1;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.info-besked {
		padding: 10px 12px;
		background: #fbf3e6;
		border: 1px solid #ecd9b3;
		border-radius: 10px;
		color: #6b5024;
		font-size: calc(12px * var(--fs-scale, 1));
		text-align: center;
	}

	.analyser-knap {
		padding: 14px;
		background: var(--terra);
		color: #fff;
		font-size: max(16px, calc(14px * var(--fs-scale, 1)));
		font-weight: 600;
		border: none;
		border-radius: 12px;
		cursor: pointer;
		font-family: var(--ff-b);
	}

	.hint {
		font-size: calc(13px * var(--fs-scale, 1));
		color: var(--text2);
		line-height: 1.5;
		margin: 0;
	}

	.hint.center {
		text-align: center;
		margin-top: 10px;
	}

	.hint.small {
		font-size: calc(11px * var(--fs-scale, 1));
		margin-top: 6px;
	}

	.card {
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 14px;
		padding: 16px;
		margin-bottom: 14px;
	}

	.card-head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		margin-bottom: 10px;
	}

	.section-label {
		font-size: calc(10px * var(--fs-scale, 1));
		font-weight: 600;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: var(--text3);
	}

	.card-tael {
		font-size: calc(11px * var(--fs-scale, 1));
		color: var(--text3);
	}

	.felt {
		display: block;
		margin-bottom: 12px;
	}

	.felt:last-child {
		margin-bottom: 0;
	}

	.felt-label {
		display: block;
		font-size: calc(11px * var(--fs-scale, 1));
		color: var(--text3);
		margin-bottom: 4px;
		font-weight: 600;
	}

	.felt input {
		width: 100%;
		padding: 10px 12px;
		border: 1px solid var(--border);
		border-radius: 8px;
		background: var(--bg2);
		font-family: var(--ff-b);
		font-size: max(16px, calc(14px * var(--fs-scale, 1)));
		color: var(--text);
		outline: none;
		box-sizing: border-box;
	}

	.felt input:focus {
		border-color: var(--terra);
	}

	.makro-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 10px;
	}

	.makro-felt {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.makro-felt.fuld {
		grid-column: span 2;
	}

	.makro-felt span {
		font-size: calc(11px * var(--fs-scale, 1));
		color: var(--text3);
		font-weight: 600;
	}

	.makro-felt input {
		width: 100%;
		padding: 8px 10px;
		border: 1px solid var(--border);
		border-radius: 8px;
		background: var(--bg2);
		font-family: var(--ff-b);
		font-size: max(16px, calc(14px * var(--fs-scale, 1)));
		color: var(--text);
		outline: none;
		box-sizing: border-box;
	}

	/* To linjer pr ingrediens, se noten i markup. Navnet oeverst i fuld
	   bredde, de smaa felter under. En tynd streg mellem dem, saa det kan ses
	   hvor den ene ingrediens slutter og den naeste begynder. */
	.ing-rad {
		display: flex;
		flex-direction: column;
		gap: 5px;
		padding-bottom: 10px;
		margin-bottom: 10px;
		border-bottom: 1px solid var(--border);
	}

	.ing-rad:last-of-type {
		border-bottom: none;
		padding-bottom: 0;
	}

	.ing-tal {
		display: grid;
		grid-template-columns: 1fr 118px 38px;
		gap: 5px;
	}

	.ing-rad input,
	.ing-rad select {
		padding: 8px 10px;
		border: 1px solid var(--border);
		border-radius: 8px;
		background: var(--bg2);
		font-family: var(--ff-b);
		font-size: max(16px, calc(13px * var(--fs-scale, 1)));
		color: var(--text);
		outline: none;
		min-width: 0;
	}

	.ing-slet {
		border: 1px solid var(--border);
		background: var(--white);
		color: var(--text3);
		border-radius: 8px;
		cursor: pointer;
		font-size: 16px;
	}

	.tilfoj-btn {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		margin-top: 6px;
		padding: 8px 12px;
		background: var(--white);
		border: 1px dashed var(--border);
		border-radius: 8px;
		font-size: calc(12px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--text2);
		cursor: pointer;
		font-family: var(--ff-b);
	}

	.gem-btn {
		display: block;
		width: 100%;
		padding: 14px;
		background: var(--terra);
		color: #fff;
		font-size: max(16px, calc(14px * var(--fs-scale, 1)));
		font-weight: 600;
		border: none;
		border-radius: 12px;
		cursor: pointer;
		font-family: var(--ff-b);
		margin-bottom: 8px;
	}

	.annuller-btn {
		display: block;
		width: 100%;
		padding: 10px;
		background: var(--white);
		color: var(--text2);
		font-size: calc(12px * var(--fs-scale, 1));
		font-weight: 600;
		border: 1px solid var(--border);
		border-radius: 10px;
		cursor: pointer;
		font-family: var(--ff-b);
	}
</style>
