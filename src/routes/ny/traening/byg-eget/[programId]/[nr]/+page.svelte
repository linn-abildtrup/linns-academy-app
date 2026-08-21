<script lang="ts">
	// ============================================================
	// Kunden fylder én af sine egne traeninger. Bid 6, 16. august 2026.
	//
	// KUN OEVELSER HUN KAN LAVE. Listen er filtreret paa det udstyr hun
	// har valgt i profilen, og der er ingen "vis alle"-knap. Admin har
	// den knap, fordi Linn skal kunne bygge til udstyr banken endnu
	// ikke kender. Kunden skal ikke se en kettlebell-oevelse hun ikke
	// har redskabet til, den er kun i vejen.
	//
	// De to genveje er de samme som admin har: kopiér fra en traening
	// hun allerede har lavet, eller faa et forslag. Uden dem skal hun
	// vaelge hver eneste oevelse i haanden paa en telefon.
	//
	// Der gemmes foerst naar hun trykker Gem, saa et fejltryk paa en pil
	// ikke skriver med det samme.
	// ============================================================

	import { getContext, onMount } from 'svelte';
	import { page } from '$app/state';
	import type { User } from 'firebase/auth';
	import type { UserDoc } from '$lib/types';
	import Ventetegn from '$lib/components/ny/Ventetegn.svelte';
	import type { DayExercise, Exercise, TrainingDay } from '$lib/content/mikrotraening';
	import { genererProgramMedConfig } from '$lib/content/mikrotraening';
	import { hentAlleExercises } from '$lib/firestore/mikrotraening';
	import {
		oevelserTilKunde3,
		rensUdstyr3,
		udstyrFra,
		type TraeningKategori3
	} from '$lib/content/traeningKategori3';
	import {
		STANDARD_OEVELSE3,
		dagensMinutter,
		flytIListe,
		validerOevelse3
	} from '$lib/content/traeningsprogram3';
	import { kopiKandidater3, type MinTraening3 } from '$lib/content/mineTraeninger3';
	import { hentKategorier3 } from '$lib/firestore/traeningKategori3';
	import { gemMinTraening3, hentMinTraening3 } from '$lib/firestore/mineTraeninger3';
	import Sidehoved from '$lib/components/ny/Sidehoved.svelte';
	import OevelsesArk from '$lib/components/ny/OevelsesArk.svelte';
	import {
		TEMPOER3,
		nuvaerendeTempo3,
		saetTempo3,
		tempoTal3,
		type Tempo3
	} from '$lib/content/traeningTempo3';
	import { filtrerOevelser, kategoriAntal, udstyrTekst } from '$lib/content/oevelsesSoeg3';
	import { getVideoUrl } from '$lib/utils/storage';

	const hentUser = getContext<() => User | null>('user');
	const hentUserDoc = getContext<() => UserDoc | null>('userDoc');
	const user = $derived(hentUser());
	const userDoc = $derived(hentUserDoc());
	const programId = $derived(page.params.programId ?? '');
	const nr = $derived(Number(page.params.nr));

	let henter = $state(true);
	let fejl = $state('');
	let besked = $state('');
	let gemmer = $state(false);
	let mit = $state<MinTraening3 | null>(null);
	let bank = $state<Exercise[]>([]);
	let kategorier = $state<TraeningKategori3[]>([]);

	/** Arbejdskopien. Der skrives foerst naar hun trykker Gem. */
	let oevelser = $state<DayExercise[]>([]);
	let urort = $state(true);

	let aabenIndex = $state<number | null>(null);
	let viserTilfoej = $state(false);
	let soegeord = $state('');
	let kopierFra = $state<number | null>(null);

	// ── Vaelgeren ───────────────────────────────────────────────
	//
	// Den brugte foer sin EGEN soegning, som kun kiggede paa navnet og
	// ikke kunne finde æ, ø og å hvis hun skrev ae, oe, aa. Og der var
	// hverken filtre eller video, saa hun valgte i blinde: "Bird dog"
	// siger ingenting til en der ikke traener i forvejen.
	//
	// Nu bruger den PRAECIS det samme som oevelsesbiblioteket under Din
	// side. Linns beslutning 21. august. Der er ét sted at rette hvis
	// soegningen skal blive bedre, og de to lister opfoerer sig ens.
	let valgtKategori = $state<string | null>(null);

	/** Den oevelse arket staar paa. Null = arket er lukket. */
	let seOevelse = $state<Exercise | null>(null);
	let seVideo = $state<string | null>(null);
	let henterVideo = $state(false);

	/** Videoen der koerer paa selve raekken i listen. */
	let raekkeVideo = $state<Map<string, string>>(new Map());

	async function seDenneOevelse(oevelse: Exercise) {
		seOevelse = oevelse;
		seVideo = null;
		if (!oevelse.videoPath) return;
		henterVideo = true;
		try {
			seVideo = await getVideoUrl(oevelse.videoPath);
		} catch (e) {
			// Uden video kan hun stadig laese hvordan oevelsen laves.
			console.warn('[ny] kunne ikke hente oevelsens video', e);
		} finally {
			henterVideo = false;
		}
	}

	const nuvaerende = $derived<TrainingDay>({
		dagNummer: nr,
		titel: '',
		indledning: '',
		exercises: oevelser
	});
	const minutter = $derived(dagensMinutter(nuvaerende));

	// Linjen under titlen. Stod foer som markup inde i hovedet, men det
	// faelles sidehoved tager en faerdig tekst.
	const undertekst = $derived(
		oevelser.length === 0
			? 'Ingen øvelser endnu'
			: `${oevelser.length === 1 ? '1 øvelse' : `${oevelser.length} øvelser`} · ca. ${minutter} min`
	);

	const mineOevelser = $derived(
		oevelserTilKunde3(bank, kategorier, rensUdstyr3(udstyrFra(userDoc), kategorier))
	);

	/** Kategorierne med antal. Talt PAA soegningen, ikke paa hele banken. */
	const kategoriValg = $derived(kategoriAntal(filtrerOevelser(mineOevelser, { soegeord })));

	const kanVaelges = $derived(
		filtrerOevelser(mineOevelser, {
			soegeord,
			kategorier: valgtKategori ? [valgtKategori] : []
		})
	);

	/** Er oevelsen allerede paa traeningen. Saa staar der flueben. */
	function erMed(exerciseId: string): boolean {
		return oevelser.some((o) => o.exerciseId === exerciseId);
	}

	/**
	 * Hvor mange raekker der maa vise levende video paa én gang.
	 *
	 * 36 videoer der koerer samtidig faar en aeldre telefon til at hakke,
	 * og det er praecis den slags der ikke kan ses paa en ny. Filtrerer
	 * hun ned til en kategori, er der typisk faerre end 12 tilbage, og
	 * saa faar hun dem alle. Ellers staar der et afspilnings-tegn, og hun
	 * kan aabne arket for at se den.
	 */
	const MAX_LEVENDE = 12;

	// ── Tempo ───────────────────────────────────────────────────
	// Ét valg for hele traeningen i stedet for tre talfelter pr oevelse.
	// Hun kan stadig rette en enkelt, men hun behoever ikke. Se
	// content/traeningTempo3.
	const tempo = $derived(nuvaerendeTempo3(oevelser));

	function saetTempo(t: Tempo3) {
		oevelser = saetTempo3(oevelser, t);
		urort = false;
	}

	$effect(() => {
		const liste = kanVaelges;
		if (liste.length === 0 || liste.length > MAX_LEVENDE) {
			if (raekkeVideo.size > 0) raekkeVideo = new Map();
			return;
		}
		let afbrudt = false;
		(async () => {
			const par = await Promise.all(
				liste.map(async (e) => {
					if (!e.videoPath) return null;
					try {
						return [e.id, await getVideoUrl(e.videoPath)] as const;
					} catch {
						return null;
					}
				})
			);
			if (afbrudt) return;
			raekkeVideo = new Map(par.filter((x): x is readonly [string, string] => x !== null));
		})();
		return () => {
			afbrudt = true;
		};
	});

	const kandidater = $derived(mit ? kopiKandidater3(mit.dage, nr) : []);

	function navnPaa(exerciseId: string): string {
		return bank.find((e) => e.id === exerciseId)?.name ?? exerciseId;
	}

	onMount(async () => {
		const uid = user?.uid;
		if (!uid) {
			henter = false;
			return;
		}
		try {
			const [data, k, exercises] = await Promise.all([
				hentMinTraening3(uid, programId),
				hentKategorier3(),
				hentAlleExercises()
			]);
			kategorier = k;
			bank = exercises;
			if (!data) {
				fejl = 'Programmet findes ikke.';
				return;
			}
			mit = data;
			const dag = data.dage.find((d) => d.dagNummer === nr);
			if (!dag) {
				fejl = 'Træningen findes ikke i programmet.';
				return;
			}
			oevelser = dag.exercises;
		} catch (e) {
			console.error('[ny] kunne ikke hente traeningen', e);
			fejl = 'Træningen kunne ikke hentes lige nu. Prøv igen om lidt.';
		} finally {
			henter = false;
		}
	});

	function aendret() {
		urort = false;
		besked = '';
	}

	function tilfoej(exerciseId: string) {
		oevelser = [...oevelser, { exerciseId, ...STANDARD_OEVELSE3 }];
		viserTilfoej = false;
		soegeord = '';
		aendret();
	}

	function fjern(index: number) {
		oevelser = oevelser.filter((_, i) => i !== index);
		if (aabenIndex === index) aabenIndex = null;
		aendret();
	}

	function flyt(index: number, retning: 'op' | 'ned') {
		const ny = flytIListe(oevelser, index, retning);
		if (ny === oevelser) return;
		oevelser = ny;
		aabenIndex = null;
		aendret();
	}

	function ret(index: number, felter: Partial<DayExercise>) {
		oevelser = oevelser.map((o, i) => (i === index ? { ...o, ...felter } : o));
		aendret();
	}

	function kopier() {
		const kilde = mit?.dage.find((d) => d.dagNummer === kopierFra);
		if (!kilde) return;
		oevelser = kilde.exercises.map((o) => ({ ...o }));
		kopierFra = null;
		aendret();
	}

	function foreslaa() {
		// Generatoren kraever oevelser i alle tre grupper. Daekker hendes
		// udstyr dem ikke, siger vi det i stedet for at vise en fejl hun
		// ikke kan bruge til noget.
		try {
			oevelser = genererProgramMedConfig(1, mineOevelser, {
				antalOvelser: 4,
				...STANDARD_OEVELSE3
			})[0].exercises;
			aendret();
		} catch (e) {
			console.warn('[ny] kunne ikke lave et forslag', e);
			fejl = 'Der er ikke øvelser nok til et forslag. Vælg dem selv herunder.';
		}
	}

	async function gem() {
		if (gemmer || !mit) return;
		for (const o of oevelser) {
			const problem = validerOevelse3(o);
			if (problem) {
				fejl = `${navnPaa(o.exerciseId)}: ${problem}`;
				return;
			}
		}
		gemmer = true;
		fejl = '';
		try {
			const naeste = {
				...mit,
				dage: mit.dage.map((d) => (d.dagNummer === nr ? nuvaerende : d))
			};
			await gemMinTraening3(user?.uid ?? '', naeste);
			mit = naeste;
			urort = true;
			besked = 'Træningen er gemt.';
		} catch (e) {
			console.error('[ny] kunne ikke gemme traeningen', e);
			fejl = 'Kunne ikke gemme. Prøv igen om lidt.';
		} finally {
			gemmer = false;
		}
	}
</script>

<svelte:head><title>Træning {nr}</title></svelte:head>

<div class="ny-pad mt-side">
	<Sidehoved
		titel="Træning {nr}"
		tilbage={`/ny/traening/byg-eget/${programId}`}
		tilbageTekst={mit?.navn ?? 'Dit program'}
		under={mit ? undertekst : undefined}
		kant={false}
	/>

	{#if henter}
		<div class="adm-venter"><Ventetegn variant="lille" /><span>Henter</span></div>
	{:else if !mit || fejl === 'Træningen findes ikke i programmet.'}
		<p class="kort rolig">{fejl || 'Træningen findes ikke.'}</p>
	{:else}
		{#if besked}<p class="adm-besked">{besked}</p>{/if}
		{#if fejl}<p class="adm-fejl">{fejl}</p>{/if}

		<!-- TEMPO FOR HELE TRAENINGEN. Foer skulle hun saette saet,
		     sekunder og pause for HVER oevelse, altsaa seks talfelter for
		     to oevelser, uden hjaelp til hvad der er fornuftigt.
		     Har hun rettet en enkelt oevelse, staar ingen af knapperne
		     valgt, se nuvaerendeTempo3. -->
		{#if oevelser.length > 0}
			<section>
				<div class="lab"><h2>Tempo</h2></div>
				<div class="oev-chips" role="group" aria-label="Vælg tempo">
					{#each TEMPOER3 as t (t.id)}
						<button
							type="button"
							class="oev-chip"
							class:valgt={tempo?.id === t.id}
							onclick={() => saetTempo(t)}
						>
							{t.navn} <span class="oev-tal">{tempoTal3(t)}</span>
						</button>
					{/each}
				</div>
				<p class="bv-hjaelp">
					{#if tempo}
						Gælder alle øvelser. Du kan stadig rette en enkelt nedenfor.
					{:else}
						Øvelserne kører ikke det samme tempo lige nu. Tryk på en knap for at sætte dem ens.
					{/if}
				</p>
			</section>
		{/if}

		{#if oevelser.length === 0}
			<p class="adm-tom">Der er ingen øvelser i træningen endnu.</p>
			<button type="button" class="ch-knap sekundaer" onclick={foreslaa}>
				Lav et forslag til mig
			</button>
		{:else}
			<div class="adm-liste">
				{#each oevelser as o, i (`${o.exerciseId}-${i}`)}
					<div class="adm-raekke">
						<div class="adm-raekke-t"><span>{navnPaa(o.exerciseId)}</span></div>
						<div class="adm-raekke-s">
							{o.sets} sæt · {o.workSec} sek · {o.restSec} sek pause
						</div>
						<div class="tr-mini-raekke">
							<button
								type="button"
								class="tr-mini"
								onclick={() => flyt(i, 'op')}
								disabled={i === 0}
								aria-label="Flyt op">↑</button
							>
							<button
								type="button"
								class="tr-mini"
								onclick={() => flyt(i, 'ned')}
								disabled={i === oevelser.length - 1}
								aria-label="Flyt ned">↓</button
							>
							<button
								type="button"
								class="tr-mini"
								onclick={() => (aabenIndex = aabenIndex === i ? null : i)}
							>
								{aabenIndex === i ? 'Luk' : 'Ret'}
							</button>
							<button type="button" class="tr-mini" onclick={() => fjern(i)}>Fjern</button>
						</div>

						{#if aabenIndex === i}
							<div class="tr-tal">
								<label class="adm-felt">
									<span>Sæt</span>
									<input
										type="number"
										min="1"
										max="20"
										value={o.sets}
										oninput={(e) => ret(i, { sets: Number(e.currentTarget.value) })}
									/>
								</label>
								<label class="adm-felt">
									<span>Arbejde, sek</span>
									<input
										type="number"
										min="5"
										max="600"
										value={o.workSec}
										oninput={(e) => ret(i, { workSec: Number(e.currentTarget.value) })}
									/>
								</label>
								<label class="adm-felt">
									<span>Pause, sek</span>
									<input
										type="number"
										min="0"
										max="600"
										value={o.restSec}
										oninput={(e) => ret(i, { restSec: Number(e.currentTarget.value) })}
									/>
								</label>
							</div>
						{/if}
					</div>
				{/each}
			</div>
		{/if}

		{#if viserTilfoej}
			<section class="adm-kort bv-vaelger">
				<h2>Tilføj øvelse</h2>

				<input
					class="ops-soeg"
					type="search"
					bind:value={soegeord}
					placeholder="Søg efter øvelse"
					aria-label="Søg efter øvelse"
				/>

				<!-- Samme filtre som oevelsesbiblioteket. Tallet siger hvad hun
				     FAAR hvis hun trykker, og ikke hvad hun allerede har. -->
				{#if kategoriValg.length > 1}
					<div class="oev-chips" role="group" aria-label="Filtrér på kategori">
						<button
							type="button"
							class="oev-chip"
							class:valgt={valgtKategori === null}
							onclick={() => (valgtKategori = null)}
						>
							Alle <span class="oev-tal">{kategoriValg.reduce((n, k) => n + k.antal, 0)}</span>
						</button>
						{#each kategoriValg as k (k.navn)}
							<button
								type="button"
								class="oev-chip"
								class:valgt={valgtKategori === k.navn}
								onclick={() => (valgtKategori = valgtKategori === k.navn ? null : k.navn)}
							>
								{k.navn} <span class="oev-tal">{k.antal}</span>
							</button>
						{/each}
					</div>
				{/if}

				{#if kanVaelges.length === 0}
					<p class="adm-tom">Der er ingen der passer. Prøv et andet ord, eller slå filteret fra.</p>
				{:else}
					<div class="bv-liste">
						{#each kanVaelges as e (e.id)}
							{@const med = erMed(e.id)}
							<!-- TO KNAPPER PR RAEKKE, og det er med vilje. Pilen aabner
							     arket, hvis hun ikke ved hvad oevelsen er. Plusset
							     laegger den paa. Foer lagde ét tryk den paa med det
							     samme, og ville hun fortryde, skulle hun finde den igen
							     laengere nede paa siden. -->
							<div class="bv-r">
								<button
									type="button"
									class="bv-se"
									onclick={() => seDenneOevelse(e)}
									aria-label="Se {e.name}"
								>
									<span class="bv-th">
										{#if raekkeVideo.get(e.id)}
											<video src={raekkeVideo.get(e.id)} autoplay muted loop playsinline></video>
										{:else}
											<span class="bv-play" aria-hidden="true">▶</span>
										{/if}
									</span>
									<span class="bv-tx">
										<span class="bv-navn">{e.name}</span>
										<span class="bv-meta">
											{e.catLabel}{#if udstyrTekst(e.udstyr ?? [])}
												· {udstyrTekst(e.udstyr ?? [])}{/if}
										</span>
									</span>
									<span class="bv-pil" aria-hidden="true">›</span>
								</button>
								<button
									type="button"
									class="bv-plus"
									class:med
									onclick={() => tilfoej(e.id)}
									aria-label={med
										? `${e.name} er allerede med. Tilføj en gang til`
										: `Tilføj ${e.name}`}
								>
									{med ? '✓' : '+'}
								</button>
							</div>
						{/each}
					</div>
				{/if}

				<button type="button" class="ch-knap sekundaer" onclick={() => (viserTilfoej = false)}>
					Luk
				</button>
			</section>
		{:else}
			<button type="button" class="ch-knap sekundaer" onclick={() => (viserTilfoej = true)}>
				+ Tilføj øvelse
			</button>
		{/if}

		{#if kandidater.length > 0}
			<section class="adm-kort">
				<h2>Kopiér fra en anden træning</h2>
				<p class="adm-hjaelp">
					Erstatter øvelserne på træning {nr} med dem fra den du vælger.
				</p>
				<label class="adm-felt">
					<span>Træning</span>
					<select bind:value={kopierFra}>
						<option value={null}>Vælg en træning</option>
						{#each kandidater as d (d.dagNummer)}
							<option value={d.dagNummer}>
								Træning {d.dagNummer} · {d.exercises.length === 1
									? '1 øvelse'
									: `${d.exercises.length} øvelser`}
							</option>
						{/each}
					</select>
				</label>
				<button
					type="button"
					class="ch-knap sekundaer"
					onclick={kopier}
					disabled={kopierFra === null}
				>
					Kopiér øvelserne
				</button>
			</section>
		{/if}

		<div class="tr-gem">
			<button type="button" class="ch-knap primaer" onclick={gem} disabled={gemmer || urort}>
				{gemmer ? 'Gemmer' : 'Gem træningen'}
			</button>
			{#if !urort}
				<p class="adm-hjaelp">Der er ændringer der ikke er gemt endnu.</p>
			{/if}
		</div>
	{/if}
</div>

<!-- Det SAMME ark som oevelsesbiblioteket og som "Se øvelserne" foer en
     traening. Ét sted at rette, og de tre lister opfoerer sig ens. -->
{#if seOevelse}
	<OevelsesArk
		oevelse={seOevelse}
		video={seVideo}
		{henterVideo}
		onluk={() => {
			seOevelse = null;
			seVideo = null;
		}}
	/>
{/if}
