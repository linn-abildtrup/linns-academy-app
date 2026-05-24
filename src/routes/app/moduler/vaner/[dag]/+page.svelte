<script lang="ts">
	import { getContext, onMount } from 'svelte';
	import { page } from '$app/state';
	import type { User } from 'firebase/auth';
	import type { UserProduct } from '$lib/content/mikrotraening';
	import type { Forlob } from '$lib/content/forlobAdgang';
	import { dagDato, unlockedDays } from '$lib/content/forlobAdgang';
	import {
		beregnDagsStatus,
		CHECKIN_SPORGSMAAL,
		type BonusSvar,
		type CheckinSvar,
		type VaneProgramDag,
		type VaneSvar,
		type VanedagEntry
	} from '$lib/content/vaner';
	import type { UserDoc } from '$lib/types';
	import { hentUserProduct } from '$lib/firestore/mikrotraening';
	import { hentAktivProduktType, hentForlob } from '$lib/firestore/forlob';
	import { gemVanedag, hentVanedag, hentVaneprogramDag } from '$lib/firestore/vaner';
	import {
		filtrerVanerForUge,
		hentAdminVanerForForlob,
		type AdminTildeltVane
	} from '$lib/firestore/admintildelteVaner';
	import type { ForlobProduct } from '$lib/types';
	import Icon from '$lib/components/Icon.svelte';
	import Loading from '$lib/components/Loading.svelte';

	const getUser = getContext<() => User | null>('user');
	const getUserDoc = getContext<() => UserDoc | null>('userDoc');
	const user = $derived(getUser());
	const userDoc = $derived(getUserDoc());

	const dagNummer = $derived(parseInt(page.params.dag ?? '', 10));

	let userProduct = $state<UserProduct | null>(null);
	let forlob = $state<Forlob | null>(null);
	let prog = $state<VaneProgramDag | null>(null);
	let produktType = $state<ForlobProduct>('kickstart');
	let adminVanerForUge = $state<AdminTildeltVane[]>([]);

	let checks = $state<Record<string, VaneSvar>>({});
	let bonus = $state<Record<string, BonusSvar>>({});
	let checkin = $state<CheckinSvar>({});
	let note = $state('');
	let oprindeligEntry = $state<VanedagEntry | null>(null);
	let baselineEntry = $state<VanedagEntry | null>(null);

	let loading = $state(true);
	let fejl = $state<string | null>(null);
	let gemmer = $state(false);
	let gemFejl = $state<string | null>(null);
	let editMode = $state(false);

	const harGemt = $derived(oprindeligEntry !== null);
	const disabled = $derived(harGemt && !editMode);

	const dagDatoLabel = $derived(() => {
		if (!forlob || !Number.isFinite(dagNummer)) return '';
		const d = dagDato(forlob.startDato.toDate(), dagNummer);
		return `${d.getDate()}/${d.getMonth() + 1}`;
	});

	const ugeLabel = $derived(() => {
		if (!prog) return '';
		if (prog.isBaseline) return 'Før du går i gang';
		return `Uge ${prog.uge}`;
	});

	const dagTitelLabel = $derived(() => {
		if (!prog) return '';
		const datoSuffix = forlob ? ` · ${dagDatoLabel()}` : '';
		if (prog.isBaseline) return `Baseline${datoSuffix}`;
		return `Dag ${prog.dagNummer}${datoSuffix}`;
	});

	const erLaast = $derived.by(() => {
		if (!forlob) return true;
		const u = unlockedDays(forlob.startDato.toDate(), forlob.antalDage);
		return u < 0 || dagNummer > u;
	});

	// Vaner vises som sum af program-checks (Kickstart-stil) + admin-tildelte
	// vaner for den uge dagen ligger i (Kropsro-stil). For Kropsro er
	// prog.checks tomt og adminVanerForUge bærer hele listen.
	const visteVaner = $derived<{ id: string; label: string }[]>([
		...(prog?.checks ?? []),
		...adminVanerForUge.map((v) => ({ id: `at-${v.id}`, label: v.label }))
	]);

	const aktuelStatus = $derived(
		prog
			? beregnDagsStatus(
					{ ...prog, checks: visteVaner } as VaneProgramDag,
					{
						dagNummer,
						checks,
						bonus,
						checkin,
						note
					}
				)
			: 'empty'
	);

	const fremgangPct = $derived.by(() => {
		if (!prog || visteVaner.length === 0) return 0;
		const score = visteVaner.reduce((s, c) => {
			const v = checks[c.id];
			return s + (v === 'ja' ? 1 : v === 'delvist' ? 0.5 : 0);
		}, 0);
		const bonusScore = prog.bonus && bonus[prog.bonus.id] === 'ja' ? 1 : 0;
		const total = visteVaner.length + (prog.bonus ? 1 : 0);
		return total > 0 ? Math.round(((score + bonusScore) / total) * 100) : 0;
	});

	const fremgangAntal = $derived.by(() => {
		if (!prog) return { ja: 0, total: 0 };
		const ja = visteVaner.filter((c) => checks[c.id] === 'ja').length;
		const bonusJa = prog.bonus && bonus[prog.bonus.id] === 'ja' ? 1 : 0;
		const total = visteVaner.length + (prog.bonus ? 1 : 0);
		return { ja: ja + bonusJa, total };
	});

	onMount(async () => {
		const u = user;
		if (!u) {
			fejl = 'Du skal være logget ind.';
			loading = false;
			return;
		}
		if (!Number.isFinite(dagNummer) || dagNummer < 0) {
			fejl = 'Ugyldigt dag-nummer.';
			loading = false;
			return;
		}

		try {
			produktType = await hentAktivProduktType(userDoc?.forlobIds ?? []);
			const up = await hentUserProduct(u.uid, produktType);
			if (!up) {
				fejl = 'Du har ikke adgang til vanetracker endnu.';
				loading = false;
				return;
			}
			userProduct = up;

			const forlobId = (up as UserProduct & { forlobId?: string }).forlobId;
			if (!forlobId) {
				fejl = 'Du er ikke tilknyttet et forløb endnu.';
				loading = false;
				return;
			}

			const f = await hentForlob(forlobId);
			if (!f) {
				fejl = 'Forløbet kunne ikke findes.';
				loading = false;
				return;
			}
			forlob = f;

			if (dagNummer > f.antalDage) {
				fejl = `Dag ${dagNummer} findes ikke i dette forløb (maks ${f.antalDage}).`;
				loading = false;
				return;
			}

			const dagData = await hentVaneprogramDag(forlobId, dagNummer);
			if (!dagData) {
				fejl = `Dag ${dagNummer} findes ikke i programmet.`;
				loading = false;
				return;
			}
			prog = dagData;

			// Hent admin-tildelte vaner for det aktuelle forløb og filtrer
			// til den uge denne dag ligger i. Dag 0 (baseline) er uge 0 og
			// har ingen vaner.
			if (!prog.isBaseline) {
				try {
					const alle = await hentAdminVanerForForlob(forlobId);
					const ugeForDag = prog.uge;
					adminVanerForUge = filtrerVanerForUge(alle, ugeForDag);
				} catch (e) {
					console.warn('Kunne ikke hente admin-vaner:', e);
				}
			}

			const entry = await hentVanedag(u.uid, dagNummer, produktType);
			if (entry) {
				oprindeligEntry = entry;
				checks = { ...(entry.checks ?? {}) };
				bonus = { ...(entry.bonus ?? {}) };
				checkin = { ...(entry.checkin ?? {}) };
				note = entry.note ?? '';
				editMode = false;
			} else {
				editMode = true;
			}

			// Hent baseline-svar separat hvis vi er på sidste MRS-checkin
			// (slutter forløbet). Vi sammenligner mod baseline (dag 0).
			if (prog.isMrsCheckin && dagNummer === f.antalDage) {
				baselineEntry = await hentVanedag(u.uid, 0, produktType);
			}
		} catch (e) {
			console.error(e);
			fejl = 'Kunne ikke hente data. Prøv igen.';
		} finally {
			loading = false;
		}
	});

	function setCheck(id: string, val: VaneSvar) {
		checks = { ...checks, [id]: val };
	}

	function setSlider(id: keyof CheckinSvar, val: string | number) {
		const n = typeof val === 'string' ? parseInt(val, 10) : val;
		if (Number.isFinite(n)) {
			checkin = { ...checkin, [id]: n };
		}
	}

	function setGenerelTekst(val: string) {
		checkin = { ...checkin, generelTekst: val };
	}

	function harSliderSvar(id: keyof CheckinSvar): boolean {
		return typeof checkin[id] === 'number';
	}

	function toggleBonus(id: string, val: BonusSvar) {
		const ny = { ...bonus };
		if (ny[id] === val) {
			delete ny[id];
		} else {
			ny[id] = val;
		}
		bonus = ny;
	}

	function startEdit() {
		editMode = true;
		gemFejl = null;
	}

	async function gem() {
		const u = user;
		if (!u || gemmer) return;
		gemFejl = null;
		gemmer = true;
		try {
			// Fyld manglende skydere ud med 5 (neutral default) på alle check-ins.
			// Klienter der ikke rykker skyderen efterlader ellers ingen måling så
			// sammenligning på tværs af forløbet bliver umulig.
			if (prog?.isBaseline || prog?.isCheckin) {
				type SliderId = Exclude<keyof CheckinSvar, 'generelTekst'>;
				const fyldt: CheckinSvar = { ...checkin };
				for (const q of CHECKIN_SPORGSMAAL) {
					const id = q.id as SliderId;
					if (typeof fyldt[id] !== 'number') {
						fyldt[id] = 5;
					}
				}
				checkin = fyldt;
			}

			await gemVanedag(
				u.uid,
				{
					dagNummer,
					checks,
					bonus,
					checkin,
					note
				},
				produktType
			);
			oprindeligEntry = { dagNummer, checks, bonus, checkin, note };
			editMode = false;
		} catch (e) {
			console.error(e);
			gemFejl = 'Kunne ikke gemme. Prøv igen.';
		} finally {
			gemmer = false;
		}
	}
</script>

<div class="page">
	<header class="page-header">
		<a class="back" href="/app/moduler/vaner">
			<Icon name="arrow-l" size={14} color="var(--text2)" />
			<span>Oversigt</span>
		</a>
		{#if prog}
			<div class="eyebrow">{dagTitelLabel()} · {ugeLabel()}</div>
			<h1>{prog.isBaseline ? 'Baseline' : 'Dagens vaner'}</h1>
			{#if !prog.isBaseline && harGemt && !editMode}
				<span class="status-badge gemt">✓ Gemt</span>
			{:else if !prog.isBaseline && editMode && harGemt}
				<span class="status-badge editing">✏️ Redigerer</span>
			{/if}
		{/if}
	</header>

	{#if loading}
		<Loading tekst="Henter dagen..." />
	{:else if fejl}
		<div class="status-besked fejl">{fejl}</div>
	{:else if erLaast}
		<div class="status-besked">🔒 Denne dag er endnu ikke låst op.</div>
	{:else if prog}
		{#if prog.isMrsCheckin}
			<a class="mrs-notice" href="/app/moduler/symptomcheck">
				<div class="mrs-notice-tekst">
					<div class="mrs-notice-titel">Tid til symptomcheck</div>
					<div class="mrs-notice-sub">
						I dag skal du udfylde dit MRS-spørgeskema så vi kan måle hvordan
						kroppen reagerer på forløbet.
					</div>
				</div>
				<Icon name="chevron-r" size={14} color="var(--terra)" />
			</a>
		{/if}
		{#if !prog.isBaseline}
			<section class="card">
				<div class="section-label">Refleksion</div>
				<p class="reflection">{prog.reflection}</p>
				<textarea
					class="textarea"
					placeholder="Skriv dit svar her..."
					bind:value={note}
					{disabled}
					rows="4"
				></textarea>
			</section>

			{#if visteVaner.length > 0}
				<section class="card">
					<div class="section-label">Dagens vaner</div>
					{#each visteVaner as c (c.id)}
						{@const val = checks[c.id]}
						<div class="check-row">
							<div class="check-label">{c.label}</div>
							<div class="check-knapper">
								<button
									class="ja-knap"
									class:aktiv={val === 'ja'}
									type="button"
									onclick={() => setCheck(c.id, 'ja')}
									{disabled}
								>
									Ja
								</button>
								<button
									class="delvist-knap"
									class:aktiv={val === 'delvist'}
									type="button"
									onclick={() => setCheck(c.id, 'delvist')}
									{disabled}
								>
									Delvist
								</button>
								<button
									class="nej-knap"
									class:aktiv={val === 'nej'}
									type="button"
									onclick={() => setCheck(c.id, 'nej')}
									{disabled}
								>
									Nej
								</button>
							</div>
						</div>
					{/each}

					{#if prog.bonus}
						{@const bVal = bonus[prog.bonus.id]}
						<div class="check-row bonus-row">
							<div class="check-label">
								<span class="bonus-tag">Bonus</span>
								{prog.bonus.label}
							</div>
							<div class="check-knapper bonus-knapper">
								<button
									class="ja-knap"
									class:aktiv={bVal === 'ja'}
									type="button"
									onclick={() => toggleBonus(prog!.bonus!.id, 'ja')}
									{disabled}
								>
									Ja
								</button>
								<button
									class="nej-knap"
									class:aktiv={bVal === 'nej'}
									type="button"
									onclick={() => toggleBonus(prog!.bonus!.id, 'nej')}
									{disabled}
								>
									Nej
								</button>
							</div>
						</div>
					{/if}

					<div class="prog-bar" style="margin-top: 14px;">
						<div class="prog-fill" style="width: {fremgangPct}%"></div>
					</div>
					<div class="prog-tael">{fremgangAntal.ja} af {fremgangAntal.total} vaner gennemført</div>
				</section>
			{/if}
		{/if}

		{#if prog.isCheckin || prog.isBaseline}
			<section class="card">
				<div class="section-label">{prog.isBaseline ? 'Baseline-check-in' : 'Check-in'}</div>
				<p class="reflection">
					{prog.isBaseline
						? 'Dine baseline-målinger. Mærk efter på en skala 1-10, hvor 1 er meget dårligt og 10 er rigtig godt. Du sammenligner med disse tal gennem hele forløbet.'
						: 'Fem spørgsmål om din uge. Mærk efter på en skala 1-10, hvor 1 er meget dårligt og 10 er rigtig godt.'}
				</p>

				{#each CHECKIN_SPORGSMAAL as q (q.id)}
					{@const id = q.id as keyof CheckinSvar}
					{@const val = harSliderSvar(id) ? (checkin[id] as number) : 5}
					<div class="slider-row">
						<div class="slider-head">
							<div class="slider-label">{q.label}</div>
							<div class="slider-val">{val}</div>
						</div>
						<input
							type="range"
							min="1"
							max="10"
							step="1"
							value={val}
							{disabled}
							oninput={(e) => setSlider(id, (e.target as HTMLInputElement).value)}
						/>
						<div class="slider-skala"><span>1</span><span>5</span><span>10</span></div>
					</div>
				{/each}

				{#if prog.isBaseline || prog.dagNummer === 21}
					<div class="generel-felt">
						<div class="generel-label">Hvordan har jeg det generelt lige nu?</div>
						<div class="generel-sub">
							Et samlet billede af hvordan du har det i din krop og dit humør.
						</div>
						<textarea
							class="textarea"
							placeholder="Skriv dit svar her..."
							value={checkin.generelTekst ?? ''}
							oninput={(e) => setGenerelTekst((e.target as HTMLTextAreaElement).value)}
							{disabled}
							rows="4"
						></textarea>

						{#if prog.dagNummer === 21 && baselineEntry?.checkin?.generelTekst}
							<div class="baseline-compare">
								<div class="baseline-compare-label">Dit svar fra dag 0 (baseline)</div>
								<div class="baseline-compare-tekst">
									{baselineEntry.checkin.generelTekst}
								</div>
							</div>
						{:else if prog.dagNummer === 21}
							<div class="baseline-compare baseline-compare-tom">
								<div class="baseline-compare-tekst">
									Du har ikke noteret et baseline-svar på dag 0, så der er ikke noget at sammenligne med.
								</div>
							</div>
						{/if}
					</div>
				{/if}
			</section>
		{/if}

		{#if gemFejl}
			<div class="fejl-besked">{gemFejl}</div>
		{/if}

		<div class="bund-knapper">
			{#if editMode}
				<button class="primary-knap" type="button" onclick={gem} disabled={gemmer}>
					{gemmer ? 'Gemmer...' : `Gem ${dagTitelLabel()} ✓`}
				</button>
			{:else}
				<button class="ghost-knap" type="button" onclick={startEdit}>
					✏️ Rediger svar
				</button>
			{/if}
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

	.back:hover {
		color: var(--text);
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

	.status-badge {
		display: inline-block;
		font-size: calc(10px * var(--fs-scale, 1));
		letter-spacing: 0.08em;
		text-transform: uppercase;
		padding: 4px 10px;
		border-radius: 99px;
		margin-top: 8px;
		font-weight: 600;
	}

	.status-badge.gemt {
		background: var(--sdim);
		color: var(--sage);
	}

	.status-badge.editing {
		background: var(--tdim);
		color: var(--terra);
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

	.card {
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 14px;
		padding: 16px;
		margin-bottom: 14px;
	}

	.mrs-notice {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 14px 16px;
		background: var(--terra2);
		border: 1px solid var(--terra);
		border-radius: 14px;
		text-decoration: none;
		margin-bottom: 14px;
	}

	.mrs-notice-tekst {
		flex: 1;
	}

	.mrs-notice-titel {
		font-size: calc(14px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--text);
		margin-bottom: 2px;
	}

	.mrs-notice-sub {
		font-size: calc(12px * var(--fs-scale, 1));
		color: var(--text2);
		line-height: 1.4;
	}

	.section-label {
		font-size: calc(10px * var(--fs-scale, 1));
		font-weight: 600;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: var(--text3);
		margin-bottom: 12px;
	}

	.reflection {
		font-size: calc(14px * var(--fs-scale, 1));
		color: var(--text);
		line-height: 1.5;
		margin: 0 0 12px;
	}

	.textarea {
		width: 100%;
		padding: 10px 12px;
		border-radius: 10px;
		border: 1px solid var(--border);
		background: var(--bg2);
		color: var(--text);
		font-family: var(--ff-b);
		font-size: calc(13px * var(--fs-scale, 1));
		line-height: 1.5;
		outline: none;
		resize: vertical;
	}

	.textarea:focus {
		border-color: var(--terra);
	}

	.textarea:disabled {
		opacity: 0.7;
		cursor: not-allowed;
	}

	.check-row {
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding: 12px 0;
		border-top: 1px solid var(--border);
	}

	.check-row:first-of-type {
		border-top: none;
		padding-top: 0;
	}

	.check-row.bonus-row {
		background: var(--bg2);
		margin: 8px -16px -8px;
		padding: 12px 16px;
		border-radius: 0 0 14px 14px;
		border-top-color: var(--border);
	}

	.check-label {
		font-size: calc(13.5px * var(--fs-scale, 1));
		color: var(--text);
		font-weight: 500;
	}

	.bonus-tag {
		display: inline-block;
		font-size: calc(9px * var(--fs-scale, 1));
		letter-spacing: 0.1em;
		text-transform: uppercase;
		background: var(--terra2);
		color: #fff;
		padding: 2px 7px;
		border-radius: 99px;
		font-weight: 600;
		margin-right: 6px;
		vertical-align: middle;
	}

	.check-knapper {
		display: grid;
		grid-template-columns: 1fr 1fr 1fr;
		gap: 6px;
	}

	.bonus-knapper {
		grid-template-columns: 1fr 1fr;
	}

	.check-knapper button {
		padding: 9px 10px;
		font-size: calc(12.5px * var(--fs-scale, 1));
		font-weight: 600;
		border-radius: 8px;
		border: 1px solid var(--border);
		background: var(--white);
		color: var(--text2);
		cursor: pointer;
		font-family: var(--ff-b);
	}

	.check-knapper button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.ja-knap.aktiv {
		background: var(--sage);
		color: #fff;
		border-color: var(--sage);
	}

	.delvist-knap.aktiv {
		background: var(--gold);
		color: #fff;
		border-color: var(--gold);
	}

	.nej-knap.aktiv {
		background: var(--text3);
		color: #fff;
		border-color: var(--text3);
	}

	.prog-bar {
		height: 5px;
		background: var(--bg2);
		border-radius: 3px;
		overflow: hidden;
	}

	.prog-fill {
		height: 100%;
		background: linear-gradient(90deg, var(--terra2), var(--terra));
		transition: width 0.3s ease;
	}

	.prog-tael {
		font-size: calc(11.5px * var(--fs-scale, 1));
		color: var(--text3);
		margin-top: 6px;
	}

	.slider-row {
		padding: 14px 0;
		border-top: 1px solid var(--border);
	}

	.slider-row:first-of-type {
		border-top: none;
		padding-top: 4px;
	}

	.slider-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 8px;
	}

	.slider-label {
		font-size: calc(13px * var(--fs-scale, 1));
		color: var(--text);
		font-weight: 500;
		flex: 1;
		min-width: 0;
		padding-right: 12px;
	}

	.slider-val {
		font-family: var(--ff-d);
		font-size: calc(22px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--terra);
		flex-shrink: 0;
		line-height: 1;
	}

	.slider-row input[type='range'] {
		width: 100%;
		accent-color: var(--terra);
		cursor: pointer;
	}

	.slider-row input[type='range']:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.slider-skala {
		display: flex;
		justify-content: space-between;
		font-size: calc(10px * var(--fs-scale, 1));
		color: var(--text3);
		margin-top: 2px;
		padding: 0 2px;
	}

	.generel-felt {
		margin-top: 16px;
		padding-top: 16px;
		border-top: 1px solid var(--border);
	}

	.generel-label {
		font-size: calc(14px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--text);
		margin-bottom: 4px;
	}

	.generel-sub {
		font-size: calc(12px * var(--fs-scale, 1));
		color: var(--text3);
		line-height: 1.45;
		margin-bottom: 10px;
	}

	.baseline-compare {
		margin-top: 14px;
		padding: 14px;
		background: var(--tdim);
		border-left: 3px solid var(--terra);
		border-radius: 6px;
	}

	.baseline-compare-tom {
		background: var(--bg2);
		border-left-color: var(--border);
	}

	.baseline-compare-label {
		font-size: calc(11px * var(--fs-scale, 1));
		font-weight: 600;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--terra);
		margin-bottom: 8px;
	}

	.baseline-compare-tekst {
		font-size: calc(13px * var(--fs-scale, 1));
		line-height: 1.55;
		color: var(--text2);
		white-space: pre-wrap;
	}

	.baseline-compare-tom .baseline-compare-tekst {
		font-style: italic;
		color: var(--text4);
	}

	.fejl-besked {
		padding: 10px 12px;
		background: #fbeeea;
		border: 1px solid #f0d6cf;
		border-radius: 8px;
		font-size: calc(12px * var(--fs-scale, 1));
		color: #8a4a3e;
		margin-bottom: 12px;
	}

	.bund-knapper {
		margin-top: 14px;
	}

	.primary-knap,
	.ghost-knap {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		width: 100%;
		padding: 14px;
		font-size: calc(14px * var(--fs-scale, 1));
		font-weight: 600;
		border-radius: 12px;
		border: none;
		cursor: pointer;
		font-family: var(--ff-b);
	}

	.primary-knap {
		background: var(--terra);
		color: #fff;
	}

	.primary-knap:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.ghost-knap {
		background: var(--white);
		border: 1px solid var(--border);
		color: var(--text2);
	}

	.ghost-knap:hover {
		background: var(--bg2);
	}
</style>
