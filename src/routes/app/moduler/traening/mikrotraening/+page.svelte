<script lang="ts">
	import { getContext, onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import type { User } from 'firebase/auth';
	import type { UserDoc } from '$lib/types';
	import type { MikrotraeningFremgang, UserProduct } from '$lib/content/mikrotraening';
	import type { Forlob } from '$lib/content/forlobAdgang';
	import { naesteDag, beregnProgramFremgang } from '$lib/content/mikrotraening';
	import {
		aktuelAboDag,
		type AboMikrotraeningFremgang
	} from '$lib/content/aboMikrotraening';
	import { getCurrentDay } from '$lib/content/forlob';
	import {
		hentForlobsProgram,
		hentUserProduct,
		type ProgramMedDage
	} from '$lib/firestore/mikrotraening';
	import {
		hentAboFremgang,
		hentAboMikrotraeningProgram,
		hentAlleAboTraeninger,
		type AboMikrotraeningProgramMedDage
	} from '$lib/firestore/aboMikrotraening';
	import type { AboMikrotraeningTraening } from '$lib/content/aboMikrotraening';
	import { hentForlob, hentAktivProduktType } from '$lib/firestore/forlob';
	import { erForlobsklient, erModulbruger } from '$lib/utils/userAdgang';
	import Icon from '$lib/components/Icon.svelte';
	import Loading from '$lib/components/Loading.svelte';

	const getUser = getContext<() => User | null>('user');
	const getUserDoc = getContext<() => UserDoc | null>('userDoc');
	const user = $derived(getUser());
	const userDoc = $derived(getUserDoc());

	type Gren = 'forlob' | 'abo' | 'ingen';
	const gren = $derived<Gren>(
		erForlobsklient(userDoc) ? 'forlob' : erModulbruger(userDoc) ? 'abo' : 'ingen'
	);

	// === Forløbs-state ===
	let userProduct = $state<UserProduct | null>(null);
	let programData = $state<ProgramMedDage | null>(null);
	let forlob = $state<Forlob | null>(null);

	// === Abo-state ===
	let aboProgram = $state<AboMikrotraeningProgramMedDage | null>(null);
	let aboFremgang = $state<AboMikrotraeningFremgang | null>(null);
	let aboTraeninger = $state<AboMikrotraeningTraening[]>([]);

	let loading = $state(true);
	let fejl = $state<string | null>(null);

	// === Forløbs-derived ===
	const fremgang = $derived<MikrotraeningFremgang>(
		(userProduct?.fremgang?.mikrotraening as MikrotraeningFremgang | undefined) ?? {
			gennemforte: [],
			feedback: {}
		}
	);
	const antalDage = $derived(programData?.program.antalDage ?? 21);
	const dageKlaret = $derived(fremgang.gennemforte.length);
	const dageTilbage = $derived(antalDage - dageKlaret);
	const fremgangProcent = $derived(beregnProgramFremgang(fremgang, antalDage));
	const naeste = $derived(naesteDag(fremgang, antalDage));

	const aktivKalenderDag = $derived.by<number | null>(() => {
		if (!forlob) return null;
		const startDato = forlob.startDato.toDate().toISOString().slice(0, 10);
		return getCurrentDay({ startDato, antalDage: forlob.antalDage });
	});

	// === Abo-derived ===
	const aboAktivDag = $derived(aktuelAboDag(aboFremgang));

	function dagsDatoStr(d: Date): string {
		const aar = d.getFullYear();
		const m = String(d.getMonth() + 1).padStart(2, '0');
		const dag = String(d.getDate()).padStart(2, '0');
		return `${aar}-${m}-${dag}`;
	}

	const idagDato = $derived(dagsDatoStr(new Date()));

	// Dage før kontoen blev oprettet vises ikke — brugeren har ikke haft
	// appen før det tidspunkt, så det giver ingen mening at åbne dem.
	const tidligsteSyngligDato = $derived(
		userDoc?.createdAt ? dagsDatoStr(new Date(userDoc.createdAt)) : null
	);

	const sidste7Datoer = $derived.by<{ dato: string; trænet: boolean }[]>(() => {
		const traenetMap = new Map<string, boolean>();
		for (const t of aboTraeninger) traenetMap.set(t.dato, true);
		const r: { dato: string; trænet: boolean }[] = [];
		const idag = new Date();
		for (let i = 6; i >= 0; i--) {
			const cur = new Date(idag);
			cur.setDate(cur.getDate() - i);
			const datoStr = dagsDatoStr(cur);
			if (tidligsteSyngligDato && datoStr < tidligsteSyngligDato) continue;
			r.push({ dato: datoStr, trænet: traenetMap.has(datoStr) });
		}
		return r;
	});

	function kortDagLabel(datoStr: string): string {
		const [aar, m, d] = datoStr.split('-').map(Number);
		const dt = new Date(aar, m - 1, d);
		return dt.toLocaleDateString('da-DK', { weekday: 'short' }).slice(0, 2);
	}

	function dagINummer(datoStr: string): string {
		const [, , d] = datoStr.split('-');
		return String(parseInt(d, 10));
	}

	onMount(async () => {
		const u = user;
		if (!u) {
			fejl = 'Du skal være logget ind.';
			loading = false;
			return;
		}

		try {
			if (gren === 'forlob') {
				await indlaesForlobsData(u.uid);
			} else if (gren === 'abo') {
				await indlaesAboData(u.uid);
			}
		} catch (e) {
			fejl = 'Kunne ikke hente data. Prøv igen.';
			console.error(e);
		} finally {
			loading = false;
		}
	});

	async function indlaesForlobsData(uid: string) {
		const produktType = await hentAktivProduktType(userDoc?.forlobIds ?? []);
		const up = await hentUserProduct(uid, produktType);
		if (!up) {
			fejl = 'Du har ikke adgang til mikrotræning endnu.';
			return;
		}
		userProduct = up;

		const programId = up.programValg?.mikrotraening;
		if (!programId) {
			goto('/app/moduler/traening/mikrotraening/onboarding');
			return;
		}

		const forlobId = (up as UserProduct & { forlobId?: string }).forlobId;
		if (!forlobId) {
			fejl = 'Du er ikke tilknyttet et forløb endnu. Kontakt Linn.';
			return;
		}

		const [data, f] = await Promise.all([
			hentForlobsProgram(forlobId, programId),
			hentForlob(forlobId)
		]);
		if (!data) {
			fejl = 'Programmet kunne ikke findes.';
			return;
		}
		programData = data;
		forlob = f;
	}

	async function indlaesAboData(uid: string) {
		const produktType = userDoc?.accessLevel === 'premium' ? 'premium' : 'basis';
		const variant = userDoc?.mikrotraeningVariant ?? 'no_kettlebell';
		const [program, fremgang, traeninger] = await Promise.all([
			hentAboMikrotraeningProgram(produktType, variant),
			hentAboFremgang(uid),
			hentAlleAboTraeninger(uid)
		]);
		if (!program) {
			fejl = 'Træningsprogrammet er ikke sat op endnu. Kontakt Linn.';
			return;
		}
		aboProgram = program;
		aboFremgang = fremgang;
		aboTraeninger = traeninger;
	}

	function dagStatus(dagNummer: number): 'klaret' | 'naeste' | 'kommer' | 'fremtid' {
		if (fremgang.gennemforte.includes(dagNummer)) return 'klaret';
		if (aktivKalenderDag !== null && dagNummer > aktivKalenderDag) return 'fremtid';
		if (dagNummer === naeste) return 'naeste';
		return 'kommer';
	}

</script>

<div class="page">
	<header class="page-header">
		<a class="back" href="/app/moduler/traening">
			<Icon name="arrow-l" size={14} color="var(--text2)" />
			<span>Træning</span>
		</a>
		<div class="eyebrow">Træningsprogram</div>
		<h1>Mikrotræning</h1>
		<p class="page-sub">
			{#if gren === 'forlob'}
				{programData?.program.beskrivelse ?? 'Daglig træning.'}
			{:else if gren === 'abo'}
				Daglig træning.
			{:else}
				Mikrotræning kræver et abonnement eller forløb.
			{/if}
		</p>
	</header>

	{#if loading}
		<Loading tekst="Henter dit program..." />
	{:else if fejl}
		<div class="status-besked fejl">{fejl}</div>
	{:else if gren === 'forlob' && programData}
		{@const naesteRute = naeste !== null ? `/app/moduler/traening/mikrotraening/${naeste}` : null}

		{#if naesteRute}
			<a class="start-knap" href={naesteRute}>
				Start næste træning
				<Icon name="arrow" size={14} color="#fff" />
			</a>
		{:else}
			<div class="start-knap faerdig">
				<Icon name="check" size={14} color="#fff" />
				Du har gennemført alle dage
			</div>
		{/if}

		<section class="card">
			<div class="card-head">
				<div class="section-label">Din fremgang</div>
				<div class="card-tael">{dageKlaret} / {antalDage}</div>
			</div>
			<div class="prog-bar">
				<div class="prog-fill" style="width: {fremgangProcent}%"></div>
			</div>
			<p class="hint">Tryk på en dag for at åbne den</p>
			<div class="dage-grid">
				{#each programData.dage as dag (dag.dagNummer)}
					{@const status = dagStatus(dag.dagNummer)}
					{#if status === 'fremtid'}
						<span class="dag dag-{status}" aria-disabled="true" title="Låst — dagen er endnu ikke nået">
							<span class="dag-num">{dag.dagNummer}</span>
						</span>
					{:else}
						<a class="dag dag-{status}" href="/app/moduler/traening/mikrotraening/{dag.dagNummer}">
							<span class="dag-num">{dag.dagNummer}</span>
							{#if status === 'klaret'}
								<Icon name="check" size={11} color="#fff" />
							{/if}
						</a>
					{/if}
				{/each}
			</div>
		</section>

		<div class="stat-row">
			<div class="stat-box">
				<div class="stat-num">{dageKlaret}</div>
				<div class="stat-lbl">dage klaret</div>
			</div>
			<div class="stat-box">
				<div class="stat-num">{dageTilbage}</div>
				<div class="stat-lbl">dage tilbage</div>
			</div>
		</div>
	{:else if gren === 'abo' && aboProgram}
		<a class="start-knap" href="/app/moduler/traening/mikrotraening/abo/{idagDato}">
			Start dagens træning
			<Icon name="arrow" size={14} color="#fff" />
		</a>

		<section class="card">
			<div class="card-head">
				<div class="section-label">
					{sidste7Datoer.length < 7 ? 'Seneste dage' : 'Sidste 7 dage'}
				</div>
			</div>
			<p class="hint">Tryk på en dag for at åbne den.</p>
			<div class="dage-grid uge-grid-7">
				{#each sidste7Datoer as d (d.dato)}
					<a
						class="dag"
						class:dag-klaret={d.trænet}
						class:dag-idag={d.dato === idagDato}
						href="/app/moduler/traening/mikrotraening/abo/{d.dato}"
					>
						<span class="dag-uge">{kortDagLabel(d.dato)}</span>
						<span class="dag-num">{dagINummer(d.dato)}</span>
					</a>
				{/each}
			</div>

			<div class="farvekode">
				<div class="farvekode-titel">Hvad betyder farverne?</div>
				<div class="farvekode-liste">
					<div class="farvekode-rad">
						<span class="farvekode-prik prik-klaret"></span>
						<span class="farvekode-tekst">Du trænede den dag</span>
					</div>
					<div class="farvekode-rad">
						<span class="farvekode-prik prik-idag"></span>
						<span class="farvekode-tekst">I dag</span>
					</div>
					<div class="farvekode-rad">
						<span class="farvekode-prik prik-tom"></span>
						<span class="farvekode-tekst">Ingen træning logget</span>
					</div>
				</div>
			</div>
		</section>
	{:else}
		<div class="status-besked">
			Mikrotræning kræver et basis-abo, premium-abo eller forløb.
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

	.start-knap {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		width: 100%;
		padding: 14px;
		background: var(--terra);
		color: #fff;
		font-size: calc(14px * var(--fs-scale, 1));
		font-weight: 600;
		border-radius: 12px;
		text-decoration: none;
		margin-bottom: 14px;
		border: none;
		cursor: pointer;
		font-family: var(--ff-b);
		box-sizing: border-box;
	}

	.start-knap.faerdig {
		background: var(--sage);
		cursor: default;
	}

	.card {
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 14px;
		padding: 16px;
		margin-bottom: 14px;
	}

	.card-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 8px;
	}

	.section-label {
		font-size: calc(10px * var(--fs-scale, 1));
		font-weight: 600;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: var(--text3);
	}

	.card-tael {
		font-size: calc(12px * var(--fs-scale, 1));
		color: var(--text3);
	}

	.prog-bar {
		height: 6px;
		background: var(--bg2);
		border-radius: 3px;
		overflow: hidden;
		margin-bottom: 8px;
	}

	.prog-fill {
		height: 100%;
		background: linear-gradient(90deg, var(--terra2), var(--terra));
		border-radius: 3px;
		transition: width 0.4s ease;
	}

	.hint {
		font-size: calc(11px * var(--fs-scale, 1));
		color: var(--text4);
		letter-spacing: 0.04em;
		margin: 0 0 14px;
		line-height: 1.5;
	}

	.dage-grid {
		display: grid;
		grid-template-columns: repeat(7, 1fr);
		gap: 6px;
	}

	.dag {
		aspect-ratio: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 2px;
		border-radius: 10px;
		font-size: calc(13px * var(--fs-scale, 1));
		font-weight: 600;
		text-decoration: none;
		border: 1px solid var(--border);
		background: var(--white);
		color: var(--text2);
	}

	.dag-num {
		font-size: calc(13px * var(--fs-scale, 1));
		font-weight: 600;
	}

	.dag-klaret {
		background: var(--sage);
		color: #fff;
		border-color: var(--sage);
	}

	.dag-naeste {
		outline: 2px solid var(--terra);
		outline-offset: -2px;
	}

	.dag-fremtid {
		opacity: 0.45;
		pointer-events: none;
		background: var(--bg2);
		color: var(--text4);
	}

	.dag-idag {
		outline: 2px solid var(--terra);
		outline-offset: -2px;
	}

	.dag-uge {
		font-size: calc(9.5px * var(--fs-scale, 1));
		font-weight: 600;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--text3);
	}

	.dag-klaret .dag-uge {
		color: rgba(255, 255, 255, 0.7);
	}

	.farvekode {
		margin-top: 14px;
		padding-top: 12px;
		border-top: 1px solid var(--border);
	}

	.farvekode-titel {
		font-size: calc(11px * var(--fs-scale, 1));
		font-weight: 600;
		letter-spacing: 0.04em;
		color: var(--text3);
		margin-bottom: 8px;
	}

	.farvekode-liste {
		display: flex;
		flex-direction: column;
		gap: 5px;
	}

	.farvekode-rad {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.farvekode-prik {
		width: 14px;
		height: 14px;
		border-radius: 4px;
		border: 1px solid var(--border);
		flex-shrink: 0;
		background: var(--white);
	}

	.farvekode-prik.prik-klaret {
		background: var(--sage);
		border-color: var(--sage);
	}

	.farvekode-prik.prik-idag {
		background: var(--white);
		border-color: var(--terra);
		outline: 1px solid var(--terra);
		outline-offset: -2px;
	}

	.farvekode-tekst {
		font-size: calc(12px * var(--fs-scale, 1));
		color: var(--text2);
	}

	.stat-row {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 8px;
	}

	.stat-row.solo {
		grid-template-columns: 1fr;
	}

	.stat-box {
		text-align: center;
		padding: 12px;
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 12px;
	}

	.stat-num {
		font-family: var(--ff-d);
		font-size: calc(22px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--terra);
	}

	.stat-lbl {
		font-size: calc(11px * var(--fs-scale, 1));
		color: var(--text3);
		margin-top: 2px;
	}

</style>
