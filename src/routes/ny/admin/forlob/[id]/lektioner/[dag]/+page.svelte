<script lang="ts">
	// ============================================================
	// Dag-editoren i det nye design.
	//
	// Den side man lander paa naar man trykker paa en dag i
	// lektions-oversigten. FOER 5. september 2026 fandtes den ikke i
	// 3.0: oversigten linkede til en adresse der ikke var bygget, saa
	// der skete ingenting naar man trykkede. Al redigering foregik i
	// den gamle app.
	//
	// HELE GEMME-LOGIKKEN ER LOEFTET ORDRET fra den gamle side. Den
	// haandterer gruppering paa tvaers af dage, og det er den mest
	// indviklede del af hele admin. Skrives den om, risikerer vi at
	// aendringer paa én dag stille smitter forkert af paa de andre.
	// Derfor er kun markup og stil ny.
	//
	// Den gamle side er uroert.
	//
	// LAYOUT: tre spalter, Linns valg B den 5. september. Yderst til
	// venstre alle dagene i forloebet, saa man hopper fra dag 6 til dag
	// 11 med ét klik og samtidig ser hvilke dage der er tomme. Bygget
	// bredt med vilje: admin bruges paa en iMac, ikke paa telefon, saa
	// den smalle 520px-ramme resten af 3.0 bruger gaelder ikke her.
	// ============================================================

	import { getContext, onMount } from 'svelte';
	import type { User } from 'firebase/auth';
	import { isAdmin } from '$lib/admin';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import type { ForlobDag, LektionItem } from '$lib/content/forlob';
	import type { Forlob } from '$lib/content/forlobAdgang';
	import { lektionTidsstatus, nyLektion, tomForlobDag } from '$lib/content/forlob';
	import {
		findDageMedLektionGruppe,
		findDageMedNoteGruppe,
		gemForlobsdag,
		gemLektionPaaDage,
		gemNotePaaDage,
		hentForlob,
		hentForlobsdag,
		hentForlobsdage,
		opdaterLektionGruppe,
		opdaterNoteGruppe,
		sletForlobsdag,
		sletLektionGruppe,
		sletNoteGruppe
	} from '$lib/firestore/forlob';
	import {
		uploadHtmlFil,
		uploadLydFil,
		uploadPdfFil,
		uploadThumbnailFil
	} from '$lib/utils/storage';
	import Icon from '$lib/components/Icon.svelte';
	import VaelgDageDialog from '$lib/components/VaelgDageDialog.svelte';
	import RedigerGruppeDialog from '$lib/components/RedigerGruppeDialog.svelte';
	import ForlobRefleksionerFane from '$lib/components/ForlobRefleksionerFane.svelte';
	import ForlobSmaaSkridtFane from '$lib/components/ForlobSmaaSkridtFane.svelte';

	const hentAdminUser = getContext<() => User | null>('user');
	const maaVaereHer = $derived(isAdmin(hentAdminUser()));

	const forlobId = $derived(page.params.id ?? '');
	const dagNummer = $derived(parseInt(page.params.dag ?? '0', 10));

	let dag = $state<ForlobDag>(tomForlobDag(0));
	let forlob = $state<Forlob | null>(null);
	let loading = $state(true);
	let fejl = $state<string | null>(null);
	let gemmer = $state(false);
	let gemKvit = $state(false);
	let bekraefter = $state(false);
	let uploaderHtml = $state<string | null>(null);
	let uploaderLyd = $state<string | null>(null);
	let uploaderThumb = $state<string | null>(null);
	/** Hvilken lektion der uploader en pdf lige nu. Linn 5. september. */
	let uploaderPdf = $state<string | null>(null);
	/** Hvilken lektions dokument-felt der har en fil svaevende over sig. */
	let dragPdf = $state<string | null>(null);
	let dragOver = $state<string | null>(null);
	let uploadFejl = $state<string | null>(null);

	// Pile-navigation mellem dage
	const maxDag = $derived(forlob?.antalDage ?? dagNummer);
	const kanForrige = $derived(dagNummer > 0);
	const kanNaeste = $derived(dagNummer < maxDag);

	// Ugedag + dato for denne lektionsdag. Dag N = forløbets startDato + N dage.
	const dagDato = $derived.by(() => {
		if (!forlob) return null;
		const d = forlob.startDato.toDate();
		d.setDate(d.getDate() + dagNummer);
		const tekst = new Intl.DateTimeFormat('da-DK', {
			weekday: 'long',
			day: 'numeric',
			month: 'long'
		}).format(d);
		return tekst.charAt(0).toUpperCase() + tekst.slice(1);
	});

	// ── Venstre spalte: alle dagene i forloebet ────────────────────────────
	// Hentes én gang, saa man kan hoppe mellem dage uden at gaa tilbage til
	// oversigten. Tallet bagved er antal lektioner, saa en tom dag er til at
	// faa oeje paa uden at klikke sig ind.
	let alleDage = $state<ForlobDag[]>([]);

	const dagsmap = $derived.by<Map<number, ForlobDag>>(() => {
		const m = new Map<number, ForlobDag>();
		for (const d of alleDage) m.set(d.dagNummer, d);
		return m;
	});

	/** Dag 0 til og med sidste dag, ogsaa dem der ikke er oprettet endnu. */
	const dageIListen = $derived.by<ForlobDag[]>(() => {
		if (!forlob) return [];
		const ud: ForlobDag[] = [];
		for (let i = 0; i <= forlob.antalDage; i++) ud.push(dagsmap.get(i) ?? tomForlobDag(i));
		return ud;
	});

	/**
	 * Antal lektioner paa en dag. Den dag man staar paa laeses fra det man
	 * har paa skaermen, ikke fra det gemte, saa tallet foelger med med det
	 * samme naar man tilfoejer eller fjerner en lektion.
	 */
	function antalPaa(d: ForlobDag): number {
		return d.dagNummer === dagNummer ? dag.lektioner.length : d.lektioner.length;
	}

	async function indlaesAlleDage() {
		try {
			alleDage = await hentForlobsdage(forlobId);
		} catch (e) {
			console.error(e);
		}
	}

	// Faner: Lektioner / Refleksioner / Små skridt
	let aktivFane = $state<'lektioner' | 'refleksioner' | 'smaaskridt'>('lektioner');

	// To-panel på Lektioner-fanen: hvilken lektion er åben til redigering i højre panel.
	let valgtLektionId = $state<string | null>(null);

	// Hold valget gyldigt: vælg den første lektion hvis intet (eller et slettet) er valgt.
	$effect(() => {
		const ids = dag.lektioner.map((l) => l.id);
		if (valgtLektionId && !ids.includes(valgtLektionId)) {
			valgtLektionId = ids[0] ?? null;
		} else if (!valgtLektionId && ids.length > 0) {
			valgtLektionId = ids[0];
		}
	});

	// 'Vis ogsaa paa dage'-dialog. maal er enten 'lektion:<id>' eller 'note'.
	let dialogMaal = $state<string | null>(null);
	let dialogStartDage = $state<number[]>([]);

	// 'Ret alle eller kun denne'-bekraeft-dialog
	let gruppeBekraeft = $state<{
		titel: string;
		beskrivelse: string;
		antalDage: number;
		alleLabel: string;
		denneLabel: string;
		erFarlig: boolean;
		paaAlle: () => void | Promise<void>;
		paaDenne: () => void | Promise<void>;
	} | null>(null);

	// Cache over hvilke dage hver gruppe ligger paa — bygges naar siden loader
	// og opdateres efter gem.
	let lektionGruppeDage = $state<Map<string, number[]>>(new Map());
	let noteGruppeDage = $state<Map<string, number[]>>(new Map());

	async function refreshGruppeDage() {
		const lkRes = new Map<string, number[]>();
		for (const l of dag.lektioner) {
			if (l.grupperingId && !lkRes.has(l.grupperingId)) {
				lkRes.set(l.grupperingId, await findDageMedLektionGruppe(forlobId, l.grupperingId));
			}
		}
		lektionGruppeDage = lkRes;

		const nRes = new Map<string, number[]>();
		if (dag.noteGrupperingId) {
			nRes.set(dag.noteGrupperingId, await findDageMedNoteGruppe(forlobId, dag.noteGrupperingId));
		}
		noteGruppeDage = nRes;
	}

	// Indlæs dagen når dagNummer ændrer sig — også ved klik på forrige/næste-pilene,
	// hvor SvelteKit genbruger komponenten i stedet for at remounte (så onMount ikke
	// ville køre igen). Nulstiller samtidig forbigående UI-tilstand fra forrige dag.
	$effect(() => {
		const nr = dagNummer;
		dag = tomForlobDag(nr);
		bekraefter = false;
		gemKvit = false;
		gruppeBekraeft = null;
		dialogMaal = null;
		uploadFejl = null;
		indlaes(nr);
	});

	async function indlaes(nr: number = dagNummer) {
		loading = true;
		fejl = null;
		try {
			const [fundet, f] = await Promise.all([
				hentForlobsdag(forlobId, nr),
				forlob ? Promise.resolve(forlob) : hentForlob(forlobId)
			]);
			dag = fundet ?? tomForlobDag(nr);
			forlob = f;
			await refreshGruppeDage();
		} catch (e) {
			console.error(e);
			fejl = 'Kunne ikke hente dagen.';
		} finally {
			loading = false;
		}
	}

	function tilfoejLektion() {
		const ny = nyLektion();
		dag = { ...dag, lektioner: [...dag.lektioner, ny] };
		valgtLektionId = ny.id;
	}

	// Flyt en lektion op (-1) eller ned (+1) i dagens rækkefølge. Rækkefølgen i
	// arrayet er den rækkefølge kunden ser i appen — gemmes når man trykker Gem.
	function flytLektion(index: number, retning: -1 | 1) {
		const maal = index + retning;
		if (maal < 0 || maal >= dag.lektioner.length) return;
		const ny = [...dag.lektioner];
		[ny[index], ny[maal]] = [ny[maal], ny[index]];
		dag = { ...dag, lektioner: ny };
	}

	function fjernLektion(id: string) {
		const l = dag.lektioner.find((x) => x.id === id);
		if (!l) return;
		const dageMedGruppe = l.grupperingId ? (lektionGruppeDage.get(l.grupperingId) ?? []) : [];
		if (l.grupperingId && dageMedGruppe.length > 1) {
			const gid = l.grupperingId;
			gruppeBekraeft = {
				titel: 'Slet lektion',
				beskrivelse:
					'Denne lektion ligger også på andre dage. Vil du fjerne den fra alle dage eller kun fra denne ene?',
				antalDage: dageMedGruppe.length,
				alleLabel: 'Slet fra alle dage',
				denneLabel: 'Kun denne dag',
				erFarlig: true,
				paaAlle: async () => {
					gruppeBekraeft = null;
					gemmer = true;
					try {
						await sletLektionGruppe(forlobId, gid);
						dag = { ...dag, lektioner: dag.lektioner.filter((x) => x.id !== id) };
						await refreshGruppeDage();
					} catch (e) {
						console.error(e);
						fejl = 'Kunne ikke slette gruppe.';
					} finally {
						gemmer = false;
					}
				},
				paaDenne: async () => {
					gruppeBekraeft = null;
					gemmer = true;
					try {
						// Persistér oeblikkeligt saa slettelsen ogsaa reflekteres
						// i VaelgDageDialog og /lektioner-oversigten.
						const nu: ForlobDag = {
							...dag,
							lektioner: dag.lektioner.filter((x) => x.id !== id)
						};
						await gemForlobsdag(forlobId, nu);
						dag = nu;
						await refreshGruppeDage();
					} catch (e) {
						console.error(e);
						fejl = 'Kunne ikke slette lektion.';
					} finally {
						gemmer = false;
					}
				}
			};
			return;
		}
		dag = { ...dag, lektioner: dag.lektioner.filter((x) => x.id !== id) };
	}

	function opdaterLektion<K extends keyof LektionItem>(
		id: string,
		felt: K,
		vaerdi: LektionItem[K]
	) {
		dag = {
			...dag,
			lektioner: dag.lektioner.map((l) => (l.id === id ? { ...l, [felt]: vaerdi } : l))
		};
	}

	// ── Tidsbegraensning (synlighedsvindue pr lektion) ──────────────────────
	// Lektioner, hvor admin har foldet tidsbegraensnings-panelet ud manuelt.
	// En lektion med gemt visFra/skjulEfter regnes altid som aaben.
	let tidsPanelManuel = $state<Set<string>>(new Set());

	function tidsAaben(l: LektionItem): boolean {
		return tidsPanelManuel.has(l.id) || !!(l.visFra || l.skjulEfter);
	}

	function toggleTidsbegraens(l: LektionItem) {
		if (tidsAaben(l)) {
			// Sluk: ryd vaerdierne, saa lektionen igen er altid synlig.
			opdaterLektion(l.id, 'visFra', '');
			opdaterLektion(l.id, 'skjulEfter', '');
			const ny = new Set(tidsPanelManuel);
			ny.delete(l.id);
			tidsPanelManuel = ny;
		} else {
			tidsPanelManuel = new Set(tidsPanelManuel).add(l.id);
		}
	}

	function formaterDatoTid(iso: string | undefined): string {
		if (!iso) return '';
		const d = new Date(iso);
		if (isNaN(d.getTime())) return '';
		const tekst = new Intl.DateTimeFormat('da-DK', {
			weekday: 'long',
			day: 'numeric',
			month: 'long',
			hour: '2-digit',
			minute: '2-digit'
		}).format(d);
		return tekst.charAt(0).toUpperCase() + tekst.slice(1);
	}

	// Menneske-laeselig opsummering af synlighedsvinduet (live under felterne).
	function tidsResume(l: LektionItem): string {
		const fra = formaterDatoTid(l.visFra);
		const til = formaterDatoTid(l.skjulEfter);
		if (!fra && !til) return '';
		if (fra && til) return `Synlig ${fra} → forsvinder efter ${til}.`;
		if (til) return `Synlig indtil ${til} — forsvinder automatisk derefter.`;
		return `Synlig fra ${fra} og frem.`;
	}

	// Kort dato til liste-maerket, fx '17/6 22:00'.
	function formaterDatoKort(iso: string | undefined): string {
		if (!iso) return '';
		const d = new Date(iso);
		if (isNaN(d.getTime())) return '';
		return new Intl.DateTimeFormat('da-DK', {
			day: 'numeric',
			month: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		}).format(d);
	}

	// Maerke til venstre liste: null hvis ingen tidsbegraensning.
	function tidsBadge(l: LektionItem): { tekst: string; status: string } | null {
		const status = lektionTidsstatus(l);
		if (status === 'altid') return null;
		if (status === 'udloebet') return { tekst: 'Udløbet · skjult', status };
		const naar = formaterDatoKort(l.skjulEfter);
		if (status === 'foer') {
			return { tekst: naar ? `Planlagt · skjules ${naar}` : 'Planlagt', status };
		}
		return { tekst: naar ? `Forsvinder ${naar}` : 'Tidsbegrænset', status };
	}

	// Valideringsfejl: skjulEfter skal ligge efter visFra.
	function tidsFejl(l: LektionItem): string {
		if (l.visFra && l.skjulEfter) {
			const f = new Date(l.visFra).getTime();
			const t = new Date(l.skjulEfter).getTime();
			if (!isNaN(f) && !isNaN(t) && t <= f) {
				return 'Sluttidspunkt skal ligge efter starttidspunkt.';
			}
		}
		return '';
	}

	async function haandterHtmlUpload(lektionId: string, e: Event) {
		const input = e.target as HTMLInputElement;
		const fil = input.files?.[0];
		if (!fil) return;
		if (!/\.(html|htm)$/i.test(fil.name)) {
			uploadFejl = 'Vælg en .html- eller .htm-fil.';
			input.value = '';
			return;
		}
		uploaderHtml = lektionId;
		uploadFejl = null;
		try {
			const url = await uploadHtmlFil(forlobId, fil);
			opdaterLektion(lektionId, 'url', url);
		} catch (err) {
			console.error(err);
			uploadFejl = 'Upload fejlede. Prøv igen.';
		} finally {
			uploaderHtml = null;
			input.value = '';
		}
	}

	async function haandterLydUpload(lektionId: string, e: Event) {
		const input = e.target as HTMLInputElement;
		const fil = input.files?.[0];
		if (!fil) return;
		if (!/\.(mp3|m4a|wav|aac|ogg)$/i.test(fil.name)) {
			uploadFejl = 'Vælg en lydfil (.mp3, .m4a, .wav, .aac eller .ogg).';
			input.value = '';
			return;
		}
		uploaderLyd = lektionId;
		uploadFejl = null;
		try {
			const url = await uploadLydFil(fil);
			opdaterLektion(lektionId, 'url', url);
			// Opdater format-feltet automatisk hvis det er tomt
			const lektion = dag.lektioner.find((l) => l.id === lektionId);
			if (lektion && !lektion.format.trim()) {
				opdaterLektion(lektionId, 'format', 'Lyd');
			}
		} catch (err) {
			console.error(err);
			uploadFejl = err instanceof Error ? `Upload fejlede: ${err.message}` : 'Upload fejlede.';
		} finally {
			uploaderLyd = null;
			input.value = '';
		}
	}

	async function haandterThumbnailFil(lektionId: string, fil: File | undefined | null) {
		if (!fil) return;
		if (!fil.type.startsWith('image/')) {
			uploadFejl = 'Vaelg en billedfil (JPG, PNG, WebP).';
			return;
		}
		uploaderThumb = lektionId;
		uploadFejl = null;
		try {
			const url = await uploadThumbnailFil(forlobId, fil);
			opdaterLektion(lektionId, 'thumbnailUrl', url);
		} catch (err) {
			console.error(err);
			uploadFejl = err instanceof Error ? `Upload fejlede: ${err.message}` : 'Upload fejlede.';
		} finally {
			uploaderThumb = null;
		}
	}

	function haandterThumbnailInput(lektionId: string, e: Event) {
		const input = e.target as HTMLInputElement;
		const fil = input.files?.[0];
		haandterThumbnailFil(lektionId, fil);
		input.value = '';
	}

	/**
	 * Hun har valgt eller trukket en PDF ind.
	 *
	 * Linn 5. september: admin skal bare kunne smide pdf'en over i appen i
	 * stedet for at linke til Simplero. Filen lander hos os, og adressen
	 * skrives i lektionens url-felt, praecis som en html-fil goer.
	 */
	async function haandterPdfFil(lektionId: string, fil: File | undefined | null) {
		if (!fil) return;
		const erPdf = fil.type === 'application/pdf' || /\.pdf$/i.test(fil.name);
		if (!erPdf) {
			uploadFejl = 'Vaelg en PDF-fil.';
			return;
		}
		uploaderPdf = lektionId;
		uploadFejl = null;
		try {
			const url = await uploadPdfFil(forlobId, fil);
			opdaterLektion(lektionId, 'url', url);
		} catch (err) {
			console.error(err);
			uploadFejl = err instanceof Error ? `Upload fejlede: ${err.message}` : 'Upload fejlede.';
		} finally {
			uploaderPdf = null;
		}
	}

	function haandterPdfInput(lektionId: string, e: Event) {
		const input = e.target as HTMLInputElement;
		haandterPdfFil(lektionId, input.files?.[0]);
		input.value = '';
	}

	function haandterPdfDrop(lektionId: string, e: DragEvent) {
		e.preventDefault();
		dragPdf = null;
		haandterPdfFil(lektionId, e.dataTransfer?.files?.[0]);
	}

	function haandterPdfDragOver(lektionId: string, e: DragEvent) {
		e.preventDefault();
		dragPdf = lektionId;
	}

	function haandterDrop(lektionId: string, e: DragEvent) {
		e.preventDefault();
		dragOver = null;
		const fil = e.dataTransfer?.files?.[0];
		haandterThumbnailFil(lektionId, fil);
	}

	function haandterDragOver(lektionId: string, e: DragEvent) {
		e.preventDefault();
		dragOver = lektionId;
	}

	function haandterDragLeave() {
		dragOver = null;
	}

	async function haandterPaste(lektionId: string, e: ClipboardEvent) {
		const items = e.clipboardData?.items;
		if (!items) return;
		for (const item of items) {
			if (item.type.startsWith('image/')) {
				e.preventDefault();
				const fil = item.getAsFile();
				if (fil) {
					await haandterThumbnailFil(lektionId, fil);
				}
				return;
			}
		}
	}

	function fjernThumbnail(lektionId: string) {
		opdaterLektion(lektionId, 'thumbnailUrl', undefined);
	}

	// Sammenligner lektion-felter (ekskl id + grupperingId) saa vi kan
	// detektere om en grupperet lektion er aendret og skal trigge dialog.
	function lektionFelterEr(a: LektionItem, b: LektionItem): boolean {
		return (
			a.titel === b.titel &&
			a.beskrivelse === b.beskrivelse &&
			a.varighedMin === b.varighedMin &&
			a.format === b.format &&
			a.url === b.url &&
			(a.thumbnailUrl ?? '') === (b.thumbnailUrl ?? '')
		);
	}

	async function gem() {
		gemmer = true;
		fejl = null;
		gemKvit = false;
		try {
			const original = (await hentForlobsdag(forlobId, dagNummer)) ?? tomForlobDag(dagNummer);
			const trimmet: LektionItem[] = dag.lektioner.map((l) => ({
				...l,
				titel: l.titel.trim(),
				beskrivelse: l.beskrivelse.trim(),
				format: l.format.trim(),
				url: l.url.trim()
			}));

			// Find grupperede lektioner der er aendret ift original
			const aendredeGrupperede: LektionItem[] = [];
			for (const ny of trimmet) {
				if (!ny.grupperingId) continue;
				const dageMed = lektionGruppeDage.get(ny.grupperingId) ?? [];
				if (dageMed.length <= 1) continue;
				const original_l = original.lektioner.find((o) => o.id === ny.id);
				if (!original_l) continue;
				if (!lektionFelterEr(ny, original_l)) {
					aendredeGrupperede.push(ny);
				}
			}

			const noteAendretGrupperet =
				dag.noteGrupperingId &&
				(noteGruppeDage.get(dag.noteGrupperingId)?.length ?? 0) > 1 &&
				dag.noteFraLinn.trim() !== (original.noteFraLinn ?? '').trim();

			if (aendredeGrupperede.length > 0 || noteAendretGrupperet) {
				// Naar der er grupperede aendringer: vis dialog. Spoerg én gang
				// samlet (typisk er det én lektion eller noten der er aendret).
				const samletAntalDage = Math.max(
					...aendredeGrupperede.map(
						(l) => lektionGruppeDage.get(l.grupperingId ?? '')?.length ?? 0
					),
					noteAendretGrupperet ? (noteGruppeDage.get(dag.noteGrupperingId ?? '')?.length ?? 0) : 0
				);
				gruppeBekraeft = {
					titel: 'Ændringer på flere dage',
					beskrivelse:
						'Du har ændret indhold der også ligger på andre dage. Vil du opdatere alle dage eller kun denne ene?',
					antalDage: samletAntalDage,
					alleLabel: 'Ret alle dage',
					denneLabel: 'Kun denne dag',
					erFarlig: false,
					paaAlle: async () => {
						gruppeBekraeft = null;
						await gemMedPropagering(trimmet, aendredeGrupperede, !!noteAendretGrupperet);
					},
					paaDenne: async () => {
						gruppeBekraeft = null;
						await gemSomStandalone(trimmet, aendredeGrupperede, !!noteAendretGrupperet);
					}
				};
				gemmer = false;
				return;
			}

			// Ingen grupperede aendringer — gem normalt
			await gemForlobsdag(forlobId, {
				dagNummer: dag.dagNummer,
				uge: dag.uge,
				lektioner: trimmet,
				noteFraLinn: dag.noteFraLinn.trim(),
				noteGrupperingId: dag.noteGrupperingId
			});
			dag = { ...dag, lektioner: trimmet };
			gemKvit = true;
			setTimeout(() => (gemKvit = false), 2000);
			await refreshGruppeDage();
		} catch (e) {
			console.error(e);
			fejl = 'Kunne ikke gemme.';
		} finally {
			gemmer = false;
		}
	}

	async function gemMedPropagering(
		trimmet: LektionItem[],
		grupperede: LektionItem[],
		noteAendret: boolean
	) {
		gemmer = true;
		try {
			// Foerst gem den aktuelle dag (med trimmede felter)
			await gemForlobsdag(forlobId, {
				dagNummer: dag.dagNummer,
				uge: dag.uge,
				lektioner: trimmet,
				noteFraLinn: dag.noteFraLinn.trim(),
				noteGrupperingId: dag.noteGrupperingId
			});
			// Propagér aendrede grupperede lektioner til alle andre dage
			for (const l of grupperede) {
				if (!l.grupperingId) continue;
				await opdaterLektionGruppe(forlobId, l.grupperingId, {
					titel: l.titel,
					beskrivelse: l.beskrivelse,
					varighedMin: l.varighedMin,
					format: l.format,
					url: l.url,
					thumbnailUrl: l.thumbnailUrl
				});
			}
			if (noteAendret && dag.noteGrupperingId) {
				await opdaterNoteGruppe(forlobId, dag.noteGrupperingId, dag.noteFraLinn.trim());
			}
			dag = { ...dag, lektioner: trimmet };
			gemKvit = true;
			setTimeout(() => (gemKvit = false), 2000);
			await refreshGruppeDage();
		} catch (e) {
			console.error(e);
			fejl = 'Kunne ikke gemme.';
		} finally {
			gemmer = false;
		}
	}

	async function gemSomStandalone(
		trimmet: LektionItem[],
		grupperede: LektionItem[],
		noteAendret: boolean
	) {
		gemmer = true;
		try {
			// 'Kun denne': fjern grupperingId fra de aendrede lektioner saa
			// de andre dage forbliver intakte med den oprindelige version.
			const grupIds = new Set(grupperede.map((l) => l.id));
			const opdateret = trimmet.map((l) =>
				grupIds.has(l.id) ? { ...l, grupperingId: undefined } : l
			);
			const noteOpdateret = noteAendret;
			await gemForlobsdag(forlobId, {
				dagNummer: dag.dagNummer,
				uge: dag.uge,
				lektioner: opdateret,
				noteFraLinn: dag.noteFraLinn.trim(),
				noteGrupperingId: noteOpdateret ? undefined : dag.noteGrupperingId
			});
			dag = {
				...dag,
				lektioner: opdateret,
				noteGrupperingId: noteOpdateret ? undefined : dag.noteGrupperingId
			};
			gemKvit = true;
			setTimeout(() => (gemKvit = false), 2000);
			await refreshGruppeDage();
		} catch (e) {
			console.error(e);
			fejl = 'Kunne ikke gemme.';
		} finally {
			gemmer = false;
		}
	}

	function aabnVaelgDageDialog(maal: string) {
		dialogMaal = maal;
		if (maal === 'note') {
			const ds = dag.noteGrupperingId
				? (noteGruppeDage.get(dag.noteGrupperingId) ?? [dagNummer])
				: [dagNummer];
			dialogStartDage = ds.length > 0 ? ds : [dagNummer];
		} else if (maal.startsWith('lektion:')) {
			const id = maal.slice('lektion:'.length);
			const l = dag.lektioner.find((x) => x.id === id);
			if (l?.grupperingId) {
				dialogStartDage = lektionGruppeDage.get(l.grupperingId) ?? [dagNummer];
			} else {
				dialogStartDage = [dagNummer];
			}
		}
	}

	async function haandterVaelgDage(valgteDage: number[]) {
		if (!dialogMaal) return;
		const valgte = valgteDage.includes(dagNummer)
			? valgteDage
			: [...valgteDage, dagNummer].sort((a, b) => a - b);

		gemmer = true;
		fejl = null;
		try {
			if (dialogMaal === 'note') {
				const tekst = dag.noteFraLinn.trim();
				if (!tekst) {
					fejl = 'Skriv noten først, før du vælger flere dage.';
					gemmer = false;
					dialogMaal = null;
					return;
				}
				const { noteGrupperingId } = await gemNotePaaDage(
					forlobId,
					tekst,
					valgte,
					dag.noteGrupperingId
				);
				dag = { ...dag, noteGrupperingId };
			} else if (dialogMaal.startsWith('lektion:')) {
				const id = dialogMaal.slice('lektion:'.length);
				const l = dag.lektioner.find((x) => x.id === id);
				if (!l) {
					gemmer = false;
					dialogMaal = null;
					return;
				}
				const { grupperingId } = await gemLektionPaaDage(
					forlobId,
					{
						titel: l.titel.trim(),
						beskrivelse: l.beskrivelse.trim(),
						varighedMin: l.varighedMin,
						format: l.format.trim(),
						url: l.url.trim(),
						thumbnailUrl: l.thumbnailUrl,
						grupperingId: l.grupperingId
					},
					valgte,
					l.grupperingId
				);
				// Fjern gruppen fra dage der ikke laengere er valgt
				if (l.grupperingId) {
					const tidligereDage = lektionGruppeDage.get(l.grupperingId) ?? [];
					const fjernet = tidligereDage.filter((d) => !valgte.includes(d));
					for (const d of fjernet) {
						const andenDag = await hentForlobsdag(forlobId, d);
						if (!andenDag) continue;
						await gemForlobsdag(forlobId, {
							...andenDag,
							lektioner: andenDag.lektioner.filter((x) => x.grupperingId !== l.grupperingId)
						});
					}
				}
				dag = {
					...dag,
					lektioner: dag.lektioner.map((x) => (x.id === id ? { ...x, grupperingId } : x))
				};
			}
			await refreshGruppeDage();
		} catch (e) {
			console.error(e);
			fejl = 'Kunne ikke opdatere flere dage.';
		} finally {
			gemmer = false;
			dialogMaal = null;
		}
	}

	function fjernNoteFraGruppe() {
		if (!dag.noteGrupperingId) return;
		const dageMed = noteGruppeDage.get(dag.noteGrupperingId) ?? [];
		if (dageMed.length <= 1) {
			dag = { ...dag, noteGrupperingId: undefined };
			return;
		}
		const gid = dag.noteGrupperingId;
		gruppeBekraeft = {
			titel: 'Slet note',
			beskrivelse:
				'Denne note ligger også på andre dage. Vil du slette den fra alle dage eller kun fra denne ene?',
			antalDage: dageMed.length,
			alleLabel: 'Slet fra alle dage',
			denneLabel: 'Kun denne dag',
			erFarlig: true,
			paaAlle: async () => {
				gruppeBekraeft = null;
				gemmer = true;
				try {
					await sletNoteGruppe(forlobId, gid);
					dag = { ...dag, noteFraLinn: '', noteGrupperingId: undefined };
					await refreshGruppeDage();
				} catch (e) {
					console.error(e);
					fejl = 'Kunne ikke slette note-gruppe.';
				} finally {
					gemmer = false;
				}
			},
			paaDenne: async () => {
				gruppeBekraeft = null;
				gemmer = true;
				try {
					const nu: ForlobDag = {
						...dag,
						noteFraLinn: '',
						noteGrupperingId: undefined
					};
					await gemForlobsdag(forlobId, nu);
					dag = nu;
					await refreshGruppeDage();
				} catch (e) {
					console.error(e);
					fejl = 'Kunne ikke slette note.';
				} finally {
					gemmer = false;
				}
			}
		};
	}

	async function sletDag() {
		if (!bekraefter) {
			bekraefter = true;
			return;
		}
		gemmer = true;
		try {
			await sletForlobsdag(forlobId, dagNummer);
			goto(`/ny/admin/forlob/${forlobId}/lektioner`);
		} catch (e) {
			console.error(e);
			fejl = 'Kunne ikke slette.';
			gemmer = false;
		}
	}

	// Kun listen hentes her. Selve dagen indlaeses af effekten ovenfor, som
	// ogsaa fanger et skift til en anden dag i venstre spalte, hvor siden
	// ikke bygges op paa ny.
	onMount(indlaesAlleDage);
</script>

{#if !maaVaereHer}
	<div class="side"><div class="besked">Kun for admin.</div></div>
{:else}
	<div class="side">
		<header class="side-hoved">
			<a class="tilbage" href="/ny/admin/forlob/{forlobId}/lektioner">
				<Icon name="arrow-l" size={14} color="var(--ink-2)" />
				<span>Lektioner</span>
			</a>
			<div class="eyebrow">{forlob?.navn ?? 'Forløb'}</div>
			<h1>{dagNummer === 0 ? 'Baseline' : `Dag ${dagNummer}`}</h1>
			<p class="side-sub">
				{#if dagNummer > 0}Uge {dag.uge}{#if dagDato}
						·
					{/if}{/if}{#if dagDato}{dagDato}{/if}
			</p>
			<div class="faner" role="tablist">
				<button
					class="fane"
					class:aktiv={aktivFane === 'lektioner'}
					type="button"
					role="tab"
					aria-selected={aktivFane === 'lektioner'}
					onclick={() => (aktivFane = 'lektioner')}>Lektioner</button
				>
				<button
					class="fane"
					class:aktiv={aktivFane === 'refleksioner'}
					type="button"
					role="tab"
					aria-selected={aktivFane === 'refleksioner'}
					onclick={() => (aktivFane = 'refleksioner')}>Refleksioner</button
				>
				<button
					class="fane"
					class:aktiv={aktivFane === 'smaaskridt'}
					type="button"
					role="tab"
					aria-selected={aktivFane === 'smaaskridt'}
					onclick={() => (aktivFane = 'smaaskridt')}>Små skridt</button
				>
			</div>
		</header>

		{#if aktivFane === 'lektioner'}
			{#if loading}
				<div class="besked">Henter dagen...</div>
			{:else if fejl}
				<div class="besked fejl">{fejl}</div>
			{:else}
				{@const valgt = dag.lektioner.find((l) => l.id === valgtLektionId)}
				<div class="krop">
					<!-- VENSTRE: alle dagene, saa man kan hoppe uden at gaa tilbage -->
					<nav class="sp sp-dage" aria-label="Dagene i forløbet">
						<div class="sp-t">Dagene</div>
						<div class="dag-liste">
							{#each dageIListen as d (d.dagNummer)}
								{@const antal = antalPaa(d)}
								<a
									class="dag-li"
									class:nu={d.dagNummer === dagNummer}
									class:tom={antal === 0}
									href="/ny/admin/forlob/{forlobId}/lektioner/{d.dagNummer}"
									aria-current={d.dagNummer === dagNummer ? 'page' : undefined}
								>
									<span class="dag-navn"
										>{d.dagNummer === 0 ? 'Baseline' : `Dag ${d.dagNummer}`}</span
									>
									<span class="dag-tal">{antal === 0 ? 'tom' : antal}</span>
								</a>
							{/each}
						</div>
					</nav>

					<!-- MIDTEN: dagens lektioner i den raekkefoelge kunden ser -->
					<div class="sp sp-liste">
						<div class="sp-t">
							<span>Lektioner</span>
							<span class="sp-tal">{dag.lektioner.length} stk.</span>
						</div>
						{#if dag.lektioner.length === 0}
							<p class="mini">Ingen lektioner endnu. Tilføj den første.</p>
						{:else}
							<p class="mini">Rækkefølgen her er den, kunden ser i appen.</p>
							<div class="lekt-liste">
								{#each dag.lektioner as l, i (l.id)}
									{@const dageMed = l.grupperingId
										? (lektionGruppeDage.get(l.grupperingId) ?? [])
										: []}
									{@const b = tidsBadge(l)}
									<div class="li" class:valgt={l.id === valgtLektionId}>
										<span class="li-nr">{i + 1}</span>
										<button class="li-vaelg" type="button" onclick={() => (valgtLektionId = l.id)}>
											<span class="li-t">{l.titel.trim() || 'Uden titel'}</span>
											<span class="li-m">
												{l.format.trim() || 'lektion'}{l.varighedMin
													? ` · ${l.varighedMin} min`
													: ''}{#if dageMed.length > 1}
													· 🔗 {dageMed.length} dage{/if}
											</span>
											{#if b}
												<span class="li-badge" data-status={b.status}>⏱ {b.tekst}</span>
											{/if}
										</button>
										<span class="li-flyt">
											<button
												class="flyt"
												type="button"
												onclick={() => flytLektion(i, -1)}
												disabled={i === 0 || gemmer}
												aria-label="Flyt op">↑</button
											>
											<button
												class="flyt"
												type="button"
												onclick={() => flytLektion(i, 1)}
												disabled={i === dag.lektioner.length - 1 || gemmer}
												aria-label="Flyt ned">↓</button
											>
										</span>
									</div>
								{/each}
							</div>
						{/if}
						<button class="knap stiplet" type="button" onclick={tilfoejLektion} disabled={gemmer}>
							+ Tilføj lektion
						</button>

						<div class="sp-t note-t">
							<span>Note fra Linn</span>
							{#if dag.noteGrupperingId && (noteGruppeDage.get(dag.noteGrupperingId) ?? []).length > 1}
								<span class="chip">🔗 {noteGruppeDage.get(dag.noteGrupperingId)?.length} dage</span>
							{/if}
						</div>
						<textarea
							bind:value={dag.noteFraLinn}
							placeholder="Personlig note til holdet for denne dag..."
							rows="3"
							disabled={gemmer}
						></textarea>
						<div class="knap-rad">
							<button
								class="knap lille"
								type="button"
								onclick={() => aabnVaelgDageDialog('note')}
								disabled={gemmer || !dag.noteFraLinn.trim()}
								title={!dag.noteFraLinn.trim() ? 'Skriv noten først' : ''}
							>
								Vis også på dage...
							</button>
							{#if dag.noteGrupperingId}
								<button
									class="knap lille"
									type="button"
									onclick={fjernNoteFraGruppe}
									disabled={gemmer}
								>
									Fjern note
								</button>
							{/if}
						</div>
					</div>

					<!-- HOEJRE: felterne for den valgte lektion -->
					<div class="sp sp-felter">
						{#if valgt}
							{@const l = valgt}
							<div class="sp-t">
								<span>Lektion {dag.lektioner.findIndex((x) => x.id === l.id) + 1}</span>
								<button
									class="slet-lille"
									type="button"
									onclick={() => fjernLektion(l.id)}
									disabled={gemmer}
								>
									Slet lektionen
								</button>
							</div>

							{#if uploadFejl}
								<div class="besked fejl lille-besked">{uploadFejl}</div>
							{/if}

							<label class="felt">
								<span class="felt-navn">Titel</span>
								<input
									type="text"
									value={l.titel}
									oninput={(e) => opdaterLektion(l.id, 'titel', e.currentTarget.value)}
									maxlength="140"
									disabled={gemmer}
								/>
							</label>

							<label class="felt">
								<span class="felt-navn">Beskrivelse</span>
								<textarea
									value={l.beskrivelse}
									oninput={(e) => opdaterLektion(l.id, 'beskrivelse', e.currentTarget.value)}
									rows="3"
									maxlength="500"
									disabled={gemmer}
								></textarea>
							</label>

							<div class="felt-rad">
								<label class="felt">
									<span class="felt-navn">Varighed (min)</span>
									<input
										type="number"
										min="0"
										max="600"
										value={l.varighedMin}
										oninput={(e) =>
											opdaterLektion(l.id, 'varighedMin', parseInt(e.currentTarget.value, 10) || 0)}
										disabled={gemmer}
									/>
								</label>
								<label class="felt">
									<span class="felt-navn">Format</span>
									<input
										type="text"
										value={l.format}
										oninput={(e) => opdaterLektion(l.id, 'format', e.currentTarget.value)}
										placeholder="Video, lyd, tekst..."
										maxlength="40"
										disabled={gemmer}
									/>
								</label>
							</div>

							<!-- FIL ELLER ADRESSE. Hele feltet tager imod en fil der
							     traekkes ind, Linns oenske 5. september. Knapperne
							     bliver, for det er dem man leder efter naar filen ikke
							     ligger lige ved musen. -->
							<div class="felt">
								<span class="felt-navn">Fil eller adresse</span>
								<div
									class="slip"
									class:svaever={dragPdf === l.id}
									class:arbejder={uploaderPdf === l.id ||
										uploaderHtml === l.id ||
										uploaderLyd === l.id}
									ondrop={(e) => haandterPdfDrop(l.id, e)}
									ondragover={(e) => haandterPdfDragOver(l.id, e)}
									ondragleave={() => (dragPdf = null)}
									role="region"
									aria-label="Slip en PDF her"
								>
									{#if uploaderPdf === l.id}
										<b>Lægger dokumentet op...</b>
									{:else if uploaderHtml === l.id || uploaderLyd === l.id}
										<b>Lægger filen op...</b>
									{:else}
										<b>Slip en PDF her</b>
										<span class="slip-knapper">
											<label class="fil-knap" class:slukket={gemmer}>
												📄 PDF
												<input
													type="file"
													accept=".pdf,application/pdf"
													onchange={(e) => haandterPdfInput(l.id, e)}
													disabled={gemmer}
												/>
											</label>
											<label class="fil-knap" class:slukket={gemmer}>
												🎵 Lydfil
												<input
													type="file"
													accept=".mp3,.m4a,.wav,.aac,.ogg,audio/*"
													onchange={(e) => haandterLydUpload(l.id, e)}
													disabled={gemmer}
												/>
											</label>
											<label class="fil-knap" class:slukket={gemmer}>
												📎 HTML
												<input
													type="file"
													accept=".html,.htm,text/html"
													onchange={(e) => haandterHtmlUpload(l.id, e)}
													disabled={gemmer}
												/>
											</label>
										</span>
									{/if}
								</div>
								<input
									class="adresse"
									type="url"
									value={l.url}
									oninput={(e) => opdaterLektion(l.id, 'url', e.currentTarget.value)}
									placeholder="https://... hvis den ligger et andet sted"
									disabled={gemmer}
								/>
							</div>

							<div class="felt">
								<span class="felt-navn">Billede på flisen (valgfri)</span>
								<div
									class="thumb"
									class:har={!!l.thumbnailUrl}
									class:svaever={dragOver === l.id}
									ondrop={(e) => haandterDrop(l.id, e)}
									ondragover={(e) => haandterDragOver(l.id, e)}
									ondragleave={haandterDragLeave}
									onpaste={(e) => haandterPaste(l.id, e)}
									role="region"
									aria-label="Slip eller indsæt et billede her"
								>
									{#if l.thumbnailUrl}
										<img src={l.thumbnailUrl} alt="" class="thumb-billede" />
										<div class="thumb-over">
											<label class="fil-knap">
												Skift
												<input
													type="file"
													accept="image/*"
													onchange={(e) => haandterThumbnailInput(l.id, e)}
													disabled={gemmer || uploaderThumb === l.id}
												/>
											</label>
											<button
												class="fil-knap fare"
												type="button"
												onclick={() => fjernThumbnail(l.id)}
												disabled={gemmer || uploaderThumb === l.id}>Fjern</button
											>
										</div>
									{:else if uploaderThumb === l.id}
										<div class="thumb-tom"><b>Lægger billedet op...</b></div>
									{:else}
										<label class="thumb-tom">
											<b>Slip et billede her</b>
											<span>eller klik for at vælge · indsæt med ⌘V</span>
											<input
												type="file"
												accept="image/*"
												onchange={(e) => haandterThumbnailInput(l.id, e)}
												disabled={gemmer}
											/>
										</label>
									{/if}
								</div>
								<p class="mini">Vises i stedet for video-tjenestens eget billede. Højst 3 MB.</p>
							</div>

							<div class="felt tids">
								<button
									class="tids-kontakt"
									type="button"
									role="switch"
									aria-checked={tidsAaben(l)}
									onclick={() => toggleTidsbegraens(l)}
									disabled={gemmer}
								>
									<span class="spor" class:til={tidsAaben(l)}><span class="kugle"></span></span>
									<span class="tids-tekst">
										<span class="felt-navn">⏱ Tidsbegræns synlighed</span>
										<span class="mini">
											{tidsAaben(l)
												? 'Lektionen skjules automatisk uden for vinduet.'
												: 'Lektionen er altid synlig, når dagen er åben.'}
										</span>
									</span>
								</button>
								{#if tidsAaben(l)}
									<div class="tids-krop">
										<div class="felt-rad">
											<label class="felt">
												<span class="felt-navn">Vis fra (valgfri)</span>
												<input
													type="datetime-local"
													value={l.visFra ?? ''}
													oninput={(e) => opdaterLektion(l.id, 'visFra', e.currentTarget.value)}
													disabled={gemmer}
												/>
											</label>
											<label class="felt">
												<span class="felt-navn">Skjul efter</span>
												<input
													type="datetime-local"
													value={l.skjulEfter ?? ''}
													oninput={(e) => opdaterLektion(l.id, 'skjulEfter', e.currentTarget.value)}
													disabled={gemmer}
												/>
											</label>
										</div>
										{#if tidsFejl(l)}
											<div class="tids-fejl">⚠ {tidsFejl(l)}</div>
										{:else if tidsResume(l)}
											<div class="tids-resume">ⓘ {tidsResume(l)}</div>
										{/if}
										<p class="mini">
											Kunder der er bagud, fordi de har holdt pause, når måske ikke at se den inden
											fristen. Til live-møder er det som regel det rigtige. Datoen hører til dette
											hold, så genbruger du lektionen, skal den sættes på ny.
										</p>
									</div>
								{/if}
							</div>

							<label class="afkrydsning">
								<input
									type="checkbox"
									checked={l.kopierIkke ?? false}
									onchange={(e) => opdaterLektion(l.id, 'kopierIkke', e.currentTarget.checked)}
									disabled={gemmer}
								/>
								<span>
									<span class="felt-navn">Kun dette hold</span>
									<span class="mini">Bliver ikke kopieret med til nye hold.</span>
								</span>
							</label>

							<button
								class="knap lille"
								type="button"
								onclick={() => aabnVaelgDageDialog(`lektion:${l.id}`)}
								disabled={gemmer || !l.titel.trim()}
								title={!l.titel.trim() ? 'Skriv titel først' : ''}
							>
								Vis også på dage...
							</button>
						{:else}
							<div class="tomt">Vælg en lektion i midten, eller tilføj en ny.</div>
						{/if}
					</div>
				</div>

				<div class="gem-bjaelke">
					<button class="knap fyldt" type="button" onclick={gem} disabled={gemmer}>
						{gemmer ? 'Gemmer...' : 'Gem'}
					</button>
					{#if !bekraefter}
						<button class="knap lille" type="button" onclick={sletDag} disabled={gemmer}>
							Slet alt indhold for denne dag
						</button>
					{:else}
						<span class="bekraeft">
							<span>Sikker? Alt indhold på dagen forsvinder.</span>
							<button class="knap fare" type="button" onclick={sletDag} disabled={gemmer}>
								Ja, slet dagen
							</button>
							<button class="knap lille" type="button" onclick={() => (bekraefter = false)}>
								Fortryd
							</button>
						</span>
					{/if}
					{#if gemKvit}<span class="kvit">Gemt ✓</span>{/if}
				</div>
			{/if}
		{:else if aktivFane === 'refleksioner'}
			<div class="enkelt-fane"><ForlobRefleksionerFane {forlobId} {dagNummer} /></div>
		{:else}
			<div class="enkelt-fane"><ForlobSmaaSkridtFane {forlobId} {dagNummer} /></div>
		{/if}
	</div>
{/if}

{#if dialogMaal && forlob}
	<VaelgDageDialog
		startDato={forlob.startDato.toDate().toISOString()}
		antalDage={forlob.antalDage}
		nuvaerendeDag={dagNummer}
		valgteDageStart={dialogStartDage}
		titel={dialogMaal === 'note' ? 'Vis noten på dage' : 'Vis lektion på dage'}
		onGem={haandterVaelgDage}
		onAnnuller={() => (dialogMaal = null)}
	/>
{/if}

{#if gruppeBekraeft}
	<RedigerGruppeDialog
		titel={gruppeBekraeft.titel}
		beskrivelse={gruppeBekraeft.beskrivelse}
		antalDage={gruppeBekraeft.antalDage}
		alleLabel={gruppeBekraeft.alleLabel}
		denneLabel={gruppeBekraeft.denneLabel}
		erFarlig={gruppeBekraeft.erFarlig}
		onAlle={gruppeBekraeft.paaAlle}
		onDenne={gruppeBekraeft.paaDenne}
		onAnnuller={() => (gruppeBekraeft = null)}
	/>
{/if}

<style>
	/* Bredt med vilje. Admin bruges paa en iMac, saa den smalle
	   520px-ramme fra kunde-siderne gaelder ikke her. */
	.side {
		padding: 20px 24px 30px;
		max-width: 1560px;
		margin: 0 auto;
	}

	.side-hoved {
		margin-bottom: 16px;
	}

	.tilbage {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-size: calc(12px * var(--fs-scale, 1));
		color: var(--ink-2);
		text-decoration: none;
		margin-bottom: 10px;
	}

	.eyebrow {
		font-size: calc(10px * var(--fs-scale, 1));
		font-weight: 600;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--ink-3);
	}

	h1 {
		font-family: var(--ff-d);
		font-size: calc(28px * var(--fs-scale, 1));
		font-weight: 600;
		letter-spacing: -0.02em;
		margin: 4px 0 0;
		line-height: 1.05;
		color: var(--text);
	}

	.side-sub {
		font-size: calc(13px * var(--fs-scale, 1));
		color: var(--ink-2);
		margin: 5px 0 14px;
	}

	.faner {
		display: inline-flex;
		gap: 4px;
		background: var(--oat);
		border-radius: 11px;
		padding: 4px;
	}

	.fane {
		border: none;
		background: transparent;
		font-family: inherit;
		font-size: calc(12.5px * var(--fs-scale, 1));
		font-weight: 600;
		padding: 8px 18px;
		border-radius: 8px;
		color: var(--ink-2);
		cursor: pointer;
	}

	.fane.aktiv {
		background: var(--white, #fff);
		color: var(--text);
		box-shadow: 0 1px 3px rgba(56, 44, 42, 0.08);
	}

	.besked {
		padding: 14px 16px;
		background: var(--white, #fff);
		border: 1px solid var(--line);
		border-radius: 12px;
		color: var(--ink-2);
		font-size: calc(13px * var(--fs-scale, 1));
		text-align: center;
	}

	.besked.fejl {
		color: var(--ler-tekst);
		background: var(--ler-tint);
		border-color: #e6cdbf;
	}

	.lille-besked {
		text-align: left;
		padding: 9px 12px;
		margin-bottom: 12px;
	}

	/* ── De tre spalter ─────────────────────────────────────────────── */
	.krop {
		display: flex;
		gap: 18px;
		align-items: flex-start;
	}

	.sp {
		background: var(--white, #fff);
		border: 1px solid var(--line);
		border-radius: 15px;
		padding: 16px;
	}

	.sp-dage {
		width: 156px;
		flex: none;
		position: sticky;
		top: 16px;
	}

	.sp-liste {
		width: 320px;
		flex: none;
	}

	.sp-felter {
		flex: 1;
		min-width: 340px;
	}

	.sp-t {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		font-size: calc(10.5px * var(--fs-scale, 1));
		font-weight: 700;
		letter-spacing: 0.11em;
		text-transform: uppercase;
		color: var(--ink-3);
		margin-bottom: 10px;
	}

	.sp-tal {
		letter-spacing: 0;
		text-transform: none;
		font-weight: 600;
	}

	.note-t {
		margin-top: 20px;
	}

	.mini {
		font-size: calc(11.5px * var(--fs-scale, 1));
		color: var(--ink-3);
		line-height: 1.5;
		margin: 0 0 9px;
	}

	/* ── Venstre: dagene ────────────────────────────────────────────── */
	.dag-liste {
		max-height: calc(100vh - 210px);
		overflow-y: auto;
	}

	.dag-li {
		display: flex;
		align-items: center;
		gap: 7px;
		padding: 6px 9px;
		border-radius: 8px;
		font-size: calc(12.5px * var(--fs-scale, 1));
		color: var(--ink-2);
		text-decoration: none;
		margin-bottom: 2px;
	}

	.dag-li:hover {
		background: var(--paper-2);
	}

	.dag-li.tom .dag-navn {
		color: var(--ink-3);
	}

	.dag-tal {
		margin-left: auto;
		font-size: calc(10px * var(--fs-scale, 1));
		color: var(--ink-3);
	}

	.dag-li.nu {
		background: var(--plum);
		color: #fff;
		font-weight: 600;
	}

	.dag-li.nu .dag-navn,
	.dag-li.nu .dag-tal {
		color: #fff;
	}

	.dag-li.nu .dag-tal {
		opacity: 0.75;
	}

	/* ── Midten: lektionerne ────────────────────────────────────────── */
	.li {
		display: flex;
		align-items: center;
		gap: 9px;
		border: 1px solid var(--line);
		border-radius: 11px;
		padding: 9px 10px;
		margin-bottom: 7px;
		background: var(--paper);
	}

	.li.valgt {
		border-color: var(--plum);
		background: var(--plum-tint);
		box-shadow: 0 0 0 2px rgba(124, 79, 99, 0.12);
	}

	.li-nr {
		width: 21px;
		height: 21px;
		flex: none;
		border-radius: 50%;
		background: var(--oat);
		color: var(--ink-2);
		font-size: calc(11px * var(--fs-scale, 1));
		font-weight: 700;
		display: grid;
		place-items: center;
	}

	.li.valgt .li-nr {
		background: var(--plum);
		color: #fff;
	}

	.li-vaelg {
		flex: 1;
		min-width: 0;
		border: none;
		background: transparent;
		font-family: inherit;
		text-align: left;
		padding: 0;
		cursor: pointer;
	}

	.li-t {
		display: block;
		font-size: calc(13.5px * var(--fs-scale, 1));
		font-weight: 600;
		line-height: 1.3;
		color: var(--text);
	}

	.li-m {
		display: block;
		font-size: calc(11px * var(--fs-scale, 1));
		color: var(--ink-3);
		margin-top: 2px;
	}

	.li-badge {
		display: inline-block;
		font-size: calc(10px * var(--fs-scale, 1));
		font-weight: 600;
		padding: 2px 7px;
		border-radius: 99px;
		margin-top: 4px;
		background: var(--honey-tint);
		color: var(--honey-deep);
	}

	.li-badge[data-status='udloebet'] {
		background: var(--ler-tint);
		color: var(--ler-tekst);
	}

	.li-flyt {
		display: flex;
		flex-direction: column;
		gap: 2px;
		flex: none;
	}

	.flyt {
		border: 1px solid var(--line);
		background: var(--white, #fff);
		border-radius: 6px;
		width: 22px;
		height: 18px;
		font-size: calc(10px * var(--fs-scale, 1));
		color: var(--ink-2);
		cursor: pointer;
		padding: 0;
		line-height: 1;
	}

	.flyt:disabled {
		opacity: 0.3;
		cursor: default;
	}

	.chip {
		font-size: calc(10px * var(--fs-scale, 1));
		font-weight: 600;
		padding: 3px 8px;
		border-radius: 99px;
		background: var(--plum-tint);
		color: var(--plum-deep);
		letter-spacing: 0;
		text-transform: none;
	}

	/* ── Knapper ────────────────────────────────────────────────────── */
	.knap {
		border: 1px solid var(--line);
		background: var(--white, #fff);
		border-radius: 10px;
		padding: 9px 16px;
		font-family: inherit;
		font-size: calc(13px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--ink-2);
		cursor: pointer;
	}

	.knap:disabled {
		opacity: 0.45;
		cursor: default;
	}

	.knap.stiplet {
		display: block;
		width: 100%;
		border-style: dashed;
		background: transparent;
		margin-top: 8px;
	}

	.knap.lille {
		padding: 7px 13px;
		font-size: calc(12px * var(--fs-scale, 1));
	}

	.knap.fyldt {
		background: var(--plum);
		border-color: var(--plum);
		color: #fff;
		padding: 10px 30px;
	}

	.knap.fare {
		background: var(--ler-tekst);
		border-color: var(--ler-tekst);
		color: #fff;
	}

	.knap-rad {
		display: flex;
		gap: 7px;
		margin-top: 8px;
		flex-wrap: wrap;
	}

	.slet-lille {
		border: none;
		background: transparent;
		font-family: inherit;
		font-size: calc(11px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--maerke);
		cursor: pointer;
		letter-spacing: 0;
		text-transform: none;
		padding: 0;
	}

	.slet-lille:disabled {
		opacity: 0.4;
		cursor: default;
	}

	/* ── Felter ─────────────────────────────────────────────────────── */
	.felt {
		display: block;
		margin-bottom: 13px;
	}

	.felt-navn {
		display: block;
		font-size: calc(11px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--ink-2);
		margin-bottom: 4px;
	}

	.felt-rad {
		display: flex;
		gap: 11px;
	}

	.felt-rad > .felt {
		flex: 1;
	}

	input[type='text'],
	input[type='url'],
	input[type='number'],
	input[type='datetime-local'],
	textarea {
		width: 100%;
		border: 1px solid var(--line);
		border-radius: 9px;
		padding: 9px 11px;
		font-size: calc(13.5px * var(--fs-scale, 1));
		font-family: inherit;
		color: var(--text);
		background: var(--paper-2);
	}

	textarea {
		resize: vertical;
	}

	input:disabled,
	textarea:disabled {
		opacity: 0.55;
	}

	.adresse {
		margin-top: 8px;
	}

	/* ── Slip en fil ────────────────────────────────────────────────── */
	.slip {
		border: 2px dashed var(--line);
		border-radius: 11px;
		padding: 16px 12px;
		text-align: center;
		background: var(--paper-2);
		transition:
			border-color 0.12s,
			background 0.12s;
	}

	.slip b {
		display: block;
		font-size: calc(13.5px * var(--fs-scale, 1));
		color: var(--ink-2);
		font-weight: 600;
		margin-bottom: 8px;
	}

	/* Svar naar en fil svaever over feltet. Uden det ved man ikke om man
	   kan slippe. */
	.slip.svaever {
		border-color: var(--maerke);
		background: #fdf6f3;
	}

	.slip.svaever b {
		color: var(--maerke);
	}

	.slip.arbejder b {
		margin-bottom: 0;
	}

	.slip-knapper {
		display: flex;
		gap: 7px;
		justify-content: center;
		flex-wrap: wrap;
	}

	.fil-knap {
		display: inline-block;
		border: 1px solid var(--line);
		background: var(--white, #fff);
		border-radius: 9px;
		padding: 7px 13px;
		font-size: calc(12px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--ink-2);
		cursor: pointer;
	}

	.fil-knap input {
		display: none;
	}

	.fil-knap.slukket {
		opacity: 0.45;
		cursor: default;
	}

	.fil-knap.fare {
		color: var(--ler-tekst);
	}

	/* ── Billedet paa flisen ────────────────────────────────────────── */
	.thumb {
		position: relative;
		border: 2px dashed var(--line);
		border-radius: 11px;
		background: var(--paper-2);
		overflow: hidden;
		min-height: 92px;
		display: grid;
		place-items: center;
	}

	.thumb.svaever {
		border-color: var(--maerke);
		background: #fdf6f3;
	}

	.thumb.har {
		border-style: solid;
		min-height: 0;
	}

	.thumb-billede {
		display: block;
		width: 100%;
		max-height: 190px;
		object-fit: cover;
	}

	.thumb-over {
		position: absolute;
		right: 8px;
		bottom: 8px;
		display: flex;
		gap: 6px;
	}

	.thumb-tom {
		display: block;
		text-align: center;
		padding: 18px 12px;
		cursor: pointer;
		width: 100%;
	}

	.thumb-tom b {
		display: block;
		font-size: calc(13px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--ink-2);
	}

	.thumb-tom span {
		display: block;
		font-size: calc(11.5px * var(--fs-scale, 1));
		color: var(--ink-3);
		margin-top: 3px;
	}

	.thumb-tom input {
		display: none;
	}

	/* ── Tidsbegraensning ───────────────────────────────────────────── */
	.tids {
		border: 1px solid var(--line);
		border-radius: 11px;
		padding: 12px;
		background: var(--paper-2);
	}

	.tids-kontakt {
		display: flex;
		align-items: flex-start;
		gap: 11px;
		border: none;
		background: transparent;
		font-family: inherit;
		text-align: left;
		padding: 0;
		width: 100%;
		cursor: pointer;
	}

	.spor {
		width: 36px;
		height: 21px;
		flex: none;
		border-radius: 99px;
		background: var(--line);
		position: relative;
		margin-top: 1px;
		transition: background 0.15s;
	}

	.spor.til {
		background: var(--sage);
	}

	.kugle {
		position: absolute;
		top: 3px;
		left: 3px;
		width: 15px;
		height: 15px;
		border-radius: 50%;
		background: #fff;
		transition: transform 0.15s;
	}

	.spor.til .kugle {
		transform: translateX(15px);
	}

	.tids-tekst .mini {
		margin: 0;
	}

	.tids-krop {
		margin-top: 12px;
	}

	.tids-fejl,
	.tids-resume {
		font-size: calc(12px * var(--fs-scale, 1));
		border-radius: 9px;
		padding: 8px 11px;
		margin-bottom: 8px;
		line-height: 1.5;
	}

	.tids-fejl {
		background: var(--ler-tint);
		color: var(--ler-tekst);
	}

	.tids-resume {
		background: var(--sage-tint);
		color: var(--sage-tekst);
	}

	.afkrydsning {
		display: flex;
		align-items: flex-start;
		gap: 9px;
		margin: 13px 0;
		cursor: pointer;
	}

	.afkrydsning input {
		margin-top: 2px;
		flex: none;
	}

	.afkrydsning .mini {
		margin: 0;
	}

	.tomt {
		padding: 40px 16px;
		text-align: center;
		color: var(--ink-3);
		font-size: calc(13px * var(--fs-scale, 1));
	}

	/* ── Gem-bjaelken ───────────────────────────────────────────────── */
	.gem-bjaelke {
		display: flex;
		align-items: center;
		gap: 11px;
		flex-wrap: wrap;
		margin-top: 16px;
		padding: 14px 16px;
		background: var(--white, #fff);
		border: 1px solid var(--line);
		border-radius: 14px;
		position: sticky;
		bottom: 12px;
		box-shadow: 0 6px 20px rgba(56, 44, 42, 0.08);
	}

	.bekraeft {
		display: flex;
		align-items: center;
		gap: 9px;
		flex-wrap: wrap;
		font-size: calc(12.5px * var(--fs-scale, 1));
		color: var(--ler-tekst);
	}

	.kvit {
		margin-left: auto;
		font-size: calc(12.5px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--sage-tekst);
	}

	.enkelt-fane {
		background: var(--white, #fff);
		border: 1px solid var(--line);
		border-radius: 15px;
		padding: 16px;
	}

	/* Paa en smallere skaerm, fx en laptop, falder spalterne under
	   hinanden i stedet for at blive klemt sammen. */
	@media (max-width: 1120px) {
		.krop {
			flex-wrap: wrap;
		}

		.sp-dage {
			width: 100%;
			position: static;
		}

		.dag-liste {
			display: flex;
			flex-wrap: wrap;
			gap: 4px;
			max-height: none;
		}

		.dag-li {
			margin-bottom: 0;
			border: 1px solid var(--line);
		}

		.sp-liste,
		.sp-felter {
			width: 100%;
			flex: 1 1 320px;
			min-width: 0;
		}
	}
</style>
