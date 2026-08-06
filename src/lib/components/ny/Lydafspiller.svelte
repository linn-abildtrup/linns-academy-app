<script lang="ts">
	// ============================================================
	// Lyd-afspilleren i 3.0. Sidder INDE paa lektionssiden, ikke som en
	// skaerm der laegger sig over. Hun skal kun trykke ét sted.
	//
	// Tre ting den kan, som er svaere at undvaere:
	//   husker hvor hun slap, ogsaa hvis hun lukker appen midt i
	//   kan styres fra telefonens laaseskaerm, uden at laase op
	//   siger til naar lyden er hoert faerdig, saa fluebenet er aerligt
	//
	// Noeglen til hukommelsen er den SAMME som den gamle afspiller bruger,
	// saa en kunde der flyttes over, fortsaetter praecis hvor hun slap.
	// ============================================================

	import { onDestroy, onMount } from 'svelte';

	interface Props {
		url: string;
		titel: string;
		/** Kaldes naar lyden er spillet helt til ende. */
		onfaerdig?: () => void;
	}

	let { url, titel, onfaerdig }: Props = $props();

	let lyd = $state<HTMLAudioElement | null>(null);
	let spiller = $state(false);
	let tid = $state(0);
	let laengde = $state(0);
	let fart = $state(1);
	let fejl = $state('');
	let klar = $state(false);

	const FARTER = [1, 1.2, 1.5];
	const POS_NOEGLE = $derived(`la_audio_pos:${url}`);

	function gemPosition() {
		if (!lyd || typeof localStorage === 'undefined') return;
		const t = lyd.currentTime;
		if (!Number.isFinite(t) || t < 1) return;
		try {
			localStorage.setItem(POS_NOEGLE, String(t));
		} catch {
			// Fuldt lager eller privat browsing. Lyden virker stadig.
		}
	}

	function rydPosition() {
		if (typeof localStorage === 'undefined') return;
		try {
			localStorage.removeItem(POS_NOEGLE);
		} catch {
			// ligegyldigt
		}
	}

	function genoptag() {
		if (!lyd || typeof localStorage === 'undefined') return;
		try {
			const gemt = localStorage.getItem(POS_NOEGLE);
			if (!gemt) return;
			const t = Number(gemt);
			// Sad hun helt til sidst, starter vi forfra i stedet for at
			// smide hende ind i de sidste to sekunder.
			if (Number.isFinite(t) && t > 0 && t < lyd.duration - 3) lyd.currentTime = t;
		} catch {
			// ligegyldigt
		}
	}

	async function skiftAfspil() {
		if (!lyd) return;
		fejl = '';
		try {
			if (lyd.paused) {
				await lyd.play();
			} else {
				lyd.pause();
			}
		} catch (e) {
			console.warn('[ny] lyden kunne ikke starte', e);
			fejl = 'Lyden kunne ikke starte. Prøv at trykke igen.';
		}
	}

	function spol(sekunder: number) {
		if (!lyd) return;
		lyd.currentTime = Math.max(0, Math.min(lyd.duration || 0, lyd.currentTime + sekunder));
		gemPosition();
	}

	function skiftFart() {
		const i = FARTER.indexOf(fart);
		fart = FARTER[(i + 1) % FARTER.length];
		if (lyd) lyd.playbackRate = fart;
	}

	function hop(e: Event) {
		const felt = e.currentTarget as HTMLInputElement;
		if (!lyd) return;
		lyd.currentTime = Number(felt.value);
		gemPosition();
	}

	function formater(sekunder: number): string {
		if (!Number.isFinite(sekunder) || sekunder < 0) return '0:00';
		const m = Math.floor(sekunder / 60);
		const s = Math.floor(sekunder % 60);
		return `${m}:${String(s).padStart(2, '0')}`;
	}

	/** Telefonens egen betjening paa laaseskaermen. */
	function saetLaaseskaerm() {
		if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
		try {
			navigator.mediaSession.metadata = new MediaMetadata({
				title: titel,
				artist: 'Linns Academy',
				artwork: [{ src: '/linn.jpg', sizes: '320x320', type: 'image/jpeg' }]
			});
			navigator.mediaSession.setActionHandler('play', () => void skiftAfspil());
			navigator.mediaSession.setActionHandler('pause', () => void skiftAfspil());
			navigator.mediaSession.setActionHandler('seekbackward', () => spol(-15));
			navigator.mediaSession.setActionHandler('seekforward', () => spol(30));
		} catch {
			// Ikke alle browsere kan det. Afspilleren virker uanset.
		}
	}

	onMount(() => {
		// iOS gemmer ikke ved unload, men den fyrer pagehide. Uden det
		// mister hun sin plads, hver gang hun skifter app.
		const gem = () => gemPosition();
		window.addEventListener('pagehide', gem);
		document.addEventListener('visibilitychange', gem);
		return () => {
			window.removeEventListener('pagehide', gem);
			document.removeEventListener('visibilitychange', gem);
		};
	});

	onDestroy(() => gemPosition());
</script>

<audio
	bind:this={lyd}
	src={url}
	preload="metadata"
	onloadedmetadata={() => {
		laengde = lyd?.duration ?? 0;
		genoptag();
		klar = true;
		saetLaaseskaerm();
	}}
	ontimeupdate={() => (tid = lyd?.currentTime ?? 0)}
	onplay={() => (spiller = true)}
	onpause={() => {
		spiller = false;
		gemPosition();
	}}
	onended={() => {
		spiller = false;
		rydPosition();
		onfaerdig?.();
	}}
	onerror={() => (fejl = 'Lydfilen kunne ikke hentes.')}
></audio>

<section class="lyd-side">
	<div class="lyd-plade">
		<span class="lyd-portraet" role="img" aria-label="Linn"></span>
	</div>

	<div class="lyd-spor">
		<input
			type="range"
			min="0"
			max={laengde || 0}
			step="1"
			value={tid}
			oninput={hop}
			aria-label="Spol i lyden"
			disabled={!klar}
		/>
		<div class="lyd-tider">
			<span>{formater(tid)}</span>
			<span>-{formater(Math.max(0, laengde - tid))}</span>
		</div>
	</div>

	<div class="lyd-knapper">
		<button class="lyd-spol" onclick={() => spol(-15)} aria-label="Spol 15 sekunder tilbage">
			15<span>SEK</span>
		</button>
		<button
			class="lyd-afspil"
			onclick={skiftAfspil}
			aria-label={spiller ? 'Sæt på pause' : 'Afspil'}
		>
			{spiller ? '❚❚' : '▶'}
		</button>
		<button class="lyd-spol" onclick={() => spol(30)} aria-label="Spol 30 sekunder frem">
			30<span>SEK</span>
		</button>
	</div>

	<div class="lyd-fart-raekke">
		<button class="lyd-fart" onclick={skiftFart} aria-label="Skift hastighed">
			{fart.toString().replace('.', ',')}×
		</button>
	</div>

	{#if fejl}
		<p class="fejl" role="alert">{fejl}</p>
	{/if}
</section>
