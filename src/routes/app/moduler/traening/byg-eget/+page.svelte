<script lang="ts">
	import { getContext, onMount } from 'svelte';
	import type { User } from 'firebase/auth';
	import { goto } from '$app/navigation';
	import Icon from '$lib/components/Icon.svelte';
	import { hentAlleExercises } from '$lib/firestore/mikrotraening';
	import {
		filtrerOvelserTilProgram,
		genererProgramMedConfig,
		type Exercise
	} from '$lib/content/mikrotraening';
	import { hentMineProgrammer, opretMitProgram } from '$lib/firestore/mineProgrammer';
	import {
		anslaaetVarighedMinutter,
		anslaaetDagVarighedMin,
		type CustomProgram,
		type CustomProgramConfig
	} from '$lib/content/mineProgrammer';

	const getUser = getContext<() => User | null>('user');
	const user = $derived(getUser());

	let programmer = $state<CustomProgram[]>([]);
	let alleOevelser = $state<Exercise[]>([]);
	let indlaeser = $state(true);
	let fejl = $state<string | null>(null);

	// 14-dages auto-byg modal
	let viserAutoModal = $state(false);
	let autoUdstyr = $state<'ingen' | 'kettlebell'>('ingen');
	let autoAntalOvelser = $state(4);
	let autoSaet = $state(3);
	let autoArbejdsSec = $state(30);
	let autoPauseSec = $state(15);
	let autoArbejder = $state(false);
	let autoFejl = $state<string | null>(null);

	onMount(async () => {
		if (!user) return;
		try {
			[programmer, alleOevelser] = await Promise.all([
				hentMineProgrammer(user.uid),
				hentAlleExercises()
			]);
		} catch (e) {
			console.error(e);
			fejl = 'Kunne ikke hente dine programmer.';
		} finally {
			indlaeser = false;
		}
	});

	function aabnAutoModal() {
		autoUdstyr = 'ingen';
		autoAntalOvelser = 4;
		autoSaet = 3;
		autoArbejdsSec = 30;
		autoPauseSec = 15;
		autoFejl = null;
		viserAutoModal = true;
	}

	function lukAutoModal() {
		if (autoArbejder) return;
		viserAutoModal = false;
	}

	async function genererAutoProgram() {
		const u = user;
		if (!u || autoArbejder) return;
		autoArbejder = true;
		autoFejl = null;
		try {
			const config: CustomProgramConfig = {
				antalDage: 14,
				antalOevelser: autoAntalOvelser,
				saet: autoSaet,
				arbejdsSec: autoArbejdsSec,
				pauseSec: autoPauseSec,
				udstyr: autoUdstyr
			};
			const filtrerede = filtrerOvelserTilProgram(alleOevelser, [autoUdstyr]);
			if (filtrerede.length === 0) {
				throw new Error('Ingen øvelser fundet for det valgte udstyr.');
			}
			// genererProgramMedConfig giver TrainingDay[] med samme datamodel
			// som vi bruger her (dagNummer + exercises). Vi mapper exercises
			// til CustomProgramOevelse.
			const dageRaa = genererProgramMedConfig(config.antalDage, filtrerede, {
				antalOvelser: config.antalOevelser,
				sets: config.saet,
				workSec: config.arbejdsSec,
				restSec: config.pauseSec
			});
			const dage = dageRaa.map((d) => ({
				dagNummer: d.dagNummer,
				oevelser: d.exercises.map((e) => ({
					exerciseId: e.exerciseId,
					saet: e.sets,
					arbejdsSec: e.workSec,
					pauseSec: e.restSec
				}))
			}));
			const ny = await opretMitProgram(u.uid, {
				navn: `Mit ${config.antalDage}-dages program${autoUdstyr === 'kettlebell' ? ' (kettlebell)' : ''}`,
				oevelser: [],
				dage,
				config
			});
			viserAutoModal = false;
			if (ny.id) goto(`/app/moduler/traening/byg-eget/${ny.id}`);
		} catch (e) {
			console.error(e);
			autoFejl = e instanceof Error ? e.message : 'Kunne ikke generere programmet.';
		} finally {
			autoArbejder = false;
		}
	}

	function programVarighed(p: CustomProgram): string {
		if (p.dage && p.dage.length > 0) {
			const dagMin = anslaaetDagVarighedMin(p.dage[0]);
			return `${p.dage.length} dage · ca. ${dagMin} min pr dag`;
		}
		return `${p.oevelser.length} øvelser · ca. ${anslaaetVarighedMinutter(p)} min`;
	}
</script>

<div class="page">
	<header class="page-header">
		<a class="back" href="/app/moduler/traening">
			<Icon name="arrow-l" size={14} color="var(--text2)" />
			<span>Træning</span>
		</a>
		<div class="eyebrow">Custom-builder</div>
		<h1>Mine programmer</h1>
		<p class="page-sub">
			Programmer du selv har bygget — vælg øvelser, sæt, reps og pause.
		</p>
	</header>

	{#if fejl}
		<div class="besked fejl">{fejl}</div>
	{:else if indlaeser}
		<div class="besked">Henter dine programmer…</div>
	{:else}
		{#if programmer.length === 0}
			<div class="tom-tilstand">
				<div class="tom-titel">Endnu ingen programmer</div>
				<p>Lav et 14-dages program på få sekunder — eller byg dit eget.</p>
			</div>
		{:else}
			<div class="liste">
				{#each programmer as p (p.id)}
					<a class="rad" href={`/app/moduler/traening/byg-eget/${p.id}`}>
						<div class="rad-icon">
							<Icon name="flame" size={18} color="#fff" />
						</div>
						<div class="rad-tekst">
							<div class="rad-navn">{p.navn}</div>
							<div class="rad-sub">{programVarighed(p)}</div>
						</div>
						<Icon name="chevron-r" size={14} color="var(--text3)" />
					</a>
				{/each}
			</div>
		{/if}

		<button type="button" class="primary-link" onclick={aabnAutoModal}>
			<Icon name="sparkle" size={16} color="#fff" />
			<span>Lav 14-dages program</span>
		</button>

		<a class="ghost-link" href="/app/moduler/traening/byg-eget/nyt">
			<Icon name="flame" size={14} color="var(--terra)" />
			<span>Byg ét sæt øvelser selv</span>
		</a>
	{/if}
</div>

{#if viserAutoModal}
	<div
		class="modal-bag"
		role="dialog"
		aria-modal="true"
		tabindex="-1"
		onclick={(e) => {
			if (e.target === e.currentTarget) lukAutoModal();
		}}
		onkeydown={(e) => {
			if (e.key === 'Escape') lukAutoModal();
		}}
	>
		<div class="auto-modal">
			<div class="modal-head">
				<h2>14-dages program</h2>
				<button class="modal-luk" type="button" onclick={lukAutoModal} aria-label="Luk">×</button>
			</div>
			<p class="auto-intro">
				Vi bygger automatisk 14 dage med forskellige øvelser. Du vælger udstyr og
				hvor hård træningen skal være — så er du i gang.
			</p>

			<div class="felt">
				<div class="felt-label">Udstyr</div>
				<div class="udstyr-rad">
					<button
						type="button"
						class="udstyr-knap"
						class:aktiv={autoUdstyr === 'ingen'}
						onclick={() => (autoUdstyr = 'ingen')}
					>
						Ingen udstyr
					</button>
					<button
						type="button"
						class="udstyr-knap"
						class:aktiv={autoUdstyr === 'kettlebell'}
						onclick={() => (autoUdstyr = 'kettlebell')}
					>
						Kettlebell
					</button>
				</div>
			</div>

			<div class="config-grid">
				<label class="felt">
					<span class="felt-label">Øvelser pr dag</span>
					<input type="number" bind:value={autoAntalOvelser} min="2" max="6" step="1" />
				</label>
				<label class="felt">
					<span class="felt-label">Sæt pr øvelse</span>
					<input type="number" bind:value={autoSaet} min="1" max="6" step="1" />
				</label>
				<label class="felt">
					<span class="felt-label">Arbejde (sek)</span>
					<input type="number" bind:value={autoArbejdsSec} min="10" max="120" step="5" />
				</label>
				<label class="felt">
					<span class="felt-label">Pause (sek)</span>
					<input type="number" bind:value={autoPauseSec} min="0" max="60" step="5" />
				</label>
			</div>

			{#if autoFejl}
				<div class="besked fejl">{autoFejl}</div>
			{/if}

			<button
				type="button"
				class="primary-knap auto-gen-knap"
				onclick={() => void genererAutoProgram()}
				disabled={autoArbejder}
			>
				{autoArbejder ? 'Bygger…' : '✨ Generer 14-dages program'}
			</button>
		</div>
	</div>
{/if}

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

	.besked {
		padding: 14px 16px;
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 12px;
		color: var(--text2);
		font-size: calc(13px * var(--fs-scale, 1));
		text-align: center;
		margin-bottom: 14px;
	}

	.besked.fejl {
		color: #8a4a3e;
		background: #fbeeea;
		border-color: #f0d6cf;
	}

	.tom-tilstand {
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 14px;
		padding: 20px;
		text-align: center;
		margin-bottom: 14px;
	}

	.tom-titel {
		font-family: var(--ff-d);
		font-size: calc(17px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--text);
		margin-bottom: 6px;
	}

	.tom-tilstand p {
		font-size: calc(13px * var(--fs-scale, 1));
		color: var(--text2);
		margin: 0;
	}

	.liste {
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 14px;
		overflow: hidden;
		margin-bottom: 14px;
	}

	.rad {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 14px;
		border-top: 1px solid var(--border);
		text-decoration: none;
		color: inherit;
	}

	.rad:first-child {
		border-top: none;
	}

	.rad:hover {
		background: var(--bg2);
	}

	.rad-icon {
		width: 40px;
		height: 40px;
		border-radius: 11px;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		background: #b87b6e;
	}

	.rad-tekst {
		flex: 1;
		min-width: 0;
	}

	.rad-navn {
		font-size: calc(14px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--text);
	}

	.rad-sub {
		font-size: calc(11.5px * var(--fs-scale, 1));
		color: var(--text3);
		margin-top: 2px;
	}

	.primary-link {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		width: 100%;
		padding: 14px;
		background: var(--terra);
		color: white;
		border-radius: 12px;
		text-decoration: none;
		font-size: calc(14px * var(--fs-scale, 1));
		font-weight: 600;
		font-family: var(--ff-b);
		box-sizing: border-box;
		border: none;
		cursor: pointer;
		margin-top: 10px;
	}

	.primary-link:hover {
		opacity: 0.92;
	}

	.ghost-link {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		width: 100%;
		padding: 11px;
		background: transparent;
		color: var(--text2);
		border: 1px solid var(--border);
		border-radius: 12px;
		text-decoration: none;
		font-size: calc(12.5px * var(--fs-scale, 1));
		font-weight: 500;
		font-family: var(--ff-b);
		box-sizing: border-box;
		margin-top: 8px;
	}

	.ghost-link:hover {
		border-color: var(--terra);
		color: var(--terra);
	}

	/* Auto-byg modal */
	.modal-bag {
		position: fixed;
		inset: 0;
		background: rgba(42, 31, 23, 0.55);
		display: flex;
		align-items: flex-end;
		justify-content: center;
		z-index: 100;
	}

	@media (min-width: 600px) {
		.modal-bag {
			align-items: center;
		}
	}

	.auto-modal {
		background: var(--bg, #f6f3ee);
		width: 100%;
		max-width: 520px;
		max-height: 92dvh;
		border-radius: 18px 18px 0 0;
		padding: 18px 18px calc(18px + env(safe-area-inset-bottom));
		display: flex;
		flex-direction: column;
		gap: 14px;
		overflow-y: auto;
	}

	@media (min-width: 600px) {
		.auto-modal {
			border-radius: 18px;
		}
	}

	.modal-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.modal-head h2 {
		font-family: var(--ff-d);
		font-size: calc(20px * var(--fs-scale, 1));
		font-weight: 600;
		margin: 0;
		color: var(--text);
	}

	.modal-luk {
		background: none;
		border: none;
		font-size: 26px;
		color: var(--text3);
		cursor: pointer;
		line-height: 1;
		padding: 4px 8px;
	}

	.auto-intro {
		font-size: calc(13px * var(--fs-scale, 1));
		color: var(--text2);
		margin: 0;
		line-height: 1.5;
	}

	.felt {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.felt-label {
		font-size: calc(11px * var(--fs-scale, 1));
		font-weight: 600;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--text3);
	}

	.udstyr-rad {
		display: flex;
		gap: 8px;
	}

	.udstyr-knap {
		flex: 1;
		padding: 12px;
		border: 1px solid var(--border);
		background: var(--white);
		color: var(--text2);
		border-radius: 10px;
		font-family: var(--ff-b);
		font-size: calc(14px * var(--fs-scale, 1));
		font-weight: 600;
		cursor: pointer;
	}

	.udstyr-knap.aktiv {
		background: var(--terra);
		border-color: var(--terra);
		color: #fff;
	}

	.config-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 8px;
	}

	.config-grid input {
		padding: 9px 11px;
		border: 1px solid var(--border);
		border-radius: 8px;
		background: var(--white);
		font-family: var(--ff-b);
		font-size: max(16px, calc(14px * var(--fs-scale, 1)));
		color: var(--text);
		outline: none;
		width: 100%;
		box-sizing: border-box;
	}

	.config-grid input:focus {
		border-color: var(--terra);
	}

	.primary-knap {
		display: block;
		width: 100%;
		padding: 13px;
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

	.auto-gen-knap {
		margin-top: 4px;
	}

	.besked.fejl {
		padding: 10px 12px;
		background: #fbeeea;
		border: 1px solid #f0d6cf;
		border-radius: 8px;
		font-size: calc(12px * var(--fs-scale, 1));
		color: #8a4a3e;
	}
</style>
