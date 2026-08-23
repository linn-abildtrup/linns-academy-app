<script lang="ts">
	// ============================================================
	// "Beskeder" i 3.0. Kundens samtale med Linn AI, og de spoergsmaal
	// hun har sendt videre til Linn selv.
	//
	// Lagt sammen 16. august 2026, Linns beslutning: det er det samme i
	// hendes verden. Derfor én side med to faner, praecis som den gamle
	// app goer. Ordet Snak er droppet, /ny/snak sender hertil.
	//
	// TRE REGLER DER ER DYRE AT GENOPDAGE:
	//
	// 1. Vejen ind til Linn gaar gennem AI'en. Der findes IKKE et
	//    skrivefelt paa fanen Linn. Hun spoerger AI'en, og er hun ikke
	//    tilfreds, sender hun netop DET spoergsmaal videre.
	// 2. Adgangen kommer fra content/beskedside3.ts og IKKE fra det
	//    delte adgangs-skema. Skemaet styrer ogsaa den gamle app.
	// 3. Samtalen GEMMES. Uden det stod hendes spoergsmaal og forsvandt,
	//    mens Linns svar blev liggende, paa den samme skaerm.
	//
	// Kunden ser ALDRIG sikkerheds-procenten. Den er kun til Linn.
	// ============================================================

	import { getContext, onMount, tick } from 'svelte';
	import { page } from '$app/state';
	import type { User } from 'firebase/auth';
	import type { UserDoc } from '$lib/types';
	import type { Adgangsbillede } from '$lib/content/adgang3';
	import { gemSpoergsmaal } from '$lib/firestore/spoergsmaal';
	import {
		aabenSamtale3,
		gemUdveksling3,
		hentLinnTraade3,
		hentTidligereSamtale3,
		markerLinnSvarLaest3,
		tidligereSamtaler3,
		tilSvarKilder3,
		type LinnTraad3,
		type TidligereSamtale3
	} from '$lib/firestore/beskedside3';
	import {
		beskedAdgang3,
		beskedFaner3,
		dagLabel3,
		erSendtVidere3,
		grupperEfterDag3,
		harNytSvar3,
		kanSendeVidere3,
		startFane3,
		visFaneraekke3,
		type BeskedFane3,
		type SamtaleBesked3
	} from '$lib/content/beskedside3';
	import Ventetegn from '$lib/components/ny/Ventetegn.svelte';
	import Fluebe from '$lib/components/ny/Fluebe.svelte';
	import Sidehoved from '$lib/components/ny/Sidehoved.svelte';

	const hentUser = getContext<() => User | null>('user');
	const hentUserDoc = getContext<() => UserDoc | null>('userDoc');
	const hentAdgang = getContext<() => Adgangsbillede>('adgang');

	const user = $derived(hentUser());
	const userDoc = $derived(hentUserDoc());
	const adgangsbillede = $derived(hentAdgang());
	const aktivtForlob = $derived(adgangsbillede.aktiveForlob[0] ?? null);

	// Reglen ligger i 3.0 og koster ingen hentning. Se beskedside3.ts.
	const adgang = $derived(beskedAdgang3(!!aktivtForlob));
	const faner = $derived(beskedFaner3(adgang));
	const visFaner = $derived(visFaneraekke3(faner));

	let valgtFane = $state<BeskedFane3 | null>(null);
	const fane = $derived(valgtFane ?? startFane3(faner, page.url.searchParams.get('fane')));

	// ── Samtalen ────────────────────────────────────────────
	let samtaleId = $state<string | null>(null);
	let beskeder = $state<SamtaleBesked3[]>([]);
	let henterSamtale = $state(true);
	let input = $state('');
	let sender = $state(false);
	let fejl = $state('');
	let rulle = $state<HTMLDivElement | null>(null);

	// Tidligere samtaler. Hentes foerst naar hun trykker, for de fleste
	// har kun én og skal ikke betale for et opslag de aldrig bruger.
	let tidligere = $state<TidligereSamtale3[]>([]);
	let antalTidligere = $state(0);
	let viserTidligere = $state(false);
	let laesteSamtaleId = $state<string | null>(null);

	// ── Fanen Linn ──────────────────────────────────────────
	let traade = $state<LinnTraad3[]>([]);
	let henterTraade = $state(true);
	/** Spoergsmaal hun allerede har sendt videre. Styrer send-linjen. */
	let sendteTekster = $state<string[]>([]);
	let senderTilLinn = $state<number | null>(null);

	const senestLaest = $derived(userDoc?.senestSpoergsmaalLaestAt ?? 0);
	const nytSvar = $derived(harNytSvar3(tilSvarKilder3(traade), senestLaest));

	const nuMs = Date.now();
	const dage = $derived(grupperEfterDag3(beskeder, nuMs));

	const FORSLAG = [
		'Jeg sover dårligt for tiden',
		'Hvordan kommer jeg i gang igen?',
		'Hvad kan jeg spise, når jeg har travlt?'
	];

	onMount(() => {
		const uid = user?.uid;
		if (!uid) return;
		void indlaesSamtale(uid);
		void indlaesTraade(uid);
	});

	async function indlaesSamtale(uid: string) {
		try {
			const aaben = await aabenSamtale3(uid);
			samtaleId = aaben.id;
			beskeder = aaben.beskeder;
			antalTidligere = aaben.antalTidligere;
			await rulNed();
		} catch (e) {
			console.error('[ny] kunne ikke hente samtalen', e);
			fejl = 'Din samtale kunne ikke hentes. Du kan godt skrive alligevel.';
		} finally {
			henterSamtale = false;
		}
	}

	async function indlaesTraade(uid: string) {
		if (!adgang.linn) {
			henterTraade = false;
			return;
		}
		try {
			traade = await hentLinnTraade3(uid);
			sendteTekster = traade.map((t) => t.spoergsmaal);
		} catch (e) {
			console.error('[ny] kunne ikke hente dine spoergsmaal til Linn', e);
		} finally {
			henterTraade = false;
		}
	}

	/**
	 * Naar hun har set fanen Linn, skal "Nyt svar fra Linn" forsvinde fra
	 * forsiden. Samme felt som den gamle app bruger, saa de to flader
	 * foelges ad.
	 */
	$effect(() => {
		if (fane !== 'linn' || !nytSvar) return;
		const uid = user?.uid;
		if (!uid) return;
		void markerLinnSvarLaest3(uid).catch((e) =>
			console.error('[ny] kunne ikke markere svar som laest', e)
		);
	});

	/**
	 * Hun svarer paa en besked Linn skrev foerst.
	 *
	 * Svaret bliver et helt almindeligt spoergsmaal, og lander derfor i
	 * Linns egen liste hvor hun svarer som hun plejer. Der er ikke en ny
	 * indbakke at holde oeje med. Se HANDOVER 9.43.
	 */
	let svarTekst = $state<Record<string, string>>({});
	let svarerPaa = $state<string | null>(null);

	async function svarLinn(traadId: string) {
		const u = user;
		const tekst = (svarTekst[traadId] ?? '').trim();
		if (!u || !tekst || svarerPaa) return;
		svarerPaa = traadId;
		fejl = '';
		try {
			await gemSpoergsmaal({
				uid: u.uid,
				email: u.email ?? userDoc?.email ?? '',
				spoergsmaal: tekst,
				forlobId: aktivtForlob?.forlobId,
				forlobNavn: aktivtForlob?.navn
			});
			svarTekst = { ...svarTekst, [traadId]: '' };
			await indlaesTraade(u.uid);
		} catch (e) {
			console.error('[ny] kunne ikke svare Linn', e);
			fejl = 'Det kunne ikke sendes. Prøv igen om lidt.';
		} finally {
			svarerPaa = null;
		}
	}

	/**
	 * Rul ned til det nye svar.
	 *
	 * Kom hun fra en besked paa telefonen, staar det nye svar maaske
	 * langt nede i listen. Uden det her moeder hun toppen af en liste og
	 * skal selv lede efter det hun lige blev lovet.
	 *
	 * Kun ÉN gang: hun skal kunne rulle vaek fra det bagefter uden at
	 * skaermen hiver hende tilbage. Linns valg 23. august.
	 */
	let harRullet = $state(false);
	$effect(() => {
		if (harRullet || fane !== 'linn' || traade.length === 0) return;
		const el = document.querySelector('.traad[data-nyt="ja"]');
		if (!el) return;
		harRullet = true;
		// Foerst naar skaermen er tegnet, ellers rulles der til den forkerte
		// plads.
		requestAnimationFrame(() =>
			el.scrollIntoView({ behavior: 'smooth', block: 'center' })
		);
	});

	async function rulNed() {
		await tick();
		rulle?.scrollTo({ top: rulle.scrollHeight, behavior: 'smooth' });
	}

	async function send(tekst?: string) {
		const u = user;
		const besked = (tekst ?? input).trim();
		if (!besked || sender || !u) return;

		// Hun kan ikke skrive videre i en gammel samtale. Trykker hun send
		// mens hun kigger tilbage, hopper vi tilbage til den aabne.
		if (viserTidligere || laesteSamtaleId) lukTidligere();

		const foer = [...beskeder];
		const erFoerste = foer.length === 0;
		beskeder = [...beskeder, { rolle: 'user', indhold: besked, ms: Date.now() }];
		input = '';
		fejl = '';
		sender = true;
		await rulNed();

		try {
			const idToken = await u.getIdToken();
			const res = await fetch('/api/ny-ai', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
				body: JSON.stringify({
					tilstand: 'samtale',
					besked,
					historik: foer.map((b) => ({ rolle: b.rolle, indhold: b.indhold }))
				})
			});

			if (!res.ok) {
				const raa = await res.text();
				let melding = 'Noget gik galt. Prøv igen om lidt.';
				try {
					const p = JSON.parse(raa);
					if (p.message) melding = p.message;
				} catch {
					if (raa) melding = raa;
				}
				fejl = melding;
				beskeder = foer;
				return;
			}

			const data = (await res.json()) as { svar: string; usikker: boolean };
			beskeder = [...beskeder, { rolle: 'assistant', indhold: data.svar, ms: Date.now() }];
			await rulNed();

			// Gemmes efter at svaret staar paa skaermen. Fejler skrivningen,
			// mister hun samtalen naeste gang hun aabner siden, men hun faar
			// da sit svar nu. Det omvendte ville vaere at lade hende vente.
			if (samtaleId) {
				await gemUdveksling3(u.uid, samtaleId, besked, data.svar, erFoerste).catch((e) =>
					console.error('[ny] kunne ikke gemme samtalen', e)
				);
			}
		} catch (e) {
			console.error('[ny] beskeder fejlede', e);
			fejl = 'Der er ingen forbindelse lige nu. Prøv igen om lidt.';
			beskeder = foer;
		} finally {
			sender = false;
		}
	}

	/**
	 * Sender ét bestemt spoergsmaal og svar videre til Linn.
	 *
	 * `i` er svarets plads i samtalen. Spoergsmaalet er den naermeste
	 * bruger-besked foer det, saa hun sender netop det par hun kigger paa
	 * og ikke bare det sidste i traaden.
	 */
	async function tilLinn(i: number) {
		const u = user;
		if (!u || senderTilLinn !== null) return;
		const svar = beskeder[i];
		const spoergsmaal = [...beskeder.slice(0, i)].reverse().find((b) => b.rolle === 'user');
		if (!svar || !spoergsmaal) return;

		senderTilLinn = i;
		fejl = '';
		try {
			await gemSpoergsmaal({
				uid: u.uid,
				email: u.email ?? userDoc?.email ?? '',
				spoergsmaal: spoergsmaal.indhold,
				forlobId: aktivtForlob?.forlobId,
				forlobNavn: aktivtForlob?.navn,
				aiSvar: svar.indhold
			});
			sendteTekster = [...sendteTekster, spoergsmaal.indhold];
			await indlaesTraade(u.uid);
		} catch (e) {
			console.error('[ny] kunne ikke sende til Linn', e);
			fejl = 'Spørgsmålet kunne ikke sendes. Prøv igen om lidt.';
		} finally {
			senderTilLinn = null;
		}
	}

	async function aabnTidligere() {
		const uid = user?.uid;
		if (!uid) return;
		viserTidligere = true;
		if (tidligere.length === 0 && samtaleId) {
			try {
				tidligere = await tidligereSamtaler3(uid, samtaleId);
			} catch (e) {
				console.error('[ny] kunne ikke hente tidligere samtaler', e);
			}
		}
	}

	async function laesTidligere(id: string) {
		const uid = user?.uid;
		if (!uid) return;
		try {
			beskeder = await hentTidligereSamtale3(uid, id);
			laesteSamtaleId = id;
			viserTidligere = false;
		} catch (e) {
			console.error('[ny] kunne ikke aabne samtalen', e);
		}
	}

	function lukTidligere() {
		viserTidligere = false;
		if (laesteSamtaleId) {
			laesteSamtaleId = null;
			const uid = user?.uid;
			if (uid) void indlaesSamtale(uid);
		}
	}

	function paaTast(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			void send();
		}
	}

	/** Spoergsmaalet der hoerer til svaret paa plads `i`. */
	function spoergsmaalFor(i: number): SamtaleBesked3 | undefined {
		const b = beskeder[i];
		if (!b || b.rolle !== 'assistant') return undefined;
		return [...beskeder.slice(0, i)].reverse().find((x) => x.rolle === 'user');
	}

	/** Skal der staa en send-linje under det her svar. */
	function visSend(i: number): boolean {
		const spoergsmaal = spoergsmaalFor(i);
		if (!spoergsmaal) return false;
		return kanSendeVidere3(adgang, true, erSendtVidere3(spoergsmaal.indhold, sendteTekster));
	}

	/** Er det her svar allerede sendt videre. */
	function erSendt(i: number): boolean {
		if (!adgang.linn) return false;
		const spoergsmaal = spoergsmaalFor(i);
		if (!spoergsmaal) return false;
		return erSendtVidere3(spoergsmaal.indhold, sendteTekster);
	}

	function dato(ms: number): string {
		return ms ? dagLabel3(ms, nuMs) : '';
	}
</script>

<svelte:head><title>Beskeder</title></svelte:head>

<div class="hjaelp-side">
	<Sidehoved
		titel="Beskeder"
		under={fane === 'linn'
			? 'Det du har sendt videre til Linn, og hendes svar.'
			: 'Her kan du spørge om det der fylder. Jeg svarer ud fra Linns materialer, og jeg er ikke læge.'}
	/>

	{#if visFaner}
		<div class="besk-faner" role="tablist">
			<button
				type="button"
				role="tab"
				aria-selected={fane === 'ai'}
				class:paa={fane === 'ai'}
				onclick={() => (valgtFane = 'ai')}
			>
				Linn AI
			</button>
			<button
				type="button"
				role="tab"
				aria-selected={fane === 'linn'}
				class:paa={fane === 'linn'}
				onclick={() => (valgtFane = 'linn')}
			>
				Linn
				{#if nytSvar}<span class="besk-prik" aria-label="Nyt svar"></span>{/if}
			</button>
		</div>
	{/if}

	{#if fane === 'linn'}
		<div class="bobler">
			{#if henterTraade}
				<div class="lektion-venter">
					<Ventetegn variant="lille" />
					<span>Henter</span>
				</div>
			{:else if traade.length === 0}
				<div class="kort rolig">
					Du har ikke sendt noget til mig endnu.
					<br /><br />
					Start med at spørge Linn AI. Er du ikke tilfreds med svaret, sender du det videre herind, og
					så kigger jeg selv på det.
				</div>
			{:else}
				<div class="traade">
					{#each traade as t (t.id)}
						{@const erNy = !!t.svar && !!t.besvaretMs && t.besvaretMs > senestLaest}
						<article class="traad" class:nyt={erNy} data-nyt={erNy ? 'ja' : null}>
							{#if erNy}
								<!-- Baandet forsvinder naar hun har set det, se
								     markerLaest nedenfor. Bliver det staaende,
								     holder det op med at betyde noget. -->
								<span class="traad-baand">Nyt svar</span>
							{/if}
							<div class="traad-top">
								<span class="traad-dato">{dato(t.sendtMs)}</span>
								{#if t.fraLinn}
									<!-- Ingen status. Der er ikke noget hun venter paa. -->
								{:else if t.svar}
									<span class="traad-status svaret">Besvaret</span>
								{:else}
									<span class="traad-status venter">Venter på svar</span>
								{/if}
							</div>
							<!-- Skrev Linn foerst, er der ingen boble ovenover: kunden
							     har ikke spurgt om noget. Se HANDOVER 9.43. -->
							{#if !t.fraLinn}
								<p class="traad-spm">{t.spoergsmaal}</p>
							{/if}
							{#if t.svar}
								<div class="traad-svar">
									<span class="traad-ava" aria-hidden="true"></span>
									<div>
										<div class="traad-fra">{t.fraLinn ? 'Linn skrev til dig' : 'Linn'}</div>
										<p>{t.svar}</p>
									</div>
								</div>
							{/if}
							{#if t.fraLinn}
								<div class="traad-svarfelt">
									<input
										type="text"
										placeholder="Skriv til Linn…"
										value={svarTekst[t.id] ?? ''}
										disabled={svarerPaa === t.id}
										oninput={(e) =>
											(svarTekst = {
												...svarTekst,
												[t.id]: (e.target as HTMLInputElement).value
											})}
										onkeydown={(e) => {
											if (e.key === 'Enter') void svarLinn(t.id);
										}}
									/>
									<button
										disabled={svarerPaa === t.id || !(svarTekst[t.id] ?? '').trim()}
										onclick={() => void svarLinn(t.id)}
									>
										{svarerPaa === t.id ? 'Sender' : 'Send'}
									</button>
								</div>
							{/if}
						</article>
					{/each}
				</div>
				<p class="besk-fod">
					Vil du spørge om noget nyt, så start i Linn AI. Kan hun ikke hjælpe, sender du spørgsmålet
					videre herind.
				</p>
			{/if}
		</div>
	{:else}
		<div class="bobler" bind:this={rulle}>
			{#if viserTidligere}
				<div class="besk-tidligere-liste">
					<button class="besk-tidligere" onclick={lukTidligere}>‹ Tilbage til samtalen</button>
					{#if tidligere.length === 0}
						<p class="besk-fod">Du har ikke andre samtaler.</p>
					{:else}
						{#each tidligere as s (s.id)}
							<button class="besk-gammel" onclick={() => laesTidligere(s.id)}>
								<span class="t">{s.titel}</span>
								<span class="s">{dato(s.opdateretMs)}</span>
							</button>
						{/each}
					{/if}
				</div>
			{:else}
				{#if laesteSamtaleId}
					<button class="besk-tidligere" onclick={lukTidligere}>‹ Tilbage til samtalen</button>
				{:else if antalTidligere > 0}
					<button class="besk-tidligere" onclick={aabnTidligere}>Se tidligere samtaler</button>
				{/if}

				{#if henterSamtale}
					<div class="lektion-venter">
						<Ventetegn variant="lille" />
						<span>Henter</span>
					</div>
				{:else if beskeder.length === 0}
					<div class="forslag">
						<p class="forslag-lab">Prøv for eksempel</p>
						{#each FORSLAG as f (f)}
							<button class="forslag-knap" onclick={() => send(f)}>{f}</button>
						{/each}
					</div>
				{/if}

				{#each dage as d (d.label)}
					<div class="besk-dato"><span>{d.label}</span></div>
					{#each d.beskeder as b (beskeder.indexOf(b))}
						{@const i = beskeder.indexOf(b)}
						<div
							class="boble"
							class:hende={b.rolle === 'user'}
							class:svar={b.rolle === 'assistant'}
						>
							{b.indhold}
						</div>
						{#if erSendt(i)}
							<span class="besk-videre sendt">
								<span class="rund-fluebe" aria-hidden="true"><Fluebe /></span>
								Sendt til Linn. Du får svar inden for et døgn
							</span>
						{:else if visSend(i) && !laesteSamtaleId}
							<button class="besk-videre" disabled={senderTilLinn === i} onclick={() => tilLinn(i)}>
								{senderTilLinn === i ? 'Sender …' : 'Ikke tilfreds? Send til Linn ›'}
							</button>
						{/if}
					{/each}
				{/each}

				{#if sender}
					<div class="boble svar taenker">
						<Ventetegn variant="lille" />
						<span>Tænker</span>
					</div>
				{/if}
			{/if}

			{#if fejl}
				<p class="fejl" role="alert">{fejl}</p>
			{/if}
		</div>

		{#if !viserTidligere}
			<div class="skrivelinje">
				<textarea
					class="felt"
					bind:value={input}
					onkeydown={paaTast}
					placeholder="Skriv hvad der fylder …"
					rows="1"
					disabled={sender}
				></textarea>
				<button
					class="send"
					onclick={() => send()}
					disabled={sender || input.trim().length === 0}
					aria-label="Send"
				>
					↑
				</button>
			</div>
		{/if}
	{/if}
</div>
