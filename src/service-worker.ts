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

	// For navigation requests (HTML): network-first, fald tilbage til cache
	// hvis offline. Det sikrer at brugeren altid får nyeste version når
	// online, men kan stadig bruge appen offline.
	if (req.mode === 'navigate') {
		event.respondWith(
			(async () => {
				try {
					const res = await fetch(req);
					if (res.ok) {
						const cache = await caches.open(NAVIGATION_CACHE);
						cache.put(req, res.clone());
					}
					return res;
				} catch {
					const cached = await caches.match(req);
					if (cached) return cached;
					// Sidste udvej: forsiden fra cache
					const forsiden = await caches.match('/');
					if (forsiden) return forsiden;
					throw new Error('offline og ingen cache');
				}
			})()
		);
		return;
	}

	// Alt andet: lad gå direkte til netværk (eller browser-håndteret)
});
