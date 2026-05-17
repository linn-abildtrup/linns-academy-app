<script lang="ts">
	import { getContext, onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import type { User } from 'firebase/auth';
	import type { UserDoc } from '$lib/types';
	import {
		beregnAboDagsStatus,
		dagensBonus,
		erUgentligCheckinDag,
		parseDato,
		type AboBonusForslag,
		type AboBonusSvar,
		type AboVaneOpsaetning,
		type AboVanedagEntry
	} from '$lib/content/aboVaner';
	import {
		CHECKIN_SPORGSMAAL,
		type CheckinSvar,
		type VaneSvar
	} from '$lib/content/vaner';
	import {
		hentAboBonusPulje,
		hentAboVaneOpsaetning,
		hentAboVanedag,
		gemAboVanedag
	} from '$lib/firestore/aboVaner';
	import { erModulbruger } from '$lib/utils/userAdgang';
	import Icon from '$lib/components/Icon.svelte';
	import Loading from '$lib/components/Loading.svelte';

	const getUser = getContext<() => User | null>('user');
	const getUserDoc = getContext<() => UserDoc | null>('userDoc');
	const user = $derived(getUser());
	const userDoc = $derived(getUserDoc());

	const dato = $derived(page.params.dato ?? '');
	const datoObj = $derived(/^\d{4}-\d{2}-\d{2}$/.test(dato) ? parseDato(dato) : null);
	const erIFremtiden = $derived(datoObj ? datoObj > new Date() : false);
	const erCheckinDag = $derived(datoObj ? erUgentligCheckinDag(datoObj) : false);

	let opsaetning = $state<AboVaneOpsaetning | null>(null);
	let bonus = $state<AboBonusForslag | null>(null);

	let checks = $state<Record<string, VaneSvar>>({});
	let bonusSvarIdx = $state<AboBonusSvar | null>(null);
	let bonusNote = $state('');
	let checkin = $state<CheckinSvar>({});
	let note = $state('');
	let oprindeligEntry = $state<AboVanedagEntry | null>(null);

	let loading = $state(true);
	let fejl = $state<string | null>(null);
	let gemmer = $state(false);
	let gemFejl = $state<string | null>(null);
	let editMode = $state(false);

	const harGemt = $derived(oprindeligEntry !== null);
	const disabled = $derived(harGemt && !editMode);

	const datoLabel = $derived.by(() => {
		if (!datoObj) return '';
		return datoObj.toLocaleDateString('da-DK', {
			weekday: 'long',
			day: 'numeric',
			month: 'long'
		});
	});

	const aktuelBonus = $derived.by(() =>
		bonus && bonusSvarIdx !== null
			? { id: bonus.id, svar: bonusSvarIdx, note: bonusNote.trim() || undefined }
			: null
	);

	const aktuelStatus = $derived(
		opsaetning
			? beregnAboDagsStatus(opsaetning.valgteVaner, bonus, erCheckinDag, {
					dato,
					checks,
					bonus: aktuelBonus,
					checkin,
					note
				})
			: 'empty'
	);

	const fremgangPct = $derived.by(() => {
		if (!opsaetning || opsaetning.valgteVaner.length === 0) return 0;
		const score = opsaetning.valgteVaner.reduce((s, v) => {
			const sv = checks[v.id];
			return s + (sv === 'ja' ? 1 : sv === 'delvist' ? 0.5 : 0);
		}, 0);
		const bonusScore = bonus && bonusSvarIdx === 0 ? 1 : 0;
		const total = opsaetning.valgteVaner.length + (bonus ? 1 : 0);
		return total > 0 ? Math.round(((score + bonusScore) / total) * 100) : 0;
	});

	const fremgangAntal = $derived.by(() => {
		if (!opsaetning) return { ja: 0, total: 0 };
		const ja = opsaetning.valgteVaner.filter((v) => checks[v.id] === 'ja').length;
		const bonusJa = bonus && bonusSvarIdx === 0 ? 1 : 0;
		const total = opsaetning.valgteVaner.length + (bonus ? 1 : 0);
		return { ja: ja + bonusJa, total };
	});

	onMount(async () => {
		const u = user;
		if (!u || !erModulbruger(userDoc)) {
			fejl = 'Du har ikke adgang til vanetracker.';
			loading = false;
			return;
		}
		if (!datoObj) {
			fejl = 'Ugyldig dato.';
			loading = false;
			return;
		}
		if (erIFremtiden) {
			fejl = 'Du kan ikke åbne en dag der ligger i fremtiden.';
			loading = false;
			return;
		}

		try {
			const o = await hentAboVaneOpsaetning(u.uid);
			if (!o) {
				fejl = 'Du har ikke valgt dine vaner endnu.';
				loading = false;
				return;
			}
			opsaetning = o;

			const pulje = await hentAboBonusPulje(o.produktType);
			bonus = dagensBonus(pulje, dato);

			const entry = await hentAboVanedag(u.uid, dato);
			if (entry) {
				oprindeligEntry = entry;
				checks = { ...(entry.checks ?? {}) };
				if (entry.bonus && entry.bonus.id === bonus?.id) {
					bonusSvarIdx = entry.bonus.svar;
					bonusNote = entry.bonus.note ?? '';
				} else {
					bonusSvarIdx = null;
					bonusNote = '';
				}
				checkin = { ...(entry.checkin ?? {}) };
				note = entry.note ?? '';
				editMode = false;
			} else {
				editMode = true;
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

	function vaelgBonusSvar(idx: AboBonusSvar) {
		bonusSvarIdx = bonusSvarIdx === idx ? null : idx;
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
			if (erCheckinDag) {
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

			const bonusEntry = aktuelBonus;
			await gemAboVanedag(u.uid, {
				dato,
				checks,
				bonus: bonusEntry,
				checkin,
				note
			});
			oprindeligEntry = { dato, checks, bonus: bonusEntry, checkin, note };
			editMode = false;
			goto('/app/moduler/vaner');
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
		<div class="eyebrow">{datoLabel}</div>
		<h1>Dagens vaner</h1>
		{#if harGemt && !editMode}
			<span class="status-badge gemt">✓ Gemt</span>
		{:else if editMode && harGemt}
			<span class="status-badge editing">✏️ Redigerer</span>
		{/if}
	</header>

	{#if loading}
		<Loading tekst="Henter dagen..." />
	{:else if fejl}
		<div class="status-besked fejl">{fejl}</div>
	{:else if opsaetning}
		<section class="card">
			<div class="section-label">Dine vaner</div>
			{#each opsaetning.valgteVaner as v (v.id)}
				{@const val = checks[v.id]}
				<div class="check-row">
					<div class="check-label">{v.label}</div>
					<div class="check-knapper">
						<button
							class="ja-knap"
							class:aktiv={val === 'ja'}
							type="button"
							onclick={() => setCheck(v.id, 'ja')}
							{disabled}
						>
							Ja
						</button>
						<button
							class="delvist-knap"
							class:aktiv={val === 'delvist'}
							type="button"
							onclick={() => setCheck(v.id, 'delvist')}
							{disabled}
						>
							Delvist
						</button>
						<button
							class="nej-knap"
							class:aktiv={val === 'nej'}
							type="button"
							onclick={() => setCheck(v.id, 'nej')}
							{disabled}
						>
							Nej
						</button>
					</div>
				</div>
			{/each}

			{#if bonus}
				{@const synligeSvar = bonus.svarmuligheder
					.map((s, i) => ({ s, i }))
					.filter((x) => x.s.trim() !== '')}
				{@const erBonusskridt = synligeSvar.length === 1}
				<div class="check-row bonus-row">
					<div class="check-label">
						<span class="bonus-tag">Bonus · {bonus.kategori}</span>
						{bonus.label}
					</div>
					<div class="check-knapper" class:bonus-knapper-3={!erBonusskridt}>
						{#each synligeSvar as { s, i } (i)}
							{@const knapKlasse = i === 0 ? 'ja-knap' : i === 1 ? 'delvist-knap' : 'nej-knap'}
							<button
								class={knapKlasse}
								class:aktiv={bonusSvarIdx === i}
								type="button"
								onclick={() => vaelgBonusSvar(i as 0 | 1 | 2)}
								{disabled}
							>
								{erBonusskridt && bonusSvarIdx === i ? '✓ ' : ''}{s}
							</button>
						{/each}
					</div>
					{#if !erBonusskridt}
						<input
							type="text"
							class="bonus-note"
							placeholder="Vil du tilføje noget? (valgfrit)"
							bind:value={bonusNote}
							{disabled}
						/>
					{/if}
				</div>
			{/if}

			<div class="prog-bar" style="margin-top: 14px;">
				<div class="prog-fill" style="width: {fremgangPct}%"></div>
			</div>
			<div class="prog-tael">{fremgangAntal.ja} af {fremgangAntal.total} vaner gennemført</div>
		</section>

		{#if erCheckinDag}
			<section class="card">
				<div class="section-label">Ugentligt check-in</div>
				<p class="reflection">
					Fem spørgsmål om din uge. Mærk efter på en skala 1-10, hvor 1 er meget dårligt
					og 10 er rigtig godt.
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

				<div class="generel-felt">
					<div class="generel-label">Hvordan har jeg det generelt lige nu?</div>
					<textarea
						class="textarea"
						placeholder="Skriv dit svar her..."
						value={checkin.generelTekst ?? ''}
						oninput={(e) => setGenerelTekst((e.target as HTMLTextAreaElement).value)}
						{disabled}
						rows="3"
					></textarea>
				</div>
			</section>
		{/if}

		{#if gemFejl}
			<div class="fejl-besked">{gemFejl}</div>
		{/if}

		<div class="bund-knapper">
			{#if editMode}
				<button class="primary-knap" type="button" onclick={gem} disabled={gemmer}>
					{gemmer ? 'Gemmer...' : 'Gem dagen ✓'}
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

	.section-label {
		font-size: calc(10px * var(--fs-scale, 1));
		font-weight: 600;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: var(--text3);
		margin-bottom: 12px;
	}

	.reflection {
		font-size: calc(13px * var(--fs-scale, 1));
		color: var(--text2);
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
		font-size: calc(16px * var(--fs-scale, 1));
		line-height: 1.5;
		outline: none;
		resize: vertical;
		box-sizing: border-box;
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

	.bonus-knapper-3 {
		grid-template-columns: 1fr 1fr 1fr;
	}

	.bonus-note {
		width: 100%;
		padding: 9px 10px;
		margin-top: 8px;
		border: 1px solid var(--border);
		border-radius: 8px;
		background: var(--white);
		color: var(--text);
		font-family: var(--ff-b);
		font-size: calc(16px * var(--fs-scale, 1));
		outline: none;
		box-sizing: border-box;
	}

	.bonus-note:focus {
		border-color: var(--terra);
	}

	.bonus-note:disabled {
		opacity: 0.7;
		cursor: not-allowed;
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
		background: #c9a07a;
		color: #fff;
		border-color: #c9a07a;
	}

	.nej-knap.aktiv {
		background: #b87b6e;
		color: #fff;
		border-color: #b87b6e;
	}

	.prog-bar {
		height: 6px;
		background: var(--bg2);
		border-radius: 3px;
		overflow: hidden;
	}

	.prog-fill {
		height: 100%;
		background: linear-gradient(90deg, var(--terra2), var(--terra));
		border-radius: 3px;
		transition: width 0.3s ease;
	}

	.prog-tael {
		font-size: calc(11px * var(--fs-scale, 1));
		color: var(--text3);
		margin-top: 6px;
		text-align: right;
	}

	.slider-row {
		padding: 10px 0;
		border-top: 1px solid var(--border);
	}

	.slider-row:first-of-type {
		border-top: none;
	}

	.slider-head {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		margin-bottom: 6px;
	}

	.slider-label {
		font-size: calc(13px * var(--fs-scale, 1));
		color: var(--text);
		font-weight: 500;
	}

	.slider-val {
		font-family: var(--ff-d);
		font-size: calc(16px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--terra);
	}

	.slider-row input[type='range'] {
		width: 100%;
		accent-color: var(--terra);
	}

	.slider-skala {
		display: flex;
		justify-content: space-between;
		font-size: calc(10px * var(--fs-scale, 1));
		color: var(--text4);
		margin-top: 2px;
	}

	.generel-felt {
		margin-top: 14px;
		padding-top: 14px;
		border-top: 1px solid var(--border);
	}

	.generel-label {
		font-size: calc(13px * var(--fs-scale, 1));
		color: var(--text);
		font-weight: 500;
		margin-bottom: 6px;
	}

	.bund-knapper {
		margin-top: 6px;
	}

	.primary-knap {
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

	.primary-knap:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.ghost-knap {
		display: block;
		width: 100%;
		padding: 13px;
		background: var(--white);
		color: var(--text2);
		font-size: calc(13px * var(--fs-scale, 1));
		font-weight: 600;
		border-radius: 12px;
		border: 1px solid var(--border);
		cursor: pointer;
		font-family: var(--ff-b);
	}

	.fejl-besked {
		padding: 10px 14px;
		background: #fbeeea;
		border: 1px solid #f0d6cf;
		color: #8a4a3e;
		border-radius: 10px;
		font-size: calc(12.5px * var(--fs-scale, 1));
		text-align: center;
		margin-bottom: 10px;
	}
</style>
