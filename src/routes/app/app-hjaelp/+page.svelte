<script lang="ts">
	import { getContext, tick } from 'svelte';
	import type { User } from 'firebase/auth';
	import type { UserDoc } from '$lib/types';
	import { harPremium } from '$lib/utils/userAdgang';
	import Icon from '$lib/components/Icon.svelte';
	import Loading from '$lib/components/Loading.svelte';
	import StjerneRating from '$lib/components/StjerneRating.svelte';

	type Besked = { rolle: 'user' | 'assistant'; indhold: string };

	const getUser = getContext<() => User | null>('user');
	const getUserDoc = getContext<() => UserDoc | null>('userDoc');
	const user = $derived(getUser());
	const userDoc = $derived(getUserDoc());

	const erPremium = $derived(harPremium(userDoc));

	let beskeder = $state<Besked[]>([]);
	let inputBesked = $state('');
	let sender = $state(false);
	let fejl = $state<string | null>(null);
	let queriesIDag = $state<number | null>(null);
	let queriesMaks = $state<number | null>(null);
	let chatRef = $state<HTMLDivElement | null>(null);

	const FORSLAG = $derived.by(() => {
		const liste = [
			'Hvor finder jeg vanetrackeren?',
			'Hvordan logger jeg et måltid?',
			'Kan jeg ændre mine vaner?'
		];
		if (erPremium) {
			liste.push('Hvad kan Linn AI hjælpe mig med?');
		} else {
			liste.push('Hvordan ændrer jeg tekststørrelsen?');
		}
		return liste;
	});

	const fagligRedirectTekst = $derived.by(() => {
		if (erPremium) return 'brug Linn AI';
		return null;
	});

	async function scrollTilBund() {
		await tick();
		if (chatRef) chatRef.scrollTop = chatRef.scrollHeight;
	}

	async function send(tekst?: string) {
		const u = user;
		if (!u || sender) return;
		const besked = (tekst ?? inputBesked).trim();
		if (!besked) return;

		fejl = null;
		sender = true;

		// Tilføj brugerens besked optimistisk
		const historikFoer = [...beskeder];
		beskeder = [...beskeder, { rolle: 'user', indhold: besked }];
		inputBesked = '';
		await scrollTilBund();

		try {
			const idToken = await u.getIdToken();
			const res = await fetch('/api/app-hjaelp', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${idToken}`
				},
				body: JSON.stringify({
					besked,
					samtaleHistorik: historikFoer
				})
			});

			if (!res.ok) {
				const errBody = await res.text();
				let melding = 'Noget gik galt. Prøv igen.';
				try {
					const parsed = JSON.parse(errBody);
					if (parsed.message) melding = parsed.message;
				} catch {
					if (errBody) melding = errBody;
				}
				fejl = melding;
				// Rul brugerens besked tilbage så historikken er konsistent ved næste send
				beskeder = historikFoer;
				return;
			}

			const data = (await res.json()) as {
				svar: string;
				queriesIDag: number;
				queriesMaks: number;
			};
			beskeder = [...beskeder, { rolle: 'assistant', indhold: data.svar }];
			queriesIDag = data.queriesIDag;
			queriesMaks = data.queriesMaks;
			await scrollTilBund();
		} catch (e) {
			console.error(e);
			fejl = 'Kunne ikke kontakte App-hjælp. Tjek din forbindelse og prøv igen.';
			beskeder = historikFoer;
		} finally {
			sender = false;
		}
	}

	function handleInputKey(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			void send();
		}
	}

	function nyChat() {
		beskeder = [];
		fejl = null;
		inputBesked = '';
	}
</script>

<div class="page">
	<header class="page-header">
		<a class="back" href="/">
			<Icon name="arrow-l" size={14} color="var(--text2)" />
			<span>Forsiden</span>
		</a>
		<div class="eyebrow">Hjælp</div>
		<h1>App-hjælp</h1>
		<p class="page-sub">
			Stil spørgsmål om hvordan appen virker. Jeg svarer kun på spørgsmål om appen
			selv{#if fagligRedirectTekst} — for faglige spørgsmål om kost, træning eller
			overgangsalder, {fagligRedirectTekst}{/if}.
		</p>
	</header>

	{#if user === null}
		<Loading tekst="Henter..." kompakt />
	{:else}
		<div class="chat-wrap">
			<div class="chat" bind:this={chatRef}>
				{#if beskeder.length === 0}
					<div class="velkomst">
						<div class="velkomst-ikon" aria-hidden="true">💬</div>
						<div class="velkomst-titel">Hvad kan jeg hjælpe med?</div>
						<p class="velkomst-tekst">
							Skriv et spørgsmål nedenfor, eller prøv en af disse:
						</p>
						<div class="forslag-liste">
							{#each FORSLAG as f (f)}
								<button class="forslag-knap" type="button" onclick={() => send(f)}>
									{f}
								</button>
							{/each}
						</div>
					</div>
				{:else}
					{#each beskeder as b, i (i)}
						<div class="besked besked-{b.rolle}">
							<div class="besked-indhold">{b.indhold}</div>
						</div>
						{#if b.rolle === 'assistant' && i > 0 && user}
							{@const forrige = beskeder[i - 1]}
							{#if forrige?.rolle === 'user'}
								<div class="rating-wrap">
									<StjerneRating
										{user}
										aiType="app-hjaelp"
										sporgsmaal={forrige.indhold}
										svar={b.indhold}
									/>
								</div>
							{/if}
						{/if}
					{/each}
					{#if sender}
						<div class="besked besked-assistant">
							<div class="besked-indhold besked-loading">
								<span class="prik"></span>
								<span class="prik"></span>
								<span class="prik"></span>
							</div>
						</div>
					{/if}
				{/if}
			</div>

			{#if fejl}
				<div class="fejl">{fejl}</div>
			{/if}

			<div class="input-bar">
				<input
					class="input-felt"
					type="text"
					bind:value={inputBesked}
					placeholder="Stil et spørgsmål om appen..."
					disabled={sender}
					onkeydown={handleInputKey}
				/>
				<button
					class="send-knap"
					type="button"
					onclick={() => send()}
					disabled={sender || !inputBesked.trim()}
					aria-label="Send"
				>
					<Icon name="arrow" size={16} color="#fff" />
				</button>
			</div>

			<div class="meta-rad">
				{#if queriesIDag !== null && queriesMaks !== null}
					<span class="meta-tekst">{queriesIDag} / {queriesMaks} spørgsmål i dag</span>
				{:else}
					<span class="meta-tekst"></span>
				{/if}
				{#if beskeder.length > 0}
					<button class="ny-chat-knap" type="button" onclick={nyChat}>Start forfra</button>
				{/if}
			</div>
		</div>
	{/if}
</div>

<style>
	.page {
		padding: 18px 18px 100px;
		max-width: 640px;
		margin: 0 auto;
	}

	.page-header {
		margin-bottom: 14px;
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

	.page-sub {
		font-size: calc(13px * var(--fs-scale, 1));
		color: var(--text2);
		margin: 6px 0 0;
		line-height: 1.4;
	}

	.chat-wrap {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.chat {
		display: flex;
		flex-direction: column;
		gap: 10px;
		min-height: 320px;
		max-height: 60vh;
		overflow-y: auto;
		padding: 6px 2px;
	}

	.velkomst {
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		padding: 28px 16px 18px;
	}

	.velkomst-ikon {
		font-size: 36px;
		margin-bottom: 10px;
	}

	.velkomst-titel {
		font-family: var(--ff-d);
		font-size: calc(18px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--text);
		margin-bottom: 6px;
	}

	.velkomst-tekst {
		font-size: calc(13px * var(--fs-scale, 1));
		color: var(--text2);
		margin: 0 0 14px;
		line-height: 1.4;
	}

	.forslag-liste {
		display: flex;
		flex-direction: column;
		gap: 6px;
		width: 100%;
		max-width: 360px;
	}

	.forslag-knap {
		padding: 10px 14px;
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 10px;
		font-family: var(--ff-b);
		font-size: calc(13px * var(--fs-scale, 1));
		color: var(--text2);
		text-align: left;
		cursor: pointer;
	}

	.forslag-knap:hover {
		background: var(--bg2);
		border-color: var(--border2);
	}

	.besked {
		display: flex;
	}

	.besked-user {
		justify-content: flex-end;
	}

	.besked-assistant {
		justify-content: flex-start;
	}

	.besked-indhold {
		padding: 10px 14px;
		border-radius: 14px;
		max-width: 80%;
		white-space: pre-wrap;
		line-height: 1.45;
		font-size: calc(13.5px * var(--fs-scale, 1));
	}

	.besked-user .besked-indhold {
		background: var(--terra);
		color: #fff;
		border-bottom-right-radius: 4px;
	}

	.rating-wrap {
		max-width: 80%;
		align-self: flex-start;
		margin-top: -4px;
		padding-left: 14px;
	}

	.besked-assistant .besked-indhold {
		background: var(--white);
		border: 1px solid var(--border);
		color: var(--text);
		border-bottom-left-radius: 4px;
	}

	.besked-loading {
		display: flex;
		gap: 4px;
		padding: 14px;
	}

	.prik {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--text3);
		animation: pulse 1.2s infinite;
	}

	.prik:nth-child(2) {
		animation-delay: 0.2s;
	}

	.prik:nth-child(3) {
		animation-delay: 0.4s;
	}

	@keyframes pulse {
		0%, 60%, 100% {
			opacity: 0.3;
		}
		30% {
			opacity: 1;
		}
	}

	.fejl {
		padding: 10px 14px;
		background: #fbeeea;
		border: 1px solid #f0d6cf;
		border-radius: 10px;
		color: #8a4a3e;
		font-size: calc(12px * var(--fs-scale, 1));
		line-height: 1.4;
	}

	.input-bar {
		display: flex;
		gap: 8px;
		align-items: center;
	}

	.input-felt {
		flex: 1;
		padding: 12px 14px;
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 12px;
		font-family: var(--ff-b);
		color: var(--text);
	}

	.input-felt:focus {
		outline: 2px solid var(--terra);
		outline-offset: -2px;
	}

	.input-felt:disabled {
		opacity: 0.5;
	}

	.send-knap {
		width: 44px;
		height: 44px;
		border-radius: 50%;
		background: var(--terra);
		color: #fff;
		border: none;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		flex-shrink: 0;
	}

	.send-knap:hover:not(:disabled) {
		filter: brightness(0.95);
	}

	.send-knap:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.meta-rad {
		display: flex;
		justify-content: space-between;
		align-items: center;
		font-size: calc(11px * var(--fs-scale, 1));
		color: var(--text3);
		margin-top: 4px;
	}

	.meta-tekst {
		min-width: 0;
	}

	.ny-chat-knap {
		background: none;
		border: none;
		font-family: var(--ff-b);
		font-size: calc(11px * var(--fs-scale, 1));
		color: var(--text2);
		cursor: pointer;
		text-decoration: underline;
		padding: 0;
	}
</style>
