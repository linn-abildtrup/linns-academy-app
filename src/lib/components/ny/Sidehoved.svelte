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

	import { page } from '$app/state';
	import { forrigeSide3 } from '$lib/content/forrigeSide3';

	interface Props {
		titel: string;
		/**
		 * Adressen bagud, som RESERVE. Uden den tegnes ingen tilbage-raekke.
		 *
		 * Ved vi hvor hun faktisk kom fra, vinder det over den her. Se
		 * content/forrigeSide3.ts og Linns oenske 5. september: knappen skal
		 * pege paa den side hun var paa, ikke et fast sted. Reserven bruges
		 * naar hun aabner siden fra en besked, et bogmaerke eller ved at
		 * genindlaese, hvor der ikke ER en forrige side.
		 */
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

	// Hvor hun kom fra, hvis vi ved det. Aldrig siden selv: saa ville
	// knappen pege paa sig selv og ikke goere noget.
	const forrige = $derived(forrigeSide3(page.url.pathname));
	const gaaTil = $derived(forrige?.sti ?? tilbage);
	const ordet = $derived(forrige?.navn ?? tilbageTekst ?? 'Tilbage');
</script>

<header class="sh" class:sh-kant={kant}>
	{#if gaaTil}
		<a class="sh-tilbage" href={gaaTil}>‹ {ordet}</a>
	{/if}
	<div class="sh-raek">
		<div class="sh-tekst">
			<h1>{titel}</h1>
			{#if under}<p>{under}</p>{/if}
		</div>
	</div>
</header>
