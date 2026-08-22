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
	//
	// LISTEN ER DELT OP I UGER. Linns beslutning 18. august, efter at
	// Kropsro viste sig at vaere 227 linjer hvor over hundrede var den
	// samme video igen og igen. Ugerne staar foldet sammen, saa hun kan se
	// alle tolv paa én skaerm, og live-Q&A ligger oeverst for sig selv,
	// fordi de ellers ville forsvinde nede i uge otte. Selve opdelingen
	// sker i lektionsUger3, og reglerne staar forklaret der.
	// ============================================================

	import { getContext, tick } from 'svelte';
	import { page } from '$app/state';
	import type { User } from 'firebase/auth';
	import type { UserDoc } from '$lib/types';
	import type { Adgangsbillede } from '$lib/content/adgang3';
	import {
		byggLektionsliste,
		byggNoteliste,
		forlobAdgang,
		gennemfoertTekst,
		lektionerMedNote,
		opgoerSete,
		type ListeLektion
	} from '$lib/content/lektionsliste3';
	import { byggUger, seteIUge, ugeNavn, type Uge } from '$lib/content/lektionsUger3';
	import { detekterGuideType, erLydLektion } from '$lib/content/bibliotek';
	import { hentLektionsdage3 } from '$lib/firestore/lektionsliste3';
	import { hentKlaret } from '$lib/firestore/forside3';
	import { hentNoterForForlob } from '$lib/firestore/lektionNoter';
	import Fluebe from '$lib/components/ny/Fluebe.svelte';
	import { erSet3 } from '$lib/content/lektionSet3';
	import Ventetegn from '$lib/components/ny/Ventetegn.svelte';
	import Sidehoved from '$lib/components/ny/Sidehoved.svelte';

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

	const opdeling = $derived(byggUger(liste));

	/**
	 * Lektionerne som de faktisk staar paa skaermen, altsaa uden de
	 * gentagelser ugerne har fjernet. Taellingen oeverst skal passe med
	 * det hun kan se, ikke med hvor mange raekker der ligger i databasen.
	 */
	const viste = $derived([
		...opdeling.qa,
		...opdeling.uger.flatMap((u) => u.poster.map((p) => p.post))
	]);
	const tal = $derived(opgoerSete(viste, klaret));

	/**
	 * Kun én uge aaben ad gangen. Koerer forloebet, staar den uge hun er i
	 * aaben fra start. Er forloebet slut, staar alt foldet sammen, saa hun
	 * moeder hele rejsen paa én skaerm i stedet for en lang liste.
	 */
	let valgtUge = $state<number | null>(null);
	let harValgt = $state(false);
	const aabenUge = $derived(
		harValgt ? valgtUge : aktivt ? Math.ceil(Math.max(aktivt.dagNummer, 1) / 7) : null
	);

	function foldUge(nummer: number) {
		harValgt = true;
		valgtUge = aabenUge === nummer ? null : nummer;
	}

	/**
	 * Gaar hun ind i en lektion og trykker tilbage, skal hun lande praecis
	 * hvor hun slap. Ugen skal staa aaben, fanen skal vaere den samme, og
	 * siden skal staa samme sted. Linns oenske 18. august.
	 *
	 * SvelteKits snapshot gemmer det pr side i historikken, saa den uge
	 * hun aabnede paa dag 47 ikke folder sig sammen bag hende. Den kan kun
	 * gemme almindelige vaerdier, ikke Set og Map, saa her ligger kun tal
	 * og tekst.
	 *
	 * Sidens position skal vi selv sætte tilbage. Browseren goer det for
	 * tidligt, mens listen stadig hentes og siden derfor er kort, saa den
	 * lander oeverst uanset hvad.
	 */
	// Med vilje IKKE reaktiv. Effekten nedenfor koerer alligevel naar
	// listen er inde, og en tilstand der baade laeses og nulstilles i samme
	// effekt ville koere rundt om sig selv.
	let gendanY: number | null = null;

	export const snapshot = {
		capture: () => ({
			uge: valgtUge,
			harValgt,
			fane,
			y: typeof window === 'undefined' ? 0 : window.scrollY
		}),
		restore: (v: {
			uge: number | null;
			harValgt: boolean;
			fane: 'lektioner' | 'noter';
			y: number;
		}) => {
			valgtUge = v.uge;
			harValgt = v.harValgt;
			fane = v.fane;
			gendanY = v.y;
		}
	};

	// Naar listen er inde og ugen er foldet ud igen, er siden lige saa hoej
	// som da hun forlod den, og saa kan vi rulle tilbage. tick() venter til
	// ugen faktisk staar der.
	$effect(() => {
		// Laeses her, saa effekten koerer igen naar listen lander.
		const klar = !henter && liste.length > 0;
		const y = gendanY;
		if (!klar || y === null) return;
		gendanY = null;
		void tick().then(() => window.scrollTo(0, y));
	});

	/** Linjen under ugens navn. Aldrig et regnskab, bare hvad der ligger. */
	function ugeUnder(u: Uge): string {
		const antal = u.poster.length;
		const laaste = u.poster.filter((x) => !x.post.aaben).length;
		if (laaste === antal) return u.poster[0]?.post.aabnerTekst || 'Åbner senere';
		const sete = seteIUge(u, klaret);
		const ord = `${antal} ${antal === 1 ? 'lektion' : 'lektioner'}`;
		if (sete === 0) return ord;
		if (sete === antal) return `${ord} · alle set`;
		return `${ord} · ${sete} set`;
	}
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

	/**
	 * Adressen paa lektionen. Forloebet sendes med, fordi afspilleren ellers
	 * slaar op i det forloeb der koerer lige nu, og saa kan en lektion fra et
	 * tidligere hold ikke findes.
	 */
	function lektionsUrl(p: ListeLektion): string {
		return `/ny/lektion/${p.dagNummer}/${p.lektion.id}?forlob=${encodeURIComponent(forlobId)}`;
	}
</script>

<!-- Én lektion inde i en uge. Ét lille ikon, navnet, og et flueben hvis
     hun har set den. Ingen thumbnails: Linns beslutning 18. august. Med
     ti linjer pr uge fyldte videobillederne mere end de fortalte, og en
     lydfil har alligevel ikke noget billede. Navnet kommer udefra, fordi
     ugerne saetter dagen paa naar flere lektioner hedder det samme. -->
{#snippet raekke(p: ListeLektion, navn: string)}
	{@const erKlaret = erSet3(klaret, p.lektion)}

	{#if p.aaben}
		<a class="ll-lek" class:set={erKlaret} href={lektionsUrl(p)}>
			<span class="ll-lek-i {art(p.lektion.url)}" aria-hidden="true"
				>{IKON[art(p.lektion.url)]}</span
			>
			<span class="ll-lek-t">{navn}</span>
			{#if medNote.has(p.lektion.id)}
				<span class="ll-blyant" title="Du har skrevet en note">✎</span>
			{/if}
			{#if erKlaret}
				<span class="ll-lek-fl" title="Set"><Fluebe /></span>
			{:else}
				<span class="ll-lek-p" aria-hidden="true">›</span>
			{/if}
		</a>
	{:else}
		<!-- Laast. Ingen a, saa hverken mus eller tastatur kan aabne den. -->
		<div class="ll-lek laast">
			<span class="ll-lek-i" aria-hidden="true">🔒</span>
			<span class="ll-lek-t">{navn}</span>
			<span class="ll-aabner">{p.aabnerTekst}</span>
		</div>
	{/if}
{/snippet}

<div class="ny-pad lektionsliste-side">
	<Sidehoved
		titel={kendt ? navn : 'Forløbet findes ikke'}
		tilbage="/ny/profil"
		tilbageTekst="Din side"
		under={kendt && undertekst ? undertekst : undefined}
	/>

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
		<!-- Ingen nedtaelling her. Skallen viser den ét sted i toppen af
		     appen i de 90 dage, og to baand lige over hinanden er stoej.
		     Se SPEC 35. Den lukkede tilstand kan ikke naas laengere: er de
		     90 dage gaaet, kommer hun slet ikke ind i appen. -->
		{#if lukket}
			<p class="ll-baand lukket">Materialet fra det her forløb er lukket.</p>
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

			<!-- Live Q&A oeverst og aldrig foldet sammen. Linns beslutning
			     18. august: med tolv uger ville de ellers ligge spredt ud
			     over hele listen, og de er noget hun leder efter. -->
			{#if opdeling.qa.length > 0}
				<section class="ll-afsnit">
					<h2 class="ll-afsnit-t">Live Q&amp;A</h2>
					<div class="ll-qa">
						{#each opdeling.qa as p (`${p.dagNummer}-${p.lektion.id}`)}
							{#if p.aaben}
								<a class="ll-qa-r" class:set={erSet3(klaret, p.lektion)} href={lektionsUrl(p)}>
									<span class="ll-qa-t">{p.lektion.titel}</span>
									<span class="ll-qa-d">dag {p.dagNummer}</span>
									{#if erSet3(klaret, p.lektion)}
										<span class="ll-lek-fl" title="Set"><Fluebe /></span>
									{:else}
										<span class="ll-lek-p" aria-hidden="true">›</span>
									{/if}
								</a>
							{:else}
								<div class="ll-qa-r laast">
									<span class="ll-qa-t">{p.lektion.titel}</span>
									<span class="ll-aabner">{p.aabnerTekst}</span>
								</div>
							{/if}
						{/each}
					</div>
				</section>
			{/if}

			<section class="ll-afsnit">
				{#if opdeling.qa.length > 0}
					<h2 class="ll-afsnit-t">Ugerne</h2>
				{/if}
				<div class="ll-uger">
					{#each opdeling.uger as u (u.nummer)}
						{@const aaben = aabenUge === u.nummer}
						<section class="ll-uge" class:aaben>
							<button class="ll-uge-hoved" aria-expanded={aaben} onclick={() => foldUge(u.nummer)}>
								<span class="ll-uge-venstre">
									<span class="ll-uge-navn">{ugeNavn(u)}</span>
									<span class="ll-uge-under">{ugeUnder(u)}</span>
								</span>
								<!-- Samme tegn som alle andre steder i appen. Her stod der ▾, en
								     lille sort trekant, og det var det eneste sted. Rettet
								     20. august, se SPEC 36. -->
								<span class="ll-uge-fold" aria-hidden="true">{aaben ? '⌄' : '›'}</span>
							</button>

							{#if aaben}
								<div class="ll-uge-liste">
									{#each u.poster as up (`${up.post.dagNummer}-${up.post.lektion.id}`)}
										{@render raekke(up.post, up.navn)}
									{/each}
								</div>
							{/if}
						</section>
					{/each}
				</div>
			</section>

			{#if tal.ialt > tal.aabne}
				<p class="kort rolig">
					Lektionerne åbner efterhånden som du når dem. Du kan altid gå tilbage til dem du har set.
				</p>
			{/if}
		{/if}
	{/if}
</div>
