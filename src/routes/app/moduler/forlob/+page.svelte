<script lang="ts">
	import { getContext, onDestroy, onMount } from 'svelte';
	import { page } from '$app/state';
	import { goto, replaceState } from '$app/navigation';
	import type { User } from 'firebase/auth';
	import type { UserDoc } from '$lib/types';
	import type { UserProduct } from '$lib/content/mikrotraening';
	import type { Forlob } from '$lib/content/forlobAdgang';
	import type { ForlobDag, LektionItem } from '$lib/content/forlob';
	import { dagStatus, getCurrentDay, tomForlobDag } from '$lib/content/forlob';
	import {
		detekterGuideType,
		erInspirationLektion,
		erLydLektion,
		erVideoLektion,
		videoEmbedUrl,
		videoThumbnail
	} from '$lib/content/bibliotek';
	import { hentForlob, hentForlobsdage } from '$lib/firestore/forlob';
	import { hentUserProduct } from '$lib/firestore/mikrotraening';
	import Icon from '$lib/components/Icon.svelte';
	import Loading from '$lib/components/Loading.svelte';
	import AudioPlayer from '$lib/components/AudioPlayer.svelte';

	const getUser = getContext<() => User | null>('user');
	const getUserDoc = getContext<() => UserDoc | null>('userDoc');
	const user = $derived(getUser());
	const userDoc = $derived(getUserDoc?.());

	let forlob = $state<Forlob | null>(null);
	let forlobsdage = $state<ForlobDag[]>([]);
	let loading = $state(true);
	let fejl = $state<string | null>(null);

	let aabenLektion = $state<LektionItem | null>(null);
	let lektionFraQueryParam = $state(false);
	// dagNummer for den åbne lektion — bruges til at gå tilbage til forsiden
	// med samme dag valgt (i stedet for at falde tilbage til i dag).
	let aabenLektionDagNummer = $state<number | null>(null);

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
		// Vis kun dage der er nået — fremtidige dage skal ikke kunne ses.
		// Clamp til [0, antalDage] så vi hverken viser fremtidige eller dage
		// udover programmets længde hvis forløbet er færdigt.
		const aktiv = aktivDagNr ?? -1;
		const sidste = Math.min(Math.max(aktiv, 0), forlob.antalDage);
		const ud: ForlobDag[] = [];
		for (let i = 1; i <= sidste; i++) {
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
		if (lektionFraQueryParam) {
			// Brugeren kom fra forsiden — gå direkte tilbage med samme dag valgt
			// (i stedet for history.back som kan lande på forkert URL).
			const dagN = aabenLektionDagNummer;
			lektionFraQueryParam = false;
			aabenLektionDagNummer = null;
			void goto(dagN !== null ? `/app?dag=${dagN}` : '/app');
			return;
		}
		const url = new URL(page.url);
		if (url.searchParams.has('lektion')) {
			url.searchParams.delete('lektion');
			replaceState(url, page.state);
		}
	}

	const aabenEmbed = $derived(
		aabenLektion?.url && detekterGuideType(aabenLektion.url) === 'video'
			? videoEmbedUrl(aabenLektion.url)
			: null
	);

	const aabenErAudio = $derived(
		!!aabenLektion?.url && detekterGuideType(aabenLektion.url) === 'audio'
	);

	const aabenErHtml = $derived(
		!!aabenLektion?.url && detekterGuideType(aabenLektion.url) === 'html'
	);

	// Skjul global Header og TabBar mens HTML-overlay er åben — så HTML-
	// indholdet får hele skærmen og knapperne ikke skjules.
	$effect(() => {
		if (typeof document === 'undefined') return;
		if (aabenErHtml) {
			document.body.classList.add('html-fullscreen-aktiv');
		} else {
			document.body.classList.remove('html-fullscreen-aktiv');
		}
	});

	onDestroy(() => {
		if (typeof document !== 'undefined') {
			document.body.classList.remove('html-fullscreen-aktiv');
		}
	});

	let htmlIframe = $state<HTMLIFrameElement | null>(null);

	function gemHtmlSomPdf() {
		// Åbn HTML-filen i ny fane så brugeren kan bruge browserens native
		// Del/Print → 'Gem som PDF'. Iframens contentWindow.print() blokeres
		// af browseren fordi Firebase Storage er cross-origin ift. appen.
		// På iOS Safari: Del → Print → pinch-zoom → Gem til Filer.
		// På Android Chrome: Tre prikker → Del → Print → Gem som PDF.
		if (aabenLektion?.url) {
			window.open(aabenLektion.url, '_blank', 'noopener,noreferrer');
		}
	}

	onMount(async () => {
		const u = user;
		if (!u) {
			fejl = 'Du skal være logget ind.';
			loading = false;
			return;
		}

		try {
			const ud = userDoc;
			if (!ud) {
				fejl = 'Du har ikke adgang til Mit forløb endnu.';
				loading = false;
				return;
			}

			// Find det aktive forløb baseret på dato (matcher forsidens logik —
			// klient kan kun være på ét forløb ad gangen). Tidligere hentede
			// siden KUN userProduct('kickstart') og fejlede for Kropsro-kunder.
			const ids = ud.forlobIds ?? [];
			if (ids.length === 0) {
				fejl = 'Du er ikke tilknyttet et forløb endnu. Kontakt Linn.';
				loading = false;
				return;
			}
			const forløbsData = await Promise.all(ids.map((id) => hentForlob(id)));
			const idagMs = Date.now();
			let aktivt: Forlob | null = null;
			for (const f of forløbsData) {
				if (!f) continue;
				const startMs = f.startDato.toMillis();
				const slutMs = startMs + f.antalDage * 24 * 60 * 60 * 1000;
				if (idagMs >= startMs && idagMs < slutMs) {
					aktivt = f;
					break;
				}
			}
			if (!aktivt) {
				fejl = 'Du har ikke et aktivt forløb lige nu.';
				loading = false;
				return;
			}
			const dage = await hentForlobsdage(aktivt.id);
			const f = aktivt;
			forlob = f;
			forlobsdage = dage;

			// Auto-åbn lektion fra query-param (fx fra forsidens dagens-lektion-card)
			const ønsketId = page.url.searchParams.get('lektion');
			if (ønsketId) {
				for (const dag of dage) {
					const fundet = dag.lektioner.find((l) => l.id === ønsketId);
					if (fundet) {
						lektionFraQueryParam = true;
						aabenLektionDagNummer = dag.dagNummer;
						aabnLektionItem(fundet);
						break;
					}
				}
			}
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
		<Loading tekst="Henter forløb..." />
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
							{@const thumbUrl = l.thumbnailUrl || videoThumbnail(l.url)}
							{@const erLyd = erLydLektion(l.url)}
							{@const erInspiration = erInspirationLektion(l.url)}
							{@const visThumb = erVideoLektion(l.url) || erLyd || erInspiration}
							{@const visFormat = erInspiration ? 'Inspiration' : l.format}
							<button
								class="lektion-card"
								class:lektion-card-medThumb={visThumb}
								type="button"
								onclick={() => aabnLektionItem(l)}
							>
								{#if visThumb}
									<div class="lektion-thumb">
										{#if thumbUrl}
											<img src={thumbUrl} alt="" loading="lazy" />
										{:else if erLyd}
											<div class="lektion-thumb-placeholder lektion-thumb-lyd">
												<Icon name="headphones" size={26} color="#fff" />
												<span>Lyd</span>
											</div>
										{:else if erInspiration}
											<div class="lektion-thumb-placeholder lektion-thumb-inspiration">
												<Icon name="lightbulb" size={32} color="#fff" />
											</div>
										{:else}
											<div class="lektion-thumb-placeholder">Zoom</div>
										{/if}
									</div>
								{/if}
								<div class="lektion-content">
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
										{#if l.varighedMin > 0 || visFormat}
											<span class="lektion-duration">
												{l.varighedMin > 0 ? l.varighedMin + ' min' : ''}{l.varighedMin > 0 && visFormat ? ' · ' : ''}{visFormat}
											</span>
										{/if}
									</div>
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
					{@const harIndhold = dag.lektioner.length > 0}
					{#if harIndhold}
						<button
							class="dag-row"
							class:aktiv={status === 'aktiv'}
							type="button"
							onclick={() => aabnLektionItem(dag.lektioner[0])}
						>
							<div class="dag-num">
								<span class="dag-num-tal">{dag.dagNummer}</span>
								<span class="dag-num-label">Dag</span>
							</div>
							<div class="dag-info">
								<div class="dag-uge">Uge {dag.uge}</div>
								<div class="dag-titel">{dag.lektioner[0].titel}</div>
								{#if dag.lektioner.length > 1}
									<div class="dag-meta">+ {dag.lektioner.length - 1} lektion mere</div>
								{/if}
							</div>
							{#if status === 'aktiv'}
								<span class="badge aktiv-badge">I dag</span>
							{:else}
								<Icon name="chevron-r" size={14} color="var(--text3)" />
							{/if}
						</button>
					{:else}
						<div class="dag-row dag-tom-row" class:aktiv={status === 'aktiv'}>
							<div class="dag-num">
								<span class="dag-num-tal">{dag.dagNummer}</span>
								<span class="dag-num-label">Dag</span>
							</div>
							<div class="dag-info">
								<div class="dag-uge">Uge {dag.uge}</div>
								<div class="dag-titel dag-tom">Intet indhold</div>
							</div>
							{#if status === 'aktiv'}
								<span class="badge aktiv-badge">I dag</span>
							{/if}
						</div>
					{/if}
				{/each}
			</div>
		</section>
	{/if}
</div>

{#if aabenLektion && aabenErHtml}
	<div class="html-overlay" role="dialog" aria-modal="true">
		<header class="html-overlay-head">
			<button class="html-overlay-luk" type="button" onclick={lukLektion}>
				<Icon name="arrow-l" size={14} color="var(--text)" />
				<span>Luk</span>
			</button>
			<div class="html-overlay-titel">{aabenLektion.titel}</div>
		</header>
		<iframe
			bind:this={htmlIframe}
			src={aabenLektion.url}
			title={aabenLektion.titel}
			sandbox="allow-same-origin allow-scripts allow-popups allow-modals"
		></iframe>
		<div class="html-overlay-foot">
			<button class="html-overlay-pdf" type="button" onclick={gemHtmlSomPdf}>
				📄 Gem som PDF
			</button>
		</div>
	</div>
{:else if aabenLektion && aabenErAudio}
	<AudioPlayer
		url={aabenLektion.url}
		titel={aabenLektion.titel}
		sub={aabenLektion.beskrivelse}
		kategori="Lektion"
		onClose={lukLektion}
	/>
{:else if aabenLektion}
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

	.eyebrow-terra {
		color: var(--terra);
	}

	.eyebrow-muted {
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
		overflow: hidden;
	}

	.lektion-card:hover {
		border-color: var(--terra);
	}

	.lektion-card-medThumb {
		padding: 0;
		gap: 0;
	}

	.lektion-thumb {
		width: 100%;
		background: var(--cream);
		overflow: hidden;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.lektion-thumb img {
		width: 100%;
		height: auto;
		display: block;
	}

	.lektion-thumb-placeholder {
		width: 100%;
		aspect-ratio: 16 / 9;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 6px;
		color: #fff;
		font-size: calc(13px * var(--fs-scale, 1));
		font-weight: 600;
		background: linear-gradient(135deg, var(--terra), #8a4f3a);
	}

	.lektion-thumb-lyd {
		background: linear-gradient(135deg, #6b8e7f, #4a6b5e);
	}

	.lektion-thumb-inspiration {
		background: linear-gradient(135deg, #c9a06b, #a07d4d);
	}

	.lektion-card-medThumb .lektion-content {
		display: flex;
		flex-direction: column;
		gap: 6px;
		padding: 14px 16px 16px;
	}

	.lektion-meta {
		font-size: calc(11px * var(--fs-scale, 1));
		color: var(--text3);
		letter-spacing: 0.05em;
	}

	.lektion-titel {
		font-family: var(--ff-d);
		font-size: calc(17px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--text);
		line-height: 1.3;
	}

	.lektion-beskrivelse {
		font-size: calc(13px * var(--fs-scale, 1));
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
		font-size: calc(12px * var(--fs-scale, 1));
		font-weight: 600;
	}

	.lektion-duration {
		font-size: calc(14px * var(--fs-scale, 1));
		font-weight: 500;
		color: var(--text2);
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
		font-size: calc(13px * var(--fs-scale, 1));
		flex-shrink: 0;
	}

	.note-eyebrow {
		font-size: calc(10px * var(--fs-scale, 1));
		font-weight: 600;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--terra);
		margin-bottom: 3px;
	}

	.note-tekst {
		font-size: calc(13px * var(--fs-scale, 1));
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
		font-size: calc(14px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--text);
	}

	.baseline-sub {
		font-size: calc(11.5px * var(--fs-scale, 1));
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
		width: 100%;
		text-align: left;
		background: transparent;
		font-family: inherit;
		color: inherit;
	}

	button.dag-row {
		border: none;
		border-top: 1px solid var(--border);
		cursor: pointer;
	}

	button.dag-row:hover {
		background: var(--bg2);
	}

	.dag-row:first-child {
		border-top: none;
	}

	.dag-row.aktiv {
		background: var(--tdim);
	}

	button.dag-row.aktiv:hover {
		background: var(--tdim);
	}

	.dag-tom-row {
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
		font-size: calc(14px * var(--fs-scale, 1));
		line-height: 1;
		color: var(--text);
	}

	.dag-row.aktiv .dag-num-tal {
		color: #fff;
	}

	.dag-num-label {
		font-size: calc(8px * var(--fs-scale, 1));
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
		font-size: calc(10px * var(--fs-scale, 1));
		color: var(--text3);
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}

	.dag-titel {
		font-size: calc(13px * var(--fs-scale, 1));
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
		font-size: calc(11px * var(--fs-scale, 1));
		color: var(--text3);
		margin-top: 2px;
	}

	.badge {
		font-size: calc(9.5px * var(--fs-scale, 1));
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
		font-size: calc(18px * var(--fs-scale, 1));
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
		font-size: calc(18px * var(--fs-scale, 1));
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

	.html-overlay {
		position: fixed;
		inset: 0;
		z-index: 100;
		background: var(--white);
		display: flex;
		flex-direction: column;
		padding-top: env(safe-area-inset-top);
		padding-bottom: env(safe-area-inset-bottom);
	}

	.html-overlay-head {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 10px 14px;
		border-bottom: 1px solid var(--border);
		flex-shrink: 0;
		background: var(--white);
	}

	.html-overlay-luk {
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

	.html-overlay-titel {
		flex: 1;
		font-family: var(--ff-d);
		font-size: calc(14px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--text);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.html-overlay iframe {
		flex: 1;
		width: 100%;
		border: none;
		background: var(--white);
	}

	.html-overlay-foot {
		flex-shrink: 0;
		padding: 12px 14px;
		border-top: 1px solid var(--border);
		background: var(--white);
	}

	.html-overlay-pdf {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		width: 100%;
		padding: 14px;
		border-radius: 12px;
		border: none;
		background: var(--terra);
		color: #fff;
		font-size: calc(15px * var(--fs-scale, 1));
		font-weight: 600;
		cursor: pointer;
		font-family: var(--ff-b);
	}

	.html-overlay-pdf:active {
		opacity: 0.85;
	}

	.overlay-beskrivelse {
		font-size: calc(13px * var(--fs-scale, 1));
		line-height: 1.6;
		color: var(--text2);
		margin: 0;
		white-space: pre-wrap;
	}

	.overlay-meta {
		font-size: calc(11px * var(--fs-scale, 1));
		color: var(--text3);
		letter-spacing: 0.04em;
	}
</style>
