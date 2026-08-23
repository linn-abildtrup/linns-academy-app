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

// Hvor mange filer vi henter ad gangen naar en ny version gemmes paa forhaand.
// Foer blev alle knap 300 fyret af paa én gang, og saa kaemper de om den samme
// mobilforbindelse som appens egne kald. Med et hold ad gangen tager hentningen
// lidt laengere i alt, men den fylder mindre undervejs, og det er det rigtige
// bytte for noget der koerer i baggrunden.
const HOLD_STOERRELSE = 12;

sw.addEventListener('install', (event) => {
	event.waitUntil(gemPaaForhaand());
	sw.skipWaiting();
});

/**
 * Gemmer app'ens filer paa forhaand, saa den ogsaa virker uden net.
 *
 * Foer stod her cache.addAll(), og den er alt-eller-intet: fejler ét eneste
 * kald, fx fordi en fil naaede at forsvinde midt i en udrulning eller fordi
 * forbindelsen knak paa den 200. fil, saa kastes HELE hentningen vaek. Der
 * bliver ikke gemt noget som helst, og saa proever den forfra ved hver eneste
 * app-start indtil den lykkes. Paa en daarlig forbindelse kan den tilstand
 * blive ved i lang tid.
 *
 * Nu hentes filerne i hold, og de faar lov at staa ved hver for sig. Én fil
 * der ikke kan hentes koster nu netop den ene fil, og den bliver gemt af sig
 * selv naeste gang nogen bruger den, se fetch-haandteringen laengere nede.
 */
async function gemPaaForhaand(): Promise<void> {
	const cache = await caches.open(ASSET_CACHE);
	let fejlede = 0;

	for (let i = 0; i < ALLE_ASSETS.length; i += HOLD_STOERRELSE) {
		const hold = ALLE_ASSETS.slice(i, i + HOLD_STOERRELSE);
		const udfald = await Promise.allSettled(hold.map((sti) => cache.add(sti)));
		fejlede += udfald.filter((u) => u.status === 'rejected').length;
	}

	if (fejlede > 0) {
		console.warn(`[sw] ${fejlede} af ${ALLE_ASSETS.length} filer kunne ikke gemmes paa forhaand`);
	}
}

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
	// rejection inde i service workeren. null betyder "nettet svarede ikke".
	const fraNettet = fetch(req).catch(() => null);

	// Selve gemningen holdes UDEN FOR svaret til kunden. Er browserens lagring
	// slaaet fra, fx privat vindue, fuld kvota eller en iPhone der har ryddet
	// op, kaster caches. Det maa aldrig kunne vaelte en hentning der gik fint.
	const faerdig = fraNettet.then(async (res) => {
		if (!res?.ok) return res;
		// Klones med det samme, foer nogen begynder at laese svaret.
		const tilCache = res.clone();
		try {
			const cache = await caches.open(NAVIGATION_CACHE);
			await cache.put(req, tilCache);
		} catch {
			// Ingen lagring til raadighed. Ikke kritisk, kunden faar sit svar.
		}
		return res;
	});

	// Hold service workeren i live til baggrunds-hentningen er faerdig, ogsaa
	// efter vi har svaret kunden med kopien.
	try {
		event.waitUntil(faerdig);
	} catch {
		// Ikke kritisk. Baggrunds-opdateringen naar det maaske ikke, men kunden
		// faar stadig sit svar.
	}

	// Samme forsigtighed her. Kan vi ikke laese lagringen, opfoerer vi os som en
	// helt almindelig hentning i stedet for at fejle.
	let kopi: Response | undefined;
	try {
		const cache = await caches.open(NAVIGATION_CACHE);
		kopi = (await cache.match(req)) ?? (await caches.match('/'));
	} catch {
		kopi = undefined;
	}

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

// ============================================================
// Beskeder paa telefonen. Bygget 23. august 2026, se HANDOVER 9.39.
//
// Den her del koerer OGSAA naar appen er lukket. Den er derfor holdt saa
// enkel som overhovedet muligt: der laeses ikke fra databasen, og der
// hentes ingenting. Alt hvad beskeden skal sige, staar i selve pakken.
//
// PAA IPHONE VIRKER DET KUN naar appen er lagt paa hjemmeskaermen. Det er
// Apples regel, ikke vores, og der er ingen vej udenom.
//
// KUN 3.0. Linns krav 23. august: der maa ALDRIG sendes til en kunde i
// den gamle app. Filen her deles af begge, men det goer ingen forskel:
// en telefon kan kun modtage hvis den har sagt ja, og der spoerges kun
// paa /ny. Dertil tjekkes adgangen én gang til lige foer afsendelsen,
// se firestore/notifikation3.ts. To laase om det samme, med vilje.
//
// Filen her er DELT MED DEN GAMLE APP, og de to blokke nedenfor er det
// eneste 3.0 har lagt i den. Linns ja 23. august. Roerer du dem, saa husk
// at en fejl her rammer alle 760 kunder og ikke kun 3.0.
// ============================================================

interface NotiPakke {
	titel: string;
	tekst: string;
	sti: string;
	slags: string;
}

sw.addEventListener('push', (event) => {
	const e = event as PushEvent;
	// Uden indhold viser vi ingenting. En tom besked er vaerre end ingen:
	// hun aabner appen og finder ikke ud af hvorfor.
	if (!e.data) return;

	let pakke: NotiPakke;
	try {
		pakke = e.data.json() as NotiPakke;
	} catch {
		return;
	}
	if (!pakke?.titel) return;

	e.waitUntil(
		(async () => {
			// ER APPEN AABEN? Saa river vi hende ikke vaek fra det hun er i
			// gang med. Vi sender beskeden ind i appen, som laegger en stille
			// stribe oeverst hun selv kan trykke paa. Linns valg 23. august,
			// se HANDOVER 9.41.
			const vinduer = await sw.clients.matchAll({ type: 'window', includeUncontrolled: true });
			const synlig = vinduer.find((v) => (v as WindowClient).visibilityState === 'visible');
			if (synlig) {
				synlig.postMessage({ slags: 'noti3', pakke });
				return;
			}
			await vis(pakke);
		})()
	);
});

async function vis(pakke: NotiPakke) {
	await sw.registration.showNotification(pakke.titel, {
		body: pakke.tekst,
		icon: '/icon-ny-192.png',
		badge: '/icon-ny-192.png',
		// HVER BESKED FRA LINN ER SIN EGEN, saa to svar staar som to
		// beskeder paa laaseskaermen. Linns beslutning 23. august.
		//
		// De to andre slags erstatter hinanden: "dagen er klar" og et savn
		// sker af sig selv, og to af dem oven i hinanden er stoej.
		...(pakke.slags === 'svar' ? {} : { tag: `linn-${pakke.slags}` }),
		data: { sti: pakke.sti || '/ny' }
	});
}

sw.addEventListener('notificationclick', (event) => {
	const e = event as NotificationEvent;
	e.notification.close();
	const sti = (e.notification.data as { sti?: string })?.sti ?? '/ny';

	// Har hun appen aabne i forvejen, skal vi IKKE aabne et vindue mere.
	// Vi flytter hende hen paa det rigtige sted i det hun allerede har.
	e.waitUntil(
		(async () => {
			const vinduer = await sw.clients.matchAll({ type: 'window', includeUncontrolled: true });
			for (const v of vinduer) {
				if ('focus' in v) {
					await (v as WindowClient).navigate(sti).catch(() => undefined);
					return (v as WindowClient).focus();
				}
			}
			return sw.clients.openWindow(sti);
		})()
	);
});
