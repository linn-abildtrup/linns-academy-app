<script lang="ts">
	// ============================================================
	// Admin: hvem ser udvidet naering, og hvem maa rette sine maal.
	//
	// Linns beslutning 22. august 2026, se mockups-naering-admin.html.
	//
	// HVORFOR DEN IKKE ER DEN GAMLE SIDE. "Funktioner og adgang" i den
	// gamle admin styrer det samme i dag, men pr KUNDETYPE og ikke pr
	// forloeb, og den styrer den gamle app for 760 kunder samtidig. Den
	// bliver staaende urørt.
	//
	// TRE LAG: undtagelse paa kunden vinder over forloebet, forloebet
	// vinder over medlems-linjen. Reglen ligger i content/naeringAdgang3.
	//
	// ALT ER TIL SOM STANDARD. Linn slaar fra, ikke til.
	// ============================================================

	import { getContext } from 'svelte';
	import type { User } from 'firebase/auth';
	import { isAdmin } from '$lib/admin';
	import { klientSoegeMatch } from '$lib/utils/klientSoegning';
	import { harRegel3, type NaeringRegel3, type NaeringRegler3 } from '$lib/content/naeringAdgang3';
	import {
		fjernUndtagelse3,
		gemNaeringRegler3,
		gemUndtagelse3,
		hentNaeringRegler3,
		hentUndtagelser3,
		type Undtagelse3
	} from '$lib/firestore/naeringAdgang3';
	import { hentAlleForlob } from '$lib/firestore/forlob';
	import type { Forlob } from '$lib/content/forlobAdgang';
	import {
		aktiveForlobNavne3,
		forlobKilder3,
		hentKlienter3,
		type Klient3
	} from '$lib/firestore/traeningKunde3';
	import Sidehoved from '$lib/components/ny/Sidehoved.svelte';
	import Ventetegn from '$lib/components/ny/Ventetegn.svelte';

	const hentUser = getContext<() => User | null>('user');
	const user = $derived(hentUser());
	const maaVaereHer = $derived(isAdmin(user));

	let henter = $state(true);
	let gemmer = $state(false);
	let fejl = $state('');
	let regler = $state<NaeringRegler3>({ medlemmer: {}, forlob: {} });
	let forlob = $state<{ id: string; navn: string; antalDage: number }[]>([]);
	let undtagelser = $state<Undtagelse3[]>([]);
	let kunder = $state<Klient3[]>([]);
	let forlobKilder = $state<ReturnType<typeof forlobKilder3>>([]);
	let soegeord = $state('');

	$effect(() => {
		if (!maaVaereHer) return;
		let afbrudt = false;
		(async () => {
			const [r, f, u, k] = await Promise.all([
				hentNaeringRegler3(),
				hentAlleForlob(),
				hentUndtagelser3(),
				hentKlienter3()
			]);
			if (afbrudt) return;
			regler = { medlemmer: r.medlemmer ?? {}, forlob: r.forlob ?? {} };
			forlob = f.map((x: Forlob) => ({ id: x.id, navn: x.navn, antalDage: x.antalDage ?? 0 }));
			forlobKilder = forlobKilder3(f);
			undtagelser = u;
			kunder = k;
			henter = false;
		})().catch((e) => {
			console.error('[ny] kunne ikke hente naerings-skemaet', e);
			fejl = 'Kunne ikke hente skemaet.';
			henter = false;
		});
		return () => {
			afbrudt = true;
		};
	});

	/** Vaerdien der gaelder for en raekke. Usat betyder til. */
	function vaerdi(r: NaeringRegel3 | undefined, felt: keyof NaeringRegel3): boolean {
		return r?.[felt] ?? true;
	}

	async function skiftMedlem(felt: keyof NaeringRegel3) {
		if (gemmer) return;
		const ny = { ...regler, medlemmer: { ...regler.medlemmer, [felt]: !vaerdi(regler.medlemmer, felt) } };
		await skriv(ny);
	}

	async function skiftForlob(id: string, felt: keyof NaeringRegel3) {
		if (gemmer) return;
		const nu = regler.forlob?.[id] ?? {};
		const ny: NaeringRegler3 = {
			...regler,
			forlob: { ...regler.forlob, [id]: { ...nu, [felt]: !vaerdi(nu, felt) } }
		};
		await skriv(ny);
	}

	async function skriv(ny: NaeringRegler3) {
		const foer = regler;
		regler = ny;
		gemmer = true;
		fejl = '';
		try {
			await gemNaeringRegler3(ny);
		} catch (e) {
			console.error('[ny] kunne ikke gemme skemaet', e);
			regler = foer;
			fejl = 'Kunne ikke gemme. Prøv igen.';
		} finally {
			gemmer = false;
		}
	}

	const fundne = $derived(
		soegeord.trim().length < 2
			? []
			: kunder.filter((k) => klientSoegeMatch(k.soegetekst, soegeord)).slice(0, 8)
	);

	/** Hendes aktive hold, eller "Uden forloeb". Til linjen under navnet. */
	function holdFor(k: Klient3): string {
		const navne = aktiveForlobNavne3(k, forlobKilder, Date.now()).map((f) => f.navn);
		return navne.length ? navne.join(', ') : 'Uden forløb';
	}

	async function saetUndtagelse(k: Klient3, felt: keyof NaeringRegel3, til: boolean) {
		if (gemmer) return;
		gemmer = true;
		fejl = '';
		try {
			const nu = undtagelser.find((u) => u.uid === k.uid);
			await gemUndtagelse3(k.uid, { ...nu, [felt]: til }, k.navn, holdFor(k));
			undtagelser = await hentUndtagelser3();
			soegeord = '';
		} catch (e) {
			console.error('[ny] kunne ikke saette undtagelsen', e);
			fejl = 'Kunne ikke gemme undtagelsen.';
		} finally {
			gemmer = false;
		}
	}

	async function fjern(uid: string) {
		if (gemmer) return;
		gemmer = true;
		try {
			await fjernUndtagelse3(uid);
			undtagelser = undtagelser.filter((u) => u.uid !== uid);
		} catch (e) {
			console.error('[ny] kunne ikke fjerne undtagelsen', e);
			fejl = 'Kunne ikke fjerne den.';
		} finally {
			gemmer = false;
		}
	}

	/** Kort tekst paa en undtagelse: hvad er der egentlig sat. */
	function undtagelseTekst(u: Undtagelse3): string {
		const dele: string[] = [];
		if (typeof u.udvidet === 'boolean') dele.push(u.udvidet ? 'Udvidet TIL' : 'Udvidet FRA');
		if (typeof u.maaRette === 'boolean')
			dele.push(u.maaRette ? 'Må rette mål' : 'Må ikke rette mål');
		return dele.join(' · ');
	}
</script>

<div class="ny-pad naering-admin">
	<Sidehoved
		titel="Næring"
		tilbage="/ny/admin"
		tilbageTekst="Admin"
		under="Hvem ser kulhydrat, fedt og kalorier, og hvem må rette sine egne mål."
		kant={false}
	/>

	{#if !maaVaereHer}
		<div class="kort rolig">Siden er kun for admin.</div>
	{:else if henter}
		<div class="lektion-venter">
			<Ventetegn variant="lille" />
			<span>Henter skemaet</span>
		</div>
	{:else}
		{#if fejl}
			<div class="kort rolig nm-fejl">{fejl}</div>
		{/if}

		<div class="lab"><h2>Medlemmer uden forløb</h2></div>
		<section class="kort">
			<div class="na-raekke">
				<div class="na-navn">Alle medlemmer</div>
				<div class="na-sub">Gælder også de forløb du ikke selv har sat.</div>
				<div class="na-knapper">
					<button class="na-k" onclick={() => skiftMedlem('udvidet')} disabled={gemmer}>
						<span class="na-sw" class:on={vaerdi(regler.medlemmer, 'udvidet')}><i></i></span>
						Udvidet næring
					</button>
					<button class="na-k" onclick={() => skiftMedlem('maaRette')} disabled={gemmer}>
						<span class="na-sw" class:on={vaerdi(regler.medlemmer, 'maaRette')}><i></i></span>
						Må rette mål
					</button>
				</div>
			</div>
		</section>

		<div class="lab"><h2>Forløb</h2></div>
		<section class="kort">
			{#each forlob as f (f.id)}
				{@const r = regler.forlob?.[f.id]}
				<div class="na-raekke">
					<div class="na-navn">{f.navn}</div>
					<div class="na-sub">
						{f.antalDage} dage{harRegel3(r) ? '' : ' · arver medlemmer'}
					</div>
					<div class="na-knapper">
						<button class="na-k" onclick={() => skiftForlob(f.id, 'udvidet')} disabled={gemmer}>
							<span class="na-sw" class:on={vaerdi(r, 'udvidet')}><i></i></span>
							Udvidet næring
						</button>
						<button class="na-k" onclick={() => skiftForlob(f.id, 'maaRette')} disabled={gemmer}>
							<span class="na-sw" class:on={vaerdi(r, 'maaRette')}><i></i></span>
							Må rette mål
						</button>
					</div>
				</div>
			{/each}
		</section>

		<div class="lab"><h2>Undtagelser</h2></div>
		<section class="kort">
			<input class="na-soeg" type="search" placeholder="Søg efter en kunde…" bind:value={soegeord} />

			{#each fundne as k (k.uid)}
				<div class="na-fund">
					<div>
						<div class="na-fund-n">{k.navn}</div>
						<div class="na-fund-s">{holdFor(k)}</div>
					</div>
					<div class="na-fund-k">
						<button onclick={() => saetUndtagelse(k, 'udvidet', true)} disabled={gemmer}>
							Udvidet til
						</button>
						<button onclick={() => saetUndtagelse(k, 'udvidet', false)} disabled={gemmer}>
							Udvidet fra
						</button>
					</div>
				</div>
			{/each}

			{#if undtagelser.length === 0}
				<div class="na-tom">Ingen undtagelser. Alle følger deres forløb.</div>
			{:else}
				{#each undtagelser as u (u.uid)}
					<div class="na-und">
						<div>
							<div class="na-und-n">{u.navn}</div>
							<div class="na-und-s">{u.under}</div>
						</div>
						<span class="na-pille" class:fra={u.udvidet === false || u.maaRette === false}>
							{undtagelseTekst(u)}
						</span>
						<button class="na-x" onclick={() => fjern(u.uid)} disabled={gemmer} aria-label="Fjern">
							×
						</button>
					</div>
				{/each}
			{/if}
		</section>

		<div class="kort rolig na-forklaring">
			Rækkefølgen appen spørger i: en undtagelse på kunden vinder, ellers gælder forløbet, ellers
			medlems-linjen. Og selvom hun må, ser hun det først når hun selv slår det til på Dine mål.
		</div>
	{/if}
</div>
