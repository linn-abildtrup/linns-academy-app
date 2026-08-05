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
	// ============================================================

	import Fluebe from './Fluebe.svelte';

	interface Props {
		titel: string;
		detalje: string;
		onfold: () => void;
	}

	let { titel, detalje, onfold }: Props = $props();
</script>

<button class="foldet" onclick={onfold} aria-expanded="false">
	<span class="rund-fluebe" aria-hidden="true"><Fluebe /></span>
	<span class="foldet-tekst">
		<span class="t">{titel}</span>
		<span class="s">{detalje}</span>
	</span>
	<span class="chev" aria-hidden="true">⌄</span>
</button>
