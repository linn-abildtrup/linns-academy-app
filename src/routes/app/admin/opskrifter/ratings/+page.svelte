<script lang="ts">
	import { onMount } from 'svelte';
	import { type Opskrift } from '$lib/content/opskrifter';
	import { hentAlleOpskrifter } from '$lib/firestore/opskrifter';
	import Icon from '$lib/components/Icon.svelte';

	type Sortering = 'lavest' | 'hoejest' | 'alfabetisk';

	let opskrifter = $state<Opskrift[]>([]);
	let loading = $state(true);
	let fejl = $state<string | null>(null);
	let sortering = $state<Sortering>('lavest');

	const sorteret = $derived.by(() => {
		const liste = [...opskrifter];
		if (sortering === 'alfabetisk') {
			liste.sort((a, b) => a.titel.localeCompare(b.titel, 'da'));
		} else {
			liste.sort((a, b) => {
				const aHar = (a.ratingCount ?? 0) > 0;
				const bHar = (b.ratingCount ?? 0) > 0;
				if (aHar && !bHar) return -1;
				if (!aHar && bHar) return 1;
				if (!aHar && !bHar) return a.titel.localeCompare(b.titel, 'da');
				const aAvg = a.ratingAvg ?? 0;
				const bAvg = b.ratingAvg ?? 0;
				return sortering === 'lavest' ? aAvg - bAvg : bAvg - aAvg;
			});
		}
		return liste;
	});

	const ratedeAntal = $derived(opskrifter.filter((o) => (o.ratingCount ?? 0) > 0).length);

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

	function format(avg: number | null | undefined): string {
		if (typeof avg !== 'number') return '—';
		return avg.toFixed(1).replace('.', ',');
	}
</script>

<div class="page">
	<header class="page-header">
		<a class="back" href="/app/admin">
			<Icon name="arrow-l" size={14} color="var(--text2)" />
			<span>Admin</span>
		</a>
		<div class="eyebrow">Admin · Opskrift-ratings</div>
		<h1>Opskrift-ratings</h1>
		<p class="page-sub">
			Klienternes gennemsnitlige vurderinger af alle opskrifter. Klik en raekke for at
			redigere opskriften.
		</p>
	</header>

	{#if loading}
		<div class="status-besked">Henter opskrifter...</div>
	{:else if fejl}
		<div class="status-besked fejl">{fejl}</div>
	{:else}
		<div class="opsummering">
			{ratedeAntal} af {opskrifter.length} opskrifter har faaet mindst én stjerne.
		</div>

		<div class="sort-rad" role="tablist" aria-label="Sortering">
			<button
				class="sort-knap"
				class:aktiv={sortering === 'lavest'}
				type="button"
				onclick={() => (sortering = 'lavest')}
			>
				Lavest foerst
			</button>
			<button
				class="sort-knap"
				class:aktiv={sortering === 'hoejest'}
				type="button"
				onclick={() => (sortering = 'hoejest')}
			>
				Hoejest foerst
			</button>
			<button
				class="sort-knap"
				class:aktiv={sortering === 'alfabetisk'}
				type="button"
				onclick={() => (sortering = 'alfabetisk')}
			>
				Alfabetisk
			</button>
		</div>

		<div class="liste">
			{#each sorteret as o (o.id)}
				{@const har = (o.ratingCount ?? 0) > 0}
				<a class="row" href="/app/admin/opskrifter/{o.id}">
					<div class="tekst">
						<div class="navn">
							{o.titel}
							{#if !o.aktiv}
								<span class="badge inaktiv">Inaktiv</span>
							{/if}
						</div>
						<div class="sub">
							{#if har}
								{o.ratingCount} {o.ratingCount === 1 ? 'stemme' : 'stemmer'}
							{:else}
								Ingen vurderinger endnu
							{/if}
						</div>
					</div>
					<div class="rating-val" class:tom={!har}>
						<span aria-hidden="true">★</span>
						<span>{format(o.ratingAvg)}</span>
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

	.opsummering {
		font-size: calc(13px * var(--fs-scale, 1));
		color: var(--text2);
		margin-bottom: 12px;
	}

	.sort-rad {
		display: flex;
		gap: 6px;
		margin-bottom: 14px;
		flex-wrap: wrap;
	}

	.sort-knap {
		padding: 8px 12px;
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 99px;
		font-family: var(--ff-b);
		font-size: calc(12px * var(--fs-scale, 1));
		color: var(--text2);
		cursor: pointer;
		touch-action: manipulation;
	}

	.sort-knap.aktiv {
		background: var(--terra);
		border-color: var(--terra);
		color: var(--white);
	}

	.status-besked {
		padding: 14px;
		text-align: center;
		color: var(--text2);
		font-size: calc(13px * var(--fs-scale, 1));
	}

	.status-besked.fejl {
		color: var(--terra);
	}

	.liste {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.row {
		display: grid;
		grid-template-columns: 1fr auto auto;
		align-items: center;
		gap: 10px;
		padding: 12px 14px;
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 12px;
		text-decoration: none;
		color: var(--text);
	}

	.navn {
		font-weight: 600;
		font-size: calc(14px * var(--fs-scale, 1));
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.badge.inaktiv {
		font-size: calc(10px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--text3);
		background: var(--bg2);
		padding: 2px 7px;
		border-radius: 99px;
	}

	.sub {
		font-size: calc(11.5px * var(--fs-scale, 1));
		color: var(--text3);
		margin-top: 2px;
	}

	.rating-val {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		color: var(--gold);
		font-weight: 600;
		font-size: calc(14px * var(--fs-scale, 1));
		min-width: 48px;
		justify-content: flex-end;
	}

	.rating-val.tom {
		color: var(--text3);
	}
</style>
