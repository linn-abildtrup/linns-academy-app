<script lang="ts">
	// Step-baseret wizard der hjælper klienten med at beregne anbefalede
	// daglige næringsmål ud fra højde, vægt, alder, aktivitet og
	// menopausal status. Bruger Mifflin-St Jeor + standard makrofordeling
	// for kvinder i overgangsalderen (1.5-1.6 g/kg protein, 30% fedt-andel,
	// minimum 1.200 kcal).
	import { onDestroy, onMount, untrack } from 'svelte';
	import type {
		Aktivitetsniveau,
		BrugerProfil,
		DagligeMaal,
		MenopausalStatus
	} from '$lib/types';
	import {
		AKTIVITETS_BESKRIVELSER,
		AKTIVITETS_LABELS,
		MENOPAUS_BESKRIVELSER,
		MENOPAUS_LABELS,
		NAERING_ENHEDER,
		NAERING_LABELS,
		beregnDagligeMaal
	} from '$lib/content/naering';
	import Icon from '$lib/components/Icon.svelte';

	interface Props {
		startProfil?: BrugerProfil;
		onBrugMaal: (profil: BrugerProfil, maal: DagligeMaal) => void;
		onClose: () => void;
	}

	let { startProfil, onBrugMaal, onClose }: Props = $props();

	// Wizard-state
	type Step = 'hojde' | 'vaegt' | 'alder' | 'aktivitet' | 'menopaus' | 'resultat';
	const STEPS: Step[] = ['hojde', 'vaegt', 'alder', 'aktivitet', 'menopaus', 'resultat'];
	let stepIndex = $state(0);
	const aktivStep = $derived(STEPS[stepIndex]);

	// Pre-udfyld med eksisterende profil hvis der er en, ellers brugbare defaults
	let hojde = $state<number>(untrack(() => startProfil?.hojde ?? 165));
	let vaegt = $state<number>(untrack(() => startProfil?.vaegt ?? 70));
	let alder = $state<number>(untrack(() => startProfil?.alder ?? 50));
	let aktivitet = $state<Aktivitetsniveau>(
		untrack(() => startProfil?.aktivitet ?? 'let')
	);
	let menopaus = $state<MenopausalStatus>(
		untrack(() => startProfil?.menopaus ?? 'perimenopause')
	);

	const profil = $derived<BrugerProfil>({ hojde, vaegt, alder, aktivitet, menopaus });
	const beregnetMaal = $derived<DagligeMaal>(beregnDagligeMaal(profil));

	const AKTIVITETER: Aktivitetsniveau[] = ['stille', 'let', 'moderat', 'meget'];
	const MENOPAUSER: MenopausalStatus[] = [
		'praemenopause',
		'perimenopause',
		'postmenopause'
	];
	const RESULTAT_FELTER: (keyof DagligeMaal)[] = [
		'kcal',
		'protein',
		'kh',
		'fedt',
		'fiber'
	];

	function naeste() {
		if (stepIndex < STEPS.length - 1) stepIndex++;
	}
	function tilbage() {
		if (stepIndex > 0) stepIndex--;
	}

	const kanGaaVidere = $derived(
		(aktivStep === 'hojde' && hojde >= 100 && hojde <= 220) ||
			(aktivStep === 'vaegt' && vaegt >= 30 && vaegt <= 200) ||
			(aktivStep === 'alder' && alder >= 18 && alder <= 100) ||
			aktivStep === 'aktivitet' ||
			aktivStep === 'menopaus' ||
			aktivStep === 'resultat'
	);

	function brugMaal() {
		onBrugMaal(profil, beregnetMaal);
	}

	function portalToBody(node: HTMLElement) {
		document.body.appendChild(node);
		return {
			destroy() {
				if (node.parentNode === document.body) {
					document.body.removeChild(node);
				}
			}
		};
	}

	onMount(() => {
		const original = document.body.style.overflow;
		document.body.style.overflow = 'hidden';
		return () => {
			document.body.style.overflow = original;
		};
	});

	onDestroy(() => {
		if (typeof document !== 'undefined') {
			document.body.style.overflow = '';
		}
	});
</script>

<div class="bag" use:portalToBody>
	<div class="modal" role="dialog" aria-modal="true">
		<header class="head">
			<button class="luk" type="button" onclick={onClose} aria-label="Luk">×</button>
			<div class="progress-rad">
				{#each STEPS.slice(0, -1) as _, i (i)}
					<div class="progress-prik" class:naet={i <= stepIndex} class:aktiv={i === stepIndex}></div>
				{/each}
			</div>
			<div class="head-spacer"></div>
		</header>

		<div class="body">
			{#if aktivStep === 'hojde'}
				<div class="step">
					<div class="step-eyebrow">Step 1 af 5</div>
					<h2>Hvor høj er du?</h2>
					<p class="step-sub">Bruges til at beregne dit basisstofskifte.</p>
					<label class="big-input-rad">
						<input
							type="number"
							bind:value={hojde}
							min="100"
							max="220"
							step="1"
							inputmode="numeric"
						/>
						<span class="big-enhed">cm</span>
					</label>
				</div>
			{:else if aktivStep === 'vaegt'}
				<div class="step">
					<div class="step-eyebrow">Step 2 af 5</div>
					<h2>Hvad vejer du?</h2>
					<p class="step-sub">Bruges til at beregne kalorier og proteinbehov.</p>
					<label class="big-input-rad">
						<input
							type="number"
							bind:value={vaegt}
							min="30"
							max="200"
							step="0.5"
							inputmode="decimal"
						/>
						<span class="big-enhed">kg</span>
					</label>
				</div>
			{:else if aktivStep === 'alder'}
				<div class="step">
					<div class="step-eyebrow">Step 3 af 5</div>
					<h2>Hvor gammel er du?</h2>
					<p class="step-sub">Stofskiftet falder lidt med alderen — vi tager højde for det.</p>
					<label class="big-input-rad">
						<input
							type="number"
							bind:value={alder}
							min="18"
							max="100"
							step="1"
							inputmode="numeric"
						/>
						<span class="big-enhed">år</span>
					</label>
				</div>
			{:else if aktivStep === 'aktivitet'}
				<div class="step">
					<div class="step-eyebrow">Step 4 af 5</div>
					<h2>Hvor aktiv er du?</h2>
					<p class="step-sub">Vælg det niveau der passer bedst til en typisk uge.</p>
					<div class="valg-liste">
						{#each AKTIVITETER as a (a)}
							<button
								type="button"
								class="valg-knap"
								class:aktiv={aktivitet === a}
								onclick={() => (aktivitet = a)}
							>
								<span class="valg-titel">{AKTIVITETS_LABELS[a]}</span>
								<span class="valg-sub">{AKTIVITETS_BESKRIVELSER[a]}</span>
							</button>
						{/each}
					</div>
				</div>
			{:else if aktivStep === 'menopaus'}
				<div class="step">
					<div class="step-eyebrow">Step 5 af 5</div>
					<h2>Hvor er du i din overgangsalder?</h2>
					<p class="step-sub">Proteinbehovet er lidt højere efter menopause.</p>
					<div class="valg-liste">
						{#each MENOPAUSER as m (m)}
							<button
								type="button"
								class="valg-knap"
								class:aktiv={menopaus === m}
								onclick={() => (menopaus = m)}
							>
								<span class="valg-titel">{MENOPAUS_LABELS[m]}</span>
								<span class="valg-sub">{MENOPAUS_BESKRIVELSER[m]}</span>
							</button>
						{/each}
					</div>
				</div>
			{:else}
				<div class="step">
					<div class="step-eyebrow">Resultat</div>
					<h2>Dine anbefalede daglige mål</h2>
					<p class="step-sub">
						Baseret på Mifflin-St Jeor-formlen og anbefalinger for kvinder i overgangsalderen.
					</p>

					<div class="resultat-liste">
						{#each RESULTAT_FELTER as f (f)}
							<div class="resultat-rad">
								<span class="resultat-lbl">{NAERING_LABELS[f]}</span>
								<span class="resultat-val">
									{beregnetMaal[f]} <span class="resultat-enhed">{NAERING_ENHEDER[f]}</span>
								</span>
							</div>
						{/each}
					</div>

					<div class="disclaimer">
						<Icon name="quiz" size={14} color="var(--text3)" />
						<p>
							Dette er et generelt udgangspunkt baseret på etablerede formler. Dine præcise behov
							afhænger af din individuelle sundhed — tal med din læge eller kostvejleder ved tvivl,
							særligt hvis du har en eksisterende sygdom eller spiseforstyrrelse.
						</p>
					</div>
				</div>
			{/if}
		</div>

		<footer class="foot">
			{#if stepIndex > 0}
				<button class="ghost" type="button" onclick={tilbage}>Tilbage</button>
			{:else}
				<button class="ghost" type="button" onclick={onClose}>Annullér</button>
			{/if}
			{#if aktivStep === 'resultat'}
				<button class="primary" type="button" onclick={brugMaal}>Brug disse mål</button>
			{:else}
				<button class="primary" type="button" onclick={naeste} disabled={!kanGaaVidere}>
					Næste
				</button>
			{/if}
		</footer>
	</div>
</div>

<style>
	.bag {
		position: fixed;
		inset: 0;
		z-index: 700;
		background: rgba(42, 31, 23, 0.55);
		display: flex;
		align-items: flex-end;
		justify-content: center;
	}

	.modal {
		background: var(--white);
		width: 100%;
		max-width: 520px;
		max-height: 92dvh;
		border-radius: 18px 18px 0 0;
		display: flex;
		flex-direction: column;
		overflow: hidden;
		box-shadow: 0 -8px 24px rgba(0, 0, 0, 0.18);
	}

	.head {
		display: grid;
		grid-template-columns: 32px 1fr 32px;
		align-items: center;
		padding: 14px 18px 6px;
		gap: 10px;
		flex-shrink: 0;
	}

	.luk {
		width: 32px;
		height: 32px;
		border-radius: 50%;
		background: var(--bg2);
		border: none;
		color: var(--text2);
		font-size: calc(20px * var(--fs-scale, 1));
		cursor: pointer;
	}

	.head-spacer {
		width: 32px;
		height: 32px;
	}

	.progress-rad {
		display: flex;
		gap: 5px;
		justify-content: center;
		align-items: center;
	}

	.progress-prik {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: var(--border);
		transition: background 0.18s ease;
	}

	.progress-prik.naet {
		background: var(--terra);
	}

	.progress-prik.aktiv {
		width: 24px;
		border-radius: 99px;
	}

	.body {
		padding: 12px 22px 18px;
		overflow-y: auto;
		overscroll-behavior: contain;
		flex: 1;
		min-height: 0;
	}

	.step-eyebrow {
		font-size: calc(10px * var(--fs-scale, 1));
		font-weight: 600;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--text3);
	}

	h2 {
		font-family: var(--ff-d);
		font-size: calc(24px * var(--fs-scale, 1));
		font-weight: 500;
		letter-spacing: -0.01em;
		color: var(--text);
		margin: 6px 0 6px;
		line-height: 1.15;
	}

	.step-sub {
		font-size: calc(13px * var(--fs-scale, 1));
		color: var(--text2);
		line-height: 1.5;
		margin: 0 0 22px;
	}

	.big-input-rad {
		display: flex;
		align-items: baseline;
		justify-content: center;
		gap: 8px;
		padding: 18px 16px;
		background: var(--bg2);
		border: 1px solid var(--border);
		border-radius: 14px;
	}

	.big-input-rad:focus-within {
		border-color: var(--terra);
	}

	.big-input-rad input {
		font-family: var(--ff-d);
		font-size: calc(48px * var(--fs-scale, 1));
		font-weight: 500;
		color: var(--text);
		background: transparent;
		border: none;
		outline: none;
		text-align: center;
		width: 130px;
		-moz-appearance: textfield;
		appearance: textfield;
	}

	.big-input-rad input::-webkit-outer-spin-button,
	.big-input-rad input::-webkit-inner-spin-button {
		-webkit-appearance: none;
		margin: 0;
	}

	.big-enhed {
		font-family: var(--ff-d);
		font-style: italic;
		font-size: calc(20px * var(--fs-scale, 1));
		color: var(--text3);
	}

	.valg-liste {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.valg-knap {
		display: flex;
		flex-direction: column;
		gap: 4px;
		padding: 13px 16px;
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 12px;
		cursor: pointer;
		text-align: left;
		font-family: var(--ff-b);
	}

	.valg-knap.aktiv {
		border-color: var(--terra);
		background: var(--tdim);
	}

	.valg-titel {
		font-size: calc(14px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--text);
	}

	.valg-sub {
		font-size: calc(12px * var(--fs-scale, 1));
		color: var(--text3);
		line-height: 1.4;
	}

	.resultat-liste {
		display: flex;
		flex-direction: column;
		gap: 6px;
		background: var(--bg2);
		border: 1px solid var(--border);
		border-radius: 12px;
		padding: 14px 18px;
		margin-bottom: 18px;
	}

	.resultat-rad {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 12px;
		padding: 6px 0;
	}

	.resultat-rad + .resultat-rad {
		border-top: 1px solid var(--border);
	}

	.resultat-lbl {
		font-size: calc(13px * var(--fs-scale, 1));
		color: var(--text);
		font-weight: 500;
	}

	.resultat-val {
		font-family: var(--ff-d);
		font-size: calc(22px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--terra);
	}

	.resultat-enhed {
		font-family: var(--ff-b);
		font-size: calc(11px * var(--fs-scale, 1));
		color: var(--text3);
		font-weight: 500;
	}

	.disclaimer {
		display: flex;
		align-items: flex-start;
		gap: 8px;
		padding: 12px 14px;
		background: var(--header);
		border-left: 3px solid var(--terra);
		border-radius: 0 8px 8px 0;
	}

	.disclaimer p {
		font-size: calc(11.5px * var(--fs-scale, 1));
		color: var(--text2);
		line-height: 1.5;
		margin: 0;
	}

	.foot {
		flex-shrink: 0;
		padding: 12px 18px calc(14px + env(safe-area-inset-bottom));
		display: flex;
		gap: 10px;
		border-top: 1px solid var(--border);
	}

	.ghost,
	.primary {
		flex: 1;
		padding: 12px;
		font-family: var(--ff-b);
		font-size: calc(14px * var(--fs-scale, 1));
		font-weight: 600;
		border-radius: 12px;
		cursor: pointer;
	}

	.ghost {
		background: transparent;
		color: var(--text2);
		border: 1px solid var(--border);
	}

	.primary {
		background: var(--terra);
		color: #fff;
		border: none;
	}

	.primary:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
</style>
