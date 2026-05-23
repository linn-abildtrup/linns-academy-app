<script lang="ts">
	import { onMount } from 'svelte';
	import type { Exercise, GenererConfig, TrainingDay } from '$lib/content/mikrotraening';
	import {
		filtrerOvelserTilProgram,
		genererProgramMedConfig
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
	import BekraeftModal from '$lib/components/BekraeftModal.svelte';

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

	// Pre-config-felter — gemmes på programmet og bruges som default
	// næste gang admin auto-genererer.
	const STANDARD_CONFIG: GenererConfig = {
		antalOvelser: 3,
		sets: 3,
		workSec: 30,
		restSec: 10
	};
	let configBasis = $state<GenererConfig>({ ...STANDARD_CONFIG });
	let configPremium = $state<GenererConfig>({ ...STANDARD_CONFIG });

	const aktivConfig = $derived(aktivTab === 'basis' ? configBasis : configPremium);

	function setConfig(felt: keyof GenererConfig, val: number) {
		const nuvaerende = aktivTab === 'basis' ? configBasis : configPremium;
		const opdateret = { ...nuvaerende, [felt]: val };
		if (aktivTab === 'basis') configBasis = opdateret;
		else configPremium = opdateret;
	}

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
			if (basis?.program.genererConfig) configBasis = { ...basis.program.genererConfig };
			if (premium?.program.genererConfig) configPremium = { ...premium.program.genererConfig };
		} catch (e) {
			fejl = 'Kunne ikke hente data.';
			console.error(e);
		} finally {
			loading = false;
		}
	});

	let viserAutoGenererBekraeft = $state(false);

	function aabnAutoGenererBekraeft() {
		if (genererStatus === 'arbejder') return;
		viserAutoGenererBekraeft = true;
	}

	async function autoGenerer() {
		if (genererStatus === 'arbejder') return;
		viserAutoGenererBekraeft = false;

		genererStatus = 'arbejder';
		genererBesked = '';

		try {
			const beregnetDagligTid = Math.max(
				1,
				Math.round(
					(aktivConfig.antalOvelser *
						aktivConfig.sets *
						(aktivConfig.workSec + aktivConfig.restSec)) /
						60
				)
			);
			const program: Omit<AboMikrotraeningProgram, 'id'> = aktivProgram?.program
				? {
						navn: aktivProgram.program.navn,
						beskrivelse: aktivProgram.program.beskrivelse,
						treaningsform: 'mikrotraening',
						antalDage: ABO_MIKROTRAENING_DAGE,
						dagligTid: beregnetDagligTid,
						niveau: aktivProgram.program.niveau,
						udstyr: aktivProgram.program.udstyr ?? ['ingen'],
						aktiv: true,
						genererConfig: { ...aktivConfig }
					}
				: {
						navn: aktivTab === 'basis' ? 'Daglig mikrotræning' : 'Daglig mikrotræning premium',
						beskrivelse: 'Daglig træning.',
						treaningsform: 'mikrotraening',
						antalDage: ABO_MIKROTRAENING_DAGE,
						dagligTid: beregnetDagligTid,
						niveau: 'begynder',
						udstyr: ['ingen'],
						aktiv: true,
						genererConfig: { ...aktivConfig }
					};
			await gemAboMikrotraeningProgram(aktivTab, program);

			const filtrerede = filtrerOvelserTilProgram(alleOvelser, program.udstyr);
			const dage: TrainingDay[] = genererProgramMedConfig(
				ABO_MIKROTRAENING_DAGE,
				filtrerede,
				aktivConfig
			);
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
			Mikrotræning for basis- og premium-abonnenter.
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
			<div class="section-label">Indstillinger til auto-gen</div>
			<div class="config-grid">
				<label class="config-felt">
					<span class="config-lbl">Antal øvelser pr dag</span>
					<input
						type="number"
						min="1"
						max="6"
						step="1"
						value={aktivConfig.antalOvelser}
						oninput={(e) =>
							setConfig('antalOvelser', parseInt((e.target as HTMLInputElement).value, 10))}
					/>
				</label>
				<label class="config-felt">
					<span class="config-lbl">Sæt pr øvelse</span>
					<input
						type="number"
						min="1"
						max="6"
						step="1"
						value={aktivConfig.sets}
						oninput={(e) => setConfig('sets', parseInt((e.target as HTMLInputElement).value, 10))}
					/>
				</label>
				<label class="config-felt">
					<span class="config-lbl">Arbejdstid (sek)</span>
					<input
						type="number"
						min="10"
						max="120"
						step="5"
						value={aktivConfig.workSec}
						oninput={(e) =>
							setConfig('workSec', parseInt((e.target as HTMLInputElement).value, 10))}
					/>
				</label>
				<label class="config-felt">
					<span class="config-lbl">Hviletid (sek)</span>
					<input
						type="number"
						min="0"
						max="60"
						step="5"
						value={aktivConfig.restSec}
						oninput={(e) =>
							setConfig('restSec', parseInt((e.target as HTMLInputElement).value, 10))}
					/>
				</label>
			</div>

			<button
				class="primary-knap"
				type="button"
				onclick={aabnAutoGenererBekraeft}
				disabled={genererStatus === 'arbejder'}
			>
				{#if genererStatus === 'arbejder'}
					Genererer...
				{:else if !aktivProgram || altErTomt}
					Auto-generér program
				{:else}
					Auto-generér igen (overskriver)
				{/if}
			</button>
			<p class="hint">
				Cykler gennem ben → overkrop → core/stabilitet og forskyder valg pr. dag
				så samme øvelse ikke gentages. Indstillingerne ovenfor gemmes med programmet
				og er default næste gang du auto-genererer. Klik på en dag nedenfor for at
				redigere den manuelt bagefter.
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
					<a class="dag-row" href="/app/admin/abo-traening/{aktivTab}/{dag.dagNummer}">
						<div class="dag-num">{dag.dagNummer}</div>
						<div class="dag-tekst">
							<div class="dag-titel">Dag {dag.dagNummer}</div>
							<div class="dag-sub">{dagOpsummering(dag)}</div>
						</div>
						<Icon name="chevron-r" size={14} color="var(--text3)" />
					</a>
				{/each}
			</section>
		{:else}
			<div class="status-besked">
				Programmet er ikke oprettet endnu. Tryk 'Auto-generér' for at komme i gang.
			</div>
		{/if}
	{/if}
</div>

{#if viserAutoGenererBekraeft}
	<BekraeftModal
		titel="{aktivProgram ? 'Overskriv' : 'Opret'} programmet?"
		beskrivelse="Det vil {aktivProgram
			? 'overskrive det eksisterende program'
			: 'oprette et nyt program'} for {aktivTab}-abo. Er du sikker?"
		bekraeftTekst={aktivProgram ? 'Overskriv' : 'Opret'}
		destruktiv={!!aktivProgram}
		arbejder={genererStatus === 'arbejder'}
		onBekraeft={() => void autoGenerer()}
		onAnnuller={() => (viserAutoGenererBekraeft = false)}
	/>
{/if}

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
		text-decoration: none;
		color: inherit;
	}

	.dag-row:first-child {
		border-top: none;
	}

	.dag-row:hover {
		background: var(--bg2);
		margin: 0 -8px;
		padding: 10px 8px;
	}

	.config-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 8px;
		margin-bottom: 14px;
	}

	.config-felt {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.config-lbl {
		font-size: calc(11px * var(--fs-scale, 1));
		color: var(--text3);
		font-weight: 500;
	}

	.config-felt input {
		padding: 9px 10px;
		font-size: calc(14px * var(--fs-scale, 1));
		font-family: var(--ff-b);
		border: 1px solid var(--border);
		border-radius: 8px;
		background: var(--white);
		color: var(--text);
		width: 100%;
		box-sizing: border-box;
	}

	.config-felt input:focus {
		outline: 2px solid var(--terra);
		outline-offset: -1px;
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
