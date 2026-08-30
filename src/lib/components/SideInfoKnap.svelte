<script lang="ts">
	// Det lille i i hjoernet af en side. Trykker kunden paa det, folder
	// forklaringen sig ud nedefra, saa hun ikke mister siden bagved.
	//
	// Knappen sidder samme sted paa hver side, saa hun laerer ét sted at
	// kigge. Teksterne ligger i content/sideInfo.ts.
	import { getContext } from 'svelte';
	import { sideInfoFor } from '$lib/content/sideInfo';
	import { erForlobsklient } from '$lib/utils/userAdgang';
	import type { UserDoc } from '$lib/types';

	let { noegle }: { noegle: string } = $props();

	// 176 af kunderne har KUN et abonnement og intet forloeb. For dem er en
	// linje om "dit forloeb" ikke bare overfloedig, den er forvirrende, saa
	// de linjer springes over. Se kunForlob i content/sideInfo.ts.
	const getUserDoc = getContext<() => UserDoc | null>('userDoc');
	const paaForlob = $derived(erForlobsklient(getUserDoc?.() ?? null));

	// Knappen bruges til at finde det omraade der faktisk ruller, se nedenfor.
	let knapEl = $state<HTMLButtonElement | null>(null);

	const raa = $derived(sideInfoFor(noegle));
	const info = $derived(
		raa
			? {
					...raa,
					punkter: raa.punkter.filter((p) => !p.kunForlob || paaForlob)
				}
			: null
	);
	let aaben = $state(false);

	function luk() {
		aaben = false;
	}

	/**
	 * Finder det omraade der faktisk ruller.
	 *
	 * Foerste forsoeg laaste document.body, og det gjorde INGEN forskel:
	 * app-rammen er hoej som skaermen og ruller slet ikke, det er et indre
	 * omraade der goer. Derfor gik rulningen videre til baggrunden alligevel.
	 * Linns fund 30. august, anden runde.
	 *
	 * Vi gaar op fra knappen og tager det foerste omraade der baade maa rulle
	 * og faktisk har mere indhold end plads.
	 */
	function findRuller(start: HTMLElement | null): HTMLElement | null {
		let el: HTMLElement | null = start?.parentElement ?? null;
		while (el && el !== document.body) {
			const s = getComputedStyle(el);
			const kanRulle = s.overflowY === 'auto' || s.overflowY === 'scroll';
			if (kanRulle && el.scrollHeight > el.clientHeight + 1) return el;
			el = el.parentElement;
		}
		return document.scrollingElement as HTMLElement | null;
	}

	// Laas det omraade der ruller, mens arket er aabent. Uden det ruller
	// baggrunden under fingeren i stedet for teksten, og kunden kan ikke naa
	// ned til Luk-knappen.
	$effect(() => {
		if (!aaben || typeof document === 'undefined') return;
		const ruller = findRuller(knapEl);
		if (!ruller) return;
		const foer = ruller.style.overflow;
		ruller.style.overflow = 'hidden';
		return () => {
			ruller.style.overflow = foer;
		};
	});

	function paaTast(e: KeyboardEvent) {
		if (e.key === 'Escape') luk();
	}
</script>

<svelte:window onkeydown={paaTast} />

{#if info}
	<button
		class="info-knap"
		type="button"
		bind:this={knapEl}
		onclick={() => (aaben = true)}
		aria-label="Hvad kan jeg her?"
	>
		i
	</button>

	{#if aaben}
		<!-- Baggrunden lukker ved tryk. Selve arket stopper klikket, saa man
		     ikke lukker ved at ramme teksten. -->
		<div
			class="info-bag"
			role="button"
			tabindex="-1"
			aria-label="Luk"
			onclick={luk}
			onkeydown={(e) => e.key === 'Enter' && luk()}
		>
			<div
				class="info-ark"
				role="dialog"
				aria-modal="true"
				aria-label={info.titel}
				tabindex="-1"
				onclick={(e) => e.stopPropagation()}
				onkeydown={(e) => e.stopPropagation()}
			>
				<div class="info-haandtag"></div>
				<div class="info-rul">
					<h2 class="info-titel">{info.titel}</h2>
					<p class="info-tekst">{info.indledning}</p>
					<ul class="info-punkter">
						{#each info.punkter as p (p.tekst)}
							<li>
								{#if p.navn}<strong>{p.navn}</strong>{/if}
								{p.tekst}
							</li>
						{/each}
					</ul>
					{#if info.trin}
						<h3 class="info-trin-titel">{info.trin.overskrift}</h3>
						<ol class="info-trin">
							{#each info.trin.skridt as t (t)}
								<li>{t}</li>
							{/each}
						</ol>
					{/if}
					{#if info.slutning}
						<p class="info-tekst">{info.slutning}</p>
					{/if}
					{#if info.slutningKunForlob && paaForlob}
						<p class="info-tekst">{info.slutningKunForlob}</p>
					{/if}
				</div>
				<button class="info-luk" type="button" onclick={luk}>Luk</button>
			</div>
		</div>
	{/if}
{/if}

<style>
	.info-knap {
		width: 32px;
		height: 32px;
		border-radius: 50%;
		border: 1px solid var(--border2);
		background: var(--white);
		color: var(--terra);
		font-family: var(--ff-d);
		font-size: calc(15px * var(--fs-scale, 1));
		font-weight: 700;
		line-height: 1;
		cursor: pointer;
		flex: none;
	}

	.info-knap:hover {
		border-color: var(--terra);
	}

	.info-knap:focus-visible {
		outline: 2px solid var(--terra);
		outline-offset: 2px;
	}

	.info-bag {
		position: fixed;
		inset: 0;
		z-index: 60;
		background: rgba(53, 35, 24, 0.32);
		display: flex;
		align-items: flex-end;
		justify-content: center;
		border: 0;
		padding: 0;
	}

	/* Arket er en kolonne: haandtag oeverst, teksten ruller i midten, og
	   Luk staar fast nederst. Foer kunne knappen falde under kanten paa en
	   lille skaerm, og saa kunne kunden ikke komme ud. */
	.info-ark {
		width: 100%;
		max-width: 480px;
		background: var(--white);
		border-radius: 20px 20px 0 0;
		padding: 16px 20px calc(22px + env(safe-area-inset-bottom, 0px));
		/* dvh, ikke vh: paa iPhone regner vh med at browserens bjaelker er
		   vaek, saa arket bliver hoejere end skaermen. */
		max-height: 85dvh;
		display: flex;
		flex-direction: column;
		text-align: left;
	}

	.info-rul {
		overflow-y: auto;
		/* Stopper rulningen ved kanten af arket i stedet for at give den
		   videre til siden bagved. */
		overscroll-behavior: contain;
		-webkit-overflow-scrolling: touch;
		margin-bottom: 14px;
	}

	.info-haandtag {
		width: 38px;
		height: 4px;
		border-radius: 99px;
		background: var(--border2);
		margin: 0 auto 16px;
	}

	.info-titel {
		font-family: var(--ff-d);
		font-size: calc(19px * var(--fs-scale, 1));
		font-weight: 700;
		color: var(--text);
		margin: 0 0 10px;
	}

	.info-tekst {
		margin: 0 0 12px;
		font-family: var(--ff-b);
		font-size: calc(13.5px * var(--fs-scale, 1));
		color: var(--text2);
		line-height: 1.6;
	}

	.info-punkter {
		margin: 0 0 12px;
		padding-left: 18px;
		font-family: var(--ff-b);
		font-size: calc(13.5px * var(--fs-scale, 1));
		color: var(--text2);
		line-height: 1.6;
	}

	.info-punkter li {
		margin-bottom: 6px;
	}

	.info-punkter strong {
		color: var(--text);
	}

	.info-trin-titel {
		font-family: var(--ff-b);
		font-size: calc(13px * var(--fs-scale, 1));
		font-weight: 700;
		color: var(--text);
		margin: 0 0 8px;
	}

	/* Nummereret, fordi raekkefoelgen betyder noget her. */
	.info-trin {
		margin: 0 0 12px;
		padding-left: 20px;
		font-family: var(--ff-b);
		font-size: calc(13.5px * var(--fs-scale, 1));
		color: var(--text2);
		line-height: 1.6;
	}

	.info-trin li {
		margin-bottom: 6px;
	}

	.info-luk {
		width: 100%;
		flex: none;
		background: var(--bg2);
		border: 0;
		border-radius: 12px;
		padding: 13px;
		font-family: var(--ff-b);
		font-weight: 700;
		font-size: calc(14px * var(--fs-scale, 1));
		color: var(--text);
		cursor: pointer;
	}

	.info-luk:focus-visible {
		outline: 2px solid var(--terra);
		outline-offset: 2px;
	}
</style>
