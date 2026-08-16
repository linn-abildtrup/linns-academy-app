<script lang="ts">
	// ============================================================
	// Kunden retter sit eget program. Bid 6, 16. august 2026.
	//
	// Navn, traeningerne, og hvor lang tid det hele tager. Selve
	// oevelserne ligger et niveau nede, én traening ad gangen.
	//
	// TIDEN STAAR NEDERST OG SPAERRER IKKE. Linns valg 16. august:
	// ingen graense paa antal oevelser eller traeninger. Hun skal bare
	// kunne se hvad hun har bygget, saa en traening paa halvanden time
	// ikke kommer bag paa hende naar hun staar midt i den.
	//
	// Der gemmes med det samme naar hun tilfoejer eller fjerner en
	// traening. Navnet gemmes foerst naar hun trykker Gem, ellers ville
	// hvert bogstav vaere en skrivning.
	// ============================================================

	import { getContext, onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import type { User } from 'firebase/auth';
	import Ventetegn from '$lib/components/ny/Ventetegn.svelte';
	import { dagensMinutter } from '$lib/content/traeningsprogram3';
	import {
		MAX_EGET_NAVN,
		fjernTraening3,
		samletMinutter3,
		tilfoejTraening3,
		validerMinTraening3,
		type MinTraening3
	} from '$lib/content/mineTraeninger3';
	import {
		gemMinTraening3,
		hentMinTraening3,
		sletMinTraening3
	} from '$lib/firestore/mineTraeninger3';

	const hentUser = getContext<() => User | null>('user');
	const user = $derived(hentUser());
	const programId = $derived(page.params.programId ?? '');

	let henter = $state(true);
	let fejl = $state('');
	let besked = $state('');
	let gemmer = $state(false);
	let mit = $state<MinTraening3 | null>(null);
	let navn = $state('');
	let visSlet = $state(false);

	const minutter = $derived(mit ? samletMinutter3(mit.dage) : 0);
	const navnAendret = $derived(mit !== null && navn.trim() !== mit.navn.trim());

	onMount(async () => {
		const uid = user?.uid;
		if (!uid) {
			henter = false;
			return;
		}
		try {
			const data = await hentMinTraening3(uid, programId);
			if (!data) {
				fejl = 'Programmet findes ikke.';
				return;
			}
			mit = data;
			navn = data.navn;
		} catch (e) {
			console.error('[ny] kunne ikke hente eget program', e);
			fejl = 'Programmet kunne ikke hentes lige nu. Prøv igen om lidt.';
		} finally {
			henter = false;
		}
	});

	/** Skriver arbejdskopien op mod Firestore og holder skaermen i takt. */
	async function gem(naeste: MinTraening3, kvittering: string) {
		if (gemmer) return;
		gemmer = true;
		fejl = '';
		try {
			await gemMinTraening3(user?.uid ?? '', naeste);
			mit = naeste;
			besked = kvittering;
		} catch (e) {
			console.error('[ny] kunne ikke gemme eget program', e);
			fejl = 'Kunne ikke gemme. Prøv igen om lidt.';
		} finally {
			gemmer = false;
		}
	}

	function gemNavn() {
		if (!mit) return;
		const problem = validerMinTraening3(navn, mit.dage.length);
		if (problem) {
			fejl = problem;
			return;
		}
		gem({ ...mit, navn: navn.trim() }, 'Navnet er gemt.');
	}

	function tilfoej() {
		if (!mit) return;
		gem({ ...mit, dage: tilfoejTraening3(mit.dage) }, 'Træningen er lagt til.');
	}

	function fjern(nr: number) {
		if (!mit) return;
		const dage = fjernTraening3(mit.dage, nr);
		if (dage === mit.dage) {
			fejl = 'Der skal være mindst én træning i programmet.';
			return;
		}
		gem({ ...mit, dage }, 'Træningen er fjernet.');
	}

	async function slet() {
		if (gemmer) return;
		gemmer = true;
		try {
			await sletMinTraening3(user?.uid ?? '', programId);
			await goto('/ny/traening');
		} catch (e) {
			console.error('[ny] kunne ikke slette eget program', e);
			fejl = 'Programmet kunne ikke slettes lige nu. Prøv igen om lidt.';
			gemmer = false;
		}
	}
</script>

<svelte:head><title>{mit?.navn ?? 'Dit program'}</title></svelte:head>

<div class="ny-pad mt-side">
	<header class="side-top" style="padding-left:0;padding-right:0">
		<a class="tr-tilbage" href="/ny/traening">‹ Mikrotræning</a>
		<h1>{mit?.navn ?? 'Dit program'}</h1>
	</header>

	{#if henter}
		<div class="adm-venter"><Ventetegn variant="lille" /><span>Henter</span></div>
	{:else if !mit}
		<p class="kort rolig">{fejl || 'Programmet findes ikke.'}</p>
	{:else}
		{#if besked}<p class="adm-besked">{besked}</p>{/if}
		{#if fejl}<p class="adm-fejl">{fejl}</p>{/if}

		<label class="adm-felt">
			<span>Navn</span>
			<input type="text" bind:value={navn} maxlength={MAX_EGET_NAVN} />
		</label>
		{#if navnAendret}
			<button type="button" class="ch-knap sekundaer" onclick={gemNavn} disabled={gemmer}>
				Gem navnet
			</button>
		{/if}

		<div class="lab"><h2>Træningerne</h2></div>
		{#each mit.dage as dag (dag.dagNummer)}
			<div class="mt-byg-raekke">
				<a class="mt-byg-link" href={`/ny/traening/byg-eget/${programId}/${dag.dagNummer}`}>
					<span class="mt-tt">
						Træning {dag.dagNummer}
						<span class="mt-ts">
							{#if dag.exercises.length === 0}
								Ingen øvelser endnu
							{:else}
								{dag.exercises.length === 1
									? '1 øvelse'
									: `${dag.exercises.length} øvelser`} · ca. {dagensMinutter(dag)} min
							{/if}
						</span>
					</span>
					<span class="mt-byg-ret">Ret</span>
				</a>
				{#if mit.dage.length > 1}
					<button
						type="button"
						class="tr-mini"
						onclick={() => fjern(dag.dagNummer)}
						disabled={gemmer}
					>
						Fjern
					</button>
				{/if}
			</div>
		{/each}

		<button type="button" class="ch-knap sekundaer" onclick={tilfoej} disabled={gemmer}>
			+ Tilføj en træning
		</button>

		<p class="adm-hjaelp">
			{mit.dage.length === 1 ? '1 træning' : `${mit.dage.length} træninger`}{minutter > 0
				? ` · ca. ${minutter} min i alt`
				: ''}
		</p>

		<a class="ch-knap primaer" href={`/ny/traening/${programId}`}>Se programmet</a>

		{#if visSlet}
			<section class="adm-kort">
				<h2>Slet programmet</h2>
				<p class="adm-hjaelp">
					Programmet og alle dets træninger forsvinder. Det kan ikke fortrydes.
				</p>
				<button type="button" class="ch-knap primaer" onclick={slet} disabled={gemmer}>
					Ja, slet {mit.navn}
				</button>
				<button type="button" class="ch-knap sekundaer" onclick={() => (visSlet = false)}>
					Fortryd
				</button>
			</section>
		{:else}
			<button type="button" class="mt-slet" onclick={() => (visSlet = true)}>
				Slet programmet
			</button>
		{/if}
	{/if}
</div>
