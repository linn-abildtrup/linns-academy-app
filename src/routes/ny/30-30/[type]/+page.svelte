<script lang="ts">
	// ============================================================
	// 30-30 beregneren, inde i maaltidet. Se SPEC-3.0.md afsnit 26.2.
	//
	// Kunden har valgt maaltidet paa oversigten, saa alt hun tilfoejer
	// her lander det rigtige sted. Derfor gaettes maaltidstypen aldrig.
	//
	// HVAD DER VIRKER, OG HVAD DER ER ATTRAP:
	// Toppen, datoen, maaltidets tal og listen nederst koerer paa rigtige
	// data. Det du plejer, soegefeltet og de fire ikoner er maerket
	// 'skitse', fordi de foerst kan gemme noget naar skaerm 3 er
	// besluttet. Fjern maerket i samme oejeblik de virker.
	// ============================================================

	import { getContext } from 'svelte';
	import { page } from '$app/state';
	import type { User } from 'firebase/auth';
	import type { UserDoc } from '$lib/types';
	import type { GemtMaaltid, Maaltidstype } from '$lib/content/kost';
	import { MAALTIDSTYPER, PROTEIN_MAALTIDS_MAAL } from '$lib/content/kost';
	import { LABELS, harProteinMaal } from '$lib/content/maaltider3';
	import { hentMaaltidsPlads } from '$lib/firestore/maaltider3';
	import { datoNoegle } from '$lib/firestore/forside3';
	import Ventetegn from '$lib/components/ny/Ventetegn.svelte';

	const hentUser = getContext<() => User | null>('user');
	const hentUserDoc = getContext<() => UserDoc | null>('userDoc');
	const user = $derived(hentUser());
	const userDoc = $derived(hentUserDoc());

	const iDag = datoNoegle(new Date());

	const type = $derived.by<Maaltidstype>(() => {
		const t = page.params.type as Maaltidstype;
		return MAALTIDSTYPER.includes(t) ? t : 'morgenmad';
	});

	let dato = $state(page.url.searchParams.get('dato') ?? datoNoegle(new Date()));
	let poster = $state<GemtMaaltid[]>([]);
	let henter = $state(true);

	const erIDag = $derived(dato === iDag);
	const kanFrem = $derived(dato < iDag);

	const UGEDAGE = ['søndag', 'mandag', 'tirsdag', 'onsdag', 'torsdag', 'fredag', 'lørdag'];
	const MAANEDER = [
		'januar', 'februar', 'marts', 'april', 'maj', 'juni',
		'juli', 'august', 'september', 'oktober', 'november', 'december'
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

	const protein = $derived(Math.round(poster.reduce((s, m) => s + (m.totalP ?? 0), 0)));
	const fiber = $derived(Math.round(poster.reduce((s, m) => s + (m.totalF ?? 0), 0)));
	const harMaal = $derived(harProteinMaal(type));
	const procent = $derived(Math.min(100, Math.round((protein / PROTEIN_MAALTIDS_MAAL) * 100)));

	$effect(() => {
		const uid = user?.uid;
		const d = dato;
		const t = type;
		if (!uid) return;
		let afbrudt = false;
		henter = true;
		hentMaaltidsPlads(uid, d, t)
			.then((r) => {
				if (!afbrudt) {
					poster = r;
					henter = false;
				}
			})
			.catch((e) => {
				console.error('[ny] kunne ikke hente maaltidet', e);
				if (!afbrudt) henter = false;
			});
		return () => {
			afbrudt = true;
		};
	});
</script>

<svelte:head><title>{LABELS[type]} · 30-30</title></svelte:head>

<div class="ny-pad tm-side">
	<div class="tm-hoved">
		<a class="tm-tilbage" href="/ny/30-30" aria-label="Tilbage til oversigten">‹</a>
		<h1 class="tm-navn">{LABELS[type]}</h1>
	</div>

	<!-- Datoen har sin egen linje, saa dens pile ikke forveksles med
	     pilen tilbage. To venstrepile paa samme linje ville betyde to
	     forskellige ting. -->
	<div class="tt-dato">
		<button type="button" onclick={() => flytDag(-1)} aria-label="Dagen før">‹</button>
		<span>{datoTekst}</span>
		<button type="button" onclick={() => flytDag(1)} disabled={!kanFrem} aria-label="Dagen efter">›</button>
	</div>

	<div class="tm-tal">
		<div class="tm-t">
			<div class="tm-t-navn">Protein</div>
			<div class="tm-t-linje">
				<span class="tm-t-tal">
					{protein}
					{#if harMaal}<small>/ {PROTEIN_MAALTIDS_MAAL} g</small>{:else}<small>g</small>{/if}
				</span>
			</div>
			<!-- Snack har ingen stribe. Der er intet maal at naa. -->
			{#if harMaal}
				<div class="tm-t-bar"><i style="width:{procent}%"></i></div>
			{/if}
		</div>
		<div class="tm-skel"></div>
		<div class="tm-t">
			<div class="tm-t-navn">Fiber</div>
			<div class="tm-t-linje">
				<span class="tm-t-tal">{fiber} <small>g</small></span>
				<!-- Fiber er et dagsmaal, ikke et maaltidsmaal. Derfor ingen stribe. -->
				<span class="tm-t-note">i dagens 30</span>
			</div>
		</div>
	</div>

	<div class="tm-k">Det du plejer</div>
	<div class="tm-plejer skitse">
		<span class="tm-flise">Kommer her</span>
		<span class="tm-flise">Kommer her</span>
	</div>

	<div class="tm-soeg skitse">Søg i alt</div>

	<div class="tm-ikoner skitse">
		<span class="tm-ikon"><i class="i1"></i>Opskrifter</span>
		<span class="tm-ikon"><i class="i2"></i>Madplan</span>
		<span class="tm-ikon"><i class="i3"></i>Favoritter</span>
		<span class="tm-ikon"><i class="i4"></i>Mine</span>
	</div>

	<div class="tm-k">I dette måltid</div>
	{#if henter}
		<div class="tt-venter"><Ventetegn variant="lille" /><span>Henter</span></div>
	{:else if poster.length === 0}
		<div class="kort rolig">Der er ikke noget her endnu.</div>
	{:else}
		<div class="tm-liste">
			{#each poster as p (p.id)}
				<div class="tm-raekke">
					<span class="tm-r-navn">{p.navn}</span>
					<span class="tm-r-tal">{Math.round(p.totalP ?? 0)} g</span>
				</div>
			{/each}
		</div>
	{/if}
</div>
