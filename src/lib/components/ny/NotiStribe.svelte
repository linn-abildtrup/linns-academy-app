<script lang="ts">
	// ============================================================
	// Striben naar en besked kommer mens appen er aaben.
	//
	// HVORFOR DEN FINDES. Telefonen viser typisk ingenting naar appen er
	// fremme, og vi vil ikke rive hende vaek fra det hun er i gang med.
	// I stedet lander beskeden som en stille stribe oeverst, hun kan
	// trykke paa eller lade ligge. Linns valg 23. august, se 9.41.
	//
	// DEN FORSVINDER AF SIG SELV efter otte sekunder. Laenge nok til at
	// blive laest, kort nok til ikke at staa i vejen.
	//
	// KOMMER DER ÉN TIL, erstatter den den foerste. To striber oven i
	// hinanden ville daekke det hun kigger paa.
	// ============================================================

	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';

	interface Pakke {
		titel: string;
		tekst: string;
		sti: string;
		slags: string;
	}

	let vist = $state<Pakke | null>(null);
	let ur: ReturnType<typeof setTimeout> | null = null;

	onMount(() => {
		if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

		function modtag(e: MessageEvent) {
			const d = e.data as { slags?: string; pakke?: Pakke } | null;
			if (d?.slags !== 'noti3' || !d.pakke?.titel) return;
			vist = d.pakke;
			if (ur) clearTimeout(ur);
			ur = setTimeout(() => (vist = null), 8000);
		}

		navigator.serviceWorker.addEventListener('message', modtag);
		return () => {
			navigator.serviceWorker.removeEventListener('message', modtag);
			if (ur) clearTimeout(ur);
		};
	});

	async function aabn() {
		const sti = vist?.sti ?? '/ny';
		vist = null;
		// invalidateAll saa siden henter forfra. Uden det lander hun paa en
		// skaerm der allerede stod der, med det den hentede sidste gang, og
		// saa er beskeden ikke med. Se HANDOVER 9.46.
		await goto(sti, { invalidateAll: true });
	}
</script>

{#if vist}
	<div class="noti-stribe" role="status">
		<button class="ns-krop" onclick={aabn}>
			<span class="ns-l" aria-hidden="true">L</span>
			<span class="ns-tekst">
				<span class="ns-t">{vist.titel}</span>
				<span class="ns-s">{vist.tekst || 'Tryk for at læse'}</span>
			</span>
		</button>
		<button class="ns-luk" aria-label="Luk" onclick={() => (vist = null)}>×</button>
	</div>
{/if}
