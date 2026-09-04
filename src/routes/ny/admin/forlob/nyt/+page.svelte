<script lang="ts">
	// ============================================================
	// Trin 1 og 2 af guiden: navn, type og startdato.
	//
	// Bygget 4. september 2026 efter skaerm 4 i mockups-admin.html.
	//
	// HVORFOR DE TO TRIN LIGGER FOR SIG. Alt andet i guiden skal gemmes
	// PAA et forloeb, og det kan ikke lade sig goere foer forloebet
	// findes. Saa snart der er trykket her, er holdet oprettet og lukket,
	// og guiden kan gemme undervejs uden at noget kan gaa tabt.
	//
	// HOLDET OPRETTES ALTID LUKKET. Det aabnes foerst paa sidste trin, og
	// kun naar der ikke er noget der spaerrer. Se forlobGuide3.ts.
	// ============================================================

	import { getContext, onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import type { User } from 'firebase/auth';
	import { isAdmin } from '$lib/admin';
	import { Timestamp } from 'firebase/firestore';
	import { hentAlleForlob, opretForlob, kopierForlobIndhold } from '$lib/firestore/forlob';
	import type { Forlob } from '$lib/content/forlobAdgang';
	import {
		TOMT_SVAR,
		idAf,
		validerOprettelse,
		forlobFelter,
		type NytForlobSvar
	} from '$lib/content/forlobGuide3';
	import AdmSide from '$lib/components/admin/AdmSide.svelte';
	import AdmKort from '$lib/components/admin/AdmKort.svelte';
	import AdmKnap from '$lib/components/admin/AdmKnap.svelte';
	import AdmTom from '$lib/components/admin/AdmTom.svelte';

	const hentUser = getContext<() => User | null>('user');
	const maaVaereHer = $derived(isAdmin(hentUser()));

	let svar = $state<NytForlobSvar>({ ...TOMT_SVAR });
	let kopierFra = $state('');
	let forlob = $state<Forlob[]>([]);
	let henter = $state(true);
	let opretter = $state(false);
	let fejl = $state('');

	onMount(async () => {
		try {
			forlob = await hentAlleForlob();
		} catch (e) {
			console.error('[guide] forløb', e);
		} finally {
			henter = false;
		}
	});

	function navnSkiftet() {
		// Id'et foelger navnet indtil man selv retter i det.
		if (!svar.id || svar.id === idAf(svar.navn.slice(0, -1))) svar.id = idAf(svar.navn);
	}

	const problem = $derived(validerOprettelse(svar, forlob.map((f) => f.id)));

	// Tidligere hold af samme slags, nyeste foerst. To Kickstart-hold
	// ligner hinanden paa naesten alt, saa kopiering er reglen og ikke
	// undtagelsen.
	const kandidater = $derived(
		[...forlob].sort((a, b) => (b.startDato?.toMillis?.() ?? 0) - (a.startDato?.toMillis?.() ?? 0))
	);

	async function opret() {
		fejl = problem;
		if (fejl) return;

		opretter = true;
		const id = (svar.id || idAf(svar.navn)).trim();
		try {
			const { startMs, ...felter } = forlobFelter(svar);
			await opretForlob(id, {
				...felter,
				startDato: Timestamp.fromMillis(startMs)
			} as unknown as Omit<Forlob, 'id' | 'oprettet'>);

			if (kopierFra) {
				try {
					await kopierForlobIndhold(kopierFra, id);
				} catch (e) {
					console.error('[guide] kopiering fejlede', e);
					// FORLOEBET ER OPRETTET. Det skal siges, ellers opretter man
					// det igen og staar med to.
					fejl =
						'Holdet er oprettet, men indholdet blev ikke kopieret. Opret det ikke igen. Guiden er åbnet, og du kan kopiere fra holdets egen side.';
					opretter = false;
					await goto(`/ny/admin/forlob/${id}/guide`);
					return;
				}
			}

			await goto(`/ny/admin/forlob/${id}/guide`);
		} catch (e) {
			console.error('[guide] opret', e);
			fejl = e instanceof Error ? e.message : 'Kunne ikke oprette holdet.';
			opretter = false;
		}
	}
</script>

<svelte:head><title>Nyt forløb · Admin</title></svelte:head>

{#if !maaVaereHer}
	<p class="nf-kun">Siden er kun for admin.</p>
{:else}
	<AdmSide titel="Nyt forløb" under="Trin 1 og 2 af 9. Resten kommer når holdet findes.">
		{#if henter}
			<AdmTom tekst="Henter de andre hold…" />
		{:else}
			<AdmKort>
				<h3>Navn og type</h3>

				<label class="nf-l">
					<span>Hvad hedder holdet?</span>
					<input type="text" bind:value={svar.navn} oninput={navnSkiftet} placeholder="Kickstart oktober 2026" />
					<small>Navnet ser kunderne. Skriv måneden med, ellers kan to hold ikke skelnes.</small>
				</label>

				<label class="nf-l">
					<span>Id</span>
					<input type="text" bind:value={svar.id} placeholder="kickstart-oktober-2026" />
					<small>Står kun i adresselinjen. Det kan ikke laves om bagefter.</small>
				</label>

				<div class="nf-l">
					<span>Hvilken slags hold?</span>
					<div class="nf-valg">
						<button type="button" class:paa={!svar.bygget && svar.type === 'kickstart'} onclick={() => { svar.bygget = false; svar.type = 'kickstart'; }}>Kickstart</button>
						<button type="button" class:paa={!svar.bygget && svar.type === 'kropsro'} onclick={() => { svar.bygget = false; svar.type = 'kropsro'; }}>Kropsro</button>
						<button type="button" class:paa={svar.bygget} onclick={() => (svar.bygget = true)}>Bygget selv</button>
					</div>
					<small>
						{#if svar.bygget}
							Et bygget hold får sin egen dataskuffe, så to hold aldrig kan blande kundernes svar
							sammen. Du vælger selv hver funktion.
						{:else}
							Kickstart og Kropsro følger de faste regler for deres type. Det er dem kunderne
							kender.
						{/if}
					</small>
				</div>

				<label class="nf-l">
					<span>Hvor mange dage?</span>
					<input type="number" min="1" max="365" bind:value={svar.antalDage} />
					<small>Kickstart er 21 dage, Kropsro er 84.</small>
				</label>

				{#if !svar.bygget}
					<label class="nf-tjek">
						<input type="checkbox" bind:checked={svar.premium} />
						<span>Holdet skal have premium-adgang</span>
					</label>
				{:else}
					<label class="nf-tjek">
						<input type="checkbox" bind:checked={svar.harTraening} />
						<span>Holdet skal have mikrotræning</span>
					</label>
					<label class="nf-tjek">
						<input type="checkbox" bind:checked={svar.harFacebookGruppe} />
						<span>Holdet har en Facebook-gruppe</span>
					</label>
					<label class="nf-tjek">
						<input type="checkbox" bind:checked={svar.harBuddy} />
						<span>Holdet får buddy-makkere</span>
					</label>
					<label class="nf-l">
						<span>Hvor mange pausedage må hun holde?</span>
						<input type="number" min="0" max="365" bind:value={svar.nulDagePulje} />
						<small>En pausedag forlænger forløbet i stedet for at æde en dag.</small>
					</label>
				{/if}
			</AdmKort>

			<AdmKort>
				<h3>Startdato</h3>
				<label class="nf-l">
					<span>Hvornår begynder holdet?</span>
					<input type="date" bind:value={svar.startDato} />
					<small>
						Dagen her er dag 0, altså den dag der måles fra. Dag 1 er dagen efter. Alt andet i
						forløbet regnes ud fra den her dato, så den er den sværeste at rette bagefter.
					</small>
				</label>
			</AdmKort>

			<AdmKort>
				<h3>Skal noget kopieres fra et tidligere hold?</h3>
				<p class="nf-p">
					To hold af samme slags ligner hinanden på næsten alt. Kopierer du, får det nye hold de
					samme lektioner, små skridt, spørgsmål og guides, og du retter kun det der er nyt.
				</p>
				<select bind:value={kopierFra}>
					<option value="">Nej, jeg starter forfra</option>
					{#each kandidater as f (f.id)}
						<option value={f.id}>{f.navn}</option>
					{/each}
				</select>
			</AdmKort>

			{#if fejl}<p class="nf-fejl">{fejl}</p>{/if}

			<div class="nf-bund">
				<span>Holdet oprettes lukket. Ingen kunde kan se det før du udgiver på sidste trin.</span>
				<AdmKnap slags="primaer" disabled={opretter || !!problem} onclick={opret}>
					{opretter ? 'Opretter…' : 'Opret og fortsæt ›'}
				</AdmKnap>
			</div>
			{#if problem && !fejl}<p class="nf-hint">{problem}</p>{/if}
		{/if}
	</AdmSide>
{/if}

<style>
	.nf-kun {
		padding: 24px 18px;
		color: var(--ink-2);
		font-size: calc(14px * var(--fs-scale, 1));
	}

	:global(.nf-l),
	.nf-l {
		display: block;
		margin-bottom: 14px;
	}

	.nf-l > span {
		display: block;
		margin-bottom: 5px;
		font-size: calc(13px * var(--fs-scale, 1));
		font-weight: 600;
	}

	.nf-l small,
	.nf-p {
		display: block;
		margin-top: 5px;
		font-size: calc(11.5px * var(--fs-scale, 1));
		color: var(--ink-3);
		line-height: 1.5;
	}

	.nf-p {
		margin: 0 0 9px;
	}

	/* Baggrunden staar altid eksplicit, ellers arver felterne browserens
	   graa og ligner ikke resten af admin. */
	input[type='text'],
	input[type='number'],
	input[type='date'],
	select {
		width: 100%;
		padding: 10px 13px;
		background: var(--paper, #fbf8f2);
		border: 1px solid var(--line, #e8dfd1);
		border-radius: 11px;
		color: var(--espresso, #382c2a);
		font-size: calc(14px * var(--fs-scale, 1));
		font-family: inherit;
		box-sizing: border-box;
	}

	.nf-valg {
		display: flex;
		gap: 6px;
		flex-wrap: wrap;
	}

	.nf-valg button {
		padding: 9px 16px;
		background: var(--paper, #fbf8f2);
		border: 1px solid var(--line, #e8dfd1);
		border-radius: 99px;
		color: var(--ink-2);
		font-size: calc(13px * var(--fs-scale, 1));
		font-family: inherit;
		font-weight: 600;
		cursor: pointer;
	}

	.nf-valg button.paa {
		background: var(--plum);
		border-color: var(--plum);
		color: #fff;
	}

	.nf-tjek {
		display: flex;
		align-items: center;
		gap: 9px;
		padding: 7px 0;
		font-size: calc(13px * var(--fs-scale, 1));
	}

	.nf-tjek input {
		width: 18px;
		height: 18px;
		flex-shrink: 0;
	}

	.nf-fejl {
		margin: 12px 0;
		padding: 11px 14px;
		background: var(--ler-tint);
		border-radius: 12px;
		color: var(--ler-tekst);
		font-size: calc(13px * var(--fs-scale, 1));
		line-height: 1.5;
	}

	.nf-bund {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 14px;
		flex-wrap: wrap;
		margin-top: 16px;
	}

	.nf-bund > span,
	.nf-hint {
		font-size: calc(11.5px * var(--fs-scale, 1));
		color: var(--ink-3);
	}

	.nf-hint {
		margin: 8px 0 0;
	}
</style>
