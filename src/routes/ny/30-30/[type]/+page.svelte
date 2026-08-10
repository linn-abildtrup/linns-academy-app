<script lang="ts">
	// ============================================================
	// 30-30 beregneren, inde i maaltidet. Se SPEC-3.0.md afsnit 26.2.
	//
	// Kunden har valgt maaltidet paa oversigten, saa alt hun tilfoejer
	// her lander det rigtige sted. Maaltidstypen gaettes aldrig.
	//
	// Raekkefoelgen paa skaermen er valgt efter hvad der bruges mest:
	// det du plejer oeverst, saa soegning, saa de fire veje, og til
	// sidst hvad der allerede ligger i maaltidet.
	// ============================================================

	import { getContext } from 'svelte';
	import { page } from '$app/state';
	import type { User } from 'firebase/auth';
	import type { UserDoc } from '$lib/types';
	import type { Fodevare, GemtMaaltid, Maaltidstype } from '$lib/content/kost';
	import { MAALTIDSTYPER, PROTEIN_MAALTIDS_MAAL, filtrerFodevarer } from '$lib/content/kost';
	import { LABELS, harProteinMaal } from '$lib/content/maaltider3';
	import { formatPortion } from '$lib/content/maengde3';
	import type { PlejerPost } from '$lib/content/plejer3';
	import { hentMaaltidsPlads } from '$lib/firestore/maaltider3';
	import { hentPlejer, gemMadvare, fortrydMadvare } from '$lib/firestore/plejer3';
	import { hentAlleFodevarer } from '$lib/firestore/kost';
	import { datoNoegle } from '$lib/firestore/forside3';
	import MaengdeArk from '$lib/components/ny/MaengdeArk.svelte';
	import Ventetegn from '$lib/components/ny/Ventetegn.svelte';

	const hentUser = getContext<() => User | null>('user');
	const user = $derived(hentUser());

	const iDag = datoNoegle(new Date());

	const type = $derived.by<Maaltidstype>(() => {
		const t = page.params.type as Maaltidstype;
		return MAALTIDSTYPER.includes(t) ? t : 'morgenmad';
	});

	let dato = $state(page.url.searchParams.get('dato') ?? datoNoegle(new Date()));
	let poster = $state<GemtMaaltid[]>([]);
	let henter = $state(true);

	let foods = $state<Map<string, Fodevare>>(new Map());
	let plejer = $state<PlejerPost[]>([]);
	let soegeord = $state('');

	// Arket og kvitteringen
	let valgt = $state<{ food: Fodevare; saedvanlig: { portion: number; enhedId?: string } | null } | null>(null);
	let gemmer = $state(false);
	let kvittering = $state<{ id: string; navn: string } | null>(null);
	let kvitTimer: ReturnType<typeof setTimeout> | null = null;

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

	// Soegning i fodevare-databasen. Opskrifter, favoritter og egne
	// foedevarer kommer med naar arkene bag ikonerne er bygget.
	const traef = $derived.by(() => {
		const ord = soegeord.trim();
		if (ord.length < 2) return [] as Fodevare[];
		// Kortest navn foerst: 'Skyr' foer 'Skyr med vanilje'. Det er
		// oftest den enkle vare hun leder efter.
		return filtrerFodevarer([...foods.values()], ord, 'all')
			.sort((a, b) => a.name.length - b.name.length)
			.slice(0, 8);
	});

	async function indlaesDagen() {
		const uid = user?.uid;
		if (!uid) return;
		poster = await hentMaaltidsPlads(uid, dato, type);
	}

	$effect(() => {
		const uid = user?.uid;
		const d = dato;
		const t = type;
		if (!uid) return;
		let afbrudt = false;
		henter = true;

		(async () => {
			const alle = await hentAlleFodevarer();
			const kort = new Map(alle.map((f) => [f.id, f]));
			if (afbrudt) return;
			foods = kort;
			poster = await hentMaaltidsPlads(uid, d, t);
			if (afbrudt) return;
			henter = false;
			// Vanerne hentes bagefter. De maa ikke forsinke maaltidet.
			plejer = await hentPlejer(uid, t, kort);
		})().catch((e) => {
			console.error('[ny] kunne ikke hente maaltidet', e);
			henter = false;
		});

		return () => {
			afbrudt = true;
		};
	});

	function aabnArk(food: Fodevare, saedvanlig: { portion: number; enhedId?: string } | null) {
		valgt = { food, saedvanlig };
	}

	/**
	 * Ét tryk paa en flise: gemmes med det samme med den maengde hun
	 * plejer. Ingen bekraeftelse, men en kvittering med Fortryd. Et "er
	 * du sikker" ville fordoble klikkene paa den vej der bruges mest.
	 */
	async function gemDirekte(p: PlejerPost) {
		const uid = user?.uid;
		const food = foods.get(p.foodId);
		if (!uid || !food) return;
		await gem(food, p.portion, p.enhedId);
	}

	async function gem(food: Fodevare, portion: number, enhedId: string | undefined) {
		const uid = user?.uid;
		if (!uid) return;
		gemmer = true;
		try {
			const svar = await gemMadvare({ uid, dato, type, food, portion, enhedId });
			valgt = null;
			soegeord = '';
			await indlaesDagen();
			visKvittering(svar);
		} catch (e) {
			console.error('[ny] kunne ikke gemme madvaren', e);
		} finally {
			gemmer = false;
		}
	}

	function visKvittering(svar: { id: string; navn: string }) {
		kvittering = svar;
		if (kvitTimer) clearTimeout(kvitTimer);
		kvitTimer = setTimeout(() => (kvittering = null), 6000);
	}

	async function fortryd() {
		const uid = user?.uid;
		const k = kvittering;
		if (!uid || !k) return;
		kvittering = null;
		try {
			await fortrydMadvare(uid, k.id);
			await indlaesDagen();
		} catch (e) {
			console.error('[ny] kunne ikke fortryde', e);
		}
	}
</script>

<svelte:head><title>{LABELS[type]} · 30-30</title></svelte:head>

<div class="ny-pad tm-side">
	<div class="tm-hoved">
		<a class="tm-tilbage" href="/ny/30-30" aria-label="Tilbage til oversigten">‹</a>
		<h1 class="tm-navn">{LABELS[type]}</h1>
	</div>

	<!-- Datoen har sin egen linje, saa dens pile ikke forveksles med
	     pilen tilbage. To venstrepile ville betyde to ting. -->
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
				<!-- Fiber er et dagsmaal, ikke et maaltidsmaal. Ingen stribe. -->
				<span class="tm-t-note">i dagens 30</span>
			</div>
		</div>
	</div>

	{#if plejer.length > 0}
		<div class="tm-k">Det du plejer</div>
		<div class="tm-plejer">
			{#each plejer as p (p.foodId)}
				<button type="button" class="tm-flise" disabled={gemmer} onclick={() => gemDirekte(p)}>
					<span class="tm-f-navn">{p.navn}</span>
					<span class="tm-f-m">{formatPortion(p.portion)} {p.enhedId ?? 'g'}</span>
				</button>
			{/each}
		</div>
	{/if}

	<div class="tm-soegefelt">
		<input
			type="search"
			bind:value={soegeord}
			placeholder="Søg efter mad"
			aria-label="Søg efter mad"
		/>
	</div>

	{#if traef.length > 0}
		<div class="tm-traef">
			{#each traef as f (f.id)}
				<button type="button" onclick={() => aabnArk(f, null)}>
					<span class="tm-tr-navn">{f.name}</span>
					<span class="tm-tr-makro">{f.p} g protein pr 100 g</span>
				</button>
			{/each}
		</div>
	{/if}

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

{#if valgt}
	<MaengdeArk
		food={valgt.food}
		maaltidLabel={LABELS[type]}
		saedvanlig={valgt.saedvanlig}
		{gemmer}
		ongem={(portion, enhedId) => gem(valgt!.food, portion, enhedId)}
		onluk={() => (valgt = null)}
	/>
{/if}

{#if kvittering}
	<div class="kvit">
		<span class="kvit-t">{kvittering.navn} lagt til {LABELS[type].toLowerCase()}</span>
		<button type="button" class="kvit-f" onclick={fortryd}>Fortryd</button>
	</div>
{/if}
