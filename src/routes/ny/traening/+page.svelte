<script lang="ts">
	// ============================================================
	// Mikrotraening. Kundens egen side. Bid 3, 15. august 2026.
	//
	// Hun ser de programmer hun har faaet, filtreret efter det udstyr
	// hun har valgt. Det hun sidst traenede ligger oeverst.
	//
	// INGEN VAELG-KNAP. Hun skal ikke foerst udpege et program og saa
	// starte det, det er to trin til det samme.
	//
	// Filtreringen bruger programmerForKunde3, altsaa NOEJAGTIG den
	// samme funktion som admin-opslaget i bid 2. To udgaver af den regel
	// ville drive fra hinanden, og saa ville admin sige noget andet end
	// kunden oplever.
	//
	// Hun kan endnu ikke starte en traening. Afspilleren er bid 4.
	// ============================================================

	import { getContext, onMount } from 'svelte';
	import type { User } from 'firebase/auth';
	import type { UserDoc } from '$lib/types';
	import Ventetegn from '$lib/components/ny/Ventetegn.svelte';
	import type { Adgangsbillede, ForlobKilde } from '$lib/content/adgang3';
	import {
		kategoriNavn3,
		rensUdstyr3,
		udstyrFra,
		type TraeningKategori3
	} from '$lib/content/traeningKategori3';
	import type { Traeningsprogram3 } from '$lib/content/traeningsprogram3';
	import {
		maaByggeEget3,
		programmerForKunde3,
		type KundeKontekst3
	} from '$lib/content/traeningTildeling3';
	import { tilProgram3, type MinTraening3 } from '$lib/content/mineTraeninger3';
	import {
		antalTraeninger3,
		fremgangTekst3,
		kundeProgrammer3,
		type KundeProgram3,
		type Traeningsfremgang3
	} from '$lib/content/traeningFremgang3';
	import { hentKategorier3 } from '$lib/firestore/traeningKategori3';
	import { hentProgrammer3 } from '$lib/firestore/traeningsprogram3';
	import { hentMineTildelinger3 } from '$lib/firestore/traeningTildeling3';
	import { hentFremgang3 } from '$lib/firestore/traeningFremgang3';
	import { hentMineTraeninger3 } from '$lib/firestore/mineTraeninger3';
	import { harAbonnement3, isoDato3 } from '$lib/firestore/traeningKunde3';
	import type { Traeningstildeling3 } from '$lib/content/traeningTildeling3';

	const hentUser = getContext<() => User | null>('user');
	const hentUserDoc = getContext<() => UserDoc | null>('userDoc');
	const hentAdgang = getContext<() => Adgangsbillede>('adgang');
	const hentForlob = getContext<() => ForlobKilde[]>('forlob');

	const user = $derived(hentUser());
	const userDoc = $derived(hentUserDoc());
	const adgang = $derived(hentAdgang());
	const forlob = $derived(hentForlob?.() ?? []);

	let henter = $state(true);
	let fejl = $state('');
	let kategorier = $state<TraeningKategori3[]>([]);
	let programmer = $state<Traeningsprogram3[]>([]);
	let tildelinger = $state<Traeningstildeling3[]>([]);
	let fremgang = $state<Map<string, Traeningsfremgang3>>(new Map());
	let mine3 = $state<MinTraening3[]>([]);

	const nu = Date.now();

	const kontekst = $derived<KundeKontekst3>({
		uid: user?.uid ?? '',
		forlob: adgang.aktiveForlob.map((f) => ({ id: f.forlobId, dag: f.dagNummer })),
		harAbonnement: harAbonnement3(userDoc, forlob, nu),
		udstyr: rensUdstyr3(udstyrFra(userDoc), kategorier),
		idag: isoDato3(nu)
	});

	const fraLinn = $derived(
		programmerForKunde3(programmer, tildelinger, kategorier, kontekst)
			.filter((x) => x.vises)
			.map((x) => x.program)
	);

	// Hendes egne filtreres IKKE paa udstyr. Hun har selv valgt oevelserne,
	// saa der er ingen kategori at filtrere paa.
	const maaBygge = $derived(maaByggeEget3(tildelinger, kontekst));
	const egne = $derived(maaBygge ? mine3.map(tilProgram3) : []);

	const liste = $derived<KundeProgram3[]>(
		kundeProgrammer3([...fraLinn, ...egne], fremgang)
	);
	const iGang = $derived(liste.filter((k) => k.iGang));
	const oevrige = $derived(liste.filter((k) => !k.iGang));

	onMount(async () => {
		const uid = user?.uid;
		if (!uid) {
			henter = false;
			return;
		}
		try {
			const [k, p, t, f, egneRaa] = await Promise.all([
				hentKategorier3(),
				hentProgrammer3(),
				hentMineTildelinger3(uid),
				hentFremgang3(uid),
				// Hendes egne er en tilgift. Kan de ikke hentes, skal Linns
				// programmer stadig kunne vises.
				hentMineTraeninger3(uid).catch((e) => {
					console.warn('[ny] kunne ikke hente egne programmer', e);
					return [];
				})
			]);
			kategorier = k;
			programmer = p;
			tildelinger = t;
			fremgang = f;
			mine3 = egneRaa;
		} catch (e) {
			console.error('[ny] kunne ikke hente traeningen', e);
			fejl = 'Din træning kunne ikke hentes lige nu. Prøv igen om lidt.';
		} finally {
			henter = false;
		}
	});

	function undertekst(k: KundeProgram3): string {
		const kategori = k.program.egen ? '' : kategoriNavn3(k.program.kategoriId, kategorier);
		const antal = antalTraeninger3(k.program);
		const dele = [kategori, antal === 1 ? '1 træning' : `${antal} træninger`].filter(Boolean);
		return dele.join(' · ');
	}
</script>

<svelte:head><title>Mikrotræning</title></svelte:head>

<div class="ny-pad mt-side">
	<header class="side-top" style="padding-left:0;padding-right:0">
		<a class="tr-tilbage" href="/ny">‹ Forside</a>
		<h1>Mikrotræning</h1>
	</header>

	{#if henter}
		<div class="adm-venter"><Ventetegn variant="lille" /><span>Henter din træning</span></div>
	{:else if fejl}
		<p class="kort rolig">{fejl}</p>
	{:else if liste.length === 0}
		<div class="mt-tom">
			<strong>Du har ikke fået nogen træning endnu.</strong>
			<p>Linn lægger den ind når den er klar til dig.</p>
		</div>
		{#if maaBygge}
			<a class="mt-byg" href="/ny/traening/byg-eget">+ Byg dit eget program</a>
		{/if}
	{:else}
		<p class="mt-under">Vælg det program du har lyst til. Du kan skifte når du vil.</p>

		{#if iGang.length > 0}
			<div class="lab"><h2>Du er i gang med</h2></div>
			{#each iGang as k (k.program.id)}
				<a class="mt-prog igang" href={`/ny/traening/${k.program.id}`}>
					<div class="mt-navn">
						{k.program.navn}{#if k.program.egen}<span class="mt-egen">Din egen</span>{/if}
					</div>
					<div class="mt-meta">{undertekst(k)}</div>
					<div class="mt-bar"><i style={`width:${k.procent}%`}></i></div>
					<div class="mt-fremgang">{fremgangTekst3(k)}</div>
					<span class="mt-knap">Fortsæt</span>
				</a>
			{/each}
		{/if}

		{#if oevrige.length > 0}
			{#if iGang.length > 0}
				<div class="lab"><h2>Dine andre programmer</h2></div>
			{/if}
			{#each oevrige as k (k.program.id)}
				<a class="mt-prog" href={`/ny/traening/${k.program.id}`}>
					<div class="mt-navn">
						{k.program.navn}{#if k.program.egen}<span class="mt-egen">Din egen</span>{/if}
					</div>
					<div class="mt-meta">{undertekst(k)}</div>
					<div class="mt-fremgang">{fremgangTekst3(k)}</div>
					<span class="mt-knap">{k.faerdig ? 'Tag den igen' : 'Start'}</span>
				</a>
			{/each}
		{/if}

		{#if maaBygge}
			<a class="mt-byg" href="/ny/traening/byg-eget">+ Byg dit eget program</a>
		{/if}
	{/if}
</div>
