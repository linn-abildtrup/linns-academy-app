<script lang="ts">
	import { getContext, onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import type { User } from 'firebase/auth';
	import { gemMinOpskrift, hentMinOpskrift, sletMinOpskrift } from '$lib/firestore/minOpskrift';
	import { storage } from '$lib/firebase';
	import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
	import type {
		MinOpskrift,
		MinOpskriftIngrediens,
		MinOpskriftMakro
	} from '$lib/content/minOpskrift';
	import { DEFAULT_MAKRO } from '$lib/content/minOpskrift';
	import Icon from '$lib/components/Icon.svelte';
	import Loading from '$lib/components/Loading.svelte';

	const getUser = getContext<() => User | null>('user');
	const user = $derived(getUser());

	const id = $derived(page.params.id ?? '');

	let opskrift = $state<MinOpskrift | null>(null);
	let loading = $state(true);
	let fejl = $state<string | null>(null);
	let sletter = $state(false);
	let editMode = $state(false);
	let gemmer = $state(false);
	let gemBesked = $state<string | null>(null);

	// Edit-state — kopieres fra opskrift når rediger trykkes
	let navn = $state('');
	let antalPortioner = $state(4);
	let ingredienser = $state<MinOpskriftIngrediens[]>([]);
	let makro = $state<MinOpskriftMakro>({ ...DEFAULT_MAKRO });
	let nyBilledeFil = $state<File | null>(null);
	let nyBilledePreview = $state<string | null>(null);

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

	function startRediger() {
		if (!opskrift) return;
		navn = opskrift.navn;
		antalPortioner = opskrift.antalPortioner;
		ingredienser = opskrift.ingredienser.map((i) => ({ ...i }));
		makro = { ...opskrift.makroPrPortion };
		nyBilledeFil = null;
		nyBilledePreview = null;
		editMode = true;
		gemBesked = null;
	}

	function annullerRediger() {
		editMode = false;
		nyBilledeFil = null;
		nyBilledePreview = null;
		gemBesked = null;
	}

	function handleNyBillede(e: Event) {
		const input = e.target as HTMLInputElement;
		const fil = input.files?.[0];
		if (!fil) return;
		if (!fil.type.startsWith('image/')) {
			gemBesked = 'Vælg venligst en billed-fil.';
			return;
		}
		if (fil.size > 5 * 1024 * 1024) {
			gemBesked = 'Billedet er for stort. Max 5 MB.';
			return;
		}
		nyBilledeFil = fil;
		nyBilledePreview = URL.createObjectURL(fil);
		gemBesked = null;
	}

	function fjernNyBillede() {
		nyBilledeFil = null;
		nyBilledePreview = null;
	}

	function tilfojIngrediens() {
		ingredienser = [...ingredienser, { navn: '', maengde: 0, enhed: 'g' }];
	}

	function fjernIngrediens(i: number) {
		ingredienser = ingredienser.filter((_, idx) => idx !== i);
	}

	async function gem() {
		const u = user;
		if (!u || gemmer) return;
		gemmer = true;
		gemBesked = null;
		try {
			let nyBilledeUrl: string | undefined;
			let gammelBilledeUrl: string | undefined;
			if (nyBilledeFil) {
				// Upload nyt billede
				const billedeId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
				const sti = `users/${u.uid}/opskrift-billeder/${billedeId}`;
				const billedeRef = ref(storage, sti);
				await uploadBytes(billedeRef, nyBilledeFil);
				nyBilledeUrl = await getDownloadURL(billedeRef);
				gammelBilledeUrl = opskrift?.billedeUrl;
			}

			const rensede = ingredienser.filter((i) => i.navn.trim());
			await gemMinOpskrift(u.uid, id, {
				navn: navn.trim() || 'Min opskrift',
				antalPortioner: Math.max(1, antalPortioner),
				ingredienser: rensede,
				makroPrPortion: makro,
				...(nyBilledeUrl ? { billedeUrl: nyBilledeUrl } : {})
			});

			// Best-effort sletning af gammelt billede
			if (gammelBilledeUrl) {
				try {
					const gammelRef = ref(storage, gammelBilledeUrl);
					await deleteObject(gammelRef);
				} catch (e) {
					console.warn('Kunne ikke slette gammelt billede:', e);
				}
			}

			// Genindlæs
			opskrift = await hentMinOpskrift(u.uid, id);
			editMode = false;
			nyBilledeFil = null;
			nyBilledePreview = null;
			gemBesked = 'Gemt.';
			setTimeout(() => (gemBesked = null), 2500);
		} catch (e) {
			console.error(e);
			gemBesked = 'Kunne ikke gemme. Prøv igen.';
		} finally {
			gemmer = false;
		}
	}

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
		{#if opskrift.billedeUrl && !editMode}
			<img class="billede" src={opskrift.billedeUrl} alt={opskrift.navn} />
		{/if}

		{#if !editMode}
			<!-- VIS-MODE -->
			<div class="titel-rad">
				<h1>{opskrift.navn}</h1>
				<button class="rediger-knap" type="button" onclick={startRediger} aria-label="Rediger">
					<Icon name="settings" size={14} color="var(--text2)" />
					<span>Rediger</span>
				</button>
			</div>
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

			{#if gemBesked}
				<div class="status-besked ok">{gemBesked}</div>
			{/if}

			<button class="slet-knap" type="button" onclick={slet} disabled={sletter}>
				{sletter ? 'Sletter...' : 'Slet opskrift'}
			</button>
		{:else}
			<!-- REDIGER-MODE -->
			<section class="card">
				<div class="section-label">Billede</div>
				{#if nyBilledePreview}
					<img class="billede-preview" src={nyBilledePreview} alt="Nyt billede" />
					<div class="billede-info">Nyt billede valgt — gemmes når du trykker "Gem ændringer".</div>
					<div class="billede-knapper">
						<label class="billede-skift">
							<input type="file" accept="image/*" onchange={handleNyBillede} hidden />
							<span>Vælg et andet</span>
						</label>
						<button class="billede-fortryd" type="button" onclick={fjernNyBillede}>
							Fortryd skift
						</button>
					</div>
				{:else if opskrift.billedeUrl}
					<img class="billede-preview" src={opskrift.billedeUrl} alt={opskrift.navn} />
					<div class="billede-knapper">
						<label class="billede-skift">
							<input type="file" accept="image/*" onchange={handleNyBillede} hidden />
							<span>Skift billede</span>
						</label>
					</div>
				{:else}
					<div class="billede-info">Ingen billede gemt endnu.</div>
					<div class="billede-knapper">
						<label class="billede-skift">
							<input type="file" accept="image/*" onchange={handleNyBillede} hidden />
							<span>Tilføj billede</span>
						</label>
					</div>
				{/if}
			</section>

			<section class="card">
				<label class="felt">
					<span class="felt-label">Opskriftens navn</span>
					<input type="text" bind:value={navn} />
				</label>
				<label class="felt">
					<span class="felt-label">Antal portioner</span>
					<input type="number" min="1" max="20" bind:value={antalPortioner} />
				</label>
			</section>

			<section class="card">
				<div class="card-head">
					<div class="section-label">Makro pr portion</div>
				</div>
				<div class="makro-edit-grid">
					<label class="makro-edit-felt">
						<span>Protein (g)</span>
						<input type="number" min="0" step="0.1" bind:value={makro.protein} />
					</label>
					<label class="makro-edit-felt">
						<span>Fiber (g)</span>
						<input type="number" min="0" step="0.1" bind:value={makro.fiber} />
					</label>
					<label class="makro-edit-felt">
						<span>Kulhydrater (g)</span>
						<input type="number" min="0" step="0.1" bind:value={makro.kh} />
					</label>
					<label class="makro-edit-felt">
						<span>Fedt (g)</span>
						<input type="number" min="0" step="0.1" bind:value={makro.fedt} />
					</label>
					<label class="makro-edit-felt">
						<span>Kalorier</span>
						<input type="number" min="0" bind:value={makro.kcal} />
					</label>
				</div>
			</section>

			<section class="card">
				<div class="card-head">
					<div class="section-label">Ingredienser</div>
					<div class="card-tael">{ingredienser.length}</div>
				</div>
				{#each ingredienser as ing, i (i)}
					<div class="ing-rad">
						<input type="text" class="ing-navn-input" placeholder="Navn" bind:value={ing.navn} />
						<input
							type="number"
							class="ing-maengde-input"
							placeholder="0"
							min="0"
							step="any"
							bind:value={ing.maengde}
						/>
						<input type="text" class="ing-enhed-input" placeholder="g" bind:value={ing.enhed} />
						<button class="ing-slet" type="button" onclick={() => fjernIngrediens(i)}>×</button>
					</div>
				{/each}
				<button class="tilfoj-btn" type="button" onclick={tilfojIngrediens}>
					<Icon name="plus" size={12} color="var(--text2)" /> Tilføj ingrediens
				</button>
			</section>

			{#if gemBesked}
				<div class="status-besked" class:fejl={gemBesked.startsWith('Kunne')} class:ok={!gemBesked.startsWith('Kunne')}>
					{gemBesked}
				</div>
			{/if}

			<button class="gem-btn" type="button" onclick={gem} disabled={gemmer}>
				{gemmer ? 'Gemmer...' : 'Gem ændringer'}
			</button>
			<button class="annuller-btn" type="button" onclick={annullerRediger} disabled={gemmer}>
				Annullér
			</button>
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
	}

	.billede {
		width: 100%;
		max-height: 300px;
		object-fit: cover;
		border-radius: 14px;
		margin-bottom: 14px;
	}

	.titel-rad {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 10px;
	}

	h1 {
		font-family: var(--ff-d);
		font-size: calc(26px * var(--fs-scale, 1));
		font-weight: 600;
		letter-spacing: -0.02em;
		margin: 0;
		line-height: 1.1;
		color: var(--text);
		flex: 1;
		min-width: 0;
	}

	.rediger-knap {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 6px 10px;
		background: var(--white);
		color: var(--text2);
		font-size: calc(11px * var(--fs-scale, 1));
		font-weight: 600;
		border: 1px solid var(--border);
		border-radius: 8px;
		cursor: pointer;
		font-family: var(--ff-b);
		flex-shrink: 0;
	}

	.rediger-knap:hover {
		border-color: var(--terra);
		color: var(--terra);
	}

	.meta {
		font-size: calc(12px * var(--fs-scale, 1));
		color: var(--text3);
		margin-top: 4px;
		margin-bottom: 14px;
	}

	.status-besked {
		padding: 12px 16px;
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 12px;
		color: var(--text2);
		font-size: calc(13px * var(--fs-scale, 1));
		text-align: center;
		margin-bottom: 10px;
	}

	.status-besked.fejl {
		color: #8a4a3e;
		background: #fbeeea;
		border-color: #f0d6cf;
	}

	.status-besked.ok {
		background: var(--sdim);
		border-color: var(--sage);
		color: var(--text);
	}

	.card {
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 14px;
		padding: 16px;
		margin-bottom: 14px;
	}

	.card-head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		margin-bottom: 10px;
	}

	.section-label {
		font-size: calc(10px * var(--fs-scale, 1));
		font-weight: 600;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: var(--text3);
		margin-bottom: 12px;
	}

	.card-tael {
		font-size: calc(11px * var(--fs-scale, 1));
		color: var(--text3);
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

	/* REDIGER-MODE STYLES */
	.billede-preview {
		display: block;
		width: 100%;
		max-height: 240px;
		object-fit: cover;
		border-radius: 10px;
		margin-bottom: 10px;
	}

	.billede-info {
		font-size: calc(12px * var(--fs-scale, 1));
		color: var(--text3);
		margin-bottom: 10px;
	}

	.billede-knapper {
		display: flex;
		gap: 8px;
		flex-wrap: wrap;
	}

	.billede-skift {
		display: inline-flex;
		align-items: center;
		padding: 8px 14px;
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 8px;
		font-size: calc(12px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--text2);
		cursor: pointer;
		font-family: var(--ff-b);
	}

	.billede-skift:hover {
		border-color: var(--terra);
		color: var(--terra);
	}

	.billede-fortryd {
		padding: 8px 14px;
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 8px;
		font-size: calc(12px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--text3);
		cursor: pointer;
		font-family: var(--ff-b);
	}

	.felt {
		display: block;
		margin-bottom: 12px;
	}

	.felt:last-child {
		margin-bottom: 0;
	}

	.felt-label {
		display: block;
		font-size: calc(11px * var(--fs-scale, 1));
		color: var(--text3);
		margin-bottom: 4px;
		font-weight: 600;
	}

	.felt input {
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

	.felt input:focus {
		border-color: var(--terra);
	}

	.makro-edit-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 10px;
	}

	.makro-edit-felt {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.makro-edit-felt span {
		font-size: calc(11px * var(--fs-scale, 1));
		color: var(--text3);
		font-weight: 600;
	}

	.makro-edit-felt input {
		padding: 8px 10px;
		border: 1px solid var(--border);
		border-radius: 8px;
		background: var(--bg2);
		font-family: var(--ff-b);
		font-size: max(16px, calc(14px * var(--fs-scale, 1)));
		color: var(--text);
		outline: none;
	}

	.ing-rad {
		display: grid;
		grid-template-columns: 1fr 60px 60px 30px;
		gap: 6px;
		margin-bottom: 6px;
	}

	.ing-rad input {
		padding: 8px 10px;
		border: 1px solid var(--border);
		border-radius: 8px;
		background: var(--bg2);
		font-family: var(--ff-b);
		font-size: max(16px, calc(13px * var(--fs-scale, 1)));
		color: var(--text);
		outline: none;
		min-width: 0;
	}

	.ing-slet {
		border: 1px solid var(--border);
		background: var(--white);
		color: var(--text3);
		border-radius: 8px;
		cursor: pointer;
		font-size: 16px;
	}

	.tilfoj-btn {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		margin-top: 6px;
		padding: 8px 12px;
		background: var(--white);
		border: 1px dashed var(--border);
		border-radius: 8px;
		font-size: calc(12px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--text2);
		cursor: pointer;
		font-family: var(--ff-b);
	}

	.gem-btn {
		display: block;
		width: 100%;
		padding: 14px;
		background: var(--terra);
		color: #fff;
		font-size: max(16px, calc(14px * var(--fs-scale, 1)));
		font-weight: 600;
		border: none;
		border-radius: 12px;
		cursor: pointer;
		font-family: var(--ff-b);
		margin-bottom: 8px;
	}

	.gem-btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.annuller-btn {
		display: block;
		width: 100%;
		padding: 10px;
		background: var(--white);
		color: var(--text2);
		font-size: calc(12px * var(--fs-scale, 1));
		font-weight: 600;
		border: 1px solid var(--border);
		border-radius: 10px;
		cursor: pointer;
		font-family: var(--ff-b);
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
