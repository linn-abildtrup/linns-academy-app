<script lang="ts">
	// Dialog til at oprette en ny EGEN privat fødevare. Bruges efter en
	// stregkode-scan (Open Food Facts pre-udfylder næringsdata) eller når
	// brugeren vælger 'Tilføj fødevare manuelt'.
	//
	// Fødevaren gemmes på users/{uid}/customFodevarer og er KUN synlig for
	// brugeren selv. Tidligere blev dette gemt som community-fødevare alle
	// kunne se, men den funktion er fjernet.
	import { onDestroy, onMount, untrack } from 'svelte';
	import { KATEGORI_LABELS, type Kategori, type Fodevare } from '$lib/content/kost';
	import { gemMinCustomFodevare } from '$lib/firestore/kost';

	interface Props {
		/** Stregkode hvis dialogen blev åbnet fra scanner — bruges ikke i UI'en
		 *  men kan bevares for senere genkendelse / metadata. */
		barcode: string;
		startNavn?: string;
		startProtein?: number;
		startFiber?: number;
		startKh?: number;
		startFedt?: number;
		startKcal?: number;
		startKat?: Kategori;
		uid: string;
		onTilfoejet: (fodevare: Fodevare) => void;
		onClose: () => void;
	}

	let {
		barcode: _barcode,
		startNavn = '',
		startProtein = 0,
		startFiber = 0,
		startKh = 0,
		startFedt = 0,
		startKcal = 0,
		startKat = 'andet',
		uid,
		onTilfoejet,
		onClose
	}: Props = $props();

	// Pre-udfyld med start-værdierne. Dialog'en re-mountes når brugeren åbner
	// en ny fødevare, så initialværdier her er korrekte. untrack undgår
	// Svelte's "state_referenced_locally"-warning siden disse props ikke
	// ændres efter mount.
	let navn = $state(untrack(() => startNavn));
	let kat = $state<Kategori>(untrack(() => startKat));
	let protein = $state(untrack(() => startProtein));
	let fiber = $state(untrack(() => startFiber));
	let kh = $state(untrack(() => startKh));
	let fedt = $state(untrack(() => startFedt));
	let kcal = $state(untrack(() => startKcal));
	let gemmer = $state(false);
	let fejl = $state<string | null>(null);

	const KATEGORIER: Kategori[] = [
		'mejeri',
		'koed',
		'fisk',
		'baelg',
		'korn',
		'gront',
		'baer',
		'noedder',
		'prot',
		'drikke',
		'andet'
	];

	function portalToBody(node: HTMLElement) {
		document.body.appendChild(node);
		return {
			destroy() {
				if (node.parentNode === document.body) {
					document.body.removeChild(node);
				}
			}
		};
	}

	onMount(() => {
		const original = document.body.style.overflow;
		document.body.style.overflow = 'hidden';
		return () => {
			document.body.style.overflow = original;
		};
	});

	onDestroy(() => {
		if (typeof document !== 'undefined') {
			document.body.style.overflow = '';
		}
	});

	async function gem() {
		const n = navn.trim();
		if (!n) {
			fejl = 'Giv fødevaren et navn.';
			return;
		}
		if (!Number.isFinite(protein) || protein < 0) {
			fejl = 'Protein skal være 0 eller derover.';
			return;
		}
		if (!Number.isFinite(fiber) || fiber < 0) {
			fejl = 'Fiber skal være 0 eller derover.';
			return;
		}
		gemmer = true;
		fejl = null;
		try {
			const customData: {
				name: string;
				cat: Kategori;
				p: number;
				f: number;
				liquid: boolean;
				kilde: 'custom';
				kh?: number;
				fedt?: number;
				kcal?: number;
			} = {
				name: n,
				cat: kat,
				p: protein,
				f: fiber,
				liquid: false,
				kilde: 'custom'
			};
			if (kh > 0) customData.kh = kh;
			if (fedt > 0) customData.fedt = fedt;
			if (kcal > 0) customData.kcal = kcal;
			const id = await gemMinCustomFodevare(uid, customData);
			const ny: Fodevare = {
				id,
				name: n,
				cat: kat,
				p: protein,
				f: fiber,
				kilde: 'custom'
			};
			if (kh > 0) ny.kh = kh;
			if (fedt > 0) ny.fedt = fedt;
			if (kcal > 0) ny.kcal = kcal;
			onTilfoejet(ny);
		} catch (e) {
			console.error(e);
			fejl = 'Kunne ikke gemme. Prøv igen.';
		} finally {
			gemmer = false;
		}
	}
</script>

<div class="bag" use:portalToBody>
	<div class="modal" role="dialog" aria-modal="true">
		<header class="head">
			<div class="titel">Tilføj egen fødevare</div>
			<button class="luk" type="button" onclick={onClose} aria-label="Luk">×</button>
		</header>

		<div class="body">
			<label class="felt">
				<span class="lbl">Navn</span>
				<input
					type="text"
					bind:value={navn}
					placeholder="fx Skyr, vanilje"
					maxlength="80"
					disabled={gemmer}
				/>
			</label>

			<label class="felt">
				<span class="lbl">Kategori</span>
				<select bind:value={kat} disabled={gemmer}>
					{#each KATEGORIER as k (k)}
						<option value={k}>{KATEGORI_LABELS[k]}</option>
					{/each}
				</select>
			</label>

			<div class="rad">
				<label class="felt">
					<span class="lbl">Protein pr 100g</span>
					<input
						type="number"
						bind:value={protein}
						min="0"
						step="0.1"
						disabled={gemmer}
					/>
				</label>
				<label class="felt">
					<span class="lbl">Fiber pr 100g</span>
					<input
						type="number"
						bind:value={fiber}
						min="0"
						step="0.1"
						disabled={gemmer}
					/>
				</label>
			</div>

			<div class="rad">
				<label class="felt">
					<span class="lbl">Kulhydrater pr 100g</span>
					<input type="number" bind:value={kh} min="0" step="0.1" disabled={gemmer} />
				</label>
				<label class="felt">
					<span class="lbl">Fedt pr 100g</span>
					<input type="number" bind:value={fedt} min="0" step="0.1" disabled={gemmer} />
				</label>
			</div>

			<label class="felt">
				<span class="lbl">Kalorier pr 100g (kcal)</span>
				<input type="number" bind:value={kcal} min="0" step="1" disabled={gemmer} />
			</label>

			<p class="hint">
				Fødevaren gemmes kun for dig — andre brugere ser den ikke.
			</p>

			{#if fejl}
				<div class="fejl">{fejl}</div>
			{/if}
		</div>

		<div class="foot">
			<button class="primary" type="button" onclick={gem} disabled={gemmer}>
				{gemmer ? 'Gemmer...' : 'Gem og tilføj til måltid'}
			</button>
		</div>
	</div>
</div>

<style>
	.bag {
		position: fixed;
		inset: 0;
		z-index: 700;
		background: rgba(42, 31, 23, 0.55);
		display: flex;
		align-items: flex-end;
		justify-content: center;
	}

	.modal {
		background: var(--white);
		width: 100%;
		max-width: 520px;
		max-height: 92dvh;
		border-radius: 18px 18px 0 0;
		display: flex;
		flex-direction: column;
		overflow: hidden;
		box-shadow: 0 -8px 24px rgba(0, 0, 0, 0.18);
	}

	.head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 14px 18px 6px;
		flex-shrink: 0;
	}

	.titel {
		font-family: var(--ff-d);
		font-size: calc(18px * var(--fs-scale, 1));
		font-weight: 600;
	}

	.luk {
		width: 32px;
		height: 32px;
		border-radius: 50%;
		background: var(--bg2);
		border: none;
		color: var(--text2);
		font-size: calc(20px * var(--fs-scale, 1));
		cursor: pointer;
	}

	.body {
		padding: 4px 18px 8px;
		overflow-y: auto;
		overscroll-behavior: contain;
		flex: 1;
		min-height: 0;
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.felt {
		display: flex;
		flex-direction: column;
		gap: 4px;
		flex: 1;
	}

	.lbl {
		font-size: calc(11px * var(--fs-scale, 1));
		font-weight: 600;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--text3);
	}

	.felt input,
	.felt select {
		padding: 10px 12px;
		font-size: calc(16px * var(--fs-scale, 1));
		border-radius: 10px;
		border: 1px solid var(--border);
		background: var(--bg2);
		color: var(--text);
		font-family: var(--ff-b);
		outline: none;
	}

	.felt input:focus,
	.felt select:focus {
		border-color: var(--terra);
	}

	.rad {
		display: flex;
		gap: 10px;
	}

	.hint {
		display: flex;
		align-items: flex-start;
		gap: 6px;
		font-size: calc(11.5px * var(--fs-scale, 1));
		color: var(--text3);
		line-height: 1.45;
		margin: 4px 0 0;
	}

	.fejl {
		padding: 10px 12px;
		background: #fbeeea;
		border: 1px solid #f0d6cf;
		border-radius: 8px;
		font-size: calc(12px * var(--fs-scale, 1));
		color: #8a4a3e;
	}

	.foot {
		flex-shrink: 0;
		padding: 8px 18px calc(14px + env(safe-area-inset-bottom));
		border-top: 1px solid var(--border);
	}

	.primary {
		width: 100%;
		padding: 12px;
		background: var(--terra);
		color: #fff;
		border: none;
		border-radius: 12px;
		font-family: var(--ff-b);
		font-weight: 600;
		font-size: calc(14px * var(--fs-scale, 1));
		cursor: pointer;
	}

	.primary:disabled {
		opacity: 0.6;
	}
</style>
