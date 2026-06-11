<script lang="ts">
	import { getContext, onMount } from 'svelte';
	import {
		EmailAuthProvider,
		reauthenticateWithCredential,
		signOut,
		updatePassword
	} from 'firebase/auth';
	import { auth, db } from '$lib/firebase';
	import { doc as doc_ref, updateDoc } from 'firebase/firestore';
	import { goto } from '$app/navigation';
	import type { User } from 'firebase/auth';
	import { KICKSTART_PRODUCT_ID, KROPSRO_PRODUCT_ID, type ForlobProduct, type UserDoc } from '$lib/types';
	import { getKoebForUser, formatUdlobsdato } from '$lib/content/koeb';
	import type { TrainingProgram, UserProduct } from '$lib/content/mikrotraening';
	import {
		gemProgramValg,
		hentForlobsProgrammer,
		hentUserProduct,
		synkroniserTraeningsvariant,
		tilfoejNulDageInterval,
		fjernNulDageInterval
	} from '$lib/firestore/mikrotraening';
	import {
		forlobTypeForId,
		programIdForVariant,
		type Variant
	} from '$lib/utils/traeningsvariant';
	import { hentAktivProduktType } from '$lib/firestore/forlob';
	import { gemAktivtTraeningsprogram } from '$lib/firestore/mineProgrammer';
	import { MAX_NUL_DAGE_PR_FORLOB, effektivMaxNulDage } from '$lib/content/mikrotraening';
	import { nulDageDatoer } from '$lib/content/forlob';
	import TesterBadge from '$lib/components/TesterBadge.svelte';
	import BekraeftModal from '$lib/components/BekraeftModal.svelte';
	import Icon, { type IconName } from '$lib/components/Icon.svelte';
	import {
		anvendScale,
		gemScale,
		laesGemtScale,
		type TextScale
	} from '$lib/utils/textScale';
	import {
		dagligeMalForBruger,
		NAERING_LABELS,
		NAERING_ENHEDER
	} from '$lib/content/naering';
	import { gemBrugerProfilOgMaal, gemNaeringsindstillinger } from '$lib/userDoc';
	import type { BrugerProfil, DagligeMaal } from '$lib/types';
	import BeregnMaalWizard from '$lib/components/BeregnMaalWizard.svelte';
	import { effektivState, erKropsroForlobskunde, harPremium } from '$lib/utils/userAdgang';
	import { harFeatureAdgang, type FeatureMatrix } from '$lib/content/features';

	const getUser = getContext<() => User | null>('user');
	const getUserDoc = getContext<() => UserDoc | null>('userDoc');
	const getFeatureMatrix = getContext<() => FeatureMatrix | null>('featureMatrix');

	const user = $derived(getUser());
	const userDoc = $derived(getUserDoc());
	const userState = $derived(effektivState(userDoc));
	const erPremium = $derived(harPremium(userDoc));

	// Tekststørrelse
	let aktivScale = $state<TextScale>('normal');
	onMount(() => {
		aktivScale = laesGemtScale();
	});
	function vaelgScale(s: TextScale) {
		aktivScale = s;
		gemScale(s);
		anvendScale(s);
	}

	// Næringsindstillinger
	let visUdvidet = $state(false);
	let dagligeMaal = $state<DagligeMaal>(dagligeMalForBruger(undefined));
	let gemmerNaering = $state(false);
	$effect(() => {
		// Læs aktuelle indstillinger fra userDoc når den loader
		const ud = userDoc;
		if (!ud) return;
		visUdvidet = ud.visUdvidetNaering ?? false;
		dagligeMaal = dagligeMalForBruger(ud.dagligeMaal);
	});

	async function toggleUdvidet() {
		const u = user;
		if (!u || gemmerNaering) return;
		visUdvidet = !visUdvidet;
		gemmerNaering = true;
		try {
			await gemNaeringsindstillinger(u.uid, visUdvidet, dagligeMaal);
		} catch (e) {
			console.error(e);
			visUdvidet = !visUdvidet;
		} finally {
			gemmerNaering = false;
		}
	}

	let gemMaalTimer: ReturnType<typeof setTimeout> | null = null;
	function maalAendret() {
		const u = user;
		if (!u) return;
		// Debounce så vi ikke skriver ved hvert tastetryk
		if (gemMaalTimer) clearTimeout(gemMaalTimer);
		gemMaalTimer = setTimeout(async () => {
			try {
				await gemNaeringsindstillinger(u.uid, visUdvidet, dagligeMaal);
			} catch (e) {
				console.error(e);
			}
		}, 600);
	}

	const NAERINGSFELTER = ['protein', 'fiber', 'kh', 'fedt', 'kcal'] as const;

	// Wizard-state
	let viserWizard = $state(false);

	async function brugBeregnedeMaal(profil: BrugerProfil, maal: DagligeMaal) {
		const u = user;
		if (!u) {
			viserWizard = false;
			return;
		}
		try {
			await gemBrugerProfilOgMaal(u.uid, profil, maal);
			dagligeMaal = { ...maal };
			visUdvidet = true;
		} catch (e) {
			console.error(e);
		} finally {
			viserWizard = false;
		}
	}

	// Mikrotræning-program-valg
	let mtProgrammer = $state<TrainingProgram[]>([]);
	let valgtMtProgramId = $state<string | null>(null);
	let mtIndlaeser = $state(false);
	let mtFejl = $state<string | null>(null);
	let mtGemmer = $state<string | null>(null);
	let mtProduktType = $state<ForlobProduct>(KICKSTART_PRODUCT_ID);
	let mtForlobId = $state<string | null>(null);

	// Nul-dage (test-feature)
	let nulIntervaller = $state<{ fra: string; til: string; satMs: number }[]>([]);
	let nulBonus = $state<number>(0);
	let nulFra = $state('');
	let nulTil = $state('');
	let nulGemmer = $state(false);
	let nulFejl = $state<string | null>(null);
	let nulFortrydMs = $state<number | null>(null);
	// Nul-dage styres nu af feature-skemaet (som de oevrige funktioner).
	// Tester-undtagelsen er indbygget i harFeatureAdgang, saa nuvaerende
	// nul-dage-testere bevarer adgangen. Standard er slukket for alle.
	const harNulDageTest = $derived(
		harFeatureAdgang(userDoc, getFeatureMatrix?.() ?? null, 'nul-dage')
	);
	const erKropsro = $derived(mtProduktType === KROPSRO_PRODUCT_ID);
	const visNulDage = $derived(harNulDageTest && erKropsro && !!mtForlobId);
	const nulBrugt = $derived(nulDageDatoer(nulIntervaller).length);
	const nulMax = $derived(MAX_NUL_DAGE_PR_FORLOB + Math.max(0, nulBonus));
	const nulTilbage = $derived(nulMax - nulBrugt);
	const idagIso = idag();
	function idag(): string {
		const d = new Date();
		const y = d.getFullYear();
		const m = String(d.getMonth() + 1).padStart(2, '0');
		const dd = String(d.getDate()).padStart(2, '0');
		return `${y}-${m}-${dd}`;
	}

	function ikonForUdstyr(udstyr: string[]): IconName {
		if (udstyr.includes('kettlebell')) return 'kettlebell';
		if (udstyr.includes('haandvaegte')) return 'kettlebell';
		return 'stretch';
	}

	onMount(async () => {
		const u = user;
		if (!u) return;
		mtIndlaeser = true;
		try {
			mtProduktType = await hentAktivProduktType(userDoc?.forlobIds ?? []);
			const up = await hentUserProduct(u.uid, mtProduktType);
			const adminForlobId = userDoc?.adminKlientForlobId ?? null;
			const forlobId =
				(up as UserProduct & { forlobId?: string } | null)?.forlobId ?? adminForlobId;
			if (!forlobId) return;
			mtForlobId = forlobId;
			const alle = await hentForlobsProgrammer(forlobId);
			mtProgrammer = alle.filter((p) => p.aktiv);
			valgtMtProgramId = up?.programValg?.mikrotraening ?? null;
			nulIntervaller = up?.nulDage?.intervaller ?? [];
			nulBonus = up?.bonusNulDage ?? 0;
		} catch (e) {
			console.error('Kunne ikke hente mikrotræning-programmer:', e);
		} finally {
			mtIndlaeser = false;
		}
	});

	function antalDageIInterval(fra: string, til: string): number {
		const f = new Date(fra);
		const t = new Date(til);
		if (isNaN(f.getTime()) || isNaN(t.getTime())) return 0;
		const ms = t.getTime() - f.getTime();
		return Math.floor(ms / (1000 * 60 * 60 * 24)) + 1;
	}

	function satIDag(satMs: number): boolean {
		const sat = new Date(satMs);
		return (
			sat.getFullYear() === new Date().getFullYear() &&
			sat.getMonth() === new Date().getMonth() &&
			sat.getDate() === new Date().getDate()
		);
	}

	function formaterDatoKort(iso: string): string {
		const [y, m, d] = iso.split('-');
		return `${parseInt(d, 10)}/${parseInt(m, 10)}`;
	}

	async function gemNulInterval() {
		if (!user || nulGemmer || !nulFra || !nulTil) return;
		if (nulFra < idagIso) {
			nulFejl = 'Du kan kun vaelge fra i dag og frem.';
			return;
		}
		if (nulTil < nulFra) {
			nulFejl = 'Slutdato skal vaere efter startdato.';
			return;
		}
		nulGemmer = true;
		nulFejl = null;
		try {
			const res = await tilfoejNulDageInterval(
				user.uid,
				mtProduktType,
				nulFra,
				nulTil,
				nulMax
			);
			if (!res.ok) {
				nulFejl = res.fejl;
				return;
			}
			nulIntervaller = [
				...nulIntervaller,
				{ fra: nulFra, til: nulTil, satMs: Date.now() }
			];
			nulFra = '';
			nulTil = '';
		} catch (e) {
			console.error(e);
			nulFejl = 'Kunne ikke gemme. Proev igen.';
		} finally {
			nulGemmer = false;
		}
	}

	async function bekraeftFortryd() {
		if (!user || nulFortrydMs === null) return;
		const satMs = nulFortrydMs;
		nulFortrydMs = null;
		try {
			await fjernNulDageInterval(user.uid, mtProduktType, satMs);
			nulIntervaller = nulIntervaller.filter((iv) => iv.satMs !== satMs);
		} catch (e) {
			console.error(e);
			nulFejl = 'Kunne ikke fjerne. Proev igen.';
		}
	}

	async function vaelgMtProgram(programId: string) {
		const u = user;
		if (!u || mtGemmer || valgtMtProgramId === programId) return;
		mtGemmer = programId;
		mtFejl = null;
		try {
			const opgaver: Promise<unknown>[] = [
				gemProgramValg(u.uid, mtProduktType, 'mikrotraening', programId)
			];
			if (mtForlobId) {
				opgaver.push(
					gemAktivtTraeningsprogram(u.uid, {
						kilde: 'tildelt',
						programId,
						forlobId: mtForlobId
					})
				);
			}
			await Promise.all(opgaver);
			valgtMtProgramId = programId;
		} catch (e) {
			console.error(e);
			mtFejl = 'Kunne ikke skifte program. Prøv igen.';
		} finally {
			mtGemmer = null;
		}
	}

	// Variant-valg: virker for baade abo og forloeb. Synkroniserer
	// userDoc.mikrotraeningVariant og products/{id}.programValg.mikrotraening
	// saa valget afspejles ens overalt (forsiden, traeningsmodul, profil).
	const erAbonnent = $derived(userDoc?.accessSource === 'abonnement');
	const erForlobskunde = $derived(userDoc?.accessSource === 'forløb');
	let varGemmer = $state<Variant | null>(null);
	let varFejl = $state<string | null>(null);

	async function vaelgVariant(variant: Variant) {
		const u = user;
		if (!u || varGemmer) return;
		if ((userDoc?.mikrotraeningVariant ?? 'no_kettlebell') === variant) return;
		varGemmer = variant;
		varFejl = null;
		try {
			// Forloebskunder faar baade userDoc og products synkroniseret
			// via synkroniserTraeningsvariant. Abo-kunder kun userDoc.
			// forlobId med saa aktivtTraeningsprogram opdateres og
			// /app/moduler/traening viser den nye variant som 'Aktiv'.
			const productId = erForlobskunde ? mtProduktType : null;
			const forlobId = erForlobskunde ? (mtForlobId ?? null) : null;
			await synkroniserTraeningsvariant(u.uid, variant, productId, forlobId);
			// Hold ogsaa valgtMtProgramId i sync saa program-listen ikke
			// viser foraeldet 'aktiv'-markering.
			if (erForlobskunde) {
				valgtMtProgramId = programIdForVariant(variant, forlobTypeForId(forlobId));
			}
		} catch (e) {
			console.error(e);
			varFejl = 'Kunne ikke skifte variant. Prøv igen.';
		} finally {
			varGemmer = null;
		}
	}

	const initial = $derived((userDoc?.firstName ?? '?').charAt(0).toUpperCase());

	const statusTekst = $derived.by(() => {
		if (userState === 'forlobskunde') {
			if (erKropsroForlobskunde(userDoc)) {
				return 'Du er på Kropsro';
			}
			return 'Du er på Kickstart en sund overgangsalder';
		}
		if (userState === 'modulbruger') {
			return 'Du har adgang til Linn\u2019s Academy';
		}
		if (userState === 'udlobet') {
			return 'Din adgang er udløbet';
		}
		return '';
	});

	const koeb = $derived(getKoebForUser(userDoc));

	async function handleLogout() {
		try {
			await signOut(auth);
			await goto('/login');
		} catch (err) {
			console.error('Log ud fejlede', err);
		}
	}

	let nulstillerApp = $state(false);
	let viserNulstilBekraeft = $state(false);

	function aabnNulstilBekraeft() {
		if (nulstillerApp) return;
		viserNulstilBekraeft = true;
	}

	async function handleNulstilApp() {
		if (nulstillerApp) return;
		viserNulstilBekraeft = false;
		nulstillerApp = true;
		try {
			// 1. Log ud af Firebase Auth — fjerner tokens i IndexedDB
			try {
				await signOut(auth);
			} catch (e) {
				console.warn('signOut fejlede:', e);
			}

			// 2. Ryd al localStorage og sessionStorage
			try {
				localStorage.clear();
				sessionStorage.clear();
			} catch (e) {
				console.warn('Storage-ryd fejlede:', e);
			}

			// 3. Unregister service workers (hvis nogen)
			if ('serviceWorker' in navigator) {
				try {
					const regs = await navigator.serviceWorker.getRegistrations();
					for (const reg of regs) await reg.unregister();
				} catch (e) {
					console.warn('SW-unregister fejlede:', e);
				}
			}

			// 4. Ryd cache-storage
			if ('caches' in window) {
				try {
					const navne = await caches.keys();
					await Promise.all(navne.map((n) => caches.delete(n)));
				} catch (e) {
					console.warn('Cache-ryd fejlede:', e);
				}
			}

			// 5. Hård reload til login
			window.location.href = '/login';
		} finally {
			nulstillerApp = false;
		}
	}

	// Skift-adgangskode-state
	let viserSkiftPassword = $state(false);
	let nuPassword = $state('');
	let nyPassword = $state('');
	let bekraeftPassword = $state('');
	let skifterPassword = $state(false);
	let passwordBesked = $state<{ tekst: string; type: 'ok' | 'fejl' } | null>(null);

	async function skiftPassword() {
		passwordBesked = null;
		const u = user;
		if (!u || !u.email) {
			passwordBesked = { tekst: 'Du skal være logget ind.', type: 'fejl' };
			return;
		}
		if (nyPassword.length < 6) {
			passwordBesked = { tekst: 'Adgangskoden skal være mindst 6 tegn.', type: 'fejl' };
			return;
		}
		if (nyPassword !== bekraeftPassword) {
			passwordBesked = { tekst: 'De to adgangskoder matcher ikke.', type: 'fejl' };
			return;
		}
		skifterPassword = true;
		try {
			const cred = EmailAuthProvider.credential(u.email, nuPassword);
			await reauthenticateWithCredential(u, cred);
			await updatePassword(u, nyPassword);
			passwordBesked = { tekst: 'Din adgangskode er skiftet.', type: 'ok' };
			nuPassword = '';
			nyPassword = '';
			bekraeftPassword = '';
			setTimeout(() => {
				viserSkiftPassword = false;
				passwordBesked = null;
			}, 2000);
		} catch (e) {
			const fejlkode =
				e && typeof e === 'object' && 'code' in e ? String((e as { code: string }).code) : '';
			if (fejlkode === 'auth/wrong-password' || fejlkode === 'auth/invalid-credential') {
				passwordBesked = { tekst: 'Nuværende adgangskode er forkert.', type: 'fejl' };
			} else {
				passwordBesked = {
					tekst: 'Kunne ikke skifte adgangskode. Prøv igen.',
					type: 'fejl'
				};
			}
		} finally {
			skifterPassword = false;
		}
	}

	function statusLabel(status: string): string {
		if (status === 'aktiv') return 'Aktiv';
		if (status === 'laeseadgang') return 'Læseadgang';
		return 'Udløbet';
	}

	function metaTekst(k: { lobende: boolean; udlobsdato?: string; status: string }): string {
		if (k.status === 'laeseadgang' && k.udlobsdato) {
			return 'Læseadgang til ' + formatUdlobsdato(k.udlobsdato);
		}
		if (k.status === 'laeseadgang') {
			return 'Læseadgang, ingen tracking';
		}
		if (k.lobende) {
			return 'Løbende adgang';
		}
		if (k.udlobsdato) {
			return 'Adgang til ' + formatUdlobsdato(k.udlobsdato);
		}
		return '';
	}
</script>

<div class="profil">
	<header class="header">
		<div class="avatar" aria-hidden="true">{initial}</div>
		<h1 class="navn">{userDoc?.firstName ?? ''}</h1>
		<p class="email">{user?.email ?? ''}</p>
	</header>

	{#if statusTekst}
		<section class="status-card">
			<p class="card-label">Status</p>
			<p class="card-text">{statusTekst}</p>
		</section>
	{/if}

	{#if koeb.length > 0}
		<section class="sektion">
			<h2 class="sektion-titel">Mine køb</h2>
			<ul class="koeb-liste">
				{#each koeb as k (k.id)}
					<li class="koeb" class:koeb-laeseadgang={k.status === 'laeseadgang'}>
						<div class="koeb-info">
							<span class="koeb-navn">{k.navn}</span>
							<span class="koeb-meta">{metaTekst(k)}</span>
						</div>
						<span class="badge" class:badge-laeseadgang={k.status === 'laeseadgang'}>
							{statusLabel(k.status)}
						</span>
					</li>
				{/each}
			</ul>
		</section>
	{/if}

	<!-- Variant-vaelger flyttet under: gaelder ALLE kundetyper. Dette
	     'mtProgrammer'-block er fjernet for at undgaa dobbelt-visning
	     af samme valg (med/uden kettlebell) for forloebskunder. -->

	{#if visNulDage}
		<section class="sektion">
			<h2 class="sektion-titel">
				Nul-dage
				<TesterBadge />
			</h2>
			<p class="sektion-sub">
				Sæt dit forløb på pause når du er på ferie, syg eller har travlt. Hver nul-dag
				skubber forløbet én dag frem. Du har {nulMax} nul-dage til dette forløb.
			</p>

			<div class="nul-tael">
				<div class="nul-tael-tal">{nulBrugt} / {nulMax}</div>
				<div class="nul-tael-tekst">brugt — {nulTilbage} tilbage</div>
			</div>

			{#if nulFejl}
				<div class="status-besked fejl">{nulFejl}</div>
			{/if}

			{#if nulTilbage > 0}
				<div class="nul-form">
					<label class="nul-felt">
						<span class="nul-label">Fra</span>
						<input type="date" bind:value={nulFra} min={idagIso} disabled={nulGemmer} />
					</label>
					<label class="nul-felt">
						<span class="nul-label">Til</span>
						<input
							type="date"
							bind:value={nulTil}
							min={nulFra || idagIso}
							disabled={nulGemmer}
						/>
					</label>
					<button
						class="nul-knap"
						type="button"
						onclick={gemNulInterval}
						disabled={!nulFra || !nulTil || nulGemmer}
					>
						{nulGemmer ? 'Gemmer...' : 'Marker som nul-dage'}
					</button>
				</div>
			{:else}
				<div class="status-besked">Du har brugt alle dine nul-dage for dette forløb.</div>
			{/if}

			{#if nulIntervaller.length > 0}
				<div class="nul-liste-titel">Dine nul-dage</div>
				<ul class="nul-liste">
					{#each [...nulIntervaller].sort((a, b) => a.fra.localeCompare(b.fra)) as iv (iv.satMs)}
						{@const dage = antalDageIInterval(iv.fra, iv.til)}
						{@const kanFortryde = satIDag(iv.satMs)}
						<li class="nul-rad">
							<div class="nul-rad-tekst">
								<div class="nul-rad-datoer">
									{formaterDatoKort(iv.fra)}{iv.fra !== iv.til ? ' – ' + formaterDatoKort(iv.til) : ''}
								</div>
								<div class="nul-rad-meta">
									{dage} dag{dage === 1 ? '' : 'e'}
									{#if !kanFortryde}
										· låst
									{/if}
								</div>
							</div>
							{#if kanFortryde}
								<button
									class="nul-fortryd"
									type="button"
									onclick={() => (nulFortrydMs = iv.satMs)}
								>
									Fortryd
								</button>
							{/if}
						</li>
					{/each}
				</ul>
			{/if}
		</section>
	{/if}

	{#if nulFortrydMs !== null}
		<BekraeftModal
			titel="Fortryd nul-dage?"
			beskrivelse="Dagene gives tilbage til din pulje og forløbet rykkes tilbage til sin oprindelige slutdato."
			bekraeftTekst="Ja, fortryd"
			destruktiv
			onBekraeft={bekraeftFortryd}
			onAnnuller={() => (nulFortrydMs = null)}
		/>
	{/if}

	{#if userDoc}
		{@const aktivVariant = userDoc?.mikrotraeningVariant ?? 'no_kettlebell'}
		<section class="sektion">
			<h2 class="sektion-titel">Mikrotræning — program</h2>
			<p class="sektion-sub">
				Vælg om du træner med eller uden udstyr. Dit program opdateres med det samme.
			</p>
			{#if varFejl}
				<div class="status-besked fejl">{varFejl}</div>
			{/if}
			<div class="program-liste">
				{#each [{ id: 'kettlebell' as const, navn: 'Mikrotræning med kettlebell', sub: 'Program med kettlebell-øvelser' }, { id: 'no_kettlebell' as const, navn: 'Mikrotræning uden udstyr', sub: 'Bodyweight-øvelser' }] as v (v.id)}
					{@const aktiv = aktivVariant === v.id}
					{@const gemmerDenne = varGemmer === v.id}
					<button
						class="program-knap"
						class:aktiv
						type="button"
						onclick={() => vaelgVariant(v.id)}
						disabled={varGemmer !== null}
					>
						<span class="program-ikon" class:aktiv>
							<Icon name={v.id === 'kettlebell' ? 'kettlebell' : 'stretch'} size={18} />
						</span>
						<span class="program-tekst">
							<span class="program-navn">{v.navn}</span>
							<span class="program-sub">{v.sub}</span>
						</span>
						<span class="program-status">
							{#if gemmerDenne}
								<span class="program-gemmer">Gemmer...</span>
							{:else if aktiv}
								<Icon name="check" size={18} color="var(--sage, #6f9e7e)" />
							{/if}
						</span>
					</button>
				{/each}
			</div>
		</section>
	{/if}

	<section class="sektion">
		<h2 class="sektion-titel">Tekststørrelse</h2>
		<p class="sektion-sub">Gør tekst i hele appen større hvis du har svært ved at læse.</p>
		<div class="scale-rad">
			<button
				type="button"
				class="scale-knap"
				class:aktiv={aktivScale === 'normal'}
				onclick={() => vaelgScale('normal')}
			>
				<span class="scale-prov scale-prov-1">Aa</span>
				<span class="scale-lbl">Normal</span>
			</button>
			<button
				type="button"
				class="scale-knap"
				class:aktiv={aktivScale === 'large'}
				onclick={() => vaelgScale('large')}
			>
				<span class="scale-prov scale-prov-2">Aa</span>
				<span class="scale-lbl">Stor</span>
			</button>
			<button
				type="button"
				class="scale-knap"
				class:aktiv={aktivScale === 'xlarge'}
				onclick={() => vaelgScale('xlarge')}
			>
				<span class="scale-prov scale-prov-3">Aa</span>
				<span class="scale-lbl">Ekstra stor</span>
			</button>
		</div>
	</section>

	{#if erPremium}
	<section class="sektion">
		<h2 class="sektion-titel">Næringsdata</h2>
		<p class="sektion-sub">
			Som standard ser du protein og fiber. Slå udvidet til hvis du også vil følge med i kulhydrater, fedt og kalorier.
		</p>
		<button
			type="button"
			class="naering-toggle"
			class:on={visUdvidet}
			onclick={toggleUdvidet}
			disabled={gemmerNaering}
		>
			<div class="naering-toggle-tekst">
				<div class="naering-toggle-titel">Vis udvidet næringsdata</div>
				<div class="naering-toggle-sub">
					{visUdvidet ? 'Slået til' : 'Slået fra'}
				</div>
			</div>
			<div class="naering-switch" class:on={visUdvidet}>
				<div class="naering-switch-knob"></div>
			</div>
		</button>

		{#if visUdvidet}
			<button
				type="button"
				class="beregn-knap"
				onclick={() => (viserWizard = true)}
			>
				<Icon name="sparkle" size={16} color="#fff" />
				<span class="beregn-knap-tekst">
					<span class="beregn-knap-titel">Beregn mine mål automatisk</span>
					<span class="beregn-knap-sub">Få et udgangspunkt baseret på din profil</span>
				</span>
				<Icon name="chevron-r" size={14} color="rgba(255,255,255,0.7)" />
			</button>

			<div class="naering-mal-card">
				<div class="naering-mal-titel">Daglige mål</div>
				<p class="naering-mal-sub">Bruges som reference på dagbogen og udviklings-siden.</p>
				<div class="naering-mal-grid">
					{#each NAERINGSFELTER as felt (felt)}
						<label class="naering-felt">
							<span class="naering-felt-lbl">{NAERING_LABELS[felt]}</span>
							<div class="naering-felt-rad">
								<input
									type="number"
									bind:value={dagligeMaal[felt]}
									onchange={maalAendret}
									min="0"
									step={felt === 'kcal' ? 50 : 5}
								/>
								<span class="naering-felt-enhed">{NAERING_ENHEDER[felt]}</span>
							</div>
						</label>
					{/each}
				</div>
			</div>
		{/if}
	</section>
	{/if}

	<section class="sektion">
		<h2 class="sektion-titel">Hjælp</h2>
		<div class="hjaelp">
			Skriv til <a href="mailto:kontakt@linnsacademy.dk">kontakt@linnsacademy.dk</a>
		</div>
	</section>

	<section class="sektion">
		<h2 class="sektion-titel">Adgangskode</h2>
		{#if !viserSkiftPassword}
			<button class="ghost-knap" type="button" onclick={() => (viserSkiftPassword = true)}>
				Skift adgangskode
			</button>
		{:else}
			<div class="password-form">
				<label class="field">
					<span class="label">Nuværende adgangskode</span>
					<input
						type="password"
						bind:value={nuPassword}
						autocomplete="current-password"
					/>
				</label>
				<label class="field">
					<span class="label">Ny adgangskode (mindst 6 tegn)</span>
					<input type="password" bind:value={nyPassword} autocomplete="new-password" />
				</label>
				<label class="field">
					<span class="label">Bekræft ny adgangskode</span>
					<input
						type="password"
						bind:value={bekraeftPassword}
						autocomplete="new-password"
					/>
				</label>
				{#if passwordBesked}
					<div class="password-besked {passwordBesked.type}">{passwordBesked.tekst}</div>
				{/if}
				<div class="password-knapper">
					<button
						class="primary-knap"
						type="button"
						onclick={skiftPassword}
						disabled={skifterPassword}
					>
						{skifterPassword ? 'Skifter…' : 'Skift adgangskode'}
					</button>
					<button
						class="ghost-knap"
						type="button"
						onclick={() => {
							viserSkiftPassword = false;
							nuPassword = '';
							nyPassword = '';
							bekraeftPassword = '';
							passwordBesked = null;
						}}
					>
						Annullér
					</button>
				</div>
			</div>
		{/if}
	</section>

	<section class="sektion">
		<h2 class="sektion-titel">Problemer med appen?</h2>
		<p class="sektion-sub">
			Hvis appen opfører sig mærkeligt — fx hvis dine data ser forkerte ud, hvis
			noget ikke vil indlæse, eller hvis appen viser den gamle version efter en
			opdatering — så prøv at nulstille den på din enhed. Det rydder gemte
			indstillinger og cache på telefonen. Dine data (måltider, vaner, træninger)
			er gemt i skyen og bliver IKKE rørt.
		</p>
		<button class="nulstil-app" type="button" onclick={aabnNulstilBekraeft} disabled={nulstillerApp}>
			{nulstillerApp ? 'Nulstiller…' : '🔄 Nulstil appen på denne enhed'}
		</button>
	</section>

	<button class="logout" onclick={handleLogout}>Log ud</button>
</div>

{#if viserWizard}
	<BeregnMaalWizard
		startProfil={userDoc?.brugerProfil}
		onBrugMaal={brugBeregnedeMaal}
		onClose={() => (viserWizard = false)}
	/>
{/if}

{#if viserNulstilBekraeft}
	<BekraeftModal
		titel="Nulstil app?"
		beskrivelse="Du bliver logget ud, og gemte indstillinger på denne enhed slettes (fx hvilken dato du sidst kiggede på). Dine data i appen rører vi ikke — du kan logge ind igen som normalt bagefter."
		bekraeftTekst="Nulstil og log ud"
		destruktiv
		arbejder={nulstillerApp}
		onBekraeft={() => void handleNulstilApp()}
		onAnnuller={() => (viserNulstilBekraeft = false)}
	/>
{/if}

<style>
	.profil {
		padding: 0 20px 32px;
		max-width: 480px;
		margin: 0 auto;
		width: 100%;
		box-sizing: border-box;
	}

	.header {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 32px 16px 24px;
	}

	.avatar {
		width: 80px;
		height: 80px;
		border-radius: 50%;
		background: var(--terra);
		color: var(--white);
		display: flex;
		align-items: center;
		justify-content: center;
		font-family: 'Playfair Display', Georgia, serif;
		font-size: calc(32px * var(--fs-scale, 1));
		font-weight: 500;
		margin-bottom: 14px;
	}

	.navn {
		font-size: calc(22px * var(--fs-scale, 1));
		font-weight: 500;
		color: var(--text);
		margin: 0;
	}

	.email {
		font-size: calc(13px * var(--fs-scale, 1));
		color: var(--text3);
		margin: 4px 0 0;
	}

	.status-card {
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 12px;
		padding: 16px 18px;
		margin-bottom: 12px;
	}

	.card-label {
		font-size: calc(11px * var(--fs-scale, 1));
		font-weight: 500;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--text3);
		margin: 0 0 4px;
	}

	.card-text {
		font-size: calc(15px * var(--fs-scale, 1));
		color: var(--text);
		margin: 0;
	}

	.sektion {
		margin-top: 20px;
	}

	.sektion-titel {
		font-size: calc(13px * var(--fs-scale, 1));
		font-weight: 500;
		color: var(--text);
		margin: 0 4px 8px;
		letter-spacing: 0.02em;
	}

	.koeb-liste {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.koeb {
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 10px;
		padding: 12px 14px;
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 12px;
	}

	.koeb-laeseadgang {
		opacity: 0.75;
	}

	.koeb-info {
		display: flex;
		flex-direction: column;
		min-width: 0;
		flex: 1;
	}

	.koeb-navn {
		font-size: calc(14px * var(--fs-scale, 1));
		font-weight: 500;
		color: var(--text);
	}

	.koeb-meta {
		font-size: calc(12px * var(--fs-scale, 1));
		color: var(--text3);
		margin-top: 2px;
	}

	.badge {
		font-size: calc(10px * var(--fs-scale, 1));
		font-weight: 500;
		padding: 4px 9px;
		border-radius: 10px;
		background: #e8f0e9;
		color: #4a7050;
		letter-spacing: 0.04em;
		flex-shrink: 0;
	}

	.badge-laeseadgang {
		background: #f1ede8;
		color: #8a7480;
	}

	.sektion-sub {
		font-size: calc(12px * var(--fs-scale, 1));
		color: var(--text3);
		margin: 0 4px 10px;
		line-height: 1.5;
	}

	.nul-tael {
		display: flex;
		align-items: baseline;
		gap: 10px;
		padding: 14px 16px;
		background: var(--bg2, #f5f1ec);
		border-radius: 12px;
		margin-bottom: 12px;
	}
	.nul-tael-tal {
		font-family: var(--ff-d);
		font-size: calc(22px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--text);
	}
	.nul-tael-tekst {
		font-size: calc(12px * var(--fs-scale, 1));
		color: var(--text2);
	}
	.nul-form {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 10px;
		margin-bottom: 14px;
	}
	.nul-felt {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.nul-label {
		font-size: calc(11px * var(--fs-scale, 1));
		font-weight: 600;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--text3);
	}
	.nul-felt input {
		padding: 10px 12px;
		font-size: calc(14px * var(--fs-scale, 1));
		border-radius: 10px;
		border: 1px solid var(--border);
		background: var(--white);
		color: var(--text);
		font-family: var(--ff-b);
	}
	.nul-knap {
		grid-column: 1 / -1;
		padding: 12px;
		font-size: calc(14px * var(--fs-scale, 1));
		font-weight: 600;
		border-radius: 10px;
		border: none;
		background: var(--terra);
		color: #fff;
		cursor: pointer;
		font-family: var(--ff-b);
	}
	.nul-knap:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}
	.nul-liste-titel {
		font-size: calc(11px * var(--fs-scale, 1));
		font-weight: 600;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--text3);
		margin: 6px 4px 8px;
	}
	.nul-liste {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.nul-rad {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
		padding: 10px 14px;
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 10px;
	}
	.nul-rad-datoer {
		font-size: calc(14px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--text);
	}
	.nul-rad-meta {
		font-size: calc(11px * var(--fs-scale, 1));
		color: var(--text3);
	}
	.nul-fortryd {
		background: none;
		border: 1px solid var(--border);
		color: var(--text2);
		font-size: calc(12px * var(--fs-scale, 1));
		font-weight: 500;
		padding: 6px 12px;
		border-radius: 8px;
		cursor: pointer;
		font-family: var(--ff-b);
	}
	.nul-fortryd:hover {
		border-color: #b8503f;
		color: #b8503f;
	}

	.status-besked {
		padding: 12px 14px;
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 10px;
		font-size: calc(13px * var(--fs-scale, 1));
		color: var(--text2);
		text-align: center;
	}

	.status-besked.fejl {
		color: #8a4a3e;
		background: #fbeeea;
		border-color: #f0d6cf;
		margin-bottom: 8px;
	}

	.program-liste {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.program-knap {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 14px;
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 12px;
		cursor: pointer;
		font-family: var(--ff-b);
		text-align: left;
		transition:
			border-color 0.15s ease,
			background 0.15s ease;
	}

	.program-knap:hover:not(:disabled) {
		border-color: var(--terra);
	}

	.program-knap.aktiv {
		border-color: var(--sage, #6f9e7e);
		background: var(--sdim, #f0f5f1);
	}

	.program-knap:disabled {
		cursor: not-allowed;
		opacity: 0.7;
	}

	.program-ikon {
		width: 36px;
		height: 36px;
		border-radius: 50%;
		background: var(--bg2);
		color: var(--terra);
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.program-ikon.aktiv {
		background: var(--white);
		color: var(--sage, #6f9e7e);
	}

	.program-tekst {
		flex: 1;
		display: flex;
		flex-direction: column;
		min-width: 0;
	}

	.program-navn {
		font-size: calc(14px * var(--fs-scale, 1));
		font-weight: 500;
		color: var(--text);
	}

	.program-sub {
		font-size: calc(12px * var(--fs-scale, 1));
		color: var(--text3);
		margin-top: 2px;
	}

	.program-status {
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		min-width: 24px;
	}

	.program-gemmer {
		font-size: calc(11px * var(--fs-scale, 1));
		color: var(--terra);
		font-weight: 500;
	}

	.scale-rad {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 8px;
	}

	.scale-knap {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6px;
		padding: 14px 8px;
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 12px;
		cursor: pointer;
		font-family: var(--ff-b);
		transition:
			border-color 0.15s ease,
			background 0.15s ease;
	}

	.scale-knap.aktiv {
		border-color: var(--sage, #6f9e7e);
		background: var(--sdim, #f0f5f1);
	}

	.scale-prov {
		font-family: var(--ff-d);
		color: var(--text);
		line-height: 1;
		font-weight: 500;
	}

	.scale-prov-1 {
		font-size: 18px;
	}

	.scale-prov-2 {
		font-size: 22px;
	}

	.scale-prov-3 {
		font-size: 27px;
	}

	.scale-lbl {
		font-size: calc(11px * var(--fs-scale, 1));
		color: var(--text2);
		font-weight: 500;
	}

	.naering-toggle {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 14px;
		width: 100%;
		padding: 14px;
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 12px;
		cursor: pointer;
		text-align: left;
		font-family: var(--ff-b);
	}

	.naering-toggle.on {
		border-color: var(--sage, #6f9e7e);
		background: var(--sdim, #f0f5f1);
	}

	.naering-toggle:disabled {
		opacity: 0.7;
		cursor: wait;
	}

	.naering-toggle-tekst {
		flex: 1;
		min-width: 0;
	}

	.naering-toggle-titel {
		font-size: calc(14px * var(--fs-scale, 1));
		font-weight: 500;
		color: var(--text);
	}

	.naering-toggle-sub {
		font-size: calc(11.5px * var(--fs-scale, 1));
		color: var(--text3);
		margin-top: 2px;
	}

	.naering-switch {
		width: 42px;
		height: 24px;
		background: var(--bg2);
		border: 1px solid var(--border);
		border-radius: 99px;
		position: relative;
		flex-shrink: 0;
		transition: background 0.18s ease;
	}

	.naering-switch.on {
		background: var(--sage, #6f9e7e);
		border-color: var(--sage, #6f9e7e);
	}

	.naering-switch-knob {
		position: absolute;
		top: 2px;
		left: 2px;
		width: 18px;
		height: 18px;
		background: #fff;
		border-radius: 50%;
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.15);
		transition: transform 0.18s ease;
	}

	.naering-switch.on .naering-switch-knob {
		transform: translateX(18px);
	}

	.beregn-knap {
		display: flex;
		align-items: center;
		gap: 12px;
		width: 100%;
		padding: 14px 16px;
		margin-top: 10px;
		background: linear-gradient(135deg, var(--terra) 0%, #a06b60 100%);
		border: none;
		border-radius: 12px;
		color: #fff;
		text-align: left;
		cursor: pointer;
		font-family: var(--ff-b);
		box-shadow: 0 4px 12px rgba(184, 123, 110, 0.25);
	}

	.beregn-knap:active {
		transform: scale(0.99);
	}

	.beregn-knap-tekst {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
	}

	.beregn-knap-titel {
		font-size: calc(14px * var(--fs-scale, 1));
		font-weight: 600;
	}

	.beregn-knap-sub {
		font-size: calc(11.5px * var(--fs-scale, 1));
		color: rgba(255, 255, 255, 0.82);
	}

	.naering-mal-card {
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 12px;
		padding: 14px;
		margin-top: 10px;
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.naering-mal-titel {
		font-size: calc(13px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--text);
	}

	.naering-mal-sub {
		font-size: calc(11.5px * var(--fs-scale, 1));
		color: var(--text3);
		margin: 0;
		line-height: 1.45;
	}

	.naering-mal-grid {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.naering-felt {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		padding: 4px 0;
	}

	.naering-felt-lbl {
		font-size: calc(13px * var(--fs-scale, 1));
		color: var(--text);
		font-weight: 500;
	}

	.naering-felt-rad {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 7px 10px;
		background: var(--bg2);
		border: 1px solid var(--border);
		border-radius: 9px;
		min-width: 110px;
	}

	.naering-felt-rad:focus-within {
		border-color: var(--terra);
	}

	.naering-felt input {
		width: 60px;
		font-family: var(--ff-b);
		font-size: calc(16px * var(--fs-scale, 1));
		font-weight: 500;
		color: var(--text);
		background: transparent;
		border: none;
		outline: none;
		text-align: right;
	}

	.naering-felt-enhed {
		font-size: calc(11px * var(--fs-scale, 1));
		color: var(--text3);
		font-weight: 500;
	}

	.hjaelp {
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 10px;
		padding: 12px 14px;
		font-size: calc(13px * var(--fs-scale, 1));
		color: var(--text);
	}

	.hjaelp a {
		color: var(--terra);
		text-decoration: none;
	}

	.hjaelp a:hover {
		text-decoration: underline;
	}

	.nulstil-app {
		display: block;
		width: 100%;
		padding: 12px 14px;
		margin-top: 6px;
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 10px;
		color: var(--text2);
		font-size: calc(13px * var(--fs-scale, 1));
		font-weight: 600;
		font-family: inherit;
		text-align: center;
		cursor: pointer;
	}

	.nulstil-app:hover:not(:disabled) {
		background: var(--bg2);
		color: var(--text);
	}

	.nulstil-app:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.logout {
		display: block;
		width: 100%;
		padding: 13px;
		margin-top: 24px;
		background: transparent;
		border: 1px solid var(--border2, var(--border));
		border-radius: 10px;
		color: var(--text3);
		font-size: calc(13px * var(--fs-scale, 1));
		font-family: inherit;
		text-align: center;
		cursor: pointer;
	}

	.logout:hover {
		color: var(--text);
		border-color: var(--text4, var(--text3));
	}

	.password-form {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.password-form .field {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.password-form .label {
		font-size: calc(11px * var(--fs-scale, 1));
		font-weight: 600;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--text3);
	}
	.password-form input {
		padding: 10px 12px;
		font-size: calc(16px * var(--fs-scale, 1));
		border-radius: 10px;
		border: 1px solid var(--border);
		background: var(--bg2);
		color: var(--text);
		font-family: var(--ff-b);
		outline: none;
	}
	.password-form input:focus {
		border-color: var(--terra);
	}
	.password-besked {
		padding: 10px 12px;
		border-radius: 10px;
		font-size: calc(13px * var(--fs-scale, 1));
	}
	.password-besked.ok {
		background: #eef5ef;
		color: #406a4e;
	}
	.password-besked.fejl {
		background: #fbeeea;
		color: #8a4a3e;
	}
	.password-knapper {
		display: flex;
		gap: 8px;
	}
	.password-knapper .primary-knap {
		flex: 1;
		padding: 12px;
		background: var(--terra);
		color: #fff;
		font-size: calc(14px * var(--fs-scale, 1));
		font-weight: 600;
		border-radius: 10px;
		border: none;
		cursor: pointer;
		font-family: var(--ff-b);
	}
	.password-knapper .primary-knap:disabled {
		opacity: 0.6;
		cursor: wait;
	}
	.password-knapper .ghost-knap {
		flex: 1;
		padding: 12px;
		background: transparent;
		border: 1px solid var(--border);
		border-radius: 10px;
		color: var(--text2);
		font-size: calc(14px * var(--fs-scale, 1));
		font-family: var(--ff-b);
		cursor: pointer;
	}
	.ghost-knap {
		display: block;
		width: 100%;
		padding: 12px;
		background: transparent;
		border: 1px solid var(--border);
		border-radius: 10px;
		color: var(--text2);
		font-size: calc(14px * var(--fs-scale, 1));
		font-family: var(--ff-b);
		cursor: pointer;
	}
</style>
