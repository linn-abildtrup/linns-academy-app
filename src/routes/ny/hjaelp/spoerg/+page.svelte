<script lang="ts">
	// ============================================================
	// AI-hjaelp til appen, i den nye flade.
	//
	// Egen videnbase siden 16. august 2026: POST /api/ny-app-hjaelp.
	//
	// FOER den dato kaldte siden /api/app-hjaelp, som bygger sit svar af
	// den GAMLE apps videnbase. Spurgte en kunde hvor hun fandt sine
	// moduler, fik hun forklaret en fane der ikke findes i 3.0. Baade det
	// gamle endpoint og den gamle videnbase er UROERTE, se
	// content/appHjaelp3.ts.
	// ============================================================

	import { getContext, tick } from 'svelte';
	import type { User } from 'firebase/auth';
	import Ventetegn from '$lib/components/ny/Ventetegn.svelte';

	interface Besked {
		rolle: 'user' | 'assistant';
		indhold: string;
	}

	const hentUser = getContext<() => User | null>('user');
	const user = $derived(hentUser());

	let beskeder = $state<Besked[]>([]);
	let inputBesked = $state('');
	let sender = $state(false);
	let fejl = $state('');
	let brugtIDag = $state<number | null>(null);
	let maksIDag = $state<number | null>(null);
	let rulle = $state<HTMLDivElement | null>(null);

	const FORSLAG = [
		'Hvordan skifter jeg mine små skridt?',
		'Hvornår kommer min næste måling?',
		'Hvordan finder jeg mine opskrifter?'
	];

	async function rulTilBund() {
		await tick();
		rulle?.scrollTo({ top: rulle.scrollHeight, behavior: 'smooth' });
	}

	async function send(tekst?: string) {
		const u = user;
		const besked = (tekst ?? inputBesked).trim();
		if (!besked || sender || !u) return;

		const historikFoer = [...beskeder];
		beskeder = [...beskeder, { rolle: 'user', indhold: besked }];
		inputBesked = '';
		fejl = '';
		sender = true;
		await rulTilBund();

		try {
			const idToken = await u.getIdToken();
			const res = await fetch('/api/ny-app-hjaelp', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${idToken}`
				},
				body: JSON.stringify({ besked, samtaleHistorik: historikFoer })
			});

			if (!res.ok) {
				const raa = await res.text();
				let melding = 'Noget gik galt. Prøv igen om lidt.';
				try {
					const parsed = JSON.parse(raa);
					if (parsed.message) melding = parsed.message;
				} catch {
					if (raa) melding = raa;
				}
				fejl = melding;
				// Rul beskeden tilbage, saa historikken er hel ved naeste forsoeg.
				beskeder = historikFoer;
				return;
			}

			const data = (await res.json()) as {
				svar: string;
				brugtIDag: number;
				maksIDag: number;
			};
			beskeder = [...beskeder, { rolle: 'assistant', indhold: data.svar }];
			brugtIDag = data.brugtIDag;
			maksIDag = data.maksIDag;
			await rulTilBund();
		} catch (e) {
			console.error('[ny] app-hjaelp fejlede', e);
			fejl = 'Der er ingen forbindelse lige nu. Prøv igen om lidt.';
			beskeder = historikFoer;
		} finally {
			sender = false;
		}
	}

	function paaTast(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			void send();
		}
	}
</script>

<div class="hjaelp-side">
	<header class="side-top">
		<a class="tilbage" href="/ny/hjaelp">‹ Hjælp</a>
		<h1>Spørg om appen</h1>
		<p>
			Jeg kan svare på alt om appen. Skal du bruge Linn selv, skriver du til hende under Beskeder.
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

		{#if fejl}
			<p class="fejl" role="alert">{fejl}</p>
		{/if}
	</div>

	<div class="skrivelinje">
		<textarea
			class="felt"
			bind:value={inputBesked}
			onkeydown={paaTast}
			placeholder="Skriv dit spørgsmål …"
			rows="1"
			disabled={sender}
		></textarea>
		<button
			class="send"
			onclick={() => send()}
			disabled={sender || inputBesked.trim().length === 0}
			aria-label="Send spørgsmål"
		>
			↑
		</button>
	</div>

	{#if brugtIDag !== null && maksIDag !== null}
		<p class="kvote">{brugtIDag} af {maksIDag} spørgsmål i dag</p>
	{/if}
</div>
