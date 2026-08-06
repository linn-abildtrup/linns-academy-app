<script lang="ts">
	// ============================================================
	// Admin: AI'en i den nye app (3.0).
	//
	// Her kan Linn laese alt hvad AI'en har sagt, og slukke for den hvis
	// den opfoerer sig daarligt. Det er hendes stemme den laaner, saa hun
	// skal kunne se med.
	//
	// NY side. Ingen eksisterende admin-side eller menu er aendret, saa
	// den naas ved at skrive adressen: /app/admin/ny-ai
	// ============================================================

	import { onMount } from 'svelte';
	import {
		hentNyAiLog,
		hentNyAiKonfiguration,
		saetNyAiSlukket,
		type NyAiLinje
	} from '$lib/firestore/nyAi';
	import Loading from '$lib/components/Loading.svelte';

	let linjer = $state<NyAiLinje[]>([]);
	let slukket = $state(false);
	let henter = $state(true);
	let gemmer = $state(false);
	let fejl = $state<string | null>(null);
	let filter = $state<'alle' | 'samtale' | 'inspirator'>('alle');

	onMount(() => void indlaes());

	async function indlaes() {
		henter = true;
		fejl = null;
		try {
			const [log, konf] = await Promise.all([hentNyAiLog(), hentNyAiKonfiguration()]);
			linjer = log;
			slukket = konf.slukket === true;
		} catch (e) {
			console.error(e);
			fejl = 'Kunne ikke hente loggen. Mangler Firestore-reglerne måske?';
		} finally {
			henter = false;
		}
	}

	async function skiftSlukket() {
		gemmer = true;
		const ny = !slukket;
		try {
			await saetNyAiSlukket(ny);
			slukket = ny;
		} catch (e) {
			console.error(e);
			fejl = 'Kunne ikke gemme. Prøv igen.';
		} finally {
			gemmer = false;
		}
	}

	const vist = $derived(linjer.filter((l) => filter === 'alle' || l.tilstand === filter));

	const antalSamtaler = $derived(linjer.filter((l) => l.tilstand === 'samtale').length);
	const antalInspirator = $derived(linjer.filter((l) => l.tilstand === 'inspirator').length);
	const antalUsikre = $derived(
		linjer.filter((l) => typeof l.sikkerhed === 'number' && l.sikkerhed < 60).length
	);

	function tid(ms: number): string {
		return new Date(ms).toLocaleString('da-DK', {
			day: 'numeric',
			month: 'short',
			hour: '2-digit',
			minute: '2-digit'
		});
	}
</script>

<div class="side">
	<header>
		<h1>AI i den nye app</h1>
		<p>
			Alt hvad AI'en har sagt til kunderne på den nye flade, nyeste først. Både samtalerne under
			Snak og de beskeder inspiratoren skriver af sig selv.
		</p>
	</header>

	<section class="kontakt" class:slukket>
		<div>
			<div class="kontakt-t">{slukket ? 'AI’en er slået fra' : 'AI’en er tændt'}</div>
			<div class="kontakt-s">
				{slukket
					? 'Kunderne får besked om at hjælpen er slået fra lige nu. Inspiratoren er også stille.'
					: 'Slå den fra, hvis den siger noget den ikke skal. Det virker med det samme.'}
			</div>
		</div>
		<button class="knap" disabled={gemmer} onclick={skiftSlukket}>
			{gemmer ? 'Gemmer …' : slukket ? 'Tænd igen' : 'Sluk for AI’en'}
		</button>
	</section>

	{#if henter}
		<Loading tekst="Henter loggen..." />
	{:else if fejl}
		<p class="fejl">{fejl}</p>
	{:else}
		<div class="tal">
			<div><b>{antalSamtaler}</b> samtaler</div>
			<div><b>{antalInspirator}</b> inspirator-beskeder</div>
			<div><b>{antalUsikre}</b> usikre svar</div>
		</div>

		<div class="filtre">
			<button class:aktiv={filter === 'alle'} onclick={() => (filter = 'alle')}>Alle</button>
			<button class:aktiv={filter === 'samtale'} onclick={() => (filter = 'samtale')}>
				Samtaler
			</button>
			<button class:aktiv={filter === 'inspirator'} onclick={() => (filter = 'inspirator')}>
				Inspirator
			</button>
		</div>

		{#if vist.length === 0}
			<p class="tom">Der er ikke sagt noget endnu.</p>
		{/if}

		<div class="liste">
			{#each vist as l (l.id)}
				<article class="linje" class:usikker={typeof l.sikkerhed === 'number' && l.sikkerhed < 60}>
					<div class="linje-top">
						<span class="maerke {l.tilstand}">
							{l.tilstand === 'samtale' ? 'Samtale' : 'Inspirator'}
						</span>
						{#if l.situation}<span class="situation">{l.situation}</span>{/if}
						{#if typeof l.sikkerhed === 'number'}
							<span class="sikkerhed">{l.sikkerhed} % sikker</span>
						{/if}
						<span class="tid">{tid(l.tidspunkt)}</span>
					</div>

					{#if l.spoergsmaal}
						<p class="spm"><b>Hun skrev:</b> {l.spoergsmaal}</p>
					{/if}
					{#if l.fakta}
						<p class="fakta">{l.fakta}</p>
					{/if}
					<p class="svar">{l.svar}</p>
					<div class="uid">{l.uid}</div>
				</article>
			{/each}
		</div>
	{/if}
</div>

<style>
	.side {
		padding: 20px 16px 60px;
		max-width: 780px;
		margin: 0 auto;
	}

	h1 {
		font-family: var(--ff-d);
		font-size: 26px;
		margin: 0 0 6px;
		color: var(--text);
	}

	header p {
		color: var(--text2);
		font-size: 14px;
		line-height: 1.5;
		margin: 0 0 20px;
	}

	.kontakt {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 14px;
		background: var(--bg2);
		border-radius: 14px;
		padding: 15px 16px;
		margin-bottom: 20px;
	}

	.kontakt.slukket {
		background: #f6e3e3;
	}

	.kontakt-t {
		font-weight: 700;
		color: var(--text);
	}

	.kontakt-s {
		font-size: 13px;
		color: var(--text2);
		margin-top: 3px;
		line-height: 1.45;
	}

	.knap {
		background: var(--terra);
		color: #fff;
		border: none;
		border-radius: 99px;
		padding: 11px 18px;
		font-size: 13px;
		font-weight: 700;
		cursor: pointer;
		white-space: nowrap;
	}

	.tal {
		display: flex;
		flex-wrap: wrap;
		gap: 18px;
		font-size: 13px;
		color: var(--text2);
		margin-bottom: 14px;
	}

	.tal b {
		color: var(--text);
		font-size: 17px;
	}

	.filtre {
		display: flex;
		gap: 8px;
		margin-bottom: 16px;
	}

	.filtre button {
		background: var(--bg2);
		border: none;
		border-radius: 99px;
		padding: 9px 15px;
		font-size: 13px;
		color: var(--text2);
		cursor: pointer;
	}

	.filtre button.aktiv {
		background: var(--terra);
		color: #fff;
		font-weight: 700;
	}

	.liste {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.linje {
		background: var(--bg2);
		border-radius: 14px;
		padding: 14px 16px;
	}

	.linje.usikker {
		box-shadow: inset 3px 0 0 #d6a15e;
	}

	.linje-top {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px;
		margin-bottom: 9px;
	}

	.maerke {
		font-size: 10px;
		font-weight: 700;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		border-radius: 99px;
		padding: 3px 9px;
		background: var(--bg);
		color: var(--text2);
	}

	.maerke.inspirator {
		background: #f7ecd7;
		color: #8a6d3b;
	}

	.situation,
	.sikkerhed {
		font-size: 11px;
		color: var(--text3);
	}

	.tid {
		margin-left: auto;
		font-size: 11px;
		color: var(--text3);
	}

	.spm,
	.svar,
	.fakta {
		margin: 0 0 8px;
		font-size: 14px;
		line-height: 1.5;
		color: var(--text);
		white-space: pre-wrap;
	}

	.fakta {
		font-size: 12px;
		color: var(--text3);
		background: var(--bg);
		border-radius: 10px;
		padding: 9px 11px;
	}

	.uid {
		font-size: 10px;
		color: var(--text3);
		font-family: monospace;
	}

	.fejl {
		background: #f6e3e3;
		border-radius: 12px;
		padding: 14px;
		color: #8a3a3a;
	}

	.tom {
		color: var(--text2);
		font-size: 14px;
	}
</style>
