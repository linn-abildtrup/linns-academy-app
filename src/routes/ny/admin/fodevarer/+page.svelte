<script lang="ts">
	// ============================================================
	// Faellesskabs-foedevarer, i det nye design.
	//
	// Femte af de 19 gamle admin-sider, 1. september 2026. Den SKRIVER, men
	// kun paa de varer kunderne selv har oprettet, og aldrig paa en kundes
	// egen konto. Derfor ligger den i midtergruppen og ikke til sidst.
	//
	// LOGIKKEN ER FLYTTET, IKKE SKREVET OM: adminSaetVerificeret og
	// sletCommunityFodevare er de samme funktioner som den gamle side
	// kalder.
	//
	// SLETNING ER PERMANENT, og det er derfor der bekraeftes paa selve
	// raekken. De maaltider hvor varen er brugt bliver ved med at virke,
	// fordi hvert maaltid fryser sine egne tal ved gemning.
	//
	// Den gamle side paa /app/admin/fodevarer er uroert.
	// ============================================================

	import { getContext, onMount } from 'svelte';
	import type { User } from 'firebase/auth';
	import { isAdmin } from '$lib/admin';
	import {
		hentAlleFodevarer,
		adminSaetVerificeret,
		sletCommunityFodevare
	} from '$lib/firestore/kost';
	import { KATEGORI_LABELS, type Fodevare } from '$lib/content/kost';
	import AdmSide from '$lib/components/admin/AdmSide.svelte';
	import AdmKort from '$lib/components/admin/AdmKort.svelte';
	import AdmKnap from '$lib/components/admin/AdmKnap.svelte';
	import AdmMaerkat from '$lib/components/admin/AdmMaerkat.svelte';
	import AdmSoeg from '$lib/components/admin/AdmSoeg.svelte';
	import AdmTom from '$lib/components/admin/AdmTom.svelte';

	const hentUser = getContext<() => User | null>('user');
	const maaVaereHer = $derived(isAdmin(hentUser()));

	type Filter = 'alle' | 'verificeret' | 'venter' | 'mistaenkelig';

	let alle = $state<Fodevare[]>([]);
	let henter = $state(true);
	let fejl = $state('');
	let arbejder = $state('');
	let sletId = $state('');
	let filter = $state<Filter>('alle');
	let soeg = $state('');

	onMount(() => void indlaes());

	async function indlaes() {
		henter = true;
		fejl = '';
		try {
			const liste = await hentAlleFodevarer();
			alle = liste.filter((f) => f.kilde === 'community');
		} catch (e) {
			console.error('[admin] fodevarer', e);
			fejl = 'Kunne ikke hente varerne.';
		} finally {
			henter = false;
		}
	}

	const listen = $derived(
		alle
			.filter((f) => {
				const ok = f.okBy?.length ?? 0;
				const ej = f.ejBy?.length ?? 0;
				if (filter === 'verificeret') return f.verificeret === true;
				if (filter === 'venter') return !f.verificeret && ej <= ok;
				if (filter === 'mistaenkelig') return ej > ok;
				return true;
			})
			.filter((f) => {
				const t = soeg.trim().toLowerCase();
				if (!t) return true;
				return `${f.name} ${f.addedByName ?? ''} ${f.barcode ?? ''}`.toLowerCase().includes(t);
			})
	);

	async function toggleVerificeret(f: Fodevare) {
		if (!f.id || arbejder) return;
		arbejder = f.id;
		try {
			const ny = !f.verificeret;
			await adminSaetVerificeret(f.id, ny);
			alle = alle.map((x) => (x.id === f.id ? { ...x, verificeret: ny } : x));
		} catch (e) {
			console.error('[admin] verificér', e);
			fejl = 'Kunne ikke gemme. Prøv igen.';
		} finally {
			arbejder = '';
		}
	}

	async function slet(f: Fodevare) {
		if (!f.id || arbejder) return;
		arbejder = f.id;
		try {
			await sletCommunityFodevare(f.id);
			alle = alle.filter((x) => x.id !== f.id);
			sletId = '';
		} catch (e) {
			console.error('[admin] slet vare', e);
			fejl = 'Kunne ikke slette. Prøv igen.';
		} finally {
			arbejder = '';
		}
	}

	function tal(x: number | undefined): string {
		if (typeof x !== 'number') return '—';
		return (Math.round(x * 10) / 10).toString().replace('.', ',');
	}
</script>

<svelte:head><title>Fællesskabs-fødevarer · Admin</title></svelte:head>

{#if !maaVaereHer}
	<p class="fv-kun">Siden er kun for admin.</p>
{:else}
	<AdmSide
		titel="Fællesskabs-fødevarer"
		under="Varer kunderne selv har oprettet. Her kan du godkende dem eller fjerne dem helt."
		bred
	>
		{#snippet handling()}
			<AdmKnap onclick={indlaes}>Hent igen</AdmKnap>
		{/snippet}

		<div class="fv-filtre">
			{#each [['alle', 'Alle'], ['venter', 'Venter på dig'], ['verificeret', 'Godkendte'], ['mistaenkelig', 'Nogen har sagt fra']] as [id, navn] (id)}
				<button
					type="button"
					class="fv-chip"
					class:paa={filter === id}
					onclick={() => (filter = id as Filter)}
				>
					{navn}
				</button>
			{/each}
		</div>

		<AdmSoeg bind:vaerdi={soeg} placeholder="Søg efter navn, stregkode eller den der oprettede…" />

		<p class="fv-antal">{listen.length} af {alle.length} varer</p>

		{#if henter}
			<AdmTom tekst="Henter varerne…" />
		{:else if fejl}
			<AdmTom tekst={fejl} fejl>
				{#snippet handling()}
					<AdmKnap onclick={indlaes}>Prøv igen</AdmKnap>
				{/snippet}
			</AdmTom>
		{:else if listen.length === 0}
			<AdmTom tekst="Ingen varer matcher det du har valgt." />
		{:else}
			{#each listen as f (f.id)}
				{@const ok = f.okBy?.length ?? 0}
				{@const ej = f.ejBy?.length ?? 0}
				<AdmKort ro={ej > ok}>
					<div class="fv-hoved">
						<div>
							<span class="fv-navn">{f.name}</span>
							<div class="fv-meta">
								{KATEGORI_LABELS[f.cat] ?? f.cat}
								{#if f.addedByName}· oprettet af {f.addedByName}{/if}
								{#if f.barcode}· stregkode {f.barcode}{/if}
							</div>
						</div>
						<AdmMaerkat farve={f.verificeret ? 'klar' : ej > ok ? 'fare' : 'stille'}>
							{f.verificeret ? 'Godkendt' : ej > ok ? 'Nogen har sagt fra' : 'Venter'}
						</AdmMaerkat>
					</div>

					<div class="fv-tal">
						<span><b>{tal(f.p)}</b> protein</span>
						<span><b>{tal(f.f)}</b> fiber</span>
						<span><b>{tal(f.kh)}</b> kulhydrat</span>
						<span><b>{tal(f.fedt)}</b> fedt</span>
						<span><b>{tal(f.kcal)}</b> kcal</span>
						<span class="fv-pr">pr 100 g</span>
					</div>

					{#if ok > 0 || ej > 0}
						<p class="fv-stemmer">
							{ok}
							{ok === 1 ? 'kunde' : 'kunder'} siger tallene passer{#if ej > 0}, {ej} siger de ikke gør{/if}
						</p>
					{/if}

					<div class="fv-knapper">
						<AdmKnap disabled={arbejder === f.id} onclick={() => toggleVerificeret(f)}>
							{f.verificeret ? 'Fjern godkendelsen' : 'Godkend varen'}
						</AdmKnap>
						{#if sletId === f.id}
							<span class="fv-advarsel">Slettes permanent. Gamle registreringer beholder tallene.</span>
							<AdmKnap slags="fare" disabled={arbejder === f.id} onclick={() => slet(f)}>
								{arbejder === f.id ? 'Sletter…' : 'Ja, slet'}
							</AdmKnap>
							<AdmKnap onclick={() => (sletId = '')}>Fortryd</AdmKnap>
						{:else}
							<AdmKnap slags="fare" onclick={() => (sletId = f.id)}>Slet</AdmKnap>
						{/if}
					</div>
				</AdmKort>
			{/each}
		{/if}
	</AdmSide>
{/if}

<style>
	.fv-kun {
		padding: 24px 18px;
		color: var(--ink-2);
		font-size: calc(14px * var(--fs-scale, 1));
	}

	.fv-filtre {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		margin-bottom: 10px;
	}

	/* Baggrunden staar eksplicit, se noten i AdmKnap. */
	.fv-chip {
		padding: 8px 14px;
		background: var(--paper-2, #f6f0e7);
		border: 1px solid var(--line, #e8dfd1);
		border-radius: 99px;
		color: var(--ink-2, #6f5f57);
		font-size: calc(12.5px * var(--fs-scale, 1));
		font-family: inherit;
		font-weight: 600;
		cursor: pointer;
	}

	.fv-chip.paa {
		background: var(--plum, #7c4f63);
		border-color: var(--plum, #7c4f63);
		color: #fff;
	}

	.fv-antal {
		margin: 10px 0 12px;
		font-size: calc(12px * var(--fs-scale, 1));
		color: var(--ink-3, #a3948a);
	}

	.fv-hoved {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 10px;
		margin-bottom: 8px;
	}

	.fv-navn {
		font-size: calc(14.5px * var(--fs-scale, 1));
		font-weight: 600;
	}

	.fv-meta {
		margin-top: 2px;
		font-size: calc(11.5px * var(--fs-scale, 1));
		color: var(--ink-3, #a3948a);
	}

	.fv-tal {
		display: flex;
		flex-wrap: wrap;
		gap: 4px 14px;
		margin-bottom: 8px;
		font-size: calc(11.5px * var(--fs-scale, 1));
		color: var(--ink-3, #a3948a);
	}

	.fv-tal b {
		color: var(--espresso, #382c2a);
		font-size: calc(13px * var(--fs-scale, 1));
	}

	.fv-pr {
		font-style: italic;
	}

	.fv-stemmer {
		margin: 0 0 10px;
		font-size: calc(12px * var(--fs-scale, 1));
		color: var(--ink-2, #6f5f57);
	}

	.fv-knapper {
		display: flex;
		align-items: center;
		gap: 8px;
		flex-wrap: wrap;
	}

	.fv-advarsel {
		font-size: calc(11.5px * var(--fs-scale, 1));
		color: var(--ler-tekst, #8a5439);
		font-weight: 600;
	}
</style>
