<script lang="ts">
	// Små skridt-fane på en forløbsdag — READ-visning. Viser hvilke små skridt
	// der er planlagt til netop denne dag (udregnet fra hvert skridts tidsplan).
	// Selve oprettelsen/redigeringen sker i det samlede overblik
	// (/app/admin/forlob/{id}/smaa-skridt).
	import { hentForlob } from '$lib/firestore/forlob';
	import type { Forlob } from '$lib/content/forlobAdgang';
	import { hentSmaaSkridt } from '$lib/firestore/smaaSkridt';
	import { dageForPlan, planTekst, type SmaaSkridt } from '$lib/content/smaaSkridt';

	let { forlobId, dagNummer }: { forlobId: string; dagNummer: number } = $props();

	let forlob = $state<Forlob | null>(null);
	let skridt = $state<SmaaSkridt[]>([]);
	let loading = $state(true);
	let fejl = $state<string | null>(null);

	$effect(() => {
		indlaes(forlobId);
	});

	async function indlaes(fid: string) {
		loading = true;
		fejl = null;
		try {
			const [f, s] = await Promise.all([hentForlob(fid), hentSmaaSkridt(fid)]);
			forlob = f;
			skridt = s;
		} catch (e) {
			console.error(e);
			fejl = 'Kunne ikke hente små skridt.';
		} finally {
			loading = false;
		}
	}

	// De små skridt hvis tidsplan rammer denne dag.
	const dagensSkridt = $derived.by<SmaaSkridt[]>(() => {
		const f = forlob;
		if (!f) return [];
		return skridt.filter((s) =>
			dageForPlan(s.plan, f.antalDage, f.startDato.toDate()).includes(dagNummer)
		);
	});
</script>

{#if loading}
	<div class="status-besked">Henter...</div>
{:else if fejl}
	<div class="status-besked fejl">{fejl}</div>
{:else}
	<section class="card">
		<div class="card-head">
			<div class="card-titel">
				Små skridt på {dagNummer === 0 ? 'baseline' : `dag ${dagNummer}`}
			</div>
			<a class="rediger-link" href="/app/admin/forlob/{forlobId}/smaa-skridt">Rediger →</a>
		</div>

		{#if dagensSkridt.length === 0}
			<p class="muted">
				Ingen små skridt på denne dag. Tilføj og planlæg dem i Små skridt-oversigten.
			</p>
		{:else}
			<div class="liste">
				{#each dagensSkridt as s (s.id)}
					<div class="rad">
						<div class="rad-label">{s.label}</div>
						<div class="rad-plan">{planTekst(s.plan)}</div>
					</div>
				{/each}
			</div>
		{/if}
	</section>
{/if}

<style>
	.status-besked {
		padding: 14px 16px;
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 12px;
		color: var(--text2);
		font-size: calc(13px * var(--fs-scale, 1));
		text-align: center;
		margin-bottom: 14px;
	}

	.status-besked.fejl {
		color: #8a4a3e;
		background: #fbeeea;
		border-color: #f0d6cf;
	}

	.card {
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 16px;
		padding: 18px;
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
	}

	.card-head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 10px;
		margin-bottom: 12px;
	}

	.card-titel {
		font-family: var(--ff-d);
		font-size: calc(16px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--text);
	}

	.rediger-link {
		font-size: calc(12.5px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--terra);
		text-decoration: none;
		flex-shrink: 0;
	}

	.rediger-link:hover {
		text-decoration: underline;
	}

	.muted {
		font-size: calc(12.5px * var(--fs-scale, 1));
		color: var(--text3);
		margin: 0;
		line-height: 1.5;
	}

	.liste {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.rad {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		padding: 11px 13px;
		background: var(--bg2);
		border-radius: 10px;
	}

	.rad-label {
		font-size: calc(14px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--text);
		min-width: 0;
	}

	.rad-plan {
		font-size: calc(11.5px * var(--fs-scale, 1));
		color: var(--text3);
		flex-shrink: 0;
	}
</style>
