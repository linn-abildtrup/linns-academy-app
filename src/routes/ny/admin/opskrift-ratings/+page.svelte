<script lang="ts">
	// ============================================================
	// Hvad kunderne synes om opskrifterne, i det nye design.
	//
	// Tredje af de 19 gamle admin-sider, 1. september 2026. Ogsaa en der
	// KUN VISER noget, saa den kan ikke goere skade.
	//
	// Den gamle side paa /app/admin/opskrifter/ratings er uroert.
	//
	// BEMAERK at den her datastroem stopper den dag et hold flyttes til
	// 3.0: stjernerne paa en opskrift findes ikke i den nye kundeflade, se
	// 9.58 punkt 4 i overdragelsen.
	// ============================================================

	import { getContext, onMount } from 'svelte';
	import type { User } from 'firebase/auth';
	import { isAdmin } from '$lib/admin';
	import type { Opskrift } from '$lib/content/opskrifter';
	import { hentAlleOpskrifter } from '$lib/firestore/opskrifter';
	import AdmSide from '$lib/components/admin/AdmSide.svelte';
	import AdmKnap from '$lib/components/admin/AdmKnap.svelte';
	import AdmTom from '$lib/components/admin/AdmTom.svelte';

	const hentUser = getContext<() => User | null>('user');
	const maaVaereHer = $derived(isAdmin(hentUser()));

	type Sortering = 'lavest' | 'hoejest' | 'alfabetisk';

	let opskrifter = $state<Opskrift[]>([]);
	let henter = $state(true);
	let fejl = $state('');
	let sortering = $state<Sortering>('lavest');

	onMount(() => void indlaes());

	async function indlaes() {
		henter = true;
		fejl = '';
		try {
			opskrifter = await hentAlleOpskrifter(false);
		} catch (e) {
			console.error('[admin] opskrift-ratings', e);
			fejl = 'Kunne ikke hente opskrifterne.';
		} finally {
			henter = false;
		}
	}

	const sorteret = $derived.by(() => {
		const liste = [...opskrifter];
		if (sortering === 'alfabetisk') {
			liste.sort((a, b) => a.titel.localeCompare(b.titel, 'da'));
			return liste;
		}
		// Dem UDEN stjerner ligger altid nederst. En ret ingen har vurderet
		// er ikke en daarlig ret, og den maa ikke ligge oeverst paa en liste
		// der handler om hvad der er galt.
		liste.sort((a, b) => {
			const aHar = (a.ratingCount ?? 0) > 0;
			const bHar = (b.ratingCount ?? 0) > 0;
			if (aHar && !bHar) return -1;
			if (!aHar && bHar) return 1;
			if (!aHar && !bHar) return a.titel.localeCompare(b.titel, 'da');
			const aa = a.ratingAvg ?? 0;
			const bb = b.ratingAvg ?? 0;
			return sortering === 'lavest' ? aa - bb : bb - aa;
		});
		return liste;
	});

	const medStjerner = $derived(opskrifter.filter((o) => (o.ratingCount ?? 0) > 0).length);

	function snit(avg: number | null | undefined): string {
		if (typeof avg !== 'number') return '—';
		return avg.toFixed(1).replace('.', ',');
	}
</script>

<svelte:head><title>Opskrift-vurderinger · Admin</title></svelte:head>

{#if !maaVaereHer}
	<p class="or-kun">Siden er kun for admin.</p>
{:else}
	<AdmSide
		titel="Hvad kunderne synes om opskrifterne"
		under="Retterne med de laveste stjerner står øverst. Det er dem der er værd at kigge på først."
		bred
	>
		{#snippet handling()}
			<AdmKnap onclick={indlaes}>Hent igen</AdmKnap>
		{/snippet}

		<p class="or-tal">
			{medStjerner} af {opskrifter.length} opskrifter har fået mindst én stjerne
		</p>

		<div class="or-filtre">
			{#each [['lavest', 'Laveste først'], ['hoejest', 'Højeste først'], ['alfabetisk', 'Efter navn']] as [id, navn] (id)}
				<button
					type="button"
					class="or-chip"
					class:paa={sortering === id}
					onclick={() => (sortering = id as Sortering)}
				>
					{navn}
				</button>
			{/each}
		</div>

		{#if henter}
			<AdmTom tekst="Henter opskrifterne…" />
		{:else if fejl}
			<AdmTom tekst={fejl} fejl>
				{#snippet handling()}
					<AdmKnap onclick={indlaes}>Prøv igen</AdmKnap>
				{/snippet}
			</AdmTom>
		{:else if sorteret.length === 0}
			<AdmTom tekst="Der er ingen opskrifter endnu." />
		{:else}
			<div class="or-liste">
				{#each sorteret as o (o.id)}
					{@const antal = o.ratingCount ?? 0}
					<a class="or-raekke" href="/app/admin/opskrifter/{o.id}">
						<span class="or-navn">{o.titel}</span>
						{#if antal > 0}
							<span class="or-snit" class:lav={(o.ratingAvg ?? 5) < 3.5}>{snit(o.ratingAvg)}</span>
							<span class="or-antal">{antal} {antal === 1 ? 'stemme' : 'stemmer'}</span>
						{:else}
							<span class="or-ingen">Ingen har vurderet den endnu</span>
						{/if}
					</a>
				{/each}
			</div>
		{/if}
	</AdmSide>
{/if}

<style>
	.or-kun {
		padding: 24px 18px;
		color: var(--ink-2);
		font-size: calc(14px * var(--fs-scale, 1));
	}

	.or-tal {
		margin: 0 0 12px;
		font-size: calc(12.5px * var(--fs-scale, 1));
		color: var(--ink-3, #a3948a);
	}

	.or-filtre {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		margin-bottom: 14px;
	}

	/* Baggrunden staar eksplicit, se noten i AdmKnap. */
	.or-chip {
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

	.or-chip.paa {
		background: var(--plum, #7c4f63);
		border-color: var(--plum, #7c4f63);
		color: #fff;
	}

	.or-liste {
		display: flex;
		flex-direction: column;
		gap: 5px;
	}

	.or-raekke {
		display: flex;
		align-items: baseline;
		gap: 12px;
		padding: 13px 16px;
		background: var(--paper-2, #f6f0e7);
		border-radius: 13px;
		text-decoration: none;
		color: inherit;
	}

	.or-navn {
		flex: 1;
		min-width: 0;
		font-size: calc(14px * var(--fs-scale, 1));
		font-weight: 600;
	}

	.or-snit {
		font-size: calc(17px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--honey-deep, #b47f3e);
	}

	.or-snit.lav {
		color: var(--ler-tekst, #8a5439);
	}

	.or-antal,
	.or-ingen {
		font-size: calc(11.5px * var(--fs-scale, 1));
		color: var(--ink-3, #a3948a);
		white-space: nowrap;
	}
</style>
