<script lang="ts">
	// ============================================================
	// Login til 3.0.
	//
	// HVORFOR DEN FINDES: /ny sendte kunden til /login, som er den GAMLE
	// apps side. Efter login gik den til / og derfra til /app, saa hun
	// skulle skrive /ny i haanden bagefter. Den gamle side er delt mellem
	// begge apper og bruges af de 760 i drift. Den er UROERT.
	//
	// FILNAVNET ER "+page@.svelte" MED ET SNABEL-A, OG DET ER MED VILJE.
	// Snabel-a'et bryder ud af /ny/+layout.svelte og lader siden hoere
	// direkte under rod-layoutet. Uden det ville skallen se en kunde der
	// ikke er logget ind, sende hende til /ny/login, og saa forfra i en
	// uendelig ring. Doeb den ALDRIG om til +page.svelte.
	//
	// Fordi vi staar uden for skallen, tager siden selv ny.css med og
	// saetter selv klassen ny-app. Vite indlaeser kun stilarket én gang.
	//
	// Alt hvad der kan afproeves uden en browser bor i content/login3.ts.
	// ============================================================

	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { VIDERE_NOEGLE3, reneVidere3 } from '$lib/content/videreTil3';
	import {
		createUserWithEmailAndPassword,
		onAuthStateChanged,
		sendPasswordResetEmail,
		signInWithEmailAndPassword,
		type User
	} from 'firebase/auth';
	import { auth } from '$lib/firebase';
	import { createUserDoc } from '$lib/userDoc';
	import { hentAllowedEmail } from '$lib/firestore/forlob';
	import {
		glemtKvittering,
		intetKoebTekst,
		kanSende,
		loginFejlTekst,
		renEmail,
		teksterFor,
		tjekFelter,
		type LoginVisning
	} from '$lib/content/login3';
	import Ventetegn from '$lib/components/ny/Ventetegn.svelte';
	import '../ny.css';

	let visning = $state<LoginVisning>('velkommen');
	let email = $state('');
	let kode = $state('');
	let fejl = $state('');
	let kvittering = $state('');
	let sender = $state(false);

	// Er hun allerede logget ind, har hun ikke noget at goere her.
	// venter holder skaermen tom imens, saa velkomsten ikke blinker forbi.
	let venter = $state(true);

	// Hvor hun var paa vej hen, da hun blev sendt herhen. Kommer fra en
	// besked paa telefonen. Kan den ikke bruges, er den null, og saa
	// lander hun paa forsiden som altid. Se content/videreTil3.
	const videre = $derived(reneVidere3(page.url.searchParams.get(VIDERE_NOEGLE3)) ?? '/ny');
	const kommerFraBesked = $derived(videre !== '/ny');

	onMount(() => {
		return onAuthStateChanged(auth, (u: User | null) => {
			if (u) {
				void goto(videre, { replaceState: true });
				return;
			}
			venter = false;
		});
	});

	const tekster = $derived(teksterFor(visning));
	const klar = $derived(kanSende(visning, email, kode, sender));

	function skift(til: LoginVisning) {
		visning = til;
		fejl = '';
		kvittering = '';
		kode = '';
	}

	async function send() {
		// Vi tjekker selv foerst, saa hun ikke skal vente paa nettet for at
		// faa at vide at et felt er tomt.
		const problem = tjekFelter(visning, email, kode);
		if (problem) {
			fejl = problem;
			return;
		}

		fejl = '';
		kvittering = '';
		sender = true;

		try {
			if (visning === 'glemt') {
				await glemKode();
			} else if (visning === 'opret') {
				await opret();
			} else {
				await signInWithEmailAndPassword(auth, renEmail(email), kode);
				await goto(videre, { replaceState: true });
			}
		} catch (e) {
			fejl = loginFejlTekst(e);
		} finally {
			sender = false;
		}
	}

	/**
	 * Opret konto. Samme regel som den gamle side: kontoen oprettes foerst,
	 * og har vi ikke et koeb paa emailen, slettes den igen med det samme.
	 * Ellers ville der samle sig konti der ikke hoerer til nogen.
	 *
	 * Raekkefoelgen kan ikke vendes om. Firestore-reglerne tillader kun at
	 * slaa allowedEmails op for den der LIGE er logget ind med den email.
	 */
	async function opret() {
		const e = renEmail(email);
		const konto = await createUserWithEmailAndPassword(auth, e, kode);

		const koeb = await hentAllowedEmail(e);
		if (!koeb) {
			try {
				await konto.user.delete();
			} catch (sletFejl) {
				console.warn('[ny] kunne ikke slette den uoenskede konto', sletFejl);
			}
			fejl = intetKoebTekst(e);
			return;
		}

		await createUserDoc(konto.user.uid, konto.user.email ?? e);
		await goto(videre, { replaceState: true });
	}

	/**
	 * Glemt kode. Kvitteringen er den SAMME uanset om emailen findes, saa
	 * siden ikke kan bruges til at gaette hvem der er kunde. Derfor faar en
	 * fejl herfra heller ikke lov at naa skaermen.
	 */
	async function glemKode() {
		const e = renEmail(email);
		try {
			await sendPasswordResetEmail(auth, e);
		} catch (resetFejl) {
			console.warn('[ny] kunne ikke sende nulstillings-mail', resetFejl);
		}
		kvittering = glemtKvittering(e);
	}

	/** Enter i et felt sender, saa hun ikke skal ned og ramme knappen. */
	function paaTast(ev: KeyboardEvent) {
		if (ev.key === 'Enter' && klar) {
			ev.preventDefault();
			void send();
		}
	}
</script>

<svelte:head>
	<title>Log ind · Linns Academy</title>
</svelte:head>

<div class="ny-app">
	<div class="log-side">
		{#if venter}
			<div class="log-venter">
				<Ventetegn variant="fuld" />
			</div>
		{:else if visning === 'velkommen'}
			<div class="log-hoved">
				<span class="log-linn" role="img" aria-label="Linn"></span>
				<h1>Linns Academy</h1>
				<p class="log-mrk">Et roligt sted til mad, træning og de små skridt der holder.</p>
			</div>

			<div class="log-knapper">
				<button class="btn log-knap" onclick={() => skift('login')}>Log ind</button>
				<button class="btn log-knap blank" onclick={() => skift('opret')}>Opret konto</button>
			</div>

			<p class="log-fod">Har du købt et forløb eller appen, bruger du den samme email her.</p>
		{:else}
			<button class="tilbage log-tilbage" onclick={() => skift('velkommen')}>‹ Tilbage</button>

			<div class="log-top">
				<h1>{tekster.titel}</h1>
				{#if kommerFraBesked}
					<!-- Hun kom fra en besked paa telefonen. Uden den her linje
					     staar hun og logger ind uden at vide hvorfor, og saa
					     foeles beskeden som spild. Se HANDOVER 9.41. -->
					<p class="log-mrk">Log ind, så viser jeg dig det du blev sagt til om.</p>
				{:else if tekster.under}
					<p class="log-mrk">{tekster.under}</p>
				{/if}
			</div>

			{#if kvittering}
				<p class="log-kvit">{kvittering}</p>
				<button class="btn log-knap" onclick={() => skift('login')}>Tilbage til log ind</button>
			{:else}
				<label class="log-felt">
					<span class="log-lab">Email</span>
					<input
						type="email"
						bind:value={email}
						onkeydown={paaTast}
						placeholder="dig@eksempel.dk"
						autocomplete="email"
						inputmode="email"
						autocapitalize="none"
						spellcheck="false"
					/>
				</label>

				{#if visning !== 'glemt'}
					<label class="log-felt">
						<span class="log-lab">
							{visning === 'opret' ? 'Vælg en adgangskode' : 'Adgangskode'}
						</span>
						<input
							type="password"
							bind:value={kode}
							onkeydown={paaTast}
							placeholder={visning === 'opret' ? 'Mindst 6 tegn' : ''}
							autocomplete={visning === 'opret' ? 'new-password' : 'current-password'}
						/>
					</label>
				{/if}

				{#if fejl}
					<p class="log-fejl" role="alert">{fejl}</p>
				{/if}

				<button class="btn log-knap" disabled={!klar} onclick={send}>
					{sender ? 'Et øjeblik …' : tekster.knap}
				</button>

				{#if visning === 'login'}
					<button class="log-link" onclick={() => skift('glemt')}>Glemt din adgangskode?</button>
				{/if}

				{#if visning === 'opret'}
					<p class="log-fod">
						Vi tjekker at der ligger et køb på din email. Passer det ikke, siger vi til med det
						samme.
					</p>
				{/if}
			{/if}
		{/if}
	</div>
</div>
