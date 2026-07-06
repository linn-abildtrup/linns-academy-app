<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import { beforeNavigate } from '$app/navigation';
	import { initTextScale } from '$lib/utils/textScale';

	let { children } = $props();

	// Sat når en ny app-version er klar (ny service worker har taget over). Vi
	// reloader IKKE straks — det ville afbryde det kunden er i gang med (fx en
	// kørende video-lektion). I stedet anvendes den nye version ved næste
	// navigation, se beforeNavigate nedenfor.
	let opdateringVenter = false;

	// Anvend en ventende opdatering på det roligste tidspunkt: næste gang kunden
	// navigerer et nyt sted hen. En fuld indlæsning af DESTINATIONEN henter den
	// nye version og lander kunden hvor hun ville hen — uden at afbryde video,
	// udfyldelse eller lignende. (SvelteKits anbefalede mønster for ventende
	// opdateringer.) willUnload-tjekket undgår at gribe ind i luk/ekstern-nav.
	beforeNavigate((nav) => {
		if (!opdateringVenter || nav.willUnload || !nav.to) return;
		window.location.href = nav.to.url.href;
	});

	// Auto-opdater service worker saa kunderne faar nye versioner uden at
	// skulle lukke og aabne app/browser. Service workeren har 'skipWaiting'
	// + 'clients.claim' (se src/service-worker.ts), saa naar en ny SW
	// installeres tager den straks over som controller. Vi markerer at en
	// opdatering venter og anvender den ved naeste navigation (beforeNavigate),
	// og tjekker periodisk + ved focus om der er en ny SW at installere.
	function startServiceWorkerAutoUpdate() {
		if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

		// Ny SW har taget over → marker at en opdatering venter. Vi genindlaeser
		// IKKE straks (det ville afbryde fx en video); den nye version anvendes
		// ved naeste navigation via beforeNavigate ovenfor.
		navigator.serviceWorker.addEventListener('controllerchange', () => {
			opdateringVenter = true;
		});

		// Periodisk check + ved focus. Browseren tjekker normalt kun ved
		// foerste besoeg — uden disse kald vil en aaben app aldrig opdage
		// nye versioner.
		void navigator.serviceWorker.ready.then((registration) => {
			const tjek = () => void registration.update().catch(() => {});
			setInterval(tjek, 15 * 60 * 1000); // hver 15 min
			window.addEventListener('focus', tjek);
		});
	}

	// Selv-helbredelse: naar en ny version er deployet skifter app'ens JS-filer
	// navn. Har brugeren en gammel version cached (typisk PWA), kan en lazy-
	// loaded fil mangle — saa haenger appen i stedet for at loade. Vite
	// dispatcher 'vite:preloadError' i det tilfaelde; vi genindlaeser saa den
	// nye version hentes. Loop-guard via sessionStorage saa vi ikke kan ende i
	// en uendelig reload (fx hvis serveren faktisk er nede).
	function startChunkFejlSelvhelbredelse() {
		if (typeof window === 'undefined') return;
		window.addEventListener('vite:preloadError', (event) => {
			event.preventDefault();
			let sidst = 0;
			try {
				sidst = Number(sessionStorage.getItem('chunkReloadAt') ?? '0');
			} catch {
				/* sessionStorage utilgaengelig — fortsaet */
			}
			if (Date.now() - sidst < 10_000) return; // allerede genindlaest for nylig
			try {
				sessionStorage.setItem('chunkReloadAt', String(Date.now()));
			} catch {
				/* ignore */
			}
			window.location.reload();
		});
	}

	onMount(() => {
		initTextScale();
		startServiceWorkerAutoUpdate();
		startChunkFejlSelvhelbredelse();
	});
</script>

{@render children()}
