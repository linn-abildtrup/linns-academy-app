<script lang="ts">
	// ============================================================
	// Admin: slaa en kunde op og se hvad hun har, og hvorfor.
	// Bid 2, 15. august 2026.
	//
	// Til den dag hun skriver at hun ikke kan se sin traening. "Ser
	// ikke" er den vigtige halvdel: der staar hvorfor, i almindeligt
	// dansk, saa Linn ikke skal sammenholde hendes udstyr med fire
	// tildelinger i hovedet.
	//
	// Svaret regnes med programmerForKunde3, altsaa NOEJAGTIG den samme
	// funktion kundens egen liste kommer til at bruge i bid 3. To
	// udgaver af den regel ville drive fra hinanden, og saa ville admin
	// sige noget andet end kunden oplever.
	// ============================================================

	import { getContext, onMount } from 'svelte';
	import type { User } from 'firebase/auth';
	import { isAdmin } from '$lib/admin';
	import Ventetegn from '$lib/components/ny/Ventetegn.svelte';
	import { klientSoegeMatch } from '$lib/utils/klientSoegning';
	import { hentAlleForlob } from '$lib/firestore/forlob';
	import type { ForlobKilde } from '$lib/content/adgang3';
	import { kategoriNavn3, type TraeningKategori3 } from '$lib/content/traeningKategori3';
	import type { Traeningsprogram3 } from '$lib/content/traeningsprogram3';
	import {
		maaByggeEget3,
		programmerForKunde3,
		type ProgramForKunde3,
		type Traeningstildeling3
	} from '$lib/content/traeningTildeling3';
	import { egetProgramTekst3, type MinTraening3 } from '$lib/content/mineTraeninger3';
	import { hentMineTraeninger3 } from '$lib/firestore/mineTraeninger3';
	import { hentKategorier3 } from '$lib/firestore/traeningKategori3';
	import { hentProgrammer3 } from '$lib/firestore/traeningsprogram3';
	import { hentTildelinger3 } from '$lib/firestore/traeningTildeling3';
	import {
		aktiveForlobNavne3,
		forlobKilder3,
		hentKlienter3,
		kundeKontekst3,
		type Klient3
	} from '$lib/firestore/traeningKunde3';

	const hentUser = getContext<() => User | null>('user');
	const user = $derived(hentUser());
	const maaVaereHer = $derived(isAdmin(user));

	let henter = $state(true);
	let fejl = $state('');
	let klienter = $state<Klient3[]>([]);
	let forlob = $state<ForlobKilde[]>([]);
	let programmer = $state<Traeningsprogram3[]>([]);
	let kategorier = $state<TraeningKategori3[]>([]);
	let tildelinger = $state<Traeningstildeling3[]>([]);
	let soegeord = $state('');
	let valgt = $state<Klient3 | null>(null);
	let hendesEgne = $state<MinTraening3[]>([]);
	let henterEgne = $state(false);

	const nu = Date.now();

	const traeffere = $derived.by(() => {
		const ord = soegeord.trim();
		if (ord.length < 2) return [];
		return klienter.filter((k) => klientSoegeMatch(k.soegetekst, ord)).slice(0, 15);
	});

	const kontekst = $derived(valgt ? kundeKontekst3(valgt, forlob, nu) : null);
	const hendesForlob = $derived(valgt ? aktiveForlobNavne3(valgt, forlob, nu) : []);

	const alle = $derived<ProgramForKunde3[]>(
		kontekst ? programmerForKunde3(programmer, tildelinger, kategorier, kontekst) : []
	);
	const ser = $derived(alle.filter((x) => x.vises));
	// En kladde er ikke tildelt hende, den er bare ikke faerdig. Den
	// hoerer ikke hjemme i et svar om hvad HUN kan se.
	const serIkke = $derived(alle.filter((x) => !x.vises && x.afvisning !== 'kladde'));
	const maaBygge = $derived(kontekst ? maaByggeEget3(tildelinger, kontekst) : false);

	/**
	 * Hendes egne programmer hentes foerst naar hun er slaaet op. De
	 * ligger under hende selv, saa der er ét kald pr kunde. At hente dem
	 * for alle paa forhaand ville vaere hundredvis af kald til noget
	 * Linn sjaeldent har brug for.
	 */
	async function vaelg(k: Klient3) {
		valgt = k;
		hendesEgne = [];
		henterEgne = true;
		try {
			hendesEgne = await hentMineTraeninger3(k.uid);
		} catch (e) {
			console.warn('[admin] kunne ikke hente hendes egne programmer', e);
		} finally {
			henterEgne = false;
		}
	}

	onMount(async () => {
		if (!isAdmin(user)) {
			henter = false;
			return;
		}
		try {
			const [k, f, p, kat, t] = await Promise.all([
				hentKlienter3(),
				hentAlleForlob(),
				hentProgrammer3(),
				hentKategorier3(),
				hentTildelinger3()
			]);
			klienter = k;
			forlob = forlobKilder3(f);
			programmer = p;
			kategorier = kat;
			tildelinger = t;
		} catch (e) {
			console.error('[admin] kunne ikke hente kunderne', e);
			fejl = 'Kunne ikke hente. Tjek at reglerne i Firebase er lagt ind.';
		} finally {
			henter = false;
		}
	});
</script>

<svelte:head><title>Slå en kunde op · admin</title></svelte:head>

<div class="ny-pad adm">
	{#if !maaVaereHer}
		<div class="adm-kort">Siden er kun for admin.</div>
	{:else if henter}
		<div class="adm-venter"><Ventetegn variant="lille" /><span>Henter kunderne</span></div>
	{:else}
		<header class="adm-top">
			<a class="tr-tilbage" href="/ny/admin/traening">‹ Træning</a>
			<h1>Slå en kunde op</h1>
			<p>Se hvilke programmer hun har, og hvorfor.</p>
		</header>

		{#if fejl}<p class="adm-fejl">{fejl}</p>{/if}

		<label class="adm-felt">
			<span>Søg</span>
			<input type="text" bind:value={soegeord} placeholder="Navn eller mail" />
		</label>

		{#if soegeord.trim().length >= 2 && !valgt}
			{#if traeffere.length === 0}
				<p class="adm-tom">Ingen kunder matcher.</p>
			{:else}
				<div class="adm-liste">
					{#each traeffere as k (k.uid)}
						<button type="button" class="adm-raekke tr-vaelg" onclick={() => vaelg(k)}>
							<div class="adm-raekke-t"><span>{k.navn}</span></div>
							<div class="adm-raekke-s">{k.email}</div>
						</button>
					{/each}
				</div>
			{/if}
		{/if}

		{#if valgt && kontekst}
			<section class="adm-kort">
				<h2>{valgt.navn}</h2>
				<p class="adm-hjaelp">
					{#if hendesForlob.length === 0}
						Intet aktivt forløb.
					{:else}
						{hendesForlob.map((f) => `${f.navn}, dag ${f.dag}`).join(' · ')}.
					{/if}
					{kontekst.harAbonnement ? ' Har et aktivt abonnement.' : ' Intet aktivt abonnement.'}
				</p>

				<div>
					<div class="adm-raekke-s">Hendes udstyr</div>
					<div class="adm-raekke-t">
						<span>
							{#if kontekst.udstyr.length === 0}
								Hun har ikke valgt endnu
							{:else}
								{kontekst.udstyr.map((id) => kategoriNavn3(id, kategorier)).join(', ')}
							{/if}
						</span>
					</div>
					{#if kontekst.udstyr.length === 0}
						<p class="adm-hjaelp">
							Spørgsmålet stilles i onboarding, som ikke er bygget endnu. Indtil hun vælger, ser
							hun alle de programmer hun har fået.
						</p>
					{/if}
				</div>

				<div class="tr-mini-raekke">
					<button type="button" class="tr-mini" onclick={() => (valgt = null)}>
						Slå en anden op
					</button>
				</div>
			</section>

			<h2 class="tr-overskrift">Ser lige nu</h2>
			{#if ser.length === 0}
				<p class="adm-tom">Hun ser ingen træningsprogrammer.</p>
			{:else}
				<div class="adm-liste">
					{#each ser as x (x.program.id)}
						<div class="adm-raekke">
							<div class="adm-raekke-t"><span>{x.program.navn}</span></div>
							<div class="adm-raekke-s">{x.forklaring}</div>
						</div>
					{/each}
				</div>
			{/if}

			<p class="adm-hjaelp">
				{maaBygge
					? 'Hun må bygge sit eget program.'
					: 'Hun må ikke bygge sit eget program.'}
			</p>

			<h2 class="tr-overskrift">Hendes egne programmer</h2>
			{#if henterEgne}
				<div class="adm-venter"><Ventetegn variant="lille" /><span>Henter</span></div>
			{:else if hendesEgne.length === 0}
				<p class="adm-tom">Hun har ikke bygget nogen selv.</p>
			{:else}
				<div class="adm-liste">
					{#each hendesEgne as m (m.id)}
						<div class="adm-raekke">
							<div class="adm-raekke-t"><span>{m.navn}</span></div>
							<div class="adm-raekke-s">{egetProgramTekst3(m)}</div>
						</div>
					{/each}
				</div>
				<p class="adm-hjaelp">
					De er hendes. Du kan se dem her, men ikke rette i dem.
					{#if !maaBygge}
						Hun kan ikke se dem lige nu, fordi hun ikke må bygge sine egne.
					{/if}
				</p>
			{/if}

			<h2 class="tr-overskrift">Ser ikke</h2>
			{#if serIkke.length === 0}
				<p class="adm-tom">Hun ser alt hvad der findes.</p>
			{:else}
				<div class="adm-liste">
					{#each serIkke as x (x.program.id)}
						<div class="adm-raekke">
							<div class="adm-raekke-t"><span>{x.program.navn}</span></div>
							<div class="adm-raekke-s">{x.forklaring}</div>
						</div>
					{/each}
				</div>
			{/if}
		{/if}
	{/if}
</div>
