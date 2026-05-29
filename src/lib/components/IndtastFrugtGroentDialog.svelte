<script lang="ts">
	// Indtast-modal til frugt/groent-challenge. Klienten:
	// 1. Soeger/vaelger fra praedefineret liste (eller skriver eget navn)
	// 2. Hver tilfoejelse vises som chip — kan fjernes
	// 3. Trykker 'Gem' → kalkern faar ansvar for at gemme + aabne stillingen
	import { FRUGT_OG_GROENT } from '$lib/content/challenge';
	import { normaliserFoedevareListe } from '$lib/firestore/challenge';

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
	let viserDropdown = $state(false);

	const valgteLowercase = $derived(new Set(valgte.map((v) => v.toLowerCase())));

	const filtreret = $derived.by(() => {
		const ord = soegeOrd.trim().toLowerCase();
		const base = FRUGT_OG_GROENT.filter((f) => !valgteLowercase.has(f.toLowerCase()));
		if (!ord) return base.slice(0, 50);
		return base.filter((f) => f.toLowerCase().includes(ord)).slice(0, 30);
	});

	const visFritekstForslag = $derived.by(() => {
		const ord = soegeOrd.trim();
		if (!ord) return null;
		if (valgteLowercase.has(ord.toLowerCase())) return null;
		const findesIListe = FRUGT_OG_GROENT.some((f) => f.toLowerCase() === ord.toLowerCase());
		if (findesIListe) return null;
		return ord;
	});

	function tilfoej(navn: string) {
		const ny = normaliserFoedevareListe([...valgte, navn]);
		valgte = ny;
		soegeOrd = '';
		viserDropdown = false;
	}

	function fjern(navn: string) {
		valgte = valgte.filter((v) => v.toLowerCase() !== navn.toLowerCase());
	}

	async function gem() {
		await onGem(valgte);
	}

	function paaFokus() {
		viserDropdown = true;
	}

	function paaBlur() {
		setTimeout(() => (viserDropdown = false), 150);
	}
</script>

<div class="overlay" role="dialog" aria-modal="true" aria-labelledby="fg-titel">
	<div class="dialog">
		<header class="dialog-head">
			<h2 id="fg-titel">Indtast frugt og grønt</h2>
			<button type="button" class="luk" onclick={onLuk} aria-label="Luk">×</button>
		</header>

		<p class="intro">
			Hver gang du har spist en ny frugt eller grøntsag i dag — tilføj den her. Du
			kan tilføje flere ad gangen og trykke Gem til sidst.
		</p>

		<div class="vaelg-omraade">
			<label class="soege-label">
				<span>Vælg frugt eller grøntsag</span>
				<input
					type="text"
					bind:value={soegeOrd}
					placeholder="Søg eller skriv eget navn..."
					onfocus={paaFokus}
					onblur={paaBlur}
					disabled={gemmer}
				/>
			</label>

			{#if viserDropdown}
				<div class="dropdown" role="listbox">
					{#if visFritekstForslag}
						<button
							type="button"
							class="dropdown-row fritekst"
							onmousedown={(e) => {
								e.preventDefault();
								tilfoej(visFritekstForslag);
							}}
						>
							+ Tilføj "{visFritekstForslag}"
						</button>
					{/if}
					{#each filtreret as f (f)}
						<button
							type="button"
							class="dropdown-row"
							onmousedown={(e) => {
								e.preventDefault();
								tilfoej(f);
							}}
						>
							{f}
						</button>
					{:else}
						{#if !visFritekstForslag}
							<div class="dropdown-tom">Ingen flere matcher.</div>
						{/if}
					{/each}
				</div>
			{/if}
		</div>

		{#if valgte.length === 0}
			<p class="muted">Ingen tilføjet endnu — vælg fra listen ovenfor.</p>
		{:else}
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
		max-width: 460px;
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

	.vaelg-omraade {
		position: relative;
		padding: 0 16px;
	}

	.soege-label {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.soege-label span {
		font-size: calc(11px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--text2);
		letter-spacing: 0.04em;
	}

	.soege-label input {
		padding: 10px 12px;
		font-size: calc(14px * var(--fs-scale, 1));
		border: 1px solid var(--border);
		border-radius: 10px;
		background: var(--bg2);
		color: var(--text);
		font-family: var(--ff-b);
	}

	.dropdown {
		position: absolute;
		left: 16px;
		right: 16px;
		top: calc(100% + 4px);
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 12px;
		box-shadow: 0 4px 18px rgba(0, 0, 0, 0.08);
		max-height: 280px;
		overflow-y: auto;
		z-index: 5;
	}

	.dropdown-row {
		display: block;
		width: 100%;
		text-align: left;
		padding: 10px 14px;
		background: transparent;
		border: none;
		border-top: 1px solid var(--border);
		font-family: var(--ff-b);
		font-size: calc(13.5px * var(--fs-scale, 1));
		color: var(--text);
		cursor: pointer;
	}

	.dropdown-row:first-child {
		border-top: none;
	}

	.dropdown-row:hover {
		background: var(--bg2);
	}

	.dropdown-row.fritekst {
		color: var(--terra);
		font-weight: 600;
	}

	.dropdown-tom {
		padding: 12px 14px;
		font-size: calc(12px * var(--fs-scale, 1));
		color: var(--text3);
		font-style: italic;
	}

	.muted {
		padding: 0 16px;
		font-size: calc(12px * var(--fs-scale, 1));
		color: var(--text3);
		font-style: italic;
		margin: 12px 0 0;
	}

	.chips-omraade {
		padding: 12px 16px 8px;
		overflow-y: auto;
	}

	.chips-label {
		font-size: calc(11px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--text2);
		letter-spacing: 0.04em;
		margin-bottom: 8px;
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
