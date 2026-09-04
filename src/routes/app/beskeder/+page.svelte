<script lang="ts">
	import { getContext, tick } from 'svelte';
	import type { User } from 'firebase/auth';
	import type { UserDoc } from '$lib/types';
	import Icon from '$lib/components/Icon.svelte';
	import SideInfoKnap from '$lib/components/SideInfoKnap.svelte';
	import BekraeftModal from '$lib/components/BekraeftModal.svelte';
	import { gemMedVentetid } from '$lib/content/gemVentetid';
	import { meldSkrivningIGang } from '$lib/state/forbindelseState.svelte';
	import {
		gemSpoergsmaal,
		hentMineSpoergsmaal,
		markerSpoergsmaalLaest,
		SPOERGSMAAL_MAX_LAENGDE,
		type KlientSpoergsmaal
	} from '$lib/firestore/spoergsmaal';
	import { hentUserProduct } from '$lib/firestore/mikrotraening';
	import { hentAktivProduktType, hentForlob } from '$lib/firestore/forlob';
	import type { UserProduct } from '$lib/content/mikrotraening';
	import { effektivState } from '$lib/utils/userAdgang';
	import { harFeatureAdgang, type FeatureMatrix } from '$lib/content/features';
	import { hentSamtaler, hentSamtale, opretSamtale, tilfojBeskeder } from '$lib/firestore/linnAi';
	import { udenFormateringstegn, type AiBesked, type AiSamtale } from '$lib/content/linnAi';
	import { Timestamp } from 'firebase/firestore';

	const getUser = getContext<() => User | null>('user');
	const getUserDoc = getContext<() => UserDoc | null>('userDoc');
	const getFeatureMatrix = getContext<() => FeatureMatrix | null>('featureMatrix');
	const user = $derived(getUser());
	const userDoc = $derived(getUserDoc());
	const userState = $derived(effektivState(userDoc));
	const harLinnAi = $derived(harFeatureAdgang(userDoc, getFeatureMatrix?.() ?? null, 'linn-ai'));
	// Skriv-direkte-til-Linn styres af egen feature. Fx fleksible forløb (SommerRo)
	// har kun Linn AI, ikke skriv-til-Linn.
	const harBeskederTilLinn = $derived(
		harFeatureAdgang(userDoc, getFeatureMatrix?.() ?? null, 'beskeder-til-linn')
	);

	// Aktiv fane (kun relevant naar harLinnAi). Linn AI er default — saa den er
	// foerste stop — men kunden kan frit skifte til at skrive direkte til Linn.
	let aktivFane = $state<'ai' | 'linn'>('ai');

	// Forløbskontekst — fastfryses på spørgsmål når brugeren sender, så
	// admin kan filtrere pr forløb selv hvis kunden senere flytter.
	let aktivtForlobId = $state<string | null>(null);
	let aktivtForlobNavn = $state<string | null>(null);

	// Status for forløbskontekst-hentning:
	//   'venter'  — userDoc er endnu ikke loaded fra Firestore (context tom)
	//   'henter'  — userDoc klar, vi henter forlobId fra userProducts
	//   'klar'    — forløbskunde: aktivtForlobId er sat
	//   'modul'   — modulbruger uden forløb (ingen forlobId at sætte)
	let forlobStatus = $state<'venter' | 'henter' | 'klar' | 'modul'>('venter');

	// Reaktiv hentning: koerer hver gang user eller userDoc skifter. Tidligere
	// brugte vi onMount, men da userDoc er en context-derived der starter som
	// null, kunne onMount ramle naar context endnu ikke var fyldt — saa
	// fandt vi forkert userProduct og endte uden forlobId. $effect
	// re-koerer naar userDoc bliver klar.
	$effect(() => {
		const u = user;
		const ud = userDoc;
		if (!u) return;
		if (!ud) {
			forlobStatus = 'venter';
			return;
		}
		const forlobIds = ud.forlobIds ?? [];
		if (forlobIds.length === 0) {
			forlobStatus = 'modul';
			return;
		}
		if (aktivtForlobId) {
			forlobStatus = 'klar';
			return;
		}
		forlobStatus = 'henter';
		void (async () => {
			try {
				const produktType = await hentAktivProduktType(forlobIds, u.uid);
				const up = await hentUserProduct(u.uid, produktType);
				const fId =
					(up as (UserProduct & { forlobId?: string }) | null)?.forlobId ??
					ud.adminKlientForlobId ??
					null;
				if (!fId) {
					// Forløbskunde uden klart forløbId — saet status til modul
					// saa send-knap aktiveres alligevel (kvalifikationsfelter
					// gemmes uden forlobId, hvilket admin haandterer).
					forlobStatus = 'modul';
					return;
				}
				aktivtForlobId = fId;
				const f = await hentForlob(fId);
				aktivtForlobNavn = f?.navn ?? null;
				forlobStatus = 'klar';
			} catch (e) {
				console.warn('Kunne ikke hente forløbskontekst:', e);
				forlobStatus = 'modul';
			}
		})();
	});

	let tekst = $state('');
	let gemmer = $state(false);
	let fejl = $state<string | null>(null);
	let mine = $state<KlientSpoergsmaal[]>([]);

	// Vises naar afsendelsen ikke naaede frem inden for ventetiden. Beskeden
	// ligger i koe og bliver sendt af sig selv, saa der staar BEVIDST ikke
	// 'Proev igen': et tryk mere ville sende den samme besked to gange.
	let ikkeSendtBesked = $state(false);

	// Fanen "Skriv til Linn" staar som en chat ligesom Linn AI. hentMineSpoergsmaal
	// giver nyeste foerst (den gamle liste-visning); i en chat skal aeldste staa
	// oeverst, saa vi vender den her og kun her.
	const mineKronologisk = $derived([...mine].reverse());
	let linnRulle = $state<HTMLDivElement | null>(null);

	async function rulLinnTilNyeste(bloed = true) {
		await tick();
		const el = linnRulle;
		if (!el) return;
		el.scrollTo({ top: el.scrollHeight, behavior: bloed ? 'smooth' : 'auto' });
	}

	const tegnAntal = $derived(tekst.length);
	// Send er disabled indtil forløbskontekst er afklaret (klar eller modul).
	// Beskytter mod at race condition glipper med forlobId=undefined.
	const kanSende = $derived(
		tekst.trim().length > 0 &&
			!gemmer &&
			!!user &&
			(forlobStatus === 'klar' || forlobStatus === 'modul')
	);

	async function genindlaesMine() {
		const u = user;
		if (!u) return;
		try {
			const foersteHentning = mine.length === 0;
			mine = await hentMineSpoergsmaal(u.uid);
			void markerSpoergsmaalLaest(u.uid);
			// Ved foerste visning skal hun bare staa nederst med det samme.
			if (foersteHentning && mine.length > 0) void rulLinnTilNyeste(false);
		} catch (e) {
			console.warn('Kunne ikke hente egne spørgsmål', e);
		}
	}

	async function send() {
		if (!user || !kanSende) return;
		fejl = null;
		gemmer = true;
		try {
			const email = user.email ?? userDoc?.email ?? '';
			// Uden forbindelse melder afsendelsen ALDRIG fejl, den bliver bare
			// haengende, og saa stod send-knappen laast for evigt. Se
			// gemVentetid.ts. Beskeden ligger i koe og bliver sendt af sig
			// selv, saa vi toemmer feltet og maerker den i samtalen i stedet.
			meldSkrivningIGang();
			const udfald = await gemMedVentetid(
				gemSpoergsmaal({
					uid: user.uid,
					email,
					spoergsmaal: tekst,
					forlobId: aktivtForlobId ?? undefined,
					forlobNavn: aktivtForlobNavn ?? undefined,
					kundeType: userState ?? undefined
				})
			);
			if (udfald.status === 'fejl') throw udfald.fejl;
			tekst = '';
			if (udfald.status === 'venter') ikkeSendtBesked = true;
			await genindlaesMine();
			void rulLinnTilNyeste();
		} catch (e) {
			console.error(e);
			fejl = 'Kunne ikke sende. Prøv igen om lidt.';
		} finally {
			gemmer = false;
		}
	}

	function formaterDato(t: { toDate?: () => Date } | null | undefined): string {
		if (!t || !t.toDate) return '';
		const d = t.toDate();
		return d.toLocaleDateString('da-DK', { day: 'numeric', month: 'long' });
	}

	/** "I dag", "I går" eller datoen — maerket der staar over dagens beskeder. */
	function dagMaerke(t: { toDate?: () => Date } | null | undefined): string {
		if (!t || !t.toDate) return '';
		const d = t.toDate();
		const nu = new Date();
		const dagAfstand = Math.round(
			(new Date(nu.getFullYear(), nu.getMonth(), nu.getDate()).getTime() -
				new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()) /
				86400000
		);
		if (dagAfstand === 0) return 'I dag';
		if (dagAfstand === 1) return 'I går';
		return formaterDato(t);
	}

	/** Skal der staa et dag-maerke over spoergsmaal nummer `i` i chatten. */
	function visDagMaerke(i: number): boolean {
		const naa = dagMaerke(mineKronologisk[i]?.oprettet);
		if (!naa) return false;
		if (i === 0) return true;
		return naa !== dagMaerke(mineKronologisk[i - 1]?.oprettet);
	}

	// ====== Linn AI chat (kun for kunder med adgang) ======
	// Hele korrespondancen bevares som én løbende samtale (multi-turn), saa
	// den staar naar kunden kommer tilbage — ligesom hendes spoergsmaal til Linn.
	let aiSamtale = $state<AiSamtale | null>(null);
	let aiInput = $state('');
	let aiLoader = $state(false);
	let aiFejl = $state<string | null>(null);
	let aiHentet = $state(false);
	// Index på de assistant-svar kunden allerede har sendt videre til Linn.
	let aiSendtIndex = $state<Set<number>>(new Set());

	// Linn AI vises som en almindelig chat: samtalen ruller for sig selv, og
	// skrivefeltet staar fast i bunden. Derfor skal vi selv rulle til nyeste
	// besked — baade naar samtalen hentes og hver gang der kommer et svar.
	let aiRulle = $state<HTMLDivElement | null>(null);
	// Begge faner staar som chat. Kun kunder helt uden adgang ser den gamle
	// almindelige side (kortet "Beskeder er ikke tilgaengelig").
	const visChat = $derived(harLinnAi || harBeskederTilLinn);

	async function rulTilNyeste(bloed = true) {
		await tick();
		const el = aiRulle;
		if (!el) return;
		el.scrollTo({ top: el.scrollHeight, behavior: bloed ? 'smooth' : 'auto' });
	}

	/**
	 * Ruller hen til det NYESTE svar, saa svarets foerste linje staar oeverst.
	 * Et langt svar fylder mere end skaermen, og ruller vi bare til bunden,
	 * lander hun midt i slutningen af svaret og skal selv rulle op for at
	 * laese det fra en ende af.
	 */
	async function rulTilSvarTop() {
		await tick();
		const el = aiRulle;
		if (!el) return;
		const svar = el.querySelectorAll('.ai-assistant');
		const sidste = svar[svar.length - 1] as HTMLElement | undefined;
		if (!sidste) return void rulTilNyeste();
		// 10px luft over boblen, saa den ikke klistrer til kanten.
		el.scrollTo({ top: Math.max(0, sidste.offsetTop - 10), behavior: 'smooth' });
	}

	// Hent kundens seneste Linn AI-samtale naar hun har adgang.
	$effect(() => {
		const u = user;
		if (!u || !harLinnAi || aiHentet) return;
		aiHentet = true;
		void (async () => {
			try {
				const samtaler = await hentSamtaler(u.uid);
				if (samtaler.length > 0) {
					aiSamtale = samtaler[0];
					// Uden bloed rulning ved foerste visning: hun skal bare staa
					// nederst med det samme, ikke se skaermen glide.
					void rulTilNyeste(false);
				}
			} catch (e) {
				console.warn('Kunne ikke hente Linn AI-samtale:', e);
			}
		})();
	});

	async function spoergLinnAi() {
		const u = user;
		const besked = aiInput.trim();
		if (!u || !besked || aiLoader) return;
		aiLoader = true;
		aiFejl = null;
		try {
			// Sikr en aktiv samtale (opret ved foerste spoergsmaal).
			let samtale = aiSamtale;
			if (!samtale) {
				const id = await opretSamtale(u.uid, besked.slice(0, 40));
				samtale = await hentSamtale(u.uid, id);
				if (!samtale) throw new Error('Kunne ikke oprette samtale');
				aiSamtale = samtale;
			}

			const brugerBesked: AiBesked = {
				rolle: 'user',
				indhold: besked,
				tidspunkt: Timestamp.now(),
				sikkerhed: null
			};
			// Vis bruger-besked optimistisk.
			aiSamtale = { ...samtale, beskeder: [...samtale.beskeder, brugerBesked] };
			aiInput = '';
			void rulTilNyeste();

			const idToken = await u.getIdToken();
			const historik = samtale.beskeder.map((b) => ({ rolle: b.rolle, indhold: b.indhold }));
			const res = await fetch('/api/linn-ai', {
				method: 'POST',
				headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' },
				body: JSON.stringify({ besked, samtaleHistorik: historik })
			});
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			const data = (await res.json()) as { svar: string; sikkerhed: number | null };

			const aiBesked: AiBesked = {
				rolle: 'assistant',
				indhold: data.svar,
				tidspunkt: Timestamp.now(),
				sikkerhed: data.sikkerhed ?? null
			};
			await tilfojBeskeder(u.uid, samtale.id, [brugerBesked, aiBesked]);
			aiSamtale = (await hentSamtale(u.uid, samtale.id)) ?? aiSamtale;
			void rulTilSvarTop();
		} catch (e) {
			console.error('Linn AI fejlede:', e);
			aiFejl = harBeskederTilLinn
				? 'Linn AI kunne ikke svare lige nu. Du kan sende dit spørgsmål til Linn i stedet.'
				: 'Linn AI kunne ikke svare lige nu. Prøv igen om lidt.';
			// Gen-hent for at fjerne den optimistiske (ugemte) bruger-besked.
			if (aiSamtale && u) {
				try {
					aiSamtale = (await hentSamtale(u.uid, aiSamtale.id)) ?? aiSamtale;
				} catch {
					/* behold nuvaerende */
				}
			}
		} finally {
			aiLoader = false;
		}
	}

	// Sender et bestemt AI-svar (+ det forudgaaende spoergsmaal) videre til Linn,
	// saa admin kan se baade spoergsmaalet og hvad Linn AI svarede.
	async function sendAiTilLinn(assistantIndex: number) {
		const u = user;
		const samtale = aiSamtale;
		if (!u || !samtale || aiSendtIndex.has(assistantIndex)) return;
		const svarBesked = samtale.beskeder[assistantIndex];
		const spoergsmaalBesked = samtale.beskeder[assistantIndex - 1];
		if (!svarBesked || svarBesked.rolle !== 'assistant' || !spoergsmaalBesked) return;
		try {
			const email = u.email ?? userDoc?.email ?? '';
			meldSkrivningIGang();
			const udfald = await gemMedVentetid(
				gemSpoergsmaal({
					uid: u.uid,
					email,
					spoergsmaal: spoergsmaalBesked.indhold,
					forlobId: aktivtForlobId ?? undefined,
					forlobNavn: aktivtForlobNavn ?? undefined,
					kundeType: userState ?? undefined,
					aiSvar: svarBesked.indhold
				})
			);
			if (udfald.status === 'fejl') throw udfald.fejl;
			if (udfald.status === 'venter') ikkeSendtBesked = true;
			aiSendtIndex = new Set([...aiSendtIndex, assistantIndex]);
			// Skift til "Skriv til Linn"-fanen saa kunden ser at spoergsmaalet
			// er landet i hendes korrespondance med Linn.
			aktivFane = 'linn';
			void genindlaesMine();
		} catch (e) {
			console.error(e);
			aiFejl = 'Kunne ikke sende til Linn. Prøv igen.';
		}
	}

	$effect(() => {
		if (user) void genindlaesMine();
	});
</script>

<div class="page" class:chat={visChat}>
	<header class="page-header">
		<div class="titel-rk">
			<div>
				<div class="eyebrow">Beskeder</div>
				<h1>Stil et <em>spørgsmål</em></h1>
			</div>
			<SideInfoKnap noegle="beskeder" />
		</div>
	</header>

	{#if harLinnAi && harBeskederTilLinn}
		<div class="faner" role="tablist">
			<button
				type="button"
				role="tab"
				class="fane"
				class:aktiv={aktivFane === 'ai'}
				aria-selected={aktivFane === 'ai'}
				onclick={() => (aktivFane = 'ai')}
			>
				Linn AI
			</button>
			<button
				type="button"
				role="tab"
				class="fane"
				class:aktiv={aktivFane === 'linn'}
				aria-selected={aktivFane === 'linn'}
				onclick={() => (aktivFane = 'linn')}
			>
				Skriv til Linn
			</button>
		</div>
		{#if aktivFane === 'ai'}
			{@render linnAiFane()}
		{:else}
			{@render skrivTilLinnFane()}
		{/if}
	{:else if harLinnAi}
		{@render linnAiFane()}
	{:else if harBeskederTilLinn}
		{@render skrivTilLinnFane()}
	{:else}
		<section class="card">
			<p class="intro">Beskeder er ikke tilgængelig på dit forløb.</p>
		</section>
	{/if}
</div>

{#snippet linnAiFane()}
	<!-- Linn AI staar som en almindelig chat: samtalen ruller for sig selv,
	     nyeste nederst, og skrivefeltet ligger fast over bundmenuen. Hun skal
	     aldrig rulle op for at stille naeste spoergsmaal. -->
	<section class="ai-card">
		<div class="ai-rulle" bind:this={aiRulle}>
			{#if !aiSamtale || aiSamtale.beskeder.length === 0}
				<div class="ai-velkomst">
					<div class="ai-ikon">
						<Icon name="sparkle" size={18} color="#fff" />
					</div>
					<div class="ai-titel">Spørg Linn AI</div>
					<div class="ai-sub">
						Få svar med det samme — bygget på alle de svar Linn har givet andre.{#if harBeskederTilLinn}
							Er svaret ikke godt nok, kan du sende dit spørgsmål videre til Linn.{/if}
					</div>
				</div>
			{:else}
				<div class="ai-traad">
					{#each aiSamtale.beskeder as b, i (i)}
						{#if b.rolle === 'user'}
							<div class="ai-besked ai-bruger">{b.indhold}</div>
						{:else}
							<div class="ai-besked ai-assistant">
								<div class="ai-svar-tekst">{udenFormateringstegn(b.indhold)}</div>
								{#if b.sikkerhed !== null && b.sikkerhed !== undefined}
									<div class="ai-sikkerhed" class:lav={b.sikkerhed < 60}>
										<Icon
											name={b.sikkerhed < 60 ? 'lightbulb' : 'check'}
											size={12}
											color="currentColor"
										/>
										<span>
											{b.sikkerhed}% sikker på at dette er som Linn ville svare{b.sikkerhed < 60 &&
											harBeskederTilLinn
												? ' — overvej at spørge Linn'
												: ''}
										</span>
									</div>
								{:else}
									<!-- Tallet mangler i knap hvert tiende svar, fordi modellen
									     glemmer at saette det paa. Foer stod der saa ingenting,
									     og et svar uden linje saa mere sikkert ud end et med.
									     Nu vises den forsigtige udgave uden procent. -->
									<div class="ai-sikkerhed lav">
										<Icon name="lightbulb" size={12} color="currentColor" />
										<span>
											Jeg kan ikke måle hvor tæt det her er på Linns eget svar{harBeskederTilLinn
												? ' — spørg Linn hvis det er vigtigt'
												: ''}
										</span>
									</div>
								{/if}
								{#if harBeskederTilLinn}
									{#if aiSendtIndex.has(i)}
										<div class="ai-sendt-note">Sendt til Linn ✓</div>
									{:else}
										<button
											type="button"
											class="ghost-knap ai-send-knap"
											onclick={() => sendAiTilLinn(i)}
										>
											Send til Linn i stedet
										</button>
									{/if}
								{/if}
							</div>
						{/if}
					{/each}
					{#if aiLoader}
						<div class="ai-besked ai-assistant ai-taenker">Linn AI tænker...</div>
					{/if}
				</div>
			{/if}

			{#if aiFejl}
				<div class="status fejl">{aiFejl}</div>
			{/if}
		</div>

		<div class="ai-skrivelinje">
			<textarea
				class="ai-felt"
				placeholder="Skriv dit spørgsmål..."
				rows="1"
				bind:value={aiInput}
				disabled={aiLoader}
			></textarea>
			<button
				type="button"
				class="ai-send"
				onclick={spoergLinnAi}
				disabled={aiLoader || !aiInput.trim()}
				aria-label="Spørg Linn AI"
			>
				<Icon name="sparkle" size={16} color="#fff" />
			</button>
		</div>
	</section>
{/snippet}

{#snippet skrivTilLinnFane()}
	<!-- Samme chat-form som Linn AI: aeldste oeverst, nyeste nederst, og
	     skrivefeltet fast over bundmenuen. Linns intro tager imod foerste
	     gang; derefter staar den korte linje, og hele teksten ligger bag
	     i-knappen foroven. -->
	<section class="ai-card">
		<div class="ai-rulle" bind:this={linnRulle}>
			{#if mine.length === 0}
				<div class="ai-velkomst linn-velkomst">
					<div class="ai-ikon">
						<Icon name="flower" size={18} color="#fff" />
					</div>
					<div class="ai-titel">Skriv dit spørgsmål til mig 🌸</div>
					<div class="ai-sub">
						Jeg samler løbende spørgsmålene og svarer på dem samlet — svarene finder du på forsiden
						af appen. Alle spørgsmål deles anonymt, så vi alle får glæde af dem.
					</div>
					<div class="ai-sub">
						Du skal derfor ikke forvente et personligt svar her, men dit spørgsmål skal nok blive
						taget med 🌸
					</div>
					<div class="linn-hilsen">Kh Linn</div>
				</div>
			{:else}
				<div class="linn-note">
					Jeg svarer samlet, og svarene deles anonymt på forsiden. Tryk på <strong>i</strong> foroven
					for hele forklaringen.
				</div>
				<div class="ai-traad linn-traad">
					{#each mineKronologisk as q, i (q.id)}
						{#if visDagMaerke(i)}
							<div class="linn-dag">{dagMaerke(q.oprettet)}</div>
						{/if}
						<div class="ai-besked ai-bruger">{q.spoergsmaal}</div>
						{#if q.svar}
							<div class="ai-besked ai-assistant">
								<div class="linn-fra">Svar fra Linn</div>
								<div class="ai-svar-tekst">{q.svar}</div>
							</div>
						{:else if q.ikkeSendt}
							<div class="linn-usendt">⏱ Venter på at blive sendt</div>
						{:else}
							<div class="linn-venter">Afventer svar</div>
						{/if}
					{/each}
				</div>
			{/if}

			{#if fejl}
				<div class="status fejl">{fejl}</div>
			{/if}
		</div>

		<div class="ai-skrivelinje linn-skrivelinje">
			<div class="ai-skrivrk">
				<textarea
					class="ai-felt"
					placeholder="Skriv dit spørgsmål..."
					maxlength={SPOERGSMAAL_MAX_LAENGDE}
					rows="1"
					bind:value={tekst}
					disabled={gemmer}
				></textarea>
				<button
					type="button"
					class="ai-send"
					onclick={send}
					disabled={!kanSende}
					aria-label="Send spørgsmål"
				>
					<Icon name="arrow" size={16} color="#fff" />
				</button>
			</div>
			{#if tegnAntal >= 400}
				<div class="linn-tegn">{tegnAntal} / {SPOERGSMAAL_MAX_LAENGDE} tegn</div>
			{/if}
		</div>
	</section>
{/snippet}

{#if ikkeSendtBesked}
	<BekraeftModal
		titel="Din besked er ikke sendt endnu"
		beskrivelse="Din telefon kan ikke få fat i appen lige nu. Beskeden ligger klar hos dig, og den bliver sendt af sig selv så snart du har forbindelse igen. Du behøver ikke skrive den en gang til. Den står som Venter på at blive sendt indtil Linn har fået den."
		bekraeftTekst="OK"
		onlyOk
		onBekraeft={() => (ikkeSendtBesked = false)}
	/>
{/if}

<style>
	.page {
		padding: 18px 18px 100px;
		max-width: 520px;
		margin: 0 auto;
	}

	/* Chat-tilstand: siden fylder praecis skaermen mellem toppen og
	   bundmenuen, saa det er samtalen der ruller — ikke hele siden.
	   Bundmenuen ligger uden for .page og bliver derfor staaende. */
	.page.chat {
		height: 100%;
		padding-bottom: 0;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	/* Titel og info-knap i samme raekke, saa knappen sidder samme sted paa
	   hver side. */
	.titel-rk {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 12px;
	}

	/* Uden min-width kan en lang overskrift skubbe knappen ud over kanten
	   paa en smal telefon. Med den bryder teksten i stedet. */
	.titel-rk > div {
		min-width: 0;
	}
	.page-header {
		margin-bottom: 14px;
	}

	.eyebrow {
		font-size: calc(10px * var(--fs-scale, 1));
		font-weight: 600;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--text3);
	}

	h1 {
		font-family: var(--ff-d);
		font-size: calc(26px * var(--fs-scale, 1));
		font-weight: 600;
		letter-spacing: -0.02em;
		margin: 4px 0 0;
		line-height: 1.05;
		color: var(--text);
	}

	.faner {
		display: flex;
		gap: 4px;
		background: var(--bg2);
		padding: 4px;
		border-radius: 12px;
		margin-bottom: 16px;
	}

	.fane {
		flex: 1;
		padding: 9px 12px;
		border: none;
		background: transparent;
		border-radius: 9px;
		font-family: var(--ff-b);
		font-size: calc(13.5px * var(--fs-scale, 1));
		font-weight: 500;
		color: var(--text2);
		cursor: pointer;
	}

	.fane.aktiv {
		background: var(--white);
		color: var(--text);
		font-weight: 600;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
	}

	h1 em {
		font-style: italic;
		color: var(--terra);
		font-weight: 400;
	}

	.card {
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 14px;
		padding: 16px 18px;
		display: flex;
		flex-direction: column;
		gap: 14px;
	}

	.ai-card {
		flex: 1 1 auto;
		min-height: 0;
		display: flex;
		flex-direction: column;
	}

	/* Selve rullefeltet med samtalen. min-height: 0 er det der faar den til
	   at rulle indeni i stedet for at skubbe skrivefeltet ned. */
	.ai-rulle {
		/* relative fordi rulTilSvarTop maaler boblens offsetTop mod den her. */
		position: relative;
		flex: 1 1 auto;
		min-height: 0;
		overflow-y: auto;
		-webkit-overflow-scrolling: touch;
		/* Lidt luft i hoejre side, saa boblerne ikke ligger under
		   rullebjaelken paa en computer. */
		padding: 0 6px 8px 0;
	}

	/* Tom samtale: den lille praesentation staar midt paa fladen. */
	.ai-velkomst {
		background: var(--white);
		border: 1px solid var(--terra);
		border-radius: 14px;
		padding: 18px;
		text-align: center;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 8px;
	}

	/* Skrivefeltet ligger fast i bunden, lige over bundmenuen. */
	.ai-skrivelinje {
		flex: 0 0 auto;
		display: flex;
		align-items: flex-end;
		gap: 8px;
		padding: 10px 0 12px;
		background: var(--bg);
		border-top: 1px solid var(--border);
	}

	.ai-felt {
		flex: 1 1 auto;
		min-width: 0;
		resize: none;
		max-height: 120px;
		background: var(--white);
		border: 1px solid var(--border2);
		border-radius: 18px;
		padding: 11px 14px;
		font-family: var(--ff-b);
		font-size: calc(13.5px * var(--fs-scale, 1));
		line-height: 1.5;
		color: var(--text);
	}

	.ai-felt:focus {
		outline: none;
		border-color: var(--terra);
	}

	.ai-send {
		flex: 0 0 auto;
		width: 38px;
		height: 38px;
		border: none;
		border-radius: 50%;
		background: var(--terra);
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
	}

	.ai-send:disabled {
		opacity: 0.4;
		cursor: default;
	}

	/* Skrivelinjen paa "Skriv til Linn" har en ekstra linje under sig til
	   tegn-taelleren, derfor en kolonne om selve raekken. */
	.linn-skrivelinje {
		display: flex;
		flex-direction: column;
		align-items: stretch;
		gap: 0;
	}

	.ai-skrivrk {
		display: flex;
		align-items: flex-end;
		gap: 8px;
	}

	.linn-tegn {
		font-size: calc(10.5px * var(--fs-scale, 1));
		color: var(--text3);
		text-align: right;
		padding: 4px 4px 0;
	}

	.linn-hilsen {
		font-family: var(--ff-d);
		font-style: italic;
		color: var(--terra);
		font-size: calc(14px * var(--fs-scale, 1));
	}

	.linn-note {
		background: var(--white);
		border: 1px dashed var(--border2);
		border-radius: 12px;
		padding: 10px 12px;
		font-size: calc(11.5px * var(--fs-scale, 1));
		color: var(--text2);
		line-height: 1.5;
		margin-bottom: 12px;
	}

	.linn-dag {
		align-self: center;
		font-size: calc(10px * var(--fs-scale, 1));
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--text3);
		margin: 4px 0;
	}

	.linn-fra {
		font-size: calc(10px * var(--fs-scale, 1));
		letter-spacing: 0.1em;
		text-transform: uppercase;
		font-weight: 600;
		color: var(--terra);
	}

	/* Beskeden ligger kun i telefonens lokale kopi. Den maa IKKE staa som
	   "Afventer svar", for saa gaar kunden og venter paa et svar Linn
	   aldrig har set. */
	.linn-usendt {
		align-self: flex-end;
		margin: 2px 2px 8px;
		font-size: calc(11px * var(--fs-scale, 1));
		font-weight: 600;
		color: #8a6a2e;
		background: #f6eeda;
		border-radius: 6px;
		padding: 3px 8px;
	}

	/* Ubesvaret spoergsmaal. Staar i hoejre side under boblen, saa det
	   hoerer tydeligt til det hun lige har sendt. */
	.linn-venter {
		align-self: flex-end;
		font-size: calc(11px * var(--fs-scale, 1));
		color: var(--gold);
	}

	.ai-taenker {
		color: var(--text3);
		font-size: calc(13px * var(--fs-scale, 1));
	}

	.ai-ikon {
		flex: 0 0 auto;
		margin-bottom: 2px;
		width: 34px;
		height: 34px;
		border-radius: 10px;
		background: var(--terra);
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.ai-titel {
		font-family: var(--ff-d);
		font-size: calc(16px * var(--fs-scale, 1));
		color: var(--text);
	}

	.ai-sub {
		font-size: calc(12.5px * var(--fs-scale, 1));
		color: var(--text2);
		line-height: 1.5;
		margin-top: 2px;
	}

	.ai-traad {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.ai-besked {
		padding: 10px 12px;
		border-radius: 12px;
		font-size: calc(13.5px * var(--fs-scale, 1));
		line-height: 1.55;
		white-space: pre-wrap;
	}

	.ai-bruger {
		background: var(--terra);
		color: #fff;
		align-self: flex-end;
		max-width: 85%;
		border-bottom-right-radius: 4px;
	}

	.ai-assistant {
		background: var(--bg2);
		color: var(--text);
		align-self: flex-start;
		max-width: 92%;
		border-bottom-left-radius: 4px;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.ai-svar-tekst {
		font-size: calc(13.5px * var(--fs-scale, 1));
		color: var(--text);
		line-height: 1.6;
		white-space: pre-wrap;
	}

	.ai-sikkerhed {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		align-self: flex-start;
		font-size: calc(11.5px * var(--fs-scale, 1));
		color: var(--terra);
		background: var(--bg2);
		padding: 4px 10px;
		border-radius: 99px;
	}

	.ai-sikkerhed.lav {
		color: #b8860b;
	}

	.ai-sendt-note {
		font-size: calc(11.5px * var(--fs-scale, 1));
		color: var(--text3);
		align-self: flex-start;
	}

	.ai-send-knap {
		align-self: flex-start;
		font-size: calc(12px * var(--fs-scale, 1));
		padding: 6px 12px;
	}

	.intro {
		font-size: calc(13px * var(--fs-scale, 1));
		color: var(--text2);
		margin: 0;
		line-height: 1.55;
	}









	.status {
		padding: 10px 14px;
		border-radius: 10px;
		font-size: calc(13px * var(--fs-scale, 1));
		text-align: center;
	}


	.status.fejl {
		background: #fbeeea;
		border: 1px solid #f0d6cf;
		color: #8a4a3e;
	}



	.ghost-knap {
		background: transparent;
		color: var(--text2);
		border: 1px solid var(--border);
		padding: 12px;
		border-radius: 10px;
		font-family: inherit;
		font-size: calc(13px * var(--fs-scale, 1));
		font-weight: 500;
		cursor: pointer;
	}













</style>
