<script lang="ts">
	// ============================================================
	// Daglige lektioner til abonnenter, i det nye design.
	//
	// Sjette af de 19 gamle admin-sider, 1. september 2026.
	//
	// LOGIKKEN ER FLYTTET, IKKE SKREVET OM. Samme fire funktioner som den
	// gamle side kalder, og datoen er stadig dokumentets id, saa der er
	// ÉN lektion pr dag og ikke to.
	//
	// Den gamle side paa /app/admin/modulbruger-lektioner er uroert.
	// ============================================================

	import { getContext, onMount } from 'svelte';
	import type { User } from 'firebase/auth';
	import { isAdmin } from '$lib/admin';
	import {
		hentAlleModulbrugerLektioner,
		hentModulbrugerLektion,
		gemModulbrugerLektion,
		sletModulbrugerLektion
	} from '$lib/firestore/modulbrugerLektioner';
	import { tomLektion, type ModulbrugerLektion } from '$lib/content/modulbrugerLektioner';
	import AdmSide from '$lib/components/admin/AdmSide.svelte';
	import AdmKort from '$lib/components/admin/AdmKort.svelte';
	import AdmKnap from '$lib/components/admin/AdmKnap.svelte';
	import AdmMaerkat from '$lib/components/admin/AdmMaerkat.svelte';
	import AdmTom from '$lib/components/admin/AdmTom.svelte';

	const hentUser = getContext<() => User | null>('user');
	const maaVaereHer = $derived(isAdmin(hentUser()));

	let lektioner = $state<ModulbrugerLektion[]>([]);
	let henter = $state(true);
	let fejl = $state('');
	let besked = $state('');

	let redigerer = $state<ModulbrugerLektion | null>(null);
	let opretter = $state(false);
	let nyDato = $state(idag());
	let gemmer = $state(false);
	let sletDato = $state('');
	let sletter = $state('');

	function idag(): string {
		const d = new Date();
		return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
	}

	function visDato(dato: string): string {
		const [a, m, d] = dato.split('-').map(Number);
		return new Date(a, m - 1, d).toLocaleDateString('da-DK', {
			weekday: 'long',
			day: 'numeric',
			month: 'long'
		});
	}

	function erFremtid(dato: string): boolean {
		return dato > idag();
	}

	onMount(() => void indlaes());

	async function indlaes() {
		henter = true;
		fejl = '';
		try {
			lektioner = await hentAlleModulbrugerLektioner();
		} catch (e) {
			console.error('[admin] modulbruger-lektioner', e);
			fejl = 'Kunne ikke hente lektionerne.';
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

	async function aabnRediger(dato: string) {
		try {
			const eks = await hentModulbrugerLektion(dato);
			redigerer = eks ?? tomLektion(dato);
			opretter = false;
		} catch (e) {
			console.error('[admin] hent lektion', e);
			fejl = 'Kunne ikke hente lektionen.';
		}
	}

	function fortsaetOpret() {
		// Findes der allerede en lektion paa dagen, aabnes DEN i stedet for
		// at der laves en ny. Datoen er dokumentets id, saa to lektioner paa
		// samme dag ville betyde at den ene skrev den anden over.
		redigerer = lektioner.find((l) => l.dato === nyDato) ?? tomLektion(nyDato);
		opretter = false;
	}

	async function gem() {
		if (!redigerer) return;
		if (!redigerer.titel.trim()) {
			fejl = 'Lektionen skal have en titel.';
			return;
		}
		gemmer = true;
		fejl = '';
		try {
			await gemModulbrugerLektion(redigerer);
			redigerer = null;
			await indlaes();
			sigTil('Lektionen er gemt');
		} catch (e) {
			console.error('[admin] gem lektion', e);
			fejl = 'Kunne ikke gemme lektionen.';
		} finally {
			gemmer = false;
		}
	}

	async function slet(dato: string) {
		sletter = dato;
		try {
			await sletModulbrugerLektion(dato);
			if (redigerer?.dato === dato) redigerer = null;
			sletDato = '';
			await indlaes();
			sigTil('Lektionen er slettet');
		} catch (e) {
			console.error('[admin] slet lektion', e);
			fejl = 'Kunne ikke slette lektionen.';
		} finally {
			sletter = '';
		}
	}
</script>

<svelte:head><title>Lektioner til abonnenter · Admin</title></svelte:head>

{#if !maaVaereHer}
	<p class="ml-kun">Siden er kun for admin.</p>
{:else}
	<AdmSide
		titel="Lektioner til abonnenter"
		under="Én lektion pr dag. Den vises på forsiden hos kunder der har appen uden at være på et forløb."
	>
		{#snippet handling()}
			<AdmKnap
				slags="primaer"
				onclick={() => {
					nyDato = idag();
					opretter = true;
					redigerer = null;
				}}>Ny lektion</AdmKnap
			>
		{/snippet}

		{#if besked}<div class="ml-besked">{besked}</div>{/if}
		{#if fejl}<div class="ml-fejl">{fejl}</div>{/if}

		{#if opretter}
			<AdmKort>
				<label class="ml-felt">
					<span>Hvilken dag</span>
					<input type="date" bind:value={nyDato} />
				</label>
				<p class="ml-hint">
					Er der allerede en lektion på dagen, åbner du den i stedet for at lave en ny. Der kan kun
					være én pr dag.
				</p>
				<div class="ml-knapper">
					<AdmKnap slags="primaer" onclick={fortsaetOpret}>Fortsæt</AdmKnap>
					<AdmKnap onclick={() => (opretter = false)}>Annuller</AdmKnap>
				</div>
			</AdmKort>
		{/if}

		{#if redigerer}
			<AdmKort>
				<h2 class="ml-h">{visDato(redigerer.dato)}</h2>

				<label class="ml-felt">
					<span>Titel</span>
					<input type="text" bind:value={redigerer.titel} disabled={gemmer} />
				</label>

				<label class="ml-felt">
					<span>Kort beskrivelse</span>
					<input type="text" bind:value={redigerer.beskrivelse} disabled={gemmer} />
				</label>

				<div class="ml-raek">
					<label class="ml-felt">
						<span>Slags</span>
						<input
							type="text"
							placeholder="Video, Lyd, Læsestof…"
							bind:value={redigerer.format}
							disabled={gemmer}
						/>
					</label>
					<label class="ml-felt">
						<span>Varighed i minutter</span>
						<input type="number" min="0" bind:value={redigerer.varighedMin} disabled={gemmer} />
					</label>
				</div>

				<label class="ml-felt">
					<span>Link</span>
					<input type="url" placeholder="https://…" bind:value={redigerer.url} disabled={gemmer} />
				</label>

				<label class="ml-felt">
					<span>Tekst</span>
					<textarea rows="7" bind:value={redigerer.indhold} disabled={gemmer}></textarea>
				</label>

				<div class="ml-knapper">
					<AdmKnap slags="primaer" disabled={gemmer} onclick={gem}>
						{gemmer ? 'Gemmer…' : 'Gem lektionen'}
					</AdmKnap>
					<AdmKnap disabled={gemmer} onclick={() => (redigerer = null)}>Annuller</AdmKnap>
				</div>
			</AdmKort>
		{/if}

		{#if henter}
			<AdmTom tekst="Henter lektionerne…" />
		{:else if lektioner.length === 0}
			<AdmTom tekst="Der er ingen lektioner endnu. Tryk Ny lektion for at lave den første." />
		{:else}
			<p class="ml-antal">{lektioner.length} lektioner</p>
			<div class="ml-liste">
				{#each lektioner as l (l.dato)}
					<div class="ml-raekke">
						<div class="ml-r-tekst">
							<div class="ml-r-top">
								<span class="ml-navn">{l.titel}</span>
								{#if erFremtid(l.dato)}<AdmMaerkat farve="ro">Kommer</AdmMaerkat>{/if}
							</div>
							<div class="ml-meta">
								{visDato(l.dato)}
								{#if l.format}· {l.format}{/if}
								{#if l.varighedMin}· {l.varighedMin} min{/if}
							</div>
						</div>
						<div class="ml-knapper">
							<AdmKnap onclick={() => aabnRediger(l.dato)}>Ret</AdmKnap>
							{#if sletDato === l.dato}
								<AdmKnap slags="fare" disabled={sletter === l.dato} onclick={() => slet(l.dato)}>
									{sletter === l.dato ? 'Sletter…' : 'Ja, slet'}
								</AdmKnap>
								<AdmKnap onclick={() => (sletDato = '')}>Fortryd</AdmKnap>
							{:else}
								<AdmKnap slags="fare" onclick={() => (sletDato = l.dato)}>Slet</AdmKnap>
							{/if}
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</AdmSide>
{/if}

<style>
	.ml-kun {
		padding: 24px 18px;
		color: var(--ink-2);
		font-size: calc(14px * var(--fs-scale, 1) * var(--adm-skala, 1));
	}

	.ml-besked,
	.ml-fejl {
		margin-bottom: 12px;
		padding: 11px 15px;
		border-radius: 12px;
		font-size: calc(13.5px * var(--fs-scale, 1) * var(--adm-skala, 1));
		font-weight: 600;
	}

	.ml-besked {
		background: var(--sage-tint, #e7efe5);
		color: var(--sage-tekst, #46603f);
	}

	.ml-fejl {
		background: var(--ler-tint, #f4e6de);
		color: var(--ler-tekst, #8a5439);
	}

	.ml-h {
		margin: 0 0 12px;
		font-size: calc(16px * var(--fs-scale, 1) * var(--adm-skala, 1));
		font-weight: 600;
	}

	.ml-felt {
		display: flex;
		flex-direction: column;
		gap: 4px;
		flex: 1 1 160px;
		margin-bottom: 11px;
	}

	.ml-felt span {
		font-size: calc(10.5px * var(--fs-scale, 1) * var(--adm-skala, 1));
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--ink-3, #a3948a);
	}

	.ml-felt input,
	.ml-felt textarea {
		padding: 11px 13px;
		background: var(--paper, #fbf8f2);
		border: 1px solid var(--line, #e8dfd1);
		border-radius: 11px;
		color: var(--espresso, #382c2a);
		font-size: calc(14px * var(--fs-scale, 1) * var(--adm-skala, 1));
		font-family: inherit;
		line-height: 1.5;
		box-sizing: border-box;
		resize: vertical;
	}

	.ml-raek {
		display: flex;
		gap: 10px;
		flex-wrap: wrap;
	}

	.ml-hint {
		margin: 0 0 11px;
		font-size: calc(11.5px * var(--fs-scale, 1) * var(--adm-skala, 1));
		color: var(--ink-3, #a3948a);
		line-height: 1.45;
	}

	.ml-knapper {
		display: flex;
		gap: 8px;
		flex-wrap: wrap;
	}

	.ml-antal {
		margin: 16px 0 10px;
		font-size: calc(12px * var(--fs-scale, 1) * var(--adm-skala, 1));
		color: var(--ink-3, #a3948a);
	}

	/* FLERE SOEJLER NAAR DER ER PLADS. Én lang stribe paa en bred skaerm
	   betoed, at man saa faa ad gangen og resten var tom plads til
	   hoejre. Paa en smal skaerm bliver det én soejle igen af sig selv. */
	.ml-liste {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(420px, 1fr));
		gap: 6px;
		align-content: start;
	}

	.ml-raekke {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		flex-wrap: wrap;
		padding: 13px 16px;
		background: var(--paper-2, #f6f0e7);
		border-radius: 13px;
	}

	.ml-r-tekst {
		min-width: 0;
		flex: 1 1 220px;
	}

	.ml-r-top {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.ml-navn {
		font-size: calc(14px * var(--fs-scale, 1) * var(--adm-skala, 1));
		font-weight: 600;
	}

	.ml-meta {
		margin-top: 2px;
		font-size: calc(11.5px * var(--fs-scale, 1) * var(--adm-skala, 1));
		color: var(--ink-3, #a3948a);
	}
</style>
