<script lang="ts">
	// ============================================================
	// Admin: alle traeningsprogrammer ét sted. Bid 1, 15. august 2026.
	//
	// I dag ligger programmerne tre steder, og to af dem er bundet til
	// enten et forloeb eller et abonnement. Her er de bare programmer.
	// Hvem der faar dem afgoeres i bid 2.
	//
	// Der skrives KUN i traeningsprogrammer3 og traeningKategorier3.
	// Den gamle app kender ingen af delene, saa de 760 kunder i drift
	// ser praecis det samme som foer.
	// ============================================================

	import { getContext, onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import type { User } from 'firebase/auth';
	import { isAdmin } from '$lib/admin';
	import Ventetegn from '$lib/components/ny/Ventetegn.svelte';
	import {
		kategoriNavn3,
		sorterKategorier3,
		type TraeningKategori3
	} from '$lib/content/traeningKategori3';
	import {
		antalPrKategori,
		filtrerProgrammer3,
		manglerTekstFor,
		tommeDageFor,
		validerProgram3,
		type Traeningsprogram3
	} from '$lib/content/traeningsprogram3';
	import { hentKategorier3 } from '$lib/firestore/traeningKategori3';
	import { hentProgrammer3, opretProgram3 } from '$lib/firestore/traeningsprogram3';
	import { hentAlleForlob } from '$lib/firestore/forlob';
	import { hentTildelinger3 } from '$lib/firestore/traeningTildeling3';
	import {
		daekning3,
		huller3,
		type ModtagerType3,
		type Traeningstildeling3
	} from '$lib/content/traeningTildeling3';

	const hentUser = getContext<() => User | null>('user');
	const user = $derived(hentUser());
	const maaVaereHer = $derived(isAdmin(user));

	let henter = $state(true);
	let kategorier = $state<TraeningKategori3[]>([]);
	let programmer = $state<Traeningsprogram3[]>([]);
	let valgtKategori = $state<string | null>(null);
	let fejl = $state('');

	// Opret-formularen ligger paa siden og ikke i et ark. Ark skal portalles
	// ud af det omraade der ruller, og det har kostet en aften foer. En admin
	// -side har ikke brug for den risiko.
	let viserOpret = $state(false);
	let gemmer = $state(false);
	let navn = $state('');
	let beskrivelse = $state('');
	let kategoriId = $state('');
	let antalDage = $state(21);
	let starterForfra = $state(true);

	const tal = $derived(antalPrKategori(programmer));
	const viste = $derived(filtrerProgrammer3(programmer, valgtKategori));

	// Modtagere der mangler et program i mindst én kategori. Tallet staar
	// paa kortet, saa et nyt hold uden traening ikke kan naa at gaa i luften
	// uden at nogen har set det.
	let tildelinger = $state<Traeningstildeling3[]>([]);
	let modtagere = $state<{ id: string; type: ModtagerType3 }[]>([]);

	const medHul = $derived.by(() => {
		if (kategorier.length === 0) return 0;
		return modtagere.filter(
			(m) => huller3(daekning3(programmer, tildelinger, kategorier, m)).length > 0
		).length;
	});

	const antalBygEget = $derived(tildelinger.filter((t) => t.type === 'byg-eget').length);

	onMount(async () => {
		if (!isAdmin(user)) {
			henter = false;
			return;
		}
		try {
			const [k, p] = await Promise.all([hentKategorier3(), hentProgrammer3()]);
			kategorier = sorterKategorier3(k);
			programmer = p;
			kategoriId = kategorier[0]?.id ?? '';
		} catch (e) {
			console.error('[admin] kunne ikke hente traeningsprogrammer', e);
			fejl = 'Kunne ikke hente. Tjek at reglerne i Firebase er lagt ind.';
		} finally {
			henter = false;
		}
		// Tallene paa de tre kort er en tilgift. Gaar de galt, skal
		// program-listen stadig virke, saa de hentes for sig.
		try {
			const [forlob, t] = await Promise.all([hentAlleForlob(), hentTildelinger3()]);
			tildelinger = t;
			modtagere = [
				...forlob
					.filter((f) => f.aktiv !== false)
					.map((f) => ({ id: f.id, type: 'hold' as ModtagerType3 })),
				{ id: 'medlemmer', type: 'medlemmer' as ModtagerType3 },
				{ id: 'alle', type: 'alle' as ModtagerType3 }
			];
		} catch (e) {
			console.warn('[admin] kunne ikke hente daekningen til kortene', e);
		}
	});

	function aabnOpret() {
		viserOpret = true;
		fejl = '';
		navn = '';
		beskrivelse = '';
		kategoriId = kategorier[0]?.id ?? '';
		antalDage = 21;
		starterForfra = true;
	}

	async function opret() {
		if (gemmer) return;
		const besked = validerProgram3({ navn, kategoriId, antalDage });
		if (besked) {
			fejl = besked;
			return;
		}
		gemmer = true;
		fejl = '';
		try {
			const nyt = await opretProgram3({
				navn: navn.trim(),
				beskrivelse: beskrivelse.trim(),
				kategoriId,
				antalDage,
				starterForfra
			});
			// Videre til dagene med det samme. Et tomt program er ikke noget
			// hun skal staa og kigge paa i en liste.
			await goto(`/ny/admin/traening/${nyt.id}`);
		} catch (e) {
			console.error('[admin] kunne ikke oprette program', e);
			fejl = 'Kunne ikke oprette programmet.';
			gemmer = false;
		}
	}
</script>

<svelte:head><title>Træning · admin</title></svelte:head>

<div class="ny-pad adm">
	{#if !maaVaereHer}
		<div class="adm-kort">Siden er kun for admin.</div>
	{:else if henter}
		<div class="adm-venter"><Ventetegn variant="lille" /><span>Henter</span></div>
	{:else}
		<header class="adm-top">
			<a class="tr-tilbage" href="/ny/admin">‹ Admin</a>
			<h1>Træning</h1>
			<p>Alle træningsprogrammer. Byg dem her, tildel dem bagefter.</p>
		</header>

		{#if fejl}
			<p class="adm-fejl">{fejl}</p>
		{/if}

		<div class="adm-knapper">
			<button type="button" class="ch-knap primaer" onclick={aabnOpret} disabled={viserOpret}>
				+ Nyt program
			</button>
			<a class="ch-knap sekundaer tr-knap-link" href="/ny/admin/traening/kategorier">Kategorier</a>
		</div>

		{#if kategorier.length === 0}
			<div class="adm-kort">
				<h2>Start med en kategori</h2>
				<p class="adm-hjaelp">
					Et program skal have en kategori, altså det udstyr der trænes med. Opret dem først, så
					kan du bygge programmer bagefter.
				</p>
				<a class="ch-knap primaer tr-knap-link" href="/ny/admin/traening/kategorier">
					Opret din første kategori
				</a>
			</div>
		{:else if viserOpret}
			<section class="adm-kort">
				<h2>Nyt program</h2>

				<label class="adm-felt">
					<span>Navn</span>
					<input type="text" bind:value={navn} placeholder="Sommerstyrke" />
				</label>

				<label class="adm-felt">
					<span>Beskrivelse</span>
					<textarea bind:value={beskrivelse} rows="2" placeholder="Kort tekst kunden kan læse"
					></textarea>
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

				<label class="adm-tjek">
					<input type="checkbox" bind:checked={starterForfra} />
					<span>Starter forfra når den er slut</span>
				</label>
				<p class="adm-hjaelp">
					Med flueben kører hun træning 1 igen efter den sidste. Uden får hun besked om at
					programmet er færdigt.
				</p>

				<div class="adm-knapper">
					<button type="button" class="ch-knap primaer" onclick={opret} disabled={gemmer}>
						{gemmer ? 'Opretter' : 'Opret program'}
					</button>
					<button
						type="button"
						class="ch-knap sekundaer"
						onclick={() => (viserOpret = false)}
						disabled={gemmer}
					>
						Fortryd
					</button>
				</div>
				<p class="adm-hjaelp">Programmet oprettes som kladde. Du sætter det selv til klar bagefter.</p>
			</section>
		{/if}

		{#if kategorier.length > 0}
			<div class="tr-chips">
				<button
					type="button"
					class="tr-chip"
					class:valgt={valgtKategori === null}
					onclick={() => (valgtKategori = null)}
				>
					Alle {programmer.length}
				</button>
				{#each kategorier as k (k.id)}
					<button
						type="button"
						class="tr-chip"
						class:valgt={valgtKategori === k.id}
						onclick={() => (valgtKategori = k.id)}
					>
						{k.navn}
						{tal[k.id] ?? 0}
					</button>
				{/each}
			</div>
		{/if}

		{#if programmer.length === 0}
			<p class="adm-tom">Der er ingen programmer her endnu.</p>
		{:else if viste.length === 0}
			<p class="adm-tom">Ingen programmer i den kategori.</p>
		{:else}
			<div class="adm-liste">
				{#each viste as p (p.id)}
					{@const mangler = manglerTekstFor(tommeDageFor(p), p.antalDage)}
					<a class="adm-raekke tr-raekke" href={`/ny/admin/traening/${p.id}`}>
						<div class="adm-raekke-t">
							<span>{p.navn}</span>
							<span class="adm-mrk" class:klar={p.klar}>{p.klar ? 'Klar' : 'Kladde'}</span>
						</div>
						<div class="adm-raekke-s">
							{kategoriNavn3(p.kategoriId, kategorier) || 'Uden kategori'} · {p.antalDage} træninger
						</div>
						{#if mangler}
							<div class="tr-adv">{mangler}</div>
						{/if}
					</a>
				{/each}
			</div>
		{/if}

		<div class="adm-liste tr-kort-liste">
			<a class="adm-raekke tr-raekke" href="/ny/admin/traening/hold">
				<div class="adm-raekke-t"><span>Hold og dækning</span></div>
				<div class="adm-raekke-s">
					{#if medHul === 0}
						Hvem har fået hvad, og mangler nogen noget
					{:else}
						{medHul === 1 ? '1 hold mangler noget' : `${medHul} hold mangler noget`}
					{/if}
				</div>
			</a>
			<a class="adm-raekke tr-raekke" href="/ny/admin/traening/kunde">
				<div class="adm-raekke-t"><span>Slå en kunde op</span></div>
				<div class="adm-raekke-s">Se hvad hun har, og hvorfor</div>
			</a>
			<a class="adm-raekke tr-raekke" href="/ny/admin/traening/byg-eget">
				<div class="adm-raekke-t"><span>Byg eget program</span></div>
				<div class="adm-raekke-s">
					{antalBygEget === 0
						? 'Ingen har adgang endnu'
						: antalBygEget === 1
							? 'Åbent for 1 modtager'
							: `Åbent for ${antalBygEget} modtagere`}
				</div>
			</a>
		</div>
	{/if}
</div>
