<script lang="ts">
	// Loading-indikator med pseudo-progress: bar tæller lineært fra 0% til
	// 99% over `maxSekunder`. Når data ankommer fjerner kalder-siden
	// komponenten — så hurtige loadings når næsten ikke at vise procent,
	// mens langsomme loadings får brugeren til at se noget bevæger sig.
	//
	// Vi når aldrig 100% af os selv (kun 99%), fordi 100% misvisende ville
	// signalere "færdig" mens vi stadig venter på data.
	import { onMount } from 'svelte';

	interface Props {
		tekst?: string;
		kompakt?: boolean;
		maxSekunder?: number;
	}

	let {
		tekst = 'Henter data...',
		kompakt = false,
		maxSekunder = 120
	}: Props = $props();

	let procent = $state(0);

	onMount(() => {
		const startTid = Date.now();
		const total = maxSekunder * 1000;
		const id = setInterval(() => {
			const forl = Date.now() - startTid;
			procent = Math.min(99, Math.floor((forl / total) * 100));
		}, 200);
		return () => clearInterval(id);
	});
</script>

<div class="loading" class:kompakt>
	<div class="bar" aria-hidden="true">
		<div class="bar-fyld" style:width="{procent}%"></div>
	</div>
	<div class="tekst">
		{tekst}
		<span class="procent">{procent}%</span>
	</div>
</div>

<style>
	.loading {
		padding: 28px 16px;
		text-align: center;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 12px;
	}

	.loading.kompakt {
		padding: 14px 16px;
		gap: 8px;
	}

	.bar {
		position: relative;
		width: 100%;
		max-width: 280px;
		height: 4px;
		border-radius: 99px;
		background: var(--bg2);
		overflow: hidden;
	}

	.loading.kompakt .bar {
		max-width: 200px;
		height: 3px;
	}

	.bar-fyld {
		height: 100%;
		background: var(--terra);
		border-radius: 99px;
		transition: width 0.3s linear;
	}

	.tekst {
		font-family: var(--ff-d);
		font-size: calc(13px * var(--fs-scale, 1));
		font-style: italic;
		color: var(--text2);
		letter-spacing: 0.01em;
	}

	.loading.kompakt .tekst {
		font-size: calc(12px * var(--fs-scale, 1));
	}

	.procent {
		display: inline-block;
		margin-left: 6px;
		font-family: var(--ff-b);
		font-style: normal;
		font-size: calc(12px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--terra);
		letter-spacing: 0;
	}

	.loading.kompakt .procent {
		font-size: calc(11px * var(--fs-scale, 1));
	}
</style>
