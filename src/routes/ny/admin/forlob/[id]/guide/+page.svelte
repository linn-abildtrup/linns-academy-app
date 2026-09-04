<script lang="ts">
	// ============================================================
	// Guiden der spoerger om alt, foer et hold maa aabne.
	//
	// Linns oenske 1. september 2026, skaerm 4 i mockups-admin.html,
	// bygget 4. september.
	//
	// DEN TJEKKER VIRKELIGHEDEN, IKKE FLUEBEN. Der er ingen "jeg har
	// husket det"-afkrydsning nogen steder. Guiden ser efter om
	// tildelingen, lektionen og skridtet ligger i databasen. Et flueben
	// man saetter selv er lige saa nemt at saette forkert som at glemme
	// det oprindelige.
	//
	// DEN SPAERRER FOR AT UDGIVE. Det er hele pointen. En advarsel kan
	// overses, en knap der ikke kan trykkes kan ikke. Reglerne for hvad
	// der spaerrer ligger i content/forlobGuide3.ts med tests.
	//
	// DEN ER IKKE ET NYT STED AT GEMME DATA. De smaa felter der bor paa
	// selve holdet gemmes med den samme gemForlob som alle andre steder,
	// og alt det store, altsaa traening, lektioner, smaa skridt og
	// biblioteket, aabnes paa de sider der allerede findes. Ellers ville
	// der vaere to steder der kunne gemme det samme forskelligt.
	//
	// ALT GEMMES MED DET SAMME. Et forloeb bygges ikke paa én eftermiddag,
	// og et halvt svar maa aldrig betyde at man starter forfra.
	// ============================================================

	import { getContext, onMount } from 'svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import type { User } from 'firebase/auth';
	import { isAdmin } from '$lib/admin';
	import { Timestamp } from 'firebase/firestore';
	import { hentForlob, hentAlleForlob, gemForlob, hentForlobsdage, hentAllowedEmailsForForlob } from '$lib/firestore/forlob';
	import { hentTildelinger3 } from '$lib/firestore/traeningTildeling3';
	import { hentSmaaSkridt } from '$lib/firestore/smaaSkridt';
	import { hentFaqItems } from '$lib/firestore/bibliotek';
	import type { Forlob } from '$lib/content/forlobAdgang';
	import { FEATURES } from '$lib/content/features';
	import {
		TRIN,
		tjekTrin,
		spaerringer,
		bemaerkninger,
		kanUdgives,
		fremdrift,
		harTraening,
		manglendeDage,
		type TrinId,
		type Verden
	} from '$lib/content/forlobGuide3';
	import AdmKort from '$lib/components/admin/AdmKort.svelte';
	import AdmKnap from '$lib/components/admin/AdmKnap.svelte';
	import AdmTom from '$lib/components/admin/AdmTom.svelte';

	const hentUser = getContext<() => User | null>('user');
	const maaVaereHer = $derived(isAdmin(hentUser()));

	const forlobId = $derived(page.params.id ?? '');

	let forlob = $state<Forlob | null>(null);
	let alle = $state<Forlob[]>([]);
	let tildelinger = $state(0);
	let dageMedLektion = $state<number[]>([]);
	let antalSkridt = $state(0);
	let antalFaq = $state(0);
	let antalKunder = $state(0);

	let henter = $state(true);
	let fejl = $state('');
	let gemmer = $state('');
	let paaTrin = $state<TrinId>('navn');

	onMount(() => void indlaes());

	async function indlaes() {
		henter = true;
		fejl = '';
		try {
			const f = await hentForlob(forlobId);
			if (!f) {
				fejl = 'Der findes ikke noget hold med det id.';
				return;
			}
			forlob = f;

			// De fem opslag koeres samtidig, og hvert af dem faar lov at
			// fejle for sig. Guiden skal kunne vise de fire ting den ved,
			// ogsaa naar det femte opslag bliver afvist.
			const [andre, tild, dage, skridt, faq, kunder] = await Promise.all([
				hentAlleForlob().catch(() => [] as Forlob[]),
				hentTildelinger3().catch(() => []),
				hentForlobsdage(forlobId).catch(() => []),
				hentSmaaSkridt(forlobId).catch(() => []),
				hentFaqItems(forlobId).catch(() => []),
				hentAllowedEmailsForForlob(forlobId).catch(() => [])
			]);

			alle = andre;
			// Kun rigtige programmer taeller. En 'byg-eget'-raekke giver
			// kunden lov til at bygge selv, ikke et program at foelge.
			tildelinger = tild.filter(
				(t) =>
					t.type === 'program' &&
					((t.modtagerType === 'hold' && t.modtagerId === forlobId) ||
						t.modtagerType === 'medlemmer' ||
						t.modtagerType === 'alle')
			).length;
			dageMedLektion = dage.filter((d) => (d.lektioner?.length ?? 0) > 0).map((d) => d.dagNummer);
			antalSkridt = skridt.length;
			antalFaq = faq.length;
			antalKunder = kunder.length;

			// Start paa det foerste trin der mangler, ikke altid paa ét.
			// Guiden bruges over flere dage, og saa er det trin man slap paa
			// mere interessant end navnet man skrev i mandags.
			const foerste = tjekTrin(verden).find((t) => t.status === 'mangler');
			paaTrin = foerste?.id ?? 'udgiv';
		} catch (e) {
			console.error('[guide] indlæs', e);
			fejl = 'Kunne ikke hente holdet.';
		} finally {
			henter = false;
		}
	}

	const verden = $derived<Verden>({
		forlob: forlob
			? {
					id: forlob.id,
					navn: forlob.navn,
					startMs: forlob.startDato?.toMillis?.() ?? 0,
					antalDage: forlob.antalDage,
					aktiv: forlob.aktiv === true,
					bygget: forlob.byggetForlob === true,
					harTraening: forlob.harTraening,
					traeningStartDag: forlob.traeningStartDag,
					harFacebookGruppe: forlob.harFacebookGruppe,
					facebookUrl: forlob.facebookUrl,
					simpleroProduktId: forlob.simpleroProduktId
				}
			: null,
		antalTraeningstildelinger: tildelinger,
		dageMedLektion,
		antalSmaaSkridt: antalSkridt,
		antalFaq,
		antalKunder,
		andreAktivePaaSammeProdukt: forlob?.simpleroProduktId
			? alle
					.filter(
						(f) =>
							f.id !== forlobId &&
							f.aktiv === true &&
							f.simpleroProduktId === forlob?.simpleroProduktId
					)
					.map((f) => f.navn)
			: []
	});

	const trinStatus = $derived(tjekTrin(verden));
	const spaerret = $derived(spaerringer(verden));
	const noter = $derived(bemaerkninger(verden));
	const naaet = $derived(fremdrift(verden));
	const nr = $derived(TRIN.findIndex((t) => t.id === paaTrin));
	const detTrin = $derived(TRIN[nr] ?? TRIN[0]);

	function statusFor(id: TrinId) {
		return trinStatus.find((t) => t.id === id);
	}

	/** Gemmer ét felt paa holdet med det samme. */
	async function gem(felter: Partial<Omit<Forlob, 'id'>>) {
		if (!forlob) return;
		gemmer = 'gemmer';
		try {
			await gemForlob(forlobId, felter);
			forlob = { ...forlob, ...felter } as Forlob;
			gemmer = 'gemt';
			setTimeout(() => (gemmer = ''), 1600);
		} catch (e) {
			console.error('[guide] gem', e);
			gemmer = 'fejl';
		}
	}

	function gaaTil(id: TrinId) {
		paaTrin = id;
		if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
	}

	function naeste() {
		if (nr < TRIN.length - 1) gaaTil(TRIN[nr + 1].id);
	}

	function forrige() {
		if (nr > 0) gaaTil(TRIN[nr - 1].id);
	}

	// Datoen i et input-felt vil have YYYY-MM-DD.
	const startFelt = $derived.by(() => {
		const ms = forlob?.startDato?.toMillis?.() ?? 0;
		if (!ms) return '';
		const d = new Date(ms);
		return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
	});

	function saetStart(v: string) {
		if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return;
		void gem({ startDato: Timestamp.fromDate(new Date(`${v}T00:01:00`)) });
	}

	let udgiver = $state(false);
	let udgivFejl = $state('');

	async function udgiv() {
		if (!kanUdgives(verden)) return;
		udgiver = true;
		udgivFejl = '';
		try {
			await gemForlob(forlobId, { aktiv: true });
			forlob = forlob ? ({ ...forlob, aktiv: true } as Forlob) : forlob;
		} catch (e) {
			console.error('[guide] udgiv', e);
			udgivFejl = 'Kunne ikke udgive holdet. Prøv igen.';
		} finally {
			udgiver = false;
		}
	}

	const traeningPaa = $derived(verden.forlob ? harTraening(verden.forlob) : true);
	const huller = $derived(manglendeDage(verden));
</script>

<svelte:head><title>{forlob?.navn ?? 'Nyt forløb'} · Guide</title></svelte:head>

{#if !maaVaereHer}
	<p class="g-kun">Siden er kun for admin.</p>
{:else if henter}
	<div class="g-ramme"><AdmTom tekst="Henter holdet…" /></div>
{:else if fejl || !forlob}
	<div class="g-ramme">
		<AdmTom tekst={fejl || 'Kunne ikke hente holdet.'} fejl>
			{#snippet handling()}
				<AdmKnap onclick={() => goto('/ny/admin/forlob')}>Tilbage til holdene</AdmKnap>
			{/snippet}
		</AdmTom>
	</div>
{:else}
	<div class="g">
		<!-- LISTEN TIL VENSTRE ER SELVE PRODUKTET. De ni ting har aldrig
		     staaet nogen steder samlet, og det er derfor de bliver glemt. -->
		<nav class="g-trin">
			<div class="g-trin-h">
				<b>{forlob.navn}</b>
				<span>Trin {nr + 1} af 9 · {naaet.klar} af {naaet.ialt} på plads</span>
				<div class="g-bar"><i style="width:{Math.round((naaet.klar / naaet.ialt) * 100)}%"></i></div>
			</div>

			{#each TRIN as t (t.id)}
				{@const s = statusFor(t.id)}
				<button
					type="button"
					class="g-r"
					class:paa={paaTrin === t.id}
					class:klar={s?.status === 'klar'}
					class:ude={s?.status === 'ikke-relevant'}
					onclick={() => gaaTil(t.id)}
				>
					<span class="g-k">{s?.status === 'klar' ? '✓' : s?.status === 'ikke-relevant' ? '–' : t.nr}</span>
					<span class="g-t">
						{t.navn}
						<small>{s?.resume ?? t.under}</small>
					</span>
				</button>
			{/each}

			<a class="g-ud" href="/ny/admin/forlob/{forlobId}">Åbn holdets almindelige side</a>
		</nav>

		<div class="g-krop">
			<div class="g-hoved">
				<h1>{detTrin.navn}</h1>
				{#if gemmer === 'gemmer'}<span class="g-gem">Gemmer…</span>
				{:else if gemmer === 'gemt'}<span class="g-gem ok">Gemt</span>
				{:else if gemmer === 'fejl'}<span class="g-gem fejl">Blev ikke gemt</span>{/if}
			</div>

			{#if paaTrin === 'navn'}
				<p class="led">Navnet ser kunderne. Længden bestemmer hvor mange dage der skal have indhold.</p>

				<div class="sp">
					<div class="q">Hvad hedder holdet?</div>
					<input type="text" value={forlob.navn} onchange={(e) => gem({ navn: e.currentTarget.value.trim() })} />
					<div class="h">Skriv måneden med. Ellers kan to hold ikke skelnes fra hinanden i admin.</div>
				</div>

				<div class="sp">
					<div class="q">Hvor mange dage er forløbet?</div>
					<input
						type="number"
						min="1"
						max="365"
						value={forlob.antalDage}
						onchange={(e) => gem({ antalDage: Math.max(1, Math.min(365, Number(e.currentTarget.value) || 1)) })}
					/>
					<div class="h">
						<b>Tallet afgør hvor mange dage der skal have lektioner.</b> Gør du forløbet længere
						senere, står de nye dage tomme indtil du fylder dem.
					</div>
				</div>

				<div class="sp">
					<div class="q">Hvilken slags hold er det?</div>
					<div class="fast">{forlob.byggetForlob ? 'Bygget selv, med sin egen dataskuffe' : forlob.type === 'kropsro' ? 'Kropsro' : 'Kickstart'}</div>
					<div class="h">Slagsen kan ikke laves om. Skal den være en anden, skal holdet oprettes igen.</div>
				</div>
			{:else if paaTrin === 'start'}
				<p class="led">
					Startdatoen er dag 0, altså den dag der måles fra. Dag 1 er dagen efter. Alt andet i
					forløbet regnes ud fra den.
				</p>

				<div class="sp">
					<div class="q">Hvornår begynder holdet?</div>
					<input type="date" value={startFelt} onchange={(e) => saetStart(e.currentTarget.value)} />
					<div class="h">
						<b>Datoen er den sværeste at rette bagefter.</b> Alle kundernes dage flytter sig med,
						også dem der allerede er svaret på.
					</div>
				</div>

				{#if verden.forlob && verden.forlob.startMs && verden.forlob.startMs < Date.now()}
					<div class="note">Startdatoen er allerede passeret. Er det med vilje, er alt i orden.</div>
				{/if}
			{:else if paaTrin === 'hvem'}
				<p class="led">
					Kunderne kan lande på holdet på to måder: af sig selv når de køber, eller fordi du sætter
					dem på i hånden.
				</p>

				<div class="sp">
					<div class="q">Hvilket Simplero-produkt sælges holdet under?</div>
					<input
						type="text"
						value={forlob.simpleroProduktId ?? ''}
						placeholder="Fx 123456"
						onchange={(e) => gem({ simpleroProduktId: e.currentTarget.value.trim() || undefined })}
					/>
					<div class="h">
						Står nummeret her, <b>og</b> er holdet udgivet, lander nye køb på holdet af sig selv.
						Du sælger hvert hold under det samme produkt, så koblingen kan ikke stå i koden.
					</div>
				</div>

				{#if verden.andreAktivePaaSammeProdukt.length > 0}
					<div class="spaerre">
						<div class="t">Det her går galt</div>
						<ul>
							<li>
								{verden.andreAktivePaaSammeProdukt.join(' og ')} står på det samme nummer og er
								stadig udgivet. Nye køb lander på det hold der starter senest, og det er ikke
								nødvendigvis det her. Luk det gamle hold først.
							</li>
						</ul>
					</div>
				{/if}

				<div class="sp">
					<div class="q">Hvem er på holdet nu?</div>
					<div class="fast">{antalKunder === 0 ? 'Ingen endnu' : `${antalKunder} kunder`}</div>
					<div class="h">Du kan altid sætte enkelte kunder på i hånden, også efter holdet er åbnet.</div>
					<a class="knap" href="/ny/admin/forlob/{forlobId}">Åbn kundelisten ›</a>
				</div>
			{:else if paaTrin === 'traening'}
				<p class="led">
					<b>Det her trin er der guiden findes for.</b> Bliver det sprunget over, starter holdet
					uden træning, og der kommer ingen fejl. Forsiden siger bare "Din træning er på vej", helt
					til forløbet er slut.
				</p>

				{#if forlob.byggetForlob}
					<div class="sp">
						<div class="q">Skal holdet overhovedet have mikrotræning?</div>
						<div class="valg">
							<button type="button" class:valgt={forlob.harTraening === true} onclick={() => gem({ harTraening: true })}>Ja</button>
							<button type="button" class:valgt={forlob.harTraening !== true} onclick={() => gem({ harTraening: false })}>Nej, træning kommer som lektioner</button>
						</div>
					</div>
				{/if}

				{#if traeningPaa}
					<div class="sp">
						<div class="q">Har holdet fået tildelt programmer?</div>
						<div class="fast" class:advarsel={tildelinger === 0}>
							{tildelinger === 0 ? 'Nej, ingen tildelinger' : `${tildelinger} ${tildelinger === 1 ? 'tildeling' : 'tildelinger'} rammer holdet`}
						</div>
						<div class="h">
							<b>Det er den enkelte ting der oftest bliver glemt.</b> En tildeling gælder ét
							bestemt hold, så et nyt hold starter altid på nul. Der skal være ét program pr slags
							udstyr: har du kun kettlebell-programmet, ser en kunde uden kettlebell ingenting.
						</div>
						<a class="knap" href="/ny/admin/forlob/{forlobId}/traening">Tildel programmer ›</a>
					</div>

					<div class="sp">
						<div class="q">Hvilken dag starter træningen?</div>
						<input
							type="number"
							min="1"
							max={forlob.antalDage}
							value={forlob.traeningStartDag ?? 1}
							onchange={(e) => gem({ traeningStartDag: Math.max(1, Number(e.currentTarget.value) || 1) })}
						/>
						<div class="h">
							Kickstart starter på dag 3, fordi de to første dage handler om mad og små skridt.
							Står der 1, begynder træningen med det samme.
						</div>
					</div>
				{:else}
					<div class="note">
						Holdet har ikke mikrotræning, så der er ikke noget at tildele. Trinnet spærrer ikke for
						at udgive.
					</div>
				{/if}
			{:else if paaTrin === 'lektioner'}
				<p class="led">Lektionerne er det hun ser på forsiden hver dag. En dag uden lektioner er en tom dag.</p>

				<div class="sp">
					<div class="q">Hvor mange dage har indhold?</div>
					<div class="fast" class:advarsel={dageMedLektion.length === 0}>
						{dageMedLektion.length} af {forlob.antalDage} dage
					</div>
					{#if huller.length > 0}
						<div class="h">
							Der mangler indhold på dag {huller.slice(0, 12).join(', ')}{huller.length > 12 ? ' og flere' : ''}.
							Det er ikke nødvendigvis en fejl, men det er værd at se på.
						</div>
					{/if}
					<a class="knap" href="/ny/admin/forlob/{forlobId}/lektioner">Åbn lektionerne ›</a>
				</div>

				<div class="sp">
					<div class="q">Er der noget på dag 1?</div>
					<div class="fast" class:advarsel={!dageMedLektion.includes(1)}>
						{dageMedLektion.includes(1) ? 'Ja' : 'Nej, første dag er tom'}
					</div>
					<div class="h">
						<b>Dag 1 er den eneste dag alle ser.</b> Er den tom, tror hun appen ikke virker, og så
						skriver hun til dig.
					</div>
				</div>
			{:else if paaTrin === 'skridt'}
				<p class="led">De små skridt er det hun går i gang med. Uden dem har forsiden ikke noget at bede hende om.</p>

				<div class="sp">
					<div class="q">Hvor mange små skridt har holdet?</div>
					<div class="fast" class:advarsel={antalSkridt === 0}>
						{antalSkridt === 0 ? 'Ingen endnu' : `${antalSkridt} små skridt`}
					</div>
					<div class="h">
						Skridtene dækker både ugens skridt og de faste vaner. Kopierede du fra et tidligere
						hold, ligger de der allerede, og du retter kun det der er nyt.
					</div>
					<a class="knap" href="/ny/admin/forlob/{forlobId}/smaa-skridt">Åbn de små skridt ›</a>
				</div>
			{:else if paaTrin === 'faellesskab'}
				<p class="led">
					To ting hun spørger om i den første uge: hvornår der er Q&amp;A, og hvor de andre er
					henne.
				</p>

				<div class="sp">
					<div class="q">Står Q&amp;A-datoerne i biblioteket?</div>
					<div class="fast" class:advarsel={antalFaq === 0}>
						{antalFaq === 0 ? 'Der er ingen FAQ' : `${antalFaq} spørgsmål`}
					</div>
					<div class="h">
						<b>Linn AI svarer ud fra holdets egen FAQ.</b> Står datoerne ikke der, kan den ikke
						svare på hvornår der er Q&amp;A, og spørgsmålet lander hos dig i stedet.
					</div>
					<a class="knap" href="/ny/admin/forlob/{forlobId}/bibliotek">Åbn biblioteket ›</a>
				</div>

				<div class="sp">
					<div class="q">Har holdet en Facebook-gruppe?</div>
					<input
						type="text"
						value={forlob.facebookUrl ?? ''}
						placeholder="https://www.facebook.com/groups/…"
						onchange={(e) => gem({ facebookUrl: e.currentTarget.value.trim() || undefined })}
					/>
					<div class="h">
						<b>Linket er selv kontakten.</b> Er feltet tomt, bliver hun slet ikke spurgt om
						gruppen, og så kan et hold aldrig komme til at sende kunderne til den forkerte gruppe.
						Tilbuddet er blødt, aldrig et krav.
					</div>
				</div>
			{:else if paaTrin === 'funktioner'}
				<p class="led">Hvad holdet må se i appen.</p>

				{#if forlob.byggetForlob}
					<div class="sp">
						<div class="q">Hvilke funktioner er tændt?</div>
						<div class="h">Rettes på holdets egen side under Funktioner og adgang.</div>
						<ul class="fl">
							{#each FEATURES as ft (ft.key)}
								<li class:paa={forlob.features?.[ft.key] === true}>
									<span>{forlob.features?.[ft.key] === true ? '✓' : '–'}</span>{ft.navn}
								</li>
							{/each}
						</ul>
						<a class="knap" href="/ny/admin/forlob/{forlobId}">Ret funktionerne ›</a>
					</div>
				{:else}
					<div class="sp">
						<div class="q">Hvilke funktioner er tændt?</div>
						<div class="fast">Følger reglerne for {forlob.type === 'kropsro' ? 'Kropsro' : 'Kickstart'}</div>
						<div class="h">
							Kickstart og Kropsro har faste funktioner, så der er ikke noget at vælge her. Vil du
							bestemme hver enkelt funktion selv, skal holdet være bygget selv.
						</div>
					</div>
				{/if}

				<div class="sp">
					<div class="q">Hvor mange pausedage må hun holde?</div>
					<div class="fast">
						{forlob.nulDagePulje ?? (forlob.type === 'kropsro' ? 21 : 14)} dage
					</div>
					<div class="h">En pausedag forlænger forløbet i stedet for at æde en dag. Rettes på holdets egen side.</div>
				</div>
			{:else if paaTrin === 'udgiv'}
				{#if forlob.aktiv}
					<div class="udgivet">
						<b>Holdet er åbent.</b>
						<span>Kunderne kan se det, og nye køb på Simplero-nummeret lander her.</span>
					</div>
					<p class="led">
						Skal holdet lukkes igen, gøres det på holdets egen side. Guiden lukker aldrig et hold
						der er åbnet, for så kunne en kunde midt i sit forløb miste adgangen ved et uheld.
					</p>
				{:else}
					<p class="led">
						Sidste blik. Bliver noget af det herunder sprunget over, kommer der ingen fejl. Der
						kommer bare ingenting, og det opdages først når kunderne skriver.
					</p>

					{#if spaerret.length > 0}
						<div class="spaerre">
							<div class="t">Holdet kan ikke udgives før det her er på plads</div>
							<ul>
								{#each spaerret as s (s)}<li>{s}</li>{/each}
							</ul>
						</div>
					{:else}
						<div class="klar-boks">
							<b>Alt det der plejer at blive glemt er på plads.</b>
							<span>Der er træning tildelt, indhold på dagene, små skridt, og ingen anden åben hold på det samme Simplero-nummer.</span>
						</div>
					{/if}

					{#if noter.length > 0}
						<div class="note">
							<b>Værd at se på, men det spærrer ikke:</b>
							<ul>
								{#each noter as n (n)}<li>{n}</li>{/each}
							</ul>
						</div>
					{/if}

					{#if udgivFejl}<p class="ufejl">{udgivFejl}</p>{/if}

					<div class="udgiv-bund">
						<AdmKnap slags="primaer" disabled={spaerret.length > 0 || udgiver} onclick={udgiv}>
							{udgiver ? 'Udgiver…' : 'Udgiv holdet'}
						</AdmKnap>
						<AdmKnap onclick={() => void indlaes()}>Tjek igen</AdmKnap>
					</div>
					{#if spaerret.length > 0}
						<p class="h">
							Knappen kan ikke trykkes så længe der står noget ovenfor. Har du rettet det på en
							anden side, så tryk "Tjek igen".
						</p>
					{/if}
				{/if}
			{/if}

			<div class="gbund">
				<div class="venstre">Alt bliver gemt med det samme. Du kan lukke siden og komme tilbage.</div>
				<div class="knapper">
					{#if nr > 0}<AdmKnap onclick={forrige}>Tilbage</AdmKnap>{/if}
					{#if nr < TRIN.length - 1}
						<AdmKnap slags="primaer" onclick={naeste}>Videre til {TRIN[nr + 1].navn} ›</AdmKnap>
					{/if}
				</div>
			</div>
		</div>
	</div>
{/if}

<style>
	.g-kun {
		padding: 24px 18px;
		color: var(--ink-2);
		font-size: calc(14px * var(--fs-scale, 1));
	}

	.g-ramme {
		max-width: 900px;
		margin: 0 auto;
		padding: 22px 20px;
	}

	.g {
		display: grid;
		grid-template-columns: 260px 1fr;
		gap: 18px;
		max-width: 1100px;
		margin: 0 auto;
		padding: 22px 20px 60px;
		align-items: start;
	}

	.g-trin {
		position: sticky;
		top: 18px;
		background: var(--paper-2);
		border-radius: 18px;
		padding: 14px 12px;
	}

	.g-trin-h {
		padding: 4px 8px 12px;
	}

	.g-trin-h b {
		display: block;
		font-size: calc(14px * var(--fs-scale, 1));
		font-weight: 600;
	}

	.g-trin-h span {
		display: block;
		margin-top: 2px;
		font-size: calc(11px * var(--fs-scale, 1));
		color: var(--ink-3);
	}

	.g-bar {
		height: 5px;
		border-radius: 99px;
		background: var(--line);
		overflow: hidden;
		margin-top: 8px;
	}

	.g-bar i {
		display: block;
		height: 100%;
		background: var(--sage);
	}

	.g-r {
		display: flex;
		align-items: flex-start;
		gap: 10px;
		width: 100%;
		padding: 8px;
		background: transparent;
		border: none;
		border-radius: 11px;
		text-align: left;
		font-family: inherit;
		color: inherit;
		cursor: pointer;
	}

	.g-r.paa {
		background: var(--paper);
	}

	.g-k {
		width: 22px;
		height: 22px;
		flex-shrink: 0;
		display: grid;
		place-items: center;
		background: var(--line);
		border-radius: 99px;
		font-size: calc(11px * var(--fs-scale, 1));
		font-weight: 700;
		color: var(--ink-2);
	}

	.g-r.klar .g-k {
		background: var(--sage);
		color: #fff;
	}

	.g-r.ude .g-k {
		color: var(--ink-3);
	}

	.g-t {
		min-width: 0;
		font-size: calc(13px * var(--fs-scale, 1));
		font-weight: 600;
	}

	.g-t small {
		display: block;
		margin-top: 1px;
		font-size: calc(10.5px * var(--fs-scale, 1));
		font-weight: 400;
		color: var(--ink-3);
		line-height: 1.4;
	}

	.g-ud {
		display: block;
		margin-top: 10px;
		padding: 8px;
		font-size: calc(11.5px * var(--fs-scale, 1));
		color: var(--plum);
		text-decoration: none;
	}

	.g-krop {
		min-width: 0;
	}

	.g-hoved {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 12px;
	}

	.g-hoved h1 {
		margin: 0 0 4px;
		font-size: calc(25px * var(--fs-scale, 1));
		font-weight: 600;
		letter-spacing: -0.02em;
	}

	.g-gem {
		font-size: calc(11.5px * var(--fs-scale, 1));
		color: var(--ink-3);
	}

	.g-gem.ok {
		color: var(--sage-tekst);
	}

	.g-gem.fejl {
		color: var(--ler-tekst);
	}

	.led {
		margin: 0 0 16px;
		font-size: calc(13.5px * var(--fs-scale, 1));
		color: var(--ink-2);
		line-height: 1.6;
	}

	.sp {
		padding: 15px 17px;
		background: var(--paper-2);
		border-radius: 16px;
		margin-bottom: 11px;
	}

	.q {
		font-size: calc(14.5px * var(--fs-scale, 1));
		font-weight: 600;
		margin-bottom: 8px;
	}

	.h {
		margin-top: 8px;
		font-size: calc(12px * var(--fs-scale, 1));
		color: var(--ink-3);
		line-height: 1.55;
	}

	.h b {
		color: var(--ink-2);
	}

	.fast {
		display: inline-block;
		padding: 7px 14px;
		background: var(--paper);
		border-radius: 99px;
		font-size: calc(13px * var(--fs-scale, 1));
	}

	.fast.advarsel {
		background: var(--ler-tint);
		color: var(--ler-tekst);
		font-weight: 600;
	}

	input[type='text'],
	input[type='number'],
	input[type='date'] {
		width: 100%;
		max-width: 420px;
		padding: 10px 13px;
		background: var(--paper, #fbf8f2);
		border: 1px solid var(--line, #e8dfd1);
		border-radius: 11px;
		color: var(--espresso, #382c2a);
		font-size: calc(14px * var(--fs-scale, 1));
		font-family: inherit;
		box-sizing: border-box;
	}

	.valg {
		display: flex;
		gap: 6px;
		flex-wrap: wrap;
	}

	.valg button {
		padding: 8px 15px;
		background: var(--paper, #fbf8f2);
		border: 1px solid var(--line, #e8dfd1);
		border-radius: 99px;
		color: var(--ink-2);
		font-size: calc(12.5px * var(--fs-scale, 1));
		font-family: inherit;
		font-weight: 600;
		cursor: pointer;
	}

	.valg button.valgt {
		background: var(--plum);
		border-color: var(--plum);
		color: #fff;
	}

	.knap {
		display: inline-block;
		margin-top: 10px;
		padding: 9px 16px;
		background: var(--paper, #fbf8f2);
		border: 1px solid var(--line, #e8dfd1);
		border-radius: 99px;
		color: var(--espresso, #382c2a);
		font-size: calc(12.5px * var(--fs-scale, 1));
		font-weight: 600;
		text-decoration: none;
	}

	.fl {
		list-style: none;
		margin: 8px 0 0;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
		gap: 3px;
	}

	.fl li {
		font-size: calc(12.5px * var(--fs-scale, 1));
		color: var(--ink-3);
	}

	.fl li.paa {
		color: var(--espresso);
	}

	.fl li span {
		display: inline-block;
		width: 16px;
		color: var(--sage-tekst);
	}

	/* SPAERRINGEN SKAL VAERE DEN TUNGESTE FLADE PAA SIDEN. Den er det
	   eneste der staar mellem et hold og en daarlig foerste dag. */
	.spaerre {
		padding: 15px 18px;
		background: var(--ler-tint);
		border-radius: 16px;
		margin-bottom: 12px;
	}

	.spaerre .t {
		font-size: calc(13.5px * var(--fs-scale, 1));
		font-weight: 700;
		color: var(--ler-tekst);
		margin-bottom: 6px;
	}

	.spaerre ul,
	.note ul {
		margin: 0;
		padding-left: 18px;
	}

	.spaerre li,
	.note li {
		font-size: calc(12.5px * var(--fs-scale, 1));
		line-height: 1.6;
		color: var(--ink-2);
	}

	.note {
		padding: 13px 16px;
		background: var(--honey-tint);
		border-radius: 14px;
		margin-bottom: 12px;
		font-size: calc(12.5px * var(--fs-scale, 1));
		line-height: 1.6;
		color: var(--ink-2);
	}

	.note b {
		display: block;
		margin-bottom: 4px;
		color: var(--honey-deep);
	}

	.klar-boks,
	.udgivet {
		padding: 15px 18px;
		background: var(--sage-tint);
		border-radius: 16px;
		margin-bottom: 12px;
	}

	.klar-boks b,
	.udgivet b {
		display: block;
		font-size: calc(14px * var(--fs-scale, 1));
		color: var(--sage-tekst);
	}

	.klar-boks span,
	.udgivet span {
		display: block;
		margin-top: 3px;
		font-size: calc(12.5px * var(--fs-scale, 1));
		color: var(--ink-2);
		line-height: 1.55;
	}

	.ufejl {
		margin: 10px 0;
		font-size: calc(12.5px * var(--fs-scale, 1));
		color: var(--ler-tekst);
	}

	.udgiv-bund {
		display: flex;
		gap: 9px;
		flex-wrap: wrap;
		margin-top: 14px;
	}

	.gbund {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 14px;
		flex-wrap: wrap;
		margin-top: 20px;
		padding-top: 15px;
		border-top: 1px solid var(--line);
	}

	.venstre {
		font-size: calc(11.5px * var(--fs-scale, 1));
		color: var(--ink-3);
	}

	.knapper {
		display: flex;
		gap: 9px;
	}

	@media (max-width: 820px) {
		.g {
			grid-template-columns: 1fr;
			padding: 16px 15px 44px;
		}

		/* Paa en telefon maa listen ikke tage hele skaermen foer man kan
		   se spoergsmaalet. Den ruller med i stedet for at klaebe. */
		.g-trin {
			position: static;
		}
	}
</style>
