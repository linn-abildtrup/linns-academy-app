<script lang="ts">
	// ============================================================
	// ÉN admin-forside for BEGGE apper.
	//
	// Linns beslutning 1. september 2026, tegnet i mockups-admin.html.
	// Foer den dag laa der to forsider, én pr app, og man skulle vide om et
	// vaerktoej hoerte til den gamle eller den nye app for at finde det.
	//
	// FORMEN ER TESLAS, FARVERNE ER LINNS. Hendes valg. Det vi tog med er
	// ikke det moerke, men maaden at taenke paa: skaermen viser
	// TILSTANDEN og ikke et katalog, der er naesten ingen streger, og kun
	// én ting er fremhaevet ad gangen.
	//
	// INGEN AF DE 34 SIDER ER ROERT. Forsiden peger paa dem.
	//
	// TALLENE HENTES EFTER at siden er tegnet, og hver for sig. Skallen og
	// menuen maa aldrig vente paa en optaelling: gaar en hentning galt,
	// staar det ene tal med en streg og resten af siden virker. Se fael­den
	// om at laegge noget nyt i en skal, 11. august.
	// ============================================================

	import { getContext, onMount } from 'svelte';
	import { page } from '$app/state';
	import type { User } from 'firebase/auth';
	import { isAdmin } from '$lib/admin';
	import {
		OMRAADE_NAVN,
		byggStatus,
		iOmraade,
		oftestBrugte,
		soegVaerktoej,
		hilsen,
		VAERKTOEJER,
		type Omraade,
		type StatusInput
	} from '$lib/content/adminForside3';
	import { hentAlleSpoergsmaal } from '$lib/firestore/spoergsmaal';

	const hentUser = getContext<() => User | null>('user');
	const maaVaereHer = $derived(isAdmin(hentUser()));

	// SKINNEN LIGGER I +layout.svelte, ikke her. Linns oenske 1. september:
	// menuen skal altid staa ude til hoejre, ogsaa paa undersiderne, og saa
	// skal den ligge ét sted.
	//
	// Omraadet kommer derfor fra ADRESSEN og ikke fra en knap paa siden.
	// $derived og ikke $state: skinnen navigerer, og et $state ville blive
	// staaende paa det foerste omraade resten af besoeget.
	const fraUrl = $derived(page.url.searchParams.get('omraade'));
	const omraade = $derived<Omraade>(
		fraUrl && fraUrl in OMRAADE_NAVN ? (fraUrl as Omraade) : 'forside'
	);
	let soeg = $state('');

	// null betyder "hentes stadig". Se noten paa StatusTal: nul er en helt
	// anden besked end at vi ikke ved det endnu.
	// null betyder "hentes stadig". Se noten paa StatusTal: nul er en helt
	// anden besked end at vi ikke ved det endnu.
	let tal = $state<StatusInput>({ ubesvarede: null, aeldsteSpoergsmaalDage: null });

	const nu = new Date();
	const DAG = 86400000;

	onMount(() => {
		// KUN ét tal hentes nu. De tre andre kort blev fjernet 3. september,
		// og med dem faldt tre hentninger vaek. Forsiden aabner hurtigere.
		void (async () => {
			try {
				const alle = await hentAlleSpoergsmaal();
				const aabne = alle.filter((s) => !s.svar);
				const aeldste = aabne.reduce((m, s) => {
					const ms = s.oprettet?.toMillis?.() ?? 0;
					return ms > 0 && (m === 0 || ms < m) ? ms : m;
				}, 0);
				tal = {
					ubesvarede: aabne.length,
					aeldsteSpoergsmaalDage: aeldste ? Math.floor((Date.now() - aeldste) / DAG) : null
				};
			} catch (e) {
				console.error('[admin] spørgsmål', e);
			}
		})();
	});

	const status = $derived(byggStatus(tal));
	const traeffer = $derived(soegVaerktoej(soeg));
	const soeger = $derived(soeg.trim().length > 0);

	function vis(t: number | null): string {
		return t === null ? '—' : String(t);
	}
</script>

<svelte:head><title>Admin · Linn's Academy</title></svelte:head>

{#if !maaVaereHer}
	<p class="af-tom">Siden er kun for admin.</p>
{:else}
	<div class="af">
		<main class="af-hoved">
			<div class="af-top">
				<div>
					<h1>{hilsen(nu.getHours())}</h1>
					<p class="af-dato">
						{nu.toLocaleDateString('da-DK', { weekday: 'long', day: 'numeric', month: 'long' })}
					</p>
				</div>
				<input
					class="af-soeg"
					type="search"
					placeholder="Søg efter et værktøj…"
					bind:value={soeg}
				/>
			</div>

			{#if soeger}
				<p class="af-grp-h">
					{traeffer.length}
					{traeffer.length === 1 ? 'værktøj' : 'værktøjer'} matcher
				</p>
				{#if traeffer.length === 0}
					<p class="af-ingen">Ingen værktøjer matcher. Prøv et ord fra det værktøjet gør.</p>
				{:else}
					<div class="af-gitter">
						{#each traeffer as v (v.rute)}
							<a class="af-flise" href={v.rute}>
								<span class="n">{v.navn}</span>
								<span class="u">{v.under}</span>
								<span class="o">{OMRAADE_NAVN[v.omraade]}</span>
							</a>
						{/each}
					</div>
				{/if}
			{:else if omraade === 'forside'}
				<div class="af-status">
					{#each status as s (s.id)}
						<a class="af-kort" class:vigtig={s.vigtig} href={s.rute}>
							<span class="tal">{vis(s.vaerdi)}</span>
							<span class="mrk">{s.mrk}</span>
							<span class="u">{s.under}</span>
						</a>
					{/each}

					<!-- PLADSEN TIL DAGENS OPGAVER. Linns oenske 3. september: her
					     skal alt det staa som hun skal naa i dag. Det er ikke
					     kodet endnu, og feltet baerer derfor klassen 'skitse', saa
					     der ikke er tvivl om hvad der virker. Se regel 7. -->
					<div class="af-opgaver skitse">
						<h2>Dagens opgaver</h2>
						<p>Her kommer det du skal nå i dag. Det er ikke bygget endnu.</p>
					</div>
				</div>

				<p class="af-grp-h">Det du bruger mest</p>
				<div class="af-gitter">
					{#each oftestBrugte() as v (v.rute)}
						<a class="af-flise" href={v.rute}>
							<span class="n">{v.navn}</span>
							<span class="u">{v.under}</span>
						</a>
					{/each}
				</div>

				<p class="af-fod">
					{VAERKTOEJER.length} værktøjer i alt. Vælg et område i menuen, eller søg foroven.
				</p>
			{:else}
				<p class="af-grp-h">
					{OMRAADE_NAVN[omraade]} · {iOmraade(omraade).length}
					{iOmraade(omraade).length === 1 ? 'værktøj' : 'værktøjer'}
				</p>
				<div class="af-gitter">
					{#each iOmraade(omraade) as v (v.rute)}
						<a class="af-flise" href={v.rute}>
							<span class="n">{v.navn}</span>
							<span class="u">{v.under}</span>
						</a>
					{/each}
				</div>
			{/if}
		</main>
	</div>
{/if}

<style>
	.af-tom {
		padding: 24px 18px;
		color: var(--ink-2);
		font-size: calc(14px * var(--fs-scale, 1) * var(--adm-skala, 1));
	}

	/* Skinnen ligger i +layout.svelte. Forsiden er kun indhold. */
	.af {
		min-height: 100%;
	}

	/* ── hovedfladen ────────────────────────────────────────── */
	.af-hoved {
		padding: 24px 26px 44px;
	}

	.af-top {
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		flex-wrap: wrap;
		gap: 14px;
		margin-bottom: 20px;
	}

	.af-top h1 {
		margin: 0;
		font-size: calc(25px * var(--fs-scale, 1) * var(--adm-skala, 1));
		font-weight: 600;
		letter-spacing: -0.02em;
	}

	.af-dato {
		margin: 3px 0 0;
		font-size: calc(13px * var(--fs-scale, 1) * var(--adm-skala, 1));
		color: var(--ink-3);
	}

	.af-soeg {
		flex: 1 1 220px;
		max-width: 320px;
		padding: 11px 17px;
		background: var(--paper-2);
		border: 1px solid var(--line);
		border-radius: 99px;
		color: var(--espresso);
		font-size: calc(14px * var(--fs-scale, 1) * var(--adm-skala, 1));
		font-family: inherit;
		box-sizing: border-box;
	}

	/* ── status. Skaermen viser tilstanden ──────────────────── */
	.af-status {
		display: grid;
		/* ÉT tal og plads til dagens opgaver ved siden af. */
		grid-template-columns: minmax(200px, 260px) 1fr;
		gap: 11px;
		margin-bottom: 8px;
		align-items: stretch;
	}

	.af-kort {
		display: block;
		padding: 16px 17px;
		background: var(--paper-2);
		border-radius: 16px;
		text-decoration: none;
		color: inherit;
	}

	/* FREMHAEVET MED KANT OG FARVE PAA TALLET, ikke med en fyldt ploomme
	   flade. Foer var kortet ploomme med hvid tekst, og undertitlen laa paa
	   62 procent hvid ovenpaa. Det var ikke til at laese, og Linn sagde det
	   3. september. Lys flade med moerk tekst er den hoejeste kontrast vi
	   har, og tallet alene baerer fremhaevelsen. */
	.af-kort.vigtig {
		background: var(--plum-tint);
		box-shadow: inset 3px 0 0 var(--plum);
	}

	.af-kort .tal {
		display: block;
		font-size: calc(32px * var(--fs-scale, 1) * var(--adm-skala, 1));
		line-height: 1.05;
		letter-spacing: -0.02em;
		color: var(--espresso);
	}

	.af-kort.vigtig .tal {
		color: var(--plum-deep);
	}

	.af-kort .mrk {
		display: block;
		margin-top: 6px;
		font-size: calc(12.5px * var(--fs-scale, 1) * var(--adm-skala, 1));
		color: var(--ink-2);
	}

	.af-kort .u {
		display: block;
		margin-top: 2px;
		font-size: calc(11px * var(--fs-scale, 1) * var(--adm-skala, 1));
		color: var(--ink-3);
	}

	.af-kort.vigtig .u {
		color: var(--plum-deep);
	}

	/* ── dagens opgaver. IKKE BYGGET ENDNU ───────────────────── */
	.af-opgaver {
		padding: 16px 17px;
		background: var(--paper-2);
		border-radius: 16px;
		border: 1px dashed var(--line);
	}

	.af-opgaver h2 {
		margin: 0;
		font-size: calc(14.5px * var(--fs-scale, 1) * var(--adm-skala, 1));
		font-weight: 600;
	}

	.af-opgaver p {
		margin: 5px 0 0;
		font-size: calc(12px * var(--fs-scale, 1) * var(--adm-skala, 1));
		color: var(--ink-3);
		line-height: 1.45;
	}

	/* ── vaerktoejerne ──────────────────────────────────────── */
	.af-grp-h {
		margin: 24px 0 10px;
		font-size: calc(11.5px * var(--fs-scale, 1) * var(--adm-skala, 1));
		font-weight: 700;
		letter-spacing: 0.13em;
		text-transform: uppercase;
		color: var(--ink-3);
	}

	.af-gitter {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 10px;
	}

	.af-flise {
		display: flex;
		flex-direction: column;
		gap: 3px;
		min-height: 78px;
		padding: 15px 16px;
		background: var(--paper-2);
		border-radius: 15px;
		text-decoration: none;
		color: inherit;
	}

	.af-flise .n {
		font-size: calc(14.5px * var(--fs-scale, 1) * var(--adm-skala, 1));
		font-weight: 600;
	}

	.af-flise .u {
		font-size: calc(12px * var(--fs-scale, 1) * var(--adm-skala, 1));
		color: var(--ink-3);
		line-height: 1.4;
	}

	.af-flise .o {
		align-self: flex-start;
		margin-top: auto;
		padding: 2px 9px;
		border-radius: 99px;
		background: var(--plum-tint);
		color: var(--plum-deep);
		font-size: calc(10.5px * var(--fs-scale, 1) * var(--adm-skala, 1));
		font-weight: 700;
	}

	.af-ingen,
	.af-fod {
		font-size: calc(12.5px * var(--fs-scale, 1) * var(--adm-skala, 1));
		color: var(--ink-3);
		margin: 18px 0 0;
	}

	/* ── iPad paa hoejkant og telefon ───────────────────────── */
	@media (max-width: 900px) {
		.af-hoved {
			padding: 18px 16px 34px;
		}

		.af-status {
			grid-template-columns: 1fr;
		}

		/* Rakker frem for fliser. Tre fliser ved siden af hinanden bliver
		   90 px brede paa en telefon, og saa kan hverken tekst eller
		   finger vaere der. */
		.af-gitter {
			grid-template-columns: 1fr;
		}

		.af-flise {
			min-height: 0;
		}
	}
</style>
