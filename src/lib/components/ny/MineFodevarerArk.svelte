<script lang="ts">
	// ============================================================
	// Hendes egne foedevarer. Se SPEC-3.0.md afsnit 26.12.
	//
	// Den ligner VaelgArk, men kan tre ting det ark ikke kan: lave en ny,
	// rette en hun har, og slette. Foer i dag kunne 3.0 kun vise dem.
	//
	// Sletningen spoerger foerst, og bekraeftelsen ligger inde i selve
	// raekken og ikke i en boks ovenpaa. Arket er portalled ud af
	// .ny-app, og en boks oven paa en boks er der hvor farverne og
	// z-index plejer at gaa galt. Samme moenster som paa de faste
	// maaltider.
	// ============================================================

	import { portal } from '$lib/actions/portal';
	import { underTekst } from '$lib/content/egneFodevarer3';
	import type { Fodevare } from '$lib/content/kost';

	interface Props {
		egne: Fodevare[];
		henter?: boolean;
		/** Vaelg den, altsaa aabn maengde-arket. */
		onvaelg: (id: string) => void;
		onny: () => void;
		onret: (id: string) => void;
		onslet: (id: string) => void;
		onluk: () => void;
	}

	let { egne, henter = false, onvaelg, onny, onret, onslet, onluk }: Props = $props();

	let soegeord = $state('');
	/** Den raekke der spoerger "slet?" lige nu. Kun én ad gangen. */
	let sletId = $state<string | null>(null);

	const traef = $derived.by(() => {
		const q = soegeord.trim().toLowerCase();
		if (!q) return egne;
		return egne.filter((f) => f.name.toLowerCase().includes(q));
	});

	function fokuser(node: HTMLInputElement) {
		// Tastaturet maa ikke springe op af sig selv. Hun vil oftest
		// bladre foerst, og et tastatur ville daekke halvdelen af listen.
		node.blur();
	}

	function slet(id: string) {
		sletId = null;
		onslet(id);
	}
</script>

<!-- ny-tokens: arket flyttes ud af .ny-app, saa farverne skal foelge med. -->
<div class="ark-lag ny-tokens" use:portal role="dialog" aria-modal="true" aria-labelledby="mf-titel">
	<button type="button" class="ark-luk-flade" onclick={onluk} aria-label="Luk"></button>
	<div class="va-ark">
		<div class="ma-greb" aria-hidden="true"></div>
		<button type="button" class="ma-luk" onclick={onluk} aria-label="Luk">×</button>

		<h2 class="va-titel" id="mf-titel">Mine fødevarer</h2>

		{#if egne.length > 0}
			<input
				class="va-soeg"
				type="search"
				bind:value={soegeord}
				use:fokuser
				placeholder="Søg i mine fødevarer"
				aria-label="Søg i mine fødevarer"
			/>
		{/if}

		<button type="button" class="fm-gem-knap mf-ny" onclick={onny}>+ Ny fødevare</button>

		<div class="fm-liste">
			{#if henter}
				<p class="va-tom">Henter</p>
			{:else if egne.length === 0}
				<p class="va-tom">
					Du har ikke lavet nogen egne fødevarer endnu. Dem laver du, når en vare ikke findes i
					forvejen, for eksempel et brød fra din egen bager.
				</p>
			{:else if traef.length === 0}
				<p class="va-tom">Ingen træffer på det ord.</p>
			{:else}
				{#each traef as f (f.id)}
					{#if sletId === f.id}
						<div class="fm-bekraeft">
							<span class="fm-b-t">Slet {f.name}?</span>
							<span class="fm-b-n">
								Det du allerede har registreret bliver stående. Kun genvejen forsvinder.
							</span>
							<div class="fm-b-k">
								<button type="button" class="fm-b-nej" onclick={() => (sletId = null)}>
									Behold
								</button>
								<button type="button" class="fm-b-ja" onclick={() => slet(f.id)}>Slet</button>
							</div>
						</div>
					{:else}
						<div class="fm-kort">
							<button type="button" class="fm-vaelg" onclick={() => onvaelg(f.id)}>
								<span class="fm-navn">{f.name}</span>
								<span class="fm-under">{underTekst(f)}</span>
							</button>
							<button
								type="button"
								class="mf-ret"
								onclick={() => onret(f.id)}
								aria-label="Ret {f.name}">Ret</button
							>
							<button
								type="button"
								class="fm-slet"
								onclick={() => (sletId = f.id)}
								aria-label="Slet {f.name}">×</button
							>
						</div>
					{/if}
				{/each}
			{/if}
		</div>
	</div>
</div>
