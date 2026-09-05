<script lang="ts">
	// ============================================================
	// Hvad kunderne synes om AI'ens svar, i det nye design.
	//
	// Anden af de 19 gamle admin-sider der laves om, 1. september 2026.
	// Taget tidligt fordi den KUN VISER noget: gaar noget galt her, kan der
	// ikke gaa data tabt. De sider der skriver til kundedata tages til
	// sidst.
	//
	// Den gamle side paa /app/admin/ai-ratings er uroert.
	// ============================================================

	import { getContext, onMount } from 'svelte';
	import type { User } from 'firebase/auth';
	import { isAdmin } from '$lib/admin';
	import { hentAlleAiRatings } from '$lib/firestore/aiRating';
	import { AI_TYPE_LABELS, type AiRating, type AiType, type Rating } from '$lib/content/aiRating';
	import AdmSide from '$lib/components/admin/AdmSide.svelte';
	import AdmKort from '$lib/components/admin/AdmKort.svelte';
	import AdmKnap from '$lib/components/admin/AdmKnap.svelte';
	import AdmMaerkat from '$lib/components/admin/AdmMaerkat.svelte';
	import AdmTom from '$lib/components/admin/AdmTom.svelte';

	const hentUser = getContext<() => User | null>('user');
	const maaVaereHer = $derived(isAdmin(hentUser()));

	let ratings = $state<AiRating[]>([]);
	let henter = $state(true);
	let fejl = $state('');
	let aabne = $state<Set<string>>(new Set());
	let filterAi = $state<AiType | 'alle'>('alle');
	let filterMaks = $state<Rating | 'alle'>('alle');

	onMount(() => void indlaes());

	async function indlaes() {
		henter = true;
		fejl = '';
		try {
			ratings = await hentAlleAiRatings();
		} catch (e) {
			console.error('[admin] ai-ratings', e);
			fejl = 'Kunne ikke hente vurderingerne.';
		} finally {
			henter = false;
		}
	}

	function toggle(id: string) {
		const ny = new Set(aabne);
		if (ny.has(id)) ny.delete(id);
		else ny.add(id);
		aabne = ny;
	}

	const listen = $derived(
		ratings.filter((r) => {
			if (filterAi !== 'alle' && r.aiType !== filterAi) return false;
			if (filterMaks !== 'alle' && r.rating > filterMaks) return false;
			return true;
		})
	);

	const tal = $derived.by(() => {
		const g: Record<AiType, { antal: number; sum: number }> = {
			'linn-ai': { antal: 0, sum: 0 },
			'app-hjaelp': { antal: 0, sum: 0 }
		};
		for (const r of ratings) {
			g[r.aiType].antal += 1;
			g[r.aiType].sum += r.rating;
		}
		return g;
	});

	function snit(a: { antal: number; sum: number }): string {
		if (a.antal === 0) return '—';
		return (Math.round((a.sum / a.antal) * 10) / 10).toString().replace('.', ',');
	}

	function dato(ts: unknown): string {
		if (!ts || typeof ts !== 'object' || !('toDate' in ts)) return '';
		return (ts as { toDate: () => Date })
			.toDate()
			.toLocaleDateString('da-DK', {
				day: 'numeric',
				month: 'short',
				hour: '2-digit',
				minute: '2-digit'
			});
	}

	function stjerner(r: Rating): string {
		return '★'.repeat(r) + '☆'.repeat(5 - r);
	}
</script>

<svelte:head><title>AI-vurderinger · Admin</title></svelte:head>

{#if !maaVaereHer}
	<p class="ar-kun">Siden er kun for admin.</p>
{:else}
	<AdmSide
		titel="Hvad kunderne synes om AI'en"
		under="Kundernes egne vurderinger af svarene. Brug de lave til at se hvor videnbasen mangler noget."
		bred
	>
		{#snippet handling()}
			<AdmKnap onclick={indlaes}>Hent igen</AdmKnap>
		{/snippet}

		<div class="ar-tal">
			{#each Object.entries(AI_TYPE_LABELS) as [id, navn] (id)}
				<div class="ar-t-kort">
					<span class="v">{snit(tal[id as AiType])}</span>
					<span class="m">{navn}</span>
					<span class="u">{tal[id as AiType].antal} vurderinger</span>
				</div>
			{/each}
		</div>

		<div class="ar-filtre">
			<button
				type="button"
				class="ar-chip"
				class:paa={filterAi === 'alle'}
				onclick={() => (filterAi = 'alle')}
			>
				Begge
			</button>
			{#each Object.entries(AI_TYPE_LABELS) as [id, navn] (id)}
				<button
					type="button"
					class="ar-chip"
					class:paa={filterAi === id}
					onclick={() => (filterAi = id as AiType)}
				>
					{navn}
				</button>
			{/each}
			<span class="ar-skel"></span>
			<button
				type="button"
				class="ar-chip"
				class:paa={filterMaks === 'alle'}
				onclick={() => (filterMaks = 'alle')}
			>
				Alle stjerner
			</button>
			<button
				type="button"
				class="ar-chip"
				class:paa={filterMaks === 3}
				onclick={() => (filterMaks = 3)}
			>
				3 og derunder
			</button>
			<button
				type="button"
				class="ar-chip"
				class:paa={filterMaks === 2}
				onclick={() => (filterMaks = 2)}
			>
				2 og derunder
			</button>
		</div>

		<p class="ar-antal">{listen.length} {listen.length === 1 ? 'vurdering' : 'vurderinger'}</p>

		{#if henter}
			<AdmTom tekst="Henter vurderingerne…" />
		{:else if fejl}
			<AdmTom tekst={fejl} fejl>
				{#snippet handling()}
					<AdmKnap onclick={indlaes}>Prøv igen</AdmKnap>
				{/snippet}
			</AdmTom>
		{:else if listen.length === 0}
			<AdmTom tekst="Ingen vurderinger matcher det du har valgt." />
		{:else}
			{#each listen as r (r.id)}
				<AdmKort ro={r.rating <= 2}>
					<div class="ar-hoved">
						<div>
							<span class="ar-stj" class:lav={r.rating <= 2}>{stjerner(r.rating)}</span>
							<div class="ar-meta">{dato(r.oprettetAt)} · {r.userEmail}</div>
						</div>
						<AdmMaerkat farve="stille">{AI_TYPE_LABELS[r.aiType]}</AdmMaerkat>
					</div>

					<p class="ar-sp">{r.sporgsmaal}</p>

					{#if aabne.has(r.id)}
						<div class="ar-svar">
							<span class="ar-svar-mrk">AI'ens svar</span>
							<p>{r.svar}</p>
						</div>
					{/if}
					<AdmKnap onclick={() => toggle(r.id)}>
						{aabne.has(r.id) ? 'Skjul svaret' : 'Se svaret'}
					</AdmKnap>
				</AdmKort>
			{/each}
		{/if}
	</AdmSide>
{/if}

<style>
	.ar-kun {
		padding: 24px 18px;
		color: var(--ink-2);
		font-size: calc(14px * var(--fs-scale, 1) * var(--adm-skala, 1));
	}

	.ar-tal {
		display: flex;
		gap: 10px;
		flex-wrap: wrap;
		margin-bottom: 14px;
	}

	.ar-t-kort {
		flex: 1 1 160px;
		padding: 15px 17px;
		background: var(--paper-2, #f6f0e7);
		border-radius: 16px;
	}

	.ar-t-kort .v {
		display: block;
		font-size: calc(30px * var(--fs-scale, 1) * var(--adm-skala, 1));
		line-height: 1.05;
		letter-spacing: -0.02em;
	}

	.ar-t-kort .m {
		display: block;
		margin-top: 5px;
		font-size: calc(12.5px * var(--fs-scale, 1) * var(--adm-skala, 1));
		color: var(--ink-2, #6f5f57);
	}

	.ar-t-kort .u {
		display: block;
		font-size: calc(11px * var(--fs-scale, 1) * var(--adm-skala, 1));
		color: var(--ink-3, #a3948a);
	}

	.ar-filtre {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 6px;
		margin-bottom: 10px;
	}

	.ar-skel {
		width: 1px;
		height: 20px;
		background: var(--line, #e8dfd1);
		margin: 0 4px;
	}

	/* Baggrunden staar eksplicit, se noten i AdmKnap. */
	.ar-chip {
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

	.ar-chip.paa {
		background: var(--plum, #7c4f63);
		border-color: var(--plum, #7c4f63);
		color: #fff;
	}

	.ar-antal {
		margin: 0 0 12px;
		font-size: calc(12px * var(--fs-scale, 1) * var(--adm-skala, 1));
		color: var(--ink-3, #a3948a);
	}

	.ar-hoved {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 10px;
		margin-bottom: 8px;
	}

	.ar-stj {
		font-size: calc(15px * var(--fs-scale, 1) * var(--adm-skala, 1));
		color: var(--honey-deep, #b47f3e);
		letter-spacing: 0.06em;
	}

	.ar-stj.lav {
		color: var(--ler-tekst, #8a5439);
	}

	.ar-meta {
		margin-top: 2px;
		font-size: calc(11.5px * var(--fs-scale, 1) * var(--adm-skala, 1));
		color: var(--ink-3, #a3948a);
	}

	.ar-sp {
		margin: 0 0 10px;
		font-size: calc(14px * var(--fs-scale, 1) * var(--adm-skala, 1));
		line-height: 1.5;
		white-space: pre-wrap;
	}

	.ar-svar {
		padding: 11px 14px;
		background: var(--paper, #fbf8f2);
		border-radius: 12px;
		margin-bottom: 10px;
	}

	.ar-svar-mrk {
		display: block;
		margin-bottom: 4px;
		font-size: calc(10.5px * var(--fs-scale, 1) * var(--adm-skala, 1));
		font-weight: 700;
		letter-spacing: 0.09em;
		text-transform: uppercase;
		color: var(--ink-3, #a3948a);
	}

	.ar-svar p {
		margin: 0;
		font-size: calc(13.5px * var(--fs-scale, 1) * var(--adm-skala, 1));
		line-height: 1.5;
		white-space: pre-wrap;
	}
</style>
