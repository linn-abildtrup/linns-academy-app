<script lang="ts">
	import { getContext, onDestroy, onMount } from 'svelte';
	import type { User } from 'firebase/auth';
	import { page } from '$app/state';
	import Icon from '$lib/components/Icon.svelte';
	import Loading from '$lib/components/Loading.svelte';
	import type { Exercise, TrainingDay, UserProduct } from '$lib/content/mikrotraening';
	import {
		hentAlleExercises,
		hentForlobsProgram,
		hentUserProduct,
		type ProgramMedDage
	} from '$lib/firestore/mikrotraening';
	import { hentForlob, hentAktivProduktType } from '$lib/firestore/forlob';
	import { getCurrentDayMedNulDage, nulDageDatoer } from '$lib/content/forlob';
	import { getVideoUrl } from '$lib/utils/storage';
	import { alleProdukter } from '$lib/content/produkter';
	import type { UserDoc } from '$lib/types';

	const getUser = getContext<() => User | null>('user');
	const user = $derived(getUser());

	const forlobId = $derived(page.params.forlobId ?? '');
	const programId = $derived(page.params.programId ?? '');

	let programData = $state<ProgramMedDage | null>(null);
	let exerciseMap = $state<Map<string, Exercise>>(new Map());
	let loading = $state(true);
	let fejl = $state<string | null>(null);

	// Dagens dag-nummer beregnes ud fra forlob.startDato + dato i dag - nul-dage.
	// Bruges til at slaa den rigtige dag op i programData.dage.
	let aktuelDagNummer = $state<number>(1);

	// Hvilken dag kunden kigger paa. Default = dagens dag, men hun kan vaelge
	// en tidligere dag i dag-vaelgeren (til og med i dag — fremtidige dage er
	// laast indtil de kommer).
	let valgtDag = $state<number>(1);

	const getUserDoc = getContext<() => UserDoc | null>('userDoc');
	const userDoc = $derived(getUserDoc?.() ?? null);

	let aabenPreview = $state<Exercise | null>(null);
	let previewVideoUrl = $state<string | null>(null);
	let previewLoading = $state(false);

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
		if (!user) {
			fejl = 'Du skal være logget ind.';
			loading = false;
			return;
		}
		try {
			const ud = userDoc;
			const [data, alleEx, forlob, produktType] = await Promise.all([
				hentForlobsProgram(forlobId, programId),
				hentAlleExercises(),
				hentForlob(forlobId),
				hentAktivProduktType(ud?.forlobIds ?? [forlobId])
			]);
			if (!data) {
				fejl = 'Programmet findes ikke.';
				loading = false;
				return;
			}
			programData = data;
			const map = new Map<string, Exercise>();
			for (const ex of alleEx) map.set(ex.id, ex);
			exerciseMap = map;

			// Bereg dagens dag-nummer ud fra forlob.startDato + nul-dage.
			// Forsiden bruger samme logik. Dag-nummeret er 1-indekseret —
			// getCurrentDayMedNulDage returnerer 0 paa dag 1, saa vi adderer 1.
			if (forlob) {
				let nulDatoer: string[] = [];
				try {
					const up = await hentUserProduct(user.uid, produktType);
					nulDatoer = nulDageDatoer(up?.nulDage?.intervaller ?? []);
				} catch {
					// Best-effort — fortsaet uden nul-dage hvis vi ikke kan hente
				}
				const startDato = forlob.startDato.toDate().toISOString().slice(0, 10);
				const idx = getCurrentDayMedNulDage(
					{ startDato, antalDage: forlob.antalDage },
					nulDatoer
				);
				if (idx !== null) {
					// idx er 0-indekseret (dag 1 = 0). Vi vil have 1-indekseret dag-nummer.
					// Modulo i stedet for clamp: naar foroebet er slut, cykler vi gennem
					// programmet igen i stedet for at sidde fast paa sidste dag. Det
					// betyder en basis-abo-kunde der har gennemfoert et 21-dages forloeb
					// faar dag 1 igen paa dag 22, ikke dag 21 i evighed.
					aktuelDagNummer = (idx % forlob.antalDage) + 1;
					valgtDag = aktuelDagNummer;
				}
			}
		} catch (e) {
			console.error(e);
			fejl = 'Kunne ikke hente programmet.';
		} finally {
			loading = false;
		}
	});

	const dag = $derived<TrainingDay | null>(
		programData?.dage.find((d) => d.dagNummer === valgtDag) ??
			programData?.dage[0] ??
			null
	);
	const harOevelser = $derived((dag?.exercises.length ?? 0) > 0);

	const forlobNavn = $derived(
		alleProdukter().find((p) => p.forlobId === forlobId)?.navn ?? forlobId
	);
</script>

<div class="page">
	<header class="page-header">
		<a class="back" href="/app/moduler/traening">
			<Icon name="arrow-l" size={14} color="var(--text2)" />
			<span>Træning</span>
		</a>
		<div class="eyebrow">Dagens træning</div>
		<h1>{programData?.program.navn ?? 'Dagens øvelser'}</h1>
		<p class="page-sub">
			Tryk på en øvelse for at se den. Tryk Start træning for at gå i gang.
		</p>
		<div class="meta-pille">Tildelt fra {forlobNavn}</div>
	</header>

	{#if loading}
		<Loading tekst="Henter dagens øvelser..." />
	{:else if fejl}
		<div class="status-besked fejl">{fejl}</div>
	{:else if !dag || !harOevelser}
		<div class="status-besked">Programmet har ingen øvelser endnu.</div>
	{:else if programData}
		{#if aktuelDagNummer > 1}
			<div class="dag-vaelger" role="tablist" aria-label="Vælg dag">
				{#each Array.from({ length: aktuelDagNummer }, (_, i) => i + 1) as d (d)}
					<button
						type="button"
						class="dag-chip"
						class:valgt={valgtDag === d}
						class:idag={d === aktuelDagNummer}
						role="tab"
						aria-selected={valgtDag === d}
						onclick={() => (valgtDag = d)}
					>
						<span class="dag-chip-label">Dag</span>
						<span class="dag-chip-num">{d}</span>
					</button>
				{/each}
			</div>
		{/if}

		<a
			class="start-knap top"
			href={`/app/moduler/traening/program/${forlobId}/${programId}/spil?dag=${valgtDag}`}
		>
			{valgtDag === aktuelDagNummer ? 'Start træning' : `Start dag ${valgtDag}`}
			<Icon name="arrow" size={14} color="#fff" />
		</a>

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

	.meta-pille {
		display: inline-block;
		margin-top: 10px;
		padding: 4px 10px;
		background: var(--tdim);
		color: var(--terra);
		border-radius: 99px;
		font-size: calc(11px * var(--fs-scale, 1));
		font-weight: 500;
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
		text-decoration: none;
		cursor: pointer;
		font-family: var(--ff-b);
		box-sizing: border-box;
	}

	.start-knap.top {
		margin-bottom: 14px;
	}

	.dag-vaelger {
		display: flex;
		gap: 8px;
		overflow-x: auto;
		padding: 4px 0 12px;
		-webkit-overflow-scrolling: touch;
		scrollbar-width: none;
	}

	.dag-vaelger::-webkit-scrollbar {
		display: none;
	}

	.dag-chip {
		flex: 0 0 auto;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 2px;
		min-width: 48px;
		padding: 8px 4px;
		background: var(--bg2);
		color: var(--text2);
		border: 1px solid transparent;
		border-radius: 12px;
		cursor: pointer;
		font-family: var(--ff-d);
	}

	.dag-chip-label {
		font-size: calc(10px * var(--fs-scale, 1));
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.dag-chip-num {
		font-size: calc(16px * var(--fs-scale, 1));
		font-weight: 600;
	}

	.dag-chip.idag {
		border-color: var(--terra);
	}

	.dag-chip.valgt {
		background: var(--terra);
		color: #fff;
		border-color: var(--terra);
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
