<script lang="ts">
	// ============================================================
	// MINE FAVORITTER. Afloeser MineFodevarerArk 26. august 2026.
	//
	// Det gamle ark hed Mine madvarer og havde TO grupper med hver sin
	// slags raekke: hjertede varer med et hjerte, og hendes egne med Ret
	// og et kryds. Hendes scannede varer stod slet ikke i det, saa hun
	// kunne kun finde dem ved at soege. Tre steder hendes ting kunne
	// vaere, og to slags raekker der lignede hinanden og opfoerte sig
	// forskelligt.
	//
	// Linns beslutning 26. august: ét begreb. Se content/mineFavoritter3.ts
	// for hele begrundelsen og for reglen om at listen REGNES UD.
	//
	// HER ER DER ÉN SLAGS RAEKKE OG ÉN HANDLING. Kilde-maerkatet siger
	// hvor tallet kommer fra, og det er den eneste forskel hun moeder.
	// Ret er flyttet ned i maengde-arket, hvor varen alligevel er aaben,
	// i stedet for at ligge som en ekstra knap paa hver raekke.
	//
	// Bekraeftelsen ligger inde i selve raekken og ikke i en boks ovenpaa.
	// Arket er portalled ud af .ny-app, og en boks oven paa en boks er
	// der hvor farverne og z-index plejer at gaa galt. Samme moenster som
	// paa de faste maaltider.
	// ============================================================

	import { portal } from '$lib/actions/portal';
	import { underTekst } from '$lib/content/egneFodevarer3';
	import { maerkatFor } from '$lib/content/fodevareKilde3';
	import {
		fjernOrd,
		fjernTitel,
		fjernForklaring,
		type FavoritRaekke
	} from '$lib/content/mineFavoritter3';

	interface Props {
		/** Hele listen, allerede samlet og sorteret. Se mineFavoritter(). */
		raekker: FavoritRaekke[];
		henter?: boolean;
		/** Vaelg den, altsaa aabn maengde-arket. */
		onvaelg: (id: string) => void;
		/** Tag varen af listen. Hvad det betyder afgoeres af raekken. */
		onfjern: (r: FavoritRaekke) => void;
		onny: () => void;
		onscan: () => void;
		onluk: () => void;
	}

	let { raekker, henter = false, onvaelg, onfjern, onny, onscan, onluk }: Props = $props();

	let soegeord = $state('');
	/** Den raekke der spoerger lige nu. Kun én ad gangen. */
	let spoergId = $state<string | null>(null);

	const traef = $derived.by(() => {
		const q = soegeord.trim().toLowerCase();
		if (!q) return raekker;
		return raekker.filter((r) => r.vare.name.toLowerCase().includes(q));
	});

	function fokuser(node: HTMLInputElement) {
		// Tastaturet maa ikke springe op af sig selv. Hun vil oftest
		// bladre foerst, og et tastatur ville daekke halvdelen af listen.
		node.blur();
	}

	function fjern(r: FavoritRaekke) {
		spoergId = null;
		onfjern(r);
	}
</script>

<!-- ny-tokens: arket flyttes ud af .ny-app, saa farverne skal foelge med. -->
<div class="ark-lag ny-tokens" use:portal role="dialog" aria-modal="true" aria-labelledby="mf-titel">
	<button type="button" class="ark-luk-flade" onclick={onluk} aria-label="Luk"></button>
	<div class="va-ark">
		<div class="ma-greb" aria-hidden="true"></div>
		<button type="button" class="ma-luk" onclick={onluk} aria-label="Luk">×</button>

		<!-- Titlen skifter IKKE efter indhold. Et sted der aendrer navn alt
		     efter hvad der ligger i det, er svaert at finde tilbage til. -->
		<h2 class="va-titel" id="mf-titel">Mine favoritter</h2>

		{#if raekker.length > 0}
			<input
				class="va-soeg"
				type="search"
				bind:value={soegeord}
				use:fokuser
				placeholder="Søg i dine favoritter"
				aria-label="Søg i dine favoritter"
			/>
		{/if}

		<div class="fm-liste">
			{#if henter}
				<p class="va-tom">Henter</p>
			{:else if raekker.length === 0}
				<p class="va-tom">
					Du har ingen favoritter endnu. Tryk på hjertet på en madvare, scan en pakke, eller lav
					en vare selv, så samles de her.
				</p>
			{:else if traef.length === 0}
				<p class="va-tom">Ingen træffer på det ord.</p>
			{:else}
				{#each traef as r (r.vare.id)}
					{#if spoergId === r.vare.id}
						<div class="fm-bekraeft">
							<span class="fm-b-t">{fjernTitel(r)}</span>
							<span class="fm-b-n">{fjernForklaring(r)}</span>
							<div class="fm-b-k">
								<button type="button" class="fm-b-nej" onclick={() => (spoergId = null)}>
									Behold
								</button>
								<button type="button" class="fm-b-ja" onclick={() => fjern(r)}>
									{fjernOrd(r)}
								</button>
							</div>
						</div>
					{:else}
						<div class="fm-kort">
							<button type="button" class="fm-vaelg" onclick={() => onvaelg(r.vare.id)}>
								<span class="fm-navn">
									{r.vare.name}
									<span class="fk-maerke fk-{r.kilde}">{maerkatFor(r.vare)}</span>
								</span>
								<span class="fm-under">{underTekst(r.vare)}</span>
							</button>
							<!-- En vare hun selv har scannet har intet kryds. Den er
							     DELT med andre kunder, saa den maa hverken slettes
							     for alle eller skjules for hende alene uden et nyt
							     felt. Se handlingFor() i mineFavoritter3.ts. -->
							{#if r.handling !== 'ingen'}
								<button
									type="button"
									class="fm-slet"
									onclick={() => (spoergId = r.vare.id)}
									aria-label="{fjernOrd(r)} {r.vare.name}">×</button
								>
							{/if}
						</div>
					{/if}
				{/each}
			{/if}
		</div>

		<!-- De to veje til en ny vare staar NEDERST, hvor hun er naar hun
		     ikke fandt den hun ledte efter. Scan foerst: vi vil helst have
		     tallene fra pakken frem for fra hukommelsen. Linns raekkefoelge,
		     se mockups-scan-vare.html. -->
		<div class="mf-veje">
			<button type="button" class="mf-vej" onclick={onscan}>
				<span class="mf-vej-i" aria-hidden="true">
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
						<path d="M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16" />
						<path d="M7.5 9v6M10.5 9v6M13.5 9v6M16.5 9v6" />
					</svg>
				</span>
				<span class="mf-vej-t"><b>Scan en vare</b>Til alt med en pakke</span>
				<span class="mf-vej-p" aria-hidden="true">›</span>
			</button>
			<button type="button" class="mf-vej" onclick={onny}>
				<span class="mf-vej-i" aria-hidden="true">
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
						<path d="M17 3.5 20.5 7 10 17.5l-4.5 1 1-4.5Z" />
						<path d="M4 20.5h9" />
					</svg>
				</span>
				<span class="mf-vej-t"><b>Lav en vare selv</b>Når den ikke findes og ikke har en pakke</span>
				<span class="mf-vej-p" aria-hidden="true">›</span>
			</button>
		</div>
	</div>
</div>
