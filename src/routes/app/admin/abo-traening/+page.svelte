<script lang="ts">
	import { onMount } from 'svelte';
	import type { Exercise, GenererConfig, TrainingDay, Udstyr } from '$lib/content/mikrotraening';
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

	type ProduktType = 'basis' | 'premium';
	type Variant = 'kettlebell' | 'no_kettlebell';
	type ProgramKey = `${ProduktType}_${Variant}`;

	function nogle(p: ProduktType, v: Variant): ProgramKey {
		return `${p}_${v}`;
	}

	let aktivTab = $state<ProduktType>('basis');
	let aktivVariant = $state<Variant>('kettlebell');
	const aktivKey = $derived<ProgramKey>(nogle(aktivTab, aktivVariant));

	let programData = $state<Record<ProgramKey, AboMikrotraeningProgramMedDage | null>>({
		basis_kettlebell: null,
		basis_no_kettlebell: null,
		premium_kettlebell: null,
		premium_no_kettlebell: null
	});
	let alleOvelser = $state<Exercise[]>([]);
	let loading = $state(true);
	let fejl = $state<string | null>(null);

	let genererStatus = $state<'klar' | 'arbejder' | 'gemt' | 'fejl'>('klar');
	let genererBesked = $state('');

	// Pre-config-felter — gemmes på programmet og bruges som default
	// næste gang admin auto-genererer. En config pr program-variant.
	const STANDARD_CONFIG: GenererConfig = {
		antalOvelser: 3,
		sets: 3,
		workSec: 45,
		restSec: 15
	};
	let configs = $state<Record<ProgramKey, GenererConfig>>({
		basis_kettlebell: { ...STANDARD_CONFIG },
		basis_no_kettlebell: { ...STANDARD_CONFIG },
		premium_kettlebell: { ...STANDARD_CONFIG },
		premium_no_kettlebell: { ...STANDARD_CONFIG }
	});

	const aktivConfig = $derived(configs[aktivKey]);

	function setConfig(felt: keyof GenererConfig, val: number) {
		configs = {
			...configs,
			[aktivKey]: { ...configs[aktivKey], [felt]: val }
		};
	}

	const aktivProgram = $derived(programData[aktivKey]);
	const tommeDage = $derived(
		aktivProgram?.dage.filter((d) => d.exercises.length === 0).length ?? 0
	);
	const altErTomt = $derived(
		aktivProgram !== null && tommeDage === aktivProgram.dage.length
	);

	onMount(async () => {
		try {
			const [bk, bn, pk, pn, ovelser] = await Promise.all([
				hentAboMikrotraeningProgram('basis', 'kettlebell'),
				hentAboMikrotraeningProgram('basis', 'no_kettlebell'),
				hentAboMikrotraeningProgram('premium', 'kettlebell'),
				hentAboMikrotraeningProgram('premium', 'no_kettlebell'),
				hentAlleExercises()
			]);
			programData = {
				basis_kettlebell: bk,
				basis_no_kettlebell: bn,
				premium_kettlebell: pk,
				premium_no_kettlebell: pn
			};
			alleOvelser = ovelser;
			// Indlæs eksisterende genererConfig pr program hvis sat
			for (const key of [
				'basis_kettlebell',
				'basis_no_kettlebell',
				'premium_kettlebell',
				'premium_no_kettlebell'
			] as ProgramKey[]) {
				const p = programData[key]?.program.genererConfig;
				if (p) configs[key] = { ...p };
			}
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

	function lukAutoGenererBekraeft() {
		viserAutoGenererBekraeft = false;
	}

	function variantNavn(v: Variant): string {
		return v === 'kettlebell' ? 'med kettlebell' : 'uden udstyr';
	}

	function programNavn(p: ProduktType, v: Variant): string {
		const niveau = p === 'basis' ? 'Daglig mikrotræning' : 'Daglig mikrotræning premium';
		const suffix = v === 'kettlebell' ? ' – kettlebell' : ' – uden udstyr';
		return niveau + suffix;
	}

	function udstyrFor(v: Variant): Udstyr[] {
		return v === 'kettlebell' ? ['kettlebell'] : ['ingen'];
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
			const udstyr = udstyrFor(aktivVariant);
			const program: Omit<AboMikrotraeningProgram, 'id'> = aktivProgram?.program
				? {
						navn: aktivProgram.program.navn,
						beskrivelse: aktivProgram.program.beskrivelse,
						treaningsform: 'mikrotraening',
						antalDage: ABO_MIKROTRAENING_DAGE,
						dagligTid: beregnetDagligTid,
						niveau: aktivProgram.program.niveau,
						udstyr,
						aktiv: true,
						genererConfig: { ...aktivConfig }
					}
				: {
						navn: programNavn(aktivTab, aktivVariant),
						beskrivelse: 'Daglig træning.',
						treaningsform: 'mikrotraening',
						antalDage: ABO_MIKROTRAENING_DAGE,
						dagligTid: beregnetDagligTid,
						niveau: 'begynder',
						udstyr,
						aktiv: true,
						genererConfig: { ...aktivConfig }
					};
			await gemAboMikrotraeningProgram(aktivKey, program);

			const filtrerede = filtrerOvelserTilProgram(alleOvelser, program.udstyr);
			const dage: TrainingDay[] = genererProgramMedConfig(
				ABO_MIKROTRAENING_DAGE,
				filtrerede,
				aktivConfig,
				{ markSidsteSomBonus: true }
			);
			await gemAboMikrotraeningDage(aktivKey, dage);

			programData = {
				...programData,
				[aktivKey]: {
					id: aktivKey,
					program: { id: aktivKey, ...program } as AboMikrotraeningProgram,
					dage
				}
			};
			genererStatus = 'gemt';
			genererBesked = `${dage.length} dage genereret for ${aktivTab}-abo (${variantNavn(aktivVariant)}).`;
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
			To programmer pr abo-niveau: med og uden kettlebell. Kunden vælger sin variant
			på sin profil, og ser så det program du har redigeret her.
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

		<div class="variant-tabs">
			<button
				class="variant-tab"
				class:aktiv={aktivVariant === 'kettlebell'}
				onclick={() => (aktivVariant = 'kettlebell')}
			>
				<Icon name="kettlebell" size={14} />
				<span>Med kettlebell</span>
			</button>
			<button
				class="variant-tab"
				class:aktiv={aktivVariant === 'no_kettlebell'}
				onclick={() => (aktivVariant = 'no_kettlebell')}
			>
				<Icon name="stretch" size={14} />
				<span>Uden udstyr</span>
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
				Cykler gennem ben → overkrop → core/stabilitet og forskyder valg pr dag
				så samme øvelse ikke gentages. Klik på en dag nedenfor for at redigere
				den manuelt bagefter.
			</p>
			{#if genererStatus === 'gemt'}
				<div class="besked ok">{genererBesked}</div>
			{:else if genererStatus === 'fejl'}
				<div class="besked fejl">{genererBesked}</div>
			{/if}
		</section>

		{#if aktivProgram}
			<section class="dage-card">
				<div class="section-label">
					{aktivProgram.program.navn} · {aktivProgram.dage.length} dage
				</div>
				{#each aktivProgram.dage as dag (dag.dagNummer)}
					<a
						class="dag-row"
						href="/app/admin/abo-traening/{aktivKey}/{dag.dagNummer}"
					>
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
	<div class="modal-overlay" role="presentation" onclick={lukAutoGenererBekraeft}>
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<div class="modal" role="dialog" aria-modal="true" tabindex="-1" onclick={(e) => e.stopPropagation()}>
			<h3 class="modal-titel">Auto-generér program?</h3>
			<p class="modal-tekst">
				Du er ved at auto-generere programmet for <strong
					>{aktivTab}-abo, {variantNavn(aktivVariant)}</strong
				>. Hvis programmet allerede har manuelle ændringer, bliver de overskrevet.
			</p>
			<div class="modal-knapper">
				<button class="ghost-knap" type="button" onclick={lukAutoGenererBekraeft}>
					Annullér
				</button>
				<button class="primary-knap" type="button" onclick={autoGenerer}>
					Ja, generér
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.page {
		padding: 18px 18px 100px;
		max-width: 720px;
		margin: 0 auto;
	}

	.page-header {
		margin-bottom: 14px;
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
		margin: 4px 0 4px;
		line-height: 1.05;
		color: var(--text);
	}

	.page-sub {
		font-size: calc(12px * var(--fs-scale, 1));
		color: var(--text3);
		margin: 0;
	}

	.tabs {
		display: flex;
		gap: 6px;
		margin-bottom: 8px;
		background: var(--bg2);
		padding: 4px;
		border-radius: 10px;
	}

	.tab {
		flex: 1;
		background: transparent;
		border: none;
		padding: 10px;
		font-family: inherit;
		font-size: calc(13px * var(--fs-scale, 1));
		font-weight: 500;
		color: var(--text2);
		border-radius: 8px;
		cursor: pointer;
	}

	.tab.aktiv {
		background: var(--white);
		color: var(--text);
		font-weight: 600;
	}

	.variant-tabs {
		display: flex;
		gap: 6px;
		margin-bottom: 14px;
	}

	.variant-tab {
		flex: 1;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		background: var(--white);
		border: 1px solid var(--border);
		padding: 8px 12px;
		font-family: inherit;
		font-size: calc(12px * var(--fs-scale, 1));
		color: var(--text2);
		border-radius: 99px;
		cursor: pointer;
	}

	.variant-tab.aktiv {
		background: var(--terra);
		border-color: var(--terra);
		color: var(--white);
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
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--text3);
		margin-bottom: 12px;
	}

	.config-grid {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 10px;
		margin-bottom: 14px;
	}

	.config-felt {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.config-lbl {
		font-size: calc(11px * var(--fs-scale, 1));
		color: var(--text2);
	}

	.config-felt input {
		font-family: inherit;
		font-size: calc(14px * var(--fs-scale, 1));
		padding: 8px 10px;
		border: 1px solid var(--border);
		border-radius: 8px;
		background: var(--bg2);
	}

	.primary-knap {
		width: 100%;
		background: var(--terra);
		color: #fff;
		border: none;
		padding: 12px;
		border-radius: 10px;
		font-family: inherit;
		font-size: calc(14px * var(--fs-scale, 1));
		font-weight: 600;
		cursor: pointer;
	}

	.primary-knap:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.ghost-knap {
		background: var(--white);
		color: var(--text2);
		border: 1px solid var(--border);
		padding: 10px 14px;
		border-radius: 8px;
		font-family: inherit;
		font-size: calc(13px * var(--fs-scale, 1));
		cursor: pointer;
	}

	.hint {
		font-size: calc(11px * var(--fs-scale, 1));
		color: var(--text3);
		margin: 10px 0 0;
		line-height: 1.5;
	}

	.besked {
		font-size: calc(12px * var(--fs-scale, 1));
		padding: 8px 12px;
		border-radius: 8px;
		margin-top: 10px;
	}

	.besked.ok {
		background: rgba(143, 168, 144, 0.18);
		color: #4f6f5b;
	}

	.besked.fejl {
		background: #fbeeea;
		color: #8a4a3e;
	}

	.dag-row {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 10px 12px;
		border-radius: 10px;
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
		font-weight: 600;
		font-size: calc(14px * var(--fs-scale, 1));
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
		font-size: calc(13px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--text);
	}

	.dag-sub {
		font-size: calc(11.5px * var(--fs-scale, 1));
		color: var(--text3);
		margin-top: 1px;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.status-besked {
		padding: 14px 16px;
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 12px;
		color: var(--text3);
		font-size: calc(13px * var(--fs-scale, 1));
		text-align: center;
	}

	.status-besked.fejl {
		color: #8a4a3e;
		background: #fbeeea;
		border-color: #f0d6cf;
	}

	.modal-overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.5);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 100;
		padding: 20px;
	}

	.modal {
		background: var(--white);
		border-radius: 14px;
		padding: 20px;
		max-width: 380px;
		width: 100%;
	}

	.modal-titel {
		font-family: var(--ff-d);
		font-size: calc(18px * var(--fs-scale, 1));
		font-weight: 600;
		margin: 0 0 10px;
		color: var(--text);
	}

	.modal-tekst {
		font-size: calc(13px * var(--fs-scale, 1));
		color: var(--text2);
		line-height: 1.5;
		margin: 0 0 14px;
	}

	.modal-knapper {
		display: flex;
		gap: 8px;
		justify-content: flex-end;
	}

	.modal-knapper .primary-knap {
		width: auto;
		padding: 10px 16px;
	}
</style>
