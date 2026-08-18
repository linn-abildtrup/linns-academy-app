<script lang="ts">
	// ============================================================
	// Kundens egen note paa en lektion.
	//
	// Bygget efter samme moenster som Refleksion.svelte, saa de to felter
	// opfoerer sig ens: har hun skrevet noget, staar teksten og ikke et
	// tomt felt, og "Rediger" aabner det igen.
	//
	// Én vigtig forskel. Refleksionen kan Linn se. Det her kan hun ikke.
	// Noten ligger under kunden selv, og Firestore-reglerne lukker alle
	// andre ude. Derfor staar der ogsaa "Kun du kan se den" og ikke
	// "Kun du og Linn".
	//
	// Noten gemmes i den SAMME samling som den gamle app bruger, altsaa
	// users/{uid}/lektionNoter. En note hun skrev i biblioteket i den
	// gamle app staar derfor allerede her, og omvendt.
	// ============================================================

	import { MAKS_NOTE_LAENGDE, validerNote } from '$lib/content/lektionNoter';
	import Fluebe from './Fluebe.svelte';

	interface Props {
		note: string;
		gemmer: boolean;
		gemtLige: boolean;
		ongem: (tekst: string) => void;
	}

	let { note, gemmer, gemtLige, ongem }: Props = $props();

	let tekst = $state('');
	let redigerer = $state(false);

	// Naar noten kommer ind fra Firestore, saettes feltet. Skriver hun
	// allerede, roerer vi ikke ved det hun har i haanden.
	$effect(() => {
		if (!redigerer) tekst = note;
	});

	const harSkrevet = $derived(note.trim().length > 0);
	const visFelt = $derived(!harSkrevet || redigerer);
	const fejl = $derived(validerNote(tekst));
	// Tom tekst er gyldig naar hun allerede HAR en note. Saa sletter hun den.
	const aendret = $derived(tekst.trim() !== note.trim());
	const kanGemme = $derived(aendret && !fejl && !gemmer);

	function gem() {
		if (!kanGemme) return;
		ongem(tekst.trim());
		redigerer = false;
	}

	function fortryd() {
		tekst = note;
		redigerer = false;
	}
</script>

<section class="lnote">
	<div class="lab"><h2>Din note</h2></div>

	{#if visFelt}
		<textarea
			class="skrivefelt"
			bind:value={tekst}
			onfocus={() => (redigerer = true)}
			placeholder="Skriv det du vil huske fra lektionen …"
			maxlength={MAKS_NOTE_LAENGDE}
			rows="4"
		></textarea>
		{#if fejl}
			<p class="lnote-fejl">{fejl}</p>
		{/if}
		<div class="lnote-fod">
			<span class="privat">Kun du kan se den</span>
			<span class="lnote-knapper">
				{#if harSkrevet}
					<button class="link-knap" onclick={fortryd}>Fortryd</button>
				{/if}
				<button class="btn" disabled={!kanGemme} onclick={gem}>
					{gemmer ? 'Gemmer …' : harSkrevet && !tekst.trim() ? 'Slet noten' : 'Gem'}
				</button>
			</span>
		</div>
	{:else}
		<p class="lnote-tekst">{note}</p>
		<div class="lnote-fod">
			{#if gemtLige}
				<span class="gemt">
					<span class="rund-fluebe" aria-hidden="true"><Fluebe /></span>
					Gemt
				</span>
			{:else}
				<span class="privat">Kun du kan se den</span>
			{/if}
			<button class="link-knap" onclick={() => (redigerer = true)}>Rediger</button>
		</div>
	{/if}
</section>
