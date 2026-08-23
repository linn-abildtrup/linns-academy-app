<script lang="ts">
	// ============================================================
	// "Beskeder paa telefonen", set fra kunden.
	//
	// HVORFOR SIDEN FINDES. Uden den har hun kun telefonens egne
	// indstillinger, og dér er valget ALT ELLER INTET. Saa slaar hun det
	// hele fra for at slippe for én slags, og saa mister hun ogsaa den om
	// at Linn har svaret. Linns beslutning 23. august, se HANDOVER 9.39.
	//
	// HUN KAN KUN SLAA FRA. Har Linn lukket en slags for hendes hold, kan
	// hun ikke aabne den, og saa staar den slet ikke paa listen. Ingen
	// graa raekke der forklarer hvad hun ikke maa, samme regel som i
	// traeningen.
	// ============================================================

	import { getContext } from 'svelte';
	import type { User } from 'firebase/auth';
	import type { UserDoc } from '$lib/types';
	import type { Adgangsbillede } from '$lib/content/adgang3';
	import {
		NOTI_NAVNE3,
		NOTI_SLAGS3,
		maaSende3,
		type NotiRegler3,
		type NotiValg3,
		type NotiValgSlags3
	} from '$lib/content/notifikation3';
	import {
		gemNotiValg3,
		hentNotiRegler3,
		hentNotiValg3,
		hentTelefoner3
	} from '$lib/firestore/notifikation3';
	import {
		hjemmeskaermTrin3,
		notiTilstand3,
		sigJaTilBeskeder3,
		type NotiTilstand3
	} from '$lib/utils/notiTilmeld3';
	import Sidehoved from '$lib/components/ny/Sidehoved.svelte';
	import Ventetegn from '$lib/components/ny/Ventetegn.svelte';

	const hentUser = getContext<() => User | null>('user');
	const hentUserDoc = getContext<() => UserDoc | null>('userDoc');
	const hentAdgang = getContext<() => Adgangsbillede>('adgang');
	const user = $derived(hentUser());
	const userDoc = $derived(hentUserDoc());
	const forlobId = $derived(hentAdgang().aktiveForlob[0]?.forlobId ?? null);

	let tilstand = $state<NotiTilstand3>('kan-ikke');
	let regler = $state<NotiRegler3>({});
	let valg = $state<NotiValg3>({});
	let antalTelefoner = $state(0);
	let henter = $state(true);
	let gemmer = $state(false);
	let fejl = $state('');
	const hjemmeskaerm = hjemmeskaermTrin3();

	$effect(() => {
		const uid = user?.uid;
		if (!uid) return;
		let afbrudt = false;
		tilstand = notiTilstand3();
		(async () => {
			const [r, v, t] = await Promise.all([
				hentNotiRegler3(),
				hentNotiValg3(uid),
				hentTelefoner3(uid)
			]);
			if (afbrudt) return;
			regler = r;
			valg = v;
			antalTelefoner = t.filter((x) => !('doed' in x)).length;
			henter = false;
		})().catch((e) => {
			console.error('[noti] kunne ikke hente indstillingerne', e);
			henter = false;
		});
		return () => {
			afbrudt = true;
		};
	});

	/** Kun dem Linn tillader for hende. Resten staar slet ikke. */
	const synlige = $derived(
		NOTI_SLAGS3.filter((s) => maaSende3(s, regler, null, forlobId))
	);

	const slaaetTil = $derived((s: NotiValgSlags3) => valg[s] !== false);

	async function skift(s: NotiValgSlags3) {
		const uid = user?.uid;
		if (!uid || gemmer) return;
		const foer = valg;
		valg = { ...valg, [s]: !slaaetTil(s) };
		gemmer = true;
		fejl = '';
		try {
			await gemNotiValg3(uid, valg);
		} catch (e) {
			console.error('[noti] kunne ikke gemme', e);
			valg = foer;
			fejl = 'Kunne ikke gemme. Prøv igen.';
		} finally {
			gemmer = false;
		}
	}

	async function sigJa() {
		const uid = user?.uid;
		if (!uid || gemmer) return;
		gemmer = true;
		const r = await sigJaTilBeskeder3(uid);
		gemmer = false;
		tilstand = notiTilstand3();
		if (r.ok) antalTelefoner += 1;
	}
</script>

<div class="ny-pad noti-side">
	<Sidehoved
		titel="Beskeder på telefonen"
		tilbage="/ny/profil"
		tilbageTekst="Din side"
		under="Du bestemmer hvad jeg må sige til om."
		kant={false}
	/>

	{#if henter}
		<div class="lektion-venter">
			<Ventetegn variant="lille" />
			<span>Henter dine indstillinger</span>
		</div>
	{:else}
		{#if fejl}
			<div class="kort rolig nm-fejl">{fejl}</div>
		{/if}

		{#if tilstand === 'kan-ikke'}
			<div class="kort rolig">
				Din browser kan ikke tage imod beskeder. Prøv at åbne appen på din telefon.
			</div>
		{:else if tilstand === 'ikke-hjemmeskaerm'}
			<section class="kort">
				<div class="nt-t">Læg appen på din hjemmeskærm først</div>
				<div class="nt-s">Uden det kan telefonen ikke sige til, og det er ikke noget vi bestemmer.</div>
				{#each hjemmeskaerm.trin as t, i (t)}
					<div class="nt-trin"><b>{i + 1}</b><span>{t}</span></div>
				{/each}
				<div class="nt-note">{hjemmeskaerm.note}</div>
			</section>
		{:else if tilstand === 'sagt-nej'}
			<section class="kort">
				<div class="nt-t">Du har sagt nej til beskeder</div>
				<div class="nt-s">
					Det kan jeg ikke lave om herfra. Åbn telefonens indstillinger, find Linn's Academy, og
					slå meddelelser til. Så virker det med det samme.
				</div>
			</section>
		{:else if tilstand === 'ikke-spurgt'}
			<section class="kort">
				<div class="nt-t">Må jeg sige til?</div>
				<div class="nt-s">
					Så hører du fra mig når der er noget, også når appen er lukket. Du kan slå det fra igen
					her.
				</div>
				<button class="nt-knap" disabled={gemmer} onclick={sigJa}>
					{gemmer ? 'Et øjeblik' : 'Ja tak'}
				</button>
			</section>
		{/if}

		{#if tilstand === 'sagt-ja'}
			<section class="kort">
				{#each synlige as s (s)}
					<div class="nk">
						<div>
							<div class="nk-t">{NOTI_NAVNE3[s].navn}</div>
							<div class="nk-s">{NOTI_NAVNE3[s].forklaring}</div>
						</div>
						<button
							class="nk-sw"
							class:on={slaaetTil(s)}
							disabled={gemmer}
							aria-pressed={slaaetTil(s)}
							aria-label={NOTI_NAVNE3[s].navn}
							onclick={() => skift(s)}><i></i></button
						>
					</div>
				{/each}
			</section>

			<div class="kort rolig nt-bund">
				Slår du dem alle fra, hører du ikke fra appen. Du kan altid slå dem til igen.
				{#if antalTelefoner > 1}
					Du får dem på {antalTelefoner} enheder.
				{/if}
			</div>
		{/if}
	{/if}
</div>
