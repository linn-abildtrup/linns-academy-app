<script lang="ts">
	// ============================================================
	// Admin: opret og tildel challenges.
	//
	// Ny side, ligger i 3.0. Den gamle admin-side under forloeb roeres
	// ikke, og de challenges der allerede ligger der bliver hvor de er.
	//
	// Her laves de nye, som ligger for sig selv og kan tildeles til et
	// hold, til alle der har appen, eller til begge dele paa én gang.
	// ============================================================

	import { getContext, onMount } from 'svelte';
	import type { User } from 'firebase/auth';
	import { isAdmin } from '$lib/admin';
	import { hentAlleForlob } from '$lib/firestore/forlob';
	import type { Forlob } from '$lib/content/forlobAdgang';
	import {
		gemChallenge,
		hentAlleMasterChallenges,
		sletChallenge,
		tilDatoFelt
	} from '$lib/firestore/challengeAdmin3';
	import { STANDARD_MAAL, type MasterChallenge, type Modtager } from '$lib/content/challenge3';
	import Ventetegn from '$lib/components/ny/Ventetegn.svelte';

	const hentUser = getContext<() => User | null>('user');
	const user = $derived(hentUser());
	const maaVaereHer = $derived(isAdmin(user));

	let henter = $state(true);
	let gemmer = $state(false);
	let besked = $state('');
	let challenges = $state<MasterChallenge[]>([]);
	let forlob = $state<Forlob[]>([]);

	// Formularen
	let redigererId = $state('');
	let navn = $state('');
	let beskrivelse = $state('');
	let startDato = $state('');
	let slutDato = $state('');
	let maal = $state(STANDARD_MAAL);
	let aktiv = $state(true);
	let tilAlleApp = $state(false);
	let valgteForlob = $state<Set<string>>(new Set());

	onMount(() => {
		(async () => {
			try {
				const [c, f] = await Promise.all([hentAlleMasterChallenges(), hentAlleForlob()]);
				challenges = c;
				forlob = f;
			} catch (e) {
				console.error('[admin] kunne ikke hente challenges', e);
				besked = 'Kunne ikke hente. Prøv at hente siden igen.';
			} finally {
				henter = false;
			}
		})();
	});

	function nulstil() {
		redigererId = '';
		navn = '';
		beskrivelse = '';
		startDato = '';
		slutDato = '';
		maal = STANDARD_MAAL;
		aktiv = true;
		tilAlleApp = false;
		valgteForlob = new Set();
	}

	function redigér(c: MasterChallenge) {
		redigererId = c.id;
		navn = c.navn;
		beskrivelse = c.beskrivelse;
		startDato = tilDatoFelt(c.startDato);
		slutDato = tilDatoFelt(c.slutDato);
		maal = c.maal ?? STANDARD_MAAL;
		aktiv = c.aktiv;
		tilAlleApp = c.modtagere.some((m) => m.type === 'alle-app');
		valgteForlob = new Set(c.modtagere.filter((m) => m.type === 'forlob').map((m) => m.id));
		besked = '';
		window.scrollTo({ top: 0, behavior: 'smooth' });
	}

	function skiftForlob(id: string) {
		const ny = new Set(valgteForlob);
		if (ny.has(id)) ny.delete(id);
		else ny.add(id);
		valgteForlob = ny;
	}

	const modtagere = $derived.by<Modtager[]>(() => {
		const ud: Modtager[] = [];
		if (tilAlleApp) ud.push({ type: 'alle-app', id: '' });
		for (const id of valgteForlob) ud.push({ type: 'forlob', id });
		return ud;
	});

	const kanGemme = $derived(
		navn.trim().length > 0 && startDato !== '' && slutDato !== '' && modtagere.length > 0 && !gemmer
	);

	// Den hyppigste fejl er at slutdatoen ligger foer startdatoen.
	const datoFejl = $derived(startDato && slutDato && slutDato < startDato);

	async function gem() {
		if (!kanGemme || datoFejl) return;
		gemmer = true;
		besked = '';
		try {
			await gemChallenge({
				id: redigererId || undefined,
				navn,
				beskrivelse,
				startDato,
				slutDato,
				aktiv,
				maal,
				modtagere,
				fravalgteBrugere: challenges.find((c) => c.id === redigererId)?.fravalgteBrugere ?? []
			});
			challenges = await hentAlleMasterChallenges();
			besked = redigererId ? 'Challenge rettet.' : 'Challenge oprettet.';
			nulstil();
		} catch (e) {
			console.error('[admin] kunne ikke gemme', e);
			besked = 'Kunne ikke gemme. Tjek at reglerne i Firebase er lagt ind.';
		} finally {
			gemmer = false;
		}
	}

	async function slet(c: MasterChallenge) {
		if (!confirm(`Slet "${c.navn}"? Kundernes indtastninger bliver liggende.`)) return;
		try {
			await sletChallenge(c.id);
			challenges = await hentAlleMasterChallenges();
			if (redigererId === c.id) nulstil();
			besked = 'Challenge slettet.';
		} catch (e) {
			console.error('[admin] kunne ikke slette', e);
			besked = 'Kunne ikke slette.';
		}
	}

	function forlobNavn(id: string): string {
		return forlob.find((f) => f.id === id)?.navn ?? id;
	}

	function modtagerTekst(c: MasterChallenge): string {
		if (c.modtagere.length === 0) return 'Ikke tildelt nogen';
		return c.modtagere
			.map((m) => {
				if (m.type === 'alle-app') return 'Alle med appen';
				if (m.type === 'kunde') return 'Én kunde';
				return forlobNavn(m.id);
			})
			.join(', ');
	}
</script>

<svelte:head><title>Challenges · admin</title></svelte:head>

<div class="ny-pad adm">
	{#if !maaVaereHer}
		<div class="kort rolig">Siden er kun for admin.</div>
	{:else if henter}
		<div class="adm-venter"><Ventetegn variant="lille" /><span>Henter</span></div>
	{:else}
		<header class="adm-top">
			<a class="tr-tilbage" href="/ny/admin">‹ Admin</a>
			<h1>Challenges</h1>
			<p>
				En challenge ligger for sig selv og bliver tildelt. Du kan give den til et hold, til alle
				der har appen, eller til flere ting på én gang.
			</p>
		</header>

		{#if besked}
			<p class="adm-besked">{besked}</p>
		{/if}

		<section class="adm-kort">
			<h2>{redigererId ? 'Ret challenge' : 'Ny challenge'}</h2>

			<label class="adm-felt">
				<span>Navn</span>
				<input type="text" bind:value={navn} placeholder="Planter til tarmmikrobiom" />
			</label>

			<label class="adm-felt">
				<span>Beskrivelse</span>
				<textarea bind:value={beskrivelse} rows="2" placeholder="Kort linje kunden ser"></textarea>
			</label>

			<div class="adm-to">
				<label class="adm-felt">
					<span>Første dag</span>
					<input type="date" bind:value={startDato} />
				</label>
				<label class="adm-felt">
					<span>Sidste dag</span>
					<input type="date" bind:value={slutDato} />
				</label>
			</div>

			{#if datoFejl}
				<p class="adm-fejl">Sidste dag ligger før første dag.</p>
			{/if}

			<label class="adm-felt">
				<span>Mål, altså hvor mange planter der skal til for at være i mål</span>
				<input type="number" bind:value={maal} min="1" max="500" />
			</label>
			<p class="adm-hjaelp">
				Til sammenligning: i din challenge 1. til 7. juni nåede den bedste 49 og midten 32. Ingen
				nåede 50 på en uge. Kører challengen længere, kan målet godt være højere.
			</p>

			<fieldset class="adm-felt">
				<legend>Hvem skal have den</legend>
				<label class="adm-tjek">
					<input type="checkbox" bind:checked={tilAlleApp} />
					<span>Alle der har appen, også dem uden forløb</span>
				</label>
				{#each forlob as f (f.id)}
					<label class="adm-tjek">
						<input
							type="checkbox"
							checked={valgteForlob.has(f.id)}
							onchange={() => skiftForlob(f.id)}
						/>
						<span>{f.navn}</span>
					</label>
				{/each}
			</fieldset>

			<label class="adm-tjek">
				<input type="checkbox" bind:checked={aktiv} />
				<span>Slået til. Uden flueben vises den ikke, uanset datoerne</span>
			</label>

			<div class="adm-knapper">
				<button type="button" class="ch-knap primaer" disabled={!kanGemme || !!datoFejl} onclick={gem}>
					{gemmer ? 'Gemmer' : redigererId ? 'Gem rettelsen' : 'Opret challenge'}
				</button>
				{#if redigererId}
					<button type="button" class="ch-knap sekundaer" onclick={nulstil}>Fortryd</button>
				{/if}
			</div>
		</section>

		<section class="adm-liste">
			<h2>Dine challenges</h2>
			{#if challenges.length === 0}
				<p class="adm-tom">Der er ingen endnu. Opret den første ovenfor.</p>
			{:else}
				{#each challenges as c (c.id)}
					<article class="adm-raekke">
						<div class="adm-raekke-t">
							<strong>{c.navn}</strong>
							{#if !c.aktiv}<span class="adm-mrk">slået fra</span>{/if}
						</div>
						<div class="adm-raekke-s">
							{tilDatoFelt(c.startDato)} til {tilDatoFelt(c.slutDato)} · mål {c.maal ??
								STANDARD_MAAL}
						</div>
						<div class="adm-raekke-s">{modtagerTekst(c)}</div>
						<div class="adm-knapper">
							<button type="button" class="ch-knap sekundaer" onclick={() => redigér(c)}>Ret</button>
							<button type="button" class="ch-knap sekundaer" onclick={() => slet(c)}>Slet</button>
						</div>
					</article>
				{/each}
			{/if}
		</section>
	{/if}
</div>
