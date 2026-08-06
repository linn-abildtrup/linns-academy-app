<script lang="ts">
	// ============================================================
	// Datostrimlen. Bruges baade paa forsiden og paa en enkelt dag, saa
	// den ser ens ud og opfoerer sig ens de to steder.
	//
	// Den kan RULLES bagud, saa hun kan finde tilbage til enhver dag hun
	// har vaeret med. Syv dage er synlige ad gangen, resten ligger til
	// venstre. Den valgte dag rulles frem, naar siden aabner.
	//
	// I dag foerer altid til forsiden, ikke til en dags-side. Forsiden ER
	// dagen i dag.
	// ============================================================

	import { onMount } from 'svelte';
	import { datoNoegle } from '$lib/firestore/forside3';

	interface Props {
		/** Den dag der er fremhaevet. YYYY-MM-DD. */
		aktivDato: string;
		/** Datoer hvor hun har svaret paa noget. */
		aktiveDage: Set<string>;
		/** Dagens dato, saa fremtiden kan laases. */
		iDag: string;
	}

	let { aktivDato, aktiveDage, iDag }: Props = $props();

	const UGEDAGE = ['Søn', 'Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør'];

	/** Hvor langt tilbage striben raekker. Otte uger daekker et forloeb. */
	const DAGE_TILBAGE = 56;

	let rulle = $state<HTMLDivElement | null>(null);

	const dage = $derived.by(() => {
		const [aar, m, d] = iDag.split('-').map(Number);
		if (!aar) return [];
		// Frem til soendag i denne uge, saa ugen altid staar hel.
		const sidste = new Date(aar, m - 1, d);
		sidste.setDate(sidste.getDate() + ((7 - sidste.getDay()) % 7));

		const liste = [];
		for (let i = DAGE_TILBAGE; i >= 0; i--) {
			const dt = new Date(sidste);
			dt.setDate(sidste.getDate() - i);
			const noegle = datoNoegle(dt);
			liste.push({
				navn: UGEDAGE[dt.getDay()],
				dato: dt.getDate(),
				noegle,
				erValgt: noegle === aktivDato,
				erIDag: noegle === iDag,
				erFremtid: noegle > iDag,
				harData: aktiveDage.has(noegle)
			});
		}
		return liste;
	});

	// Ruller den valgte dag frem. Uden det starter striben helt til
	// venstre, otte uger tilbage, og saa er hun helt forkert et sted.
	onMount(() => {
		const valgt = rulle?.querySelector('.dag.idag') as HTMLElement | null;
		if (valgt && rulle) {
			rulle.scrollLeft = valgt.offsetLeft - rulle.clientWidth + valgt.offsetWidth + 8;
		}
	});
</script>

<div class="uge-rulle" bind:this={rulle}>
	{#each dage as dag (dag.noegle)}
		{#if dag.erFremtid}
			<div class="dag senere">
				<span class="u">{dag.navn}</span>
				<span class="d">{dag.dato}</span>
			</div>
		{:else}
			<!-- I dag foerer til forsiden. Det er dér dagen i dag bor. -->
			<a
				class="dag"
				class:idag={dag.erValgt}
				href={dag.erIDag ? '/ny' : `/ny/dag/${dag.noegle}`}
			>
				<span class="u">{dag.navn}</span>
				<span class="d">{dag.dato}</span>
				{#if dag.harData}<span class="prik"></span>{/if}
			</a>
		{/if}
	{/each}
</div>
