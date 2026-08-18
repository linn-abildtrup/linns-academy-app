<script lang="ts">
	// ============================================================
	// Udvikling i 3.0, foerste blok: baseline og check-ins.
	// Bygget 18. august 2026, se SPEC-3.0.md afsnit 34.
	//
	// Den gamle side tegner fem farvede streger oven i hinanden med en
	// farveforklaring under. Linns beslutning 18. august: én kurve over
	// hendes overskud samlet, og saa "fra → til" pr spoergsmaal, som er
	// DET der svarer paa om det har hjulpet. Vil hun grave, vaelger hun
	// ét spoergsmaal og faar dets egen kurve.
	//
	// Kurven er den SAMME som paa forsiden, altsaa byggKurve fra
	// content/forside3.ts. Saa faar vi forloebs-baandene og pauserne med
	// gratis, og de to sider kan ikke drive fra hinanden.
	//
	// Naering, traening og smaa skridt hoerer ogsaa til Udvikling i den
	// gamle app, men de er BEVIDST ikke bygget her. Linns beslutning: tag
	// den her blok alene foerst. Se HANDOVER 9.24.
	// ============================================================

	import { getContext } from 'svelte';
	import type { User } from 'firebase/auth';
	import type { UserDoc } from '$lib/types';
	import type { ForlobKilde } from '$lib/content/adgang3';
	import { udledAdgange, type Adgangsbillede } from '$lib/content/adgang3';
	import { byggKurve, formaterKortDato, maalingStatus, type Kurve } from '$lib/content/forside3';
	import {
		forskelTekst,
		formatTal,
		fraTilListe,
		kurveFor,
		overblikFor,
		samletKurve,
		SLIDERE,
		stoersteFremgang,
		tilstandFor,
		type MaalingKilde,
		type SliderId
	} from '$lib/content/udvikling3';
	import { hentAlleMrsScores } from '$lib/firestore/mrs';
	import Ventetegn from '$lib/components/ny/Ventetegn.svelte';

	const hentUser = getContext<() => User | null>('user');
	const hentUserDoc = getContext<() => UserDoc | null>('userDoc');
	const hentAdgang = getContext<() => Adgangsbillede>('adgang');
	const hentForlob = getContext<() => ForlobKilde[]>('forlob');

	const user = $derived(hentUser());
	const userDoc = $derived(hentUserDoc());
	const adgang = $derived(hentAdgang());

	let maalinger = $state<MaalingKilde[]>([]);
	let henter = $state(true);
	/** null er den samlede kurve. Ellers ét af de fem spoergsmaal. */
	let valgt = $state<SliderId | null>(null);

	const nu = Date.now();

	$effect(() => {
		const uid = user?.uid;
		if (!uid) {
			henter = false;
			return;
		}

		let afbrudt = false;
		(async () => {
			henter = true;
			const scores = await hentAlleMrsScores(uid);
			if (afbrudt) return;
			maalinger = scores.map((s) => ({ timestamp: s.timestamp, sliders: s.sliders }));
			henter = false;
		})().catch((e) => {
			console.error('[ny] kunne ikke hente maalingerne', e);
			henter = false;
		});

		return () => {
			afbrudt = true;
		};
	});

	const tilstand = $derived(tilstandFor(maalinger));
	const overblik = $derived(overblikFor(maalinger));
	const liste = $derived(fraTilListe(maalinger));
	const bedst = $derived(stoersteFremgang(liste));
	const valgtInfo = $derived(SLIDERE.find((s) => s.id === valgt) ?? null);

	/** Det ene spoergsmaals egen fra-til, naar hun har valgt et. */
	const valgtFraTil = $derived(valgt ? (liste.find((f) => f.id === valgt) ?? null) : null);

	// Adgangs-raekkerne giver kurven dens forloebs-baand og pauser. Samme
	// udledning som forsiden bruger.
	const adgange = $derived(
		udledAdgange(
			{
				forlobIds: userDoc?.forlobIds,
				aboKoebtAt: userDoc?.aboKoebtAt,
				aboSlutterAt: userDoc?.aboSlutterAt,
				aboProdukt: userDoc?.aboProdukt,
				activeProduct: userDoc?.activeProduct,
				activeSubscription: userDoc?.activeSubscription,
				accessSource: userDoc?.accessSource,
				bonusPeriodEndsAt: userDoc?.bonusPeriodEndsAt,
				createdAt: userDoc?.createdAt
			},
			hentForlob?.() ?? []
		)
	);

	const navne = $derived.by(() => {
		const m = new Map(adgang.gennemfoerte.map((g) => [g.forlobId, g.navn]));
		for (const f of adgang.aktiveForlob) m.set(f.forlobId, f.navn);
		return m;
	});

	/** Kurven for det hun kigger paa lige nu. Samme tegning begge veje. */
	const kurve = $derived<Kurve>(
		byggKurve(valgt ? kurveFor(maalinger, valgt) : samletKurve(maalinger), adgange, nu, navne)
	);

	const status = $derived(
		maalingStatus(
			overblik ? (samletKurve(maalinger).at(-1)?.ms ?? null) : null,
			adgang.aktiveForlob[0]?.produkt ?? null,
			nu
		)
	);

	/** Overskriften over kurven. */
	const kurveTitel = $derived(valgtInfo ? valgtInfo.lang : 'Dit overskud lige nu');

	/** Tallet der staar stort. Det valgte spoergsmaal, eller det samlede. */
	const stortTal = $derived(valgtFraTil ? valgtFraTil.nu : (overblik?.nu ?? null));
	const stortForskel = $derived(
		valgtFraTil
			? valgtFraTil.kanSammenlignes
				? valgtFraTil.forskel
				: null
			: (overblik?.forskel ?? null)
	);

	// Farve pr forloebstype, saa Kickstart og Kropsro kan skelnes. Samme
	// to farver som paa forsiden.
	const BAAND_FARVER: Record<string, string> = { kickstart: '#86a188', kropsro: '#d49ab0' };
	const baandFarve = (produkt: string) => BAAND_FARVER[produkt] ?? '#c9b7d6';

	// Navnene under kurven. Samme forloeb to gange skal kun staa én gang.
	const forklaring = $derived.by(() => {
		const m = new Map<string, string>();
		for (const b of kurve.baand) if (!m.has(b.navn)) m.set(b.navn, b.produkt);
		return [...m].map(([navn, produkt]) => ({ navn, produkt }));
	});

	/** Bredden paa stregen i fra-til-listen. 1 til 10 bliver 10 til 100. */
	function bredde(v: number): number {
		return Math.max(0, Math.min(100, v * 10));
	}
</script>

<div class="ny-pad udv-side">
	<header class="side-top" style="padding-left:0;padding-right:0">
		<h1>Min udvikling</h1>
	</header>

	{#if henter}
		<div class="lektion-venter">
			<Ventetegn variant="lille" />
			<span>Henter dine målinger</span>
		</div>
	{:else if tilstand === 'ingen'}
		<div class="kort rolig">
			Du har ikke lavet en måling endnu. Når du gør, kan du følge din energi, søvn, humør, mave og
			cravings her, og se hvordan det rykker sig over tid.
		</div>
		<a class="udv-kom-igang" href="/ny/maaling">
			<span class="udv-kom-t">Lav din første måling</span>
			<span class="udv-kom-s">Fem spørgsmål, to minutter. Den bliver dit udgangspunkt.</span>
		</a>
	{:else}
		<!-- Knapperne staar kun frem naar der ER en historie at grave i.
		     Med én maaling er der ingenting at kigge paa pr spoergsmaal. -->
		{#if tilstand === 'flere'}
			<div class="udv-chips" role="tablist" aria-label="Vælg hvad du vil se">
				<button
					class="udv-chip"
					class:aktiv={valgt === null}
					role="tab"
					aria-selected={valgt === null}
					onclick={() => (valgt = null)}
				>
					Samlet
				</button>
				{#each SLIDERE as s (s.id)}
					<button
						class="udv-chip"
						class:aktiv={valgt === s.id}
						role="tab"
						aria-selected={valgt === s.id}
						onclick={() => (valgt = s.id)}
					>
						{s.kort.replace(/^(Min|Mit|Mine) /, '')}
					</button>
				{/each}
			</div>
		{/if}

		<section class="udv-kort">
			<div class="udv-k">{kurveTitel}</div>

			{#if stortTal !== null}
				<div class="udv-tal">
					<span class="udv-n">{formatTal(stortTal)}</span>
					<span class="udv-af">af 10</span>
					{#if forskelTekst(stortForskel)}
						<span class="udv-chip-tal" class:ned={(stortForskel ?? 0) < 0}>
							{forskelTekst(stortForskel)}
						</span>
					{/if}
				</div>
			{/if}

			{#if tilstand === 'flere'}
				<!-- Samme geometri som forsiden, men tegnet til en LYS flade.
				     Forsidens kurve staar paa en moerk plomme-baggrund og kan
				     derfor ikke genbruges som komponent uden at rette i den,
				     og forsiden er den mest brugte skaerm i appen. -->
				<div class="udv-kurve">
					<svg
						viewBox="0 0 286 80"
						width="100%"
						height="80"
						role="img"
						aria-label={`${kurveTitel}, fra ${formatTal(kurve.foerste?.vaerdi ?? 0)} til ${formatTal(kurve.seneste?.vaerdi ?? 0)} af 10`}
					>
						{#each kurve.baand as b (b.fraMs + b.navn)}
							<rect x={b.x} y="6" width={b.bredde} height="52" rx="5" fill="var(--plum-tint)" />
							<rect
								x={b.x}
								y="62"
								width={b.bredde}
								height="3"
								rx="1.5"
								fill={baandFarve(b.produkt)}
							/>
						{/each}

						{#each kurve.pauser as p, i (i)}
							<rect x={p.x} y="62" width={p.bredde} height="3" rx="1.5" fill="var(--line)" />
						{/each}

						{#each kurve.huller as h, i (i)}
							<path
								d={h}
								fill="none"
								stroke="var(--ink-3)"
								stroke-width="2"
								stroke-linecap="round"
								stroke-dasharray="3 5"
								opacity="0.6"
							/>
						{/each}

						{#each kurve.stier as st, i (i)}
							<path
								d={st}
								fill="none"
								stroke="var(--plum)"
								stroke-width="2.5"
								stroke-linecap="round"
								stroke-linejoin="round"
							/>
						{/each}

						{#each kurve.punkter as p, i (p.ms)}
							{#if p.visPrik}
								<circle
									cx={p.x}
									cy={p.y}
									r={p.erSidste ? 5.2 : 3.4}
									fill={p.erSidste ? 'var(--plum)' : 'var(--ink-3)'}
									stroke={p.erSidste ? 'var(--paper)' : 'none'}
									stroke-width={p.erSidste ? 2 : 0}
								/>
							{/if}
							{#if p.visTal}
								<text
									class="udv-v-tal"
									class:nu={p.erSidste}
									x={p.x}
									y={p.y - (p.erSidste ? 9 : 8)}
									text-anchor={p.erSidste ? 'end' : i === 0 ? 'start' : 'middle'}
								>
									{formatTal(p.vaerdi)}
								</text>
							{/if}
							{#if p.visDato}
								<text
									class="udv-v-lab"
									x={p.x}
									y="76"
									text-anchor={p.erSidste ? 'end' : i === 0 ? 'start' : 'middle'}
								>
									{formaterKortDato(p.ms, nu)}
								</text>
							{/if}
						{/each}
					</svg>
				</div>

				{#if forklaring.length}
					<div class="udv-legende">
						{#each forklaring as f (f.navn)}
							<span><i class="sw" style:background={baandFarve(f.produkt)}></i>{f.navn}</span>
						{/each}
					</div>
				{/if}
			{:else}
				<p class="udv-mrk">
					Det her er din baseline, altså dit udgangspunkt. Den bruger vi til at måle alt det andet
					imod.
				</p>
			{/if}
		</section>

		{#if tilstand === 'foerste'}
			<div class="kort rolig">
				Når du har lavet din næste måling, kan du se hvordan det har rykket sig.
				{#if status.tekst}{status.tekst}.{/if}
			</div>
		{/if}

		{#if valgt === null && liste.length > 0}
			<section>
				<div class="lab"><h2>Siden du startede</h2></div>
				<div class="udv-liste">
					{#each liste as f (f.id)}
						<div class="udv-raekke">
							<span class="udv-navn">{f.kort}</span>
							<span class="udv-bar" aria-hidden="true">
								<i class="foer" style={`width:${bredde(f.foer)}%`}></i>
								<i class="nu" style={`width:${bredde(f.nu)}%`}></i>
							</span>
							{#if f.kanSammenlignes}
								<span class="udv-ft">{formatTal(f.foer)} → <b>{formatTal(f.nu)}</b></span>
							{:else}
								<span class="udv-ft"><b>{formatTal(f.nu)}</b></span>
							{/if}
						</div>
					{/each}
				</div>

				{#if bedst}
					<p class="udv-mrk">
						{bedst.kort.toLowerCase().replace(/^(min|mit|mine) /, '')} har rykket sig mest, fra
						{formatTal(bedst.foer)} til {formatTal(bedst.nu)}.
					</p>
				{/if}
			</section>
		{/if}
	{/if}
</div>
