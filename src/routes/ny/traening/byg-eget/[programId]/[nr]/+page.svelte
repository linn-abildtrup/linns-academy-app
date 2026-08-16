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

	const nuvaerende = $derived<TrainingDay>({
		dagNummer: nr,
		titel: '',
		indledning: '',
		exercises: oevelser
	});
	const minutter = $derived(dagensMinutter(nuvaerende));

	const mineOevelser = $derived(
		oevelserTilKunde3(bank, kategorier, rensUdstyr3(udstyrFra(userDoc), kategorier))
	);

	const kanVaelges = $derived.by(() => {
		const ord = soegeord.trim().toLowerCase();
		if (!ord) return mineOevelser;
		return mineOevelser.filter((e) => e.name.toLowerCase().includes(ord));
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
	<header class="side-top" style="padding-left:0;padding-right:0">
		<a class="tr-tilbage" href={`/ny/traening/byg-eget/${programId}`}>
			‹ {mit?.navn ?? 'Dit program'}
		</a>
		<h1>Træning {nr}</h1>
		{#if mit}
			<p class="mt-under">
				{#if oevelser.length === 0}
					Ingen øvelser endnu
				{:else}
					{oevelser.length === 1 ? '1 øvelse' : `${oevelser.length} øvelser`} · ca. {minutter} min
				{/if}
			</p>
		{/if}
	</header>

	{#if henter}
		<div class="adm-venter"><Ventetegn variant="lille" /><span>Henter</span></div>
	{:else if !mit || fejl === 'Træningen findes ikke i programmet.'}
		<p class="kort rolig">{fejl || 'Træningen findes ikke.'}</p>
	{:else}
		{#if besked}<p class="adm-besked">{besked}</p>{/if}
		{#if fejl}<p class="adm-fejl">{fejl}</p>{/if}

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
			<section class="adm-kort">
				<h2>Tilføj øvelse</h2>
				<label class="adm-felt">
					<span>Søg</span>
					<input type="text" bind:value={soegeord} placeholder="Søg i øvelser" />
				</label>

				{#if kanVaelges.length === 0}
					<p class="adm-tom">Ingen øvelser matcher det du søgte efter.</p>
				{:else}
					<div class="adm-liste">
						{#each kanVaelges as e (e.id)}
							<button type="button" class="adm-raekke tr-vaelg" onclick={() => tilfoej(e.id)}>
								<div class="adm-raekke-t"><span>{e.name}</span></div>
								<div class="adm-raekke-s">{e.catLabel}</div>
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
