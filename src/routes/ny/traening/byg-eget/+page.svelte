<script lang="ts">
	// ============================================================
	// Kunden bygger sit eget program. Trin 1: navn og antal. Bid 6.
	//
	// Hun bliver ikke bedt om at vaelge oevelser her. Foerst faar hun et
	// program med de tomme traeninger, og saa fylder hun dem ud én ad
	// gangen. Ét langt skema paa en telefon er den sikreste maade at
	// miste hende paa.
	//
	// "Lav et forslag til mig" fylder alle traeningerne med det samme,
	// ud fra det udstyr hun har valgt. Saa har hun noget at rette i i
	// stedet for at starte fra ingenting, og det er den vej de fleste
	// gaar. Linns valg 16. august.
	//
	// Adgangen tjekkes her ogsaa, ikke kun paa knappen i listen. En
	// adresse skrevet i haanden maa ikke aabne noget hun ikke har faaet.
	// ============================================================

	import { getContext, onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import type { User } from 'firebase/auth';
	import type { UserDoc } from '$lib/types';
	import Ventetegn from '$lib/components/ny/Ventetegn.svelte';
	import type { Adgangsbillede, ForlobKilde } from '$lib/content/adgang3';
	import type { Exercise } from '$lib/content/mikrotraening';
	import { genererProgramMedConfig } from '$lib/content/mikrotraening';
	import {
		oevelserTilKunde3,
		rensUdstyr3,
		udstyrFra,
		type TraeningKategori3
	} from '$lib/content/traeningKategori3';
	import { STANDARD_OEVELSE3 } from '$lib/content/traeningsprogram3';
	import {
		maaByggeEget3,
		type KundeKontekst3,
		type Traeningstildeling3
	} from '$lib/content/traeningTildeling3';
	import { MAX_EGET_NAVN, validerMinTraening3 } from '$lib/content/mineTraeninger3';
	import { hentKategorier3 } from '$lib/firestore/traeningKategori3';
	import { hentMineTildelinger3 } from '$lib/firestore/traeningTildeling3';
	import { hentAlleExercises } from '$lib/firestore/mikrotraening';
	import { gemMinTraening3, opretMinTraening3 } from '$lib/firestore/mineTraeninger3';
	import { harAbonnement3, isoDato3 } from '$lib/firestore/traeningKunde3';
	import Sidehoved from '$lib/components/ny/Sidehoved.svelte';

	const hentUser = getContext<() => User | null>('user');
	const hentUserDoc = getContext<() => UserDoc | null>('userDoc');
	const hentAdgang = getContext<() => Adgangsbillede>('adgang');
	const hentForlob = getContext<() => ForlobKilde[]>('forlob');

	const user = $derived(hentUser());
	const userDoc = $derived(hentUserDoc());
	const adgang = $derived(hentAdgang());
	const forlob = $derived(hentForlob?.() ?? []);

	let henter = $state(true);
	let fejl = $state('');
	let gemmer = $state(false);
	let maaBygge = $state(false);
	let kategorier = $state<TraeningKategori3[]>([]);
	let bank = $state<Exercise[]>([]);

	let navn = $state('');
	let antal = $state(3);
	let medForslag = $state(true);

	const nu = Date.now();

	const mineOevelser = $derived(
		oevelserTilKunde3(bank, kategorier, rensUdstyr3(udstyrFra(userDoc), kategorier))
	);

	onMount(async () => {
		const uid = user?.uid;
		if (!uid) {
			henter = false;
			return;
		}
		try {
			const [k, t, exercises] = await Promise.all([
				hentKategorier3(),
				hentMineTildelinger3(uid),
				hentAlleExercises()
			]);
			kategorier = k;
			bank = exercises;
			const kontekst: KundeKontekst3 = {
				uid,
				forlob: adgang.aktiveForlob.map((x) => ({ id: x.forlobId, dag: x.dagNummer })),
				harAbonnement: harAbonnement3(userDoc, forlob, nu),
				udstyr: rensUdstyr3(udstyrFra(userDoc), k),
				idag: isoDato3(nu)
			};
			maaBygge = maaByggeEget3(t as Traeningstildeling3[], kontekst);
		} catch (e) {
			console.error('[ny] kunne ikke hente byg-siden', e);
			fejl = 'Siden kunne ikke hentes lige nu. Prøv igen om lidt.';
		} finally {
			henter = false;
		}
	});

	async function opret() {
		if (gemmer) return;
		const problem = validerMinTraening3(navn, antal);
		if (problem) {
			fejl = problem;
			return;
		}
		gemmer = true;
		fejl = '';
		try {
			const nyt = await opretMinTraening3(user?.uid ?? '', navn, antal);
			if (medForslag) {
				// Forslaget er en tilgift. Kan det ikke laves, fordi hendes
				// udstyr ikke daekker alle tre oevelses-grupper, faar hun det
				// tomme program i stedet for en fejl. Hun kan altid fylde selv.
				try {
					nyt.dage = genererProgramMedConfig(antal, mineOevelser, {
						antalOvelser: 4,
						...STANDARD_OEVELSE3
					});
					await gemMinTraening3(user?.uid ?? '', nyt);
				} catch (e) {
					console.warn('[ny] kunne ikke lave et forslag', e);
				}
			}
			await goto(`/ny/traening/byg-eget/${nyt.id}`);
		} catch (e) {
			console.error('[ny] kunne ikke oprette programmet', e);
			fejl = 'Programmet kunne ikke oprettes lige nu. Prøv igen om lidt.';
			gemmer = false;
		}
	}
</script>

<svelte:head><title>Byg dit eget program</title></svelte:head>

<div class="ny-pad mt-side">
	<Sidehoved
		titel="Byg dit eget program"
		tilbage="/ny/traening"
		tilbageTekst="Mikrotræning"
		kant={false}
	/>

	{#if henter}
		<div class="adm-venter"><Ventetegn variant="lille" /><span>Henter</span></div>
	{:else if !maaBygge}
		<p class="kort rolig">Du kan ikke bygge dine egne programmer lige nu.</p>
	{:else}
		<p class="mt-under">
			Giv programmet et navn og vælg hvor mange træninger det skal have. Du kan altid tilføje flere
			bagefter.
		</p>

		{#if fejl}<p class="adm-fejl">{fejl}</p>{/if}

		<label class="adm-felt">
			<span>Navn</span>
			<input
				type="text"
				bind:value={navn}
				maxlength={MAX_EGET_NAVN}
				placeholder="Fx Min morgenrutine"
			/>
		</label>

		<label class="adm-felt">
			<span>Antal træninger</span>
			<input type="number" min="1" max="100" bind:value={antal} />
		</label>

		<label class="adm-tjek">
			<input type="checkbox" bind:checked={medForslag} />
			<span>Lav et forslag til mig, så jeg har noget at rette i</span>
		</label>

		<p class="adm-hjaelp">
			Forslaget bruger kun øvelser der passer til det udstyr du har valgt i din profil.
		</p>

		<button type="button" class="ch-knap primaer" onclick={opret} disabled={gemmer}>
			{gemmer ? 'Opretter' : 'Opret programmet'}
		</button>
	{/if}
</div>
