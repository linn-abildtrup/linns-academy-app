<script lang="ts">
	// Modal hvor admin vaelger hvilke dage en lektion (eller note) skal vises paa.
	// Viser 'Dag X · DD. md ÅÅÅÅ' for hver dag i forloebet plus genveje:
	// Alle dage, alle ugedage (Mandage osv), uge X, naeste X dage.
	import {
		datoForDag,
		formatKortDato,
		ugeForDag,
		UGEDAG_LABELS
	} from '$lib/content/forlob';

	interface Props {
		startDato: string;
		antalDage: number;
		nuvaerendeDag: number;
		valgteDageStart: number[];
		titel?: string;
		onGem: (dage: number[]) => void;
		onAnnuller: () => void;
	}

	let {
		startDato,
		antalDage,
		nuvaerendeDag,
		valgteDageStart,
		titel = 'Vis også på dage',
		onGem,
		onAnnuller
	}: Props = $props();

	let valgte = $state<Set<number>>(new Set());
	$effect(() => {
		valgte = new Set(valgteDageStart);
	});

	const alleDageInfo = $derived.by(() => {
		const ud: { dagNummer: number; dato: Date; ugedag: number; uge: number }[] = [];
		for (let i = 0; i <= antalDage; i++) {
			const dato = datoForDag(startDato, i);
			ud.push({
				dagNummer: i,
				dato,
				ugedag: dato.getDay(),
				uge: ugeForDag(i)
			});
		}
		return ud;
	});

	const antalUger = $derived(Math.max(1, Math.ceil(antalDage / 7)));

	function toggle(dagNummer: number) {
		const ny = new Set(valgte);
		if (ny.has(dagNummer)) ny.delete(dagNummer);
		else ny.add(dagNummer);
		valgte = ny;
	}

	function vaelgAlle() {
		valgte = new Set(alleDageInfo.map((d) => d.dagNummer));
	}

	function ryd() {
		valgte = new Set();
	}

	function vaelgUgedag(ugedag: number) {
		const ny = new Set(valgte);
		for (const d of alleDageInfo) {
			if (d.ugedag === ugedag) ny.add(d.dagNummer);
		}
		valgte = ny;
	}

	function vaelgUge(uge: number) {
		const ny = new Set(valgte);
		for (const d of alleDageInfo) {
			if (d.uge === uge) ny.add(d.dagNummer);
		}
		valgte = ny;
	}

	function vaelgNaesteX(antal: number) {
		const ny = new Set(valgte);
		for (let i = nuvaerendeDag; i <= Math.min(antalDage, nuvaerendeDag + antal - 1); i++) {
			ny.add(i);
		}
		valgte = ny;
	}

	function gem() {
		const liste = [...valgte].sort((a, b) => a - b);
		onGem(liste);
	}

	function ugedagsKortLabel(i: number): string {
		return UGEDAG_LABELS[i].slice(0, 3);
	}
</script>

<div class="overlay" role="dialog" aria-modal="true" aria-labelledby="vd-titel">
	<div class="dialog">
		<header class="dialog-head">
			<h2 id="vd-titel">{titel}</h2>
			<button type="button" class="luk" onclick={onAnnuller} aria-label="Luk">×</button>
		</header>

		<div class="genveje">
			<div class="genvej-label">Genveje</div>
			<div class="genvej-rad">
				<button type="button" class="genvej-knap" onclick={vaelgAlle}>Alle dage</button>
				<button type="button" class="genvej-knap" onclick={() => vaelgNaesteX(7)}>
					Næste 7 dage
				</button>
				<button type="button" class="genvej-knap" onclick={() => vaelgNaesteX(14)}>
					Næste 14 dage
				</button>
				<button type="button" class="genvej-knap genvej-ryd" onclick={ryd}>Ryd</button>
			</div>
			<div class="genvej-label">Ugedage</div>
			<div class="genvej-rad">
				{#each [1, 2, 3, 4, 5, 6, 0] as ud (ud)}
					<button
						type="button"
						class="genvej-knap genvej-chip"
						onclick={() => vaelgUgedag(ud)}
					>
						Alle {ugedagsKortLabel(ud).toLowerCase()}.
					</button>
				{/each}
			</div>
			<div class="genvej-label">Uger</div>
			<div class="genvej-rad">
				{#each Array(antalUger) as _, i (i)}
					<button
						type="button"
						class="genvej-knap genvej-chip"
						onclick={() => vaelgUge(i + 1)}
					>
						Uge {i + 1}
					</button>
				{/each}
			</div>
		</div>

		<div class="dage-liste">
			{#each alleDageInfo as d (d.dagNummer)}
				{@const checked = valgte.has(d.dagNummer)}
				<label class="dag-row" class:checked>
					<input
						type="checkbox"
						{checked}
						onchange={() => toggle(d.dagNummer)}
					/>
					<span class="dag-num">{d.dagNummer === 0 ? 'Baseline' : `Dag ${d.dagNummer}`}</span>
					<span class="dag-dato">{formatKortDato(d.dato)}</span>
					{#if d.dagNummer === nuvaerendeDag}
						<span class="dag-aktuel">aktuel</span>
					{/if}
				</label>
			{/each}
		</div>

		<footer class="dialog-foot">
			<div class="antal">{valgte.size} dag{valgte.size === 1 ? '' : 'e'} valgt</div>
			<div class="knap-rad">
				<button type="button" class="annuller" onclick={onAnnuller}>Annuller</button>
				<button type="button" class="gem" onclick={gem} disabled={valgte.size === 0}>
					Gem
				</button>
			</div>
		</footer>
	</div>
</div>

<style>
	.overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.45);
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 16px;
		z-index: 1000;
	}

	.dialog {
		background: var(--white);
		border-radius: 14px;
		width: 100%;
		max-width: 480px;
		max-height: calc(100vh - 32px);
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	.dialog-head {
		padding: 14px 16px;
		border-bottom: 1px solid var(--border);
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.dialog-head h2 {
		margin: 0;
		font-family: var(--ff-d);
		font-size: calc(18px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--text);
	}

	.luk {
		background: transparent;
		border: none;
		cursor: pointer;
		padding: 0 6px;
		font-size: calc(22px * var(--fs-scale, 1));
		color: var(--text2);
		line-height: 1;
		touch-action: manipulation;
	}

	.genveje {
		padding: 12px 16px;
		border-bottom: 1px solid var(--border);
		background: var(--bg2);
	}

	.genvej-label {
		font-size: calc(10px * var(--fs-scale, 1));
		font-weight: 600;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--text3);
		margin: 8px 0 6px;
	}

	.genvej-label:first-child {
		margin-top: 0;
	}

	.genvej-rad {
		display: flex;
		gap: 6px;
		flex-wrap: wrap;
	}

	.genvej-knap {
		padding: 7px 11px;
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 99px;
		font-family: var(--ff-b);
		font-size: calc(12px * var(--fs-scale, 1));
		color: var(--text2);
		cursor: pointer;
		touch-action: manipulation;
	}

	.genvej-knap:hover {
		border-color: var(--terra);
		color: var(--terra);
	}

	.genvej-ryd {
		color: var(--text3);
	}

	.dage-liste {
		flex: 1;
		overflow-y: auto;
		padding: 8px 16px 16px;
	}

	.dag-row {
		display: grid;
		grid-template-columns: 18px auto 1fr auto;
		align-items: center;
		gap: 10px;
		padding: 10px 6px;
		border-bottom: 1px solid var(--border);
		cursor: pointer;
	}

	.dag-row:last-child {
		border-bottom: none;
	}

	.dag-row.checked {
		background: var(--tdim);
		border-radius: 6px;
	}

	.dag-row input[type='checkbox'] {
		width: 18px;
		height: 18px;
		accent-color: var(--terra);
		cursor: pointer;
	}

	.dag-num {
		font-family: var(--ff-d);
		font-weight: 600;
		font-size: calc(13px * var(--fs-scale, 1));
		color: var(--text);
		min-width: 70px;
	}

	.dag-dato {
		font-size: calc(12px * var(--fs-scale, 1));
		color: var(--text2);
	}

	.dag-aktuel {
		font-size: calc(10px * var(--fs-scale, 1));
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--terra);
		background: var(--tdim);
		padding: 2px 6px;
		border-radius: 99px;
	}

	.dialog-foot {
		padding: 12px 16px;
		border-top: 1px solid var(--border);
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
	}

	.antal {
		font-size: calc(12px * var(--fs-scale, 1));
		color: var(--text3);
	}

	.knap-rad {
		display: flex;
		gap: 8px;
	}

	.annuller,
	.gem {
		padding: 9px 14px;
		font-family: var(--ff-b);
		font-size: calc(13px * var(--fs-scale, 1));
		font-weight: 600;
		border-radius: 10px;
		cursor: pointer;
		touch-action: manipulation;
	}

	.annuller {
		background: var(--white);
		border: 1px solid var(--border);
		color: var(--text2);
	}

	.gem {
		background: var(--terra);
		border: 1px solid var(--terra);
		color: var(--white);
	}

	.gem:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
</style>
