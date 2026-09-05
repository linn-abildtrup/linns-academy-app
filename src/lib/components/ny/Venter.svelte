<script lang="ts">
	// ============================================================
	// Vente-skaermen. ÉN i hele 3.0.
	//
	// HVORFOR DEN FINDES SOM KOMPONENT. Foer stod den samme stump markup
	// 22 steder, og forsiden havde sin helt egen med en procent-bjaelke.
	// Linn bad 5. september om at de skulle vaere ens, og de driver fra
	// hinanden igen med det samme, hvis reglen kun staar i en kommentar.
	//
	// LINJEN DER KOMMER SENERE er Linns valg, forslag B i
	// mockups-ventskaerme.html. Traekker det ud, faar hun at vide at det
	// ikke er hende der har gjort noget forkert. Forsiden havde den
	// tidligere, og den forsvandt da skaermene blev rettet ind.
	//
	// FIRE SEKUNDER er valgt saa en normal hentning ALDRIG naar at vise
	// den. Kommer den for tidligt, laerer hun at appen altid er langsom,
	// og saa betyder linjen ingenting den dag den er sand.
	//
	// TEKSTEN SKAL SIGE HVAD HUN VENTER PAA. "Henter" alene kunne staa paa
	// en hvilken som helst side. Se de otte tekster i mockup'en.
	// ============================================================

	import { onMount } from 'svelte';
	import Ventetegn from './Ventetegn.svelte';

	interface Props {
		/** Hvad hun venter paa, fx "Henter din træning". */
		tekst: string;
		/**
		 * Skal den blide linje komme hvis det traekker ud.
		 *
		 * Falsk paa skaerme der bevidst kun vises et splitsekund, som en
		 * side der sender videre. Dér ville linjen naa at blinke forbi og
		 * kun forvirre.
		 */
		visLaenge?: boolean;
	}

	let { tekst, visLaenge = true }: Props = $props();

	const LAENGE_MS = 4000;

	let laenge = $state(false);
	onMount(() => {
		if (!visLaenge) return;
		const id = setTimeout(() => (laenge = true), LAENGE_MS);
		return () => clearTimeout(id);
	});
</script>

<div class="venter">
	<div class="venter-linje">
		<Ventetegn variant="lille" />
		<span>{tekst}</span>
	</div>

	{#if laenge}
		<!-- aria-live, saa en skaermlaeser ogsaa faar den at vide. Uden den
		     ville en blind kunde sidde i tavshed og tro at intet skete. -->
		<p class="venter-laenge" aria-live="polite">
			Det tager længere end normalt. Din forbindelse er måske langsom lige nu.
		</p>
	{/if}
</div>
