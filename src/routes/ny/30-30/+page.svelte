<script lang="ts">
	// ============================================================
	// 30-30 beregneren, oversigten. Se SPEC-3.0.md afsnit 26.1.
	//
	// Hele indgangen til modulet. Fire maaltidsfliser og dagens to tal,
	// ikke mere. Alt indhold ligger inde i maaltidet, ét tryk vaek.
	//
	// Det er en beslutning og ikke en forglemmelse: oversigten skal ikke
	// kunne rode til, og maden lander rigtigt fordi maaltidet er valgt
	// foerst. Laeg ikke soegning, opskrifter eller genveje her.
	// ============================================================

	import { getContext, untrack } from 'svelte';
	import type { User } from 'firebase/auth';
	import type { UserDoc } from '$lib/types';
	import type { Adgangsbillede, ForlobKilde } from '$lib/content/adgang3';
	import { datoNoegle } from '$lib/firestore/forside3';
	import { hentDagen } from '$lib/firestore/maaltider3';
	import { pladsTal, TOM_TEKST, type DagsOpgoerelse } from '$lib/content/maaltider3';
	import Ventetegn from '$lib/components/ny/Ventetegn.svelte';
	import Sidehoved from '$lib/components/ny/Sidehoved.svelte';

	const hentUserDoc = getContext<() => UserDoc | null>('userDoc');
	const hentUser = getContext<() => User | null>('user');
	const hentAdgang = getContext<() => Adgangsbillede>('adgang');
	const forlobKilder = getContext<() => ForlobKilde[]>('forlob');

	const userDoc = $derived(hentUserDoc());
	const user = $derived(hentUser());
	const adgang = $derived(hentAdgang());
	const aktivtForlob = $derived(adgang.aktiveForlob[0] ?? null);

	const iDag = datoNoegle(new Date());
	let dato = $state(datoNoegle(new Date()));
	let dag = $state<DagsOpgoerelse | null>(null);
	let henter = $state(true);

	const erIDag = $derived(dato === iDag);
	// Hun maa gerne taste noget hun glemte i gaar, men ikke noget hun
	// endnu ikke har spist.
	const kanFrem = $derived(dato < iDag);

	const UGEDAGE = ['søndag', 'mandag', 'tirsdag', 'onsdag', 'torsdag', 'fredag', 'lørdag'];
	const MAANEDER = [
		'januar',
		'februar',
		'marts',
		'april',
		'maj',
		'juni',
		'juli',
		'august',
		'september',
		'oktober',
		'november',
		'december'
	];

	const datoTekst = $derived.by(() => {
		const [aar, m, d] = dato.split('-').map(Number);
		if (!aar) return '';
		const dt = new Date(aar, m - 1, d);
		const lang = `${UGEDAGE[dt.getDay()]} ${d}. ${MAANEDER[m - 1]}`;
		return erIDag ? `I dag · ${lang}` : lang.charAt(0).toUpperCase() + lang.slice(1);
	});

	function flytDag(retning: number) {
		const [aar, m, d] = dato.split('-').map(Number);
		const dt = new Date(aar, m - 1, d);
		dt.setDate(dt.getDate() + retning);
		const ny = datoNoegle(dt);
		if (ny > iDag) return;
		dato = ny;
	}

	// Forloebets maaltids-fokus, hvis Linn har sat et. Se maaltidsFokus.ts.
	const fokus = $derived.by(() => {
		if (!aktivtForlob) return null;
		const f = forlobKilder().find((x) => x.id === aktivtForlob.forlobId) as
			| (ForlobKilde & { maaltidsFokus?: never })
			| undefined;
		// ForlobKilde baerer ikke fokus-perioderne. Indtil de foelger med,
		// viser vi alle fire maaltider. Det er den tilgivende fejl.
		return f ? { perioder: null, dagNummer: aktivtForlob.dagNummer } : null;
	});

	/**
	 * Sat naar dagen ikke kunne hentes, ogsaa efter et nyt forsoeg.
	 *
	 * DEN HER FANDTES IKKE FOER 25. august, og det var en rigtig fejl:
	 * skaermen havde kun "henter" og "her er dagen". Gik hentningen galt,
	 * stod `dag` som null mens `henter` blev falsk, og saa tegnede siden
	 * INGENTING. Top og bundmenu blev staaende, fordi de hoerer til
	 * skallen, saa det saa ud som en blank app. Linn saa det flere gange.
	 *
	 * Maaltidsskaermen inde bagved havde det rigtigt hele tiden. Det var
	 * kun her udvejen manglede.
	 */
	let fejl = $state(false);
	/** Tael op naar hun trykker Prøv igen, saa effekten koerer forfra. */
	let forsoeg = $state(0);

	/**
	 * Alt der maa starte hentningen forfra, og INTET andet.
	 *
	 * Ny kunde, ny dato, et tryk paa Prøv igen, eller en ny dag i forloebet.
	 * Bemaerk at det er `fokus.dagNummer` og ikke `fokus` selv: fokus bygges
	 * om hver gang adgangsbilledet bygges om, og giver et nyt objekt ogsaa
	 * naar dagnummeret er praecis det samme. Se noeglen paa forsiden og
	 * HANDOVER 9.72.
	 */
	const noegle = $derived([user?.uid ?? '', dato, forsoeg, fokus?.dagNummer ?? -1].join('|'));

	// DEN SAMME RING SOM PAA FORSIDEN, 4. september. Effekten laeste userDoc
	// og fokus mens den stillede kaldet op, og saa startede hentningen
	// forfra hver gang adgangsbilledet blev bygget om. Skaermen satte sig
	// fast paa "henter", for udvejen nedenfor naaede aldrig frem foer den
	// blev afbrudt af naeste genstart. Alt andet end noeglen laeses nu i
	// untrack.
	$effect(() => {
		const n = noegle;
		if (!n) return;
		return untrack(() => hentDagenForfra());
	});

	function hentDagenForfra(): () => void {
		const uid = user?.uid;
		if (!uid) return () => {};
		const d = dato;
		let afbrudt = false;
		henter = true;
		fejl = false;

		/**
		 * Henter dagen, og proever ÉN gang til hvis det gik galt.
		 *
		 * De fleste af de her fejl er et oejebliks daarlig forbindelse paa
		 * en telefon, og de er vaek ved andet forsoeg. Saa opdager hun det
		 * aldrig. Slaar det ogsaa fejl, faar hun en tekst og en knap i
		 * stedet for en tom skaerm.
		 */
		(async () => {
			for (let i = 0; i < 2; i++) {
				try {
					const r = await hentDagen(uid, d, userDoc, fokus ?? undefined);
					if (afbrudt) return;
					dag = r;
					henter = false;
					return;
				} catch (e) {
					console.error('[ny] kunne ikke hente dagen, forsoeg', i + 1, e);
					if (afbrudt) return;
					// Kort pause foer andet forsoeg. Uden den rammer vi tit
					// den samme daarlige forbindelse igen med det samme.
					if (i === 0) await new Promise((r) => setTimeout(r, 900));
				}
			}
			if (afbrudt) return;
			fejl = true;
			henter = false;
		})();

		return () => {
			afbrudt = true;
		};
	}
</script>

<svelte:head><title>30-30 beregner</title></svelte:head>

<div class="ny-pad tt-side">
	<Sidehoved titel="30-30 beregner" kant={false} />

	<div class="tt-dato">
		<button type="button" onclick={() => flytDag(-1)} aria-label="Dagen før">‹</button>
		<span>{datoTekst}</span>
		<button type="button" onclick={() => flytDag(1)} disabled={!kanFrem} aria-label="Dagen efter"
			>›</button
		>
	</div>

	{#if henter}
		<div class="tt-venter"><Ventetegn variant="lille" /><span>Henter dagen</span></div>
	{:else if dag}
		{#each dag.pladser as plads (plads.type)}
			<a class="tt-maaltid" href="/ny/30-30/{plads.type}?dato={dato}">
				<span class="tt-t">
					<span class="tt-navn">{plads.label}</span>
					{#if plads.resume}
						<span class="tt-under">{plads.resume}</span>
					{:else}
						<span class="tt-tom">{TOM_TEKST}</span>
					{/if}
					<!-- Snack har ingen stribe. Der er intet maal at naa. -->
					{#if plads.procent !== null}
						<span class="tt-ring"><i style="width:{plads.procent}%"></i></span>
					{/if}
				</span>
				<span class="tt-hoejre">
					<span
						class="tt-tal"
						class:mangler={plads.mangler !== null}
						class:fri={plads.maal === null}
					>
						{pladsTal(plads)}
						<small>PROTEIN</small>
					</span>
					<span class="tt-pil" aria-hidden="true">›</span>
				</span>
			</a>
		{/each}

		<div class="tt-dagskort">
			<div class="tt-dk protein">
				<div class="tt-dk-navn">Protein i dag</div>
				<div class="tt-dk-tal">{dag.proteinIAlt} <small>/ {dag.proteinMaal} g</small></div>
				<div class="tt-dk-bar">
					<i style="width:{Math.min(100, Math.round((dag.proteinIAlt / dag.proteinMaal) * 100))}%"
					></i>
				</div>
			</div>
			<div class="tt-dk fiber">
				<div class="tt-dk-navn">Fiber i dag</div>
				<div class="tt-dk-tal">{dag.fiberIAlt} <small>/ {dag.fiberMaal} g</small></div>
				<div class="tt-dk-bar">
					<i style="width:{Math.min(100, Math.round((dag.fiberIAlt / dag.fiberMaal) * 100))}%"></i>
				</div>
			</div>
		</div>
		<p class="tt-snack-note">Snacken tæller med i begge tal.</p>
	{:else}
		<!--
			DEN HER GREN MAA ALDRIG FJERNES.

			Uden den tegnede siden ingenting naar dagen ikke kunne hentes,
			og kunden saa en blank skaerm med top og bundmenu. Bygger du en
			ny tilstand ind her, saa soerg for at der stadig er en sidste
			udvej der ALTID tegner noget.

			Tonen er med vilje. Hun har ikke gjort noget forkert, og hendes
			tal er der stadig. Ingen roed farve og ingen teknisk besked,
			samme regel som spaerre-skaermen, se HANDOVER 9.3.
		-->
		<div class="kort rolig tt-fejl">
			<p>Forbindelsen drillede, så jeg kunne ikke hente din dag.</p>
			<p class="tt-fejl-s">Alt hvad du har tastet ligger der stadig.</p>
			<button type="button" class="btn" onclick={() => forsoeg++}>Prøv igen</button>
		</div>
	{/if}
</div>
