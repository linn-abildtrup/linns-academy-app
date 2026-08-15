<script lang="ts">
	// ============================================================
	// Admin: ét traeningsprogram og dets dage. Bid 1, 15. august 2026.
	//
	// Her ligger de tre ting Linn skal kunne: rette programmets top,
	// se hvor hullerne er, og faa et automatisk udkast til dagene.
	//
	// UDKASTET er ikke pynt. Et 84-dages program er en hel aften i
	// haanden. Generatoren er den samme som den gamle app bruger, saa
	// den er kendt og afproevet, og den roerer som standard KUN de dage
	// der er tomme. Ellers kunne ét tryk kaste en aftens arbejde vaek.
	// ============================================================

	import { getContext, onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import type { User } from 'firebase/auth';
	import { isAdmin } from '$lib/admin';
	import Ventetegn from '$lib/components/ny/Ventetegn.svelte';
	import {
		genererProgramMedConfig,
		type Exercise,
		type TrainingDay
	} from '$lib/content/mikrotraening';
	import { hentAlleExercises } from '$lib/firestore/mikrotraening';
	import {
		filtrerOevelserTilKategori,
		kategoriNavn3,
		type TraeningKategori3
	} from '$lib/content/traeningKategori3';
	import {
		dagErTom,
		dagensMinutter,
		fletUdkast,
		justerAntalDage,
		manglerTekst,
		validerProgram3,
		type Traeningsprogram3
	} from '$lib/content/traeningsprogram3';
	import { hentKategorier3 } from '$lib/firestore/traeningKategori3';
	import {
		gemDage3,
		gemProgram3,
		hentProgram3,
		sletDageOver3,
		sletProgram3
	} from '$lib/firestore/traeningsprogram3';
	import { sletTildelingerForProgram3 } from '$lib/firestore/traeningTildeling3';

	const hentUser = getContext<() => User | null>('user');
	const user = $derived(hentUser());
	const maaVaereHer = $derived(isAdmin(user));
	const programId = $derived(page.params.programId ?? '');

	let henter = $state(true);
	let program = $state<Traeningsprogram3 | null>(null);
	let dage = $state<TrainingDay[]>([]);
	let kategorier = $state<TraeningKategori3[]>([]);
	let fejl = $state('');
	let besked = $state('');
	let gemmer = $state(false);

	let viserRet = $state(false);
	let navn = $state('');
	let beskrivelse = $state('');
	let kategoriId = $state('');
	let antalDage = $state(21);
	let starterForfra = $state(true);

	let viserUdkast = $state(false);
	let oevelser = $state<Exercise[]>([]);
	let henterOevelser = $state(false);
	let uAntal = $state(3);
	let uSaet = $state(3);
	let uArbejde = $state(30);
	let uPause = $state(10);
	let uKunTomme = $state(true);
	let uSidsteErEkstra = $state(false);

	const mangler = $derived(manglerTekst(dage));
	const kategori = $derived(kategorier.find((k) => k.id === program?.kategoriId) ?? null);

	onMount(async () => {
		if (!isAdmin(user)) {
			henter = false;
			return;
		}
		await hentAlt();
	});

	async function hentAlt() {
		try {
			const [data, k] = await Promise.all([hentProgram3(programId), hentKategorier3()]);
			kategorier = k;
			if (!data) {
				fejl = 'Programmet findes ikke.';
				return;
			}
			program = data.program;
			dage = data.dage;
			navn = data.program.navn;
			beskrivelse = data.program.beskrivelse;
			kategoriId = data.program.kategoriId;
			antalDage = data.program.antalDage;
			starterForfra = data.program.starterForfra;
		} catch (e) {
			console.error('[admin] kunne ikke hente programmet', e);
			fejl = 'Kunne ikke hente programmet.';
		} finally {
			henter = false;
		}
	}

	async function gemTop() {
		if (gemmer || !program) return;
		const problem = validerProgram3({ navn, kategoriId, antalDage });
		if (problem) {
			fejl = problem;
			return;
		}
		gemmer = true;
		fejl = '';
		try {
			const antalAendret = antalDage !== program.antalDage;
			await gemProgram3(programId, {
				navn: navn.trim(),
				beskrivelse: beskrivelse.trim(),
				kategoriId,
				antalDage,
				starterForfra
			});
			if (antalAendret) {
				// Dagene skal foelge med tallet. Foerst de nye tomme ind, saa
				// de overskydende vaek, saa der ikke ligger usynlige dage og
				// dukker op igen hvis hun senere saetter tallet op igen.
				const justeret = justerAntalDage(dage, antalDage);
				await gemDage3(programId, justeret);
				await sletDageOver3(programId, antalDage);
			}
			await hentAlt();
			viserRet = false;
			besked = 'Programmet er gemt.';
		} catch (e) {
			console.error('[admin] kunne ikke gemme programmet', e);
			fejl = 'Kunne ikke gemme.';
		} finally {
			gemmer = false;
		}
	}

	async function skiftKlar() {
		if (!program || gemmer) return;
		gemmer = true;
		try {
			await gemProgram3(programId, { klar: !program.klar });
			program = { ...program, klar: !program.klar };
			besked = program.klar
				? 'Programmet er klar og kan tildeles.'
				: 'Programmet er sat tilbage til kladde.';
		} catch (e) {
			console.error('[admin] kunne ikke skifte tilstand', e);
			fejl = 'Kunne ikke gemme.';
		} finally {
			gemmer = false;
		}
	}

	async function aabnUdkast() {
		viserUdkast = true;
		besked = '';
		fejl = '';
		if (oevelser.length > 0 || henterOevelser) return;
		henterOevelser = true;
		try {
			oevelser = await hentAlleExercises();
		} catch (e) {
			console.error('[admin] kunne ikke hente oevelser', e);
			fejl = 'Kunne ikke hente øvelserne.';
		} finally {
			henterOevelser = false;
		}
	}

	async function lavUdkast() {
		if (gemmer || !program) return;
		gemmer = true;
		fejl = '';
		try {
			const passer = filtrerOevelserTilKategori(oevelser, kategori?.udstyrTag ?? null);
			const udkast = genererProgramMedConfig(
				program.antalDage,
				passer,
				{ antalOvelser: uAntal, sets: uSaet, workSec: uArbejde, restSec: uPause },
				{ markSidsteSomBonus: uSidsteErEkstra }
			);
			const flettet = fletUdkast(dage, udkast, uKunTomme);
			await gemDage3(programId, flettet);
			await hentAlt();
			viserUdkast = false;
			besked = uKunTomme ? 'De tomme træninger er fyldt ud.' : 'Alle træninger er fyldt ud.';
		} catch (e) {
			console.error('[admin] kunne ikke lave udkast', e);
			// Generatoren kaster hvis en af de tre oevelses-grupper er tom.
			// Det sker naar kategorien er koblet til et redskab der ikke
			// findes i banken. Sig det, i stedet for en teknisk fejl.
			fejl =
				e instanceof Error && e.message.includes('Mangler øvelser')
					? 'Der er ikke øvelser nok til den kategori. Vælg øvelserne selv, eller ret koblingen på kategorien.'
					: 'Kunne ikke lave udkastet.';
		} finally {
			gemmer = false;
		}
	}

	async function sletHele() {
		if (!program) return;
		if (!confirm(`Slet "${program.navn}" og alle dets dage?`)) return;
		try {
			// Tildelingerne skal med. Ellers bliver der liggende raekker der
			// peger paa ingenting og taeller med i daekningen som om holdet
			// havde et program.
			await sletTildelingerForProgram3(programId);
			await sletProgram3(programId);
			await goto('/ny/admin/traening');
		} catch (e) {
			console.error('[admin] kunne ikke slette programmet', e);
			fejl = 'Kunne ikke slette.';
		}
	}
</script>

<svelte:head><title>{program?.navn ?? 'Program'} · admin</title></svelte:head>

<div class="ny-pad adm">
	{#if !maaVaereHer}
		<div class="adm-kort">Siden er kun for admin.</div>
	{:else if henter}
		<div class="adm-venter"><Ventetegn variant="lille" /><span>Henter</span></div>
	{:else if !program}
		<p class="adm-fejl">{fejl || 'Programmet findes ikke.'}</p>
	{:else}
		<header class="adm-top">
			<a class="tr-tilbage" href="/ny/admin/traening">‹ Træning</a>
			<h1>{program.navn}</h1>
			<p>
				{kategoriNavn3(program.kategoriId, kategorier) || 'Uden kategori'} · {program.antalDage} træninger
				· {program.klar ? 'Klar' : 'Kladde'}
			</p>
		</header>

		{#if besked}<p class="adm-besked">{besked}</p>{/if}
		{#if fejl}<p class="adm-fejl">{fejl}</p>{/if}

		<div class="adm-knapper">
			<button
				type="button"
				class="ch-knap sekundaer"
				onclick={() => (viserRet = !viserRet)}
				disabled={gemmer}
			>
				Rediger
			</button>
			<button type="button" class="ch-knap primaer" onclick={aabnUdkast} disabled={gemmer}>
				Fyld træninger ud
			</button>
		</div>

		<a class="ch-knap sekundaer tr-knap-link" href={`/ny/admin/traening/${programId}/tildel`}>
			{program.klar ? 'Tildel' : 'Tildel, kræver at programmet er klar'}
		</a>

		{#if viserRet}
			<section class="adm-kort">
				<h2>Rediger program</h2>

				<label class="adm-felt">
					<span>Navn</span>
					<input type="text" bind:value={navn} />
				</label>

				<label class="adm-felt">
					<span>Beskrivelse</span>
					<textarea bind:value={beskrivelse} rows="2"></textarea>
				</label>

				<label class="adm-felt">
					<span>Kategori</span>
					<select bind:value={kategoriId}>
						{#each kategorier as k (k.id)}
							<option value={k.id}>{k.navn}</option>
						{/each}
					</select>
				</label>

				<label class="adm-felt">
					<span>Antal træninger</span>
					<input type="number" bind:value={antalDage} min="1" max="365" />
				</label>
				<p class="adm-hjaelp">
					Sætter du tallet op, kommer de nye træninger tomme. Sætter du det ned, forsvinder de
					sidste træninger og deres øvelser.
				</p>

				<label class="adm-tjek">
					<input type="checkbox" bind:checked={starterForfra} />
					<span>Starter forfra når den er slut</span>
				</label>

				<div class="adm-knapper">
					<button type="button" class="ch-knap primaer" onclick={gemTop} disabled={gemmer}>
						{gemmer ? 'Gemmer' : 'Gem'}
					</button>
					<button
						type="button"
						class="ch-knap sekundaer"
						onclick={() => (viserRet = false)}
						disabled={gemmer}
					>
						Fortryd
					</button>
				</div>

				<button type="button" class="tr-slet" onclick={sletHele}>Slet hele programmet</button>
			</section>
		{/if}

		{#if viserUdkast}
			<section class="adm-kort">
				<h2>Fyld træninger ud</h2>
				<p class="adm-hjaelp">
					Laver et udkast til hele programmet. Øvelserne fordeles jævnt på ben, overkrop og core,
					og der bruges kun øvelser der passer til kategorien. Du retter bagefter i de dage du vil
					have anderledes.
				</p>

				{#if henterOevelser}
					<div class="adm-venter"><Ventetegn variant="lille" /><span>Henter øvelser</span></div>
				{:else}
					<div class="adm-to">
						<label class="adm-felt">
							<span>Øvelser pr træning</span>
							<input type="number" bind:value={uAntal} min="1" max="10" />
						</label>
						<label class="adm-felt">
							<span>Sæt</span>
							<input type="number" bind:value={uSaet} min="1" max="20" />
						</label>
					</div>
					<div class="adm-to">
						<label class="adm-felt">
							<span>Arbejde, sek</span>
							<input type="number" bind:value={uArbejde} min="5" max="600" />
						</label>
						<label class="adm-felt">
							<span>Pause, sek</span>
							<input type="number" bind:value={uPause} min="0" max="600" />
						</label>
					</div>

					<label class="adm-tjek">
						<input type="checkbox" bind:checked={uKunTomme} />
						<span>Rør kun de tomme træninger</span>
					</label>
					<p class="adm-hjaelp">
						Med flueben bliver de træninger du selv har fyldt ud stående. Uden bliver alle
						erstattet, og dine egne øvelser forsvinder.
					</p>

					<label class="adm-tjek">
						<input type="checkbox" bind:checked={uSidsteErEkstra} />
						<span>Sidste øvelse er ekstra</span>
					</label>

					<div class="adm-knapper">
						<button type="button" class="ch-knap primaer" onclick={lavUdkast} disabled={gemmer}>
							{gemmer ? 'Fylder ud' : 'Lav udkast'}
						</button>
						<button
							type="button"
							class="ch-knap sekundaer"
							onclick={() => (viserUdkast = false)}
							disabled={gemmer}
						>
							Fortryd
						</button>
					</div>
				{/if}
			</section>
		{/if}

		<h2 class="tr-overskrift">Træningerne</h2>
		<div class="adm-liste tr-dage">
			{#each dage as d (d.dagNummer)}
				<a
					class="adm-raekke tr-raekke tr-dag"
					class:tom={dagErTom(d)}
					href={`/ny/admin/traening/${programId}/${d.dagNummer}`}
				>
					<div class="adm-raekke-t">
						<span>Træning {d.dagNummer}</span>
						{#if d.titel}<span class="tr-dag-titel">{d.titel}</span>{/if}
					</div>
					<div class="adm-raekke-s">
						{#if dagErTom(d)}
							Ingen øvelser endnu
						{:else}
							{d.exercises.length === 1 ? '1 øvelse' : `${d.exercises.length} øvelser`} · ca. {dagensMinutter(
								d
							)} min
						{/if}
					</div>
				</a>
			{/each}
		</div>

		<button type="button" class="ch-knap sekundaer" onclick={skiftKlar} disabled={gemmer}>
			{program.klar ? 'Sæt tilbage til kladde' : 'Sæt programmet til Klar'}
		</button>
		{#if mangler && !program.klar}
			<p class="adm-hjaelp">
				{mangler}. Du kan godt sætte den til klar alligevel, men så får kunden en tom træning.
			</p>
		{/if}
	{/if}
</div>
