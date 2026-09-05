<script lang="ts">
	// ============================================================
	// Mikrotraening til abonnenter, i det nye design.
	//
	// Tiende af de 19 gamle admin-sider, 1. september 2026.
	//
	// LOGIKKEN ER FLYTTET, IKKE SKREVET OM. Samme funktioner, samme
	// udregning af daglig tid, og samme fire programmer. Genereringen
	// bruger filtrerOvelserTilProgram og genererProgramMedConfig ordret som
	// foer.
	//
	// FIRE PROGRAMMER, IKKE ÉT: basis og premium gange med og uden
	// kettlebell. Ordene basis og premium staar stadig her, for det er
	// noeglerne dokumenterne ligger under. Se noten i abo-vaner.
	//
	// AT GENERERE OVERSKRIVER ALLE DAGENE. Det er derfor der bekraeftes
	// foerst, og det er derfor der staar hvor mange dage der er fyldt ud i
	// forvejen.
	//
	// Den gamle side paa /app/admin/abo-traening er uroert.
	// ============================================================

	import { getContext, onMount } from 'svelte';
	import type { User } from 'firebase/auth';
	import { isAdmin } from '$lib/admin';
	import type { Exercise, GenererConfig, TrainingDay, Udstyr } from '$lib/content/mikrotraening';
	import { filtrerOvelserTilProgram, genererProgramMedConfig } from '$lib/content/mikrotraening';
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
	import AdmSide from '$lib/components/admin/AdmSide.svelte';
	import AdmKort from '$lib/components/admin/AdmKort.svelte';
	import AdmKnap from '$lib/components/admin/AdmKnap.svelte';
	import AdmMaerkat from '$lib/components/admin/AdmMaerkat.svelte';
	import AdmTom from '$lib/components/admin/AdmTom.svelte';

	const hentUser = getContext<() => User | null>('user');
	const maaVaereHer = $derived(isAdmin(hentUser()));

	type Type = 'basis' | 'premium';
	type Variant = 'kettlebell' | 'no_kettlebell';
	type Noegle = `${Type}_${Variant}`;

	const ALLE_NOEGLER: Noegle[] = [
		'basis_kettlebell',
		'basis_no_kettlebell',
		'premium_kettlebell',
		'premium_no_kettlebell'
	];

	let type = $state<Type>('basis');
	let variant = $state<Variant>('kettlebell');
	const noegle = $derived<Noegle>(`${type}_${variant}`);

	let data = $state<Record<Noegle, AboMikrotraeningProgramMedDage | null>>({
		basis_kettlebell: null,
		basis_no_kettlebell: null,
		premium_kettlebell: null,
		premium_no_kettlebell: null
	});
	let oevelser = $state<Exercise[]>([]);
	let henter = $state(true);
	let fejl = $state('');

	let arbejder = $state(false);
	let besked = $state('');
	let bekraefter = $state(false);

	const STANDARD: GenererConfig = { antalOvelser: 3, sets: 3, workSec: 45, restSec: 15 };
	let configs = $state<Record<Noegle, GenererConfig>>({
		basis_kettlebell: { ...STANDARD },
		basis_no_kettlebell: { ...STANDARD },
		premium_kettlebell: { ...STANDARD },
		premium_no_kettlebell: { ...STANDARD }
	});

	const config = $derived(configs[noegle]);
	const program = $derived(data[noegle]);
	const tommeDage = $derived(program?.dage.filter((d) => d.exercises.length === 0).length ?? 0);

	function saet(felt: keyof GenererConfig, v: number) {
		configs = { ...configs, [noegle]: { ...configs[noegle], [felt]: v } };
	}

	onMount(() => void indlaes());

	async function indlaes() {
		henter = true;
		fejl = '';
		try {
			const [bk, bn, pk, pn, ex] = await Promise.all([
				hentAboMikrotraeningProgram('basis', 'kettlebell'),
				hentAboMikrotraeningProgram('basis', 'no_kettlebell'),
				hentAboMikrotraeningProgram('premium', 'kettlebell'),
				hentAboMikrotraeningProgram('premium', 'no_kettlebell'),
				hentAlleExercises()
			]);
			data = {
				basis_kettlebell: bk,
				basis_no_kettlebell: bn,
				premium_kettlebell: pk,
				premium_no_kettlebell: pn
			};
			oevelser = ex;
			// De gemte indstillinger vinder over standarden, saa en generering
			// giver det samme som sidst hvis der ikke roeres noget.
			for (const k of ALLE_NOEGLER) {
				const gemt = data[k]?.program.genererConfig;
				if (gemt) configs[k] = { ...gemt };
			}
		} catch (e) {
			console.error('[admin] abo-træning', e);
			fejl = 'Kunne ikke hente programmerne.';
		} finally {
			henter = false;
		}
	}

	function variantNavn(v: Variant): string {
		return v === 'kettlebell' ? 'med kettlebell' : 'uden udstyr';
	}

	function programNavn(t: Type, v: Variant): string {
		const n = t === 'basis' ? 'Daglig mikrotræning' : 'Daglig mikrotræning premium';
		return n + (v === 'kettlebell' ? ' – kettlebell' : ' – uden udstyr');
	}

	function udstyrFor(v: Variant): Udstyr[] {
		return v === 'kettlebell' ? ['kettlebell'] : ['ingen'];
	}

	function oevelseNavn(id: string): string {
		return oevelser.find((e) => e.id === id)?.name ?? id;
	}

	function dagTekst(d: TrainingDay): string {
		if (d.exercises.length === 0) return 'Tom, ingen øvelser';
		return d.exercises.map((e) => oevelseNavn(e.exerciseId)).join(' · ');
	}

	async function generer() {
		if (arbejder) return;
		bekraefter = false;
		arbejder = true;
		besked = '';
		try {
			const dagligTid = Math.max(
				1,
				Math.round((config.antalOvelser * config.sets * (config.workSec + config.restSec)) / 60)
			);
			const udstyr = udstyrFor(variant);
			const eks = program?.program;
			const nyt: Omit<AboMikrotraeningProgram, 'id'> = {
				navn: eks?.navn ?? programNavn(type, variant),
				beskrivelse: eks?.beskrivelse ?? 'Daglig træning.',
				treaningsform: 'mikrotraening',
				antalDage: ABO_MIKROTRAENING_DAGE,
				dagligTid,
				niveau: eks?.niveau ?? 'begynder',
				udstyr,
				aktiv: true,
				genererConfig: { ...config }
			};
			await gemAboMikrotraeningProgram(noegle, nyt);

			const brugbare = filtrerOvelserTilProgram(oevelser, nyt.udstyr);
			const dage = genererProgramMedConfig(ABO_MIKROTRAENING_DAGE, brugbare, config, {
				markSidsteSomBonus: true
			});
			await gemAboMikrotraeningDage(noegle, dage);

			data = {
				...data,
				[noegle]: {
					id: noegle,
					program: { id: noegle, ...nyt } as AboMikrotraeningProgram,
					dage
				}
			};
			besked = `${dage.length} dage lavet for ${type} ${variantNavn(variant)}.`;
		} catch (e) {
			console.error('[admin] generér', e);
			besked = e instanceof Error ? e.message : 'Kunne ikke lave programmet.';
		} finally {
			arbejder = false;
		}
	}

	const brugbareNu = $derived(filtrerOvelserTilProgram(oevelser, udstyrFor(variant)).length);
</script>

<svelte:head><title>Træning til abonnenter · Admin</title></svelte:head>

{#if !maaVaereHer}
	<p class="at-kun">Siden er kun for admin.</p>
{:else}
	<AdmSide
		titel="Træning til abonnenter"
		under="Fire programmer: basis og premium, hver med og uden kettlebell. Dagene laves automatisk ud fra øvelsesbanken."
		bred
	>
		{#if besked}<div class="at-besked">{besked}</div>{/if}
		{#if fejl}<div class="at-fejl">{fejl}</div>{/if}

		<div class="at-faner">
			{#each [['basis', 'Basis'], ['premium', 'Premium']] as [id, navn] (id)}
				<button
					type="button"
					class="at-chip"
					class:paa={type === id}
					onclick={() => (type = id as Type)}
				>
					{navn}
				</button>
			{/each}
			<span class="at-skel"></span>
			{#each [['kettlebell', 'Med kettlebell'], ['no_kettlebell', 'Uden udstyr']] as [id, navn] (id)}
				<button
					type="button"
					class="at-chip"
					class:paa={variant === id}
					onclick={() => (variant = id as Variant)}>{navn}</button
				>
			{/each}
		</div>

		{#if henter}
			<AdmTom tekst="Henter programmerne…" />
		{:else if fejl && !program}
			<AdmTom tekst={fejl} fejl>
				{#snippet handling()}
					<AdmKnap onclick={indlaes}>Prøv igen</AdmKnap>
				{/snippet}
			</AdmTom>
		{:else}
			<AdmKort>
				<div class="at-h-raek">
					<h2 class="at-h">{programNavn(type, variant)}</h2>
					{#if !program}
						<AdmMaerkat farve="ro">Findes ikke endnu</AdmMaerkat>
					{:else if tommeDage > 0}
						<AdmMaerkat farve="ro">{tommeDage} tomme dage</AdmMaerkat>
					{:else}
						<AdmMaerkat farve="klar">Fyldt ud</AdmMaerkat>
					{/if}
				</div>
				<p class="at-meta">
					{#if program}
						{program.dage.length} dage · {program.program.dagligTid} min om dagen
					{:else}
						Der er ikke lavet noget program endnu.
					{/if}
					· {brugbareNu} øvelser passer til {variantNavn(variant)}
				</p>
			</AdmKort>

			<AdmKort>
				<div class="at-felt-raek">
					<label class="at-felt">
						<span>Øvelser pr dag</span>
						<input
							type="number"
							min="1"
							max="8"
							value={config.antalOvelser}
							disabled={arbejder}
							onchange={(e) => saet('antalOvelser', Number(e.currentTarget.value))}
						/>
					</label>
					<label class="at-felt">
						<span>Sæt</span>
						<input
							type="number"
							min="1"
							max="6"
							value={config.sets}
							disabled={arbejder}
							onchange={(e) => saet('sets', Number(e.currentTarget.value))}
						/>
					</label>
					<label class="at-felt">
						<span>Arbejde i sekunder</span>
						<input
							type="number"
							min="10"
							max="120"
							value={config.workSec}
							disabled={arbejder}
							onchange={(e) => saet('workSec', Number(e.currentTarget.value))}
						/>
					</label>
					<label class="at-felt">
						<span>Pause i sekunder</span>
						<input
							type="number"
							min="0"
							max="120"
							value={config.restSec}
							disabled={arbejder}
							onchange={(e) => saet('restSec', Number(e.currentTarget.value))}
						/>
					</label>
				</div>
				<p class="at-hint">
					Det giver
					{Math.max(
						1,
						Math.round((config.antalOvelser * config.sets * (config.workSec + config.restSec)) / 60)
					)} minutter om dagen. Indstillingerne bliver gemt på programmet, så næste gang starter du samme
					sted.
				</p>

				{#if bekraefter}
					<!-- Der bekraeftes, fordi ALLE dagene bliver skrevet over. Har
					     du rettet en enkelt dag i haanden, er den vaek bagefter. -->
					<div class="at-advarsel">
						Alle {ABO_MIKROTRAENING_DAGE} dage bliver lavet om. Har du rettet en enkelt dag i hånden,
						forsvinder den.
					</div>
					<div class="at-knapper">
						<AdmKnap slags="fare" disabled={arbejder} onclick={generer}>
							{arbejder ? 'Laver…' : 'Ja, lav dem om'}
						</AdmKnap>
						<AdmKnap disabled={arbejder} onclick={() => (bekraefter = false)}>Fortryd</AdmKnap>
					</div>
				{:else}
					<div class="at-knapper">
						<AdmKnap slags="primaer" disabled={arbejder} onclick={() => (bekraefter = true)}>
							Lav dagene automatisk
						</AdmKnap>
					</div>
				{/if}
			</AdmKort>

			{#if program && program.dage.length > 0}
				<p class="at-antal">Dagene</p>
				<div class="at-liste">
					{#each program.dage as d, i (i)}
						<div class="at-dag" class:tom={d.exercises.length === 0}>
							<span class="at-dag-nr">Dag {i + 1}</span>
							<span class="at-dag-tekst">{dagTekst(d)}</span>
						</div>
					{/each}
				</div>
			{:else if program}
				<AdmTom tekst="Programmet har ingen dage endnu. Tryk Lav dagene automatisk." />
			{/if}
		{/if}
	</AdmSide>
{/if}

<style>
	.at-kun {
		padding: 24px 18px;
		color: var(--ink-2);
		font-size: calc(14px * var(--fs-scale, 1) * var(--adm-skala, 1));
	}

	.at-besked,
	.at-fejl {
		margin-bottom: 12px;
		padding: 11px 15px;
		border-radius: 12px;
		font-size: calc(13.5px * var(--fs-scale, 1) * var(--adm-skala, 1));
		font-weight: 600;
	}

	.at-besked {
		background: var(--sage-tint, #e7efe5);
		color: var(--sage-tekst, #46603f);
	}

	.at-fejl {
		background: var(--ler-tint, #f4e6de);
		color: var(--ler-tekst, #8a5439);
	}

	.at-faner {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 6px;
		margin-bottom: 14px;
	}

	.at-skel {
		width: 1px;
		height: 20px;
		background: var(--line, #e8dfd1);
		margin: 0 4px;
	}

	/* Baggrunden staar eksplicit, se noten i AdmKnap. */
	.at-chip {
		padding: 8px 14px;
		background: var(--paper-2, #f6f0e7);
		border: 1px solid var(--line, #e8dfd1);
		border-radius: 99px;
		color: var(--ink-2, #6f5f57);
		font-size: calc(12.5px * var(--fs-scale, 1) * var(--adm-skala, 1));
		font-family: inherit;
		font-weight: 600;
		cursor: pointer;
	}

	.at-chip.paa {
		background: var(--plum, #7c4f63);
		border-color: var(--plum, #7c4f63);
		color: #fff;
	}

	.at-h-raek {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
		flex-wrap: wrap;
	}

	.at-h {
		margin: 0;
		font-size: calc(16px * var(--fs-scale, 1) * var(--adm-skala, 1));
		font-weight: 600;
	}

	.at-meta {
		margin: 5px 0 0;
		font-size: calc(12.5px * var(--fs-scale, 1) * var(--adm-skala, 1));
		color: var(--ink-3, #a3948a);
	}

	.at-felt-raek {
		display: flex;
		gap: 10px;
		flex-wrap: wrap;
	}

	.at-felt {
		display: flex;
		flex-direction: column;
		gap: 4px;
		flex: 1 1 110px;
		margin-bottom: 10px;
	}

	.at-felt span {
		font-size: calc(10.5px * var(--fs-scale, 1) * var(--adm-skala, 1));
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--ink-3, #a3948a);
	}

	.at-felt input {
		padding: 11px 13px;
		background: var(--paper, #fbf8f2);
		border: 1px solid var(--line, #e8dfd1);
		border-radius: 11px;
		color: var(--espresso, #382c2a);
		font-size: calc(14px * var(--fs-scale, 1) * var(--adm-skala, 1));
		font-family: inherit;
		box-sizing: border-box;
	}

	.at-hint {
		margin: 2px 0 12px;
		font-size: calc(11.5px * var(--fs-scale, 1) * var(--adm-skala, 1));
		color: var(--ink-3, #a3948a);
		line-height: 1.45;
	}

	.at-advarsel {
		margin-bottom: 11px;
		padding: 11px 14px;
		background: var(--ler-tint, #f4e6de);
		border-radius: 11px;
		color: var(--ler-tekst, #8a5439);
		font-size: calc(12.5px * var(--fs-scale, 1) * var(--adm-skala, 1));
		font-weight: 600;
		line-height: 1.45;
	}

	.at-knapper {
		display: flex;
		gap: 8px;
		flex-wrap: wrap;
	}

	.at-antal {
		margin: 18px 0 8px;
		font-size: calc(11.5px * var(--fs-scale, 1) * var(--adm-skala, 1));
		font-weight: 700;
		letter-spacing: 0.13em;
		text-transform: uppercase;
		color: var(--ink-3, #a3948a);
	}

	/* FLERE SOEJLER NAAR DER ER PLADS. Én lang stribe paa en bred skaerm
	   betoed, at man saa faa ad gangen og resten var tom plads til
	   hoejre. Paa en smal skaerm bliver det én soejle igen af sig selv. */
	.at-liste {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
		gap: 4px;
		align-content: start;
	}

	.at-dag {
		display: flex;
		gap: 12px;
		padding: 10px 14px;
		background: var(--paper-2, #f6f0e7);
		border-radius: 11px;
		font-size: calc(12.5px * var(--fs-scale, 1) * var(--adm-skala, 1));
	}

	.at-dag.tom {
		background: var(--ler-tint, #f4e6de);
		color: var(--ler-tekst, #8a5439);
	}

	.at-dag-nr {
		flex-shrink: 0;
		width: 58px;
		font-weight: 600;
		color: var(--espresso, #382c2a);
	}

	.at-dag.tom .at-dag-nr {
		color: var(--ler-tekst, #8a5439);
	}

	.at-dag-tekst {
		min-width: 0;
		color: var(--ink-2, #6f5f57);
	}

	.at-dag.tom .at-dag-tekst {
		color: var(--ler-tekst, #8a5439);
	}
</style>
