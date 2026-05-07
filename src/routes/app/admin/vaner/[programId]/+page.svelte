<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import type { VaneProgram, VaneProgramDag } from '$lib/content/vaner';
	import { hentVaneProgram } from '$lib/firestore/vaner';
	import Icon from '$lib/components/Icon.svelte';

	const programId = $derived(page.params.programId ?? '');

	let program = $state<VaneProgram | null>(null);
	let dage = $state<VaneProgramDag[]>([]);
	let loading = $state(true);
	let fejl = $state<string | null>(null);

	onMount(async () => {
		try {
			const data = await hentVaneProgram(programId);
			if (!data) {
				fejl = 'Programmet findes ikke.';
				loading = false;
				return;
			}
			program = data.program;
			dage = data.dage;
		} catch (e) {
			console.error(e);
			fejl = 'Kunne ikke hente programmet.';
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
		<a class="back" href="/app/admin/vaner">
			<Icon name="arrow-l" size={14} color="var(--text2)" />
			<span>Programmer</span>
		</a>
		<div class="eyebrow">Admin · Vaner</div>
		<h1>{program?.navn ?? programId}</h1>
		{#if program?.beskrivelse}
			<p class="page-sub">{program.beskrivelse}</p>
		{/if}
	</header>

	{#if loading}
		<div class="status-besked">Henter program...</div>
	{:else if fejl}
		<div class="status-besked fejl">{fejl}</div>
	{:else}
		<div class="dag-liste">
			{#each dage as dag (dag.dagNummer)}
				{@const badge = badgeFor(dag)}
				<a class="dag-row" href="/app/admin/vaner/{programId}/{dag.dagNummer}">
					<div class="dag-num">
						{dag.dagNummer}
					</div>
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
		font-size: 14px;
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
		font-size: 13.5px;
		font-weight: 600;
		color: var(--text);
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.dag-sub {
		font-size: 11px;
		color: var(--text3);
		margin-top: 2px;
	}

	.dag-reflection {
		font-size: 12px;
		color: var(--text2);
		margin-top: 6px;
		line-height: 1.4;
		font-style: italic;
	}

	.badge {
		font-size: 9.5px;
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
