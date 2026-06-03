<script lang="ts">
	// Fuld-skaerm stillings-overlay for challenge. Viser top-3 podium oeverst
	// (med terra/sage/gold-farver) og en bar-graf-liste over de resterende
	// deltagere. Krydset oeverst kalder onLuk → klient er tilbage paa forsiden.
	import type { StillingRaekke } from '$lib/content/challenge';
	import { portal } from '$lib/actions/portal';

	interface Props {
		challengeNavn: string;
		raekker: StillingRaekke[];
		onLuk: () => void;
	}

	let { challengeNavn, raekker, onLuk }: Props = $props();

	const top3 = $derived(raekker.slice(0, 3));
	const restMed = $derived(raekker.slice(3));
	const maxScore = $derived(raekker[0]?.score ?? 0);
</script>

<div class="overlay" use:portal role="dialog" aria-modal="true" aria-labelledby="st-titel">
	<header class="head">
		<button type="button" class="luk" onclick={onLuk} aria-label="Luk">×</button>
		<div class="head-tekst">
			<div class="eyebrow">Stillingen</div>
			<h2 id="st-titel">{challengeNavn}</h2>
		</div>
	</header>

	{#if raekker.length === 0}
		<div class="tom">
			<p>Ingen indtastninger endnu. Vær den første til at logge en frugt eller grøntsag.</p>
		</div>
	{:else}
		{#if top3.length > 0}
			<section class="podium">
				{#if top3[1]}
					<div class="plads plads-2" class:mig={top3[1].erMig}>
						<div class="placering">2</div>
						<div class="medalje sage" aria-hidden="true">🥈</div>
						<div class="navn">{top3[1].displayNavn}</div>
						<div class="score">{top3[1].score}</div>
						<div class="podie podie-2"></div>
					</div>
				{/if}
				{#if top3[0]}
					<div class="plads plads-1" class:mig={top3[0].erMig}>
						<div class="placering">1</div>
						<div class="medalje gold" aria-hidden="true">🥇</div>
						<div class="navn">{top3[0].displayNavn}</div>
						<div class="score">{top3[0].score}</div>
						<div class="podie podie-1"></div>
					</div>
				{/if}
				{#if top3[2]}
					<div class="plads plads-3" class:mig={top3[2].erMig}>
						<div class="placering">3</div>
						<div class="medalje terra" aria-hidden="true">🥉</div>
						<div class="navn">{top3[2].displayNavn}</div>
						<div class="score">{top3[2].score}</div>
						<div class="podie podie-3"></div>
					</div>
				{/if}
			</section>
		{/if}

		{#if restMed.length > 0}
			<section class="liste">
				{#each restMed as r, i (r.uid)}
					{@const pct = maxScore > 0 ? (r.score / maxScore) * 100 : 0}
					<div class="liste-row" class:mig={r.erMig}>
						<div class="liste-placering">{i + 4}.</div>
						<div class="liste-navn">{r.displayNavn}</div>
						<div class="bar-omraade">
							<div class="bar" style="width: {pct}%"></div>
						</div>
						<div class="liste-score">{r.score}</div>
					</div>
				{/each}
			</section>
		{/if}
	{/if}
</div>

<style>
	.overlay {
		position: fixed;
		inset: 0;
		background: var(--bg);
		z-index: 2000;
		overflow-y: auto;
		padding: env(safe-area-inset-top) 0 40px;
	}

	.head {
		padding: 18px 18px 12px;
		display: flex;
		align-items: flex-start;
		gap: 12px;
	}

	.luk {
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 50%;
		width: 36px;
		height: 36px;
		font-size: calc(22px * var(--fs-scale, 1));
		color: var(--text2);
		cursor: pointer;
		line-height: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		touch-action: manipulation;
		flex-shrink: 0;
	}

	.head-tekst {
		flex: 1;
		min-width: 0;
	}

	.eyebrow {
		font-size: calc(10px * var(--fs-scale, 1));
		font-weight: 600;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--text3);
	}

	.head h2 {
		margin: 4px 0 0;
		font-family: var(--ff-d);
		font-size: calc(22px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--text);
		line-height: 1.15;
	}

	.tom {
		padding: 32px 18px;
		text-align: center;
		color: var(--text3);
		font-size: calc(13.5px * var(--fs-scale, 1));
	}

	.podium {
		display: grid;
		grid-template-columns: 1fr 1fr 1fr;
		align-items: end;
		gap: 8px;
		padding: 28px 18px 0;
	}

	.plads {
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
	}

	.plads-1 {
		order: 2;
	}

	.plads-2 {
		order: 1;
	}

	.plads-3 {
		order: 3;
	}

	.medalje {
		font-size: calc(34px * var(--fs-scale, 1));
		margin-bottom: 4px;
	}

	.placering {
		font-family: var(--ff-d);
		font-weight: 700;
		font-size: calc(11px * var(--fs-scale, 1));
		color: var(--text3);
		letter-spacing: 0.18em;
	}

	.navn {
		font-size: calc(12px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--text);
		margin-top: 2px;
		max-width: 100%;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.score {
		font-family: var(--ff-d);
		font-weight: 700;
		font-size: calc(22px * var(--fs-scale, 1));
		color: var(--text);
		margin: 2px 0 8px;
	}

	.podie {
		width: 100%;
		border-radius: 12px 12px 0 0;
		border: 1px solid var(--border);
		border-bottom: none;
	}

	.podie-1 {
		height: 88px;
		background: linear-gradient(180deg, var(--gold), #c9a07a);
	}

	.podie-2 {
		height: 64px;
		background: linear-gradient(180deg, var(--sage), #5e8c6f);
	}

	.podie-3 {
		height: 48px;
		background: linear-gradient(180deg, var(--terra), var(--terra2));
	}

	.plads.mig .podie {
		box-shadow: 0 0 0 2px var(--terra) inset;
	}

	.plads.mig .navn {
		color: var(--terra);
	}

	.liste {
		margin-top: 24px;
		padding: 0 18px;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.liste-row {
		display: grid;
		grid-template-columns: 28px minmax(80px, auto) 1fr 32px;
		align-items: center;
		gap: 10px;
		padding: 10px 12px;
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 12px;
	}

	.liste-row.mig {
		border-color: var(--terra);
		background: var(--tdim);
	}

	.liste-placering {
		font-family: var(--ff-d);
		font-weight: 700;
		color: var(--text2);
		font-size: calc(13px * var(--fs-scale, 1));
	}

	.liste-navn {
		font-size: calc(13px * var(--fs-scale, 1));
		color: var(--text);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.bar-omraade {
		height: 8px;
		background: var(--bg2);
		border-radius: 99px;
		overflow: hidden;
	}

	.bar {
		height: 100%;
		background: linear-gradient(90deg, var(--sage), var(--gold));
		border-radius: 99px;
		transition: width 220ms ease;
	}

	.liste-score {
		font-family: var(--ff-d);
		font-weight: 700;
		font-size: calc(15px * var(--fs-scale, 1));
		color: var(--terra);
		text-align: right;
	}
</style>
