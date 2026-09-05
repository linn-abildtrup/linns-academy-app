<script lang="ts">
	// ============================================================
	// Nulstil en kundes adgangskode, i det nye design.
	//
	// Tolvte af de 19 gamle admin-sider, 1. september 2026, og den anden af
	// dem der roerer adgang.
	//
	// DEN HER SIDE SAETTER EN NY KODE PAA EN RIGTIG KONTO. Den gamle kode
	// holder op med at virke i samme sekund. Derfor:
	//  - der bekraeftes foer der trykkes, med kundens navn og mail synlig
	//  - koden vises ÉN gang, og der staar at den ikke kan hentes frem igen
	//  - der er en faerdig besked at kopiere, saa Linn ikke skal formulere
	//    den samme sms forfra hver gang
	//
	// LOGIKKEN ER FLYTTET, IKKE SKREVET OM. Samme endepunkt
	// /api/admin/set-temp-password, og samme fremgangsmaade med et frisk
	// id-token.
	//
	// Den gamle side paa /app/admin/nulstil-adgang er uroert og staar
	// stadig i menuen under System.
	// ============================================================

	import { getContext, onMount } from 'svelte';
	import type { User } from 'firebase/auth';
	import { isAdmin } from '$lib/admin';
	import { collection, getDocs } from 'firebase/firestore';
	import { db } from '$lib/firebase';
	import { klientSoegeMatch } from '$lib/utils/klientSoegning';
	import AdmSide from '$lib/components/admin/AdmSide.svelte';
	import AdmKort from '$lib/components/admin/AdmKort.svelte';
	import AdmKnap from '$lib/components/admin/AdmKnap.svelte';
	import AdmSoeg from '$lib/components/admin/AdmSoeg.svelte';
	import AdmTom from '$lib/components/admin/AdmTom.svelte';

	const hentUser = getContext<() => User | null>('user');
	const maaVaereHer = $derived(isAdmin(hentUser()));
	const user = $derived(hentUser());

	type Kunde = { email: string; fornavn: string; efternavn: string };

	let alle = $state<Kunde[]>([]);
	let henter = $state(true);
	let fejl = $state('');

	let soeg = $state('');
	let valgt = $state<Kunde | null>(null);
	let bekraefter = $state(false);
	let arbejder = $state(false);

	let kode = $state('');
	let kodeTil = $state('');
	let kopieret = $state('');

	const traeffer = $derived.by<Kunde[]>(() => {
		if (soeg.trim().length < 2) return [];
		return alle
			.filter((k) => klientSoegeMatch(`${k.fornavn} ${k.efternavn} ${k.email}`, soeg))
			.slice(0, 20);
	});

	function navnFor(k: Kunde): string {
		return `${k.fornavn} ${k.efternavn}`.trim() || k.email;
	}

	onMount(() => void indlaes());

	async function indlaes() {
		henter = true;
		fejl = '';
		try {
			const kort = new Map<string, Kunde>();
			// allowedEmails har navnene paa alle kunder fra Simplero.
			const tilladte = await getDocs(collection(db, 'allowedEmails'));
			for (const d of tilladte.docs) {
				const x = d.data() as { email?: string; firstName?: string; lastName?: string };
				const e = (x.email ?? '').toLowerCase();
				if (!e) continue;
				kort.set(e, { email: e, fornavn: x.firstName ?? '', efternavn: x.lastName ?? '' });
			}
			// users bruges som reserve for dem der ikke staar i allowedEmails.
			try {
				const brugere = await getDocs(collection(db, 'users'));
				for (const d of brugere.docs) {
					const x = d.data() as { email?: string; firstName?: string; lastName?: string };
					const e = (x.email ?? '').toLowerCase();
					if (!e) continue;
					const eks = kort.get(e);
					if (!eks) {
						kort.set(e, { email: e, fornavn: x.firstName ?? '', efternavn: x.lastName ?? '' });
					} else if (x.firstName && !eks.fornavn) {
						eks.fornavn = x.firstName;
					}
				}
			} catch (e) {
				console.warn('[admin] kunne ikke hente users', e);
			}
			alle = Array.from(kort.values()).sort((a, b) =>
				(a.fornavn || a.email).localeCompare(b.fornavn || b.email, 'da')
			);
		} catch (e) {
			console.error('[admin] nulstil-adgang', e);
			fejl = 'Kunne ikke hente kundelisten.';
		} finally {
			henter = false;
		}
	}

	async function nulstil() {
		const u = user;
		const k = valgt;
		if (!u || !k || arbejder) return;
		arbejder = true;
		fejl = '';
		try {
			// Et FRISK token. Endepunktet tjekker at det er admin, og et
			// gammelt token kan vaere udloebet.
			const idToken = await u.getIdToken(true);
			const res = await fetch('/api/admin/set-temp-password', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
				body: JSON.stringify({ email: k.email })
			});
			if (!res.ok) {
				const tekst = await res.text();
				let melding = 'Kunne ikke sætte en ny kode.';
				try {
					const p = JSON.parse(tekst);
					if (p.message) melding = p.message;
				} catch {
					if (tekst) melding = tekst;
				}
				fejl = melding;
				return;
			}
			const data = (await res.json()) as { tempPassword: string };
			kode = data.tempPassword;
			kodeTil = k.email;
			bekraefter = false;
			valgt = null;
			soeg = '';
		} catch (e) {
			console.error('[admin] nulstil', e);
			fejl = 'Kunne ikke få fat i serveren. Prøv igen.';
		} finally {
			arbejder = false;
		}
	}

	const beskedTilKunden = $derived(
		kode
			? `Jeg har nulstillet din adgangskode, som er ${kode}. Du skal logge ind med den og kan bagefter ændre den under Din side.`
			: ''
	);

	async function kopier(hvad: 'kode' | 'besked') {
		const tekst = hvad === 'kode' ? kode : beskedTilKunden;
		if (!tekst) return;
		try {
			await navigator.clipboard.writeText(tekst);
			kopieret = hvad;
			setTimeout(() => {
				if (kopieret === hvad) kopieret = '';
			}, 2000);
		} catch (e) {
			console.warn('[admin] kunne ikke kopiere', e);
			fejl = 'Kunne ikke kopiere. Marker teksten og kopier i hånden.';
		}
	}
</script>

<svelte:head><title>Nulstil adgangskode · Admin</title></svelte:head>

{#if !maaVaereHer}
	<p class="na-kun">Siden er kun for admin.</p>
{:else}
	<AdmSide
		titel="Nulstil adgangskode"
		under="Sæt en midlertidig kode for en kunde der ikke kan komme ind. Hendes gamle kode holder op med at virke med det samme."
	>
		{#if fejl}<div class="na-fejl">{fejl}</div>{/if}

		{#if kode}
			<!-- Koden vises ÉN gang. Der er ikke noget sted at hente den frem
			     igen, og det skal staa, ellers lukker man kortet og skal
			     nulstille forfra. -->
			<AdmKort ro>
				<div class="na-kvit-h">Ny kode til {kodeTil}</div>
				<div class="na-kode">{kode}</div>
				<p class="na-advarsel">
					Skriv den ned eller kopier den nu. Den kan ikke hentes frem igen, og du skal nulstille
					forfra hvis du mister den.
				</p>

				<div class="na-besked-boks">{beskedTilKunden}</div>

				<div class="na-knapper">
					<AdmKnap slags="primaer" onclick={() => kopier('besked')}>
						{kopieret === 'besked' ? 'Kopieret' : 'Kopier beskeden til hende'}
					</AdmKnap>
					<AdmKnap onclick={() => kopier('kode')}>
						{kopieret === 'kode' ? 'Kopieret' : 'Kopier kun koden'}
					</AdmKnap>
					<AdmKnap
						onclick={() => {
							kode = '';
							kodeTil = '';
						}}>Luk</AdmKnap
					>
				</div>
			</AdmKort>
		{/if}

		{#if henter}
			<AdmTom tekst="Henter kundelisten…" />
		{:else if alle.length === 0}
			<AdmTom tekst={fejl || 'Kunne ikke hente kundelisten.'} fejl>
				{#snippet handling()}
					<AdmKnap onclick={indlaes}>Prøv igen</AdmKnap>
				{/snippet}
			</AdmTom>
		{:else}
			<AdmKort>
				<AdmSoeg bind:vaerdi={soeg} placeholder="Søg efter navn eller mail…" />

				{#if valgt}
					<div class="na-valgt">
						<div>
							<span class="na-navn">{navnFor(valgt)}</span>
							<span class="na-mail">{valgt.email}</span>
						</div>
						<AdmKnap
							onclick={() => {
								valgt = null;
								bekraefter = false;
							}}>Vælg en anden</AdmKnap
						>
					</div>

					{#if bekraefter}
						<div class="na-advarsel-boks">
							Du sætter en ny kode for <b>{navnFor(valgt)}</b>. Hendes nuværende kode holder op med
							at virke med det samme, så hun kan ikke komme ind før du har sendt hende den nye.
						</div>
						<div class="na-knapper">
							<AdmKnap slags="fare" disabled={arbejder} onclick={nulstil}>
								{arbejder ? 'Sætter…' : 'Ja, sæt en ny kode'}
							</AdmKnap>
							<AdmKnap disabled={arbejder} onclick={() => (bekraefter = false)}>Fortryd</AdmKnap>
						</div>
					{:else}
						<div class="na-knapper">
							<AdmKnap slags="primaer" onclick={() => (bekraefter = true)}>Sæt en ny kode</AdmKnap>
						</div>
					{/if}
				{:else if soeg.trim().length < 2}
					<p class="na-hint">Skriv mindst to bogstaver for at søge blandt {alle.length} kunder.</p>
				{:else if traeffer.length === 0}
					<p class="na-hint">Ingen kunder matcher.</p>
				{:else}
					<div class="na-liste">
						{#each traeffer as k (k.email)}
							<button type="button" class="na-raekke" onclick={() => (valgt = k)}>
								<span class="na-navn">{navnFor(k)}</span>
								<span class="na-mail">{k.email}</span>
							</button>
						{/each}
					</div>
				{/if}
			</AdmKort>
		{/if}
	</AdmSide>
{/if}

<style>
	.na-kun {
		padding: 24px 18px;
		color: var(--ink-2);
		font-size: calc(14px * var(--fs-scale, 1));
	}

	.na-fejl {
		margin-bottom: 12px;
		padding: 11px 15px;
		border-radius: 12px;
		background: var(--ler-tint, #f4e6de);
		color: var(--ler-tekst, #8a5439);
		font-size: calc(13.5px * var(--fs-scale, 1));
		font-weight: 600;
	}

	.na-kvit-h {
		font-size: calc(11px * var(--fs-scale, 1));
		font-weight: 700;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--honey-deep, #b47f3e);
		margin-bottom: 8px;
	}

	.na-kode {
		font-size: calc(28px * var(--fs-scale, 1));
		font-weight: 600;
		letter-spacing: 0.04em;
		color: var(--espresso, #382c2a);
		word-break: break-all;
	}

	.na-advarsel {
		margin: 8px 0 12px;
		font-size: calc(12.5px * var(--fs-scale, 1));
		color: var(--honey-deep, #b47f3e);
		line-height: 1.45;
		font-weight: 600;
	}

	.na-besked-boks {
		padding: 12px 14px;
		background: var(--paper, #fbf8f2);
		border-radius: 11px;
		font-size: calc(13px * var(--fs-scale, 1));
		line-height: 1.5;
		margin-bottom: 12px;
	}

	.na-advarsel-boks {
		margin: 12px 0;
		padding: 12px 14px;
		background: var(--ler-tint, #f4e6de);
		border-radius: 11px;
		color: var(--ler-tekst, #8a5439);
		font-size: calc(12.5px * var(--fs-scale, 1));
		line-height: 1.5;
	}

	.na-knapper {
		display: flex;
		gap: 8px;
		flex-wrap: wrap;
	}

	.na-hint {
		margin: 12px 0 0;
		font-size: calc(12.5px * var(--fs-scale, 1));
		color: var(--ink-3, #a3948a);
	}

	.na-liste {
		display: flex;
		flex-direction: column;
		gap: 5px;
		margin-top: 12px;
	}

	.na-raekke {
		display: block;
		width: 100%;
		padding: 11px 14px;
		background: var(--paper, #fbf8f2);
		border: none;
		border-radius: 11px;
		font-family: inherit;
		text-align: left;
		cursor: pointer;
	}

	.na-valgt {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
		flex-wrap: wrap;
		margin-top: 12px;
		padding: 12px 14px;
		background: var(--plum-tint, #f1e5e8);
		border-radius: 11px;
	}

	.na-navn {
		display: block;
		font-size: calc(14px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--espresso, #382c2a);
	}

	.na-mail {
		display: block;
		font-size: calc(11.5px * var(--fs-scale, 1));
		color: var(--ink-3, #a3948a);
	}
</style>
