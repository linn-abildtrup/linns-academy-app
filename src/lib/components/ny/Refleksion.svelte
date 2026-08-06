<script lang="ts">
	// ============================================================
	// Dagens refleksion. Kun for kunder paa et forloeb, fordi
	// spoergsmaalet staar paa forloebets programdag.
	//
	// Hun skriver direkte paa forsiden. Der gemmes KUN note-feltet, aldrig
	// hele dagen. Refleksionssiden i den gamle app bruger samme felt, og
	// de to maa aldrig kunne overskrive hinanden.
	// ============================================================

	import Fluebe from './Fluebe.svelte';

	interface Props {
		spoergsmaal: string;
		note: string;
		gemmer: boolean;
		gemtLige: boolean;
		ongem: (tekst: string) => void;
	}

	let { spoergsmaal, note, gemmer, gemtLige, ongem }: Props = $props();

	let tekst = $state('');
	let redigerer = $state(false);
	let foldet = $state(false);

	// Naar noten kommer ind fra Firestore, saettes feltet. Skriver hun
	// allerede, roerer vi ikke ved det hun har i haanden.
	$effect(() => {
		if (!redigerer) tekst = note;
	});

	const harSkrevet = $derived(note.trim().length > 0);
	const visFelt = $derived(!harSkrevet || redigerer);
	const kanGemme = $derived(tekst.trim().length > 0 && tekst.trim() !== note.trim() && !gemmer);

	function gem() {
		ongem(tekst.trim());
		redigerer = false;
	}
</script>

<section class="refleksion">
	<button
		class="refleksion-top"
		onclick={() => (foldet = !foldet)}
		aria-expanded={!foldet}
	>
		<span class="refleksion-k">Dagens refleksion</span>
		<span class="refleksion-chev" class:vendt={foldet} aria-hidden="true">⌄</span>
	</button>

	{#if !foldet}
	<p class="refleksion-spm">{spoergsmaal}</p>

	{#if visFelt}
		<textarea
			class="skrivefelt"
			bind:value={tekst}
			onfocus={() => (redigerer = true)}
			placeholder="Skriv dine tanker her …"
			rows="3"
		></textarea>
		<div class="refleksion-fod">
			<span class="privat">Kun du og Linn kan se dit svar</span>
			<button class="btn" disabled={!kanGemme} onclick={gem}>
				{gemmer ? 'Gemmer …' : 'Gem'}
			</button>
		</div>
	{:else}
		<p class="refleksion-svar">{note}</p>
		<div class="refleksion-fod">
			{#if gemtLige}
				<span class="gemt">
					<span class="rund-fluebe" aria-hidden="true"><Fluebe /></span>
					Gemt
				</span>
			{:else}
				<span class="privat">Kun du og Linn kan se dit svar</span>
			{/if}
			<button class="link-knap" onclick={() => (redigerer = true)}>Rediger</button>
		</div>
	{/if}
	{/if}
</section>
