<script lang="ts">
	// ============================================================
	// Hylden med hendes faste maaltider. Se SPEC-3.0.md afsnit 26.10.
	//
	// Den ligner VaelgArk, men kan tre ting det ark ikke kan, og som
	// maalingen 12. august 2026 sagde den skulle:
	//
	//   1. dele i to, saa det maaltid hun staar i ligger oeverst. 76 %
	//      af de faste maaltider bruges ALTID til det samme maaltid
	//   2. saette mest brugte oeverst. Halvdelen af hylden bliver aldrig
	//      roert, saa den der er brugt tolv gange skal ikke ligge under
	//      den der blev lavet én gang i maj
	//   3. slette. Uden en slette-vej kan hylden kun vokse
	//
	// Sletningen spoerger foerst, og det er med vilje anderledes end
	// resten af modulet. Alle andre steder sker handlingen straks og
	// Fortryd er ét tryk vaek. Her er der ingen Fortryd at falde tilbage
	// paa, og hun mister noget hun selv har bygget. Bekraeftelsen ligger
	// inde i selve raekken og ikke i en boks ovenpaa, for arket er
	// portalled ud af .ny-app og en boks oven paa en boks er der hvor
	// farverne og z-index plejer at gaa galt.
	// ============================================================

	import { portal } from '$lib/actions/portal';

	export interface FastPost {
		id: string;
		navn: string;
		/** Linjen under navnet, fx "5 ting · 31 g protein · brugt 12 gange". */
		under: string;
		/** Maaltidet, kun paa dem der IKKE hoerer til det hun staar i. */
		badge?: string;
	}

	interface Props {
		tilMaaltidet: FastPost[];
		andre: FastPost[];
		/** "morgenmad", til overskriften over den foerste gruppe. */
		maaltidLabel: string;
		henter?: boolean;
		onvaelg: (id: string) => void;
		onslet: (id: string) => void;
		onluk: () => void;
	}

	let { tilMaaltidet, andre, maaltidLabel, henter = false, onvaelg, onslet, onluk }: Props = $props();

	let soegeord = $state('');
	/** Den raekke der spoerger "slet?" lige nu. Kun én ad gangen. */
	let sletId = $state<string | null>(null);

	function filtrer(liste: FastPost[]): FastPost[] {
		const q = soegeord.trim().toLowerCase();
		if (!q) return liste;
		return liste.filter((p) => p.navn.toLowerCase().includes(q));
	}

	const visTil = $derived(filtrer(tilMaaltidet));
	const visAndre = $derived(filtrer(andre));
	const ialt = $derived(tilMaaltidet.length + andre.length);
	const visesIalt = $derived(visTil.length + visAndre.length);

	function fokuser(node: HTMLInputElement) {
		// Tastaturet maa IKKE springe op af sig selv. Hun vil oftest
		// bladre foerst, og et tastatur ville daekke halvdelen af listen.
		node.blur();
	}

	function slet(id: string) {
		sletId = null;
		onslet(id);
	}
</script>

<!-- ny-tokens: arket flyttes ud af .ny-app, saa farverne skal foelge med.
     Uden den bliver arket gennemsigtigt. Se ny.css i toppen. -->
<div class="ark-lag ny-tokens" use:portal role="dialog" aria-modal="true" aria-labelledby="fm-titel">
	<button type="button" class="ark-luk-flade" onclick={onluk} aria-label="Luk"></button>
	<div class="va-ark">
		<div class="ma-greb" aria-hidden="true"></div>
		<button type="button" class="ma-luk" onclick={onluk} aria-label="Luk">×</button>

		<h2 class="va-titel" id="fm-titel">Faste måltider</h2>

		{#if ialt > 0}
			<input
				class="va-soeg"
				type="search"
				bind:value={soegeord}
				use:fokuser
				placeholder="Søg i dine faste måltider"
				aria-label="Søg i dine faste måltider"
			/>
		{/if}

		<div class="fm-liste">
			{#if henter}
				<p class="va-tom">Henter</p>
			{:else if ialt === 0}
				<p class="va-tom">
					Du har ingen faste måltider endnu. Tast et måltid ind, og tryk så Gem som fast
					måltid. Så ligger det her næste gang.
				</p>
			{:else if visesIalt === 0}
				<p class="va-tom">Ingen træffer på det ord.</p>
			{:else}
				{#each [{ titel: `Til ${maaltidLabel}`, poster: visTil }, { titel: 'Dine andre', poster: visAndre }] as gruppe (gruppe.titel)}
					{#if gruppe.poster.length > 0}
						<div class="fm-gruppe">{gruppe.titel}</div>
						{#each gruppe.poster as p (p.id)}
							{#if sletId === p.id}
								<div class="fm-bekraeft">
									<span class="fm-b-t">Slet {p.navn}?</span>
									<span class="fm-b-n">Det du har spist bliver stående. Kun genvejen forsvinder.</span>
									<div class="fm-b-k">
										<button type="button" class="fm-b-nej" onclick={() => (sletId = null)}>
											Behold
										</button>
										<button type="button" class="fm-b-ja" onclick={() => slet(p.id)}>Slet</button>
									</div>
								</div>
							{:else}
								<div class="fm-kort">
									<button type="button" class="fm-vaelg" onclick={() => onvaelg(p.id)}>
										<span class="fm-navn">{p.navn}</span>
										<span class="fm-under">
											{p.under}
											{#if p.badge}<span class="fm-badge">{p.badge}</span>{/if}
										</span>
									</button>
									<button
										type="button"
										class="fm-slet"
										onclick={() => (sletId = p.id)}
										aria-label="Slet {p.navn}">×</button
									>
								</div>
							{/if}
						{/each}
					{/if}
				{/each}
			{/if}
		</div>
	</div>
</div>
