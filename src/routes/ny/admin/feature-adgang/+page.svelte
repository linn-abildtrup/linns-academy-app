<script lang="ts">
	// ============================================================
	// Funktioner og adgang, i det nye design.
	//
	// Trettende af de 19 gamle admin-sider, 1. september 2026, og den
	// tredje af dem der roerer adgang.
	//
	// DET HER SKEMA STYRER DEN GAMLE APP FOR ALLE KUNDER. Et flueben her
	// aendrer hvad en hel kundetype kan, med det samme og uden en
	// udrulning. Det er den mest vidtraekkende af alle admin-siderne.
	//
	// DER SKAL TRYKKES GEM. Fluebenene aendrer kun skaermen indtil da, og
	// det staar paa siden. Det er ogsaa saadan den gamle virkede, men det
	// stod ingen steder.
	//
	// OG SKEMAET GAELDER IKKE 3.0. Beskeder-siden i 3.0 har sin egen regel,
	// se 9.19: aendrer du et flueben her, sker der ingenting i den nye app.
	// Det staar nu paa skaermen, for det er praecis den slags man ellers
	// opdager for sent.
	//
	// LOGIKKEN ER FLYTTET, IKKE SKREVET OM. Samme hentFeatureMatrix,
	// gemFeatureMatrix, gemForlob og validerPerioder.
	//
	// Den gamle side paa /app/admin/feature-adgang er uroert.
	// ============================================================

	import { getContext, onMount } from 'svelte';
	import type { User } from 'firebase/auth';
	import { isAdmin } from '$lib/admin';
	import {
		FEATURES,
		KUNDETYPER,
		STANDARD_MATRIX,
		type FeatureMatrix,
		type Kundetype,
		type FeatureKey
	} from '$lib/content/features';
	import { hentFeatureMatrix, gemFeatureMatrix } from '$lib/firestore/featureAdgang';
	import { hentAlleForlob, gemForlob } from '$lib/firestore/forlob';
	import type { Forlob } from '$lib/content/forlobAdgang';
	import { validerPerioder, type MaaltidsFokusPeriode } from '$lib/content/maaltidsFokus';
	import { MAALTIDSTYPER, MAALTIDSTYPE_LABELS, type Maaltidstype } from '$lib/content/kost';
	import AdmSide from '$lib/components/admin/AdmSide.svelte';
	import AdmKort from '$lib/components/admin/AdmKort.svelte';
	import AdmKnap from '$lib/components/admin/AdmKnap.svelte';
	import AdmTom from '$lib/components/admin/AdmTom.svelte';

	const hentUser = getContext<() => User | null>('user');
	const maaVaereHer = $derived(isAdmin(hentUser()));

	// Starter paa standarden, saa skemaet har gyldige vaerdier foer
	// hentningen er faerdig. Erstattes af det gemte.
	let matrix = $state<FeatureMatrix>(JSON.parse(JSON.stringify(STANDARD_MATRIX)));
	let henter = $state(true);
	let gemmer = $state(false);
	let besked = $state('');
	let fejl = $state('');
	let uGemt = $state(false);

	let fane = $state<'funktioner' | 'fokus'>('funktioner');

	let forlobListe = $state<Forlob[]>([]);
	let valgtId = $state('');
	let perioder = $state<MaaltidsFokusPeriode[]>([]);
	let fokusGemmer = $state(false);
	let fokusBesked = $state('');
	let fokusUGemt = $state(false);

	const valgtForlob = $derived(forlobListe.find((f) => f.id === valgtId) ?? null);

	onMount(() => void indlaes());

	async function indlaes() {
		henter = true;
		fejl = '';
		try {
			const [m, forlob] = await Promise.all([hentFeatureMatrix(), hentAlleForlob()]);
			matrix = m;
			forlobListe = forlob;
		} catch (e) {
			console.error('[admin] feature-adgang', e);
			fejl = 'Kunne ikke hente skemaet.';
		} finally {
			henter = false;
		}
	}

	function toggle(kt: Kundetype, fk: FeatureKey) {
		matrix[kt][fk] = !matrix[kt][fk];
		besked = '';
		uGemt = true;
	}

	async function gem() {
		if (gemmer) return;
		gemmer = true;
		besked = '';
		try {
			await gemFeatureMatrix(matrix);
			besked = 'Skemaet er gemt, og det gælder med det samme';
			uGemt = false;
		} catch (e) {
			console.error('[admin] gem skema', e);
			besked = 'Kunne ikke gemme. Prøv igen.';
		} finally {
			gemmer = false;
		}
	}

	function vaelgForlob(id: string) {
		valgtId = id;
		fokusBesked = '';
		fokusUGemt = false;
		const f = forlobListe.find((x) => x.id === id);
		// Dyb kopi, saa redigering ikke aendrer den hentede liste.
		perioder = (f?.maaltidsFokus ?? []).map((p) => ({ ...p, maaltider: [...p.maaltider] }));
	}

	function tilfoejPeriode() {
		perioder = [...perioder, { fraDag: 0, tilDag: 6, maaltider: ['morgenmad'] }];
		fokusBesked = '';
		fokusUGemt = true;
	}

	function fjernPeriode(i: number) {
		perioder = perioder.filter((_, idx) => idx !== i);
		fokusBesked = '';
		fokusUGemt = true;
	}

	function toggleMaaltid(i: number, type: Maaltidstype) {
		const har = perioder[i].maaltider.includes(type);
		perioder[i].maaltider = har
			? perioder[i].maaltider.filter((m) => m !== type)
			: [...perioder[i].maaltider, type];
		fokusBesked = '';
		fokusUGemt = true;
	}

	function datoForDag(dag: number): string {
		if (!valgtForlob || !Number.isFinite(dag)) return '';
		return new Date(valgtForlob.startDato.toMillis() + dag * 86400000).toLocaleDateString('da-DK', {
			day: '2-digit',
			month: 'short'
		});
	}

	async function gemFokus() {
		if (fokusGemmer || !valgtId) return;
		const f = validerPerioder(perioder);
		if (f) {
			fokusBesked = f;
			return;
		}
		fokusGemmer = true;
		fokusBesked = '';
		try {
			await gemForlob(valgtId, { maaltidsFokus: perioder });
			forlobListe = forlobListe.map((x) =>
				x.id === valgtId
					? { ...x, maaltidsFokus: perioder.map((p) => ({ ...p, maaltider: [...p.maaltider] })) }
					: x
			);
			fokusBesked = 'Gemt';
			fokusUGemt = false;
		} catch (e) {
			console.error('[admin] gem fokus', e);
			fokusBesked = 'Kunne ikke gemme. Prøv igen.';
		} finally {
			fokusGemmer = false;
		}
	}
</script>

<svelte:head><title>Funktioner og adgang · Admin</title></svelte:head>

{#if !maaVaereHer}
	<p class="fa-kun">Siden er kun for admin.</p>
{:else}
	<AdmSide
		titel="Funktioner og adgang"
		under="Hvad hver slags kunde kan i den gamle app, og hvilke måltider et forløb må registrere i en periode."
		bred
	>
		{#if fejl}<div class="fa-fejl">{fejl}</div>{/if}

		<div class="fa-faner">
			<button
				type="button"
				class="fa-chip"
				class:paa={fane === 'funktioner'}
				onclick={() => (fane = 'funktioner')}
			>
				Funktioner pr kundetype
			</button>
			<button
				type="button"
				class="fa-chip"
				class:paa={fane === 'fokus'}
				onclick={() => (fane = 'fokus')}
			>
				Måltids-fokus pr forløb
			</button>
		</div>

		{#if henter}
			<AdmTom tekst="Henter skemaet…" />
		{:else if fane === 'funktioner'}
			<!-- Den her linje er den vigtigste paa siden. Skemaet gaelder KUN
			     den gamle app, og det er praecis den slags man opdager for
			     sent. Se 9.19 om Beskeder i 3.0. -->
			<div class="fa-note">
				Skemaet gælder <b>den gamle app</b>. Den nye app har sine egne regler, så et flueben her
				ændrer ikke noget for kunder på 3.0.
			</div>

			{#if besked}<div class="fa-besked">{besked}</div>{/if}

			<div class="fa-tabel">
				<div class="fa-r fa-hoved">
					<span class="fa-f-navn">Funktion</span>
					{#each KUNDETYPER as kt (kt.key)}
						<span class="fa-kol">{kt.navn}</span>
					{/each}
				</div>

				{#each FEATURES as f (f.key)}
					<div class="fa-r">
						<span class="fa-f-navn">
							<b>{f.navn}</b>
							<em>{f.beskrivelse}</em>
							{#if !f.koblet}
								<!-- Staar i skemaet, men ingen kode laeser den endnu. Uden
								     den her linje tror man at fluebenet goer noget. -->
								<span class="fa-ikke-koblet">Er endnu ikke koblet til noget</span>
							{/if}
						</span>
						{#each KUNDETYPER as kt (kt.key)}
							<span class="fa-kol">
								<button
									type="button"
									class="fa-flueben"
									class:paa={matrix[kt.key][f.key]}
									disabled={gemmer}
									aria-label="{f.navn} for {kt.navn}"
									aria-pressed={matrix[kt.key][f.key] ? 'true' : 'false'}
									onclick={() => toggle(kt.key, f.key)}
								>
									{matrix[kt.key][f.key] ? '✓' : ''}
								</button>
							</span>
						{/each}
					</div>
				{/each}
			</div>

			<div class="fa-gem">
				<AdmKnap slags="primaer" disabled={gemmer || !uGemt} onclick={gem}>
					{gemmer ? 'Gemmer…' : 'Gem skemaet'}
				</AdmKnap>
				{#if uGemt}
					<span class="fa-ugemt">Der er ændringer der ikke er gemt endnu.</span>
				{/if}
			</div>
		{:else}
			<div class="fa-note">
				I en fokus-periode kan kunden kun registrere de måltider du vælger. Er der ingen perioder,
				kan hun registrere alt, og det er sådan de fleste forløb kører.
			</div>

			<AdmKort>
				<label class="fa-felt">
					<span>Forløb</span>
					<select value={valgtId} onchange={(e) => vaelgForlob(e.currentTarget.value)}>
						<option value="">Vælg et forløb</option>
						{#each forlobListe as f (f.id)}
							<option value={f.id}>{f.navn}</option>
						{/each}
					</select>
				</label>
			</AdmKort>

			{#if !valgtId}
				<AdmTom tekst="Vælg et forløb for at se og rette dets perioder." />
			{:else}
				{#if fokusBesked}<div class="fa-besked">{fokusBesked}</div>{/if}

				{#if perioder.length === 0}
					<AdmTom tekst="Forløbet har ingen fokus-perioder. Kunden kan registrere alle måltider." />
				{/if}

				{#each perioder as p, i (i)}
					<AdmKort>
						<div class="fa-p-raek">
							<label class="fa-felt">
								<span>Fra dag</span>
								<input type="number" min="0" bind:value={p.fraDag} disabled={fokusGemmer} />
								<em>{datoForDag(p.fraDag)}</em>
							</label>
							<label class="fa-felt">
								<span>Til og med dag</span>
								<input type="number" min="0" bind:value={p.tilDag} disabled={fokusGemmer} />
								<em>{datoForDag(p.tilDag)}</em>
							</label>
							<div class="fa-p-fjern">
								<AdmKnap slags="fare" disabled={fokusGemmer} onclick={() => fjernPeriode(i)}>
									Fjern
								</AdmKnap>
							</div>
						</div>

						<div class="fa-felt bred">
							<span>Måltider hun må registrere</span>
							<div class="fa-chips">
								{#each MAALTIDSTYPER as m (m)}
									<button
										type="button"
										class="fa-chip"
										class:paa={p.maaltider.includes(m)}
										disabled={fokusGemmer}
										onclick={() => toggleMaaltid(i, m)}
									>
										{MAALTIDSTYPE_LABELS[m]}
									</button>
								{/each}
							</div>
						</div>
					</AdmKort>
				{/each}

				<div class="fa-gem">
					<AdmKnap disabled={fokusGemmer} onclick={tilfoejPeriode}>Tilføj en periode</AdmKnap>
					<AdmKnap slags="primaer" disabled={fokusGemmer || !fokusUGemt} onclick={gemFokus}>
						{fokusGemmer ? 'Gemmer…' : 'Gem perioderne'}
					</AdmKnap>
					{#if fokusUGemt}
						<span class="fa-ugemt">Der er ændringer der ikke er gemt endnu.</span>
					{/if}
				</div>
			{/if}
		{/if}
	</AdmSide>
{/if}

<style>
	.fa-kun {
		padding: 24px 18px;
		color: var(--ink-2);
		font-size: calc(14px * var(--fs-scale, 1));
	}

	.fa-besked,
	.fa-fejl {
		margin-bottom: 12px;
		padding: 11px 15px;
		border-radius: 12px;
		font-size: calc(13.5px * var(--fs-scale, 1));
		font-weight: 600;
	}

	.fa-besked {
		background: var(--sage-tint, #e7efe5);
		color: var(--sage-tekst, #46603f);
	}

	.fa-fejl {
		background: var(--ler-tint, #f4e6de);
		color: var(--ler-tekst, #8a5439);
	}

	.fa-note {
		margin-bottom: 14px;
		padding: 12px 15px;
		background: var(--honey-tint, #f7ecd7);
		border-radius: 12px;
		color: var(--honey-deep, #b47f3e);
		font-size: calc(12.5px * var(--fs-scale, 1));
		line-height: 1.5;
	}

	.fa-faner,
	.fa-chips {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}

	.fa-faner {
		margin-bottom: 14px;
	}

	/* Baggrunden staar eksplicit, se noten i AdmKnap. */
	.fa-chip {
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

	.fa-chip.paa {
		background: var(--plum, #7c4f63);
		border-color: var(--plum, #7c4f63);
		color: #fff;
	}

	.fa-tabel {
		display: flex;
		flex-direction: column;
		gap: 5px;
	}

	.fa-r {
		display: flex;
		align-items: flex-start;
		gap: 8px;
		padding: 12px 14px;
		background: var(--paper-2, #f6f0e7);
		border-radius: 12px;
	}

	.fa-r.fa-hoved {
		background: none;
		padding-bottom: 2px;
		font-size: calc(10.5px * var(--fs-scale, 1));
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--ink-3, #a3948a);
	}

	.fa-f-navn {
		flex: 1 1 220px;
		min-width: 0;
	}

	.fa-f-navn b {
		display: block;
		font-size: calc(14px * var(--fs-scale, 1));
		font-weight: 600;
	}

	.fa-f-navn em {
		display: block;
		margin-top: 2px;
		font-size: calc(11.5px * var(--fs-scale, 1));
		color: var(--ink-3, #a3948a);
		font-style: normal;
		line-height: 1.45;
	}

	.fa-ikke-koblet {
		display: inline-block;
		margin-top: 4px;
		padding: 2px 8px;
		border-radius: 99px;
		background: var(--honey-tint, #f7ecd7);
		color: var(--honey-deep, #b47f3e);
		font-size: calc(10.5px * var(--fs-scale, 1));
		font-weight: 700;
	}

	.fa-kol {
		flex: 0 0 62px;
		text-align: center;
	}

	.fa-flueben {
		width: 34px;
		height: 34px;
		border-radius: 10px;
		background: var(--paper, #fbf8f2);
		border: 1px solid var(--line, #e8dfd1);
		color: var(--sage-tekst, #46603f);
		font-size: calc(15px * var(--fs-scale, 1));
		font-family: inherit;
		cursor: pointer;
	}

	.fa-flueben.paa {
		background: var(--sage-tint, #e7efe5);
		border-color: var(--sage, #86a188);
		font-weight: 700;
	}

	.fa-gem {
		display: flex;
		align-items: center;
		gap: 10px;
		flex-wrap: wrap;
		margin-top: 16px;
	}

	.fa-ugemt {
		font-size: calc(12px * var(--fs-scale, 1));
		color: var(--honey-deep, #b47f3e);
		font-weight: 600;
	}

	.fa-felt {
		display: flex;
		flex-direction: column;
		gap: 4px;
		flex: 1 1 130px;
		margin-bottom: 10px;
	}

	.fa-felt.bred {
		flex-basis: 100%;
	}

	.fa-felt span {
		font-size: calc(10.5px * var(--fs-scale, 1));
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--ink-3, #a3948a);
	}

	.fa-felt input,
	.fa-felt select {
		padding: 11px 13px;
		background: var(--paper, #fbf8f2);
		border: 1px solid var(--line, #e8dfd1);
		border-radius: 11px;
		color: var(--espresso, #382c2a);
		font-size: calc(14px * var(--fs-scale, 1));
		font-family: inherit;
		box-sizing: border-box;
	}

	.fa-felt em {
		font-size: calc(11px * var(--fs-scale, 1));
		color: var(--ink-3, #a3948a);
		font-style: normal;
	}

	.fa-p-raek {
		display: flex;
		gap: 10px;
		flex-wrap: wrap;
		align-items: flex-start;
	}

	.fa-p-fjern {
		margin-top: 18px;
	}

	@media (max-width: 700px) {
		.fa-r {
			flex-wrap: wrap;
		}

		.fa-kol {
			flex: 0 0 auto;
		}
	}
</style>
