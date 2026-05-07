<script lang="ts">
	import { onMount } from 'svelte';
	import {
		ALLE_KATEGORIER,
		filtrerOpskrifter,
		KATEGORI_LABELS,
		type Opskrift,
		type OpskriftKategori
	} from '$lib/content/opskrifter';
	import { hentAlleOpskrifter } from '$lib/firestore/opskrifter';
	import Icon from '$lib/components/Icon.svelte';

	let opskrifter = $state<Opskrift[]>([]);
	let loading = $state(true);
	let fejl = $state<string | null>(null);

	let soegeord = $state('');
	let valgteKategorier = $state<OpskriftKategori[]>([]);

	const filtreret = $derived(filtrerOpskrifter(opskrifter, soegeord, valgteKategorier));

	onMount(async () => {
		try {
			opskrifter = await hentAlleOpskrifter(true);
		} catch (e) {
			console.error(e);
			fejl = 'Kunne ikke hente opskrifter.';
		} finally {
			loading = false;
		}
	});

	function toggleKategori(k: OpskriftKategori) {
		if (valgteKategorier.includes(k)) {
			valgteKategorier = valgteKategorier.filter((x) => x !== k);
		} else {
			valgteKategorier = [...valgteKategorier, k];
		}
	}

	function ryd() {
		valgteKategorier = [];
		soegeord = '';
	}
</script>

<div class="page">
	<header class="page-header">
		<a class="back" href="/app/moduler/30-30-3">
			<Icon name="arrow-l" size={14} color="var(--text2)" />
			<span>30-30-3</span>
		</a>
		<div class="eyebrow">Opskrifter</div>
		<h1>Mad med protein og fiber</h1>
		<p class="page-sub">
			Linns opskrifter med protein og fiber i fokus. Tryk på en opskrift for at se ingredienser
			og fremgangsmåde.
		</p>
	</header>

	{#if loading}
		<div class="status-besked">Henter opskrifter...</div>
	{:else if fejl}
		<div class="status-besked fejl">{fejl}</div>
	{:else}
		<input
			type="search"
			class="search"
			placeholder="Søg opskrift..."
			bind:value={soegeord}
		/>

		<div class="chips">
			{#each ALLE_KATEGORIER as k (k)}
				<button
					type="button"
					class="chip"
					class:aktiv={valgteKategorier.includes(k)}
					onclick={() => toggleKategori(k)}
				>
					{KATEGORI_LABELS[k]}
				</button>
			{/each}
			{#if valgteKategorier.length > 0 || soegeord.trim()}
				<button class="ryd-knap" type="button" onclick={ryd}>Ryd</button>
			{/if}
		</div>

		{#if opskrifter.length === 0}
			<div class="status-besked">
				Linn er ved at lægge opskrifter ind. Kig forbi senere.
			</div>
		{:else if filtreret.length === 0}
			<div class="status-besked">Ingen opskrifter matcher dine filtre.</div>
		{:else}
			<div class="grid">
				{#each filtreret as o (o.id)}
					<a class="kort" href="/app/moduler/30-30-3/opskrifter/{o.id}">
						<div class="kort-billede">
							{#if o.billedeUrl}
								<img src={o.billedeUrl} alt={o.titel} />
							{:else}
								<div class="kort-emoji">🍽️</div>
							{/if}
						</div>
						<div class="kort-tekst">
							<div class="kort-titel">{o.titel}</div>
							{#if o.kategorier.length > 0}
								<div class="kort-kategorier">
									{#each o.kategorier as k (k)}
										<span class="kort-cat">{KATEGORI_LABELS[k]}</span>
									{/each}
								</div>
							{/if}
						</div>
					</a>
				{/each}
			</div>
		{/if}
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

	.back {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-size: 12px;
		color: var(--text2);
		text-decoration: none;
		margin-bottom: 12px;
	}

	.eyebrow {
		font-size: 10px;
		font-weight: 600;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--text3);
	}

	h1 {
		font-family: var(--ff-d);
		font-size: 26px;
		font-weight: 600;
		letter-spacing: -0.02em;
		margin: 4px 0 0;
		line-height: 1.05;
		color: var(--text);
	}

	.page-sub {
		font-size: 13px;
		color: var(--text2);
		margin: 6px 0 0;
		line-height: 1.4;
	}

	.status-besked {
		padding: 14px 16px;
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 12px;
		color: var(--text2);
		font-size: 13px;
		text-align: center;
	}

	.status-besked.fejl {
		color: #8a4a3e;
		background: #fbeeea;
		border-color: #f0d6cf;
	}

	.search {
		width: 100%;
		padding: 11px 14px;
		font-size: 14px;
		border-radius: 10px;
		border: 1px solid var(--border);
		background: var(--bg2);
		color: var(--text);
		font-family: var(--ff-b);
		outline: none;
		margin-bottom: 10px;
	}

	.search:focus {
		border-color: var(--terra);
	}

	.chips {
		display: flex;
		gap: 6px;
		flex-wrap: wrap;
		margin-bottom: 14px;
		align-items: center;
	}

	.chip {
		padding: 6px 12px;
		font-size: 12px;
		border-radius: 99px;
		border: 1px solid var(--border);
		background: var(--white);
		color: var(--text2);
		cursor: pointer;
		font-family: var(--ff-b);
	}

	.chip.aktiv {
		background: var(--terra);
		color: #fff;
		border-color: var(--terra);
	}

	.ryd-knap {
		font-size: 11.5px;
		color: var(--text3);
		background: none;
		border: none;
		cursor: pointer;
		padding: 6px 8px;
		font-family: var(--ff-b);
	}

	.ryd-knap:hover {
		color: var(--terra);
		text-decoration: underline;
	}

	.grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 10px;
	}

	.kort {
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 14px;
		overflow: hidden;
		text-decoration: none;
		color: inherit;
		display: flex;
		flex-direction: column;
	}

	.kort:hover {
		border-color: var(--terra);
	}

	.kort-billede {
		aspect-ratio: 4 / 3;
		background: var(--bg2);
		display: flex;
		align-items: center;
		justify-content: center;
		overflow: hidden;
	}

	.kort-billede img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.kort-emoji {
		font-size: 38px;
		opacity: 0.4;
	}

	.kort-tekst {
		padding: 10px 12px;
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.kort-titel {
		font-size: 13.5px;
		font-weight: 600;
		color: var(--text);
		line-height: 1.3;
	}

	.kort-kategorier {
		display: flex;
		gap: 4px;
		flex-wrap: wrap;
	}

	.kort-cat {
		font-size: 9.5px;
		letter-spacing: 0.06em;
		color: var(--text3);
		background: var(--bg2);
		padding: 2px 7px;
		border-radius: 99px;
	}
</style>
