// Service Worker — cacher app-shell (HTML/JS/CSS) så appen åbner instant
// på 2. besøg og virker offline.
//
// SvelteKit auto-registrerer denne fil og injicerer $service-worker-modul
// med liste af built assets. Vi følger standard "cache-first for assets,
// network-first for everything else"-mønstret.
//
// Vigtigt for vores app:
// - Firestore-data går ALDRIG gennem SW — Firebase SDK håndterer sin egen
//   IndexedDB-cache og online-detection. Vi rører ikke Firestore-requests.
// - Firebase Storage (videoer) cachees af browseren via dets egne
//   Cache-Control-headers. Vi går heller ikke i vejen for dem.
// - App-shell (vores HTML/JS/CSS) cachees aggressivt.

/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />

import { build, files, version } from '$service-worker';

const sw = self as unknown as ServiceWorkerGlobalScope;

const ASSET_CACHE = `assets-${version}`;
const NAVIGATION_CACHE = `navigation-${version}`;

// Hvor laenge nettet maa vaere om at svare paa selve app-skallen (HTML), foer
// vi serverer den gemte kopi i stedet. En almindelig hentning tager 0,2-0,5
// sek, saa 3 sek er rigelig plads til en langsom forbindelse.
const NAV_TIMEOUT_MS = 3000;

// Alle built JS/CSS/font-assets — har hashed filnavne, så de er sikre at
// cache for evigt (gamle versioner ryddes når en ny SW aktiveres).
const ALLE_ASSETS = [...build, ...files];

sw.addEventListener('install', (event) => {
	// Pre-cache alle assets — det tager 1-2 sek ved første besøg, men
	// efter det er appen instant.
	event.waitUntil(caches.open(ASSET_CACHE).then((cache) => cache.addAll(ALLE_ASSETS)));
	sw.skipWaiting();
});

sw.addEventListener('activate', (event) => {
	// Slet gamle cache-versioner når en ny SW aktiveres
	event.waitUntil(
		caches.keys().then(async (navne) => {
			for (const navn of navne) {
				if (navn !== ASSET_CACHE && navn !== NAVIGATION_CACHE) {
					await caches.delete(navn);
				}
			}
			await sw.clients.claim();
		})
	);
});

sw.addEventListener('fetch', (event) => {
	const req = event.request;
	if (req.method !== 'GET') return;

	const url = new URL(req.url);

	// Lad Firestore- og Firebase-Auth-requests gå direkte til netværk —
	// Firebase SDK har sin egen IndexedDB-cache og online-håndtering.
	if (
		url.hostname.includes('firestore.googleapis.com') ||
		url.hostname.includes('identitytoolkit.googleapis.com') ||
		url.hostname.includes('securetoken.googleapis.com') ||
		url.hostname.includes('firebaseio.com')
	) {
		return;
	}

	// Lad Firebase Storage gå direkte — videoer har egne Cache-Control
	if (url.hostname.includes('firebasestorage.googleapis.com')) {
		return;
	}

	// Lad Anthropic API + Simplero + andre externe APIs gå direkte
	if (url.origin !== sw.location.origin) {
		return;
	}

	// For built assets (i ALLE_ASSETS): cache-first
	if (ALLE_ASSETS.includes(url.pathname)) {
		event.respondWith(
			caches.open(ASSET_CACHE).then(async (cache) => {
				const cached = await cache.match(req);
				if (cached) return cached;
				const res = await fetch(req);
				// Cache kun gode svar — ellers kan en enkelt 404 (fx en asset der
				// mangler under en deploy) blive gemt permanent i cachen.
				if (res.ok) cache.put(req, res.clone());
				return res;
			})
		);
		return;
	}

	// For navigation requests (HTML): se navigationSvar nedenfor.
	if (req.mode === 'navigate') {
		event.respondWith(navigationSvar(event));
		return;
	}

	// Alt andet: lad gå direkte til netværk (eller browser-håndteret)
});

/**
 * Svarer paa en navigation, altsaa selve app-skallen (HTML).
 *
 * Foer spurgte vi ALTID nettet foerst og faldt kun tilbage til den gemte kopi
 * hvis nettet sagde klart nej. Er forbindelsen der, men doed, hvilket er helt
 * normalt naar en telefon lige er vaagnet eller skifter mellem wifi og
 * mobilnet, kan browseren bruge et minut foer den giver op. Kunden ser en tom
 * skaerm imens, selv om kopien laa klar hele tiden.
 *
 * Nu faar nettet NAV_TIMEOUT_MS. Naar tiden er gaaet, serverer vi kopien og
 * lader hentningen loebe faerdig i baggrunden, saa cachen er frisk til naeste
 * opstart. Har vi ingen kopi, venter vi paa nettet praecis som foer.
 *
 * Konsekvens ved en langsom forbindelse lige efter en udrulning: kunden kan
 * faa den forrige version én gang. Baggrunds-hentningen opdaterer kopien, og
 * de eksisterende mekanismer (SW-update ved focus, controllerchange og
 * vite:preloadError-selvhelbredelsen i routes/+layout.svelte) bringer hende
 * paa den nye version. Det er en bevidst byttehandel: ét ekstra gensyn med
 * den gamle version vejer mindre end et minuts sort skaerm.
 */
async function navigationSvar(event: FetchEvent): Promise<Response> {
	const req = event.request;

	// Start hentningen og reserver service workerens levetid FOER vi venter paa
	// noget som helst. Begge dele skal ske synkront: kaldes waitUntil efter et
	// await, kan enkelte browsere afvise det.
	//
	// .catch() er vigtig: uden den bliver et fejlet kald til en ubehandlet
	// rejection inde i service workeren.
	const fraNettet = fetch(req)
		.then(async (res) => {
			if (res.ok) {
				const cache = await caches.open(NAVIGATION_CACHE);
				await cache.put(req, res.clone());
			}
			return res;
		})
		.catch(() => null);

	// Hold service workeren i live til baggrunds-hentningen er faerdig, ogsaa
	// efter vi har svaret kunden med kopien.
	try {
		event.waitUntil(fraNettet);
	} catch {
		// Ikke kritisk. Baggrunds-opdateringen naar det maaske ikke, men kunden
		// faar stadig sit svar.
	}

	const cache = await caches.open(NAVIGATION_CACHE);
	const kopi = (await cache.match(req)) ?? (await caches.match('/'));

	// Ingen kopi at falde tilbage paa, fx allerfoerste besoeg. Saa maa vi vente.
	if (!kopi) {
		const res = await fraNettet;
		if (res) return res;
		throw new Error('offline og ingen cache');
	}

	const svar = await Promise.race([
		fraNettet,
		new Promise<null>((afslut) => setTimeout(() => afslut(null), NAV_TIMEOUT_MS))
	]);

	return svar ?? kopi;
}
