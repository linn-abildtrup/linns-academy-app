<script lang="ts">
	// ============================================================
	// Admin: ét holds daekning, kategori for kategori.
	// Bid 2, 15. august 2026.
	//
	// KOPIÉR FRA ET TIDLIGERE HOLD er det vigtigste her. Fordi en
	// tildeling gaelder ét bestemt hold, starter hvert nyt hold paa nul,
	// og saa skal op til seks programmer gives ud i haanden hver gang.
	// Det er praecis dér et hold bliver glemt og starter uden traening.
	//
	// De to reserverede id'er 'medlemmer' og 'alle' er ikke hold, saa de
	// har ingen dage og ingen kopiér-knap.
	// ============================================================

	import { getContext, onMount } from 'svelte';
	import { page } from '$app/state';
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
		kopierTildelinger3,
		periodeTekst3,
		type Daekning3,
		type ModtagerType3,
		type Traeningstildeling3
	} from '$lib/content/traeningTildeling3';
	import { hentKategorier3 } from '$lib/firestore/traeningKategori3';
	import { hentProgrammer3 } from '$lib/firestore/traeningsprogram3';
	import { hentTildelinger3, opretTildelinger3 } from '$lib/firestore/traeningTildeling3';

	const hentUser = getContext<() => User | null>('user');
	const user = $derived(hentUser());
	const maaVaereHer = $derived(isAdmin(user));
	const modtagerId = $derived(page.params.modtagerId ?? '');

	let henter = $state(true);
	let fejl = $state('');
	let besked = $state('');
	let gemmer = $state(false);
	let forlob = $state<Forlob[]>([]);
	let programmer = $state<Traeningsprogram3[]>([]);
	let kategorier = $state<TraeningKategori3[]>([]);
	let tildelinger = $state<Traeningstildeling3[]>([]);
	let kilde = $state('');

	const erHold = $derived(modtagerId !== 'medlemmer' && modtagerId !== 'alle');
	const modtagerType = $derived<ModtagerType3>(
		modtagerId === 'medlemmer' ? 'medlemmer' : modtagerId === 'alle' ? 'alle' : 'hold'
	);
	const holdet = $derived(forlob.find((f) => f.id === modtagerId) ?? null);

	const navn = $derived(
		modtagerId === 'medlemmer'
			? 'Alle med et abonnement'
			: modtagerId === 'alle'
				? 'Alle med appen'
				: (holdet?.navn ?? modtagerId)
	);

	const dag = $derived.by<number | null>(() => {
		if (!holdet) return null;
		return getCurrentDay({
			startDato: toIsoLokal(holdet.startDato.toDate()),
			antalDage: holdet.antalDage
		});
	});

	const mine = $derived(
		tildelinger.filter(
			(t) => t.type === 'program' && t.modtagerType === modtagerType && t.modtagerId === modtagerId
		)
	);

	const daekning = $derived<Daekning3[]>(
		kategorier.length === 0
			? []
			: daekning3(programmer, tildelinger, kategorier, { type: modtagerType, id: modtagerId })
	);
	const huller = $derived(huller3(daekning));

	/** Andre hold der har noget at kopiere fra. Flest tildelinger foerst. */
	const kildeHold = $derived.by(() => {
		const tal = new Map<string, number>();
		for (const t of tildelinger) {
			if (t.modtagerType !== 'hold' || t.modtagerId === modtagerId) continue;
			tal.set(t.modtagerId, (tal.get(t.modtagerId) ?? 0) + 1);
		}
		return [...tal.entries()]
			.map(([id, antal]) => ({ id, antal, navn: forlob.find((f) => f.id === id)?.navn ?? id }))
			.sort((a, b) => b.antal - a.antal || a.navn.localeCompare(b.navn, 'da'));
	});

	onMount(async () => {
		if (!isAdmin(user)) {
			henter = false;
			return;
		}
		await hentAlt();
	});

	async function hentAlt() {
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
			if (!kilde) kilde = kildeHold[0]?.id ?? '';
		} catch (e) {
			console.error('[admin] kunne ikke hente holdet', e);
			fejl = 'Kunne ikke hente. Tjek at reglerne i Firebase er lagt ind.';
		} finally {
			henter = false;
		}
	}

	async function kopier() {
		if (gemmer || !kilde || !holdet) return;
		const nye = kopierTildelinger3(
			tildelinger,
			kilde,
			{ forlobId: modtagerId, navn: holdet.navn },
			Date.now(),
			user?.uid ?? ''
		);
		if (nye.length === 0) {
			besked = 'Der var ikke noget at kopiere. Holdet har det hele i forvejen.';
			return;
		}
		gemmer = true;
		fejl = '';
		try {
			await opretTildelinger3(nye);
			tildelinger = await hentTildelinger3();
			besked =
				nye.length === 1 ? '1 tildeling kopieret over.' : `${nye.length} tildelinger kopieret over.`;
		} catch (e) {
			console.error('[admin] kunne ikke kopiere', e);
			fejl = 'Kunne ikke kopiere.';
		} finally {
			gemmer = false;
		}
	}

	function programNavn(programId: string): string {
		return programmer.find((p) => p.id === programId)?.navn ?? 'Slettet program';
	}
</script>

<svelte:head><title>{navn} · admin</title></svelte:head>

<div class="ny-pad adm">
	{#if !maaVaereHer}
		<div class="adm-kort">Siden er kun for admin.</div>
	{:else if henter}
		<div class="adm-venter"><Ventetegn variant="lille" /><span>Henter</span></div>
	{:else}
		<header class="adm-top">
			<a class="tr-tilbage" href="/ny/admin/traening/hold">‹ Hold og dækning</a>
			<h1>{navn}</h1>
			<p>
				{mine.length === 1 ? '1 program' : `${mine.length} programmer`}{#if erHold}
					· {dag === null ? 'ikke startet endnu' : `dag ${dag}`}{/if}
			</p>
		</header>

		{#if besked}<p class="adm-besked">{besked}</p>{/if}
		{#if fejl}<p class="adm-fejl">{fejl}</p>{/if}

		{#if mine.length === 0}
			<div class="tr-adv">
				{erHold ? 'Holdet har ingen træning endnu.' : 'Der er ingen programmer her endnu.'}
			</div>
		{/if}

		{#if erHold && kildeHold.length > 0}
			<section class="adm-kort">
				<h2>Hurtig vej</h2>
				<p class="adm-hjaelp">
					Kopiér et andet holds programmer over med de samme dage. Det holdet allerede har,
					springes over, så du kan trykke uden at få dubletter.
				</p>
				<label class="adm-felt">
					<span>Kopiér fra</span>
					<select bind:value={kilde}>
						{#each kildeHold as k (k.id)}
							<option value={k.id}>
								{k.navn} · {k.antal === 1 ? '1 tildeling' : `${k.antal} tildelinger`}
							</option>
						{/each}
					</select>
				</label>
				<button type="button" class="ch-knap primaer" onclick={kopier} disabled={gemmer || !kilde}>
					{gemmer ? 'Kopierer' : 'Kopiér tildelingerne'}
				</button>
			</section>
		{/if}

		{#if kategorier.length === 0}
			<p class="adm-tom">Der er ingen kategorier endnu.</p>
		{:else}
			<h2 class="tr-overskrift">Kategorier</h2>
			<div class="adm-liste">
				{#each daekning as d (d.kategori.id)}
					<div class="tr-daek" class:mangler={d.programNavne.length === 0}>
						<span class="tr-daek-ikon" aria-hidden="true">
							{d.programNavne.length === 0 ? '!' : '✓'}
						</span>
						<span class="tr-daek-t">
							{d.kategori.navn}
							<span class="tr-daek-m">
								{d.programNavne.length === 0 ? 'Ingen programmer' : d.programNavne.join(', ')}
							</span>
						</span>
					</div>
				{/each}
			</div>

			{#if huller.length > 0}
				<div class="tr-adv">
					Kunder der har valgt {huller.map((k) => k.navn.toLowerCase()).join(' eller ')} ser ikke noget
					her.
				</div>
			{/if}
		{/if}

		{#if mine.length > 0}
			<h2 class="tr-overskrift">Programmerne</h2>
			<div class="adm-liste">
				{#each mine as t (t.id)}
					<a class="adm-raekke tr-raekke" href={`/ny/admin/traening/${t.programId}/tildel`}>
						<div class="adm-raekke-t"><span>{programNavn(t.programId)}</span></div>
						<div class="adm-raekke-s">{periodeTekst3(t)}</div>
					</a>
				{/each}
			</div>
		{/if}

		<a class="ch-knap sekundaer tr-knap-link" href="/ny/admin/traening">Find et program at tildele</a>
	{/if}
</div>
