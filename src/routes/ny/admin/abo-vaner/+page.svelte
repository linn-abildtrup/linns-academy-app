<script lang="ts">
	// ============================================================
	// Smaa skridt til abonnenter, i det nye design.
	//
	// Syvende af de 19 gamle admin-sider, 1. september 2026.
	//
	// ORDENE BASIS OG PREMIUM STAAR STADIG HER, og det er med vilje. Der
	// findes ikke premium i 3.0 som kundeskel, men de to er stadig rene
	// datanoegler i de gamle dokumenter, og skabelonerne ligger under netop
	// de navne. At doebe dem om her ville betyde at der blev skrevet et
	// andet sted end der laeses. Se afsnit 3.3 i overdragelsen.
	//
	// LOGIKKEN ER FLYTTET, IKKE SKREVET OM. Samme fire funktioner, og
	// tomme linjer renses vaek foer der gemmes praecis som foer.
	//
	// Den gamle side paa /app/admin/abo-vaner er uroert.
	// ============================================================

	import { getContext, onMount } from 'svelte';
	import type { User } from 'firebase/auth';
	import { isAdmin } from '$lib/admin';
	import type { AboVaneForslag, AboBonusForslag } from '$lib/content/aboVaner';
	import {
		hentAboVaneskabelon,
		gemAboVaneskabelon,
		hentAboBonusPulje,
		gemAboBonusPulje
	} from '$lib/firestore/aboVaner';
	import AdmSide from '$lib/components/admin/AdmSide.svelte';
	import AdmKort from '$lib/components/admin/AdmKort.svelte';
	import AdmKnap from '$lib/components/admin/AdmKnap.svelte';
	import AdmTom from '$lib/components/admin/AdmTom.svelte';

	const hentUser = getContext<() => User | null>('user');
	const maaVaereHer = $derived(isAdmin(hentUser()));

	type Slags = 'vaner' | 'bonus';
	type Type = 'basis' | 'premium';

	let slags = $state<Slags>('vaner');
	let type = $state<Type>('basis');

	let vanerBasis = $state<AboVaneForslag[]>([]);
	let vanerPremium = $state<AboVaneForslag[]>([]);
	let bonusBasis = $state<AboBonusForslag[]>([]);
	let bonusPremium = $state<AboBonusForslag[]>([]);

	let henter = $state(true);
	let gemmer = $state(false);
	let besked = $state('');
	let fejl = $state('');

	onMount(() => void indlaes());

	async function indlaes() {
		henter = true;
		fejl = '';
		try {
			[vanerBasis, vanerPremium, bonusBasis, bonusPremium] = await Promise.all([
				hentAboVaneskabelon('basis'),
				hentAboVaneskabelon('premium'),
				hentAboBonusPulje('basis'),
				hentAboBonusPulje('premium')
			]);
		} catch (e) {
			console.error('[admin] abo-vaner', e);
			fejl = 'Kunne ikke hente listerne.';
		} finally {
			henter = false;
		}
	}

	const vaner = $derived(type === 'basis' ? vanerBasis : vanerPremium);
	const bonus = $derived(type === 'basis' ? bonusBasis : bonusPremium);

	function nyId(praefiks: string, eks: { id: string }[]): string {
		let n = 1;
		while (eks.some((x) => x.id === `${praefiks}${n}`)) n++;
		return `${praefiks}${n}`;
	}

	function tilfoejVane() {
		const ny: AboVaneForslag = { id: nyId('v', vaner), label: '', kategori: '' };
		if (type === 'basis') vanerBasis = [...vanerBasis, ny];
		else vanerPremium = [...vanerPremium, ny];
	}

	function fjernVane(id: string) {
		if (type === 'basis') vanerBasis = vanerBasis.filter((v) => v.id !== id);
		else vanerPremium = vanerPremium.filter((v) => v.id !== id);
	}

	function tilfoejBonus() {
		const ny: AboBonusForslag = {
			id: nyId('b', bonus),
			label: '',
			kategori: '',
			svarmuligheder: ['Ja', 'Nogenlunde', 'Nej']
		};
		if (type === 'basis') bonusBasis = [...bonusBasis, ny];
		else bonusPremium = [...bonusPremium, ny];
	}

	function fjernBonus(id: string) {
		if (type === 'basis') bonusBasis = bonusBasis.filter((b) => b.id !== id);
		else bonusPremium = bonusPremium.filter((b) => b.id !== id);
	}

	async function gemAlt() {
		gemmer = true;
		fejl = '';
		try {
			// Tomme linjer renses vaek, praecis som foer. En linje uden tekst
			// ville vise sig som et tomt skridt hos kunden.
			const vb = vanerBasis.filter((v) => v.label.trim());
			const vp = vanerPremium.filter((v) => v.label.trim());
			const bb = bonusBasis.filter((b) => b.label.trim());
			const bp = bonusPremium.filter((b) => b.label.trim());

			await Promise.all([
				gemAboVaneskabelon('basis', vb),
				gemAboVaneskabelon('premium', vp),
				gemAboBonusPulje('basis', bb),
				gemAboBonusPulje('premium', bp)
			]);

			vanerBasis = vb;
			vanerPremium = vp;
			bonusBasis = bb;
			bonusPremium = bp;
			besked = 'Alt er gemt';
			setTimeout(() => {
				if (besked === 'Alt er gemt') besked = '';
			}, 2500);
		} catch (e) {
			console.error('[admin] gem abo-vaner', e);
			fejl = 'Kunne ikke gemme. Prøv igen.';
		} finally {
			gemmer = false;
		}
	}
</script>

<svelte:head><title>Små skridt til abonnenter · Admin</title></svelte:head>

{#if !maaVaereHer}
	<p class="av-kun">Siden er kun for admin.</p>
{:else}
	<AdmSide
		titel="Små skridt til abonnenter"
		under="De skridt en kunde uden forløb kan vælge imellem, og puljen af bonus-spørgsmål."
	>
		{#snippet handling()}
			<AdmKnap slags="primaer" disabled={gemmer || henter} onclick={gemAlt}>
				{gemmer ? 'Gemmer…' : 'Gem det hele'}
			</AdmKnap>
		{/snippet}

		{#if besked}<div class="av-besked">{besked}</div>{/if}
		{#if fejl}<div class="av-fejl">{fejl}</div>{/if}

		<div class="av-faner">
			<button
				type="button"
				class="av-chip"
				class:paa={slags === 'vaner'}
				onclick={() => (slags = 'vaner')}
			>
				Skridt hun kan vælge
			</button>
			<button
				type="button"
				class="av-chip"
				class:paa={slags === 'bonus'}
				onclick={() => (slags = 'bonus')}
			>
				Bonus-spørgsmål
			</button>
			<span class="av-skel"></span>
			<button
				type="button"
				class="av-chip"
				class:paa={type === 'basis'}
				onclick={() => (type = 'basis')}
			>
				Basis
			</button>
			<button
				type="button"
				class="av-chip"
				class:paa={type === 'premium'}
				onclick={() => (type = 'premium')}
			>
				Premium
			</button>
		</div>

		{#if henter}
			<AdmTom tekst="Henter listerne…" />
		{:else if fejl && vaner.length === 0 && bonus.length === 0}
			<AdmTom tekst={fejl} fejl>
				{#snippet handling()}
					<AdmKnap onclick={indlaes}>Prøv igen</AdmKnap>
				{/snippet}
			</AdmTom>
		{:else if slags === 'vaner'}
			<p class="av-antal">{vaner.length} skridt</p>
			{#if vaner.length === 0}
				<AdmTom tekst="Der er ingen skridt endnu. Tryk Tilføj for at lave det første." />
			{/if}
			{#each vaner as v (v.id)}
				<AdmKort>
					<div class="av-raek">
						<label class="av-felt bred">
							<span>Skridtet, som hun ser det</span>
							<input type="text" bind:value={v.label} disabled={gemmer} />
						</label>
						<label class="av-felt">
							<span>Kategori</span>
							<input type="text" bind:value={v.kategori} disabled={gemmer} />
						</label>
						<div class="av-fjern">
							<AdmKnap slags="fare" disabled={gemmer} onclick={() => fjernVane(v.id)}>Fjern</AdmKnap
							>
						</div>
					</div>
				</AdmKort>
			{/each}
			<AdmKnap disabled={gemmer} onclick={tilfoejVane}>Tilføj et skridt</AdmKnap>
		{:else}
			<p class="av-antal">{bonus.length} bonus-spørgsmål</p>
			{#if bonus.length === 0}
				<AdmTom tekst="Der er ingen bonus-spørgsmål endnu." />
			{/if}
			{#each bonus as b (b.id)}
				<AdmKort>
					<div class="av-raek">
						<label class="av-felt bred">
							<span>Spørgsmålet</span>
							<input type="text" bind:value={b.label} disabled={gemmer} />
						</label>
						<label class="av-felt">
							<span>Kategori</span>
							<input type="text" bind:value={b.kategori} disabled={gemmer} />
						</label>
						<div class="av-fjern">
							<AdmKnap slags="fare" disabled={gemmer} onclick={() => fjernBonus(b.id)}
								>Fjern</AdmKnap
							>
						</div>
					</div>
					<!-- TRE FELTER OG IKKE EN KOMMALISTE. Der SKAL vaere praecis
					     tre svar, og raekkefoelgen betyder noget: det foerste er
					     det positive og det sidste det negative. Det gaelder ogsaa
					     et negativt formuleret spoergsmaal, fx "Har du foelt dig
					     stresset" der har Nej, Lidt, Ja. Ellers kan trenden ikke
					     regnes ens paa tvaers. Se noten i content/aboVaner.ts.
					     En kommaliste kunne give to eller fire svar. -->
					<div class="av-raek">
						<label class="av-felt">
							<span>Svar 1, det positive</span>
							<input type="text" bind:value={b.svarmuligheder[0]} disabled={gemmer} />
						</label>
						<label class="av-felt">
							<span>Svar 2, midt imellem</span>
							<input type="text" bind:value={b.svarmuligheder[1]} disabled={gemmer} />
						</label>
						<label class="av-felt">
							<span>Svar 3, det negative</span>
							<input type="text" bind:value={b.svarmuligheder[2]} disabled={gemmer} />
						</label>
					</div>
				</AdmKort>
			{/each}
			<AdmKnap disabled={gemmer} onclick={tilfoejBonus}>Tilføj et bonus-spørgsmål</AdmKnap>
		{/if}

		<p class="av-fod">
			Der gemmes først når du trykker Gem det hele, og alle fire lister gemmes på én gang. En linje
			uden tekst bliver ikke gemt.
		</p>
	</AdmSide>
{/if}

<style>
	.av-kun {
		padding: 24px 18px;
		color: var(--ink-2);
		font-size: calc(14px * var(--fs-scale, 1) * var(--adm-skala, 1));
	}

	.av-besked,
	.av-fejl {
		margin-bottom: 12px;
		padding: 11px 15px;
		border-radius: 12px;
		font-size: calc(13.5px * var(--fs-scale, 1) * var(--adm-skala, 1));
		font-weight: 600;
	}

	.av-besked {
		background: var(--sage-tint, #e7efe5);
		color: var(--sage-tekst, #46603f);
	}

	.av-fejl {
		background: var(--ler-tint, #f4e6de);
		color: var(--ler-tekst, #8a5439);
	}

	.av-faner {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 6px;
		margin-bottom: 12px;
	}

	.av-skel {
		width: 1px;
		height: 20px;
		background: var(--line, #e8dfd1);
		margin: 0 4px;
	}

	/* Baggrunden staar eksplicit, se noten i AdmKnap. */
	.av-chip {
		padding: 8px 14px;
		background: var(--paper-2, #f6f0e7);
		border: 1px solid var(--line, #e8dfd1);
		border-radius: 99px;
		color: var(--ink-2, #6f5f57);
		font-size: calc(12.5px * var(--fs-scale, 1) * var(--adm-skala, 1));
		font-family: inherit;
		font-weight: 600;
		cursor: pointer;
	}

	.av-chip.paa {
		background: var(--plum, #7c4f63);
		border-color: var(--plum, #7c4f63);
		color: #fff;
	}

	.av-antal {
		margin: 0 0 10px;
		font-size: calc(12px * var(--fs-scale, 1) * var(--adm-skala, 1));
		color: var(--ink-3, #a3948a);
	}

	.av-raek {
		display: flex;
		gap: 10px;
		flex-wrap: wrap;
		align-items: flex-end;
	}

	.av-felt {
		display: flex;
		flex-direction: column;
		gap: 4px;
		flex: 1 1 140px;
		margin-bottom: 8px;
	}

	.av-felt.bred {
		flex: 2 1 260px;
	}

	.av-felt span {
		font-size: calc(10.5px * var(--fs-scale, 1) * var(--adm-skala, 1));
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--ink-3, #a3948a);
	}

	.av-felt input {
		padding: 11px 13px;
		background: var(--paper, #fbf8f2);
		border: 1px solid var(--line, #e8dfd1);
		border-radius: 11px;
		color: var(--espresso, #382c2a);
		font-size: calc(14px * var(--fs-scale, 1) * var(--adm-skala, 1));
		font-family: inherit;
		box-sizing: border-box;
	}

	.av-fjern {
		margin-bottom: 8px;
	}

	.av-fod {
		margin: 20px 0 0;
		font-size: calc(11.5px * var(--fs-scale, 1) * var(--adm-skala, 1));
		color: var(--ink-3, #a3948a);
		line-height: 1.5;
	}
</style>
