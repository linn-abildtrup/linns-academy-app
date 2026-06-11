<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import {
		ALLE_DIET_TAGS,
		ALLE_KATEGORIER,
		DIET_LABELS,
		KATEGORI_LABELS,
		parseOpskriftMakro,
		type DietTag,
		type Ingrediens,
		type Opskrift,
		type OpskriftKategori
	} from '$lib/content/opskrifter';
	import { gemOpskrift, hentOpskrift, sletOpskrift } from '$lib/firestore/opskrifter';
	import Icon from '$lib/components/Icon.svelte';

	const opskriftId = $derived(page.params.id ?? '');

	let original = $state<Opskrift | null>(null);

	let formTitel = $state('');
	let formBeskrivelse = $state('');
	let formBilledeUrl = $state('');
	let formKategorier = $state<OpskriftKategori[]>([]);
	let formDietTags = $state<DietTag[]>([]);
	let formDefaultPortioner = $state(4);
	let formIngredienser = $state<Ingrediens[]>([]);
	let formInstruktioner = $state('');

	// Live-aflæsning af makro fra instruktioner-feltet, saa admin med det samme
	// kan se om makroen kan parses (kunderne ser '—' hvis ikke). Protein, fiber
	// og kalorier er de "vigtige" felter 30-30-3 viser.
	const makroAflaest = $derived(parseOpskriftMakro(formInstruktioner));
	const makroMangler = $derived(
		makroAflaest.protein === null || makroAflaest.fiber === null || makroAflaest.kalorier === null
	);
	const makroResume = $derived(
		[
			`Protein ${makroAflaest.protein ?? '—'} g`,
			`Fiber ${makroAflaest.fiber ?? '—'} g`,
			`Kulhydrat ${makroAflaest.kh ?? '—'} g`,
			`Fedt ${makroAflaest.fedt ?? '—'} g`,
			`Kalorier ${makroAflaest.kalorier ?? '—'} kcal`
		].join(' · ')
	);
	let formAktiv = $state(false);

	let loading = $state(true);
	let fejl = $state<string | null>(null);
	let gemmer = $state(false);
	let gemFejl = $state<string | null>(null);
	let gemKvit = $state(false);
	let bekraefter = $state(false);
	let sletter = $state(false);

	onMount(async () => {
		try {
			const o = await hentOpskrift(opskriftId);
			if (!o) {
				fejl = 'Opskriften findes ikke.';
				loading = false;
				return;
			}
			original = o;
			formTitel = o.titel;
			formBeskrivelse = o.beskrivelse;
			formBilledeUrl = o.billedeUrl ?? '';
			formKategorier = [...o.kategorier];
			formDietTags = [...(o.dietTags ?? [])];
			formDefaultPortioner = o.defaultPortioner;
			formIngredienser = o.ingredienser.map((i) => ({ ...i }));
			formInstruktioner = o.instruktioner;
			formAktiv = o.aktiv;
		} catch (e) {
			console.error(e);
			fejl = 'Kunne ikke hente opskriften.';
		} finally {
			loading = false;
		}
	});

	function toggleKategori(k: OpskriftKategori) {
		if (formKategorier.includes(k)) {
			formKategorier = formKategorier.filter((x) => x !== k);
		} else {
			formKategorier = [...formKategorier, k];
		}
	}

	function toggleDietTag(t: DietTag) {
		if (formDietTags.includes(t)) {
			formDietTags = formDietTags.filter((x) => x !== t);
		} else {
			formDietTags = [...formDietTags, t];
		}
	}

	function tilfoejIngrediens() {
		formIngredienser = [...formIngredienser, { navn: '', maengde: 0, enhed: 'g' }];
	}

	function fjernIngrediens(index: number) {
		formIngredienser = formIngredienser.filter((_, i) => i !== index);
	}

	function flytIngrediens(index: number, retning: -1 | 1) {
		const ny = index + retning;
		if (ny < 0 || ny >= formIngredienser.length) return;
		const opdateret = [...formIngredienser];
		[opdateret[index], opdateret[ny]] = [opdateret[ny], opdateret[index]];
		formIngredienser = opdateret;
	}

	async function gem() {
		gemFejl = null;
		gemKvit = false;
		const titel = formTitel.trim();
		if (!titel) {
			gemFejl = 'Opskriften skal have en titel.';
			return;
		}
		if (formDefaultPortioner < 1) {
			gemFejl = 'Default portioner skal være mindst 1.';
			return;
		}
		gemmer = true;
		try {
			const renseIngredienser = formIngredienser
				.map((i) => ({
					navn: i.navn.trim(),
					maengde: Number(i.maengde) || 0,
					enhed: i.enhed.trim()
				}))
				.filter((i) => i.navn);
			await gemOpskrift({
				id: opskriftId,
				titel,
				beskrivelse: formBeskrivelse.trim(),
				billedeUrl: formBilledeUrl.trim() || null,
				kategorier: formKategorier,
				dietTags: formDietTags,
				defaultPortioner: formDefaultPortioner,
				ingredienser: renseIngredienser,
				instruktioner: formInstruktioner.trim(),
				aktiv: formAktiv
			});
			gemKvit = true;
			setTimeout(() => (gemKvit = false), 2000);
		} catch (e) {
			console.error(e);
			gemFejl = 'Kunne ikke gemme. Prøv igen.';
		} finally {
			gemmer = false;
		}
	}

	async function slet() {
		if (!bekraefter) {
			bekraefter = true;
			return;
		}
		sletter = true;
		try {
			await sletOpskrift(opskriftId);
			goto('/app/admin/opskrifter');
		} catch (e) {
			console.error(e);
			gemFejl = 'Kunne ikke slette opskriften.';
			sletter = false;
		}
	}
</script>

<div class="page">
	<header class="page-header">
		<a class="back" href="/app/admin/opskrifter">
			<Icon name="arrow-l" size={14} color="var(--text2)" />
			<span>Opskrifter</span>
		</a>
		<div class="eyebrow">Admin · Opskrifter</div>
		<h1>{formTitel || 'Ny opskrift'}</h1>
	</header>

	{#if loading}
		<div class="status-besked">Henter opskrift...</div>
	{:else if fejl}
		<div class="status-besked fejl">{fejl}</div>
	{:else if original}
		<section class="card">
			<div class="form-titel">Generelt</div>

			<label class="felt">
				<span class="felt-label">Titel</span>
				<input type="text" bind:value={formTitel} disabled={gemmer} />
			</label>

			<label class="felt">
				<span class="felt-label">Beskrivelse</span>
				<textarea
					class="textarea"
					bind:value={formBeskrivelse}
					rows="3"
					disabled={gemmer}
					placeholder="Kort beskrivelse der vises på opskriftens detalje-side..."
				></textarea>
			</label>

			<label class="felt">
				<span class="felt-label">Billede-URL</span>
				<input type="url" bind:value={formBilledeUrl} disabled={gemmer} placeholder="https://..." />
				<span class="felt-hint">
					Brug en hosted URL for nu. Upload via Firebase Storage tilføjes senere.
				</span>
			</label>

			<div class="felt">
				<span class="felt-label">Kategorier</span>
				<div class="chip-rad">
					{#each ALLE_KATEGORIER as k (k)}
						<button
							type="button"
							class="chip"
							class:aktiv={formKategorier.includes(k)}
							onclick={() => toggleKategori(k)}
							disabled={gemmer}
						>
							{KATEGORI_LABELS[k]}
						</button>
					{/each}
				</div>
			</div>

			<div class="felt">
				<span class="felt-label">Diæt-tags</span>
				<div class="chip-rad">
					{#each ALLE_DIET_TAGS as t (t)}
						<button
							type="button"
							class="chip"
							class:aktiv={formDietTags.includes(t)}
							onclick={() => toggleDietTag(t)}
							disabled={gemmer}
						>
							{DIET_LABELS[t]}
						</button>
					{/each}
				</div>
			</div>

			<label class="felt">
				<span class="felt-label">Default antal portioner</span>
				<input type="number" min="1" max="20" bind:value={formDefaultPortioner} disabled={gemmer} />
				<span class="felt-hint">Brugeren kan justere op/ned, og mængderne skaleres.</span>
			</label>

			<label class="checkbox-rad">
				<input type="checkbox" bind:checked={formAktiv} disabled={gemmer} />
				<span>Aktiv (synlig for brugerne)</span>
			</label>
		</section>

		<section class="card">
			<div class="form-titel">Ingredienser</div>
			<p class="hint">
				Mængder er for default-portioner ovenfor. Klienten kan skalere ved at justere
				portion-tællen.
			</p>
			{#each formIngredienser as ing, i (i)}
				<div class="ing-form">
					<div class="ing-form-rad">
						<input
							class="ing-maengde"
							type="number"
							min="0"
							step="0.5"
							placeholder="0"
							bind:value={formIngredienser[i].maengde}
							disabled={gemmer}
						/>
						<input
							class="ing-enhed"
							type="text"
							placeholder="g"
							bind:value={formIngredienser[i].enhed}
							disabled={gemmer}
						/>
						<input
							class="ing-navn"
							type="text"
							placeholder="navn"
							bind:value={formIngredienser[i].navn}
							disabled={gemmer}
						/>
					</div>
					<div class="ing-handlinger">
						<button
							type="button"
							class="ikon-knap"
							onclick={() => flytIngrediens(i, -1)}
							disabled={gemmer || i === 0}
							aria-label="Flyt op">↑</button
						>
						<button
							type="button"
							class="ikon-knap"
							onclick={() => flytIngrediens(i, 1)}
							disabled={gemmer || i === formIngredienser.length - 1}
							aria-label="Flyt ned">↓</button
						>
						<button
							type="button"
							class="ikon-knap"
							onclick={() => fjernIngrediens(i)}
							disabled={gemmer}
							aria-label="Fjern">×</button
						>
					</div>
				</div>
			{/each}
			<button class="ghost-knap" type="button" onclick={tilfoejIngrediens} disabled={gemmer}>
				+ Tilføj ingrediens
			</button>
		</section>

		<section class="card">
			<div class="form-titel">Fremgangsmåde</div>
			<textarea
				class="textarea"
				bind:value={formInstruktioner}
				rows="10"
				disabled={gemmer}
				placeholder="1. Start med...&#10;2. Fortsæt med..."
			></textarea>
			<p class="hint">Skriv hvert trin på sin egen linje. Tomme linjer giver afsnit.</p>
			{#if formInstruktioner.trim()}
				<div class="makro-aflaest" class:advarsel={makroMangler}>
					{#if makroMangler}
						<strong>⚠️ Kunne ikke aflæse al makro fra teksten.</strong>
						<span>
							Kunden ser "—" for de manglende felter. Skriv makroen et sted i teksten, fx:
							<code
								>Protein: 30 g · Fiber: 8 g · Kulhydrater: 40 g · Fedt: 12 g · Kalorier: 380 kcal</code
							>
						</span>
						<span class="aflaest-nu">Aflæst nu: {makroResume}</span>
					{:else}
						<strong>✓ Makro aflæst:</strong>
						<span>{makroResume}</span>
					{/if}
				</div>
			{/if}
		</section>

		{#if gemFejl}
			<div class="fejl-besked">{gemFejl}</div>
		{/if}
		{#if gemKvit}
			<div class="kvit-besked">Gemt ✓</div>
		{/if}

		<button class="primary-knap" type="button" onclick={gem} disabled={gemmer}>
			{gemmer ? 'Gemmer...' : 'Gem opskrift'}
		</button>

		<div class="slet-omraade">
			{#if !bekraefter}
				<button class="slet-knap" type="button" onclick={slet}>Slet opskrift</button>
			{:else}
				<div class="slet-bekraeft">
					<div class="slet-tekst">Slet opskriften permanent?</div>
					<div class="slet-knapper">
						<button
							class="form-knap ghost"
							type="button"
							onclick={() => (bekraefter = false)}
							disabled={sletter}
						>
							Annuller
						</button>
						<button class="form-knap danger" type="button" onclick={slet} disabled={sletter}>
							{sletter ? 'Sletter...' : 'Ja, slet'}
						</button>
					</div>
				</div>
			{/if}
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
		font-size: calc(26px * var(--fs-scale, 1));
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
		font-size: calc(13px * var(--fs-scale, 1));
		text-align: center;
		margin-bottom: 14px;
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
		display: flex;
		flex-direction: column;
		gap: 12px;
		margin-bottom: 14px;
	}

	.form-titel {
		font-family: var(--ff-d);
		font-size: calc(16px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--text);
	}

	.hint {
		font-size: calc(11.5px * var(--fs-scale, 1));
		color: var(--text3);
		margin: 0;
		line-height: 1.45;
	}

	.makro-aflaest {
		margin-top: 10px;
		padding: 10px 12px;
		border-radius: 8px;
		background: #eef4ef;
		border-left: 3px solid var(--sage, #6f9e7e);
		font-size: calc(12px * var(--fs-scale, 1));
		line-height: 1.5;
		color: var(--text2);
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.makro-aflaest.advarsel {
		background: #fdf0d5;
		border-left-color: #b8860b;
	}

	.makro-aflaest code {
		font-size: calc(11px * var(--fs-scale, 1));
		background: rgba(0, 0, 0, 0.05);
		padding: 1px 5px;
		border-radius: 4px;
	}

	.makro-aflaest .aflaest-nu {
		color: var(--text3);
		font-size: calc(11px * var(--fs-scale, 1));
	}

	.felt {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.felt-label {
		font-size: calc(11px * var(--fs-scale, 1));
		font-weight: 600;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--text3);
	}

	.felt input,
	.textarea {
		padding: 10px 12px;
		font-size: calc(14px * var(--fs-scale, 1));
		border-radius: 10px;
		border: 1px solid var(--border);
		background: var(--bg2);
		color: var(--text);
		font-family: var(--ff-b);
		outline: none;
	}

	.textarea {
		resize: vertical;
		line-height: 1.5;
	}

	.felt input:focus,
	.textarea:focus {
		border-color: var(--terra);
	}

	.felt-hint {
		font-size: calc(11px * var(--fs-scale, 1));
		color: var(--text4);
	}

	.chip-rad {
		display: flex;
		gap: 6px;
		flex-wrap: wrap;
	}

	.chip {
		padding: 7px 12px;
		font-size: calc(12px * var(--fs-scale, 1));
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

	.chip:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.checkbox-rad {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: calc(13px * var(--fs-scale, 1));
		color: var(--text2);
		cursor: pointer;
	}

	.checkbox-rad input {
		width: 16px;
		height: 16px;
		accent-color: var(--terra);
	}

	.ing-form {
		display: flex;
		gap: 6px;
		align-items: stretch;
	}

	.ing-form-rad {
		display: grid;
		grid-template-columns: 70px 70px 1fr;
		gap: 6px;
		flex: 1;
	}

	.ing-maengde,
	.ing-enhed,
	.ing-navn {
		padding: 8px 10px;
		font-size: calc(13px * var(--fs-scale, 1));
		border-radius: 8px;
		border: 1px solid var(--border);
		background: var(--bg2);
		font-family: var(--ff-b);
	}

	.ing-handlinger {
		display: flex;
		gap: 4px;
	}

	.ikon-knap {
		width: 32px;
		height: 32px;
		border-radius: 8px;
		background: var(--bg2);
		border: 1px solid var(--border);
		color: var(--text3);
		font-size: calc(14px * var(--fs-scale, 1));
		cursor: pointer;
		font-family: var(--ff-b);
	}

	.ikon-knap:hover:not(:disabled) {
		background: #fbeeea;
		color: #8a4a3e;
	}

	.ikon-knap:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.ghost-knap {
		padding: 10px 14px;
		font-size: calc(13px * var(--fs-scale, 1));
		font-weight: 500;
		border-radius: 10px;
		background: var(--bg2);
		border: 1px dashed var(--border);
		color: var(--text2);
		cursor: pointer;
		font-family: var(--ff-b);
		align-self: flex-start;
	}

	.ghost-knap:hover {
		background: var(--white);
		border-color: var(--terra);
		color: var(--terra);
	}

	.fejl-besked {
		padding: 10px 12px;
		background: #fbeeea;
		border: 1px solid #f0d6cf;
		border-radius: 8px;
		font-size: calc(12px * var(--fs-scale, 1));
		color: #8a4a3e;
		margin-bottom: 12px;
	}

	.kvit-besked {
		padding: 8px 12px;
		background: var(--sdim);
		border-radius: 8px;
		font-size: calc(12px * var(--fs-scale, 1));
		color: var(--sage);
		text-align: center;
		margin-bottom: 12px;
	}

	.primary-knap {
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
	}

	.primary-knap:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.slet-omraade {
		margin-top: 24px;
	}

	.slet-knap {
		background: none;
		border: 1px solid #e8c8c1;
		color: #b8503f;
		font-size: calc(13px * var(--fs-scale, 1));
		font-weight: 500;
		padding: 10px 16px;
		border-radius: 10px;
		cursor: pointer;
		font-family: var(--ff-b);
	}

	.slet-knap:hover {
		background: #fbeeea;
	}

	.slet-bekraeft {
		background: #fbeeea;
		border: 1px solid #f0d6cf;
		border-radius: 12px;
		padding: 14px;
	}

	.slet-tekst {
		font-size: calc(13px * var(--fs-scale, 1));
		color: #8a4a3e;
		margin-bottom: 10px;
	}

	.slet-knapper {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 10px;
	}

	.form-knap {
		padding: 11px;
		font-size: calc(13px * var(--fs-scale, 1));
		font-weight: 600;
		border-radius: 8px;
		border: none;
		cursor: pointer;
		font-family: var(--ff-b);
	}

	.form-knap.ghost {
		background: var(--white);
		border: 1px solid var(--border);
		color: var(--text2);
	}

	.form-knap.danger {
		background: #b8503f;
		color: #fff;
	}

	.form-knap:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}
</style>
