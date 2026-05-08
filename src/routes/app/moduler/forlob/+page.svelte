<script lang="ts">
	import { getContext, onMount } from 'svelte';
	import type { User } from 'firebase/auth';
	import type { UserProduct } from '$lib/content/mikrotraening';
	import type { Forlob } from '$lib/content/forlobAdgang';
	import type { ForlobDag, LektionItem } from '$lib/content/forlob';
	import { dagStatus, getCurrentDay, tomForlobDag } from '$lib/content/forlob';
	import { detekterGuideType, videoEmbedUrl } from '$lib/content/bibliotek';
	import { hentForlob, hentForlobsdage } from '$lib/firestore/forlob';
	import { hentUserProduct } from '$lib/firestore/mikrotraening';
	import Icon from '$lib/components/Icon.svelte';

	const getUser = getContext<() => User | null>('user');
	const user = $derived(getUser());

	let forlob = $state<Forlob | null>(null);
	let forlobsdage = $state<ForlobDag[]>([]);
	let loading = $state(true);
	let fejl = $state<string | null>(null);

	let aabenLektion = $state<LektionItem | null>(null);

	const aktivDagNr = $derived.by<number | null>(() => {
		if (!forlob) return null;
		const startDato = forlob.startDato.toDate().toISOString().slice(0, 10);
		return getCurrentDay({ startDato, antalDage: forlob.antalDage });
	});

	const dagsmap = $derived.by<Map<number, ForlobDag>>(() => {
		const m = new Map<number, ForlobDag>();
		for (const d of forlobsdage) m.set(d.dagNummer, d);
		return m;
	});

	const programDage = $derived.by<ForlobDag[]>(() => {
		if (!forlob) return [];
		const ud: ForlobDag[] = [];
		for (let i = 1; i <= forlob.antalDage; i++) {
			ud.push(dagsmap.get(i) ?? tomForlobDag(i));
		}
		return ud;
	});

	const aktivDag = $derived.by<ForlobDag | null>(() => {
		if (aktivDagNr === null) return null;
		return dagsmap.get(aktivDagNr) ?? tomForlobDag(aktivDagNr);
	});

	function aabnLektionItem(it: LektionItem) {
		if (!it.url) {
			aabenLektion = it;
			return;
		}
		const t = detekterGuideType(it.url);
		if (t === 'pdf' || t === 'link') {
			window.open(it.url, '_blank', 'noopener,noreferrer');
			return;
		}
		aabenLektion = it;
	}

	function lukLektion() {
		aabenLektion = null;
	}

	const aabenEmbed = $derived(
		aabenLektion?.url && detekterGuideType(aabenLektion.url) === 'video'
			? videoEmbedUrl(aabenLektion.url)
			: null
	);

	const aabenErAudio = $derived(
		!!aabenLektion?.url && detekterGuideType(aabenLektion.url) === 'audio'
	);

	onMount(async () => {
		const u = user;
		if (!u) {
			fejl = 'Du skal være logget ind.';
			loading = false;
			return;
		}

		try {
			const up = await hentUserProduct(u.uid, 'kickstart');
			if (!up) {
				fejl = 'Du har ikke adgang til Mit forløb endnu.';
				loading = false;
				return;
			}

			const forlobId = (up as UserProduct & { forlobId?: string }).forlobId;
			if (!forlobId) {
				fejl = 'Du er ikke tilknyttet et forløb endnu. Kontakt Linn.';
				loading = false;
				return;
			}

			const [f, dage] = await Promise.all([
				hentForlob(forlobId),
				hentForlobsdage(forlobId)
			]);
			if (!f) {
				fejl = 'Forløbet kunne ikke findes.';
				loading = false;
				return;
			}
			forlob = f;
			forlobsdage = dage;
		} catch (e) {
			console.error(e);
			fejl = 'Kunne ikke hente forløb. Prøv igen.';
		} finally {
			loading = false;
		}
	});
</script>

<div class="page">
	<header class="page-header">
		<a class="back" href="/app/moduler">
			<Icon name="arrow-l" size={14} color="var(--text2)" />
			<span>Moduler</span>
		</a>
		<div class="eyebrow">Mit forløb</div>
		<h1>{forlob?.navn ?? 'Mit forløb'}</h1>
		{#if forlob && aktivDagNr !== null}
			<p class="page-sub">Dag {aktivDagNr} af {forlob.antalDage}</p>
		{:else if forlob}
			<p class="page-sub">Forløbet starter snart</p>
		{/if}
	</header>

	{#if loading}
		<div class="status-besked">Henter forløb...</div>
	{:else if fejl}
		<div class="status-besked fejl">{fejl}</div>
	{:else if forlob}
		{#if aktivDag}
			<section class="aktiv-section">
				<div class="eyebrow eyebrow-terra">Dagens lektion</div>
				{#if aktivDag.lektioner.length === 0}
					<div class="status-besked">Der er ingen lektion lagt op til i dag.</div>
				{:else}
					<div class="lektion-liste">
						{#each aktivDag.lektioner as l (l.id)}
							<button class="lektion-card" type="button" onclick={() => aabnLektionItem(l)}>
								<div class="lektion-meta">
									Dag {aktivDag.dagNummer} · uge {aktivDag.uge}
								</div>
								<div class="lektion-titel">{l.titel}</div>
								{#if l.beskrivelse}
									<div class="lektion-beskrivelse">{l.beskrivelse}</div>
								{/if}
								<div class="lektion-footer">
									<span class="lektion-pille">
										<Icon name="play" size={11} color="var(--terra)" filled />
										Begynd
									</span>
									{#if l.varighedMin > 0 || l.format}
										<span class="lektion-duration">
											{l.varighedMin > 0 ? l.varighedMin + ' min' : ''}{l.varighedMin > 0 && l.format ? ' · ' : ''}{l.format}
										</span>
									{/if}
								</div>
							</button>
						{/each}
					</div>
				{/if}

				{#if aktivDag.noteFraLinn}
					<div class="note-card">
						<div class="note-badge">L</div>
						<div class="note-content">
							<div class="note-eyebrow">Note fra Linn</div>
							<div class="note-tekst">{aktivDag.noteFraLinn}</div>
						</div>
					</div>
				{/if}
			</section>
		{:else}
			<div class="status-besked">
				Forløbet er endnu ikke startet. Tjek tilbage på {forlob.startDato.toDate().toLocaleDateString('da-DK')}.
			</div>
		{/if}

		<section class="baseline-section">
			<a class="baseline-card" href="/app/moduler/vaner/0">
				<div class="baseline-icon">
					<Icon name="sparkle" size={16} color="#fff" />
				</div>
				<div class="baseline-tekst">
					<div class="baseline-titel">Baseline check-in</div>
					<div class="baseline-sub">Mærk dit udgangspunkt før forløbet starter</div>
				</div>
				<Icon name="chevron-r" size={14} color="var(--text3)" />
			</a>
		</section>

		<section class="tidslinje-section">
			<div class="eyebrow eyebrow-muted">Hele forløbet</div>
			<div class="tidslinje">
				{#each programDage as dag (dag.dagNummer)}
					{@const status = dagStatus(dag.dagNummer, aktivDagNr)}
					{@const harIndhold = dag.lektioner.length > 0 || !!dag.noteFraLinn}
					<div class="dag-row" class:aktiv={status === 'aktiv'} class:laast={status === 'fremtid'}>
						<div class="dag-num">
							<span class="dag-num-tal">{dag.dagNummer}</span>
							<span class="dag-num-label">Dag</span>
						</div>
						<div class="dag-info">
							<div class="dag-uge">Uge {dag.uge}</div>
							{#if dag.lektioner.length > 0}
								<div class="dag-titel">{dag.lektioner[0].titel}</div>
								{#if dag.lektioner.length > 1}
									<div class="dag-meta">+ {dag.lektioner.length - 1} lektion mere</div>
								{/if}
							{:else}
								<div class="dag-titel dag-tom">Intet indhold</div>
							{/if}
						</div>
						{#if status === 'fremtid'}
							<Icon name="lock" size={14} color="var(--text3)" />
						{:else if status === 'aktiv'}
							<span class="badge aktiv-badge">I dag</span>
						{:else if harIndhold}
							<Icon name="chevron-r" size={14} color="var(--text3)" />
						{/if}
					</div>
				{/each}
			</div>
		</section>
	{/if}
</div>

{#if aabenLektion}
	<div
		class="overlay-bg"
		role="button"
		tabindex="0"
		onclick={lukLektion}
		onkeydown={(e) => e.key === 'Escape' && lukLektion()}
	></div>
	<div class="overlay" role="dialog" aria-modal="true">
		<header class="overlay-head">
			<div class="overlay-titel">{aabenLektion.titel}</div>
			<button class="overlay-luk" type="button" onclick={lukLektion} aria-label="Luk">×</button>
		</header>

		{#if aabenEmbed}
			<div class="overlay-video">
				<iframe
					src={aabenEmbed}
					title={aabenLektion.titel}
					allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
					allowfullscreen
				></iframe>
			</div>
		{:else if aabenErAudio}
			<audio controls src={aabenLektion.url}>Din browser kan ikke afspille lyd.</audio>
		{/if}

		{#if aabenLektion.beskrivelse}
			<p class="overlay-beskrivelse">{aabenLektion.beskrivelse}</p>
		{/if}

		{#if aabenLektion.varighedMin > 0 || aabenLektion.format}
			<div class="overlay-meta">
				{aabenLektion.varighedMin > 0 ? aabenLektion.varighedMin + ' min' : ''}{aabenLektion.varighedMin > 0 && aabenLektion.format ? ' · ' : ''}{aabenLektion.format}
			</div>
		{/if}
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
		font-size: 12px;
		color: var(--text2);
		text-decoration: none;
		margin-bottom: 12px;
	}

	.eyebrow {
		font-size: 10px;
		font-weight: 600;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--text3);
	}

	.eyebrow-terra {
		color: var(--terra);
	}

	.eyebrow-muted {
		color: var(--text3);
	}

	h1 {
		font-family: var(--ff-d);
		font-size: 28px;
		font-weight: 600;
		letter-spacing: -0.02em;
		margin: 4px 0 0;
		line-height: 1.05;
		color: var(--text);
	}

	.page-sub {
		font-size: 13px;
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
		font-size: 13px;
		text-align: center;
		margin-bottom: 14px;
	}

	.status-besked.fejl {
		color: #8a4a3e;
		background: #fbeeea;
		border-color: #f0d6cf;
	}

	.aktiv-section {
		display: flex;
		flex-direction: column;
		gap: 10px;
		margin-bottom: 22px;
	}

	.lektion-liste {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.lektion-card {
		display: flex;
		flex-direction: column;
		gap: 6px;
		padding: 16px;
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 14px;
		text-align: left;
		font-family: inherit;
		cursor: pointer;
	}

	.lektion-card:hover {
		border-color: var(--terra);
	}

	.lektion-meta {
		font-size: 11px;
		color: var(--text3);
		letter-spacing: 0.05em;
	}

	.lektion-titel {
		font-family: var(--ff-d);
		font-size: 17px;
		font-weight: 600;
		color: var(--text);
		line-height: 1.3;
	}

	.lektion-beskrivelse {
		font-size: 13px;
		color: var(--text2);
		line-height: 1.5;
	}

	.lektion-footer {
		display: flex;
		align-items: center;
		gap: 12px;
		margin-top: 4px;
	}

	.lektion-pille {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 6px 12px;
		border-radius: 999px;
		background: var(--tdim);
		color: var(--terra);
		font-size: 12px;
		font-weight: 600;
	}

	.lektion-duration {
		font-size: 11px;
		color: var(--text3);
	}

	.note-card {
		display: flex;
		gap: 12px;
		padding: 14px;
		background: var(--bg2);
		border: 1px solid var(--border);
		border-radius: 12px;
	}

	.note-badge {
		width: 28px;
		height: 28px;
		border-radius: 999px;
		background: var(--terra);
		color: #fff;
		display: flex;
		align-items: center;
		justify-content: center;
		font-family: var(--ff-d);
		font-weight: 600;
		font-size: 13px;
		flex-shrink: 0;
	}

	.note-eyebrow {
		font-size: 10px;
		font-weight: 600;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--terra);
		margin-bottom: 3px;
	}

	.note-tekst {
		font-size: 13px;
		line-height: 1.55;
		color: var(--text);
		white-space: pre-wrap;
	}

	.baseline-section {
		margin-bottom: 22px;
	}

	.baseline-card {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 14px 16px;
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 14px;
		text-decoration: none;
		color: inherit;
	}

	.baseline-card:hover {
		background: var(--bg2);
	}

	.baseline-icon {
		width: 36px;
		height: 36px;
		border-radius: 10px;
		background: var(--sage);
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.baseline-tekst {
		flex: 1;
		min-width: 0;
	}

	.baseline-titel {
		font-size: 14px;
		font-weight: 600;
		color: var(--text);
	}

	.baseline-sub {
		font-size: 11.5px;
		color: var(--text3);
		margin-top: 2px;
	}

	.tidslinje-section {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.tidslinje {
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 14px;
		overflow: hidden;
	}

	.dag-row {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 12px 14px;
		border-top: 1px solid var(--border);
	}

	.dag-row:first-child {
		border-top: none;
	}

	.dag-row.aktiv {
		background: var(--tdim);
	}

	.dag-row.laast {
		opacity: 0.55;
	}

	.dag-num {
		width: 36px;
		height: 36px;
		border-radius: 10px;
		background: var(--bg2);
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.dag-row.aktiv .dag-num {
		background: var(--terra);
		color: #fff;
	}

	.dag-num-tal {
		font-family: var(--ff-d);
		font-weight: 700;
		font-size: 14px;
		line-height: 1;
		color: var(--text);
	}

	.dag-row.aktiv .dag-num-tal {
		color: #fff;
	}

	.dag-num-label {
		font-size: 8px;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--text3);
		margin-top: 1px;
	}

	.dag-row.aktiv .dag-num-label {
		color: rgba(255, 255, 255, 0.85);
	}

	.dag-info {
		flex: 1;
		min-width: 0;
	}

	.dag-uge {
		font-size: 10px;
		color: var(--text3);
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}

	.dag-titel {
		font-size: 13px;
		font-weight: 500;
		color: var(--text);
		line-height: 1.3;
		margin-top: 2px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.dag-titel.dag-tom {
		color: var(--text3);
		font-weight: 400;
		font-style: italic;
	}

	.dag-meta {
		font-size: 11px;
		color: var(--text3);
		margin-top: 2px;
	}

	.badge {
		font-size: 9.5px;
		font-weight: 600;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		padding: 4px 9px;
		border-radius: 999px;
	}

	.aktiv-badge {
		background: var(--terra);
		color: #fff;
	}

	.overlay-bg {
		position: fixed;
		inset: 0;
		background: rgba(20, 14, 18, 0.7);
		z-index: 60;
		border: none;
	}

	.overlay {
		position: fixed;
		left: 50%;
		top: 50%;
		transform: translate(-50%, -50%);
		background: var(--white);
		border-radius: 16px;
		width: calc(100% - 24px);
		max-width: 720px;
		max-height: 92vh;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: 12px;
		padding: 16px;
		z-index: 61;
		box-shadow: 0 20px 50px rgba(0, 0, 0, 0.3);
	}

	.overlay-head {
		display: flex;
		align-items: center;
		gap: 10px;
	}

	.overlay-titel {
		flex: 1;
		font-family: var(--ff-d);
		font-size: 18px;
		font-weight: 600;
		color: var(--text);
		line-height: 1.3;
	}

	.overlay-luk {
		width: 32px;
		height: 32px;
		border-radius: 999px;
		border: 1px solid var(--border);
		background: var(--white);
		color: var(--text2);
		font-size: 18px;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.overlay-video {
		position: relative;
		width: 100%;
		aspect-ratio: 16 / 9;
		background: #000;
		border-radius: 10px;
		overflow: hidden;
	}

	.overlay-video iframe {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		border: none;
	}

	.overlay audio {
		width: 100%;
	}

	.overlay-beskrivelse {
		font-size: 13px;
		line-height: 1.6;
		color: var(--text2);
		margin: 0;
		white-space: pre-wrap;
	}

	.overlay-meta {
		font-size: 11px;
		color: var(--text3);
		letter-spacing: 0.04em;
	}
</style>
