<script lang="ts">
	// ============================================================
	// Arket bag de fire ikoner: opskrifter, favoritter og mine
	// foedevarer. Se SPEC-3.0.md afsnit 26.2.
	//
	// Ét ark til alle tre, fordi de goer det samme: viser en liste hun
	// kan soege i og vaelge fra. Tre naesten ens ark ville vaere tre
	// steder at rette en fejl.
	//
	// Soegefeltet er altid der. Én kunde har 143 egne foedevarer, og en
	// liste uden soegning er ubrugelig ved den stoerrelse.
	// ============================================================

	import { portal } from '$lib/actions/portal';

	export interface Valg {
		id: string;
		navn: string;
		/** Linjen under navnet, fx makro eller antal ingredienser. */
		under: string;
	}

	interface Props {
		titel: string;
		poster: Valg[];
		henter?: boolean;
		/** Tekst naar listen er tom. Siger hvorfor, ikke bare "ingenting". */
		tomTekst: string;
		onvaelg: (id: string) => void;
		onluk: () => void;
	}

	let { titel, poster, henter = false, tomTekst, onvaelg, onluk }: Props = $props();

	let soegeord = $state('');

	const traef = $derived.by(() => {
		const q = soegeord.trim().toLowerCase();
		if (!q) return poster;
		return poster.filter((p) => p.navn.toLowerCase().includes(q));
	});

	function fokuser(node: HTMLInputElement) {
		// Tastaturet maa IKKE springe op af sig selv. Hun vil oftest
		// bladre foerst, og et tastatur ville daekke halvdelen af listen.
		node.blur();
	}
</script>

<!-- ny-tokens: arket flyttes ud af .ny-app, saa farverne skal foelge med.
     Uden den bliver arket gennemsigtigt. Se ny.css i toppen. -->
<div class="ark-lag ny-tokens" use:portal role="dialog" aria-modal="true" aria-labelledby="va-titel">
	<button type="button" class="ark-luk-flade" onclick={onluk} aria-label="Luk"></button>
	<div class="va-ark">
		<div class="ma-greb" aria-hidden="true"></div>
		<button type="button" class="ma-luk" onclick={onluk} aria-label="Luk">×</button>

		<h2 class="va-titel" id="va-titel">{titel}</h2>

		<input
			class="va-soeg"
			type="search"
			bind:value={soegeord}
			use:fokuser
			placeholder="Søg i {titel.toLowerCase()}"
			aria-label="Søg i {titel.toLowerCase()}"
		/>

		<div class="va-liste">
			{#if henter}
				<p class="va-tom">Henter</p>
			{:else if traef.length === 0}
				<p class="va-tom">{soegeord.trim() ? 'Ingen træffer på det ord.' : tomTekst}</p>
			{:else}
				{#each traef as p (p.id)}
					<button type="button" onclick={() => onvaelg(p.id)}>
						<span class="va-navn">{p.navn}</span>
						{#if p.under}<span class="va-under">{p.under}</span>{/if}
					</button>
				{/each}
			{/if}
		</div>
	</div>
</div>
