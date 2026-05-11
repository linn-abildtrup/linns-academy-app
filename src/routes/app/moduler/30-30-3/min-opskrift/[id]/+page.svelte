<script lang="ts">
	import { getContext, onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import type { User } from 'firebase/auth';
	import { hentMinOpskrift, sletMinOpskrift } from '$lib/firestore/minOpskrift';
	import type { MinOpskrift } from '$lib/content/minOpskrift';
	import Icon from '$lib/components/Icon.svelte';
	import Loading from '$lib/components/Loading.svelte';

	const getUser = getContext<() => User | null>('user');
	const user = $derived(getUser());

	const id = $derived(page.params.id ?? '');

	let opskrift = $state<MinOpskrift | null>(null);
	let loading = $state(true);
	let fejl = $state<string | null>(null);
	let sletter = $state(false);

	onMount(async () => {
		const u = user;
		if (!u) {
			fejl = 'Du skal være logget ind.';
			loading = false;
			return;
		}
		try {
			opskrift = await hentMinOpskrift(u.uid, id);
			if (!opskrift) fejl = 'Opskriften kunne ikke findes.';
		} catch (e) {
			console.error(e);
			fejl = 'Kunne ikke hente opskriften.';
		} finally {
			loading = false;
		}
	});

	async function slet() {
		const u = user;
		if (!u || sletter) return;
		if (!confirm('Slet denne opskrift?')) return;
		sletter = true;
		try {
			await sletMinOpskrift(u.uid, id);
			goto('/app/moduler/30-30-3?tab=mine');
		} catch (e) {
			console.error(e);
			fejl = 'Kunne ikke slette.';
			sletter = false;
		}
	}
</script>

<div class="page">
	<header class="page-header">
		<a class="back" href="/app/moduler/30-30-3?tab=mine">
			<Icon name="arrow-l" size={14} color="var(--text2)" />
			<span>Mine opskrifter</span>
		</a>
	</header>

	{#if loading}
		<Loading tekst="Henter..." />
	{:else if fejl}
		<div class="status-besked fejl">{fejl}</div>
	{:else if opskrift}
		{#if opskrift.billedeUrl}
			<img class="billede" src={opskrift.billedeUrl} alt={opskrift.navn} />
		{/if}

		<h1>{opskrift.navn}</h1>
		<div class="meta">{opskrift.antalPortioner} {opskrift.antalPortioner === 1 ? 'portion' : 'portioner'}</div>

		<section class="card">
			<div class="section-label">Makro pr portion</div>
			<div class="makro-grid">
				<div class="makro-felt">
					<div class="makro-val">{opskrift.makroPrPortion.protein}g</div>
					<div class="makro-lbl">Protein</div>
				</div>
				<div class="makro-felt">
					<div class="makro-val">{opskrift.makroPrPortion.fiber}g</div>
					<div class="makro-lbl">Fiber</div>
				</div>
				<div class="makro-felt">
					<div class="makro-val">{opskrift.makroPrPortion.kh}g</div>
					<div class="makro-lbl">Kulhydrater</div>
				</div>
				<div class="makro-felt">
					<div class="makro-val">{opskrift.makroPrPortion.fedt}g</div>
					<div class="makro-lbl">Fedt</div>
				</div>
				<div class="makro-felt fuld">
					<div class="makro-val">{opskrift.makroPrPortion.kcal}</div>
					<div class="makro-lbl">Kalorier</div>
				</div>
			</div>
		</section>

		<section class="card">
			<div class="section-label">Ingredienser</div>
			<ul class="ing-liste">
				{#each opskrift.ingredienser as ing, i (i)}
					<li class="ing-item">
						<span class="ing-maengde">{ing.maengde} {ing.enhed}</span>
						<span class="ing-navn">{ing.navn}</span>
					</li>
				{/each}
			</ul>
		</section>

		<button class="slet-knap" type="button" onclick={slet} disabled={sletter}>
			{sletter ? 'Sletter...' : 'Slet opskrift'}
		</button>
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
	}

	.billede {
		width: 100%;
		max-height: 300px;
		object-fit: cover;
		border-radius: 14px;
		margin-bottom: 14px;
	}

	h1 {
		font-family: var(--ff-d);
		font-size: calc(26px * var(--fs-scale, 1));
		font-weight: 600;
		letter-spacing: -0.02em;
		margin: 0;
		line-height: 1.1;
		color: var(--text);
	}

	.meta {
		font-size: calc(12px * var(--fs-scale, 1));
		color: var(--text3);
		margin-top: 4px;
		margin-bottom: 14px;
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

	.status-besked.fejl {
		color: #8a4a3e;
		background: #fbeeea;
		border-color: #f0d6cf;
	}

	.card {
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 14px;
		padding: 16px;
		margin-bottom: 14px;
	}

	.section-label {
		font-size: calc(10px * var(--fs-scale, 1));
		font-weight: 600;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: var(--text3);
		margin-bottom: 12px;
	}

	.makro-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 10px;
	}

	.makro-felt {
		padding: 10px 12px;
		background: var(--bg2);
		border-radius: 10px;
		text-align: center;
	}

	.makro-felt.fuld {
		grid-column: span 2;
	}

	.makro-val {
		font-family: var(--ff-d);
		font-size: calc(20px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--terra);
	}

	.makro-lbl {
		font-size: calc(11px * var(--fs-scale, 1));
		color: var(--text3);
		margin-top: 2px;
	}

	.ing-liste {
		list-style: none;
		padding: 0;
		margin: 0;
	}

	.ing-item {
		display: flex;
		gap: 10px;
		padding: 8px 0;
		border-top: 1px solid var(--border);
		font-size: calc(13px * var(--fs-scale, 1));
	}

	.ing-item:first-child {
		border-top: none;
	}

	.ing-maengde {
		flex-shrink: 0;
		min-width: 80px;
		font-weight: 600;
		color: var(--text2);
	}

	.ing-navn {
		color: var(--text);
	}

	.slet-knap {
		display: block;
		width: 100%;
		padding: 12px;
		background: var(--white);
		color: #8a4a3e;
		font-size: calc(13px * var(--fs-scale, 1));
		font-weight: 600;
		border: 1px solid #f0d6cf;
		border-radius: 10px;
		cursor: pointer;
		font-family: var(--ff-b);
	}

	.slet-knap:hover {
		background: #fbeeea;
	}

	.slet-knap:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
</style>
