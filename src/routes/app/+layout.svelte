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
	import type { UserDoc } from '$lib/types';
	import TabBar from '$lib/components/TabBar.svelte';
	import Header from '$lib/components/Header.svelte';
	import Loading from '$lib/components/Loading.svelte';
	import Logo from '$lib/components/Logo.svelte';
	import AdminKlientBanner from '$lib/components/AdminKlientBanner.svelte';
	import AdminImpersonateBanner from '$lib/components/AdminImpersonateBanner.svelte';
	import ReadOnlyToast from '$lib/components/ReadOnlyToast.svelte';
	import IngenAdgangScreen from '$lib/components/IngenAdgangScreen.svelte';
	import { ryAdminKlientMode } from '$lib/userDoc';
	import { setAktivKlientForlobId } from '$lib/state/adminKlientState.svelte';
	import { harIngenAdgang } from '$lib/utils/userAdgang';
	import { isAdmin } from '$lib/admin';
	import { forladImpersonate, impersonateUid } from '$lib/viewOnlyState.svelte';

	let { children } = $props();

	let user = $state<User | null>(null);
	let userDoc = $state<UserDoc | null>(null);
	let loading = $state(true);

	// Impersonate-mode: hvis admin har sat impersonateUid i localStorage,
	// hentes klientens userDoc og bruges i stedet for admin's egen i hele
	// app'en. Skrive-handlinger blokeres centralt via safeWrite()-wrapper.
	let impersonatedDoc = $state<UserDoc | null>(null);
	const aktivImpersonateUid = $derived(impersonateUid());
	const erIImpersonate = $derived(aktivImpersonateUid !== null);
	const effektivAuthUid = $derived(aktivImpersonateUid ?? user?.uid ?? null);

	// Hent klientens userDoc naar impersonate-uid'en aendrer sig
	$effect(() => {
		const uid = aktivImpersonateUid;
		if (!uid || !isAdmin(user)) {
			impersonatedDoc = null;
			return;
		}
		getUserDoc(uid)
			.then((d) => {
				impersonatedDoc = d ?? null;
			})
			.catch((e) => {
				console.warn('Kunne ikke hente impersonate-userDoc:', e);
				impersonatedDoc = null;
			});
	});

	function forladImpersonateLokalt() {
		forladImpersonate();
		impersonatedDoc = null;
		// Refresh siden saa alle data-laesninger genstartes med admin's egen uid
		if (typeof window !== 'undefined') window.location.href = '/app';
	}

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
		function medAdminForlobId(forlobIds: string[] | undefined, id: string | undefined): string[] | undefined {
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
				state: 'forlobskunde',
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
				state: 'forlobskunde',
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
				state: 'modulbruger',
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
				state: 'modulbruger',
				accessLevel: 'premium',
				accessSource: 'abonnement',
				activeProduct: 'premiumabo',
				activeSubscription: true
			};
		}
		return d;
	}

	// Gør userDoc tilgængeligt for alle undersider via Svelte context.
	// I impersonate-mode bruger vi klientens userDoc i stedet for admin's
	// egen — alle data-laesninger peges saaledes paa klientens data.
	setContext('userDoc', () => {
		if (erIImpersonate && impersonatedDoc) return effektivUserDoc(impersonatedDoc);
		return effektivUserDoc(userDoc);
	});
	// User-context returnerer admin's User-objekt med en patched uid i
	// impersonate-mode — saa alle eksisterende user.uid-laesninger automatisk
	// peger paa klientens data uden refactor af komponenter. Firebase Auth's
	// interne uid forbliver admin's egen saa auth-handling (token-refresh,
	// sign-out) er uaendret.
	setContext('user', () => {
		if (erIImpersonate && aktivImpersonateUid && user) {
			return new Proxy(user, {
				get(target, prop) {
					if (prop === 'uid') return aktivImpersonateUid;
					return Reflect.get(target, prop);
				}
			}) as User;
		}
		return user;
	});
	// Effektiv uid bruges af alle data-laesninger der laeser fra
	// /users/{uid}/... — i impersonate-mode er det klientens uid, ellers
	// admin's egen auth.uid.
	setContext('effektivUid', () => effektivAuthUid);
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

		const authUnsubscribe = onAuthStateChanged(auth, async (u) => {
			if (!u) {
				// Ikke logget ind → send til login
				userDocUnsubscribe?.();
				userDocUnsubscribe = null;
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
				} catch (e) {
					console.warn('Forløbssync fejlede:', e);
				}
			}

			userDoc = doc;
			loading = false;

			// Start live-listener så ændringer (fx markerSpoergsmaalLaest)
			// propageres uden manuel reload
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
		{#if erIImpersonate && impersonatedDoc}
			<AdminImpersonateBanner
				klientNavn={impersonatedDoc.firstName || 'klient'}
				onForlad={forladImpersonateLokalt}
			/>
		{:else if userDoc?.adminKlientMode || userDoc?.adminKlientForlobId}
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
		<ReadOnlyToast />
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
