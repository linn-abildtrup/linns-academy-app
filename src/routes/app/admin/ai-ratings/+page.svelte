<script lang="ts">
	import { onMount } from 'svelte';
	import { hentAlleAiRatings } from '$lib/firestore/aiRating';
	import { AI_TYPE_LABELS, type AiRating, type AiType, type Rating } from '$lib/content/aiRating';
	import Icon from '$lib/components/Icon.svelte';
	import Loading from '$lib/components/Loading.svelte';

	let ratings = $state<AiRating[]>([]);
	let loading = $state(true);
	let fejl = $state<string | null>(null);
	let aabne = $state<Set<string>>(new Set());
	let filterAi = $state<AiType | 'alle'>('alle');
	let filterMaksRating = $state<Rating | 'alle'>('alle');

	onMount(() => {
		void indlaes();
	});

	async function indlaes() {
		loading = true;
		fejl = null;
		try {
			ratings = await hentAlleAiRatings();
		} catch (e) {
			console.error(e);
			fejl = 'Kunne ikke hente ratings.';
		} finally {
			loading = false;
		}
	}

	function toggle(id: string) {
		const ny = new Set(aabne);
		if (ny.has(id)) ny.delete(id);
		else ny.add(id);
		aabne = ny;
	}

	const filtreret = $derived.by(() => {
		return ratings.filter((r) => {
			if (filterAi !== 'alle' && r.aiType !== filterAi) return false;
			if (filterMaksRating !== 'alle' && r.rating > filterMaksRating) return false;
			return true;
		});
	});

	const statistik = $derived.by(() => {
		const grupper: Record<AiType, { antal: number; sum: number }> = {
			'linn-ai': { antal: 0, sum: 0 },
			'app-hjaelp': { antal: 0, sum: 0 }
		};
		for (const r of ratings) {
			grupper[r.aiType].antal += 1;
			grupper[r.aiType].sum += r.rating;
		}
		return grupper;
	});

	function formatDato(ts: unknown): string {
		if (!ts || typeof ts !== 'object' || !('toDate' in ts)) return '';
		const t = (ts as { toDate: () => Date }).toDate();
		return t.toLocaleDateString('da-DK', {
			day: 'numeric',
			month: 'short',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	function stjerneVisning(rating: Rating): string {
		return '★'.repeat(rating) + '☆'.repeat(5 - rating);
	}
</script>

<div class="page">
	<header class="page-header">
		<a class="back" href="/app/admin">
			<Icon name="arrow-l" size={14} color="var(--text2)" />
			<span>Admin</span>
		</a>
		<div class="eyebrow">Admin</div>
		<h1>AI-ratings</h1>
		<p class="page-sub">
			Klienterne kan rate hvert AI-svar 1-5 stjerner. Brug listen til at finde
			svar der var dårlige (rating 1-2) og forbedre videnbase eller persona-prompt.
		</p>
	</header>

	{#if fejl}
		<div class="status-besked fejl">{fejl}</div>
	{/if}

	<div class="stat-rad">
		<div class="stat-box">
			<div class="stat-titel">Linn AI</div>
			<div class="stat-tal">
				{statistik['linn-ai'].antal > 0
					? (statistik['linn-ai'].sum / statistik['linn-ai'].antal).toFixed(1)
					: '–'}
			</div>
			<div class="stat-sub">{statistik['linn-ai'].antal} ratings</div>
		</div>
		<div class="stat-box">
			<div class="stat-titel">App-hjælp</div>
			<div class="stat-tal">
				{statistik['app-hjaelp'].antal > 0
					? (statistik['app-hjaelp'].sum / statistik['app-hjaelp'].antal).toFixed(1)
					: '–'}
			</div>
			<div class="stat-sub">{statistik['app-hjaelp'].antal} ratings</div>
		</div>
	</div>

	<div class="filter-rad">
		<label class="filter-felt">
			<span class="filter-label">AI-type</span>
			<select bind:value={filterAi}>
				<option value="alle">Alle</option>
				<option value="linn-ai">Linn AI</option>
				<option value="app-hjaelp">App-hjælp</option>
			</select>
		</label>
		<label class="filter-felt">
			<span class="filter-label">Max rating</span>
			<select bind:value={filterMaksRating}>
				<option value="alle">Alle</option>
				<option value={1}>1 stjerne</option>
				<option value={2}>1-2 stjerner</option>
				<option value={3}>1-3 stjerner</option>
			</select>
		</label>
	</div>

	{#if loading}
		<Loading tekst="Henter ratings..." kompakt />
	{:else if filtreret.length === 0}
		<div class="status-besked">Ingen ratings matcher filteret.</div>
	{:else}
		<div class="liste">
			{#each filtreret as r (r.id)}
				{@const aaben = aabne.has(r.id)}
				<div class="rating-row">
					<button class="rating-head" type="button" onclick={() => toggle(r.id)}>
						<div class="rating-stjerner" data-rating={r.rating}>{stjerneVisning(r.rating)}</div>
						<div class="rating-meta">
							<div class="rating-meta-top">
								<span class="rating-ai">{AI_TYPE_LABELS[r.aiType]}</span>
								<span class="rating-dato">{formatDato(r.oprettetAt)}</span>
							</div>
							<div class="rating-email">{r.userEmail || '(ukendt email)'}</div>
							<div class="rating-sporg-preview">{r.sporgsmaal}</div>
						</div>
						<Icon name={aaben ? 'chevron-d' : 'chevron-r'} size={12} color="var(--text3)" />
					</button>
					{#if aaben}
						<div class="rating-body">
							<div class="rating-section">
								<div class="rating-section-label">Spørgsmål</div>
								<div class="rating-section-tekst">{r.sporgsmaal}</div>
							</div>
							<div class="rating-section">
								<div class="rating-section-label">AI-svar</div>
								<div class="rating-section-tekst">{r.svar}</div>
							</div>
							{#if r.samtaleId}
								<div class="rating-section-sub">
									Samtale-id: <code>{r.samtaleId}</code>
									{r.beskedIdx !== undefined ? `· besked #${r.beskedIdx}` : ''}
								</div>
							{/if}
						</div>
					{/if}
				</div>
			{/each}
		</div>
	{/if}
</div>

<style>
	.page {
		padding: 18px 18px 100px;
		max-width: 720px;
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
		line-height: 1.45;
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

	.stat-rad {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 10px;
		margin-bottom: 14px;
	}

	.stat-box {
		padding: 14px 16px;
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 12px;
		text-align: center;
	}

	.stat-titel {
		font-size: calc(11px * var(--fs-scale, 1));
		font-weight: 600;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--text3);
	}

	.stat-tal {
		font-family: var(--ff-d);
		font-size: calc(32px * var(--fs-scale, 1));
		font-weight: 700;
		color: var(--terra);
		margin-top: 4px;
		line-height: 1.1;
	}

	.stat-sub {
		font-size: calc(11px * var(--fs-scale, 1));
		color: var(--text3);
		margin-top: 2px;
	}

	.filter-rad {
		display: flex;
		gap: 10px;
		margin-bottom: 14px;
	}

	.filter-felt {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.filter-label {
		font-size: calc(10.5px * var(--fs-scale, 1));
		font-weight: 600;
		letter-spacing: 0.04em;
		color: var(--text3);
		text-transform: uppercase;
	}

	.filter-felt select {
		padding: 9px 12px;
		border: 1px solid var(--border);
		border-radius: 8px;
		background: var(--white);
		font-family: var(--ff-b);
		color: var(--text);
	}

	.liste {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.rating-row {
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 12px;
		overflow: hidden;
	}

	.rating-head {
		display: flex;
		align-items: flex-start;
		gap: 12px;
		padding: 12px 14px;
		background: none;
		border: none;
		width: 100%;
		text-align: left;
		font-family: var(--ff-b);
		cursor: pointer;
		color: inherit;
	}

	.rating-head:hover {
		background: var(--bg2);
	}

	.rating-stjerner {
		font-size: calc(15px * var(--fs-scale, 1));
		color: #d9b350;
		letter-spacing: 1px;
		flex-shrink: 0;
		font-variant-numeric: tabular-nums;
	}

	.rating-stjerner[data-rating='1'],
	.rating-stjerner[data-rating='2'] {
		color: #b87b6e;
	}

	.rating-meta {
		flex: 1;
		min-width: 0;
	}

	.rating-meta-top {
		display: flex;
		gap: 10px;
		align-items: baseline;
		justify-content: space-between;
	}

	.rating-ai {
		font-size: calc(11px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--terra);
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}

	.rating-dato {
		font-size: calc(10.5px * var(--fs-scale, 1));
		color: var(--text3);
	}

	.rating-email {
		font-size: calc(11.5px * var(--fs-scale, 1));
		color: var(--text2);
		margin-top: 2px;
	}

	.rating-sporg-preview {
		font-size: calc(12px * var(--fs-scale, 1));
		color: var(--text);
		margin-top: 4px;
		overflow: hidden;
		text-overflow: ellipsis;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		line-height: 1.4;
	}

	.rating-body {
		padding: 0 14px 14px;
		display: flex;
		flex-direction: column;
		gap: 10px;
		border-top: 1px solid var(--border);
	}

	.rating-section {
		padding-top: 10px;
	}

	.rating-section-label {
		font-size: calc(10.5px * var(--fs-scale, 1));
		font-weight: 600;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--text3);
		margin-bottom: 4px;
	}

	.rating-section-tekst {
		font-size: calc(12.5px * var(--fs-scale, 1));
		color: var(--text);
		line-height: 1.5;
		white-space: pre-wrap;
	}

	.rating-section-sub {
		font-size: calc(11px * var(--fs-scale, 1));
		color: var(--text3);
	}

	code {
		font-family: ui-monospace, SFMono-Regular, monospace;
		background: var(--bg2);
		padding: 1px 5px;
		border-radius: 4px;
		font-size: calc(10.5px * var(--fs-scale, 1));
	}
</style>
