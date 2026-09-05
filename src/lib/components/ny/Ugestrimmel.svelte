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
		/** Dagens dato, saa fremtiden kan laases. */
		iDag: string;
		/**
		 * Dage hvor kunden har sat forloebet paa pause. De taeller ikke med
		 * i forloebet, saa der er intet indhold at gaa ind til. Tom for alle
		 * andre end Kropsro-kunder. Se nulDage3.ts.
		 */
		nulDage?: Set<string>;
	}

	let { aktivDato, iDag, nulDage = new Set<string>() }: Props = $props();

	const UGEDAGE = ['Søn', 'Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør'];

	// MAANEDEN STAAR PAA HVER DAG. Linns valg 5. september, forslag D i
	// mockups-datostrimmel-maaned.html. Foer stod der kun ugedag og dato,
	// og saa laa "31" og "1" ved siden af hinanden uden at nogen fortalte
	// at der gik en maaned imellem. Strimlen kan rulles otte uger tilbage,
	// saa spoergsmaalet "hvilken maaned er det her" opstaar tit.
	const MAANEDER = [
		'jan',
		'feb',
		'mar',
		'apr',
		'maj',
		'jun',
		'jul',
		'aug',
		'sep',
		'okt',
		'nov',
		'dec'
	];

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
				erPause: nulDage.has(noegle),
				maaned: MAANEDER[dt.getMonth()]
			});
		}
		return liste;
	});

	// Ruller den valgte dag ind i MIDTEN. Uden det starter striben helt
	// til venstre, otte uger tilbage, og saa er hun et forkert sted. I
	// midten kan hun se baade dagene foer og dagene efter, og paa
	// forsiden staar i dag altid samme sted.
	onMount(() => {
		const valgt = rulle?.querySelector('.dag.idag') as HTMLElement | null;
		if (!valgt || !rulle) return;
		rulle.scrollLeft = valgt.offsetLeft - (rulle.clientWidth - valgt.offsetWidth) / 2;
	});
</script>

<div class="uge-rulle" bind:this={rulle}>
	{#each dage as dag (dag.noegle)}
		{#if dag.erPause}
			<!-- Pause-dag. Der er ikke noget indhold bag den, saa den kan
			     ikke trykkes. Se nulDage3.ts. -->
			<div class="dag pause" title="Pause">
				<span class="u">{dag.navn}</span>
				<span class="d">{dag.dato}</span>
				<span class="p">Pause</span>
			</div>
		{:else if dag.erFremtid}
			<div class="dag senere">
				<span class="u">{dag.navn}</span>
				<span class="d">{dag.dato}</span>
				<span class="m">{dag.maaned}</span>
			</div>
		{:else}
			<!-- I dag foerer til forsiden. Det er dér dagen i dag bor. -->
			<a class="dag" class:idag={dag.erValgt} href={dag.erIDag ? '/ny' : `/ny/dag/${dag.noegle}`}>
				<span class="u">{dag.navn}</span>
				<span class="d">{dag.dato}</span>
				<!-- Maaneden stod foer som en prik der betoed "du har svaret
				     paa mindst ét lille skridt". Linn 5. september: prikken
				     bruges ikke, maaneden er vigtigere paa den plads. -->
				<span class="m">{dag.maaned}</span>
			</a>
		{/if}
	{/each}
</div>
