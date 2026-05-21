<script lang="ts">
	import { getContext, onMount } from 'svelte';
	import type { User } from 'firebase/auth';
	import type { UserDoc } from '$lib/types';
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
		SUBSCALES,
		validerScores,
		type MaalePunkt,
		type MrsScore
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
	let tidligereScores = $state<MrsScore[]>([]);
	let netop_gemt = $state<MrsScore | null>(null);
	let loading = $state(true);
	let gemmer = $state(false);
	let fejl = $state<string | null>(null);

	const antalBesvaret = $derived(Object.keys(scores).length);
	const klarTilSubmit = $derived(antalBesvaret === MRS_ITEMS.length);

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
		netop_gemt = null;
		fejl = null;
		visning = 'udfyld';
		if (typeof window !== 'undefined') window.scrollTo({ top: 0 });
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
				scores
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

	const skalUdfylde = $derived(
		skalUdfyldeNu(
			userDoc?.accessSource,
			userDoc?.activeProduct,
			sidsteUdfyldelseAt
		)
	);

	const naesteCheckDato = $derived(
		sidsteUdfyldelseAt !== null
			? naesteUdfyldelseDato(
					userDoc?.accessSource,
					userDoc?.activeProduct,
					sidsteUdfyldelseAt
				)
			: null
	);

	const kadenceTekst = $derived.by<string>(() => {
		if (userDoc?.accessSource === 'forløb' && userDoc.activeProduct === 'kickstart') {
			return 'På Kickstart udfylder du hver søndag — så du kan se din udvikling uge for uge.';
		}
		if (
			userDoc?.accessSource === 'forløb' &&
			userDoc.activeProduct === 'premiumforløb'
		) {
			return 'På Kropsro udfylder du hver 4. uge gennem dit forløb.';
		}
		return 'Du udfylder en symptomcheck én gang om måneden, så du kan følge din udvikling over tid.';
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
			<button type="button" class="cta-knap" onclick={startNyUdfyldelse}>
				<div class="cta-tekst">
					{#if naesteCheckDato}
						<div class="cta-eyebrow">Næste udfyldelse {formaterDato(naesteCheckDato)}</div>
					{/if}
					<div class="cta-titel">Tag en check nu</div>
				</div>
				<Icon name="chevron-r" size={14} color="var(--terra)" />
			</button>
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
				<div class="card-titel">Din udvikling</div>
				<p class="card-sub">Total-score fra første til seneste udfyldelse.</p>
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
				<div class="graf-akse">
					<span>{formaterDatoTekst(tidligereSorteret[tidligereSorteret.length - 1].timestamp)}</span>
					<span>{formaterDatoTekst(tidligereSorteret[0].timestamp)}</span>
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

		<p class="progress">{antalBesvaret} af {MRS_ITEMS.length} besvaret</p>
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

	.udvikling-graf {
		display: block;
		width: 100%;
		height: 120px;
		margin-top: 8px;
	}

	.graf-akse {
		display: flex;
		justify-content: space-between;
		font-size: calc(10.5px * var(--fs-scale, 1));
		color: var(--text3);
		margin-top: 6px;
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
	}

	.subskala-blok {
		margin-bottom: 16px;
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
