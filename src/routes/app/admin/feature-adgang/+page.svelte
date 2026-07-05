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
	import { hentAlleForlob, gemForlob } from '$lib/firestore/forlob';
	import type { Forlob } from '$lib/content/forlobAdgang';
	import { validerPerioder, type MaaltidsFokusPeriode } from '$lib/content/maaltidsFokus';
	import { MAALTIDSTYPER, MAALTIDSTYPE_LABELS, type Maaltidstype } from '$lib/content/kost';

	// Start med en kopi af standard saa skemaet har gyldige vaerdier foer
	// hentningen er faerdig. Erstattes af den gemte matrix i onMount.
	let matrix = $state<FeatureMatrix>(JSON.parse(JSON.stringify(STANDARD_MATRIX)));
	let loading = $state(true);
	let gemmer = $state(false);
	let besked = $state<string | null>(null);

	// ── Måltids-fokus pr forløb (perioder hvor kun bestemte måltider er tilladt) ──
	let forlobListe = $state<Forlob[]>([]);
	let valgtForlobId = $state<string>('');
	let fokusPerioder = $state<MaaltidsFokusPeriode[]>([]);
	let fokusGemmer = $state(false);
	let fokusBesked = $state<string | null>(null);

	const valgtForlob = $derived(forlobListe.find((f) => f.id === valgtForlobId) ?? null);

	onMount(async () => {
		try {
			const [m, forlob] = await Promise.all([hentFeatureMatrix(), hentAlleForlob()]);
			matrix = m;
			forlobListe = forlob;
		} catch (e) {
			console.error('Kunne ikke hente feature-matrix/forløb:', e);
		} finally {
			loading = false;
		}
	});

	function vaelgForlob(id: string) {
		valgtForlobId = id;
		fokusBesked = null;
		const f = forlobListe.find((x) => x.id === id);
		// Dyb kopi så redigering ikke muterer den hentede liste
		fokusPerioder = (f?.maaltidsFokus ?? []).map((p) => ({ ...p, maaltider: [...p.maaltider] }));
	}

	function tilfoejPeriode() {
		fokusPerioder = [...fokusPerioder, { fraDag: 0, tilDag: 6, maaltider: ['morgenmad'] }];
		fokusBesked = null;
	}

	function fjernPeriode(i: number) {
		fokusPerioder = fokusPerioder.filter((_, idx) => idx !== i);
		fokusBesked = null;
	}

	function toggleFokusMaaltid(i: number, type: Maaltidstype) {
		const har = fokusPerioder[i].maaltider.includes(type);
		fokusPerioder[i].maaltider = har
			? fokusPerioder[i].maaltider.filter((m) => m !== type)
			: [...fokusPerioder[i].maaltider, type];
		fokusBesked = null;
	}

	function datoForDag(dag: number): string {
		if (!valgtForlob || !Number.isFinite(dag)) return '';
		const d = new Date(valgtForlob.startDato.toMillis() + dag * 86400000);
		return d.toLocaleDateString('da-DK', { day: '2-digit', month: 'short' });
	}

	async function gemFokus() {
		if (fokusGemmer || !valgtForlobId) return;
		const fejl = validerPerioder(fokusPerioder);
		if (fejl) {
			fokusBesked = fejl;
			return;
		}
		fokusGemmer = true;
		fokusBesked = null;
		try {
			await gemForlob(valgtForlobId, { maaltidsFokus: fokusPerioder });
			// Opdater lokal liste så et nyt forløbs-valg viser de gemte perioder
			forlobListe = forlobListe.map((f) =>
				f.id === valgtForlobId
					? { ...f, maaltidsFokus: fokusPerioder.map((p) => ({ ...p, maaltider: [...p.maaltider] })) }
					: f
			);
			fokusBesked = 'Gemt ✓';
		} catch (e) {
			console.error('Kunne ikke gemme måltids-fokus:', e);
			fokusBesked = 'Kunne ikke gemme — prøv igen';
		} finally {
			fokusGemmer = false;
		}
	}

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

		<section class="fokus">
			<h2 class="fokus-titel">Måltids-fokus (pr. forløb)</h2>
			<p class="fokus-sub">
				Begræns hvilke måltider kunden må se og logge i en periode af et forløb (fx dag 0–6 = kun
				morgenmad). Perioder angives som forløbs-dage, så de gælder alle hold uanset startdato.
				Ingen perioder = ingen begrænsning.
			</p>

			<label class="fokus-vaelg">
				<span>Vælg forløb</span>
				<select value={valgtForlobId} onchange={(e) => vaelgForlob(e.currentTarget.value)}>
					<option value="">— vælg forløb —</option>
					{#each forlobListe as f (f.id)}
						<option value={f.id}>{f.navn}</option>
					{/each}
				</select>
			</label>

			{#if valgtForlobId}
				{#if fokusPerioder.length === 0}
					<p class="fokus-tom">Ingen perioder — kunden ser alle måltider som normalt.</p>
				{/if}

				{#each fokusPerioder as p, i (i)}
					<div class="periode">
						<div class="periode-dage">
							<label>
								<span>Fra dag</span>
								<input type="number" min="0" bind:value={p.fraDag} />
								<em>{datoForDag(p.fraDag)}</em>
							</label>
							<label>
								<span>Til dag</span>
								<input type="number" min="0" bind:value={p.tilDag} />
								<em>{datoForDag(p.tilDag)}</em>
							</label>
							<button type="button" class="fjern" onclick={() => fjernPeriode(i)}>Fjern</button>
						</div>
						<div class="periode-maaltider">
							{#each MAALTIDSTYPER as type (type)}
								<button
									type="button"
									class="maaltid-flueben"
									class:til={p.maaltider.includes(type)}
									aria-pressed={p.maaltider.includes(type)}
									onclick={() => toggleFokusMaaltid(i, type)}
								>
									{MAALTIDSTYPE_LABELS[type]}
								</button>
							{/each}
						</div>
					</div>
				{/each}

				<button type="button" class="tilfoej" onclick={tilfoejPeriode}>+ Tilføj periode</button>

				<div class="gem-rad">
					{#if fokusBesked}
						<span class="besked">{fokusBesked}</span>
					{/if}
					<button class="gem-knap" type="button" disabled={fokusGemmer} onclick={gemFokus}>
						{fokusGemmer ? 'Gemmer...' : 'Gem måltids-fokus'}
					</button>
				</div>
			{/if}
		</section>
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

	.fokus {
		margin-top: 40px;
		padding-top: 24px;
		border-top: 1px solid var(--bg2);
	}

	.fokus-titel {
		font-family: var(--ff-d);
		font-size: calc(18px * var(--fs-scale, 1));
		margin: 0 0 6px;
	}

	.fokus-sub {
		color: var(--text2);
		font-size: calc(13px * var(--fs-scale, 1));
		font-family: var(--ff-b);
		margin: 0 0 16px;
	}

	.fokus-vaelg {
		display: flex;
		flex-direction: column;
		gap: 4px;
		font-family: var(--ff-b);
		font-size: calc(13px * var(--fs-scale, 1));
		color: var(--text2);
		max-width: 340px;
	}

	.fokus-vaelg select {
		padding: 10px 12px;
		border-radius: 10px;
		border: 1px solid var(--bg2);
		background: var(--bg);
		font-family: var(--ff-b);
		font-size: calc(14px * var(--fs-scale, 1));
	}

	.fokus-tom {
		color: var(--text3);
		font-size: calc(12.5px * var(--fs-scale, 1));
		font-family: var(--ff-b);
		margin: 14px 0 0;
	}

	.periode {
		margin-top: 14px;
		padding: 12px;
		border: 1px solid var(--bg2);
		border-radius: 12px;
	}

	.periode-dage {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		gap: 12px;
	}

	.periode-dage label {
		display: flex;
		flex-direction: column;
		gap: 4px;
		font-family: var(--ff-b);
		font-size: calc(12px * var(--fs-scale, 1));
		color: var(--text2);
	}

	.periode-dage input {
		width: 72px;
		padding: 8px 10px;
		border-radius: 8px;
		border: 1px solid var(--bg2);
		background: var(--bg);
		font-family: var(--ff-b);
		font-size: calc(14px * var(--fs-scale, 1));
	}

	.periode-dage em {
		font-style: normal;
		font-size: calc(11px * var(--fs-scale, 1));
		color: var(--text3);
	}

	.fjern {
		margin-left: auto;
		padding: 8px 12px;
		border-radius: 8px;
		border: 1px solid var(--bg2);
		background: var(--bg);
		color: var(--text2);
		font-family: var(--ff-b);
		font-size: calc(12.5px * var(--fs-scale, 1));
		cursor: pointer;
	}

	.periode-maaltider {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		margin-top: 12px;
	}

	.maaltid-flueben {
		padding: 8px 14px;
		border-radius: 99px;
		border: 1.5px solid var(--bg2);
		background: var(--bg);
		color: var(--text2);
		font-family: var(--ff-b);
		font-size: calc(13px * var(--fs-scale, 1));
		cursor: pointer;
	}

	.maaltid-flueben.til {
		background: var(--terra);
		border-color: var(--terra);
		color: #fff;
	}

	.tilfoej {
		margin-top: 14px;
		padding: 10px 16px;
		border-radius: 10px;
		border: 1px dashed var(--terra);
		background: var(--bg);
		color: var(--terra);
		font-family: var(--ff-b);
		font-weight: 600;
		font-size: calc(13px * var(--fs-scale, 1));
		cursor: pointer;
	}
</style>
