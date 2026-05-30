<script lang="ts">
	import { getContext, onMount } from 'svelte';
	import type { User } from 'firebase/auth';
	import { type UserDoc } from '$lib/types';
	import { erKickstartForlobskunde, erKropsroForlobskunde } from '$lib/utils/userAdgang';
	import Icon from '$lib/components/Icon.svelte';
	import Loading from '$lib/components/Loading.svelte';
	import {
		getInterpretation,
		getSubskalaFortolkning,
		MAALEPUNKT_LABEL,
		MRS_ITEMS,
		naesteUdfyldelseDato,
		SEVERITY,
		skalUdfyldeNu,
		SLIDER_SPORGSMAAL,
		SUBSCALES,
		validerScores,
		validerSliders,
		type MaalePunkt,
		type MrsScore,
		type MrsSliders
	} from '$lib/content/mrs';
	import { gemMrsScore, hentAlleMrsScores } from '$lib/firestore/mrs';

	const getUser = getContext<() => User | null>('user');
	const getUserDoc = getContext<() => UserDoc | null>('userDoc');
	const user = $derived(getUser());
	const userDoc = $derived(getUserDoc());

	type Visning = 'forside' | 'udfyld' | 'resultat';

	let visning = $state<Visning>('forside');
	let valgtMaalepunkt = $state<MaalePunkt>('baseline');
	let scores = $state<Record<number, number>>({});
	let sliders = $state<Partial<MrsSliders>>({});
	let tidligereScores = $state<MrsScore[]>([]);
	let netop_gemt = $state<MrsScore | null>(null);
	let loading = $state(true);
	let gemmer = $state(false);
	let fejl = $state<string | null>(null);

	const antalMrsBesvaret = $derived(Object.keys(scores).length);
	const antalSlidersBesvaret = $derived(
		SLIDER_SPORGSMAAL.filter((s) => sliders[s.id] !== undefined).length
	);
	const klarTilSubmit = $derived(
		antalMrsBesvaret === MRS_ITEMS.length &&
			antalSlidersBesvaret === SLIDER_SPORGSMAAL.length
	);

	onMount(async () => {
		if (!user) {
			fejl = 'Du skal være logget ind.';
			loading = false;
			return;
		}
		try {
			tidligereScores = await hentAlleMrsScores(user.uid);
		} catch (e) {
			console.warn('Kunne ikke hente tidligere MRS-scorer:', e);
		} finally {
			loading = false;
		}
	});

	function startNyUdfyldelse() {
		// Første gang = 'forste', ellers en planlagt opfølgning
		valgtMaalepunkt = tidligereScores.length === 0 ? 'forste' : 'opfoelgning';
		scores = {};
		sliders = {};
		netop_gemt = null;
		fejl = null;
		visning = 'udfyld';
		if (typeof window !== 'undefined') window.scrollTo({ top: 0 });
	}

	function setSlider(id: keyof MrsSliders, value: number) {
		sliders = { ...sliders, [id]: value };
	}

	/** Åbner en specifik tidligere udfyldelse i resultat-visningen. */
	function aabnTidligere(s: MrsScore) {
		valgtMaalepunkt = s.measurePoint;
		netop_gemt = s;
		fejl = null;
		visning = 'resultat';
		if (typeof window !== 'undefined') window.scrollTo({ top: 0 });
	}

	function tilbageTilForside() {
		visning = 'forside';
		if (typeof window !== 'undefined') window.scrollTo({ top: 0 });
	}

	function setScore(itemId: number, value: number) {
		scores = { ...scores, [itemId]: value };
	}

	async function submit() {
		if (!user || gemmer) return;
		const slidersFejl = validerSliders(sliders);
		if (slidersFejl) {
			fejl = slidersFejl;
			return;
		}
		const valFejl = validerScores(scores);
		if (valFejl) {
			fejl = valFejl;
			return;
		}
		gemmer = true;
		fejl = null;
		try {
			const ny = await gemMrsScore(
				user.uid,
				user.email ?? '',
				valgtMaalepunkt,
				scores,
				sliders as MrsSliders
			);
			netop_gemt = ny;
			tidligereScores = [...tidligereScores, ny];
			visning = 'resultat';
			if (typeof window !== 'undefined') window.scrollTo({ top: 0 });
		} catch (e) {
			console.error(e);
			fejl = 'Kunne ikke gemme. Prøv igen.';
		} finally {
			gemmer = false;
		}
	}

	const harSomatiskFarve = SUBSCALES.somatisk.color;
	function farveFor(itemId: number): string {
		const item = MRS_ITEMS.find((i) => i.id === itemId);
		return item ? SUBSCALES[item.subscale].color : harSomatiskFarve;
	}
	function bgFor(itemId: number): string {
		const item = MRS_ITEMS.find((i) => i.id === itemId);
		return item ? SUBSCALES[item.subscale].bg : SUBSCALES.somatisk.bg;
	}

	const resultatFortolkning = $derived(
		netop_gemt ? getInterpretation(netop_gemt.total) : null
	);

	const sidsteUdfyldelseAt = $derived(
		tidligereScores.length > 0
			? tidligereScores[tidligereScores.length - 1].timestamp
			: null
	);

	const erKickstart = $derived(erKickstartForlobskunde(userDoc));
	const erKropsro = $derived(erKropsroForlobskunde(userDoc));

	const skalUdfylde = $derived(
		skalUdfyldeNu(
			userDoc?.accessSource,
			userDoc?.activeProduct,
			sidsteUdfyldelseAt,
			erKickstart
		)
	);

	const naesteCheckDato = $derived(
		sidsteUdfyldelseAt !== null
			? naesteUdfyldelseDato(
					userDoc?.accessSource,
					userDoc?.activeProduct,
					sidsteUdfyldelseAt,
					erKickstart
				)
			: null
	);

	const kadenceTekst = $derived.by<string>(() => {
		if (userDoc?.accessSource === 'forløb' && erKickstart) {
			return 'På Kickstart udfylder du hver søndag, så du kan se din udvikling uge for uge.';
		}
		if (userDoc?.accessSource === 'forløb' && erKropsro) {
			return 'På Kropsro udfylder du hver 4. søndag gennem dit forløb.';
		}
		return 'Du udfylder en symptomcheck hver 4. søndag, så du kan følge din udvikling over tid. Første gang må du gerne tage den med det samme som baseline.';
	});

	function formaterDatoTekst(timestamp: number): string {
		const d = new Date(timestamp);
		return `${d.getDate()}/${d.getMonth() + 1}-${d.getFullYear()}`;
	}

	function formaterDato(d: Date): string {
		return `${d.getDate()}/${d.getMonth() + 1}-${d.getFullYear()}`;
	}

	const tidligereSorteret = $derived(
		[...tidligereScores].sort((a, b) => b.timestamp - a.timestamp)
	);

	// Til sliders-grafen: kun entries der faktisk har sliders-data (post-22-maj
	// 2026). Gamle MRS-udfyldelser uden sliders falder fra.
	const tidligereMedSliders = $derived(
		tidligereSorteret.filter((s) => s.sliders !== undefined)
	);
</script>

<div class="page">
	<header class="page-header">
		<a class="back" href="/app/moduler">
			<Icon name="arrow-l" size={14} color="var(--text2)" />
			<span>Moduler</span>
		</a>
		<div class="eyebrow">Modul · Symptomcheck</div>
		<h1>
			{#if visning === 'forside'}
				Symptomcheck
			{:else if visning === 'udfyld'}
				Hvordan har din krop det lige nu?
			{:else}
				Din symptomprofil
			{/if}
		</h1>
		{#if visning === 'forside'}
			<p class="page-sub">{kadenceTekst}</p>
		{:else if visning === 'udfyld'}
			<p class="page-sub">
				Vælg den sværhedsgrad der passer bedst for hvert symptom. Der er ingen rigtige
				eller forkerte svar.
			</p>
		{/if}
	</header>

	{#if fejl}
		<div class="status-besked fejl">{fejl}</div>
	{/if}

	{#if loading}
		<Loading tekst="Henter…" />
	{:else if visning === 'forside'}
		{#if skalUdfylde}
			<button type="button" class="cta-knap due" onclick={startNyUdfyldelse}>
				<div class="cta-tekst">
					<div class="cta-eyebrow">
						{tidligereScores.length === 0 ? 'Første udfyldelse' : 'Tid til opfølgning'}
					</div>
					<div class="cta-titel">Tag symptomcheck nu</div>
				</div>
				<Icon name="chevron-r" size={14} color="#fff" />
			</button>
		{:else}
			<div class="cta-info">
				<div class="cta-tekst">
					<div class="cta-eyebrow">Du har lige udfyldt</div>
					<div class="cta-titel">Næste symptomcheck</div>
					{#if naesteCheckDato}
						<div class="cta-info-dato">{formaterDato(naesteCheckDato)}</div>
					{/if}
				</div>
			</div>
		{/if}

		{#if tidligereSorteret.length >= 2}
			{@const sorteretGammelForst = [...tidligereSorteret].reverse()}
			{@const grafPunkter = sorteretGammelForst.map((s, i) => {
				const n = sorteretGammelForst.length;
				const x = (i / Math.max(1, n - 1)) * 300 + 10;
				const y = 110 - (s.total / 44) * 100;
				return { x, y, score: s };
			})}
			{@const grafPath = grafPunkter
				.map((p, i) => (i === 0 ? `M ${p.x},${p.y}` : `L ${p.x},${p.y}`))
				.join(' ')}
			<section class="card">
				<div class="card-titel">MRS-symptomscore over tid</div>
				<p class="card-sub">
					Den internationale Menopause Rating Scale (0-44). Jo
					<strong>lavere</strong> tal, jo færre overgangsalder-symptomer. En
					faldende kurve er et godt tegn.
				</p>
				<div class="graf-wrapper">
					<div class="y-akse stor">
						<span>44</span>
						<span>33</span>
						<span>22</span>
						<span>11</span>
						<span>0</span>
					</div>
					<svg class="udvikling-graf" viewBox="0 0 320 120" preserveAspectRatio="none">
					<line x1="10" y1="10" x2="10" y2="110" stroke="var(--border)" stroke-width="1" />
					<line
						x1="10"
						y1="110"
						x2="310"
						y2="110"
						stroke="var(--border)"
						stroke-width="1"
					/>
					<path
						d={grafPath}
						fill="none"
						stroke="var(--terra)"
						stroke-width="2.5"
						stroke-linejoin="round"
					/>
					{#each grafPunkter as p (p.score.id)}
						<circle cx={p.x} cy={p.y} r="4" fill="var(--terra)" />
					{/each}
				</svg>
				</div>
				<div class="graf-akse med-y-akse">
					<span>{formaterDatoTekst(tidligereSorteret[tidligereSorteret.length - 1].timestamp)}</span>
					<span>{formaterDatoTekst(tidligereSorteret[0].timestamp)}</span>
				</div>
			</section>
		{/if}

		{#if tidligereMedSliders.length >= 2}
			{@const slidersAeldsteFoerst = [...tidligereMedSliders].reverse()}
			<section class="card">
				<div class="card-titel">Din velvære over tid (Linns Academy)</div>
				<p class="card-sub">
					Dine 5 selvvurderinger fra symptomchecken (1-10). Jo
					<strong>højere</strong> tal, jo bedre velvære. En stigende kurve er et
					godt tegn. Dette er Linns Academys egen kvalitative måling — det
					modsatte af MRS-grafen ovenfor, hvor lave tal er bedst.
				</p>
				{#each SLIDER_SPORGSMAAL as spm (spm.id)}
					{@const punkter = slidersAeldsteFoerst.map((s, i) => {
						const n = slidersAeldsteFoerst.length;
						const v = s.sliders ? s.sliders[spm.id] : 5;
						const x = (i / Math.max(1, n - 1)) * 300 + 10;
						const y = 70 - ((v - 1) / 9) * 60;
						return { x, y, score: s };
					})}
					{@const path = punkter
						.map((p, i) => (i === 0 ? `M ${p.x},${p.y}` : `L ${p.x},${p.y}`))
						.join(' ')}
					<div class="mini-graf-blok">
						<div class="mini-graf-label">{spm.label}</div>
						<div class="graf-wrapper">
							<div class="y-akse lille">
								<span>10</span>
								<span>5</span>
								<span>1</span>
							</div>
							<svg class="mini-graf" viewBox="0 0 320 80" preserveAspectRatio="none">
								<line x1="10" y1="10" x2="10" y2="70" stroke="var(--border)" stroke-width="1" />
								<line
									x1="10"
									y1="70"
									x2="310"
									y2="70"
									stroke="var(--border)"
									stroke-width="1"
								/>
								<path
									d={path}
									fill="none"
									stroke="var(--terra)"
									stroke-width="2"
									stroke-linejoin="round"
								/>
								{#each punkter as p (p.score.id)}
									<circle cx={p.x} cy={p.y} r="3" fill="var(--terra)" />
								{/each}
							</svg>
						</div>
					</div>
				{/each}
				<div class="graf-akse med-y-akse">
					<span>{formaterDatoTekst(tidligereMedSliders[tidligereMedSliders.length - 1].timestamp)}</span>
					<span>{formaterDatoTekst(tidligereMedSliders[0].timestamp)}</span>
				</div>
			</section>
		{/if}

		<section class="card">
			<div class="card-titel">Tidligere udfyldelser ({tidligereScores.length})</div>
			{#if tidligereSorteret.length === 0}
				<p class="hint">Du har ikke udfyldt en symptomcheck endnu.</p>
			{:else}
				<div class="historik-liste">
					{#each tidligereSorteret as s (s.id)}
						{@const interp = getInterpretation(s.total)}
						<button
							type="button"
							class="historik-rad"
							onclick={() => aabnTidligere(s)}
						>
							<div class="historik-dato">{formaterDatoTekst(s.timestamp)}</div>
							<div class="historik-info">
								<div class="historik-score" style="color: {interp.color};">
									{s.total}<span class="historik-max">/44</span>
								</div>
								<div class="historik-label" style="color: {interp.color};">
									{interp.label}
								</div>
							</div>
							<Icon name="chevron-r" size={14} color="var(--text3)" />
						</button>
					{/each}
				</div>
			{/if}
		</section>

		<div class="info-blok">
			Denne symptomtjekliste er baseret på Menopause Rating Scale (MRS), som bruges i
			forskning verden over til at måle overgangsaldersymptomer. Tilpasset til dansk af
			Linn's Academy. Kilde: Heinemann et al., Health Qual Life Outcomes 2003;1:28.
		</div>
	{:else if visning === 'udfyld'}
		<div class="maalepunkt-pill">{MAALEPUNKT_LABEL[valgtMaalepunkt]}</div>

		<div class="intro-blok">
			<p>
				Symptomchecken har to dele:
			</p>
			<ol class="intro-liste">
				<li>
					<strong>Din generelle velvære</strong> — 5 sliders der måler hvordan du
					har det lige nu (energi, mave, cravings, humør, søvn).
				</li>
				<li>
					<strong>Dine overgangsalder-symptomer</strong> — 11 spørgsmål fra den
					internationale MRS-skala der zoomer ind på specifikke symptomer.
				</li>
			</ol>
			<p class="intro-fodnote">
				Tag dig god tid og mærk efter. Det tager 2-3 minutter i alt.
			</p>
		</div>

		<section class="subskala-blok del-1">
			<div class="del-eyebrow">Del 1 af 2</div>
			<div
				class="subskala-label"
				style="background: var(--tdim); color: var(--terra);"
			>
				Hvordan har du det generelt?
			</div>
			<p class="slider-intro">
				Træk i hver slider — 1 = lavest, 10 = højest. Bruges sammen med dine
				symptom-svar nedenfor til at give det fulde billede.
			</p>
			{#each SLIDER_SPORGSMAAL as spm (spm.id)}
				{@const v = sliders[spm.id]}
				<div class="slider-rad">
					<div class="slider-label">{spm.label}</div>
					<input
						type="range"
						min="1"
						max="10"
						step="1"
						value={v ?? 5}
						oninput={(e) =>
							setSlider(spm.id, parseInt((e.target as HTMLInputElement).value, 10))}
					/>
					<div class="slider-vaerdi">
						{v !== undefined ? v : '–'}
					</div>
				</div>
			{/each}
		</section>

		<div class="del-skille">
			<div class="del-skille-linje"></div>
			<div class="del-skille-label">Del 2 af 2</div>
			<div class="del-skille-linje"></div>
		</div>

		<div class="mrs-intro">
			<h2>Dine overgangsalder-symptomer</h2>
			<p>
				Den her del er den internationalt anerkendte MRS-skala (Menopause Rating
				Scale). Den måler 11 typiske symptomer i tre grupper. For hvert symptom
				vælger du hvor meget det fylder for dig lige nu — fra <em>Ingen</em> til
				<em>Voldsomt</em>. Der er ingen rigtige eller forkerte svar.
			</p>
		</div>

		{#each ['somatisk', 'psykologisk', 'urogenital'] as subKey ((subKey))}
			{@const sub = SUBSCALES[subKey as keyof typeof SUBSCALES]}
			<section class="subskala-blok">
				<div
					class="subskala-label"
					style="background: {sub.bg}; color: {sub.color};"
				>
					{sub.label}
				</div>
				{#each MRS_ITEMS.filter((i) => i.subscale === subKey) as item (item.id)}
					{@const val = scores[item.id]}
					<div class="oevelse-kort" class:answered={val !== undefined}>
						<div class="oevelse-titel">{item.id}. {item.da}</div>
						<div class="oevelse-desc">{item.description}</div>
						<div class="sev-rad">
							{#each SEVERITY as sev (sev.value)}
								{@const valgt = val === sev.value}
								<button
									type="button"
									class="sev-knap"
									class:valgt
									style={valgt
										? `border-color: ${farveFor(item.id)}; background: ${bgFor(item.id)}; color: ${farveFor(item.id)};`
										: ''}
									onclick={() => setScore(item.id, sev.value)}
								>
									{sev.label}
								</button>
							{/each}
						</div>
					</div>
				{/each}
			</section>
		{/each}

		<p class="progress">
			{antalSlidersBesvaret + antalMrsBesvaret} af {SLIDER_SPORGSMAAL.length + MRS_ITEMS.length} besvaret
		</p>
		<button
			type="button"
			class="primary-knap"
			class:klar={klarTilSubmit}
			disabled={!klarTilSubmit || gemmer}
			onclick={submit}
		>
			{gemmer ? 'Gemmer…' : 'Se mit resultat'}
		</button>

		<button type="button" class="annuller-knap" onclick={tilbageTilForside}>
			Annullér
		</button>
	{:else if visning === 'resultat' && netop_gemt && resultatFortolkning}
		{@const score = netop_gemt}
		<div class="resultat-header">
			<div class="maalepunkt-pill">{MAALEPUNKT_LABEL[score.measurePoint]}</div>
			<div class="udfyldt-dato">Udfyldt {formaterDatoTekst(score.timestamp)}</div>
		</div>

		<section
			class="total-blok"
			style="background: {resultatFortolkning.color}12; border: 1px solid {resultatFortolkning.color}33;"
		>
			<div class="total-score" style="color: {resultatFortolkning.color};">
				{score.total}
			</div>
			<div class="total-max">af 44 mulige</div>
			<div class="total-label" style="color: {resultatFortolkning.color};">
				{resultatFortolkning.label}
			</div>
			<p class="total-forklaring">{resultatFortolkning.beskrivelse}</p>
			<p class="total-forklaring sekundaer">
				Din samlede score lægger alle 11 svar sammen. Skalaen går fra 0 (ingen gener)
				til 44 (kraftige gener). Niveauerne følger international konsensus
				(Heinemann et al.).
			</p>
		</section>

		<div class="subskala-titel">De tre symptom-områder</div>
		<div class="subskala-grid">
			{#each Object.entries(SUBSCALES) as [key, sub] (key)}
				{@const subScore = score.subscales[key as keyof typeof score.subscales]}
				{@const max = sub.items.length * 4}
				{@const subForto = getSubskalaFortolkning(
					key as 'somatisk' | 'psykologisk' | 'urogenital',
					subScore
				)}
				<div
					class="subskala-kort"
					style="background: {sub.bg}; border: 1px solid {sub.color}20;"
				>
					<div class="subskala-tal" style="color: {sub.color};">{subScore}</div>
					<div class="subskala-max">af {max}</div>
					<div class="subskala-navn" style="color: {sub.color};">{sub.label}</div>
					<div class="subskala-niveau" style="color: {sub.color};">{subForto.label}</div>
					<div class="subskala-beskrivelse">{sub.beskrivelse}</div>
				</div>
			{/each}
		</div>

		<div class="bars-titel">Dine svar i overblik</div>
		<div class="bars-liste">
			{#each MRS_ITEMS as item (item.id)}
				{@const val = score.scores[item.id]}
				{@const pct = (val / 4) * 100}
				{@const color = SUBSCALES[item.subscale].color}
				<div class="bar-row">
					<span class="bar-label">{item.da}</span>
					<div class="bar-track">
						<div class="bar-fill" style="width: {pct}%; background: {color};"></div>
					</div>
					<span class="bar-val" style="color: {color};">{val}</span>
				</div>
			{/each}
		</div>

		{#if score.sliders}
			{@const slidersVal = score.sliders}
			<div class="bars-titel" style="margin-top: 18px;">Hvordan du har det generelt</div>
			<div class="bars-liste">
				{#each SLIDER_SPORGSMAAL as spm (spm.id)}
					{@const val = slidersVal[spm.id]}
					{@const pct = (val / 10) * 100}
					<div class="bar-row">
						<span class="bar-label">{spm.label}</span>
						<div class="bar-track">
							<div
								class="bar-fill"
								style="width: {pct}%; background: var(--terra);"
							></div>
						</div>
						<span class="bar-val" style="color: var(--terra);">{val}</span>
					</div>
				{/each}
			</div>
		{/if}

		<div class="info-blok kompakt">
			<strong>Hvad er dette?</strong><br />
			Du har lige udfyldt en internationalt anerkendt symptomtjekliste for kvinder i
			overgangsalderen (Menopause Rating Scale). Den bruges verden over til at måle
			hvordan symptomer udvikler sig over tid. Ved at udfylde den igen senere i forløbet
			kan du se din egen udvikling sort på hvidt.
		</div>

		<button type="button" class="primary-knap klar" onclick={tilbageTilForside}>
			Tilbage til oversigten
		</button>
		<button
			type="button"
			class="annuller-knap"
			onclick={() => startNyUdfyldelse()}
		>
			Udfyld igen
		</button>
	{/if}
</div>

<style>
	.page {
		padding: 18px 18px 100px;
		max-width: 600px;
		margin: 0 auto;
	}

	.page-header {
		margin-bottom: 18px;
	}

	.back {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-size: calc(12px * var(--fs-scale, 1));
		color: var(--text2);
		text-decoration: none;
		margin-bottom: 12px;
	}

	.eyebrow {
		font-size: calc(10px * var(--fs-scale, 1));
		font-weight: 600;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--text3);
	}

	h1 {
		font-family: var(--ff-d);
		font-size: calc(26px * var(--fs-scale, 1));
		font-weight: 600;
		letter-spacing: -0.02em;
		margin: 4px 0 0;
		line-height: 1.15;
		color: var(--text);
	}

	.page-sub {
		font-size: calc(13px * var(--fs-scale, 1));
		color: var(--text2);
		margin: 8px 0 0;
		line-height: 1.5;
	}

	.status-besked {
		padding: 12px 14px;
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 10px;
		color: var(--text2);
		font-size: calc(13px * var(--fs-scale, 1));
		text-align: center;
		margin-bottom: 14px;
	}

	.status-besked.fejl {
		color: #8a4a3e;
		background: #fbeeea;
		border-color: #f0d6cf;
	}

	.card {
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 14px;
		padding: 16px;
		margin-bottom: 14px;
	}

	.card-titel {
		font-size: calc(15px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--text);
		margin-bottom: 4px;
	}

	.card-sub {
		font-size: calc(12px * var(--fs-scale, 1));
		color: var(--text3);
		margin: 0 0 12px;
		line-height: 1.4;
	}

	.cta-knap {
		display: flex;
		align-items: center;
		gap: 12px;
		width: 100%;
		padding: 16px;
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 12px;
		cursor: pointer;
		font-family: var(--ff-b);
		text-align: left;
		margin-bottom: 14px;
		color: inherit;
	}

	.cta-knap.due {
		background: var(--terra);
		border-color: var(--terra);
		color: #fff;
	}

	.cta-tekst {
		flex: 1;
		min-width: 0;
	}

	.cta-eyebrow {
		font-size: calc(10.5px * var(--fs-scale, 1));
		font-weight: 600;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		opacity: 0.85;
		margin-bottom: 4px;
	}

	.cta-titel {
		font-family: var(--ff-d);
		font-size: calc(18px * var(--fs-scale, 1));
		font-weight: 600;
		line-height: 1.15;
	}

	.cta-info {
		display: flex;
		align-items: center;
		gap: 12px;
		width: 100%;
		padding: 16px;
		background: var(--bg2);
		border: 1px solid var(--border);
		border-radius: 12px;
		margin-bottom: 14px;
		color: var(--text);
	}

	.cta-info .cta-eyebrow {
		color: var(--text3);
		opacity: 1;
	}

	.cta-info .cta-titel {
		color: var(--text2);
		font-size: calc(15px * var(--fs-scale, 1));
		margin-bottom: 4px;
	}

	.cta-info-dato {
		font-family: var(--ff-d);
		font-size: calc(20px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--text);
		letter-spacing: -0.01em;
	}

	.udvikling-graf {
		display: block;
		width: 100%;
		height: 120px;
		margin-top: 8px;
	}

	.mini-graf-blok {
		margin-bottom: 12px;
	}

	.mini-graf-label {
		font-size: calc(11.5px * var(--fs-scale, 1));
		color: var(--text2);
		margin-bottom: 4px;
		font-weight: 500;
	}

	.mini-graf {
		display: block;
		flex: 1;
		min-width: 0;
		height: 80px;
	}

	.graf-wrapper {
		display: flex;
		gap: 6px;
		align-items: stretch;
		margin-top: 8px;
	}

	.graf-wrapper .udvikling-graf {
		flex: 1;
		min-width: 0;
		margin-top: 0;
	}

	.y-akse {
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		font-size: calc(10px * var(--fs-scale, 1));
		color: var(--text3);
		text-align: right;
		font-variant-numeric: tabular-nums;
		flex-shrink: 0;
		min-width: 18px;
	}

	.y-akse span {
		line-height: 1;
	}

	.y-akse.stor {
		height: 120px;
	}

	.y-akse.lille {
		height: 80px;
	}

	.graf-akse {
		display: flex;
		justify-content: space-between;
		font-size: calc(10.5px * var(--fs-scale, 1));
		color: var(--text3);
		margin-top: 6px;
	}

	/* Når y-aksen er til venstre, skal dato-aksen rykkes så den starter
	 * efter y-akse-bredden. */
	.graf-akse.med-y-akse {
		padding-left: 24px;
	}

	.historik-liste {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.historik-rad {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 12px 14px;
		background: var(--bg2);
		border: 1px solid var(--border);
		border-radius: 10px;
		cursor: pointer;
		font-family: var(--ff-b);
		text-align: left;
		color: inherit;
	}

	.historik-rad:hover {
		background: var(--white);
		border-color: var(--terra);
	}

	.historik-dato {
		font-size: calc(12px * var(--fs-scale, 1));
		color: var(--text2);
		width: 95px;
		flex-shrink: 0;
	}

	.historik-info {
		flex: 1;
		min-width: 0;
		display: flex;
		align-items: baseline;
		gap: 10px;
		flex-wrap: wrap;
	}

	.historik-score {
		font-family: var(--ff-d);
		font-size: calc(18px * var(--fs-scale, 1));
		font-weight: 600;
		line-height: 1;
	}

	.historik-max {
		font-size: calc(11px * var(--fs-scale, 1));
		color: var(--text3);
		font-family: var(--ff-b);
	}

	.historik-label {
		font-size: calc(11.5px * var(--fs-scale, 1));
		font-weight: 500;
	}

	.hint {
		font-size: calc(12px * var(--fs-scale, 1));
		color: var(--text3);
		margin: 0;
	}

	.info-blok {
		background: var(--tdim);
		border-radius: 10px;
		padding: 14px;
		font-size: calc(11.5px * var(--fs-scale, 1));
		color: var(--text2);
		line-height: 1.6;
		margin-bottom: 12px;
	}

	.info-blok.kompakt {
		font-size: calc(12px * var(--fs-scale, 1));
		margin: 16px 0;
	}

	.maalepunkt-pill {
		display: inline-block;
		padding: 6px 14px;
		background: var(--tdim);
		color: var(--terra);
		border-radius: 99px;
		font-size: calc(12px * var(--fs-scale, 1));
		font-weight: 600;
		letter-spacing: 0.04em;
		margin-bottom: 18px;
	}

	.resultat-header .maalepunkt-pill {
		margin-bottom: 0;
	}

	.intro-blok {
		background: var(--tdim);
		border-radius: 12px;
		padding: 16px 18px;
		margin-bottom: 22px;
	}

	.intro-blok p {
		font-size: calc(13px * var(--fs-scale, 1));
		color: var(--text);
		line-height: 1.55;
		margin: 0 0 10px;
	}

	.intro-blok p:last-child {
		margin-bottom: 0;
	}

	.intro-liste {
		margin: 0 0 10px;
		padding-left: 22px;
		font-size: calc(13px * var(--fs-scale, 1));
		color: var(--text);
		line-height: 1.5;
	}

	.intro-liste li {
		margin-bottom: 6px;
	}

	.intro-liste li:last-child {
		margin-bottom: 0;
	}

	.intro-fodnote {
		font-size: calc(11.5px * var(--fs-scale, 1)) !important;
		color: var(--text3) !important;
	}

	.del-eyebrow {
		font-size: calc(10.5px * var(--fs-scale, 1));
		font-weight: 600;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--text3);
		margin-bottom: 10px;
	}

	.del-skille {
		display: flex;
		align-items: center;
		gap: 12px;
		margin: 32px 0 22px;
	}

	.del-skille-linje {
		flex: 1;
		height: 1px;
		background: var(--border);
	}

	.del-skille-label {
		font-size: calc(10.5px * var(--fs-scale, 1));
		font-weight: 600;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--text3);
	}

	.mrs-intro {
		margin-bottom: 22px;
	}

	.mrs-intro h2 {
		font-family: var(--ff-d);
		font-size: calc(22px * var(--fs-scale, 1));
		font-weight: 600;
		letter-spacing: -0.01em;
		color: var(--text);
		margin: 0 0 8px;
		line-height: 1.2;
	}

	.mrs-intro p {
		font-size: calc(13px * var(--fs-scale, 1));
		color: var(--text2);
		line-height: 1.55;
		margin: 0;
	}

	.mrs-intro em {
		font-style: italic;
		color: var(--text);
	}

	.subskala-blok {
		margin-bottom: 16px;
	}

	.slider-intro {
		font-size: calc(12.5px * var(--fs-scale, 1));
		color: var(--text2);
		margin: 0 0 14px;
		line-height: 1.5;
	}

	.slider-rad {
		display: grid;
		grid-template-columns: 1fr auto;
		align-items: center;
		gap: 6px 14px;
		padding: 12px 14px;
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 10px;
		margin-bottom: 10px;
	}

	.slider-label {
		grid-column: 1 / -1;
		font-size: calc(13.5px * var(--fs-scale, 1));
		font-weight: 500;
		color: var(--text);
	}

	.slider-rad input[type='range'] {
		grid-column: 1;
		width: 100%;
		accent-color: var(--terra);
	}

	.slider-vaerdi {
		grid-column: 2;
		font-family: var(--ff-d);
		font-size: calc(20px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--terra);
		min-width: 24px;
		text-align: right;
	}

	.subskala-label {
		display: inline-block;
		padding: 6px 12px;
		border-radius: 6px;
		font-size: calc(11px * var(--fs-scale, 1));
		font-weight: 600;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		margin-bottom: 12px;
	}

	.oevelse-kort {
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 10px;
		padding: 14px;
		margin-bottom: 10px;
	}

	.oevelse-kort.answered {
		border-color: rgba(0, 0, 0, 0.15);
	}

	.oevelse-titel {
		font-size: calc(14px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--text);
		margin-bottom: 4px;
	}

	.oevelse-desc {
		font-size: calc(11.5px * var(--fs-scale, 1));
		color: var(--text3);
		margin-bottom: 12px;
		line-height: 1.45;
	}

	.sev-rad {
		display: flex;
		gap: 6px;
	}

	.sev-knap {
		flex: 1;
		padding: 8px 4px;
		border-radius: 6px;
		font-size: calc(11px * var(--fs-scale, 1));
		font-weight: 500;
		cursor: pointer;
		border: 1px solid var(--border);
		background: transparent;
		color: var(--text3);
		font-family: var(--ff-b);
	}

	.sev-knap.valgt {
		border-width: 1.5px;
	}

	.progress {
		font-size: calc(13px * var(--fs-scale, 1));
		color: var(--text3);
		text-align: center;
		margin: 18px 0 12px;
	}

	.primary-knap {
		display: block;
		width: 100%;
		padding: 14px;
		background: var(--bg2);
		color: var(--text3);
		border: none;
		border-radius: 10px;
		font-size: calc(15px * var(--fs-scale, 1));
		font-weight: 500;
		font-family: var(--ff-b);
		cursor: not-allowed;
	}

	.primary-knap.klar {
		background: var(--terra);
		color: #fff;
		cursor: pointer;
	}

	.primary-knap:disabled {
		cursor: not-allowed;
	}

	.annuller-knap {
		display: block;
		width: 100%;
		padding: 12px;
		background: transparent;
		color: var(--text2);
		border: 1px solid var(--border);
		border-radius: 10px;
		font-size: calc(13px * var(--fs-scale, 1));
		cursor: pointer;
		font-family: var(--ff-b);
		margin-top: 8px;
	}

	.total-blok {
		border-radius: 12px;
		padding: 22px;
		text-align: center;
		margin-bottom: 18px;
	}

	.total-score {
		font-family: var(--ff-d);
		font-size: calc(42px * var(--fs-scale, 1));
		font-weight: 600;
		line-height: 1;
	}

	.total-max {
		font-size: calc(11px * var(--fs-scale, 1));
		color: var(--text3);
		margin: 6px 0 8px;
	}

	.total-label {
		font-size: calc(15px * var(--fs-scale, 1));
		font-weight: 500;
	}

	.total-forklaring {
		font-size: calc(13px * var(--fs-scale, 1));
		color: var(--text);
		line-height: 1.6;
		margin: 14px 0 0;
		text-align: left;
	}

	.total-forklaring.sekundaer {
		font-size: calc(11.5px * var(--fs-scale, 1));
		color: var(--text3);
		margin-top: 10px;
	}

	.resultat-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		flex-wrap: wrap;
		gap: 8px;
		margin-bottom: 14px;
	}

	.udfyldt-dato {
		font-size: calc(11.5px * var(--fs-scale, 1));
		color: var(--text3);
		letter-spacing: 0.02em;
	}

	.subskala-niveau {
		font-size: calc(11px * var(--fs-scale, 1));
		font-weight: 600;
		margin-top: 6px;
		letter-spacing: 0.02em;
	}

	.subskala-titel {
		font-size: calc(12px * var(--fs-scale, 1));
		color: var(--text3);
		margin: 0 0 10px;
		font-weight: 500;
	}

	.subskala-grid {
		display: flex;
		gap: 12px;
		margin-bottom: 18px;
	}

	.subskala-kort {
		flex: 1;
		min-width: 0;
		border-radius: 10px;
		padding: 14px;
		text-align: center;
	}

	.subskala-tal {
		font-family: var(--ff-d);
		font-size: calc(24px * var(--fs-scale, 1));
		font-weight: 600;
		line-height: 1;
	}

	.subskala-max {
		font-size: calc(10px * var(--fs-scale, 1));
		color: var(--text3);
		margin: 4px 0 6px;
	}

	.subskala-navn {
		font-size: calc(12px * var(--fs-scale, 1));
		font-weight: 500;
	}

	.subskala-beskrivelse {
		font-size: calc(10.5px * var(--fs-scale, 1));
		color: var(--text2);
		margin-top: 8px;
		line-height: 1.45;
		opacity: 0.85;
	}

	.bars-titel {
		font-size: calc(12px * var(--fs-scale, 1));
		color: var(--text3);
		margin: 0 0 12px;
		font-weight: 500;
	}

	.bars-liste {
		display: flex;
		flex-direction: column;
		gap: 8px;
		margin-bottom: 8px;
	}

	.bar-row {
		display: flex;
		align-items: center;
		gap: 10px;
	}

	.bar-label {
		font-size: calc(12px * var(--fs-scale, 1));
		color: var(--text2);
		width: 150px;
		flex-shrink: 0;
	}

	.bar-track {
		flex: 1;
		height: 8px;
		background: var(--bg2);
		border-radius: 4px;
		overflow: hidden;
	}

	.bar-fill {
		height: 100%;
		border-radius: 4px;
		transition: width 0.5s ease;
	}

	.bar-val {
		font-size: calc(13px * var(--fs-scale, 1));
		font-weight: 500;
		width: 20px;
		text-align: right;
	}
</style>
