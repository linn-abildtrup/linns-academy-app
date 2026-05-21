<script lang="ts">
	import { getContext, onDestroy, onMount } from 'svelte';
	import type { User } from 'firebase/auth';
	import { page } from '$app/state';
	import Icon from '$lib/components/Icon.svelte';
	import Loading from '$lib/components/Loading.svelte';
	import type { Exercise } from '$lib/content/mikrotraening';
	import { hentAlleExercises } from '$lib/firestore/mikrotraening';
	import { hentMitProgram } from '$lib/firestore/mineProgrammer';
	import type { CustomProgram } from '$lib/content/mineProgrammer';
	import { getVideoUrl } from '$lib/utils/storage';

	const getUser = getContext<() => User | null>('user');
	const user = $derived(getUser());

	const programId = $derived(page.params.id ?? '');

	let program = $state<CustomProgram | null>(null);
	let exerciseMap = $state<Map<string, Exercise>>(new Map());
	let loading = $state(true);
	let fejl = $state<string | null>(null);

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
		const u = user;
		if (!u) {
			fejl = 'Du skal være logget ind.';
			loading = false;
			return;
		}
		try {
			const [p, alleEx] = await Promise.all([
				hentMitProgram(u.uid, programId),
				hentAlleExercises()
			]);
			if (!p) {
				fejl = 'Programmet findes ikke.';
				loading = false;
				return;
			}
			program = p;
			const map = new Map<string, Exercise>();
			for (const ex of alleEx) map.set(ex.id, ex);
			exerciseMap = map;
		} catch (e) {
			console.error(e);
			fejl = 'Kunne ikke hente programmet.';
		} finally {
			loading = false;
		}
	});

	const harOevelser = $derived((program?.oevelser.length ?? 0) > 0);
</script>

<div class="page">
	<header class="page-header">
		<a class="back" href="/app/moduler/traening">
			<Icon name="arrow-l" size={14} color="var(--text2)" />
			<span>Træning</span>
		</a>
		<div class="eyebrow">Dagens træning</div>
		<h1>{program?.navn ?? 'Dagens øvelser'}</h1>
		<p class="page-sub">
			Tryk på en øvelse for at se den. Tryk Start træning for at gå i gang.
		</p>
		{#if program}
			<a class="rediger-link" href={`/app/moduler/traening/byg-eget/${programId}`}>
				<Icon name="settings" size={12} color="var(--text2)" />
				<span>Rediger program</span>
			</a>
		{/if}
	</header>

	{#if loading}
		<Loading tekst="Henter dagens øvelser..." />
	{:else if fejl}
		<div class="status-besked fejl">{fejl}</div>
	{:else if !harOevelser}
		<div class="status-besked">Programmet har ingen øvelser endnu.</div>
	{:else if program}
		<a class="start-knap top" href={`/app/moduler/traening/byg-eget/${programId}/spil`}>
			Start træning
			<Icon name="arrow" size={14} color="#fff" />
		</a>

		<div class="ovelse-liste">
			{#each program.oevelser as o, i (i)}
				{@const exercise = exerciseMap.get(o.exerciseId)}
				<article class="ovelse-row">
					<div class="ovelse-num">{i + 1}</div>
					<div class="ovelse-tekst">
						<div class="ovelse-navn">{exercise?.name ?? o.exerciseId}</div>
						<div class="ovelse-meta">
							{o.saet} sæt · {o.arbejdsSec}s arbejde · {o.pauseSec}s pause
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

	.back:hover {
		color: var(--text);
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

	.rediger-link {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		margin-top: 10px;
		padding: 6px 10px;
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 99px;
		text-decoration: none;
		font-size: calc(12px * var(--fs-scale, 1));
		color: var(--text2);
		font-family: var(--ff-b);
	}

	.rediger-link:hover {
		background: var(--bg2);
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

	.preview-knap:hover {
		filter: brightness(1.05);
	}

	.preview-knap:active {
		transform: scale(0.95);
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

	.start-knap:hover {
		filter: brightness(0.95);
	}

	.start-knap.top {
		margin-bottom: 14px;
	}

	/* Preview-overlay */
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
