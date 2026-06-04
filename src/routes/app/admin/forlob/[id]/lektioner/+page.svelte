<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import type { Forlob } from '$lib/content/forlobAdgang';
	import type { ForlobDag } from '$lib/content/forlob';
	import { tomForlobDag } from '$lib/content/forlob';
	import { hentForlob, hentForlobsdage } from '$lib/firestore/forlob';
	import Icon from '$lib/components/Icon.svelte';

	const forlobId = $derived(page.params.id ?? '');

	let forlob = $state<Forlob | null>(null);
	let dage = $state<ForlobDag[]>([]);
	let loading = $state(true);
	let fejl = $state<string | null>(null);

	const dagsmap = $derived.by<Map<number, ForlobDag>>(() => {
		const m = new Map<number, ForlobDag>();
		for (const d of dage) m.set(d.dagNummer, d);
		return m;
	});

	const programDage = $derived.by<ForlobDag[]>(() => {
		if (!forlob) return [];
		const ud: ForlobDag[] = [];
		for (let i = 0; i <= forlob.antalDage; i++) {
			ud.push(dagsmap.get(i) ?? tomForlobDag(i));
		}
		return ud;
	});

	// Beregn kalenderdato for et dag-nummer ud fra forl0bets startDato.
	// Konvention: startDato = baseline (Dag 0). Dag 1 = startDato + 1,
	// Dag 2 = startDato + 2 osv.
	function datoForDag(dagNummer: number): string {
		if (!forlob) return '';
		const start = forlob.startDato.toDate();
		const d = new Date(start);
		d.setDate(d.getDate() + dagNummer);
		return d.toLocaleDateString('da-DK', {
			weekday: 'short',
			day: 'numeric',
			month: 'short'
		});
	}

	// Farve-gruppe: dag 0-7 = gruppe A, 8-14 = B, 15-21 = A, osv.
	// Skifter pr 7. dag, gentager A/B/A/B. Baseline (dag 0) hænger sammen
	// med dag 1-7 visuelt da den udfyldes f0r forl0bet starter.
	function ugeGruppe(dagNummer: number): 'a' | 'b' {
		const offset = Math.max(0, dagNummer - 1);
		return Math.floor(offset / 7) % 2 === 0 ? 'a' : 'b';
	}

	onMount(async () => {
		try {
			const f = await hentForlob(forlobId);
			if (!f) {
				fejl = 'Forløbet findes ikke.';
				loading = false;
				return;
			}
			forlob = f;
			dage = await hentForlobsdage(forlobId);
		} catch (e) {
			console.error(e);
			fejl = 'Kunne ikke hente data.';
		} finally {
			loading = false;
		}
	});
</script>

<div class="page">
	<header class="page-header">
		<a class="back" href="/app/admin/forlob/{forlobId}">
			<Icon name="arrow-l" size={14} color="var(--text2)" />
			<span>{forlob?.navn ?? 'Forløb'}</span>
		</a>
		<div class="eyebrow">Admin · {forlob?.navn ?? forlobId} · Lektioner</div>
		<h1>Lektioner</h1>
		<p class="page-sub">
			Læg dagens lektion ind for hver dag i forløbet. Hver dag kan have flere lektioner og en valgfri note.
		</p>
	</header>

	{#if loading}
		<div class="status-besked">Henter...</div>
	{:else if fejl}
		<div class="status-besked fejl">{fejl}</div>
	{:else if forlob}
		<div class="dag-liste">
			{#each programDage as dag (dag.dagNummer)}
				{@const tael = dag.lektioner.length}
				{@const gruppe = ugeGruppe(dag.dagNummer)}
				<a class="dag-row" href="/app/admin/forlob/{forlobId}/lektioner/{dag.dagNummer}">
					<div class="dag-num gruppe-{gruppe}">{dag.dagNummer}</div>
					<div class="dag-tekst">
						<div class="dag-titel">
							{dag.dagNummer === 0 ? 'Baseline' : `Dag ${dag.dagNummer}`}
							{#if dag.dagNummer > 0}
								<span class="dag-uge">· uge {dag.uge}</span>
							{/if}
							<span class="dag-dato">· {datoForDag(dag.dagNummer)}</span>
						</div>
						{#if tael > 0}
							<div class="dag-sub">
								{tael} lektion{tael === 1 ? '' : 'er'}{dag.noteFraLinn ? ' · note fra Linn' : ''}
							</div>
							<div class="dag-preview">
								{dag.lektioner[0].titel}
								{#if tael > 1}
									<span class="dag-mere">+ {tael - 1} mere</span>
								{/if}
							</div>
						{:else if dag.noteFraLinn}
							<div class="dag-sub">Kun note fra Linn</div>
						{:else}
							<div class="dag-sub dag-tom">Intet indhold endnu</div>
						{/if}
					</div>
					<Icon name="chevron-r" size={14} color="var(--text3)" />
				</a>
			{/each}
		</div>
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
		font-size: calc(26px * var(--fs-scale, 1));
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

	.status-besked {
		padding: 14px 16px;
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 12px;
		color: var(--text2);
		font-size: calc(13px * var(--fs-scale, 1));
		text-align: center;
	}

	.status-besked.fejl {
		color: #8a4a3e;
		background: #fbeeea;
		border-color: #f0d6cf;
	}

	.dag-liste {
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 14px;
		overflow: hidden;
		margin-bottom: 14px;
	}

	.dag-row {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 12px 14px;
		border-top: 1px solid var(--border);
		text-decoration: none;
		color: inherit;
	}

	.dag-row:first-child {
		border-top: none;
	}

	.dag-row:hover {
		background: var(--bg2);
	}

	.dag-num {
		width: 36px;
		height: 36px;
		border-radius: 10px;
		background: var(--bg2);
		display: flex;
		align-items: center;
		justify-content: center;
		font-family: var(--ff-d);
		font-weight: 700;
		font-size: calc(14px * var(--fs-scale, 1));
		color: var(--text);
		flex-shrink: 0;
	}

	/* Farve-grupper: dag 1-7 = terra, 8-14 = sage, 15-21 = terra osv.
	   Bruger den daempede pendant som baggrund + den faste farve som tekst,
	   saa det er tydeligt men ikke aggressivt. */
	.dag-num.gruppe-a {
		background: var(--tdim);
		color: var(--terra);
	}
	.dag-num.gruppe-b {
		background: var(--sdim);
		color: var(--sage);
	}

	.dag-tekst {
		flex: 1;
		min-width: 0;
	}

	.dag-titel {
		font-size: calc(13px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--text);
	}

	.dag-uge {
		color: var(--text3);
		font-weight: 400;
	}

	.dag-dato {
		color: var(--text3);
		font-weight: 400;
	}

	.dag-sub {
		font-size: calc(11px * var(--fs-scale, 1));
		color: var(--text3);
		margin-top: 2px;
	}

	.dag-sub.dag-tom {
		font-style: italic;
	}

	.dag-preview {
		font-size: calc(12px * var(--fs-scale, 1));
		color: var(--text2);
		margin-top: 2px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.dag-mere {
		color: var(--text3);
		margin-left: 4px;
		font-size: calc(11px * var(--fs-scale, 1));
	}

</style>
