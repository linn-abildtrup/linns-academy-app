<script lang="ts">
	// ============================================================
	// Smaa skridt paa en forloebsdag, i det nye design.
	//
	// Linn 5. september 2026: "lav de to andre faner i det nye
	// design". Den gamle komponent bruges stadig af den gamle app og
	// er derfor uroert. Denne er en ny fil ved siden af.
	//
	// KUN LAESNING, praecis som foer. Selve oprettelsen sker i det
	// samlede overblik under Smaa skridt, og linket peger nu paa den
	// nye admin, saa man ikke falder tilbage i det gamle udseende
	// midt i et forloeb.
	// ============================================================
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

	// De smaa skridt hvis tidsplan rammer netop denne dag.
	const dagensSkridt = $derived.by<SmaaSkridt[]>(() => {
		const f = forlob;
		if (!f) return [];
		return skridt.filter((s) =>
			dageForPlan(s.plan, f.antalDage, f.startDato.toDate()).includes(dagNummer)
		);
	});
</script>

{#if loading}
	<div class="besked">Henter...</div>
{:else if fejl}
	<div class="besked fejl">{fejl}</div>
{:else}
	<div class="hoved">
		<div class="sp-t">
			Små skridt på {dagNummer === 0 ? 'baseline' : `dag ${dagNummer}`}
		</div>
		<a class="ret" href="/ny/admin/forlob/{forlobId}/smaa-skridt">Ret i oversigten →</a>
	</div>

	{#if dagensSkridt.length === 0}
		<p class="mini">
			Ingen små skridt på denne dag. Du opretter og planlægger dem i oversigten over små skridt.
		</p>
	{:else}
		<div class="liste">
			{#each dagensSkridt as s (s.id)}
				<div class="rad">
					<span class="rad-navn">{s.label}</span>
					<span class="rad-plan">{planTekst(s.plan)}</span>
				</div>
			{/each}
		</div>
	{/if}
{/if}

<style>
	.hoved {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 12px;
		flex-wrap: wrap;
		margin-bottom: 12px;
	}

	.sp-t {
		font-size: calc(10.5px * var(--fs-scale, 1));
		font-weight: 700;
		letter-spacing: 0.11em;
		text-transform: uppercase;
		color: var(--ink-3);
	}

	.ret {
		font-size: calc(12.5px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--plum);
		text-decoration: none;
	}

	.besked {
		padding: 14px 16px;
		background: var(--paper-2);
		border-radius: 12px;
		color: var(--ink-2);
		font-size: calc(13px * var(--fs-scale, 1));
		text-align: center;
	}

	.besked.fejl {
		color: var(--ler-tekst);
		background: var(--ler-tint);
	}

	.mini {
		font-size: calc(13px * var(--fs-scale, 1));
		color: var(--ink-3);
		line-height: 1.55;
		margin: 0;
		max-width: 62ch;
	}

	.rad {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 14px;
		flex-wrap: wrap;
		border: 1px solid var(--line);
		border-radius: 11px;
		padding: 11px 13px;
		margin-bottom: 7px;
		background: var(--paper);
	}

	.rad-navn {
		font-size: calc(13.5px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--text);
	}

	.rad-plan {
		font-size: calc(12px * var(--fs-scale, 1));
		color: var(--ink-3);
	}
</style>
