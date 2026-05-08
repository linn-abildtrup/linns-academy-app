<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import type { Forlob } from '$lib/content/forlobAdgang';
	import type { ForlobDag } from '$lib/content/forlob';
	import { tomForlobDag } from '$lib/content/forlob';
	import { hentForlob, hentForlobsdage } from '$lib/firestore/forlob';
	import Icon from '$lib/components/Icon.svelte';

	const forlobId = $derived(page.params.id ?? '');

	let forlob = $state<Forlob | null>(null);
	let dage = $state<ForlobDag[]>([]);
	let loading = $state(true);
	let fejl = $state<string | null>(null);

	const dagsmap = $derived.by<Map<number, ForlobDag>>(() => {
		const m = new Map<number, ForlobDag>();
		for (const d of dage) m.set(d.dagNummer, d);
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

	onMount(async () => {
		try {
			const f = await hentForlob(forlobId);
			if (!f) {
				fejl = 'Forløbet findes ikke.';
				loading = false;
				return;
			}
			forlob = f;
			dage = await hentForlobsdage(forlobId);
		} catch (e) {
			console.error(e);
			fejl = 'Kunne ikke hente data.';
		} finally {
			loading = false;
		}
	});
</script>

<div class="page">
	<header class="page-header">
		<a class="back" href="/app/admin/forlob/{forlobId}">
			<Icon name="arrow-l" size={14} color="var(--text2)" />
			<span>{forlob?.navn ?? 'Forløb'}</span>
		</a>
		<div class="eyebrow">Admin · {forlob?.navn ?? forlobId} · Lektioner</div>
		<h1>Lektioner</h1>
		<p class="page-sub">
			Læg dagens lektion ind for hver dag i forløbet. Hver dag kan have flere lektioner og en valgfri note.
		</p>
	</header>

	{#if loading}
		<div class="status-besked">Henter...</div>
	{:else if fejl}
		<div class="status-besked fejl">{fejl}</div>
	{:else if forlob}
		<div class="dag-liste">
			{#each programDage as dag (dag.dagNummer)}
				{@const tael = dag.lektioner.length}
				<a class="dag-row" href="/app/admin/forlob/{forlobId}/lektioner/{dag.dagNummer}">
					<div class="dag-num">{dag.dagNummer}</div>
					<div class="dag-tekst">
						<div class="dag-titel">
							Dag {dag.dagNummer}
							<span class="dag-uge">· uge {dag.uge}</span>
						</div>
						{#if tael > 0}
							<div class="dag-sub">
								{tael} lektion{tael === 1 ? '' : 'er'}{dag.noteFraLinn ? ' · note fra Linn' : ''}
							</div>
							<div class="dag-preview">
								{dag.lektioner[0].titel}
								{#if tael > 1}
									<span class="dag-mere">+ {tael - 1} mere</span>
								{/if}
							</div>
						{:else if dag.noteFraLinn}
							<div class="dag-sub">Kun note fra Linn</div>
						{:else}
							<div class="dag-sub dag-tom">Intet indhold endnu</div>
						{/if}
					</div>
					<Icon name="chevron-r" size={14} color="var(--text3)" />
				</a>
			{/each}
		</div>

		<a class="baseline-link" href="/app/admin/forlob/{forlobId}/lektioner/0">
			<Icon name="sparkle" size={14} color="var(--sage)" />
			<span>Rediger baseline-dag (dag 0)</span>
			<Icon name="chevron-r" size={12} color="var(--text3)" />
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

	h1 {
		font-family: var(--ff-d);
		font-size: 26px;
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
	}

	.status-besked.fejl {
		color: #8a4a3e;
		background: #fbeeea;
		border-color: #f0d6cf;
	}

	.dag-liste {
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 14px;
		overflow: hidden;
		margin-bottom: 14px;
	}

	.dag-row {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 12px 14px;
		border-top: 1px solid var(--border);
		text-decoration: none;
		color: inherit;
	}

	.dag-row:first-child {
		border-top: none;
	}

	.dag-row:hover {
		background: var(--bg2);
	}

	.dag-num {
		width: 36px;
		height: 36px;
		border-radius: 10px;
		background: var(--bg2);
		display: flex;
		align-items: center;
		justify-content: center;
		font-family: var(--ff-d);
		font-weight: 700;
		font-size: 14px;
		color: var(--text);
		flex-shrink: 0;
	}

	.dag-tekst {
		flex: 1;
		min-width: 0;
	}

	.dag-titel {
		font-size: 13px;
		font-weight: 600;
		color: var(--text);
	}

	.dag-uge {
		color: var(--text3);
		font-weight: 400;
	}

	.dag-sub {
		font-size: 11px;
		color: var(--text3);
		margin-top: 2px;
	}

	.dag-sub.dag-tom {
		font-style: italic;
	}

	.dag-preview {
		font-size: 12px;
		color: var(--text2);
		margin-top: 2px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.dag-mere {
		color: var(--text3);
		margin-left: 4px;
		font-size: 11px;
	}

	.baseline-link {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 12px 14px;
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 12px;
		text-decoration: none;
		color: var(--text2);
		font-size: 13px;
	}

	.baseline-link:hover {
		background: var(--bg2);
	}

	.baseline-link span {
		flex: 1;
	}
</style>
