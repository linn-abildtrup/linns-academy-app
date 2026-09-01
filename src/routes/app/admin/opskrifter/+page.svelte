<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import {
		ALLE_KATEGORIER,
		KATEGORI_LABELS,
		filtrerOpskrifter,
		type Opskrift,
		type OpskriftKategori
	} from '$lib/content/opskrifter';
	import {
		gemOpskrift,
		hentAlleOpskrifter,
		saetOpskriftGodkendt
	} from '$lib/firestore/opskrifter';
	import Icon from '$lib/components/Icon.svelte';

	let opskrifter = $state<Opskrift[]>([]);
	let loading = $state(true);
	let fejl = $state<string | null>(null);
	let opretter = $state(false);

	let soeg = $state('');
	let valgteKategorier = $state<OpskriftKategori[]>([]);
	let kunUgodkendte = $state(false);
	let gemmerGodkendt = $state<string | null>(null);
	let godkendFejl = $state<string | null>(null);

	// Samme filtrering som kunden moeder under 30-30-3. Reglen er bevidst IKKE
	// skrevet forfra her: to steder der filtrerer hver sin vej ville betyde at
	// admin viste noget andet end kunden, og saa kan man ikke stole paa listen.
	// Godkendelses-filteret ligger UDENFOR og er kun admins, saa kundens
	// filtrering ikke skal kende til et felt hun aldrig ser.
	const filtrerede = $derived.by(() => {
		const liste = filtrerOpskrifter(opskrifter, soeg, valgteKategorier);
		return kunUgodkendte ? liste.filter((o) => !o.godkendt) : liste;
	});

	const antalGodkendte = $derived(opskrifter.filter((o) => o.godkendt).length);

	function toggleKategori(k: OpskriftKategori) {
		valgteKategorier = valgteKategorier.includes(k)
			? valgteKategorier.filter((v) => v !== k)
			: [...valgteKategorier, k];
	}

	async function toggleGodkendt(o: Opskrift) {
		if (gemmerGodkendt) return;
		gemmerGodkendt = o.id;
		godkendFejl = null;
		const ny = !o.godkendt;
		try {
			await saetOpskriftGodkendt(o.id, ny);
			// Raetter listen paa stedet i stedet for at hente alt forfra. En hel
			// genindlaesning ville rykke listen under fingeren midt i en
			// gennemgang af 133 opskrifter.
			opskrifter = opskrifter.map((x) => (x.id === o.id ? { ...x, godkendt: ny } : x));
		} catch (e) {
			console.error(e);
			godkendFejl = 'Kunne ikke gemme godkendelsen. Prøv igen.';
		} finally {
			gemmerGodkendt = null;
		}
	}

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
				dietTags: [],
				// ÉN portion, ikke fire. 122 af de 130 opskrifter er skrevet til
				// én person, saa fire er ikke normen i den her app.
				//
				// Feltet fortaeller hvor mange portioner INGREDIENSLISTEN raekker
				// til, og det bruges til at skalere maengderne. Stod der 4 paa en
				// ret der er skrevet til én, ville kunden se en fjerdedel af hver
				// maengde. Se SPEC-3.0.md 26.9 og 26.18.
				//
				// Foer 13. august 2026 stod her 4, saa hver ny opskrift var
				// forkert indtil feltet blev rettet i haanden. De 122 er sat ned
				// én ad gangen af netop den grund.
				defaultPortioner: 1,
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
		<input type="search" class="search" placeholder="Søg opskrift (fx laks, ris)..." bind:value={soeg} />

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
			<button
				type="button"
				class="chip godkend-chip"
				class:aktiv={kunUgodkendte}
				onclick={() => (kunUgodkendte = !kunUgodkendte)}
			>
				Mangler godkendelse
			</button>
		</div>

		<div class="antal">
			{#if filtrerede.length === opskrifter.length}
				{opskrifter.length} opskrifter
			{:else}
				{filtrerede.length} af {opskrifter.length} opskrifter
			{/if}
			· {antalGodkendte} godkendt
		</div>

		{#if godkendFejl}
			<div class="status-besked fejl">{godkendFejl}</div>
		{/if}

		{#if filtrerede.length === 0}
			<div class="status-besked">Ingen opskrifter matcher.</div>
		{:else}
			<div class="liste">
				{#each filtrerede as o (o.id)}
					<div class="row" class:godkendt={o.godkendt}>
						<!-- Godkend-knappen ligger UDEN FOR linket. En knap inde i et
						     link kan ikke trykkes paa uden ogsaa at aabne opskriften. -->
						<button
							type="button"
							class="godkend"
							class:sat={o.godkendt}
							disabled={gemmerGodkendt === o.id}
							title={o.godkendt ? 'Godkendt. Tryk for at fjerne' : 'Marker som godkendt'}
							aria-label={o.godkendt
								? `Fjern godkendelsen af ${o.titel}`
								: `Godkend ${o.titel}`}
							aria-pressed={o.godkendt ? 'true' : 'false'}
							onclick={() => toggleGodkendt(o)}
						>
							✓
						</button>
						<a class="row-link" href="/app/admin/opskrifter/{o.id}">
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
					</div>
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

	.opret-knap {
		display: block;
		width: 100%;
		padding: 13px;
		background: var(--terra);
		color: #fff;
		font-size: calc(14px * var(--fs-scale, 1));
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

	.search {
		display: block;
		width: 100%;
		padding: 11px 13px;
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 12px;
		color: var(--text);
		font-size: calc(13.5px * var(--fs-scale, 1));
		font-family: var(--ff-b);
		margin-bottom: 10px;
		box-sizing: border-box;
	}

	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		margin-bottom: 10px;
	}

	/* Baggrunden staar eksplicit. Uden den giver browseren knappen sin egen graa
	   flade, og saa ligner en fravalgt kategori en valgt. */
	.chip {
		padding: 7px 13px;
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 99px;
		color: var(--text2);
		font-size: calc(12.5px * var(--fs-scale, 1));
		font-family: var(--ff-b);
		font-weight: 600;
		cursor: pointer;
	}

	.chip.aktiv {
		background: var(--terra);
		border-color: var(--terra);
		color: #fff;
	}

	.antal {
		font-size: calc(11.5px * var(--fs-scale, 1));
		color: var(--text3);
		margin-bottom: 8px;
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

	.liste {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.row {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 10px 12px;
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 12px;
		color: inherit;
	}

	.row:hover {
		background: var(--bg2);
	}

	/* En godkendt raekke faar en groen kant i venstre side, saa det kan ses
	   ved at skimme listen og ikke kun ved at kigge paa hvert flueben. */
	.row.godkendt {
		border-left: 3px solid #4f8a5b;
	}

	.row-link {
		display: flex;
		align-items: center;
		gap: 12px;
		flex: 1;
		min-width: 0;
		text-decoration: none;
		color: inherit;
	}

	/* Baggrunden staar eksplicit, ellers giver browseren knappen sin egen
	   graa flade og et ugodkendt flueben ligner et godkendt. */
	.godkend {
		width: 30px;
		height: 30px;
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 8px;
		color: var(--text3);
		font-size: calc(14px * var(--fs-scale, 1));
		line-height: 1;
		cursor: pointer;
		padding: 0;
	}

	.godkend.sat {
		background: #e7f2e9;
		border-color: #4f8a5b;
		color: #3d7048;
	}

	.godkend:disabled {
		opacity: 0.5;
		cursor: wait;
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
		font-size: calc(22px * var(--fs-scale, 1));
		opacity: 0.4;
	}

	.tekst {
		flex: 1;
		min-width: 0;
	}

	.navn {
		font-size: calc(14px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--text);
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.sub {
		font-size: calc(11.5px * var(--fs-scale, 1));
		color: var(--text3);
		margin-top: 2px;
	}

	.badge {
		font-size: calc(9.5px * var(--fs-scale, 1));
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
