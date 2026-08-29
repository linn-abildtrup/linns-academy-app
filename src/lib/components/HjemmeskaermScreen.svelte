<script lang="ts">
	// Skaermen en ny kunde ser foerste gang hun er logget ind. Reglerne
	// for hvornaar den overhovedet vises staar i content/hjemmeskaerm.ts.
	//
	// ÉT TRYK PAA ANDROID: Chrome tilbyder selv at installere appen via
	// beforeinstallprompt. Faar vi den, goer knappen arbejdet for hende i
	// stedet for at bede hende finde menuen. Vi FANGER begivenheden i
	// app-layoutet, ikke her, fordi browseren sender den én gang og
	// tidligt — er skaermen ikke bygget endnu, er den tabt.
	//
	// iPhone kan det ikke. Apple har ingen tilsvarende, saa der er de tre
	// trin den eneste vej, og det er derfor vejledningen altid findes.

	import { onMount } from 'svelte';
	import Button from '$lib/components/Button.svelte';
	import Logo from '$lib/components/Logo.svelte';
	import {
		erApplePhone,
		erSafariPaaIphone,
		hjemmeskaermVejledning,
		type HjemmeskaermVejledning
	} from '$lib/content/hjemmeskaerm';

	interface InstallerBegivenhed extends Event {
		prompt: () => Promise<void>;
		userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
	}

	let {
		installer = null,
		faerdig
	}: {
		/** Chromes tilbud om at installere, hvis vi fik det. */
		installer?: InstallerBegivenhed | null;
		/** Kaldes baade ved "Det er gjort" og "Spring over". */
		faerdig: () => void;
	} = $props();

	let vejledning = $state<HjemmeskaermVejledning>(hjemmeskaermVejledning(false));
	let arbejder = $state(false);

	onMount(() => {
		const agent = navigator.userAgent;
		vejledning = hjemmeskaermVejledning(erApplePhone(agent), erSafariPaaIphone(agent));
	});

	async function etTryk() {
		if (!installer || arbejder) return;
		arbejder = true;
		try {
			await installer.prompt();
			// Uanset hvad hun svarer, er spoergsmaalet stillet. Browseren
			// giver os ikke tilbuddet igen i den her omgang.
			await installer.userChoice;
			faerdig();
		} catch (e) {
			// Afviser browseren boksen, falder hun tilbage paa vejledningen
			// nedenunder i stedet for at staa fast.
			console.warn('[hjemmeskaerm] kunne ikke vise installer-boksen', e);
			arbejder = false;
		}
	}
</script>

<div class="hs-skaerm">
	<div class="hs-indhold">
		<div class="hs-ikon">
			<Logo size="sm" />
		</div>

		<h1 class="hs-titel">Læg appen på din hjemmeskærm</h1>
		<p class="hs-under">
			Så åbner den med ét tryk, ligesom en rigtig app, og du skal ikke lede efter den i browseren
			hver gang.
		</p>

		{#if installer}
			<!-- Android med Chromes tilbud: hun skal ikke finde menuen selv. -->
			<div class="hs-ettryk">
				<Button variant="primary" size="lg" full onclick={etTryk}>
					{arbejder ? 'Vent...' : 'Læg den på hjemmeskærmen'}
				</Button>
				<p class="hs-note">Din telefon spørger om lov, og så er den der.</p>
			</div>
		{:else}
			{#if vejledning.kraeverSafari}
				<p class="hs-safari">{vejledning.kraeverSafari}</p>
			{/if}
			<ol class="hs-trin">
				{#each vejledning.trin as t, i (t)}
					<li class="hs-raekke">
						<span class="hs-nr">{i + 1}</span>
						<span class="hs-tekst">{t}</span>
					</li>
				{/each}
			</ol>
			<p class="hs-note">{vejledning.note}</p>
		{/if}
	</div>

	<div class="hs-bund">
		{#if !installer}
			<Button variant="primary" size="lg" full onclick={faerdig}>Det er gjort</Button>
		{/if}
		<button class="hs-spring" type="button" onclick={faerdig}>Spring over</button>
	</div>
</div>

<style>
	.hs-skaerm {
		min-height: 100dvh;
		background: var(--bg);
		display: flex;
		flex-direction: column;
		padding: 28px 24px 28px;
		max-width: 480px;
		margin: 0 auto;
		width: 100%;
		box-sizing: border-box;
	}

	.hs-indhold {
		flex: 1;
		display: flex;
		flex-direction: column;
		justify-content: center;
	}

	/* Ikonet viser hende hvad hun ender med at faa. */
	.hs-ikon {
		width: 66px;
		height: 66px;
		border-radius: 18px;
		background: var(--white);
		border: 1px solid var(--border);
		display: flex;
		align-items: center;
		justify-content: center;
		margin-bottom: 20px;
		box-shadow: 0 5px 14px rgba(53, 35, 24, 0.09);
		overflow: hidden;
	}

	.hs-titel {
		font-family: var(--ff-d);
		font-size: calc(26px * var(--fs-scale, 1));
		font-weight: 700;
		color: var(--text);
		letter-spacing: -0.01em;
		margin: 0 0 8px;
		line-height: 1.2;
	}

	.hs-under {
		margin: 0 0 22px;
		font-size: calc(14px * var(--fs-scale, 1));
		color: var(--text2);
		line-height: 1.55;
	}

	/* Safari-linjen paa iPhone. Staar for sig, fordi den er forskellen
	   paa at kunne og ikke kunne, ikke et raad. */
	.hs-safari {
		margin: 0 0 14px;
		padding: 12px 14px;
		background: var(--tdim);
		border-radius: var(--r);
		font-size: calc(13px * var(--fs-scale, 1));
		color: var(--text);
		line-height: 1.5;
	}

	.hs-trin {
		list-style: none;
		margin: 0 0 14px;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 9px;
	}

	.hs-raekke {
		display: flex;
		align-items: center;
		gap: 12px;
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: var(--r);
		padding: 13px 15px;
	}

	.hs-nr {
		width: 24px;
		height: 24px;
		border-radius: 50%;
		background: var(--tdim);
		color: var(--terra);
		font-size: calc(12px * var(--fs-scale, 1));
		font-weight: 700;
		display: flex;
		align-items: center;
		justify-content: center;
		flex: none;
	}

	.hs-tekst {
		font-size: calc(14px * var(--fs-scale, 1));
		color: var(--text);
		line-height: 1.45;
	}

	.hs-ettryk {
		margin-bottom: 6px;
	}

	.hs-note {
		margin: 10px 0 0;
		font-size: calc(12.5px * var(--fs-scale, 1));
		color: var(--text3);
		line-height: 1.5;
	}

	.hs-bund {
		padding-top: 24px;
	}

	/* Stilfaerdig med vilje. Hun skal kunne komme videre, men det er
	   ikke den vej vi peger paa. */
	.hs-spring {
		background: none;
		border: none;
		display: block;
		width: 100%;
		text-align: center;
		margin-top: 12px;
		padding: 8px 0;
		font-family: var(--ff-b);
		font-size: calc(13px * var(--fs-scale, 1));
		color: var(--text2);
		text-decoration: underline;
		cursor: pointer;
	}

	.hs-spring:hover {
		color: var(--terra);
	}
</style>
