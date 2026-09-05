<script lang="ts">
	// ============================================================
	// Admin: skriv til én kunde.
	//
	// Beskeden lander i hendes Beskeder som en traad, og hun kan svare
	// paa den. Svaret havner i Linns almindelige liste over spoergsmaal,
	// hvor hun svarer som hun plejer. Der er ikke en ny indbakke.
	//
	// DER ER INGEN OVERSKRIFT AT SKRIVE. Notifikationen siger altid "Linn
	// har skrevet til dig", og de foerste ord af beskeden staar under.
	// Ét felt faerre at tage stilling til. Linns valg 23. august.
	//
	// DEN KAN IKKE KALDES TILBAGE, og det staar paa skaermen inden hun
	// trykker. En besked paa forsiden kan rettes, den her er afleveret.
	//
	// ÉT BILLEDE ELLER ÉN LYDBESKED kan haenge paa beskeden, ved siden af
	// teksten. Filen laegges i KUNDENS EGEN MAPPE i Storage foer beskeden
	// sendes, og hun er den eneste ud over Linn der maa aabne den.
	//
	// DU SER DET FOER DU SENDER. Beskeden kan ikke kaldes tilbage, saa
	// billedet vises og lyden kan hoeres inden knappen bliver aktiv.
	//
	// LAVET OM 1. september 2026 til det nye admin-udseende. Siden saa ud
	// som en telefonskaerm med sidehoved og tilbage-pil, midt i en menu
	// der staar til venstre paa en computer. Nu bruger den de samme seks
	// byggeklodser som de nitten andre. INTET er aendret i hvad den goer.
	//
	// Se HANDOVER 9.43.
	// ============================================================

	import { getContext, onDestroy } from 'svelte';
	import type { User } from 'firebase/auth';
	import { isAdmin } from '$lib/admin';
	import { klientSoegeMatch } from '$lib/utils/klientSoegning';
	import { hentAlleForlob } from '$lib/firestore/forlob';
	import type { Forlob } from '$lib/content/forlobAdgang';
	import {
		aktiveForlobNavne3,
		forlobKilder3,
		hentKlienter3,
		type Klient3
	} from '$lib/firestore/traeningKunde3';
	import AdmSide from '$lib/components/admin/AdmSide.svelte';
	import AdmKort from '$lib/components/admin/AdmKort.svelte';
	import AdmKnap from '$lib/components/admin/AdmKnap.svelte';
	import AdmSoeg from '$lib/components/admin/AdmSoeg.svelte';
	import AdmTom from '$lib/components/admin/AdmTom.svelte';
	import { gemBeskedBillede, gemBeskedLyd, type LagtOpBillede } from '$lib/firestore/beskedFil3';
	import { filStoerrelse, formaterSekunder, LYD_MAKS_SEKUNDER } from '$lib/content/beskedFil3';
	import Lydbesked from '$lib/components/ny/Lydbesked.svelte';

	const hentUser = getContext<() => User | null>('user');
	const user = $derived(hentUser());
	const maaVaereHer = $derived(isAdmin(user));

	let henter = $state(true);
	let sender = $state(false);
	let fejl = $state('');
	let kvittering = $state('');
	let kunder = $state<Klient3[]>([]);
	let kilder = $state<ReturnType<typeof forlobKilder3>>([]);
	let soegeord = $state('');
	let valgt = $state<Klient3 | null>(null);
	let tekst = $state('');

	// ── Billedet ────────────────────────────────────────────
	/** Den valgte fil, som den ser ud i browseren foer den er sendt. */
	let billedFil = $state<File | null>(null);
	let billedForhaandUrl = $state('');
	let billedFejl = $state('');
	let lagtOp = $state<LagtOpBillede | null>(null);
	let laegerOp = $state(false);
	/** Adressen paa den lyd der allerede er lagt op, saa den ikke sendes to gange. */
	let lagtOpLyd = $state('');

	// ── Lydbeskeden ─────────────────────────────────────────
	/** Den faerdige optagelse, som den ser ud foer den er sendt. */
	let lydBlob = $state<Blob | null>(null);
	let lydForhaandUrl = $state('');
	let lydSekunder = $state(0);
	let optager = $state(false);
	let lydFejl = $state('');
	/** Kan browseren optage. Er svaret nej, skifter knappen til filvalg. */
	let kanOptage = $state(true);

	/** Stregerne under tiden. Pynt, saa skaermen ikke staar stille. */
	const BOELGER = [10, 19, 29, 14, 24, 33, 12, 21, 30, 15, 26, 9, 20, 28, 13, 22, 31, 11];

	let optagelse: MediaRecorder | null = null;
	let optagelseStumper: Blob[] = [];
	let ur: ReturnType<typeof setInterval> | null = null;
	let startetMs = 0;

	/** Der er noget at sende. Styrer Send-knappen. */
	const harNoget = $derived(!!tekst.trim() || !!billedFil || !!lydBlob);

	function stopUret() {
		if (ur) clearInterval(ur);
		ur = null;
	}

	async function startOptagelse() {
		if (optager) return;
		lydFejl = '';
		try {
			const spor = await navigator.mediaDevices.getUserMedia({ audio: true });
			// Chrome optager i webm, Safari i mp4. Vi beder ikke om et
			// bestemt format: browseren giver det den kan, og begge kan
			// afspille hinandens.
			optagelse = new MediaRecorder(spor);
			optagelseStumper = [];
			fjernLyd();
			fjernBillede();

			optagelse.ondataavailable = (e) => {
				if (e.data.size) optagelseStumper.push(e.data);
			};
			optagelse.onstop = () => {
				// Mikrofonen slippes altid. Ellers bliver den staaende med
				// den roede prik i browserfanen bagefter.
				spor.getTracks().forEach((t) => t.stop());
				stopUret();
				optager = false;
				const type = optagelse?.mimeType || 'audio/webm';
				const blob = new Blob(optagelseStumper, { type });
				optagelseStumper = [];
				if (!blob.size) {
					lydFejl = 'Der kom ingen lyd med. Prøv igen.';
					return;
				}
				lydBlob = blob;
				lydForhaandUrl = URL.createObjectURL(blob);
			};

			optagelse.start();
			startetMs = Date.now();
			lydSekunder = 0;
			optager = true;
			ur = setInterval(() => {
				lydSekunder = Math.floor((Date.now() - startetMs) / 1000);
				// DEN STOPPER SELV VED FEM MINUTTER, og det hun har sagt
				// indtil da bliver liggende. En times fejloptagelse skal
				// aldrig kunne sendes.
				if (lydSekunder >= LYD_MAKS_SEKUNDER) stopOptagelse();
			}, 250);
		} catch (e) {
			console.error('[skriv] kunne ikke optage', e);
			// Enten sagde browseren nej til mikrofonen, eller ogsaa kan den
			// slet ikke optage. Begge dele skal ende samme sted: et sted
			// hvor hun stadig kan sende en lydbesked.
			kanOptage = false;
			lydFejl =
				'Din browser gav ikke adgang til mikrofonen. Du kan optage i Memoer og vælge filen her i stedet.';
			optager = false;
			stopUret();
		}
	}

	function stopOptagelse() {
		if (!optagelse || optagelse.state === 'inactive') return;
		optagelse.stop();
	}

	function vaelgLydfil(e: Event) {
		const input = e.target as HTMLInputElement;
		const fil = input.files?.[0];
		input.value = '';
		if (!fil) return;
		if (!fil.type.startsWith('audio/')) {
			lydFejl = 'Filen skal være en lydfil.';
			return;
		}
		lydFejl = '';
		fjernLyd();
		fjernBillede();
		lydBlob = fil;
		lydForhaandUrl = URL.createObjectURL(fil);
		// Laengden kendes foerst naar filen er laest. Afspilleren siger den
		// selv, saa her staar der bare nul indtil da.
		lydSekunder = 0;
	}

	function fjernLyd() {
		if (lydForhaandUrl) URL.revokeObjectURL(lydForhaandUrl);
		lydForhaandUrl = '';
		lydBlob = null;
		lydSekunder = 0;
	}

	function vaelgBillede(e: Event) {
		const input = e.target as HTMLInputElement;
		const fil = input.files?.[0];
		// Feltet nulstilles med det samme, saa den samme fil kan vaelges
		// igen efter den er fjernet.
		input.value = '';
		if (!fil) return;
		if (!fil.type.startsWith('image/')) {
			billedFejl = 'Filen skal være et billede.';
			return;
		}
		billedFejl = '';
		fjernForhaand();
		// ÉN FIL PR BESKED. Skal der baade lyd og billede til, er det to
		// beskeder, og saa er baade skaermen og hendes traad rolig.
		fjernLyd();
		billedFil = fil;
		billedForhaandUrl = URL.createObjectURL(fil);
		lagtOp = null;
	}

	function fjernForhaand() {
		if (billedForhaandUrl) URL.revokeObjectURL(billedForhaandUrl);
		billedForhaandUrl = '';
	}

	function fjernBillede() {
		fjernForhaand();
		billedFil = null;
		lagtOp = null;
		billedFejl = '';
	}

	$effect(() => {
		if (!maaVaereHer) return;
		let afbrudt = false;
		(async () => {
			const [k, f] = await Promise.all([hentKlienter3(), hentAlleForlob()]);
			if (afbrudt) return;
			kunder = k;
			kilder = forlobKilder3(f as Forlob[]);
			henter = false;
		})().catch((e) => {
			console.error('[noti] kunne ikke hente kunderne', e);
			fejl = 'Kunne ikke hente kunderne.';
			henter = false;
		});
		return () => {
			afbrudt = true;
		};
	});

	const fundne = $derived(
		soegeord.trim().length < 2
			? []
			: kunder.filter((k) => klientSoegeMatch(k.soegetekst, soegeord)).slice(0, 8)
	);

	function holdFor(k: Klient3): string {
		const navne = aktiveForlobNavne3(k, kilder, Date.now()).map((f) => f.navn);
		return navne.length ? navne.join(', ') : 'Uden forløb';
	}

	// Forlader hun siden midt i en optagelse, skal mikrofonen slippes og
	// uret stoppe. Ellers bliver den roede prik staaende i browserfanen.
	onDestroy(() => {
		stopUret();
		if (optagelse && optagelse.state !== 'inactive') optagelse.stop();
		fjernForhaand();
		fjernLyd();
	});

	async function send() {
		const u = user;
		const kunde = valgt;
		if (!u || !kunde || sender || !harNoget) return;
		sender = true;
		fejl = '';
		kvittering = '';
		try {
			// FILEN FOERST. Gaar uploaden galt, er der ingen besked hos
			// kunden der peger paa et billede der ikke kom frem.
			let billedUrl = lagtOp?.url ?? '';
			if (billedFil && !billedUrl) {
				laegerOp = true;
				const r = await gemBeskedBillede(kunde.uid, billedFil);
				lagtOp = r;
				billedUrl = r.url;
				laegerOp = false;
			}

			let lydUrl = lagtOpLyd;
			if (lydBlob && !lydUrl) {
				laegerOp = true;
				const r = await gemBeskedLyd(kunde.uid, lydBlob);
				lagtOpLyd = r.url;
				lydUrl = r.url;
				laegerOp = false;
			}

			const token = await u.getIdToken();
			const res = await fetch('/api/ny-skriv', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
				body: JSON.stringify({
					uid: kunde.uid,
					tekst: tekst.trim(),
					...(billedUrl ? { billedUrl } : {}),
					...(lydUrl ? { lydUrl, lydSekunder: Math.round(lydSekunder) } : {})
				})
			});
			if (!res.ok) {
				fejl = `Det gik galt (${res.status}). Beskeden blev ikke sendt.`;
				return;
			}
			const r = (await res.json()) as {
				sendt: number;
				sprunget: string | null;
				mail?: boolean;
			};
			const hvad = lydUrl ? 'lydbeskeden' : billedUrl ? 'billedet' : 'den';
			// Beskeden ligger i hendes app uanset hvad. Prikket er en ekstra
			// tjeneste, og linjen her siger hvad der faktisk skete.
			kvittering =
				r.sendt > 0
					? `Sendt. Hun har ${hvad} i Beskeder, og hun blev prikket på telefonen.`
					: r.mail
						? `Sendt. Hun har ${hvad} i Beskeder, og hun fik en mail. Telefonen kunne ikke nås.`
						: r.sprunget === 'ingen-telefon'
							? `Sendt. Hun har ${hvad} i Beskeder, men hun kunne hverken nås på telefon eller mail.`
							: r.sprunget === 'slaaet-fra'
								? `Sendt. Hun har ${hvad} i Beskeder, men hun har slået notifikationer fra.`
								: `Sendt. Hun har ${hvad} i Beskeder.`;
			tekst = '';
			fjernBillede();
			fjernLyd();
			lagtOpLyd = '';
		} catch (e) {
			console.error('[noti] kunne ikke skrive', e);
			// Uploaden er den mest sandsynlige der fejler, og saa skal der
			// staa hvad hun kan goere ved det.
			fejl = laegerOp
				? 'Filen kunne ikke lægges op. Beskeden blev ikke sendt.'
				: 'Kunne ikke sende.';
		} finally {
			laegerOp = false;
			sender = false;
		}
	}
</script>

<svelte:head><title>Skriv til en kunde · Admin</title></svelte:head>

{#if !maaVaereHer}
	<p class="ns-kun">Siden er kun for admin.</p>
{:else}
	<AdmSide
		titel="Skriv til en kunde"
		under="Beskeden lander i hendes Beskeder, og hun kan svare på den."
	>
		{#if fejl}<div class="ns-fejl">{fejl}</div>{/if}

		{#if henter}
			<AdmTom tekst="Henter kunderne…" />
		{:else if kunder.length === 0}
			<AdmTom tekst={fejl || 'Kunne ikke hente kunderne.'} fejl />
		{:else}
			<AdmKort>
				{#if !valgt}
					<AdmSoeg bind:vaerdi={soegeord} placeholder="Søg efter en kunde…" />

					{#if fundne.length > 0}
						<div class="ns-liste">
							{#each fundne as k (k.uid)}
								<button type="button" class="ns-raekke" onclick={() => (valgt = k)}>
									<span>
										<span class="ns-navn">{k.navn}</span>
										<span class="ns-hold">{holdFor(k)}</span>
									</span>
									<span class="ns-pil">›</span>
								</button>
							{/each}
						</div>
					{:else if soegeord.trim().length >= 2}
						<p class="ns-hint">Ingen med det navn.</p>
					{:else}
						<p class="ns-hint">Skriv mindst to bogstaver for at søge.</p>
					{/if}
				{:else}
					<div class="ns-valgt">
						<div>
							<span class="ns-navn">{valgt.navn}</span>
							<span class="ns-hold">{holdFor(valgt)}</span>
						</div>
						<AdmKnap onclick={() => (valgt = null)}>Vælg en anden</AdmKnap>
					</div>

					<textarea
						class="ns-felt"
						rows="5"
						placeholder="Skriv din besked til hende…"
						bind:value={tekst}
					></textarea>

					{#if optager}
						<!-- Mens hun taler. Tiden loeber, og hun kan se at der
						     bliver optaget. -->
						<div class="ns-optager">
							<div class="ns-optager-status"><span class="ns-rp"></span>Optager</div>
							<div class="ns-tid">{formaterSekunder(lydSekunder)}</div>
							<div class="ns-boelge" aria-hidden="true">
								{#each BOELGER as h, i (i)}
									<i style="height:{h}px"></i>
								{/each}
							</div>
							<div class="ns-knapper ns-midt">
								<AdmKnap slags="primaer" onclick={stopOptagelse}>Stop optagelsen</AdmKnap>
							</div>
							<p class="ns-graense">Højst {LYD_MAKS_SEKUNDER / 60} minutter</p>
						</div>
					{:else if lydBlob}
						<!-- HOER DEN FOER DU SENDER. Beskeden kan ikke kaldes
						     tilbage, saa den samme afspiller som kunden faar
						     staar her. -->
						<div class="ns-lyd">
							<Lydbesked url={lydForhaandUrl} sekunder={lydSekunder} maerkat="Din lydbesked" />
						</div>
						<div class="ns-knapper">
							{#if kanOptage}
								<AdmKnap disabled={sender} onclick={startOptagelse}>Optag igen</AdmKnap>
							{/if}
							<AdmKnap disabled={sender} onclick={fjernLyd}>Fjern lyden</AdmKnap>
						</div>
					{:else if billedFil}
						<div class="ns-fil">
							<img class="ns-mini" src={billedForhaandUrl} alt="Det valgte billede" />
							<div class="ns-fil-tekst">
								<span class="ns-navn">{billedFil.name}</span>
								<span class="ns-hold">
									{filStoerrelse(billedFil.size)}
									{#if lagtOp}→ {filStoerrelse(lagtOp.bytes)} · lagt op{:else}· skrumpes når du
										sender{/if}
								</span>
							</div>
							<AdmKnap disabled={sender} onclick={fjernBillede}>Fjern</AdmKnap>
						</div>
					{:else}
						<div class="ns-vedhaeft">
							{#if kanOptage}
								<button type="button" class="ns-v" onclick={startOptagelse}>
									🎙 Optag lydbesked
								</button>
							{:else}
								<label class="ns-v">
									<input type="file" accept="audio/*" onchange={vaelgLydfil} />
									<span>🎵 Vælg lydfil</span>
								</label>
							{/if}
							<label class="ns-v">
								<input type="file" accept="image/*" onchange={vaelgBillede} />
								<span>🖼 Vælg billede</span>
							</label>
						</div>
					{/if}

					{#if billedFejl}<p class="ns-filfejl">{billedFejl}</p>{/if}
					{#if lydFejl}<p class="ns-filfejl">{lydFejl}</p>{/if}

					<div class="ns-advarsel">
						Beskeden kan ikke kaldes tilbage. Skal det være noget alle skal se, og som du kan rette
						igen, så brug Besked på forsiden i stedet.
					</div>

					<div class="ns-knapper">
						<AdmKnap slags="primaer" disabled={sender || optager || !harNoget} onclick={send}>
							{laegerOp ? 'Lægger filen op…' : sender ? 'Sender…' : 'Send besked'}
						</AdmKnap>
					</div>
				{/if}

				{#if kvittering}<div class="ns-kvittering">{kvittering}</div>{/if}
			</AdmKort>
		{/if}
	</AdmSide>
{/if}

<style>
	.ns-kun {
		padding: 24px 18px;
		color: var(--ink-2);
		font-size: calc(14px * var(--fs-scale, 1) * var(--adm-skala, 1));
	}

	.ns-fejl {
		margin-bottom: 12px;
		padding: 11px 15px;
		border-radius: 12px;
		background: var(--ler-tint, #f4e6de);
		color: var(--ler-tekst, #8a5439);
		font-size: calc(13.5px * var(--fs-scale, 1) * var(--adm-skala, 1));
		font-weight: 600;
	}

	.ns-liste {
		display: flex;
		flex-direction: column;
		gap: 5px;
		margin-top: 12px;
	}

	.ns-raekke {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
		width: 100%;
		padding: 11px 14px;
		background: var(--paper, #fbf8f2);
		border: none;
		border-radius: 11px;
		font-family: inherit;
		text-align: left;
		cursor: pointer;
	}

	.ns-pil {
		color: var(--ink-3, #a3948a);
		font-size: calc(17px * var(--fs-scale, 1) * var(--adm-skala, 1));
	}

	.ns-navn {
		display: block;
		font-size: calc(14px * var(--fs-scale, 1) * var(--adm-skala, 1));
		font-weight: 600;
		color: var(--espresso, #382c2a);
	}

	.ns-hold {
		display: block;
		font-size: calc(11.5px * var(--fs-scale, 1) * var(--adm-skala, 1));
		color: var(--ink-3, #a3948a);
	}

	.ns-hint {
		margin: 12px 0 0;
		font-size: calc(12.5px * var(--fs-scale, 1) * var(--adm-skala, 1));
		color: var(--ink-3, #a3948a);
	}

	.ns-valgt {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
		flex-wrap: wrap;
		padding: 12px 14px;
		background: var(--paper, #fbf8f2);
		border-radius: 11px;
		margin-bottom: 12px;
	}

	.ns-felt {
		display: block;
		width: 100%;
		padding: 12px 14px;
		background: var(--paper, #fbf8f2);
		border: 1px solid var(--line, #e8dfd1);
		border-radius: 13px;
		color: var(--espresso, #382c2a);
		font-family: inherit;
		font-size: calc(14px * var(--fs-scale, 1) * var(--adm-skala, 1));
		line-height: 1.5;
		resize: vertical;
		box-sizing: border-box;
	}

	.ns-advarsel {
		margin-top: 12px;
		padding: 11px 14px;
		background: var(--honey-tint, #f7ecd7);
		border-radius: 13px;
		color: var(--honey-deep, #b47f3e);
		font-size: calc(12.5px * var(--fs-scale, 1) * var(--adm-skala, 1));
		line-height: 1.5;
	}

	.ns-vedhaeft {
		display: flex;
		gap: 10px;
		margin-top: 12px;
	}

	.ns-v {
		flex: 1;
		display: block;
		font-family: inherit;
		padding: 11px 8px;
		border: 1px dashed #d9cdbb;
		border-radius: 13px;
		background: var(--paper, #fbf8f2);
		color: var(--plum, #7c4f63);
		font-size: calc(13px * var(--fs-scale, 1) * var(--adm-skala, 1));
		font-weight: 600;
		text-align: center;
		cursor: pointer;
	}

	/* Selve filfeltet er grimt i alle browsere og ser forskelligt ud i
	   hver. Etiketten er knappen, og feltet gemmes helt vaek. */
	.ns-v input {
		position: absolute;
		width: 1px;
		height: 1px;
		opacity: 0;
		pointer-events: none;
	}

	.ns-fil {
		display: flex;
		align-items: center;
		gap: 12px;
		flex-wrap: wrap;
		margin-top: 12px;
		padding: 12px 14px;
		background: var(--paper, #fbf8f2);
		border-radius: 13px;
	}

	.ns-mini {
		width: 64px;
		height: 64px;
		flex-shrink: 0;
		border-radius: 12px;
		object-fit: cover;
	}

	.ns-fil-tekst {
		flex: 1;
		min-width: 120px;
	}

	.ns-optager {
		margin-top: 12px;
		padding: 16px;
		background: var(--plum-tint, #f1e5e8);
		border-radius: 14px;
		text-align: center;
	}

	.ns-optager-status {
		font-size: calc(11px * var(--fs-scale, 1) * var(--adm-skala, 1));
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--plum, #7c4f63);
		margin-bottom: 6px;
	}

	.ns-rp {
		display: inline-block;
		width: 9px;
		height: 9px;
		border-radius: 50%;
		background: #b2445f;
		margin-right: 6px;
	}

	.ns-tid {
		font-size: calc(32px * var(--fs-scale, 1) * var(--adm-skala, 1));
		font-weight: 600;
		letter-spacing: 0.03em;
		color: var(--plum-deep, #5e3a4b);
		line-height: 1.1;
	}

	.ns-boelge {
		display: flex;
		align-items: flex-end;
		justify-content: center;
		gap: 3px;
		height: 34px;
		margin: 11px 0 4px;
	}

	.ns-boelge i {
		width: 3.5px;
		border-radius: 2px;
		background: var(--plum, #7c4f63);
		opacity: 0.55;
	}

	.ns-midt {
		justify-content: center;
	}

	.ns-graense {
		margin: 9px 0 0;
		font-size: calc(12px * var(--fs-scale, 1) * var(--adm-skala, 1));
		color: var(--ink-3, #a3948a);
	}

	.ns-lyd {
		margin-top: 12px;
	}

	.ns-filfejl {
		margin: 10px 0 0;
		font-size: calc(12.5px * var(--fs-scale, 1) * var(--adm-skala, 1));
		color: var(--ler-tekst, #8a5439);
		font-weight: 600;
	}

	.ns-knapper {
		display: flex;
		gap: 8px;
		flex-wrap: wrap;
		margin-top: 12px;
	}

	.ns-kvittering {
		margin-top: 12px;
		padding: 12px 14px;
		background: var(--sage-tint, #e7efe5);
		border-radius: 13px;
		color: var(--sage-tekst, #46603f);
		font-size: calc(13px * var(--fs-scale, 1) * var(--adm-skala, 1));
		font-weight: 600;
	}
</style>
