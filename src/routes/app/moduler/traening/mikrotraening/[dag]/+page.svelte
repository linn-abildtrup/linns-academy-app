<script lang="ts">
	import { getContext, onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import type { User } from 'firebase/auth';
	import type {
		Exercise,
		MikrotraeningFremgang,
		TrainingDay,
		UserProduct
	} from '$lib/content/mikrotraening';
	import { harGennemfortDag } from '$lib/content/mikrotraening';
	import {
		hentExercises,
		hentProgram,
		hentUserProduct,
		type ProgramMedDage
	} from '$lib/firestore/mikrotraening';
	import Icon from '$lib/components/Icon.svelte';
	import Loading from '$lib/components/Loading.svelte';

	const getUser = getContext<() => User | null>('user');
	const user = $derived(getUser());

	const dagNummer = $derived(parseInt(page.params.dag ?? '', 10));

	let userProduct = $state<UserProduct | null>(null);
	let programData = $state<ProgramMedDage | null>(null);
	let exerciseMap = $state<Map<string, Exercise>>(new Map());
	let loading = $state(true);
	let fejl = $state<string | null>(null);

	const fremgang = $derived<MikrotraeningFremgang>(
		(userProduct?.fremgang?.mikrotraening as MikrotraeningFremgang | undefined) ?? {
			gennemforte: [],
			feedback: {}
		}
	);
	const dag = $derived<TrainingDay | null>(
		programData?.dage.find((d) => d.dagNummer === dagNummer) ?? null
	);
	const erGennemfort = $derived(harGennemfortDag(fremgang, dagNummer));
	const antalDage = $derived(programData?.program.antalDage ?? 21);
	const harOvelser = $derived((dag?.exercises.length ?? 0) > 0);

	onMount(async () => {
		const u = user;
		if (!u) {
			fejl = 'Du skal være logget ind.';
			loading = false;
			return;
		}

		if (!Number.isFinite(dagNummer) || dagNummer < 1 || dagNummer > 21) {
			fejl = 'Ugyldigt dag-nummer.';
			loading = false;
			return;
		}

		try {
			const up = await hentUserProduct(u.uid, 'kickstart');
			if (!up) {
				fejl = 'Du har ikke adgang til mikrotræning endnu.';
				loading = false;
				return;
			}
			userProduct = up;

			const programId = up.programValg?.mikrotraening;
			if (!programId) {
				goto('/app/moduler/traening/mikrotraening/onboarding');
				return;
			}

			const data = await hentProgram(programId);
			if (!data) {
				fejl = 'Programmet kunne ikke findes.';
				loading = false;
				return;
			}
			programData = data;

			const exerciseIds = (data.dage.find((d) => d.dagNummer === dagNummer)?.exercises ?? []).map(
				(e) => e.exerciseId
			);
			if (exerciseIds.length > 0) {
				exerciseMap = await hentExercises(exerciseIds);
			}
		} catch (e) {
			fejl = 'Kunne ikke hente data. Prøv igen.';
			console.error(e);
		} finally {
			loading = false;
		}
	});
</script>

<div class="page">
	<header class="page-header">
		<a class="back" href="/app/moduler/traening/mikrotraening">
			<Icon name="arrow-l" size={14} color="var(--text2)" />
			<span>Tilbage</span>
		</a>
		<div class="eyebrow">Dag {dagNummer} af {antalDage}</div>
		<h1>Dagens øvelser</h1>
		{#if dag?.indledning}
			<p class="page-sub">{dag.indledning}</p>
		{:else}
			<p class="page-sub">Tryk på en øvelse for at se den. Tryk Start træning for at gå i gang.</p>
		{/if}
	</header>

	{#if loading}
		<Loading tekst="Henter dagens øvelser..." />
	{:else if fejl}
		<div class="status-besked fejl">{fejl}</div>
	{:else if !dag}
		<div class="status-besked fejl">Dag {dagNummer} kunne ikke findes.</div>
	{:else if !harOvelser}
		<div class="status-besked">
			Der er ikke lagt øvelser ind for denne dag endnu. Kig forbi senere.
		</div>
	{:else}
		<div class="ovelse-liste">
			{#each dag.exercises as ex, i (i)}
				{@const exercise = exerciseMap.get(ex.exerciseId)}
				<article class="ovelse-row" class:bonus={ex.bonus}>
					<div class="ovelse-num">{i + 1}</div>
					<div class="ovelse-tekst">
						<div class="ovelse-navn">
							{exercise?.name ?? ex.exerciseId}
							{#if ex.bonus}
								<span class="bonus-badge">Bonus</span>
							{/if}
						</div>
						<div class="ovelse-meta">
							{ex.sets} sæt · {ex.workSec}s arbejde · {ex.restSec}s hvile
						</div>
						{#if exercise?.catLabel}
							<div class="ovelse-cat">{exercise.catLabel}</div>
						{/if}
					</div>
				</article>
			{/each}
		</div>

		{#if erGennemfort}
			<div class="done-banner">
				<Icon name="check" size={14} color="#6f9e7e" />
				<span>Denne dag er allerede gennemført — du er velkommen til at køre den igen.</span>
			</div>
		{/if}

		<a class="start-knap" href="/app/moduler/traening/mikrotraening/{dagNummer}/spil">
			{erGennemfort ? 'Kør træningen igen' : 'Start træning'}
			<Icon name="arrow" size={14} color="#fff" />
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

	.back:hover {
		color: var(--text);
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
		font-size: 28px;
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

	.ovelse-liste {
		display: flex;
		flex-direction: column;
		gap: 8px;
		margin-bottom: 14px;
	}

	.ovelse-row {
		display: flex;
		align-items: center;
		gap: 12px;
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 12px;
		padding: 12px 14px;
	}

	.ovelse-row.bonus {
		border-color: #e5d6c8;
		background: #fdf8f2;
	}

	.ovelse-num {
		width: 28px;
		height: 28px;
		border-radius: 50%;
		background: var(--bg2);
		color: var(--text2);
		font-size: 12px;
		font-weight: 600;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.ovelse-tekst {
		flex: 1;
		min-width: 0;
	}

	.ovelse-navn {
		font-size: 14px;
		font-weight: 600;
		color: var(--text);
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.bonus-badge {
		font-size: 9px;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		background: var(--terra2);
		color: #fff;
		padding: 2px 7px;
		border-radius: 99px;
	}

	.ovelse-meta {
		font-size: 11.5px;
		color: var(--text3);
		margin-top: 2px;
	}

	.ovelse-cat {
		font-size: 10.5px;
		color: var(--text4);
		margin-top: 2px;
		letter-spacing: 0.04em;
	}

	.done-banner {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 12px 14px;
		background: #eef5ef;
		border: 1px solid #d6e6da;
		border-radius: 12px;
		font-size: 12.5px;
		color: #4a6b54;
		margin-bottom: 14px;
	}

	.start-knap {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		width: 100%;
		padding: 14px;
		background: var(--terra);
		color: #fff;
		font-size: 14px;
		font-weight: 600;
		border-radius: 12px;
		border: none;
		text-decoration: none;
		cursor: pointer;
		font-family: var(--ff-b);
	}

	.start-knap:hover {
		filter: brightness(0.95);
	}
</style>
