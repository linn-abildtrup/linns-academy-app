<script lang="ts">
	// ============================================================
	// Toppen af hver side i 3.0, undtagen forsiden og afspilleren.
	//
	// Foer 20. august 2026 fandtes den her top i SYV udgaver: side-top,
	// adm-top, ing-top, ob-hoved, rm-top, maaling-top og forsidens egen.
	// De gjorde det samme og drev fra hinanden. Tolv sider bar desuden
	// den samme haandrettelse i markup for at faa luften til at passe.
	// Alt det er samlet her.
	//
	// SAADAN BRUGES DEN:
	//   <Sidehoved titel="Beskeder" />
	//   <Sidehoved titel="Kettle" tilbage="/ny/traening" tilbageTekst="Træning" />
	//   <Sidehoved titel="Din side" kant={false} />   inde i .ny-pad
	//
	// KANT er den ene ting du skal taenke over. Sider der ligger inde i
	// .ny-pad har allerede 17 px i siderne, og saa skal hovedet ikke
	// laegge 17 til. Det er praecis det den gamle haandrettelse gjorde.
	// ============================================================

	interface Props {
		titel: string;
		/** Adressen bagud. Uden den tegnes ingen tilbage-raekke. */
		tilbage?: string;
		/** Ordet efter pilen. Staar der intet, skriver vi Tilbage. */
		tilbageTekst?: string;
		/** Én rolig linje under titlen. Brug den kun hvor den siger noget. */
		under?: string;
		/**
		 * Sidder hovedet inde i .ny-pad, som allerede har luft i siderne.
		 * Saa skal hovedet ikke laegge sin egen oveni.
		 */
		kant?: boolean;
	}

	let { titel, tilbage, tilbageTekst, under, kant = true }: Props = $props();
</script>

<header class="sh" class:sh-kant={kant}>
	{#if tilbage}
		<a class="sh-tilbage" href={tilbage}>‹ {tilbageTekst ?? 'Tilbage'}</a>
	{/if}
	<div class="sh-raek">
		<div class="sh-tekst">
			<h1>{titel}</h1>
			{#if under}<p>{under}</p>{/if}
		</div>
	</div>
</header>
