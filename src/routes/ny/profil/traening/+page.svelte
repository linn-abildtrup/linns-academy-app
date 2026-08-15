<script lang="ts">
	// ============================================================
	// "Saadan traener jeg". Bid 3, 15. august 2026.
	//
	// Kundens udstyrsvalg. Det bor KUN her i Profil, Linns valg
	// 15. august. Naar onboarding bygges, genbruger den samme komponent.
	// ============================================================

	import { getContext, onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import type { User } from 'firebase/auth';
	import type { UserDoc } from '$lib/types';
	import Ventetegn from '$lib/components/ny/Ventetegn.svelte';
	import UdstyrValg from '$lib/components/ny/UdstyrValg.svelte';
	import {
		rensUdstyr3,
		udstyrFra,
		valgbareKategorier3,
		type TraeningKategori3
	} from '$lib/content/traeningKategori3';
	import { hentKategorier3 } from '$lib/firestore/traeningKategori3';
	import { gemUdstyr3 } from '$lib/firestore/traeningUdstyr3';

	const hentUser = getContext<() => User | null>('user');
	const hentUserDoc = getContext<() => UserDoc | null>('userDoc');
	const user = $derived(hentUser());
	const userDoc = $derived(hentUserDoc());

	let henter = $state(true);
	let gemmer = $state(false);
	let fejl = $state('');
	let kategorier = $state<TraeningKategori3[]>([]);

	const valgte = $derived(rensUdstyr3(udstyrFra(userDoc), kategorier));

	onMount(async () => {
		try {
			kategorier = await hentKategorier3();
		} catch (e) {
			console.warn('[ny] kunne ikke hente kategorier', e);
			fejl = 'Kunne ikke hente. Prøv igen om lidt.';
		} finally {
			henter = false;
		}
	});

	async function gem(markerede: string[]) {
		const uid = user?.uid;
		if (!uid || gemmer) return;
		gemmer = true;
		fejl = '';
		try {
			// Kun de valgbare gemmes. Dem der vises altid gaelder uanset hvad,
			// og et gemt id ville blive forkert den dag fluebenet flyttes.
			const gyldige = new Set(valgbareKategorier3(kategorier).map((k) => k.id));
			await gemUdstyr3(uid, markerede.filter((id) => gyldige.has(id)));
			await goto('/ny/profil');
		} catch (e) {
			console.error('[ny] kunne ikke gemme udstyret', e);
			fejl = 'Kunne ikke gemme. Prøv igen.';
			gemmer = false;
		}
	}
</script>

<svelte:head><title>Sådan træner jeg</title></svelte:head>

<div class="ny-pad tv-side">
	<header class="side-top" style="padding-left:0;padding-right:0">
		<a class="tr-tilbage" href="/ny/profil">‹ Din konto</a>
		<h1>Hvad træner du med?</h1>
		<p class="tv-under">
			Så viser jeg dig kun de programmer du kan bruge. Du kan altid ændre det.
		</p>
	</header>

	{#if henter}
		<div class="adm-venter"><Ventetegn variant="lille" /><span>Henter</span></div>
	{:else if kategorier.length === 0}
		<p class="kort rolig">Der er ikke noget at vælge imellem endnu.</p>
	{:else}
		{#if fejl}<p class="adm-fejl">{fejl}</p>{/if}
		<UdstyrValg {kategorier} {valgte} {gemmer} {gem} />
	{/if}
</div>
