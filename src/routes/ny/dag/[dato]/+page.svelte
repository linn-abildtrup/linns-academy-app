<script lang="ts">
	// ============================================================
	// Én dag i kundens liv. SAMME opstilling som forsiden, bare for en
	// anden dato: ugestrimmel, smaa skridt, lektioner, traening,
	// refleksion og dagens tal, i den raekkefoelge hun kender.
	//
	// Kunden har dage. Forloebet er noget der laegger sig ovenpaa. Derfor
	// er siden slaaet op paa DATOEN og ikke paa et dagnummer, og derfor
	// virker den ens for et medlem og for en paa hold.
	// ============================================================

	import { getContext } from 'svelte';
	import { page } from '$app/state';
	import type { User } from 'firebase/auth';
	import type { UserDoc } from '$lib/types';
	import type { Adgangsbillede } from '$lib/content/adgang3';
	import type { LektionItem } from '$lib/content/forlob';
	import { dageSidenStart } from '$lib/content/forlobAdgang';
	import { hentForlobsdag } from '$lib/firestore/forlob';
	import { hentHistorikForDato } from '$lib/firestore/traeningHistorik';
	import {
		hentDagensLektioner,
		hentKlaret,
		hentSmaaSkridtIDag,
		saetSkridtSvar,
		gemRefleksion,
		hentDagensTal,
		hentAktiveDage,
		datoNoegle,
		type SmaaSkridtIDag,
		type DagensTal
	} from '$lib/firestore/forside3';
	import Ventetegn from '$lib/components/ny/Ventetegn.svelte';
	import Fluebe from '$lib/components/ny/Fluebe.svelte';
	import Ugestrimmel from '$lib/components/ny/Ugestrimmel.svelte';
	import SmaaSkridt from '$lib/components/ny/SmaaSkridt.svelte';
	import Lektioner from '$lib/components/ny/Lektioner.svelte';
	import Refleksion from '$lib/components/ny/Refleksion.svelte';
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

	/** Hvilken dag i forloebet datoen svarer til, hvis den ligger indenfor. */
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
	let aktiveDage = $state<Set<string>>(new Set());
	let henter = $state(true);
	let gemmer = $state<string | null>(null);
	let gemmerNote = $state(false);
	let noteGemtLige = $state(false);

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
			const fra = new Date(d);
			fra.setDate(fra.getDate() - 14);

			const [skridt, t, historik, dage] = await Promise.all([
				hentSmaaSkridtIDag(
					uid,
					forlob && nr !== null
						? { forlobId: forlob.forlobId, produkt: forlob.produkt, dagNummer: nr }
						: null,
					d
				),
				hentDagensTal(uid, d, userDoc),
				hentHistorikForDato(uid, d),
				hentAktiveDage(
					uid,
					forlob ? { produkt: forlob.produkt, startMs: forlob.startMs } : null,
					datoNoegle(fra)
				)
			]);
			if (afbrudt) return;
			skridtData = skridt;
			tal = t;
			traenede = historik.length > 0;
			aktiveDage = dage;

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

	const datoTekst = $derived.by(() => {
		if (!dato) return '';
		const [aar, m, d] = dato.split('-').map(Number);
		if (!aar) return '';
		const dt = new Date(aar, m - 1, d);
		return `${UGEDAGE[dt.getDay()]} · ${d}. ${MAANEDER[m - 1]}`;
	});

	const overskrift = $derived(erIDag ? 'I dag' : datoTekst.split(' · ')[0]);

	const harMaal = $derived((tal?.proteinMaal ?? 0) > 0 || (tal?.fiberMaal ?? 0) > 0);
	const harRefleksion = $derived((skridtData?.refleksion ?? '').length > 0);
	const harNoget = $derived(
		lektioner.length > 0 ||
			(skridtData?.skridt.length ?? 0) > 0 ||
			traenede ||
			harMaal ||
			harRefleksion
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

	async function gemNote(tekst: string) {
		const uid = user?.uid;
		if (!uid || !skridtData?.produktId || skridtData.dagNummer === undefined) return;
		gemmerNote = true;
		try {
			await gemRefleksion(uid, skridtData.produktId, skridtData.dagNummer, tekst);
			skridtData = { ...skridtData, note: tekst };
			noteGemtLige = true;
			setTimeout(() => (noteGemtLige = false), 4000);
		} catch (e) {
			console.error('[ny] kunne ikke gemme refleksionen', e);
		} finally {
			gemmerNote = false;
		}
	}
</script>

<header class="dawn">
	<div class="date">{datoTekst}</div>
	<div class="dawn-top">
		<h1 class="hello">{overskrift}</h1>
		<div class="linn-ava" role="img" aria-label="Linn"></div>
	</div>
	<div class="status-raekke">
		<a class="status tid" href="/ny">‹ Forside</a>
		{#if dagNummer !== null && forlob}
			<span class="status">
				<span class="prik" aria-hidden="true"></span>
				{forlob.navn} <span class="let">· dag {dagNummer}</span>
			</span>
		{/if}
	</div>
</header>

<div class="ny-pad" style="margin-top:16px">
	{#if erFremtid}
		<div class="kort rolig">Den dag er der ikke åbnet for endnu.</div>
	{:else if henter}
		<div class="lektion-venter">
			<Ventetegn variant="lille" />
			<span>Henter dagen</span>
		</div>
	{:else}
		<Ugestrimmel aktivDato={dato} {aktiveDage} {iDag} nulDage={adgang.nulDatoer} />

		{#if note}
			<section class="note-fra-linn">
				<span class="note-ava" aria-hidden="true"></span>
				<div>
					<div class="note-k">Fra Linn</div>
					<p class="note-tekst">{note}</p>
				</div>
			</section>
		{/if}

		{#if skridtData && skridtData.skridt.length > 0}
			<SmaaSkridt skridt={skridtData.skridt} {gemmer} onskift={skiftSkridt} />
		{/if}

		{#if lektioner.length > 0 && dagNummer !== null}
			<Lektioner
				titel={forlob ? `Dag ${dagNummer} på ${forlob.navn}` : 'Lektioner'}
				{dagNummer}
				{lektioner}
				{klaret}
			/>
		{/if}

		<section class="dag-status">
			<span class="status-ikon" class:opfyldt={traenede} aria-hidden="true">
				{#if traenede}<Fluebe />{:else}◈{/if}
			</span>
			<span>{traenede ? 'Du trænede denne dag' : 'Ingen træning denne dag'}</span>
		</section>

		{#if harRefleksion}
			<Refleksion
				spoergsmaal={skridtData?.refleksion ?? ''}
				note={skridtData?.note ?? ''}
				gemmer={gemmerNote}
				gemtLige={noteGemtLige}
				ongem={gemNote}
			/>
		{/if}

		{#if tal && harMaal}
			<DagensTalKort {tal} />
		{/if}

		{#if !harNoget}
			<div class="kort rolig">Der er ikke noget gemt for den dag.</div>
		{/if}
	{/if}
</div>
