<script lang="ts">
	import { onMount } from 'svelte';
	import Icon from '$lib/components/Icon.svelte';
	import Loading from '$lib/components/Loading.svelte';
	import {
		FEATURES,
		KUNDETYPER,
		STANDARD_MATRIX,
		type FeatureMatrix,
		type Kundetype,
		type FeatureKey
	} from '$lib/content/features';
	import { hentFeatureMatrix, gemFeatureMatrix } from '$lib/firestore/featureAdgang';

	// Start med en kopi af standard saa skemaet har gyldige vaerdier foer
	// hentningen er faerdig. Erstattes af den gemte matrix i onMount.
	let matrix = $state<FeatureMatrix>(JSON.parse(JSON.stringify(STANDARD_MATRIX)));
	let loading = $state(true);
	let gemmer = $state(false);
	let besked = $state<string | null>(null);

	onMount(async () => {
		try {
			matrix = await hentFeatureMatrix();
		} catch (e) {
			console.error('Kunne ikke hente feature-matrix:', e);
		} finally {
			loading = false;
		}
	});

	function toggle(kt: Kundetype, fk: FeatureKey) {
		matrix[kt][fk] = !matrix[kt][fk];
		besked = null;
	}

	async function gem() {
		if (gemmer) return;
		gemmer = true;
		besked = null;
		try {
			await gemFeatureMatrix(matrix);
			besked = 'Gemt ✓';
		} catch (e) {
			console.error('Kunne ikke gemme feature-matrix:', e);
			besked = 'Kunne ikke gemme — prøv igen';
		} finally {
			gemmer = false;
		}
	}
</script>

<div class="page">
	<header class="page-header">
		<a class="back" href="/app/admin">
			<Icon name="arrow-l" size={14} color="var(--text2)" />
			<span>Admin</span>
		</a>
		<div class="eyebrow">Admin</div>
		<h1>Funktioner og adgang</h1>
		<p class="page-sub">
			Sæt flueben for hvilke funktioner hver kundetype har adgang til. Ændringer træder i kraft for
			kunderne, så snart du gemmer. NB: funktioner mærket
			<strong>"Virker ikke endnu"</strong> er ikke koblet til skemaet endnu — at ændre dem har ingen effekt,
			før de er sat i drift.
		</p>
	</header>

	{#if loading}
		<Loading tekst="Henter adgang..." />
	{:else}
		<div class="skema-wrap">
			<table class="skema">
				<thead>
					<tr>
						<th class="hjorne">Funktion</th>
						{#each KUNDETYPER as kt (kt.key)}
							<th>{kt.navn}</th>
						{/each}
					</tr>
				</thead>
				<tbody>
					{#each FEATURES as f (f.key)}
						<tr>
							<td class="funktion">
								<div class="funktion-navn">
									{f.navn}
									{#if !f.koblet}
										<span
											class="ikke-aktiv"
											title="Ændringer for denne funktion har ingen effekt endnu — den kører stadig på det gamle premium-system."
										>
											Virker ikke endnu
										</span>
									{/if}
								</div>
								<div class="funktion-beskrivelse">{f.beskrivelse}</div>
							</td>
							{#each KUNDETYPER as kt (kt.key)}
								<td class="celle">
									<button
										type="button"
										class="flueben"
										class:til={matrix[kt.key][f.key]}
										aria-pressed={matrix[kt.key][f.key]}
										aria-label="{f.navn} for {kt.navn}"
										onclick={() => toggle(kt.key, f.key)}
									>
										{#if matrix[kt.key][f.key]}
											<Icon name="check" size={14} color="#fff" />
										{/if}
									</button>
								</td>
							{/each}
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		<div class="gem-rad">
			{#if besked}
				<span class="besked">{besked}</span>
			{/if}
			<button class="gem-knap" type="button" disabled={gemmer} onclick={gem}>
				{gemmer ? 'Gemmer...' : 'Gem ændringer'}
			</button>
		</div>
	{/if}
</div>

<style>
	.page {
		padding: 18px 18px 100px;
	}

	.back {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		color: var(--text2);
		text-decoration: none;
		font-size: calc(13px * var(--fs-scale, 1));
		font-family: var(--ff-b);
		margin-bottom: 12px;
	}

	.eyebrow {
		font-size: calc(11px * var(--fs-scale, 1));
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--text3);
		font-family: var(--ff-d);
	}

	h1 {
		font-family: var(--ff-d);
		font-size: calc(22px * var(--fs-scale, 1));
		margin: 2px 0 8px;
	}

	.page-sub {
		color: var(--text2);
		font-size: calc(13px * var(--fs-scale, 1));
		font-family: var(--ff-b);
		margin: 0 0 18px;
	}

	.skema-wrap {
		overflow-x: auto;
	}

	.skema {
		width: 100%;
		border-collapse: collapse;
		font-family: var(--ff-b);
	}

	.skema th {
		text-align: center;
		font-family: var(--ff-d);
		font-size: calc(13px * var(--fs-scale, 1));
		color: var(--text);
		padding: 8px 6px;
		border-bottom: 1px solid var(--bg2);
	}

	.skema th.hjorne {
		text-align: left;
	}

	.funktion {
		padding: 12px 8px 12px 0;
		border-bottom: 1px solid var(--bg2);
		min-width: 160px;
	}

	.funktion-navn {
		font-family: var(--ff-d);
		font-size: calc(14px * var(--fs-scale, 1));
		color: var(--text);
	}

	.ikke-aktiv {
		display: inline-block;
		margin-left: 6px;
		font-family: var(--ff-b);
		font-size: calc(10px * var(--fs-scale, 1));
		font-weight: 600;
		color: #9a6a00;
		background: #fdf0d5;
		padding: 1px 8px;
		border-radius: 99px;
		vertical-align: middle;
		white-space: nowrap;
	}

	.funktion-beskrivelse {
		font-size: calc(11px * var(--fs-scale, 1));
		color: var(--text3);
		margin-top: 2px;
	}

	.celle {
		text-align: center;
		padding: 12px 6px;
		border-bottom: 1px solid var(--bg2);
	}

	.flueben {
		width: 28px;
		height: 28px;
		border-radius: 8px;
		border: 1.5px solid var(--bg2);
		background: var(--bg);
		display: inline-flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		padding: 0;
	}

	.flueben.til {
		background: var(--terra);
		border-color: var(--terra);
	}

	.gem-rad {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: 12px;
		margin-top: 20px;
	}

	.besked {
		font-size: calc(13px * var(--fs-scale, 1));
		color: var(--text2);
		font-family: var(--ff-b);
	}

	.gem-knap {
		padding: 12px 20px;
		background: var(--terra);
		color: #fff;
		font-size: calc(14px * var(--fs-scale, 1));
		font-weight: 600;
		border-radius: 12px;
		border: none;
		cursor: pointer;
		font-family: var(--ff-b);
	}

	.gem-knap:disabled {
		opacity: 0.6;
		cursor: default;
	}
</style>
