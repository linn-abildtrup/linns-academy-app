<script lang="ts">
	// ============================================================
	// Ét forloeb set bagfra: alle lektionerne, i raekkefoelge.
	//
	// Linns beslutning 18. august. Hun ville have det aktive forloeb med
	// paa listen og ikke kun de gennemfoerte, saa kunden har ét sted at
	// se hele forloebet. Derfor staar lektioner hun ikke er naaet til med
	// paa listen, men graa og uden link, med den dato de aabner.
	//
	// Forloebets navn og hvor langt hun er, laeser vi ud af adgangs-
	// billedet som skallen allerede har hentet. Det koster ingen ekstra
	// opslag, og et forloeb hun ikke har vaeret paa findes derfor slet
	// ikke her.
	// ============================================================

	import { getContext } from 'svelte';
	import { page } from '$app/state';
	import type { User } from 'firebase/auth';
	import type { UserDoc } from '$lib/types';
	import type { Adgangsbillede } from '$lib/content/adgang3';
	import {
		byggLektionsliste,
		byggNoteliste,
		bonusTekst,
		forlobAdgang,
		gennemfoertTekst,
		lektionerMedNote,
		opgoerSete,
		type ListeLektion
	} from '$lib/content/lektionsliste3';
	import { detekterGuideType, erLydLektion, videoThumbnail } from '$lib/content/bibliotek';
	import { hentLektionsdage3 } from '$lib/firestore/lektionsliste3';
	import { hentKlaret } from '$lib/firestore/forside3';
	import { hentNoterForForlob } from '$lib/firestore/lektionNoter';
	import Fluebe from '$lib/components/ny/Fluebe.svelte';
	import Ventetegn from '$lib/components/ny/Ventetegn.svelte';

	const hentUser = getContext<() => User | null>('user');
	const hentAdgang = getContext<() => Adgangsbillede>('adgang');
	const hentUserDoc = getContext<() => UserDoc | null>('userDoc');
	const user = $derived(hentUser());
	const adgang = $derived(hentAdgang());
	const userDoc = $derived(hentUserDoc());

	const forlobId = $derived(page.params.forlobId ?? '');

	// Koerer forloebet lige nu, eller er det et hun har vaeret paa.
	const aktivt = $derived(adgang.aktiveForlob.find((f) => f.forlobId === forlobId) ?? null);
	const tidligere = $derived(adgang.gennemfoerte.find((f) => f.forlobId === forlobId) ?? null);

	const navn = $derived(aktivt?.navn ?? tidligere?.navn ?? '');
	const kendt = $derived(Boolean(aktivt || tidligere));

	// De 90 dages bibliotek-bonus. Er de gaaet, staar kun hendes egne noter
	// tilbage. Linns beslutning 18. august: noterne er hendes ord og foelger
	// ikke adgangen til Linns materiale.
	const bonusSlutMs = $derived(userDoc?.bonusPeriodEndsAt ?? null);
	const forlobsAdgang = $derived(
		forlobAdgang(Boolean(aktivt), {
			harApp: adgang.harApp,
			bonusSlutMs,
			nu: Date.now()
		})
	);
	const lukket = $derived(forlobsAdgang === 'lukket');
	const undertekst = $derived(
		aktivt
			? aktivt.antalDage > 0
				? `Dag ${aktivt.dagNummer} af ${aktivt.antalDage}`
				: `Dag ${aktivt.dagNummer}`
			: tidligere
				? gennemfoertTekst(tidligere.slutMs)
				: ''
	);

	let liste = $state<ListeLektion[]>([]);
	let klaret = $state<Set<string>>(new Set());
	let noter = $state<{ lektionId: string; tekst: string; opdateret: number }[]>([]);
	let henter = $state(true);

	// To faner: lektionerne og hendes egne noter. Noterne staar i deres
	// egen fane og ikke spredt ud i listen, saa hun kan laese dem i ét
	// straek naar hun ser tilbage paa et forloeb.
	let fane = $state<'lektioner' | 'noter'>('lektioner');

	$effect(() => {
		const uid = user?.uid;
		const id = forlobId;
		const aktivDag = aktivt ? aktivt.dagNummer : null;
		const lukketNu = lukket;
		if (!uid || !id || !kendt) {
			henter = false;
			return;
		}

		let afbrudt = false;
		(async () => {
			henter = true;
			// Noterne maa gerne fejle for sig. Kan vi ikke naa dem, skal
			// lektionerne stadig staa der.
			const [dage, k, n] = await Promise.all([
				hentLektionsdage3(id),
				hentKlaret(uid),
				hentNoterForForlob(uid, id).catch((e) => {
					console.warn('[ny] kunne ikke hente noterne', e);
					return [];
				})
			]);
			if (afbrudt) return;
			// Er forloebet lukket, bygger vi ingen lektions-liste. Noterne
			// hentes stadig, for de er hendes egne.
			liste = lukketNu ? [] : byggLektionsliste(dage, { aktivDagNummer: aktivDag, nu: Date.now() });
			klaret = k;
			noter = n.map((x) => ({
				lektionId: x.lektionId,
				tekst: x.tekst,
				opdateret: x.opdateret
			}));
			henter = false;
		})().catch((e) => {
			console.error('[ny] kunne ikke hente forloebets lektioner', e);
			henter = false;
		});

		return () => {
			afbrudt = true;
		};
	});

	const tal = $derived(opgoerSete(liste, klaret));
	const medNote = $derived(lektionerMedNote(noter));
	const noteliste = $derived(byggNoteliste(liste, noter));

	// Har Linn taget alle lektionerne ned, men hendes noter staar tilbage,
	// giver det ingen mening at aabne paa en tom lektions-fane.
	const visFane = $derived(liste.length === 0 ? 'noter' : fane);

	/** Hvilken slags indhold lektionen er. Samme skoen som paa forsiden. */
	function art(url: string): 'lyd' | 'video' | 'tekst' {
		if (erLydLektion(url)) return 'lyd';
		const t = detekterGuideType(url);
		if (t === 'video') return 'video';
		if (t === 'audio') return 'lyd';
		return 'tekst';
	}

	const IKON: Record<string, string> = { lyd: '♪', video: '▶', tekst: '✦' };

	function meta(p: ListeLektion): string {
		const a = art(p.lektion.url);
		const dele = [`Dag ${p.dagNummer}`, a === 'lyd' ? 'Lyd' : a === 'video' ? 'Video' : 'Læsning'];
		if (p.lektion.varighedMin) dele.push(`${p.lektion.varighedMin} min`);
		return dele.join(' · ');
	}

	/**
	 * Adressen paa lektionen. Forloebet sendes med, fordi afspilleren ellers
	 * slaar op i det forloeb der koerer lige nu, og saa kan en lektion fra et
	 * tidligere hold ikke findes.
	 */
	function lektionsUrl(p: ListeLektion): string {
		return `/ny/lektion/${p.dagNummer}/${p.lektion.id}?forlob=${encodeURIComponent(forlobId)}`;
	}
</script>

<div class="ny-pad lektionsliste-side">
	<header class="side-top">
		<a class="tilbage" href="/ny/profil">‹ Din konto</a>
		<h1>{kendt ? navn : 'Forløbet findes ikke'}</h1>
		{#if kendt && undertekst}
			<p>{undertekst}</p>
		{/if}
	</header>

	{#if !kendt}
		<div class="kort rolig">
			Du har ikke været på det her forløb.
			<a href="/ny/profil">Tilbage til din konto</a>
		</div>
	{:else if henter}
		<div class="lektion-venter">
			<Ventetegn variant="lille" />
			<span>Henter lektionerne</span>
		</div>
	{:else if liste.length === 0 && noteliste.length === 0}
		<div class="kort rolig">
			{#if lukket}
				Materialet fra det her forløb er lukket, og du skrev ingen noter undervejs.
			{:else}
				Der er ikke lagt lektioner op på det her forløb.
			{/if}
		</div>
	{:else}
		{#if lukket}
			<p class="ll-baand lukket">
				Materialet fra det her forløb er lukket, men dine egne noter bliver stående.
			</p>
		{:else if forlobsAdgang === 'bonus' && bonusSlutMs !== null}
			<p class="ll-baand">
				{bonusTekst(bonusSlutMs, Date.now())}. Derefter står kun dine egne noter tilbage.
			</p>
		{/if}

		<!-- Fanerne staar kun frem naar der er noget i begge. Har hun ingen
		     noter skrevet, er en tom fane bare stoej. -->
		{#if noteliste.length > 0 && liste.length > 0}
			<div class="ll-faner" role="tablist">
				<button
					class="ll-fane"
					class:aktiv={visFane === 'lektioner'}
					role="tab"
					aria-selected={visFane === 'lektioner'}
					onclick={() => (fane = 'lektioner')}
				>
					Lektioner
				</button>
				<button
					class="ll-fane"
					class:aktiv={visFane === 'noter'}
					role="tab"
					aria-selected={visFane === 'noter'}
					onclick={() => (fane = 'noter')}
				>
					Mine noter <span class="ll-antal">{noteliste.length}</span>
				</button>
			</div>
		{/if}

		{#if visFane === 'noter'}
			<div class="ll-noter">
				{#each noteliste as n (n.lektionId)}
					<article class="ll-note">
						<div class="ll-note-top">
							<span class="ll-note-t">{n.titel}</span>
							{#if n.dagNummer !== null}<span class="ll-note-dag">Dag {n.dagNummer}</span>{/if}
						</div>
						<p class="ll-note-tekst">{n.tekst}</p>
						{#if n.aaben}
							<a
								class="link-knap"
								href={`/ny/lektion/${n.dagNummer}/${n.lektionId}?forlob=${encodeURIComponent(forlobId)}`}
							>
								Åbn lektionen
							</a>
						{/if}
					</article>
				{/each}
			</div>
		{:else}
			<p class="ll-opgoer">
				Du har set {tal.sete} af {tal.aabne}
				{tal.aabne === 1 ? 'lektion' : 'lektioner'}{#if tal.ialt > tal.aabne}, og {tal.ialt -
						tal.aabne} venter forude{/if}.
			</p>

			<div class="medie-liste">
				{#each liste as p (`${p.dagNummer}-${p.lektion.id}`)}
					{@const erKlaret = klaret.has(p.lektion.id)}
					{@const billede = p.lektion.thumbnailUrl || videoThumbnail(p.lektion.url)}

					{#if p.aaben}
						<a class="medie-raekke" class:set={erKlaret} href={lektionsUrl(p)}>
							<span class="medie-thumb {art(p.lektion.url)}">
								{#if erKlaret}
									<span class="rund-fluebe stor" aria-hidden="true"><Fluebe /></span>
								{:else if billede}
									<img class="medie-foto" src={billede} alt="" loading="lazy" />
									<span class="medie-play" aria-hidden="true">{IKON[art(p.lektion.url)]}</span>
								{:else}
									<span class="medie-glyph" aria-hidden="true">{IKON[art(p.lektion.url)]}</span>
								{/if}
							</span>

							<span class="medie-tekst">
								<span class="medie-t">{p.lektion.titel}</span>
								<span class="medie-m">
									{#if erKlaret}<span class="klar-tekst">Set</span> · se igen{:else}{meta(p)}{/if}
								</span>
							</span>
							{#if medNote.has(p.lektion.id)}
								<span class="ll-blyant" title="Du har skrevet en note">✎</span>
							{/if}
							<span class="medie-pil" aria-hidden="true">›</span>
						</a>
					{:else}
						<!-- Laast. Ingen a, saa hverken mus eller tastatur kan aabne den. -->
						<div class="medie-raekke ll-laast">
							<span class="medie-thumb tekst">
								<span class="medie-glyph" aria-hidden="true">🔒</span>
							</span>
							<span class="medie-tekst">
								<span class="medie-t">{p.lektion.titel}</span>
								<span class="medie-m">Dag {p.dagNummer}</span>
							</span>
							<span class="ll-aabner">{p.aabnerTekst}</span>
						</div>
					{/if}
				{/each}
			</div>

			{#if tal.ialt > tal.aabne}
				<p class="kort rolig">
					Lektionerne åbner efterhånden som du når dem. Du kan altid gå tilbage til dem du har set.
				</p>
			{/if}
		{/if}
	{/if}
</div>
