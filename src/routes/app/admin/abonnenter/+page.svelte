<script lang="ts">
	import { onMount } from 'svelte';
	import Icon from '$lib/components/Icon.svelte';
	import Loading from '$lib/components/Loading.svelte';
	import { hentAbonnentAllowedEmails } from '$lib/firestore/forlob';
	import type { AllowedEmail } from '$lib/content/forlobAdgang';

	let abonnenter = $state<AllowedEmail[]>([]);
	let loading = $state(true);
	let fejl = $state<string | null>(null);
	let filter = $state<'alle' | 'basis' | 'premium' | 'kun-aktive'>('alle');

	onMount(async () => {
		try {
			abonnenter = await hentAbonnentAllowedEmails();
		} catch (e) {
			console.error(e);
			fejl = 'Kunne ikke hente abonnenter.';
		} finally {
			loading = false;
		}
	});

	const filtreret = $derived(
		abonnenter.filter((a) => {
			if (filter === 'basis') return a.accessLevel === 'basis';
			if (filter === 'premium') return a.accessLevel === 'premium';
			if (filter === 'kun-aktive') return a.activeSubscription === true;
			return true;
		})
	);

	const aktiveBasis = $derived(
		abonnenter.filter((a) => a.accessLevel === 'basis' && a.activeSubscription).length
	);
	const aktivePremium = $derived(
		abonnenter.filter((a) => a.accessLevel === 'premium' && a.activeSubscription).length
	);

	function visDato(ts?: number): string {
		if (!ts) return '';
		const d = new Date(ts);
		return d.toLocaleDateString('da-DK', { day: '2-digit', month: 'short', year: '2-digit' });
	}

	function produktLabel(a: AllowedEmail): string {
		const map: Record<string, string> = {
			basisabo: 'Basis-abo',
			premiumabo: 'Premium-abo',
			kickstart: 'Kickstart',
			premiumforløb: 'Premium-forløb'
		};
		return a.activeProduct ? (map[a.activeProduct] ?? a.activeProduct) : '—';
	}
</script>

<div class="page">
	<header class="page-header">
		<a class="back" href="/app/admin">
			<Icon name="arrow-l" size={14} color="var(--text2)" />
			<span>Admin</span>
		</a>
		<div class="eyebrow">Admin</div>
		<h1>Abonnenter</h1>
		<p class="page-sub">
			Alle brugere med basis- eller premium-abonnement fra Simplero. Listen omfatter
			whitelistede emails — brugeren ses kun i den fulde bruger-liste, når hun har
			logget ind første gang.
		</p>
	</header>

	{#if loading}
		<Loading tekst="Henter abonnenter..." />
	{:else if fejl}
		<div class="status-besked fejl">{fejl}</div>
	{:else}
		<div class="kpi-rad">
			<div class="kpi">
				<div class="kpi-tal">{aktiveBasis}</div>
				<div class="kpi-lbl">Aktive basis</div>
			</div>
			<div class="kpi">
				<div class="kpi-tal">{aktivePremium}</div>
				<div class="kpi-lbl">Aktive premium</div>
			</div>
			<div class="kpi">
				<div class="kpi-tal">{abonnenter.length}</div>
				<div class="kpi-lbl">I alt</div>
			</div>
		</div>

		<div class="chips">
			{#each [{ id: 'alle' as const, l: 'Alle' }, { id: 'kun-aktive' as const, l: 'Kun aktive' }, { id: 'basis' as const, l: 'Basis' }, { id: 'premium' as const, l: 'Premium' }] as f (f.id)}
				<button
					type="button"
					class="chip"
					class:aktiv={filter === f.id}
					onclick={() => (filter = f.id)}
				>
					{f.l}
				</button>
			{/each}
		</div>

		{#if filtreret.length === 0}
			<div class="status-besked">Ingen abonnenter matcher filteret.</div>
		{:else}
			<div class="liste">
				{#each filtreret as a (a.email)}
					<div class="kort">
						<div class="kort-top">
							<div class="kort-email">{a.email}</div>
							<span
								class="badge"
								class:badge-aktiv={a.activeSubscription}
								class:badge-inaktiv={!a.activeSubscription}
							>
								{a.activeSubscription ? 'Aktiv' : 'Stoppet'}
							</span>
						</div>
						<div class="kort-meta">
							<span class="meta-tag" class:tag-premium={a.accessLevel === 'premium'}>
								{produktLabel(a)}
							</span>
							<span>
								{a.status === 'registered' ? 'Tilmeldt appen ✓' : 'Ikke logget ind endnu'}
							</span>
							{#if a.updatedAt}
								<span>· opdateret {visDato(a.updatedAt)}</span>
							{/if}
						</div>
						{#if a.simpleroCustomerId}
							<div class="kort-id">Simplero-id: {a.simpleroCustomerId}</div>
						{/if}
					</div>
				{/each}
			</div>
		{/if}
	{/if}
</div>

<style>
	.page {
		max-width: 720px;
		margin: 0 auto;
		padding: 16px 18px 80px;
	}
	.page-header {
		margin-bottom: 18px;
	}
	.back {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		color: var(--text2);
		font-size: calc(12px * var(--fs-scale, 1));
		text-decoration: none;
		margin-bottom: 8px;
	}
	.eyebrow {
		font-size: calc(11px * var(--fs-scale, 1));
		font-weight: 600;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--text3);
	}
	h1 {
		font-family: var(--ff-d);
		font-size: calc(22px * var(--fs-scale, 1));
		font-weight: 600;
		margin: 4px 0 6px;
	}
	.page-sub {
		font-size: calc(13px * var(--fs-scale, 1));
		color: var(--text2);
		line-height: 1.4;
	}
	.kpi-rad {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 8px;
		margin-bottom: 14px;
	}
	.kpi {
		padding: 10px 12px;
		background: var(--bg2);
		border-radius: 12px;
		text-align: center;
	}
	.kpi-tal {
		font-family: var(--ff-d);
		font-size: calc(20px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--text);
	}
	.kpi-lbl {
		font-size: calc(11px * var(--fs-scale, 1));
		color: var(--text3);
		margin-top: 2px;
	}
	.chips {
		display: flex;
		gap: 6px;
		flex-wrap: wrap;
		margin-bottom: 14px;
	}
	.chip {
		padding: 6px 12px;
		font-size: calc(12px * var(--fs-scale, 1));
		border-radius: 99px;
		border: 1px solid var(--border);
		background: var(--white);
		color: var(--text2);
		font-family: var(--ff-b);
		cursor: pointer;
	}
	.chip.aktiv {
		background: var(--terra);
		color: #fff;
		border-color: var(--terra);
	}
	.liste {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.kort {
		padding: 12px 14px;
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 12px;
	}
	.kort-top {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		margin-bottom: 4px;
	}
	.kort-email {
		font-family: var(--ff-b);
		font-weight: 600;
		font-size: calc(14px * var(--fs-scale, 1));
		color: var(--text);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.badge {
		font-size: calc(10px * var(--fs-scale, 1));
		font-weight: 700;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		padding: 3px 8px;
		border-radius: 99px;
		flex-shrink: 0;
	}
	.badge-aktiv {
		background: #eef5ef;
		color: #406a4e;
	}
	.badge-inaktiv {
		background: var(--bg2);
		color: var(--text3);
	}
	.kort-meta {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		align-items: center;
		font-size: calc(11.5px * var(--fs-scale, 1));
		color: var(--text3);
	}
	.meta-tag {
		padding: 2px 8px;
		border-radius: 99px;
		background: var(--bg2);
		color: var(--text2);
		font-weight: 500;
	}
	.tag-premium {
		background: rgba(157, 99, 88, 0.12);
		color: var(--terra);
	}
	.kort-id {
		margin-top: 4px;
		font-size: calc(10.5px * var(--fs-scale, 1));
		color: var(--text3);
		font-family: 'SF Mono', Menlo, monospace;
	}
	.status-besked {
		padding: 12px 14px;
		background: var(--bg2);
		border-radius: 10px;
		color: var(--text2);
		font-size: calc(13px * var(--fs-scale, 1));
	}
	.status-besked.fejl {
		background: #fbeeea;
		color: #8a4a3e;
	}
</style>
