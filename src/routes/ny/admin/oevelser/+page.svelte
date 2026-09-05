<script lang="ts">
	// ============================================================
	// Oevelsesbanken, i det nye design.
	//
	// Niende af de 19 gamle admin-sider, 1. september 2026.
	//
	// DEN HER BANK ER FAELLES FOR BEGGE APPER. 3.0's traeningsprogrammer
	// vaelger oevelser herfra, og det samme goer de gamle programmer. Retter
	// du en oevelse, rammer det begge steder. Derfor er der en linje om det
	// paa skaermen.
	//
	// LOGIKKEN ER FLYTTET, IKKE SKREVET OM. Samme tre funktioner, og alle
	// fire kontroller foer der gemmes staar ordret som foer.
	//
	// Den gamle side paa /app/admin/traening er uroert.
	// ============================================================

	import { getContext, onMount } from 'svelte';
	import type { User } from 'firebase/auth';
	import { isAdmin } from '$lib/admin';
	import type {
		Exercise,
		ExerciseCategory,
		Treaningsform,
		Udstyr
	} from '$lib/content/mikrotraening';
	import { gemExercise, hentAlleExercises, sletExercise } from '$lib/firestore/mikrotraening';
	import AdmSide from '$lib/components/admin/AdmSide.svelte';
	import AdmKort from '$lib/components/admin/AdmKort.svelte';
	import AdmKnap from '$lib/components/admin/AdmKnap.svelte';
	import AdmMaerkat from '$lib/components/admin/AdmMaerkat.svelte';
	import AdmSoeg from '$lib/components/admin/AdmSoeg.svelte';
	import AdmTom from '$lib/components/admin/AdmTom.svelte';

	const hentUser = getContext<() => User | null>('user');
	const maaVaereHer = $derived(isAdmin(hentUser()));

	const KATEGORIER: { id: ExerciseCategory; label: string }[] = [
		{ id: 'ben', label: 'Ben' },
		{ id: 'overkrop', label: 'Overkrop' },
		{ id: 'core', label: 'Core' },
		{ id: 'stabilitet', label: 'Stabilitet' }
	];

	const UDSTYR: { id: Udstyr; label: string }[] = [
		{ id: 'ingen', label: 'Intet' },
		{ id: 'kettlebell', label: 'Kettlebell' },
		{ id: 'elastik', label: 'Elastik' },
		{ id: 'haandvaegte', label: 'Håndvægte' },
		{ id: 'forhojning', label: 'Forhøjning' }
	];

	const FORMER: { id: Treaningsform; label: string }[] = [
		{ id: 'mikrotraening', label: 'Mikrotræning' },
		{ id: 'yoga', label: 'Yoga' },
		{ id: 'styrke', label: 'Styrke' },
		{ id: 'mobilitet', label: 'Mobilitet' }
	];

	let oevelser = $state<Exercise[]>([]);
	let henter = $state(true);
	let fejl = $state('');
	let besked = $state('');

	let soeg = $state('');
	let kategori = $state<ExerciseCategory | 'alle'>('alle');

	// Redigering. Null betyder at der oprettes en ny.
	let aaben = $state(false);
	let redigererId = $state<string | null>(null);
	let fId = $state('');
	let fNavn = $state('');
	let fBesk = $state('');
	let fHvordan = $state('');
	let fKat = $state<ExerciseCategory>('ben');
	let fKatNavn = $state('');
	let fTags = $state('');
	let fVideo = $state('');
	let fUdstyr = $state<Udstyr[]>(['ingen']);
	let fFormer = $state<Treaningsform[]>(['mikrotraening']);
	let fAktiv = $state(true);
	let gemmer = $state(false);
	let formFejl = $state('');
	let bekraefterSlet = $state(false);

	onMount(() => void indlaes());

	async function indlaes() {
		henter = true;
		fejl = '';
		try {
			oevelser = await hentAlleExercises();
		} catch (e) {
			console.error('[admin] øvelser', e);
			fejl = 'Kunne ikke hente øvelserne.';
		} finally {
			henter = false;
		}
	}

	function sigTil(t: string) {
		besked = t;
		setTimeout(() => {
			if (besked === t) besked = '';
		}, 2400);
	}

	const listen = $derived.by<Exercise[]>(() => {
		const q = soeg.trim().toLowerCase();
		return oevelser.filter((ex) => {
			if (kategori !== 'alle' && ex.cat !== kategori) return false;
			if (!q) return true;
			return (
				ex.name.toLowerCase().includes(q) ||
				ex.desc.toLowerCase().includes(q) ||
				ex.tags.some((t) => t.toLowerCase().includes(q))
			);
		});
	});

	const udenVideo = $derived(oevelser.filter((e) => !e.videoPath?.trim()).length);

	function aabnNy() {
		redigererId = null;
		fId = '';
		fNavn = '';
		fBesk = '';
		fHvordan = '';
		fKat = 'ben';
		fKatNavn = '';
		fTags = '';
		fVideo = '';
		fUdstyr = ['ingen'];
		fFormer = ['mikrotraening'];
		fAktiv = true;
		formFejl = '';
		bekraefterSlet = false;
		aaben = true;
	}

	function aabnRediger(ex: Exercise) {
		redigererId = ex.id;
		fId = ex.id;
		fNavn = ex.name;
		fBesk = ex.desc;
		fHvordan = ex.how.join('\n');
		fKat = ex.cat;
		fKatNavn = ex.catLabel ?? '';
		fTags = ex.tags.join(', ');
		fVideo = ex.videoPath ?? '';
		fUdstyr = ex.udstyr ?? ['ingen'];
		fFormer = ex.treaningsformer ?? ['mikrotraening'];
		fAktiv = ex.aktiv;
		formFejl = '';
		bekraefterSlet = false;
		aaben = true;
	}

	function toggleUdstyr(u: Udstyr) {
		fUdstyr = fUdstyr.includes(u) ? fUdstyr.filter((x) => x !== u) : [...fUdstyr, u];
	}

	function toggleForm(t: Treaningsform) {
		fFormer = fFormer.includes(t) ? fFormer.filter((x) => x !== t) : [...fFormer, t];
	}

	async function gem() {
		const id = (redigererId ?? fId).trim();
		const navn = fNavn.trim();
		// De fire kontroller staar ordret som paa den gamle side.
		if (!id || !/^[a-z0-9_]+$/.test(id)) {
			formFejl = 'Id må kun indeholde små bogstaver, tal og understreg.';
			return;
		}
		if (!navn) {
			formFejl = 'Øvelsen skal have et navn.';
			return;
		}
		if (fUdstyr.length === 0) {
			formFejl = 'Vælg mindst ét udstyr, eller vælg Intet.';
			return;
		}
		if (fFormer.length === 0) {
			formFejl = 'Vælg mindst én træningsform.';
			return;
		}
		gemmer = true;
		formFejl = '';
		try {
			await gemExercise(id, {
				name: navn,
				desc: fBesk.trim(),
				// Ét trin pr linje. Sadan har den altid vaeret gemt.
				how: fHvordan
					.split('\n')
					.map((s) => s.trim())
					.filter(Boolean),
				cat: fKat,
				catLabel: fKatNavn.trim() || fKat,
				tags: fTags
					.split(',')
					.map((s) => s.trim())
					.filter(Boolean),
				videoPath: fVideo.trim(),
				udstyr: fUdstyr,
				treaningsformer: fFormer,
				aktiv: fAktiv
			});
			aaben = false;
			await indlaes();
			sigTil('Øvelsen er gemt');
		} catch (e) {
			console.error('[admin] gem øvelse', e);
			formFejl = 'Kunne ikke gemme.';
		} finally {
			gemmer = false;
		}
	}

	async function slet() {
		if (!redigererId) return;
		gemmer = true;
		formFejl = '';
		try {
			await sletExercise(redigererId);
			aaben = false;
			await indlaes();
			sigTil('Øvelsen er slettet');
		} catch (e) {
			console.error('[admin] slet øvelse', e);
			formFejl = 'Kunne ikke slette.';
		} finally {
			gemmer = false;
		}
	}
</script>

<svelte:head><title>Øvelsesbanken · Admin</title></svelte:head>

{#if !maaVaereHer}
	<p class="ob-kun">Siden er kun for admin.</p>
{:else}
	<AdmSide
		titel="Øvelsesbanken"
		under="Alle øvelser med video, beskrivelse og trin. Både den gamle og den nye app vælger herfra."
		bred
	>
		{#snippet handling()}
			<AdmKnap slags="primaer" onclick={aabnNy}>Ny øvelse</AdmKnap>
		{/snippet}

		{#if besked}<div class="ob-besked">{besked}</div>{/if}
		{#if fejl}<div class="ob-fejl">{fejl}</div>{/if}

		{#if aaben}
			<AdmKort>
				<h2 class="ob-h">{redigererId ? 'Ret øvelsen' : 'Ny øvelse'}</h2>

				<div class="ob-raek">
					<label class="ob-felt">
						<span>Navn</span>
						<input type="text" bind:value={fNavn} disabled={gemmer} />
					</label>
					<label class="ob-felt">
						<span>Id{redigererId ? '' : ', kan ikke ændres senere'}</span>
						<input
							type="text"
							placeholder="fx goblet_squat"
							bind:value={fId}
							disabled={gemmer || !!redigererId}
						/>
					</label>
				</div>

				<label class="ob-felt bred">
					<span>Kort beskrivelse</span>
					<input type="text" bind:value={fBesk} disabled={gemmer} />
				</label>

				<label class="ob-felt bred">
					<span>Sådan gør du, ét trin pr linje</span>
					<textarea rows="5" bind:value={fHvordan} disabled={gemmer}></textarea>
				</label>

				<div class="ob-raek">
					<label class="ob-felt">
						<span>Kategori</span>
						<select bind:value={fKat} disabled={gemmer}>
							{#each KATEGORIER as k (k.id)}
								<option value={k.id}>{k.label}</option>
							{/each}
						</select>
					</label>
					<label class="ob-felt">
						<span>Andet navn på kategorien</span>
						<input type="text" bind:value={fKatNavn} disabled={gemmer} />
					</label>
				</div>

				<label class="ob-felt bred">
					<span>Søgeord, adskilt med komma</span>
					<input type="text" bind:value={fTags} disabled={gemmer} />
				</label>

				<label class="ob-felt bred">
					<span>Video</span>
					<input
						type="text"
						placeholder="Stien til videofilen"
						bind:value={fVideo}
						disabled={gemmer}
					/>
				</label>

				<div class="ob-felt bred">
					<span>Udstyr</span>
					<div class="ob-chips">
						{#each UDSTYR as u (u.id)}
							<button
								type="button"
								class="ob-chip"
								class:paa={fUdstyr.includes(u.id)}
								disabled={gemmer}
								onclick={() => toggleUdstyr(u.id)}>{u.label}</button
							>
						{/each}
					</div>
				</div>

				<div class="ob-felt bred">
					<span>Træningsformer</span>
					<div class="ob-chips">
						{#each FORMER as t (t.id)}
							<button
								type="button"
								class="ob-chip"
								class:paa={fFormer.includes(t.id)}
								disabled={gemmer}
								onclick={() => toggleForm(t.id)}>{t.label}</button
							>
						{/each}
					</div>
				</div>

				<label class="ob-flueben">
					<input type="checkbox" bind:checked={fAktiv} disabled={gemmer} />
					<span>Aktiv, altså kan vælges til et program</span>
				</label>

				{#if formFejl}<div class="ob-fejl">{formFejl}</div>{/if}

				<div class="ob-knapper">
					<AdmKnap slags="primaer" disabled={gemmer} onclick={gem}>
						{gemmer ? 'Gemmer…' : 'Gem øvelsen'}
					</AdmKnap>
					<AdmKnap disabled={gemmer} onclick={() => (aaben = false)}>Annuller</AdmKnap>
					{#if redigererId}
						{#if bekraefterSlet}
							<span class="ob-advarsel">
								Øvelsen forsvinder fra banken. Programmer der bruger den står med et hul.
							</span>
							<AdmKnap slags="fare" disabled={gemmer} onclick={slet}>
								{gemmer ? 'Sletter…' : 'Ja, slet'}
							</AdmKnap>
							<AdmKnap disabled={gemmer} onclick={() => (bekraefterSlet = false)}>Fortryd</AdmKnap>
						{:else}
							<AdmKnap slags="fare" disabled={gemmer} onclick={() => (bekraefterSlet = true)}>
								Slet
							</AdmKnap>
						{/if}
					{/if}
				</div>
			</AdmKort>
		{/if}

		<AdmSoeg bind:vaerdi={soeg} placeholder="Søg efter navn, beskrivelse eller søgeord…" />

		<div class="ob-filtre">
			<button
				type="button"
				class="ob-chip"
				class:paa={kategori === 'alle'}
				onclick={() => (kategori = 'alle')}
			>
				Alle
			</button>
			{#each KATEGORIER as k (k.id)}
				<button
					type="button"
					class="ob-chip"
					class:paa={kategori === k.id}
					onclick={() => (kategori = k.id)}>{k.label}</button
				>
			{/each}
		</div>

		<p class="ob-antal">
			{listen.length} af {oevelser.length} øvelser
			{#if udenVideo > 0}· {udenVideo} mangler en video{/if}
		</p>

		{#if henter}
			<AdmTom tekst="Henter øvelserne…" />
		{:else if fejl && oevelser.length === 0}
			<AdmTom tekst={fejl} fejl>
				{#snippet handling()}
					<AdmKnap onclick={indlaes}>Prøv igen</AdmKnap>
				{/snippet}
			</AdmTom>
		{:else if listen.length === 0}
			<AdmTom tekst="Ingen øvelser matcher det du har valgt." />
		{:else}
			<div class="ob-liste">
				{#each listen as ex (ex.id)}
					<button type="button" class="ob-raekke" onclick={() => aabnRediger(ex)}>
						<div class="ob-r-tekst">
							<div class="ob-r-top">
								<span class="ob-navn">{ex.name}</span>
								{#if !ex.aktiv}<AdmMaerkat farve="stille">Ikke aktiv</AdmMaerkat>{/if}
								{#if !ex.videoPath?.trim()}<AdmMaerkat farve="ro">Ingen video</AdmMaerkat>{/if}
							</div>
							<div class="ob-meta">
								{KATEGORIER.find((k) => k.id === ex.cat)?.label ?? ex.cat}
								{#if (ex.udstyr ?? []).length > 0}
									· {(ex.udstyr ?? [])
										.map((u) => UDSTYR.find((x) => x.id === u)?.label ?? u)
										.join(', ')}
								{/if}
							</div>
						</div>
						<span class="ob-pil">›</span>
					</button>
				{/each}
			</div>
		{/if}
	</AdmSide>
{/if}

<style>
	.ob-kun {
		padding: 24px 18px;
		color: var(--ink-2);
		font-size: calc(14px * var(--fs-scale, 1));
	}

	.ob-besked,
	.ob-fejl {
		margin-bottom: 12px;
		padding: 11px 15px;
		border-radius: 12px;
		font-size: calc(13.5px * var(--fs-scale, 1));
		font-weight: 600;
	}

	.ob-besked {
		background: var(--sage-tint, #e7efe5);
		color: var(--sage-tekst, #46603f);
	}

	.ob-fejl {
		background: var(--ler-tint, #f4e6de);
		color: var(--ler-tekst, #8a5439);
	}

	.ob-h {
		margin: 0 0 12px;
		font-size: calc(16px * var(--fs-scale, 1));
		font-weight: 600;
	}

	.ob-raek {
		display: flex;
		gap: 10px;
		flex-wrap: wrap;
	}

	.ob-felt {
		display: flex;
		flex-direction: column;
		gap: 4px;
		flex: 1 1 160px;
		margin-bottom: 11px;
	}

	.ob-felt.bred {
		flex-basis: 100%;
	}

	.ob-felt span {
		font-size: calc(10.5px * var(--fs-scale, 1));
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--ink-3, #a3948a);
	}

	.ob-felt input,
	.ob-felt select,
	.ob-felt textarea {
		padding: 11px 13px;
		background: var(--paper, #fbf8f2);
		border: 1px solid var(--line, #e8dfd1);
		border-radius: 11px;
		color: var(--espresso, #382c2a);
		font-size: calc(14px * var(--fs-scale, 1));
		font-family: inherit;
		line-height: 1.5;
		box-sizing: border-box;
		resize: vertical;
	}

	.ob-felt input:disabled {
		opacity: 0.6;
	}

	.ob-chips,
	.ob-filtre {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}

	.ob-filtre {
		margin: 10px 0;
	}

	/* Baggrunden staar eksplicit, se noten i AdmKnap. */
	.ob-chip {
		padding: 8px 14px;
		background: var(--paper, #fbf8f2);
		border: 1px solid var(--line, #e8dfd1);
		border-radius: 99px;
		color: var(--ink-2, #6f5f57);
		font-size: calc(12.5px * var(--fs-scale, 1));
		font-family: inherit;
		font-weight: 600;
		cursor: pointer;
	}

	.ob-chip.paa {
		background: var(--plum, #7c4f63);
		border-color: var(--plum, #7c4f63);
		color: #fff;
	}

	.ob-flueben {
		display: flex;
		align-items: center;
		gap: 9px;
		margin: 4px 0 12px;
		font-size: calc(13.5px * var(--fs-scale, 1));
	}

	.ob-knapper {
		display: flex;
		align-items: center;
		gap: 8px;
		flex-wrap: wrap;
	}

	.ob-advarsel {
		font-size: calc(11.5px * var(--fs-scale, 1));
		color: var(--ler-tekst, #8a5439);
		font-weight: 600;
	}

	.ob-antal {
		margin: 0 0 10px;
		font-size: calc(12px * var(--fs-scale, 1));
		color: var(--ink-3, #a3948a);
	}

	.ob-liste {
		display: flex;
		flex-direction: column;
		gap: 5px;
	}

	.ob-raekke {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		width: 100%;
		padding: 13px 16px;
		background: var(--paper-2, #f6f0e7);
		border: none;
		border-radius: 13px;
		font-family: inherit;
		text-align: left;
		cursor: pointer;
	}

	.ob-r-tekst {
		min-width: 0;
	}

	.ob-r-top {
		display: flex;
		align-items: center;
		gap: 8px;
		flex-wrap: wrap;
	}

	.ob-navn {
		font-size: calc(14px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--espresso, #382c2a);
	}

	.ob-meta {
		margin-top: 2px;
		font-size: calc(11.5px * var(--fs-scale, 1));
		color: var(--ink-3, #a3948a);
	}

	.ob-pil {
		color: var(--ink-3, #a3948a);
		flex-shrink: 0;
	}
</style>
