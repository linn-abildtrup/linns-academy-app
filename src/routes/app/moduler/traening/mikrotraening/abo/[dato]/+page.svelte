<script lang="ts">
	import { getContext, onMount, onDestroy } from 'svelte';
	import { page } from '$app/state';
	import type { User } from 'firebase/auth';
	import type { UserDoc } from '$lib/types';
	import type { Exercise, TrainingDay } from '$lib/content/mikrotraening';
	import {
		aktuelAboDag,
		type AboMikrotraeningFremgang,
		type AboMikrotraeningTraening
	} from '$lib/content/aboMikrotraening';
	import {
		hentAboFremgang,
		hentAboMikrotraeningProgram,
		hentAlleAboTraeninger,
		type AboMikrotraeningProgramMedDage
	} from '$lib/firestore/aboMikrotraening';
	import { hentExercises } from '$lib/firestore/mikrotraening';
	import { harPremium } from '$lib/utils/userAdgang';
	import { getVideoUrl } from '$lib/utils/storage';
	import Icon from '$lib/components/Icon.svelte';
	import Loading from '$lib/components/Loading.svelte';

	const getUser = getContext<() => User | null>('user');
	const getUserDoc = getContext<() => UserDoc | null>('userDoc');
	const user = $derived(getUser());
	const userDoc = $derived(getUserDoc());

	const dato = $derived(page.params.dato ?? '');
	const produktType = $derived<'basis' | 'premium'>(harPremium(userDoc) ? 'premium' : 'basis');

	function dagsDatoStr(d: Date): string {
		const aar = d.getFullYear();
		const m = String(d.getMonth() + 1).padStart(2, '0');
		const dag = String(d.getDate()).padStart(2, '0');
		return `${aar}-${m}-${dag}`;
	}

	const idagDato = $derived(dagsDatoStr(new Date()));
	const datoErGyldig = $derived(/^\d{4}-\d{2}-\d{2}$/.test(dato));

	const datoStatus = $derived.by<'i_dag' | 'fortid_naer' | 'fortid_lang' | 'fremtid'>(() => {
		if (!datoErGyldig) return 'fremtid';
		if (dato === idagDato) return 'i_dag';
		if (dato > idagDato) return 'fremtid';
		// Beregn dage siden
		const a = new Date(idagDato);
		const b = new Date(dato);
		const diffMs = a.getTime() - b.getTime();
		const dageSiden = Math.round(diffMs / (1000 * 60 * 60 * 24));
		return dageSiden <= 3 ? 'fortid_naer' : 'fortid_lang';
	});

	let programData = $state<AboMikrotraeningProgramMedDage | null>(null);
	let fremgang = $state<AboMikrotraeningFremgang | null>(null);
	let eksisterendeTraening = $state<AboMikrotraeningTraening | null>(null);
	let exerciseMap = $state<Map<string, Exercise>>(new Map());

	let aabenPreview = $state<Exercise | null>(null);
	let previewVideoUrl = $state<string | null>(null);
	let previewLoading = $state(false);

	let loading = $state(true);
	let fejl = $state<string | null>(null);

	// ProgramDag bestemmes fra dato:
	// - Eksisterende træning: brug stored programDag
	// - I dag eller seneste få dage uden træning: brug aktuelAboDag
	// - Fremtid eller ingen træning langt tilbage: vis fejl
	const programDag = $derived.by<number | null>(() => {
		if (eksisterendeTraening) return eksisterendeTraening.programDag;
		if (datoStatus === 'i_dag' || datoStatus === 'fortid_naer') {
			return aktuelAboDag(fremgang);
		}
		return null;
	});
	const dag = $derived<TrainingDay | null>(
		programData && programDag !== null
			? programData.dage.find((d) => d.dagNummer === programDag) ?? null
			: null
	);
	const harOvelser = $derived((dag?.exercises.length ?? 0) > 0);
	const erTraenet = $derived(eksisterendeTraening !== null);
	const kanStartes = $derived(
		(datoStatus === 'i_dag' || datoStatus === 'fortid_naer') && !erTraenet
	);

	const datoLabel = $derived.by(() => {
		if (!datoErGyldig) return '';
		const [aar, m, d] = dato.split('-').map(Number);
		const dt = new Date(aar, m - 1, d);
		return dt.toLocaleDateString('da-DK', {
			weekday: 'long',
			day: 'numeric',
			month: 'long'
		});
	});

	async function aabnPreview(ex: Exercise) {
		aabenPreview = ex;
		previewVideoUrl = null;
		if (typeof document !== 'undefined') {
			document.body.classList.add('html-fullscreen-aktiv');
		}
		if (!ex.videoPath) return;
		previewLoading = true;
		try {
			previewVideoUrl = await getVideoUrl(ex.videoPath);
		} catch (e) {
			console.warn('Kunne ikke hente video for', ex.id, e);
		} finally {
			previewLoading = false;
		}
	}

	function lukPreview() {
		aabenPreview = null;
		previewVideoUrl = null;
		if (typeof document !== 'undefined') {
			document.body.classList.remove('html-fullscreen-aktiv');
		}
	}

	onDestroy(() => {
		if (typeof document !== 'undefined') {
			document.body.classList.remove('html-fullscreen-aktiv');
		}
	});

	onMount(async () => {
		const u = user;
		if (!u) {
			fejl = 'Du skal være logget ind.';
			loading = false;
			return;
		}
		if (!datoErGyldig) {
			fejl = 'Ugyldig dato.';
			loading = false;
			return;
		}
		if (datoStatus === 'fremtid') {
			fejl = 'Du kan ikke åbne en dag der ligger i fremtiden.';
			loading = false;
			return;
		}

		const variant = userDoc?.mikrotraeningVariant ?? 'no_kettlebell';
		try {
			const [program, f, traeninger] = await Promise.all([
				hentAboMikrotraeningProgram(produktType, variant),
				hentAboFremgang(u.uid),
				hentAlleAboTraeninger(u.uid)
			]);
			if (!program) {
				fejl = 'Træningsprogrammet er ikke sat op endnu.';
				loading = false;
				return;
			}
			programData = program;
			fremgang = f;
			eksisterendeTraening = traeninger.find((t) => t.dato === dato) ?? null;

			if (programDag === null) {
				// Fortid uden træning og uden mulighed for sen-træning
				loading = false;
				return;
			}

			const exerciseIds = (program.dage.find((d) => d.dagNummer === programDag)?.exercises ?? []).map(
				(e) => e.exerciseId
			);
			if (exerciseIds.length > 0) {
				exerciseMap = await hentExercises(exerciseIds);
			}
		} catch (e) {
			fejl = 'Kunne ikke hente data. Prøv igen.';
			console.error(e);
		} finally {
			loading = false;
		}
	});

</script>

<div class="page">
	<header class="page-header">
		<a class="back" href="/app">
			<Icon name="arrow-l" size={14} color="var(--text2)" />
			<span>Forside</span>
		</a>
		<div class="eyebrow">{datoLabel}</div>
		<h1>Dagens øvelser</h1>
		{#if dag?.indledning}
			<p class="page-sub">{dag.indledning}</p>
		{:else if erTraenet}
			<p class="page-sub">Du trænede denne dag — her er hvad du lavede.</p>
		{:else}
			<p class="page-sub">Tryk på en øvelse for at se den. Start træningen når du er klar.</p>
		{/if}
	</header>

	{#if loading}
		<Loading tekst="Henter dagens øvelser..." />
	{:else if fejl}
		<div class="status-besked fejl">{fejl}</div>
	{:else if programDag === null}
		<div class="status-besked">
			Du trænede ikke denne dag — og det er for længe siden til at registrere det nu.
		</div>
	{:else if !dag}
		<div class="status-besked fejl">Træningen for denne dag kunne ikke findes.</div>
	{:else if !harOvelser}
		<div class="status-besked">
			Der er ikke lagt øvelser ind for denne dag endnu. Kig forbi senere.
		</div>
	{:else}
		<div class="ovelse-liste">
			{#each dag.exercises as ex, i (i)}
				{@const exercise = exerciseMap.get(ex.exerciseId)}
				<article class="ovelse-row" class:bonus={ex.bonus}>
					<div class="ovelse-num">{i + 1}</div>
					<div class="ovelse-tekst">
						<div class="ovelse-navn">
							{exercise?.name ?? ex.exerciseId}
							{#if ex.bonus}
								<span class="bonus-badge">Bonus</span>
							{/if}
						</div>
						<div class="ovelse-meta">
							{ex.sets} sæt · {ex.workSec}s arbejde · {ex.restSec}s hvile
						</div>
						{#if exercise?.catLabel}
							<div class="ovelse-cat">{exercise.catLabel}</div>
						{/if}
					</div>
					{#if exercise}
						<button
							class="preview-knap"
							type="button"
							onclick={() => aabnPreview(exercise)}
							aria-label="Se hvordan {exercise.name} udføres"
							title="Se øvelsen"
						>
							<Icon name="play" size={14} color="#fff" filled />
						</button>
					{/if}
				</article>
			{/each}
		</div>

		{#if erTraenet}
			<div class="done-banner">
				<Icon name="check" size={14} color="#6f9e7e" />
				<span>Du trænede denne dag — du er velkommen til at køre den igen.</span>
			</div>
		{/if}

		{#if kanStartes || erTraenet}
			<a class="start-knap" href="/app/moduler/traening/mikrotraening/abo/{dato}/spil">
				{erTraenet ? 'Kør træningen igen' : datoStatus === 'i_dag' ? 'Start dagens træning' : 'Registrer træning'}
				<Icon name="arrow" size={14} color="#fff" />
			</a>
		{/if}
	{/if}
</div>

{#if aabenPreview}
	<div class="preview-overlay" role="dialog" aria-modal="true">
		<header class="preview-head">
			<button class="preview-luk" type="button" onclick={lukPreview}>
				<Icon name="arrow-l" size={14} color="var(--text)" />
				<span>Tilbage</span>
			</button>
			<div class="preview-titel-top">{aabenPreview.name}</div>
		</header>

		<div class="preview-video">
			{#if previewLoading}
				<Loading tekst="Henter video..." kompakt />
			{:else if previewVideoUrl}
				<video src={previewVideoUrl} autoplay muted loop playsinline preload="auto"></video>
			{:else}
				<div class="preview-fallback">
					<div class="preview-fallback-navn">{aabenPreview.name}</div>
					<div class="preview-fallback-hint">Video følger snart</div>
				</div>
			{/if}
		</div>

		<div class="preview-scroll">
			<div class="preview-card">
				<div class="preview-navn">{aabenPreview.name}</div>
				{#if aabenPreview.desc}
					<p class="preview-desc">{aabenPreview.desc}</p>
				{/if}

				{#if aabenPreview.how && aabenPreview.how.length > 0}
					<div class="preview-divider"></div>
					<div class="preview-how-label">Sådan udfører du øvelsen</div>
					<ol class="preview-how-liste">
						{#each aabenPreview.how as trin (trin)}
							<li>{trin}</li>
						{/each}
					</ol>
				{/if}

				{#if aabenPreview.tags && aabenPreview.tags.length > 0}
					<div class="preview-divider"></div>
					<div class="preview-tags">
						{#each aabenPreview.tags as tag (tag)}
							<span class="preview-tag">{tag}</span>
						{/each}
					</div>
				{/if}
			</div>
		</div>
	</div>
{/if}

<style>
	.page {
		padding: 18px 18px 100px;
		max-width: 520px;
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
		background: none;
		border: none;
		padding: 0;
		font-family: var(--ff-b);
		cursor: pointer;
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
		font-size: calc(28px * var(--fs-scale, 1));
		font-weight: 600;
		letter-spacing: -0.02em;
		margin: 4px 0 0;
		line-height: 1.05;
		color: var(--text);
	}

	.page-sub {
		font-size: calc(13px * var(--fs-scale, 1));
		color: var(--text2);
		margin: 6px 0 0;
		line-height: 1.4;
	}

	.status-besked {
		padding: 14px 16px;
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 12px;
		color: var(--text2);
		font-size: calc(13px * var(--fs-scale, 1));
		text-align: center;
	}

	.status-besked.fejl {
		color: #8a4a3e;
		background: #fbeeea;
		border-color: #f0d6cf;
	}

	.ovelse-liste {
		display: flex;
		flex-direction: column;
		gap: 8px;
		margin-bottom: 14px;
	}

	.ovelse-row {
		display: flex;
		align-items: center;
		gap: 12px;
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 12px;
		padding: 12px 14px;
	}

	.ovelse-row.bonus {
		border-color: #e5d6c8;
		background: #fdf8f2;
	}

	.ovelse-num {
		width: 28px;
		height: 28px;
		border-radius: 50%;
		background: var(--bg2);
		color: var(--text2);
		font-size: calc(12px * var(--fs-scale, 1));
		font-weight: 600;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.ovelse-tekst {
		flex: 1;
		min-width: 0;
	}

	.ovelse-navn {
		font-size: calc(14px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--text);
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.bonus-badge {
		font-size: calc(9px * var(--fs-scale, 1));
		letter-spacing: 0.1em;
		text-transform: uppercase;
		background: var(--terra2);
		color: #fff;
		padding: 2px 7px;
		border-radius: 99px;
	}

	.ovelse-meta {
		font-size: calc(11.5px * var(--fs-scale, 1));
		color: var(--text3);
		margin-top: 2px;
	}

	.ovelse-cat {
		font-size: calc(10.5px * var(--fs-scale, 1));
		color: var(--text4);
		margin-top: 2px;
		letter-spacing: 0.04em;
	}

	.done-banner {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 12px 14px;
		background: #eef5ef;
		border: 1px solid #d6e6da;
		border-radius: 12px;
		font-size: calc(12.5px * var(--fs-scale, 1));
		color: #4a6b54;
		margin-bottom: 14px;
	}

	.start-knap {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		width: 100%;
		padding: 14px;
		background: var(--terra);
		color: #fff;
		font-size: calc(14px * var(--fs-scale, 1));
		font-weight: 600;
		border-radius: 12px;
		border: none;
		cursor: pointer;
		font-family: var(--ff-b);
		text-decoration: none;
		box-sizing: border-box;
	}

	.preview-knap {
		flex-shrink: 0;
		width: 36px;
		height: 36px;
		border-radius: 50%;
		border: none;
		background: var(--terra);
		color: #fff;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		font-family: var(--ff-b);
		padding: 0;
	}

	.preview-overlay {
		position: fixed;
		inset: 0;
		z-index: 100;
		background: var(--bg);
		display: flex;
		flex-direction: column;
		padding-top: env(safe-area-inset-top);
		padding-bottom: env(safe-area-inset-bottom);
	}

	.preview-head {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 10px 14px;
		border-bottom: 1px solid var(--border);
		flex-shrink: 0;
		background: var(--white);
	}

	.preview-luk {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 8px 12px;
		border-radius: 8px;
		border: 1px solid var(--border);
		background: var(--white);
		color: var(--text);
		font-size: calc(13px * var(--fs-scale, 1));
		font-weight: 500;
		cursor: pointer;
		font-family: var(--ff-b);
		flex-shrink: 0;
	}

	.preview-titel-top {
		flex: 1;
		font-family: var(--ff-d);
		font-size: calc(14px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--text);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.preview-video {
		flex-shrink: 0;
		width: 100%;
		aspect-ratio: 16 / 9;
		background: #000;
		display: flex;
		align-items: center;
		justify-content: center;
		overflow: hidden;
	}

	.preview-video video {
		width: 100%;
		height: 100%;
		object-fit: contain;
		background: #000;
	}

	.preview-scroll {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		padding: 14px;
		-webkit-overflow-scrolling: touch;
	}

	.preview-fallback {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6px;
		text-align: center;
		padding: 20px;
	}

	.preview-fallback-navn {
		font-family: var(--ff-d);
		font-size: calc(22px * var(--fs-scale, 1));
		font-style: italic;
		color: var(--text3);
	}

	.preview-fallback-hint {
		font-size: calc(10px * var(--fs-scale, 1));
		color: var(--text4);
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}

	.preview-card {
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 14px;
		padding: 18px;
		display: flex;
		flex-direction: column;
		gap: 11px;
	}

	.preview-navn {
		font-family: var(--ff-d);
		font-size: calc(22px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--text);
		line-height: 1.2;
	}

	.preview-desc {
		font-size: calc(14px * var(--fs-scale, 1));
		line-height: 1.6;
		color: var(--text2);
		margin: 0;
	}

	.preview-divider {
		height: 1px;
		background: var(--border);
		margin: 4px 0;
	}

	.preview-how-label {
		font-size: calc(10px * var(--fs-scale, 1));
		font-weight: 500;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--terra);
	}

	.preview-how-liste {
		margin: 0;
		padding-left: 20px;
		display: flex;
		flex-direction: column;
		gap: 8px;
		font-size: calc(14px * var(--fs-scale, 1));
		line-height: 1.6;
		color: var(--text);
	}

	.preview-how-liste li {
		padding-left: 4px;
	}

	.preview-tags {
		display: flex;
		flex-wrap: wrap;
		gap: 7px;
	}

	.preview-tag {
		font-size: calc(11px * var(--fs-scale, 1));
		padding: 4px 10px;
		border-radius: 999px;
		background: var(--tdim);
		color: var(--terra);
	}
</style>
