<script lang="ts">
	// ============================================================
	// Arket der gemmer det maaltid hun lige har tastet, som et fast
	// maaltid. Se SPEC-3.0.md afsnit 26.10.
	//
	// Ét felt, fire chips og én knap. Navnet er foreslaaet og maaltidet
	// er valgt i forvejen, saa hun kan trykke Gem uden at skrive noget.
	//
	// "Det her kommer med" er ikke pynt. En linje der kom fra en opskrift
	// har ingen madvarer at slaa op, saa den kan ikke gemmes, og den maa
	// ikke bare forsvinde i stilhed. Det er praecis den fejl der findes
	// paa 178 af de 2.905 faste maaltider i drift, hvor kunden logger
	// mindre end hun spiste uden at nogen siger det.
	// ============================================================

	import { portal } from '$lib/actions/portal';
	import { MAALTIDSTYPER, MAALTIDSTYPE_LABELS, type Maaltidstype } from '$lib/content/kost';
	import { navnDuger } from '$lib/content/fasteMaaltider3';

	export interface GemLinje {
		navn: string;
		/** "60 g" eller "1 spsk". Tom hvis maengden ikke kan laeses. */
		maengde: string;
	}

	interface Props {
		/** Foreslaaet navn. Hun kan skrive over det. */
		startNavn: string;
		startMaaltid: Maaltidstype;
		linjer: GemLinje[];
		/** Navnene paa det der IKKE kan komme med. */
		uden: string[];
		gemmer?: boolean;
		ongem: (navn: string, maaltid: Maaltidstype) => void;
		onluk: () => void;
	}

	let { startNavn, startMaaltid, linjer, uden, gemmer = false, ongem, onluk }: Props = $props();

	// Kun STARTvaerdierne, med vilje. Arket bygges forfra hver gang hun
	// aabner det, og skriver hun sit eget navn, maa et forslag udefra
	// ikke tage det fra hende igen.
	// svelte-ignore state_referenced_locally
	let navn = $state(startNavn);
	// svelte-ignore state_referenced_locally
	let maaltid = $state<Maaltidstype>(startMaaltid);

	const kanGemme = $derived(navnDuger(navn) && linjer.length > 0 && !gemmer);

	function vaelg(t: Maaltidstype) {
		// Hun har skrevet sit eget navn, saa det maa en chip ikke tage fra
		// hende. Er navnet stadig et af maaltidernes, foelger det med.
		const kendte = Object.values(MAALTIDSTYPE_LABELS);
		if (kendte.includes(navn.trim())) navn = MAALTIDSTYPE_LABELS[t];
		maaltid = t;
	}

	function gem() {
		if (!kanGemme) return;
		ongem(navn, maaltid);
	}
</script>

<!-- ny-tokens: arket flyttes ud af .ny-app, saa farverne skal foelge med. -->
<div class="ark-lag ny-tokens" use:portal role="dialog" aria-modal="true" aria-labelledby="gf-titel">
	<button type="button" class="ark-luk-flade" onclick={onluk} aria-label="Luk"></button>
	<div class="ma-ark">
		<div class="ma-greb" aria-hidden="true"></div>
		<button type="button" class="ma-luk" onclick={onluk} aria-label="Luk">×</button>

		<h2 class="ma-navn" id="gf-titel">Gem som fast måltid</h2>

		<input
			class="gf-navn"
			type="text"
			bind:value={navn}
			maxlength="60"
			aria-label="Navn på det faste måltid"
		/>
		<p class="gf-hjaelp">Navnet er det du ser i listen bagefter.</p>

		<div class="ma-k">Hører til</div>
		<div class="ma-chips">
			{#each MAALTIDSTYPER as t (t)}
				<button
					type="button"
					class="ma-chip"
					class:valgt={maaltid === t}
					aria-pressed={maaltid === t}
					onclick={() => vaelg(t)}
				>
					{MAALTIDSTYPE_LABELS[t]}
				</button>
			{/each}
		</div>

		<div class="ma-k gf-k2">Det her kommer med</div>
		<div class="gf-linjer">
			{#each linjer as l, i (i)}
				<div class="gf-linje">
					<span class="gf-flueben" aria-hidden="true">✓</span>
					<span class="gf-l-navn">{l.navn}</span>
					{#if l.maengde}<span class="gf-l-m">{l.maengde}</span>{/if}
				</div>
			{/each}
		</div>

		{#if uden.length > 0}
			<div class="gf-ude">
				<strong>{uden.join(', ')} kommer ikke med.</strong>
				En opskrift har ingen enkelte varer at gemme. Sæt hjertet på selve opskriften i stedet,
				så finder du den under Opskrifter.
			</div>
		{/if}

		{#if linjer.length === 0}
			<p class="gf-tom">Der er ikke noget her der kan gemmes som et fast måltid.</p>
		{/if}

		<button type="button" class="ma-gem" disabled={!kanGemme} onclick={gem}>
			{#if gemmer}
				Gemmer
			{:else if uden.length > 0 && linjer.length > 0}
				Gem de {linjer.length} andre
			{:else}
				Gem det faste måltid
			{/if}
		</button>
	</div>
</div>
