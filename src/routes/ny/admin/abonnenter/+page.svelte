<script lang="ts">
	// ============================================================
	// Abonnenter, i det nye design.
	//
	// Femtende af de 19 gamle admin-sider, 1. september 2026, og den SIDSTE
	// af de fem der roerer adgang.
	//
	// DEN HER SIDE KAN TRE TING DER RAMMER EN RIGTIG KUNDE:
	//  - saette en ny adgangskode
	//  - oprette en gratis kunde der kan logge ind
	//  - aendre hvornaar en kundes adgang udloeber
	// Alle tre bekraeftes, og der staar hvad der sker foer der trykkes.
	//
	// LOGIKKEN ER FLYTTET, IKKE SKREVET OM. Samme tre endepunkter:
	// set-temp-password, opret-app-kunde og ret-abo-udloeb, og stadig et
	// frisk id-token hver gang.
	//
	// ORDENE BASIS OG PREMIUM STAAR STADIG. De kommer fra Simplero og er
	// navnene paa produkterne, ikke et skel vi selv har fundet paa.
	//
	// Den gamle side paa /app/admin/abonnenter er uroert.
	// ============================================================

	import { getContext, onMount } from 'svelte';
	import type { User } from 'firebase/auth';
	import { isAdmin } from '$lib/admin';
	import { collection, getDocs } from 'firebase/firestore';
	import { db } from '$lib/firebase';
	import { hentAbonnentAllowedEmails } from '$lib/firestore/forlob';
	import type { AllowedEmail } from '$lib/content/forlobAdgang';
	import type { UserDoc } from '$lib/types';
	import { klientSoegeMatch } from '$lib/utils/klientSoegning';
	import AdmSide from '$lib/components/admin/AdmSide.svelte';
	import AdmKort from '$lib/components/admin/AdmKort.svelte';
	import AdmKnap from '$lib/components/admin/AdmKnap.svelte';
	import AdmMaerkat from '$lib/components/admin/AdmMaerkat.svelte';
	import AdmSoeg from '$lib/components/admin/AdmSoeg.svelte';
	import AdmTom from '$lib/components/admin/AdmTom.svelte';

	const hentUser = getContext<() => User | null>('user');
	const maaVaereHer = $derived(isAdmin(hentUser()));
	const user = $derived(hentUser());

	type Raekke = { allowed: AllowedEmail; userDoc: UserDoc | null; uid: string | null };

	let raekker = $state<Raekke[]>([]);
	let henter = $state(true);
	let fejl = $state('');
	let besked = $state('');

	let filter = $state<'alle' | 'basis' | 'premium' | 'aktive'>('alle');
	let soeg = $state('');
	let aaben = $state('');

	// Ny kode
	let kodeBekraeft = $state('');
	let kodeArbejder = $state(false);
	let kode = $state('');
	let kodeTil = $state('');
	let kopieret = $state(false);

	// Opret kunde
	let opretAaben = $state(false);
	let nyMail = $state('');
	let nyFornavn = $state('');
	let nyEfternavn = $state('');
	let nyUdloeb = $state('');
	let opretArbejder = $state(false);
	let opretFejl = $state('');

	// Ret udloeb
	let udloebMail = $state('');
	let udloebDato = $state('');
	let udloebArbejder = $state(false);
	let udloebFejl = $state('');

	onMount(() => void indlaes());

	async function indlaes() {
		henter = true;
		fejl = '';
		try {
			const tilladte = await hentAbonnentAllowedEmails();
			// users hentes for at kunne vise uid og navn. Kan reglerne ikke
			// laese dem, fortsaetter vi med det vi har fra Simplero.
			const perMail = new Map<string, { uid: string; data: UserDoc }>();
			try {
				const snap = await getDocs(collection(db, 'users'));
				for (const d of snap.docs) {
					const x = d.data() as UserDoc;
					if (x.email) perMail.set(x.email.toLowerCase(), { uid: d.id, data: x });
				}
			} catch (e) {
				console.warn('[admin] kunne ikke hente users', e);
			}
			raekker = tilladte.map((a) => {
				const m = perMail.get(a.email.toLowerCase());
				return { allowed: a, userDoc: m?.data ?? null, uid: m?.uid ?? null };
			});
		} catch (e) {
			console.error('[admin] abonnenter', e);
			fejl = 'Kunne ikke hente abonnenterne.';
		} finally {
			henter = false;
		}
	}

	function sigTil(t: string) {
		besked = t;
		setTimeout(() => {
			if (besked === t) besked = '';
		}, 3000);
	}

	function navnFor(r: Raekke): string {
		const f = r.userDoc?.firstName ?? r.allowed.firstName ?? '';
		const l = r.allowed.lastName ?? '';
		return [f, l].filter(Boolean).join(' ') || '(uden navn)';
	}

	function produkt(a: AllowedEmail): string {
		const kort: Record<string, string> = {
			basisabo: 'Basis',
			premiumabo: 'Premium',
			kickstart: 'Kickstart',
			premiumforløb: 'Kropsro'
		};
		return a.activeProduct ? (kort[a.activeProduct] ?? a.activeProduct) : '—';
	}

	/** Den dato der faktisk haandhaeves. Null betyder loebende adgang. */
	function udloeb(r: Raekke): number | null {
		return r.allowed.aboSlutterAt ?? r.userDoc?.aboSlutterAt ?? null;
	}

	function visDato(ms?: number | null): string {
		if (!ms) return 'Løbende, udløber ikke';
		return new Date(ms).toLocaleDateString('da-DK', {
			day: '2-digit',
			month: 'short',
			year: 'numeric'
		});
	}

	function tilInput(ms?: number | null): string {
		if (!ms) return '';
		const d = new Date(ms);
		const p = (n: number) => String(n).padStart(2, '0');
		return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
	}

	const listen = $derived(
		raekker.filter((r) => {
			const a = r.allowed;
			if (filter === 'basis' && a.accessLevel !== 'basis') return false;
			if (filter === 'premium' && a.accessLevel !== 'premium') return false;
			if (filter === 'aktive' && !a.activeSubscription) return false;
			if (!soeg.trim()) return true;
			return klientSoegeMatch(`${navnFor(r)} ${a.email}`, soeg);
		})
	);

	const aktiveBasis = $derived(
		raekker.filter((r) => r.allowed.accessLevel === 'basis' && r.allowed.activeSubscription).length
	);
	const aktivePremium = $derived(
		raekker.filter((r) => r.allowed.accessLevel === 'premium' && r.allowed.activeSubscription)
			.length
	);

	async function nyKode(r: Raekke) {
		const u = user;
		if (!u || kodeArbejder) return;
		kodeArbejder = true;
		fejl = '';
		try {
			const token = await u.getIdToken(true);
			const res = await fetch('/api/admin/set-temp-password', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
				body: JSON.stringify({ email: r.allowed.email })
			});
			if (!res.ok) {
				const t = await res.text();
				let m = 'Kunne ikke sætte en ny kode.';
				try {
					const p = JSON.parse(t);
					if (p.message) m = p.message;
				} catch {
					if (t) m = t;
				}
				fejl = m;
				return;
			}
			const data = (await res.json()) as { tempPassword: string };
			kode = data.tempPassword;
			kodeTil = navnFor(r);
			kodeBekraeft = '';
		} catch (e) {
			console.error('[admin] ny kode', e);
			fejl = 'Kunne ikke få fat i serveren.';
		} finally {
			kodeArbejder = false;
		}
	}

	const kodeBesked = $derived(
		kode
			? `Jeg har nulstillet din adgangskode, som er ${kode}. Du skal logge ind med den og kan bagefter ændre den under Din side.`
			: ''
	);

	async function kopier() {
		if (!kodeBesked) return;
		try {
			await navigator.clipboard.writeText(kodeBesked);
			kopieret = true;
			setTimeout(() => (kopieret = false), 2000);
		} catch (e) {
			console.warn('[admin] kopier', e);
			fejl = 'Kunne ikke kopiere. Marker teksten og kopier i hånden.';
		}
	}

	async function opret() {
		const u = user;
		const mail = nyMail.trim().toLowerCase();
		if (!u || opretArbejder) return;
		if (!mail || !mail.includes('@')) {
			opretFejl = 'Skriv en gyldig mail.';
			return;
		}
		let slutter: number | undefined;
		if (nyUdloeb) {
			// Sidst paa den valgte dag, saa hun har HELE dagen.
			const ms = new Date(`${nyUdloeb}T23:59:59`).getTime();
			if (!Number.isFinite(ms) || ms <= Date.now()) {
				opretFejl = 'Datoen skal være i fremtiden.';
				return;
			}
			slutter = ms;
		}
		opretArbejder = true;
		opretFejl = '';
		try {
			const token = await u.getIdToken(true);
			const res = await fetch('/api/admin/opret-app-kunde', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
				body: JSON.stringify({
					email: mail,
					firstName: nyFornavn.trim(),
					lastName: nyEfternavn.trim(),
					...(slutter !== undefined ? { aboSlutterAt: slutter } : {})
				})
			});
			const data = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string };
			if (!res.ok || data.ok === false) {
				opretFejl = data.message ?? 'Kunne ikke oprette kunden.';
				return;
			}
			sigTil(
				`${mail} er oprettet. ${slutter ? `Adgangen udløber ${visDato(slutter)}.` : 'Adgangen er løbende.'} Hun kan nu oprette sig på login-siden med den mail.`
			);
			nyMail = '';
			nyFornavn = '';
			nyEfternavn = '';
			nyUdloeb = '';
			opretAaben = false;
			await indlaes().catch(() => {});
		} catch (e) {
			console.error('[admin] opret kunde', e);
			opretFejl = 'Kunne ikke få fat i serveren.';
		} finally {
			opretArbejder = false;
		}
	}

	async function gemUdloeb(mail: string, fjern: boolean) {
		const u = user;
		if (!u || udloebArbejder) return;
		let slutter: number | null;
		if (fjern) {
			slutter = null;
		} else {
			if (!udloebDato) {
				udloebFejl = 'Vælg en dato, eller tryk Fjern udløb.';
				return;
			}
			const ms = new Date(`${udloebDato}T23:59:59`).getTime();
			if (!Number.isFinite(ms) || ms <= Date.now()) {
				udloebFejl = 'Datoen skal være i fremtiden.';
				return;
			}
			slutter = ms;
		}
		udloebArbejder = true;
		udloebFejl = '';
		try {
			const token = await u.getIdToken(true);
			const res = await fetch('/api/admin/ret-abo-udloeb', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
				body: JSON.stringify({ email: mail, aboSlutterAt: slutter })
			});
			const data = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string };
			if (!res.ok || data.ok === false) {
				udloebFejl = data.message ?? 'Kunne ikke gemme.';
				return;
			}
			raekker = raekker.map((r) =>
				r.allowed.email === mail
					? {
							...r,
							allowed: { ...r.allowed, aboSlutterAt: slutter ?? undefined },
							userDoc: r.userDoc
								? ({ ...r.userDoc, aboSlutterAt: slutter ?? undefined } as UserDoc)
								: r.userDoc
						}
					: r
			);
			udloebMail = '';
			udloebDato = '';
			sigTil(fjern ? 'Udløbet er fjernet, adgangen er nu løbende' : 'Udløbsdatoen er gemt');
		} catch (e) {
			console.error('[admin] ret udløb', e);
			udloebFejl = 'Kunne ikke få fat i serveren.';
		} finally {
			udloebArbejder = false;
		}
	}
</script>

<svelte:head><title>Abonnenter · Admin</title></svelte:head>

{#if !maaVaereHer}
	<p class="ab-kun">Siden er kun for admin.</p>
{:else}
	<AdmSide
		titel="Abonnenter"
		under="Kunder med et abonnement fra Simplero. Her kan du også oprette en gratis kunde eller ændre hvornår en adgang udløber."
		bred
	>
		{#snippet handling()}
			<AdmKnap slags="primaer" onclick={() => (opretAaben = !opretAaben)}>
				{opretAaben ? 'Luk' : 'Opret en gratis kunde'}
			</AdmKnap>
		{/snippet}

		{#if besked}<div class="ab-besked">{besked}</div>{/if}
		{#if fejl}<div class="ab-fejl">{fejl}</div>{/if}

		{#if kode}
			<AdmKort ro>
				<div class="ab-kvit-h">Ny kode til {kodeTil}</div>
				<div class="ab-kode">{kode}</div>
				<p class="ab-advarsel">Skriv den ned eller kopier den nu. Den kan ikke hentes frem igen.</p>
				<div class="ab-besked-boks">{kodeBesked}</div>
				<div class="ab-knapper">
					<AdmKnap slags="primaer" onclick={kopier}>
						{kopieret ? 'Kopieret' : 'Kopier beskeden'}
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

		{#if opretAaben}
			<AdmKort>
				<h2 class="ab-h">Opret en gratis kunde</h2>
				<p class="ab-hint">
					Til dem der skal have appen uden at betale. Hun får premium-adgang og kan oprette sig på
					login-siden med den mail du skriver her.
				</p>
				<div class="ab-raek">
					<label class="ab-felt bred">
						<span>Mail</span>
						<input type="email" bind:value={nyMail} disabled={opretArbejder} />
					</label>
					<label class="ab-felt">
						<span>Fornavn</span>
						<input type="text" bind:value={nyFornavn} disabled={opretArbejder} />
					</label>
					<label class="ab-felt">
						<span>Efternavn</span>
						<input type="text" bind:value={nyEfternavn} disabled={opretArbejder} />
					</label>
					<label class="ab-felt">
						<span>Udløber, valgfrit</span>
						<input type="date" bind:value={nyUdloeb} disabled={opretArbejder} />
					</label>
				</div>
				<p class="ab-hint">
					Lader du datoen stå tom, er adgangen løbende og udløber aldrig. Sætter du en, gælder hele
					den dag.
				</p>
				{#if opretFejl}<div class="ab-fejl">{opretFejl}</div>{/if}
				<div class="ab-knapper">
					<AdmKnap slags="primaer" disabled={opretArbejder} onclick={opret}>
						{opretArbejder ? 'Opretter…' : 'Opret kunden'}
					</AdmKnap>
					<AdmKnap disabled={opretArbejder} onclick={() => (opretAaben = false)}>Annuller</AdmKnap>
				</div>
			</AdmKort>
		{/if}

		{#if henter}
			<AdmTom tekst="Henter abonnenterne…" />
		{:else if fejl && raekker.length === 0}
			<AdmTom tekst={fejl} fejl>
				{#snippet handling()}
					<AdmKnap onclick={indlaes}>Prøv igen</AdmKnap>
				{/snippet}
			</AdmTom>
		{:else}
			<div class="ab-tal">
				<div class="ab-t-kort">
					<span class="v">{aktiveBasis}</span><span class="m">aktive basis</span>
				</div>
				<div class="ab-t-kort">
					<span class="v">{aktivePremium}</span><span class="m">aktive premium</span>
				</div>
				<div class="ab-t-kort">
					<span class="v">{raekker.length}</span><span class="m">i alt</span>
				</div>
			</div>

			<div class="ab-filtre">
				{#each [['alle', 'Alle'], ['aktive', 'Kun aktive'], ['basis', 'Basis'], ['premium', 'Premium']] as [id, navn] (id)}
					<button
						type="button"
						class="ab-chip"
						class:paa={filter === id}
						onclick={() => (filter = id as typeof filter)}>{navn}</button
					>
				{/each}
			</div>

			<AdmSoeg bind:vaerdi={soeg} placeholder="Søg efter navn eller mail…" />
			<p class="ab-antal">{listen.length} af {raekker.length}</p>

			{#if listen.length === 0}
				<AdmTom tekst="Ingen abonnenter matcher." />
			{:else}
				{#each listen as r (r.allowed.email)}
					{@const slut = udloeb(r)}
					<AdmKort>
						<button
							type="button"
							class="ab-hoved"
							onclick={() => (aaben = aaben === r.allowed.email ? '' : r.allowed.email)}
						>
							<div>
								<span class="ab-navn">{navnFor(r)}</span>
								<div class="ab-meta">{r.allowed.email} · {produkt(r.allowed)}</div>
								<div class="ab-meta">Adgang: {visDato(slut)}</div>
							</div>
							<AdmMaerkat farve={r.allowed.activeSubscription ? 'klar' : 'stille'}>
								{r.allowed.activeSubscription ? 'Aktiv' : 'Ikke aktiv'}
							</AdmMaerkat>
						</button>

						{#if aaben === r.allowed.email}
							<div class="ab-detalje">
								{#if !r.uid}
									<p class="ab-hint">
										Hun har ikke oprettet sig i appen endnu. Der er købt adgang, men ingen konto.
									</p>
								{/if}

								{#if udloebMail === r.allowed.email}
									<div class="ab-advarsel-boks">
										Du ændrer hvornår <b>{navnFor(r)}</b> mister adgangen. Sætter du en dato der er gået,
										kan hun ikke komme ind.
									</div>
									<div class="ab-raek">
										<label class="ab-felt">
											<span>Udløber</span>
											<input type="date" bind:value={udloebDato} disabled={udloebArbejder} />
										</label>
									</div>
									{#if udloebFejl}<div class="ab-fejl">{udloebFejl}</div>{/if}
									<div class="ab-knapper">
										<AdmKnap
											slags="primaer"
											disabled={udloebArbejder}
											onclick={() => gemUdloeb(r.allowed.email, false)}
										>
											{udloebArbejder ? 'Gemmer…' : 'Gem datoen'}
										</AdmKnap>
										<AdmKnap
											disabled={udloebArbejder}
											onclick={() => gemUdloeb(r.allowed.email, true)}
										>
											Fjern udløb, giv løbende adgang
										</AdmKnap>
										<AdmKnap disabled={udloebArbejder} onclick={() => (udloebMail = '')}>
											Fortryd
										</AdmKnap>
									</div>
								{:else if kodeBekraeft === r.allowed.email}
									<div class="ab-advarsel-boks">
										Du sætter en ny kode for <b>{navnFor(r)}</b>. Hendes nuværende kode holder op
										med at virke med det samme.
									</div>
									<div class="ab-knapper">
										<AdmKnap slags="fare" disabled={kodeArbejder} onclick={() => nyKode(r)}>
											{kodeArbejder ? 'Sætter…' : 'Ja, sæt en ny kode'}
										</AdmKnap>
										<AdmKnap disabled={kodeArbejder} onclick={() => (kodeBekraeft = '')}>
											Fortryd
										</AdmKnap>
									</div>
								{:else}
									<div class="ab-knapper">
										<AdmKnap
											onclick={() => {
												udloebMail = r.allowed.email;
												udloebDato = tilInput(slut);
												udloebFejl = '';
											}}>Ret hvornår adgangen udløber</AdmKnap
										>
										<AdmKnap onclick={() => (kodeBekraeft = r.allowed.email)}>
											Sæt en ny adgangskode
										</AdmKnap>
									</div>
								{/if}
							</div>
						{/if}
					</AdmKort>
				{/each}
			{/if}
		{/if}
	</AdmSide>
{/if}

<style>
	.ab-kun {
		padding: 24px 18px;
		color: var(--ink-2);
		font-size: calc(14px * var(--fs-scale, 1) * var(--adm-skala, 1));
	}

	.ab-besked,
	.ab-fejl {
		margin-bottom: 12px;
		padding: 11px 15px;
		border-radius: 12px;
		font-size: calc(13.5px * var(--fs-scale, 1) * var(--adm-skala, 1));
		font-weight: 600;
		line-height: 1.45;
	}

	.ab-besked {
		background: var(--sage-tint, #e7efe5);
		color: var(--sage-tekst, #46603f);
	}

	.ab-fejl {
		background: var(--ler-tint, #f4e6de);
		color: var(--ler-tekst, #8a5439);
	}

	.ab-kvit-h {
		font-size: calc(11px * var(--fs-scale, 1) * var(--adm-skala, 1));
		font-weight: 700;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--honey-deep, #b47f3e);
		margin-bottom: 8px;
	}

	.ab-kode {
		font-size: calc(26px * var(--fs-scale, 1) * var(--adm-skala, 1));
		font-weight: 600;
		letter-spacing: 0.04em;
		word-break: break-all;
	}

	.ab-advarsel {
		margin: 8px 0 12px;
		font-size: calc(12.5px * var(--fs-scale, 1) * var(--adm-skala, 1));
		color: var(--honey-deep, #b47f3e);
		font-weight: 600;
	}

	.ab-besked-boks {
		padding: 12px 14px;
		background: var(--paper, #fbf8f2);
		border-radius: 11px;
		font-size: calc(13px * var(--fs-scale, 1) * var(--adm-skala, 1));
		line-height: 1.5;
		margin-bottom: 12px;
	}

	.ab-advarsel-boks {
		margin-bottom: 11px;
		padding: 12px 14px;
		background: var(--ler-tint, #f4e6de);
		border-radius: 11px;
		color: var(--ler-tekst, #8a5439);
		font-size: calc(12.5px * var(--fs-scale, 1) * var(--adm-skala, 1));
		line-height: 1.5;
	}

	.ab-h {
		margin: 0 0 6px;
		font-size: calc(16px * var(--fs-scale, 1) * var(--adm-skala, 1));
		font-weight: 600;
	}

	.ab-hint {
		margin: 0 0 11px;
		font-size: calc(12px * var(--fs-scale, 1) * var(--adm-skala, 1));
		color: var(--ink-3, #a3948a);
		line-height: 1.5;
	}

	.ab-raek {
		display: flex;
		gap: 10px;
		flex-wrap: wrap;
	}

	.ab-felt {
		display: flex;
		flex-direction: column;
		gap: 4px;
		flex: 1 1 140px;
		margin-bottom: 10px;
	}

	.ab-felt.bred {
		flex-basis: 100%;
	}

	.ab-felt span {
		font-size: calc(10.5px * var(--fs-scale, 1) * var(--adm-skala, 1));
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--ink-3, #a3948a);
	}

	.ab-felt input {
		padding: 11px 13px;
		background: var(--paper, #fbf8f2);
		border: 1px solid var(--line, #e8dfd1);
		border-radius: 11px;
		color: var(--espresso, #382c2a);
		font-size: calc(14px * var(--fs-scale, 1) * var(--adm-skala, 1));
		font-family: inherit;
		box-sizing: border-box;
	}

	.ab-knapper {
		display: flex;
		gap: 8px;
		flex-wrap: wrap;
	}

	.ab-tal {
		display: flex;
		gap: 10px;
		flex-wrap: wrap;
		margin-bottom: 12px;
	}

	.ab-t-kort {
		flex: 1 1 120px;
		padding: 14px 16px;
		background: var(--paper-2, #f6f0e7);
		border-radius: 14px;
	}

	.ab-t-kort .v {
		display: block;
		font-size: calc(26px * var(--fs-scale, 1) * var(--adm-skala, 1));
		line-height: 1.05;
	}

	.ab-t-kort .m {
		display: block;
		margin-top: 4px;
		font-size: calc(11.5px * var(--fs-scale, 1) * var(--adm-skala, 1));
		color: var(--ink-3, #a3948a);
	}

	.ab-filtre {
		display: flex;
		gap: 6px;
		flex-wrap: wrap;
		margin-bottom: 10px;
	}

	/* Baggrunden staar eksplicit, se noten i AdmKnap. */
	.ab-chip {
		padding: 8px 14px;
		background: var(--paper-2, #f6f0e7);
		border: 1px solid var(--line, #e8dfd1);
		border-radius: 99px;
		color: var(--ink-2, #6f5f57);
		font-size: calc(12.5px * var(--fs-scale, 1) * var(--adm-skala, 1));
		font-family: inherit;
		font-weight: 600;
		cursor: pointer;
	}

	.ab-chip.paa {
		background: var(--plum, #7c4f63);
		border-color: var(--plum, #7c4f63);
		color: #fff;
	}

	.ab-antal {
		margin: 10px 0;
		font-size: calc(12px * var(--fs-scale, 1) * var(--adm-skala, 1));
		color: var(--ink-3, #a3948a);
	}

	.ab-hoved {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 10px;
		width: 100%;
		padding: 0;
		background: none;
		border: none;
		font-family: inherit;
		text-align: left;
		cursor: pointer;
	}

	.ab-navn {
		font-size: calc(14.5px * var(--fs-scale, 1) * var(--adm-skala, 1));
		font-weight: 600;
		color: var(--espresso, #382c2a);
	}

	.ab-meta {
		margin-top: 2px;
		font-size: calc(11.5px * var(--fs-scale, 1) * var(--adm-skala, 1));
		color: var(--ink-3, #a3948a);
	}

	.ab-detalje {
		margin-top: 12px;
		padding-top: 12px;
		border-top: 1px solid var(--line, #e8dfd1);
	}
</style>
