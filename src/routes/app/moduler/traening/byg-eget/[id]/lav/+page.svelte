<script lang="ts">
	import { getContext, onMount } from 'svelte';
	import type { User } from 'firebase/auth';
	import { page } from '$app/state';
	import Icon from '$lib/components/Icon.svelte';
	import type { Exercise } from '$lib/content/mikrotraening';
	import { hentExercises } from '$lib/firestore/mikrotraening';
	import { hentMitProgram } from '$lib/firestore/mineProgrammer';
	import {
		anslaaetVarighedMinutter,
		type CustomProgram
	} from '$lib/content/mineProgrammer';
	import { getVideoUrl } from '$lib/utils/storage';

	const getUser = getContext<() => User | null>('user');
	const user = $derived(getUser());

	const programId = $derived(page.params.id ?? '');

	let program = $state<CustomProgram | null>(null);
	let exerciseMap = $state<Map<string, Exercise>>(new Map());
	let videoUrls = $state<Map<string, string>>(new Map());
	let indlaeser = $state(true);
	let fejl = $state<string | null>(null);

	onMount(async () => {
		if (!user) {
			fejl = 'Du skal være logget ind.';
			indlaeser = false;
			return;
		}
		try {
			const p = await hentMitProgram(user.uid, programId);
			if (!p) {
				fejl = 'Programmet findes ikke.';
				indlaeser = false;
				return;
			}
			program = p;
			const exerciseIds = Array.from(new Set(p.oevelser.map((o) => o.exerciseId)));
			exerciseMap = await hentExercises(exerciseIds);

			const urls = new Map<string, string>();
			await Promise.all(
				Array.from(exerciseMap.values()).map(async (ex) => {
					if (!ex.videoPath) return;
					try {
						const url = await getVideoUrl(ex.videoPath);
						urls.set(ex.videoPath, url);
					} catch (e) {
						console.warn('Kunne ikke hente video for', ex.id, e);
					}
				})
			);
			videoUrls = urls;
		} catch (e) {
			console.error(e);
			fejl = 'Kunne ikke hente programmet.';
		} finally {
			indlaeser = false;
		}
	});

	const anslaaetMin = $derived(
		program ? anslaaetVarighedMinutter({ oevelser: program.oevelser }) : 0
	);

	function pauseTekst(sec: number): string {
		if (sec < 60) return `${sec} sek pause`;
		const min = Math.floor(sec / 60);
		const rest = sec % 60;
		return rest === 0 ? `${min} min pause` : `${min} min ${rest} sek pause`;
	}
</script>

<div class="page">
	<header class="page-header">
		<a class="back" href="/app/moduler/traening">
			<Icon name="arrow-l" size={14} color="var(--text2)" />
			<span>Træning</span>
		</a>
		<div class="eyebrow">Dagens træning</div>
		<h1>{program?.navn ?? (indlaeser ? 'Henter…' : 'Program')}</h1>
		{#if program}
			<p class="page-sub">
				{program.oevelser.length} øvelser · ca. {anslaaetMin} min
			</p>
		{/if}
		{#if program}
			<a class="rediger-link" href={`/app/moduler/traening/byg-eget/${programId}`}>
				<Icon name="settings" size={12} color="var(--text2)" />
				<span>Rediger program</span>
			</a>
		{/if}
	</header>

	{#if fejl}
		<div class="besked fejl">{fejl}</div>
	{:else if indlaeser}
		<div class="besked">Henter dit program…</div>
	{:else if program}
		<a class="start-knap top" href={`/app/moduler/traening/byg-eget/${programId}/spil`}>
			<Icon name="play" size={14} color="#fff" filled />
			<span>Start træning</span>
		</a>

		<div class="oevelse-liste">
			{#each program.oevelser as o, i (i)}
				{@const ex = exerciseMap.get(o.exerciseId)}
				{@const videoUrl = ex?.videoPath ? videoUrls.get(ex.videoPath) : null}
				<div class="oevelse-kort">
					<div class="oevelse-nummer">{i + 1}</div>
					{#if videoUrl}
						<video
							class="oevelse-video"
							src={videoUrl}
							autoplay
							muted
							loop
							playsinline
							preload="metadata"
						></video>
					{:else}
						<div class="oevelse-video-tom">
							<Icon name="flame" size={24} color="var(--text3)" />
						</div>
					{/if}
					<div class="oevelse-info">
						<div class="oevelse-navn">{ex?.name ?? o.exerciseId}</div>
						{#if ex?.desc}
							<div class="oevelse-beskrivelse">{ex.desc}</div>
						{/if}
						<div class="oevelse-stats">
							<div class="stat">
								<div class="stat-tal">{o.saet}</div>
								<div class="stat-label">sæt</div>
							</div>
							<div class="stat-skille"></div>
							<div class="stat">
								<div class="stat-tal">{o.arbejdsSec}s</div>
								<div class="stat-label">arbejde</div>
							</div>
							<div class="stat-skille"></div>
							<div class="stat">
								<div class="stat-tal">{o.pauseSec}s</div>
								<div class="stat-label">pause</div>
							</div>
						</div>
						{#if ex?.how && ex.how.length > 0}
							<details class="how">
								<summary>Sådan gør du</summary>
								<ol>
									{#each ex.how as h, hi (hi)}
										<li>{h}</li>
									{/each}
								</ol>
							</details>
						{/if}
						<div class="oevelse-pause">{pauseTekst(o.pauseSec)} mellem sæt</div>
					</div>
				</div>
			{/each}
		</div>

		<a class="start-knap" href={`/app/moduler/traening/byg-eget/${programId}/spil`}>
			<Icon name="play" size={14} color="#fff" filled />
			<span>Start træning</span>
		</a>
	{/if}
</div>

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

	.besked {
		padding: 14px 16px;
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 12px;
		color: var(--text2);
		font-size: calc(13px * var(--fs-scale, 1));
		text-align: center;
	}

	.besked.fejl {
		color: #8a4a3e;
		background: #fbeeea;
		border-color: #f0d6cf;
	}

	.oevelse-liste {
		display: flex;
		flex-direction: column;
		gap: 14px;
	}

	.oevelse-kort {
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 14px;
		overflow: hidden;
		position: relative;
	}

	.oevelse-nummer {
		position: absolute;
		top: 12px;
		left: 12px;
		width: 28px;
		height: 28px;
		border-radius: 14px;
		background: rgba(0, 0, 0, 0.55);
		color: #fff;
		font-size: calc(13px * var(--fs-scale, 1));
		font-weight: 600;
		display: flex;
		align-items: center;
		justify-content: center;
		font-family: var(--ff-b);
		z-index: 1;
	}

	.oevelse-video {
		display: block;
		width: 100%;
		aspect-ratio: 16 / 9;
		object-fit: cover;
		background: #000;
	}

	.oevelse-video-tom {
		width: 100%;
		aspect-ratio: 16 / 9;
		background: var(--bg2);
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.oevelse-info {
		padding: 14px;
	}

	.oevelse-navn {
		font-size: calc(16px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--text);
	}

	.oevelse-beskrivelse {
		font-size: calc(12.5px * var(--fs-scale, 1));
		color: var(--text2);
		margin-top: 4px;
		line-height: 1.45;
	}

	.oevelse-stats {
		display: flex;
		align-items: center;
		gap: 16px;
		margin-top: 12px;
		padding: 12px;
		background: var(--bg2);
		border-radius: 10px;
	}

	.stat {
		flex: 1;
		text-align: center;
	}

	.stat-tal {
		font-family: var(--ff-d);
		font-size: calc(20px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--text);
	}

	.stat-label {
		font-size: calc(10.5px * var(--fs-scale, 1));
		font-weight: 600;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--text3);
		margin-top: 2px;
	}

	.stat-skille {
		width: 1px;
		align-self: stretch;
		background: var(--border);
	}

	.how {
		margin-top: 12px;
		font-size: calc(12.5px * var(--fs-scale, 1));
		color: var(--text2);
	}

	.how summary {
		cursor: pointer;
		font-weight: 600;
		color: var(--terra);
		padding: 4px 0;
	}

	.how ol {
		margin: 6px 0 0;
		padding-left: 20px;
		line-height: 1.5;
	}

	.how li {
		margin-bottom: 4px;
	}

	.oevelse-pause {
		margin-top: 8px;
		font-size: calc(11.5px * var(--fs-scale, 1));
		color: var(--text3);
		text-align: center;
	}

	.start-knap {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		padding: 14px 18px;
		background: var(--terra);
		color: #fff;
		border-radius: 12px;
		text-decoration: none;
		font-size: calc(15px * var(--fs-scale, 1));
		font-weight: 600;
		font-family: var(--ff-b);
		margin: 16px 0;
	}

	.start-knap.top {
		margin-top: 0;
		margin-bottom: 16px;
	}

	.start-knap:hover {
		opacity: 0.93;
	}
</style>
