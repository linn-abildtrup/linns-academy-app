<script lang="ts">
	// ============================================================
	// Arket der samler ALT det der tilfoejer noget til maaltidet.
	// Forslag 2 fra gennemgangen 12. august, se SPEC-3.0.md 26.17.
	//
	// Maaltidsskaermen var vokset fra fem lag til ni paa én dag: tal,
	// udvidet naering, det du plejer, soegefelt, traeffere, tre hylder,
	// overskrift, gem-knap og saa endelig maden. Hun laeste fem afsnit
	// foer hun saa sin egen mad.
	//
	// Her ligger de fem af dem i ét ark, og skaermen bagved er tal, én
	// knap og maden.
	//
	// ARKET ER EN FORDELING, IKKE ET STED HUN BLIVER. Vaelger hun en
	// madvare, en hylde eller lav-selv, LUKKER det. Saa er der kun ét ark
	// aabent ad gangen, kvitteringen med Fortryd kan ses, og hun ser sin
	// mad vokse. Prisen er ét tryk mere paa den vej der bruges mest, og
	// det er praecis det vi proever af.
	// ============================================================

	import { portal } from '$lib/actions/portal';
	import type { Fodevare } from '$lib/content/kost';
	import type { PlejerPost } from '$lib/content/plejer3';
	import { formatPortion } from '$lib/content/maengde3';
	import { kildeAf, maerkatFor } from '$lib/content/fodevareKilde3';

	interface Props {
		maaltidLabel: string;
		plejer: PlejerPost[];
		/** Soegefeltet. Siden ejer traefferne, saa den skal kende ordet. */
		soegeord?: string;
		traef: Fodevare[];
		/** Id'erne paa de madvarer hun har markeret med hjerte. */
		hjerter?: string[];
		gemmer?: boolean;
		onplejer: (p: PlejerPost) => void;
		onvaelg: (food: Fodevare) => void;
		/** Slaar hjertet til eller fra paa en madvare. */
		onhjerte: (foodId: string) => void;
		onlavSelv: (navn: string) => void;
		onkilde: (kilde: 'opskrifter' | 'faste' | 'mine') => void;
		onluk: () => void;
	}

	let {
		maaltidLabel,
		plejer,
		soegeord = $bindable(''),
		traef,
		hjerter = [],
		gemmer = false,
		onplejer,
		onhjerte,
		onvaelg,
		onlavSelv,
		onkilde,
		onluk
	}: Props = $props();

	const soeger = $derived(soegeord.trim().length >= 2);
	const intet = $derived(soeger && traef.length === 0);

	function fokuser(node: HTMLInputElement) {
		// Tastaturet maa IKKE springe op af sig selv. Fliserne staar lige
		// nedenunder, og de daekker over halvdelen af det hun taster.
		node.blur();
	}
</script>

<!-- ny-tokens: arket flyttes ud af .ny-app, saa farverne skal foelge med. -->
<div class="ark-lag ny-tokens" use:portal role="dialog" aria-modal="true" aria-labelledby="ta-titel">
	<button type="button" class="ark-luk-flade" onclick={onluk} aria-label="Luk"></button>
	<div class="va-ark">
		<div class="ma-greb" aria-hidden="true"></div>
		<button type="button" class="ma-luk" onclick={onluk} aria-label="Luk">×</button>

		<h2 class="va-titel" id="ta-titel">Tilføj til {maaltidLabel.toLowerCase()}</h2>

		<input
			class="va-soeg"
			type="search"
			bind:value={soegeord}
			use:fokuser
			placeholder="Søg efter mad"
			aria-label="Søg efter mad"
		/>

		<div class="ta-rul">
			{#if intet}
				<!-- Vejen ind naar soegningen ikke finder noget. Det er HER hun
				     staar i staa: varen i haanden og en tom skaerm. -->
				<div class="kort rolig tm-intet">
					<span>Ingen fødevarer hedder det.</span>
					<button type="button" class="tm-lav-selv" onclick={() => onlavSelv(soegeord)}>
						+ Lav "{soegeord.trim()}" selv
					</button>
				</div>
			{:else if traef.length > 0}
				<div class="tm-traef ta-traef">
					{#each traef as f (f.id)}
						<!-- Hjertet staar for sig til hoejre, saa et tryk paa selve
						     linjen aabner maengden. Samme opdeling som krydset i
						     maaltidet. Linns valg 12. august. -->
						<div class="tm-tr-raekke">
							<button type="button" class="tm-tr-vaelg" onclick={() => onvaelg(f)}>
								<span class="tm-tr-navn">
									{f.name}
									<span class="fk-maerke fk-{kildeAf(f)}">{maerkatFor(f)}</span>
								</span>
								<span class="tm-tr-makro">{f.p} g protein pr 100 g</span>
							</button>
							<button
								type="button"
								class="tm-tr-hjerte"
								class:paa={hjerter.includes(f.id)}
								aria-pressed={hjerter.includes(f.id)}
								aria-label="Marker med hjerte"
								onclick={() => onhjerte(f.id)}
							>
								<svg viewBox="0 0 24 24" fill={hjerter.includes(f.id) ? 'currentColor' : 'none'} stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
									<path d="M12 20s-7-4.4-7-9.2A4 4 0 0 1 12 8a4 4 0 0 1 7 2.8C19 15.6 12 20 12 20Z" />
								</svg>
							</button>
						</div>
					{/each}
				</div>
			{/if}

			{#if !soeger}
				{#if plejer.length > 0}
					<div class="tm-k ta-k">Det du plejer</div>
					<div class="tm-plejer">
						{#each plejer as p (p.foodId)}
							<button type="button" class="tm-flise" disabled={gemmer} onclick={() => onplejer(p)}>
								<span class="tm-f-navn">{p.navn}</span>
								<span class="tm-f-m">{formatPortion(p.portion)} {p.enhedId ?? 'g'}</span>
							</button>
						{/each}
					</div>
				{/if}

				<div class="tm-k ta-k">Hent fra</div>
				<div class="tm-ikoner">
					<button type="button" class="tm-ikon" onclick={() => onkilde('opskrifter')}>
						<span class="i1">
							<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
								<path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H19v16H5.5A1.5 1.5 0 0 1 4 18.5Z" />
								<path d="M8 8h7M8 12h7M8 16h4" />
							</svg>
						</span>
						Opskrifter
					</button>
					<button type="button" class="tm-ikon" onclick={() => onkilde('faste')}>
						<span class="i3">
							<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
								<circle cx="12" cy="12" r="8.5" />
								<circle cx="12" cy="12" r="3.8" />
							</svg>
						</span>
						Faste måltider
					</button>
					<button type="button" class="tm-ikon" onclick={() => onkilde('mine')}>
						<span class="i4">
							<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
								<path d="M17 3.5 20.5 7 10 17.5l-4.5 1 1-4.5Z" />
								<path d="M4 20.5h9" />
							</svg>
						</span>
						Mine madvarer
					</button>
				</div>
			{/if}
		</div>
	</div>
</div>
