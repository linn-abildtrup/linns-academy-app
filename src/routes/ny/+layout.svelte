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
	import { harTestAdgang } from '$lib/utils/userAdgang';
	import { isAdmin } from '$lib/admin';
	import type { UserDoc } from '$lib/types';
	import {
		adgangsbilledeFor,
		type Adgangsbillede,
		type ForlobKilde
	} from '$lib/content/adgang3';
	import Ventetegn from '$lib/components/ny/Ventetegn.svelte';
	import './ny.css';

	let { children } = $props();

	/** Flag-noeglen der giver adgang til 3.0. Saettes pr kunde. */
	const FLAG = 'ny-app';

	let user = $state<User | null>(null);
	let userDoc = $state<UserDoc | null>(null);
	let forlob = $state<ForlobKilde[]>([]);
	let loading = $state(true);

	const maaSeNyApp = $derived(isAdmin(user) || harTestAdgang(userDoc, FLAG));

	// Adgangsbilledet udledes af de felter der allerede staar paa kunden.
	// Ingen skrivninger, ingen migrering. Se SPEC-3.0.md afsnit 2.2.1.
	const adgang = $derived<Adgangsbillede>(
		adgangsbilledeFor(
			Date.now(),
			{
				forlobIds: userDoc?.forlobIds,
				aboKoebtAt: userDoc?.aboKoebtAt,
				aboSlutterAt: userDoc?.aboSlutterAt,
				aboProdukt: userDoc?.aboProdukt,
				activeProduct: userDoc?.activeProduct,
				activeSubscription: userDoc?.activeSubscription,
				accessSource: userDoc?.accessSource,
				bonusPeriodEndsAt: userDoc?.bonusPeriodEndsAt,
				createdAt: userDoc?.createdAt
			},
			forlob
		)
	);

	setContext('userDoc', () => userDoc);
	setContext('user', () => user);
	setContext('adgang', () => adgang);
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
				await goto('/login');
				return;
			}

			user = u;
			const doc = await getUserDoc(u.uid);
			userDoc = doc;

			if (doc?.forlobIds?.length) {
				forlob = await indlaesForlob(doc.forlobIds);
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

	const faner = [
		{ href: '/ny', navn: 'Forside' },
		{ href: '/ny/moduler', navn: 'Moduler' },
		{ href: '/ny/udvikling', navn: 'Udvikling' },
		{ href: '/ny/profil', navn: 'Profil' }
	];

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
				Den nye app er under opbygning og er kun åben for udvalgte testere. Du finder din
				sædvanlige app på det vante sted.
			</p>
			<a class="btn" href="/app">Gå til appen</a>
		</div>
	{:else}
		<div class="ny-shell">
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
						{#if fane.navn === 'Forside'}
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
						{:else if fane.navn === 'Moduler'}
							<svg
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="1.9"
								stroke-linecap="round"
								stroke-linejoin="round"
								aria-hidden="true"
							>
								<rect x="3" y="3" width="7" height="7" rx="2" /><rect
									x="14"
									y="3"
									width="7"
									height="7"
									rx="2"
								/><rect x="3" y="14" width="7" height="7" rx="2" /><rect
									x="14"
									y="14"
									width="7"
									height="7"
									rx="2"
								/>
							</svg>
						{:else if fane.navn === 'Udvikling'}
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
