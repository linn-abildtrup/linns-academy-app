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
	import { hentAlleOpskrifter } from '$lib/firestore/opskrifter';
	import { hentAlleForlob } from '$lib/firestore/forlob';
	import { hentTildelinger3 } from '$lib/firestore/traeningTildeling3';
	import { hentKoblinger } from '$lib/firestore/ingrediensKobling3';
	import { byggOversigt } from '$lib/content/ingrediensOversigt3';
	import { normaliserKategorier } from '$lib/content/opskrifter';

	const hentUser = getContext<() => User | null>('user');
	const maaVaereHer = $derived(isAdmin(hentUser()));

	// Skinnen paa de GAMLE admin-sider peger herind med ?omraade=, saa et
	// tryk paa Mad lander samme sted uanset hvilken app du kom fra.
	const fraUrl = page.url.searchParams.get('omraade');
	let omraade = $state<Omraade>(
		fraUrl && fraUrl in OMRAADE_NAVN ? (fraUrl as Omraade) : 'forside'
	);
	let soeg = $state('');

	// null betyder "hentes stadig". Se noten paa StatusTal: nul er en helt
	// anden besked end at vi ikke ved det endnu.
	let tal = $state<StatusInput>({
		ubesvarede: null,
		holdUdenTraening: null,
		ingredienserUdenKobling: null,
		opskrifterIkkeGodkendt: null,
		aeldsteSpoergsmaalDage: null,
		holdNavn: null,
		opskrifterIAlt: null
	});

	const nu = new Date();
	const DAG = 86400000;

	onMount(() => {
		// Fire uafhaengige hentninger. Hver fejler for sig, saa ét tal der
		// ikke kan hentes ikke tager de tre andre med sig.
		void (async () => {
			try {
				const alle = await hentAlleSpoergsmaal();
				const aabne = alle.filter((s) => !s.svar);
				const aeldste = aabne.reduce((m, s) => {
					const ms = s.oprettet?.toMillis?.() ?? 0;
					return ms > 0 && (m === 0 || ms < m) ? ms : m;
				}, 0);
				tal = {
					...tal,
					ubesvarede: aabne.length,
					aeldsteSpoergsmaalDage: aeldste ? Math.floor((Date.now() - aeldste) / DAG) : null
				};
			} catch (e) {
				console.error('[admin] spørgsmål', e);
			}
		})();

		void (async () => {
			try {
				const o = await hentAlleOpskrifter(false);
				tal = {
					...tal,
					opskrifterIkkeGodkendt: o.filter((x) => !x.godkendt).length,
					opskrifterIAlt: o.length
				};
			} catch (e) {
				console.error('[admin] opskrifter', e);
			}
		})();

		void (async () => {
			try {
				const [forlob, tildelinger] = await Promise.all([hentAlleForlob(), hentTildelinger3()]);
				const nuMs = Date.now();
				// Kun de hold der KOERER lige nu. Et afsluttet hold uden
				// traening er ikke en opgave, det er historie.
				const aktive = forlob.filter((f) => {
					const start = f.startDato?.toMillis?.() ?? 0;
					const dage = Number(f.antalDage) || 0;
					if (!start || !dage) return false;
					return nuMs >= start && nuMs <= start + (dage + 1) * DAG;
				});
				// En tildeling til ALLE daekker ogsaa et hold, saa saa er der
				// ingen hold uden traening. Ellers er et hold daekket naar der
				// findes en tildeling til netop det hold. Bemaerk at 'byg-eget'
				// IKKE taeller: det er retten til at bygge sit eget program og
				// ikke et program hun kan tage i morgen.
				const rigtige = tildelinger.filter((t) => t.type === 'program');
				const alleHarEt = rigtige.some((t) => t.modtagerType === 'alle');
				const daekket = new Set(
					rigtige.filter((t) => t.modtagerType === 'hold').map((t) => t.modtagerId)
				);
				const uden = alleHarEt ? [] : aktive.filter((f) => !daekket.has(f.id));
				tal = {
					...tal,
					holdUdenTraening: uden.length,
					holdNavn: uden.length === 1 ? uden[0].navn : uden.length > 1 ? `${uden.length} hold` : null
				};
			} catch (e) {
				console.error('[admin] hold', e);
			}
		})();

		void (async () => {
			try {
				// Foedevarerne hentes IKKE her. En manglende kobling kan ses
				// uden dem, og de 2.268 raekker hoerer ikke hjemme paa en
				// forside der skal aabne hurtigt.
				const [opskrifter, kort] = await Promise.all([
					hentAlleOpskrifter(false),
					hentKoblinger()
				]);
				const enkel: Record<string, { foodId: string }> = {};
				for (const [k, v] of Object.entries(kort)) enkel[k] = { foodId: v.foodId };
				const raekker = byggOversigt(
					opskrifter.map((o) => ({
						id: o.id,
						titel: o.titel,
						kategorier: normaliserKategorier(o.kategorier),
						ingredienser: o.ingredienser
					})),
					enkel,
					new Map()
				);
				tal = {
					...tal,
					ingredienserUdenKobling: raekker.filter((r) => r.fejl === 'ingen kobling').length
				};
			} catch (e) {
				console.error('[admin] koblinger', e);
			}
		})();
	});

	const status = $derived(byggStatus(tal));
	const traeffer = $derived(soegVaerktoej(soeg));
	const soeger = $derived(soeg.trim().length > 0);
	const OMRAADER: Omraade[] = ['forside', 'kunder', 'forlob', 'mad', 'traening', 'beskeder', 'system'];

	function vis(t: number | null): string {
		return t === null ? '—' : String(t);
	}
</script>

<svelte:head><title>Admin · Linn's Academy</title></svelte:head>

{#if !maaVaereHer}
	<p class="af-tom">Siden er kun for admin.</p>
{:else}
	<div class="af">
		<!-- Skinnen. Paa telefon bliver den til en raekke der ruller. -->
		<nav class="af-skinne">
			<div class="af-logo"><i></i><b>Linn's Academy</b></div>
			{#each OMRAADER as o (o)}
				<button
					type="button"
					class="af-punkt"
					class:paa={omraade === o && !soeger}
					onclick={() => {
						omraade = o;
						soeg = '';
					}}
				>
					<span>{OMRAADE_NAVN[o]}</span>
					{#if o === 'kunder' && (tal.ubesvarede ?? 0) > 0}
						<span class="af-pip">{tal.ubesvarede}</span>
					{/if}
				</button>
			{/each}
		</nav>

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
						<a class="af-kort" class:vigtig={s.vigtig} class:ro={s.ro} href={s.rute}>
							<span class="tal">{vis(s.vaerdi)}</span>
							<span class="mrk">{s.mrk}</span>
							<span class="u">{s.under}</span>
						</a>
					{/each}
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
		font-size: calc(14px * var(--fs-scale, 1));
	}

	.af {
		display: grid;
		grid-template-columns: 216px 1fr;
		min-height: 100%;
	}

	/* ── skinnen ────────────────────────────────────────────── */
	.af-skinne {
		background: var(--paper-2);
		padding: 20px 12px 30px;
		border-right: 1px solid var(--line);
	}

	.af-logo {
		display: flex;
		align-items: center;
		gap: 9px;
		padding: 0 10px 16px;
	}

	.af-logo i {
		width: 9px;
		height: 9px;
		border-radius: 50%;
		background: var(--maerke);
	}

	.af-logo b {
		font-size: calc(15.5px * var(--fs-scale, 1));
		font-weight: 600;
	}

	/* Baggrunden staar eksplicit. Nulstillingen i .ny-app er vaegtloes, saa
	   en knap uden egen baggrund faar browserens graa. */
	.af-punkt {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		width: 100%;
		padding: 11px 12px;
		margin-bottom: 2px;
		background: none;
		border: none;
		border-radius: 12px;
		color: var(--espresso);
		font-size: calc(14.5px * var(--fs-scale, 1));
		font-family: inherit;
		text-align: left;
		cursor: pointer;
	}

	.af-punkt.paa {
		background: var(--plum);
		color: #fff;
		font-weight: 600;
	}

	.af-pip {
		min-width: 21px;
		padding: 1px 7px;
		border-radius: 99px;
		background: var(--plum);
		color: #fff;
		font-size: calc(11.5px * var(--fs-scale, 1));
		font-weight: 700;
		text-align: center;
	}

	.af-punkt.paa .af-pip {
		background: rgba(255, 255, 255, 0.26);
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
		font-size: calc(25px * var(--fs-scale, 1));
		font-weight: 600;
		letter-spacing: -0.02em;
	}

	.af-dato {
		margin: 3px 0 0;
		font-size: calc(13px * var(--fs-scale, 1));
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
		font-size: calc(14px * var(--fs-scale, 1));
		font-family: inherit;
		box-sizing: border-box;
	}

	/* ── status. Skaermen viser tilstanden ──────────────────── */
	.af-status {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 11px;
		margin-bottom: 8px;
	}

	.af-kort {
		display: block;
		padding: 16px 17px;
		background: var(--paper-2);
		border-radius: 16px;
		text-decoration: none;
		color: inherit;
	}

	/* KUN naar der venter noget. Er alt i orden, er intet fremhaevet, og
	   saa betyder fremhaevelsen noget naar den er der. */
	.af-kort.vigtig {
		background: var(--plum);
		color: #fff;
	}

	.af-kort.ro {
		background: var(--honey-tint);
	}

	.af-kort .tal {
		display: block;
		font-size: calc(32px * var(--fs-scale, 1));
		line-height: 1.05;
		letter-spacing: -0.02em;
	}

	.af-kort .mrk {
		display: block;
		margin-top: 6px;
		font-size: calc(12.5px * var(--fs-scale, 1));
		color: var(--ink-2);
	}

	.af-kort.vigtig .mrk {
		color: rgba(255, 255, 255, 0.87);
	}

	.af-kort.ro .mrk {
		color: var(--honey-deep);
	}

	.af-kort .u {
		display: block;
		margin-top: 2px;
		font-size: calc(11px * var(--fs-scale, 1));
		color: var(--ink-3);
	}

	.af-kort.vigtig .u {
		color: rgba(255, 255, 255, 0.62);
	}

	/* ── vaerktoejerne ──────────────────────────────────────── */
	.af-grp-h {
		margin: 24px 0 10px;
		font-size: calc(11.5px * var(--fs-scale, 1));
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
		font-size: calc(14.5px * var(--fs-scale, 1));
		font-weight: 600;
	}

	.af-flise .u {
		font-size: calc(12px * var(--fs-scale, 1));
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
		font-size: calc(10.5px * var(--fs-scale, 1));
		font-weight: 700;
	}

	.af-ingen,
	.af-fod {
		font-size: calc(12.5px * var(--fs-scale, 1));
		color: var(--ink-3);
		margin: 18px 0 0;
	}

	/* ── iPad paa hoejkant og telefon ───────────────────────── */
	@media (max-width: 900px) {
		.af {
			grid-template-columns: 1fr;
		}

		/* Skinnen bliver en raekke der ruller. Den bliver IKKE til en
		   bundmenu her: admin har syv omraader, og fem er graensen
		   forneden. Se 9.28 om de seks faner. */
		.af-skinne {
			display: flex;
			gap: 6px;
			overflow-x: auto;
			padding: 10px 14px;
			border-right: none;
			border-bottom: 1px solid var(--line);
		}

		.af-logo {
			display: none;
		}

		.af-punkt {
			width: auto;
			flex-shrink: 0;
			margin-bottom: 0;
			padding: 9px 15px;
			background: var(--paper);
			border-radius: 99px;
		}

		.af-hoved {
			padding: 18px 16px 34px;
		}

		.af-status {
			grid-template-columns: 1fr 1fr;
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
