<script lang="ts">
	import { getContext, onMount } from 'svelte';
	import { portal } from '$lib/actions/portal';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import type { User } from 'firebase/auth';
	import { gemMinOpskrift, hentMinOpskrift, sletMinOpskrift } from '$lib/firestore/minOpskrift';
	import { gemMaaltid } from '$lib/firestore/kost';
	import { storage } from '$lib/firebase';
	import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
	import { komprimerBillede } from '$lib/utils/billede';
	import type {
		MinOpskrift,
		MinOpskriftIngrediens,
		MinOpskriftMakro
	} from '$lib/content/minOpskrift';
	import {
		DEFAULT_MAKRO,
		omberegnMakroForNytAntalPortioner,
		skalerMakro
	} from '$lib/content/minOpskrift';
	import {
		formatDatoKey,
		gaetMaaltidstype,
		MAALTIDSTYPER,
		MAALTIDSTYPE_LABELS,
		type Maaltidstype
	} from '$lib/content/kost';
	import { ENHEDER } from '$lib/content/mineOpskrifter3';
	import Icon from '$lib/components/Icon.svelte';
	import Loading from '$lib/components/Loading.svelte';
	import BekraeftModal from '$lib/components/BekraeftModal.svelte';

	const getUser = getContext<() => User | null>('user');
	const user = $derived(getUser());

	const id = $derived(page.params.id ?? '');

	let opskrift = $state<MinOpskrift | null>(null);
	let loading = $state(true);
	let fejl = $state<string | null>(null);
	let sletter = $state(false);
	let editMode = $state(false);
	let gemmer = $state(false);
	let gemBesked = $state<string | null>(null);

	// Edit-state — kopieres fra opskrift når rediger trykkes
	let navn = $state('');
	let antalPortioner = $state(4);
	let ingredienser = $state<MinOpskriftIngrediens[]>([]);
	let makro = $state<MinOpskriftMakro>({ ...DEFAULT_MAKRO });
	let nyBilledeFil = $state<File | null>(null);
	let nyBilledePreview = $state<string | null>(null);
	/**
	 * Saadan laver hun retten. Feltet blev til 1. september 2026, men kunne
	 * kun skrives ved oprettelsen. Hun kunne hverken laese eller rette det
	 * bagefter, saa teksten laa gemt uden vej ind til. Rettet 2. september.
	 * Langt de fleste opskrifter har den ikke, saa skaermen skal kunne staa
	 * uden.
	 */
	let fremgangsmaade = $state('');
	/** Naar appen regner naeringstallene ud af ingredienserne. */
	let regner = $state(false);
	let regneFejl = $state<string | null>(null);

	/** Et tomt maengde-felt. Se noten paa opret-siden. */
	const TOM_MAENGDE = undefined as unknown as number;
	const ANDET = '__andet__';

	// Snapshot af original makro + antal portioner taget ved start af rediger.
	// Bruges af effekten nedenfor til at omberegne makro-pr-portion saa
	// total-makro bevares naar kunden aendrer antal portioner. Hvis hun fx
	// retter fra 4 til 2 portioner, bliver pr-portion-makroen fordoblet
	// (total er det samme — opskriften har ikke aendret indhold).
	let originalAntalPortioner = $state(1);
	let originalMakro = $state<MinOpskriftMakro>({ ...DEFAULT_MAKRO });

	// Læg-som-måltid modal
	let viserMaaltidModal = $state(false);

	$effect(() => {
		if (typeof document === 'undefined') return;
		if (viserMaaltidModal) {
			document.body.style.overflow = 'hidden';
			return () => {
				document.body.style.overflow = '';
			};
		}
	});
	let maaltidPortioner = $state(1);
	let maaltidDato = $state(formatDatoKey());
	let maaltidType = $state<Maaltidstype>(gaetMaaltidstype());
	let gemmerMaaltid = $state(false);
	let maaltidBesked = $state<string | null>(null);

	const skaleretMakro = $derived(
		opskrift
			? skalerMakro(opskrift.makroPrPortion, Math.max(0.01, maaltidPortioner))
			: { ...DEFAULT_MAKRO }
	);

	onMount(async () => {
		const u = user;
		if (!u) {
			fejl = 'Du skal være logget ind.';
			loading = false;
			return;
		}
		try {
			opskrift = await hentMinOpskrift(u.uid, id);
			if (!opskrift) fejl = 'Opskriften kunne ikke findes.';
		} catch (e) {
			console.error(e);
			fejl = 'Kunne ikke hente opskriften.';
		} finally {
			loading = false;
		}
	});

	function startRediger() {
		if (!opskrift) return;
		navn = opskrift.navn;
		antalPortioner = opskrift.antalPortioner;
		ingredienser = opskrift.ingredienser.map((i) => ({ ...i }));
		makro = { ...opskrift.makroPrPortion };
		originalAntalPortioner = opskrift.antalPortioner;
		originalMakro = { ...opskrift.makroPrPortion };
		fremgangsmaade = opskrift.fremgangsmaade ?? '';
		nyBilledeFil = null;
		nyBilledePreview = null;
		regneFejl = null;
		editMode = true;
		gemBesked = null;
	}

	// Naar kunden aendrer antal portioner i rediger-mode, omberegn makro-
	// pr-portion saa total-makro bevares. Pure-funktionen er testet i
	// minOpskrift.test.ts (alle 5 felter + edge cases). Skipper omberegning
	// hvis vaerdien er samme som original (rediger lige startet).
	$effect(() => {
		if (!editMode) return;
		const nyt = antalPortioner;
		if (!Number.isFinite(nyt) || nyt <= 0) return;
		if (nyt === originalAntalPortioner) return;
		makro = omberegnMakroForNytAntalPortioner(originalMakro, originalAntalPortioner, nyt);
	});

	function annullerRediger() {
		editMode = false;
		nyBilledeFil = null;
		nyBilledePreview = null;
		gemBesked = null;
	}

	function handleNyBillede(e: Event) {
		const input = e.target as HTMLInputElement;
		const fil = input.files?.[0];
		if (!fil) return;
		if (!fil.type.startsWith('image/')) {
			gemBesked = 'Vælg venligst en billed-fil.';
			return;
		}
		if (fil.size > 5 * 1024 * 1024) {
			gemBesked = 'Billedet er for stort. Max 5 MB.';
			return;
		}
		nyBilledeFil = fil;
		nyBilledePreview = URL.createObjectURL(fil);
		gemBesked = null;
	}

	function fjernNyBillede() {
		nyBilledeFil = null;
		nyBilledePreview = null;
	}

	function tilfojIngrediens() {
		ingredienser = [...ingredienser, { navn: '', maengde: TOM_MAENGDE, enhed: 'g' }];
	}

	/** Se noten paa opret-siden: staar der en enhed vi ikke kender, ER den hendes egen. */
	function erEgenEnhed(enhed: string): boolean {
		return !ENHEDER.includes((enhed ?? '').trim());
	}

	function vaelgEnhed(i: number, vaerdi: string) {
		ingredienser[i].enhed = vaerdi === ANDET ? '' : vaerdi;
	}

	/**
	 * Lad appen regne naeringstallene ud af ingredienserne. Hjaelpen fandtes
	 * kun da opskriften blev oprettet, saa rettede hun en ingrediens
	 * bagefter, stod hun med regnestykket selv.
	 *
	 * DEN GAETTER, og det staar paa skaermen. Alle tal kan rettes bagefter.
	 */
	async function regnTallene() {
		const brugbare = ingredienser.filter((i) => i.navn.trim());
		if (brugbare.length === 0) {
			regneFejl = 'Skriv mindst én ingrediens først.';
			return;
		}
		regner = true;
		regneFejl = null;
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
			const data = (await res.json()) as { makroPrPortion?: MinOpskriftMakro; error?: string };
			if (data.error || !data.makroPrPortion) {
				regneFejl =
					'Der var ikke nok at regne på. Skriv hvor meget der er af hver ingrediens, eller skriv tallene selv.';
			} else {
				makro = data.makroPrPortion;
				// Saa omregningen ved portions-skift regner videre paa de nye tal.
				originalMakro = { ...data.makroPrPortion };
				originalAntalPortioner = antalPortioner;
			}
		} catch (e) {
			console.error(e);
			const grund = e instanceof Error && e.message ? ` ${e.message}` : '';
			regneFejl = `Kunne ikke regne på opskriften.${grund} Skriv tallene selv, eller prøv igen.`;
		} finally {
			regner = false;
		}
	}

	function fjernIngrediens(i: number) {
		ingredienser = ingredienser.filter((_, idx) => idx !== i);
	}

	async function gem() {
		const u = user;
		if (!u || gemmer) return;
		// A-Z #12: valider navn + ingredienser foer gem. F0r blev tomt navn
		// gemt som 'Min opskrift' (silent default) og tom ingrediens-liste
		// gemt som tom array (intet indhold) — saa kunden kunne uforvarende
		// miste sit indhold ved redigering. Nu viser vi tydelig fejl i UI'et.
		const navnTrimmet = navn.trim();
		if (!navnTrimmet) {
			gemBesked = 'Opskriften skal have et navn.';
			return;
		}
		const rensede = ingredienser.filter((i) => i.navn.trim());
		if (rensede.length === 0) {
			gemBesked = 'Opskriften skal have mindst én ingrediens.';
			return;
		}
		gemmer = true;
		gemBesked = null;
		try {
			let nyBilledeUrl: string | undefined;
			let gammelBilledeUrl: string | undefined;
			if (nyBilledeFil) {
				// Upload nyt billede (komprimeret — sparer plads + hurtigere upload)
				const thumbnail = await komprimerBillede(nyBilledeFil);
				const billedeId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
				const sti = `users/${u.uid}/opskrift-billeder/${billedeId}`;
				const billedeRef = ref(storage, sti);
				await uploadBytes(billedeRef, thumbnail, { contentType: thumbnail.type });
				nyBilledeUrl = await getDownloadURL(billedeRef);
				gammelBilledeUrl = opskrift?.billedeUrl;
			}

			await gemMinOpskrift(u.uid, id, {
				navn: navnTrimmet,
				antalPortioner: Math.max(1, antalPortioner),
				ingredienser: rensede.map((i) => ({ ...i, maengde: Number(i.maengde) || 0 })),
				makroPrPortion: makro,
				// Tom tekst skrives som tom, ikke som ingenting. Ellers kunne
				// hun ikke slette en fremgangsmaade hun havde fortrudt.
				fremgangsmaade: fremgangsmaade.trim(),
				...(nyBilledeUrl ? { billedeUrl: nyBilledeUrl } : {})
			});

			// Best-effort sletning af gammelt billede
			if (gammelBilledeUrl) {
				try {
					const gammelRef = ref(storage, gammelBilledeUrl);
					await deleteObject(gammelRef);
				} catch (e) {
					console.warn('Kunne ikke slette gammelt billede:', e);
				}
			}

			// Genindlæs
			opskrift = await hentMinOpskrift(u.uid, id);
			editMode = false;
			nyBilledeFil = null;
			nyBilledePreview = null;
			gemBesked = 'Gemt.';
			setTimeout(() => (gemBesked = null), 2500);
		} catch (e) {
			console.error(e);
			gemBesked = 'Kunne ikke gemme. Prøv igen.';
		} finally {
			gemmer = false;
		}
	}

	function aabnMaaltidModal() {
		if (!opskrift) return;
		maaltidPortioner = 1;
		maaltidDato = formatDatoKey();
		maaltidType = gaetMaaltidstype();
		maaltidBesked = null;
		viserMaaltidModal = true;
	}

	function lukMaaltidModal() {
		if (gemmerMaaltid) return;
		viserMaaltidModal = false;
		maaltidBesked = null;
	}

	async function gemSomMaaltid() {
		const u = user;
		if (!u || !opskrift || gemmerMaaltid) return;
		// A-Z #9: valider portion-input. Samme fix som paa Linns opskrifter.
		if (!Number.isFinite(maaltidPortioner) || maaltidPortioner < 0.25) {
			maaltidBesked = 'Skriv et antal portioner mellem 0,25 og 20.';
			return;
		}
		if (maaltidPortioner > 20) {
			maaltidBesked = 'Antal portioner kan h0jst vaere 20.';
			return;
		}
		const portioner = maaltidPortioner;
		gemmerMaaltid = true;
		maaltidBesked = null;
		try {
			const m = skalerMakro(opskrift.makroPrPortion, portioner);
			const portionTekst = portioner === 1 ? 'portion' : 'portioner';
			await gemMaaltid(u.uid, {
				navn: opskrift.navn,
				type: maaltidType,
				dato: maaltidDato,
				items: [
					{
						foodId: '',
						portion: portioner,
						manuel: { navn: opskrift.navn, enhed: portionTekst },
						opskriftRef: { id: opskrift.id, erEgen: true }
					}
				],
				totalP: m.protein,
				totalF: m.fiber,
				totalKh: m.kh,
				totalFedt: m.fedt,
				totalKcal: m.kcal
			});
			viserMaaltidModal = false;
			goto(`/app/moduler/30-30-3?tab=dagbog&dato=${maaltidDato}`);
		} catch (e) {
			console.error(e);
			maaltidBesked = 'Kunne ikke gemme måltidet. Prøv igen.';
		} finally {
			gemmerMaaltid = false;
		}
	}

	let viserSletBekraeft = $state(false);
	function aabnSletBekraeft() {
		if (!sletter) viserSletBekraeft = true;
	}
	async function slet() {
		const u = user;
		if (!u || sletter) return;
		viserSletBekraeft = false;
		sletter = true;
		try {
			await sletMinOpskrift(u.uid, id);
			goto('/app/moduler/30-30-3?tab=mine');
		} catch (e) {
			console.error(e);
			fejl = 'Kunne ikke slette.';
			sletter = false;
		}
	}
</script>

<div class="page">
	<header class="page-header">
		<a class="back" href="/app/moduler/30-30-3?tab=mine">
			<Icon name="arrow-l" size={14} color="var(--text2)" />
			<span>Mine opskrifter</span>
		</a>
	</header>

	{#if loading}
		<Loading tekst="Henter..." />
	{:else if fejl}
		<div class="status-besked fejl">{fejl}</div>
	{:else if opskrift}
		{#if opskrift.billedeUrl && !editMode}
			<img class="billede" src={opskrift.billedeUrl} alt={opskrift.navn} />
		{/if}

		{#if !editMode}
			<!-- VIS-MODE -->
			<div class="titel-rad">
				<h1>{opskrift.navn}</h1>
				<button class="rediger-knap" type="button" onclick={startRediger} aria-label="Rediger">
					<Icon name="settings" size={14} color="var(--text2)" />
					<span>Rediger</span>
				</button>
			</div>
			<div class="meta">
				{opskrift.antalPortioner}
				{opskrift.antalPortioner === 1 ? 'portion' : 'portioner'}
			</div>

			<section class="card">
				<div class="section-label">Makro pr portion</div>
				<div class="makro-grid">
					<div class="makro-felt">
						<div class="makro-val">{opskrift.makroPrPortion.protein}g</div>
						<div class="makro-lbl">Protein</div>
					</div>
					<div class="makro-felt">
						<div class="makro-val">{opskrift.makroPrPortion.fiber}g</div>
						<div class="makro-lbl">Fiber</div>
					</div>
					<div class="makro-felt">
						<div class="makro-val">{opskrift.makroPrPortion.kh}g</div>
						<div class="makro-lbl">Kulhydrater</div>
					</div>
					<div class="makro-felt">
						<div class="makro-val">{opskrift.makroPrPortion.fedt}g</div>
						<div class="makro-lbl">Fedt</div>
					</div>
					<div class="makro-felt fuld">
						<div class="makro-val">{opskrift.makroPrPortion.kcal}</div>
						<div class="makro-lbl">Kalorier</div>
					</div>
				</div>
			</section>

			<section class="card">
				<div class="section-label">Ingredienser</div>
				<ul class="ing-liste">
					{#each opskrift.ingredienser as ing, i (i)}
						<li class="ing-item">
							<!-- Staar der ingen maengde, skriver vi ikke "0 g". -->
							<span class="ing-maengde"
								>{ing.maengde ? `${ing.maengde} ${ing.enhed ?? ''}`.trim() : ''}</span
							>
							<span class="ing-navn">{ing.navn}</span>
						</li>
					{/each}
				</ul>
			</section>

			<!-- Fremgangsmaaden. Den blev skrevet ved oprettelsen, men blev
			     aldrig vist bagefter. Rettet 2. september 2026. De fleste
			     opskrifter har den ikke, saa kortet staar kun naar der er
			     noget at vise. -->
			{#if opskrift.fremgangsmaade?.trim()}
				<section class="card">
					<div class="section-label">Sådan laver du den</div>
					<p class="fremgang-tekst">{opskrift.fremgangsmaade}</p>
				</section>
			{/if}

			{#if gemBesked}
				<div class="status-besked ok">{gemBesked}</div>
			{/if}

			<button class="primaer-knap" type="button" onclick={aabnMaaltidModal}>
				<Icon name="plus" size={14} color="#fff" />
				<span>Læg ind som måltid</span>
			</button>

			<button class="slet-knap" type="button" onclick={aabnSletBekraeft} disabled={sletter}>
				{sletter ? 'Sletter...' : 'Slet opskrift'}
			</button>
		{:else}
			<!-- REDIGER-MODE -->
			<section class="card">
				<div class="section-label">Billede</div>
				{#if nyBilledePreview}
					<img class="billede-preview" src={nyBilledePreview} alt="Nyt billede" />
					<div class="billede-info">Nyt billede valgt — gemmes når du trykker "Gem ændringer".</div>
					<div class="billede-knapper">
						<label class="billede-skift">
							<input type="file" accept="image/*" onchange={handleNyBillede} hidden />
							<span>Vælg et andet</span>
						</label>
						<button class="billede-fortryd" type="button" onclick={fjernNyBillede}>
							Fortryd skift
						</button>
					</div>
				{:else if opskrift.billedeUrl}
					<img class="billede-preview" src={opskrift.billedeUrl} alt={opskrift.navn} />
					<div class="billede-knapper">
						<label class="billede-skift">
							<input type="file" accept="image/*" onchange={handleNyBillede} hidden />
							<span>Skift billede</span>
						</label>
					</div>
				{:else}
					<div class="billede-info">Ingen billede gemt endnu.</div>
					<div class="billede-knapper">
						<label class="billede-skift">
							<input type="file" accept="image/*" onchange={handleNyBillede} hidden />
							<span>Tilføj billede</span>
						</label>
					</div>
				{/if}
			</section>

			<section class="card">
				<label class="felt">
					<span class="felt-label">Opskriftens navn</span>
					<input type="text" bind:value={navn} />
				</label>
				<label class="felt">
					<span class="felt-label">Antal portioner</span>
					<input type="number" min="1" max="20" bind:value={antalPortioner} />
					<span class="felt-hjaelp">
						Hvis du ændrer antal portioner, omberegnes makro pr portion automatisk så den samlede
						opskrift har samme værdier.
					</span>
				</label>
			</section>

			<section class="card">
				<div class="card-head">
					<div class="section-label">Ingredienser</div>
					<div class="card-tael">{ingredienser.length}</div>
				</div>
				<!-- To linjer pr ingrediens, som paa opret-siden. Navnet faar
				     hele bredden, de smaa felter staar under. -->
				{#each ingredienser as ing, i (i)}
					<div class="ing-rad">
						<input
							type="text"
							class="ing-navn-input"
							placeholder="Ingrediens"
							bind:value={ing.navn}
						/>
						<div class="ing-tal">
							<input
								type="number"
								class="ing-maengde-input"
								placeholder="Mængde"
								min="0"
								step="any"
								bind:value={ing.maengde}
							/>
							<select
								class="ing-enhed-input"
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

			<section class="card">
				<div class="card-head">
					<div class="section-label">Makro pr portion</div>
				</div>
				<div class="pr-portion-baand">
					Tallene er <b>pr portion</b> og ikke for hele retten.
				</div>
				<!-- Hjaelpen til tallene fandtes kun da opskriften blev
				     oprettet. Rettede hun en ingrediens bagefter, stod hun med
				     regnestykket selv. -->
				{#if regner}
					<Loading tekst="Regner på opskriften..." />
				{:else}
					<button class="regn-knap" type="button" onclick={regnTallene}>
						Lad appen regne tallene ud af ingredienserne
					</button>
				{/if}
				{#if regneFejl}
					<div class="status-besked fejl" style="margin-top: 10px">{regneFejl}</div>
				{/if}
				<div class="makro-edit-grid">
					<label class="makro-edit-felt">
						<span>Protein (g)</span>
						<input type="number" min="0" step="0.1" bind:value={makro.protein} />
					</label>
					<label class="makro-edit-felt">
						<span>Fiber (g)</span>
						<input type="number" min="0" step="0.1" bind:value={makro.fiber} />
					</label>
					<label class="makro-edit-felt">
						<span>Kulhydrater (g)</span>
						<input type="number" min="0" step="0.1" bind:value={makro.kh} />
					</label>
					<label class="makro-edit-felt">
						<span>Fedt (g)</span>
						<input type="number" min="0" step="0.1" bind:value={makro.fedt} />
					</label>
					<label class="makro-edit-felt fuld">
						<span>Kalorier</span>
						<input type="number" min="0" bind:value={makro.kcal} />
					</label>
				</div>
			</section>

			{#if gemBesked}
				<div
					class="status-besked"
					class:fejl={gemBesked.startsWith('Kunne')}
					class:ok={!gemBesked.startsWith('Kunne')}
				>
					{gemBesked}
				</div>
			{/if}

			<button class="gem-btn" type="button" onclick={gem} disabled={gemmer}>
				{gemmer ? 'Gemmer...' : 'Gem ændringer'}
			</button>
			<button class="annuller-btn" type="button" onclick={annullerRediger} disabled={gemmer}>
				Annullér
			</button>
		{/if}
	{/if}
</div>

{#if viserMaaltidModal && opskrift}
	<div
		class="modal-bag"
		use:portal
		role="dialog"
		aria-modal="true"
		tabindex="-1"
		onclick={(e) => {
			if (e.target === e.currentTarget) lukMaaltidModal();
		}}
		onkeydown={(e) => {
			if (e.key === 'Escape') lukMaaltidModal();
		}}
	>
		<div class="modal">
			<div class="modal-head">
				<h2>Læg ind som måltid</h2>
				<button class="modal-luk" type="button" onclick={lukMaaltidModal} aria-label="Luk">
					×
				</button>
			</div>

			<div class="modal-info">
				<div class="modal-info-navn">{opskrift.navn}</div>
				<div class="modal-info-meta">
					Hele opskriften: {opskrift.antalPortioner}
					{opskrift.antalPortioner === 1 ? 'portion' : 'portioner'}
				</div>
			</div>

			<label class="felt">
				<span class="felt-label">Hvor mange portioner spiser du?</span>
				<div class="portion-rad">
					{#each [0.5, 1, 1.5, 2] as p (p)}
						<button
							type="button"
							class="portion-chip"
							class:aktiv={maaltidPortioner === p}
							onclick={() => (maaltidPortioner = p)}
						>
							{p}
						</button>
					{/each}
				</div>
				<input
					type="number"
					min="0.25"
					step="0.25"
					bind:value={maaltidPortioner}
					class="portion-input"
				/>
			</label>

			<label class="felt">
				<span class="felt-label">Dato</span>
				<input type="date" bind:value={maaltidDato} />
			</label>

			<label class="felt">
				<span class="felt-label">Måltidstype</span>
				<select bind:value={maaltidType}>
					{#each MAALTIDSTYPER as t (t)}
						<option value={t}>{MAALTIDSTYPE_LABELS[t]}</option>
					{/each}
				</select>
			</label>

			<div class="modal-makro">
				<div class="modal-makro-titel">Makro i dette måltid</div>
				<div class="modal-makro-grid">
					<div><strong>{skaleretMakro.protein}g</strong><span>Protein</span></div>
					<div><strong>{skaleretMakro.fiber}g</strong><span>Fiber</span></div>
					<div><strong>{skaleretMakro.kh}g</strong><span>Kulhydrater</span></div>
					<div><strong>{skaleretMakro.fedt}g</strong><span>Fedt</span></div>
					<div class="fuld"><strong>{skaleretMakro.kcal}</strong><span>Kalorier</span></div>
				</div>
			</div>

			{#if maaltidBesked}
				<div class="status-besked fejl">{maaltidBesked}</div>
			{/if}

			<button
				class="primaer-knap"
				type="button"
				onclick={gemSomMaaltid}
				disabled={gemmerMaaltid || maaltidPortioner <= 0}
			>
				{gemmerMaaltid ? 'Gemmer...' : 'Læg ind i dagbog'}
			</button>
			<button class="annuller-btn" type="button" onclick={lukMaaltidModal} disabled={gemmerMaaltid}>
				Annullér
			</button>
		</div>
	</div>
{/if}

{#if viserSletBekraeft}
	<BekraeftModal
		titel="Slet denne opskrift?"
		beskrivelse="Opskriften slettes permanent og kan ikke gendannes."
		bekraeftTekst="Slet"
		destruktiv
		arbejder={sletter}
		onBekraeft={() => void slet()}
		onAnnuller={() => (viserSletBekraeft = false)}
	/>
{/if}

<style>
	.page {
		padding: 18px 18px 100px;
		max-width: 520px;
		margin: 0 auto;
	}

	.page-header {
		margin-bottom: 14px;
	}

	.back {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-size: calc(12px * var(--fs-scale, 1));
		color: var(--text2);
		text-decoration: none;
	}

	.billede {
		width: 100%;
		max-height: 300px;
		object-fit: cover;
		border-radius: 14px;
		margin-bottom: 14px;
	}

	.titel-rad {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 10px;
	}

	h1 {
		font-family: var(--ff-d);
		font-size: calc(26px * var(--fs-scale, 1));
		font-weight: 600;
		letter-spacing: -0.02em;
		margin: 0;
		line-height: 1.1;
		color: var(--text);
		flex: 1;
		min-width: 0;
	}

	.rediger-knap {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 6px 10px;
		background: var(--white);
		color: var(--text2);
		font-size: calc(11px * var(--fs-scale, 1));
		font-weight: 600;
		border: 1px solid var(--border);
		border-radius: 8px;
		cursor: pointer;
		font-family: var(--ff-b);
		flex-shrink: 0;
	}

	.rediger-knap:hover {
		border-color: var(--terra);
		color: var(--terra);
	}

	.meta {
		font-size: calc(12px * var(--fs-scale, 1));
		color: var(--text3);
		margin-top: 4px;
		margin-bottom: 14px;
	}

	.status-besked {
		padding: 12px 16px;
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 12px;
		color: var(--text2);
		font-size: calc(13px * var(--fs-scale, 1));
		text-align: center;
		margin-bottom: 10px;
	}

	.status-besked.fejl {
		color: #8a4a3e;
		background: #fbeeea;
		border-color: #f0d6cf;
	}

	.status-besked.ok {
		background: var(--sdim);
		border-color: var(--sage);
		color: var(--text);
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
		margin-bottom: 12px;
	}

	.card-tael {
		font-size: calc(11px * var(--fs-scale, 1));
		color: var(--text3);
	}

	.makro-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 10px;
	}

	.makro-felt {
		padding: 10px 12px;
		background: var(--bg2);
		border-radius: 10px;
		text-align: center;
	}

	.makro-felt.fuld {
		grid-column: span 2;
	}

	.makro-val {
		font-family: var(--ff-d);
		font-size: calc(20px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--terra);
	}

	.makro-lbl {
		font-size: calc(11px * var(--fs-scale, 1));
		color: var(--text3);
		margin-top: 2px;
	}

	.ing-liste {
		list-style: none;
		padding: 0;
		margin: 0;
	}

	.ing-item {
		display: flex;
		gap: 10px;
		padding: 8px 0;
		border-top: 1px solid var(--border);
		font-size: calc(13px * var(--fs-scale, 1));
	}

	.ing-item:first-child {
		border-top: none;
	}

	.ing-maengde {
		flex-shrink: 0;
		min-width: 80px;
		font-weight: 600;
		color: var(--text2);
	}

	.ing-navn {
		color: var(--text);
	}

	/* REDIGER-MODE STYLES */
	.billede-preview {
		display: block;
		width: 100%;
		max-height: 240px;
		object-fit: cover;
		border-radius: 10px;
		margin-bottom: 10px;
	}

	.billede-info {
		font-size: calc(12px * var(--fs-scale, 1));
		color: var(--text3);
		margin-bottom: 10px;
	}

	.billede-knapper {
		display: flex;
		gap: 8px;
		flex-wrap: wrap;
	}

	.billede-skift {
		display: inline-flex;
		align-items: center;
		padding: 8px 14px;
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 8px;
		font-size: calc(12px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--text2);
		cursor: pointer;
		font-family: var(--ff-b);
	}

	.billede-skift:hover {
		border-color: var(--terra);
		color: var(--terra);
	}

	.billede-fortryd {
		padding: 8px 14px;
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 8px;
		font-size: calc(12px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--text3);
		cursor: pointer;
		font-family: var(--ff-b);
	}

	.felt {
		display: block;
		margin-bottom: 12px;
	}

	.felt:last-child {
		margin-bottom: 0;
	}

	.felt-hjaelp {
		display: block;
		font-size: calc(11px * var(--fs-scale, 1));
		color: var(--text3);
		margin-top: 6px;
		line-height: 1.4;
		font-style: italic;
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

	.makro-edit-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 10px;
	}

	.makro-edit-felt {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.makro-edit-felt.fuld {
		grid-column: span 2;
	}

	.makro-edit-felt span {
		font-size: calc(11px * var(--fs-scale, 1));
		color: var(--text3);
		font-weight: 600;
	}

	.makro-edit-felt input {
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

	/* To linjer pr ingrediens, som paa opret-siden. Navnet oeverst i fuld
	   bredde, de smaa felter under, og en tynd streg mellem dem. Lavet om 2.
	   september 2026, da enheden blev en liste og navnefeltet blev for
	   smalt paa en telefon. */
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

	select.ing-enhed-input {
		/* Den lille pil er tegnet med i baggrunden. Uden den ligner feltet et
		   almindeligt skrivefelt. Skriften bliver paa 16px, ellers zoomer
		   iPhone ind naar hun rammer feltet. */
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
		box-sizing: border-box;
	}

	/* Fremgangsmaaden, baade at laese og at skrive. */
	.fremgang-tekst {
		margin: 0;
		color: var(--text2);
		font-size: calc(13.5px * var(--fs-scale, 1));
		line-height: 1.7;
		white-space: pre-wrap;
	}

	.fremgang-felt {
		display: block;
		width: 100%;
		padding: 12px 13px;
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 11px;
		color: var(--text);
		font-size: max(16px, calc(14px * var(--fs-scale, 1)));
		font-family: var(--ff-b);
		line-height: 1.55;
		box-sizing: border-box;
		resize: vertical;
	}

	.card-tael.valgfri {
		background: none;
		color: var(--text3);
		font-weight: 500;
		text-transform: none;
		letter-spacing: 0;
	}

	/* Den vigtigste linje paa skaermen, samme som paa opret-siden. */
	.pr-portion-baand {
		margin-bottom: 12px;
		padding: 11px 13px;
		background: var(--gdim);
		border-radius: 11px;
		color: #8a6a3a;
		font-size: calc(12.5px * var(--fs-scale, 1));
		line-height: 1.45;
	}

	.regn-knap {
		display: block;
		width: 100%;
		margin-bottom: 12px;
		padding: 13px;
		background: var(--white);
		border: 1.5px solid var(--terra);
		border-radius: 12px;
		color: var(--terra);
		font-size: max(16px, calc(14px * var(--fs-scale, 1)));
		font-weight: 600;
		font-family: var(--ff-b);
		cursor: pointer;
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

	.gem-btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
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

	.primaer-knap {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
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
		margin-bottom: 10px;
	}

	.primaer-knap:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	/* Læg-som-måltid modal */
	.modal-bag {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.4);
		display: flex;
		align-items: flex-end;
		justify-content: center;
		z-index: 100;
	}

	.modal {
		width: 100%;
		max-width: 520px;
		/* dvh OG IKKE vh. Mobilbrowsere regner vh ud som om adresselinjen
		   var vaek, saa et ark paa 92vh blev HOEJERE end det hun kunne se.
		   Saa mente arket selv at det var plads nok, overflow slog aldrig
		   til, og hun kunne hverken rulle op eller ned. vh staar som
		   reserve til de faa browsere der ikke kender dvh.
		   Samme fejl som blev rettet paa alle fire ark i 3.0 den 11. august.
		   Fundet af Linn 1. september paa hendes egen opskrift. */
		max-height: 92vh;
		max-height: 92dvh;
		overflow-y: auto;
		overscroll-behavior: contain;
		-webkit-overflow-scrolling: touch;
		background: var(--bg);
		border-radius: 18px 18px 0 0;
		padding: 18px 18px 28px;
	}

	@media (min-width: 600px) {
		.modal-bag {
			align-items: center;
		}
		.modal {
			border-radius: 18px;
			max-height: 88vh;
			max-height: 88dvh;
		}
	}

	.modal-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 10px;
	}

	.modal h2 {
		font-family: var(--ff-d);
		font-size: calc(20px * var(--fs-scale, 1));
		font-weight: 600;
		margin: 0;
		color: var(--text);
	}

	.modal-luk {
		background: none;
		border: none;
		font-size: 26px;
		color: var(--text3);
		cursor: pointer;
		line-height: 1;
		padding: 4px 8px;
	}

	.modal-info {
		padding: 10px 12px;
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 10px;
		margin-bottom: 14px;
	}

	.modal-info-navn {
		font-weight: 600;
		color: var(--text);
		font-size: calc(14px * var(--fs-scale, 1));
	}

	.modal-info-meta {
		font-size: calc(11px * var(--fs-scale, 1));
		color: var(--text3);
		margin-top: 2px;
	}

	.modal .felt select,
	.modal .felt input[type='date'] {
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

	.portion-rad {
		display: flex;
		gap: 6px;
		margin-bottom: 6px;
	}

	.portion-chip {
		flex: 1;
		padding: 10px 4px;
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 10px;
		font-family: var(--ff-b);
		font-size: calc(14px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--text2);
		cursor: pointer;
		touch-action: manipulation;
	}

	.portion-chip.aktiv {
		background: var(--terra);
		border-color: var(--terra);
		color: #fff;
	}

	.portion-input {
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

	.modal-makro {
		background: var(--sdim);
		border: 1px solid var(--sage);
		border-radius: 12px;
		padding: 12px;
		margin: 14px 0;
	}

	.modal-makro-titel {
		font-size: calc(10px * var(--fs-scale, 1));
		font-weight: 600;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: var(--text3);
		margin-bottom: 8px;
	}

	.modal-makro-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 8px;
	}

	.modal-makro-grid > div {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 8px;
		background: var(--white);
		border-radius: 8px;
	}

	.modal-makro-grid > div.fuld {
		grid-column: span 2;
	}

	.modal-makro-grid strong {
		font-family: var(--ff-d);
		font-size: calc(17px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--terra);
	}

	.modal-makro-grid span {
		font-size: calc(10px * var(--fs-scale, 1));
		color: var(--text3);
		margin-top: 2px;
	}

	.slet-knap {
		display: block;
		width: 100%;
		padding: 12px;
		background: var(--white);
		color: #8a4a3e;
		font-size: calc(13px * var(--fs-scale, 1));
		font-weight: 600;
		border: 1px solid #f0d6cf;
		border-radius: 10px;
		cursor: pointer;
		font-family: var(--ff-b);
	}

	.slet-knap:hover {
		background: #fbeeea;
	}

	.slet-knap:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
</style>
