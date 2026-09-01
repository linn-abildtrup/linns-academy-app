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

	import { getContext } from 'svelte';
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
	import { gemBeskedBillede, type LagtOpBillede } from '$lib/firestore/beskedFil3';
	import { filStoerrelse } from '$lib/content/beskedFil3';

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

	/** Der er noget at sende. Styrer Send-knappen. */
	const harNoget = $derived(!!tekst.trim() || !!billedFil);

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

			const token = await u.getIdToken();
			const res = await fetch('/api/ny-skriv', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
				body: JSON.stringify({
					uid: kunde.uid,
					tekst: tekst.trim(),
					...(billedUrl ? { billedUrl } : {})
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
			const hvad = billedUrl ? 'billedet' : 'den';
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
		} catch (e) {
			console.error('[noti] kunne ikke skrive', e);
			// Uploaden er den mest sandsynlige der fejler, og saa skal der
			// staa hvad hun kan goere ved det.
			fejl = laegerOp
				? 'Billedet kunne ikke lægges op. Beskeden blev ikke sendt.'
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

					{#if billedFil}
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
							<label class="ns-v">
								<input type="file" accept="image/*" onchange={vaelgBillede} />
								<span>🖼 Vælg billede</span>
							</label>
						</div>
					{/if}

					{#if billedFejl}<p class="ns-filfejl">{billedFejl}</p>{/if}

					<div class="ns-advarsel">
						Beskeden kan ikke kaldes tilbage. Skal det være noget alle skal se, og som du kan rette
						igen, så brug Besked på forsiden i stedet.
					</div>

					<div class="ns-knapper">
						<AdmKnap slags="primaer" disabled={sender || !harNoget} onclick={send}>
							{laegerOp ? 'Lægger billedet op…' : sender ? 'Sender…' : 'Send besked'}
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
		font-size: calc(14px * var(--fs-scale, 1));
	}

	.ns-fejl {
		margin-bottom: 12px;
		padding: 11px 15px;
		border-radius: 12px;
		background: var(--ler-tint, #f4e6de);
		color: var(--ler-tekst, #8a5439);
		font-size: calc(13.5px * var(--fs-scale, 1));
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
		font-size: calc(17px * var(--fs-scale, 1));
	}

	.ns-navn {
		display: block;
		font-size: calc(14px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--espresso, #382c2a);
	}

	.ns-hold {
		display: block;
		font-size: calc(11.5px * var(--fs-scale, 1));
		color: var(--ink-3, #a3948a);
	}

	.ns-hint {
		margin: 12px 0 0;
		font-size: calc(12.5px * var(--fs-scale, 1));
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
		font-size: calc(14px * var(--fs-scale, 1));
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
		font-size: calc(12.5px * var(--fs-scale, 1));
		line-height: 1.5;
	}

	.ns-vedhaeft {
		display: flex;
		gap: 10px;
		margin-top: 12px;
	}

	.ns-v {
		flex: 1;
		padding: 11px 8px;
		border: 1px dashed #d9cdbb;
		border-radius: 13px;
		background: var(--paper, #fbf8f2);
		color: var(--plum, #7c4f63);
		font-size: calc(13px * var(--fs-scale, 1));
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

	.ns-filfejl {
		margin: 10px 0 0;
		font-size: calc(12.5px * var(--fs-scale, 1));
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
		font-size: calc(13px * var(--fs-scale, 1));
		font-weight: 600;
	}
</style>
