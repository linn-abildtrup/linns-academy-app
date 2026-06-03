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

	const MAX_BILLEDER = 3;

	type Tilstand = 'vaelg' | 'analyserer' | 'redigerer' | 'gemmer' | 'fejl';
	let tilstand = $state<Tilstand>('vaelg');
	let fejlBesked = $state<string | null>(null);
	let infoBesked = $state<string | null>(null);

	let billedeFiler = $state<File[]>([]);
	let billedePreviews = $state<string[]>([]);

	let navn = $state('');
	let antalPortioner = $state(4);
	let ingredienser = $state<MinOpskriftIngrediens[]>([]);
	let makro = $state<MinOpskriftMakro>({ ...DEFAULT_MAKRO });

	function tilfojFiler(filer: FileList | File[]) {
		infoBesked = null;
		const nye: File[] = [];
		for (const fil of Array.from(filer)) {
			if (!fil.type.startsWith('image/')) {
				infoBesked = 'Kun billed-filer er tilladt.';
				continue;
			}
			if (fil.size > 5 * 1024 * 1024) {
				infoBesked = `${fil.name} er for stort (max 5 MB).`;
				continue;
			}
			nye.push(fil);
		}
		const samlet = [...billedeFiler, ...nye];
		if (samlet.length > MAX_BILLEDER) {
			infoBesked = `Max ${MAX_BILLEDER} billeder pr opskrift. De første ${MAX_BILLEDER} bliver brugt.`;
		}
		const trimmet = samlet.slice(0, MAX_BILLEDER);
		// Frigiv preview-URLs for filer der fjernes
		for (let i = trimmet.length; i < billedePreviews.length; i++) {
			URL.revokeObjectURL(billedePreviews[i]);
		}
		billedeFiler = trimmet;
		billedePreviews = trimmet.map((f) => URL.createObjectURL(f));
	}

	function fjernBillede(index: number) {
		const url = billedePreviews[index];
		if (url) URL.revokeObjectURL(url);
		billedeFiler = billedeFiler.filter((_, i) => i !== index);
		billedePreviews = billedePreviews.filter((_, i) => i !== index);
	}

	async function analyserOpskrift() {
		const u = user;
		if (!u || billedeFiler.length === 0) return;
		tilstand = 'analyserer';
		fejlBesked = null;
		try {
			const billeder = await Promise.all(
				billedeFiler.map(async (fil) => ({
					billedeBase64: await filTilBase64(fil),
					mediaType: fil.type
				}))
			);
			const idToken = await u.getIdToken();
			const res = await fetch('/api/analyser-opskrift', {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${idToken}`,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ billeder })
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
			fejlBesked = e instanceof Error ? e.message : 'Kunne ikke analysere opskriften.';
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
		if (!u || billedeFiler.length === 0) return;
		tilstand = 'gemmer';
		fejlBesked = null;
		try {
			// Vi gemmer kun det første billede som thumbnail. AI har allerede
			// udvundet alle data fra de øvrige, så de behøver ikke gemmes.
			const forsteFil = billedeFiler[0];
			const billedeId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
			const sti = `users/${u.uid}/opskrift-billeder/${billedeId}`;
			const billedeRef = ref(storage, sti);
			await uploadBytes(billedeRef, forsteFil);
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
		if (input.files?.length) tilfojFiler(input.files);
		// Nulstil så samme fil kan vælges igen efter fjernelse
		input.value = '';
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
			Denne funktion er kun tilgængelig for premium-app og Kropsro.
		</div>
	{:else if tilstand === 'vaelg'}
		<div class="vaelg-card">
			<p class="hint">
				Tag et billede af en opskrift, upload fra galleri, eller paste en
				screenshot. AI'en læser opskriften og estimerer makro pr portion.
				Du kan tilføje op til {MAX_BILLEDER} billeder hvis opskriften fylder over flere sider.
			</p>

			{#if billedePreviews.length > 0}
				<div class="billede-grid">
					{#each billedePreviews as preview, i (preview)}
						<div class="billede-tile">
							<img src={preview} alt="Billede {i + 1}" />
							<div class="billede-tile-nr">{i + 1}</div>
							<button
								type="button"
								class="billede-tile-slet"
								onclick={() => fjernBillede(i)}
								aria-label="Fjern billede {i + 1}"
							>
								×
							</button>
						</div>
					{/each}
				</div>
			{/if}

			{#if infoBesked}
				<div class="info-besked">{infoBesked}</div>
			{/if}

			{#if billedeFiler.length < MAX_BILLEDER}
				<label class="upload-knap">
					<Icon name="plus" size={18} color="#fff" />
					<span>
						{billedeFiler.length === 0 ? 'Vælg billede' : 'Tilføj endnu et billede'}
					</span>
					<input
						type="file"
						accept="image/*"
						capture="environment"
						multiple
						onchange={handleFileInput}
					/>
				</label>
				<label class="upload-knap sekundaer">
					<span>Vælg fra galleri</span>
					<input type="file" accept="image/*" multiple onchange={handleFileInput} />
				</label>
			{/if}

			{#if billedeFiler.length > 0}
				<button class="analyser-knap" type="button" onclick={analyserOpskrift}>
					Analysér {billedeFiler.length === 1 ? 'opskrift' : `${billedeFiler.length} billeder`}
				</button>
			{/if}
		</div>
	{:else if tilstand === 'analyserer'}
		<div class="analyse-card">
			{#if billedePreviews.length > 0}
				<div class="billede-grid kompakt">
					{#each billedePreviews as preview, i (preview)}
						<img src={preview} alt="Billede {i + 1}" />
					{/each}
				</div>
			{/if}
			<Loading
				tekst={billedeFiler.length === 1
					? 'AI analyserer opskriften...'
					: `AI analyserer ${billedeFiler.length} billeder...`}
			/>
			<p class="hint center">
				{billedeFiler.length === 1
					? 'Det tager typisk 5-15 sekunder.'
					: 'Det tager typisk 10-25 sekunder for flere billeder.'}
			</p>
		</div>
	{:else if tilstand === 'redigerer'}
		<section class="card">
			{#if billedePreviews.length > 0}
				<img class="preview-billede" src={billedePreviews[0]} alt="Opskrift" />
				{#if billedePreviews.length > 1}
					<div class="hint center small">
						{billedePreviews.length} billeder brugt til analysen — kun det første gemmes som thumbnail.
					</div>
				{/if}
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
				<label class="makro-felt fuld">
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
				for (const url of billedePreviews) URL.revokeObjectURL(url);
				billedeFiler = [];
				billedePreviews = [];
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

	.billede-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 8px;
		margin-bottom: 4px;
	}

	.billede-grid.kompakt img {
		width: 100%;
		aspect-ratio: 1 / 1;
		object-fit: cover;
		border-radius: 8px;
	}

	.billede-tile {
		position: relative;
		aspect-ratio: 1 / 1;
		border-radius: 10px;
		overflow: hidden;
		background: var(--bg2);
	}

	.billede-tile img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.billede-tile-nr {
		position: absolute;
		top: 4px;
		left: 4px;
		background: rgba(0, 0, 0, 0.6);
		color: #fff;
		font-size: 11px;
		font-weight: 700;
		padding: 2px 6px;
		border-radius: 6px;
	}

	.billede-tile-slet {
		position: absolute;
		top: 4px;
		right: 4px;
		background: rgba(0, 0, 0, 0.6);
		color: #fff;
		border: none;
		border-radius: 50%;
		width: 24px;
		height: 24px;
		font-size: 16px;
		line-height: 1;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.info-besked {
		padding: 10px 12px;
		background: #fbf3e6;
		border: 1px solid #ecd9b3;
		border-radius: 10px;
		color: #6b5024;
		font-size: calc(12px * var(--fs-scale, 1));
		text-align: center;
	}

	.analyser-knap {
		padding: 14px;
		background: var(--terra);
		color: #fff;
		font-size: max(16px, calc(14px * var(--fs-scale, 1)));
		font-weight: 600;
		border: none;
		border-radius: 12px;
		cursor: pointer;
		font-family: var(--ff-b);
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

	.hint.small {
		font-size: calc(11px * var(--fs-scale, 1));
		margin-top: 6px;
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

	.makro-felt.fuld {
		grid-column: span 2;
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
