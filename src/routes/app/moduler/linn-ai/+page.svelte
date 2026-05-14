<script lang="ts">
	import { getContext, onMount, tick } from 'svelte';
	import type { User } from 'firebase/auth';
	import type { UserDoc } from '$lib/types';
	import { harPremium } from '$lib/utils/userAdgang';
	import {
		hentSamtaler,
		hentSamtale,
		opretSamtale,
		tilfojBeskeder,
		sletSamtale,
		opdaterSamtaleTitel
	} from '$lib/firestore/linnAi';
	import type { AiBesked, AiSamtale } from '$lib/content/linnAi';
	import { Timestamp } from 'firebase/firestore';
	import Icon from '$lib/components/Icon.svelte';
	import Loading from '$lib/components/Loading.svelte';
	import StjerneRating from '$lib/components/StjerneRating.svelte';

	const getUser = getContext<() => User | null>('user');
	const getUserDoc = getContext<() => UserDoc | null>('userDoc');
	const user = $derived(getUser());
	const userDoc = $derived(getUserDoc());
	const harAdgang = $derived(harPremium(userDoc));

	let samtaler = $state<AiSamtale[]>([]);
	let aktivSamtale = $state<AiSamtale | null>(null);
	let inputBesked = $state('');
	let sender = $state(false);
	let loading = $state(true);
	let fejl = $state<string | null>(null);
	let chatRef = $state<HTMLDivElement | null>(null);

	const beskeder = $derived(aktivSamtale?.beskeder ?? []);

	onMount(async () => {
		if (!harAdgang) {
			loading = false;
			return;
		}
		const u = user;
		if (!u) {
			loading = false;
			return;
		}
		try {
			samtaler = await hentSamtaler(u.uid);
			if (samtaler.length > 0) {
				aktivSamtale = samtaler[0];
			}
		} catch (e) {
			console.error(e);
			fejl = 'Kunne ikke hente samtaler.';
		} finally {
			loading = false;
		}
	});

	async function nySamtale() {
		const u = user;
		if (!u) return;
		try {
			const id = await opretSamtale(u.uid, 'Ny samtale');
			samtaler = await hentSamtaler(u.uid);
			aktivSamtale = (await hentSamtale(u.uid, id)) ?? null;
			inputBesked = '';
		} catch (e) {
			console.error(e);
			fejl = 'Kunne ikke oprette samtale.';
		}
	}

	async function vaelgSamtale(id: string) {
		const u = user;
		if (!u) return;
		aktivSamtale = (await hentSamtale(u.uid, id)) ?? null;
	}

	async function handleSlet(id: string) {
		const u = user;
		if (!u) return;
		if (!confirm('Slet denne samtale?')) return;
		await sletSamtale(u.uid, id);
		samtaler = await hentSamtaler(u.uid);
		if (aktivSamtale?.id === id) {
			aktivSamtale = samtaler[0] ?? null;
		}
	}

	function smartTitel(tekst: string): string {
		const enLinje = tekst.replace(/\s+/g, ' ').trim();
		const stop = enLinje.length > 50 ? enLinje.slice(0, 47).replace(/[.,!?]+$/, '') + '...' : enLinje;
		return stop || 'Ny samtale';
	}

	async function send() {
		const u = user;
		if (!u || sender) return;
		const tekst = inputBesked.trim();
		if (!tekst) return;

		sender = true;
		fejl = null;

		// Sikr at vi har en aktiv samtale — navngiv den fra første spørgsmål
		let samtale = aktivSamtale;
		const erForsteBesked = !samtale || samtale.beskeder.length === 0;
		if (!samtale) {
			const id = await opretSamtale(u.uid, smartTitel(tekst));
			samtale = await hentSamtale(u.uid, id);
			if (!samtale) {
				sender = false;
				return;
			}
			aktivSamtale = samtale;
		} else if (erForsteBesked && samtale.titel === 'Ny samtale') {
			// Bruger trykte "Ny samtale" først — opdater titel ud fra første besked
			await opdaterSamtaleTitel(u.uid, samtale.id, smartTitel(tekst));
			aktivSamtale = { ...samtale, titel: smartTitel(tekst) };
		}

		// Tilføj bruger-besked optimistisk i UI
		const brugerBesked: AiBesked = {
			rolle: 'user',
			indhold: tekst,
			tidspunkt: Timestamp.now()
		};
		aktivSamtale = {
			...samtale,
			beskeder: [...samtale.beskeder, brugerBesked]
		};
		inputBesked = '';
		await tick();
		scrollTilBund();

		try {
			const idToken = await u.getIdToken();
			const historik = samtale.beskeder.map((b) => ({
				rolle: b.rolle,
				indhold: b.indhold
			}));
			const res = await fetch('/api/linn-ai', {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${idToken}`,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ besked: tekst, samtaleHistorik: historik })
			});

			if (!res.ok) {
				const errData = await res.json().catch(() => ({}));
				throw new Error(errData.message ?? `Fejl ${res.status}`);
			}
			const data = (await res.json()) as { svar: string };

			const aiBesked: AiBesked = {
				rolle: 'assistant',
				indhold: data.svar,
				tidspunkt: Timestamp.now()
			};

			// Gem begge beskeder i Firestore
			await tilfojBeskeder(u.uid, samtale.id, [brugerBesked, aiBesked]);

			// Opdater UI med AI-svar
			aktivSamtale = (await hentSamtale(u.uid, samtale.id)) ?? aktivSamtale;
			samtaler = await hentSamtaler(u.uid);
			await tick();
			scrollTilBund();
		} catch (e) {
			console.error(e);
			fejl = e instanceof Error ? e.message : 'Kunne ikke sende besked.';
			// Rul bruger-beskeden tilbage
			if (aktivSamtale) {
				aktivSamtale = {
					...aktivSamtale,
					beskeder: aktivSamtale.beskeder.slice(0, -1)
				};
			}
			inputBesked = tekst;
		} finally {
			sender = false;
		}
	}

	function scrollTilBund() {
		if (chatRef) {
			chatRef.scrollTop = chatRef.scrollHeight;
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			send();
		}
	}
</script>

<div class="page">
	<header class="page-header">
		<a class="back" href="/app/moduler">
			<Icon name="arrow-l" size={14} color="var(--text2)" />
			<span>Moduler</span>
		</a>
		<div class="eyebrow">Premium</div>
		<h1>Linn AI</h1>
	</header>

	{#if loading}
		<Loading tekst="Henter..." />
	{:else if !harAdgang}
		<div class="status-besked">
			Linn AI er kun tilgængelig for premium-abonnenter og premium-forløb.
		</div>
	{:else}
		<div class="layout">
			{#if samtaler.length > 0}
				<aside class="samtale-liste">
					<button class="ny-knap" type="button" onclick={nySamtale}>
						<Icon name="plus" size={14} color="var(--text)" />
						<span>Ny samtale</span>
					</button>
					{#each samtaler as s (s.id)}
						<div class="samtale-rad" class:aktiv={aktivSamtale?.id === s.id}>
							<button
								class="samtale-knap"
								type="button"
								onclick={() => vaelgSamtale(s.id)}
							>
								<span class="samtale-titel">{s.titel}</span>
							</button>
							<button
								class="slet-mini"
								type="button"
								aria-label="Slet samtale"
								onclick={() => handleSlet(s.id)}
							>
								×
							</button>
						</div>
					{/each}
				</aside>
			{/if}

			<section class="chat-omraade">
				{#if aktivSamtale === null && samtaler.length === 0}
					<div class="velkomst">
						<div class="velkomst-emoji">💬</div>
						<h2>Spørg mig</h2>
						<p>Jeg kan svare på dine spørgsmål om kost, træning, overgangsalder, søvn og mental sundhed — baseret på Linns viden.</p>
						<button class="primary-knap" type="button" onclick={nySamtale}>
							Start en samtale
						</button>
					</div>
				{:else}
					<div class="beskeder" bind:this={chatRef}>
						{#each beskeder as b, i (i)}
							<div class="besked rolle-{b.rolle}">
								{#if b.rolle === 'assistant'}
									<div class="afsender">Linn AI</div>
								{/if}
								<div class="besked-indhold">{b.indhold}</div>
								{#if b.rolle === 'assistant' && i > 0 && user && aktivSamtale}
									{@const forrige = beskeder[i - 1]}
									{#if forrige?.rolle === 'user'}
										<StjerneRating
											{user}
											aiType="linn-ai"
											sporgsmaal={forrige.indhold}
											svar={b.indhold}
											samtaleId={aktivSamtale.id}
											beskedIdx={i}
										/>
									{/if}
								{/if}
							</div>
						{/each}
						{#if sender}
							<div class="besked rolle-assistant">
								<div class="afsender">Linn AI</div>
								<div class="besked-indhold tænker">tænker...</div>
							</div>
						{/if}
					</div>

					{#if fejl}
						<div class="fejl-besked">{fejl}</div>
					{/if}

					<div class="input-rad">
						<textarea
							class="input"
							placeholder="Skriv dit spørgsmål..."
							bind:value={inputBesked}
							onkeydown={handleKeydown}
							disabled={sender}
							rows="2"
						></textarea>
						<button
							class="send-knap"
							type="button"
							onclick={send}
							disabled={sender || !inputBesked.trim()}
							aria-label="Send"
						>
							<Icon name="arrow" size={16} color="#fff" />
						</button>
					</div>
					<div class="disclaimer">
						Linn AI er en AI-assistent inspireret af Linns viden. Ved sygdomme, symptomer eller medicin: kontakt din læge.
					</div>
				{/if}
			</section>
		</div>
	{/if}
</div>

<style>
	.page {
		padding: 18px 18px 100px;
		max-width: 720px;
		margin: 0 auto;
	}

	.page-header {
		margin-bottom: 18px;
	}

	.back {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-size: calc(12px * var(--fs-scale, 1));
		color: var(--text2);
		text-decoration: none;
		margin-bottom: 12px;
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
		font-size: calc(28px * var(--fs-scale, 1));
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
		font-size: calc(13px * var(--fs-scale, 1));
		text-align: center;
	}

	.layout {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.samtale-liste {
		display: flex;
		gap: 6px;
		overflow-x: auto;
		padding-bottom: 4px;
	}

	.ny-knap {
		flex-shrink: 0;
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 8px 12px;
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 99px;
		font-size: calc(12px * var(--fs-scale, 1));
		font-family: var(--ff-b);
		color: var(--text2);
		cursor: pointer;
	}

	.samtale-rad {
		flex-shrink: 0;
		display: inline-flex;
		align-items: center;
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 99px;
		max-width: 180px;
	}

	.samtale-rad.aktiv {
		background: var(--terra);
		border-color: var(--terra);
	}

	.samtale-knap {
		display: inline-flex;
		align-items: center;
		padding: 8px 4px 8px 12px;
		background: none;
		border: none;
		font-size: calc(12px * var(--fs-scale, 1));
		font-family: var(--ff-b);
		color: var(--text2);
		cursor: pointer;
		max-width: 140px;
	}

	.samtale-rad.aktiv .samtale-knap {
		color: #fff;
	}

	.samtale-titel {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.slet-mini {
		background: none;
		border: none;
		color: var(--text3);
		opacity: 0.6;
		cursor: pointer;
		font-size: 16px;
		padding: 0 10px 0 4px;
	}

	.samtale-rad.aktiv .slet-mini {
		color: #fff;
	}

	.slet-mini:hover {
		opacity: 1;
	}

	.chat-omraade {
		display: flex;
		flex-direction: column;
		gap: 10px;
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 14px;
		padding: 14px;
		min-height: 60dvh;
	}

	.velkomst {
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		gap: 10px;
		padding: 40px 20px;
	}

	.velkomst-emoji {
		font-size: 48px;
	}

	.velkomst h2 {
		font-family: var(--ff-d);
		font-size: calc(22px * var(--fs-scale, 1));
		font-weight: 600;
		margin: 0;
	}

	.velkomst p {
		font-size: calc(13px * var(--fs-scale, 1));
		color: var(--text2);
		max-width: 340px;
		line-height: 1.5;
		margin: 0;
	}

	.primary-knap {
		margin-top: 6px;
		padding: 12px 20px;
		background: var(--terra);
		color: #fff;
		border: none;
		border-radius: 99px;
		font-size: calc(13px * var(--fs-scale, 1));
		font-weight: 600;
		font-family: var(--ff-b);
		cursor: pointer;
	}

	.beskeder {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 10px;
		overflow-y: auto;
		padding-right: 4px;
		min-height: 40dvh;
		max-height: 60dvh;
	}

	.besked {
		max-width: 80%;
		padding: 10px 14px;
		border-radius: 14px;
		font-size: calc(13.5px * var(--fs-scale, 1));
		line-height: 1.5;
		white-space: pre-wrap;
	}

	.besked.rolle-user {
		align-self: flex-end;
		background: var(--terra);
		color: #fff;
		border-bottom-right-radius: 4px;
	}

	.besked.rolle-assistant {
		align-self: flex-start;
		background: var(--bg2);
		color: var(--text);
		border-bottom-left-radius: 4px;
	}

	.afsender {
		font-size: calc(10px * var(--fs-scale, 1));
		font-weight: 600;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--text3);
		margin-bottom: 4px;
	}

	.tænker {
		opacity: 0.6;
		font-style: italic;
	}

	.fejl-besked {
		padding: 8px 12px;
		background: #fbeeea;
		border: 1px solid #f0d6cf;
		color: #8a4a3e;
		border-radius: 8px;
		font-size: calc(12px * var(--fs-scale, 1));
	}

	.input-rad {
		display: flex;
		gap: 8px;
		align-items: flex-end;
	}

	.input {
		flex: 1;
		padding: 10px 12px;
		border: 1px solid var(--border);
		border-radius: 12px;
		background: var(--bg2);
		color: var(--text);
		font-family: var(--ff-b);
		font-size: max(16px, calc(14px * var(--fs-scale, 1)));
		resize: none;
		outline: none;
	}

	.input:focus {
		border-color: var(--terra);
	}

	.send-knap {
		flex-shrink: 0;
		width: 42px;
		height: 42px;
		border-radius: 50%;
		background: var(--terra);
		border: none;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.send-knap:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.disclaimer {
		font-size: calc(10.5px * var(--fs-scale, 1));
		color: var(--text4);
		text-align: center;
		line-height: 1.4;
		margin-top: -2px;
	}
</style>
