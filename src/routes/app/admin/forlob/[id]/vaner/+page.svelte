<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import type { VaneProgramDag } from '$lib/content/vaner';
	import type { Forlob } from '$lib/content/forlobAdgang';
	import { hentForlob } from '$lib/firestore/forlob';
	import { hentVaneprogramForForlob } from '$lib/firestore/vaner';
	import Icon from '$lib/components/Icon.svelte';

	const forlobId = $derived(page.params.id ?? '');

	let forlob = $state<Forlob | null>(null);
	let dage = $state<VaneProgramDag[]>([]);
	let loading = $state(true);
	let fejl = $state<string | null>(null);

	onMount(async () => {
		try {
			const f = await hentForlob(forlobId);
			if (!f) {
				fejl = 'Forløbet findes ikke.';
				loading = false;
				return;
			}
			forlob = f;
			dage = await hentVaneprogramForForlob(forlobId);
		} catch (e) {
			console.error(e);
			fejl = 'Kunne ikke hente data.';
		} finally {
			loading = false;
		}
	});

	function badgeFor(dag: VaneProgramDag): { label: string; klass: string } | null {
		if (dag.isBaseline) return { label: 'Baseline', klass: 'baseline' };
		if (dag.isCheckin) return { label: 'Check-in', klass: 'checkin' };
		if (dag.isWin) return { label: '#win', klass: 'win' };
		return null;
	}
</script>

<div class="page">
	<header class="page-header">
		<a class="back" href="/app/admin/forlob/{forlobId}">
			<Icon name="arrow-l" size={14} color="var(--text2)" />
			<span>{forlob?.navn ?? 'Forløb'}</span>
		</a>
		<div class="eyebrow">Admin · {forlob?.navn ?? forlobId} · Vaner</div>
		<h1>Vaneprogram</h1>
		<p class="page-sub">
			Rediger refleksioner, faste vaner og bonus-skridt pr dag for dette forløb.
		</p>
	</header>

	{#if loading}
		<div class="status-besked">Henter program...</div>
	{:else if fejl}
		<div class="status-besked fejl">{fejl}</div>
	{:else if dage.length === 0}
		<div class="status-besked">
			Vaneprogrammet er ikke sat op for dette forløb endnu. Kør
			<code>npm run seed:vaneprogram -- {forlobId}</code> for at få standardindholdet.
		</div>
	{:else}
		<div class="dag-liste">
			{#each dage as dag (dag.dagNummer)}
				{@const badge = badgeFor(dag)}
				<a class="dag-row" href="/app/admin/forlob/{forlobId}/vaner/{dag.dagNummer}">
					<div class="dag-num">{dag.dagNummer}</div>
					<div class="dag-tekst">
						<div class="dag-titel">
							{dag.isBaseline ? 'Baseline' : `Dag ${dag.dagNummer}`}
							{#if badge}
								<span class="badge {badge.klass}">{badge.label}</span>
							{/if}
						</div>
						<div class="dag-sub">
							{#if dag.isBaseline}
								Kun check-in, ingen vaner
							{:else}
								Uge {dag.uge} · {dag.checks.length} vane{dag.checks.length === 1 ? '' : 'r'}
								{#if dag.bonus}
									· bonus
								{/if}
							{/if}
						</div>
						{#if dag.reflection && !dag.isBaseline}
							<div class="dag-reflection">{dag.reflection}</div>
						{/if}
					</div>
					<Icon name="chevron-r" size={14} color="var(--text3)" />
				</a>
			{/each}
		</div>
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
		font-size: calc(26px * var(--fs-scale, 1));
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

	.status-besked code {
		background: var(--bg2);
		padding: 1px 6px;
		border-radius: 4px;
		font-size: calc(11.5px * var(--fs-scale, 1));
	}

	.dag-liste {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.dag-row {
		display: flex;
		align-items: flex-start;
		gap: 12px;
		padding: 12px 14px;
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 12px;
		text-decoration: none;
		color: inherit;
	}

	.dag-row:hover {
		background: var(--bg2);
	}

	.dag-num {
		width: 32px;
		height: 32px;
		border-radius: 50%;
		background: var(--bg2);
		color: var(--text2);
		font-family: var(--ff-d);
		font-size: calc(14px * var(--fs-scale, 1));
		font-weight: 600;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.dag-tekst {
		flex: 1;
		min-width: 0;
	}

	.dag-titel {
		font-size: calc(13.5px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--text);
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.dag-sub {
		font-size: calc(11px * var(--fs-scale, 1));
		color: var(--text3);
		margin-top: 2px;
	}

	.dag-reflection {
		font-size: calc(12px * var(--fs-scale, 1));
		color: var(--text2);
		margin-top: 6px;
		line-height: 1.4;
		font-style: italic;
	}

	.badge {
		font-size: calc(9.5px * var(--fs-scale, 1));
		letter-spacing: 0.1em;
		text-transform: uppercase;
		padding: 2px 7px;
		border-radius: 99px;
		font-weight: 600;
	}

	.badge.baseline {
		background: var(--gdim);
		color: var(--gold);
	}

	.badge.checkin {
		background: var(--sdim);
		color: var(--sage);
	}

	.badge.win {
		background: var(--tdim);
		color: var(--terra);
	}
</style>
