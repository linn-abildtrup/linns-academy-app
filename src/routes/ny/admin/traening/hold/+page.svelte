<script lang="ts">
	// ============================================================
	// Admin: har hvert hold traening til alle slags udstyr.
	// Bid 2, 15. august 2026.
	//
	// HVORFOR SIDEN FINDES
	// Kunden vaelger sit udstyr og ser kun de programmer der passer.
	// Tildeler Linn fem programmer til et hold, og de alle sammen
	// kraever redskaber, ser en kvinde der har valgt uden redskaber
	// INGENTING. Hun er paa et forloeb hvor traening er en del af
	// konceptet, og hun har ikke gjort noget forkert.
	//
	// Og fordi en tildeling gaelder ÉT bestemt hold, starter hvert nyt
	// hold paa nul. Derfor staar tomme hold oeverst og med farve.
	// ============================================================

	import { getContext, onMount } from 'svelte';
	import type { User } from 'firebase/auth';
	import { isAdmin } from '$lib/admin';
	import Ventetegn from '$lib/components/ny/Ventetegn.svelte';
	import { getCurrentDay, toIsoLokal } from '$lib/content/forlob';
	import type { Forlob } from '$lib/content/forlobAdgang';
	import { hentAlleForlob } from '$lib/firestore/forlob';
	import type { TraeningKategori3 } from '$lib/content/traeningKategori3';
	import type { Traeningsprogram3 } from '$lib/content/traeningsprogram3';
	import {
		daekning3,
		huller3,
		type ModtagerType3,
		type Traeningstildeling3
	} from '$lib/content/traeningTildeling3';
	import { hentKategorier3 } from '$lib/firestore/traeningKategori3';
	import { hentProgrammer3 } from '$lib/firestore/traeningsprogram3';
	import { hentTildelinger3 } from '$lib/firestore/traeningTildeling3';

	const hentUser = getContext<() => User | null>('user');
	const user = $derived(hentUser());
	const maaVaereHer = $derived(isAdmin(user));

	let henter = $state(true);
	let fejl = $state('');
	let forlob = $state<Forlob[]>([]);
	let programmer = $state<Traeningsprogram3[]>([]);
	let kategorier = $state<TraeningKategori3[]>([]);
	let tildelinger = $state<Traeningstildeling3[]>([]);

	interface Raekke {
		id: string;
		navn: string;
		under: string;
		antal: number;
		antalHuller: number;
		/** 0 tom, 1 hul, 2 i orden. Styrer baade farve og raekkefoelge. */
		vaegt: number;
	}

	function under(f: Forlob): string {
		const dag = getCurrentDay({
			startDato: toIsoLokal(f.startDato.toDate()),
			antalDage: f.antalDage
		});
		if (dag === null) return 'Ikke startet endnu';
		if (dag > f.antalDage) return 'Sluttet';
		return `Dag ${dag} af ${f.antalDage}`;
	}

	function byggRaekke(id: string, navn: string, underTekst: string, type: ModtagerType3): Raekke {
		const d = daekning3(programmer, tildelinger, kategorier, { type, id });
		const antal = d.reduce((sum, x) => sum + x.programNavne.length, 0);
		const antalHuller = huller3(d).length;
		return {
			id,
			navn,
			under: underTekst,
			antal,
			antalHuller,
			vaegt: antal === 0 ? 0 : antalHuller > 0 ? 1 : 2
		};
	}

	const raekker = $derived.by<Raekke[]>(() => {
		if (kategorier.length === 0) return [];
		const hold = forlob
			.filter((f) => f.aktiv !== false)
			.map((f) => byggRaekke(f.id, f.navn, under(f), 'hold'));
		const oevrige = [
			byggRaekke('medlemmer', 'Alle med et abonnement', 'Alle med et aktivt abonnement', 'medlemmer'),
			byggRaekke('alle', 'Alle med appen', 'Både forløb og abonnement', 'alle')
		];
		return [...hold, ...oevrige].sort(
			(a, b) => a.vaegt - b.vaegt || a.navn.localeCompare(b.navn, 'da')
		);
	});

	const medHul = $derived(raekker.filter((r) => r.vaegt < 2).length);

	onMount(async () => {
		if (!isAdmin(user)) {
			henter = false;
			return;
		}
		try {
			const [f, p, k, t] = await Promise.all([
				hentAlleForlob(),
				hentProgrammer3(),
				hentKategorier3(),
				hentTildelinger3()
			]);
			forlob = f;
			programmer = p;
			kategorier = k;
			tildelinger = t;
		} catch (e) {
			console.error('[admin] kunne ikke hente daekningen', e);
			fejl = 'Kunne ikke hente. Tjek at reglerne i Firebase er lagt ind.';
		} finally {
			henter = false;
		}
	});

	function tekst(r: Raekke): string {
		if (r.antal === 0) return 'Ingen programmer';
		const p = r.antal === 1 ? '1 program' : `${r.antal} programmer`;
		if (r.antalHuller === 0) return `${p} · alle kategorier dækket`;
		return `${p} · mangler ${r.antalHuller === 1 ? '1 kategori' : `${r.antalHuller} kategorier`}`;
	}
</script>

<svelte:head><title>Hold og dækning · admin</title></svelte:head>

<div class="ny-pad adm">
	{#if !maaVaereHer}
		<div class="adm-kort">Siden er kun for admin.</div>
	{:else if henter}
		<div class="adm-venter"><Ventetegn variant="lille" /><span>Henter</span></div>
	{:else}
		<header class="adm-top">
			<a class="tr-tilbage" href="/ny/admin/traening">‹ Træning</a>
			<h1>Hold og dækning</h1>
			<p>Har hvert hold programmer til alle slags udstyr?</p>
		</header>

		{#if fejl}<p class="adm-fejl">{fejl}</p>{/if}

		{#if kategorier.length === 0}
			<p class="adm-tom">Der er ingen kategorier endnu, så der er ikke noget at dække.</p>
		{:else}
			{#if medHul > 0}
				<p class="adm-hjaelp">
					{medHul === 1 ? '1 hold mangler noget' : `${medHul} hold mangler noget`}. Et hul er ikke
					altid en fejl, men kunden ser kun det du har givet hende.
				</p>
			{/if}

			<div class="adm-liste">
				{#each raekker as r (r.id)}
					<a class="adm-raekke tr-raekke" class:tom={r.vaegt === 0} href={`/ny/admin/traening/hold/${r.id}`}>
						<div class="adm-raekke-t">
							<span>{r.navn}</span>
							<span class="adm-mrk" class:klar={r.vaegt === 2}>
								{r.vaegt === 0 ? 'Tom' : r.vaegt === 1 ? 'Hul' : 'OK'}
							</span>
						</div>
						<div class="adm-raekke-s">{r.under} · {tekst(r)}</div>
					</a>
				{/each}
			</div>
		{/if}
	{/if}
</div>
