<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import { initTextScale } from '$lib/utils/textScale';

	let { children } = $props();

	// Auto-opdater service worker saa kunderne faar nye versioner uden at
	// skulle lukke og aabne app/browser. Service workeren har 'skipWaiting'
	// + 'clients.claim' (se src/service-worker.ts), saa naar en ny SW
	// installeres tager den straks over som controller. Vi reloader siden
	// ved 'controllerchange', og tjekker periodisk + ved focus om der er
	// en ny SW at installere.
	function startServiceWorkerAutoUpdate() {
		if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

		// Reload siden naar en ny SW har taget over saa den nye JS bruges.
		// SW'en aktiveres allerede automatisk; reload er for at sikre at
		// klient-koden i denne fane bruger den nye version.
		let reloadPlanlagt = false;
		navigator.serviceWorker.addEventListener('controllerchange', () => {
			if (reloadPlanlagt) return;
			reloadPlanlagt = true;
			window.location.reload();
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

	onMount(() => {
		initTextScale();
		startServiceWorkerAutoUpdate();
	});
</script>

{@render children()}
