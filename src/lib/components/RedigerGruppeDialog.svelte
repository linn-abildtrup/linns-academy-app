<script lang="ts">
	// Lille bekraeft-dialog der vises naar Linn vil rette eller slette en
	// lektion/note der ligger paa flere dage. Hun vaelger om aendringen skal
	// gaelde alle dage i gruppen eller kun den aktuelle dag.
	interface Props {
		titel: string;
		beskrivelse: string;
		antalDage: number;
		alleLabel?: string;
		denneLabel?: string;
		erFarlig?: boolean;
		onAlle: () => void;
		onDenne: () => void;
		onAnnuller: () => void;
	}

	let {
		titel,
		beskrivelse,
		antalDage,
		alleLabel = 'Ret alle dage',
		denneLabel = 'Kun denne dag',
		erFarlig = false,
		onAlle,
		onDenne,
		onAnnuller
	}: Props = $props();
</script>

<div class="overlay" role="dialog" aria-modal="true" aria-labelledby="rg-titel">
	<div class="dialog">
		<header class="dialog-head">
			<h2 id="rg-titel">{titel}</h2>
		</header>

		<p class="beskrivelse">{beskrivelse}</p>
		<p class="meta">Denne ligger på {antalDage} dag{antalDage === 1 ? '' : 'e'}.</p>

		<div class="knap-rad">
			<button type="button" class="annuller" onclick={onAnnuller}>Annuller</button>
			<button type="button" class="denne" onclick={onDenne}>{denneLabel}</button>
			<button
				type="button"
				class="alle"
				class:farlig={erFarlig}
				onclick={onAlle}
			>
				{alleLabel}
			</button>
		</div>
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
		z-index: 1001;
	}

	.dialog {
		background: var(--white);
		border-radius: 14px;
		width: 100%;
		max-width: 420px;
		padding: 18px 18px 14px;
	}

	.dialog-head h2 {
		margin: 0 0 8px;
		font-family: var(--ff-d);
		font-size: calc(18px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--text);
	}

	.beskrivelse {
		font-size: calc(13.5px * var(--fs-scale, 1));
		color: var(--text2);
		line-height: 1.5;
		margin: 0 0 4px;
	}

	.meta {
		font-size: calc(12px * var(--fs-scale, 1));
		color: var(--text3);
		margin: 0 0 14px;
	}

	.knap-rad {
		display: flex;
		gap: 8px;
		justify-content: flex-end;
		flex-wrap: wrap;
	}

	.annuller,
	.denne,
	.alle {
		padding: 10px 14px;
		font-family: var(--ff-b);
		font-size: calc(13px * var(--fs-scale, 1));
		font-weight: 600;
		border-radius: 10px;
		cursor: pointer;
		touch-action: manipulation;
		border: 1px solid var(--border);
	}

	.annuller {
		background: var(--white);
		color: var(--text2);
	}

	.denne {
		background: var(--bg2);
		color: var(--text);
		border-color: var(--border2);
	}

	.alle {
		background: var(--terra);
		color: var(--white);
		border-color: var(--terra);
	}

	.alle.farlig {
		background: #b8453a;
		border-color: #b8453a;
	}
</style>
