<script lang="ts">
	// ============================================================
	// Forloebets forside, i det nye design.
	//
	// En af de otte undersider under ét forloeb, 1. september 2026.
	//
	// HELE SIDEN ER KOPIERET ORDRET, baade script, markup og stil, saa
	// intet indhold kunne gaa tabt. Udseendet skifter via farvebroen
	// nederst i stilen. Samme greb som paa Dashboard.
	//
	// Alle interne veje peger nu paa den nye admin, saa man ikke falder
	// tilbage i det gamle udseende midt i et forloeb.
	//
	// Den gamle side er uroert.
	// ============================================================

	import { getContext, onMount } from 'svelte';
	import type { User } from 'firebase/auth';
	import { isAdmin } from '$lib/admin';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { Timestamp } from 'firebase/firestore';
	import type { AllowedEmail, CsvParseResult, Forlob, ForlobType } from '$lib/content/forlobAdgang';
	import { parseSimpleroCsv } from '$lib/content/forlobAdgang';
	import { TRAENING_START_DAG_DEFAULT, traeningStartDag } from '$lib/content/traeningStart';
	import {
		gemAllowedEmailsBatch,
		gemForlob,
		hentAllowedEmailsForForlob,
		hentAppVersionerForForlob,
		hentAlleForlob,
		hentForlob,
		sletForlob,
		tilfoejEnKunde,
		type ImportResultat
	} from '$lib/firestore/forlob';
	import { FEATURES } from '$lib/content/features';
	import { forlobSlutMs, toIsoLokal } from '$lib/content/forlob';
	import { klientSoegeMatch } from '$lib/utils/klientSoegning';
	import Icon from '$lib/components/Icon.svelte';

	const hentAdminUser = getContext<() => User | null>('user');
	const maaVaereHer = $derived(isAdmin(hentAdminUser()));

	const forlobId = $derived(page.params.id ?? '');

	// Adgangs-vindue beregnet ud fra form-værdierne — samme start-konvention
	// (kl. 00:01) som gem bruger, og samme forlobSlutMs som appen gater på.
	// Vises under Startdato/Antal dage så det altid er tydeligt hvornår
	// kunderne får materialet og hvornår de mister det igen.
	const datoTidFmt = new Intl.DateTimeFormat('da-DK', {
		weekday: 'long',
		day: 'numeric',
		month: 'long',
		year: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
		timeZone: 'Europe/Copenhagen'
	});
	const adgangsVindue = $derived.by(() => {
		if (!formStartDato || !formAntalDage) return null;
		const start = new Date(formStartDato + 'T00:01:00');
		if (isNaN(start.getTime())) return null;
		// Sidste tilgængelige øjeblik = ét minut før lukke-grænsen (midnat).
		const sidste = new Date(forlobSlutMs(start.getTime(), formAntalDage, 0) - 60_000);
		return { aabner: datoTidFmt.format(start), mister: datoTidFmt.format(sidste) };
	});

	let forlob = $state<Forlob | null>(null);
	let emails = $state<AllowedEmail[]>([]);
	// email (lowercased) → hvilken app-build kunden sidst bootede med.
	let appVersioner = $state<Map<string, { appVersion?: string; appVersionSetAt?: number }>>(
		new Map()
	);
	let loading = $state(true);
	let fejl = $state<string | null>(null);

	let formNavn = $state('');
	let formStartDato = $state('');
	let formAntalDage = $state(21);
	let formAktiv = $state(true);
	let formType = $state<ForlobType>('kickstart');
	// Byggede (fleksible) forløb har ingen Kickstart/Kropsro-type — vis dem som
	// "Fleksibelt" og rør ikke type-feltet ved gem.
	const erBygget = $derived(forlob?.byggetForlob === true);
	// Fleksible tilvalg — redigerbare på detalje-siden for byggede forløb.
	let formFeatures = $state<Record<string, boolean>>({});
	let formBuddy = $state(false);
	let formFacebook = $state(false);
	let formTraening = $state(false);
	// Hvilken forloebsdag den foerste mikrotraening ligger paa. Kickstart
	// bruger 3, alle andre 1. Gaelder ogsaa Kickstart/Kropsro, saa feltet
	// staar uden for bygget-forloebs-blokken. Se traeningStart.ts.
	let formTraeningStart = $state(TRAENING_START_DAG_DEFAULT);
	// Hvert hold har sin egen Facebook-gruppe. Er feltet tomt, spoerger appen
	// slet ikke om gruppen, saa et hold kan aldrig sende kunderne det forkerte
	// sted hen. Se forlobAdgang.ts.
	let formFacebookUrl = $state('');
	// Simplero-produktets nummer. Staar det her, og er holdet sat som
	// aktivt, lander nye koeb paa holdet af sig selv. Se content/forlobKoeb.ts.
	let formSimpleroId = $state('');
	// Andre hold der staar med SAMME nummer. Bruges til advarslen nedenfor,
	// saa to hold ikke slaas om de samme koebere.
	let andreMedSammeNummer = $state<{ id: string; navn: string; aktiv: boolean }[]>([]);
	// Alle hold, hentet én gang. Bruges kun til at finde dem der staar med
	// samme Simplero-nummer som det her.
	let alleHold = $state<{ id: string; navn: string; aktiv: boolean; nummer: string }[]>([]);

	$effect(() => {
		const nummer = formSimpleroId.trim();
		andreMedSammeNummer = nummer
			? alleHold.filter((h) => h.id !== forlobId && h.nummer === nummer)
			: [];
	});
	let formNulPulje = $state(14);
	let gemmer = $state(false);
	let gemFejl = $state<string | null>(null);
	let gemKvit = $state(false);

	let sletter = $state(false);
	let bekraefter = $state(false);

	let csvIndhold = $state('');
	let parsResultat = $state<CsvParseResult | null>(null);
	let importerer = $state(false);
	let importResultat = $state<ImportResultat | null>(null);
	let importFejl = $state<string | null>(null);

	// Manuel tilfoej-én-kunde-form
	let nyEmail = $state('');
	let nyFornavn = $state('');
	let nyEfternavn = $state('');
	let tilfoejer = $state(false);
	let tilfoejResultat = $state<string | null>(null);
	let tilfoejFejl = $state<string | null>(null);

	async function tilfoejManuel() {
		const email = nyEmail.trim();
		if (!email) {
			tilfoejFejl = 'Skriv en email.';
			return;
		}
		if (!email.includes('@')) {
			tilfoejFejl = 'Ugyldig email.';
			return;
		}
		if (!nyFornavn.trim()) {
			tilfoejFejl = 'Skriv et fornavn.';
			return;
		}
		tilfoejer = true;
		tilfoejFejl = null;
		tilfoejResultat = null;
		try {
			const r = await tilfoejEnKunde(forlobId, email, nyFornavn.trim(), nyEfternavn.trim());
			tilfoejResultat =
				r.status === 'tilfoejet'
					? `${r.email} tilføjet til forløbet.`
					: `${r.email} fandtes allerede — er nu opdateret til dette forløb.`;
			nyEmail = '';
			nyFornavn = '';
			nyEfternavn = '';
			// Best-effort: kan vi ikke hente de andre hold, undvaerer vi bare
			// advarslen om ens Simplero-numre.
			alleHold = await hentAlleForlob()
				.then((liste) =>
					liste.map((h) => ({
						id: h.id,
						navn: h.navn,
						aktiv: h.aktiv,
						nummer: (h.simpleroProduktId ?? '').trim()
					}))
				)
				.catch(() => []);

			emails = await hentAllowedEmailsForForlob(forlobId);
		} catch (e) {
			console.error(e);
			tilfoejFejl = e instanceof Error && e.message ? e.message : 'Kunne ikke tilføje kunden.';
		} finally {
			tilfoejer = false;
		}
	}

	let soegning = $state('');

	const filtreredeEmails = $derived.by<AllowedEmail[]>(() => {
		if (!soegning.trim()) return emails;
		return emails.filter((e) =>
			klientSoegeMatch(`${e.firstName ?? ''} ${e.lastName ?? ''} ${e.email}`, soegning)
		);
	});

	function laesCsvFil(e: Event) {
		const input = e.target as HTMLInputElement;
		const fil = input.files?.[0];
		if (!fil) return;
		const reader = new FileReader();
		reader.onload = () => {
			csvIndhold = String(reader.result ?? '');
			previewCsv();
		};
		reader.onerror = () => {
			importFejl = 'Kunne ikke læse filen.';
		};
		reader.readAsText(fil, 'utf-8');
		input.value = '';
	}

	onMount(async () => {
		await indlaes();
	});

	async function indlaes() {
		loading = true;
		fejl = null;
		try {
			const f = await hentForlob(forlobId);
			if (!f) {
				fejl = 'Forløbet findes ikke.';
				loading = false;
				return;
			}
			forlob = f;
			formNavn = f.navn;
			formStartDato = toIsoLokal(f.startDato.toDate());
			formAntalDage = f.antalDage;
			formAktiv = f.aktiv;
			formType = f.type ?? 'kickstart';
			formFeatures = { ...(f.features ?? {}) };
			formBuddy = f.harBuddy ?? false;
			formFacebook = f.harFacebookGruppe ?? false;
			formTraening = f.harTraening ?? false;
			formTraeningStart = traeningStartDag(f);
			formFacebookUrl = f.facebookUrl ?? '';
			formSimpleroId = f.simpleroProduktId ?? '';
			formNulPulje = typeof f.nulDagePulje === 'number' ? f.nulDagePulje : 14;

			emails = await hentAllowedEmailsForForlob(forlobId);
			// App-versioner er best-effort: fejler opslaget, viser vi bare
			// ingen version frem for at blokere hele siden.
			appVersioner = await hentAppVersionerForForlob(forlobId).catch(() => new Map());
		} catch (e) {
			console.error(e);
			fejl = 'Kunne ikke hente forløbet.';
		} finally {
			loading = false;
		}
	}

	async function gem() {
		gemFejl = null;
		gemKvit = false;
		const trimmedNavn = formNavn.trim();
		if (!trimmedNavn) {
			gemFejl = 'Forløbet skal have et navn.';
			return;
		}
		if (!formStartDato) {
			gemFejl = 'Vælg en startdato.';
			return;
		}
		if (formAntalDage < 1 || formAntalDage > 365) {
			gemFejl = 'Antal dage skal være mellem 1 og 365.';
			return;
		}
		gemmer = true;
		try {
			// Forløb starter kl. 00:01 (konvention) — se opret-siden. Redigeres et
			// eksisterende forløbs dato, flyttes starttiden også til 00:01.
			const startDate = new Date(formStartDato + 'T00:01:00');
			// Byggede forløb har ingen type — undlad at skrive den (ellers
			// stemples forløbet fejlagtigt som Kickstart). De fleksible tilvalg
			// (funktioner, fællesskab, træning, pause-dage-pulje) gemmes derimod.
			const ekstraFelter = erBygget
				? {
						features: { ...formFeatures },
						harBuddy: formBuddy,
						harFacebookGruppe: formFacebook,
						harTraening: formTraening,
						nulDagePulje: Math.max(0, Math.min(365, formNulPulje))
					}
				: { type: formType };
			// Traeningens startdag gemmes for ALLE forloeb, ogsaa Kickstart og
			// Kropsro, der ikke er byggede forloeb.
			const traeningStart = Math.max(0, Math.min(formAntalDage, formTraeningStart));
			const facebookUrl = formFacebookUrl.trim();
			const simpleroProduktId = formSimpleroId.trim();
			await gemForlob(forlobId, {
				navn: trimmedNavn,
				startDato: Timestamp.fromDate(startDate),
				antalDage: formAntalDage,
				aktiv: formAktiv,
				traeningStartDag: traeningStart,
				facebookUrl,
				simpleroProduktId,
				...ekstraFelter
			});
			if (forlob) {
				forlob = {
					...forlob,
					navn: trimmedNavn,
					startDato: Timestamp.fromDate(startDate),
					antalDage: formAntalDage,
					aktiv: formAktiv,
					traeningStartDag: traeningStart,
					facebookUrl,
					simpleroProduktId,
					...ekstraFelter
				};
			}
			gemKvit = true;
			setTimeout(() => (gemKvit = false), 2000);
		} catch (e) {
			console.error(e);
			gemFejl = 'Kunne ikke gemme. Prøv igen.';
		} finally {
			gemmer = false;
		}
	}

	async function slet() {
		if (!bekraefter) {
			bekraefter = true;
			return;
		}
		sletter = true;
		try {
			await sletForlob(forlobId);
			goto('/ny/admin/forlob');
		} catch (e) {
			console.error(e);
			gemFejl = 'Kunne ikke slette forløbet.';
			sletter = false;
		}
	}

	function statusLabel(status: AllowedEmail['status']): string {
		return status === 'registered' ? 'Tilmeldt' : 'Inviteret';
	}

	// Tekst til app-versions-linjen pr. kunde under Tilmeldte emails.
	function appVersionTekst(email: string): string {
		const v = appVersioner.get(email.toLowerCase());
		if (!v) return 'App: ikke åbnet endnu';
		if (!v.appVersion) return 'App: ukendt version (åbnet før sporing)';
		const dato = v.appVersionSetAt
			? new Date(v.appVersionSetAt).toLocaleDateString('da-DK', {
					day: 'numeric',
					month: 'short'
				})
			: null;
		return dato ? `App ${v.appVersion} · siden ${dato}` : `App ${v.appVersion}`;
	}

	function previewCsv() {
		importResultat = null;
		importFejl = null;
		const r = parseSimpleroCsv(csvIndhold);
		parsResultat = r;
	}

	async function importer() {
		if (!parsResultat || parsResultat.rows.length === 0) return;
		importerer = true;
		importFejl = null;
		try {
			const r = await gemAllowedEmailsBatch(parsResultat.rows, forlobId);
			importResultat = r;
			emails = await hentAllowedEmailsForForlob(forlobId);
			csvIndhold = '';
			parsResultat = null;
		} catch (e) {
			console.error(e);
			// Vis specifik fejlbesked fra adgangsFelterForForlob (fx "Forløbet
			// ... findes ikke") saa Linn kan identificere CSV-typo direkte.
			importFejl = e instanceof Error && e.message ? e.message : 'Kunne ikke importere. Prøv igen.';
		} finally {
			importerer = false;
		}
	}
</script>

{#if !maaVaereHer}
	<p class="fu-kun">Siden er kun for admin.</p>
{:else}
	<div class="page">
		<header class="page-header">
			<a class="back" href="/ny/admin/forlob">
				<Icon name="arrow-l" size={14} color="var(--text2)" />
				<span>Forløb</span>
			</a>
			<div class="eyebrow">Admin · Forløb</div>
			<h1>{forlob?.navn ?? forlobId}</h1>
		</header>

		{#if loading}
			<div class="status-besked">Henter forløb...</div>
		{:else if fejl}
			<div class="status-besked fejl">{fejl}</div>
		{:else if forlob}
			<div class="form-card">
				<div class="form-titel">Indstillinger</div>
				<label class="felt">
					<span class="felt-label">Navn</span>
					<input type="text" bind:value={formNavn} disabled={gemmer} />
				</label>
				<div class="felt-rad">
					<label class="felt">
						<span class="felt-label">Startdato</span>
						<input type="date" bind:value={formStartDato} disabled={gemmer} />
					</label>
					<label class="felt">
						<span class="felt-label">Antal dage</span>
						<input type="number" min="1" max="365" bind:value={formAntalDage} disabled={gemmer} />
					</label>
				</div>
				{#if adgangsVindue}
					<div class="adgangs-vindue">
						<div class="adgangs-rad">
							<span class="adgangs-label">Adgang åbner</span>
							<span class="adgangs-vaerdi">{adgangsVindue.aabner}</span>
						</div>
						<div class="adgangs-rad">
							<span class="adgangs-label">Mister adgang efter</span>
							<span class="adgangs-vaerdi">{adgangsVindue.mister}</span>
						</div>
						<div class="adgangs-note">
							Kunderne har materialet til og med sidste forløbsdag kl. 23.59. Pause-dage (nul-dage)
							kan udskyde lukningen pr. kunde.
						</div>
					</div>
				{/if}
				<label class="checkbox-rad">
					<input type="checkbox" bind:checked={formAktiv} disabled={gemmer} />
					<span>
						Aktivt forløb
						{#if formSimpleroId.trim()}
							(nye køb i Simplero lander på dette hold)
						{:else}
							(sæt Simplero-nummeret nedenfor, hvis nye køb skal lande her)
						{/if}
					</span>
				</label>

				<label class="felt">
					<span class="felt-label">Simplero-produkt (nummer)</span>
					<input
						type="text"
						inputmode="numeric"
						bind:value={formSimpleroId}
						placeholder="fx 253807"
						disabled={gemmer}
					/>
					<span class="felt-hint">
						{#if !formSimpleroId.trim()}
							Tomt felt betyder, at køb i Simplero ikke kommer med her af sig selv. Så skal du hente
							købslisten ind manuelt, som du plejer.
						{:else if !formAktiv}
							Nummeret står her, men holdet er ikke sat som aktivt. Derfor lander nye køb ikke her.
							Sæt fluebenet ovenfor.
						{:else}
							Nye køb af det produkt lander på dette hold med det samme. Når du åbner næste hold,
							flytter du fluebenet ovenfor derover.
						{/if}
					</span>
					{#if andreMedSammeNummer.length > 0}
						<!-- To hold der begge er aktive paa samme nummer ville slaas om
					     koeberne. Vi vaelger det nyeste, men Linn skal vide det. -->
						<span class="felt-advarsel">
							{#if andreMedSammeNummer.some((h) => h.aktiv) && formAktiv}
								Pas på: {andreMedSammeNummer
									.filter((h) => h.aktiv)
									.map((h) => h.navn)
									.join(', ')}
								står med samme nummer og er også aktivt. Nye køb lander på det hold, der starter senest.
								Fjern fluebenet på det gamle hold.
							{:else}
								Samme nummer står også på: {andreMedSammeNummer.map((h) => h.navn).join(', ')}. Det
								er i orden, så længe kun ét af dem er aktivt.
							{/if}
						</span>
					{/if}
				</label>

				<div class="felt">
					<span class="felt-label">Forløbs-type</span>
					{#if erBygget}
						<div class="bygget-tag">Fleksibelt forløb</div>
					{:else}
						<div class="type-toggle">
							<button
								type="button"
								class="type-knap"
								class:aktiv={formType === 'kickstart'}
								onclick={() => (formType = 'kickstart')}
								disabled={gemmer}
							>
								<div class="type-titel">Kickstart</div>
								<div class="type-sub">21 dage · basis-niveau</div>
							</button>
							<button
								type="button"
								class="type-knap"
								class:aktiv={formType === 'kropsro'}
								onclick={() => (formType = 'kropsro')}
								disabled={gemmer}
							>
								<div class="type-titel">Kropsro</div>
								<div class="type-sub">12 uger · med buddy-gruppe</div>
							</button>
						</div>
					{/if}
				</div>

				<label class="felt">
					<span class="felt-label">Facebook-gruppe (link)</span>
					<input
						type="url"
						bind:value={formFacebookUrl}
						placeholder="https://www.facebook.com/groups/..."
						disabled={gemmer}
					/>
					<span class="felt-hint">
						{formFacebookUrl.trim()
							? 'Kunden bliver spurgt én gang, om hun er med i gruppen, og kan trykke sig direkte derover.'
							: 'Tomt felt betyder at vi slet ikke spørger om Facebook på dette hold.'}
					</span>
				</label>

				<label class="felt">
					<span class="felt-label">Træningen starter på dag</span>
					<input
						type="number"
						min="0"
						max={formAntalDage}
						bind:value={formTraeningStart}
						disabled={gemmer}
					/>
					<span class="felt-hint">
						{formTraeningStart <= 1
							? 'Træningen er med fra dag 1. Sådan kører Kropsro.'
							: `Ingen træning før dag ${formTraeningStart}. Den dag giver træning 1, dagen efter træning 2, og så fremdeles. Kickstart bruger dag 3.`}
					</span>
				</label>

				{#if erBygget}
					<div class="felt">
						<span class="felt-label">Funktioner (frit pr forløb)</span>
						<div class="feature-liste">
							{#each FEATURES as f (f.key)}
								<label class="checkbox-rad">
									<input
										type="checkbox"
										checked={formFeatures[f.key] ?? false}
										onchange={(e) => (formFeatures[f.key] = e.currentTarget.checked)}
										disabled={gemmer}
									/>
									<span>{f.navn}</span>
								</label>
							{/each}
						</div>

						{#if formFeatures['nul-dage']}
							<label class="felt" style="margin-top: 12px;">
								<span class="felt-label">Pause-dage-pulje (max antal)</span>
								<input
									type="number"
									min="0"
									max="365"
									bind:value={formNulPulje}
									disabled={gemmer}
								/>
								<span class="felt-hint">
									Hvor mange dage kunden i alt må sætte på pause i forløbet.
								</span>
							</label>
						{/if}
					</div>

					<div class="felt">
						<span class="felt-label">Fællesskab</span>
						<label class="checkbox-rad">
							<input type="checkbox" bind:checked={formBuddy} disabled={gemmer} />
							<span>Buddy-makker (kunden spørges ved første login)</span>
						</label>
						<label class="checkbox-rad">
							<input type="checkbox" bind:checked={formFacebook} disabled={gemmer} />
							<span>Facebook-gruppe (kunden spørges om hun er kommet ind)</span>
						</label>
					</div>

					<div class="felt">
						<span class="felt-label">Træning</span>
						<label class="checkbox-rad">
							<input type="checkbox" bind:checked={formTraening} disabled={gemmer} />
							<span>Mikrotræning (kunden vælger kettlebell/uden)</span>
						</label>
						<span class="felt-hint">
							{formTraening
								? 'Husk at bygge to programmer (med/uden kettlebell) under Træning-siden nedenfor.'
								: 'Uden mikrotræning leveres træning bare som lektioner/videoer.'}
						</span>
					</div>
				{/if}

				{#if gemFejl}
					<div class="fejl-besked">{gemFejl}</div>
				{/if}
				{#if gemKvit}
					<div class="kvit-besked">Gemt ✓</div>
				{/if}

				<button class="form-knap primary" type="button" onclick={gem} disabled={gemmer}>
					{gemmer ? 'Gemmer...' : 'Gem ændringer'}
				</button>
			</div>

			<a class="indhold-row" href="/ny/admin/forlob/{forlobId}/lektioner">
				<div class="indhold-icon" style="background: #9D6358;">
					<Icon name="path" size={16} color="#fff" />
				</div>
				<div class="indhold-tekst">
					<div class="indhold-navn">Dagligt indhold</div>
					<div class="indhold-sub">Lektioner, refleksioner og små skridt — dag for dag</div>
				</div>
				<Icon name="chevron-r" size={14} color="var(--text3)" />
			</a>

			<a class="indhold-row" href="/ny/admin/forlob/{forlobId}/smaa-skridt">
				<div class="indhold-icon" style="background: #7E9BB3;">
					<Icon name="flower" size={16} color="#fff" />
				</div>
				<div class="indhold-tekst">
					<div class="indhold-navn">Små skridt</div>
					<div class="indhold-sub">Daglige små skridt — vælg hvilke dage de gælder</div>
				</div>
				<Icon name="chevron-r" size={14} color="var(--text3)" />
			</a>

			<a class="indhold-row" href="/ny/admin/forlob/{forlobId}/challenges">
				<div class="indhold-icon" style="background: #6F9E7E;">
					<Icon name="leaf" size={16} color="#fff" />
				</div>
				<div class="indhold-tekst">
					<div class="indhold-navn">Challenges</div>
					<div class="indhold-sub">Tidsbegrænsede konkurrencer som frugt/grønt-uge</div>
				</div>
				<Icon name="chevron-r" size={14} color="var(--text3)" />
			</a>

			{#if forlob?.harBuddy ?? forlob?.type === 'kropsro'}
				<a class="indhold-row" href="/ny/admin/forlob/{forlobId}/buddymakker">
					<div class="indhold-icon" style="background: #9D6358;">
						<Icon name="user" size={16} color="#fff" />
					</div>
					<div class="indhold-tekst">
						<div class="indhold-navn">Buddy-gruppe</div>
						<div class="indhold-sub">Deltagere der vil være med i en buddy-gruppe</div>
					</div>
					<Icon name="chevron-r" size={14} color="var(--text3)" />
				</a>
			{/if}

			{#if forlob?.harFacebookGruppe ?? forlob?.type === 'kropsro'}
				<a class="indhold-row" href="/ny/admin/forlob/{forlobId}/facebook-gruppe">
					<div class="indhold-icon" style="background: #4267B2;">
						<Icon name="community" size={16} color="#fff" />
					</div>
					<div class="indhold-tekst">
						<div class="indhold-navn">Facebook-gruppe</div>
						<div class="indhold-sub">Hvem er kommet ind og hvem mangler</div>
					</div>
					<Icon name="chevron-r" size={14} color="var(--text3)" />
				</a>
			{/if}

			<a class="indhold-row" href="/ny/admin/forlob/{forlobId}/traening">
				<div class="indhold-icon" style="background: #C9A07A;">
					<Icon name="flame" size={16} color="#fff" />
				</div>
				<div class="indhold-tekst">
					<div class="indhold-navn">Træning</div>
					<div class="indhold-sub">
						Programmer, tildelinger og custom-builder for forløbets deltagere
					</div>
				</div>
				<Icon name="chevron-r" size={14} color="var(--text3)" />
			</a>

			<a class="indhold-row" href="/ny/admin/forlob/{forlobId}/bibliotek">
				<div class="indhold-icon" style="background: var(--terra);">
					<Icon name="book" size={16} color="#fff" />
				</div>
				<div class="indhold-tekst">
					<div class="indhold-navn">Bibliotek</div>
					<div class="indhold-sub">FAQ og links for forløbet</div>
				</div>
				<Icon name="chevron-r" size={14} color="var(--text3)" />
			</a>

			<a class="indhold-row" href="/ny/admin/forlob/{forlobId}/beskeder">
				<div class="indhold-icon" style="background: #5C7A8C;">
					<Icon name="mail" size={16} color="#fff" />
				</div>
				<div class="indhold-tekst">
					<div class="indhold-navn">Beskeder</div>
					<div class="indhold-sub">Spørgsmål fra klienter på dette forløb</div>
				</div>
				<Icon name="chevron-r" size={14} color="var(--text3)" />
			</a>

			<div class="form-card">
				<div class="form-titel">Tilføj én kunde manuelt</div>
				<p class="csv-hint">
					Indsæt klientens email, fornavn og efternavn. Hun bliver automatisk tilknyttet dette
					forløb med korrekt adgang.
				</p>
				<form
					class="manuel-form"
					onsubmit={(e) => {
						e.preventDefault();
						void tilfoejManuel();
					}}
				>
					<input
						type="email"
						class="manuel-input"
						placeholder="Email"
						bind:value={nyEmail}
						disabled={tilfoejer}
						autocomplete="email"
					/>
					<div class="manuel-row">
						<input
							type="text"
							class="manuel-input"
							placeholder="Fornavn"
							bind:value={nyFornavn}
							disabled={tilfoejer}
							autocomplete="given-name"
						/>
						<input
							type="text"
							class="manuel-input"
							placeholder="Efternavn"
							bind:value={nyEfternavn}
							disabled={tilfoejer}
							autocomplete="family-name"
						/>
					</div>
					<button
						type="submit"
						class="form-knap primary"
						disabled={tilfoejer || !nyEmail.trim() || !nyFornavn.trim()}
					>
						{tilfoejer ? 'Tilføjer...' : 'Tilføj kunde'}
					</button>
				</form>
				{#if tilfoejResultat}
					<div class="kvit-besked">{tilfoejResultat}</div>
				{/if}
				{#if tilfoejFejl}
					<div class="fejl-besked">{tilfoejFejl}</div>
				{/if}
			</div>

			<div class="form-card">
				<div class="form-titel">Importér emails fra Simplero</div>
				<p class="csv-hint">
					Upload din Simplero-eksport som CSV-fil eller paste indholdet ind. Klienter med "Canceled
					at" udfyldt springes automatisk over.
				</p>

				<label class="csv-fil-knap" class:disabled={importerer}>
					📎 Vælg CSV-fil
					<input
						type="file"
						accept=".csv,text/csv,text/plain"
						onchange={laesCsvFil}
						disabled={importerer}
					/>
				</label>

				<div class="csv-eller">eller indsæt manuelt</div>

				<textarea
					class="csv-textarea"
					placeholder="Paste CSV-indhold her..."
					bind:value={csvIndhold}
					disabled={importerer}
					rows="6"
				></textarea>

				<div class="csv-knapper">
					<button
						class="form-knap ghost"
						type="button"
						onclick={previewCsv}
						disabled={!csvIndhold.trim() || importerer}
					>
						Forhåndsvis
					</button>
					<button
						class="form-knap primary"
						type="button"
						onclick={importer}
						disabled={!parsResultat || parsResultat.rows.length === 0 || importerer}
					>
						{importerer ? 'Importerer...' : 'Importér'}
					</button>
				</div>

				{#if parsResultat}
					{#if parsResultat.fejl}
						<div class="fejl-besked">{parsResultat.fejl}</div>
					{:else}
						<div class="csv-preview">
							<div class="csv-preview-tael">
								<strong>{parsResultat.rows.length}</strong> gyldige emails klar til import
							</div>
							{#if parsResultat.skippedCanceled > 0}
								<div class="csv-preview-info">
									{parsResultat.skippedCanceled} annullerede sprunget over
								</div>
							{/if}
							{#if parsResultat.skippedInvalid > 0}
								<div class="csv-preview-info">
									{parsResultat.skippedInvalid} ugyldige rækker sprunget over
								</div>
							{/if}
						</div>
					{/if}
				{/if}

				{#if importResultat}
					<div class="kvit-besked">
						Import færdig — {importResultat.tilfoejet} tilføjet · {importResultat.opdateret} opdateret
						·
						{importResultat.uaendret} uændret
						{#if importResultat.fejl > 0}
							· {importResultat.fejl} fejl
						{/if}
					</div>
				{/if}

				{#if importFejl}
					<div class="fejl-besked">{importFejl}</div>
				{/if}
			</div>

			<div class="emails-card">
				<div class="emails-head">
					<div class="form-titel">Tilmeldte emails</div>
					<div class="emails-tael">
						{#if soegning.trim() && filtreredeEmails.length !== emails.length}
							{filtreredeEmails.length} af {emails.length}
						{:else}
							{emails.length}
						{/if}
					</div>
				</div>

				{#if emails.length > 0}
					<div class="soeg-rad">
						<input
							type="search"
							class="soeg-input"
							placeholder="Søg på navn eller email..."
							bind:value={soegning}
						/>
						{#if soegning}
							<button
								class="soeg-ryd"
								type="button"
								onclick={() => (soegning = '')}
								aria-label="Ryd søgning"
							>
								×
							</button>
						{/if}
					</div>
				{/if}

				{#if emails.length === 0}
					<div class="status-besked" style="margin: 0;">
						Ingen emails tilknyttet endnu. Importér en CSV-fil ovenfor for at komme i gang.
					</div>
				{:else if filtreredeEmails.length === 0}
					<div class="status-besked" style="margin: 0;">
						Ingen match for "{soegning}".
					</div>
				{:else}
					<div class="emails-liste">
						{#each filtreredeEmails as e (e.email)}
							<div class="email-row">
								<div class="email-info">
									<div class="email-adresse">{e.email}</div>
									{#if e.firstName || e.lastName}
										<div class="email-navn">{e.firstName} {e.lastName}</div>
									{/if}
									<div class="email-version">{appVersionTekst(e.email)}</div>
								</div>
								<span class="badge {e.status === 'registered' ? 'aktiv' : 'inaktiv'}">
									{statusLabel(e.status)}
								</span>
							</div>
						{/each}
					</div>
				{/if}
			</div>

			<div class="slet-omraade">
				{#if !bekraefter}
					<button class="slet-knap" type="button" onclick={slet}>Slet forløb</button>
				{:else}
					<div class="slet-bekraeft">
						<div class="slet-tekst">
							Slet forløbet permanent? Tilknyttede allowedEmails forbliver i Firestore.
						</div>
						<div class="slet-knapper">
							<button
								class="form-knap ghost"
								type="button"
								onclick={() => (bekraefter = false)}
								disabled={sletter}
							>
								Annuller
							</button>
							<button class="form-knap danger" type="button" onclick={slet} disabled={sletter}>
								{sletter ? 'Sletter...' : 'Ja, slet'}
							</button>
						</div>
					</div>
				{/if}
			</div>
		{/if}
	</div>
{/if}

<style>
	.page {
		padding: 18px 18px 100px;
		max-width: 520px;
		margin: 0 auto;
	}

	.page-header {
		margin-bottom: 18px;
	}

	.back {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-size: calc(12px * var(--fs-scale, 1) * var(--adm-skala, 1));
		color: var(--text2);
		text-decoration: none;
		margin-bottom: 12px;
	}

	.back:hover {
		color: var(--text);
	}

	.eyebrow {
		font-size: calc(10px * var(--fs-scale, 1) * var(--adm-skala, 1));
		font-weight: 600;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--text3);
	}

	h1 {
		font-family: var(--ff-d);
		font-size: calc(26px * var(--fs-scale, 1) * var(--adm-skala, 1));
		font-weight: 600;
		letter-spacing: -0.02em;
		margin: 4px 0 0;
		line-height: 1.05;
		color: var(--text);
	}

	.status-besked {
		padding: 14px 16px;
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 12px;
		color: var(--text2);
		font-size: calc(13px * var(--fs-scale, 1) * var(--adm-skala, 1));
		text-align: center;
		margin-bottom: 14px;
	}

	.status-besked.fejl {
		color: #8a4a3e;
		background: #fbeeea;
		border-color: #f0d6cf;
	}

	.form-card,
	.emails-card {
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 14px;
		padding: 16px;
		display: flex;
		flex-direction: column;
		gap: 12px;
		margin-bottom: 14px;
	}

	.form-titel {
		font-family: var(--ff-d);
		font-size: calc(18px * var(--fs-scale, 1) * var(--adm-skala, 1));
		font-weight: 600;
		color: var(--text);
	}

	.emails-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.emails-tael {
		font-size: calc(13px * var(--fs-scale, 1) * var(--adm-skala, 1));
		color: var(--text3);
		font-variant-numeric: tabular-nums;
	}

	.emails-liste {
		display: flex;
		flex-direction: column;
		gap: 6px;
		max-height: 320px;
		overflow-y: auto;
	}

	.email-row {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 8px 10px;
		background: var(--bg2);
		border-radius: 8px;
	}

	.email-info {
		flex: 1;
		min-width: 0;
	}

	.email-adresse {
		font-size: calc(13px * var(--fs-scale, 1) * var(--adm-skala, 1));
		color: var(--text);
		font-weight: 500;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.email-navn {
		font-size: calc(11px * var(--fs-scale, 1) * var(--adm-skala, 1));
		color: var(--text3);
		margin-top: 1px;
	}

	.email-version {
		font-size: calc(10px * var(--fs-scale, 1) * var(--adm-skala, 1));
		color: var(--text3);
		margin-top: 2px;
	}

	.felt {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.felt-label {
		font-size: calc(11px * var(--fs-scale, 1) * var(--adm-skala, 1));
		font-weight: 600;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--text3);
	}

	.felt input {
		padding: 10px 12px;
		font-size: calc(14px * var(--fs-scale, 1) * var(--adm-skala, 1));
		border-radius: 10px;
		border: 1px solid var(--border);
		background: var(--bg2);
		color: var(--text);
		font-family: var(--ff-b);
		outline: none;
	}

	.felt input:focus {
		border-color: var(--terra);
	}

	.felt-rad {
		display: grid;
		grid-template-columns: 2fr 1fr;
		gap: 10px;
	}

	.adgangs-vindue {
		display: flex;
		flex-direction: column;
		gap: 6px;
		padding: 12px;
		background: var(--bg2);
		border-radius: 10px;
	}

	.adgangs-rad {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 12px;
	}

	.adgangs-label {
		font-size: calc(11px * var(--fs-scale, 1) * var(--adm-skala, 1));
		font-weight: 600;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--text3);
	}

	.adgangs-vaerdi {
		font-size: calc(13px * var(--fs-scale, 1) * var(--adm-skala, 1));
		font-weight: 600;
		color: var(--text);
		text-align: right;
	}

	.adgangs-note {
		font-size: calc(11px * var(--fs-scale, 1) * var(--adm-skala, 1));
		color: var(--text3);
		line-height: 1.4;
		margin-top: 2px;
	}

	.checkbox-rad {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: calc(13px * var(--fs-scale, 1) * var(--adm-skala, 1));
		color: var(--text2);
		cursor: pointer;
	}

	.checkbox-rad input {
		width: 16px;
		height: 16px;
		accent-color: var(--terra);
	}

	.type-toggle {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 8px;
		margin-top: 6px;
	}

	.bygget-tag {
		display: inline-block;
		margin-top: 6px;
		padding: 8px 14px;
		border-radius: 99px;
		background: var(--sdim);
		color: var(--sage);
		font-family: var(--ff-b);
		font-size: calc(13px * var(--fs-scale, 1) * var(--adm-skala, 1));
		font-weight: 600;
	}

	.feature-liste {
		display: flex;
		flex-direction: column;
		gap: 7px;
		margin-top: 4px;
	}

	.felt-advarsel {
		display: block;
		margin-top: 6px;
		font-size: calc(12.5px * var(--fs-scale, 1) * var(--adm-skala, 1));
		line-height: 1.5;
		color: var(--advarsel, #9a6b3f);
	}

	.felt-hint {
		font-size: calc(11.5px * var(--fs-scale, 1) * var(--adm-skala, 1));
		color: var(--text3);
		margin-top: 4px;
		line-height: 1.4;
	}

	.type-knap {
		padding: 12px 14px;
		background: var(--white);
		border: 1.5px solid var(--border);
		border-radius: 10px;
		cursor: pointer;
		text-align: left;
		font-family: var(--ff-b);
		color: inherit;
	}

	.type-knap:hover {
		border-color: var(--terra);
	}

	.type-knap.aktiv {
		border-color: var(--terra);
		background: var(--tdim);
	}

	.type-knap:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.type-titel {
		font-size: calc(14px * var(--fs-scale, 1) * var(--adm-skala, 1));
		font-weight: 600;
		color: var(--text);
	}

	.type-knap.aktiv .type-titel {
		color: var(--terra);
	}

	.type-sub {
		font-size: calc(11px * var(--fs-scale, 1) * var(--adm-skala, 1));
		color: var(--text3);
		margin-top: 2px;
	}

	.fejl-besked {
		padding: 10px 12px;
		background: #fbeeea;
		border: 1px solid #f0d6cf;
		border-radius: 8px;
		font-size: calc(12px * var(--fs-scale, 1) * var(--adm-skala, 1));
		color: #8a4a3e;
	}

	.indhold-row {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 14px 16px;
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 14px;
		text-decoration: none;
		color: inherit;
		margin-bottom: 14px;
	}

	.indhold-row:hover {
		background: var(--bg2);
	}

	.indhold-icon {
		width: 36px;
		height: 36px;
		border-radius: 10px;
		background: var(--sage);
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.indhold-tekst {
		flex: 1;
		min-width: 0;
	}

	.indhold-navn {
		font-size: calc(14px * var(--fs-scale, 1) * var(--adm-skala, 1));
		font-weight: 600;
		color: var(--text);
	}

	.indhold-sub {
		font-size: calc(11.5px * var(--fs-scale, 1) * var(--adm-skala, 1));
		color: var(--text3);
		margin-top: 2px;
	}

	.kvit-besked {
		padding: 8px 12px;
		background: var(--sdim);
		border-radius: 8px;
		font-size: calc(12px * var(--fs-scale, 1) * var(--adm-skala, 1));
		color: var(--sage);
		text-align: center;
	}

	.csv-hint {
		font-size: calc(12px * var(--fs-scale, 1) * var(--adm-skala, 1));
		color: var(--text3);
		line-height: 1.5;
		margin: 0;
	}

	.csv-fil-knap {
		position: relative;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 11px 16px;
		font-size: calc(13px * var(--fs-scale, 1) * var(--adm-skala, 1));
		font-weight: 600;
		border-radius: 10px;
		border: 1px dashed var(--terra);
		background: var(--tdim);
		color: var(--terra);
		cursor: pointer;
		font-family: var(--ff-b);
	}

	.csv-fil-knap:hover {
		background: var(--white);
	}

	.csv-fil-knap.disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.csv-fil-knap input[type='file'] {
		position: absolute;
		inset: 0;
		opacity: 0;
		cursor: pointer;
		font-size: 0;
	}

	.csv-fil-knap.disabled input[type='file'] {
		cursor: not-allowed;
	}

	.csv-eller {
		text-align: center;
		font-size: calc(11px * var(--fs-scale, 1) * var(--adm-skala, 1));
		color: var(--text3);
		font-style: italic;
		margin: 2px 0;
	}

	.soeg-rad {
		position: relative;
		display: flex;
		align-items: center;
	}

	.soeg-input {
		flex: 1;
		padding: 10px 36px 10px 12px;
		font-size: calc(13px * var(--fs-scale, 1) * var(--adm-skala, 1));
		border-radius: 10px;
		border: 1px solid var(--border);
		background: var(--bg2);
		color: var(--text);
		font-family: var(--ff-b);
		outline: none;
	}

	.soeg-input:focus {
		border-color: var(--terra);
	}

	.soeg-ryd {
		position: absolute;
		right: 6px;
		width: 24px;
		height: 24px;
		border-radius: 50%;
		border: none;
		background: var(--text3);
		color: #fff;
		font-size: calc(14px * var(--fs-scale, 1) * var(--adm-skala, 1));
		line-height: 1;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.csv-textarea {
		font-family: ui-monospace, monospace;
		font-size: calc(11px * var(--fs-scale, 1) * var(--adm-skala, 1));
		padding: 10px 12px;
		border-radius: 10px;
		border: 1px solid var(--border);
		background: var(--bg2);
		color: var(--text);
		outline: none;
		resize: vertical;
		min-height: 100px;
	}

	.manuel-form {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.manuel-row {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 8px;
	}

	.manuel-input {
		padding: 10px 12px;
		font-size: calc(14px * var(--fs-scale, 1) * var(--adm-skala, 1));
		border: 1px solid var(--border);
		border-radius: 10px;
		background: var(--bg2);
		color: var(--text);
		font-family: var(--ff-b);
		outline: none;
		box-sizing: border-box;
	}

	.manuel-input:focus {
		border-color: var(--terra);
	}

	.csv-textarea:focus {
		border-color: var(--terra);
	}

	.csv-knapper {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 10px;
	}

	.csv-preview {
		padding: 10px 12px;
		background: var(--bg2);
		border-radius: 8px;
		font-size: calc(12px * var(--fs-scale, 1) * var(--adm-skala, 1));
		color: var(--text2);
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.csv-preview-tael strong {
		color: var(--terra);
		font-size: calc(14px * var(--fs-scale, 1) * var(--adm-skala, 1));
	}

	.csv-preview-info {
		font-size: calc(11px * var(--fs-scale, 1) * var(--adm-skala, 1));
		color: var(--text3);
	}

	.form-knap {
		padding: 12px;
		font-size: calc(14px * var(--fs-scale, 1) * var(--adm-skala, 1));
		font-weight: 600;
		border-radius: 10px;
		border: none;
		cursor: pointer;
		font-family: var(--ff-b);
	}

	.form-knap.ghost {
		background: var(--white);
		border: 1px solid var(--border);
		color: var(--text2);
	}

	.form-knap.primary {
		background: var(--terra);
		color: #fff;
	}

	.form-knap.danger {
		background: #b8503f;
		color: #fff;
	}

	.form-knap:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.badge {
		font-size: calc(9.5px * var(--fs-scale, 1) * var(--adm-skala, 1));
		letter-spacing: 0.1em;
		text-transform: uppercase;
		padding: 2px 7px;
		border-radius: 99px;
		font-weight: 600;
	}

	.badge.aktiv {
		background: var(--sdim);
		color: var(--sage);
	}

	.badge.inaktiv {
		background: var(--bg2);
		color: var(--text3);
	}

	.slet-omraade {
		margin-top: 24px;
	}

	.slet-knap {
		background: none;
		border: 1px solid #e8c8c1;
		color: #b8503f;
		font-size: calc(13px * var(--fs-scale, 1) * var(--adm-skala, 1));
		font-weight: 500;
		padding: 10px 16px;
		border-radius: 10px;
		cursor: pointer;
		font-family: var(--ff-b);
	}

	.slet-knap:hover {
		background: #fbeeea;
	}

	.slet-bekraeft {
		background: #fbeeea;
		border: 1px solid #f0d6cf;
		border-radius: 12px;
		padding: 14px;
	}

	.slet-tekst {
		font-size: calc(13px * var(--fs-scale, 1) * var(--adm-skala, 1));
		color: #8a4a3e;
		margin-bottom: 10px;
	}

	.slet-knapper {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 10px;
	}

	/* ============================================================
	   FARVEBRO. Siden er kopieret ORDRET fra den gamle admin, markup og
	   stil, saa intet indhold kunne gaa tabt i flytningen. De gamle
	   farve-navne peger i stedet paa de nye vaerdier, og saa foelger hele
	   siden det nye design uden at en linje markup er roert.
	   Samme greb som paa Dashboard. Se samtalen 1. september 2026.
	   ============================================================ */
	.page {
		--bg: #fbf8f2;
		--white: #f6f0e7;
		--bg2: #f1eadf;
		--header: #f6f0e7;
		--border: #e8dfd1;
		--border2: #e8dfd1;
		--text: #382c2a;
		--text2: #6f5f57;
		--text3: #a3948a;
		--text4: #a3948a;
		--terra: #7c4f63;
		--terra2: #7c4f63;
		--tdim: #f1e5e8;
		--tdim2: #f1e5e8;
		--sage: #86a188;
		--sdim: #e7efe5;
		--gold: #d6a15e;
		--gdim: #f7ecd7;
		background: var(--bg);
	}

	.fu-kun {
		padding: 24px 18px;
		color: #6f5f57;
		font-size: calc(14px * var(--fs-scale, 1) * var(--adm-skala, 1));
	}
</style>
