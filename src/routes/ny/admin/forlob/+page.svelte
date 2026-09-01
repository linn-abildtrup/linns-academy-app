<script lang="ts">
	// ============================================================
	// Forloeb, i det nye design.
	//
	// Sekstende af de 19 gamle admin-sider, 1. september 2026.
	//
	// FORLOEBET HAR OTTE UNDERSIDER: lektioner, smaa skridt, traening,
	// bibliotek, beskeder, challenges, makker og Facebook-gruppen. De er
	// alle lavet om samme dag og ligger under /ny/admin/forlob/[id].
	//
	// LOGIKKEN ER FLYTTET, IKKE SKREVET OM. Samme opretForlob, gemForlob og
	// kopierForlobIndhold, og id'et laves med praecis den samme regel.
	//
	// TO TING DER ER DYRE AT GENOPDAGE, og som staar ordret som foer:
	//  - forloeb starter kl 00:01, saa det daekker kalenderdagene rent og
	//    udloebet lander ved midnat efter sidste dag
	//  - et BYGGET forloeb saetter ikke type, faar sit eget dataspor via
	//    produktNoegle, og er altid 'basis' internt. Alt synligt styres af
	//    funktions-fluebenene
	//
	// Den gamle side paa /app/admin/forlob er uroert.
	// ============================================================

	import { getContext, onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import type { User } from 'firebase/auth';
	import { isAdmin } from '$lib/admin';
	import { Timestamp } from 'firebase/firestore';
	import type { Forlob, ForlobType } from '$lib/content/forlobAdgang';
	import {
		gemForlob,
		hentAlleForlob,
		kopierForlobIndhold,
		opretForlob
	} from '$lib/firestore/forlob';
	import { FEATURES } from '$lib/content/features';
	import AdmSide from '$lib/components/admin/AdmSide.svelte';
	import AdmKort from '$lib/components/admin/AdmKort.svelte';
	import AdmKnap from '$lib/components/admin/AdmKnap.svelte';
	import AdmMaerkat from '$lib/components/admin/AdmMaerkat.svelte';
	import AdmTom from '$lib/components/admin/AdmTom.svelte';

	const hentUser = getContext<() => User | null>('user');
	const maaVaereHer = $derived(isAdmin(hentUser()));

	let forlob = $state<Forlob[]>([]);
	let henter = $state(true);
	let fejl = $state('');
	let besked = $state('');

	let laasId = $state('');
	let laaser = $state(false);

	let opretAaben = $state(false);
	let fNavn = $state('');
	let fStart = $state('');
	let fDage = $state(21);
	let fId = $state('');
	let fAktiv = $state(true);
	let fType = $state<ForlobType>('kickstart');
	let fPremium = $state(false);
	let fBygget = $state(false);
	let fFeatures = $state<Record<string, boolean>>({});
	let fBuddy = $state(false);
	let fFacebook = $state(false);
	let fTraening = $state(false);
	let fNulPulje = $state(14);
	let fKopierFra = $state('');
	let opretFejl = $state('');
	let opretter = $state(false);

	onMount(() => void indlaes());

	async function indlaes() {
		henter = true;
		fejl = '';
		try {
			forlob = await hentAlleForlob();
		} catch (e) {
			console.error('[admin] forløb', e);
			fejl = 'Kunne ikke hente forløbene.';
		} finally {
			henter = false;
		}
	}

	function sigTil(t: string) {
		besked = t;
		setTimeout(() => {
			if (besked === t) besked = '';
		}, 2600);
	}

	/** Samme regel som foer. Id'et er dokumentets navn og kan ikke aendres. */
	function idAf(navn: string): string {
		return navn
			.toLowerCase()
			.normalize('NFD')
			.replace(/[̀-ͯ]/g, '')
			.replace(/æ/g, 'ae')
			.replace(/ø/g, 'oe')
			.replace(/å/g, 'aa')
			.replace(/[^a-z0-9]+/g, '_')
			.replace(/^_|_$/g, '');
	}

	function aabnOpret() {
		opretAaben = true;
		fNavn = '';
		fStart = '';
		fDage = 21;
		fId = '';
		fAktiv = true;
		fType = 'kickstart';
		fPremium = false;
		fBygget = false;
		fFeatures = {};
		fBuddy = false;
		fFacebook = false;
		fTraening = false;
		fNulPulje = 14;
		fKopierFra = '';
		opretFejl = '';
	}

	function navnSkiftet() {
		// Id'et foelger navnet indtil man selv retter i det.
		if (!fId || fId === idAf(fNavn.slice(0, fNavn.length - 1))) fId = idAf(fNavn);
	}

	function dato(t: { toDate: () => Date } | undefined): string {
		if (!t || typeof t.toDate !== 'function') return '—';
		const d = t.toDate();
		return d.toLocaleDateString('da-DK', { day: 'numeric', month: 'short', year: 'numeric' });
	}

	function koererNu(f: Forlob): boolean {
		const start = f.startDato?.toMillis?.() ?? 0;
		const dage = Number(f.antalDage) || 0;
		if (!start || !dage) return false;
		const nu = Date.now();
		return nu >= start && nu <= start + (dage + 1) * 86400000;
	}

	async function opret() {
		opretFejl = '';
		const navn = fNavn.trim();
		if (!navn) {
			opretFejl = 'Forløbet skal have et navn.';
			return;
		}
		if (!fStart) {
			opretFejl = 'Vælg en startdato.';
			return;
		}
		if (fDage < 1 || fDage > 365) {
			opretFejl = 'Antal dage skal være mellem 1 og 365.';
			return;
		}
		const id = fId.trim() || idAf(navn);
		if (!id) {
			opretFejl = 'Kunne ikke lave et id ud af navnet. Skriv et selv.';
			return;
		}
		if (forlob.some((f) => f.id === id)) {
			opretFejl = 'Der findes allerede et forløb med det id.';
			return;
		}

		opretter = true;
		try {
			// KL 00:01. Saa daekker forloebet kalenderdagene rent, og udloebet
			// lander ved midnat efter sidste dag i stedet for at arve et
			// skaevt klokkeslaet.
			const start = new Date(fStart + 'T00:01:00');

			if (fBygget) {
				// Bygget forloeb: eget dataspor via produktNoegle, ingen type,
				// og altid 'basis' internt. Alt synligt styres af fluebenene.
				await opretForlob(id, {
					navn,
					startDato: Timestamp.fromDate(start),
					antalDage: fDage,
					vaneProgramId: null,
					aktiv: fAktiv,
					byggetForlob: true,
					produktNoegle: id,
					adgangsNiveau: 'basis',
					features: { ...fFeatures },
					harBuddy: fBuddy,
					harFacebookGruppe: fFacebook,
					harTraening: fTraening,
					nulDagePulje: Math.max(0, Math.min(365, fNulPulje))
				});
			} else {
				await opretForlob(id, {
					navn,
					startDato: Timestamp.fromDate(start),
					antalDage: fDage,
					vaneProgramId: null,
					aktiv: fAktiv,
					type: fType,
					...(fPremium ? { adgangsNiveau: 'premium' as const } : {})
				});
			}

			if (fKopierFra) {
				try {
					await kopierForlobIndhold(fKopierFra, id);
				} catch (e) {
					console.error('[admin] kopiering fejlede', e);
					// Forloebet ER oprettet. Det skal siges, ellers opretter man
					// det igen og faar to.
					opretFejl =
						'Forløbet er oprettet, men indholdet blev ikke kopieret. Opret det ikke igen. Kopiér i stedet fra forløbets egen side.';
					opretter = false;
					await indlaes();
					return;
				}
			}

			goto(`/ny/admin/forlob/${id}`);
		} catch (e) {
			console.error('[admin] opret forløb', e);
			opretFejl = e instanceof Error ? e.message : 'Kunne ikke oprette forløbet.';
			opretter = false;
		}
	}

	async function saetLaas(f: Forlob) {
		if (laaser) return;
		laaser = true;
		try {
			await gemForlob(f.id, { laast: !f.laast });
			forlob = forlob.map((x) => (x.id === f.id ? { ...x, laast: !f.laast } : x));
			laasId = '';
			sigTil(f.laast ? 'Forløbet er låst op' : 'Forløbet er låst');
		} catch (e) {
			console.error('[admin] lås', e);
			fejl = 'Kunne ikke ændre låsen.';
		} finally {
			laaser = false;
		}
	}
</script>

<svelte:head><title>Forløb · Admin</title></svelte:head>

{#if !maaVaereHer}
	<p class="fo-kun">Siden er kun for admin.</p>
{:else}
	<AdmSide
		titel="Forløb"
		under="Alle hold. Tryk på et forløb for at rette dets dage, lektioner, små skridt og træning."
		bred
	>
		{#snippet handling()}
			<AdmKnap slags="primaer" onclick={aabnOpret}>Nyt forløb</AdmKnap>
		{/snippet}

		{#if besked}<div class="fo-besked">{besked}</div>{/if}
		{#if fejl}<div class="fo-fejl">{fejl}</div>{/if}

		{#if opretAaben}
			<AdmKort>
				<h2 class="fo-h">Nyt forløb</h2>

				<div class="fo-raek">
					<label class="fo-felt bred">
						<span>Navn</span>
						<input type="text" bind:value={fNavn} oninput={navnSkiftet} disabled={opretter} />
					</label>
					<label class="fo-felt">
						<span>Id, kan ikke ændres senere</span>
						<input type="text" bind:value={fId} disabled={opretter} />
					</label>
					<label class="fo-felt">
						<span>Starter</span>
						<input type="date" bind:value={fStart} disabled={opretter} />
					</label>
					<label class="fo-felt">
						<span>Antal dage</span>
						<input type="number" min="1" max="365" bind:value={fDage} disabled={opretter} />
					</label>
				</div>

				<label class="fo-flueben">
					<input type="checkbox" bind:checked={fBygget} disabled={opretter} />
					<span>Bygget forløb, altså ikke Kickstart eller Kropsro</span>
				</label>

				{#if fBygget}
					<p class="fo-hint">
						Et bygget forløb får sin egen skuffe til kundernes data, og du vælger selv hvilke
						funktioner det har. Det har ingen premium-forskel.
					</p>

					<div class="fo-felt bred">
						<span>Funktioner</span>
						<div class="fo-chips">
							{#each FEATURES as ft (ft.key)}
								<button
									type="button"
									class="fo-chip"
									class:paa={fFeatures[ft.key]}
									disabled={opretter}
									onclick={() => (fFeatures = { ...fFeatures, [ft.key]: !fFeatures[ft.key] })}
								>
									{ft.navn}
								</button>
							{/each}
						</div>
					</div>

					<div class="fo-chips">
						<button type="button" class="fo-chip" class:paa={fTraening} disabled={opretter} onclick={() => (fTraening = !fTraening)}>
							Har træning
						</button>
						<button type="button" class="fo-chip" class:paa={fBuddy} disabled={opretter} onclick={() => (fBuddy = !fBuddy)}>
							Har makker
						</button>
						<button type="button" class="fo-chip" class:paa={fFacebook} disabled={opretter} onclick={() => (fFacebook = !fFacebook)}>
							Har Facebook-gruppe
						</button>
					</div>

					<label class="fo-felt">
						<span>Pause-dage kunden må bruge</span>
						<input type="number" min="0" max="365" bind:value={fNulPulje} disabled={opretter} />
					</label>
				{:else}
					<div class="fo-raek">
						<label class="fo-felt">
							<span>Type</span>
							<select bind:value={fType} disabled={opretter}>
								<option value="kickstart">Kickstart</option>
								<option value="kropsro">Kropsro</option>
							</select>
						</label>
					</div>
					<label class="fo-flueben">
						<input type="checkbox" bind:checked={fPremium} disabled={opretter} />
						<span>Premium-niveau</span>
					</label>
				{/if}

				<label class="fo-flueben">
					<input type="checkbox" bind:checked={fAktiv} disabled={opretter} />
					<span>Aktivt</span>
				</label>

				<label class="fo-felt bred">
					<span>Kopiér indholdet fra et andet forløb, valgfrit</span>
					<select bind:value={fKopierFra} disabled={opretter}>
						<option value="">Start tomt</option>
						{#each forlob as f (f.id)}
							<option value={f.id}>{f.navn}</option>
						{/each}
					</select>
				</label>

				{#if opretFejl}<div class="fo-fejl">{opretFejl}</div>{/if}

				<div class="fo-knapper">
					<AdmKnap slags="primaer" disabled={opretter} onclick={opret}>
						{opretter ? 'Opretter…' : 'Opret forløbet'}
					</AdmKnap>
					<AdmKnap disabled={opretter} onclick={() => (opretAaben = false)}>Annuller</AdmKnap>
				</div>
			</AdmKort>
		{/if}

		{#if henter}
			<AdmTom tekst="Henter forløbene…" />
		{:else if fejl && forlob.length === 0}
			<AdmTom tekst={fejl} fejl>
				{#snippet handling()}
					<AdmKnap onclick={indlaes}>Prøv igen</AdmKnap>
				{/snippet}
			</AdmTom>
		{:else if forlob.length === 0}
			<AdmTom tekst="Der er ingen forløb endnu." />
		{:else}
			<p class="fo-antal">{forlob.length} forløb</p>
			{#each forlob as f (f.id)}
				<AdmKort ro={koererNu(f)}>
					<div class="fo-hoved">
						<div>
							<span class="fo-navn">{f.navn}</span>
							<div class="fo-meta">
								Starter {dato(f.startDato)} · {f.antalDage} dage
								{#if f.byggetForlob}· bygget{:else if f.type}· {f.type}{/if}
							</div>
							<div class="fo-id">{f.id}</div>
						</div>
						<div class="fo-maerker">
							{#if koererNu(f)}<AdmMaerkat farve="ro">Kører nu</AdmMaerkat>{/if}
							{#if f.laast}<AdmMaerkat farve="fare">Låst</AdmMaerkat>{/if}
							{#if f.aktiv === false}<AdmMaerkat farve="stille">Ikke aktivt</AdmMaerkat>{/if}
						</div>
					</div>

					<div class="fo-knapper">
						{#if f.laast}
							<span class="fo-laast-tekst">
								Forløbet er låst, så indholdet ikke kan rettes ved et uheld.
							</span>
						{:else}
							<AdmKnap
								slags="primaer"
								onclick={() => goto(`/ny/admin/forlob/${f.id}`)}
							>
								Åbn forløbet
							</AdmKnap>
						{/if}

						{#if laasId === f.id}
							<span class="fo-advarsel">
								{f.laast
									? 'Indholdet kan rettes igen bagefter.'
									: 'Indholdet kan ikke rettes så længe det er låst.'}
							</span>
							<AdmKnap slags="fare" disabled={laaser} onclick={() => saetLaas(f)}>
								{laaser ? 'Gemmer…' : f.laast ? 'Ja, lås op' : 'Ja, lås'}
							</AdmKnap>
							<AdmKnap onclick={() => (laasId = '')}>Fortryd</AdmKnap>
						{:else}
							<AdmKnap onclick={() => (laasId = f.id)}>{f.laast ? 'Lås op' : 'Lås'}</AdmKnap>
						{/if}
					</div>
				</AdmKort>
			{/each}
		{/if}


	</AdmSide>
{/if}

<style>
	.fo-kun {
		padding: 24px 18px;
		color: var(--ink-2);
		font-size: calc(14px * var(--fs-scale, 1));
	}

	.fo-besked,
	.fo-fejl {
		margin-bottom: 12px;
		padding: 11px 15px;
		border-radius: 12px;
		font-size: calc(13.5px * var(--fs-scale, 1));
		font-weight: 600;
		line-height: 1.45;
	}

	.fo-besked {
		background: var(--sage-tint, #e7efe5);
		color: var(--sage-tekst, #46603f);
	}

	.fo-fejl {
		background: var(--ler-tint, #f4e6de);
		color: var(--ler-tekst, #8a5439);
	}

	.fo-h {
		margin: 0 0 12px;
		font-size: calc(16px * var(--fs-scale, 1));
		font-weight: 600;
	}

	.fo-raek {
		display: flex;
		gap: 10px;
		flex-wrap: wrap;
	}

	.fo-felt {
		display: flex;
		flex-direction: column;
		gap: 4px;
		flex: 1 1 150px;
		margin-bottom: 11px;
	}

	.fo-felt.bred {
		flex-basis: 100%;
	}

	.fo-felt span {
		font-size: calc(10.5px * var(--fs-scale, 1));
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--ink-3, #a3948a);
	}

	.fo-felt input,
	.fo-felt select {
		padding: 11px 13px;
		background: var(--paper, #fbf8f2);
		border: 1px solid var(--line, #e8dfd1);
		border-radius: 11px;
		color: var(--espresso, #382c2a);
		font-size: calc(14px * var(--fs-scale, 1));
		font-family: inherit;
		box-sizing: border-box;
	}

	.fo-flueben {
		display: flex;
		align-items: center;
		gap: 9px;
		margin: 2px 0 11px;
		font-size: calc(13.5px * var(--fs-scale, 1));
	}

	.fo-hint {
		margin: 0 0 11px;
		font-size: calc(12px * var(--fs-scale, 1));
		color: var(--ink-3, #a3948a);
		line-height: 1.5;
	}

	.fo-chips {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		margin-bottom: 11px;
	}

	/* Baggrunden staar eksplicit, se noten i AdmKnap. */
	.fo-chip {
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

	.fo-chip.paa {
		background: var(--plum, #7c4f63);
		border-color: var(--plum, #7c4f63);
		color: #fff;
	}

	.fo-knapper {
		display: flex;
		align-items: center;
		gap: 8px;
		flex-wrap: wrap;
	}

	.fo-antal {
		margin: 0 0 10px;
		font-size: calc(12px * var(--fs-scale, 1));
		color: var(--ink-3, #a3948a);
	}

	.fo-hoved {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 10px;
		margin-bottom: 10px;
	}

	.fo-navn {
		font-size: calc(15px * var(--fs-scale, 1));
		font-weight: 600;
	}

	.fo-meta {
		margin-top: 2px;
		font-size: calc(12px * var(--fs-scale, 1));
		color: var(--ink-2, #6f5f57);
	}

	.fo-id {
		margin-top: 2px;
		font-size: calc(11px * var(--fs-scale, 1));
		color: var(--ink-3, #a3948a);
	}

	.fo-maerker {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 4px;
		flex-shrink: 0;
	}

	.fo-laast-tekst,
	.fo-advarsel {
		font-size: calc(11.5px * var(--fs-scale, 1));
		color: var(--ler-tekst, #8a5439);
		font-weight: 600;
	}

</style>
