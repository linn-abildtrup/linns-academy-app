<script lang="ts">
	// ============================================================
	// Find en kunde. Foerste halvdel af kunde-opslaget.
	//
	// Linns oenske 3. september 2026, tegnet i mockups-kunde-opslag.html.
	//
	// Der hentes ALLE brugere én gang og soeges lokalt. Det er ét opslag i
	// stedet for ét pr tastetryk, og listen er lille nok: godt 900 raekker
	// med navn og mail. Samme moenster som testere-siden.
	//
	// Soegningen er klientSoegeMatch, altsaa den samme som resten af admin.
	// Den taaler ae, oe og aa, flere ord og en slaafejl.
	//
	// EFTERNAVNET HENTES OGSAA I KOEBSLISTEN. To tredjedele af kunderne har
	// kun et fornavn paa deres konto, fordi feltet kun bliver sat naar
	// koebet fra Simplero havde det med. Uden det opslag finder en soegning
	// paa efternavn kun hver tredje kunde. Linn 4. september.
	// ============================================================

	import { getContext, onMount } from 'svelte';
	import type { User } from 'firebase/auth';
	import { isAdmin } from '$lib/admin';
	import { collection, getDocs } from 'firebase/firestore';
	import { db } from '$lib/firebase';
	import { hentNavnePerEmail } from '$lib/firestore/forlob';
	import type { UserDoc } from '$lib/types';
	import { klientSoegeMatch } from '$lib/utils/klientSoegning';
	import {
		fuldtNavn,
		initialer,
		dageSiden,
		navnMedListen,
		soegeTekst
	} from '$lib/content/kundeOpslag3';
	import AdmSide from '$lib/components/admin/AdmSide.svelte';
	import AdmKnap from '$lib/components/admin/AdmKnap.svelte';
	import AdmSoeg from '$lib/components/admin/AdmSoeg.svelte';
	import AdmTom from '$lib/components/admin/AdmTom.svelte';

	const hentUser = getContext<() => User | null>('user');
	const maaVaereHer = $derived(isAdmin(hentUser()));

	type Raekke = {
		uid: string;
		email: string;
		fornavn: string;
		efternavn: string;
		/** Kontoens navn, koebslistens navn og mailen samlet. */
		soeg: string;
		forlobIds: string[];
		sidstAktiv: number | null;
	};

	let alle = $state<Raekke[]>([]);
	let henter = $state(true);
	let fejl = $state('');
	let soeg = $state('');

	const nu = Date.now();

	onMount(() => void indlaes());

	async function indlaes() {
		henter = true;
		fejl = '';
		try {
			// Koebslisten maa gerne fejle for sig. Saa er der stadig en
			// soegning, den finder bare faerre efternavne.
			const [snap, navne] = await Promise.all([
				getDocs(collection(db, 'users')),
				hentNavnePerEmail().catch((e) => {
					console.warn('[admin] navne fra købslisten', e);
					return new Map<string, string>();
				})
			]);
			alle = snap.docs
				.map((d) => {
					const x = d.data() as UserDoc & { lastName?: string; sidstAktiv3?: number };
					const email = x.email ?? '';
					const fraListen = navne.get(email.toLowerCase());
					const navn = navnMedListen(x.firstName ?? '', x.lastName ?? '', fraListen);
					return {
						uid: d.id,
						email,
						fornavn: navn.fornavn,
						efternavn: navn.efternavn,
						soeg: soegeTekst(x.firstName ?? '', x.lastName ?? '', email, fraListen),
						forlobIds: (x as unknown as { forlobIds?: string[] }).forlobIds ?? [],
						sidstAktiv: typeof x.sidstAktiv3 === 'number' ? x.sidstAktiv3 : null
					};
				})
				.sort((a, b) => (a.fornavn || a.email).localeCompare(b.fornavn || b.email, 'da'));
		} catch (e) {
			console.error('[admin] kunder', e);
			fejl = 'Kunne ikke hente kunderne.';
		} finally {
			henter = false;
		}
	}

	const traeffer = $derived.by<Raekke[]>(() => {
		if (soeg.trim().length < 2) return [];
		return alle.filter((r) => klientSoegeMatch(r.soeg, soeg)).slice(0, 40);
	});

	function aktivTekst(r: Raekke): string {
		const d = dageSiden(r.sidstAktiv, nu);
		if (d === null) return '';
		if (d === 0) return 'i appen i dag';
		if (d === 1) return 'i appen i går';
		return `sidst i appen for ${d} dage siden`;
	}
</script>

<svelte:head><title>Slå en kunde op · Admin</title></svelte:head>

{#if !maaVaereHer}
	<p class="ks-kun">Siden er kun for admin.</p>
{:else}
	<AdmSide
		titel="Slå en kunde op"
		under="Søg på fornavn, efternavn eller mail, og se alt hvad appen ved om hende."
		bred
	>
		{#snippet handling()}
			<AdmKnap onclick={indlaes}>Hent igen</AdmKnap>
		{/snippet}

		<AdmSoeg bind:vaerdi={soeg} placeholder="Fornavn, efternavn eller mail…" />

		{#if henter}
			<AdmTom tekst="Henter kunderne…" />
		{:else if fejl}
			<AdmTom tekst={fejl} fejl>
				{#snippet handling()}
					<AdmKnap onclick={indlaes}>Prøv igen</AdmKnap>
				{/snippet}
			</AdmTom>
		{:else if soeg.trim().length < 2}
			<p class="ks-hint">Skriv mindst to bogstaver for at søge blandt {alle.length} kunder.</p>
		{:else if traeffer.length === 0}
			<p class="ks-hint">Ingen kunder matcher. Prøv med mailen i stedet.</p>
		{:else}
			<p class="ks-antal">{traeffer.length} {traeffer.length === 1 ? 'kunde' : 'kunder'}</p>
			<div class="ks-liste">
				{#each traeffer as r (r.uid)}
					<a class="ks-raekke" href="/ny/admin/kunde/{r.uid}">
						<span class="ks-ini">{initialer(r.fornavn, r.efternavn, r.email)}</span>
						<span class="ks-tekst">
							<span class="ks-navn">{fuldtNavn(r.fornavn, r.efternavn, r.email)}</span>
							<span class="ks-meta">
								{r.email}
								{#if aktivTekst(r)}· {aktivTekst(r)}{/if}
							</span>
						</span>
						<span class="ks-pil">›</span>
					</a>
				{/each}
			</div>
		{/if}
	</AdmSide>
{/if}

<style>
	.ks-kun {
		padding: 24px 18px;
		color: var(--ink-2);
		font-size: calc(14px * var(--fs-scale, 1) * var(--adm-skala, 1));
	}

	.ks-hint,
	.ks-antal {
		margin: 14px 0 10px;
		font-size: calc(12.5px * var(--fs-scale, 1) * var(--adm-skala, 1));
		color: var(--ink-3);
	}

	.ks-liste {
		display: flex;
		flex-direction: column;
		gap: 5px;
	}

	.ks-raekke {
		display: flex;
		align-items: center;
		gap: 11px;
		padding: 10px 13px;
		background: var(--paper-2);
		border-radius: 13px;
		text-decoration: none;
		color: inherit;
	}

	.ks-ini {
		width: 38px;
		height: 38px;
		flex-shrink: 0;
		display: grid;
		place-items: center;
		background: var(--plum-tint);
		border-radius: 11px;
		color: var(--plum);
		font-size: calc(13.5px * var(--fs-scale, 1) * var(--adm-skala, 1));
		font-weight: 600;
	}

	.ks-tekst {
		flex: 1;
		min-width: 0;
	}

	.ks-navn {
		display: block;
		font-size: calc(14px * var(--fs-scale, 1) * var(--adm-skala, 1));
		font-weight: 600;
	}

	.ks-meta {
		display: block;
		font-size: calc(11.5px * var(--fs-scale, 1) * var(--adm-skala, 1));
		color: var(--ink-3);
	}

	.ks-pil {
		flex-shrink: 0;
		color: var(--ink-3);
	}
</style>
