<script lang="ts">
	import { onMount } from 'svelte';
	import {
		beregnItem,
		beregnMaaltid,
		filtrerFodevarer,
		formatGram,
		KATEGORI_LABELS as FODEVARE_KATEGORIER,
		PROTEIN_MAALTIDS_MAAL,
		FIBER_DAGS_MAAL,
		procentMod,
		sorterFodevarer,
		type Fodevare,
		type Kategori,
		type MaaltidsItem,
		type SortMode
	} from '$lib/content/kost';
	import {
		ALLE_KATEGORIER as OPSKRIFT_KATEGORIER,
		filtrerOpskrifter,
		KATEGORI_LABELS as OPSKRIFT_LABELS,
		type Opskrift,
		type OpskriftKategori
	} from '$lib/content/opskrifter';
	import { hentAlleFodevarer } from '$lib/firestore/kost';
	import { hentAlleOpskrifter } from '$lib/firestore/opskrifter';
	import Icon from '$lib/components/Icon.svelte';

	const STORAGE_KEY = 'la_30303_maaltid_v1';

	type Tab = 'opslag' | 'maaltid' | 'opskrifter';

	let aktivTab = $state<Tab>('opslag');

	let foods = $state<Fodevare[]>([]);
	let foodMap = $state<Map<string, Fodevare>>(new Map());
	let opskrifter = $state<Opskrift[]>([]);
	let loading = $state(true);
	let fejl = $state<string | null>(null);

	// Slå op-state
	let soegeord = $state('');
	let aktivKategori = $state<Kategori | 'all'>('all');
	let sortMode = $state<SortMode>('alpha');

	// Byg måltid-state — persisterer i localStorage
	let maaltid = $state<MaaltidsItem[]>([]);
	let viserPicker = $state(false);
	let pickerSoeg = $state('');
	let pickerKategori = $state<Kategori | 'all'>('all');

	// Opskrifter-state
	let opskriftSoeg = $state('');
	let valgteOpskriftKategorier = $state<OpskriftKategori[]>([]);

	const filtreret = $derived(
		sorterFodevarer(filtrerFodevarer(foods, soegeord, aktivKategori), sortMode)
	);
	const filtretetPicker = $derived(
		sorterFodevarer(filtrerFodevarer(foods, pickerSoeg, pickerKategori), 'alpha')
	);
	const filtreredeOpskrifter = $derived(
		filtrerOpskrifter(opskrifter, opskriftSoeg, valgteOpskriftKategorier)
	);

	const totaler = $derived(beregnMaaltid(maaltid, foodMap));
	const proteinPct = $derived(procentMod(PROTEIN_MAALTIDS_MAAL, totaler.protein));
	const fiberPct = $derived(procentMod(FIBER_DAGS_MAAL, totaler.fiber));

	const aktiveKategorier = $derived.by<Array<Kategori | 'all'>>(() => {
		const sat = new Set<Kategori>();
		for (const f of foods) sat.add(f.cat);
		return [
			'all',
			...Array.from(sat).sort((a, b) =>
				FODEVARE_KATEGORIER[a].localeCompare(FODEVARE_KATEGORIER[b], 'da')
			)
		];
	});

	let initialiseret = $state(false);

	onMount(async () => {
		try {
			const raw = localStorage.getItem(STORAGE_KEY);
			if (raw) {
				const parsed = JSON.parse(raw);
				if (Array.isArray(parsed)) maaltid = parsed;
			}
		} catch (e) {
			console.warn('Kunne ikke læse gemt måltid:', e);
		}

		try {
			const [allFoods, allOpskrifter] = await Promise.all([
				hentAlleFodevarer(),
				hentAlleOpskrifter(true)
			]);
			foods = allFoods;
			foodMap = new Map(allFoods.map((f) => [f.id, f]));
			opskrifter = allOpskrifter;
		} catch (e) {
			console.error(e);
			fejl = 'Kunne ikke hente data.';
		} finally {
			loading = false;
			initialiseret = true;
		}
	});

	$effect(() => {
		if (!initialiseret) return;
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(maaltid));
		} catch (e) {
			console.warn('Kunne ikke gemme måltid:', e);
		}
	});

	function tilfoejTilMaaltid(food: Fodevare) {
		const standardEnhed = food.units?.[0]?.u;
		const standardPortion = standardEnhed ? 1 : 100;
		maaltid = [
			...maaltid,
			{ foodId: food.id, portion: standardPortion, enhedId: standardEnhed }
		];
		viserPicker = false;
		pickerSoeg = '';
		aktivTab = 'maaltid';
	}

	function fjernItem(index: number) {
		maaltid = maaltid.filter((_, i) => i !== index);
	}

	function opdaterPortion(index: number, ny: string) {
		const n = parseFloat(ny.replace(',', '.'));
		if (!Number.isFinite(n) || n < 0) return;
		const opdateret = [...maaltid];
		opdateret[index] = { ...opdateret[index], portion: n };
		maaltid = opdateret;
	}

	function opdaterEnhed(index: number, ny: string) {
		const opdateret = [...maaltid];
		opdateret[index] = { ...opdateret[index], enhedId: ny || undefined };
		maaltid = opdateret;
	}

	function nulstilMaaltid() {
		maaltid = [];
	}

	function aabnPicker() {
		viserPicker = true;
		pickerSoeg = '';
		pickerKategori = 'all';
	}

	function lukPicker() {
		viserPicker = false;
	}

	function toggleOpskriftKategori(k: OpskriftKategori) {
		if (valgteOpskriftKategorier.includes(k)) {
			valgteOpskriftKategorier = valgteOpskriftKategorier.filter((x) => x !== k);
		} else {
			valgteOpskriftKategorier = [...valgteOpskriftKategorier, k];
		}
	}
</script>

<div class="page">
	<header class="page-header">
		<a class="back" href="/app/moduler">
			<Icon name="arrow-l" size={14} color="var(--text2)" />
			<span>Moduler</span>
		</a>
		<div class="eyebrow">Kost</div>
		<h1>30-30-3</h1>
	</header>

	{#if loading}
		<div class="status-besked">Henter data...</div>
	{:else if fejl}
		<div class="status-besked fejl">{fejl}</div>
	{:else}
		<div class="tabs">
			<button
				class="tab-knap"
				class:aktiv={aktivTab === 'opslag'}
				type="button"
				onclick={() => (aktivTab = 'opslag')}
			>
				Slå op
			</button>
			<button
				class="tab-knap"
				class:aktiv={aktivTab === 'maaltid'}
				type="button"
				onclick={() => (aktivTab = 'maaltid')}
			>
				Byg måltid {maaltid.length > 0 ? `(${maaltid.length})` : ''}
			</button>
			<button
				class="tab-knap"
				class:aktiv={aktivTab === 'opskrifter'}
				type="button"
				onclick={() => (aktivTab = 'opskrifter')}
			>
				Opskrifter
			</button>
		</div>

		{#if aktivTab === 'opslag'}
			<input
				type="search"
				class="search"
				placeholder="Søg fødevare (fx skyr, havregryn, kylling)..."
				bind:value={soegeord}
			/>

			<div class="sort-rad">
				<span class="sort-label">Sortér:</span>
				<button
					type="button"
					class="sort-knap"
					class:aktiv={sortMode === 'alpha'}
					onclick={() => (sortMode = 'alpha')}>Alfabetisk</button
				>
				<button
					type="button"
					class="sort-knap"
					class:aktiv={sortMode === 'protein'}
					onclick={() => (sortMode = 'protein')}>Mest protein</button
				>
				<button
					type="button"
					class="sort-knap"
					class:aktiv={sortMode === 'fiber'}
					onclick={() => (sortMode = 'fiber')}>Mest fiber</button
				>
			</div>

			<div class="chips">
				{#each aktiveKategorier as cat (cat)}
					<button
						type="button"
						class="chip"
						class:aktiv={aktivKategori === cat}
						onclick={() => (aktivKategori = cat)}
					>
						{cat === 'all' ? 'Alle' : FODEVARE_KATEGORIER[cat]}
					</button>
				{/each}
			</div>

			<div class="liste">
				{#if filtreret.length === 0}
					<div class="status-besked">Ingen fødevarer matcher.</div>
				{:else}
					{#each filtreret as food (food.id)}
						<div class="food-row">
							<div class="food-tekst">
								<div class="food-navn">{food.name}</div>
								<div class="food-meta">
									{food.p}g protein · {food.f}g fiber pr 100g
								</div>
							</div>
							<button
								class="tilfoej-knap"
								type="button"
								onclick={() => tilfoejTilMaaltid(food)}
								aria-label="Tilføj til måltid"
							>
								+
							</button>
						</div>
					{/each}
				{/if}
			</div>
		{:else if aktivTab === 'maaltid'}
			<div class="totaler">
				<div class="total-card protein">
					<div class="total-head">
						<span class="total-label">Protein</span>
						<span class="total-mål">mål {PROTEIN_MAALTIDS_MAAL}g</span>
					</div>
					<div class="total-val">{formatGram(totaler.protein)}</div>
					<div class="total-bar">
						<div class="total-fill protein-fill" style="width: {proteinPct}%"></div>
					</div>
				</div>
				<div class="total-card fiber">
					<div class="total-head">
						<span class="total-label">Fibre</span>
						<span class="total-mål">dagsmål {FIBER_DAGS_MAAL}g</span>
					</div>
					<div class="total-val">{formatGram(totaler.fiber)}</div>
					<div class="total-bar">
						<div class="total-fill fiber-fill" style="width: {fiberPct}%"></div>
					</div>
				</div>
			</div>

			<div class="maaltid-liste">
				{#if maaltid.length === 0}
					<div class="status-besked">
						Tryk på + for at tilføje din første fødevare.
					</div>
				{:else}
					{#each maaltid as item, i (i)}
						{@const food = foodMap.get(item.foodId)}
						{@const beregnet = beregnItem(item, food)}
						<div class="item-row">
							<div class="item-tekst">
								<div class="item-navn">{food?.name ?? item.foodId}</div>
								<div class="item-meta">
									{formatGram(beregnet.protein)} protein · {formatGram(beregnet.fiber)} fiber
								</div>
							</div>
							<input
								class="portion-input"
								type="number"
								min="0"
								step="0.5"
								value={item.portion}
								oninput={(e) =>
									opdaterPortion(i, (e.target as HTMLInputElement).value)}
							/>
							{#if food?.units && food.units.length > 0}
								<select
									class="enhed-select"
									value={item.enhedId ?? 'g'}
									onchange={(e) =>
										opdaterEnhed(i, (e.target as HTMLSelectElement).value)}
								>
									<option value="g">g</option>
									{#each food.units as u (u.u)}
										<option value={u.u}>{u.label}</option>
									{/each}
								</select>
							{:else}
								<span class="enhed-static">g</span>
							{/if}
							<button
								class="ikon-knap"
								type="button"
								onclick={() => fjernItem(i)}
								aria-label="Fjern fødevare"
							>
								×
							</button>
						</div>
					{/each}
				{/if}
			</div>

			<button class="primary-knap" type="button" onclick={aabnPicker}>
				+ Tilføj fødevare
			</button>
			{#if maaltid.length > 0}
				<button class="ghost-knap" type="button" onclick={nulstilMaaltid}>Nulstil måltid</button>
			{/if}
		{:else}
			<input
				type="search"
				class="search"
				placeholder="Søg opskrift..."
				bind:value={opskriftSoeg}
			/>

			<div class="chips">
				{#each OPSKRIFT_KATEGORIER as k (k)}
					<button
						type="button"
						class="chip"
						class:aktiv={valgteOpskriftKategorier.includes(k)}
						onclick={() => toggleOpskriftKategori(k)}
					>
						{OPSKRIFT_LABELS[k]}
					</button>
				{/each}
			</div>

			{#if opskrifter.length === 0}
				<div class="status-besked">
					Linn er ved at lægge opskrifter ind. Kig forbi senere.
				</div>
			{:else if filtreredeOpskrifter.length === 0}
				<div class="status-besked">Ingen opskrifter matcher dine filtre.</div>
			{:else}
				<div class="opskrift-grid">
					{#each filtreredeOpskrifter as o (o.id)}
						<a class="opskrift-kort" href="/app/moduler/30-30-3/opskrifter/{o.id}">
							<div class="opskrift-billede">
								{#if o.billedeUrl}
									<img src={o.billedeUrl} alt={o.titel} />
								{:else}
									<div class="opskrift-emoji">🍽️</div>
								{/if}
							</div>
							<div class="opskrift-tekst">
								<div class="opskrift-titel">{o.titel}</div>
								{#if o.kategorier.length > 0}
									<div class="opskrift-kategorier">
										{#each o.kategorier as k (k)}
											<span class="opskrift-cat">{OPSKRIFT_LABELS[k]}</span>
										{/each}
									</div>
								{/if}
							</div>
						</a>
					{/each}
				</div>
			{/if}
		{/if}
	{/if}

	{#if viserPicker}
		<div
			class="modal-bag"
			role="dialog"
			aria-modal="true"
			onclick={(e) => {
				if (e.target === e.currentTarget) lukPicker();
			}}
			onkeydown={(e) => {
				if (e.key === 'Escape') lukPicker();
			}}
			tabindex="-1"
		>
			<div class="modal">
				<div class="modal-head">
					<div class="modal-titel">Vælg fødevare</div>
					<button class="modal-luk" type="button" onclick={lukPicker} aria-label="Luk">
						×
					</button>
				</div>
				<input type="search" class="search" placeholder="Søg..." bind:value={pickerSoeg} />
				<div class="chips">
					{#each aktiveKategorier as cat (cat)}
						<button
							type="button"
							class="chip"
							class:aktiv={pickerKategori === cat}
							onclick={() => (pickerKategori = cat)}
						>
							{cat === 'all' ? 'Alle' : FODEVARE_KATEGORIER[cat]}
						</button>
					{/each}
				</div>
				<div class="picker-liste">
					{#each filtretetPicker as food (food.id)}
						<button
							class="picker-row"
							type="button"
							onclick={() => tilfoejTilMaaltid(food)}
						>
							<div class="picker-tekst">
								<div class="food-navn">{food.name}</div>
								<div class="food-meta">{food.p}g protein · {food.f}g fiber pr 100g</div>
							</div>
							<span class="picker-plus">+</span>
						</button>
					{/each}
				</div>
			</div>
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
		font-size: 30px;
		font-weight: 600;
		letter-spacing: -0.02em;
		margin: 4px 0 0;
		line-height: 1.05;
		color: var(--text);
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

	.tabs {
		display: grid;
		grid-template-columns: 1fr 1fr 1fr;
		background: var(--bg2);
		padding: 4px;
		border-radius: 12px;
		margin-bottom: 14px;
		gap: 4px;
	}

	.tab-knap {
		padding: 10px 6px;
		font-size: 12.5px;
		font-weight: 600;
		border-radius: 8px;
		border: none;
		background: transparent;
		color: var(--text2);
		cursor: pointer;
		font-family: var(--ff-b);
	}

	.tab-knap.aktiv {
		background: var(--white);
		color: var(--terra);
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
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

	.sort-rad {
		display: flex;
		align-items: center;
		gap: 6px;
		flex-wrap: wrap;
		margin-bottom: 10px;
	}

	.sort-label {
		font-size: 11.5px;
		color: var(--text3);
		margin-right: 4px;
	}

	.sort-knap,
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

	.sort-knap.aktiv,
	.chip.aktiv {
		background: var(--terra);
		color: #fff;
		border-color: var(--terra);
	}

	.chips {
		display: flex;
		gap: 6px;
		flex-wrap: wrap;
		margin-bottom: 12px;
	}

	.liste {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.food-row {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 10px 12px;
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 10px;
	}

	.food-tekst {
		flex: 1;
		min-width: 0;
	}

	.food-navn {
		font-size: 13.5px;
		font-weight: 500;
		color: var(--text);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.food-meta {
		font-size: 11px;
		color: var(--text3);
		margin-top: 2px;
	}

	.tilfoej-knap {
		width: 32px;
		height: 32px;
		border-radius: 50%;
		background: var(--terra);
		color: #fff;
		font-size: 18px;
		border: none;
		cursor: pointer;
		font-family: var(--ff-b);
		flex-shrink: 0;
	}

	.tilfoej-knap:hover {
		filter: brightness(0.95);
	}

	.totaler {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 10px;
		margin-bottom: 14px;
	}

	.total-card {
		padding: 14px;
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 14px;
	}

	.total-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 6px;
	}

	.total-label {
		font-size: 11px;
		font-weight: 600;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--text2);
	}

	.total-mål {
		font-size: 10.5px;
		color: var(--text3);
	}

	.total-val {
		font-family: var(--ff-d);
		font-size: 26px;
		font-weight: 600;
		color: var(--text);
		margin-bottom: 6px;
	}

	.total-bar {
		height: 5px;
		background: var(--bg2);
		border-radius: 3px;
		overflow: hidden;
	}

	.total-fill {
		height: 100%;
		transition: width 0.3s ease;
	}

	.protein-fill {
		background: var(--terra);
	}

	.fiber-fill {
		background: var(--sage);
	}

	.maaltid-liste {
		display: flex;
		flex-direction: column;
		gap: 6px;
		margin-bottom: 12px;
	}

	.item-row {
		display: grid;
		grid-template-columns: 1fr 60px 60px 32px;
		gap: 6px;
		align-items: center;
		padding: 8px 10px;
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 10px;
	}

	.item-tekst {
		min-width: 0;
		overflow: hidden;
	}

	.item-navn {
		font-size: 13px;
		font-weight: 500;
		color: var(--text);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.item-meta {
		font-size: 10.5px;
		color: var(--text3);
		margin-top: 2px;
	}

	.portion-input,
	.enhed-select {
		padding: 7px 8px;
		font-size: 12.5px;
		border-radius: 8px;
		border: 1px solid var(--border);
		background: var(--bg2);
		color: var(--text);
		font-family: var(--ff-b);
		outline: none;
	}

	.enhed-static {
		font-size: 12px;
		color: var(--text3);
		text-align: center;
	}

	.ikon-knap {
		width: 28px;
		height: 28px;
		border-radius: 6px;
		background: var(--bg2);
		border: 1px solid var(--border);
		color: var(--text3);
		font-size: 16px;
		cursor: pointer;
		font-family: var(--ff-b);
	}

	.ikon-knap:hover {
		background: #fbeeea;
		color: #8a4a3e;
	}

	.primary-knap {
		display: block;
		width: 100%;
		padding: 13px;
		background: var(--terra);
		color: #fff;
		font-size: 14px;
		font-weight: 600;
		border-radius: 10px;
		border: none;
		cursor: pointer;
		font-family: var(--ff-b);
	}

	.ghost-knap {
		display: block;
		width: 100%;
		padding: 10px;
		background: transparent;
		color: var(--text3);
		font-size: 13px;
		border: none;
		cursor: pointer;
		margin-top: 8px;
		font-family: var(--ff-b);
	}

	.opskrift-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 10px;
	}

	.opskrift-kort {
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 14px;
		overflow: hidden;
		text-decoration: none;
		color: inherit;
		display: flex;
		flex-direction: column;
	}

	.opskrift-kort:hover {
		border-color: var(--terra);
	}

	.opskrift-billede {
		aspect-ratio: 4 / 3;
		background: var(--bg2);
		display: flex;
		align-items: center;
		justify-content: center;
		overflow: hidden;
	}

	.opskrift-billede img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.opskrift-emoji {
		font-size: 38px;
		opacity: 0.4;
	}

	.opskrift-tekst {
		padding: 10px 12px;
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.opskrift-titel {
		font-size: 13.5px;
		font-weight: 600;
		color: var(--text);
		line-height: 1.3;
	}

	.opskrift-kategorier {
		display: flex;
		gap: 4px;
		flex-wrap: wrap;
	}

	.opskrift-cat {
		font-size: 9.5px;
		letter-spacing: 0.06em;
		color: var(--text3);
		background: var(--bg2);
		padding: 2px 7px;
		border-radius: 99px;
	}

	.modal-bag {
		position: fixed;
		inset: 0;
		background: rgba(42, 31, 23, 0.5);
		display: flex;
		align-items: flex-end;
		justify-content: center;
		z-index: 600;
	}

	.modal {
		background: var(--white);
		border-radius: 18px 18px 0 0;
		padding: 14px 18px 24px;
		width: 100%;
		max-width: 520px;
		max-height: 80vh;
		display: flex;
		flex-direction: column;
		gap: 10px;
		box-shadow: 0 -8px 24px rgba(0, 0, 0, 0.15);
	}

	.modal-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.modal-titel {
		font-family: var(--ff-d);
		font-size: 18px;
		font-weight: 600;
	}

	.modal-luk {
		width: 32px;
		height: 32px;
		border-radius: 50%;
		background: var(--bg2);
		border: none;
		color: var(--text2);
		font-size: 20px;
		cursor: pointer;
	}

	.picker-liste {
		display: flex;
		flex-direction: column;
		gap: 4px;
		overflow-y: auto;
		flex: 1;
	}

	.picker-row {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 10px 12px;
		background: var(--bg2);
		border: 1px solid var(--border);
		border-radius: 10px;
		cursor: pointer;
		text-align: left;
		font-family: var(--ff-b);
	}

	.picker-row:hover {
		background: var(--white);
		border-color: var(--terra);
	}

	.picker-tekst {
		flex: 1;
		min-width: 0;
	}

	.picker-plus {
		font-size: 18px;
		color: var(--terra);
		font-weight: 600;
	}
</style>
