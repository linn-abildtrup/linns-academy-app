<script lang="ts">
	// ============================================================
	// facebook-gruppe, i det nye design.
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
	import { collection, getDocs } from 'firebase/firestore';
	import { db } from '$lib/firebase';
	import Icon from '$lib/components/Icon.svelte';
	import { hentForlob } from '$lib/firestore/forlob';
	import type { Forlob } from '$lib/content/forlobAdgang';

	const hentAdminUser = getContext<() => User | null>('user');
	const maaVaereHer = $derived(isAdmin(hentAdminUser()));

	type Deltager = {
		uid: string;
		email: string;
		firstName: string;
		lastName: string;
		kropsroFacebookGruppe: boolean | undefined;
	};

	const forlobId = $derived(page.params.id ?? '');

	let forlob = $state<Forlob | null>(null);
	let deltagere = $state<Deltager[]>([]);
	let loading = $state(true);
	let fejl = $state<string | null>(null);

	onMount(async () => {
		try {
			forlob = await hentForlob(forlobId);
			const usersSnap = await getDocs(collection(db, 'users'));
			deltagere = usersSnap.docs
				.filter((d) => {
					const data = d.data() as { forlobIds?: string[] };
					return (data.forlobIds ?? []).includes(forlobId);
				})
				.map((d) => {
					const data = d.data() as {
						email?: string;
						firstName?: string;
						lastName?: string;
						kropsroFacebookGruppe?: boolean;
					};
					return {
						uid: d.id,
						email: data.email ?? '',
						firstName: data.firstName ?? '',
						lastName: data.lastName ?? '',
						kropsroFacebookGruppe: data.kropsroFacebookGruppe
					};
				})
				.sort((a, b) => (a.firstName || a.email).localeCompare(b.firstName || b.email, 'da'));
		} catch (e) {
			console.error(e);
			fejl = 'Kunne ikke hente data.';
		} finally {
			loading = false;
		}
	});

	const erInde = $derived(deltagere.filter((d) => d.kropsroFacebookGruppe === true));
	const ikkeInde = $derived(deltagere.filter((d) => d.kropsroFacebookGruppe === false));
	const ikkeSpurgt = $derived(deltagere.filter((d) => d.kropsroFacebookGruppe === undefined));
</script>

{#if !maaVaereHer}
	<p class="fu-kun">Siden er kun for admin.</p>
{:else}
	<div class="page">
		<header class="page-header">
			<a class="back" href="/ny/admin/forlob/{forlobId}">
				<Icon name="arrow-l" size={14} color="var(--text2)" />
				<span>Forløb</span>
			</a>
			<h1>Facebook-gruppe-status</h1>
			<p class="page-sub">
				Overblik over deltagere på {forlob?.navn ?? 'forløbet'} der er kommet ind i forløbets Facebook-gruppe.
				Spørgsmålet stilles første gang kunden logger ind på dag 0 eller senere.
			</p>
		</header>

		{#if fejl}
			<div class="status-besked fejl">{fejl}</div>
		{:else if loading}
			<div class="status-besked">Henter…</div>
		{:else}
			<section class="card highlight">
				<div class="card-titel">Mangler at komme ind ({ikkeInde.length})</div>
				{#if ikkeInde.length === 0}
					<p class="hint">Ingen har sagt "ikke endnu" — alt godt herfra.</p>
				{:else}
					<p class="card-sub">
						Disse deltagere har sagt "ikke endnu". Du kan sende dem linket til Facebook-gruppen
						manuelt.
					</p>
					<div class="liste">
						{#each ikkeInde as d (d.uid)}
							{@const navn = `${d.firstName} ${d.lastName}`.trim()}
							<div class="rad">
								<div class="rad-tekst">
									<div class="rad-navn">{navn || '(uden navn)'}</div>
									<div class="rad-sub">
										<a href="mailto:{d.email}">{d.email}</a>
									</div>
								</div>
							</div>
						{/each}
					</div>
				{/if}
			</section>

			<section class="card sekundaer">
				<div class="card-titel sub">Status for hele forløbet</div>
				<div class="stat-grid">
					<div class="stat">
						<div class="stat-tal">{erInde.length}</div>
						<div class="stat-label">Er inde</div>
					</div>
					<div class="stat">
						<div class="stat-tal">{ikkeInde.length}</div>
						<div class="stat-label">Ikke endnu</div>
					</div>
					<div class="stat">
						<div class="stat-tal">{ikkeSpurgt.length}</div>
						<div class="stat-label">Endnu ikke spurgt</div>
					</div>
				</div>
				{#if erInde.length > 0}
					<details class="ikke-spurgt-detail">
						<summary>Vis deltagere der er inde i gruppen</summary>
						<div class="liste sekundaer-liste">
							{#each erInde as d (d.uid)}
								{@const navn = `${d.firstName} ${d.lastName}`.trim()}
								<div class="rad">
									<div class="rad-tekst">
										<div class="rad-navn">{navn || '(uden navn)'}</div>
										<div class="rad-sub">{d.email}</div>
									</div>
								</div>
							{/each}
						</div>
					</details>
				{/if}
				{#if ikkeSpurgt.length > 0}
					<details class="ikke-spurgt-detail">
						<summary>Vis deltagere der endnu ikke er spurgt</summary>
						<div class="liste sekundaer-liste">
							{#each ikkeSpurgt as d (d.uid)}
								{@const navn = `${d.firstName} ${d.lastName}`.trim()}
								<div class="rad">
									<div class="rad-tekst">
										<div class="rad-navn">{navn || '(uden navn)'}</div>
										<div class="rad-sub">{d.email}</div>
									</div>
								</div>
							{/each}
						</div>
					</details>
				{/if}
			</section>
		{/if}
	</div>
{/if}

<style>
	/* ============================================================
	   Bygget om 5. september 2026 efter de principper dag-editoren blev
	   proevet af paa.

	   BREDT. Admin bruges paa en iMac. 520 punkter efterlod tre
	   fjerdedele af skaermen tom.

	   SLANK TOP. Tilbage-link, titel og undertekst staar paa én linje.
	   Foer fyldte de fire linjer, og paa en bred, lav skaerm er hoejden
	   det knappe. Den lille graa "Admin · et-eller-andet" er vaek: den
	   sagde det samme som overskriften lige under, og menuen til venstre
	   viser i forvejen hvor man staar.
	   ============================================================ */
	.page {
		padding: 16px 18px 40px;
		max-width: 1240px;
		margin: 0 auto;
	}

	.page-header {
		display: flex;
		align-items: baseline;
		gap: 14px;
		flex-wrap: wrap;
		margin-bottom: 14px;
	}

	.back {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-size: calc(12px * var(--fs-scale, 1) * var(--adm-skala, 1));
		color: var(--text2);
		text-decoration: none;
		white-space: nowrap;
	}


	h1 {
		font-family: var(--ff-d);
		font-size: calc(21px * var(--fs-scale, 1) * var(--adm-skala, 1));
		font-weight: 600;
		letter-spacing: -0.02em;
		margin: 0;
		line-height: 1.05;
		color: var(--text);
	}

	.page-sub {
		font-size: calc(13px * var(--fs-scale, 1) * var(--adm-skala, 1));
		color: var(--text2);
		margin: 0;
		max-width: 70ch;
		line-height: 1.5;
	}

	.status-besked {
		padding: 14px 16px;
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 12px;
		color: var(--text2);
		font-size: calc(13px * var(--fs-scale, 1) * var(--adm-skala, 1));
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

	.card.highlight {
		border-color: var(--terra);
	}

	.card.sekundaer {
		background: var(--bg2);
	}

	.card-titel {
		font-size: calc(15px * var(--fs-scale, 1) * var(--adm-skala, 1));
		font-weight: 600;
		color: var(--text);
		margin-bottom: 12px;
	}

	.card-titel.sub {
		font-size: calc(13px * var(--fs-scale, 1) * var(--adm-skala, 1));
		color: var(--text2);
	}

	.card-sub {
		font-size: calc(12px * var(--fs-scale, 1) * var(--adm-skala, 1));
		color: var(--text3);
		margin: 0 0 12px;
		line-height: 1.4;
	}

	.hint {
		font-size: calc(12px * var(--fs-scale, 1) * var(--adm-skala, 1));
		color: var(--text3);
		margin: 0;
		line-height: 1.5;
	}

	.liste {
		border: 1px solid var(--border);
		border-radius: 10px;
		overflow: hidden;
	}

	.rad {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 12px 14px;
		border-top: 1px solid var(--border);
		background: var(--white);
	}

	.rad:first-child {
		border-top: none;
	}

	.rad-tekst {
		flex: 1;
		min-width: 0;
	}

	.rad-navn {
		font-size: calc(14px * var(--fs-scale, 1) * var(--adm-skala, 1));
		font-weight: 600;
		color: var(--text);
	}

	.rad-sub {
		font-size: calc(11.5px * var(--fs-scale, 1) * var(--adm-skala, 1));
		color: var(--text3);
		margin-top: 2px;
	}

	.rad-sub a {
		color: var(--terra);
		text-decoration: none;
	}

	.rad-sub a:hover {
		text-decoration: underline;
	}

	.stat-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 10px;
	}

	.stat {
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 10px;
		padding: 12px 8px;
		text-align: center;
	}

	.stat-tal {
		font-family: var(--ff-d);
		font-size: calc(24px * var(--fs-scale, 1) * var(--adm-skala, 1));
		font-weight: 600;
		color: var(--text);
		line-height: 1;
	}

	.stat-label {
		font-size: calc(10.5px * var(--fs-scale, 1) * var(--adm-skala, 1));
		color: var(--text3);
		margin-top: 4px;
		letter-spacing: 0.04em;
	}

	.ikke-spurgt-detail {
		margin-top: 14px;
	}

	.ikke-spurgt-detail summary {
		cursor: pointer;
		font-size: calc(12px * var(--fs-scale, 1) * var(--adm-skala, 1));
		color: var(--terra);
		font-weight: 500;
		padding: 4px 0;
	}

	.sekundaer-liste {
		margin-top: 8px;
	}

	.sekundaer-liste .rad {
		background: var(--bg2);
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
