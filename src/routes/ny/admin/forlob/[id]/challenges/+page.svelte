<script lang="ts">
	// ============================================================
	// challenges, i det nye design.
	//
	// En af de otte undersider under ét forloeb, 1. september 2026.
	//
	// HELE SIDEN ER KOPIERET ORDRET, baade script, markup og stil, saa
	// intet indhold kunne gaa tabt. Udseendet skifter via farvebroen
	// nederst i stilen. Samme greb som paa Dashboard.
	//
	// Alle interne veje peger nu paa den nye admin, saa man ikke falder
	// tilbage i det gamle udseende midt i et forloeb.
	//
	// Den gamle side er uroert.
	// ============================================================

	import { getContext, onMount } from 'svelte';
	import type { User } from 'firebase/auth';
	import { isAdmin } from '$lib/admin';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { Timestamp } from 'firebase/firestore';
	import type { Challenge } from '$lib/content/challenge';
	import { gemChallenge, hentChallenges } from '$lib/firestore/challenge';
	import { hentForlob } from '$lib/firestore/forlob';
	import type { Forlob } from '$lib/content/forlobAdgang';
	import Icon from '$lib/components/Icon.svelte';

	const hentAdminUser = getContext<() => User | null>('user');
	const maaVaereHer = $derived(isAdmin(hentAdminUser()));

	const forlobId = $derived(page.params.id ?? '');

	let forlob = $state<Forlob | null>(null);
	let challenges = $state<Challenge[]>([]);
	let loading = $state(true);
	let fejl = $state<string | null>(null);
	let opretter = $state(false);

	onMount(async () => {
		try {
			const [f, liste] = await Promise.all([hentForlob(forlobId), hentChallenges(forlobId)]);
			forlob = f;
			challenges = liste;
		} catch (e) {
			console.error(e);
			fejl = 'Kunne ikke hente challenges.';
		} finally {
			loading = false;
		}
	});

	function formatDato(t: Timestamp | undefined): string {
		if (!t) return '—';
		const d = t.toDate();
		return `${d.getDate()}. ${d.toLocaleString('da-DK', { month: 'short' })} ${d.getFullYear()}`;
	}

	function status(c: Challenge): { tekst: string; klasse: string } {
		const nu = Date.now();
		const startMs = c.startDato?.toMillis?.() ?? 0;
		const slutMs = c.slutDato?.toMillis?.() ?? 0;
		const slutMidnat = slutMs + (24 * 60 * 60 * 1000 - 1);
		if (!c.aktiv) return { tekst: 'Inaktiv', klasse: 'inaktiv' };
		if (nu < startMs) return { tekst: 'Kommende', klasse: 'kommende' };
		if (nu > slutMidnat) return { tekst: 'Afsluttet', klasse: 'afsluttet' };
		return { tekst: 'Kører nu', klasse: 'koerer' };
	}

	async function opretNy() {
		if (opretter) return;
		opretter = true;
		try {
			const id = `challenge_${Date.now().toString(36)}`;
			const idag = new Date();
			idag.setHours(0, 0, 0, 0);
			const omEnUge = new Date(idag);
			omEnUge.setDate(omEnUge.getDate() + 6);
			await gemChallenge({
				id,
				forlobId,
				navn: 'Planter til tarmmikrobiom',
				beskrivelse:
					'Spis så mange forskellige planter som muligt — frugt, grønt, bælgfrugter, nødder, frø og korn tæller alle med.',
				startDato: Timestamp.fromDate(idag),
				slutDato: Timestamp.fromDate(omEnUge),
				aktiv: false,
				fravalgteBrugere: []
			});
			goto(`/ny/admin/forlob/${forlobId}/challenges/${id}`);
		} catch (e) {
			console.error(e);
			fejl = 'Kunne ikke oprette challenge.';
			opretter = false;
		}
	}
</script>

{#if !maaVaereHer}
	<p class="fu-kun">Siden er kun for admin.</p>
{:else}
	<div class="page">
		<header class="page-header">
			<a class="back" href="/ny/admin/forlob/{forlobId}">
				<Icon name="arrow-l" size={14} color="var(--text2)" />
				<span>{forlob?.navn ?? 'Forløb'}</span>
			</a>
			<div class="eyebrow">Admin · {forlob?.navn ?? forlobId} · Challenges</div>
			<h1>Challenges</h1>
			<p class="page-sub">
				Tidsbegrænsede konkurrencer der vises på forsiden for klienterne i den valgte periode.
			</p>
		</header>

		<button class="opret-knap" type="button" onclick={opretNy} disabled={opretter}>
			{opretter ? 'Opretter...' : '+ Opret ny challenge'}
		</button>

		{#if loading}
			<div class="status-besked">Henter...</div>
		{:else if fejl}
			<div class="status-besked fejl">{fejl}</div>
		{:else if challenges.length === 0}
			<div class="status-besked">Ingen challenges endnu — opret den første ovenfor.</div>
		{:else}
			<div class="liste">
				{#each challenges as c (c.id)}
					{@const s = status(c)}
					<a class="row" href="/ny/admin/forlob/{forlobId}/challenges/{c.id}">
						<div class="row-ikon"><Icon name="leaf" size={18} color="var(--sage)" /></div>
						<div class="tekst">
							<div class="navn">
								{c.navn}
								<span class="status-pille {s.klasse}">{s.tekst}</span>
							</div>
							<div class="sub">
								{formatDato(c.startDato)} – {formatDato(c.slutDato)}
							</div>
						</div>
						<Icon name="chevron-r" size={14} color="var(--text3)" />
					</a>
				{/each}
			</div>
		{/if}
	</div>
{/if}

<style>
	.page {
		padding: 18px 18px 100px;
		max-width: 520px;
		margin: 0 auto;
	}

	.page-header {
		margin-bottom: 14px;
	}

	.back {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-size: calc(12px * var(--fs-scale, 1) * var(--adm-skala, 1));
		color: var(--text2);
		text-decoration: none;
		margin-bottom: 12px;
	}

	.eyebrow {
		font-size: calc(10px * var(--fs-scale, 1) * var(--adm-skala, 1));
		font-weight: 600;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--text3);
	}

	h1 {
		font-family: var(--ff-d);
		font-size: calc(28px * var(--fs-scale, 1) * var(--adm-skala, 1));
		font-weight: 600;
		letter-spacing: -0.02em;
		margin: 4px 0 0;
		color: var(--text);
	}

	.page-sub {
		font-size: calc(13px * var(--fs-scale, 1) * var(--adm-skala, 1));
		color: var(--text2);
		margin: 6px 0 0;
		line-height: 1.4;
	}

	.opret-knap {
		display: block;
		width: 100%;
		padding: 13px;
		background: var(--terra);
		color: #fff;
		font-size: calc(14px * var(--fs-scale, 1) * var(--adm-skala, 1));
		font-weight: 600;
		border-radius: 12px;
		border: none;
		cursor: pointer;
		font-family: var(--ff-b);
		margin-bottom: 14px;
		touch-action: manipulation;
	}

	.opret-knap:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.status-besked {
		padding: 14px;
		text-align: center;
		color: var(--text2);
		font-size: calc(13px * var(--fs-scale, 1) * var(--adm-skala, 1));
	}

	.status-besked.fejl {
		color: var(--terra);
	}

	/* FLERE SOEJLER NAAR DER ER PLADS. Én lang stribe paa en bred skaerm
	   betoed, at man saa faa ad gangen og resten var tom plads til
	   hoejre. Paa en smal skaerm bliver det én soejle igen af sig selv. */
	.liste {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(420px, 1fr));
		gap: 8px;
		align-content: start;
	}

	.row {
		display: grid;
		grid-template-columns: 36px 1fr auto;
		align-items: center;
		gap: 12px;
		padding: 12px 14px;
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 12px;
		text-decoration: none;
		color: var(--text);
	}

	.row-ikon {
		width: 36px;
		height: 36px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--sdim);
		border-radius: 10px;
	}

	.navn {
		font-weight: 600;
		font-size: calc(14px * var(--fs-scale, 1) * var(--adm-skala, 1));
		display: flex;
		align-items: center;
		gap: 8px;
		flex-wrap: wrap;
	}

	.sub {
		font-size: calc(11.5px * var(--fs-scale, 1) * var(--adm-skala, 1));
		color: var(--text3);
		margin-top: 2px;
	}

	.status-pille {
		font-size: calc(10px * var(--fs-scale, 1) * var(--adm-skala, 1));
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		padding: 3px 7px;
		border-radius: 99px;
	}

	.status-pille.koerer {
		background: var(--sdim);
		color: var(--sage);
	}

	.status-pille.kommende {
		background: var(--tdim);
		color: var(--terra);
	}

	.status-pille.afsluttet {
		background: var(--bg2);
		color: var(--text3);
	}

	.status-pille.inaktiv {
		background: var(--bg2);
		color: var(--text3);
		font-style: italic;
	}

	/* ============================================================
	   FARVEBRO. Siden er kopieret ORDRET fra den gamle admin, markup og
	   stil, saa intet indhold kunne gaa tabt i flytningen. De gamle
	   farve-navne peger i stedet paa de nye vaerdier, og saa foelger hele
	   siden det nye design uden at en linje markup er roert.
	   Samme greb som paa Dashboard. Se samtalen 1. september 2026.
	   ============================================================ */
	.page {
		--bg: #fbf8f2;
		--white: #f6f0e7;
		--bg2: #f1eadf;
		--header: #f6f0e7;
		--border: #e8dfd1;
		--border2: #e8dfd1;
		--text: #382c2a;
		--text2: #6f5f57;
		--text3: #a3948a;
		--text4: #a3948a;
		--terra: #7c4f63;
		--terra2: #7c4f63;
		--tdim: #f1e5e8;
		--tdim2: #f1e5e8;
		--sage: #86a188;
		--sdim: #e7efe5;
		--gold: #d6a15e;
		--gdim: #f7ecd7;
		background: var(--bg);
	}

	.fu-kun {
		padding: 24px 18px;
		color: #6f5f57;
		font-size: calc(14px * var(--fs-scale, 1) * var(--adm-skala, 1));
	}
</style>
