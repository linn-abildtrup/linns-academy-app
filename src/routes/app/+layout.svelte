<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount, setContext } from 'svelte';
	import { onAuthStateChanged, type User } from 'firebase/auth';
	import { auth } from '$lib/firebase';
	import {
		createUserDoc,
		getUserDoc,
		lytTilUserDoc,
		synkroniserForlobskundeStatus
	} from '$lib/userDoc';
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

	let { children } = $props();

	let user = $state<User | null>(null);
	let userDoc = $state<UserDoc | null>(null);
	let loading = $state(true);

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
		let userDocUnsubscribe: (() => void) | null = null;
		let allowedEmailUnsubscribe: (() => void) | null = null;

		// Sidste gang vi koerte synkronisering. Bruges af visibility-change-
		// listeneren til at undgaa for hyppige re-syncs (smaa skift mellem
		// apps maa ikke trigge sync hver gang). Tærskel: 10 minutter.
		let sidsteSync = Date.now();
		const SYNC_TAERSKEL_MS = 10 * 60 * 1000;

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
		// at have vaeret skjult > 10 min, koerer vi sync igen. Daekker iPhone-
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

			userDoc = doc;
			loading = false;

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
		};
	});
</script>

{#if loading}
	<div class="loading-screen">
		<Logo size="lg" />
		<Loading tekst="Et øjeblik..." />
	</div>
{:else if userDoc && !isAdmin(user) && harIngenAdgang(userDoc)}
	<!-- Bruger uden adgang (efter 90-dages bonus + ingen aktivt abonnement,
	     eller email der aldrig blev whitelisted). Admin omgås tjekket så Linn
	     altid kan komme ind. -->
	<IngenAdgangScreen {userDoc} />
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
