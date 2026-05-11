<script lang="ts">
	import { getContext } from 'svelte';
	import { goto } from '$app/navigation';
	import type { User } from 'firebase/auth';
	import type { UserDoc } from '$lib/types';
	import { harPremium } from '$lib/utils/userAdgang';
	import { storage } from '$lib/firebase';
	import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
	import { opretMinOpskrift } from '$lib/firestore/minOpskrift';
	import {
		erGyldigAnalyse,
		DEFAULT_MAKRO,
		type MinOpskriftIngrediens,
		type MinOpskriftMakro
	} from '$lib/content/minOpskrift';
	import Icon from '$lib/components/Icon.svelte';
	import Loading from '$lib/components/Loading.svelte';

	const getUser = getContext<() => User | null>('user');
	const getUserDoc = getContext<() => UserDoc | null>('userDoc');
	const user = $derived(getUser());
	const userDoc = $derived(getUserDoc());
	const harAdgang = $derived(harPremium(userDoc));

	type Tilstand = 'vaelg' | 'analyserer' | 'redigerer' | 'gemmer' | 'fejl';
	let tilstand = $state<Tilstand>('vaelg');
	let fejlBesked = $state<string | null>(null);

	let billedeFil = $state<File | null>(null);
	let billedePreview = $state<string | null>(null);

	let navn = $state('');
	let antalPortioner = $state(4);
	let ingredienser = $state<MinOpskriftIngrediens[]>([]);
	let makro = $state<MinOpskriftMakro>({ ...DEFAULT_MAKRO });

	async function handleFil(fil: File) {
		if (!fil.type.startsWith('image/')) {
			fejlBesked = 'Vælg venligst en billed-fil.';
			tilstand = 'fejl';
			return;
		}
		if (fil.size > 5 * 1024 * 1024) {
			fejlBesked = 'Billedet er for stort. Max 5 MB.';
			tilstand = 'fejl';
			return;
		}
		billedeFil = fil;
		billedePreview = URL.createObjectURL(fil);
		await analyserBillede(fil);
	}

	async function analyserBillede(fil: File) {
		const u = user;
		if (!u) return;
		tilstand = 'analyserer';
		fejlBesked = null;
		try {
			const base64 = await filTilBase64(fil);
			const idToken = await u.getIdToken();
			const res = await fetch('/api/analyser-opskrift', {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${idToken}`,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ billedeBase64: base64, mediaType: fil.type })
			});
			if (!res.ok) {
				const e = await res.json().catch(() => ({}));
				throw new Error(e.message ?? `Fejl ${res.status}`);
			}
			const data = await res.json();
			if (data.error) throw new Error(data.error);
			if (!erGyldigAnalyse(data)) throw new Error('AI returnerede ugyldigt format. Prøv igen.');

			navn = data.navn;
			antalPortioner = data.antalPortioner;
			ingredienser = data.ingredienser;
			makro = data.makroPrPortion;
			tilstand = 'redigerer';
		} catch (e) {
			console.error(e);
			fejlBesked = e instanceof Error ? e.message : 'Kunne ikke analysere billedet.';
			tilstand = 'fejl';
		}
	}

	function filTilBase64(fil: File): Promise<string> {
		return new Promise((resolve, reject) => {
			const reader = new FileReader();
			reader.onload = () => {
				const r = reader.result as string;
				// Fjerner "data:image/jpeg;base64," præfix
				const komma = r.indexOf(',');
				resolve(komma >= 0 ? r.slice(komma + 1) : r);
			};
			reader.onerror = () => reject(reader.error);
			reader.readAsDataURL(fil);
		});
	}

	function tilfojIngrediens() {
		ingredienser = [...ingredienser, { navn: '', maengde: 0, enhed: 'g' }];
	}

	function fjernIngrediens(i: number) {
		ingredienser = ingredienser.filter((_, idx) => idx !== i);
	}

	async function gem() {
		const u = user;
		if (!u || !billedeFil) return;
		tilstand = 'gemmer';
		fejlBesked = null;
		try {
			// Upload billede til Firebase Storage
			const billedeId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
			const sti = `users/${u.uid}/opskrift-billeder/${billedeId}`;
			const billedeRef = ref(storage, sti);
			await uploadBytes(billedeRef, billedeFil);
			const billedeUrl = await getDownloadURL(billedeRef);

			await opretMinOpskrift(u.uid, {
				navn: navn.trim() || 'Min opskrift',
				billedeUrl,
				antalPortioner: Math.max(1, antalPortioner),
				ingredienser: ingredienser.filter((i) => i.navn.trim()),
				makroPrPortion: makro
			});
			goto('/app/moduler/30-30-3?tab=mine');
		} catch (e) {
			console.error(e);
			fejlBesked = 'Kunne ikke gemme. Prøv igen.';
			tilstand = 'redigerer';
		}
	}

	function handleFileInput(e: Event) {
		const input = e.target as HTMLInputElement;
		const fil = input.files?.[0];
		if (fil) handleFil(fil);
	}
</script>

<div class="page">
	<header class="page-header">
		<a class="back" href="/app/moduler/30-30-3?tab=mine">
			<Icon name="arrow-l" size={14} color="var(--text2)" />
			<span>Tilbage</span>
		</a>
		<div class="eyebrow">Min opskrift</div>
		<h1>Tilføj fra billede</h1>
	</header>

	{#if !harAdgang}
		<div class="status-besked">
			Denne funktion er kun tilgængelig for premium-app og premium-forløb.
		</div>
	{:else if tilstand === 'vaelg'}
		<div class="vaelg-card">
			<p class="hint">
				Tag et billede af en opskrift, upload fra galleri, eller paste en
				screenshot. AI'en læser opskriften og estimerer makro pr portion.
			</p>
			<label class="upload-knap">
				<Icon name="plus" size={18} color="#fff" />
				<span>Vælg billede</span>
				<input
					type="file"
					accept="image/*"
					capture="environment"
					onchange={handleFileInput}
				/>
			</label>
			<label class="upload-knap sekundaer">
				<span>Upload fra galleri</span>
				<input type="file" accept="image/*" onchange={handleFileInput} />
			</label>
		</div>
	{:else if tilstand === 'analyserer'}
		<div class="analyse-card">
			{#if billedePreview}
				<img class="preview-billede" src={billedePreview} alt="Opskrift" />
			{/if}
			<Loading tekst="AI analyserer opskriften..." />
			<p class="hint center">Det tager typisk 5-15 sekunder.</p>
		</div>
	{:else if tilstand === 'redigerer'}
		<section class="card">
			{#if billedePreview}
				<img class="preview-billede" src={billedePreview} alt="Opskrift" />
			{/if}
			<label class="felt">
				<span class="felt-label">Opskriftens navn</span>
				<input type="text" bind:value={navn} placeholder="fx Pasta med hytteost" />
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
			<div class="makro-grid">
				<label class="makro-felt">
					<span>Protein (g)</span>
					<input type="number" min="0" step="0.1" bind:value={makro.protein} />
				</label>
				<label class="makro-felt">
					<span>Fiber (g)</span>
					<input type="number" min="0" step="0.1" bind:value={makro.fiber} />
				</label>
				<label class="makro-felt">
					<span>Kulhydrater (g)</span>
					<input type="number" min="0" step="0.1" bind:value={makro.kh} />
				</label>
				<label class="makro-felt">
					<span>Fedt (g)</span>
					<input type="number" min="0" step="0.1" bind:value={makro.fedt} />
				</label>
				<label class="makro-felt">
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
					<input
						type="text"
						class="ing-navn"
						placeholder="Navn"
						bind:value={ing.navn}
					/>
					<input
						type="number"
						class="ing-maengde"
						placeholder="0"
						min="0"
						step="any"
						bind:value={ing.maengde}
					/>
					<input
						type="text"
						class="ing-enhed"
						placeholder="g"
						bind:value={ing.enhed}
					/>
					<button class="ing-slet" type="button" onclick={() => fjernIngrediens(i)}>×</button>
				</div>
			{/each}
			<button class="tilfoj-btn" type="button" onclick={tilfojIngrediens}>
				<Icon name="plus" size={12} color="var(--text2)" /> Tilføj ingrediens
			</button>
		</section>

		{#if fejlBesked}
			<div class="status-besked fejl">{fejlBesked}</div>
		{/if}

		<button class="gem-btn" type="button" onclick={gem}>Gem opskrift</button>
		<button
			class="annuller-btn"
			type="button"
			onclick={() => {
				tilstand = 'vaelg';
				billedeFil = null;
				billedePreview = null;
			}}
		>
			Start forfra
		</button>
	{:else if tilstand === 'gemmer'}
		<Loading tekst="Gemmer..." />
	{:else if tilstand === 'fejl'}
		<div class="status-besked fejl">{fejlBesked}</div>
		<button
			class="gem-btn"
			type="button"
			onclick={() => {
				tilstand = 'vaelg';
				fejlBesked = null;
			}}
		>
			Prøv igen
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
		margin-bottom: 18px;
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
		background: #fbeeea;
		border-color: #f0d6cf;
		color: #8a4a3e;
	}

	.vaelg-card,
	.analyse-card {
		display: flex;
		flex-direction: column;
		align-items: stretch;
		gap: 12px;
		padding: 24px;
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 14px;
		text-align: center;
	}

	.upload-knap {
		position: relative;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		padding: 14px;
		background: var(--terra);
		color: #fff;
		font-size: max(16px, calc(14px * var(--fs-scale, 1)));
		font-weight: 600;
		border-radius: 12px;
		cursor: pointer;
		font-family: var(--ff-b);
	}

	.upload-knap.sekundaer {
		background: var(--white);
		color: var(--text);
		border: 1px solid var(--border);
	}

	.upload-knap input {
		position: absolute;
		inset: 0;
		opacity: 0;
		cursor: pointer;
	}

	.preview-billede {
		width: 100%;
		max-height: 280px;
		object-fit: cover;
		border-radius: 12px;
		margin-bottom: 12px;
	}

	.hint {
		font-size: calc(13px * var(--fs-scale, 1));
		color: var(--text2);
		line-height: 1.5;
		margin: 0;
	}

	.hint.center {
		text-align: center;
		margin-top: 10px;
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
	}

	.card-tael {
		font-size: calc(11px * var(--fs-scale, 1));
		color: var(--text3);
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

	.makro-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 10px;
	}

	.makro-felt {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.makro-felt span {
		font-size: calc(11px * var(--fs-scale, 1));
		color: var(--text3);
		font-weight: 600;
	}

	.makro-felt input {
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
</style>
