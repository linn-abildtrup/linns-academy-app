<script lang="ts">
	// ============================================================
	// Admin: én dag i et traeningsprogram. Bid 1, 15. august 2026.
	//
	// Her ligger selve arbejdet: hvilke oevelser, hvor mange saet, hvor
	// laenge og hvor lang pause.
	//
	// TO TING DER SPARER TID PAA ET 84-DAGES PROGRAM
	// "Kopiér fra en anden traening" henter en hun allerede har lavet.
	// Oevelses-listen staar som standard paa dem der passer til
	// kategorien, men filteret spaerrer aldrig: hun kan altid skifte til
	// hele banken, for et nyt redskab som sjippetov har ingen maerkater.
	//
	// Der gemmes foerst naar hun trykker Gem. Ellers ville et fejltryk paa
	// en pil skrive med det samme, og der er ingen fortryd.
	// ============================================================

	import { getContext, onMount } from 'svelte';
	import { page } from '$app/state';
	import type { User } from 'firebase/auth';
	import { isAdmin } from '$lib/admin';
	import Ventetegn from '$lib/components/ny/Ventetegn.svelte';
	import type { DayExercise, Exercise, TrainingDay } from '$lib/content/mikrotraening';
	import { hentAlleExercises } from '$lib/firestore/mikrotraening';
	import {
		filtrerOevelserTilKategori,
		type TraeningKategori3
	} from '$lib/content/traeningKategori3';
	import {
		STANDARD_OEVELSE3,
		dagErTom,
		dagensMinutter,
		flytIListe,
		validerOevelse3,
		type Traeningsprogram3
	} from '$lib/content/traeningsprogram3';
	import { hentKategorier3 } from '$lib/firestore/traeningKategori3';
	import { gemDag3, hentProgram3 } from '$lib/firestore/traeningsprogram3';

	const hentUser = getContext<() => User | null>('user');
	const user = $derived(hentUser());
	const maaVaereHer = $derived(isAdmin(user));
	const programId = $derived(page.params.programId ?? '');
	const dagNummer = $derived(Number(page.params.dag));

	let henter = $state(true);
	let program = $state<Traeningsprogram3 | null>(null);
	let alleDage = $state<TrainingDay[]>([]);
	let kategori = $state<TraeningKategori3 | null>(null);
	let bank = $state<Exercise[]>([]);
	let fejl = $state('');
	let besked = $state('');
	let gemmer = $state(false);

	/** Arbejdskopien. Der skrives foerst naar hun trykker Gem. */
	let titel = $state('');
	let indledning = $state('');
	let oevelser = $state<DayExercise[]>([]);
	let urort = $state(true);

	let aabenIndex = $state<number | null>(null);
	let viserTilfoej = $state(false);
	let soegeord = $state('');
	let visAlle = $state(false);
	let kopierFra = $state<number | null>(null);

	const dagNu = $derived<TrainingDay>({
		dagNummer,
		titel,
		indledning,
		exercises: oevelser
	});
	const minutter = $derived(dagensMinutter(dagNu));

	function navnPaa(exerciseId: string): string {
		return bank.find((e) => e.id === exerciseId)?.name ?? exerciseId;
	}

	const kanVaelges = $derived.by(() => {
		const passer = visAlle ? bank.filter((e) => e.aktiv) : filtrerOevelserTilKategori(bank, kategori?.udstyrTag ?? null);
		const ord = soegeord.trim().toLowerCase();
		if (!ord) return passer;
		return passer.filter((e) => e.name.toLowerCase().includes(ord));
	});

	/** Dage der har noget at kopiere fra. Dagen selv er ikke med. */
	const kopiKandidater = $derived(
		alleDage.filter((d) => d.dagNummer !== dagNummer && !dagErTom(d))
	);

	onMount(async () => {
		if (!isAdmin(user)) {
			henter = false;
			return;
		}
		try {
			const [data, kategorier, exercises] = await Promise.all([
				hentProgram3(programId),
				hentKategorier3(),
				hentAlleExercises()
			]);
			bank = exercises;
			if (!data) {
				fejl = 'Programmet findes ikke.';
				return;
			}
			program = data.program;
			alleDage = data.dage;
			kategori = kategorier.find((k) => k.id === data.program.kategoriId) ?? null;
			const dag = data.dage.find((d) => d.dagNummer === dagNummer);
			if (!dag) {
				fejl = 'Træningen findes ikke i programmet.';
				return;
			}
			titel = dag.titel;
			indledning = dag.indledning;
			oevelser = dag.exercises;
		} catch (e) {
			console.error('[admin] kunne ikke hente dagen', e);
			fejl = 'Kunne ikke hente træningen.';
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
		const kilde = alleDage.find((d) => d.dagNummer === kopierFra);
		if (!kilde) return;
		oevelser = kilde.exercises.map((o) => ({ ...o }));
		kopierFra = null;
		aendret();
	}

	async function gem() {
		if (gemmer) return;
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
			await gemDag3(programId, dagNu, alleDage);
			alleDage = alleDage.map((d) => (d.dagNummer === dagNummer ? dagNu : d));
			urort = true;
			besked = 'Træningen er gemt.';
		} catch (e) {
			console.error('[admin] kunne ikke gemme dagen', e);
			fejl = 'Kunne ikke gemme.';
		} finally {
			gemmer = false;
		}
	}
</script>

<svelte:head><title>Træning {dagNummer} · admin</title></svelte:head>

<div class="ny-pad adm">
	{#if !maaVaereHer}
		<div class="adm-kort">Siden er kun for admin.</div>
	{:else if henter}
		<div class="adm-venter"><Ventetegn variant="lille" /><span>Henter</span></div>
	{:else if !program || fejl === 'Træningen findes ikke i programmet.'}
		<p class="adm-fejl">{fejl || 'Træningen findes ikke.'}</p>
	{:else}
		<header class="adm-top">
			<a class="tr-tilbage" href={`/ny/admin/traening/${programId}`}>‹ {program.navn}</a>
			<h1>Træning {dagNummer}</h1>
			<p>
				{#if oevelser.length === 0}
					Ingen øvelser endnu
				{:else}
					{oevelser.length === 1 ? '1 øvelse' : `${oevelser.length} øvelser`} · ca. {minutter} min
				{/if}
			</p>
		</header>

		{#if besked}<p class="adm-besked">{besked}</p>{/if}
		{#if fejl}<p class="adm-fejl">{fejl}</p>{/if}

		<label class="adm-felt">
			<span>Titel</span>
			<input
				type="text"
				bind:value={titel}
				oninput={aendret}
				placeholder="Valgfri, fx Ben og balance"
			/>
		</label>

		<h2 class="tr-overskrift">Øvelser</h2>

		{#if oevelser.length === 0}
			<p class="adm-tom">Der er ingen øvelser på dagen endnu.</p>
		{:else}
			<div class="adm-liste">
				{#each oevelser as o, i (`${o.exerciseId}-${i}`)}
					<div class="adm-raekke">
						<div class="adm-raekke-t">
							<span>{navnPaa(o.exerciseId)}</span>
							{#if o.bonus}<span class="adm-mrk">Ekstra</span>{/if}
						</div>
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
							<label class="adm-tjek">
								<input
									type="checkbox"
									checked={o.bonus}
									onchange={(e) => ret(i, { bonus: e.currentTarget.checked })}
								/>
								<span>Ekstra øvelse, må gerne springes over</span>
							</label>
						{/if}
					</div>
				{/each}
			</div>
		{/if}

		{#if viserTilfoej}
			<section class="adm-kort">
				<h2>Tilføj øvelse</h2>
				<label class="adm-felt">
					<span>Søg</span>
					<input type="text" bind:value={soegeord} placeholder="Søg i øvelser" />
				</label>

				<div class="tr-chips">
					<button type="button" class="tr-chip" class:valgt={!visAlle} onclick={() => (visAlle = false)}>
						Passer til kategorien
					</button>
					<button type="button" class="tr-chip" class:valgt={visAlle} onclick={() => (visAlle = true)}>
						Alle øvelser
					</button>
				</div>

				{#if kanVaelges.length === 0}
					<p class="adm-tom">Ingen øvelser matcher. Prøv Alle øvelser.</p>
				{:else}
					<div class="adm-liste">
						{#each kanVaelges as e (e.id)}
							<button type="button" class="adm-raekke tr-vaelg" onclick={() => tilfoej(e.id)}>
								<div class="adm-raekke-t"><span>{e.name}</span></div>
								<div class="adm-raekke-s">
									{e.catLabel} · {e.udstyr.length === 0 || e.udstyr.every((u) => u === 'ingen')
										? 'ingen redskaber'
										: e.udstyr.join(', ')}
								</div>
							</button>
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

		{#if kopiKandidater.length > 0}
			<section class="adm-kort">
				<h2>Kopiér fra en anden træning</h2>
				<p class="adm-hjaelp">Erstatter øvelserne på træning {dagNummer} med dem fra den du vælger.</p>
				<label class="adm-felt">
					<span>Træning</span>
					<select bind:value={kopierFra}>
						<option value={null}>Vælg en træning</option>
						{#each kopiKandidater as d (d.dagNummer)}
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
