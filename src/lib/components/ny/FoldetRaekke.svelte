<script lang="ts">
	// ============================================================
	// En sektion der er foldet sammen, fordi hun har klaret den.
	//
	// Raekken bliver liggende PRAECIS hvor sektionen stod. Den flytter
	// aldrig ned i bunden. En side der laver om paa sig selv, foeles som
	// om noget er blevet vaek, og det rammer haardest hos dem der i
	// forvejen synes hovedet ikke helt foelger med.
	//
	// Der staar altid hvad der er sket ("klaret kl. 7.40"), saa det er
	// tydeligt at det er hende der har gjort noget, ikke appen der har
	// fjernet noget.
	//
	// SIDEN 20. AUGUST ER RAEKKEN OGSAA OVERSKRIFT NAAR SEKTIONEN ER
	// AABEN. Foer kunne hun folde ud, men ikke ind igen, og et forsoeg med
	// en "Fold sammen"-knap nedenunder var forkert. Linns valg: det samme
	// moenster som paa Udvikling, hvor overskriften SELV er kontakten og
	// indholdet folder ud i det samme kort. Tegnet er › naar den er
	// lukket og ⌄ naar den er aaben, ligesom der.
	// ============================================================

	import Fluebe from './Fluebe.svelte';

	interface Props {
		titel: string;
		detalje: string;
		/** Staar sektionen aaben. Styrer tegnet og laeses af skaermlaesere. */
		aaben?: boolean;
		onfold: () => void;
	}

	let { titel, detalje, aaben = false, onfold }: Props = $props();
</script>

<button class="foldet" class:aaben onclick={onfold} aria-expanded={aaben}>
	<span class="rund-fluebe" aria-hidden="true"><Fluebe /></span>
	<span class="foldet-tekst">
		<span class="t">{titel}</span>
		<span class="s">{detalje}</span>
	</span>
	<span class="chev" aria-hidden="true">{aaben ? '⌄' : '›'}</span>
</button>
