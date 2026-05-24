<script lang="ts">
	import { getContext, onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import type { User } from 'firebase/auth';
	import {
		DIET_LABELS,
		formatMaengde,
		KATEGORI_LABELS,
		parseOpskriftMakro,
		skalerMaengde,
		type Opskrift
	} from '$lib/content/opskrifter';
	import { hentOpskrift } from '$lib/firestore/opskrifter';
	import { gemMaaltid, hentAlleFodevarer } from '$lib/firestore/kost';
	import {
		formatDatoKey,
		gaetMaaltidstype,
		MAALTIDSTYPER,
		MAALTIDSTYPE_LABELS,
		matchIngredienserMaltid,
		type Fodevare,
		type MaaltidsItem,
		type Maaltidstype
	} from '$lib/content/kost';
	import Icon from '$lib/components/Icon.svelte';
	import Loading from '$lib/components/Loading.svelte';

	const STORAGE_KEY = 'la_30303_maaltid_v1';

	const getUser = getContext<() => User | null>('user');
	const user = $derived(getUser());

	const opskriftId = $derived(page.params.id ?? '');
	// Når brugeren kommer fra biblioteket (?fra=bibliotek) skjules
	// "tilføj til byg-måltid"-knappen — bibliotek-flowet er rent læse-orienteret.
	const fraBibliotek = $derived(page.url.searchParams.get('fra') === 'bibliotek');

	let opskrift = $state<Opskrift | null>(null);
	let foods = $state<Fodevare[]>([]);
	let loading = $state(true);
	let fejl = $state<string | null>(null);
	let portioner = $state(0);

	let tilfoejer = $state(false);
	let tilfoejBesked = $state<{ tekst: string; type: 'ok' | 'advarsel' } | null>(null);

	// 'Gem direkte i dagbog'-modal
	let viserMaaltidModal = $state(false);

	// Laas body-scroll naar modalen er aaben — ellers scroller iOS Safari
	// baggrunden i stedet for modal-indholdet.
	$effect(() => {
		if (typeof document === 'undefined') return;
		if (viserMaaltidModal) {
			document.body.style.overflow = 'hidden';
			return () => {
				document.body.style.overflow = '';
			};
		}
	});
	let maaltidPortioner = $state(1);
	let maaltidDato = $state(formatDatoKey());
	let maaltidType = $state<Maaltidstype>(gaetMaaltidstype());
	let gemmerMaaltid = $state(false);
	let maaltidBesked = $state<string | null>(null);

	const skaleretMakro = $derived<{
		protein: number | null;
		fiber: number | null;
		kh: number | null;
		fedt: number | null;
		kalorier: number | null;
	}>(
		opskrift
			? (() => {
					const m = parseOpskriftMakro(opskrift.instruktioner);
					const p = Math.max(0.01, maaltidPortioner);
					const skala = p / (opskrift.defaultPortioner || 1);
					const round1 = (v: number) => Math.round(v * 10) / 10;
					return {
						protein: m.protein === null ? null : round1(m.protein * skala),
						fiber: m.fiber === null ? null : round1(m.fiber * skala),
						kh: m.kh === null ? null : round1(m.kh * skala),
						fedt: m.fedt === null ? null : round1(m.fedt * skala),
						kalorier: m.kalorier === null ? null : Math.round(m.kalorier * skala)
					};
				})()
			: { protein: null, fiber: null, kh: null, fedt: null, kalorier: null }
	);

	function aabnMaaltidModal() {
		if (!opskrift) return;
		maaltidPortioner = 1;
		maaltidDato = formatDatoKey();
		maaltidType = gaetMaaltidstype();
		maaltidBesked = null;
		viserMaaltidModal = true;
	}

	function lukMaaltidModal() {
		if (gemmerMaaltid) return;
		viserMaaltidModal = false;
		maaltidBesked = null;
	}

	async function gemSomMaaltid() {
		const u = user;
		if (!u || !opskrift || gemmerMaaltid) return;
		const p = Math.max(0.01, maaltidPortioner);
		gemmerMaaltid = true;
		maaltidBesked = null;
		try {
			const portionTekst = p === 1 ? 'portion' : 'portioner';
			await gemMaaltid(u.uid, {
				navn: opskrift.titel,
				type: maaltidType,
				dato: maaltidDato,
				items: [
					{
						foodId: '',
						portion: p,
						manuel: { navn: opskrift.titel, enhed: portionTekst },
						opskriftRef: { id: opskrift.id, erEgen: false }
					}
				],
				totalP: skaleretMakro.protein ?? 0,
				totalF: skaleretMakro.fiber ?? 0,
				totalKh: skaleretMakro.kh ?? 0,
				totalFedt: skaleretMakro.fedt ?? 0,
				totalKcal: skaleretMakro.kalorier ?? 0
			});
			viserMaaltidModal = false;
			goto(`/app/moduler/30-30-3?tab=dagbog&dato=${maaltidDato}`);
		} catch (e) {
			console.error(e);
			maaltidBesked = 'Kunne ikke gemme måltidet. Prøv igen.';
		} finally {
			gemmerMaaltid = false;
		}
	}

	onMount(async () => {
		try {
			const [o, allFoods] = await Promise.all([
				hentOpskrift(opskriftId),
				hentAlleFodevarer()
			]);
			if (!o) {
				fejl = 'Opskriften blev ikke fundet.';
				loading = false;
				return;
			}
			opskrift = o;
			foods = allFoods;
			portioner = o.defaultPortioner || 4;
		} catch (e) {
			console.error(e);
			fejl = 'Kunne ikke hente opskriften.';
		} finally {
			loading = false;
		}
	});

	function aendrePortioner(delta: number) {
		const ny = Math.max(1, Math.min(20, portioner + delta));
		portioner = ny;
	}

	async function tilfoejTilMaaltid() {
		if (!opskrift || tilfoejer) return;
		tilfoejer = true;
		tilfoejBesked = null;
		try {
			const skaleredeIngredienser = opskrift.ingredienser.map((ing) => ({
				...ing,
				maengde: skalerMaengde(ing.maengde, opskrift!.defaultPortioner, portioner)
			}));
			const { items, ikkeMatchede } = matchIngredienserMaltid(skaleredeIngredienser, foods);

			let nuvaerende: MaaltidsItem[] = [];
			try {
				const raw = localStorage.getItem(STORAGE_KEY);
				if (raw) {
					const parsed = JSON.parse(raw);
					if (Array.isArray(parsed)) nuvaerende = parsed;
				}
			} catch {
				// ignorer fejl ved læsning
			}
			const opdateret = [...nuvaerende, ...items];
			localStorage.setItem(STORAGE_KEY, JSON.stringify(opdateret));

			const matchede = items.length - ikkeMatchede.length;
			if (ikkeMatchede.length === 0) {
				tilfoejBesked = {
					tekst: `${items.length} ingredienser tilføjet til dit måltid.`,
					type: 'ok'
				};
			} else {
				tilfoejBesked = {
					tekst:
						`${items.length} ingredienser tilføjet (${matchede} med protein/fiber-beregning, ${ikkeMatchede.length} manuelle). ` +
						`Klik på de manuelle for at koble dem til en fødevare i databasen.`,
					type: 'advarsel'
				};
			}
			setTimeout(() => goto('/app/moduler/30-30-3?tab=maaltid'), 1500);
		} catch (e) {
			console.error(e);
			tilfoejBesked = { tekst: 'Kunne ikke tilføje til måltid. Prøv igen.', type: 'advarsel' };
			tilfoejer = false;
		}
	}
</script>

<div class="page">
	<header class="page-header">
		<a class="back" href="/app/moduler/30-30-3?tab=opskrifter">
			<Icon name="arrow-l" size={14} color="var(--text2)" />
			<span>Opskrifter</span>
		</a>
	</header>

	{#if loading}
		<Loading tekst="Henter opskrift..." />
	{:else if fejl}
		<div class="status-besked fejl">{fejl}</div>
	{:else if opskrift}
		<div class="hero">
			{#if opskrift.billedeUrl}
				<img
					class="hero-img"
					src={opskrift.billedeUrl}
					alt={opskrift.titel}
					width="800"
					height="600"
					fetchpriority="high"
					decoding="async"
				/>
			{:else}
				<div class="hero-emoji">🍽️</div>
			{/if}
		</div>

		<h1>{opskrift.titel}</h1>
		{#if opskrift.kategorier.length > 0 || (opskrift.dietTags && opskrift.dietTags.length > 0)}
			<div class="kategorier">
				{#each opskrift.kategorier as k (k)}
					<span class="kategori-badge">{KATEGORI_LABELS[k]}</span>
				{/each}
				{#each opskrift.dietTags ?? [] as t (t)}
					<span class="kategori-badge diet">{DIET_LABELS[t]}</span>
				{/each}
			</div>
		{/if}
		{#if opskrift.beskrivelse}
			<p class="beskrivelse">{opskrift.beskrivelse}</p>
		{/if}

		{#if opskrift.ingredienser.length > 0}
			<section class="card">
				<div class="section-label">Ingredienser</div>
				<div class="portion-rad">
					<button
						class="portion-knap"
						type="button"
						onclick={() => aendrePortioner(-1)}
						disabled={portioner <= 1}
						aria-label="Færre portioner"
					>
						−
					</button>
					<div class="portion-num">{portioner}</div>
					<button
						class="portion-knap"
						type="button"
						onclick={() => aendrePortioner(1)}
						aria-label="Flere portioner"
					>
						+
					</button>
					<div class="portion-label">
						person{portioner === 1 ? '' : 'er'}
					</div>
				</div>

				<div class="ingredienser">
					{#each opskrift.ingredienser as ing (ing.navn)}
						{@const skala = skalerMaengde(ing.maengde, opskrift.defaultPortioner, portioner)}
						<div class="ing-row">
							<div class="ing-mængde">
								{formatMaengde(skala)}
								{ing.enhed}
							</div>
							<div class="ing-navn">{ing.navn}</div>
						</div>
					{/each}
				</div>
			</section>
		{/if}

		{#if opskrift.instruktioner.trim()}
			<section class="card">
				<div class="section-label">Fremgangsmåde</div>
				<div class="instruktioner">{opskrift.instruktioner}</div>
			</section>
		{/if}

		{#if opskrift.ingredienser.length > 0 && !fraBibliotek}
			{#if tilfoejBesked}
				<div class="tilfoej-besked {tilfoejBesked.type}">{tilfoejBesked.tekst}</div>
			{/if}
			<button
				class="primary-knap log-direkte-knap"
				type="button"
				onclick={aabnMaaltidModal}
			>
				✚ Log som måltid i dagbog
			</button>
			<button
				class="ghost-knap"
				type="button"
				onclick={tilfoejTilMaaltid}
				disabled={tilfoejer}
			>
				{tilfoejer ? 'Tilføjer...' : `Tilføj ingredienser til byg-måltid (${portioner} pers.)`}
			</button>
		{/if}
	{/if}
</div>

{#if viserMaaltidModal && opskrift}
	<div
		class="modal-bag"
		role="dialog"
		aria-modal="true"
		tabindex="-1"
		onclick={(e) => {
			if (e.target === e.currentTarget) lukMaaltidModal();
		}}
		onkeydown={(e) => {
			if (e.key === 'Escape') lukMaaltidModal();
		}}
	>
		<div class="modal">
			<div class="modal-head">
				<h2>Log som måltid i dagbog</h2>
				<button class="modal-luk" type="button" onclick={lukMaaltidModal} aria-label="Luk">
					×
				</button>
			</div>

			<div class="modal-info">
				<div class="modal-info-navn">{opskrift.titel}</div>
				<div class="modal-info-meta">
					Opskriften er beregnet til {opskrift.defaultPortioner}
					{opskrift.defaultPortioner === 1 ? 'portion' : 'portioner'}
				</div>
			</div>

			<label class="felt">
				<span class="felt-label">Hvor mange portioner spiser du?</span>
				<div class="portion-rad">
					{#each [0.5, 1, 1.5, 2] as p (p)}
						<button
							type="button"
							class="portion-chip"
							class:aktiv={maaltidPortioner === p}
							onclick={() => (maaltidPortioner = p)}
						>
							{p}
						</button>
					{/each}
				</div>
				<input
					type="number"
					min="0.25"
					step="0.25"
					bind:value={maaltidPortioner}
					class="portion-input"
				/>
			</label>

			<label class="felt">
				<span class="felt-label">Dato</span>
				<input type="date" bind:value={maaltidDato} />
			</label>

			<label class="felt">
				<span class="felt-label">Måltidstype</span>
				<select bind:value={maaltidType}>
					{#each MAALTIDSTYPER as t (t)}
						<option value={t}>{MAALTIDSTYPE_LABELS[t]}</option>
					{/each}
				</select>
			</label>

			<div class="modal-makro">
				<div class="modal-makro-titel">Makro i dette måltid</div>
				<div class="modal-makro-grid">
					<div><strong>{skaleretMakro.protein === null ? '—' : skaleretMakro.protein + 'g'}</strong><span>Protein</span></div>
					<div><strong>{skaleretMakro.fiber === null ? '—' : skaleretMakro.fiber + 'g'}</strong><span>Fiber</span></div>
					<div><strong>{skaleretMakro.kh === null ? '—' : skaleretMakro.kh + 'g'}</strong><span>Kulhydrater</span></div>
					<div><strong>{skaleretMakro.fedt === null ? '—' : skaleretMakro.fedt + 'g'}</strong><span>Fedt</span></div>
					<div><strong>{skaleretMakro.kalorier === null ? '—' : skaleretMakro.kalorier}</strong><span>Kalorier</span></div>
				</div>
			</div>

			{#if maaltidBesked}
				<div class="status-besked fejl">{maaltidBesked}</div>
			{/if}

			<button
				class="primary-knap"
				type="button"
				onclick={gemSomMaaltid}
				disabled={gemmerMaaltid || maaltidPortioner <= 0}
			>
				{gemmerMaaltid ? 'Gemmer...' : 'Læg ind i dagbog'}
			</button>
			<button class="ghost-knap" type="button" onclick={lukMaaltidModal} disabled={gemmerMaaltid}>
				Annullér
			</button>
		</div>
	</div>
{/if}

<style>
	.page {
		padding: 18px 18px 100px;
		max-width: 520px;
		margin: 0 auto;
	}

	.page-header {
		margin-bottom: 12px;
	}

	.back {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-size: calc(12px * var(--fs-scale, 1));
		color: var(--text2);
		text-decoration: none;
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

	.hero {
		aspect-ratio: 16 / 10;
		background: var(--bg2);
		border-radius: 16px;
		overflow: hidden;
		display: flex;
		align-items: center;
		justify-content: center;
		margin-bottom: 14px;
	}

	.hero-img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.hero-emoji {
		font-size: calc(56px * var(--fs-scale, 1));
		opacity: 0.4;
	}

	h1 {
		font-family: var(--ff-d);
		font-size: calc(28px * var(--fs-scale, 1));
		font-weight: 600;
		letter-spacing: -0.02em;
		margin: 0 0 8px;
		line-height: 1.1;
		color: var(--text);
	}

	.kategorier {
		display: flex;
		gap: 6px;
		flex-wrap: wrap;
		margin-bottom: 10px;
	}

	.kategori-badge {
		font-size: calc(10.5px * var(--fs-scale, 1));
		letter-spacing: 0.06em;
		color: var(--terra);
		background: var(--tdim);
		padding: 3px 9px;
		border-radius: 99px;
		font-weight: 500;
	}

	.kategori-badge.diet {
		color: var(--sage);
		background: var(--sdim);
	}

	.beskrivelse {
		font-size: calc(13.5px * var(--fs-scale, 1));
		color: var(--text2);
		line-height: 1.55;
		margin: 0 0 16px;
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

	.portion-rad {
		display: flex;
		align-items: center;
		gap: 10px;
		margin-bottom: 14px;
	}

	.portion-knap {
		width: 32px;
		height: 32px;
		border-radius: 50%;
		background: var(--bg2);
		border: 1px solid var(--border);
		font-size: calc(18px * var(--fs-scale, 1));
		color: var(--text2);
		cursor: pointer;
		font-family: var(--ff-b);
	}

	.portion-knap:hover:not(:disabled) {
		background: var(--terra);
		color: #fff;
		border-color: var(--terra);
	}

	.portion-knap:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.portion-num {
		font-family: var(--ff-d);
		font-size: calc(22px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--text);
		min-width: 32px;
		text-align: center;
	}

	.portion-label {
		font-size: calc(13px * var(--fs-scale, 1));
		color: var(--text3);
	}

	.ingredienser {
		display: flex;
		flex-direction: column;
	}

	.ing-row {
		display: grid;
		grid-template-columns: 100px 1fr;
		gap: 12px;
		padding: 10px 0;
		border-top: 1px solid var(--border);
		font-size: calc(14px * var(--fs-scale, 1));
	}

	.ing-row:first-child {
		border-top: none;
	}

	.ing-mængde {
		color: var(--terra);
		font-weight: 600;
	}

	.ing-navn {
		color: var(--text);
	}

	.instruktioner {
		font-size: calc(14px * var(--fs-scale, 1));
		line-height: 1.6;
		color: var(--text);
		white-space: pre-wrap;
	}

	.primary-knap {
		display: block;
		width: 100%;
		padding: 14px;
		background: var(--terra);
		color: #fff;
		font-size: calc(14px * var(--fs-scale, 1));
		font-weight: 600;
		border-radius: 12px;
		border: none;
		cursor: pointer;
		font-family: var(--ff-b);
		margin-top: 8px;
	}

	.primary-knap:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.tilfoej-besked {
		padding: 12px 14px;
		border-radius: 10px;
		font-size: calc(12.5px * var(--fs-scale, 1));
		line-height: 1.5;
		margin-bottom: 10px;
	}

	.tilfoej-besked.ok {
		background: var(--sdim);
		color: var(--sage);
	}

	.tilfoej-besked.advarsel {
		background: #fdf3e7;
		color: #8a6a3c;
		border: 1px solid #ecd9b8;
	}

	.ghost-knap {
		display: block;
		width: 100%;
		padding: 13px;
		background: transparent;
		color: var(--text2);
		font-size: calc(13px * var(--fs-scale, 1));
		font-weight: 500;
		border-radius: 10px;
		border: 1px solid var(--border);
		cursor: pointer;
		font-family: var(--ff-b);
		margin-top: 8px;
	}

	.ghost-knap:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.log-direkte-knap {
		margin-bottom: 0;
	}

	/* Modal til 'Log som måltid i dagbog' */
	.modal-bag {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.4);
		display: flex;
		align-items: flex-end;
		justify-content: center;
		z-index: 100;
	}

	.modal {
		width: 100%;
		max-width: 520px;
		max-height: 92vh;
		overflow-y: auto;
		overscroll-behavior: contain;
		-webkit-overflow-scrolling: touch;
		background: var(--bg, #f6f3ee);
		border-radius: 18px 18px 0 0;
		padding: 18px 18px 28px;
	}

	@media (min-width: 600px) {
		.modal-bag {
			align-items: center;
		}
		.modal {
			border-radius: 18px;
			max-height: 88vh;
		}
	}

	.modal-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 10px;
	}

	.modal h2 {
		font-family: var(--ff-d);
		font-size: calc(20px * var(--fs-scale, 1));
		font-weight: 600;
		margin: 0;
		color: var(--text);
	}

	.modal-luk {
		background: none;
		border: none;
		font-size: 26px;
		color: var(--text3);
		cursor: pointer;
		line-height: 1;
		padding: 4px 8px;
	}

	.modal-info {
		padding: 10px 12px;
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 10px;
		margin-bottom: 14px;
	}

	.modal-info-navn {
		font-weight: 600;
		color: var(--text);
		font-size: calc(14px * var(--fs-scale, 1));
	}

	.modal-info-meta {
		font-size: calc(11px * var(--fs-scale, 1));
		color: var(--text3);
		margin-top: 2px;
	}

	.felt {
		display: flex;
		flex-direction: column;
		gap: 4px;
		margin-bottom: 12px;
	}

	.felt-label {
		font-size: calc(11px * var(--fs-scale, 1));
		font-weight: 600;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--text3);
	}

	.modal .felt select,
	.modal .felt input[type='date'] {
		width: 100%;
		padding: 10px 12px;
		border: 1px solid var(--border);
		border-radius: 8px;
		background: var(--bg2);
		font-family: var(--ff-b);
		font-size: max(16px, calc(14px * var(--fs-scale, 1)));
		color: var(--text);
		outline: none;
		box-sizing: border-box;
	}

	.portion-rad {
		display: flex;
		gap: 6px;
		margin-bottom: 6px;
	}

	.portion-chip {
		flex: 1;
		padding: 10px 4px;
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 10px;
		font-family: var(--ff-b);
		font-size: calc(14px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--text2);
		cursor: pointer;
	}

	.portion-chip.aktiv {
		background: var(--terra);
		border-color: var(--terra);
		color: #fff;
	}

	.portion-input {
		width: 100%;
		padding: 10px 12px;
		border: 1px solid var(--border);
		border-radius: 8px;
		background: var(--bg2);
		font-family: var(--ff-b);
		font-size: max(16px, calc(14px * var(--fs-scale, 1)));
		color: var(--text);
		outline: none;
		box-sizing: border-box;
	}

	.modal-makro {
		background: var(--sdim, #eaf0e7);
		border: 1px solid var(--sage, #b7c8a5);
		border-radius: 12px;
		padding: 12px;
		margin: 14px 0;
	}

	.modal-makro-titel {
		font-size: calc(10px * var(--fs-scale, 1));
		font-weight: 600;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: var(--text3);
		margin-bottom: 8px;
	}

	.modal-makro-grid {
		display: grid;
		grid-template-columns: repeat(5, 1fr);
		gap: 6px;
	}

	.modal-makro-grid > div {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 8px 4px;
		background: var(--white);
		border-radius: 8px;
	}

	.modal-makro-grid strong {
		font-family: var(--ff-d);
		font-size: calc(14px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--terra);
	}

	.modal-makro-grid span {
		font-size: calc(10px * var(--fs-scale, 1));
		color: var(--text3);
		margin-top: 2px;
	}
</style>
