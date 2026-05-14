<script lang="ts">
	import { getContext, onMount } from 'svelte';
	import { page } from '$app/state';
	import { replaceState, goto } from '$app/navigation';
	import type { User } from 'firebase/auth';
	import type { UserDoc } from '$lib/types';
	import {
		beregnItem,
		beregnMaaltid,
		erManueltItem,
		formatDatoKey,
		formatGram,
		gaetMaaltidstype,
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
		type Maaltidstype
	} from '$lib/content/kost';
	import {
		gemFavorit,
		gemMaaltid,
		hentFavoritter,
		hentMaaltiderForDato,
		hentMaaltiderIPeriode,
		opdaterFavorit,
		opdaterMaaltid,
		sletFavorit,
		sletMaaltid,
		stemPaaFodevare,
		toggleFavoritFodevare
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
	import { harPremium } from '$lib/utils/userAdgang';
	const getUserDoc = getContext<() => UserDoc | null>('userDoc');
	const user = $derived(getUser());
	const userDoc = $derived(getUserDoc?.() ?? null);
	// Udvidet næring (kh/fedt/kcal) er kun for premium. Brugerens toggle
	// huskes på userDoc, men gælder kun hvis hun har premium-niveau.
	const visUdvidet = $derived(harPremium(userDoc) && userDoc?.visUdvidetNaering === true);
	const kanScanne = $derived(harPremium(userDoc));
	import { hentAlleOpskrifter } from '$lib/firestore/opskrifter';
	import { hentMineOpskrifter } from '$lib/firestore/minOpskrift';
	import type { MinOpskrift } from '$lib/content/minOpskrift';
	import Icon from '$lib/components/Icon.svelte';
	import IndkoebsListeOverlay from '$lib/components/IndkoebsListeOverlay.svelte';
	import Loading from '$lib/components/Loading.svelte';
	import {
		byggIndkoebsliste,
		type IndkoebsItem,
		type ValgteOpskrifter
	} from '$lib/content/indkoebsliste';
	import {
		handlingsFarve,
		type MaaltidDiff,
		type OptimerSvar
	} from '$lib/content/optimerMaaltider';

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

	type Tab = 'maaltid' | 'opskrifter' | 'mine' | 'dagbog';

	function tabFraQuery(): Tab {
		const t = page.url.searchParams.get('tab');
		if (t === 'maaltid' || t === 'opskrifter' || t === 'mine' || t === 'dagbog') return t;
		return 'maaltid';
	}

	function datoFraQuery(): string | null {
		const d = page.url.searchParams.get('dato');
		if (d && /^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
		return null;
	}

	let aktivTab = $state<Tab>(tabFraQuery());

	function skiftTab(ny: Tab) {
		aktivTab = ny;
		const url = new URL(page.url);
		if (ny === 'maaltid') {
			url.searchParams.delete('tab');
		} else {
			url.searchParams.set('tab', ny);
		}
		replaceState(url, page.state);
	}

	let foods = $state<Fodevare[]>([]);
	let foodMap = $state<Map<string, Fodevare>>(new Map());
	let opskrifter = $state<Opskrift[]>([]);
	let mineOpskrifter = $state<MinOpskrift[]>([]);
	let loading = $state(true);
	let fejl = $state<string | null>(null);

	// Picker-state (åbnes fra Byg måltid via "Tilføj/søg fødevare")
	type PickerTab = 'alle' | 'seneste' | 'favorit';
	let senesteFodevareIds = $state<string[]>([]);
	let eksaktSog = $state(false);

	// Byg måltid-state — persisterer i localStorage
	let maaltid = $state<MaaltidsItem[]>([]);
	let viserPicker = $state(false);
	let pickerSoeg = $state('');
	let pickerTab = $state<PickerTab>('alle');
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

	// Dagbog-state — initialiseres fra ?dato=YYYY-MM-DD query param hvis sat,
	// så links fra forsiden kan pre-vælge en specifik dato.
	let dagbogDato = $state<string>(datoFraQuery() ?? formatDatoKey());
	let dagbogMaaltider = $state<GemtMaaltid[]>([]);
	let dagbogIndlaeser = $state(false);
	let dagbogFejl = $state<string | null>(null);

	// Pre-valgt dato når brugeren klikker 'Byg måltid for denne dag' fra
	// dagbog-fanen. Honoreres af aabnGemModal og nulstilles efter gem
	// eller ved manuel skift til Byg måltid-fanen.
	let forhaandsValgtDato = $state<string | null>(null);

	function byggForDenneDag() {
		forhaandsValgtDato = dagbogDato;
		skiftTab('maaltid');
	}

	// Optimér-min-mad-state (premium-feature)
	let optimerIndlaeser = $state(false);
	let optimerSvar = $state<OptimerSvar | null>(null);
	let optimerFejl = $state<string | null>(null);
	let anvenderOptimering = $state(false);
	const kanOptimere = $derived(
		harPremium(userDoc) &&
			!!userDoc?.dagligeMaal &&
			dagbogDato === formatDatoKey()
	);

	// Gem-måltid-modal state
	let viserGemModal = $state(false);
	let gemNavn = $state('');
	let gemType = $state<Maaltidstype>('morgenmad');
	let gemDato = $state<string>(formatDatoKey());
	let gemSomFavorit = $state(false);
	let gemmer = $state(false);
	let gemBesked = $state<{ tekst: string; type: 'ok' | 'fejl' } | null>(null);
	// Pre-udfyldt navn når en favorit indlæses — gem-modalen bruger det som
	// default i stedet for blank, så brugeren ikke skal genskrive navnet.
	let pendingMaaltidsNavn = $state<string | null>(null);

	// Kopier-måltid-modal state — bruges når brugeren klikker "kopier" på et
	// dagbog-måltid og vælger en ny dato + type.
	let kopierFra = $state<GemtMaaltid | null>(null);
	let kopierDato = $state<string>(formatDatoKey());
	let kopierType = $state<Maaltidstype>('morgenmad');
	let kopierer = $state(false);
	let kopierBesked = $state<{ tekst: string; type: 'ok' | 'fejl' } | null>(null);

	// Favoritter
	let favoritter = $state<FavoritMaaltid[]>([]);
	let redigererFavorit = $state<{ id: string; navn: string } | null>(null);
	let redigerNavn = $state('');
	let opdaterer = $state(false);
	let viserFavoritModal = $state(false);
	let redigerBesked = $state<{ tekst: string; type: 'ok' | 'fejl' } | null>(null);

	// Rediger-måltid-state — sat når brugeren klikker rediger på et dagbog-kort
	let redigererMaaltid = $state<{
		id: string;
		navn: string;
		type: Maaltidstype;
		dato: string;
	} | null>(null);

	const favoritFodevareSet = $derived(new Set(userDoc?.favoritFodevarer ?? []));
	const senesteSet = $derived(new Set(senesteFodevareIds));

	// Default: bred substring-søgning ("æg" matcher alt med "æg" i navnet).
	// Med toggle "Kun hele ord" slået til: kun eksakt ord-match — "æg" matcher
	// kun "Æg" eller fx "Pålæg med æg", ikke "Æggenudler".
	function matcherSog(navn: string, q: string): boolean {
		const lower = navn.toLowerCase();
		if (eksaktSog) {
			const ord = lower.split(/[\s,\-/&()]+/);
			return ord.includes(q);
		}
		return lower.includes(q);
	}

	// Filtrér foods i pickeren baseret på aktiv tab + søgeord.
	// Alle: tom-state uden søgning, alle matchende foods med søgning.
	// Seneste: de seneste 30 valgte fødevarer (alfabetisk).
	// Favorit: brugerens favoritter (alfabetisk).
	const filtretetPicker = $derived.by<Fodevare[]>(() => {
		const q = pickerSoeg.trim().toLowerCase();
		let base: Fodevare[];
		if (pickerTab === 'alle') {
			if (!q) return [];
			base = foods;
		} else if (pickerTab === 'seneste') {
			base = foods.filter((f) => senesteSet.has(f.id));
		} else {
			base = foods.filter((f) => favoritFodevareSet.has(f.id));
		}
		if (q) base = base.filter((f) => matcherSog(f.name, q));
		return sorterFodevarer(base, 'alpha');
	});

	const filtreredeOpskrifter = $derived(
		filtrerOpskrifter(opskrifter, opskriftSoeg, valgteOpskriftKategorier, valgteDietTags)
	);

	const totaler = $derived(beregnMaaltid(maaltid, foodMap));
	const proteinPct = $derived(procentMod(PROTEIN_MAALTIDS_MAAL, totaler.protein));
	const fiberPct = $derived(procentMod(FIBER_DAGS_MAAL, totaler.fiber));

	async function toggleFavorit(food: Fodevare) {
		const u = user;
		if (!u) return;
		const erFavorit = favoritFodevareSet.has(food.id);
		try {
			await toggleFavoritFodevare(u.uid, food.id, !erFavorit);
			// userDoc-snapshot opdaterer automatisk favoritFodevareSet via $derived.
		} catch (e) {
			console.warn('Kunne ikke ændre favorit-status:', e);
		}
	}

	async function indlaesSenesteFodevarer(uid: string) {
		// Henter måltider fra de seneste 90 dage, sortér nyeste først, og
		// udled de seneste 30 unikke fødevarer brugeren har valgt.
		const idag = new Date();
		const fra = new Date(idag);
		fra.setDate(fra.getDate() - 90);
		try {
			const maaltider = await hentMaaltiderIPeriode(
				uid,
				formatDatoKey(fra),
				formatDatoKey(idag)
			);
			maaltider.sort((a, b) => b.dato.localeCompare(a.dato));
			const seen = new Set<string>();
			const result: string[] = [];
			for (const m of maaltider) {
				for (const i of m.items) {
					if (i.foodId && !seen.has(i.foodId)) {
						seen.add(i.foodId);
						result.push(i.foodId);
						if (result.length >= 30) break;
					}
				}
				if (result.length >= 30) break;
			}
			senesteFodevareIds = result;
		} catch (e) {
			console.warn('Kunne ikke hente seneste fødevarer:', e);
		}
	}

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
			const u = user;
			const [allFoods, allOpskrifter, mine] = await Promise.all([
				hentAlleFodevarer(),
				hentAlleOpskrifter(true),
				u && harPremium(userDoc) ? hentMineOpskrifter(u.uid) : Promise.resolve([])
			]);
			foods = allFoods;
			foodMap = new Map(allFoods.map((f) => [f.id, f]));
			opskrifter = allOpskrifter;
			mineOpskrifter = mine;
		} catch (e) {
			console.error(e);
			fejl = 'Kunne ikke hente data.';
		} finally {
			loading = false;
			initialiseret = true;
		}

		// Indlæs dagbog, favoritter og seneste fødevarer i baggrunden
		void indlaesDagbog();
		void indlaesFavoritter();
		const u2 = user;
		if (u2) void indlaesSenesteFodevarer(u2.uid);
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
		pendingMaaltidsNavn = fav.navn;
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
			// Prepend så den nytilføjede fødevare ligger øverst i listen — nemmere
			// at se hvad man lige har valgt uden at scrolle.
			maaltid = [
				{ foodId: food.id, portion: standardPortion, enhedId: standardEnhed },
				...maaltid
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
		pickerTab = 'alle';
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
		pendingMaaltidsNavn = null;
	}

	function aabnPicker() {
		erstatterIndex = null;
		viserPicker = true;
		pickerSoeg = '';
		pickerTab = 'alle';
	}

	function aabnScanner() {
		if (!kanScanne) return;
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

	function aabnKopierModal(m: GemtMaaltid) {
		kopierFra = m;
		kopierDato = m.dato;
		kopierType = m.type;
		kopierBesked = null;
	}

	function lukKopierModal() {
		kopierFra = null;
		kopierBesked = null;
	}

	function kopierGenvej(delta: number) {
		const [aar, mnd, dag] = kopierDato.split('-').map(Number);
		const d = new Date(aar, mnd - 1, dag);
		d.setDate(d.getDate() + delta);
		kopierDato = formatDatoKey(d);
	}

	async function udforKopier() {
		const u = user;
		const kilde = kopierFra;
		if (!u || !kilde) return;
		kopierer = true;
		kopierBesked = null;
		try {
			const nyt: Omit<GemtMaaltid, 'id'> = {
				navn: kilde.navn,
				type: kopierType,
				dato: kopierDato,
				items: kilde.items.map((i) => ({ ...i })),
				totalP: kilde.totalP,
				totalF: kilde.totalF
			};
			if (kilde.totalKh !== undefined) nyt.totalKh = kilde.totalKh;
			if (kilde.totalFedt !== undefined) nyt.totalFedt = kilde.totalFedt;
			if (kilde.totalKcal !== undefined) nyt.totalKcal = kilde.totalKcal;
			await gemMaaltid(u.uid, nyt);
			// Hvis brugeren kopierer til den dato hun allerede ser, opdatér listen.
			if (kopierDato === dagbogDato) {
				dagbogMaaltider = await hentMaaltiderForDato(u.uid, dagbogDato);
			}
			kopierBesked = { tekst: `Kopieret til ${visningsDato(kopierDato)}.`, type: 'ok' };
			setTimeout(() => {
				kopierFra = null;
				kopierBesked = null;
			}, 1200);
		} catch (e) {
			console.error(e);
			kopierBesked = { tekst: 'Kunne ikke kopiere måltidet.', type: 'fejl' };
		} finally {
			kopierer = false;
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
			gemNavn = pendingMaaltidsNavn ?? '';
			gemType = gaetMaaltidstype();
			gemDato = forhaandsValgtDato ?? formatDatoKey();
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
				totalF: Math.round(totaler.fiber * 10) / 10,
				totalKh: Math.round(totaler.kh * 10) / 10,
				totalFedt: Math.round(totaler.fedt * 10) / 10,
				totalKcal: Math.round(totaler.kcal)
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
			pendingMaaltidsNavn = null;
			localStorage.setItem(STORAGE_KEY, '[]');
			viserGemModal = false;
			forhaandsValgtDato = null;
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
		let kh = 0;
		let fedt = 0;
		let kcal = 0;
		for (const m of dagbogMaaltider) {
			p += m.totalP;
			f += m.totalF;
			kh += m.totalKh ?? 0;
			fedt += m.totalFedt ?? 0;
			kcal += m.totalKcal ?? 0;
		}
		return { protein: p, fiber: f, kh, fedt, kcal };
	}

	async function optimerMad() {
		const u = user;
		if (!u || !userDoc?.dagligeMaal) return;
		optimerIndlaeser = true;
		optimerFejl = null;
		optimerSvar = null;
		try {
			const idToken = await u.getIdToken();
			const res = await fetch('/api/optimer-maaltider', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${idToken}`
				},
				body: JSON.stringify({
					maaltider: dagbogMaaltider,
					maal: userDoc.dagligeMaal,
					dietTags: []
				})
			});
			if (!res.ok) {
				const data = (await res.json().catch(() => ({}))) as { message?: string };
				throw new Error(data.message ?? `Server-fejl ${res.status}`);
			}
			optimerSvar = (await res.json()) as OptimerSvar;
		} catch (e) {
			optimerFejl = e instanceof Error ? e.message : 'Noget gik galt. Prøv igen.';
		} finally {
			optimerIndlaeser = false;
		}
	}

	function lukOptimerKort() {
		optimerSvar = null;
		optimerFejl = null;
	}

	/**
	 * Anvender AI'ens diff på dagbogen ved at føje en manuel "AI-tilpasning"-
	 * item til hvert berørt måltid og opdatere måltidets totaler med
	 * makroDelta. For NY_-prefiksede maaltidId'er oprettes et nyt måltid.
	 *
	 * 'fjern' og 'byt' lægges også ind som manuelle items (med negative eller
	 * netto-makro) så dagstotalerne stemmer. Bruger kan rydde manuelt op
	 * bagefter hvis hun vil.
	 */
	async function anvendOptimering() {
		const u = user;
		if (!u || !optimerSvar) return;
		anvenderOptimering = true;
		try {
			// Grupper diff pr måltid for at lave så få Firestore-writes som muligt
			const grupperet = new Map<string, MaaltidDiff[]>();
			for (const d of optimerSvar.diff) {
				const liste = grupperet.get(d.maaltidId) ?? [];
				liste.push(d);
				grupperet.set(d.maaltidId, liste);
			}

			for (const [maaltidId, diffs] of grupperet) {
				const erNyt = maaltidId.startsWith('NY_');
				const eksisterende = erNyt
					? null
					: dagbogMaaltider.find((m) => m.id === maaltidId);

				// Saml ny item-liste og totaler
				const nyeItems: MaaltidsItem[] = diffs.map((d) => ({
					foodId: '',
					portion: 1,
					manuel: {
						navn: `${d.handling === 'fjern' ? '− ' : d.handling === 'byt' ? '↔ ' : '+ '}${d.tekst}`,
						enhed: 'AI-justering'
					}
				}));
				let totalP = (eksisterende?.totalP ?? 0);
				let totalF = (eksisterende?.totalF ?? 0);
				let totalKh = (eksisterende?.totalKh ?? 0);
				let totalFedt = (eksisterende?.totalFedt ?? 0);
				let totalKcal = (eksisterende?.totalKcal ?? 0);
				for (const d of diffs) {
					totalP += d.makroDelta.protein;
					totalF += d.makroDelta.fiber;
					totalKh += d.makroDelta.kh;
					totalFedt += d.makroDelta.fedt;
					totalKcal += d.makroDelta.kcal;
				}
				// Klippe til ikke-negative tal
				totalP = Math.max(0, totalP);
				totalF = Math.max(0, totalF);
				totalKh = Math.max(0, totalKh);
				totalFedt = Math.max(0, totalFedt);
				totalKcal = Math.max(0, totalKcal);

				if (erNyt) {
					const første = diffs[0];
					await gemMaaltid(u.uid, {
						navn: første.maaltidNavn || 'AI-snack',
						type: første.maaltidType,
						dato: dagbogDato,
						items: nyeItems,
						totalP,
						totalF,
						totalKh,
						totalFedt,
						totalKcal
					});
				} else if (eksisterende) {
					await opdaterMaaltid(u.uid, eksisterende.id, {
						navn: eksisterende.navn,
						type: eksisterende.type,
						dato: eksisterende.dato,
						items: [...eksisterende.items, ...nyeItems],
						totalP,
						totalF,
						totalKh,
						totalFedt,
						totalKcal
					});
				}
			}

			// Genindlæs dagbog og luk kortet
			await indlaesDagbog();
			optimerSvar = null;
		} catch (e) {
			console.error(e);
			optimerFejl = 'Kunne ikke anvende alle ændringer. Prøv igen.';
		} finally {
			anvenderOptimering = false;
		}
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
		<button
			class="back"
			type="button"
			onclick={() => {
				if (typeof window !== 'undefined' && window.history.length > 1) {
					history.back();
				} else {
					void goto('/');
				}
			}}
		>
			<Icon name="arrow-l" size={14} color="var(--text2)" />
			<span>Tilbage</span>
		</button>
		<div class="eyebrow">Mad</div>
		<h1>30-30 beregner</h1>
		<p class="page-sub">
			Sigt efter mindst 30g protein pr. måltid og 30g fiber i alt over dagen. Det holder dig mæt længere og støtter et stabilt blodsukker gennem overgangsalderen.
		</p>
	</header>

	{#if loading}
		<Loading tekst="Henter data..." />
	{:else if fejl}
		<div class="status-besked fejl">{fejl}</div>
	{:else}
		<div class="tabs">
			<button
				class="tab-knap"
				class:aktiv={aktivTab === 'maaltid'}
				type="button"
				onclick={() => {
					forhaandsValgtDato = null;
					skiftTab('maaltid');
				}}
			>
				Byg {maaltid.length > 0 ? `(${maaltid.length})` : ''}
			</button>
			<button
				class="tab-knap"
				class:aktiv={aktivTab === 'opskrifter'}
				type="button"
				onclick={() => skiftTab('opskrifter')}
			>
				Opskrifter
			</button>
			{#if harPremium(userDoc)}
				<button
					class="tab-knap"
					class:aktiv={aktivTab === 'mine'}
					type="button"
					onclick={() => skiftTab('mine')}
				>
					Mine
				</button>
			{/if}
			<button
				class="tab-knap"
				class:aktiv={aktivTab === 'dagbog'}
				type="button"
				onclick={() => skiftTab('dagbog')}
			>
				Dagbog
			</button>
		</div>

		{#if aktivTab === 'maaltid'}
			{#if forhaandsValgtDato && !redigererFavorit && !redigererMaaltid}
				<div class="dato-hint">
					Du bygger måltid for <strong>{visningsDato(forhaandsValgtDato)}</strong>.
					Gem-datoen er pre-valgt.
				</div>
			{/if}
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
				<button
					class="favorit-toggle-knap"
					type="button"
					onclick={() => (viserFavoritModal = true)}
				>
					<span>Mine favoritter ({favoritter.length})</span>
					<Icon name="chevron-r" size={14} color="var(--text2)" />
				</button>
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

			{#if visUdvidet}
				<div class="udvidet-totaler">
					<div class="udvidet-celle">
						<span class="udvidet-lbl">Kulhydrater</span>
						<span class="udvidet-val">{formatGram(totaler.kh)}</span>
					</div>
					<div class="udvidet-celle">
						<span class="udvidet-lbl">Fedt</span>
						<span class="udvidet-val">{formatGram(totaler.fedt)}</span>
					</div>
					<div class="udvidet-celle">
						<span class="udvidet-lbl">Kalorier</span>
						<span class="udvidet-val">{Math.round(totaler.kcal)} kcal</span>
					</div>
				</div>
			{/if}

			<div class="tilfoej-rad">
				<button class="primary-knap tilfoej-fodevare-knap" type="button" onclick={aabnPicker}>
					+ Tilføj/søg fødevare
				</button>
				{#if !redigererFavorit && maaltid.length > 0}
					<button class="primary-knap sage gem-i-rad" type="button" onclick={aabnGemModal}>
						Gem i dagbog
					</button>
				{/if}
				{#if kanScanne}
					<button
						class="scan-knap-direkte"
						type="button"
						onclick={aabnScanner}
						disabled={scannerArbejder}
						aria-label="Scan stregkode"
					>
						<Icon name="barcode" size={16} color="#fff" />
						<span>Scan</span>
					</button>
				{/if}
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
		{:else if aktivTab === 'mine'}
			<div class="hint-boks">
				<span class="hint-ikon">✨</span>
				<span class="hint-tekst">
					Tag billede af en opskrift — AI'en estimerer makro pr portion. Kun synlig for dig.
				</span>
			</div>
			<a class="primary-knap mine-tilfoj" href="/app/moduler/30-30-3/min-opskrift/ny">
				+ Tilføj fra billede
			</a>
			{#if mineOpskrifter.length === 0}
				<div class="tom-boks">
					<p>Du har ingen private opskrifter endnu. Tryk på knappen ovenfor for at tilføje din første.</p>
				</div>
			{:else}
				<ul class="mine-liste">
					{#each mineOpskrifter as o (o.id)}
						<a class="mine-item" href="/app/moduler/30-30-3/min-opskrift/{o.id}">
							{#if o.billedeUrl}
								<img src={o.billedeUrl} alt={o.navn} class="mine-billede" />
							{:else}
								<div class="mine-billede placeholder"></div>
							{/if}
							<div class="mine-tekst">
								<div class="mine-navn">{o.navn}</div>
								<div class="mine-meta">
									{o.makroPrPortion.protein}g protein · {o.makroPrPortion.kcal} kcal · {o.antalPortioner} {o.antalPortioner === 1 ? 'portion' : 'portioner'}
								</div>
							</div>
						</a>
					{/each}
				</ul>
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

			<button class="byg-for-dag-knap" type="button" onclick={byggForDenneDag}>
				+ Byg måltid for denne dag
			</button>

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

				{#if visUdvidet}
					<div class="udvidet-totaler">
						<div class="udvidet-celle">
							<span class="udvidet-lbl">Kulhydrater</span>
							<span class="udvidet-val">{formatGram(dagsTotaler.kh)}</span>
						</div>
						<div class="udvidet-celle">
							<span class="udvidet-lbl">Fedt</span>
							<span class="udvidet-val">{formatGram(dagsTotaler.fedt)}</span>
						</div>
						<div class="udvidet-celle">
							<span class="udvidet-lbl">Kalorier</span>
							<span class="udvidet-val">{Math.round(dagsTotaler.kcal)} kcal</span>
						</div>
					</div>
				{/if}

				{#if kanOptimere}
					<div class="optimer-rad">
						{#if !optimerSvar}
							<button
								class="btn primary optimer-knap"
								type="button"
								onclick={() => void optimerMad()}
								disabled={optimerIndlaeser}
							>
								{optimerIndlaeser ? 'AI analyserer dagen…' : 'Optimér min mad'}
							</button>
							{#if optimerFejl}
								<div class="status-besked fejl">{optimerFejl}</div>
							{/if}
						{:else}
							<div class="optimer-kort">
								<div class="optimer-head">
									<h3>Forslag til justeringer</h3>
									<button
										class="ikon-knap"
										type="button"
										onclick={lukOptimerKort}
										aria-label="Luk"
									>
										×
									</button>
								</div>

								<p class="optimer-samlet">{optimerSvar.samletBegrundelse}</p>

								{#if optimerSvar.advarsel}
									<div class="status-besked advarsel">{optimerSvar.advarsel}</div>
								{/if}

								{#if optimerSvar.diff.length === 0}
									<div class="status-besked">Din dag ser allerede god ud — ingen ændringer foreslået.</div>
								{:else}
									<ul class="optimer-diff">
										{#each optimerSvar.diff as d, i (i)}
											<li class="optimer-item" style="--accent: {handlingsFarve(d.handling)}">
												<div class="optimer-item-head">
													<span class="optimer-maaltid">{MAALTIDSTYPE_LABELS[d.maaltidType]} · {d.maaltidNavn}</span>
												</div>
												<div class="optimer-item-body">{d.tekst}</div>
												<div class="optimer-item-meta">{d.begrundelse}</div>
												<div class="optimer-item-makro">
													{d.makroDelta.protein >= 0 ? '+' : ''}{Math.round(d.makroDelta.protein * 10) / 10}g protein ·
													{d.makroDelta.fiber >= 0 ? '+' : ''}{Math.round(d.makroDelta.fiber * 10) / 10}g fiber ·
													{d.makroDelta.kcal >= 0 ? '+' : ''}{Math.round(d.makroDelta.kcal)} kcal
												</div>
											</li>
										{/each}
									</ul>

									<div class="optimer-resultat">
										<div class="optimer-resultat-titel">Forventet resultat</div>
										<div class="optimer-resultat-tal">
											{Math.round(optimerSvar.resultatMakro.protein)}g protein ·
											{Math.round(optimerSvar.resultatMakro.fiber)}g fiber ·
											{Math.round(optimerSvar.resultatMakro.kcal)} kcal
										</div>
									</div>

									<div class="optimer-handlinger">
										<button
											class="btn ghost"
											type="button"
											onclick={lukOptimerKort}
											disabled={anvenderOptimering}
										>
											Behold som det er
										</button>
										<button
											class="btn primary"
											type="button"
											onclick={() => void anvendOptimering()}
											disabled={anvenderOptimering}
										>
											{anvenderOptimering ? 'Anvender…' : 'Anvend ændringer'}
										</button>
									</div>
								{/if}
							</div>
						{/if}
					</div>
				{/if}

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
													onclick={() => aabnKopierModal(m)}
													aria-label="Kopiér til anden dag"
													title="Kopiér til anden dag"
												>
													⎘
												</button>
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
											{#if visUdvidet}
												<span>·</span>
												<span>{formatGram(m.totalKh ?? 0)} kh</span>
												<span>·</span>
												<span>{formatGram(m.totalFedt ?? 0)} fedt</span>
												<span>·</span>
												<span>{Math.round(m.totalKcal ?? 0)} kcal</span>
											{/if}
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

	{#if kopierFra}
		<div
			class="modal-bag"
			role="dialog"
			aria-modal="true"
			use:portalToBody
			onclick={(e) => {
				if (e.target === e.currentTarget) lukKopierModal();
			}}
			onkeydown={(e) => {
				if (e.key === 'Escape') lukKopierModal();
			}}
			tabindex="-1"
		>
			<div class="modal kopier-modal">
				<div class="modal-head">
					<div class="modal-titel">Kopiér måltid</div>
					<button class="modal-luk" type="button" onclick={lukKopierModal} aria-label="Luk">
						×
					</button>
				</div>
				<div class="kopier-info">
					<div class="kopier-info-navn">{kopierFra.navn}</div>
					<div class="kopier-info-sub">
						{MAALTIDSTYPE_LABELS[kopierFra.type]} · {visningsDato(kopierFra.dato)}
					</div>
				</div>

				<div class="felt">
					<div class="felt-label">Vælg dato</div>
					<div class="kopier-genveje">
						<button type="button" class="genvej-knap" onclick={() => kopierGenvej(-1)}>
							I går
						</button>
						<button
							type="button"
							class="genvej-knap"
							onclick={() => (kopierDato = formatDatoKey())}
						>
							I dag
						</button>
						<button type="button" class="genvej-knap" onclick={() => kopierGenvej(1)}>
							I morgen
						</button>
					</div>
					<input
						type="date"
						class="felt-input"
						bind:value={kopierDato}
						disabled={kopierer}
					/>
				</div>

				<div class="felt">
					<div class="felt-label">Måltidstype</div>
					<select class="felt-input" bind:value={kopierType} disabled={kopierer}>
						{#each MAALTIDSTYPER as type (type)}
							<option value={type}>{MAALTIDSTYPE_LABELS[type]}</option>
						{/each}
					</select>
				</div>

				{#if kopierBesked}
					<div class="gem-besked {kopierBesked.type}">{kopierBesked.tekst}</div>
				{/if}

				<button
					class="primary-knap"
					type="button"
					onclick={udforKopier}
					disabled={kopierer}
				>
					{kopierer ? 'Kopierer...' : 'Kopiér måltidet'}
				</button>
			</div>
		</div>
	{/if}

	{#if viserFavoritModal}
		<div
			class="modal-bag"
			role="dialog"
			aria-modal="true"
			use:portalToBody
			onclick={(e) => {
				if (e.target === e.currentTarget) viserFavoritModal = false;
			}}
			onkeydown={(e) => {
				if (e.key === 'Escape') viserFavoritModal = false;
			}}
			tabindex="-1"
		>
			<div class="modal">
				<div class="modal-head">
					<div class="modal-titel">Mine favoritter</div>
					<button
						class="modal-luk"
						type="button"
						onclick={() => (viserFavoritModal = false)}
						aria-label="Luk"
					>
						×
					</button>
				</div>
				<div class="picker-liste">
					{#if favoritter.length === 0}
						<div class="status-besked">Du har endnu ingen favorit-måltider.</div>
					{:else}
						{#each favoritter as f (f.id)}
							<div class="favorit-modal-row">
								<button
									class="favorit-modal-vaelg"
									type="button"
									onclick={() => {
										indlaesFavoritIMaaltid(f);
										viserFavoritModal = false;
									}}
								>
									<span class="favorit-navn">{f.navn}</span>
									<span class="favorit-antal">{f.items.length} ingredienser</span>
								</button>
								<div class="favorit-handlinger">
									<button
										class="favorit-mini"
										type="button"
										onclick={() => {
											startRedigerFavorit(f);
											viserFavoritModal = false;
										}}
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
					{/if}
				</div>
			</div>
		</div>
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
					<button class="modal-luk" type="button" onclick={lukPicker} aria-label="Luk">
						×
					</button>
				</div>
				<input type="search" class="search" placeholder="Søg..." bind:value={pickerSoeg} />
				<label class="eksakt-toggle" class:aktiv={eksaktSog}>
					<input type="checkbox" bind:checked={eksaktSog} />
					<span>Kun hele ord</span>
				</label>
				<div class="slap-tabs">
					{#each [{ id: 'alle' as PickerTab, l: 'Alle' }, { id: 'seneste' as PickerTab, l: 'Seneste' }, { id: 'favorit' as PickerTab, l: 'Mine favoritter' }] as t (t.id)}
						<button
							type="button"
							class="slap-tab"
							class:aktiv={pickerTab === t.id}
							onclick={() => (pickerTab = t.id)}
						>
							{t.l}
						</button>
					{/each}
				</div>
				<div class="picker-liste">
					{#if filtretetPicker.length === 0}
						{#if pickerTab === 'alle' && !pickerSoeg.trim()}
							<div class="status-besked tom-state">
								<div>Søg efter en madvare for at komme i gang.</div>
								<div class="tom-state-hint">Dine favoritter vises under Mine favoritter.</div>
							</div>
						{:else if pickerTab === 'seneste'}
							<div class="status-besked">Du har endnu ikke valgt nogen fødevarer.</div>
						{:else if pickerTab === 'favorit'}
							<div class="status-besked">
								Ingen favoritter endnu — tryk på stjernen ved en fødevare for at gemme den.
							</div>
						{:else}
							<div class="status-besked">Ingen fødevarer matcher.</div>
						{/if}
					{/if}
					{#each filtretetPicker as food (food.id)}
						{@const erCommunity = food.kilde === 'community'}
						{@const okAntal = food.okBy?.length ?? 0}
						{@const ejAntal = food.ejBy?.length ?? 0}
						{@const minStem = user && food.okBy?.includes(user.uid) ? 'ok' : user && food.ejBy?.includes(user.uid) ? 'ej' : null}
						{@const erFavorit = favoritFodevareSet.has(food.id)}
						<div class="picker-row-wrap">
							<div class="picker-row-flex">
								<button
									class="favorit-stjerne"
									type="button"
									onclick={() => toggleFavorit(food)}
									aria-label={erFavorit ? 'Fjern fra favoritter' : 'Tilføj til favoritter'}
									title={erFavorit ? 'Fjern fra favoritter' : 'Tilføj til favoritter'}
								>
									<Icon
										name="star"
										size={16}
										color={erFavorit ? 'var(--terra)' : 'var(--text3)'}
										filled={erFavorit}
									/>
								</button>
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
							</div>
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
				<div class="picker-footer">
					<button class="manuel-link" type="button" onclick={aabnTilfoejManuel}>
						<Icon name="plus" size={12} color="var(--terra)" />
						Tilføj fødevare manuelt
					</button>
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
		font-size: calc(12px * var(--fs-scale, 1));
		color: var(--text2);
		text-decoration: none;
		margin-bottom: 12px;
		background: none;
		border: none;
		padding: 0;
		font-family: var(--ff-b);
		cursor: pointer;
	}

	.eyebrow {
		font-size: calc(10px * var(--fs-scale, 1));
		font-weight: 600;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--text3);
	}

	h1 {
		font-family: var(--ff-d);
		font-size: calc(30px * var(--fs-scale, 1));
		font-weight: 600;
		letter-spacing: -0.02em;
		margin: 4px 0 0;
		line-height: 1.05;
		color: var(--text);
	}

	.page-sub {
		font-size: calc(13px * var(--fs-scale, 1));
		color: var(--text2);
		margin: 8px 0 0;
		line-height: 1.45;
	}

	.status-besked {
		padding: 14px 16px;
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 12px;
		color: var(--text2);
		font-size: calc(13px * var(--fs-scale, 1));
		text-align: center;
	}

	.status-besked.fejl {
		color: #8a4a3e;
		background: #fbeeea;
		border-color: #f0d6cf;
	}

	.status-besked.advarsel {
		color: #8a6a1a;
		background: #fbf3dd;
		border-color: #f0e2b1;
	}

	.optimer-rad {
		margin-bottom: 14px;
	}

	.optimer-knap {
		width: 100%;
	}

	.optimer-kort {
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 14px;
		padding: 16px;
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.optimer-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
	}

	.optimer-head h3 {
		margin: 0;
		font-size: calc(16px * var(--fs-scale, 1));
		color: var(--text);
	}

	.optimer-samlet {
		margin: 0;
		color: var(--text2);
		font-size: calc(13px * var(--fs-scale, 1));
		line-height: 1.45;
	}

	.optimer-diff {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.optimer-item {
		border-left: 3px solid var(--accent);
		background: var(--bg, #fafafa);
		border-radius: 8px;
		padding: 10px 12px;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.optimer-maaltid {
		font-size: calc(11px * var(--fs-scale, 1));
		text-transform: uppercase;
		letter-spacing: 0.5px;
		color: var(--text3);
	}

	.optimer-item-body {
		font-size: calc(14px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--text);
	}

	.optimer-item-meta {
		font-size: calc(12px * var(--fs-scale, 1));
		color: var(--text2);
	}

	.optimer-item-makro {
		font-size: calc(11.5px * var(--fs-scale, 1));
		color: var(--text3);
		font-variant-numeric: tabular-nums;
	}

	.optimer-resultat {
		background: var(--bg-soft, #f4f4f1);
		border-radius: 8px;
		padding: 10px 12px;
	}

	.optimer-resultat-titel {
		font-size: calc(11px * var(--fs-scale, 1));
		text-transform: uppercase;
		letter-spacing: 0.5px;
		color: var(--text3);
		margin-bottom: 2px;
	}

	.optimer-resultat-tal {
		font-size: calc(13.5px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--text);
		font-variant-numeric: tabular-nums;
	}

	.optimer-handlinger {
		display: flex;
		gap: 8px;
		justify-content: flex-end;
	}

	.tabs {
		display: grid;
		grid-auto-flow: column;
		grid-auto-columns: 1fr;
		background: var(--bg2);
		padding: 4px;
		border-radius: 12px;
		margin-bottom: 14px;
		gap: 4px;
	}

	.tab-knap {
		padding: 9px 6px;
		font-size: calc(12px * var(--fs-scale, 1));
		font-family: var(--ff-b);
		font-weight: 500;
		color: var(--text2);
		background: transparent;
		border: none;
		border-radius: 9px;
		cursor: pointer;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.tab-knap.aktiv {
		background: var(--white);
		color: var(--text);
		font-weight: 600;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
	}

	.search {
		width: 100%;
		padding: 11px 14px;
		font-size: calc(16px * var(--fs-scale, 1));
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
		font-size: calc(11.5px * var(--fs-scale, 1));
		color: var(--text3);
		margin-right: 4px;
	}

	.sort-knap,
	.chip {
		padding: 6px 12px;
		font-size: calc(12px * var(--fs-scale, 1));
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

	.slap-tabs {
		display: flex;
		gap: 4px;
		margin-bottom: 14px;
		overflow-x: auto;
		-webkit-overflow-scrolling: touch;
		scrollbar-width: none;
	}
	.slap-tabs::-webkit-scrollbar {
		display: none;
	}
	.slap-tab {
		padding: 7px 14px;
		font-size: calc(13px * var(--fs-scale, 1));
		border-radius: 99px;
		border: none;
		background: transparent;
		color: var(--text2);
		cursor: pointer;
		font-family: var(--ff-b);
		font-weight: 500;
		flex-shrink: 0;
	}
	.slap-tab.aktiv {
		background: var(--bg2);
		color: var(--text);
	}

	.tom-state {
		text-align: left;
		padding: 16px 12px;
	}
	.tom-state-hint {
		margin-top: 8px;
		font-style: italic;
		color: var(--text3);
	}

	.favorit-stjerne {
		background: none;
		border: none;
		padding: 4px;
		cursor: pointer;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}
	.favorit-stjerne:hover {
		opacity: 0.7;
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
		font-size: calc(13.5px * var(--fs-scale, 1));
		font-weight: 500;
		color: var(--text);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.food-meta {
		font-size: calc(11px * var(--fs-scale, 1));
		color: var(--text3);
		margin-top: 2px;
	}

	.tilfoej-knap {
		width: 32px;
		height: 32px;
		border-radius: 50%;
		background: var(--terra);
		color: #fff;
		font-size: calc(18px * var(--fs-scale, 1));
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

	.udvidet-totaler {
		display: grid;
		grid-template-columns: 1fr 1fr 1fr;
		gap: 8px;
		margin-bottom: 14px;
		padding: 10px 12px;
		background: var(--bg2);
		border: 1px solid var(--border);
		border-radius: 10px;
	}

	.udvidet-celle {
		display: flex;
		flex-direction: column;
		gap: 2px;
		text-align: center;
	}

	.udvidet-lbl {
		font-size: calc(10px * var(--fs-scale, 1));
		font-weight: 500;
		letter-spacing: 0.04em;
		color: var(--text3);
	}

	.udvidet-val {
		font-family: var(--ff-d);
		font-size: calc(15px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--text);
	}

	.total-card {
		padding: 9px 12px;
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 12px;
	}

	.total-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 3px;
	}

	.total-label {
		font-size: calc(10px * var(--fs-scale, 1));
		font-weight: 600;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--text2);
	}

	.total-mål {
		font-size: calc(9.5px * var(--fs-scale, 1));
		color: var(--text3);
	}

	.total-val {
		font-family: var(--ff-d);
		font-size: calc(19px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--text);
		margin-bottom: 4px;
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
		font-size: calc(9px * var(--fs-scale, 1));
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
		font-size: calc(12px * var(--fs-scale, 1));
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
		font-size: calc(13px * var(--fs-scale, 1));
		font-weight: 500;
		color: var(--text);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.item-meta {
		font-size: calc(10.5px * var(--fs-scale, 1));
		color: var(--text3);
		margin-top: 2px;
	}

	.portion-input,
	.enhed-select {
		padding: 7px 8px;
		font-size: calc(12.5px * var(--fs-scale, 1));
		border-radius: 8px;
		border: 1px solid var(--border);
		background: var(--bg2);
		color: var(--text);
		font-family: var(--ff-b);
		outline: none;
	}

	.enhed-static {
		font-size: calc(12px * var(--fs-scale, 1));
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
		font-size: calc(16px * var(--fs-scale, 1));
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
		font-size: calc(14px * var(--fs-scale, 1));
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
		font-size: calc(13px * var(--fs-scale, 1));
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
		font-size: calc(12px * var(--fs-scale, 1));
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
		font-size: calc(14px * var(--fs-scale, 1));
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
		font-size: calc(16px * var(--fs-scale, 1));
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
		font-size: calc(14px * var(--fs-scale, 1));
		font-weight: 700;
		cursor: pointer;
		line-height: 1;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.portioner-val {
		font-size: calc(11px * var(--fs-scale, 1));
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
		font-size: calc(14px * var(--fs-scale, 1));
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
		font-size: calc(11px * var(--fs-scale, 1));
		font-weight: 700;
	}

	.nulstil-knap {
		width: 44px;
		height: 44px;
		border-radius: 50%;
		background: var(--white);
		border: 1px solid var(--border);
		color: var(--text2);
		font-size: calc(22px * var(--fs-scale, 1));
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
		font-size: calc(38px * var(--fs-scale, 1));
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
		font-size: calc(13.5px * var(--fs-scale, 1));
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
		font-size: calc(9.5px * var(--fs-scale, 1));
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
		height: 85dvh;
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
		font-size: calc(18px * var(--fs-scale, 1));
		font-weight: 600;
	}

	.modal-luk {
		width: 32px;
		height: 32px;
		border-radius: 50%;
		background: var(--bg2);
		border: none;
		color: var(--text2);
		font-size: calc(20px * var(--fs-scale, 1));
		cursor: pointer;
	}

	.picker-liste {
		display: flex;
		flex-direction: column;
		gap: 4px;
		overflow-y: auto;
		flex: 1 1 0;
		min-height: 0;
		-webkit-overflow-scrolling: touch;
	}

	/* Hold modal-head, søgefelt, toggle og tabs fastlimet til toppen så de
	   ikke scroller med picker-listen — ellers forsvinder søgefeltet når
	   listen er lang. */
	.modal > .modal-head,
	.modal > .search,
	.modal > .eksakt-toggle,
	.modal > .slap-tabs {
		flex-shrink: 0;
	}

	.eksakt-toggle {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 4px 0;
		font-size: calc(12px * var(--fs-scale, 1));
		color: var(--text3);
		cursor: pointer;
		user-select: none;
		align-self: flex-start;
	}
	.eksakt-toggle input {
		width: 14px;
		height: 14px;
		accent-color: var(--terra);
		cursor: pointer;
	}
	.eksakt-toggle.aktiv {
		color: var(--terra);
		font-weight: 600;
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
		font-size: calc(18px * var(--fs-scale, 1));
		color: var(--terra);
		font-weight: 600;
	}

	.picker-footer {
		flex-shrink: 0;
		padding: 8px 0 calc(8px + env(safe-area-inset-bottom));
		display: flex;
		justify-content: center;
		background: var(--white);
		border-top: 1px solid var(--border);
		margin-top: 4px;
	}

	.tilfoej-rad {
		display: flex;
		gap: 8px;
		align-items: stretch;
		margin-bottom: 14px;
	}

	.tilfoej-fodevare-knap {
		flex: 1 1 0;
		min-width: 0;
		text-align: center;
	}

	/* "Gem i dagbog"-knappen står ved siden af tilføj-knappen og skal være
	   samme størrelse. Override sage's margin-top via samme specificity. */
	.primary-knap.gem-i-rad {
		flex: 1 1 0;
		min-width: 0;
		margin-top: 0;
		text-align: center;
	}

	.scan-knap-direkte {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		padding: 13px;
		font-size: calc(14px * var(--fs-scale, 1));
		font-weight: 600;
		font-family: var(--ff-b);
		border-radius: 10px;
		background: linear-gradient(135deg, var(--terra) 0%, #a06b60 100%);
		border: none;
		color: #fff;
		cursor: pointer;
		box-shadow: 0 4px 12px rgba(184, 123, 110, 0.3);
	}

	.scan-knap-direkte:active {
		transform: scale(0.97);
	}

	.scan-knap-direkte:disabled {
		opacity: 0.7;
		cursor: wait;
	}

	.scan-banner {
		display: flex;
		align-items: center;
		gap: 12px;
		width: 100%;
		padding: 14px 16px;
		background: linear-gradient(135deg, var(--terra) 0%, #a06b60 100%);
		border: none;
		border-radius: 14px;
		color: #fff;
		text-align: left;
		cursor: pointer;
		font-family: var(--ff-b);
		flex-shrink: 0;
		box-shadow: 0 4px 12px rgba(184, 123, 110, 0.25);
	}

	.scan-banner:active {
		transform: scale(0.99);
	}

	.scan-banner:disabled {
		opacity: 0.7;
		cursor: wait;
	}

	.scan-banner-ikon {
		width: 44px;
		height: 44px;
		border-radius: 12px;
		background: rgba(255, 255, 255, 0.2);
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.scan-banner-tekst {
		flex: 1;
		display: flex;
		flex-direction: column;
		min-width: 0;
		gap: 2px;
	}

	.scan-banner-titel {
		font-size: calc(15px * var(--fs-scale, 1));
		font-weight: 600;
		letter-spacing: -0.005em;
	}

	.scan-banner-sub {
		font-size: calc(11.5px * var(--fs-scale, 1));
		color: rgba(255, 255, 255, 0.82);
		line-height: 1.3;
	}

	.manuel-link {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 4px;
		align-self: center;
		padding: 6px 12px;
		font-size: calc(12px * var(--fs-scale, 1));
		font-weight: 500;
		font-family: var(--ff-b);
		color: var(--terra);
		background: transparent;
		border: none;
		cursor: pointer;
		flex-shrink: 0;
	}

	.manuel-link:hover {
		text-decoration: underline;
	}

	.picker-row-wrap {
		display: flex;
		flex-direction: column;
		gap: 0;
	}

	.picker-row-flex {
		display: flex;
		align-items: stretch;
		gap: 4px;
	}
	.picker-row-flex .favorit-stjerne {
		align-self: center;
	}
	.picker-row-flex .picker-row {
		flex: 1;
	}

	.badge {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 18px;
		height: 18px;
		padding: 0 5px;
		font-size: calc(10px * var(--fs-scale, 1));
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
		font-size: calc(9.5px * var(--fs-scale, 1));
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
		font-size: calc(11px * var(--fs-scale, 1));
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
		font-size: calc(18px * var(--fs-scale, 1));
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
		font-size: calc(16px * var(--fs-scale, 1));
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
		font-size: calc(16px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--text);
		text-align: center;
		margin-bottom: 14px;
	}

	.byg-for-dag-knap {
		display: block;
		width: 100%;
		padding: 12px 14px;
		margin-bottom: 14px;
		background: var(--terra);
		color: #fff;
		font-family: var(--ff-b);
		font-size: calc(13.5px * var(--fs-scale, 1));
		font-weight: 600;
		border: none;
		border-radius: 10px;
		cursor: pointer;
	}

	.byg-for-dag-knap:hover {
		filter: brightness(0.95);
	}

	.dato-hint {
		padding: 10px 12px;
		margin-bottom: 12px;
		background: var(--tdim, #fbeeea);
		border: 1px solid var(--tdim2, #f0d6cf);
		border-radius: 10px;
		font-size: calc(12.5px * var(--fs-scale, 1));
		color: var(--text2);
		line-height: 1.4;
	}

	.dagbog-liste {
		display: flex;
		flex-direction: column;
		gap: 14px;
	}

	.type-overskrift {
		font-size: calc(11px * var(--fs-scale, 1));
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
		font-size: calc(14px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--text);
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.dagbog-totaler {
		font-size: calc(11.5px * var(--fs-scale, 1));
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
		font-size: calc(11px * var(--fs-scale, 1));
		font-weight: 600;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--text3);
	}

	.felt-input {
		padding: 10px 12px;
		font-size: calc(16px * var(--fs-scale, 1));
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
		font-size: calc(12.5px * var(--fs-scale, 1));
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
		font-size: calc(12.5px * var(--fs-scale, 1));
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

	.favorit-toggle-knap {
		display: flex;
		width: 100%;
		align-items: center;
		justify-content: space-between;
		padding: 11px 14px;
		margin-bottom: 12px;
		background: var(--bg2);
		border: 1px solid var(--border);
		border-radius: 10px;
		color: var(--text2);
		font-family: var(--ff-b);
		font-size: calc(13px * var(--fs-scale, 1));
		font-weight: 500;
		cursor: pointer;
	}
	.favorit-toggle-knap:hover {
		background: var(--white);
	}

	.kopier-modal {
		height: auto;
		max-height: 80dvh;
		padding-bottom: calc(14px + env(safe-area-inset-bottom));
	}
	.kopier-info {
		padding: 10px 12px;
		background: var(--bg2);
		border-radius: 10px;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.kopier-info-navn {
		font-family: var(--ff-b);
		font-weight: 600;
		color: var(--text);
	}
	.kopier-info-sub {
		font-size: calc(12px * var(--fs-scale, 1));
		color: var(--text3);
	}
	.kopier-genveje {
		display: flex;
		gap: 6px;
		margin-bottom: 4px;
	}
	.genvej-knap {
		flex: 1;
		padding: 8px 10px;
		font-size: calc(12.5px * var(--fs-scale, 1));
		font-family: var(--ff-b);
		color: var(--text2);
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 99px;
		cursor: pointer;
	}
	.genvej-knap:hover {
		background: var(--bg2);
	}

	.favorit-modal-row {
		display: flex;
		align-items: stretch;
		gap: 6px;
		padding: 6px 0;
		border-bottom: 1px solid var(--border);
	}
	.favorit-modal-row:last-child {
		border-bottom: none;
	}
	.favorit-modal-vaelg {
		flex: 1;
		text-align: left;
		background: none;
		border: none;
		padding: 6px 8px;
		font-family: var(--ff-b);
		cursor: pointer;
		display: flex;
		flex-direction: column;
		gap: 2px;
		color: var(--text);
	}
	.favorit-modal-vaelg:hover {
		background: var(--bg2);
		border-radius: 8px;
	}

	.favorit-overskrift {
		font-size: calc(11px * var(--fs-scale, 1));
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
		font-size: calc(13px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--text);
		line-height: 1.3;
		padding-right: 22px;
	}

	.favorit-antal {
		font-size: calc(11px * var(--fs-scale, 1));
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
		font-size: calc(12px * var(--fs-scale, 1));
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
		font-size: calc(10.5px * var(--fs-scale, 1));
		font-weight: 600;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--terra);
	}

	.rediger-navn-input {
		padding: 7px 10px;
		font-size: calc(14px * var(--fs-scale, 1));
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
		font-size: calc(14px * var(--fs-scale, 1));
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
		font-size: calc(18px * var(--fs-scale, 1));
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
		font-size: calc(13px * var(--fs-scale, 1));
		color: var(--text);
		font-weight: 500;
	}

	.favorit-toggle-sub {
		font-size: calc(11.5px * var(--fs-scale, 1));
		color: var(--text3);
		margin-top: 1px;
		line-height: 1.4;
	}

	.mine-tilfoj {
		display: block;
		text-align: center;
		text-decoration: none;
		margin-bottom: 14px;
	}

	.tom-boks {
		padding: 24px 16px;
		background: var(--bg2);
		border: 1px dashed var(--border);
		border-radius: 12px;
		text-align: center;
		color: var(--text2);
		font-size: calc(13px * var(--fs-scale, 1));
		line-height: 1.5;
	}

	.tom-boks p {
		margin: 0;
	}

	.mine-liste {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.mine-item {
		display: flex;
		gap: 12px;
		padding: 10px;
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 12px;
		text-decoration: none;
		color: inherit;
	}

	.mine-item:hover {
		border-color: var(--terra);
	}

	.mine-billede {
		width: 64px;
		height: 64px;
		object-fit: cover;
		border-radius: 10px;
		flex-shrink: 0;
		background: var(--bg2);
	}

	.mine-billede.placeholder {
		background: var(--bg2);
	}

	.mine-tekst {
		flex: 1;
		min-width: 0;
	}

	.mine-navn {
		font-size: calc(14px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--text);
	}

	.mine-meta {
		font-size: calc(11.5px * var(--fs-scale, 1));
		color: var(--text3);
		margin-top: 2px;
		line-height: 1.4;
	}
</style>
