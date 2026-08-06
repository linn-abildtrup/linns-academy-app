<script lang="ts">
	// ============================================================
	// Inspirator-kortet, lige under Dit overskud.
	//
	// Melder sig kun naar hun har vaeret vaek et stykke tid, eller naar
	// overskuddet falder mens hun er aktiv. Teksten er skrevet af AI'en
	// ud fra hendes egne tal, med meget stramme regler for tonen.
	//
	// Hun kan altid sige "ikke nu", og saa er kortet vaek resten af dagen.
	// ============================================================

	import Ventetegn from './Ventetegn.svelte';

	interface Props {
		tekst: string;
		henter: boolean;
		onafvis: () => void;
	}

	let { tekst, henter, onafvis }: Props = $props();
</script>

<section class="inspirator">
	<div class="inspirator-top">
		<span class="inspirator-ava" aria-hidden="true"></span>
		<span class="inspirator-k">En tanke til dig</span>
		<button class="inspirator-luk" onclick={onafvis} aria-label="Skjul for i dag">Ikke nu</button>
	</div>

	{#if henter}
		<div class="inspirator-venter">
			<Ventetegn variant="lille" />
			<span>Et øjeblik</span>
		</div>
	{:else}
		<p class="inspirator-tekst">{tekst}</p>
		<a class="btn" href="/ny/snak">Snak med mig om det</a>
	{/if}
</section>
