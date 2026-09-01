<script lang="ts">
	// ============================================================
	// Den lille afspiller til en lydbesked. Én linje: play, en bjaelke og
	// hvor lang den er.
	//
	// DEN SAMME KLODS BEGGE STEDER. Linn hoerer beskeden igennem paa
	// admin-skaermen foer hun sender, og kunden hoerer den i sin traad. To
	// afspillere ville vaere to udseender, og saa er det ikke sikkert at
	// det Linn hoerte er det kunden faar.
	//
	// IKKE den store Lydafspiller fra lektionerne. Den har plade, fart og
	// hukommelse for hvor man slap, fordi en lektion er tyve minutter man
	// vender tilbage til. En besked er ét minut man hoerer én gang.
	//
	// Bygget 1. september 2026.
	// ============================================================

	import { formaterSekunder } from '$lib/content/beskedFil3';

	interface Props {
		url: string;
		/** Laengden fra da beskeden blev sendt. Vises foer filen er hentet. */
		sekunder?: number;
		/** Staar til venstre for tiden. */
		maerkat?: string;
	}

	let { url, sekunder = 0, maerkat = 'Lydbesked' }: Props = $props();

	let lyd = $state<HTMLAudioElement | null>(null);
	let spiller = $state(false);
	let tid = $state(0);
	let laengde = $state(0);
	let fejl = $state('');

	// Laengden vi FIK er den vi viser, indtil filen selv siger noget andet.
	// Ellers staar der 0:00 til hun trykker, og saa ved hun ikke om det er
	// et halvt minut eller fem.
	const vist = $derived(laengde || sekunder);
	const andel = $derived(vist > 0 ? Math.min(100, (tid / vist) * 100) : 0);

	function vip() {
		if (!lyd) return;
		if (spiller) {
			lyd.pause();
			return;
		}
		void lyd.play().catch(() => (fejl = 'Lyden kunne ikke afspilles.'));
	}
</script>

<audio
	bind:this={lyd}
	src={url}
	preload="metadata"
	onloadedmetadata={() => {
		const d = lyd?.duration ?? 0;
		// Optagelser fra browseren melder nogle gange Infinity som laengde.
		// Saa beholder vi den vi fik med beskeden.
		if (Number.isFinite(d) && d > 0) laengde = d;
	}}
	ontimeupdate={() => (tid = lyd?.currentTime ?? 0)}
	onplay={() => (spiller = true)}
	onpause={() => (spiller = false)}
	onended={() => {
		spiller = false;
		tid = 0;
	}}
	onerror={() => (fejl = 'Lyden kunne ikke hentes.')}
></audio>

<div class="lb">
	<button
		type="button"
		class="lb-play"
		onclick={vip}
		aria-label={spiller ? 'Sæt på pause' : 'Afspil lydbeskeden'}
	>
		{spiller ? '❙❙' : '▶'}
	</button>
	<div class="lb-midt">
		<div class="lb-bjaelke"><i style="width:{andel}%"></i></div>
		<div class="lb-meta">
			<span>{fejl || maerkat}</span>
			<span>{formaterSekunder(spiller || tid > 0 ? tid : vist)}</span>
		</div>
	</div>
</div>

<style>
	.lb {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 10px 12px;
		background: var(--oat, #f1eadf);
		border-radius: 14px;
	}

	.lb-play {
		width: 34px;
		height: 34px;
		flex-shrink: 0;
		border: 0;
		border-radius: 50%;
		background: var(--plum, #7c4f63);
		color: #fff;
		font-size: calc(12px * var(--fs-scale, 1));
		line-height: 1;
		cursor: pointer;
	}

	.lb-midt {
		flex: 1;
		min-width: 0;
	}

	.lb-bjaelke {
		height: 4px;
		border-radius: 3px;
		background: #ded0bd;
		overflow: hidden;
		margin-bottom: 5px;
	}

	.lb-bjaelke i {
		display: block;
		height: 100%;
		border-radius: 3px;
		background: var(--plum, #7c4f63);
	}

	.lb-meta {
		display: flex;
		justify-content: space-between;
		gap: 8px;
		font-size: calc(11px * var(--fs-scale, 1));
		color: var(--ink-3, #a3948a);
	}
</style>
