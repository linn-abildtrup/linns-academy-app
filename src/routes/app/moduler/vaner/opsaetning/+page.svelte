<script lang="ts">
	import { getContext, onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import type { User } from 'firebase/auth';
	import type { UserDoc } from '$lib/types';
	import {
		maksAntalVaner,
		type AboVaneForslag,
		type AboVaneOpsaetning,
		type ValgtVane
	} from '$lib/content/aboVaner';
	import {
		hentAboVaneskabelon,
		hentAboVaneOpsaetning,
		gemAboVaneOpsaetning
	} from '$lib/firestore/aboVaner';
	import { erModulbruger } from '$lib/utils/userAdgang';
	import Icon from '$lib/components/Icon.svelte';
	import Loading from '$lib/components/Loading.svelte';

	const getUser = getContext<() => User | null>('user');
	const getUserDoc = getContext<() => UserDoc | null>('userDoc');
	const user = $derived(getUser());
	const userDoc = $derived(getUserDoc());

	// Alle app-kunder har samme vanetracker (3 vaner) — premium-tier fjernet 11/6.
	const produktType = 'basis' as const;
	const maks = maksAntalVaner(produktType);

	let forslag = $state<AboVaneForslag[]>([]);
	let opsaetning = $state<AboVaneOpsaetning | null>(null);
	let valgteIds = $state<Set<string>>(new Set());
	let egneVaner = $state<{ tempId: string; label: string }[]>([]);
	let loading = $state(true);
	let gemmer = $state(false);
	let fejl = $state<string | null>(null);

	const antalValgt = $derived(valgteIds.size + egneVaner.filter((e) => e.label.trim()).length);

	onMount(async () => {
		const u = user;
		if (!u || !erModulbruger(userDoc)) {
			fejl = 'Du har ikke adgang til Små skridt.';
			loading = false;
			return;
		}
		try {
			[forslag, opsaetning] = await Promise.all([
				hentAboVaneskabelon(produktType),
				hentAboVaneOpsaetning(u.uid)
			]);

			if (opsaetning) {
				const ids = new Set<string>();
				const egne: { tempId: string; label: string }[] = [];
				for (const v of opsaetning.valgteVaner) {
					if (v.kilde === 'kurateret') ids.add(v.id);
					else egne.push({ tempId: v.id, label: v.label });
				}
				valgteIds = ids;
				egneVaner = egne;
			}
		} catch (e) {
			console.error(e);
			fejl = 'Kunne ikke hente data.';
		} finally {
			loading = false;
		}
	});

	function toggleForslag(id: string) {
		const ny = new Set(valgteIds);
		if (ny.has(id)) {
			ny.delete(id);
		} else if (antalValgt < maks) {
			ny.add(id);
		}
		valgteIds = ny;
	}

	function tilfojEgenVane() {
		if (antalValgt >= maks) return;
		egneVaner = [...egneVaner, { tempId: `egen-${Date.now()}`, label: '' }];
	}

	function fjernEgenVane(tempId: string) {
		egneVaner = egneVaner.filter((e) => e.tempId !== tempId);
	}

	async function gem() {
		const u = user;
		if (!u) return;
		gemmer = true;
		fejl = null;
		try {
			const valgte: ValgtVane[] = [];
			for (const id of valgteIds) {
				const f = forslag.find((x) => x.id === id);
				if (f) valgte.push({ id: f.id, label: f.label, kilde: 'kurateret' });
			}
			for (const e of egneVaner) {
				const label = e.label.trim();
				if (label) valgte.push({ id: e.tempId, label, kilde: 'egen' });
			}
			if (valgte.length > maks) {
				fejl = `Du kan højst vælge ${maks} ${maks === 1 ? 'vane' : 'vaner'}.`;
				gemmer = false;
				return;
			}
			await gemAboVaneOpsaetning(u.uid, valgte, produktType);
			goto('/app/moduler/vaner');
		} catch (e) {
			console.error(e);
			fejl = 'Kunne ikke gemme. Prøv igen.';
			gemmer = false;
		}
	}
</script>

<div class="page">
	<header class="page-header">
		<a class="back" href="/app/moduler/vaner">
			<Icon name="arrow-l" size={14} color="var(--text2)" />
			<span>Små skridt</span>
		</a>
		<div class="eyebrow">Små skridt · Opsætning</div>
		<h1>Vælg dine små skridt</h1>
		<p class="page-sub">
			Vælg op til 3 små skridt du vil arbejde med dagligt. Du kan vælge fra forslagene eller skrive dine
			egne — eller du kan gemme uden at vælge nogen og komme tilbage senere.
		</p>
	</header>

	{#if loading}
		<Loading tekst="Henter forslag..." />
	{:else if fejl && forslag.length === 0}
		<div class="status-besked fejl">{fejl}</div>
	{:else}
		<div class="taeller">
			<div class="taeller-tekst">Valgt</div>
			<div class="taeller-tal" class:full={antalValgt >= maks}>
				{antalValgt} / {maks}
			</div>
		</div>

		<section class="card">
			<div class="kort-titel">Forslag</div>
			{#if forslag.length === 0}
				<p class="hint">Linn har ikke oprettet forslag endnu.</p>
			{:else}
				<div class="forslag-liste">
					{#each forslag as f (f.id)}
						{@const valgt = valgteIds.has(f.id)}
						<button
							class="forslag-row"
							class:valgt
							disabled={!valgt && antalValgt >= maks}
							onclick={() => toggleForslag(f.id)}
						>
							<div class="check-cirkel" class:valgt>
								{#if valgt}
									<Icon name="check" size={10} color="#fff" />
								{/if}
							</div>
							<div class="forslag-tekst">
								<div class="forslag-label">{f.label}</div>
								{#if f.kategori}
									<div class="forslag-kat">{f.kategori}</div>
								{/if}
							</div>
						</button>
					{/each}
				</div>
			{/if}
		</section>

		<section class="card">
			<div class="kort-titel">Egne små skridt</div>
			{#each egneVaner as e (e.tempId)}
				<div class="rad">
					<input
						type="text"
						class="input-egen"
						placeholder="Skriv dit eget lille skridt"
						bind:value={e.label}
					/>
					<button class="slet-btn" aria-label="Fjern" onclick={() => fjernEgenVane(e.tempId)}>
						×
					</button>
				</div>
			{/each}
			<button class="tilfoj-btn" onclick={tilfojEgenVane} disabled={antalValgt >= maks}>
				<Icon name="plus" size={14} color="var(--text2)" />
				Tilføj egen vane
			</button>
		</section>

		{#if fejl}
			<div class="status-besked fejl">{fejl}</div>
		{/if}

		<button class="gem-btn" onclick={gem} disabled={gemmer}>
			{gemmer ? 'Gemmer...' : opsaetning ? 'Opdater små skridt' : 'Gem små skridt'}
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

	.page-sub {
		font-size: calc(13px * var(--fs-scale, 1));
		color: var(--text2);
		margin: 6px 0 0;
		line-height: 1.4;
	}

	.taeller {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		padding: 0 4px;
		margin-bottom: 10px;
	}

	.taeller-tekst {
		font-size: calc(11px * var(--fs-scale, 1));
		font-weight: 600;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--text3);
	}

	.taeller-tal {
		font-family: var(--ff-d);
		font-size: calc(18px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--text2);
	}

	.taeller-tal.full {
		color: var(--terra);
	}

	.card {
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 14px;
		padding: 14px;
		margin-bottom: 14px;
	}

	.kort-titel {
		font-size: calc(11px * var(--fs-scale, 1));
		font-weight: 600;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: var(--text3);
		margin-bottom: 10px;
	}

	.forslag-liste {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.forslag-row {
		display: flex;
		gap: 12px;
		align-items: center;
		padding: 10px 12px;
		background: var(--bg2);
		border: 1px solid var(--border);
		border-radius: 10px;
		text-align: left;
		cursor: pointer;
		font-family: var(--ff-b);
	}

	.forslag-row.valgt {
		background: var(--sdim);
		border-color: var(--sage);
	}

	.forslag-row:disabled:not(.valgt) {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.check-cirkel {
		width: 22px;
		height: 22px;
		border-radius: 50%;
		border: 1.5px solid var(--border);
		background: var(--white);
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.check-cirkel.valgt {
		background: var(--sage);
		border-color: var(--sage);
	}

	.forslag-tekst {
		flex: 1;
		min-width: 0;
	}

	.forslag-label {
		font-size: calc(13.5px * var(--fs-scale, 1));
		color: var(--text);
		font-weight: 500;
	}

	.forslag-kat {
		font-size: calc(10.5px * var(--fs-scale, 1));
		color: var(--text3);
		margin-top: 1px;
	}

	.rad {
		display: flex;
		gap: 6px;
		margin-bottom: 6px;
	}

	.input-egen {
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

	.input-egen:focus {
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

	.tilfoj-btn {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 9px 12px;
		margin-top: 6px;
		font-size: calc(12px * var(--fs-scale, 1));
		font-weight: 600;
		font-family: var(--ff-b);
		color: var(--text2);
		border: 1px dashed var(--border);
		background: var(--white);
		border-radius: 8px;
		cursor: pointer;
	}

	.tilfoj-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.status-besked {
		padding: 12px 14px;
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 12px;
		font-size: calc(13px * var(--fs-scale, 1));
		text-align: center;
		margin-bottom: 14px;
	}

	.status-besked.fejl {
		color: #8a4a3e;
		background: #fbeeea;
		border-color: #f0d6cf;
	}

	.gem-btn {
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
	}

	.gem-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.hint {
		font-size: calc(12px * var(--fs-scale, 1));
		color: var(--text3);
		margin: 0;
	}
</style>
