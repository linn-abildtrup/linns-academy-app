<script lang="ts">
	// ============================================================
	// "Beskeder" i 3.0. Kundens samtale med Linn AI, og de spoergsmaal
	// hun har sendt videre til Linn selv.
	//
	// Lagt sammen 16. august 2026, Linns beslutning: det er det samme i
	// hendes verden. Derfor én side med to faner, praecis som den gamle
	// app goer. Ordet Snak er droppet, /ny/snak sender hertil.
	//
	// TRE REGLER DER ER DYRE AT GENOPDAGE:
	//
	// 1. Vejen ind til Linn gaar gennem AI'en. Der findes IKKE et
	//    skrivefelt paa fanen Linn. Hun spoerger AI'en, og er hun ikke
	//    tilfreds, sender hun netop DET spoergsmaal videre.
	// 2. Adgangen kommer fra content/beskedside3.ts og IKKE fra det
	//    delte adgangs-skema. Skemaet styrer ogsaa den gamle app.
	// 3. Samtalen GEMMES. Uden det stod hendes spoergsmaal og forsvandt,
	//    mens Linns svar blev liggende, paa den samme skaerm.
	//
	// SIKKERHEDS-PROCENTEN VISES TIL KUNDEN, fra 4. september. Her stod
	// foer det modsatte. Linns beslutning: 3.0 skal sige det samme som den
	// gamle app, hvor de 925 kunder har set tallet hele tiden.
	// Ordlyden ligger i content/aiSikkerhed3.ts.
	// ============================================================

	import { getContext, onMount, tick } from 'svelte';
	import { husk, husket } from '$lib/content/sidehukommelse3';
	import { page } from '$app/state';
	import type { User } from 'firebase/auth';
	import type { UserDoc } from '$lib/types';
	import type { Adgangsbillede } from '$lib/content/adgang3';
	import { gemSpoergsmaal, SPOERGSMAAL_MAX_LAENGDE } from '$lib/firestore/spoergsmaal';
	import {
		aabenSamtale3,
		gemUdveksling3,
		hentLinnTraade3,
		hentTidligereSamtale3,
		harSvarIndhold3,
		markerLinnSvarLaest3,
		tidligereSamtaler3,
		tilSvarKilder3,
		type LinnTraad3,
		type TidligereSamtale3
	} from '$lib/firestore/beskedside3';
	import {
		beskedAdgang3,
		beskedFaner3,
		dagLabel3,
		erSendtVidere3,
		grupperEfterDag3,
		tilChatTraade3,
		harNytSvar3,
		kanSendeVidere3,
		startFane3,
		visFaneraekke3,
		type BeskedFane3,
		type SamtaleBesked3
	} from '$lib/content/beskedside3';
	import { delOpILinks } from '$lib/content/linkTekst3';
	import { sikkerhedsLinje3 } from '$lib/content/aiSikkerhed3';
	import { rullendeElement3 } from '$lib/utils/rulning3';
	import { udenFormateringstegn } from '$lib/content/linnAi';
	import Venter from '$lib/components/ny/Venter.svelte';
	// Ventetegnet bruges stadig alene i "Taenker"-boblen: den er en besked i
	// samtalen og ikke en vente-skaerm, saa den skal ikke have linjen om at
	// det traekker ud.
	import Ventetegn from '$lib/components/ny/Ventetegn.svelte';
	import Lydbesked from '$lib/components/ny/Lydbesked.svelte';
	import BilledeLag from '$lib/components/ny/BilledeLag.svelte';
	import Fluebe from '$lib/components/ny/Fluebe.svelte';
	import Sidehoved from '$lib/components/ny/Sidehoved.svelte';

	const hentUser = getContext<() => User | null>('user');
	const hentUserDoc = getContext<() => UserDoc | null>('userDoc');
	const hentAdgang = getContext<() => Adgangsbillede>('adgang');

	const user = $derived(hentUser());
	const userDoc = $derived(hentUserDoc());
	const adgangsbillede = $derived(hentAdgang());
	const aktivtForlob = $derived(adgangsbillede.aktiveForlob[0] ?? null);

	// Reglen ligger i 3.0 og koster ingen hentning. Se beskedside3.ts.
	const adgang = $derived(beskedAdgang3(!!aktivtForlob));
	const faner = $derived(beskedFaner3(adgang));
	const visFaner = $derived(visFaneraekke3(faner));

	let valgtFane = $state<BeskedFane3 | null>(null);
	const fane = $derived(valgtFane ?? startFane3(faner, page.url.searchParams.get('fane')));

	// ── Samtalen ────────────────────────────────────────────
	let samtaleId = $state<string | null>(null);
	let beskeder = $state<SamtaleBesked3[]>([]);
	let henterSamtale = $state(true);
	let input = $state('');
	let sender = $state(false);
	let fejl = $state('');
	let rulle = $state<HTMLDivElement | null>(null);

	// Tidligere samtaler. Hentes foerst naar hun trykker, for de fleste
	// har kun én og skal ikke betale for et opslag de aldrig bruger.
	let tidligere = $state<TidligereSamtale3[]>([]);
	let antalTidligere = $state(0);
	let viserTidligere = $state(false);
	let laesteSamtaleId = $state<string | null>(null);

	// ── Fanen Linn ──────────────────────────────────────────
	let traade = $state<LinnTraad3[]>([]);
	let henterTraade = $state(true);
	/** Spoergsmaal hun allerede har sendt videre. Styrer send-linjen. */
	let sendteTekster = $state<string[]>([]);
	let senderTilLinn = $state<number | null>(null);
	/** Det billede hun har trykket paa, hvis nogen. Vises i fuld skaerm. */
	let stortBillede = $state<{ url: string; tekst: string } | null>(null);

	const senestLaest = $derived(userDoc?.senestSpoergsmaalLaestAt ?? 0);
	const nytSvar = $derived(harNytSvar3(tilSvarKilder3(traade), senestLaest));

	const nuMs = Date.now();
	const dage = $derived(grupperEfterDag3(beskeder, nuMs));

	const FORSLAG = [
		'Jeg sover dårligt for tiden',
		'Hvordan kommer jeg i gang igen?',
		'Hvad kan jeg spise, når jeg har travlt?'
	];

	onMount(() => {
		const uid = user?.uid;
		if (!uid) return;
		void indlaesSamtale(uid);
		void indlaesTraade(uid);
	});

	async function indlaesSamtale(uid: string) {
		try {
			const aaben = await aabenSamtale3(uid);
			samtaleId = aaben.id;
			beskeder = aaben.beskeder;
			antalTidligere = aaben.antalTidligere;
			// Ingen rulning her: effekten ovenfor saetter den i bunden UDEN
			// animation, saa snart listen er tegnet.
		} catch (e) {
			console.error('[ny] kunne ikke hente samtalen', e);
			fejl = 'Din samtale kunne ikke hentes. Du kan godt skrive alligevel.';
		} finally {
			henterSamtale = false;
		}
	}

	const HUKOMMELSE_TRAADE = 'beskeder-traade';

	async function indlaesTraade(uid: string) {
		if (!adgang.linn) {
			henterTraade = false;
			return;
		}

		// Har hun set fanen i det her besoeg, staar traadene der med det
		// samme, og vi henter friskt nedenfor. Se sidehukommelse3.ts.
		const gemt = husket<LinnTraad3[]>(uid, HUKOMMELSE_TRAADE);
		if (gemt) {
			traade = gemt;
			sendteTekster = gemt.map((t) => t.spoergsmaal);
			henterTraade = false;
		}

		try {
			traade = await hentLinnTraade3(uid);
			sendteTekster = traade.map((t) => t.spoergsmaal);
			husk<LinnTraad3[]>(uid, HUKOMMELSE_TRAADE, traade);
		} catch (e) {
			console.error('[ny] kunne ikke hente dine spoergsmaal til Linn', e);
		} finally {
			henterTraade = false;
		}
	}

	/**
	 * Naar hun har set fanen Linn, skal "Nyt svar fra Linn" forsvinde fra
	 * forsiden. Samme felt som den gamle app bruger, saa de to flader
	 * foelges ad.
	 */
	$effect(() => {
		if (fane !== 'linn' || !nytSvar) return;
		const uid = user?.uid;
		if (!uid) return;
		void markerLinnSvarLaest3(uid).catch((e) =>
			console.error('[ny] kunne ikke markere svar som laest', e)
		);
	});

	/**
	 * HENT FORFRA NAAR HUN KOMMER TILBAGE TIL SKAERMEN.
	 *
	 * Trykker hun paa en besked paa telefonen, aabner appen ofte den side
	 * den allerede stod paa, med det den hentede sidste gang. Saa er
	 * svaret der ikke, og det dukker foerst op lidt senere. Linn saa det
	 * 23. august, se HANDOVER 9.46.
	 *
	 * Der hentes kun naar skaermen bliver synlig igen, ikke i en
	 * lykke: en app der ligger fremme henter ingenting af sig selv.
	 */
	$effect(() => {
		const uid = user?.uid;
		if (!uid || typeof document === 'undefined') return;

		function naarSynlig() {
			if (document.visibilityState !== 'visible') return;
			void indlaesTraade(uid!);
		}

		document.addEventListener('visibilitychange', naarSynlig);
		return () => document.removeEventListener('visibilitychange', naarSynlig);
	});

	// ── Hun skriver til Linn ────────────────────────────────────
	//
	// ÉT FELT FORNEDEN, som i den gamle app. Linns beslutning 4. september.
	//
	// Foer laa der et lille svarfelt inde i hver traad Linn selv havde
	// startet, og INTET felt til et nyt spoergsmaal: vejen ind gik gennem
	// AI'en. De to ting er nu det samme felt, og det er ikke en
	// forenkling der koster noget: et svar paa Linns besked blev i
	// forvejen gemt som et helt almindeligt spoergsmaal, saa det landede
	// samme sted i hendes liste. Se HANDOVER 9.43.

	/** Samme graense som den gamle app, 500 tegn. */
	let nyTekst = $state('');
	let senderNy = $state(false);
	const tegnAntal = $derived(nyTekst.length);

	/** Foerst naar hun naermer sig graensen. Den gamle apps tal. */
	const TAEL_FRA = 400;

	/** Traadene som en samtale, aeldst oeverst. Se content/beskedside3. */
	const chatTraade = $derived(tilChatTraade3(traade, nuMs));

	let linnRulle = $state<HTMLDivElement | null>(null);

	function paaTastLinn(e: KeyboardEvent) {
		// Enter sender, shift+enter giver en ny linje. Samme som AI-feltet,
		// saa de to faner ikke opfoerer sig forskelligt under fingrene.
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			void skrivTilLinn();
		}
	}

	async function skrivTilLinn() {
		const u = user;
		const tekst = nyTekst.trim();
		if (!u || !tekst || senderNy) return;
		senderNy = true;
		fejl = '';
		try {
			await gemSpoergsmaal({
				uid: u.uid,
				email: u.email ?? userDoc?.email ?? '',
				spoergsmaal: tekst,
				forlobId: aktivtForlob?.forlobId,
				forlobNavn: aktivtForlob?.navn
			});
			// Feltet toemmes FOERST naar skrivningen er gaaet igennem. Gaar
			// den galt, staar hendes tekst der stadig, og hun skal ikke
			// skrive det hele forfra.
			nyTekst = '';
			await indlaesTraade(u.uid);
			await rulLinnNed();
		} catch (e) {
			console.error('[ny] kunne ikke sende til Linn', e);
			fejl = 'Det kunne ikke sendes. Prøv igen om lidt.';
		} finally {
			senderNy = false;
		}
	}

	/** Nyeste staar nederst, saa vi ruller derned efter en ny besked. */
	async function rulLinnNed() {
		await tick();
		if (linnRulle) linnRulle.scrollTop = linnRulle.scrollHeight;
	}

	/**
	 * SAMTALEN STAAR I BUNDEN NAAR HUN AABNER DEN. Linns oenske 4.
	 * september. Nyeste besked staar nederst, saa toppen er det aeldste
	 * hun har skrevet, og det er ikke der hun skal begynde at laese.
	 *
	 * UDEN ANIMATION. Den skal allerede VAERE i bunden, ikke rulle derned
	 * mens hun kigger paa det.
	 *
	 * ÉN GANG PR VISNING, ikke loebende: hun skal kunne rulle op og laese
	 * gamle beskeder uden at skaermen hiver hende ned igen. Noeglen skifter
	 * naar hun skifter fane eller aabner en tidligere samtale, for saa er
	 * det en ny liste der bliver tegnet forfra.
	 *
	 * Den her erstatter en effekt der ledte efter '.traad[data-nyt]'. Den
	 * selektor forsvandt da fanen blev til en samtale 4. september, saa
	 * effekten havde ikke gjort noget siden.
	 */
	/**
	 * Hvor hun stod paa hver fane, saa et fane-skift ikke hopper.
	 *
	 * NAAR HUN SKIFTER TIL LINN bliver indholdet kort, og browseren
	 * klamper positionen mod toppen. Skifter hun tilbage, staar
	 * AI-samtalen derfor oeverst, og saa rullede vi den ned bagefter. DET
	 * var hoppet Linn saa: rettelsen der arbejdede, ikke en fejl i sig
	 * selv.
	 *
	 * Positionen gemmes derfor FOER skiftet og gendannes bagefter. Har hun
	 * ikke vaeret paa fanen i det her besoeg, gaar den i bunden som foer.
	 */
	const gemtPosition: Record<string, number> = {};

	/** Taelles op ved hvert klik, saa der altid maales igen efter et skift. */
	let faneSkift = $state(0);

	function skiftTil(ny: BeskedFane3) {
		if (ny === fane) return;
		const el = rullendeElement3(fane === 'linn' ? linnRulle : rulle);
		// fane kan i teorien vaere null foer adgangen er hentet. Tom streng
		// er en gyldig noegle og rammer ingen rigtig fane.
		if (el) gemtPosition[fane ?? ''] = el.scrollTop;
		valgtFane = ny;
		faneSkift += 1;
	}

	let sidstRullet = '';
	$effect(() => {
		const f = fane;
		// Vent til der er noget at rulle i. Ellers er hoejden nul, og vi
		// ruller til bunden af en tom liste.
		const klar = f === 'linn' ? !henterTraade : !henterSamtale;
		if (!klar) return;

		// ANTALLET SKAL MED I NOEGLEN. Foerste forsoeg 4. september saa kun
		// paa fanen, og den blev brugt op i det oejeblik listen var hentet
		// men endnu ikke tegnet. Saa var noeglen brændt, elementet var
		// tomt, og der blev aldrig rullet. Det var derfor Linn stadig
		// landede i toppen.
		const antal = f === 'linn' ? chatTraade.length : beskeder.length;

		// LAESES FOER noeglen bruges op, saa effekten koerer igen naar
		// elementet dukker op. Samme fejl som ovenfor, bare den anden vej.
		const el = f === 'linn' ? linnRulle : rulle;
		if (!el || antal === 0) return;

		const noegle = `${f}|${faneSkift}|${laesteSamtaleId ?? ''}|${viserTidligere}|${antal}`;
		if (sidstRullet === noegle) return;
		sidstRullet = noegle;

		// Har hun staaet paa fanen foer i det her besoeg, saetter vi hende
		// tilbage praecis hvor hun slap. Det er baade uden hop og bedre end
		// bunden: hun mister ikke det sted hun var ved at laese.
		const gemt = gemtPosition[f ?? ''];

		// RUL DET DER FAKTISK RULLER. Boble-listen har selv overflow-y:auto,
		// men den ligger i skallens .ny-scroll, som ikke er en
		// flex-container. Derfor bider listens flex:1 ikke, den vokser med
		// sit indhold, og rullet sker i .ny-scroll udenfor. At saette
		// scrollTop paa listen gjorde altsaa ingenting, og det var den
		// rigtige grund til at Linn blev ved med at lande i toppen.
		// Se utils/rulning3.ts.
		const iBunden = () => {
			const s = rullendeElement3(el);
			if (!s) return;
			s.scrollTop = gemt === undefined ? s.scrollHeight : Math.min(gemt, s.scrollHeight);
		};

		// FIRE FORSOEG, og det er ikke overdrevet. Med det samme rammer den
		// hvis alt allerede staar der. Naeste billede-tegning fanger det
		// almindelige tilfaelde. De to sidste er til lydbeskeder og
		// billeder: de har ingen hoejde foer de er hentet, og saa vokser
		// listen UNDER hende bagefter, og bunden flytter sig.
		iBunden();
		requestAnimationFrame(iBunden);
		// Det sidste forsoeg ligger sent med vilje: et billede fra Linn har
		// ingen hoejde foer det er hentet, og paa en telefon paa mobildata
		// kan det tage et halvt sekund. Uden det lander hun naesten i
		// bunden, og det ligner en tilfaeldig fejl.
		const ure = [60, 250, 600].map((ms) => setTimeout(iBunden, ms));
		return () => ure.forEach(clearTimeout);
	});

	async function rulNed() {
		await tick();
		// Samme fejl som ovenfor: .bobler ruller ikke selv, det goer
		// skallens .ny-scroll udenom. Se utils/rulning3.ts.
		const el = rullendeElement3(rulle);
		el?.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
	}

	/**
	 * Ruller til det nyeste svar, saa svarets FOERSTE linje staar oeverst.
	 * Et langt svar fylder mere end skaermen; ruller vi til bunden, lander
	 * hun i slutningen af svaret og skal selv rulle op for at laese det.
	 */
	async function rulTilSvarTop() {
		await tick();
		if (!rulle) return;
		const svar = rulle.querySelectorAll('.boble.svar');
		const sidste = svar[svar.length - 1] as HTMLElement | undefined;
		if (!sidste) return void rulNed();

		// Det element der ruller er skallens .ny-scroll og ikke .bobler,
		// saa boblens offsetTop skal maales mod DEN og ikke mod listen.
		// Foer stod der offsetTop mod .bobler, og saa landede rulningen for
		// hoejt oppe med praecis afstanden fra toppen af skaermen og ned til
		// listen. Se utils/rulning3.ts.
		const el = rullendeElement3(rulle);
		if (!el) return;
		const top = sidste.getBoundingClientRect().top - el.getBoundingClientRect().top;
		el.scrollTo({ top: Math.max(0, el.scrollTop + top - 10), behavior: 'smooth' });
	}

	async function send(tekst?: string) {
		const u = user;
		const besked = (tekst ?? input).trim();
		if (!besked || sender || !u) return;

		// Hun kan ikke skrive videre i en gammel samtale. Trykker hun send
		// mens hun kigger tilbage, hopper vi tilbage til den aabne.
		if (viserTidligere || laesteSamtaleId) lukTidligere();

		const foer = [...beskeder];
		const erFoerste = foer.length === 0;
		beskeder = [...beskeder, { rolle: 'user', indhold: besked, ms: Date.now() }];
		input = '';
		fejl = '';
		sender = true;
		await rulNed();

		try {
			const idToken = await u.getIdToken();
			const res = await fetch('/api/ny-ai', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
				body: JSON.stringify({
					tilstand: 'samtale',
					besked,
					historik: foer.map((b) => ({ rolle: b.rolle, indhold: b.indhold }))
				})
			});

			if (!res.ok) {
				const raa = await res.text();
				let melding = 'Noget gik galt. Prøv igen om lidt.';
				try {
					const p = JSON.parse(raa);
					if (p.message) melding = p.message;
				} catch {
					if (raa) melding = raa;
				}
				fejl = melding;
				beskeder = foer;
				return;
			}

			const data = (await res.json()) as {
				svar: string;
				usikker: boolean;
				sikkerhed: number | null;
			};
			beskeder = [
				...beskeder,
				{
					rolle: 'assistant',
					indhold: data.svar,
					ms: Date.now(),
					sikkerhed: data.sikkerhed ?? null
				}
			];
			await rulTilSvarTop();

			// Gemmes efter at svaret staar paa skaermen. Fejler skrivningen,
			// mister hun samtalen naeste gang hun aabner siden, men hun faar
			// da sit svar nu. Det omvendte ville vaere at lade hende vente.
			if (samtaleId) {
				await gemUdveksling3(
					u.uid,
					samtaleId,
					besked,
					data.svar,
					erFoerste,
					data.sikkerhed ?? null
				).catch((e) => console.error('[ny] kunne ikke gemme samtalen', e));
			}
		} catch (e) {
			console.error('[ny] beskeder fejlede', e);
			fejl = 'Der er ingen forbindelse lige nu. Prøv igen om lidt.';
			beskeder = foer;
		} finally {
			sender = false;
		}
	}

	/**
	 * Sender ét bestemt spoergsmaal og svar videre til Linn.
	 *
	 * `i` er svarets plads i samtalen. Spoergsmaalet er den naermeste
	 * bruger-besked foer det, saa hun sender netop det par hun kigger paa
	 * og ikke bare det sidste i traaden.
	 */
	async function tilLinn(i: number) {
		const u = user;
		if (!u || senderTilLinn !== null) return;
		const svar = beskeder[i];
		const spoergsmaal = [...beskeder.slice(0, i)].reverse().find((b) => b.rolle === 'user');
		if (!svar || !spoergsmaal) return;

		senderTilLinn = i;
		fejl = '';
		try {
			await gemSpoergsmaal({
				uid: u.uid,
				email: u.email ?? userDoc?.email ?? '',
				spoergsmaal: spoergsmaal.indhold,
				forlobId: aktivtForlob?.forlobId,
				forlobNavn: aktivtForlob?.navn,
				aiSvar: svar.indhold
			});
			sendteTekster = [...sendteTekster, spoergsmaal.indhold];
			await indlaesTraade(u.uid);
		} catch (e) {
			console.error('[ny] kunne ikke sende til Linn', e);
			fejl = 'Spørgsmålet kunne ikke sendes. Prøv igen om lidt.';
		} finally {
			senderTilLinn = null;
		}
	}

	async function aabnTidligere() {
		const uid = user?.uid;
		if (!uid) return;
		viserTidligere = true;
		if (tidligere.length === 0 && samtaleId) {
			try {
				tidligere = await tidligereSamtaler3(uid, samtaleId);
			} catch (e) {
				console.error('[ny] kunne ikke hente tidligere samtaler', e);
			}
		}
	}

	async function laesTidligere(id: string) {
		const uid = user?.uid;
		if (!uid) return;
		try {
			beskeder = await hentTidligereSamtale3(uid, id);
			laesteSamtaleId = id;
			viserTidligere = false;
		} catch (e) {
			console.error('[ny] kunne ikke aabne samtalen', e);
		}
	}

	function lukTidligere() {
		viserTidligere = false;
		if (laesteSamtaleId) {
			laesteSamtaleId = null;
			const uid = user?.uid;
			if (uid) void indlaesSamtale(uid);
		}
	}

	function paaTast(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			void send();
		}
	}

	/** Spoergsmaalet der hoerer til svaret paa plads `i`. */
	function spoergsmaalFor(i: number): SamtaleBesked3 | undefined {
		const b = beskeder[i];
		if (!b || b.rolle !== 'assistant') return undefined;
		return [...beskeder.slice(0, i)].reverse().find((x) => x.rolle === 'user');
	}

	/** Skal der staa en send-linje under det her svar. */
	function visSend(i: number): boolean {
		const spoergsmaal = spoergsmaalFor(i);
		if (!spoergsmaal) return false;
		return kanSendeVidere3(adgang, true, erSendtVidere3(spoergsmaal.indhold, sendteTekster));
	}

	/** Er det her svar allerede sendt videre. */
	function erSendt(i: number): boolean {
		if (!adgang.linn) return false;
		const spoergsmaal = spoergsmaalFor(i);
		if (!spoergsmaal) return false;
		return erSendtVidere3(spoergsmaal.indhold, sendteTekster);
	}

	function dato(ms: number): string {
		return ms ? dagLabel3(ms, nuMs) : '';
	}
</script>

<svelte:head><title>Beskeder</title></svelte:head>

<div class="hjaelp-side besk-fuld">
	<!-- HELE TOPPEN BLIVER STAAENDE, ikke kun fanerne. Linns oenske 5.
	     september. Foer rullede titlen og linjen under den vaek, mens
	     fanerne blev haengende alene, og saa saa toppen halv ud.
	     Sidehovedet og fanerne er derfor pakket sammen i ét lag der
	     klaeber. -->
	<div class="besk-top-fast">
		<Sidehoved
			titel="Beskeder"
			under={fane === 'linn'
				? // Sagde 'Det du har sendt videre til Linn, og hendes svar'
					// indtil 4. september. Det passede da fanen kun var en liste
					// over det AI'en havde sendt videre. Nu kan hun skrive
					// direkte, og saa beskrev den ikke laengere hvad siden goer.
					'Skriv dit spørgsmål til mig.'
				: 'Her kan du spørge om det der fylder. Jeg svarer ud fra Linns materialer, og jeg er ikke læge.'}
		/>

		{#if visFaner}
			<!-- FANERNE BLIVER STAAENDE naar hun ruller. Linns oenske 4.
		     september: skiftet mellem Linn AI og Linn skal vaere ét tryk
		     vaek, ogsaa midt i en lang samtale. Foer rullede de vaek med
		     titlen, og saa skulle hun helt op i toppen foerst.

		     Wrapperen findes fordi selve fane-pillen har luft i siderne.
		     Uden den ville indholdet kunne ses glide forbi til hoejre og
		     venstre for pillen, mens den klaeber. -->
			<div class="besk-faner-fast">
				<div class="besk-faner" role="tablist">
					<button
						type="button"
						role="tab"
						aria-selected={fane === 'ai'}
						class:paa={fane === 'ai'}
						onclick={() => skiftTil('ai')}
					>
						Linn AI
					</button>
					<button
						type="button"
						role="tab"
						aria-selected={fane === 'linn'}
						class:paa={fane === 'linn'}
						onclick={() => skiftTil('linn')}
					>
						Linn
						{#if nytSvar}<span class="besk-prik" aria-label="Nyt svar"></span>{/if}
					</button>
				</div>
			</div>
		{/if}
	</div>

	{#if fane === 'linn'}
		<!-- FANEN ER EN SAMTALE, ikke en liste med kort. Linns beslutning
		     4. september, forslag B i mockups-beskeder-som-gammel.html:
		     3.0 skal virke som den gamle app, hvor kunden skriver direkte
		     til Linn. Alt det 3.0 kunne i forvejen lever videre inde i
		     boblerne: lyd, billeder, klikbare links, og at Linn kan skrive
		     foerst. -->
		<div class="bobler" bind:this={linnRulle}>
			{#if henterTraade}
				<Venter tekst="Henter dine beskeder" />
			{:else if chatTraade.length === 0}
				<!-- Linns egen intro, ordret fra den gamle app. Det er det
				     foerste en kunde moeder her, og det skal lyde som hende
				     og ikke som appen. -->
				<div class="besk-velkomst">
					<span class="besk-velkomst-ikon" aria-hidden="true">✿</span>
					<h2>Skriv dit spørgsmål til mig 🌸</h2>
					<p>
						Jeg samler løbende spørgsmålene og svarer på dem samlet — svarene finder du på forsiden
						af appen. Alle spørgsmål deles anonymt, så vi alle får glæde af dem.
					</p>
					<p>
						Du skal derfor ikke forvente et personligt svar her, men dit spørgsmål skal nok blive
						taget med 🌸
					</p>
					<p class="besk-hilsen">Kh Linn</p>
				</div>
			{:else}
				<p class="besk-note">Jeg svarer samlet, og svarene deles anonymt på forsiden.</p>
				{#each chatTraade as rk (rk.traad.id)}
					{@const t = rk.traad}
					{@const harNoget = harSvarIndhold3(t)}
					{@const erNy = harNoget && !!t.besvaretMs && t.besvaretMs > senestLaest}
					{#if rk.dagLabel}
						<div class="besk-dato"><span>{rk.dagLabel}</span></div>
					{/if}
					<!-- Skrev Linn foerst, er der ingen boble ovenover: kunden har
					     ikke spurgt om noget. Se HANDOVER 9.43. -->
					{#if !t.fraLinn}
						<div class="boble hende">{t.spoergsmaal}</div>
					{/if}
					{#if harNoget}
						<div class="boble svar besk-linn" class:nyt={erNy}>
							<span class="besk-linn-fra">
								<span class="traad-ava" aria-hidden="true"></span>
								{t.fraLinn ? 'Linn skrev til dig' : 'Svar fra Linn'}
							</span>
							{#if t.svar}
								<span class="besk-linn-tekst"
									>{#each delOpILinks(t.svar) as d, di (di)}{#if d.slags === 'link'}<a
												class="besk-link"
												href={d.url}
												target="_blank"
												rel="noopener noreferrer">{d.tekst}</a
											>{:else}{d.tekst}{/if}{/each}</span
								>
							{/if}
							{#if t.lydUrl}
								<span class="traad-lyd">
									<Lydbesked url={t.lydUrl} sekunder={t.lydSekunder ?? 0} />
								</span>
							{/if}
							{#if t.billedUrl}
								<!-- Trykker hun paa billedet, aabner det i fuld skaerm.
								     Laget portales ud i body, ellers ligger bundmenuen
								     ovenpaa paa en iPhone. -->
								<button
									type="button"
									class="traad-billede"
									onclick={() => (stortBillede = { url: t.billedUrl ?? '', tekst: t.svar ?? '' })}
								>
									<img src={t.billedUrl} alt="Billede fra Linn" loading="lazy" />
								</button>
							{/if}
						</div>
						{#if erNy}
							<!-- Baandet forsvinder naar hun har set det, se
							     markerLaest. Bliver det staaende, holder det op med
							     at betyde noget. -->
							<span class="besk-nyt">Nyt svar</span>
						{/if}
					{:else if !t.fraLinn}
						<span class="besk-venter">Afventer svar</span>
					{/if}
				{/each}
			{/if}
		</div>

		<!-- SKRIVEFELTET LIGGER FAST FORNEDEN. Linns oenske 4. september:
		     trykker hun paa en fane, skal feltet vaere fremme med det samme.
		     Foer rullede det med indholdet, og i en lang samtale laa det
		     langt nede. Samme som den gamle app, hvor feltet er fast over
		     bundmenuen. -->
		<div class="besk-bund">
			<div class="skrivelinje">
				<textarea
					class="felt"
					bind:value={nyTekst}
					onkeydown={paaTastLinn}
					placeholder="Skriv dit spørgsmål …"
					rows="1"
					maxlength={SPOERGSMAAL_MAX_LAENGDE}
					disabled={senderNy}
				></textarea>
				<button
					class="send"
					onclick={() => void skrivTilLinn()}
					disabled={senderNy || nyTekst.trim().length === 0}
					aria-label="Send spørgsmål"
				>
					↑
				</button>
			</div>
			<!-- Taelleren staar foerst frem naar hun naermer sig graensen. Foer
		     ville den staa og taelle fra det foerste tegn, og det laeser som
		     en begraensning i stedet for en hjaelp. Samme graense som den
		     gamle app. -->
			{#if tegnAntal >= TAEL_FRA}
				<p class="besk-tegn">{tegnAntal} / {SPOERGSMAAL_MAX_LAENGDE} tegn</p>
			{/if}
		</div>
	{:else}
		<div class="bobler" bind:this={rulle}>
			{#if viserTidligere}
				<div class="besk-tidligere-liste">
					<button class="besk-tidligere" onclick={lukTidligere}>‹ Tilbage til samtalen</button>
					{#if tidligere.length === 0}
						<p class="besk-fod">Du har ikke andre samtaler.</p>
					{:else}
						{#each tidligere as s (s.id)}
							<button class="besk-gammel" onclick={() => laesTidligere(s.id)}>
								<span class="t">{s.titel}</span>
								<span class="s">{dato(s.opdateretMs)}</span>
							</button>
						{/each}
					{/if}
				</div>
			{:else}
				{#if laesteSamtaleId}
					<button class="besk-tidligere" onclick={lukTidligere}>‹ Tilbage til samtalen</button>
				{:else if antalTidligere > 0}
					<button class="besk-tidligere" onclick={aabnTidligere}>Se tidligere samtaler</button>
				{/if}

				{#if henterSamtale}
					<Venter tekst="Henter dine beskeder" />
				{:else if beskeder.length === 0}
					<div class="forslag">
						<p class="forslag-lab">Prøv for eksempel</p>
						{#each FORSLAG as f (f)}
							<button class="forslag-knap" onclick={() => send(f)}>{f}</button>
						{/each}
					</div>
				{/if}

				{#each dage as d (d.label)}
					<div class="besk-dato"><span>{d.label}</span></div>
					{#each d.beskeder as b (beskeder.indexOf(b))}
						{@const i = beskeder.indexOf(b)}
						<div
							class="boble"
							class:hende={b.rolle === 'user'}
							class:svar={b.rolle === 'assistant'}
						>
							<!-- Stumperne staar paa ÉN linje med vilje. Boblen bevarer
							     linjeskift (white-space: pre-wrap), saa et linjeskift i
							     selve markup ville blive til luft paa skaermen. -->
							{#each delOpILinks(udenFormateringstegn(b.indhold)) as d, di (di)}{#if d.slags === 'link'}<a
										class="besk-link"
										href={d.url}
										target="_blank"
										rel="noopener noreferrer">{d.tekst}</a
									>{:else}{d.tekst}{/if}{/each}
						</div>
						<!-- SIKKERHEDS-LINJEN, som i den gamle app. Linns beslutning
						     4. september. Den staar UDEN for boblen, saa den laeser
						     som en note til svaret og ikke som en del af det Linn
						     ville have sagt. Ordlyden ligger i aiSikkerhed3. -->
						{#if b.rolle === 'assistant'}
							{@const linje = sikkerhedsLinje3(b.sikkerhed, adgang.linn)}
							<span class="besk-sikker" class:lav={linje.lav}>
								<span aria-hidden="true">{linje.lav ? '💡' : '✓'}</span>
								{linje.tekst}
							</span>
						{/if}
						{#if erSendt(i)}
							<span class="besk-videre sendt">
								<span class="rund-fluebe" aria-hidden="true"><Fluebe /></span>
								Sendt til Linn. Du får svar inden for et døgn
							</span>
						{:else if visSend(i) && !laesteSamtaleId}
							<button class="besk-videre" disabled={senderTilLinn === i} onclick={() => tilLinn(i)}>
								{senderTilLinn === i ? 'Sender …' : 'Ikke tilfreds? Send til Linn ›'}
							</button>
						{/if}
					{/each}
				{/each}

				{#if sender}
					<div class="boble svar taenker">
						<Ventetegn variant="lille" />
						<span>Tænker</span>
					</div>
				{/if}
			{/if}

			{#if fejl}
				<p class="fejl" role="alert">{fejl}</p>
			{/if}
		</div>

		{#if !viserTidligere}
			<div class="besk-bund">
				<div class="skrivelinje">
					<textarea
						class="felt"
						bind:value={input}
						onkeydown={paaTast}
						placeholder="Skriv hvad der fylder …"
						rows="1"
						disabled={sender}
					></textarea>
					<button
						class="send"
						onclick={() => send()}
						disabled={sender || input.trim().length === 0}
						aria-label="Send"
					>
						↑
					</button>
				</div>
			</div>
		{/if}
	{/if}
</div>

{#if stortBillede}
	<BilledeLag url={stortBillede.url} tekst={stortBillede.tekst} luk={() => (stortBillede = null)} />
{/if}

<style>
	/* Lyd og billede i en besked fra Linn. Kom til 1. september 2026. */
	.traad-lyd {
		margin-top: 8px;
	}

	.traad-billede {
		display: block;
		width: 100%;
		margin-top: 8px;
		padding: 0;
		border: 0;
		border-radius: 14px;
		background: none;
		cursor: pointer;
		overflow: hidden;
	}

	.traad-billede img {
		display: block;
		width: 100%;
		/* Et hoejt billede maa ikke fylde hele traaden. Hun kan trykke det
		   op i fuld skaerm, og der er intet klippet vaek. */
		max-height: 260px;
		object-fit: cover;
		border-radius: 14px;
	}
</style>
