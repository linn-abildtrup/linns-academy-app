<script lang="ts">
	// ============================================================
	// Skallen til Linns Academy 3.0. Se SPEC-3.0.md afsnit 5.2.
	//
	// Denne rute er HELT adskilt fra /app. Der er bevidst INGEN
	// omdirigering fra det gamle layout hertil, fordi den eksisterende
	// app ikke maa aendres. Kunder med flaget faar linket direkte.
	//
	// Skallen genbruger alle eksisterende lib-moduler ved at LAESE dem.
	// Ingen af dem er aendret.
	// ============================================================

	import { goto } from '$app/navigation';
	import { onMount, setContext } from 'svelte';
	import { page } from '$app/state';
	import { onAuthStateChanged, type User } from 'firebase/auth';
	import { auth } from '$lib/firebase';
	import { getUserDoc, lytTilUserDoc } from '$lib/userDoc';
	import { hentForlob } from '$lib/firestore/forlob';
	import { produktTypeForForlob } from '$lib/content/forlobAdgang';
	import { isAdmin } from '$lib/admin';
	import type { UserDoc } from '$lib/types';
	import type { ForlobKilde, NulDageKilde } from '$lib/content/adgang3';
	import { hentNulDage } from '$lib/firestore/nulDage3';
	import Maerke from '$lib/components/ny/Maerke.svelte';
	import { bonusBaandTekst, maaSeIBonus, naadeTekst, BONUS_START } from '$lib/content/spaerring3';
	import { opstartsBillede, maaAabnePaaKopi3 } from '$lib/content/hurtigStart3';
	import { hentOpstartFraCache } from '$lib/firestore/hurtigStart3';
	import { tidsgraense, HURTIG_START_MS } from '$lib/content/hurtigStart';
	import { APP_KOB_URL } from '$lib/content/abonnement';
	import { tekstSkalaFra3 } from '$lib/content/onboarding3';
	import { anvendScale, gemScale, laesGemtScale } from '$lib/utils/textScale';
	import Ventetegn from '$lib/components/ny/Ventetegn.svelte';
	import './ny.css';

	let { children } = $props();

	// Flag-noeglen der giver adgang til 3.0 bor nu i content/hurtigStart3.ts
	// som NY_APP_FLAG, saa den hurtige opstart og skallen bruger den samme.

	let user = $state<User | null>(null);
	let userDoc = $state<UserDoc | null>(null);
	let forlob = $state<ForlobKilde[]>([]);
	/** Kundens pause-dage pr produkt. Tom for alle andre end Kropsro. */
	let nulDage = $state<NulDageKilde>({});
	let loading = $state(true);

	// Adgangsbilledet og spaerringen opgoeres ét sted, i content/hurtigStart3.ts.
	// Udregningerne er praecis de samme som foer, de er bare flyttet ud af
	// skallen saa den hurtige opstart kan stille NOEJAGTIG samme spoergsmaal om
	// den lokale kopi som skallen stiller om serverens svar. To udgaver af den
	// regel ville kunne drive fra hinanden, og saa ville kopien og serveren vise
	// hver sin skaerm.
	//
	// Spaerringen ligger stadig HER og kun her, saa der er ét sted at kigge og
	// ingen underside kan slippe nogen ind ad en bagdoer. Se spaerring3.ts.
	const billede = $derived(
		opstartsBillede({ userDoc, forlob, nulDage, erAdmin: isAdmin(user) }, Date.now())
	);

	const adgang = $derived(billede.adgang);
	const spaerring = $derived(billede.spaerring);
	const maaSeNyApp = $derived(billede.maaSeNyApp);
	const erSpaerret = $derived(billede.erSpaerret);

	// ── De 90 dage efter et forloeb. Se SPEC 35 ────────────────
	//
	// Hun har ikke koebt app-adgang, men hun har krav paa alt materialet i
	// 90 dage: opskrifter, lektioner, oevelser, FAQ, og sin egen udvikling.
	// Hun kan ikke registrere noget, for der er ikke noget forloeb at maale
	// paa, og derfor er baade forsiden, 30-30 og Beskeder lukket.
	//
	// Foer det her kendte porten kun abonnement og forloeb. Hun blev lukket
	// ude paa dag 1 i stedet for dag 91.
	const erBonus = $derived(billede.tilstand === 'bonus');
	const bonusSlutMs = $derived(userDoc?.bonusPeriodEndsAt ?? null);

	/**
	 * Sender hende tilbage til sin egen side hvis hun staar et sted hun
	 * ikke maa vaere i de 90 dage.
	 *
	 * Det sker HER og kun her, saa der er ét sted at kigge og ingen
	 * underside kan slippe nogen ind ad en bagdoer. Samme princip som
	 * spaerringen ovenfor. Hvidlisten staar i spaerring3.
	 */
	$effect(() => {
		if (loading || !erBonus) return;
		const sti = page.url.pathname;
		if (maaSeIBonus(sti)) return;
		void goto(BONUS_START, { replaceState: true });
	});

	// Skriftstoerrelsen. Rod-layoutet laeser den fra browseren ved opstart,
	// men det valg findes ikke paa en ny telefon. Her sættes den fra hendes
	// konto, saa den foelger med. Det er BEVIDST det eneste nye i skallen:
	// det er et lokalt attribut-skift uden ét eneste netvaerkskald, altsaa
	// ikke det der vaeltede appen 11. august. Se onboarding3.ts.
	$effect(() => {
		const valgt = tekstSkalaFra3(userDoc);
		if (!userDoc || valgt === laesGemtScale()) return;
		anvendScale(valgt);
		gemScale(valgt);
	});

	setContext('userDoc', () => userDoc);
	setContext('user', () => user);
	setContext('adgang', () => adgang);
	// Hvilken af de tre tilstande hun er i, saa siderne kan skjule det der
	// ikke virker i de 90 dage. Porten ligger stadig kun i skallen: det
	// her er til udseendet, ikke til adgangen. Se SPEC 35.
	setContext('tilstand', () => billede.tilstand);
	// Forsiden bruger de raa forloebs-dokumenter til at tegne baandene paa
	// kurven, saa den ikke skal hente dem igen.
	setContext('forlob', () => forlob);

	/** Henter de forloebs-dokumenter kunden er tilmeldt. Kun laesning. */
	async function indlaesForlob(ids: string[]): Promise<ForlobKilde[]> {
		const hentet = await Promise.all(
			ids.map(async (id) => {
				try {
					const f = await hentForlob(id);
					if (!f?.startDato) return null;
					return {
						id: f.id,
						navn: f.navn,
						startMs: f.startDato.toDate().getTime(),
						antalDage: f.antalDage,
						produkt: produktTypeForForlob(f)
					} satisfies ForlobKilde;
				} catch (e) {
					console.warn('[ny] kunne ikke hente forloeb', id, e);
					return null;
				}
			})
		);
		return hentet.filter((f): f is ForlobKilde => f !== null);
	}

	onMount(() => {
		let userDocUnsubscribe: (() => void) | null = null;

		const authUnsubscribe = onAuthStateChanged(auth, async (u) => {
			if (!u) {
				userDocUnsubscribe?.();
				userDocUnsubscribe = null;
				// 3.0 har sin egen login-side. Den gamle /login er delt med den
				// app der er i drift og bliver staaende uroert. Login-siden
				// ligger BEVIDST uden for det her layout, se filnavnet
				// ny/login/+page@.svelte, ellers ville den sende sig selv i ring.
				await goto('/ny/login');
				return;
			}

			user = u;

			// Hele opstarts-billedet fra kundens egen kopi. Laeses lokalt og
			// koster intet netvaerk. Tom er helt normalt foerste gang hun logger
			// ind paa en enhed. Se firestore/hurtigStart3.ts.
			const kopi = await hentOpstartFraCache(u.uid);
			const kopiDuer = maaAabnePaaKopi3({ ...kopi, erAdmin: isAdmin(u) }, Date.now());

			// Den rigtige kaede. Indholdet er uaendret, den er bare pakket saa vi
			// kan holde den op mod et ur nedenfor.
			const kaeden = (async () => {
				const doc = await getUserDoc(u.uid);
				let hentedeForlob: ForlobKilde[] = [];
				let hentedeNulDage: NulDageKilde = {};

				if (doc?.forlobIds?.length) {
					hentedeForlob = await indlaesForlob(doc.forlobIds);
					// Pause-dage skal med, ellers staar dagnummeret forkert for
					// den kunde der har holdt fri. Kun Kropsro kan holde pause,
					// saa for alle andre koster det her nul opslag.
					hentedeNulDage = await hentNulDage(
						u.uid,
						hentedeForlob.map((f) => f.produkt)
					);
				}

				return { userDoc: doc, forlob: hentedeForlob, nulDage: hentedeNulDage };
			})();

			// Hurtig opstart. Kaeden er tre ture til serveren efter hinanden,
			// bruger-dokument, saa forloeb, saa pause-dage, og foer laa der ingen
			// tidsgraense paa dem. Var forbindelsen der, men doed, stod kunden med
			// "Et oejeblik, jeg lukker dig ind" i lang tid, selv om kopien laa
			// klar hele tiden.
			//
			// Paa en normal forbindelse er kaeden hjemme foerst og vinder
			// kapløbet, og saa sker der intet nyt overhovedet. Se
			// content/hurtigStart3.ts for reglen og begrundelsen bag tallet.
			if (kopiDuer) {
				const udfald = await Promise.race([
					kaeden.then(() => 'kaeden' as const).catch(() => 'kaeden' as const),
					tidsgraense(HURTIG_START_MS)
				]);
				if (udfald === 'tid') {
					userDoc = kopi.userDoc;
					forlob = kopi.forlob;
					nulDage = kopi.nulDage;
					loading = false;
				}
			}

			// Serveren har altid det sidste ord. Naar kaeden lander, overskriver
			// den kopien, og de $derived der laeser userDoc, forlob og nulDage
			// regner sig selv om.
			try {
				const svar = await kaeden;
				userDoc = svar.userDoc;
				forlob = svar.forlob;
				nulDage = svar.nulDage;
			} catch (e) {
				// Kunne slet ikke naa serveren. Har vi en brugbar kopi, er kunden
				// allerede lukket ind ovenfor og arbejder videre paa den. Har vi
				// ingen, er der intet at vise, og vi lader fejlen gaa videre.
				console.warn('[ny] kunne ikke hente opstarten fra serveren:', e);
				if (!kopiDuer) throw e;
			}

			loading = false;

			userDocUnsubscribe?.();
			userDocUnsubscribe = lytTilUserDoc(u.uid, (ny) => {
				if (ny) userDoc = ny;
			});
		});

		return () => {
			authUnsubscribe();
			userDocUnsubscribe?.();
		};
	});

	// ── Datoen i toppen ─────────────────────────────────────────
	// Appen staar aaben i dagevis paa en telefon. Laeses tidspunktet kun
	// én gang ved indlaesning, viser toppen gaarsdagens dato naeste
	// morgen. Samme problem og samme loesning som paa forsiden.
	let nu = $state(new Date());

	onMount(() => {
		const opdater = () => {
			if (document.visibilityState === 'visible') nu = new Date();
		};
		document.addEventListener('visibilitychange', opdater);
		window.addEventListener('focus', opdater);
		return () => {
			document.removeEventListener('visibilitychange', opdater);
			window.removeEventListener('focus', opdater);
		};
	});

	const datoTekst = $derived(
		new Intl.DateTimeFormat('da-DK', { weekday: 'long', day: 'numeric', month: 'long' })
			.format(nu)
			.replace(' den ', ' · ')
			.replace(/^(\w)/, (c) => c.toUpperCase())
	);

	// Ikonet vaelges paa ikon-noeglen og IKKE paa navnet. Foer stod der
	// navnet i hver gren, og saa mistede fanen sit ikon i samme oejeblik
	// nogen doebte den om. Set da Profil blev til Din side.
	const ALLE_FANER = [
		{ href: '/ny', navn: 'Forside', ikon: 'hus' },
		{ href: '/ny/30-30', navn: '30-30', ikon: 'skaal' },
		{ href: '/ny/traening', navn: 'Træning', ikon: 'vaegt' },
		{ href: '/ny/beskeder', navn: 'Beskeder', ikon: 'boble' },
		{ href: '/ny/udvikling', navn: 'Udvikling', ikon: 'draabe' },
		{ href: '/ny/profil', navn: 'Din side', ikon: 'person' }
	];

	/**
	 * Menuen i de 90 dage. Kun de to der foerer et sted hen.
	 *
	 * Fem faner hvor de tre sender hende tilbage med det samme er vaerre
	 * end to der virker. Hun skal ikke skulle laere hvad der er lukket ved
	 * at proeve.
	 */
	const faner = $derived(erBonus ? ALLE_FANER.filter((f) => maaSeIBonus(f.href)) : ALLE_FANER);

	function erAktiv(href: string): boolean {
		return href === '/ny' ? page.url.pathname === '/ny' : page.url.pathname.startsWith(href);
	}
</script>

<div class="ny-app">
	{#if loading}
		<div class="ny-besked">
			<Ventetegn variant="fuld" />
			<p class="vente-linje">Et øjeblik, jeg lukker dig ind.</p>
		</div>
	{:else if !maaSeNyApp}
		<div class="ny-besked">
			<h1>Ikke åben endnu</h1>
			<p>
				Den nye app er under opbygning og er kun åben for udvalgte testere. Du finder din sædvanlige
				app på det vante sted.
			</p>
			<a class="btn" href="/app">Gå til appen</a>
		</div>
	{:else if erSpaerret}
		<!-- Roligt, ikke en fejlmeddelelse. Hun har ikke gjort noget
		     forkert, abonnementet er bare loebet ud. Se spaerring3.ts. -->
		<div class="ny-besked">
			<h1>Din adgang er udløbet</h1>
			<p>
				Dit abonnement er ikke længere aktivt, så appen er lukket for nu. Alt hvad du har
				registreret, ligger stadig og venter på dig, og det kommer tilbage i samme øjeblik du
				fornyer.
			</p>
			<a class="btn" href={APP_KOB_URL} target="_blank" rel="noopener">Forny dit abonnement</a>
			<p class="spaer-hjaelp">
				Har du lige fornyet, så giv det et øjeblik og hent siden igen. Passer det ikke, så skriv til
				Linn, så retter hun det.
			</p>
		</div>
	{:else}
		<div class="ny-shell">
			{#if erBonus && bonusSlutMs !== null}
				<!-- De 90 dage. Baandet siger hvad hun HAR og ikke hvad hun
				     har mistet. Hun har lige gennemfoert et forloeb, og det
				     foerste hun moeder maa ikke vaere en regning. -->
				<div class="naade-baand bonus-baand">
					<span>{bonusBaandTekst(bonusSlutMs, Date.now())}</span>
					<a href={APP_KOB_URL} target="_blank" rel="noopener">Behold det</a>
				</div>
			{:else if spaerring.iNaade}
				<!-- Hun er inde paa naade. Hun skal vide det, saa hun naar at
				     forny, men hun skal ikke spaerres midt i det hun laver. -->
				<div class="naade-baand">
					<span>{naadeTekst(spaerring.dageTilbageAfNaade)}</span>
					<a href={APP_KOB_URL} target="_blank" rel="noopener">Forny</a>
				</div>
			{/if}
			<!-- TOPPEN LIGGER UDEN FOR DET DER RULLER, praecis som
			     bundmenuen. Derfor kan den slet ikke gynge, og vi behoever
			     hverken position: fixed eller at skubbe indholdet ned.
			     Linns oenske 20. august: den skal sidde fast som menuen.

			     Der staar KUN navnet og datoen. Sidens egen titel bliver
			     staaende nede i indholdet og ruller med. -->
			<header class="ny-top">
				<Maerke variant="fuld" link={true} />
				<span class="ny-top-dato">{datoTekst}</span>
			</header>

			<div class="ny-scroll">
				{@render children()}
			</div>

			<nav class="ny-nav" aria-label="Hovedmenu">
				{#each faner as fane (fane.href)}
					<a
						href={fane.href}
						class:active={erAktiv(fane.href)}
						aria-current={erAktiv(fane.href) ? 'page' : undefined}
					>
						{#if fane.ikon === 'hus'}
							<svg
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="1.9"
								stroke-linecap="round"
								stroke-linejoin="round"
								aria-hidden="true"
							>
								<path d="M3 10.5L12 4l9 6.5" /><path d="M5 9.5V20h14V9.5" />
							</svg>
						{:else if fane.ikon === 'skaal'}
							<!-- En skaal med damp. 30-30 handler om mad, ikke om moduler,
							     saa firkanterne fra Moduler passede ikke laengere. -->
							<svg
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="1.9"
								stroke-linecap="round"
								stroke-linejoin="round"
								aria-hidden="true"
							>
								<path d="M3.5 11.5h17a8.5 8.5 0 0 1-8.5 8.5 8.5 8.5 0 0 1-8.5-8.5Z" />
								<path d="M9 7.5c0-1.2 1.2-1.6 1.2-2.8S9 3 9 3" />
								<path d="M14.2 7.5c0-1.2 1.2-1.6 1.2-2.8s-1.2-1.7-1.2-1.7" />
							</svg>
						{:else if fane.ikon === 'vaegt'}
							<!-- En kettlebell: kuglen med haandtaget paa. -->
							<svg
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="1.9"
								stroke-linecap="round"
								stroke-linejoin="round"
								aria-hidden="true"
							>
								<path d="M8.5 8.4a3.5 3.5 0 1 1 7 0" />
								<path
									d="M9.6 8.2C6.9 9.4 5.2 12 5.2 15c0 1.9.6 3.4 1.2 4.3h11.2c.6-.9 1.2-2.4 1.2-4.3 0-3-1.7-5.6-4.4-6.8z"
								/>
							</svg>
						{:else if fane.ikon === 'boble'}
							<svg
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="1.9"
								stroke-linecap="round"
								stroke-linejoin="round"
								aria-hidden="true"
							>
								<path
									d="M6.5 4h11A2.5 2.5 0 0 1 20 6.5v7a2.5 2.5 0 0 1-2.5 2.5H11l-4 3v-3h-.5A2.5 2.5 0 0 1 4 13.5v-7A2.5 2.5 0 0 1 6.5 4Z"
								/>
							</svg>
						{:else if fane.ikon === 'draabe'}
							<svg
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="1.9"
								stroke-linecap="round"
								stroke-linejoin="round"
								aria-hidden="true"
							>
								<path
									d="M12 3c1 3-1 5-2 6.5C8.5 11 8 12.5 8 14a4 4 0 0 0 8 0c0-1.2-.4-2.3-1-3 .2 1.2-.6 2-1.3 2 .8-2 .3-4-1.7-6.5-.3 1-1 1.6-2 2 1-2.2.3-4.5 0-5.5z"
								/>
							</svg>
						{:else}
							<svg
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="1.9"
								stroke-linecap="round"
								stroke-linejoin="round"
								aria-hidden="true"
							>
								<circle cx="12" cy="8" r="4" /><path d="M5 21c0-3.87 3.13-7 7-7s7 3.13 7 7" />
							</svg>
						{/if}
						{fane.navn}
					</a>
				{/each}
			</nav>
		</div>
	{/if}
</div>
