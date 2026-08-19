<script lang="ts">
	import { onMount } from 'svelte';
	import Icon from '$lib/components/Icon.svelte';
	import { hentAlleForlob } from '$lib/firestore/forlob';
	import { hentRefleksioner } from '$lib/firestore/refleksioner';
	import type { Forlob } from '$lib/content/forlobAdgang';
	import {
		afgraensSvar,
		byggCsv,
		csvFilnavn,
		datoTekst,
		grupperPrDag,
		grupperPrKlient,
		isoDato,
		tidspunktTekst,
		type Afgraensning,
		type Refleksionssvar
	} from '$lib/content/refleksioner';

	let forlobListe = $state<Forlob[]>([]);
	let valgtForlobId = $state<string>('');
	let afgraensning = $state<Afgraensning>('dag');
	let fra = $state('');
	let til = $state('');

	let alleSvar = $state<Refleksionssvar[]>([]);
	let antalKlienter = $state(0);
	let hentetForlob = $state<Forlob | null>(null);
	let gruppering = $state<'dag' | 'klient'>('dag');
	let aabneKlienter = $state<Set<string>>(new Set());

	let indlaeserForlob = $state(true);
	let henter = $state(false);
	let fejl = $state<string | null>(null);
	let toast = $state<string | null>(null);

	const valgtForlob = $derived(forlobListe.find((f) => f.id === valgtForlobId) ?? null);
	const startMs = $derived(hentetForlob?.startDato?.toMillis?.() ?? null);

	const filtrerede = $derived(afgraensSvar(alleSvar, afgraensning, fra, til));
	const dagGrupper = $derived(grupperPrDag(filtrerede, startMs));
	const klientGrupper = $derived(grupperPrKlient(filtrerede));
	const antalKlienterMedSvar = $derived(new Set(filtrerede.map((s) => s.uid)).size);

	function visToast(besked: string) {
		toast = besked;
		setTimeout(() => (toast = null), 2600);
	}

	// Saetter fra/til til hele forloebet naar admin skifter hold eller skifter
	// mellem dag og dato. Saa rammer et klik paa 'Hent svar' altid noget.
	function nulstilAfgraensning() {
		const f = valgtForlob;
		if (!f) return;
		if (afgraensning === 'dag') {
			fra = '0';
			til = String(f.antalDage);
		} else {
			const start = f.startDato?.toDate?.() ?? new Date();
			fra = isoDato(start);
			til = isoDato(new Date());
		}
	}

	function vaelgForlob(id: string) {
		valgtForlobId = id;
		alleSvar = [];
		hentetForlob = null;
		fejl = null;
		nulstilAfgraensning();
	}

	function skiftAfgraensning(ny: Afgraensning) {
		if (afgraensning === ny) return;
		afgraensning = ny;
		nulstilAfgraensning();
	}

	async function hent() {
		const f = valgtForlob;
		if (!f || henter) return;
		henter = true;
		fejl = null;
		try {
			const resultat = await hentRefleksioner(f);
			alleSvar = resultat.svar;
			antalKlienter = resultat.antalKlienter;
			hentetForlob = f;
			aabneKlienter = new Set();
		} catch (e) {
			console.error('Kunne ikke hente refleksioner:', e);
			fejl = 'Kunne ikke hente svarene. Prøv igen.';
		} finally {
			henter = false;
		}
	}

	function hentCsv() {
		if (filtrerede.length === 0 || !hentetForlob) return;
		const csv = byggCsv(filtrerede, hentetForlob.navn, startMs);
		const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = csvFilnavn(hentetForlob.navn, new Date());
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
		visToast(`CSV hentet (${filtrerede.length} svar)`);
	}

	function toggleKlient(uid: string) {
		const ny = new Set(aabneKlienter);
		if (ny.has(uid)) ny.delete(uid);
		else ny.add(uid);
		aabneKlienter = ny;
	}

	onMount(async () => {
		try {
			forlobListe = await hentAlleForlob();
			if (forlobListe.length > 0) vaelgForlob(forlobListe[0].id);
		} catch (e) {
			console.error('Kunne ikke hente forløb:', e);
			fejl = 'Kunne ikke hente listen af forløb.';
		} finally {
			indlaeserForlob = false;
		}
	});
</script>

<div class="page">
	<header class="page-header">
		<a class="back" href="/app/admin">
			<Icon name="arrow-l" size={14} color="var(--text2)" />
			<span>Admin</span>
		</a>
		<div class="head-row">
			<div>
				<div class="eyebrow">Admin · Refleksioner</div>
				<h1>Svar fra <em>klienter</em></h1>
			</div>
			<button type="button" class="ghost-knap sm" onclick={hent} disabled={henter || !valgtForlob}>
				{henter ? 'Henter...' : 'Opdater'}
			</button>
		</div>
	</header>

	{#if indlaeserForlob}
		<div class="status-kort">Henter forløb...</div>
	{:else if forlobListe.length === 0}
		<div class="status-kort">Der er ingen forløb endnu.</div>
	{:else}
		<div class="filter-kort">
			<div class="felt">
				<span class="felt-label">Forløb</span>
				<select
					value={valgtForlobId}
					onchange={(e) => vaelgForlob((e.currentTarget as HTMLSelectElement).value)}
				>
					{#each forlobListe as f (f.id)}
						<option value={f.id}>{f.navn}</option>
					{/each}
				</select>
			</div>

			<div class="felt">
				<span class="felt-label">Vis efter</span>
				<div class="pille-raekke">
					<button
						type="button"
						class="pille"
						class:valgt={afgraensning === 'dag'}
						onclick={() => skiftAfgraensning('dag')}
					>
						Forløbsdag
					</button>
					<button
						type="button"
						class="pille"
						class:valgt={afgraensning === 'dato'}
						onclick={() => skiftAfgraensning('dato')}
					>
						Dato
					</button>
				</div>
			</div>

			<div class="fra-til">
				<div class="felt">
					<span class="felt-label">{afgraensning === 'dag' ? 'Fra dag' : 'Fra dato'}</span>
					{#if afgraensning === 'dag'}
						<input type="number" min="0" bind:value={fra} />
					{:else}
						<input type="date" bind:value={fra} />
					{/if}
				</div>
				<div class="felt">
					<span class="felt-label">{afgraensning === 'dag' ? 'Til dag' : 'Til dato'}</span>
					{#if afgraensning === 'dag'}
						<input type="number" min="0" bind:value={til} />
					{:else}
						<input type="date" bind:value={til} />
					{/if}
				</div>
			</div>

			<div class="knap-raekke">
				<button type="button" class="primary-knap" onclick={hent} disabled={henter}>
					{henter ? 'Henter...' : 'Hent svar'}
				</button>
				<button
					type="button"
					class="ghost-knap ikon"
					onclick={hentCsv}
					disabled={filtrerede.length === 0}
				>
					<Icon name="doc" size={14} color="var(--sage)" />
					<span>Hent CSV{filtrerede.length > 0 ? ` (${filtrerede.length})` : ''}</span>
				</button>
			</div>
		</div>
	{/if}

	{#if fejl}
		<div class="fejl-kort">{fejl}</div>
	{/if}

	{#if hentetForlob}
		<div class="resultat-linje">
			<div class="resultat-tekst">
				{filtrerede.length} svar · {antalKlienterMedSvar} af {antalKlienter} klienter
			</div>
			<div class="segment">
				<button
					type="button"
					class="segment-knap"
					class:valgt={gruppering === 'dag'}
					onclick={() => (gruppering = 'dag')}
				>
					Pr dag
				</button>
				<button
					type="button"
					class="segment-knap"
					class:valgt={gruppering === 'klient'}
					onclick={() => (gruppering = 'klient')}
				>
					Pr klient
				</button>
			</div>
		</div>

		{#if filtrerede.length === 0}
			<div class="tom-kort">
				<div class="tom-ikon">
					<Icon name="cal" size={22} color="var(--terra)" />
				</div>
				<div class="tom-titel">Ingen svar i den periode</div>
				<p class="tom-tekst">
					Der er ikke skrevet noget på {hentetForlob.navn} i den afgrænsning du har valgt. Prøv en
					anden periode eller et andet forløb.
				</p>
				<button type="button" class="tom-knap" onclick={nulstilAfgraensning}>
					Vis hele forløbet
				</button>
			</div>
		{:else if gruppering === 'dag'}
			{#each dagGrupper as gruppe (gruppe.dagNummer)}
				<section class="gruppe-kort">
					<div class="gruppe-hoved">
						<div class="gruppe-top">
							<div class="gruppe-eyebrow">
								Dag {gruppe.dagNummer}{gruppe.dato ? ` · ${datoTekst(gruppe.dato)}` : ''}
							</div>
							<div class="antal-badge">{gruppe.svar.length} svar</div>
						</div>
						{#if gruppe.spoergsmaal}
							<div class="spoergsmaal">{gruppe.spoergsmaal}</div>
						{/if}
					</div>
					<div class="svar-liste">
						{#each gruppe.svar as s (s.uid + '-' + s.dagNummer)}
							<div class="svar-rad">
								<div class="svar-top">
									<span class="svar-navn">{s.navn}</span>
									<span class="svar-tid">{tidspunktTekst(s.gemtMs)}</span>
								</div>
								<p class="svar-tekst">{s.svar}</p>
							</div>
						{/each}
					</div>
				</section>
			{/each}
		{:else}
			{#each klientGrupper as klient (klient.uid)}
				{@const aaben = aabneKlienter.has(klient.uid)}
				<section class="gruppe-kort">
					<button type="button" class="klient-hoved" onclick={() => toggleKlient(klient.uid)}>
						<div class="klient-navn-blok">
							<div class="klient-navn">{klient.navn}</div>
							<div class="klient-mail">{klient.email}</div>
						</div>
						<div class="klient-hoejre">
							<div class="antal-badge sage">{klient.svar.length} svar</div>
							<Icon name={aaben ? 'chevron-d' : 'chevron-r'} size={16} color="var(--text3)" />
						</div>
					</button>
					{#if aaben}
						<div class="svar-liste">
							{#each klient.svar as s (s.dagNummer)}
								<div class="svar-rad klient-rad">
									<div class="dag-maerkat">Dag {s.dagNummer}</div>
									<div class="klient-svar-blok">
										{#if s.spoergsmaal}
											<div class="klient-spoergsmaal">{s.spoergsmaal}</div>
										{/if}
										<p class="svar-tekst">{s.svar}</p>
									</div>
								</div>
							{/each}
						</div>
					{/if}
				</section>
			{/each}
		{/if}
	{/if}

	{#if toast}
		<div class="toast">{toast}</div>
	{/if}
</div>

<style>
	.page {
		padding: 18px 18px 100px;
		max-width: 600px;
		margin: 0 auto;
	}

	.page-header {
		margin-bottom: 14px;
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

	.head-row {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 12px;
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
		font-size: calc(26px * var(--fs-scale, 1));
		font-weight: 600;
		letter-spacing: -0.02em;
		margin: 4px 0 0;
		line-height: 1.05;
		color: var(--text);
	}

	h1 em {
		font-style: italic;
		color: var(--terra);
		font-weight: 400;
	}

	.filter-kort {
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 14px;
		padding: 14px;
		margin-bottom: 14px;
		display: flex;
		flex-direction: column;
		gap: 14px;
	}

	.felt {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.felt-label {
		font-size: calc(10px * var(--fs-scale, 1));
		font-weight: 600;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--text3);
	}

	.filter-kort select,
	.filter-kort input {
		width: 100%;
		padding: 10px 12px;
		border: 1px solid var(--border);
		border-radius: 10px;
		background: var(--bg2);
		color: var(--text);
		font-family: var(--ff-b);
		font-size: calc(14px * var(--fs-scale, 1));
	}

	.filter-kort select:focus,
	.filter-kort input:focus {
		outline: none;
		border-color: var(--terra);
	}

	.pille-raekke {
		display: flex;
		gap: 8px;
	}

	.pille {
		background: var(--bg2);
		border: 1px solid var(--border);
		color: var(--text2);
		border-radius: 99px;
		padding: 6px 14px;
		font-family: var(--ff-b);
		font-size: calc(12px * var(--fs-scale, 1));
		cursor: pointer;
	}

	.pille.valgt {
		background: var(--terra);
		border-color: var(--terra);
		color: var(--white);
		font-weight: 500;
	}

	.fra-til {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 12px;
	}

	.knap-raekke {
		display: flex;
		gap: 10px;
		align-items: center;
		flex-wrap: wrap;
	}

	.primary-knap {
		background: var(--terra);
		color: var(--white);
		border: none;
		padding: 11px 18px;
		border-radius: 10px;
		font-family: var(--ff-b);
		font-size: calc(13px * var(--fs-scale, 1));
		font-weight: 500;
		cursor: pointer;
	}

	.ghost-knap {
		background: var(--white);
		color: var(--text2);
		border: 1px solid var(--border);
		padding: 8px 12px;
		border-radius: 8px;
		font-family: var(--ff-b);
		font-size: calc(12px * var(--fs-scale, 1));
		cursor: pointer;
	}

	.ghost-knap.sm {
		padding: 6px 10px;
		font-size: calc(11.5px * var(--fs-scale, 1));
	}

	.ghost-knap.ikon {
		display: inline-flex;
		align-items: center;
		gap: 7px;
		padding: 10px 14px;
		border-radius: 10px;
		font-size: calc(13px * var(--fs-scale, 1));
	}

	.primary-knap:disabled,
	.ghost-knap:disabled {
		opacity: 0.5;
		cursor: default;
	}

	.status-kort,
	.fejl-kort {
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 12px;
		padding: 14px 16px;
		font-size: calc(13px * var(--fs-scale, 1));
		color: var(--text2);
		margin-bottom: 14px;
	}

	.fejl-kort {
		color: #8a4a3e;
		border-color: var(--border2);
	}

	.resultat-linje {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 12px;
		margin-bottom: 14px;
		flex-wrap: wrap;
	}

	.resultat-tekst {
		font-size: calc(12px * var(--fs-scale, 1));
		color: var(--text2);
	}

	.segment {
		display: flex;
		background: var(--bg2);
		border: 1px solid var(--border);
		border-radius: 99px;
		padding: 3px;
	}

	.segment-knap {
		background: none;
		border: none;
		color: var(--text3);
		border-radius: 99px;
		padding: 5px 13px;
		font-family: var(--ff-b);
		font-size: calc(11.5px * var(--fs-scale, 1));
		cursor: pointer;
	}

	.segment-knap.valgt {
		background: var(--white);
		color: var(--text);
		font-weight: 500;
	}

	.gruppe-kort {
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 14px;
		overflow: hidden;
		margin-bottom: 14px;
	}

	.gruppe-hoved {
		padding: 14px;
		border-bottom: 1px solid var(--border);
		background: var(--bg2);
		display: flex;
		flex-direction: column;
		gap: 5px;
	}

	.gruppe-top {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 10px;
	}

	.gruppe-eyebrow {
		font-size: calc(10px * var(--fs-scale, 1));
		font-weight: 600;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: var(--text3);
	}

	.antal-badge {
		background: var(--tdim);
		color: var(--terra);
		border-radius: 99px;
		padding: 2px 9px;
		font-size: calc(10px * var(--fs-scale, 1));
		font-weight: 600;
		white-space: nowrap;
	}

	.antal-badge.sage {
		background: var(--sdim);
		color: #4f7a5d;
	}

	.spoergsmaal {
		font-family: var(--ff-d);
		font-size: calc(16px * var(--fs-scale, 1));
		font-style: italic;
		font-weight: 400;
		color: var(--text);
		line-height: 1.35;
	}

	.svar-liste {
		display: flex;
		flex-direction: column;
	}

	.svar-rad {
		padding: 14px;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.svar-rad + .svar-rad {
		border-top: 1px solid var(--border);
	}

	.svar-top {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: 10px;
	}

	.svar-navn {
		font-size: calc(13px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--text);
	}

	.svar-tid {
		font-size: calc(11px * var(--fs-scale, 1));
		color: var(--text3);
		white-space: nowrap;
	}

	.svar-tekst {
		margin: 0;
		font-size: calc(14px * var(--fs-scale, 1));
		line-height: 1.55;
		color: var(--text2);
		white-space: pre-wrap;
		overflow-wrap: anywhere;
	}

	.klient-hoved {
		width: 100%;
		background: var(--bg2);
		border: none;
		border-bottom: 1px solid var(--border);
		padding: 14px;
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 10px;
		cursor: pointer;
		text-align: left;
		font-family: var(--ff-b);
	}

	.klient-navn-blok {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
	}

	.klient-navn {
		font-family: var(--ff-d);
		font-size: calc(18px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--text);
	}

	.klient-mail {
		font-size: calc(11px * var(--fs-scale, 1));
		color: var(--text3);
		overflow-wrap: anywhere;
	}

	.klient-hoejre {
		display: flex;
		align-items: center;
		gap: 10px;
		flex-shrink: 0;
	}

	.klient-rad {
		flex-direction: row;
		gap: 12px;
		padding: 13px 14px;
	}

	.dag-maerkat {
		flex-shrink: 0;
		width: 52px;
		font-size: calc(10px * var(--fs-scale, 1));
		font-weight: 600;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--terra);
		padding-top: 3px;
	}

	.klient-svar-blok {
		display: flex;
		flex-direction: column;
		gap: 4px;
		min-width: 0;
	}

	.klient-spoergsmaal {
		font-size: calc(12px * var(--fs-scale, 1));
		font-style: italic;
		color: var(--text3);
		line-height: 1.4;
	}

	.tom-kort {
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 14px;
		padding: 40px 28px;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 12px;
		text-align: center;
	}

	.tom-ikon {
		width: 52px;
		height: 52px;
		border-radius: 99px;
		background: var(--ic-rose);
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.tom-titel {
		font-family: var(--ff-d);
		font-size: calc(19px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--text);
	}

	.tom-tekst {
		margin: 0;
		font-size: calc(13.5px * var(--fs-scale, 1));
		line-height: 1.6;
		color: var(--text2);
		max-width: 340px;
	}

	.tom-knap {
		background: var(--bg2);
		color: var(--text2);
		border: 1px solid var(--border);
		padding: 8px 16px;
		border-radius: 99px;
		font-family: var(--ff-b);
		font-size: calc(12px * var(--fs-scale, 1));
		cursor: pointer;
		margin-top: 4px;
	}

	.toast {
		position: fixed;
		left: 50%;
		bottom: 92px;
		transform: translateX(-50%);
		background: var(--text);
		color: var(--white);
		padding: 10px 16px;
		border-radius: 99px;
		font-size: calc(12.5px * var(--fs-scale, 1));
		z-index: 60;
	}
</style>
