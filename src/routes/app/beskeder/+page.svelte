<script lang="ts">
	import { getContext } from 'svelte';
	import type { User } from 'firebase/auth';
	import type { UserDoc } from '$lib/types';
	import Icon from '$lib/components/Icon.svelte';
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

	const getUser = getContext<() => User | null>('user');
	const getUserDoc = getContext<() => UserDoc | null>('userDoc');
	const getFeatureMatrix = getContext<() => FeatureMatrix | null>('featureMatrix');
	const user = $derived(getUser());
	const userDoc = $derived(getUserDoc());
	const userState = $derived(effektivState(userDoc));
	const harLinnAi = $derived(harFeatureAdgang(userDoc, getFeatureMatrix?.() ?? null, 'linn-ai'));

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
				const produktType = await hentAktivProduktType(forlobIds);
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
	let kvittering = $state(false);
	let fejl = $state<string | null>(null);
	let mine = $state<KlientSpoergsmaal[]>([]);

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
			mine = await hentMineSpoergsmaal(u.uid);
			void markerSpoergsmaalLaest(u.uid);
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
			await gemSpoergsmaal({
				uid: user.uid,
				email,
				spoergsmaal: tekst,
				forlobId: aktivtForlobId ?? undefined,
				forlobNavn: aktivtForlobNavn ?? undefined,
				kundeType: userState ?? undefined
			});
			tekst = '';
			kvittering = true;
			void genindlaesMine();
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

	// ====== Linn AI (kun for kunder med adgang) ======
	let aiInput = $state('');
	let aiSpurgt = $state(''); // spoergsmaalet AI'en svarede paa
	let aiSvar = $state<string | null>(null);
	let aiSikkerhed = $state<number | null>(null);
	let aiLoader = $state(false);
	let aiFejl = $state<string | null>(null);
	let aiSendt = $state(false); // sendt videre til Linn

	function nulstilAi() {
		aiInput = '';
		aiSpurgt = '';
		aiSvar = null;
		aiSikkerhed = null;
		aiFejl = null;
		aiSendt = false;
	}

	async function spoergLinnAi() {
		const u = user;
		const besked = aiInput.trim();
		if (!u || !besked || aiLoader) return;
		aiLoader = true;
		aiFejl = null;
		aiSvar = null;
		aiSikkerhed = null;
		aiSendt = false;
		try {
			const idToken = await u.getIdToken();
			const res = await fetch('/api/linn-ai', {
				method: 'POST',
				headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' },
				body: JSON.stringify({ besked })
			});
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			const data = (await res.json()) as { svar: string; sikkerhed: number | null };
			aiSpurgt = besked;
			aiSvar = data.svar;
			aiSikkerhed = data.sikkerhed ?? null;
		} catch (e) {
			console.error('Linn AI fejlede:', e);
			aiFejl = 'Linn AI kunne ikke svare lige nu. Du kan sende dit spørgsmål til Linn i stedet.';
		} finally {
			aiLoader = false;
		}
	}

	// Sender det AI-besvarede spoergsmaal videre til Linn MED AI-svaret, saa
	// admin kan se hvad Linn AI svarede kunden.
	async function sendAiTilLinn() {
		const u = user;
		if (!u || !aiSpurgt || aiSendt) return;
		try {
			const email = u.email ?? userDoc?.email ?? '';
			await gemSpoergsmaal({
				uid: u.uid,
				email,
				spoergsmaal: aiSpurgt,
				forlobId: aktivtForlobId ?? undefined,
				forlobNavn: aktivtForlobNavn ?? undefined,
				kundeType: userState ?? undefined,
				aiSvar: aiSvar ?? undefined
			});
			aiSendt = true;
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

<div class="page">
	<header class="page-header">
		<div class="eyebrow">Beskeder</div>
		<h1>Stil et <em>spørgsmål</em></h1>
	</header>

	{#if harLinnAi}
		<section class="ai-card">
			<div class="ai-header">
				<div class="ai-ikon">
					<Icon name="sparkle" size={18} color="#fff" />
				</div>
				<div>
					<div class="ai-titel">Spørg Linn AI</div>
					<div class="ai-sub">
						Få svar med det samme — bygget på alle de svar Linn har givet andre. Er svaret ikke godt
						nok, kan du sende dit spørgsmål videre til Linn.
					</div>
				</div>
			</div>

			{#if !aiSvar}
				<label class="felt">
					<textarea
						class="felt-input"
						placeholder="Skriv dit spørgsmål til Linn AI..."
						rows="4"
						bind:value={aiInput}
						disabled={aiLoader}
					></textarea>
				</label>
				<button
					type="button"
					class="primary-knap"
					onclick={spoergLinnAi}
					disabled={aiLoader || !aiInput.trim()}
				>
					{aiLoader ? 'Linn AI tænker...' : 'Spørg Linn AI'}
				</button>
			{:else}
				<div class="ai-svar">
					<div class="ai-spurgt">Du spurgte: {aiSpurgt}</div>
					<div class="ai-svar-tekst">{aiSvar}</div>
					{#if aiSikkerhed !== null}
						<div class="ai-sikkerhed" class:lav={aiSikkerhed < 60}>
							<Icon
								name={aiSikkerhed < 60 ? 'lightbulb' : 'check'}
								size={12}
								color="currentColor"
							/>
							<span>
								{aiSikkerhed}% sikker på at dette er som Linn ville svare{aiSikkerhed < 60
									? ' — overvej at spørge Linn'
									: ''}
							</span>
						</div>
					{/if}
				</div>

				{#if aiSendt}
					<div class="status ok">Sendt til Linn — hun ser også hvad Linn AI svarede dig.</div>
					<button type="button" class="ghost-knap" onclick={nulstilAi}>
						Stil et nyt spørgsmål
					</button>
				{:else}
					<div class="ai-handlinger">
						<button type="button" class="ghost-knap" onclick={nulstilAi}>
							Tak, det var fint
						</button>
						<button type="button" class="primary-knap" onclick={sendAiTilLinn}>
							Send til Linn i stedet
						</button>
					</div>
				{/if}
			{/if}

			{#if aiFejl}
				<div class="status fejl">{aiFejl}</div>
			{/if}
		</section>
	{/if}

	<section class="card">
		<p class="intro">
			Skriv dit spørgsmål til Linn. Hun læser alle spørgsmål og bruger dem til at skabe videoer,
			live og kommende indhold. Du får ikke nødvendigvis et personligt svar, men du er med til at
			forme hvad der bliver lavet.
		</p>

		<label class="felt">
			<span class="felt-label">Dit spørgsmål</span>
			<textarea
				class="felt-input"
				placeholder="Skriv dit spørgsmål her..."
				maxlength={SPOERGSMAAL_MAX_LAENGDE}
				rows="7"
				bind:value={tekst}
				disabled={gemmer || kvittering}
			></textarea>
			<div class="felt-meta">
				<span>{tegnAntal} / {SPOERGSMAAL_MAX_LAENGDE} tegn</span>
			</div>
		</label>

		{#if fejl}
			<div class="status fejl">{fejl}</div>
		{/if}

		{#if kvittering}
			<div class="status ok">Tak — dit spørgsmål er modtaget.</div>
		{/if}

		<button type="button" class="primary-knap" onclick={send} disabled={!kanSende}>
			{#if gemmer}
				Sender...
			{:else if forlobStatus === 'venter' || forlobStatus === 'henter'}
				Henter...
			{:else}
				Send spørgsmål
			{/if}
		</button>

		{#if kvittering}
			<button
				type="button"
				class="ghost-knap"
				onclick={() => {
					kvittering = false;
				}}
			>
				Stil et nyt spørgsmål
			</button>
		{/if}
	</section>

	{#if mine.length > 0}
		<section class="mine-section">
			<div class="mine-eyebrow">Mine spørgsmål</div>
			<div class="mine-liste">
				{#each mine as q (q.id)}
					<article class="mine-kort" class:besvaret={!!q.svar}>
						<div class="mine-meta">
							<span class="mine-dato">{formaterDato(q.oprettet)}</span>
							{#if q.svar}
								<span class="mine-pill">Besvaret</span>
							{:else}
								<span class="mine-pill mine-pill-venter">Afventer svar</span>
							{/if}
						</div>
						<div class="mine-tekst">{q.spoergsmaal}</div>
						{#if q.svar}
							<div class="mine-svar">
								<div class="mine-svar-label">Svar fra Linn</div>
								<div class="mine-svar-tekst">{q.svar}</div>
							</div>
						{/if}
					</article>
				{/each}
			</div>
		</section>
	{/if}
</div>

<style>
	.page {
		padding: 18px 18px 100px;
		max-width: 520px;
		margin: 0 auto;
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
		background: var(--white);
		border: 1px solid var(--terra);
		border-radius: 14px;
		padding: 16px 18px;
		display: flex;
		flex-direction: column;
		gap: 14px;
		margin-bottom: 16px;
	}

	.ai-header {
		display: flex;
		gap: 12px;
		align-items: flex-start;
	}

	.ai-ikon {
		flex: 0 0 auto;
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

	.ai-svar {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.ai-spurgt {
		font-size: calc(12px * var(--fs-scale, 1));
		color: var(--text3);
		font-style: italic;
	}

	.ai-svar-tekst {
		font-size: calc(14px * var(--fs-scale, 1));
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

	.ai-handlinger {
		display: flex;
		gap: 10px;
		flex-wrap: wrap;
	}

	.ai-handlinger .ghost-knap,
	.ai-handlinger .primary-knap {
		flex: 1;
		min-width: 140px;
	}

	.intro {
		font-size: calc(13px * var(--fs-scale, 1));
		color: var(--text2);
		margin: 0;
		line-height: 1.55;
	}

	.felt {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.felt-label {
		font-size: calc(12px * var(--fs-scale, 1));
		font-weight: 500;
		color: var(--text2);
	}

	.felt-input {
		font-family: var(--ff-b);
		font-size: calc(16px * var(--fs-scale, 1));
		line-height: 1.5;
		padding: 12px 14px;
		border-radius: 10px;
		background: var(--bg2);
		border: 1px solid var(--border);
		color: var(--text);
		outline: none;
		resize: vertical;
		min-height: 140px;
	}

	.felt-input:focus {
		border-color: var(--terra);
	}

	.felt-meta {
		display: flex;
		justify-content: space-between;
		font-size: calc(11px * var(--fs-scale, 1));
		color: var(--text3);
	}

	.status {
		padding: 10px 14px;
		border-radius: 10px;
		font-size: calc(13px * var(--fs-scale, 1));
		text-align: center;
	}

	.status.ok {
		background: rgba(143, 168, 144, 0.18);
		border: 1px solid rgba(143, 168, 144, 0.4);
		color: var(--text);
	}

	.status.fejl {
		background: #fbeeea;
		border: 1px solid #f0d6cf;
		color: #8a4a3e;
	}

	.primary-knap {
		background: var(--terra);
		color: var(--white);
		border: none;
		padding: 14px;
		border-radius: 10px;
		font-family: inherit;
		font-size: calc(14px * var(--fs-scale, 1));
		font-weight: 600;
		cursor: pointer;
	}

	.primary-knap:disabled {
		opacity: 0.45;
		cursor: not-allowed;
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

	.mine-section {
		margin-top: 24px;
	}

	.mine-eyebrow {
		font-size: calc(10px * var(--fs-scale, 1));
		font-weight: 600;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--text3);
		margin-bottom: 10px;
	}

	.mine-liste {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.mine-kort {
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 12px;
		padding: 12px 14px;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.mine-kort.besvaret {
		border-color: var(--terra);
	}

	.mine-meta {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 8px;
	}

	.mine-dato {
		font-size: calc(11px * var(--fs-scale, 1));
		color: var(--text3);
	}

	.mine-pill {
		background: var(--terra);
		color: var(--white);
		font-size: calc(10px * var(--fs-scale, 1));
		font-weight: 600;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		padding: 2px 8px;
		border-radius: 99px;
	}

	.mine-pill-venter {
		background: var(--bg2);
		color: var(--text3);
	}

	.mine-tekst {
		font-size: calc(13px * var(--fs-scale, 1));
		color: var(--text);
		line-height: 1.5;
		white-space: pre-wrap;
	}

	.mine-svar {
		background: var(--header);
		border-left: 3px solid var(--terra);
		padding: 10px 12px;
		border-radius: 8px;
	}

	.mine-svar-label {
		font-size: calc(10px * var(--fs-scale, 1));
		font-weight: 600;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--terra);
		margin-bottom: 4px;
	}

	.mine-svar-tekst {
		font-size: calc(13px * var(--fs-scale, 1));
		color: var(--text);
		line-height: 1.5;
		white-space: pre-wrap;
	}
</style>
