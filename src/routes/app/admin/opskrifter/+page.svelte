<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import {
		KATEGORI_LABELS,
		type Opskrift
	} from '$lib/content/opskrifter';
	import { gemOpskrift, hentAlleOpskrifter } from '$lib/firestore/opskrifter';
	import Icon from '$lib/components/Icon.svelte';

	let opskrifter = $state<Opskrift[]>([]);
	let loading = $state(true);
	let fejl = $state<string | null>(null);
	let opretter = $state(false);

	onMount(async () => {
		try {
			opskrifter = await hentAlleOpskrifter(false);
		} catch (e) {
			console.error(e);
			fejl = 'Kunne ikke hente opskrifter.';
		} finally {
			loading = false;
		}
	});

	async function opretNy() {
		if (opretter) return;
		opretter = true;
		try {
			const id = `opskrift_${Date.now().toString(36)}`;
			await gemOpskrift({
				id,
				titel: 'Ny opskrift',
				beskrivelse: '',
				billedeUrl: null,
				kategorier: [],
				defaultPortioner: 4,
				ingredienser: [],
				instruktioner: '',
				aktiv: false
			});
			goto(`/app/admin/opskrifter/${id}`);
		} catch (e) {
			console.error(e);
			fejl = 'Kunne ikke oprette opskrift.';
			opretter = false;
		}
	}
</script>

<div class="page">
	<header class="page-header">
		<a class="back" href="/app/admin">
			<Icon name="arrow-l" size={14} color="var(--text2)" />
			<span>Admin</span>
		</a>
		<div class="eyebrow">Admin · Opskrifter</div>
		<h1>Opskrifter</h1>
		<p class="page-sub">Opret og rediger opskrifter der vises til kunderne under 30-30-3.</p>
	</header>

	<button class="opret-knap" type="button" onclick={opretNy} disabled={opretter}>
		{opretter ? 'Opretter...' : '+ Opret ny opskrift'}
	</button>

	{#if loading}
		<div class="status-besked">Henter opskrifter...</div>
	{:else if fejl}
		<div class="status-besked fejl">{fejl}</div>
	{:else if opskrifter.length === 0}
		<div class="status-besked">Ingen opskrifter endnu — opret den første ovenfor.</div>
	{:else}
		<div class="liste">
			{#each opskrifter as o (o.id)}
				<a class="row" href="/app/admin/opskrifter/{o.id}">
					<div class="thumb">
						{#if o.billedeUrl}
							<img src={o.billedeUrl} alt={o.titel} />
						{:else}
							<div class="thumb-emoji">🍽️</div>
						{/if}
					</div>
					<div class="tekst">
						<div class="navn">
							{o.titel}
							{#if !o.aktiv}
								<span class="badge inaktiv">Inaktiv</span>
							{/if}
						</div>
						<div class="sub">
							{o.kategorier.map((k) => KATEGORI_LABELS[k]).join(', ') || 'Ingen kategori'}
							· {o.ingredienser.length} ingredienser
						</div>
					</div>
					<Icon name="chevron-r" size={14} color="var(--text3)" />
				</a>
			{/each}
		</div>
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
		font-size: 28px;
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

	.opret-knap {
		display: block;
		width: 100%;
		padding: 13px;
		background: var(--terra);
		color: #fff;
		font-size: 14px;
		font-weight: 600;
		border-radius: 12px;
		border: none;
		cursor: pointer;
		font-family: var(--ff-b);
		margin-bottom: 14px;
	}

	.opret-knap:disabled {
		opacity: 0.6;
		cursor: not-allowed;
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

	.liste {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.row {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 10px 12px;
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 12px;
		text-decoration: none;
		color: inherit;
	}

	.row:hover {
		background: var(--bg2);
	}

	.thumb {
		width: 48px;
		height: 48px;
		border-radius: 10px;
		background: var(--bg2);
		overflow: hidden;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.thumb img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.thumb-emoji {
		font-size: 22px;
		opacity: 0.4;
	}

	.tekst {
		flex: 1;
		min-width: 0;
	}

	.navn {
		font-size: 14px;
		font-weight: 600;
		color: var(--text);
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.sub {
		font-size: 11.5px;
		color: var(--text3);
		margin-top: 2px;
	}

	.badge {
		font-size: 9.5px;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		padding: 2px 7px;
		border-radius: 99px;
		font-weight: 600;
	}

	.badge.inaktiv {
		background: var(--bg2);
		color: var(--text3);
	}
</style>
