<script lang="ts">
	// ============================================================
	// Admin: byg et traeningsprogram med AI. 16. august 2026.
	//
	// Ingen formular. Hun skriver hvad hun vil have, i fri tekst, og
	// snakker sig frem til et program.
	//
	// FORSLAGET STAAR SOM ET KORT med rigtige oevelsesnavne, ikke som
	// tekst inde i samtalen. Hun skal kunne se hvad hun faar uden at
	// laese et afsnit. Linns valg 15. august.
	//
	// DER GEMMES INGENTING FOER HUN TRYKKER OPRET. Hun kan skrive frem
	// og tilbage saa mange gange hun vil.
	//
	// KATEGORIEN VAELGES HER, ikke af AI'en. To grunde: puljen af
	// oevelser skal filtreres foer den sendes afsted, og programmet skal
	// have en kategori for at kunden overhovedet kan se det. AI'en
	// opretter aldrig kategorier, Linn beholder styringen over den liste.
	// ============================================================

	import { getContext, onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import type { User } from 'firebase/auth';
	import { isAdmin } from '$lib/admin';
	import Ventetegn from '$lib/components/ny/Ventetegn.svelte';
	import type { Exercise } from '$lib/content/mikrotraening';
	import { hentAlleExercises } from '$lib/firestore/mikrotraening';
	import {
		filtrerOevelserTilKategori,
		sorterKategorier3,
		type TraeningKategori3
	} from '$lib/content/traeningKategori3';
	import {
		forslagTekst3,
		maaSendeMere3,
		validerBesked3,
		type AiBesked3,
		type AiForslag3,
		type AiSvar3
	} from '$lib/content/traeningAi3';
	import { hentKategorier3 } from '$lib/firestore/traeningKategori3';
	import { gemDage3, opretProgram3 } from '$lib/firestore/traeningsprogram3';
	import Sidehoved from '$lib/components/ny/Sidehoved.svelte';

	const hentUser = getContext<() => User | null>('user');
	const user = $derived(hentUser());
	const maaVaereHer = $derived(isAdmin(user));

	let henter = $state(true);
	let fejl = $state('');
	let venter = $state(false);
	let opretter = $state(false);
	let kategorier = $state<TraeningKategori3[]>([]);
	let bank = $state<Exercise[]>([]);

	let kategoriId = $state('');
	let medTekst = $state(false);
	let beskeder = $state<AiBesked3[]>([]);
	let udkast = $state('');
	let forslag = $state<AiForslag3 | null>(null);
	let visAlleDage = $state(false);

	/** Samtalens id. Gemmes sammen med samtalen, saa den kan findes igen. */
	const samtaleId = `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

	const kategori = $derived(kategorier.find((k) => k.id === kategoriId) ?? null);

	/** Puljen AI'en maa vaelge fra. Filtreret paa kategorien. */
	const puljen = $derived(filtrerOevelserTilKategori(bank, kategori?.udstyrTag ?? null));

	const kanSende = $derived(
		kategoriId !== '' && udkast.trim() !== '' && !venter && maaSendeMere3(beskeder)
	);

	function navnPaa(exerciseId: string): string {
		return bank.find((e) => e.id === exerciseId)?.name ?? exerciseId;
	}

	onMount(async () => {
		if (!isAdmin(user)) {
			henter = false;
			return;
		}
		try {
			const [k, exercises] = await Promise.all([hentKategorier3(), hentAlleExercises()]);
			kategorier = sorterKategorier3(k);
			bank = exercises;
			kategoriId = kategorier[0]?.id ?? '';
		} catch (e) {
			console.error('[admin] kunne ikke hente til AI-siden', e);
			fejl = 'Kunne ikke hente øvelserne. Prøv igen om lidt.';
		} finally {
			henter = false;
		}
	});

	async function send() {
		const problem = validerBesked3(udkast);
		if (problem) {
			fejl = problem;
			return;
		}
		if (!kategoriId) {
			fejl = 'Vælg først hvilken kategori programmet hører til.';
			return;
		}
		const naeste: AiBesked3[] = [...beskeder, { rolle: 'bruger', tekst: udkast.trim() }];
		beskeder = naeste;
		udkast = '';
		fejl = '';
		venter = true;
		try {
			const token = await user?.getIdToken();
			const res = await fetch('/api/traening-ai', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${token}`
				},
				body: JSON.stringify({
					tilstand: 'nyt',
					beskeder: naeste,
					medTekst,
					samtaleId,
					kategoriNavn: kategori?.navn ?? '',
					oevelser: puljen.map((e) => ({
						id: e.id,
						name: e.name,
						catLabel: e.catLabel,
						udstyr: e.udstyr
					}))
				})
			});
			if (!res.ok) {
				const data = (await res.json().catch(() => null)) as { message?: string } | null;
				fejl = data?.message ?? 'AI-tjenesten svarede ikke. Prøv igen.';
				return;
			}
			const svar = (await res.json()) as AiSvar3;
			beskeder = [...naeste, { rolle: 'ai', tekst: svar.svar }];
			if (svar.forslag) {
				forslag = svar.forslag;
				visAlleDage = false;
			}
		} catch (e) {
			console.error('[admin] AI-kaldet fejlede', e);
			fejl = 'Der skete en fejl. Prøv igen om lidt.';
		} finally {
			venter = false;
		}
	}

	/**
	 * Opretter forslaget som et helt almindeligt program i kladde.
	 * Ingen saerlig AI-type, ingenting er laast, og hun retter i det
	 * bagefter som i alt andet. Linns valg 15. august.
	 */
	async function opret() {
		if (!forslag || opretter) return;
		opretter = true;
		fejl = '';
		try {
			const program = await opretProgram3({
				navn: forslag.navn,
				beskrivelse: forslag.beskrivelse,
				kategoriId,
				antalDage: forslag.antalDage,
				starterForfra: false
			});
			await gemDage3(program.id, forslag.dage);
			await goto(`/ny/admin/traening/${program.id}`);
		} catch (e) {
			console.error('[admin] kunne ikke oprette programmet', e);
			fejl = 'Programmet kunne ikke oprettes. Prøv igen om lidt.';
			opretter = false;
		}
	}

	function dagTekst(nr: number): string {
		const dag = forslag?.dage.find((d) => d.dagNummer === nr);
		if (!dag) return '';
		return dag.exercises.map((o) => navnPaa(o.exerciseId)).join(' · ');
	}
</script>

<svelte:head><title>Byg med AI · admin</title></svelte:head>

<div class="ny-pad adm">
	{#if !maaVaereHer}
		<div class="adm-kort">Siden er kun for admin.</div>
	{:else if henter}
		<div class="adm-venter"><Ventetegn variant="lille" /><span>Henter øvelserne</span></div>
	{:else}
		<Sidehoved
			titel="Byg med AI"
			tilbage="/ny/admin/traening"
			tilbageTekst="Træning"
			under="Beskriv hvad programmet skal kunne. Jeg foreslår øvelser fra din egen bank."
			kant={false}
		/>

		{#if fejl}<p class="adm-fejl">{fejl}</p>{/if}

		{#if beskeder.length === 0}
			<label class="adm-felt">
				<span>Kategori</span>
				<select bind:value={kategoriId}>
					{#each kategorier as k (k.id)}
						<option value={k.id}>{k.navn}</option>
					{/each}
				</select>
			</label>
			<p class="adm-hjaelp">
				Kategorien afgør hvilke øvelser jeg må vælge imellem, og hvor programmet lander.
				{puljen.length === 1 ? '1 øvelse' : `${puljen.length} øvelser`} passer til den.
			</p>
		{:else}
			<p class="adm-hjaelp">{kategori?.navn} · {puljen.length} øvelser at vælge imellem</p>
		{/if}

		<div class="ai-samtale">
			{#each beskeder as b, i (i)}
				<div class="ai-boble" class:mig={b.rolle === 'bruger'}>{b.tekst}</div>
			{/each}
			{#if venter}
				<div class="ai-boble"><Ventetegn variant="lille" /></div>
			{/if}
		</div>

		{#if forslag}
			<section class="ai-forslag">
				<h2>{forslag.navn}</h2>
				<p class="adm-hjaelp">{forslagTekst3(forslag, kategori?.navn ?? '')}</p>
				{#if forslag.beskrivelse}<p class="adm-hjaelp">{forslag.beskrivelse}</p>{/if}

				{#each forslag.dage.slice(0, visAlleDage ? forslag.dage.length : 3) as d (d.dagNummer)}
					<div class="ai-dag">
						<span class="ai-dag-nr">Træning {d.dagNummer}</span>
						<span class="ai-dag-o">{dagTekst(d.dagNummer)}</span>
					</div>
				{/each}
				{#if !visAlleDage && forslag.dage.length > 3}
					<button type="button" class="tr-mini" onclick={() => (visAlleDage = true)}>
						Vis alle {forslag.dage.length} træninger
					</button>
				{/if}

				<button type="button" class="ch-knap primaer" onclick={opret} disabled={opretter}>
					{opretter ? 'Opretter' : 'Opret som kladde'}
				</button>
				<p class="adm-hjaelp">Der bliver ikke gemt noget før du trykker Opret.</p>
			</section>
		{/if}

		<label class="adm-tjek">
			<input type="checkbox" bind:checked={medTekst} />
			<span>Skriv også titler og en kort tekst til hver træning</span>
		</label>

		<label class="adm-felt">
			<span>{beskeder.length === 0 ? 'Hvad skal programmet kunne?' : 'Ret videre'}</span>
			<textarea
				bind:value={udkast}
				rows="3"
				placeholder={beskeder.length === 0
					? 'Skriv gerne hvem det er til, hvor lang tid hun har, og hvad hun har af udstyr'
					: 'Skriv hvad der skal laves om'}
			></textarea>
		</label>

		<button type="button" class="ch-knap primaer" onclick={send} disabled={!kanSende}>
			{venter ? 'Tænker' : 'Send'}
		</button>

		{#if !maaSendeMere3(beskeder)}
			<p class="adm-hjaelp">Samtalen er blevet lang. Opret det du har, eller start en ny.</p>
		{/if}

		<p class="ai-note">◆ Bruger kun øvelser fra din bank</p>
	{/if}
</div>
