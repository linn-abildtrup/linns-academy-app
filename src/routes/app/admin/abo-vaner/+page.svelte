<script lang="ts">
	import { onMount } from 'svelte';
	import type { AboVaneForslag, AboBonusForslag } from '$lib/content/aboVaner';
	import {
		hentAboVaneskabelon,
		gemAboVaneskabelon,
		hentAboBonusPulje,
		gemAboBonusPulje
	} from '$lib/firestore/aboVaner';
	import Icon from '$lib/components/Icon.svelte';
	import Loading from '$lib/components/Loading.svelte';

	type Tab = 'vaner-basis' | 'vaner-premium' | 'bonus-basis' | 'bonus-premium';
	let aktivTab = $state<Tab>('vaner-basis');

	let vanerBasis = $state<AboVaneForslag[]>([]);
	let vanerPremium = $state<AboVaneForslag[]>([]);
	let bonusBasis = $state<AboBonusForslag[]>([]);
	let bonusPremium = $state<AboBonusForslag[]>([]);

	let loading = $state(true);
	let gemmer = $state(false);
	let besked = $state<string | null>(null);

	onMount(async () => {
		try {
			[vanerBasis, vanerPremium, bonusBasis, bonusPremium] = await Promise.all([
				hentAboVaneskabelon('basis'),
				hentAboVaneskabelon('premium'),
				hentAboBonusPulje('basis'),
				hentAboBonusPulje('premium')
			]);
		} catch (e) {
			console.error(e);
			besked = 'Kunne ikke hente data.';
		} finally {
			loading = false;
		}
	});

	function nyId(prefix: string, eksisterende: { id: string }[]): string {
		let n = 1;
		while (eksisterende.some((x) => x.id === `${prefix}${n}`)) n++;
		return `${prefix}${n}`;
	}

	function tilfojVane(produktType: 'basis' | 'premium') {
		const liste = produktType === 'basis' ? vanerBasis : vanerPremium;
		const ny: AboVaneForslag = { id: nyId('v', liste), label: '', kategori: '' };
		if (produktType === 'basis') vanerBasis = [...liste, ny];
		else vanerPremium = [...liste, ny];
	}

	function fjernVane(produktType: 'basis' | 'premium', id: string) {
		if (produktType === 'basis') vanerBasis = vanerBasis.filter((v) => v.id !== id);
		else vanerPremium = vanerPremium.filter((v) => v.id !== id);
	}

	function tilfojBonus(produktType: 'basis' | 'premium') {
		const liste = produktType === 'basis' ? bonusBasis : bonusPremium;
		const ny: AboBonusForslag = {
			id: nyId('b', liste),
			label: '',
			kategori: '',
			svarmuligheder: ['Ja', 'Nogenlunde', 'Nej']
		};
		if (produktType === 'basis') bonusBasis = [...liste, ny];
		else bonusPremium = [...liste, ny];
	}

	function fjernBonus(produktType: 'basis' | 'premium', id: string) {
		if (produktType === 'basis') bonusBasis = bonusBasis.filter((b) => b.id !== id);
		else bonusPremium = bonusPremium.filter((b) => b.id !== id);
	}

	async function gemAlt() {
		gemmer = true;
		besked = null;
		try {
			const rensetVanerBasis = vanerBasis.filter((v) => v.label.trim());
			const rensetVanerPremium = vanerPremium.filter((v) => v.label.trim());
			const rensetBonusBasis = bonusBasis.filter((b) => b.label.trim());
			const rensetBonusPremium = bonusPremium.filter((b) => b.label.trim());

			await Promise.all([
				gemAboVaneskabelon('basis', rensetVanerBasis),
				gemAboVaneskabelon('premium', rensetVanerPremium),
				gemAboBonusPulje('basis', rensetBonusBasis),
				gemAboBonusPulje('premium', rensetBonusPremium)
			]);

			vanerBasis = rensetVanerBasis;
			vanerPremium = rensetVanerPremium;
			bonusBasis = rensetBonusBasis;
			bonusPremium = rensetBonusPremium;
			besked = 'Gemt.';
			setTimeout(() => (besked = null), 2500);
		} catch (e) {
			console.error(e);
			besked = 'Kunne ikke gemme. Prøv igen.';
		} finally {
			gemmer = false;
		}
	}
</script>

<div class="page">
	<header class="page-header">
		<a class="back" href="/app/admin">
			<Icon name="arrow-l" size={14} color="var(--text2)" />
			<span>Admin</span>
		</a>
		<div class="eyebrow">Admin · Abo-vaner</div>
		<h1>Vaneliste og bonus</h1>
		<p class="page-sub">
			Forslag som basis- og premium-abonnenter kan vælge fra. Brugere kan også
			skrive deres egne vaner. Bonus-puljen roteres deterministisk pr dag.
		</p>
	</header>

	{#if loading}
		<Loading tekst="Henter..." />
	{:else}
		<div class="tabs">
			<button
				class="tab"
				class:aktiv={aktivTab === 'vaner-basis'}
				onclick={() => (aktivTab = 'vaner-basis')}
			>
				Vaner basis
			</button>
			<button
				class="tab"
				class:aktiv={aktivTab === 'vaner-premium'}
				onclick={() => (aktivTab = 'vaner-premium')}
			>
				Vaner premium
			</button>
			<button
				class="tab"
				class:aktiv={aktivTab === 'bonus-basis'}
				onclick={() => (aktivTab = 'bonus-basis')}
			>
				Bonus basis
			</button>
			<button
				class="tab"
				class:aktiv={aktivTab === 'bonus-premium'}
				onclick={() => (aktivTab = 'bonus-premium')}
			>
				Bonus premium
			</button>
		</div>

		<section class="card">
			{#if aktivTab === 'vaner-basis' || aktivTab === 'vaner-premium'}
				{@const erBasis = aktivTab === 'vaner-basis'}
				{@const liste = erBasis ? vanerBasis : vanerPremium}
				<div class="kort-head">
					<div class="kort-titel">
						{erBasis ? 'Basis (vælg 3)' : 'Premium (vælg op til 7)'}
					</div>
					<div class="kort-sub">{liste.length} forslag</div>
				</div>

				{#each liste as vane (vane.id)}
					<div class="rad">
						<input
							type="text"
							class="input-label"
							placeholder="Vanens tekst (fx 'Protein til morgenmad')"
							bind:value={vane.label}
						/>
						<input
							type="text"
							class="input-kategori"
							placeholder="Kategori"
							bind:value={vane.kategori}
						/>
						<button
							class="slet-btn"
							aria-label="Slet"
							onclick={() => fjernVane(erBasis ? 'basis' : 'premium', vane.id)}
						>
							×
						</button>
					</div>
				{/each}

				<button
					class="tilfoj-btn"
					onclick={() => tilfojVane(erBasis ? 'basis' : 'premium')}
				>
					<Icon name="plus" size={14} color="var(--text2)" />
					Tilføj forslag
				</button>
			{:else}
				{@const erBasis = aktivTab === 'bonus-basis'}
				{@const liste = erBasis ? bonusBasis : bonusPremium}
				<div class="kort-head">
					<div class="kort-titel">
						Bonus-pulje {erBasis ? 'basis' : 'premium'}
					</div>
					<div class="kort-sub">{liste.length} spørgsmål</div>
				</div>

				<p class="hjaelp">
					Konvention: skriv det <em>positive</em> svar først (svarmulighed 1).
					Også for negativt formulerede spørgsmål — fx 'Har du følt dig stresset?'
					skal have svar 'Nej / Lidt / Ja'. Det gør at trend-score kan beregnes
					ensartet på tværs af spørgsmål.
				</p>

				{#each liste as bonus (bonus.id)}
					<div class="bonus-blok">
						<div class="rad">
							<input
								type="text"
								class="input-label"
								placeholder="Spørgsmål (fx 'Hvordan er dit energiniveau i dag?')"
								bind:value={bonus.label}
							/>
							<button
								class="slet-btn"
								aria-label="Slet"
								onclick={() => fjernBonus(erBasis ? 'basis' : 'premium', bonus.id)}
							>
								×
							</button>
						</div>
						<div class="rad">
							<input
								type="text"
								class="input-kategori"
								placeholder="Kategori (fx 'Energi og krop')"
								bind:value={bonus.kategori}
							/>
						</div>
						<div class="svar-rad">
							<input
								type="text"
								class="svar-input positiv"
								placeholder="Positiv (fx Godt)"
								bind:value={bonus.svarmuligheder[0]}
							/>
							<input
								type="text"
								class="svar-input neutral"
								placeholder="Neutral (fx Okay)"
								bind:value={bonus.svarmuligheder[1]}
							/>
							<input
								type="text"
								class="svar-input negativ"
								placeholder="Negativ (fx Lavt)"
								bind:value={bonus.svarmuligheder[2]}
							/>
						</div>
					</div>
				{/each}

				<button
					class="tilfoj-btn"
					onclick={() => tilfojBonus(erBasis ? 'basis' : 'premium')}
				>
					<Icon name="plus" size={14} color="var(--text2)" />
					Tilføj bonus
				</button>
			{/if}
		</section>

		<div class="bund">
			{#if besked}
				<div class="besked">{besked}</div>
			{/if}
			<button class="gem-btn" onclick={gemAlt} disabled={gemmer}>
				{gemmer ? 'Gemmer...' : 'Gem alle ændringer'}
			</button>
		</div>
	{/if}
</div>

<style>
	.page {
		padding: 18px 18px 100px;
		max-width: 640px;
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

	.page-sub {
		font-size: calc(13px * var(--fs-scale, 1));
		color: var(--text2);
		margin: 6px 0 0;
		line-height: 1.4;
	}

	.tabs {
		display: flex;
		gap: 4px;
		margin-bottom: 14px;
		overflow-x: auto;
		padding-bottom: 2px;
	}

	.tab {
		flex-shrink: 0;
		padding: 8px 12px;
		border-radius: 8px;
		border: 1px solid var(--border);
		background: var(--white);
		color: var(--text2);
		font-size: calc(12px * var(--fs-scale, 1));
		font-weight: 600;
		cursor: pointer;
		font-family: var(--ff-b);
	}

	.tab.aktiv {
		background: var(--terra);
		color: #fff;
		border-color: var(--terra);
	}

	.card {
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 14px;
		padding: 16px;
		margin-bottom: 14px;
	}

	.kort-head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		margin-bottom: 12px;
	}

	.kort-titel {
		font-family: var(--ff-d);
		font-size: calc(16px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--text);
	}

	.kort-sub {
		font-size: calc(11px * var(--fs-scale, 1));
		color: var(--text3);
	}

	.rad {
		display: flex;
		gap: 6px;
		margin-bottom: 6px;
		align-items: stretch;
	}

	.input-label {
		flex: 1;
		min-width: 0;
		padding: 9px 10px;
		font-size: calc(14px * var(--fs-scale, 1));
		font-family: var(--ff-b);
		border: 1px solid var(--border);
		border-radius: 8px;
		background: var(--white);
		color: var(--text);
	}

	.input-kategori {
		width: 100px;
		padding: 9px 10px;
		font-size: calc(13px * var(--fs-scale, 1));
		font-family: var(--ff-b);
		border: 1px solid var(--border);
		border-radius: 8px;
		background: var(--white);
		color: var(--text2);
	}

	.input-label:focus,
	.input-kategori:focus {
		outline: 2px solid var(--terra);
		outline-offset: -1px;
	}

	.slet-btn {
		width: 32px;
		flex-shrink: 0;
		border: 1px solid var(--border);
		background: var(--white);
		color: var(--text3);
		border-radius: 8px;
		font-size: 18px;
		cursor: pointer;
		font-family: var(--ff-b);
	}

	.slet-btn:hover {
		background: #fbeeea;
		border-color: #f0d6cf;
		color: #8a4a3e;
	}

	.tilfoj-btn {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 9px 12px;
		margin-top: 10px;
		font-size: calc(12px * var(--fs-scale, 1));
		font-weight: 600;
		font-family: var(--ff-b);
		color: var(--text2);
		border: 1px dashed var(--border);
		background: var(--white);
		border-radius: 8px;
		cursor: pointer;
	}

	.tilfoj-btn:hover {
		border-color: var(--terra);
		color: var(--terra);
	}

	.bonus-blok {
		padding: 12px;
		margin-bottom: 10px;
		background: var(--bg2);
		border: 1px solid var(--border);
		border-radius: 10px;
	}

	.bonus-blok .input-kategori {
		width: 100%;
	}

	.svar-rad {
		display: grid;
		grid-template-columns: 1fr 1fr 1fr;
		gap: 6px;
		margin-top: 4px;
	}

	.svar-input {
		padding: 8px 9px;
		font-size: calc(12.5px * var(--fs-scale, 1));
		font-family: var(--ff-b);
		border: 1px solid var(--border);
		border-radius: 8px;
		background: var(--white);
		color: var(--text);
		min-width: 0;
	}

	.svar-input.positiv {
		border-left: 3px solid #6f9e7e;
	}

	.svar-input.neutral {
		border-left: 3px solid #c9a07a;
	}

	.svar-input.negativ {
		border-left: 3px solid #b87b6e;
	}

	.svar-input:focus {
		outline: 2px solid var(--terra);
		outline-offset: -1px;
	}

	.hjaelp {
		font-size: calc(12px * var(--fs-scale, 1));
		color: var(--text3);
		line-height: 1.5;
		margin: 0 0 10px;
		padding: 8px 10px;
		background: var(--bg2);
		border-radius: 8px;
	}

	.bund {
		display: flex;
		flex-direction: column;
		gap: 10px;
		align-items: stretch;
	}

	.gem-btn {
		padding: 14px;
		background: var(--terra);
		color: #fff;
		font-size: calc(14px * var(--fs-scale, 1));
		font-weight: 600;
		border-radius: 12px;
		border: none;
		cursor: pointer;
		font-family: var(--ff-b);
	}

	.gem-btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.besked {
		padding: 10px 14px;
		background: var(--sdim);
		border: 1px solid var(--sage);
		border-radius: 10px;
		color: var(--text);
		font-size: calc(12px * var(--fs-scale, 1));
		text-align: center;
	}
</style>
