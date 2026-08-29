<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount, setContext } from 'svelte';
	import { onAuthStateChanged, type User } from 'firebase/auth';
	import { auth } from '$lib/firebase';
	import {
		createUserDoc,
		gemAppVersion,
		getUserDoc,
		lytTilUserDoc,
		synkroniserForlobskundeStatus
	} from '$lib/userDoc';
	import { version } from '$app/environment';
	import { lytTilAllowedEmail } from '$lib/firestore/forlob';
	import type { UserDoc } from '$lib/types';
	import TabBar from '$lib/components/TabBar.svelte';
	import Header from '$lib/components/Header.svelte';
	import Loading from '$lib/components/Loading.svelte';
	import Logo from '$lib/components/Logo.svelte';
	import AdminKlientBanner from '$lib/components/AdminKlientBanner.svelte';
	import IngenAdgangScreen from '$lib/components/IngenAdgangScreen.svelte';
	import { ryAdminKlientMode } from '$lib/userDoc';
	import { setAktivKlientForlobId } from '$lib/state/adminKlientState.svelte';
	import { harIngenAdgang } from '$lib/utils/userAdgang';
	import { isAdmin } from '$lib/admin';
	import { hentFeatureMatrix } from '$lib/firestore/featureAdgang';
	import { STANDARD_MATRIX, type FeatureMatrix } from '$lib/content/features';
	import { hentUserDocFraCache } from '$lib/userDocCache';
	import { maaAabnePaaKopi, tidsgraense, HURTIG_START_MS } from '$lib/content/hurtigStart';
	import HjemmeskaermScreen from '$lib/components/HjemmeskaermScreen.svelte';
	import { erMobilEnhed, erPaaHjemmeskaerm, skalViseHjemmeskaerm } from '$lib/content/hjemmeskaerm';
	import {
		clearIndexedDbPersistence,
		doc as doc_ref,
		terminate,
		updateDoc
	} from 'firebase/firestore';
	import { db } from '$lib/firebase';
	import {
		AERLIG_SKAERM_MS,
		boerNulstille,
		harKontaktetDatabasen,
		harNulstilletFoer,
		huskNulstilling,
		VAGT_MS
	} from '$lib/utils/opstartVagt';

	let { children } = $props();

	let user = $state<User | null>(null);
	let userDoc = $state<UserDoc | null>(null);
	let loading = $state(true);
	// Vagten over opstarten. Saetter appen sig fast uden ét eneste kald til
	// databasen, rydder vi lageret og starter forfra ÉN gang. Traekker det
	// bare ud, siger vi det aerligt i stedet for at vise en bjaelke der
	// tæller sekunder. Se utils/opstartVagt.ts.
	let opstartHaenger = $state(false);

	/**
	 * Rydder den lokale kopi og starter appen forfra. Sidste udvej, og kun
	 * naar vagten har konstateret at der ikke er sendt noget som helst.
	 */
	async function nulstilOgStartForfra() {
		huskNulstilling();
		try {
			await terminate(db);
			await clearIndexedDbPersistence(db);
		} catch (e) {
			// Lykkes rydningen ikke, genstarter vi alligevel. En frisk
			// indlaesning er stadig bedre end at staa fast for evigt.
			console.warn('[opstart] kunne ikke rydde det lokale lager:', e);
		}
		location.reload();
	}

	// ── Hjemmeskaerms-skaermen for nye kunder ────────────────────
	// Vises én gang, foer alt andet paa forsiden, saa hun ikke faar
	// kettlebell-spoergsmaalet oveni. Reglerne staar i
	// content/hjemmeskaerm.ts. Se ogsaa HjemmeskaermScreen.svelte.
	interface InstallerBegivenhed extends Event {
		prompt: () => Promise<void>;
		userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
	}

	// Chromes tilbud om at installere med ét tryk. Browseren sender den
	// ÉN gang og tidligt, saa vi tager imod her i layoutet og giver den
	// videre. Fanger vi den ikke, er den tabt for den her indlaesning.
	let installer = $state<InstallerBegivenhed | null>(null);
	// Sat lokalt naar hun har trykket, saa skaermen forsvinder med det
	// samme i stedet for at vente paa at userDoc kommer retur.
	let hjemmeskaermKlaret = $state(false);
	let hjemmeskaermVilkaar = $state({ paaHjemmeskaerm: false, erMobil: false });

	const visHjemmeskaerm = $derived(
		!hjemmeskaermKlaret &&
			!!userDoc &&
			skalViseHjemmeskaerm({
				oprettetAt: userDoc.createdAt,
				vistAt: userDoc.hjemmeskaermVistAt,
				erAdmin: isAdmin(user),
				paaHjemmeskaerm: hjemmeskaermVilkaar.paaHjemmeskaerm,
				erMobil: hjemmeskaermVilkaar.erMobil
			})
	);

	/**
	 * Hun har svaret, uanset om hun gjorde det eller sprang over. Skaermen
	 * lukkes med det samme, og feltet gemmes bagefter. Fejler skrivningen,
	 * staar hun ikke fast — hun ser den saa igen naeste gang, og det er
	 * det mindst irriterende af de to onder.
	 */
	async function hjemmeskaermFaerdig() {
		hjemmeskaermKlaret = true;
		const u = user;
		if (!u) return;
		try {
			await updateDoc(doc_ref(db, 'users', u.uid), { hjemmeskaermVistAt: Date.now() });
		} catch (e) {
			console.warn('Kunne ikke gemme hjemmeskaerm-svaret:', e);
		}
	}

	// Feature-adgangs-matrixen hentes én gang og deles via context, saa alle
	// sider afgoer feature-adgang ud fra SAMME kilde (via harFeatureAdgang).
	// Falder tilbage til STANDARD_MATRIX indtil hentningen er faerdig / ved fejl.
	let featureMatrix = $state<FeatureMatrix>(STANDARD_MATRIX);

	// Når admin er i klient-mode, override'r vi adgangs-felterne så
	// klient-modulerne reagerer som om admin var den valgte klient-type.
	// Den rigtige userDoc i Firestore ændres ikke — kun det context-objekt
	// modulerne læser.
	//
	// 3 modes:
	// - 'forlob': forløbskunde på et specifikt forløb (Maria-flow)
	// - 'basisapp': modulbruger med basis-abo
	// - 'premiumapp': modulbruger med premium-abo
	function effektivUserDoc(d: UserDoc | null): UserDoc | null {
		if (!d) return null;
		const mode = d.adminKlientMode;
		// Admin's egne expiresAt/bonusPeriodEndsAt-felter kan vaere udloebet
		// (fx fra tidligere test-roller). Vi nulstiller dem i klient-mode saa
		// effektivState() ikke faelder hende som udlobet — klient-oplevelsen
		// skal afspejle 'aktiv klient', ikke admin's egen historik.
		// aktivtTraeningsprogram nulstilles ogsaa saa admin's egne 'mit-eget-
		// program'-valg ikke laekker ind i klient-preview (display ville
		// ellers vise admin's eget programnavn i traenings-rubrikken).
		const klientOverride = {
			expiresAt: undefined,
			bonusPeriodEndsAt: undefined,
			aktivtTraeningsprogram: undefined
		};
		// Naar admin tester et specifikt forloeb, skal forlobId vaere i
		// forlobIds saa forsidens indlaesForlob-flow finder det. Vi tilfoejer
		// adminKlientForlobId hvis det ikke allerede er der.
		function medAdminForlobId(
			forlobIds: string[] | undefined,
			id: string | undefined
		): string[] | undefined {
			if (!id) return forlobIds;
			const liste = forlobIds ?? [];
			return liste.includes(id) ? liste : [...liste, id];
		}
		// activeProduct vaelges dynamisk ud fra det forl0b admin tester
		// (kickstart vs premiumforl0b). Sat af gemAdminKlientForlob — vi
		// faldter tilbage til 'kickstart' hvis feltet mangler (gamle doks).
		const klientForlobProdukt = d.adminKlientAktivProdukt ?? 'kickstart';
		const erKropsroKlient = klientForlobProdukt === 'premiumforløb';
		// Bagudkompatibilitet: hvis adminKlientForlobId er sat men adminKlientMode
		// mangler (gamle dokumenter), antag forlobs-mode.
		if (!mode && d.adminKlientForlobId) {
			return {
				...d,
				...klientOverride,
				accessLevel: erKropsroKlient ? 'premium' : 'basis',
				accessSource: 'forløb',
				activeProduct: klientForlobProdukt,
				forlobIds: medAdminForlobId(d.forlobIds, d.adminKlientForlobId)
			};
		}
		if (mode === 'forlob') {
			return {
				...d,
				...klientOverride,
				accessLevel: erKropsroKlient ? 'premium' : 'basis',
				accessSource: 'forløb',
				activeProduct: klientForlobProdukt,
				forlobIds: medAdminForlobId(d.forlobIds, d.adminKlientForlobId)
			};
		}
		if (mode === 'basisapp') {
			return {
				...d,
				...klientOverride,
				accessLevel: 'basis',
				accessSource: 'abonnement',
				activeProduct: 'basisabo',
				activeSubscription: true
			};
		}
		if (mode === 'premiumapp') {
			return {
				...d,
				...klientOverride,
				accessLevel: 'premium',
				accessSource: 'abonnement',
				activeProduct: 'premiumabo',
				activeSubscription: true
			};
		}
		return d;
	}

	// Gør userDoc tilgængeligt for alle undersider via Svelte context
	setContext('userDoc', () => effektivUserDoc(userDoc));
	setContext('user', () => user);
	setContext('featureMatrix', () => featureMatrix);
	// Eksponér adminKlientForlobId så firestore-helpers kan scope deres
	// læs/skriv-paths. Returnerer null når admin er i normal admin-mode
	// eller når brugeren er en almindelig klient.
	setContext('adminKlientForlobId', () => userDoc?.adminKlientForlobId ?? null);

	// Sync den globale state-singleton der læses fra firestore-helpers
	// (de kan ikke bruge Svelte context fordi de ikke er komponenter).
	$effect(() => {
		setAktivKlientForlobId(userDoc?.adminKlientForlobId ?? null);
	});

	async function afslutKlientMode() {
		if (!user) return;
		try {
			await ryAdminKlientMode(user.uid);
		} catch (e) {
			console.error('Kunne ikke afslutte klient-mode:', e);
		}
	}

	onMount(() => {
		// Vagten. To ure: det foerste ser efter om appen er sat fast, det
		// andet holder op med at lade som om der sker noget.
		const vagtUr = setTimeout(() => {
			if (
				boerNulstille({
					stadigIGang: loading,
					harKontakt: harKontaktetDatabasen(),
					alleredeNulstillet: harNulstilletFoer()
				})
			) {
				console.warn('[opstart] ingen kontakt til databasen, rydder og starter forfra');
				void nulstilOgStartForfra();
			}
		}, VAGT_MS);
		const aerligUr = setTimeout(() => {
			if (loading) opstartHaenger = true;
		}, AERLIG_SKAERM_MS);

		// Vilkaarene for hjemmeskaerms-skaermen kan foerst laeses i browseren.
		hjemmeskaermVilkaar = {
			paaHjemmeskaerm: erPaaHjemmeskaerm(window),
			erMobil: erMobilEnhed(window)
		};
		// Chromes tilbud om ét-tryks-installation. Vi holder browserens egen
		// banner tilbage med preventDefault, saa tilbuddet i stedet ligger
		// paa vores knap.
		const paaInstaller = (e: Event) => {
			e.preventDefault();
			installer = e as InstallerBegivenhed;
		};
		window.addEventListener('beforeinstallprompt', paaInstaller);

		let userDocUnsubscribe: (() => void) | null = null;
		let allowedEmailUnsubscribe: (() => void) | null = null;

		// Sidste gang vi koerte synkronisering. Bruges af visibility-change-
		// listeneren til at undgaa for hyppige re-syncs (smaa skift mellem
		// apps maa ikke trigge sync hver gang). Tærskel: 1 time.
		let sidsteSync = Date.now();
		const SYNC_TAERSKEL_MS = 60 * 60 * 1000;

		// Hjælper: koer synkroniseringen igen og opdater userDoc lokalt.
		// Bruges baade af allowedEmail-listeneren og visibility-change.
		async function genSynkroniser(grund: string) {
			const u = user;
			if (!u || !u.email) return;
			try {
				const aktuel = userDoc ?? (await getUserDoc(u.uid));
				if (!aktuel) return;
				const opdateret = await synkroniserForlobskundeStatus(u.uid, u.email, aktuel);
				userDoc = opdateret;
				sidsteSync = Date.now();
				console.log(`[layout] re-syncede pga ${grund}`);
			} catch (e) {
				console.warn(`[layout] re-sync (${grund}) fejlede:`, e);
			}
		}

		// B) Visibility-change: naar appen vender tilbage til forgrund efter
		// at have vaeret skjult > 1 time, koerer vi sync igen. Daekker iPhone-
		// PWA der "vaagner op" efter timer i baggrund uden ny app-start.
		function onVisibility() {
			if (document.visibilityState !== 'visible') return;
			if (Date.now() - sidsteSync < SYNC_TAERSKEL_MS) return;
			void genSynkroniser('visibility');
		}
		document.addEventListener('visibilitychange', onVisibility);

		const authUnsubscribe = onAuthStateChanged(auth, async (u) => {
			if (!u) {
				// Ikke logget ind → send til login
				userDocUnsubscribe?.();
				userDocUnsubscribe = null;
				allowedEmailUnsubscribe?.();
				allowedEmailUnsubscribe = null;
				await goto('/login');
				return;
			}

			user = u;

			// Kundens egen kopi af bruger-dokumentet. Laeses lokalt og koster
			// intet netvaerk. Null er helt normalt foerste gang hun logger ind
			// paa en enhed. Se lib/userDocCache.ts.
			//
			// maaAabnePaaKopi holder den hurtige opstart bag 'ny-app'-flaget
			// under udrulningen, saa de kunder der er i drift koerer videre paa
			// den kaede de altid har koert paa. Se content/hurtigStart.ts.
			const kopi = await hentUserDocFraCache(u.uid);
			const kopiDuer = maaAabnePaaKopi(kopi, isAdmin(u));

			// Den rigtige kaede. Indholdet er uaendret, den er bare pakket saa
			// vi kan holde den op mod et ur nedenfor.
			const kaeden = (async () => {
				// Hent bruger-dokument fra Firestore
				let doc = await getUserDoc(u.uid);

				// Hvis dokumentet ikke findes (fx hvis brugeren blev oprettet før
				// vi havde Firestore-integration), opret det nu med default state
				if (!doc) {
					await createUserDoc(u.uid, u.email ?? '');
					doc = await getUserDoc(u.uid);
				}

				// Tjek om brugeren er på et forløbs-whitelist og opdater state +
				// userProduct hvis det er tilfældet. Best-effort — fejl logges men
				// blokerer ikke login.
				if (doc && u.email) {
					try {
						doc = await synkroniserForlobskundeStatus(u.uid, u.email, doc);
						sidsteSync = Date.now();
					} catch (e) {
						console.warn('Forløbssync fejlede:', e);
					}
				}

				return doc;
			})();

			// Hurtig opstart. Kaeden er 3 til 6 ture frem og tilbage til serveren
			// i koe, og foer laa der ingen tidsgraense paa dem. Var forbindelsen
			// der, men doed, stod kunden med "Et oejeblik" i over et minut, selv
			// om kopien laa klar hele tiden.
			//
			// Paa en normal forbindelse er kaeden hjemme paa under et sekund og
			// vinder kapløbet, og saa sker der intet nyt overhovedet. Trækker den
			// ud, lukker vi kunden ind paa kopien og lader kaeden loebe faerdig i
			// baggrunden. Se content/hurtigStart.ts for begrundelsen bag tallet.
			if (kopiDuer) {
				const udfald = await Promise.race([
					kaeden.then(() => 'kaeden' as const).catch(() => 'kaeden' as const),
					tidsgraense(HURTIG_START_MS)
				]);
				if (udfald === 'tid') {
					userDoc = kopi;
					loading = false;
				}
			}

			// Serveren har altid det sidste ord. Naar kaeden lander, overskriver
			// den kopien, og de $effects der laeser userDoc koerer igen. Det er
			// samme moenster som lytTilUserDoc og lytTilAllowedEmail allerede
			// bruger, saa siderne er bygget til at taale det.
			let doc: UserDoc | null;
			try {
				doc = await kaeden;
			} catch (e) {
				// Kunne slet ikke naa serveren. Har vi en brugbar kopi, er kunden
				// allerede lukket ind ovenfor, og saa arbejder hun bare videre paa
				// den. Har vi ingen, er der intet at vise, og vi lader fejlen gaa
				// videre praecis som foer.
				console.warn('Kunne ikke hente bruger-dokument fra serveren:', e);
				if (!kopiDuer) throw e;
				doc = kopi;
			}

			userDoc = doc;
			loading = false;

			// Registrer hvilket app-build klienten netop bootede med. Ikke-
			// blokerende og kun et write ved versions-skift — så vi kan se om
			// en kunde sidder fast på et gammelt cachet build.
			void gemAppVersion(u.uid, version, doc);

			// Hent feature-adgangs-matrixen (best-effort). Fejler den, beholder
			// vi STANDARD_MATRIX saa adgangen aldrig falder bort.
			hentFeatureMatrix()
				.then((m) => {
					featureMatrix = m;
				})
				.catch((e) => console.warn('Kunne ikke hente feature-matrix:', e));

			// Start live-listener så ændringer (fx markerSpoergsmaalLaest)
			// propageres uden manuel reload
			userDocUnsubscribe?.();
			userDocUnsubscribe = lytTilUserDoc(u.uid, (ny) => {
				if (ny) userDoc = ny;
			});

			// A) Live-listener paa kundens allowedEmail-doc. Naar Linn flytter
			// hende til et nyt forl0b eller aendrer adgangs-felter, kommer
			// aendringen ind her i real-tid og vi koerer sync igen — uden at
			// kunden skal lukke/aabne appen.
			allowedEmailUnsubscribe?.();
			if (u.email) {
				allowedEmailUnsubscribe = lytTilAllowedEmail(u.email, () => {
					void genSynkroniser('allowedEmail-aendring');
				});
			}
		});

		return () => {
			authUnsubscribe();
			userDocUnsubscribe?.();
			allowedEmailUnsubscribe?.();
			document.removeEventListener('visibilitychange', onVisibility);
			window.removeEventListener('beforeinstallprompt', paaInstaller);
			clearTimeout(vagtUr);
			clearTimeout(aerligUr);
		};
	});
</script>

{#if loading}
	<div class="loading-screen">
		<Logo size="lg" />
		{#if opstartHaenger}
			<!-- Bjaelken taeller sekunder, ikke arbejde. Traekker det ud, er det
			     mere aerligt at sige det end at love en fremdrift der ikke findes. -->
			<div class="opstart-haenger">
				<p class="opstart-titel">Det tager længere end normalt</p>
				<p class="opstart-tekst">
					Vi kan ikke få fat i dine data lige nu. Tjek din forbindelse, og prøv igen.
				</p>
				<button class="opstart-knap" type="button" onclick={() => location.reload()}>
					Prøv igen
				</button>
			</div>
		{:else}
			<Loading tekst="Et øjeblik..." />
		{/if}
	</div>
{:else if userDoc && !isAdmin(user) && harIngenAdgang(userDoc)}
	<!-- Bruger uden adgang (efter 90-dages bonus + ingen aktivt abonnement,
	     eller email der aldrig blev whitelisted). Admin omgås tjekket så Linn
	     altid kan komme ind. -->
	<IngenAdgangScreen {userDoc} />
{:else if visHjemmeskaerm}
	<!-- Ny kunde, foerste gang. Skaermen staar alene, saa forsiden ikke
	     naar at aabne kettlebell-spoergsmaalet bagved. -->
	<HjemmeskaermScreen {installer} faerdig={hjemmeskaermFaerdig} />
{:else}
	<div class="app-shell">
		{#if userDoc?.adminKlientMode || userDoc?.adminKlientForlobId}
			<AdminKlientBanner
				mode={userDoc.adminKlientMode}
				forlobId={userDoc.adminKlientForlobId}
				onAfslut={afslutKlientMode}
			/>
		{/if}
		<Header />
		<main class="content">
			{@render children()}
		</main>
		<div class="tabbar-wrap">
			<TabBar />
		</div>
	</div>
{/if}

<style>
	/* Den aerlige skaerm, naar opstarten traekker ud. */
	.opstart-haenger {
		text-align: center;
		max-width: 300px;
		padding: 0 24px;
	}

	.opstart-titel {
		font-family: var(--ff-d);
		font-size: calc(19px * var(--fs-scale, 1));
		color: var(--text);
		margin: 0 0 8px;
	}

	.opstart-tekst {
		font-family: var(--ff-b);
		font-size: calc(13.5px * var(--fs-scale, 1));
		color: var(--text2);
		line-height: 1.55;
		margin: 0 0 18px;
	}

	.opstart-knap {
		width: 100%;
		background: var(--terra);
		color: #fff;
		border: 0;
		border-radius: 12px;
		padding: 13px;
		font-family: var(--ff-b);
		font-weight: 700;
		font-size: calc(15px * var(--fs-scale, 1));
		cursor: pointer;
	}

	.loading-screen {
		min-height: 100dvh;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 32px;
		background: var(--bg);
	}

	.app-shell {
		height: 100dvh;
		display: flex;
		flex-direction: column;
		background: var(--bg);
		overflow: hidden;
	}

	.content {
		flex: 1 1 auto;
		min-height: 0;
		overflow-y: auto;
		-webkit-overflow-scrolling: touch;
	}

	.tabbar-wrap {
		flex: 0 0 auto;
	}
</style>
