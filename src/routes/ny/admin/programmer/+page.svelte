<script lang="ts">
	// ============================================================
	// Mine programmer, i det nye design.
	//
	// Ottende af de 19 gamle admin-sider, 1. september 2026.
	//
	// DET HER ER DE GAMLE MASTER-PROGRAMMER, ikke 3.0's. De to lever side
	// om side: 3.0's ligger i traeningsprogrammer3 og bygges under
	// Traeningsprogrammer. Bland dem ikke sammen. Se 9.18.
	//
	// LOGIKKEN ER FLYTTET, IKKE SKREVET OM. Samme fire funktioner, og alle
	// fem kontroller foer der oprettes staar ordret som foer.
	//
	// Den gamle side paa /app/admin/programmer er uroert.
	// ============================================================

	import { getContext, onMount } from 'svelte';
	import type { User } from 'firebase/auth';
	import { isAdmin } from '$lib/admin';
	import type { Niveau, TrainingProgram, Udstyr } from '$lib/content/mikrotraening';
	import { tommeDageSkelet } from '$lib/content/mikrotraening';
	import {
		gemMasterProgram,
		gemMasterDage,
		hentAlleMasterProgrammer,
		sletMasterProgram
	} from '$lib/firestore/mikrotraening';
	import AdmSide from '$lib/components/admin/AdmSide.svelte';
	import AdmKort from '$lib/components/admin/AdmKort.svelte';
	import AdmKnap from '$lib/components/admin/AdmKnap.svelte';
	import AdmMaerkat from '$lib/components/admin/AdmMaerkat.svelte';
	import AdmTom from '$lib/components/admin/AdmTom.svelte';

	const hentUser = getContext<() => User | null>('user');
	const maaVaereHer = $derived(isAdmin(hentUser()));

	const UDSTYR: { id: Udstyr; label: string }[] = [
		{ id: 'ingen', label: 'Intet' },
		{ id: 'kettlebell', label: 'Kettlebell' },
		{ id: 'elastik', label: 'Elastik' },
		{ id: 'haandvaegte', label: 'Håndvægte' },
		{ id: 'forhojning', label: 'Forhøjning' }
	];

	const NIVEAUER: { id: Niveau; label: string }[] = [
		{ id: 'begynder', label: 'Begynder' },
		{ id: 'let_oevet', label: 'Let øvet' },
		{ id: 'oevet', label: 'Øvet' }
	];

	let programmer = $state<TrainingProgram[]>([]);
	let henter = $state(true);
	let fejl = $state('');
	let besked = $state('');

	let opretter = $state(false);
	let nyId = $state('');
	let nyNavn = $state('');
	let nyBeskrivelse = $state('');
	let nyAntalDage = $state(21);
	let nyUdstyr = $state<Udstyr[]>(['ingen']);
	let nyNiveau = $state<Niveau>('begynder');
	let gemmer = $state(false);
	let opretFejl = $state('');

	let sletId = $state('');
	let sletter = $state(false);

	onMount(() => void indlaes());

	async function indlaes() {
		henter = true;
		fejl = '';
		try {
			programmer = await hentAlleMasterProgrammer();
		} catch (e) {
			console.error('[admin] programmer', e);
			fejl = 'Kunne ikke hente programmerne.';
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

	function aabnOpret() {
		nyId = '';
		nyNavn = '';
		nyBeskrivelse = '';
		nyAntalDage = 21;
		nyUdstyr = ['ingen'];
		nyNiveau = 'begynder';
		opretFejl = '';
		opretter = true;
	}

	function toggleUdstyr(u: Udstyr) {
		nyUdstyr = nyUdstyr.includes(u) ? nyUdstyr.filter((x) => x !== u) : [...nyUdstyr, u];
	}

	async function opret() {
		const id = nyId.trim();
		const navn = nyNavn.trim();
		// De fem kontroller staar ordret som paa den gamle side. Id'et er
		// dokumentets navn i databasen og kan ikke laves om bagefter.
		if (!id || !/^[a-z0-9_]+$/.test(id)) {
			opretFejl = 'Id må kun indeholde små bogstaver, tal og understreg.';
			return;
		}
		if (!navn) {
			opretFejl = 'Programmet skal have et navn.';
			return;
		}
		if (nyUdstyr.length === 0) {
			opretFejl = 'Vælg mindst ét udstyr.';
			return;
		}
		if (nyAntalDage < 1) {
			opretFejl = 'Programmet skal have mindst én dag.';
			return;
		}
		if (programmer.some((p) => p.id === id)) {
			opretFejl = 'Der findes allerede et program med det id.';
			return;
		}
		gemmer = true;
		opretFejl = '';
		try {
			await gemMasterProgram(id, {
				navn,
				beskrivelse: nyBeskrivelse.trim(),
				treaningsform: 'mikrotraening',
				antalDage: nyAntalDage,
				dagligTid: 180,
				niveau: nyNiveau,
				udstyr: nyUdstyr,
				aktiv: true
			});
			// Dagene oprettes tomme med det samme, saa programmet ikke ligger
			// halvt oprettet uden noget at fylde ud.
			await gemMasterDage(id, tommeDageSkelet(nyAntalDage));
			opretter = false;
			await indlaes();
			sigTil('Programmet er oprettet');
		} catch (e) {
			console.error('[admin] opret program', e);
			opretFejl = 'Kunne ikke oprette programmet.';
		} finally {
			gemmer = false;
		}
	}

	async function slet(id: string) {
		sletter = true;
		try {
			await sletMasterProgram(id);
			sletId = '';
			await indlaes();
			sigTil('Programmet er slettet');
		} catch (e) {
			console.error('[admin] slet program', e);
			fejl = 'Kunne ikke slette programmet.';
		} finally {
			sletter = false;
		}
	}

	function udstyrTekst(p: TrainingProgram): string {
		return (p.udstyr ?? []).map((u) => UDSTYR.find((x) => x.id === u)?.label ?? u).join(', ');
	}
</script>

<svelte:head><title>Mine programmer · Admin</title></svelte:head>

{#if !maaVaereHer}
	<p class="pr-kun">Siden er kun for admin.</p>
{:else}
	<AdmSide
		titel="Mine programmer"
		under="De gamle mikrotrænings-programmer, som kan tildeles forløb, abonnenter eller enkelte kunder."
		bred
	>
		{#snippet handling()}
			<AdmKnap slags="primaer" onclick={aabnOpret}>Nyt program</AdmKnap>
		{/snippet}

		{#if besked}<div class="pr-besked">{besked}</div>{/if}
		{#if fejl}<div class="pr-fejl">{fejl}</div>{/if}

		<!-- Den her linje er ikke pynt. De to slags programmer ligner
		     hinanden, og at rette i det forkerte sted er dyrt at opdage. -->
		<p class="pr-note">
			Det her er de gamle programmer. Dem du bygger til den nye app ligger under Træning, og de to
			har ikke noget med hinanden at gøre.
		</p>

		{#if opretter}
			<AdmKort>
				<div class="pr-raek">
					<label class="pr-felt">
						<span>Navn</span>
						<input type="text" bind:value={nyNavn} disabled={gemmer} />
					</label>
					<label class="pr-felt">
						<span>Id, kan ikke ændres senere</span>
						<input type="text" placeholder="fx kickstart_ben" bind:value={nyId} disabled={gemmer} />
					</label>
				</div>

				<label class="pr-felt bred">
					<span>Beskrivelse</span>
					<input type="text" bind:value={nyBeskrivelse} disabled={gemmer} />
				</label>

				<div class="pr-raek">
					<label class="pr-felt">
						<span>Antal dage</span>
						<input type="number" min="1" max="120" bind:value={nyAntalDage} disabled={gemmer} />
					</label>
					<label class="pr-felt">
						<span>Niveau</span>
						<select bind:value={nyNiveau} disabled={gemmer}>
							{#each NIVEAUER as n (n.id)}
								<option value={n.id}>{n.label}</option>
							{/each}
						</select>
					</label>
				</div>

				<div class="pr-felt bred">
					<span>Udstyr</span>
					<div class="pr-chips">
						{#each UDSTYR as u (u.id)}
							<button
								type="button"
								class="pr-chip"
								class:paa={nyUdstyr.includes(u.id)}
								disabled={gemmer}
								onclick={() => toggleUdstyr(u.id)}
							>
								{u.label}
							</button>
						{/each}
					</div>
				</div>

				{#if opretFejl}<div class="pr-fejl">{opretFejl}</div>{/if}

				<div class="pr-knapper">
					<AdmKnap slags="primaer" disabled={gemmer} onclick={opret}>
						{gemmer ? 'Opretter…' : 'Opret programmet'}
					</AdmKnap>
					<AdmKnap disabled={gemmer} onclick={() => (opretter = false)}>Annuller</AdmKnap>
				</div>
				<p class="pr-hint">
					Dagene bliver oprettet tomme med det samme, så programmet ikke ligger halvt færdigt.
				</p>
			</AdmKort>
		{/if}

		{#if henter}
			<AdmTom tekst="Henter programmerne…" />
		{:else if fejl && programmer.length === 0}
			<AdmTom tekst={fejl} fejl>
				{#snippet handling()}
					<AdmKnap onclick={indlaes}>Prøv igen</AdmKnap>
				{/snippet}
			</AdmTom>
		{:else if programmer.length === 0}
			<AdmTom tekst="Der er ingen programmer endnu. Tryk Nyt program for at lave det første." />
		{:else}
			<p class="pr-antal">{programmer.length} programmer</p>
			{#each programmer as p (p.id)}
				<AdmKort>
					<div class="pr-hoved">
						<div>
							<span class="pr-navn">{p.navn}</span>
							<div class="pr-meta">
								{p.antalDage} dage · {NIVEAUER.find((n) => n.id === p.niveau)?.label ?? p.niveau}
								{#if udstyrTekst(p)}· {udstyrTekst(p)}{/if}
							</div>
							<div class="pr-id">{p.id}</div>
						</div>
						{#if p.aktiv === false}
							<AdmMaerkat farve="stille">Ikke aktiv</AdmMaerkat>
						{/if}
					</div>

					{#if p.beskrivelse}<p class="pr-besk">{p.beskrivelse}</p>{/if}

					<div class="pr-knapper">
						<AdmKnap
							slags="primaer"
							onclick={() => (window.location.href = `/app/admin/programmer/${p.id}`)}
						>
							Ret dagene
						</AdmKnap>
						{#if sletId === p.id}
							<span class="pr-advarsel">Programmet og alle dets dage slettes permanent.</span>
							<AdmKnap slags="fare" disabled={sletter} onclick={() => slet(p.id)}>
								{sletter ? 'Sletter…' : 'Ja, slet'}
							</AdmKnap>
							<AdmKnap onclick={() => (sletId = '')}>Fortryd</AdmKnap>
						{:else}
							<AdmKnap slags="fare" onclick={() => (sletId = p.id)}>Slet</AdmKnap>
						{/if}
					</div>
				</AdmKort>
			{/each}
		{/if}
	</AdmSide>
{/if}

<style>
	.pr-kun {
		padding: 24px 18px;
		color: var(--ink-2);
		font-size: calc(14px * var(--fs-scale, 1));
	}

	.pr-besked,
	.pr-fejl {
		margin-bottom: 12px;
		padding: 11px 15px;
		border-radius: 12px;
		font-size: calc(13.5px * var(--fs-scale, 1));
		font-weight: 600;
	}

	.pr-besked {
		background: var(--sage-tint, #e7efe5);
		color: var(--sage-tekst, #46603f);
	}

	.pr-fejl {
		background: var(--ler-tint, #f4e6de);
		color: var(--ler-tekst, #8a5439);
	}

	.pr-note {
		margin: 0 0 14px;
		padding: 11px 14px;
		background: var(--honey-tint, #f7ecd7);
		border-radius: 12px;
		font-size: calc(12.5px * var(--fs-scale, 1));
		color: var(--honey-deep, #b47f3e);
		line-height: 1.45;
	}

	.pr-raek {
		display: flex;
		gap: 10px;
		flex-wrap: wrap;
	}

	.pr-felt {
		display: flex;
		flex-direction: column;
		gap: 4px;
		flex: 1 1 160px;
		margin-bottom: 11px;
	}

	.pr-felt.bred {
		flex-basis: 100%;
	}

	.pr-felt span {
		font-size: calc(10.5px * var(--fs-scale, 1));
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--ink-3, #a3948a);
	}

	.pr-felt input,
	.pr-felt select {
		padding: 11px 13px;
		background: var(--paper, #fbf8f2);
		border: 1px solid var(--line, #e8dfd1);
		border-radius: 11px;
		color: var(--espresso, #382c2a);
		font-size: calc(14px * var(--fs-scale, 1));
		font-family: inherit;
		box-sizing: border-box;
	}

	.pr-chips {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}

	/* Baggrunden staar eksplicit, se noten i AdmKnap. */
	.pr-chip {
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

	.pr-chip.paa {
		background: var(--plum, #7c4f63);
		border-color: var(--plum, #7c4f63);
		color: #fff;
	}

	.pr-knapper {
		display: flex;
		align-items: center;
		gap: 8px;
		flex-wrap: wrap;
	}

	.pr-hint {
		margin: 10px 0 0;
		font-size: calc(11.5px * var(--fs-scale, 1));
		color: var(--ink-3, #a3948a);
	}

	.pr-antal {
		margin: 0 0 10px;
		font-size: calc(12px * var(--fs-scale, 1));
		color: var(--ink-3, #a3948a);
	}

	.pr-hoved {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 10px;
		margin-bottom: 8px;
	}

	.pr-navn {
		font-size: calc(15px * var(--fs-scale, 1));
		font-weight: 600;
	}

	.pr-meta {
		margin-top: 2px;
		font-size: calc(12px * var(--fs-scale, 1));
		color: var(--ink-2, #6f5f57);
	}

	.pr-id {
		margin-top: 2px;
		font-size: calc(11px * var(--fs-scale, 1));
		color: var(--ink-3, #a3948a);
	}

	.pr-besk {
		margin: 0 0 10px;
		font-size: calc(13.5px * var(--fs-scale, 1));
		line-height: 1.5;
	}

	.pr-advarsel {
		font-size: calc(11.5px * var(--fs-scale, 1));
		color: var(--ler-tekst, #8a5439);
		font-weight: 600;
	}
</style>
