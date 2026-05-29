<script lang="ts">
	// Indtast-modal til frugt/groent-challenge. Klienten:
	// 1. Soeger eller bladrer i kategoriserede planter (Linns 'Planter til
	//    tarmmikrobiom'-liste + alle relevante foedevarer fra Mad-modulets database)
	// 2. Hver tilfoejelse vises som chip — kan fjernes
	// 3. Trykker 'Gem' → kalderen faar ansvar for at gemme + aabne stillingen
	import { onMount } from 'svelte';
	import {
		PLANTE_KATEGORIER,
		CAT_TIL_PLANTE_KATEGORI,
		type PlanteKategori
	} from '$lib/content/challenge';
	import { normaliserFoedevareListe } from '$lib/firestore/challenge';
	import { hentAlleFodevarer } from '$lib/firestore/kost';
	import type { Fodevare } from '$lib/content/kost';

	interface Props {
		startListe: string[];
		onGem: (foedevarer: string[]) => void | Promise<void>;
		onLuk: () => void;
		gemmer?: boolean;
	}

	let { startListe, onGem, onLuk, gemmer = false }: Props = $props();

	let valgte = $state<string[]>([]);
	$effect(() => {
		valgte = [...startListe];
	});

	let soegeOrd = $state('');
	let databaseFoedevarer = $state<Fodevare[]>([]);

	onMount(async () => {
		try {
			// hentAlleFodevarer er cached pr session, saa anden gang er oeblikkelig.
			databaseFoedevarer = await hentAlleFodevarer();
		} catch (e) {
			console.warn('Kunne ikke hente foedevare-database:', e);
		}
	});

	// Saml den fulde kategoriserede liste: Linns PDF-items + database-items
	// flettet ind under deres rette kategori (case-insensitivt deduplikering).
	const kategoriseretListe = $derived.by<PlanteKategori[]>(() => {
		const ud = PLANTE_KATEGORIER.map((k) => ({
			id: k.id,
			label: k.label,
			items: [...k.items]
		}));
		const indexByKategori = new Map<string, PlanteKategori>(ud.map((k) => [k.id, k]));

		for (const f of databaseFoedevarer) {
			const kategoriId = CAT_TIL_PLANTE_KATEGORI[f.cat];
			if (!kategoriId) continue;
			const kat = indexByKategori.get(kategoriId);
			if (!kat) continue;
			// Dedup case-insensitivt
			const findes = kat.items.some((i) => i.toLowerCase() === f.name.toLowerCase());
			if (!findes) kat.items.push(f.name);
		}
		// Sortér hver kategori alfabetisk
		for (const k of ud) {
			k.items.sort((a, b) => a.localeCompare(b, 'da'));
		}
		return ud;
	});

	const valgteLowercase = $derived(new Set(valgte.map((v) => v.toLowerCase())));

	// Filtrer pr kategori + udelad dem klienten allerede har valgt.
	const visKategorier = $derived.by<PlanteKategori[]>(() => {
		const ord = soegeOrd.trim().toLowerCase();
		return kategoriseretListe
			.map((k) => ({
				...k,
				items: k.items.filter((i) => {
					if (valgteLowercase.has(i.toLowerCase())) return false;
					if (!ord) return true;
					return i.toLowerCase().includes(ord);
				})
			}))
			.filter((k) => k.items.length > 0);
	});

	const alleKendteLowercase = $derived(
		new Set(kategoriseretListe.flatMap((k) => k.items.map((i) => i.toLowerCase())))
	);

	const visFritekstForslag = $derived.by(() => {
		const ord = soegeOrd.trim();
		if (!ord) return null;
		if (valgteLowercase.has(ord.toLowerCase())) return null;
		if (alleKendteLowercase.has(ord.toLowerCase())) return null;
		return ord;
	});

	function tilfoej(navn: string) {
		const ny = normaliserFoedevareListe([...valgte, navn]);
		valgte = ny;
		soegeOrd = '';
	}

	function fjern(navn: string) {
		valgte = valgte.filter((v) => v.toLowerCase() !== navn.toLowerCase());
	}

	async function gem() {
		await onGem(valgte);
	}
</script>

<div class="overlay" role="dialog" aria-modal="true" aria-labelledby="fg-titel">
	<div class="dialog">
		<header class="dialog-head">
			<h2 id="fg-titel">Indtast planter</h2>
			<button type="button" class="luk" onclick={onLuk} aria-label="Luk">×</button>
		</header>

		<p class="intro">
			Hver gang du har spist en ny plante — frugt, grøntsag, bælgfrugt, nød, korn,
			krydderi eller fermenteret — tilføj den her. Jo flere forskellige, jo bedre for
			dit tarmmikrobiom.
		</p>

		<div class="soege-omraade">
			<input
				type="text"
				bind:value={soegeOrd}
				placeholder="Søg eller skriv en plante..."
				disabled={gemmer}
				class="soege-input"
			/>
		</div>

		{#if valgte.length > 0}
			<div class="chips-omraade">
				<div class="chips-label">
					Du har {valgte.length} forskellig{valgte.length === 1 ? '' : 'e'} i alt:
				</div>
				<div class="chips">
					{#each valgte as v (v.toLowerCase())}
						<span class="chip">
							{v}
							<button
								type="button"
								class="chip-fjern"
								onclick={() => fjern(v)}
								aria-label="Fjern {v}"
								disabled={gemmer}
							>×</button>
						</span>
					{/each}
				</div>
			</div>
		{/if}

		<div class="liste-omraade">
			{#if visFritekstForslag}
				<button
					type="button"
					class="fritekst-knap"
					onclick={() => tilfoej(visFritekstForslag)}
					disabled={gemmer}
				>
					+ Tilføj "{visFritekstForslag}"
				</button>
			{/if}

			{#each visKategorier as kat (kat.id)}
				<div class="kategori-blok">
					<div class="kategori-titel">{kat.label}</div>
					<div class="kategori-items">
						{#each kat.items as item (item)}
							<button
								type="button"
								class="item-chip"
								onclick={() => tilfoej(item)}
								disabled={gemmer}
							>
								{item}
							</button>
						{/each}
					</div>
				</div>
			{:else}
				{#if !visFritekstForslag}
					<div class="tom">Ingen matcher dit søgeord — prøv at skrive det selv og tryk Tilføj.</div>
				{/if}
			{/each}
		</div>

		<footer class="dialog-foot">
			<button type="button" class="annuller" onclick={onLuk} disabled={gemmer}>
				Annuller
			</button>
			<button
				type="button"
				class="gem"
				onclick={gem}
				disabled={gemmer || valgte.length === 0}
			>
				{gemmer ? 'Gemmer...' : 'Gem'}
			</button>
		</footer>
	</div>
</div>

<style>
	.overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.45);
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 16px;
		z-index: 1000;
	}

	.dialog {
		background: var(--white);
		border-radius: 14px;
		width: 100%;
		max-width: 520px;
		max-height: calc(100vh - 32px);
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	.dialog-head {
		padding: 14px 16px;
		border-bottom: 1px solid var(--border);
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.dialog-head h2 {
		margin: 0;
		font-family: var(--ff-d);
		font-size: calc(18px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--text);
	}

	.luk {
		background: transparent;
		border: none;
		cursor: pointer;
		padding: 0 6px;
		font-size: calc(24px * var(--fs-scale, 1));
		color: var(--text2);
		line-height: 1;
		touch-action: manipulation;
	}

	.intro {
		font-size: calc(12.5px * var(--fs-scale, 1));
		color: var(--text2);
		margin: 12px 16px 8px;
		line-height: 1.45;
	}

	.soege-omraade {
		padding: 0 16px 8px;
	}

	.soege-input {
		width: 100%;
		padding: 10px 12px;
		font-size: calc(14px * var(--fs-scale, 1));
		border: 1px solid var(--border);
		border-radius: 10px;
		background: var(--bg2);
		color: var(--text);
		font-family: var(--ff-b);
		box-sizing: border-box;
	}

	.soege-input:focus {
		outline: none;
		border-color: var(--terra);
	}

	.chips-omraade {
		padding: 0 16px 8px;
	}

	.chips-label {
		font-size: calc(11px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--text2);
		letter-spacing: 0.04em;
		margin-bottom: 6px;
	}

	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}

	.chip {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		padding: 5px 4px 5px 10px;
		background: var(--sdim);
		border-radius: 99px;
		font-size: calc(12.5px * var(--fs-scale, 1));
		color: var(--sage);
		font-weight: 600;
	}

	.chip-fjern {
		background: transparent;
		border: none;
		font-size: calc(15px * var(--fs-scale, 1));
		color: var(--sage);
		cursor: pointer;
		padding: 0 6px;
		line-height: 1;
		touch-action: manipulation;
	}

	.chip-fjern:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.liste-omraade {
		flex: 1;
		overflow-y: auto;
		padding: 0 16px 12px;
		border-top: 1px solid var(--border);
	}

	.fritekst-knap {
		display: block;
		width: 100%;
		padding: 10px 14px;
		margin: 10px 0;
		background: var(--tdim);
		border: 1px dashed var(--terra);
		border-radius: 10px;
		font-family: var(--ff-b);
		font-size: calc(13px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--terra);
		cursor: pointer;
		touch-action: manipulation;
	}

	.kategori-blok {
		margin-top: 14px;
	}

	.kategori-blok:first-child {
		margin-top: 10px;
	}

	.kategori-titel {
		font-size: calc(10.5px * var(--fs-scale, 1));
		font-weight: 600;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--terra);
		margin-bottom: 8px;
	}

	.kategori-items {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}

	.item-chip {
		padding: 6px 11px;
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 99px;
		font-family: var(--ff-b);
		font-size: calc(12.5px * var(--fs-scale, 1));
		color: var(--text2);
		cursor: pointer;
		touch-action: manipulation;
	}

	.item-chip:hover:not(:disabled) {
		border-color: var(--sage);
		color: var(--sage);
		background: var(--sdim);
	}

	.item-chip:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.tom {
		padding: 24px 0;
		text-align: center;
		font-size: calc(12px * var(--fs-scale, 1));
		color: var(--text3);
		font-style: italic;
	}

	.dialog-foot {
		padding: 12px 16px 14px;
		border-top: 1px solid var(--border);
		display: flex;
		gap: 8px;
		justify-content: flex-end;
	}

	.annuller,
	.gem {
		padding: 10px 16px;
		font-family: var(--ff-b);
		font-size: calc(13px * var(--fs-scale, 1));
		font-weight: 600;
		border-radius: 10px;
		cursor: pointer;
		touch-action: manipulation;
		border: 1px solid var(--border);
	}

	.annuller {
		background: var(--white);
		color: var(--text2);
	}

	.gem {
		background: var(--terra);
		color: var(--white);
		border-color: var(--terra);
	}

	.gem:disabled,
	.annuller:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
</style>
