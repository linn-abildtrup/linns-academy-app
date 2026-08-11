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
	import { formatPortion, naeringFor } from '$lib/content/maengde3';
	import type { PlejerPost } from '$lib/content/plejer3';
	import { hentMaaltidsPlads } from '$lib/firestore/maaltider3';
	import {
		hentPlejer,
		gemMadvare,
		fortrydMadvare,
		fjernMadvare,
		gendanMadvare
	} from '$lib/firestore/plejer3';
	import { hentAlleFodevarer } from '$lib/firestore/kost';
	import { datoNoegle } from '$lib/firestore/forside3';
	import MaengdeArk from '$lib/components/ny/MaengdeArk.svelte';
	import VaelgArk, { type Valg } from '$lib/components/ny/VaelgArk.svelte';
	import OpskriftArk from '$lib/components/ny/OpskriftArk.svelte';
	import { hentMineCustomFodevarer, hentFavoritter } from '$lib/firestore/kost';
	import { hentAlleOpskrifter } from '$lib/firestore/opskrifter';
	import { parseOpskriftMakro } from '$lib/content/opskrifter';
	import type { Opskrift } from '$lib/content/opskrifter';
	import type { FavoritMaaltid } from '$lib/content/kost';
	import { gemSammensat } from '$lib/firestore/plejer3';
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
	// Kvitteringen daekker begge veje: tilfoejet og fjernet. Fortryd
	// betyder derfor enten slet igen eller gendan.
	let kvittering = $state<
		| { slags: 'tilfoejet'; id: string; navn: string }
		| { slags: 'fjernet'; maaltid: GemtMaaltid }
		| null
	>(null);
	let kvitTimer: ReturnType<typeof setTimeout> | null = null;

	// De tre ark bag ikonerne.
	//
	// Madplanen er PARKERET efter Linns beslutning 11. august. Ikonet er
	// fjernet helt, ikke bare slaaet fra, saa der ikke staar noget der
	// ser halvfaerdigt ud. Motoren bag findes stadig i
	// content/foreslaaMadplan.ts og api/foreslaa-madplan, uroert.
	type Kilde = 'opskrifter' | 'favoritter' | 'mine';
	let aabentArk = $state<Kilde | null>(null);
	let arkHenter = $state(false);
	let opskrifter = $state<Opskrift[]>([]);
	let favoritter = $state<FavoritMaaltid[]>([]);
	let egne = $state<Fodevare[]>([]);
	/** Den opskrift hun kigger paa. Vises oven paa listen. */
	let aabenOpskrift = $state<Opskrift | null>(null);

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

	/** Henter foerst naar hun aabner arket. Ellers ville vi hente tre
	    lister hver gang hun bare vil taste en banan. */
	async function aabnKilde(kilde: Kilde) {
		const uid = user?.uid;
		if (!uid) return;
		aabentArk = kilde;
		arkHenter = true;
		try {
			if (kilde === 'opskrifter' && opskrifter.length === 0) {
				opskrifter = (await hentAlleOpskrifter()).filter((o) => o.aktiv);
			} else if (kilde === 'favoritter' && favoritter.length === 0) {
				favoritter = await hentFavoritter(uid);
			} else if (kilde === 'mine' && egne.length === 0) {
				egne = await hentMineCustomFodevarer(uid);
			}
		} catch (e) {
			console.error('[ny] kunne ikke hente', kilde, e);
		} finally {
			arkHenter = false;
		}
	}

	const arkTitel: Record<Kilde, string> = {
		opskrifter: 'Opskrifter',
		favoritter: 'Favoritter',
		mine: 'Mine fødevarer'
	};

	const arkTom: Record<Kilde, string> = {
		opskrifter: 'Der er ingen opskrifter endnu.',
		favoritter: 'Du har ingen favoritter endnu. Du kan gemme et måltid som favorit, når du har sat det sammen.',
		mine: 'Du har ikke lavet nogen egne fødevarer endnu. Dem laver du, når en vare ikke findes i forvejen.'
	};

	const arkPoster = $derived.by<Valg[]>(() => {
		if (aabentArk === 'opskrifter') {
			return opskrifter.map((o) => {
				const mk = parseOpskriftMakro(o.instruktioner);
				return {
					id: o.id,
					navn: o.titel,
					under: mk.protein ? `${Math.round(mk.protein)} g protein pr portion` : ''
				};
			});
		}
		if (aabentArk === 'favoritter') {
			return favoritter.map((f) => ({
				id: f.id,
				navn: f.navn,
				under: `${f.items?.length ?? 0} madvarer`
			}));
		}
		if (aabentArk === 'mine') {
			return egne.map((f) => ({
				id: f.id,
				navn: f.name,
				under: `${f.p} g protein pr 100 g`
			}));
		}
		return [];
	});

	/** Hvad der sker naar hun vaelger noget i arket. */
	async function vaelgFraArk(id: string) {
		const kilde = aabentArk;
		if (!kilde) return;

		// Egne foedevarer er almindelige madvarer, saa de gaar gennem
		// maengde-arket praecis som et soegeresultat.
		if (kilde === 'mine') {
			const f = egne.find((x) => x.id === id);
			if (!f) return;
			aabentArk = null;
			valgt = { food: f, saedvanlig: null };
			return;
		}

		// Opskriften SKAL kunne ses foer den laegges i. Hun kan ikke
		// vurdere en ret ud fra titlen alene.
		if (kilde === 'opskrifter') {
			const o = opskrifter.find((x) => x.id === id);
			if (!o) return;
			aabenOpskrift = o;
			return;
		}

		// Favoritter er hendes egne, faerdige maaltider. Dem har hun sat
		// sammen selv, saa de laegges direkte i.
		const uid = user?.uid;
		if (!uid) return;
		const f = favoritter.find((x) => x.id === id);
		if (!f) return;
		aabentArk = null;
		gemmer = true;
		try {
			let protein = 0;
			let fiber = 0;
			for (const it of f.items ?? []) {
				const food = foods.get(it.foodId);
				if (!food) continue;
				const n = naeringFor(food, it.portion ?? 0, it.enhedId);
				protein += n.protein;
				fiber += n.fiber;
			}
			const svar = await gemSammensat({ uid, dato, type, navn: f.navn, protein, fiber });
			await indlaesDagen();
			visKvittering({ slags: 'tilfoejet', ...svar });
		} catch (e) {
			console.error('[ny] kunne ikke laegge favoritten i', e);
		} finally {
			gemmer = false;
		}
	}

	/** Laegger opskriften i, med det antal portioner hun har valgt. */
	async function gemOpskrift(portioner: number) {
		const uid = user?.uid;
		const o = aabenOpskrift;
		if (!uid || !o) return;
		gemmer = true;
		try {
			const mk = parseOpskriftMakro(o.instruktioner);
			const navn = portioner === 1 ? o.titel : `${o.titel} (${formatPortion(portioner)} port.)`;
			const svar = await gemSammensat({
				uid,
				dato,
				type,
				navn,
				protein: (mk.protein ?? 0) * portioner,
				fiber: (mk.fiber ?? 0) * portioner
			});
			aabenOpskrift = null;
			aabentArk = null;
			await indlaesDagen();
			visKvittering({ slags: 'tilfoejet', ...svar });
		} catch (e) {
			console.error('[ny] kunne ikke laegge opskriften i', e);
		} finally {
			gemmer = false;
		}
	}

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
			visKvittering({ slags: 'tilfoejet', ...svar });
		} catch (e) {
			console.error('[ny] kunne ikke gemme madvaren', e);
		} finally {
			gemmer = false;
		}
	}

	function visKvittering(k: NonNullable<typeof kvittering>) {
		kvittering = k;
		if (kvitTimer) clearTimeout(kvitTimer);
		kvitTimer = setTimeout(() => (kvittering = null), 6000);
	}

	/**
	 * Fjerner en madvare hun allerede har tastet. Ingen "er du sikker",
	 * men en kvittering med Fortryd, praecis som naar hun tilfoejer.
	 */
	async function fjern(m: GemtMaaltid) {
		const uid = user?.uid;
		if (!uid || gemmer) return;
		gemmer = true;
		try {
			await fjernMadvare(uid, m);
			await indlaesDagen();
			visKvittering({ slags: 'fjernet', maaltid: m });
		} catch (e) {
			console.error('[ny] kunne ikke fjerne madvaren', e);
		} finally {
			gemmer = false;
		}
	}

	async function fortryd() {
		const uid = user?.uid;
		const k = kvittering;
		if (!uid || !k) return;
		kvittering = null;
		try {
			if (k.slags === 'tilfoejet') {
				await fortrydMadvare(uid, k.id);
			} else {
				await gendanMadvare(uid, k.maaltid);
			}
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

	<!-- Groen er Linns ting, blomme er kundens eget. Farven baerer
	     parringen, saa vi slipper for at gruppere dem i layoutet og
	     dermed for et ekstra klik. Se SPEC-3.0.md afsnit 26.2. -->
	<div class="tm-ikoner">
		<button type="button" class="tm-ikon" onclick={() => aabnKilde('opskrifter')}>
			<span class="i1">
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
					<path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H19v16H5.5A1.5 1.5 0 0 1 4 18.5Z" />
					<path d="M8 8h7M8 12h7M8 16h4" />
				</svg>
			</span>
			Opskrifter
		</button>
		<button type="button" class="tm-ikon" onclick={() => aabnKilde('favoritter')}>
			<span class="i3">
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
					<path d="M12 20s-7-4.4-7-9.2A4 4 0 0 1 12 8a4 4 0 0 1 7 2.8C19 15.6 12 20 12 20Z" />
				</svg>
			</span>
			Favoritter
		</button>
		<button type="button" class="tm-ikon" onclick={() => aabnKilde('mine')}>
			<span class="i4">
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
					<path d="M17 3.5 20.5 7 10 17.5l-4.5 1 1-4.5Z" />
					<path d="M4 20.5h9" />
				</svg>
			</span>
			Mine
		</button>
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
					<button
						type="button"
						class="tm-r-fjern"
						disabled={gemmer}
						onclick={() => fjern(p)}
						aria-label="Fjern {p.navn}">×</button
					>
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

{#if aabentArk}
	<VaelgArk
		titel={arkTitel[aabentArk]}
		poster={arkPoster}
		henter={arkHenter}
		tomTekst={arkTom[aabentArk]}
		onvaelg={vaelgFraArk}
		onluk={() => (aabentArk = null)}
	/>
{/if}

{#if aabenOpskrift}
	<OpskriftArk
		opskrift={aabenOpskrift}
		maaltidLabel={LABELS[type]}
		{gemmer}
		ongem={gemOpskrift}
		ontilbage={() => (aabenOpskrift = null)}
	/>
{/if}

{#if kvittering}
	<div class="kvit">
		<span class="kvit-t">
			{#if kvittering.slags === 'tilfoejet'}
				{kvittering.navn} lagt til {LABELS[type].toLowerCase()}
			{:else}
				{kvittering.maaltid.navn} er fjernet
			{/if}
		</span>
		<button type="button" class="kvit-f" onclick={fortryd}>Fortryd</button>
	</div>
{/if}
