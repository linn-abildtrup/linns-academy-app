<script lang="ts">
	import { onMount } from 'svelte';
	import type { Exercise, TrainingDay } from '$lib/content/mikrotraening';
	import {
		filtrerOvelserTilProgram,
		genererStandardProgram
	} from '$lib/content/mikrotraening';
	import {
		ABO_MIKROTRAENING_DAGE,
		type AboMikrotraeningProgram
	} from '$lib/content/aboMikrotraening';
	import {
		hentAboMikrotraeningProgram,
		gemAboMikrotraeningProgram,
		gemAboMikrotraeningDage,
		type AboMikrotraeningProgramMedDage
	} from '$lib/firestore/aboMikrotraening';
	import { hentAlleExercises } from '$lib/firestore/mikrotraening';
	import Icon from '$lib/components/Icon.svelte';
	import Loading from '$lib/components/Loading.svelte';

	type ProduktType = 'basis' | 'premium';
	let aktivTab = $state<ProduktType>('basis');

	let programData = $state<Record<ProduktType, AboMikrotraeningProgramMedDage | null>>({
		basis: null,
		premium: null
	});
	let alleOvelser = $state<Exercise[]>([]);
	let loading = $state(true);
	let fejl = $state<string | null>(null);

	let genererStatus = $state<'klar' | 'arbejder' | 'gemt' | 'fejl'>('klar');
	let genererBesked = $state('');

	const aktivProgram = $derived(programData[aktivTab]);
	const tommeDage = $derived(
		aktivProgram?.dage.filter((d) => d.exercises.length === 0).length ?? 0
	);
	const altErTomt = $derived(
		aktivProgram !== null && tommeDage === aktivProgram.dage.length
	);

	onMount(async () => {
		try {
			const [basis, premium, ovelser] = await Promise.all([
				hentAboMikrotraeningProgram('basis'),
				hentAboMikrotraeningProgram('premium'),
				hentAlleExercises()
			]);
			programData = { basis, premium };
			alleOvelser = ovelser;
		} catch (e) {
			fejl = 'Kunne ikke hente data.';
			console.error(e);
		} finally {
			loading = false;
		}
	});

	async function autoGenerer() {
		if (genererStatus === 'arbejder') return;
		const bekraeftet = confirm(
			`Det vil ${aktivProgram ? 'overskrive' : 'oprette'} ${ABO_MIKROTRAENING_DAGE} dages program for ${aktivTab}-abo. Er du sikker?`
		);
		if (!bekraeftet) return;

		genererStatus = 'arbejder';
		genererBesked = '';

		try {
			// Sikrer at program-doc'en findes med standard-metadata
			const program: Omit<AboMikrotraeningProgram, 'id'> = aktivProgram?.program
				? {
						navn: aktivProgram.program.navn,
						beskrivelse: aktivProgram.program.beskrivelse,
						treaningsform: 'mikrotraening',
						antalDage: ABO_MIKROTRAENING_DAGE,
						dagligTid: aktivProgram.program.dagligTid,
						niveau: aktivProgram.program.niveau,
						udstyr: aktivProgram.program.udstyr ?? ['ingen'],
						aktiv: true
					}
				: {
						navn: aktivTab === 'basis' ? 'Daglig mikrotræning' : 'Daglig mikrotræning premium',
						beskrivelse:
							'Tre minutters daglig styrketræning. 14 dage der looper.',
						treaningsform: 'mikrotraening',
						antalDage: ABO_MIKROTRAENING_DAGE,
						dagligTid: 3,
						niveau: 'begynder',
						udstyr: ['ingen'],
						aktiv: true
					};
			await gemAboMikrotraeningProgram(aktivTab, program);

			const filtrerede = filtrerOvelserTilProgram(alleOvelser, program.udstyr);
			const dage: TrainingDay[] = genererStandardProgram(ABO_MIKROTRAENING_DAGE, filtrerede);
			await gemAboMikrotraeningDage(aktivTab, dage);

			programData = {
				...programData,
				[aktivTab]: {
					id: aktivTab,
					program: { id: aktivTab, ...program } as AboMikrotraeningProgram,
					dage
				}
			};
			genererStatus = 'gemt';
			genererBesked = `${dage.length} dage genereret og gemt for ${aktivTab}-abo.`;
		} catch (e) {
			genererStatus = 'fejl';
			genererBesked = e instanceof Error ? e.message : 'Kunne ikke generere program.';
			console.error(e);
		}
	}

	function ovelseNavn(exerciseId: string): string {
		return alleOvelser.find((e) => e.id === exerciseId)?.name ?? exerciseId;
	}

	function dagOpsummering(dag: TrainingDay): string {
		if (dag.exercises.length === 0) return 'Tom — ingen øvelser';
		return dag.exercises.map((e) => ovelseNavn(e.exerciseId)).join(' · ');
	}
</script>

<div class="page">
	<header class="page-header">
		<a class="back" href="/app/admin">
			<Icon name="arrow-l" size={14} color="var(--text2)" />
			<span>Admin</span>
		</a>
		<div class="eyebrow">Admin · Abo-træning</div>
		<h1>Mikrotræning for abonnenter</h1>
		<p class="page-sub">
			14 dages program der looper. Når basis- eller premium-abonnenten har
			gennemført dag 14, starter hun forfra på dag 1 med samme indhold.
		</p>
	</header>

	{#if loading}
		<Loading tekst="Henter..." />
	{:else if fejl}
		<div class="status-besked fejl">{fejl}</div>
	{:else}
		<div class="tabs">
			<button class="tab" class:aktiv={aktivTab === 'basis'} onclick={() => (aktivTab = 'basis')}>
				Basis-app
			</button>
			<button
				class="tab"
				class:aktiv={aktivTab === 'premium'}
				onclick={() => (aktivTab = 'premium')}
			>
				Premium-app
			</button>
		</div>

		<section class="actions-card">
			<div class="section-label">Auto-generér</div>
			<button
				class="primary-knap"
				type="button"
				onclick={autoGenerer}
				disabled={genererStatus === 'arbejder'}
			>
				{#if genererStatus === 'arbejder'}
					Genererer...
				{:else if !aktivProgram || altErTomt}
					Auto-generér 14-dages program
				{:else}
					Auto-generér igen (overskriver)
				{/if}
			</button>
			<p class="hint">
				Genererer 1 ben-, 1 overkrop- og 1 core/stabilitet-øvelse pr. dag, alle
				3 sæt × 30s arbejde × 10s hvile. Du kan justere hver dag bagefter via
				det almindelige forløbs-redigerings-flow (samme øvelses-bibliotek).
			</p>
			{#if genererStatus === 'gemt'}
				<div class="besked ok">{genererBesked}</div>
			{:else if genererStatus === 'fejl'}
				<div class="besked fejl">{genererBesked}</div>
			{/if}
		</section>

		{#if aktivProgram}
			<section class="dage-card">
				<div class="section-label">Programmets {aktivProgram.dage.length} dage</div>
				{#each aktivProgram.dage as dag (dag.dagNummer)}
					<div class="dag-row">
						<div class="dag-num">{dag.dagNummer}</div>
						<div class="dag-tekst">
							<div class="dag-titel">Dag {dag.dagNummer}</div>
							<div class="dag-sub">{dagOpsummering(dag)}</div>
						</div>
					</div>
				{/each}
			</section>
		{:else}
			<div class="status-besked">
				Programmet er ikke oprettet endnu. Tryk 'Auto-generér' for at komme i gang.
			</div>
		{/if}
	{/if}
</div>

<style>
	.page {
		padding: 18px 18px 100px;
		max-width: 640px;
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

	.tabs {
		display: flex;
		gap: 4px;
		margin-bottom: 14px;
	}

	.tab {
		flex: 1;
		padding: 10px 12px;
		border-radius: 8px;
		border: 1px solid var(--border);
		background: var(--white);
		color: var(--text2);
		font-size: calc(13px * var(--fs-scale, 1));
		font-weight: 600;
		cursor: pointer;
		font-family: var(--ff-b);
	}

	.tab.aktiv {
		background: var(--terra);
		color: #fff;
		border-color: var(--terra);
	}

	.actions-card,
	.dage-card {
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 14px;
		padding: 16px;
		margin-bottom: 14px;
	}

	.section-label {
		font-size: calc(10px * var(--fs-scale, 1));
		font-weight: 600;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: var(--text3);
		margin-bottom: 10px;
	}

	.primary-knap {
		display: block;
		width: 100%;
		padding: 12px;
		background: var(--terra);
		color: #fff;
		font-size: calc(14px * var(--fs-scale, 1));
		font-weight: 600;
		border-radius: 10px;
		border: none;
		cursor: pointer;
		font-family: var(--ff-b);
	}

	.primary-knap:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.hint {
		font-size: calc(12px * var(--fs-scale, 1));
		color: var(--text3);
		line-height: 1.5;
		margin: 8px 0 0;
	}

	.besked {
		margin-top: 10px;
		padding: 8px 12px;
		border-radius: 8px;
		font-size: calc(12px * var(--fs-scale, 1));
		text-align: center;
	}

	.besked.ok {
		background: var(--sdim);
		border: 1px solid var(--sage);
		color: var(--text);
	}

	.besked.fejl {
		background: #fbeeea;
		border: 1px solid #f0d6cf;
		color: #8a4a3e;
	}

	.dag-row {
		display: flex;
		gap: 12px;
		align-items: center;
		padding: 10px 0;
		border-top: 1px solid var(--border);
	}

	.dag-row:first-child {
		border-top: none;
	}

	.dag-num {
		width: 30px;
		height: 30px;
		border-radius: 50%;
		background: var(--bg2);
		color: var(--text2);
		font-family: var(--ff-d);
		font-weight: 600;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		font-size: calc(13px * var(--fs-scale, 1));
	}

	.dag-tekst {
		flex: 1;
		min-width: 0;
	}

	.dag-titel {
		font-size: calc(13.5px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--text);
	}

	.dag-sub {
		font-size: calc(11.5px * var(--fs-scale, 1));
		color: var(--text3);
		margin-top: 2px;
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
</style>
