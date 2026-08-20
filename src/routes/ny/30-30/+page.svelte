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

	import { getContext } from 'svelte';
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

	$effect(() => {
		const uid = user?.uid;
		const d = dato;
		if (!uid) return;
		let afbrudt = false;
		henter = true;
		hentDagen(uid, d, userDoc, fokus ?? undefined)
			.then((r) => {
				if (!afbrudt) {
					dag = r;
					henter = false;
				}
			})
			.catch((e) => {
				console.error('[ny] kunne ikke hente dagen', e);
				if (!afbrudt) henter = false;
			});
		return () => {
			afbrudt = true;
		};
	});
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
	{/if}
</div>
