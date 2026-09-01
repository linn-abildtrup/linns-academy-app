<script lang="ts">
	// ============================================================
	// Kundernes svar paa dagens refleksion, i det nye design.
	//
	// Fjerde af de 19 gamle admin-sider, 1. september 2026. Ogsaa en der
	// KUN LAESER, saa den kan ikke goere skade.
	//
	// HELE REGNESTYKKET LIGGER I content/refleksioner.ts og er uroert. Den
	// her fil er kun skaerm: afgraensning, gruppering og CSV kommer fra det
	// samme modul som den gamle side bruger, saa de to kan ikke komme til
	// at vise forskellige svar.
	//
	// Den gamle side paa /app/admin/refleksioner er uroert.
	// ============================================================

	import { getContext, onMount } from 'svelte';
	import type { User } from 'firebase/auth';
	import { isAdmin } from '$lib/admin';
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
		type Afgraensning
	} from '$lib/content/refleksioner';
	import type { Refleksionssvar } from '$lib/content/refleksioner';
	import AdmSide from '$lib/components/admin/AdmSide.svelte';
	import AdmKort from '$lib/components/admin/AdmKort.svelte';
	import AdmKnap from '$lib/components/admin/AdmKnap.svelte';
	import AdmTom from '$lib/components/admin/AdmTom.svelte';

	const hentUser = getContext<() => User | null>('user');
	const maaVaereHer = $derived(isAdmin(hentUser()));

	let forlobListe = $state<Forlob[]>([]);
	let valgtId = $state('');
	let afgraensning = $state<Afgraensning>('dag');
	let fra = $state('');
	let til = $state('');

	let alleSvar = $state<Refleksionssvar[]>([]);
	let antalKlienter = $state(0);
	let hentetForlob = $state<Forlob | null>(null);
	let gruppering = $state<'dag' | 'klient'>('dag');
	let aabne = $state<Set<string>>(new Set());

	let henterForlob = $state(true);
	let henter = $state(false);
	let fejl = $state('');
	let besked = $state('');

	const valgtForlob = $derived(forlobListe.find((f) => f.id === valgtId) ?? null);
	const startMs = $derived(hentetForlob?.startDato?.toMillis?.() ?? null);
	const filtrerede = $derived(afgraensSvar(alleSvar, afgraensning, fra, til));
	const dagGrupper = $derived(grupperPrDag(filtrerede, startMs));
	const klientGrupper = $derived(grupperPrKlient(filtrerede));
	const medSvar = $derived(new Set(filtrerede.map((s) => s.uid)).size);

	function sigTil(t: string) {
		besked = t;
		setTimeout(() => {
			if (besked === t) besked = '';
		}, 2600);
	}

	// Saetter fra og til til HELE forloebet naar der skiftes hold eller
	// maade. Saa rammer et tryk paa Hent altid noget.
	function nulstil() {
		const f = valgtForlob;
		if (!f) return;
		if (afgraensning === 'dag') {
			fra = '0';
			til = String(f.antalDage);
		} else {
			fra = isoDato(f.startDato?.toDate?.() ?? new Date());
			til = isoDato(new Date());
		}
	}

	function vaelgForlob(id: string) {
		valgtId = id;
		alleSvar = [];
		hentetForlob = null;
		fejl = '';
		nulstil();
	}

	function skiftAfgraensning(ny: Afgraensning) {
		if (afgraensning === ny) return;
		afgraensning = ny;
		nulstil();
	}

	async function hent() {
		const f = valgtForlob;
		if (!f || henter) return;
		henter = true;
		fejl = '';
		try {
			const r = await hentRefleksioner(f);
			alleSvar = r.svar;
			antalKlienter = r.antalKlienter;
			hentetForlob = f;
			aabne = new Set();
		} catch (e) {
			console.error('[admin] refleksioner', e);
			fejl = 'Kunne ikke hente svarene.';
		} finally {
			henter = false;
		}
	}

	function hentCsv() {
		if (filtrerede.length === 0 || !hentetForlob) return;
		const url = URL.createObjectURL(
			new Blob([byggCsv(filtrerede, hentetForlob.navn, startMs)], {
				type: 'text/csv;charset=utf-8;'
			})
		);
		const a = document.createElement('a');
		a.href = url;
		a.download = csvFilnavn(hentetForlob.navn, new Date());
		a.click();
		URL.revokeObjectURL(url);
		sigTil(`${filtrerede.length} svar hentet som CSV`);
	}

	function toggle(id: string) {
		const ny = new Set(aabne);
		if (ny.has(id)) ny.delete(id);
		else ny.add(id);
		aabne = ny;
	}

	onMount(async () => {
		try {
			forlobListe = await hentAlleForlob();
			if (forlobListe.length > 0) vaelgForlob(forlobListe[0].id);
		} catch (e) {
			console.error('[admin] forløb', e);
			fejl = 'Kunne ikke hente holdene.';
		} finally {
			henterForlob = false;
		}
	});
</script>

<svelte:head><title>Refleksioner · Admin</title></svelte:head>

{#if !maaVaereHer}
	<p class="rf-kun">Siden er kun for admin.</p>
{:else}
	<AdmSide
		titel="Dagens refleksion"
		under="Kundernes egne svar. Vælg et hold, sæt hvor meget du vil se, og hent."
		bred
	>
		{#snippet handling()}
			<AdmKnap onclick={hentCsv} disabled={filtrerede.length === 0}>Hent som CSV</AdmKnap>
		{/snippet}

		{#if besked}<div class="rf-besked">{besked}</div>{/if}

		{#if henterForlob}
			<AdmTom tekst="Henter holdene…" />
		{:else if forlobListe.length === 0}
			<AdmTom tekst="Der er ingen hold at vælge imellem." />
		{:else}
			<AdmKort>
				<label class="rf-felt">
					<span>Hold</span>
					<select value={valgtId} onchange={(e) => vaelgForlob(e.currentTarget.value)}>
						{#each forlobListe as f (f.id)}
							<option value={f.id}>{f.navn}</option>
						{/each}
					</select>
				</label>

				<div class="rf-maade">
					<button
						type="button"
						class="rf-chip"
						class:paa={afgraensning === 'dag'}
						onclick={() => skiftAfgraensning('dag')}>Efter dag i forløbet</button
					>
					<button
						type="button"
						class="rf-chip"
						class:paa={afgraensning === 'dato'}
						onclick={() => skiftAfgraensning('dato')}>Efter dato</button
					>
				</div>

				<div class="rf-raek">
					<label class="rf-felt">
						<span>Fra</span>
						<input type={afgraensning === 'dag' ? 'number' : 'date'} bind:value={fra} />
					</label>
					<label class="rf-felt">
						<span>Til</span>
						<input type={afgraensning === 'dag' ? 'number' : 'date'} bind:value={til} />
					</label>
					<div class="rf-hent">
						<AdmKnap slags="primaer" disabled={henter} onclick={hent}>
							{henter ? 'Henter…' : 'Hent svar'}
						</AdmKnap>
					</div>
				</div>
			</AdmKort>

			{#if fejl}
				<AdmTom tekst={fejl} fejl>
					{#snippet handling()}
						<AdmKnap onclick={hent}>Prøv igen</AdmKnap>
					{/snippet}
				</AdmTom>
			{:else if !hentetForlob}
				<AdmTom tekst="Vælg et hold og tryk Hent svar." />
			{:else if filtrerede.length === 0}
				<AdmTom tekst="Der er ingen svar i den periode du har valgt." />
			{:else}
				<div class="rf-tal">
					<span><b>{filtrerede.length}</b> svar</span>
					<span><b>{medSvar}</b> af {antalKlienter} kunder har svaret</span>
				</div>

				<div class="rf-maade">
					<button
						type="button"
						class="rf-chip"
						class:paa={gruppering === 'dag'}
						onclick={() => (gruppering = 'dag')}>Samlet pr dag</button
					>
					<button
						type="button"
						class="rf-chip"
						class:paa={gruppering === 'klient'}
						onclick={() => (gruppering = 'klient')}>Samlet pr kunde</button
					>
				</div>

				{#if gruppering === 'dag'}
					{#each dagGrupper as g (g.dagNummer)}
						<AdmKort>
							<div class="rf-g-top">
								<h2>Dag {g.dagNummer}</h2>
								<span class="rf-g-meta">
									{g.dato ? datoTekst(g.dato) : ''} · {g.svar.length}
									{g.svar.length === 1 ? 'svar' : 'svar'}
								</span>
							</div>
							{#if g.spoergsmaal}<p class="rf-sp">{g.spoergsmaal}</p>{/if}
							{#each g.svar as s (s.uid + s.dagNummer)}
								<div class="rf-svar">
									<div class="rf-navn">{s.navn || s.email}</div>
									<p>{s.svar}</p>
									{#if s.gemtMs}<span class="rf-tid">{tidspunktTekst(s.gemtMs)}</span>{/if}
								</div>
							{/each}
						</AdmKort>
					{/each}
				{:else}
					{#each klientGrupper as k (k.uid)}
						<AdmKort>
							<button type="button" class="rf-k-top" onclick={() => toggle(k.uid)}>
								<span class="rf-navn">{k.navn || k.email}</span>
								<span class="rf-g-meta">
									{k.svar.length}
									{k.svar.length === 1 ? 'svar' : 'svar'} · {aabne.has(k.uid) ? 'skjul' : 'vis'}
								</span>
							</button>
							{#if aabne.has(k.uid)}
								{#each k.svar as s (s.dagNummer)}
									<div class="rf-svar">
										<div class="rf-tid">Dag {s.dagNummer}</div>
										{#if s.spoergsmaal}<p class="rf-sp">{s.spoergsmaal}</p>{/if}
										<p>{s.svar}</p>
									</div>
								{/each}
							{/if}
						</AdmKort>
					{/each}
				{/if}
			{/if}
		{/if}
	</AdmSide>
{/if}

<style>
	.rf-kun {
		padding: 24px 18px;
		color: var(--ink-2);
		font-size: calc(14px * var(--fs-scale, 1));
	}

	.rf-besked {
		margin-bottom: 12px;
		padding: 11px 15px;
		background: var(--sage-tint, #e7efe5);
		border-radius: 12px;
		color: var(--sage-tekst, #46603f);
		font-size: calc(13.5px * var(--fs-scale, 1));
		font-weight: 600;
	}

	.rf-felt {
		display: flex;
		flex-direction: column;
		gap: 4px;
		flex: 1 1 150px;
		margin-bottom: 10px;
	}

	.rf-felt span {
		font-size: calc(10.5px * var(--fs-scale, 1));
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--ink-3, #a3948a);
	}

	.rf-felt select,
	.rf-felt input {
		padding: 10px 13px;
		background: var(--paper, #fbf8f2);
		border: 1px solid var(--line, #e8dfd1);
		border-radius: 11px;
		color: var(--espresso, #382c2a);
		font-size: calc(14px * var(--fs-scale, 1));
		font-family: inherit;
		box-sizing: border-box;
	}

	.rf-raek {
		display: flex;
		gap: 10px;
		flex-wrap: wrap;
		align-items: flex-end;
	}

	.rf-hent {
		margin-bottom: 10px;
	}

	.rf-maade {
		display: flex;
		gap: 6px;
		flex-wrap: wrap;
		margin-bottom: 12px;
	}

	/* Baggrunden staar eksplicit, se noten i AdmKnap. */
	.rf-chip {
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

	.rf-chip.paa {
		background: var(--plum, #7c4f63);
		border-color: var(--plum, #7c4f63);
		color: #fff;
	}

	.rf-tal {
		display: flex;
		gap: 18px;
		flex-wrap: wrap;
		margin: 4px 0 12px;
		font-size: calc(12.5px * var(--fs-scale, 1));
		color: var(--ink-3, #a3948a);
	}

	.rf-tal b {
		color: var(--espresso, #382c2a);
		font-size: calc(15px * var(--fs-scale, 1));
	}

	.rf-g-top,
	.rf-k-top {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 10px;
		width: 100%;
		margin-bottom: 6px;
		background: none;
		border: none;
		padding: 0;
		font-family: inherit;
		text-align: left;
		cursor: pointer;
	}

	.rf-g-top h2 {
		margin: 0;
		font-size: calc(15.5px * var(--fs-scale, 1));
		font-weight: 600;
	}

	.rf-g-meta {
		font-size: calc(11.5px * var(--fs-scale, 1));
		color: var(--ink-3, #a3948a);
		white-space: nowrap;
	}

	.rf-sp {
		margin: 0 0 10px;
		font-size: calc(13px * var(--fs-scale, 1));
		color: var(--ink-2, #6f5f57);
		font-style: italic;
		line-height: 1.45;
	}

	.rf-svar {
		padding: 11px 14px;
		background: var(--paper, #fbf8f2);
		border-radius: 12px;
		margin-bottom: 7px;
	}

	.rf-svar p {
		margin: 0;
		font-size: calc(13.5px * var(--fs-scale, 1));
		line-height: 1.5;
		white-space: pre-wrap;
	}

	.rf-navn {
		font-size: calc(13.5px * var(--fs-scale, 1));
		font-weight: 600;
		margin-bottom: 3px;
	}

	.rf-tid {
		display: block;
		margin-top: 4px;
		font-size: calc(11px * var(--fs-scale, 1));
		color: var(--ink-3, #a3948a);
	}
</style>
