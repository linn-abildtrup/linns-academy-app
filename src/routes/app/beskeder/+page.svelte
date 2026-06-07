<script lang="ts">
	import { getContext, onMount } from 'svelte';
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

	const getUser = getContext<() => User | null>('user');
	const getUserDoc = getContext<() => UserDoc | null>('userDoc');
	const user = $derived(getUser());
	const userDoc = $derived(getUserDoc());
	const userState = $derived(effektivState(userDoc));

	// Forløbskontekst — fastfryses på spørgsmål når brugeren sender, så
	// admin kan filtrere pr forløb selv hvis kunden senere flytter.
	let aktivtForlobId = $state<string | null>(null);
	let aktivtForlobNavn = $state<string | null>(null);

	onMount(async () => {
		const u = user;
		if (!u) return;
		try {
			const produktType = await hentAktivProduktType(userDoc?.forlobIds ?? []);
			const up = await hentUserProduct(u.uid, produktType);
			const adminForlobId = userDoc?.adminKlientForlobId ?? null;
			const forlobId =
				(up as UserProduct & { forlobId?: string } | null)?.forlobId ?? adminForlobId;
			if (!forlobId) return;
			aktivtForlobId = forlobId;
			const f = await hentForlob(forlobId);
			aktivtForlobNavn = f?.navn ?? null;
		} catch (e) {
			console.warn('Kunne ikke hente forløbskontekst:', e);
		}
	});

	let tekst = $state('');
	let gemmer = $state(false);
	let kvittering = $state(false);
	let fejl = $state<string | null>(null);
	let mine = $state<KlientSpoergsmaal[]>([]);

	const tegnAntal = $derived(tekst.length);
	const kanSende = $derived(tekst.trim().length > 0 && !gemmer && !!user);

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
			// Just-in-time fallback: hvis onMount endnu ikke har sat forlobId
			// (race condition naar klienten skriver hurtigt), saa hent den nu.
			// Bug 7/6 2026: 55 sporgsmaal fra Kickstart juni-kunder var gemt
			// uden forlobId fordi send blev kaldt foer onMount var faerdig.
			if (!aktivtForlobId && (userDoc?.forlobIds?.length ?? 0) > 0) {
				try {
					const produktType = await hentAktivProduktType(userDoc?.forlobIds ?? []);
					const up = await hentUserProduct(user.uid, produktType);
					const fId =
						(up as UserProduct & { forlobId?: string } | null)?.forlobId ??
						userDoc?.adminKlientForlobId ??
						null;
					if (fId) {
						aktivtForlobId = fId;
						const f = await hentForlob(fId);
						aktivtForlobNavn = f?.navn ?? null;
					}
				} catch (e) {
					console.warn('Kunne ikke hente forløbskontekst ved send:', e);
				}
			}

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

	$effect(() => {
		if (user) void genindlaesMine();
	});
</script>

<div class="page">
	<header class="page-header">
		<div class="eyebrow">Beskeder</div>
		<h1>Stil et <em>spørgsmål</em></h1>
	</header>

	<section class="card">
		<p class="intro">
			Skriv dit spørgsmål til Linn. Hun læser alle spørgsmål og bruger dem til at skabe videoer, live
			og kommende indhold. Du får ikke nødvendigvis et personligt svar, men du er med til at forme
			hvad der bliver lavet.
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
			{gemmer ? 'Sender...' : 'Send spørgsmål'}
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
