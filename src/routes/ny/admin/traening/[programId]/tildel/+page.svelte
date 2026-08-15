<script lang="ts">
	// ============================================================
	// Admin: hvem har det her program, og hvornaar gaelder det.
	// Bid 2, 15. august 2026.
	//
	// Kun et program der er sat til KLAR kan gives ud. Spaerren er den
	// samme som i bid 1, og her er den det der forhindrer at et
	// halvbygget 84-dages program lander hos et helt hold.
	// ============================================================

	import { getContext, onMount } from 'svelte';
	import { page } from '$app/state';
	import type { User } from 'firebase/auth';
	import { isAdmin } from '$lib/admin';
	import Ventetegn from '$lib/components/ny/Ventetegn.svelte';
	import TildelPanel from '$lib/components/ny/TildelPanel.svelte';
	import { getCurrentDay, toIsoLokal } from '$lib/content/forlob';
	import type { Forlob } from '$lib/content/forlobAdgang';
	import { hentAlleForlob } from '$lib/firestore/forlob';
	import { kategoriNavn3, type TraeningKategori3 } from '$lib/content/traeningKategori3';
	import {
		manglerTekstFor,
		tommeDageFor,
		type Traeningsprogram3
	} from '$lib/content/traeningsprogram3';
	import {
		modtagerTekst3,
		periodeTekst3,
		sorterTildelinger3,
		tildelingStatus3,
		type HoldValg3,
		type NyTildeling3,
		type Tildelingsstatus3,
		type Traeningstildeling3
	} from '$lib/content/traeningTildeling3';
	import { hentKategorier3 } from '$lib/firestore/traeningKategori3';
	import { hentProgrammer3 } from '$lib/firestore/traeningsprogram3';
	import {
		hentTildelinger3,
		opretTildelinger3,
		sletTildeling3
	} from '$lib/firestore/traeningTildeling3';
	import { isoDato3 } from '$lib/firestore/traeningKunde3';

	const hentUser = getContext<() => User | null>('user');
	const user = $derived(hentUser());
	const maaVaereHer = $derived(isAdmin(user));
	const programId = $derived(page.params.programId ?? '');

	let henter = $state(true);
	let program = $state<Traeningsprogram3 | null>(null);
	let kategorier = $state<TraeningKategori3[]>([]);
	let forlob = $state<Forlob[]>([]);
	let alleTildelinger = $state<Traeningstildeling3[]>([]);
	let fejl = $state('');
	let besked = $state('');
	let viserPanel = $state(false);

	const nu = Date.now();
	const idag = isoDato3(nu);

	/** Holdets dag lige nu. null naar holdet ikke er startet. */
	function holdDag(forlobId: string): number | null {
		const f = forlob.find((x) => x.id === forlobId);
		if (!f) return null;
		return getCurrentDay({ startDato: toIsoLokal(f.startDato.toDate()), antalDage: f.antalDage });
	}

	function status(t: Traeningstildeling3): Tildelingsstatus3 {
		return tildelingStatus3(t, { idag, holdDag: holdDag(t.modtagerId) });
	}

	const mine = $derived(
		sorterTildelinger3(
			alleTildelinger.filter((t) => t.type === 'program' && t.programId === programId),
			status
		)
	);

	const holdValg = $derived<HoldValg3[]>(
		forlob
			.filter((f) => f.aktiv !== false)
			.map((f) => ({ id: f.id, navn: f.navn, dag: holdDag(f.id), antalKunder: null }))
	);

	const mangler = $derived(program ? manglerTekstFor(tommeDageFor(program), program.antalDage) : null);

	onMount(async () => {
		if (!isAdmin(user)) {
			henter = false;
			return;
		}
		await hentAlt();
	});

	async function hentAlt() {
		try {
			const [programmer, k, f, t] = await Promise.all([
				hentProgrammer3(),
				hentKategorier3(),
				hentAlleForlob(),
				hentTildelinger3()
			]);
			program = programmer.find((p) => p.id === programId) ?? null;
			kategorier = k;
			forlob = f;
			alleTildelinger = t;
			if (!program) fejl = 'Programmet findes ikke.';
		} catch (e) {
			console.error('[admin] kunne ikke hente tildelinger', e);
			fejl = 'Kunne ikke hente. Tjek at reglerne i Firebase er lagt ind.';
		} finally {
			henter = false;
		}
	}

	async function gem(nye: NyTildeling3[]) {
		await opretTildelinger3(nye);
		alleTildelinger = await hentTildelinger3();
		viserPanel = false;
		besked = nye.length === 1 ? 'Programmet er givet ud.' : `Givet til ${nye.length} modtagere.`;
	}

	async function fjern(t: Traeningstildeling3) {
		const svar = confirm(
			`${modtagerTekst3(t)} mister programmet.\n\nKundernes fremgang bliver liggende. Får de det igen senere, starter de hvor de slap.`
		);
		if (!svar) return;
		try {
			await sletTildeling3(t.id);
			alleTildelinger = await hentTildelinger3();
			besked = 'Tildelingen er fjernet.';
		} catch (e) {
			console.error('[admin] kunne ikke fjerne tildeling', e);
			fejl = 'Kunne ikke fjerne.';
		}
	}

	function statusTekst(s: Tildelingsstatus3): string {
		return s === 'aktiv' ? 'Aktiv' : s === 'venter' ? 'Venter' : 'Slut';
	}
</script>

<svelte:head><title>Tildel · admin</title></svelte:head>

<div class="ny-pad adm">
	{#if !maaVaereHer}
		<div class="adm-kort">Siden er kun for admin.</div>
	{:else if henter}
		<div class="adm-venter"><Ventetegn variant="lille" /><span>Henter</span></div>
	{:else if !program}
		<p class="adm-fejl">{fejl || 'Programmet findes ikke.'}</p>
	{:else}
		<header class="adm-top">
			<a class="tr-tilbage" href={`/ny/admin/traening/${programId}`}>‹ {program.navn}</a>
			<h1>Tildel</h1>
			<p>
				{program.navn} · {kategoriNavn3(program.kategoriId, kategorier) || 'uden kategori'} · {program.antalDage}
				træninger
			</p>
		</header>

		{#if besked}<p class="adm-besked">{besked}</p>{/if}
		{#if fejl}<p class="adm-fejl">{fejl}</p>{/if}

		{#if !program.klar}
			<div class="adm-kort">
				<div class="tr-adv">
					Programmet er en kladde og kan ikke gives ud endnu.{mangler ? ` ${mangler}.` : ''}
				</div>
				<a class="ch-knap sekundaer tr-knap-link" href={`/ny/admin/traening/${programId}`}>
					Gå til programmet
				</a>
			</div>
		{:else}
			{#if mine.length === 0}
				<p class="adm-tom">Ingen har fået programmet endnu.</p>
			{:else}
				<div class="adm-liste">
					{#each mine as t (t.id)}
						{@const s = status(t)}
						<div class="adm-raekke">
							<div class="adm-raekke-t">
								<span>{modtagerTekst3(t)}</span>
								<span class="adm-mrk" class:klar={s === 'aktiv'} class:slut={s === 'slut'}>
									{statusTekst(s)}
								</span>
							</div>
							<div class="adm-raekke-s">{periodeTekst3(t)}</div>
							<div class="tr-mini-raekke">
								<button type="button" class="tr-mini" onclick={() => fjern(t)}>Fjern</button>
							</div>
						</div>
					{/each}
				</div>
			{/if}

			{#if viserPanel}
				<TildelPanel
					type="program"
					{programId}
					eksisterende={mine}
					hold={holdValg}
					adminUid={user?.uid ?? ''}
					{gem}
					luk={() => (viserPanel = false)}
				/>
			{:else}
				<button type="button" class="ch-knap primaer" onclick={() => (viserPanel = true)}>
					{mine.length === 0 ? '+ Giv det til nogen' : '+ Giv det til flere'}
				</button>
			{/if}
		{/if}
	{/if}
</div>
