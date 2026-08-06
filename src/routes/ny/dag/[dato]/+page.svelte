<script lang="ts">
	// ============================================================
	// Én dag i kundens liv. ÉN side, uanset om hun er paa forloeb.
	//
	// Kunden har dage. Forloebet er noget der laegger sig ovenpaa. Derfor
	// er siden slaaet op paa DATOEN og ikke paa et dagnummer, og derfor
	// virker den ens for et medlem og for en paa hold. Det er den samme
	// tanke som resten af 3.0, se SPEC-3.0.md afsnit 2.
	//
	// Fremtidige dage er laaste. Besluttet af Linn 6. august 2026.
	// ============================================================

	import { getContext } from 'svelte';
	import { page } from '$app/state';
	import type { User } from 'firebase/auth';
	import type { UserDoc } from '$lib/types';
	import type { Adgangsbillede } from '$lib/content/adgang3';
	import type { LektionItem } from '$lib/content/forlob';
	import { artFor } from '$lib/content/lektion3';
	import { videoThumbnail } from '$lib/content/bibliotek';
	import { dageSidenStart } from '$lib/content/forlobAdgang';
	import { hentForlobsdag } from '$lib/firestore/forlob';
	import { hentHistorikForDato } from '$lib/firestore/traeningHistorik';
	import {
		hentDagensLektioner,
		hentKlaret,
		hentSmaaSkridtIDag,
		saetSkridtSvar,
		hentDagensTal,
		datoNoegle,
		type SmaaSkridtIDag,
		type DagensTal
	} from '$lib/firestore/forside3';
	import Ventetegn from '$lib/components/ny/Ventetegn.svelte';
	import Fluebe from '$lib/components/ny/Fluebe.svelte';
	import DagensTalKort from '$lib/components/ny/DagensTal.svelte';

	const hentUser = getContext<() => User | null>('user');
	const hentUserDoc = getContext<() => UserDoc | null>('userDoc');
	const hentAdgang = getContext<() => Adgangsbillede>('adgang');

	const user = $derived(hentUser());
	const userDoc = $derived(hentUserDoc());
	const adgang = $derived(hentAdgang());
	const forlob = $derived(adgang.aktiveForlob[0] ?? null);

	const dato = $derived(page.params.dato ?? '');
	const iDag = $derived(datoNoegle(new Date()));
	const erIDag = $derived(dato === iDag);
	const erFremtid = $derived(dato > iDag);

	/**
	 * Hvilken dag i forloebet datoen svarer til. Er hun ikke paa forloeb,
	 * eller ligger datoen udenfor, er den null og forloebs-laget vises ikke.
	 */
	const dagNummer = $derived.by(() => {
		if (!forlob || !dato) return null;
		const [aar, m, d] = dato.split('-').map(Number);
		if (!aar) return null;
		const nr = dageSidenStart(new Date(forlob.startMs), new Date(aar, m - 1, d, 12));
		if (nr < 0 || nr > forlob.antalDage || nr > forlob.dagNummer) return null;
		return nr;
	});

	let lektioner = $state<LektionItem[]>([]);
	let note = $state('');
	let klaret = $state<Set<string>>(new Set());
	let skridtData = $state<SmaaSkridtIDag | null>(null);
	let tal = $state<DagensTal | null>(null);
	let traenede = $state(false);
	let henter = $state(true);
	let gemmer = $state<string | null>(null);

	$effect(() => {
		const uid = user?.uid;
		const d = dato;
		if (!uid || !d || erFremtid) {
			henter = false;
			return;
		}
		const nr = dagNummer;
		let afbrudt = false;

		(async () => {
			henter = true;
			const [skridt, t, historik] = await Promise.all([
				hentSmaaSkridtIDag(
					uid,
					forlob && nr !== null
						? { forlobId: forlob.forlobId, produkt: forlob.produkt, dagNummer: nr }
						: null,
					d
				),
				hentDagensTal(uid, d, userDoc),
				hentHistorikForDato(uid, d)
			]);
			if (afbrudt) return;
			skridtData = skridt;
			tal = t;
			traenede = historik.length > 0;

			if (forlob && nr !== null) {
				const [dagDoc, synlige, k] = await Promise.all([
					hentForlobsdag(forlob.forlobId, nr),
					hentDagensLektioner(forlob.forlobId, nr, Date.now()),
					hentKlaret(uid)
				]);
				if (afbrudt) return;
				note = dagDoc?.noteFraLinn ?? '';
				lektioner = synlige;
				klaret = k;
			} else {
				note = '';
				lektioner = [];
			}
			henter = false;
		})().catch((e) => {
			console.error('[ny] kunne ikke hente dagen', e);
			henter = false;
		});

		return () => {
			afbrudt = true;
		};
	});

	const UGEDAGE = ['Søndag', 'Mandag', 'Tirsdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lørdag'];
	const MAANEDER = [
		'januar',
		'februar',
		'marts',
		'april',
		'maj',
		'juni',
		'juli',
		'august',
		'september',
		'oktober',
		'november',
		'december'
	];

	const overskrift = $derived.by(() => {
		if (!dato) return '';
		const [aar, m, d] = dato.split('-').map(Number);
		if (!aar) return '';
		const dt = new Date(aar, m - 1, d);
		if (erIDag) return 'I dag';
		return `${UGEDAGE[dt.getDay()]} den ${d}. ${MAANEDER[m - 1]}`;
	});

	const IKON: Record<string, string> = { lyd: '♪', video: '▶', side: '✦', link: '↗' };

	const harMaal = $derived((tal?.proteinMaal ?? 0) > 0 || (tal?.fiberMaal ?? 0) > 0);
	const harNoget = $derived(
		lektioner.length > 0 || (skridtData?.skridt.length ?? 0) > 0 || traenede || harMaal
	);

	/** Hun maa gerne saette et skridt bagud. Det er hendes egen optegnelse. */
	async function skiftSkridt(id: string, tilKlaret: boolean) {
		const uid = user?.uid;
		if (!uid || !skridtData) return;
		gemmer = id;
		const foer = skridtData.skridt.map((s) => ({ ...s }));
		skridtData = {
			...skridtData,
			skridt: skridtData.skridt.map((s) =>
				s.id === id ? { ...s, svar: tilKlaret ? 'ja' : null } : s
			)
		};
		try {
			await saetSkridtSvar(uid, skridtData, id, tilKlaret ? 'ja' : null);
		} catch (e) {
			console.error('[ny] kunne ikke gemme skridt', e);
			skridtData = { ...skridtData, skridt: foer };
		} finally {
			gemmer = null;
		}
	}
</script>

<div class="ny-pad forlob-side">
	<header class="side-top" style="padding-left:0;padding-right:0">
		<a class="tilbage" href="/ny">‹ Forside</a>
		<h1>{overskrift}</h1>
		{#if dagNummer !== null && forlob}
			<p>Dag {dagNummer} på {forlob.navn}</p>
		{/if}
	</header>

	{#if erFremtid}
		<div class="kort rolig">Den dag er der ikke åbnet for endnu.</div>
	{:else if henter}
		<div class="lektion-venter">
			<Ventetegn variant="lille" />
			<span>Henter dagen</span>
		</div>
	{:else}
		{#if note}
			<section class="note-fra-linn">
				<span class="note-ava" aria-hidden="true"></span>
				<div>
					<div class="note-k">Fra Linn</div>
					<p class="note-tekst">{note}</p>
				</div>
			</section>
		{/if}

		{#if lektioner.length > 0}
			<section>
				<div class="lab"><h2>Lektioner</h2></div>
				<div class="medie-liste">
					{#each lektioner as l (l.id)}
						{@const erKlaret = klaret.has(l.id)}
						{@const billede = l.thumbnailUrl || videoThumbnail(l.url)}
						<a class="medie-raekke" class:set={erKlaret} href={`/ny/lektion/${dagNummer}/${l.id}`}>
							<span class="medie-thumb {artFor(l.url)}">
								{#if erKlaret}
									<span class="rund-fluebe stor" aria-hidden="true"><Fluebe /></span>
								{:else if billede}
									<img class="medie-foto" src={billede} alt="" loading="lazy" />
									<span class="medie-play" aria-hidden="true">{IKON[artFor(l.url)]}</span>
								{:else}
									<span class="medie-glyph" aria-hidden="true">{IKON[artFor(l.url)]}</span>
								{/if}
							</span>
							<span class="medie-tekst">
								<span class="medie-t">{l.titel}</span>
								<span class="medie-m">
									{#if erKlaret}<span class="klar-tekst">Set</span> · se igen{:else if l.varighedMin}{l.varighedMin}
										min{:else}Åbn{/if}
								</span>
							</span>
							<span class="medie-pil" aria-hidden="true">›</span>
						</a>
					{/each}
				</div>
			</section>
		{/if}

		{#if skridtData && skridtData.skridt.length > 0}
			<section>
				<div class="lab"><h2>Dine små skridt</h2></div>
				<div class="kort">
					{#each skridtData.skridt as s (s.id)}
						{@const klar = s.svar === 'ja'}
						<div class="skridt" class:klar>
							<button
								class="boks"
								class:klar
								disabled={gemmer === s.id}
								aria-pressed={klar}
								aria-label={klar ? `Fortryd ${s.label}` : `Markér ${s.label}`}
								onclick={() => skiftSkridt(s.id, !klar)}
							>
								{#if klar}<Fluebe />{/if}
							</button>
							<div class="tx">{s.label}</div>
						</div>
					{/each}
				</div>
			</section>
		{/if}

		{#if skridtData?.refleksion}
			<section class="refleksion">
				<div class="refleksion-k">Dagens refleksion</div>
				<p class="refleksion-spm">{skridtData.refleksion}</p>
				{#if skridtData.note}
					<p class="refleksion-svar">{skridtData.note}</p>
				{:else}
					<p class="privat">Du skrev ikke noget den dag.</p>
				{/if}
			</section>
		{/if}

		<section class="dag-status">
			<span class="status-ikon" class:opfyldt={traenede} aria-hidden="true">
				{#if traenede}<Fluebe />{:else}◈{/if}
			</span>
			<span>{traenede ? 'Du trænede denne dag' : 'Ingen træning registreret'}</span>
		</section>

		{#if tal && harMaal}
			<DagensTalKort {tal} />
		{/if}

		{#if !harNoget}
			<div class="kort rolig">Der er ikke noget gemt for den dag.</div>
		{/if}
	{/if}
</div>
