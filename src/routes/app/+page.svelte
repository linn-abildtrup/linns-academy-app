<script lang="ts">
	import { getContext } from 'svelte';
	import type { UserDoc } from '$lib/types';
	import Icon from '$lib/components/Icon.svelte';
	import { getGreetingWithName } from '$lib/utils/greeting';
	import {
		aktivtForlob,
		dagensIndhold,
		formatDato,
		getCurrentDay
	} from '$lib/content/forlob';

	const getUserDoc = getContext<() => UserDoc | null>('userDoc');

	const userDoc = $derived(getUserDoc());

	const greeting = $derived(getGreetingWithName(userDoc?.firstName ?? ''));
	const today = $derived(formatDato(new Date()));
	const dayNumber = $derived(getCurrentDay(aktivtForlob) ?? dagensIndhold.dag);
	const completedActions = $derived(
		dagensIndhold.actions.filter((a) => a.done).length
	);
	const totalActions = $derived(dagensIndhold.actions.length);

	type ModulGenvej = {
		navn: string;
		meta: string;
		ikon: 'check' | 'flame' | 'leaf' | 'book';
		accent: string;
		dim: string;
	};

	const moduler: ModulGenvej[] = [
		{
			navn: 'Vaner',
			meta: '14 dages flow',
			ikon: 'check',
			accent: '#6F9E7E',
			dim: 'rgba(111,158,126,.10)'
		},
		{
			navn: 'Træning',
			meta: '3 nye øvelser',
			ikon: 'flame',
			accent: 'var(--terra)',
			dim: 'var(--tdim)'
		},
		{
			navn: 'Kost',
			meta: '30-30-3 i dag',
			ikon: 'leaf',
			accent: 'var(--sage)',
			dim: 'var(--sdim)'
		},
		{
			navn: 'Bibliotek',
			meta: '3 nye podcasts',
			ikon: 'book',
			accent: '#5C7A8C',
			dim: 'rgba(92,122,140,.10)'
		}
	];

	type TidligereKob = {
		navn: string;
		meta: string;
		expires: string;
		ikon: 'path' | 'check';
		accent: string;
		dim: string;
	};

	const tidligereKob: TidligereKob[] = [
		{
			navn: 'Kickstart en sund overgangsalder',
			meta: 'Forløb · købt okt. 2025',
			expires: 'Adgang til 15. nov. 2026',
			ikon: 'path',
			accent: '#9D6358',
			dim: 'rgba(157,99,88,.10)'
		},
		{
			navn: 'Vanetracker',
			meta: 'Modul · købt jan. 2026',
			expires: 'Læseadgang · ingen tracking',
			ikon: 'check',
			accent: '#6F9E7E',
			dim: 'rgba(111,158,126,.10)'
		}
	];

	function getActionAccent(modul: 'kost' | 'traening' | 'vaner'): string {
		if (modul === 'kost') return 'var(--sage)';
		if (modul === 'traening') return 'var(--terra)';
		return '#6F9E7E';
	}

	function getActionAccentDim(modul: 'kost' | 'traening' | 'vaner'): string {
		if (modul === 'kost') return 'var(--sdim)';
		if (modul === 'traening') return 'var(--tdim)';
		return 'rgba(111,158,126,.10)';
	}

	function getActionIcon(modul: 'kost' | 'traening' | 'vaner') {
		if (modul === 'kost') return 'leaf';
		if (modul === 'traening') return 'flame';
		return 'check';
	}
</script>

{#if userDoc?.state === 'forlobskunde'}
	<div class="forside-a1">
		<header class="forside-header">
			<div class="header-content">
				<div class="header-text">
					<div class="date-label">{today}</div>
					<h1 class="greeting">{greeting}</h1>
					<div class="forlob-badge">
						<span class="badge-dot"></span>
						{aktivtForlob.kortNavn} · dag {dayNumber} af {aktivtForlob.antalDage}
					</div>
				</div>
				<button class="bell-button" aria-label="Notifikationer">
					<Icon name="bell" size={15} color="var(--text2)" />
					<span class="bell-dot"></span>
				</button>
			</div>
		</header>

		<div class="forside-body">
			{#each dagensIndhold.lektioner as lektion (lektion.id)}
				<section class="lektion-section">
					<div class="eyebrow eyebrow-terra">Dagens lektion</div>
					<div class="lektion-card">
						<div class="lektion-decoration lektion-decoration-1"></div>
						<div class="lektion-decoration lektion-decoration-2"></div>
						<div class="lektion-content">
							<div class="lektion-meta">Dag {lektion.dag} · uge {lektion.uge}</div>
							<div class="lektion-title">{lektion.titel}</div>
							<div class="lektion-description">{lektion.beskrivelse}</div>
							<div class="lektion-actions">
								<button class="lektion-button">
									<Icon name="play" size={12} color="var(--terra)" filled />
									Begynd
								</button>
								<span class="lektion-duration">
									{lektion.varighedMin} min · {lektion.format}
								</span>
							</div>
						</div>
					</div>
				</section>
			{/each}

			<section class="actions-section">
				<div class="actions-header">
					<div class="eyebrow eyebrow-muted">Dagens action</div>
					<div class="actions-counter">{completedActions} af {totalActions} i dag</div>
				</div>
				<div class="actions-list">
					{#each dagensIndhold.actions as action (action.id)}
						<button class="action-card" class:action-done={action.done}>
							<div
								class="action-icon"
								style="background: {getActionAccentDim(action.modul)}"
							>
								<Icon
									name={getActionIcon(action.modul)}
									size={15}
									color={getActionAccent(action.modul)}
								/>
								{#if action.done}
									<span class="action-check">
										<Icon name="check" size={8} color="#fff" />
									</span>
								{/if}
							</div>
							<div class="action-text">
								<div
									class="action-eyebrow"
									style="color: {getActionAccent(action.modul)}"
								>
									{action.eyebrow}
								</div>
								<div class="action-title">{action.titel}</div>
								<div class="action-meta">{action.meta}</div>
							</div>
							<Icon name="chevron-r" size={14} color="var(--text3)" />
						</button>
					{/each}
				</div>
			</section>

			{#if dagensIndhold.noteFraLinn}
				<section class="note-section">
					<div class="note-badge">L</div>
					<div class="note-content">
						<div class="note-eyebrow">Note fra Linn</div>
						<div class="note-text">{dagensIndhold.noteFraLinn}</div>
					</div>
				</section>
			{/if}
		</div>
	</div>
{:else if userDoc?.state === 'modulbruger'}
	<div class="forside-b1">
		<header class="b1-header">
			<div class="b1-brand">Linn's Academy</div>
			<button class="bell-button" aria-label="Notifikationer">
				<Icon name="bell" size={13} color="var(--text2)" />
			</button>
		</header>

		<div class="forside-body">
			<section class="b1-greeting">
				<div class="date-label">{today}</div>
				<h1 class="greeting">{greeting}</h1>
			</section>

			<section class="actions-section">
				<div class="eyebrow eyebrow-terra">Dagens action</div>
				<div class="actions-list">
					{#each dagensIndhold.actions as action (action.id)}
						<button class="action-card" class:action-done={action.done}>
							<div
								class="action-icon"
								style="background: {getActionAccentDim(action.modul)}"
							>
								<Icon
									name={getActionIcon(action.modul)}
									size={15}
									color={getActionAccent(action.modul)}
								/>
								{#if action.done}
									<span class="action-check">
										<Icon name="check" size={8} color="#fff" />
									</span>
								{/if}
							</div>
							<div class="action-text">
								<div
									class="action-eyebrow"
									style="color: {getActionAccent(action.modul)}"
								>
									{action.eyebrow}
								</div>
								<div class="action-title">{action.titel}</div>
								<div class="action-meta">{action.meta}</div>
							</div>
							<Icon name="chevron-r" size={14} color="var(--text3)" />
						</button>
					{/each}
				</div>
			</section>

			<section class="moduler-section">
				<div class="moduler-header">
					<div class="eyebrow eyebrow-muted">Mine moduler</div>
					<div class="moduler-title">Hurtig adgang</div>
				</div>
				<div class="moduler-grid">
					{#each moduler as modul (modul.navn)}
						<button class="modul-card">
							<div class="modul-icon" style="background: {modul.dim}">
								<Icon name={modul.ikon} size={15} color={modul.accent} />
							</div>
							<div class="modul-name">{modul.navn}</div>
							<div class="modul-meta">{modul.meta}</div>
						</button>
					{/each}
				</div>
			</section>

			<section class="featured-card">
				<div class="featured-icon" style="background: rgba(92,122,140,.15)">
					<Icon name="mic" size={17} color="#5C7A8C" />
				</div>
				<div class="featured-text">
					<div class="featured-eyebrow">Ny podcast</div>
					<div class="featured-title">Når kroppen siger fra</div>
					<div class="featured-meta">32 min · samtale med Linn</div>
				</div>
				<button class="featured-play" aria-label="Afspil">
					<Icon name="play" size={11} color="#fff" filled />
				</button>
			</section>
		</div>
	</div>
{:else if userDoc?.state === 'udlobet'}
	<div class="forside-c1">
		<header class="b1-header">
			<div class="b1-brand">Linn's Academy</div>
			<button class="bell-button" aria-label="Notifikationer">
				<Icon name="bell" size={13} color="var(--text2)" />
			</button>
		</header>

		<div class="forside-body">
			<section class="c1-greeting">
				<div class="date-label">Velkommen tilbage</div>
				<h1 class="greeting greeting-large">{greeting}</h1>
				<p class="c1-tagline">Det er længe siden — godt at se dig igen.</p>
			</section>

			<section class="tilbud-card">
				<div class="tilbud-decoration"></div>
				<div class="tilbud-content">
					<div class="tilbud-eyebrow">
						<Icon name="sparkle" size={10} color="#fff" />
						KUN FOR DIG
					</div>
					<div class="tilbud-title">−30% den første måned</div>
					<div class="tilbud-description">
						Fortsæt hvor du slap — alle moduler, fri adgang.
					</div>
					<button class="tilbud-button">Se mit tilbud</button>
				</div>
			</section>

			<section class="kob-section">
				<div class="kob-header">
					<div class="eyebrow eyebrow-muted">Mine køb</div>
					<div class="kob-title">Stadig dine — i 2 måneder til</div>
				</div>
				<div class="kob-list">
					{#each tidligereKob as kob (kob.navn)}
						<button class="kob-card">
							<div class="kob-icon" style="background: {kob.dim}">
								<Icon name={kob.ikon} size={16} color={kob.accent} />
							</div>
							<div class="kob-text">
								<div class="kob-name">{kob.navn}</div>
								<div class="kob-meta">{kob.meta}</div>
								<div class="kob-expires">{kob.expires}</div>
							</div>
							<Icon name="chevron-r" size={14} color="var(--text3)" />
						</button>
					{/each}
				</div>
			</section>

			<div class="c1-disclaimer">Ingen forpligtelse — du bestemmer selv tempoet.</div>
		</div>
	</div>
{:else}
	<div class="placeholder-page">
		<p class="placeholder-text">Et øjeblik...</p>
	</div>
{/if}

<style>
	/* ── Fælles forside-body ───────────────────────────────────── */

	.forside-a1,
	.forside-b1,
	.forside-c1 {
		min-height: 100%;
		display: flex;
		flex-direction: column;
	}

	.forside-body {
		flex: 1;
		padding: 14px 20px 18px;
		display: flex;
		flex-direction: column;
		gap: 14px;
	}

	/* ── A1 header ─────────────────────────────────────────────── */

	.forside-header {
		padding: 8px 20px 14px;
		background: var(--header);
		border-bottom: 1px solid var(--border);
	}

	.header-content {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 12px;
	}

	.header-text {
		min-width: 0;
		flex: 1;
	}

	.date-label {
		font-size: 9.5px;
		font-weight: 600;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: var(--text3);
	}

	.greeting {
		font-family: var(--ff-d);
		font-size: 22px;
		font-weight: 700;
		color: var(--text);
		letter-spacing: -0.02em;
		margin: 3px 0 0;
		line-height: 1.05;
	}

	.greeting-large {
		font-size: 26px;
		margin: 4px 0 6px;
	}

	.forlob-badge {
		margin-top: 6px;
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 3px 10px;
		border-radius: 99px;
		background: var(--tdim);
		color: var(--terra);
		font-size: 10px;
		font-weight: 600;
		letter-spacing: 0.04em;
	}

	.badge-dot {
		width: 5px;
		height: 5px;
		border-radius: 50%;
		background: var(--terra);
	}

	.bell-button {
		width: 34px;
		height: 34px;
		border-radius: 50%;
		background: var(--white);
		border: 1px solid var(--border);
		display: flex;
		align-items: center;
		justify-content: center;
		position: relative;
		flex-shrink: 0;
		cursor: pointer;
	}

	.bell-dot {
		position: absolute;
		top: 7px;
		right: 8px;
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--terra);
	}

	/* ── B1 og C1 header ───────────────────────────────────────── */

	.b1-header {
		padding: 10px 20px 0;
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.b1-brand {
		font-family: var(--ff-d);
		font-style: italic;
		font-size: 12px;
		color: var(--text2);
	}

	.b1-header .bell-button {
		width: 32px;
		height: 32px;
	}

	.b1-greeting {
		margin-bottom: 2px;
	}

	.b1-greeting .greeting {
		font-size: 26px;
	}

	/* ── C1 hilsen ─────────────────────────────────────────────── */

	.c1-greeting {
		max-width: 320px;
	}

	.c1-tagline {
		font-family: var(--ff-d);
		font-style: italic;
		font-size: 13px;
		color: var(--text2);
		margin: 0;
		line-height: 1.45;
	}

	/* ── Eyebrow-labels ────────────────────────────────────────── */

	.eyebrow {
		font-size: 9px;
		font-weight: 700;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		margin-bottom: 8px;
	}

	.eyebrow-terra {
		color: var(--terra);
	}

	.eyebrow-muted {
		color: var(--text3);
	}

	/* ── Lektion-card ──────────────────────────────────────────── */

	.lektion-card {
		border-radius: 16px;
		overflow: hidden;
		background: linear-gradient(160deg, #c99587 0%, #b87b6e 60%, #9d6358 100%);
		color: #fff;
		padding: 18px;
		position: relative;
		min-height: 170px;
	}

	.lektion-decoration {
		position: absolute;
		border-radius: 50%;
	}

	.lektion-decoration-1 {
		right: -30px;
		top: -30px;
		width: 140px;
		height: 140px;
		background: rgba(255, 255, 255, 0.08);
	}

	.lektion-decoration-2 {
		right: 30px;
		bottom: -50px;
		width: 110px;
		height: 110px;
		background: rgba(255, 255, 255, 0.05);
	}

	.lektion-content {
		position: relative;
	}

	.lektion-meta {
		font-size: 9px;
		font-weight: 600;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		opacity: 0.85;
	}

	.lektion-title {
		font-family: var(--ff-d);
		font-size: 22px;
		font-weight: 700;
		margin-top: 6px;
		line-height: 1.1;
	}

	.lektion-description {
		font-size: 11.5px;
		opacity: 0.85;
		margin-top: 4px;
		line-height: 1.45;
	}

	.lektion-actions {
		display: flex;
		gap: 8px;
		margin-top: 14px;
		align-items: center;
	}

	.lektion-button {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 9px 16px;
		border-radius: 99px;
		background: #fff;
		color: var(--terra);
		border: none;
		font-size: 12px;
		font-weight: 600;
		font-family: var(--ff-b);
		cursor: pointer;
	}

	.lektion-duration {
		font-size: 10.5px;
		opacity: 0.85;
	}

	/* ── Actions ───────────────────────────────────────────────── */

	.actions-header {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		margin-bottom: 8px;
	}

	.actions-counter {
		font-size: 10px;
		color: var(--text3);
		font-family: var(--ff-d);
		font-style: italic;
	}

	.actions-list {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.action-card {
		padding: 12px;
		border-radius: 12px;
		background: var(--white);
		border: 1px solid var(--border);
		display: flex;
		align-items: center;
		gap: 11px;
		width: 100%;
		text-align: left;
		font-family: var(--ff-b);
		cursor: pointer;
	}

	.action-icon {
		width: 34px;
		height: 34px;
		border-radius: 10px;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		position: relative;
	}

	.action-check {
		position: absolute;
		bottom: -2px;
		right: -2px;
		width: 14px;
		height: 14px;
		border-radius: 50%;
		background: var(--sage);
		border: 2px solid var(--white);
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.action-text {
		flex: 1;
		min-width: 0;
	}

	.action-eyebrow {
		font-size: 9px;
		font-weight: 700;
		letter-spacing: 0.14em;
		text-transform: uppercase;
	}

	.action-title {
		font-family: var(--ff-d);
		font-size: 13px;
		font-weight: 700;
		margin-top: 2px;
		line-height: 1.2;
	}

	.action-meta {
		font-size: 10px;
		color: var(--text3);
		margin-top: 2px;
	}

	.action-done .action-title {
		text-decoration: line-through;
		text-decoration-color: var(--text3);
		opacity: 0.55;
	}

	/* ── Note fra Linn ─────────────────────────────────────────── */

	.note-section {
		padding: 14px;
		border-radius: 12px;
		background: var(--bg2);
		border: 1px solid var(--border);
		display: flex;
		gap: 11px;
	}

	.note-badge {
		width: 32px;
		height: 32px;
		border-radius: 50%;
		background: var(--ic-rose);
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		font-family: var(--ff-d);
		font-weight: 700;
		font-size: 13px;
		color: var(--terra);
	}

	.note-content {
		flex: 1;
		min-width: 0;
	}

	.note-eyebrow {
		font-size: 9px;
		font-weight: 700;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--text3);
	}

	.note-text {
		font-family: var(--ff-d);
		font-size: 12.5px;
		font-style: italic;
		color: var(--text2);
		margin-top: 3px;
		line-height: 1.45;
	}

	/* ── Mine moduler (B1) ─────────────────────────────────────── */

	.moduler-header {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		margin-bottom: 8px;
	}

	.moduler-title {
		font-family: var(--ff-d);
		font-size: 14px;
		font-weight: 700;
		font-style: italic;
		color: var(--text);
	}

	.moduler-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 8px;
	}

	.modul-card {
		padding: 13px;
		border-radius: 13px;
		background: var(--white);
		border: 1px solid var(--border);
		display: flex;
		flex-direction: column;
		gap: 6px;
		min-height: 80px;
		text-align: left;
		font-family: var(--ff-b);
		cursor: pointer;
	}

	.modul-icon {
		width: 30px;
		height: 30px;
		border-radius: 9px;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.modul-name {
		font-family: var(--ff-d);
		font-size: 13px;
		font-weight: 700;
		line-height: 1.1;
		color: var(--text);
	}

	.modul-meta {
		font-size: 10px;
		color: var(--text3);
	}

	/* ── Featured card (B1 podcast) ────────────────────────────── */

	.featured-card {
		padding: 13px;
		border-radius: 12px;
		background: var(--bg2);
		border: 1px solid var(--border);
		display: flex;
		align-items: center;
		gap: 11px;
	}

	.featured-icon {
		width: 42px;
		height: 42px;
		border-radius: 10px;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.featured-text {
		flex: 1;
		min-width: 0;
	}

	.featured-eyebrow {
		font-size: 9px;
		font-weight: 700;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: #5c7a8c;
	}

	.featured-title {
		font-family: var(--ff-d);
		font-size: 13px;
		font-weight: 700;
		margin-top: 2px;
		line-height: 1.2;
		color: var(--text);
	}

	.featured-meta {
		font-size: 10px;
		color: var(--text3);
	}

	.featured-play {
		width: 28px;
		height: 28px;
		border-radius: 50%;
		background: #5c7a8c;
		border: none;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		cursor: pointer;
	}

	/* ── C1 tilbuds-card ───────────────────────────────────────── */

	.tilbud-card {
		border-radius: 16px;
		overflow: hidden;
		background: linear-gradient(160deg, #c99587 0%, #b87b6e 60%, #9d6358 100%);
		color: #fff;
		padding: 18px;
		position: relative;
	}

	.tilbud-decoration {
		position: absolute;
		right: -30px;
		top: -30px;
		width: 130px;
		height: 130px;
		border-radius: 50%;
		background: rgba(255, 255, 255, 0.08);
	}

	.tilbud-content {
		position: relative;
	}

	.tilbud-eyebrow {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		padding: 3px 9px;
		border-radius: 99px;
		background: rgba(255, 255, 255, 0.22);
		font-size: 9px;
		font-weight: 700;
		letter-spacing: 0.14em;
		margin-bottom: 10px;
	}

	.tilbud-title {
		font-family: var(--ff-d);
		font-size: 22px;
		font-weight: 700;
		line-height: 1.1;
		letter-spacing: -0.01em;
	}

	.tilbud-description {
		font-size: 11.5px;
		opacity: 0.9;
		margin-top: 6px;
		line-height: 1.45;
	}

	.tilbud-button {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 10px 18px;
		border-radius: 99px;
		background: #fff;
		color: var(--terra);
		border: none;
		font-size: 12px;
		font-weight: 600;
		font-family: var(--ff-b);
		margin-top: 14px;
		cursor: pointer;
	}

	/* ── C1 mine køb ───────────────────────────────────────────── */

	.kob-header {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		margin-bottom: 8px;
	}

	.kob-title {
		font-family: var(--ff-d);
		font-size: 14px;
		font-weight: 700;
		font-style: italic;
		color: var(--text);
	}

	.kob-list {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.kob-card {
		padding: 13px;
		border-radius: 12px;
		background: var(--white);
		border: 1px solid var(--border);
		display: flex;
		align-items: center;
		gap: 11px;
		width: 100%;
		text-align: left;
		font-family: var(--ff-b);
		cursor: pointer;
	}

	.kob-icon {
		width: 38px;
		height: 38px;
		border-radius: 10px;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.kob-text {
		flex: 1;
		min-width: 0;
	}

	.kob-name {
		font-family: var(--ff-d);
		font-size: 13px;
		font-weight: 700;
		line-height: 1.2;
		color: var(--text);
	}

	.kob-meta {
		font-size: 10px;
		color: var(--text3);
		margin-top: 2px;
	}

	.kob-expires {
		font-size: 9.5px;
		color: var(--terra);
		margin-top: 2px;
		font-weight: 600;
		letter-spacing: 0.04em;
	}

	.c1-disclaimer {
		font-size: 10px;
		color: var(--text3);
		font-family: var(--ff-d);
		font-style: italic;
		text-align: center;
		padding: 4px 0;
	}

	/* ── Placeholder ───────────────────────────────────────────── */

	.placeholder-page {
		padding: 40px 24px;
		min-height: 100%;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 12px;
		text-align: center;
	}

	.placeholder-text {
		font-family: var(--ff-d);
		font-style: italic;
		font-size: 13px;
		color: var(--text2);
		margin: 0;
	}
</style>
