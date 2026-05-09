<script lang="ts">
	import { getContext, onMount } from 'svelte';
	import { page } from '$app/state';
	import { replaceState } from '$app/navigation';
	import type { User } from 'firebase/auth';
	import {
		beregnItem,
		beregnMaaltid,
		erManueltItem,
		filtrerFodevarer,
		formatDatoKey,
		formatGram,
		gaetMaaltidstype,
		KATEGORI_LABELS as FODEVARE_KATEGORIER,
		MAALTIDSTYPE_LABELS,
		MAALTIDSTYPER,
		maaltidstypeOrder,
		PROTEIN_MAALTIDS_MAAL,
		FIBER_DAGS_MAAL,
		procentMod,
		sorterFodevarer,
		type Fodevare,
		type GemtMaaltid,
		type Kategori,
		type MaaltidsItem,
		type Maaltidstype,
		type SortMode
	} from '$lib/content/kost';
	import {
		gemFavorit,
		gemMaaltid,
		hentFavoritter,
		hentMaaltiderForDato,
		opdaterFavorit,
		opdaterMaaltid,
		sletFavorit,
		sletMaaltid,
		stemPaaFodevare
	} from '$lib/firestore/kost';
	import { lookupBarcode } from '$lib/content/openFoodFacts';
	import BarcodeScanner from '$lib/components/BarcodeScanner.svelte';
	import TilfoejFodevareDialog from '$lib/components/TilfoejFodevareDialog.svelte';
	import type { FavoritMaaltid } from '$lib/content/kost';
	import {
		ALLE_DIET_TAGS,
		ALLE_KATEGORIER as OPSKRIFT_KATEGORIER,
		DIET_LABELS,
		filtrerOpskrifter,
		KATEGORI_LABELS as OPSKRIFT_LABELS,
		type DietTag,
		type Opskrift,
		type OpskriftKategori
	} from '$lib/content/opskrifter';
	import { hentAlleFodevarer } from '$lib/firestore/kost';

	const getUser = getContext<() => User | null>('user');
	const getUserDoc = getContext<() => { firstName?: string } | null>('userDoc');
	const user = $derived(getUser());
	const userDoc = $derived(getUserDoc?.() ?? null);
	import { hentAlleOpskrifter } from '$lib/firestore/opskrifter';
	import Icon from '$lib/components/Icon.svelte';
	import IndkoebsListeOverlay from '$lib/components/IndkoebsListeOverlay.svelte';
	import Loading from '$lib/components/Loading.svelte';
	import {
		byggIndkoebsliste,
		type IndkoebsItem,
		type ValgteOpskrifter
	} from '$lib/content/indkoebsliste';

	// Flytter overlay-elementet til document.body så det kommer ud af
	// app-shellens stacking context (.app-shell har overflow: hidden) og
	// lægger sig oven på Header og TabBar uanset side-scroll.
	function portalToBody(node: HTMLElement) {
		document.body.appendChild(node);
		return {
			destroy() {
				if (node.parentNode === document.body) {
					document.body.removeChild(node);
				}
			}
		};
	}

	const STORAGE_KEY = 'la_30303_maaltid_v1';

	type Tab = 'opslag' | 'maaltid' | 'opskrifter' | 'dagbog';

	function tabFraQuery(): Tab {
		const t = page.url.searchParams.get('tab');
		if (t === 'maaltid' || t === 'opskrifter' || t === 'dagbog' || t === 'opslag') return t;
		return 'opslag';
	}

	let aktivTab = $state<Tab>(tabFraQuery());

	function skiftTab(ny: Tab) {
		aktivTab = ny;
		const url = new URL(page.url);
		if (ny === 'opslag') {
			url.searchParams.delete('tab');
		} else {
			url.searchParams.set('tab', ny);
		}
		replaceState(url, page.state);
	}

	let foods = $state<Fodevare[]>([]);
	let foodMap = $state<Map<string, Fodevare>>(new Map());
	let opskrifter = $state<Opskrift[]>([]);
	let loading = $state(true);
	let fejl = $state<string | null>(null);

	// Slå op-state
	let soegeord = $state('');
	let aktivKategori = $state<Kategori | 'all'>('all');
	let sortMode = $state<SortMode>('alpha');

	// Byg måltid-state — persisterer i localStorage
	let maaltid = $state<MaaltidsItem[]>([]);
	let viserPicker = $state(false);
	let pickerSoeg = $state('');
	let pickerKategori = $state<Kategori | 'all'>('all');
	let erstatterIndex = $state<number | null>(null);

	// Stregkode-scanner og 'tilføj ny fødevare'-dialog
	let viserScanner = $state(false);
	let scannerArbejder = $state(false);
	let nyDialog = $state<{
		barcode: string;
		startNavn?: string;
		startProtein?: number;
		startFiber?: number;
		startKat?: Kategori;
	} | null>(null);
	let stemmer = $state<string | null>(null); // fodevare-id der er ved at få stem opdateret

	// Opskrifter-state
	let opskriftSoeg = $state('');
	let valgteOpskriftKategorier = $state<OpskriftKategori[]>([]);
	let valgteDietTags = $state<DietTag[]>([]);

	// Indkøbsliste-state — valgte opskrifter med portioner og overlay
	let valgteOpskrifter = $state<ValgteOpskrifter>(new Map());
	let viserIndkoebsliste = $state(false);
	let indkoebslisteItems = $state<IndkoebsItem[]>([]);
	let bevareteManuelle = $state<IndkoebsItem[]>([]);

	const valgteAntal = $derived(valgteOpskrifter.size);

	function toggleValgtOpskrift(o: Opskrift, e: MouseEvent) {
		e.preventDefault();
		e.stopPropagation();
		const ny = new Map(valgteOpskrifter);
		if (ny.has(o.id)) {
			ny.delete(o.id);
		} else {
			ny.set(o.id, o.defaultPortioner);
		}
		valgteOpskrifter = ny;
	}

	function aendrePortioner(opskriftId: string, delta: number, e: MouseEvent) {
		e.preventDefault();
		e.stopPropagation();
		const aktuel = valgteOpskrifter.get(opskriftId);
		if (aktuel === undefined) return;
		const ny = Math.max(1, aktuel + delta);
		const ny2 = new Map(valgteOpskrifter);
		ny2.set(opskriftId, ny);
		valgteOpskrifter = ny2;
	}

	function aabnIndkoebsliste() {
		indkoebslisteItems = byggIndkoebsliste(opskrifter, valgteOpskrifter, bevareteManuelle);
		viserIndkoebsliste = true;
	}

	function lukIndkoebsliste() {
		bevareteManuelle = indkoebslisteItems.filter((i) => i.manuel);
		viserIndkoebsliste = false;
	}

	function opdaterItems(ny: IndkoebsItem[]) {
		indkoebslisteItems = ny;
	}

	function nulstilValgteOpskrifter() {
		valgteOpskrifter = new Map();
		bevareteManuelle = [];
	}

	// Dagbog-state
	let dagbogDato = $state<string>(formatDatoKey());
	let dagbogMaaltider = $state<GemtMaaltid[]>([]);
	let dagbogIndlaeser = $state(false);
	let dagbogFejl = $state<string | null>(null);

	// Gem-måltid-modal state
	let viserGemModal = $state(false);
	let gemNavn = $state('');
	let gemType = $state<Maaltidstype>('morgenmad');
	let gemDato = $state<string>(formatDatoKey());
	let gemSomFavorit = $state(false);
	let gemmer = $state(false);
	let gemBesked = $state<{ tekst: string; type: 'ok' | 'fejl' } | null>(null);

	// Favoritter
	let favoritter = $state<FavoritMaaltid[]>([]);
	let redigererFavorit = $state<{ id: string; navn: string } | null>(null);
	let redigerNavn = $state('');
	let opdaterer = $state(false);
	let redigerBesked = $state<{ tekst: string; type: 'ok' | 'fejl' } | null>(null);

	// Rediger-måltid-state — sat når brugeren klikker rediger på et dagbog-kort
	let redigererMaaltid = $state<{
		id: string;
		navn: string;
		type: Maaltidstype;
		dato: string;
	} | null>(null);

	const filtreret = $derived(
		sorterFodevarer(filtrerFodevarer(foods, soegeord, aktivKategori), sortMode)
	);
	const filtretetPicker = $derived(
		sorterFodevarer(filtrerFodevarer(foods, pickerSoeg, pickerKategori), 'alpha')
	);
	const filtreredeOpskrifter = $derived(
		filtrerOpskrifter(opskrifter, opskriftSoeg, valgteOpskriftKategorier, valgteDietTags)
	);

	const totaler = $derived(beregnMaaltid(maaltid, foodMap));
	const proteinPct = $derived(procentMod(PROTEIN_MAALTIDS_MAAL, totaler.protein));
	const fiberPct = $derived(procentMod(FIBER_DAGS_MAAL, totaler.fiber));

	const aktiveKategorier = $derived.by<Array<Kategori | 'all'>>(() => {
		const sat = new Set<Kategori>();
		for (const f of foods) sat.add(f.cat);
		return [
			'all',
			...Array.from(sat).sort((a, b) =>
				FODEVARE_KATEGORIER[a].localeCompare(FODEVARE_KATEGORIER[b], 'da')
			)
		];
	});

	let initialiseret = $state(false);

	onMount(async () => {
		try {
			const raw = localStorage.getItem(STORAGE_KEY);
			if (raw) {
				const parsed = JSON.parse(raw);
				if (Array.isArray(parsed)) maaltid = parsed;
			}
		} catch (e) {
			console.warn('Kunne ikke læse gemt måltid:', e);
		}

		try {
			const [allFoods, allOpskrifter] = await Promise.all([
				hentAlleFodevarer(),
				hentAlleOpskrifter(true)
			]);
			foods = allFoods;
			foodMap = new Map(allFoods.map((f) => [f.id, f]));
			opskrifter = allOpskrifter;
		} catch (e) {
			console.error(e);
			fejl = 'Kunne ikke hente data.';
		} finally {
			loading = false;
			initialiseret = true;
		}

		// Indlæs dagbog og favoritter i baggrunden
		void indlaesDagbog();
		void indlaesFavoritter();
	});

	async function indlaesFavoritter() {
		const u = user;
		if (!u) return;
		try {
			favoritter = await hentFavoritter(u.uid);
		} catch (e) {
			console.warn('Kunne ikke hente favoritter:', e);
		}
	}

	function indlaesFavoritIMaaltid(fav: FavoritMaaltid) {
		if (maaltid.length > 0) {
			const ok = confirm(
				'Du har allerede et måltid i gang. Vil du erstatte det med ' + fav.navn + '?'
			);
			if (!ok) return;
		}
		maaltid = fav.items.map((i) => ({ ...i }));
		skiftTab('maaltid');
	}

	async function sletFavoritKlik(id: string, navn: string) {
		const u = user;
		if (!u) return;
		const ok = confirm(`Slet favoritten "${navn}"?`);
		if (!ok) return;
		try {
			await sletFavorit(u.uid, id);
			favoritter = favoritter.filter((f) => f.id !== id);
		} catch (e) {
			console.error(e);
		}
	}

	function startRedigerFavorit(fav: FavoritMaaltid) {
		if (maaltid.length > 0) {
			const ok = confirm(
				'Du har et måltid i gang. Det erstattes af favoritten du vil redigere.'
			);
			if (!ok) return;
		}
		maaltid = fav.items.map((i) => ({ ...i }));
		redigererFavorit = { id: fav.id, navn: fav.navn };
		redigerNavn = fav.navn;
		redigerBesked = null;
		skiftTab('maaltid');
	}

	function annullerRediger() {
		const ok = confirm('Kassér ændringer? Favoritten forbliver uændret.');
		if (!ok) return;
		maaltid = [];
		localStorage.setItem(STORAGE_KEY, '[]');
		redigererFavorit = null;
		redigerBesked = null;
	}

	async function gemRedigeretFavorit() {
		const u = user;
		const aktiv = redigererFavorit;
		if (!u || !aktiv || opdaterer) return;
		const navn = redigerNavn.trim();
		if (!navn) {
			redigerBesked = { tekst: 'Favoritten skal have et navn.', type: 'fejl' };
			return;
		}
		if (maaltid.length === 0) {
			redigerBesked = { tekst: 'Tilføj mindst én ingrediens.', type: 'fejl' };
			return;
		}
		opdaterer = true;
		redigerBesked = null;
		try {
			await opdaterFavorit(u.uid, aktiv.id, { navn, items: maaltid });
			await indlaesFavoritter();
			maaltid = [];
			localStorage.setItem(STORAGE_KEY, '[]');
			redigererFavorit = null;
			redigerBesked = null;
		} catch (e) {
			console.error(e);
			redigerBesked = { tekst: 'Kunne ikke opdatere favoritten. Prøv igen.', type: 'fejl' };
		} finally {
			opdaterer = false;
		}
	}

	$effect(() => {
		if (!initialiseret) return;
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(maaltid));
		} catch (e) {
			console.warn('Kunne ikke gemme måltid:', e);
		}
	});

	// Lås bagvedliggende side-scroll mens en modal er åben, så iPhone ikke
	// scroller forsiden under dialogen. IndkoebsListeOverlay låser selv.
	$effect(() => {
		if (!viserGemModal && !viserPicker) return;
		const original = document.body.style.overflow;
		document.body.style.overflow = 'hidden';
		return () => {
			document.body.style.overflow = original;
		};
	});

	function tilfoejTilMaaltid(food: Fodevare) {
		const standardEnhed = food.units?.[0]?.u;
		if (erstatterIndex !== null) {
			// Erstat manuelt item — bevar portion hvis muligt, ellers brug standard
			const eksisterende = maaltid[erstatterIndex];
			const portion = eksisterende?.portion > 0 ? eksisterende.portion : standardEnhed ? 1 : 100;
			const opdateret = [...maaltid];
			opdateret[erstatterIndex] = {
				foodId: food.id,
				portion,
				enhedId: standardEnhed
			};
			maaltid = opdateret;
			erstatterIndex = null;
		} else {
			const standardPortion = standardEnhed ? 1 : 100;
			maaltid = [
				...maaltid,
				{ foodId: food.id, portion: standardPortion, enhedId: standardEnhed }
			];
			skiftTab('maaltid');
		}
		viserPicker = false;
		pickerSoeg = '';
	}

	function aabnErstat(index: number) {
		erstatterIndex = index;
		const item = maaltid[index];
		viserPicker = true;
		// Pre-udfyld søgefeltet med ingrediensens navn for hurtig matching
		pickerSoeg = item?.manuel?.navn ?? '';
		pickerKategori = 'all';
	}

	function fjernItem(index: number) {
		maaltid = maaltid.filter((_, i) => i !== index);
	}

	function opdaterPortion(index: number, ny: string) {
		const n = parseFloat(ny.replace(',', '.'));
		if (!Number.isFinite(n) || n < 0) return;
		const opdateret = [...maaltid];
		opdateret[index] = { ...opdateret[index], portion: n };
		maaltid = opdateret;
	}

	function opdaterEnhed(index: number, ny: string) {
		const opdateret = [...maaltid];
		opdateret[index] = { ...opdateret[index], enhedId: ny || undefined };
		maaltid = opdateret;
	}

	function nulstilMaaltid() {
		maaltid = [];
	}

	function aabnPicker() {
		erstatterIndex = null;
		viserPicker = true;
		pickerSoeg = '';
		pickerKategori = 'all';
	}

	function aabnScanner() {
		viserScanner = true;
	}

	async function efterScan(barcode: string) {
		viserScanner = false;
		scannerArbejder = true;
		try {
			// Hvis fødevaren allerede findes (cf_-prefix på dokument-id) → tilføj direkte
			const eksisterendeId = `cf_${barcode}`;
			const eksisterende = foods.find((f) => f.id === eksisterendeId);
			if (eksisterende) {
				tilfoejTilMaaltid(eksisterende);
				return;
			}
			const off = await lookupBarcode(barcode);
			nyDialog = {
				barcode,
				startNavn: off?.navn ?? '',
				startProtein: off?.protein ?? 0,
				startFiber: off?.fiber ?? 0,
				startKat: off?.katForslag ?? 'andet'
			};
		} finally {
			scannerArbejder = false;
		}
	}

	function aabnTilfoejManuel() {
		nyDialog = {
			barcode: 'manual_' + Date.now(),
			startNavn: '',
			startProtein: 0,
			startFiber: 0,
			startKat: 'andet'
		};
	}

	function efterTilfoejet(ny: Fodevare) {
		// Læg den nye fødevare ind i klient-cachen så den straks kan findes
		foods = [...foods, ny].sort((a, b) => a.name.localeCompare(b.name, 'da'));
		foodMap = new Map(foods.map((f) => [f.id, f]));
		nyDialog = null;
		// Tilføj direkte til måltid (eller erstat hvis vi var i erstat-flow)
		tilfoejTilMaaltid(ny);
	}

	async function stemFodevare(food: Fodevare, type: 'ok' | 'ej', e: Event) {
		e.stopPropagation();
		const u = user;
		if (!u || !food.id || stemmer) return;
		stemmer = food.id;
		try {
			await stemPaaFodevare(food.id, u.uid, type);
			// Opdater lokal cache så UI reagerer med det samme
			const idx = foods.findIndex((f) => f.id === food.id);
			if (idx >= 0) {
				const okBy = (foods[idx].okBy ?? []).filter((x) => x !== u.uid);
				const ejBy = (foods[idx].ejBy ?? []).filter((x) => x !== u.uid);
				if (type === 'ok') okBy.push(u.uid);
				else ejBy.push(u.uid);
				const opdateret: Fodevare = {
					...foods[idx],
					okBy,
					ejBy,
					verificeret: okBy.length >= 3
				};
				foods = [...foods.slice(0, idx), opdateret, ...foods.slice(idx + 1)];
				foodMap = new Map(foods.map((f) => [f.id, f]));
			}
		} catch (err) {
			console.error(err);
		} finally {
			stemmer = null;
		}
	}

	function lukPicker() {
		viserPicker = false;
		erstatterIndex = null;
	}

	function toggleOpskriftKategori(k: OpskriftKategori) {
		if (valgteOpskriftKategorier.includes(k)) {
			valgteOpskriftKategorier = valgteOpskriftKategorier.filter((x) => x !== k);
		} else {
			valgteOpskriftKategorier = [...valgteOpskriftKategorier, k];
		}
	}

	function toggleDietTag(t: DietTag) {
		if (valgteDietTags.includes(t)) {
			valgteDietTags = valgteDietTags.filter((x) => x !== t);
		} else {
			valgteDietTags = [...valgteDietTags, t];
		}
	}

	// Dagbog
	async function indlaesDagbog() {
		const u = user;
		if (!u) return;
		dagbogIndlaeser = true;
		dagbogFejl = null;
		try {
			const m = await hentMaaltiderForDato(u.uid, dagbogDato);
			m.sort((a, b) => maaltidstypeOrder(a.type) - maaltidstypeOrder(b.type));
			dagbogMaaltider = m;
		} catch (e) {
			console.error(e);
			dagbogFejl = 'Kunne ikke hente dagbogen.';
		} finally {
			dagbogIndlaeser = false;
		}
	}

	async function aendreDagbogDato(ny: string) {
		dagbogDato = ny;
		await indlaesDagbog();
	}

	async function sletGemtMaaltid(id: string) {
		const u = user;
		if (!u) return;
		try {
			await sletMaaltid(u.uid, id);
			dagbogMaaltider = dagbogMaaltider.filter((m) => m.id !== id);
			// Hvis brugeren er ved at redigere det måltid der nu slettes,
			// så annullér rediger-tilstanden
			if (redigererMaaltid?.id === id) {
				maaltid = [];
				localStorage.setItem(STORAGE_KEY, '[]');
				redigererMaaltid = null;
			}
		} catch (e) {
			console.error(e);
			dagbogFejl = 'Kunne ikke slette måltidet.';
		}
	}

	function startRedigerMaaltid(m: GemtMaaltid) {
		if (maaltid.length > 0 && redigererMaaltid?.id !== m.id) {
			const ok = confirm(
				'Du har et måltid i gang. Det erstattes af måltidet du vil redigere.'
			);
			if (!ok) return;
		}
		maaltid = m.items.map((i) => ({ ...i }));
		redigererMaaltid = { id: m.id, navn: m.navn, type: m.type, dato: m.dato };
		// Annullér samtidig favorit-redigering hvis aktiv
		redigererFavorit = null;
		redigerBesked = null;
		skiftTab('maaltid');
	}

	function annullerRedigerMaaltid() {
		const ok = confirm('Kassér ændringer? Måltidet i dagbogen forbliver uændret.');
		if (!ok) return;
		maaltid = [];
		localStorage.setItem(STORAGE_KEY, '[]');
		redigererMaaltid = null;
	}

	// Gem-modal
	function aabnGemModal() {
		if (redigererMaaltid) {
			gemNavn = redigererMaaltid.navn;
			gemType = redigererMaaltid.type;
			gemDato = redigererMaaltid.dato;
			gemSomFavorit = false;
		} else {
			gemNavn = '';
			gemType = gaetMaaltidstype();
			gemDato = formatDatoKey();
			gemSomFavorit = false;
		}
		gemBesked = null;
		viserGemModal = true;
	}

	function lukGemModal() {
		viserGemModal = false;
		gemBesked = null;
	}

	async function gemMaaltidet() {
		const u = user;
		if (!u) {
			gemBesked = { tekst: 'Du skal være logget ind.', type: 'fejl' };
			return;
		}
		const navn = gemNavn.trim();
		if (!navn) {
			gemBesked = { tekst: 'Måltidet skal have et navn.', type: 'fejl' };
			return;
		}
		if (maaltid.length === 0) {
			gemBesked = { tekst: 'Måltidet er tomt — tilføj noget først.', type: 'fejl' };
			return;
		}
		gemmer = true;
		gemBesked = null;
		try {
			const data = {
				navn,
				type: gemType,
				dato: gemDato,
				items: maaltid,
				totalP: Math.round(totaler.protein * 10) / 10,
				totalF: Math.round(totaler.fiber * 10) / 10
			};
			if (redigererMaaltid) {
				await opdaterMaaltid(u.uid, redigererMaaltid.id, data);
				redigererMaaltid = null;
			} else {
				await gemMaaltid(u.uid, data);
				if (gemSomFavorit) {
					try {
						await gemFavorit(u.uid, { navn, items: maaltid });
						await indlaesFavoritter();
					} catch (e) {
						console.warn('Kunne ikke gemme som favorit:', e);
					}
				}
			}
			// Ryd måltid efter gem
			maaltid = [];
			localStorage.setItem(STORAGE_KEY, '[]');
			viserGemModal = false;
			// Skift til dagbog og indlæs
			dagbogDato = gemDato;
			await indlaesDagbog();
			skiftTab('dagbog');
		} catch (e) {
			console.error(e);
			gemBesked = { tekst: 'Kunne ikke gemme måltidet. Prøv igen.', type: 'fejl' };
		} finally {
			gemmer = false;
		}
	}

	function dagbogTotaler() {
		let p = 0;
		let f = 0;
		for (const m of dagbogMaaltider) {
			p += m.totalP;
			f += m.totalF;
		}
		return { protein: p, fiber: f };
	}

	function visningsDato(key: string): string {
		const i_dag = formatDatoKey();
		if (key === i_dag) return 'I dag';
		const i_gar = formatDatoKey(new Date(Date.now() - 86400000));
		if (key === i_gar) return 'I går';
		const d = new Date(key + 'T12:00:00');
		return d.toLocaleDateString('da-DK', { day: 'numeric', month: 'long' });
	}
</script>

<div class="page">
	<header class="page-header">
		<a class="back" href="/app/moduler">
			<Icon name="arrow-l" size={14} color="var(--text2)" />
			<span>Moduler</span>
		</a>
		<div class="eyebrow">Kost</div>
		<h1>30-30 beregner</h1>
	</header>

	{#if loading}
		<Loading tekst="Henter data..." />
	{:else if fejl}
		<div class="status-besked fejl">{fejl}</div>
	{:else}
		<div class="tabs">
			<button
				class="tab-knap"
				class:aktiv={aktivTab === 'opslag'}
				type="button"
				onclick={() => skiftTab('opslag')}
			>
				Slå op
			</button>
			<button
				class="tab-knap"
				class:aktiv={aktivTab === 'maaltid'}
				type="button"
				onclick={() => skiftTab('maaltid')}
			>
				Byg måltid {maaltid.length > 0 ? `(${maaltid.length})` : ''}
			</button>
			<button
				class="tab-knap"
				class:aktiv={aktivTab === 'opskrifter'}
				type="button"
				onclick={() => skiftTab('opskrifter')}
			>
				Opskrifter
			</button>
			<button
				class="tab-knap"
				class:aktiv={aktivTab === 'dagbog'}
				type="button"
				onclick={() => skiftTab('dagbog')}
			>
				Dagbog
			</button>
		</div>

		{#if aktivTab === 'opslag'}
			<input
				type="search"
				class="search"
				placeholder="Søg fødevare (fx skyr, havregryn, kylling)..."
				bind:value={soegeord}
			/>

			<div class="sort-rad">
				<span class="sort-label">Sortér:</span>
				<button
					type="button"
					class="sort-knap"
					class:aktiv={sortMode === 'alpha'}
					onclick={() => (sortMode = 'alpha')}>Alfabetisk</button
				>
				<button
					type="button"
					class="sort-knap"
					class:aktiv={sortMode === 'protein'}
					onclick={() => (sortMode = 'protein')}>Mest protein</button
				>
				<button
					type="button"
					class="sort-knap"
					class:aktiv={sortMode === 'fiber'}
					onclick={() => (sortMode = 'fiber')}>Mest fiber</button
				>
			</div>

			<div class="chips">
				{#each aktiveKategorier as cat (cat)}
					<button
						type="button"
						class="chip"
						class:aktiv={aktivKategori === cat}
						onclick={() => (aktivKategori = cat)}
					>
						{cat === 'all' ? 'Alle' : FODEVARE_KATEGORIER[cat]}
					</button>
				{/each}
			</div>

			<div class="liste">
				{#if filtreret.length === 0}
					<div class="status-besked">Ingen fødevarer matcher.</div>
				{:else}
					{#each filtreret as food (food.id)}
						<div class="food-row">
							<div class="food-tekst">
								<div class="food-navn">{food.name}</div>
								<div class="food-meta">
									{food.p}g protein · {food.f}g fiber pr 100g
								</div>
							</div>
							<button
								class="tilfoej-knap"
								type="button"
								onclick={() => tilfoejTilMaaltid(food)}
								aria-label="Tilføj til måltid"
							>
								+
							</button>
						</div>
					{/each}
				{/if}
			</div>
		{:else if aktivTab === 'maaltid'}
			{#if redigererFavorit}
				<div class="rediger-banner">
					<div class="rediger-banner-tekst">
						<div class="rediger-banner-lbl">Redigerer favorit</div>
						<input
							class="rediger-navn-input"
							type="text"
							bind:value={redigerNavn}
							disabled={opdaterer}
						/>
					</div>
					<button
						class="rediger-banner-luk"
						type="button"
						onclick={annullerRediger}
						disabled={opdaterer}
						aria-label="Annullér"
					>
						×
					</button>
				</div>
			{:else if redigererMaaltid}
				<div class="rediger-banner">
					<div class="rediger-banner-tekst">
						<div class="rediger-banner-lbl">Redigerer måltid i dagbog</div>
						<div class="rediger-navn-static">{redigererMaaltid.navn}</div>
					</div>
					<button
						class="rediger-banner-luk"
						type="button"
						onclick={annullerRedigerMaaltid}
						aria-label="Annullér"
					>
						×
					</button>
				</div>
			{/if}

			{#if favoritter.length > 0 && !redigererFavorit}
				<div class="favorit-sektion">
					<div class="favorit-overskrift">Mine favoritter</div>
					<div class="favorit-rad">
						{#each favoritter as f (f.id)}
							<div class="favorit-kort">
								<button
									class="favorit-knap"
									type="button"
									onclick={() => indlaesFavoritIMaaltid(f)}
								>
									<span class="favorit-navn">{f.navn}</span>
									<span class="favorit-antal">{f.items.length} ingredienser</span>
								</button>
								<div class="favorit-handlinger">
									<button
										class="favorit-mini"
										type="button"
										onclick={() => startRedigerFavorit(f)}
										aria-label="Rediger favorit"
										title="Rediger"
									>
										✎
									</button>
									<button
										class="favorit-mini"
										type="button"
										onclick={() => sletFavoritKlik(f.id, f.navn)}
										aria-label="Slet favorit"
										title="Slet"
									>
										×
									</button>
								</div>
							</div>
						{/each}
					</div>
				</div>
			{/if}

			<div class="totaler">
				<div class="total-card protein">
					<div class="total-head">
						<span class="total-label">Protein</span>
						<span class="total-mål">mål {PROTEIN_MAALTIDS_MAAL}g</span>
					</div>
					<div class="total-val">{formatGram(totaler.protein)}</div>
					<div class="total-bar">
						<div class="total-fill protein-fill" style="width: {proteinPct}%"></div>
					</div>
				</div>
				<div class="total-card fiber">
					<div class="total-head">
						<span class="total-label">Fibre</span>
						<span class="total-mål">dagsmål {FIBER_DAGS_MAAL}g</span>
					</div>
					<div class="total-val">{formatGram(totaler.fiber)}</div>
					<div class="total-bar">
						<div class="total-fill fiber-fill" style="width: {fiberPct}%"></div>
					</div>
				</div>
			</div>

			<div class="maaltid-liste">
				{#if maaltid.length === 0}
					<div class="status-besked">
						Tryk på + for at tilføje din første fødevare.
					</div>
				{:else}
					{#each maaltid as item, i (i)}
						{@const food = foodMap.get(item.foodId)}
						{@const manuel = erManueltItem(item)}
						{@const beregnet = beregnItem(item, food)}
						<div class="item-row" class:manuel>
							{#if manuel}
								<div class="item-tekst">
									<div class="item-navn">
										{item.manuel?.navn ?? '(uden navn)'}
										<span class="manuel-badge">Manuel</span>
									</div>
									<div class="item-meta">
										{item.portion > 0 ? `${item.portion} ${item.manuel?.enhed ?? ''}` : 'efter smag'}
										· ingen protein/fiber-beregning
									</div>
								</div>
								<button
									class="erstat-knap"
									type="button"
									onclick={() => aabnErstat(i)}
								>
									Find
								</button>
								<button
									class="ikon-knap"
									type="button"
									onclick={() => fjernItem(i)}
									aria-label="Fjern ingrediens"
								>
									×
								</button>
							{:else}
								<div class="item-tekst">
									<div class="item-navn">{food?.name ?? item.foodId}</div>
									<div class="item-meta">
										{formatGram(beregnet.protein)} protein · {formatGram(beregnet.fiber)} fiber
									</div>
								</div>
								<input
									class="portion-input"
									type="number"
									min="0"
									step="0.5"
									value={item.portion}
									oninput={(e) =>
										opdaterPortion(i, (e.target as HTMLInputElement).value)}
								/>
								{#if food?.units && food.units.length > 0}
									<select
										class="enhed-select"
										value={item.enhedId ?? 'g'}
										onchange={(e) =>
											opdaterEnhed(i, (e.target as HTMLSelectElement).value)}
									>
										<option value="g">g</option>
										{#each food.units as u (u.u)}
											<option value={u.u}>{u.label}</option>
										{/each}
									</select>
								{:else}
									<span class="enhed-static">g</span>
								{/if}
								<button
									class="ikon-knap"
									type="button"
									onclick={() => fjernItem(i)}
									aria-label="Fjern fødevare"
								>
									×
								</button>
							{/if}
						</div>
					{/each}
				{/if}
			</div>

			<button class="primary-knap" type="button" onclick={aabnPicker}>
				+ Tilføj fødevare
			</button>

			{#if redigererFavorit}
				{#if redigerBesked}
					<div class="gem-besked {redigerBesked.type}">{redigerBesked.tekst}</div>
				{/if}
				<button
					class="primary-knap sage"
					type="button"
					onclick={gemRedigeretFavorit}
					disabled={opdaterer}
				>
					{opdaterer ? 'Opdaterer...' : 'Gem ændringer i favorit'}
				</button>
				<button class="ghost-knap" type="button" onclick={annullerRediger} disabled={opdaterer}>
					Annullér redigering
				</button>
			{:else if maaltid.length > 0}
				<button class="primary-knap sage" type="button" onclick={aabnGemModal}>
					Gem måltidet i dagbog
				</button>
				<button class="ghost-knap" type="button" onclick={nulstilMaaltid}>Nulstil måltid</button>
			{/if}
		{:else if aktivTab === 'opskrifter'}
			<div class="hint-boks">
				<span class="hint-ikon">+</span>
				<span class="hint-tekst">
					Klik på <strong>+</strong> på en opskrift for at samle ingredienserne i én indkøbsliste.
					Vælg flere på tværs af kategorier og få listen som tekst eller PDF.
				</span>
			</div>

			<input
				type="search"
				class="search"
				placeholder="Søg opskrift..."
				bind:value={opskriftSoeg}
			/>

			<div class="chips">
				{#each OPSKRIFT_KATEGORIER as k (k)}
					<button
						type="button"
						class="chip"
						class:aktiv={valgteOpskriftKategorier.includes(k)}
						onclick={() => toggleOpskriftKategori(k)}
					>
						{OPSKRIFT_LABELS[k]}
					</button>
				{/each}
			</div>

			<div class="chips diet-chips">
				{#each ALLE_DIET_TAGS as t (t)}
					<button
						type="button"
						class="chip diet"
						class:aktiv={valgteDietTags.includes(t)}
						onclick={() => toggleDietTag(t)}
					>
						{DIET_LABELS[t]}
					</button>
				{/each}
			</div>

			{#if opskrifter.length === 0}
				<div class="status-besked">
					Linn er ved at lægge opskrifter ind. Kig forbi senere.
				</div>
			{:else if filtreredeOpskrifter.length === 0}
				<div class="status-besked">Ingen opskrifter matcher dine filtre.</div>
			{:else}
				<div class="opskrift-grid">
					{#each filtreredeOpskrifter as o (o.id)}
						{@const erValgt = valgteOpskrifter.has(o.id)}
						{@const portioner = valgteOpskrifter.get(o.id) ?? o.defaultPortioner}
						<a class="opskrift-kort" class:valgt={erValgt} href="/app/moduler/30-30-3/opskrifter/{o.id}">
							<div class="opskrift-billede">
								{#if o.billedeUrl}
									<img src={o.billedeUrl} alt={o.titel} />
								{:else}
									<div class="opskrift-emoji">🍽️</div>
								{/if}
								<button
									type="button"
									class="vaelg-knap"
									class:on={erValgt}
									aria-label={erValgt ? 'Fjern fra indkøbsliste' : 'Vælg til indkøbsliste'}
									onclick={(e) => toggleValgtOpskrift(o, e)}
								>
									{erValgt ? '✓' : '+'}
								</button>
							</div>
							<div class="opskrift-tekst">
								<div class="opskrift-titel">{o.titel}</div>
								{#if o.kategorier.length > 0}
									<div class="opskrift-kategorier">
										{#each o.kategorier as k (k)}
											<span class="opskrift-cat">{OPSKRIFT_LABELS[k]}</span>
										{/each}
									</div>
								{/if}
								{#if erValgt}
									<div class="portioner-rad">
										<button
											type="button"
											class="portioner-knap"
											aria-label="Færre portioner"
											onclick={(e) => aendrePortioner(o.id, -1, e)}>−</button
										>
										<span class="portioner-val">{portioner} pers.</span>
										<button
											type="button"
											class="portioner-knap"
											aria-label="Flere portioner"
											onclick={(e) => aendrePortioner(o.id, 1, e)}>+</button
										>
									</div>
								{/if}
							</div>
						</a>
					{/each}
				</div>

				{#if valgteAntal > 0}
					<div class="indkoeb-bar">
						<button type="button" class="indkoeb-knap" onclick={aabnIndkoebsliste}>
							Generer indkøbsliste
							<span class="indkoeb-badge">{valgteAntal}</span>
						</button>
						<button
							type="button"
							class="nulstil-knap"
							onclick={nulstilValgteOpskrifter}
							aria-label="Nulstil valg">×</button
						>
					</div>
				{/if}
			{/if}
		{:else}
			<div class="dagbog-rad">
				<button
					class="dato-knap"
					type="button"
					onclick={() => {
						const d = new Date(dagbogDato + 'T12:00:00');
						d.setDate(d.getDate() - 1);
						void aendreDagbogDato(formatDatoKey(d));
					}}
					aria-label="Forrige dag"
				>
					‹
				</button>
				<input
					class="dato-input"
					type="date"
					value={dagbogDato}
					onchange={(e) =>
						void aendreDagbogDato((e.target as HTMLInputElement).value)}
				/>
				<button
					class="dato-knap"
					type="button"
					onclick={() => {
						const d = new Date(dagbogDato + 'T12:00:00');
						d.setDate(d.getDate() + 1);
						void aendreDagbogDato(formatDatoKey(d));
					}}
					aria-label="Næste dag"
				>
					›
				</button>
			</div>
			<div class="dato-label">{visningsDato(dagbogDato)}</div>

			{#if dagbogIndlaeser}
				<Loading tekst="Henter dagbog..." kompakt />
			{:else if dagbogFejl}
				<div class="status-besked fejl">{dagbogFejl}</div>
			{:else if dagbogMaaltider.length === 0}
				<div class="status-besked">
					Ingen måltider gemt for denne dag. Byg et måltid og tryk Gem.
				</div>
			{:else}
				{@const dagsTotaler = dagbogTotaler()}
				<div class="totaler">
					<div class="total-card">
						<div class="total-head">
							<span class="total-label">Protein i dag</span>
						</div>
						<div class="total-val">{formatGram(dagsTotaler.protein)}</div>
					</div>
					<div class="total-card">
						<div class="total-head">
							<span class="total-label">Fibre i dag</span>
							<span class="total-mål">mål {FIBER_DAGS_MAAL}g</span>
						</div>
						<div class="total-val">{formatGram(dagsTotaler.fiber)}</div>
						<div class="total-bar">
							<div
								class="total-fill fiber-fill"
								style="width: {procentMod(FIBER_DAGS_MAAL, dagsTotaler.fiber)}%"
							></div>
						</div>
					</div>
				</div>

				<div class="dagbog-liste">
					{#each MAALTIDSTYPER as type (type)}
						{@const dette = dagbogMaaltider.filter((m) => m.type === type)}
						{#if dette.length > 0}
							<div class="type-gruppe">
								<div class="type-overskrift">{MAALTIDSTYPE_LABELS[type]}</div>
								{#each dette as m (m.id)}
									<div class="dagbog-kort">
										<div class="dagbog-kort-head">
											<div class="dagbog-navn">{m.navn}</div>
											<div class="dagbog-handlinger">
												<button
													class="ikon-knap"
													type="button"
													onclick={() => startRedigerMaaltid(m)}
													aria-label="Rediger måltid"
												>
													✎
												</button>
												<button
													class="ikon-knap"
													type="button"
													onclick={() => sletGemtMaaltid(m.id)}
													aria-label="Slet måltid"
												>
													×
												</button>
											</div>
										</div>
										<div class="dagbog-totaler">
											<span>{formatGram(m.totalP)} protein</span>
											<span>·</span>
											<span>{formatGram(m.totalF)} fiber</span>
											<span>·</span>
											<span>{m.items.length} ingredienser</span>
										</div>
									</div>
								{/each}
							</div>
						{/if}
					{/each}
				</div>
			{/if}
		{/if}
	{/if}

	{#if viserGemModal}
		<div
			class="modal-bag"
			role="dialog"
			aria-modal="true"
			use:portalToBody
			onclick={(e) => {
				if (e.target === e.currentTarget) lukGemModal();
			}}
			onkeydown={(e) => {
				if (e.key === 'Escape') lukGemModal();
			}}
			tabindex="-1"
		>
			<div class="modal">
				<div class="modal-head">
					<div class="modal-titel">
						{redigererMaaltid ? 'Rediger måltid' : 'Gem måltid i dagbog'}
					</div>
					<button class="modal-luk" type="button" onclick={lukGemModal} aria-label="Luk">
						×
					</button>
				</div>

				<div class="modal-body">
					<label class="felt">
						<span class="felt-label">Navn</span>
						<input
							type="text"
							class="felt-input"
							placeholder="fx Morgenmad med skyr og bær"
							bind:value={gemNavn}
							disabled={gemmer}
						/>
					</label>

					<div class="felt">
						<span class="felt-label">Måltidstype</span>
						<div class="type-rad">
							{#each MAALTIDSTYPER as t (t)}
								<button
									type="button"
									class="type-chip"
									class:aktiv={gemType === t}
									onclick={() => (gemType = t)}
									disabled={gemmer}
								>
									{MAALTIDSTYPE_LABELS[t]}
								</button>
							{/each}
						</div>
					</div>

					<label class="felt">
						<span class="felt-label">Dato</span>
						<input
							type="date"
							class="felt-input"
							bind:value={gemDato}
							disabled={gemmer}
						/>
					</label>

					{#if !redigererMaaltid}
						<label class="favorit-toggle" class:on={gemSomFavorit}>
							<input type="checkbox" bind:checked={gemSomFavorit} disabled={gemmer} />
							<div class="favorit-toggle-tekst">
								<div class="favorit-toggle-lbl">Gem også som favorit</div>
								<div class="favorit-toggle-sub">
									Genbrug måltidet hurtigt næste gang under Byg måltid
								</div>
							</div>
						</label>
					{/if}

					{#if gemBesked}
						<div class="gem-besked {gemBesked.type}">{gemBesked.tekst}</div>
					{/if}
				</div>

				<div class="modal-footer">
					<button class="primary-knap" type="button" onclick={gemMaaltidet} disabled={gemmer}>
						{#if gemmer}
							{redigererMaaltid ? 'Opdaterer...' : 'Gemmer...'}
						{:else}
							{redigererMaaltid ? 'Opdater' : 'Gem'}
						{/if}
					</button>
				</div>
			</div>
		</div>
	{/if}

	{#if viserPicker}
		<div
			class="modal-bag"
			role="dialog"
			aria-modal="true"
			use:portalToBody
			onclick={(e) => {
				if (e.target === e.currentTarget) lukPicker();
			}}
			onkeydown={(e) => {
				if (e.key === 'Escape') lukPicker();
			}}
			tabindex="-1"
		>
			<div class="modal">
				<div class="modal-head">
					<div class="modal-titel">
						{erstatterIndex !== null ? 'Erstat med fødevare' : 'Vælg fødevare'}
					</div>
					<div class="modal-head-knapper">
						<button
							class="head-ikon"
							type="button"
							onclick={aabnScanner}
							disabled={scannerArbejder}
							aria-label="Scan stregkode"
							title="Scan stregkode"
						>
							<Icon name="search" size={16} color="var(--terra)" />
						</button>
						<button
							class="head-ikon"
							type="button"
							onclick={aabnTilfoejManuel}
							aria-label="Tilføj manuelt"
							title="Tilføj manuelt"
						>
							<Icon name="plus" size={16} color="var(--terra)" />
						</button>
						<button class="modal-luk" type="button" onclick={lukPicker} aria-label="Luk">
							×
						</button>
					</div>
				</div>
				<input type="search" class="search" placeholder="Søg..." bind:value={pickerSoeg} />
				<div class="chips">
					{#each aktiveKategorier as cat (cat)}
						<button
							type="button"
							class="chip"
							class:aktiv={pickerKategori === cat}
							onclick={() => (pickerKategori = cat)}
						>
							{cat === 'all' ? 'Alle' : FODEVARE_KATEGORIER[cat]}
						</button>
					{/each}
				</div>
				<div class="picker-liste">
					{#each filtretetPicker as food (food.id)}
						{@const erCommunity = food.kilde === 'community'}
						{@const okAntal = food.okBy?.length ?? 0}
						{@const ejAntal = food.ejBy?.length ?? 0}
						{@const minStem = user && food.okBy?.includes(user.uid) ? 'ok' : user && food.ejBy?.includes(user.uid) ? 'ej' : null}
						<div class="picker-row-wrap">
							<button
								class="picker-row"
								type="button"
								onclick={() => tilfoejTilMaaltid(food)}
							>
								<div class="picker-tekst">
									<div class="food-navn">
										{food.name}
										{#if erCommunity && food.verificeret}
											<span class="badge badge-verificeret" title="Verificeret af fællesskabet">✓</span>
										{:else if erCommunity && ejAntal > okAntal}
											<span class="badge badge-mistaenkelig" title="Flere har stemt 'ej' end 'ok'">⚠</span>
										{:else if erCommunity}
											<span class="badge badge-ny" title="Tilføjet af bruger">Ny</span>
										{/if}
									</div>
									<div class="food-meta">
										{food.p}g protein · {food.f}g fiber pr 100g
										{#if erCommunity && food.addedByName}
											<span class="meta-by"> · af {food.addedByName}</span>
										{/if}
									</div>
								</div>
								<span class="picker-plus">+</span>
							</button>
							{#if erCommunity && user && food.addedBy !== user.uid}
								<div class="stem-rad">
									<button
										type="button"
										class="stem-knap"
										class:aktiv={minStem === 'ok'}
										disabled={stemmer === food.id}
										onclick={(e) => stemFodevare(food, 'ok', e)}
										aria-label="Bekræft fødevare"
									>
										✓ {okAntal}
									</button>
									<button
										type="button"
										class="stem-knap stem-ej"
										class:aktiv={minStem === 'ej'}
										disabled={stemmer === food.id}
										onclick={(e) => stemFodevare(food, 'ej', e)}
										aria-label="Marker som dårlig kvalitet"
									>
										✗ {ejAntal}
									</button>
								</div>
							{/if}
						</div>
					{/each}
				</div>
			</div>
		</div>
	{/if}
</div>

{#if viserIndkoebsliste}
	<IndkoebsListeOverlay
		items={indkoebslisteItems}
		valgte={valgteOpskrifter}
		{opskrifter}
		onClose={lukIndkoebsliste}
		onItemsChange={opdaterItems}
	/>
{/if}

{#if viserScanner}
	<BarcodeScanner
		onDetected={efterScan}
		onClose={() => (viserScanner = false)}
	/>
{/if}

{#if nyDialog && user}
	<TilfoejFodevareDialog
		barcode={nyDialog.barcode}
		startNavn={nyDialog.startNavn}
		startProtein={nyDialog.startProtein}
		startFiber={nyDialog.startFiber}
		startKat={nyDialog.startKat}
		uid={user.uid}
		uidNavn={userDoc?.firstName ?? 'En bruger'}
		onTilfoejet={efterTilfoejet}
		onClose={() => (nyDialog = null)}
	/>
{/if}

<style>
	.page {
		padding: 18px 18px 100px;
		max-width: 520px;
		margin: 0 auto;
	}

	.page-header {
		margin-bottom: 14px;
	}

	.back {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-size: 12px;
		color: var(--text2);
		text-decoration: none;
		margin-bottom: 12px;
	}

	.eyebrow {
		font-size: 10px;
		font-weight: 600;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--text3);
	}

	h1 {
		font-family: var(--ff-d);
		font-size: 30px;
		font-weight: 600;
		letter-spacing: -0.02em;
		margin: 4px 0 0;
		line-height: 1.05;
		color: var(--text);
	}

	.status-besked {
		padding: 14px 16px;
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 12px;
		color: var(--text2);
		font-size: 13px;
		text-align: center;
	}

	.status-besked.fejl {
		color: #8a4a3e;
		background: #fbeeea;
		border-color: #f0d6cf;
	}

	.tabs {
		display: grid;
		grid-template-columns: 1fr 1fr 1fr 1fr;
		background: var(--bg2);
		padding: 4px;
		border-radius: 12px;
		margin-bottom: 14px;
		gap: 4px;
	}

	.tab-knap {
		padding: 10px 6px;
		font-size: 12.5px;
		font-weight: 600;
		border-radius: 8px;
		border: none;
		background: transparent;
		color: var(--text2);
		cursor: pointer;
		font-family: var(--ff-b);
	}

	.tab-knap.aktiv {
		background: var(--white);
		color: var(--terra);
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
	}

	.search {
		width: 100%;
		padding: 11px 14px;
		font-size: 16px;
		border-radius: 10px;
		border: 1px solid var(--border);
		background: var(--bg2);
		color: var(--text);
		font-family: var(--ff-b);
		outline: none;
		margin-bottom: 10px;
	}

	.search:focus {
		border-color: var(--terra);
	}

	.sort-rad {
		display: flex;
		align-items: center;
		gap: 6px;
		flex-wrap: wrap;
		margin-bottom: 10px;
	}

	.sort-label {
		font-size: 11.5px;
		color: var(--text3);
		margin-right: 4px;
	}

	.sort-knap,
	.chip {
		padding: 6px 12px;
		font-size: 12px;
		border-radius: 99px;
		border: 1px solid var(--border);
		background: var(--white);
		color: var(--text2);
		cursor: pointer;
		font-family: var(--ff-b);
	}

	.sort-knap.aktiv,
	.chip.aktiv {
		background: var(--terra);
		color: #fff;
		border-color: var(--terra);
	}

	.chips {
		display: flex;
		gap: 6px;
		flex-wrap: wrap;
		margin-bottom: 12px;
	}

	.diet-chips {
		margin-top: -6px;
		margin-bottom: 12px;
	}

	.chip.diet.aktiv {
		background: var(--sage);
		border-color: var(--sage);
	}

	.liste {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.food-row {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 10px 12px;
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 10px;
	}

	.food-tekst {
		flex: 1;
		min-width: 0;
	}

	.food-navn {
		font-size: 13.5px;
		font-weight: 500;
		color: var(--text);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.food-meta {
		font-size: 11px;
		color: var(--text3);
		margin-top: 2px;
	}

	.tilfoej-knap {
		width: 32px;
		height: 32px;
		border-radius: 50%;
		background: var(--terra);
		color: #fff;
		font-size: 18px;
		border: none;
		cursor: pointer;
		font-family: var(--ff-b);
		flex-shrink: 0;
	}

	.tilfoej-knap:hover {
		filter: brightness(0.95);
	}

	.totaler {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 10px;
		margin-bottom: 14px;
	}

	.total-card {
		padding: 14px;
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 14px;
	}

	.total-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 6px;
	}

	.total-label {
		font-size: 11px;
		font-weight: 600;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--text2);
	}

	.total-mål {
		font-size: 10.5px;
		color: var(--text3);
	}

	.total-val {
		font-family: var(--ff-d);
		font-size: 26px;
		font-weight: 600;
		color: var(--text);
		margin-bottom: 6px;
	}

	.total-bar {
		height: 5px;
		background: var(--bg2);
		border-radius: 3px;
		overflow: hidden;
	}

	.total-fill {
		height: 100%;
		transition: width 0.3s ease;
	}

	.protein-fill {
		background: var(--terra);
	}

	.fiber-fill {
		background: var(--sage);
	}

	.maaltid-liste {
		display: flex;
		flex-direction: column;
		gap: 6px;
		margin-bottom: 12px;
	}

	.item-row {
		display: grid;
		grid-template-columns: 1fr 60px 60px 32px;
		gap: 6px;
		align-items: center;
		padding: 8px 10px;
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 10px;
	}

	.item-row.manuel {
		grid-template-columns: 1fr auto 32px;
		background: #fdf3e7;
		border-color: #ecd9b8;
	}

	.manuel-badge {
		font-size: 9px;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		background: #ecd9b8;
		color: #8a6a3c;
		padding: 2px 7px;
		border-radius: 99px;
		margin-left: 6px;
		font-weight: 600;
		vertical-align: middle;
	}

	.erstat-knap {
		padding: 6px 12px;
		font-size: 12px;
		font-weight: 600;
		border-radius: 8px;
		border: 1px solid var(--terra);
		background: var(--white);
		color: var(--terra);
		cursor: pointer;
		font-family: var(--ff-b);
	}

	.erstat-knap:hover {
		background: var(--terra);
		color: #fff;
	}

	.item-tekst {
		min-width: 0;
		overflow: hidden;
	}

	.item-navn {
		font-size: 13px;
		font-weight: 500;
		color: var(--text);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.item-meta {
		font-size: 10.5px;
		color: var(--text3);
		margin-top: 2px;
	}

	.portion-input,
	.enhed-select {
		padding: 7px 8px;
		font-size: 12.5px;
		border-radius: 8px;
		border: 1px solid var(--border);
		background: var(--bg2);
		color: var(--text);
		font-family: var(--ff-b);
		outline: none;
	}

	.enhed-static {
		font-size: 12px;
		color: var(--text3);
		text-align: center;
	}

	.ikon-knap {
		width: 28px;
		height: 28px;
		border-radius: 6px;
		background: var(--bg2);
		border: 1px solid var(--border);
		color: var(--text3);
		font-size: 16px;
		cursor: pointer;
		font-family: var(--ff-b);
	}

	.ikon-knap:hover {
		background: #fbeeea;
		color: #8a4a3e;
	}

	.primary-knap {
		display: block;
		width: 100%;
		padding: 13px;
		background: var(--terra);
		color: #fff;
		font-size: 14px;
		font-weight: 600;
		border-radius: 10px;
		border: none;
		cursor: pointer;
		font-family: var(--ff-b);
	}

	.primary-knap.sage {
		background: var(--sage);
		margin-top: 8px;
	}

	.primary-knap:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.ghost-knap {
		display: block;
		width: 100%;
		padding: 10px;
		background: transparent;
		color: var(--text3);
		font-size: 13px;
		border: none;
		cursor: pointer;
		margin-top: 8px;
		font-family: var(--ff-b);
	}

	.opskrift-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 10px;
	}

	.hint-boks {
		display: flex;
		align-items: flex-start;
		gap: 10px;
		padding: 10px 14px;
		background: var(--tdim);
		border: 1px solid var(--tdim2, var(--border));
		border-radius: 12px;
		margin-bottom: 10px;
		font-size: 12px;
		line-height: 1.45;
		color: var(--terra);
	}

	.hint-ikon {
		flex-shrink: 0;
		width: 22px;
		height: 22px;
		border-radius: 50%;
		background: var(--terra);
		color: var(--white);
		font-weight: 700;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 14px;
		line-height: 1;
	}

	.hint-tekst {
		flex: 1;
	}

	.hint-tekst strong {
		font-weight: 700;
	}

	.opskrift-kort {
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 14px;
		overflow: hidden;
		text-decoration: none;
		color: inherit;
		display: flex;
		flex-direction: column;
	}

	.opskrift-kort:hover {
		border-color: var(--terra);
	}

	.opskrift-kort.valgt {
		border-color: var(--terra);
		box-shadow: 0 0 0 1px var(--terra);
	}

	.opskrift-billede {
		aspect-ratio: 4 / 3;
		background: var(--bg2);
		display: flex;
		align-items: center;
		justify-content: center;
		overflow: hidden;
		position: relative;
	}

	.vaelg-knap {
		position: absolute;
		top: 8px;
		right: 8px;
		width: 28px;
		height: 28px;
		border-radius: 50%;
		background: rgba(255, 255, 255, 0.9);
		border: 1.5px solid var(--terra);
		color: var(--terra);
		font-size: 16px;
		font-weight: 700;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		line-height: 1;
		backdrop-filter: blur(4px);
	}

	.vaelg-knap.on {
		background: var(--terra);
		color: var(--white);
	}

	.portioner-rad {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-top: 4px;
	}

	.portioner-knap {
		width: 24px;
		height: 24px;
		border-radius: 50%;
		border: 1px solid var(--border);
		background: var(--white);
		color: var(--text2);
		font-size: 14px;
		font-weight: 700;
		cursor: pointer;
		line-height: 1;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.portioner-val {
		font-size: 11px;
		font-weight: 600;
		color: var(--terra);
	}

	.indkoeb-bar {
		position: sticky;
		bottom: 14px;
		margin-top: 14px;
		display: flex;
		gap: 8px;
		z-index: 10;
	}

	.indkoeb-knap {
		flex: 1;
		background: var(--terra);
		color: var(--white);
		border: none;
		padding: 14px 18px;
		border-radius: 99px;
		font-family: inherit;
		font-size: 14px;
		font-weight: 600;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		box-shadow: 0 4px 18px rgba(184, 123, 110, 0.35);
	}

	.indkoeb-badge {
		background: rgba(255, 255, 255, 0.25);
		border-radius: 99px;
		padding: 2px 9px;
		font-size: 11px;
		font-weight: 700;
	}

	.nulstil-knap {
		width: 44px;
		height: 44px;
		border-radius: 50%;
		background: var(--white);
		border: 1px solid var(--border);
		color: var(--text2);
		font-size: 22px;
		cursor: pointer;
		line-height: 1;
		flex-shrink: 0;
	}

	.opskrift-billede img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.opskrift-emoji {
		font-size: 38px;
		opacity: 0.4;
	}

	.opskrift-tekst {
		padding: 10px 12px;
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.opskrift-titel {
		font-size: 13.5px;
		font-weight: 600;
		color: var(--text);
		line-height: 1.3;
	}

	.opskrift-kategorier {
		display: flex;
		gap: 4px;
		flex-wrap: wrap;
	}

	.opskrift-cat {
		font-size: 9.5px;
		letter-spacing: 0.06em;
		color: var(--text3);
		background: var(--bg2);
		padding: 2px 7px;
		border-radius: 99px;
	}

	.modal-bag {
		position: fixed;
		inset: 0;
		background: rgba(42, 31, 23, 0.5);
		display: flex;
		align-items: flex-end;
		justify-content: center;
		z-index: 600;
	}

	.modal {
		background: var(--white);
		border-radius: 18px 18px 0 0;
		padding: 14px 18px 0;
		width: 100%;
		max-width: 520px;
		max-height: 92dvh;
		display: flex;
		flex-direction: column;
		gap: 10px;
		box-shadow: 0 -8px 24px rgba(0, 0, 0, 0.15);
		overflow: hidden;
	}

	.modal-body {
		display: flex;
		flex-direction: column;
		gap: 10px;
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		overscroll-behavior: contain;
		-webkit-overflow-scrolling: touch;
		padding-bottom: 4px;
	}

	.modal-footer {
		flex-shrink: 0;
		padding: 4px 0 calc(14px + env(safe-area-inset-bottom));
		background: var(--white);
		border-top: 1px solid var(--border);
	}

	.modal-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.modal-titel {
		font-family: var(--ff-d);
		font-size: 18px;
		font-weight: 600;
	}

	.modal-luk {
		width: 32px;
		height: 32px;
		border-radius: 50%;
		background: var(--bg2);
		border: none;
		color: var(--text2);
		font-size: 20px;
		cursor: pointer;
	}

	.picker-liste {
		display: flex;
		flex-direction: column;
		gap: 4px;
		overflow-y: auto;
		flex: 1;
	}

	.picker-row {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 10px 12px;
		background: var(--bg2);
		border: 1px solid var(--border);
		border-radius: 10px;
		cursor: pointer;
		text-align: left;
		font-family: var(--ff-b);
	}

	.picker-row:hover {
		background: var(--white);
		border-color: var(--terra);
	}

	.picker-tekst {
		flex: 1;
		min-width: 0;
	}

	.picker-plus {
		font-size: 18px;
		color: var(--terra);
		font-weight: 600;
	}

	.modal-head-knapper {
		display: flex;
		align-items: center;
		gap: 6px;
		flex-shrink: 0;
	}

	.head-ikon {
		width: 32px;
		height: 32px;
		border-radius: 50%;
		background: var(--tdim);
		border: 1px solid var(--tdim2);
		color: var(--terra);
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
	}

	.head-ikon:disabled {
		opacity: 0.6;
		cursor: wait;
	}

	.picker-row-wrap {
		display: flex;
		flex-direction: column;
		gap: 0;
	}

	.badge {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 18px;
		height: 18px;
		padding: 0 5px;
		font-size: 10px;
		font-weight: 700;
		border-radius: 99px;
		margin-left: 6px;
		vertical-align: middle;
	}

	.badge-verificeret {
		background: var(--sdim);
		color: var(--sage);
		border: 1px solid rgba(111, 158, 126, 0.35);
	}

	.badge-mistaenkelig {
		background: #fbeeea;
		color: #8a4a3e;
		border: 1px solid #f0d6cf;
	}

	.badge-ny {
		background: var(--tdim);
		color: var(--terra);
		border: 1px solid var(--tdim2);
		font-weight: 500;
		font-size: 9.5px;
		letter-spacing: 0.04em;
	}

	.meta-by {
		color: var(--text3);
		font-style: italic;
	}

	.stem-rad {
		display: flex;
		gap: 6px;
		padding: 4px 12px 8px;
		background: var(--bg2);
		border-left: 1px solid var(--border);
		border-right: 1px solid var(--border);
		border-bottom: 1px solid var(--border);
		border-radius: 0 0 10px 10px;
		margin-top: -2px;
	}

	.stem-knap {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 4px;
		padding: 4px 10px;
		font-size: 11px;
		font-weight: 600;
		font-family: var(--ff-b);
		border-radius: 99px;
		background: var(--white);
		color: var(--text2);
		border: 1px solid var(--border);
		cursor: pointer;
	}

	.stem-knap.aktiv {
		background: var(--sdim);
		color: var(--sage);
		border-color: rgba(111, 158, 126, 0.35);
	}

	.stem-knap.stem-ej.aktiv {
		background: #fbeeea;
		color: #8a4a3e;
		border-color: #f0d6cf;
	}

	.stem-knap:disabled {
		opacity: 0.5;
		cursor: wait;
	}

	.dagbog-rad {
		display: grid;
		grid-template-columns: 40px 1fr 40px;
		gap: 8px;
		align-items: center;
		margin-bottom: 4px;
	}

	.dato-knap {
		width: 40px;
		height: 40px;
		border-radius: 50%;
		background: var(--bg2);
		border: 1px solid var(--border);
		font-size: 18px;
		color: var(--text2);
		cursor: pointer;
		font-family: var(--ff-b);
	}

	.dato-knap:hover {
		background: var(--terra);
		color: #fff;
		border-color: var(--terra);
	}

	.dato-input {
		padding: 10px 12px;
		font-size: 16px;
		border-radius: 10px;
		border: 1px solid var(--border);
		background: var(--bg2);
		color: var(--text);
		font-family: var(--ff-b);
		outline: none;
		text-align: center;
	}

	.dato-label {
		font-family: var(--ff-d);
		font-size: 16px;
		font-weight: 600;
		color: var(--text);
		text-align: center;
		margin-bottom: 14px;
	}

	.dagbog-liste {
		display: flex;
		flex-direction: column;
		gap: 14px;
	}

	.type-overskrift {
		font-size: 11px;
		font-weight: 600;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--text3);
		margin-bottom: 6px;
	}

	.dagbog-kort {
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 12px;
		padding: 12px 14px;
		margin-bottom: 6px;
	}

	.dagbog-kort-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
		margin-bottom: 4px;
	}

	.dagbog-handlinger {
		display: flex;
		gap: 6px;
		flex-shrink: 0;
	}

	.dagbog-navn {
		font-size: 14px;
		font-weight: 600;
		color: var(--text);
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.dagbog-totaler {
		font-size: 11.5px;
		color: var(--text3);
		display: flex;
		gap: 6px;
		flex-wrap: wrap;
	}

	.felt {
		display: flex;
		flex-direction: column;
		gap: 4px;
		margin-bottom: 4px;
	}

	.felt-label {
		font-size: 11px;
		font-weight: 600;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--text3);
	}

	.felt-input {
		padding: 10px 12px;
		font-size: 16px;
		border-radius: 10px;
		border: 1px solid var(--border);
		background: var(--bg2);
		color: var(--text);
		font-family: var(--ff-b);
		outline: none;
	}

	.felt-input:focus {
		border-color: var(--terra);
	}

	.type-rad {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 6px;
	}

	.type-chip {
		padding: 9px 10px;
		font-size: 12.5px;
		font-weight: 500;
		border-radius: 8px;
		border: 1px solid var(--border);
		background: var(--white);
		color: var(--text2);
		cursor: pointer;
		font-family: var(--ff-b);
	}

	.type-chip.aktiv {
		background: var(--terra);
		color: #fff;
		border-color: var(--terra);
	}

	.gem-besked {
		padding: 10px 12px;
		border-radius: 8px;
		font-size: 12.5px;
		margin-bottom: 6px;
	}

	.gem-besked.ok {
		background: var(--sdim);
		color: var(--sage);
	}

	.gem-besked.fejl {
		background: #fbeeea;
		color: #8a4a3e;
	}

	.favorit-sektion {
		margin-bottom: 16px;
	}

	.favorit-overskrift {
		font-size: 11px;
		font-weight: 600;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--text3);
		margin-bottom: 8px;
	}

	.favorit-rad {
		display: flex;
		gap: 8px;
		overflow-x: auto;
		padding-bottom: 4px;
	}

	.favorit-kort {
		position: relative;
		flex-shrink: 0;
	}

	.favorit-knap {
		min-width: 140px;
		max-width: 200px;
		padding: 12px 14px 12px 14px;
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 12px;
		display: flex;
		flex-direction: column;
		gap: 4px;
		text-align: left;
		cursor: pointer;
		font-family: var(--ff-b);
	}

	.favorit-knap:hover {
		border-color: var(--terra);
		background: var(--tdim);
	}

	.favorit-navn {
		font-size: 13px;
		font-weight: 600;
		color: var(--text);
		line-height: 1.3;
		padding-right: 22px;
	}

	.favorit-antal {
		font-size: 11px;
		color: var(--text3);
	}

	.favorit-handlinger {
		position: absolute;
		top: 4px;
		right: 4px;
		display: flex;
		gap: 4px;
	}

	.favorit-mini {
		width: 22px;
		height: 22px;
		border-radius: 50%;
		background: rgba(255, 255, 255, 0.9);
		border: 1px solid var(--border);
		color: var(--text3);
		font-size: 12px;
		cursor: pointer;
		font-family: var(--ff-b);
		line-height: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0;
	}

	.favorit-mini:hover {
		background: var(--terra);
		color: #fff;
		border-color: var(--terra);
	}

	.rediger-banner {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 10px 12px;
		background: var(--tdim);
		border: 1px solid var(--terra);
		border-radius: 12px;
		margin-bottom: 14px;
	}

	.rediger-banner-tekst {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.rediger-banner-lbl {
		font-size: 10.5px;
		font-weight: 600;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--terra);
	}

	.rediger-navn-input {
		padding: 7px 10px;
		font-size: 14px;
		font-weight: 600;
		border-radius: 8px;
		border: 1px solid var(--border);
		background: var(--white);
		color: var(--text);
		font-family: var(--ff-b);
		outline: none;
		width: 100%;
	}

	.rediger-navn-input:focus {
		border-color: var(--terra);
	}

	.rediger-navn-static {
		padding: 7px 10px;
		font-size: 14px;
		font-weight: 600;
		border-radius: 8px;
		background: var(--white);
		color: var(--text);
		font-family: var(--ff-b);
	}

	.rediger-banner-luk {
		width: 32px;
		height: 32px;
		border-radius: 50%;
		background: var(--white);
		border: 1px solid var(--border);
		color: var(--text2);
		font-size: 18px;
		cursor: pointer;
		font-family: var(--ff-b);
		flex-shrink: 0;
	}

	.rediger-banner-luk:hover {
		background: #fbeeea;
		color: #8a4a3e;
	}

	.favorit-toggle {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 10px 12px;
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 10px;
		cursor: pointer;
	}

	.favorit-toggle.on {
		background: var(--tdim);
		border-color: var(--terra);
	}

	.favorit-toggle input {
		width: 18px;
		height: 18px;
		accent-color: var(--terra);
		cursor: pointer;
	}

	.favorit-toggle-tekst {
		flex: 1;
	}

	.favorit-toggle-lbl {
		font-size: 13px;
		color: var(--text);
		font-weight: 500;
	}

	.favorit-toggle-sub {
		font-size: 11.5px;
		color: var(--text3);
		margin-top: 1px;
		line-height: 1.4;
	}
</style>
