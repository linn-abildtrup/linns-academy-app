<script lang="ts">
	// ============================================================
	// "Snak" i 3.0. Kundens samtale med AI'en, med Linns videnbase og
	// hendes persona bag.
	//
	// To ting adskiller den fra "Spørg om appen":
	//   her taler vi om hende, ikke om knapper
	//   er AI'en usikker, tilbyder den at sende spoergsmaalet til Linn
	//
	// Kunden ser ALDRIG sikkerheds-procenten. Den er kun til Linn.
	// ============================================================

	import { getContext, tick } from 'svelte';
	import type { User } from 'firebase/auth';
	import type { UserDoc } from '$lib/types';
	import type { Adgangsbillede } from '$lib/content/adgang3';
	import { gemSpoergsmaal } from '$lib/firestore/spoergsmaal';
	import Ventetegn from '$lib/components/ny/Ventetegn.svelte';
	import Fluebe from '$lib/components/ny/Fluebe.svelte';

	interface Besked {
		rolle: 'user' | 'assistant';
		indhold: string;
		/** Sat paa AI-svar hvor den selv var i tvivl. */
		usikker?: boolean;
	}

	const hentUser = getContext<() => User | null>('user');
	const hentUserDoc = getContext<() => UserDoc | null>('userDoc');
	const hentAdgang = getContext<() => Adgangsbillede>('adgang');

	const user = $derived(hentUser());
	const userDoc = $derived(hentUserDoc());
	const adgang = $derived(hentAdgang());
	const aktivtForlob = $derived(adgang.aktiveForlob[0] ?? null);

	let beskeder = $state<Besked[]>([]);
	let input = $state('');
	let sender = $state(false);
	let fejl = $state('');
	let rulle = $state<HTMLDivElement | null>(null);

	// Send til Linn hoerer til forloebet. Det kan ikke skaleres til alle
	// medlemmer, se SPEC-3.0.md afsnit 3.2.
	const kanSkriveTilLinn = $derived(!!aktivtForlob);
	let senderTilLinn = $state(false);
	let sendtTilLinn = $state(false);

	const FORSLAG = [
		'Jeg sover dårligt for tiden',
		'Hvordan kommer jeg i gang igen?',
		'Hvad kan jeg spise, når jeg har travlt?'
	];

	async function rulNed() {
		await tick();
		rulle?.scrollTo({ top: rulle.scrollHeight, behavior: 'smooth' });
	}

	async function send(tekst?: string) {
		const u = user;
		const besked = (tekst ?? input).trim();
		if (!besked || sender || !u) return;

		const foer = [...beskeder];
		beskeder = [...beskeder, { rolle: 'user', indhold: besked }];
		input = '';
		fejl = '';
		sender = true;
		sendtTilLinn = false;
		await rulNed();

		try {
			const idToken = await u.getIdToken();
			const res = await fetch('/api/ny-ai', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
				body: JSON.stringify({ tilstand: 'samtale', besked, historik: foer })
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
			beskeder = [...beskeder, { rolle: 'assistant', indhold: data.svar, usikker: data.usikker }];
			await rulNed();
		} catch (e) {
			console.error('[ny] snak fejlede', e);
			fejl = 'Der er ingen forbindelse lige nu. Prøv igen om lidt.';
			beskeder = foer;
		} finally {
			sender = false;
		}
	}

	/** Sender det seneste spoergsmaal videre til Linn som en rigtig besked. */
	async function tilLinn() {
		const u = user;
		if (!u || senderTilLinn) return;
		const sidsteSpoergsmaal = [...beskeder].reverse().find((b) => b.rolle === 'user');
		const sidsteSvar = [...beskeder].reverse().find((b) => b.rolle === 'assistant');
		if (!sidsteSpoergsmaal) return;

		senderTilLinn = true;
		try {
			await gemSpoergsmaal({
				uid: u.uid,
				email: u.email ?? userDoc?.email ?? '',
				spoergsmaal: sidsteSpoergsmaal.indhold,
				forlobId: aktivtForlob?.forlobId,
				forlobNavn: aktivtForlob?.navn,
				aiSvar: sidsteSvar?.indhold
			});
			sendtTilLinn = true;
		} catch (e) {
			console.error('[ny] kunne ikke sende til Linn', e);
			fejl = 'Beskeden kunne ikke sendes. Prøv igen om lidt.';
		} finally {
			senderTilLinn = false;
		}
	}

	function paaTast(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			void send();
		}
	}

	const sidsteErUsikker = $derived(
		beskeder.length > 0 && beskeder[beskeder.length - 1].usikker === true
	);
</script>

<div class="hjaelp-side">
	<header class="side-top">
		<h1>Snak</h1>
		<p>
			Her kan du spørge om det der fylder. Jeg svarer ud fra Linns materialer, og jeg er ikke
			læge.
		</p>
	</header>

	<div class="bobler" bind:this={rulle}>
		{#if beskeder.length === 0}
			<div class="forslag">
				<p class="forslag-lab">Prøv for eksempel</p>
				{#each FORSLAG as f (f)}
					<button class="forslag-knap" onclick={() => send(f)}>{f}</button>
				{/each}
			</div>
		{/if}

		{#each beskeder as b, i (i)}
			<div class="boble" class:hende={b.rolle === 'user'} class:svar={b.rolle === 'assistant'}>
				{b.indhold}
			</div>
		{/each}

		{#if sender}
			<div class="boble svar taenker">
				<Ventetegn variant="lille" />
				<span>Tænker</span>
			</div>
		{/if}

		{#if sidsteErUsikker && !sender}
			<div class="usikker">
				{#if sendtTilLinn}
					<span class="gemt">
						<span class="rund-fluebe" aria-hidden="true"><Fluebe /></span>
						Sendt til Linn
					</span>
					<p>Hun svarer dig under Beskeder, som regel inden for et døgn.</p>
				{:else}
					<p>Det her er jeg ikke helt sikker på.</p>
					{#if kanSkriveTilLinn}
						<button class="btn" disabled={senderTilLinn} onclick={tilLinn}>
							{senderTilLinn ? 'Sender …' : 'Send spørgsmålet til Linn'}
						</button>
					{:else}
						<p class="dvask">Skriv til kontakt@linnsacademy.dk, så kigger Linn på det.</p>
					{/if}
				{/if}
			</div>
		{/if}

		{#if fejl}
			<p class="fejl" role="alert">{fejl}</p>
		{/if}
	</div>

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
</div>
