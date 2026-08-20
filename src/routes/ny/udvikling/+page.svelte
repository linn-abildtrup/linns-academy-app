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
	// Smaa skridt hoerer ogsaa til Udvikling i den gamle app. Kortet blev
	// bygget 18. august og pillet ned samme dag efter Linns beslutning.
	// Se HANDOVER 9.26 for hvad der gjorde det svaert, hvis det skal
	// tilbage.
	// ============================================================

	import { getContext } from 'svelte';
	import type { User } from 'firebase/auth';
	import type { UserDoc } from '$lib/types';
	import type { ForlobKilde } from '$lib/content/adgang3';
	import { udledAdgange, type Adgangsbillede } from '$lib/content/adgang3';
	import {
		byggKurve,
		FLADE_UDVIKLING,
		formaterKortDato,
		maalingStatus,
		type Kurve
	} from '$lib/content/forside3';
	import {
		forskelTekst,
		formatTal,
		fraTilListe,
		holdNavn,
		kurveFor,
		overblikFor,
		samletKurve,
		SLIDERE,
		stoersteFremgang,
		tilstandFor,
		type MaalingKilde,
		type SliderId
	} from '$lib/content/udvikling3';
	import {
		GRAENSER_SYMPTOMER,
		symptomKurve,
		symptomOverblik,
		symptomTekst,
		type SymptomKilde
	} from '$lib/content/symptomer3';
	import {
		traeningOverblik,
		traeningTal,
		traeningTekst,
		type TraeningKilde
	} from '$lib/content/traeningMaaned3';
	import { dagOrd, madOverblik, madTekst, type MaaltidKilde } from '$lib/content/madMaaned3';
	import { soejleBredde, stoersteMaaned } from '$lib/content/maanedTal3';
	import { hentAlleMrsScores } from '$lib/firestore/mrs';
	import { hentMaaltiderIPeriode } from '$lib/firestore/kost';
	import { hentHistorikSidenDato } from '$lib/firestore/traeningHistorik';
	import Ventetegn from '$lib/components/ny/Ventetegn.svelte';

	const hentUser = getContext<() => User | null>('user');
	const hentUserDoc = getContext<() => UserDoc | null>('userDoc');
	const hentAdgang = getContext<() => Adgangsbillede>('adgang');
	const hentForlob = getContext<() => ForlobKilde[]>('forlob');

	const user = $derived(hentUser());
	const userDoc = $derived(hentUserDoc());
	const adgang = $derived(hentAdgang());

	let maalinger = $state<MaalingKilde[]>([]);
	let symptomer = $state<SymptomKilde[]>([]);
	let traeninger = $state<TraeningKilde[]>([]);
	let maaltider = $state<MaaltidKilde[]>([]);
	let henter = $state(true);
	/** null er den samlede kurve. Ellers ét af de fem spoergsmaal. */
	let valgt = $state<SliderId | null>(null);

	/**
	 * Hvilket omraade der er foldet ud. Ét ad gangen.
	 *
	 * Udvikling har fire omraader: overskuddet, symptomerne, traeningen og
	 * maden. Hvert af dem er et kort hvor tallet og retningen ALTID staar
	 * fremme, mens grafen er foldet sammen. Saa kan hun se hele billedet
	 * paa én skaerm, og det er dét siden er til. Linns valg 18. august, se
	 * HANDOVER 9.25.
	 *
	 * Formen blev valgt fordi et omraade kan bygges eller fjernes uden at
	 * siden ser halvfaerdig ud. Et kort der ikke findes, er der bare ikke.
	 */
	let aabent = $state<string>('overskud');

	function fold(omraade: string) {
		aabent = aabent === omraade ? '' : omraade;
	}

	const nu = Date.now();

	/** YYYY-MM-DD i lokal tid. Samme form som historikken bruger. */
	function isoDag(d: Date): string {
		return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
	}

	$effect(() => {
		const uid = user?.uid;
		if (!uid) {
			henter = false;
			return;
		}

		let afbrudt = false;
		(async () => {
			henter = true;
			// Traeningen maa gerne fejle for sig. Kan vi ikke naa den, staar
			// maalingerne der stadig.
			const seksMaanederSiden = new Date(nu);
			seksMaanederSiden.setMonth(seksMaanederSiden.getMonth() - 6);
			const fra = isoDag(seksMaanederSiden);
			const [scores, historik, mad] = await Promise.all([
				hentAlleMrsScores(uid),
				hentHistorikSidenDato(uid, fra).catch((e) => {
					console.warn('[ny] kunne ikke hente traeningen', e);
					return [];
				}),
				hentMaaltiderIPeriode(uid, fra, isoDag(new Date(nu))).catch((e) => {
					console.warn('[ny] kunne ikke hente maden', e);
					return [];
				})
			]);
			if (afbrudt) return;
			maalinger = scores.map((s) => ({ timestamp: s.timestamp, sliders: s.sliders }));
			symptomer = scores.map((s) => ({
				timestamp: s.timestamp,
				total: s.total,
				kunSliders: s.kunSliders
			}));
			traeninger = historik.map((h) => ({ dato: h.dato, minutter: h.minutter }));
			maaltider = mad.map((x) => ({
				dato: x.dato,
				type: x.type,
				totalP: x.totalP,
				totalF: x.totalF
			}));

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
	// Der er kun noget at vaelge imellem naar der er mere end én maaling.
	// Med kun en baseline er der ingen kurve at skifte til.
	const kanVaelge = $derived(tilstand === 'flere');

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

	// ── Symptomer ────────────────────────────────────────────
	// FAERRE gener er fremgang. Det er omvendt af alt andet paa siden.
	const symptomKurven = $derived(symptomKurve(symptomer));
	const symptom = $derived(symptomOverblik(symptomer));
	// Symptomerne gaar fra 0 til 44, ikke fra 1 til 10 som overskuddet.
	// Uden det klipper aksen kurven vaek. Set 18. august.
	const symptomGraf = $derived(
		byggKurve(symptomKurven, adgange, nu, navne, FLADE_UDVIKLING, GRAENSER_SYMPTOMER)
	);

	// ── Traening ─────────────────────────────────────────────
	const traening = $derived(traeningOverblik(traeninger, nu));

	// ── Mad ──────────────────────────────────────────────────
	// Vi taeller DAGE hvor hun spiste efter 30-30, ikke et gennemsnit.
	const mad = $derived(madOverblik(maaltider, nu));

	/** Kurven for det hun kigger paa lige nu. Samme tegning begge veje. */
	const kurve = $derived<Kurve>(
		byggKurve(
			valgt ? kurveFor(maalinger, valgt) : samletKurve(maalinger),
			adgange,
			nu,
			navne,
			// Her er kurven sidens hovedperson og ikke et hjoerne af et kort,
			// saa den faar mere hoejde og gaar taettere paa kanterne.
			FLADE_UDVIKLING
		)
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
		{@const aaben = aabent === 'overskud'}
		<section class="udv-omraade" class:aaben>
			<!-- Hovedet er BAADE overskrift og knap. Overskriften og den lille
			     plakat staar til venstre, tallet til hoejre, saa de to spalter
			     bliver lige hoeje og grafen kan komme laengere op. Naar kortet
			     er foldet sammen, staar det samme hoved der. Kun grafen og
			     listen forsvinder. -->
			<button class="udv-hoved" aria-expanded={aaben} onclick={() => fold('overskud')}>
				<span class="udv-venstre">
					<span class="udv-k">{kurveTitel}</span>
					{#if forskelTekst(stortForskel)}
						<span class="udv-chip-tal" class:ned={(stortForskel ?? 0) < 0}>
							{forskelTekst(stortForskel)}
						</span>
					{/if}
				</span>
				{#if stortTal !== null}
					<span class="udv-tal">
						<span class="udv-n">{formatTal(stortTal)}</span>
						<span class="udv-af">af 10</span>
					</span>
				{/if}
				<span class="udv-fold" aria-hidden="true">{aaben ? '⌄' : '›'}</span>
			</button>

			{#if aaben}
				<div class="udv-krop">
					{#if tilstand === 'flere'}
						<!-- Samme geometri som forsiden, men tegnet til en LYS flade.
				     Forsidens kurve staar paa en moerk plomme-baggrund og kan
				     derfor ikke genbruges som komponent uden at rette i den,
				     og forsiden er den mest brugte skaerm i appen. -->
						<div class="udv-kurve">
							<svg
								viewBox="0 0 {kurve.flade.bredde} {kurve.flade.hoejde}"
								role="img"
								aria-label={`${kurveTitel}, fra ${formatTal(kurve.foerste?.vaerdi ?? 0)} til ${formatTal(kurve.seneste?.vaerdi ?? 0)} af 10`}
							>
								<!-- Y-aksen. Den daekker hendes EGNE tal og ikke hele skalaen
						     fra 1 til 10. Linns valg: hun vil hellere se bevaegelsen
						     tydeligt end se hvor langt der er til ti. Tallene runder
						     ud til hele, saa der aldrig staar 3,8. Se beregnAkse. -->
								{#if kurve.akse.midt !== null}
									{@const yMidt = (kurve.flade.yTop + kurve.flade.yBund) / 2}
									<line
										x1={kurve.flade.akseBredde}
										y1={kurve.flade.yTop}
										x2={kurve.flade.xHoejre}
										y2={kurve.flade.yTop}
										stroke="var(--line)"
										stroke-width="1"
									/>
									<line
										x1={kurve.flade.akseBredde}
										y1={yMidt}
										x2={kurve.flade.xHoejre}
										y2={yMidt}
										stroke="var(--line)"
										stroke-width="1"
										stroke-dasharray="2 3"
									/>
									<line
										x1={kurve.flade.akseBredde}
										y1={kurve.flade.yBund}
										x2={kurve.flade.xHoejre}
										y2={kurve.flade.yBund}
										stroke="var(--line)"
										stroke-width="1"
									/>
									<text class="udv-v-akse" x={kurve.flade.akseBredde - 5} y={kurve.flade.yTop + 3}>
										{kurve.akse.hoej}
									</text>
									<text class="udv-v-akse" x={kurve.flade.akseBredde - 5} y={yMidt + 3}>
										{kurve.akse.midt}
									</text>
									<text class="udv-v-akse" x={kurve.flade.akseBredde - 5} y={kurve.flade.yBund + 3}>
										{kurve.akse.lav}
									</text>
								{/if}

								{#each kurve.baand as b (b.fraMs + b.navn)}
									<rect
										x={b.x}
										y={kurve.flade.baandTop}
										width={b.bredde}
										height={kurve.flade.baandHoejde}
										rx="6"
										fill="var(--plum-tint)"
										opacity="0.55"
									/>
									<rect
										x={b.x}
										y={kurve.flade.baandStregY}
										width={b.bredde}
										height={kurve.flade.baandStregHoejde}
										rx="1.5"
										fill={baandFarve(b.produkt)}
									/>
									<!-- Navnet staar HVOR forloebet laa, i stedet for i en
							     forklaring under flisen man skal slaa op i. Linns
							     beslutning 18. august. Er baandet for smalt til navnet,
							     springes det over, ellers ville to hold stoede sammen. -->
									{#if b.bredde >= 34}
										<text class="udv-v-baand" x={b.x} y={kurve.flade.baandTekstY}>
											{holdNavn(b.navn)}
										</text>
									{/if}
								{/each}

								{#each kurve.pauser as p, i (i)}
									<rect
										x={p.x}
										y={kurve.flade.baandStregY}
										width={p.bredde}
										height={kurve.flade.baandStregHoejde}
										rx="1.5"
										fill="var(--line)"
									/>
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

								<!-- Fladen under linjen. En tynd streg i en stor flise ser tom
						     ud, en flade goer ikke. Toningen doer ud mod bunden, saa
						     den ikke bliver en klods. -->
								<defs>
									<linearGradient id="udv-fyld" x1="0" y1="0" x2="0" y2="1">
										<stop offset="0%" stop-color="var(--plum)" stop-opacity="0.26" />
										<stop offset="100%" stop-color="var(--plum)" stop-opacity="0" />
									</linearGradient>
								</defs>
								{#each kurve.fyld as f, i (i)}
									<path d={f} fill="url(#udv-fyld)" />
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
									<!-- Kun hendes FOERSTE tal staar paa kurven. Det seneste
							     staar allerede stort oeverst i flisen, og tallene
							     undervejs kraevede en tom stribe i toppen som kurven
							     kunne have brugt. -->
									{#if i === 0}
										<text class="udv-v-tal" x={p.x} y={p.y - 9} text-anchor="start">
											{formatTal(p.vaerdi)}
										</text>
									{/if}
									{#if p.erSidste}
										<text class="udv-v-lab" x={p.x} y={kurve.flade.datoY} text-anchor="end">
											{formaterKortDato(p.ms, nu)}
										</text>
									{/if}
								{/each}
							</svg>
						</div>
					{:else}
						<p class="udv-mrk">
							Det her er din baseline, altså dit udgangspunkt. Den bruger vi til at måle alt det
							andet imod.
						</p>
					{/if}

					{#if tilstand === 'foerste'}
						<div class="kort rolig">
							Når du har lavet din næste måling, kan du se hvordan det har rykket sig.
							{#if status.tekst}{status.tekst}.{/if}
						</div>
					{/if}

					{#if liste.length > 0}
						<div class="udv-under">
							<div class="lab"><h2>Siden du startede</h2></div>
							{#if kanVaelge}
								<p class="udv-hint">Tryk på en linje for at se den i kurven ovenfor.</p>
							{/if}
							<div class="udv-liste">
								<!-- "Samlet" staar oeverst som en raekke paa lige fod med de
					     fem. Uden den var eneste vej tilbage til det samlede at
					     trykke paa den valgte raekke igen, og det er der ingen der
					     gaetter. Linns oenske 18. august. -->
								{#if kanVaelge && overblik}
									<button
										class="udv-raekke udv-vaelg udv-samlet"
										class:valgt={valgt === null}
										aria-pressed={valgt === null}
										onclick={() => (valgt = null)}
									>
										<span class="udv-navn">Samlet</span>
										<span class="udv-bar" aria-hidden="true">
											<i class="foer" style={`width:${bredde(overblik.foer)}%`}></i>
											<i class="nu" style={`width:${bredde(overblik.nu)}%`}></i>
										</span>
										<span class="udv-ft">
											{formatTal(overblik.foer)} → <b>{formatTal(overblik.nu)}</b>
										</span>
										<span class="udv-pil" aria-hidden="true">{valgt === null ? '⌄' : '›'}</span>
									</button>
								{/if}

								{#each liste as f (f.id)}
									{#if kanVaelge}
										<!-- Linjen ER knappen. Der var foer en raekke runde knapper
							     oeverst paa siden, men de fyldte to linjer og skubbede
							     hendes tal ned. Linns beslutning 18. august: navnene
							     staar her i forvejen, saa hun trykker paa det hun
							     undrer sig over. Et tryk mere foerer tilbage. -->
										<button
											class="udv-raekke udv-vaelg"
											class:valgt={valgt === f.id}
											aria-pressed={valgt === f.id}
											onclick={() => (valgt = valgt === f.id ? null : f.id)}
										>
											<span class="udv-navn">{f.kort}</span>
											<span class="udv-bar" aria-hidden="true">
												<i class="foer" style={`width:${bredde(f.foer)}%`}></i>
												<i class="nu" style={`width:${bredde(f.nu)}%`}></i>
											</span>
											<span class="udv-ft">{formatTal(f.foer)} → <b>{formatTal(f.nu)}</b></span>
											<span class="udv-pil" aria-hidden="true">{valgt === f.id ? '⌄' : '›'}</span>
										</button>
									{:else}
										<div class="udv-raekke">
											<span class="udv-navn">{f.kort}</span>
											<span class="udv-bar" aria-hidden="true">
												<i class="foer" style={`width:${bredde(f.foer)}%`}></i>
												<i class="nu" style={`width:${bredde(f.nu)}%`}></i>
											</span>
											<span class="udv-ft"><b>{formatTal(f.nu)}</b></span>
										</div>
									{/if}
								{/each}
							</div>

							{#if bedst}
								<p class="udv-mrk">
									{bedst.kort.toLowerCase().replace(/^(min|mit|mine) /, '')} har rykket sig mest, fra
									{formatTal(bedst.foer)} til {formatTal(bedst.nu)}.
								</p>
							{/if}
						</div>
					{/if}
				</div>
			{/if}
		</section>

		<!-- ── Symptomer ─────────────────────────────────────────────
		     Linns valg: tallet staar som det er, 0 til 44, hvor 0 er bedst.
		     Vi vender det IKKE om, for saa ville de to sider vise
		     forskellige tal for det samme. En FALDENDE kurve er sejren
		     her, og det modsatte alle andre steder paa siden. Derfor
		     graennen og linjen der siger det med rene ord. -->
		{#if symptom}
			{@const aabenSym = aabent === 'symptomer'}
			<section class="udv-omraade" class:aaben={aabenSym}>
				<button class="udv-hoved" aria-expanded={aabenSym} onclick={() => fold('symptomer')}>
					<span class="udv-venstre">
						<span class="udv-k">Symptomer</span>
						{#if symptom.faerre !== null && symptom.faerre !== 0}
							<!-- Faerre gener er fremgang. "siden start" skal med, ellers
							     er det ikke til at se hvad de 13 er. -->
							<span class="udv-chip-tal" class:ned={symptom.faerre < 0}>
								{symptom.faerre > 0 ? '↓' : '↑'}
								{formatTal(Math.abs(symptom.faerre))}
								{symptom.faerre > 0 ? 'færre' : 'flere'} siden start
							</span>
						{/if}
					</span>
					<span class="udv-tal">
						<span class="udv-n">{formatTal(symptom.nu)}</span>
						<span class="udv-af">af 44</span>
					</span>
					<span class="udv-fold" aria-hidden="true">{aabenSym ? '⌄' : '›'}</span>
				</button>

				{#if aabenSym}
					<div class="udv-krop">
						{#if symptomKurven.length > 1}
							<div class="udv-kurve">
								<svg
									viewBox="0 0 {symptomGraf.flade.bredde} {symptomGraf.flade.hoejde}"
									width="100%"
									height={symptomGraf.flade.hoejde}
									role="img"
									aria-label={`Dine gener, fra ${formatTal(symptom.foer)} til ${formatTal(symptom.nu)} af 44`}
								>
									{#if symptomGraf.akse.midt !== null}
										{@const yM = (symptomGraf.flade.yTop + symptomGraf.flade.yBund) / 2}
										<line
											x1={symptomGraf.flade.akseBredde}
											y1={symptomGraf.flade.yTop}
											x2={symptomGraf.flade.xHoejre}
											y2={symptomGraf.flade.yTop}
											stroke="var(--line)"
											stroke-width="1"
										/>
										<line
											x1={symptomGraf.flade.akseBredde}
											y1={yM}
											x2={symptomGraf.flade.xHoejre}
											y2={yM}
											stroke="var(--line)"
											stroke-width="1"
											stroke-dasharray="2 3"
										/>
										<line
											x1={symptomGraf.flade.akseBredde}
											y1={symptomGraf.flade.yBund}
											x2={symptomGraf.flade.xHoejre}
											y2={symptomGraf.flade.yBund}
											stroke="var(--line)"
											stroke-width="1"
										/>
										<text
											class="udv-v-akse"
											x={symptomGraf.flade.akseBredde - 5}
											y={symptomGraf.flade.yTop + 3}>{symptomGraf.akse.hoej}</text
										>
										<text class="udv-v-akse" x={symptomGraf.flade.akseBredde - 5} y={yM + 3}
											>{symptomGraf.akse.midt}</text
										>
										<text
											class="udv-v-akse"
											x={symptomGraf.flade.akseBredde - 5}
											y={symptomGraf.flade.yBund + 3}>{symptomGraf.akse.lav}</text
										>
									{/if}

									{#each symptomGraf.baand as b (b.fraMs + b.navn)}
										<rect
											x={b.x}
											y={symptomGraf.flade.baandTop}
											width={b.bredde}
											height={symptomGraf.flade.baandHoejde}
											rx="6"
											fill="var(--sage-tint)"
											opacity="0.5"
										/>
										<rect
											x={b.x}
											y={symptomGraf.flade.baandStregY}
											width={b.bredde}
											height={symptomGraf.flade.baandStregHoejde}
											rx="1.5"
											fill={baandFarve(b.produkt)}
										/>
										{#if b.bredde >= 34}
											<text class="udv-v-baand" x={b.x} y={symptomGraf.flade.baandTekstY}
												>{holdNavn(b.navn)}</text
											>
										{/if}
									{/each}

									<defs>
										<linearGradient id="sym-fyld" x1="0" y1="0" x2="0" y2="1">
											<stop offset="0%" stop-color="var(--sage-tekst)" stop-opacity="0.24" />
											<stop offset="100%" stop-color="var(--sage-tekst)" stop-opacity="0" />
										</linearGradient>
									</defs>
									{#each symptomGraf.fyld as f, i (i)}
										<path d={f} fill="url(#sym-fyld)" />
									{/each}
									{#each symptomGraf.stier as st, i (i)}
										<path
											d={st}
											fill="none"
											stroke="var(--sage-tekst)"
											stroke-width="2.5"
											stroke-linecap="round"
											stroke-linejoin="round"
										/>
									{/each}
									{#each symptomGraf.punkter as p, i (p.ms)}
										{#if p.visPrik}
											<circle
												cx={p.x}
												cy={p.y}
												r={p.erSidste ? 5.2 : 3.4}
												fill={p.erSidste ? 'var(--sage-tekst)' : 'var(--ink-3)'}
												stroke={p.erSidste ? 'var(--paper)' : 'none'}
												stroke-width={p.erSidste ? 2 : 0}
											/>
										{/if}
										{#if i === 0}
											<text class="udv-v-tal" x={p.x} y={p.y - 9} text-anchor="start"
												>{formatTal(p.vaerdi)}</text
											>
										{/if}
										{#if p.erSidste}
											<text class="udv-v-lab" x={p.x} y={symptomGraf.flade.datoY} text-anchor="end"
												>{formaterKortDato(p.ms, nu)}</text
											>
										{/if}
									{/each}
								</svg>
							</div>
						{/if}
						<p class="udv-mrk">{symptomTekst(symptom)}</p>
					</div>
				{/if}
			</section>
		{/if}

		<!-- ── Traening ──────────────────────────────────────────────
		     Linns valg: maaned mod maaned, i minutter. Der er INTET maal
		     at ramme ved siden af. Hun sammenlignes kun med sig selv. -->
		{#if traening}
			{@const aabenTr = aabent === 'traening'}
			<section class="udv-omraade" class:aaben={aabenTr}>
				<button class="udv-hoved" aria-expanded={aabenTr} onclick={() => fold('traening')}>
					<span class="udv-venstre">
						<span class="udv-k">Mikrotræning</span>
						<!-- Plakaten staar KUN naar det er gaaet frem, og den siger
						     hvad der sammenlignes med. Foer stod der bare "↓ 46 min",
						     og Linn kunne ikke se hvad de 46 var. Det var ogsaa i
						     modstrid med teksten under, som bevidst ikke naevner et
						     fald. Samme regel som paa 30-30 dage. -->
						{#if traening.forskel !== null && traening.forskel > 0 && traening.forrigeSammeTid}
							<span class="udv-chip-tal">
								↑ {traening.forskel}
								{traening.enhed === 'minutter' ? 'min' : 'gange'} mere end samme tid i {traening
									.forrigeSammeTid.navn}
							</span>
						{/if}
					</span>
					<span class="udv-tal">
						<span class="udv-n">{traening.denne.vaerdi}</span>
						<span class="udv-af">{traening.enhed === 'minutter' ? 'min' : 'gange'}</span>
					</span>
					<span class="udv-fold" aria-hidden="true">{aabenTr ? '⌄' : '›'}</span>
				</button>

				{#if aabenTr}
					<div class="udv-krop">
						<div class="udv-maaneder">
							{#each traening.maaneder as m (m.noegle)}
								<div class="udv-md" class:nu={m.noegle === traening.denne.noegle}>
									<span class="udv-md-n">{m.navn.slice(0, 3)}</span>
									<span class="udv-md-bar" aria-hidden="true">
										<i style={`width:${soejleBredde(m.vaerdi, stoersteMaaned(traening))}%`}></i>
									</span>
									<span class="udv-md-v">{m.vaerdi > 0 ? m.vaerdi : ''}</span>
								</div>
							{/each}
						</div>
						<p class="udv-mrk">{traeningTekst(traening)}</p>
						{#if traening.enhed === 'traeninger'}
							<p class="udv-hint">
								Vi begyndte at gemme hvor længe du træner 18. august, så indtil videre tæller vi
								gange.
							</p>
						{/if}
					</div>
				{/if}
			</section>
		{/if}

		<!-- ── Mad ───────────────────────────────────────────────────
		     Vi taeller DAGE hvor hun spiste efter 30-30, ikke et
		     gennemsnit. Linns valg 18. august: "86,6 g i snit" er et tal
		     ingen kunde taenker i. Metoden er det hun goer noget ved. -->
		{#if mad}
			{@const aabenMad = aabent === 'mad'}
			<section class="udv-omraade" class:aaben={aabenMad}>
				<button class="udv-hoved" aria-expanded={aabenMad} onclick={() => fold('mad')}>
					<span class="udv-venstre">
						<span class="udv-k">30-30 dage</span>
						{#if mad.forskel !== null && mad.forskel > 0 && mad.forrigeSammeTid}
							<span class="udv-chip-tal">
								↑ {mad.forskel} mere end samme tid i {mad.forrigeSammeTid.navn}
							</span>
						{/if}
					</span>
					<span class="udv-tal">
						<span class="udv-n">{mad.denne.vaerdi}</span>
						<span class="udv-af">{mad.denne.vaerdi === 1 ? 'dag' : 'dage'}</span>
					</span>
					<span class="udv-fold" aria-hidden="true">{aabenMad ? '⌄' : '›'}</span>
				</button>

				{#if aabenMad}
					<div class="udv-krop">
						<div class="udv-maaneder">
							{#each mad.maaneder as m (m.noegle)}
								<div class="udv-md" class:nu={m.noegle === mad.denne.noegle}>
									<span class="udv-md-n">{m.navn.slice(0, 3)}</span>
									<span class="udv-md-bar" aria-hidden="true">
										<i style={`width:${soejleBredde(m.vaerdi, stoersteMaaned(mad))}%`}></i>
									</span>
									<span class="udv-md-v">{m.vaerdi > 0 ? m.vaerdi : ''}</span>
								</div>
							{/each}
						</div>
						<p class="udv-mrk">{madTekst(mad)}</p>
						<p class="udv-hint">
							En 30-30-dag er 90 g protein og 30 g fiber over hele dagen. Det er ligegyldigt hvordan
							det er fordelt, og snacken tæller med.
						</p>
						{#if mad.registrerede > 0}
							<p class="udv-hint">
								Du har registreret mad {dagOrd(mad.registrerede)} i {mad.denne.navn}.
							</p>
						{/if}
					</div>
				{/if}
			</section>
		{/if}
	{/if}
</div>
