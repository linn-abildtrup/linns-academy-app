<script lang="ts">
	// ============================================================
	// Admin: kobl opskrifternes ingredienser til foedevaredatabasen.
	// Etape 3 af regnemaskinen, se SPEC-3.0.md 26.19.
	//
	// 1105 ingrediens-linjer i 133 opskrifter peger i dag paa INGENTING.
	// Derfor er opskrifternes makro tal skrevet i teksten, og derfor kan
	// ris ikke skiftes ud med kartofler.
	//
	// Siden her viser ét kernenavn ad gangen med de bedste bud, og Linn
	// vaelger. De hyppigste kommer foerst, saa arbejdet betaler sig med
	// det samme: de 100 hyppigste navne daekker 78 procent af linjerne.
	//
	// Koblingen er pr KERNENAVN og ikke pr linje. Vaelger hun én gang for
	// olivenolie, gaelder det alle 38 steder.
	//
	// Der skrives KUN i ingrediensKobling/koblinger. Hverken opskrifterne
	// eller foedevarerne roeres, saa de 760 kunder i den gamle app ser
	// praecis det samme som foer.
	// ============================================================

	import { getContext, onMount } from 'svelte';
	import type { User } from 'firebase/auth';
	import { isAdmin } from '$lib/admin';
	import { hentAlleOpskrifter } from '$lib/firestore/opskrifter';
	import { hentFodevarer3 } from '$lib/firestore/fodevarer3';
	import type { Fodevare } from '$lib/content/kost';
	import { kerneNavn, tilstand, type Tilstand } from '$lib/content/ingrediensNavn3';
	import { foreslaaKobling, taleneErUmulige, type Kandidat } from '$lib/content/ingrediensKobling3';
	import { tilGram, bidragerIkke } from '$lib/content/enhedsvaegt3';
	import {
		hentKoblinger,
		saetKobling,
		gemKoblinger,
		type Koblingskort
	} from '$lib/firestore/ingrediensKobling3';
	import Ventetegn from '$lib/components/ny/Ventetegn.svelte';
	import Sidehoved from '$lib/components/ny/Sidehoved.svelte';

	const hentUser = getContext<() => User | null>('user');
	const user = $derived(hentUser());
	const maaVaereHer = $derived(isAdmin(user));

	let henter = $state(true);
	let gemmer = $state(false);
	let besked = $state('');
	let varer = $state<Fodevare[]>([]);
	let kort = $state<Koblingskort>({});
	let soegeord = $state('');
	let visKun = $state<'alle' | 'mangler' | 'klar'>('mangler');

	interface Opgave {
		/** Maskinens navn. Bruges som noegle og vises aldrig alene. */
		kerne: string;
		/**
		 * Det navn Linn faktisk ser. Den hyppigste skrivemaade fra
		 * opskrifterne, altsaa "røde linser, tørre" og ikke maskinens
		 * "linser roede toer". Hun skal ikke oversaette 290 gange.
		 */
		visNavn: string;
		tilstand: Tilstand;
		/** Hvor mange linjer i opskrifterne der bruger navnet. */
		antal: number;
		/** De skrevne varianter, saa Linn kan se hvad der stod. */
		varianter: string[];
		/** Ét eksempel paa maengde, saa hun kan se om vaegten giver mening. */
		eksempel: string;
		gram: number;
		/** Sand naar ingen af linjerne giver et eneste gram. */
		vejerNul: boolean;
	}

	let opgaver = $state<Opgave[]>([]);

	onMount(() => {
		(async () => {
			try {
				const [opskrifter, alleVarer, gemte] = await Promise.all([
					hentAlleOpskrifter(false),
					hentFodevarer3(),
					hentKoblinger()
				]);
				varer = alleVarer;
				kort = gemte;

				// Foerst samles alle linjer pr kernenavn, med taelling af hvor
				// tit hver skrivemaade bruges. Den hyppigste bliver det navn
				// Linn ser.
				const samlet = new Map<
					string,
					{
						kerne: string;
						tilstand: Tilstand;
						antal: number;
						skrivemaader: Map<string, number>;
						eksempel: string;
						gram: number;
						nogetVejer: boolean;
					}
				>();

				for (const o of opskrifter) {
					for (const i of o.ingredienser ?? []) {
						const k = kerneNavn(i.navn ?? '');
						if (!k) continue;
						const v = tilGram(i.navn, Number(i.maengde), String(i.enhed ?? ''));
						if (!samlet.has(k)) {
							samlet.set(k, {
								kerne: k,
								tilstand: tilstand(i.navn ?? ''),
								antal: 0,
								skrivemaader: new Map(),
								eksempel: `${i.maengde} ${i.enhed} ${i.navn}`,
								gram: v.gram,
								nogetVejer: false
							});
						}
						const op = samlet.get(k)!;
						op.antal++;
						op.skrivemaader.set(i.navn, (op.skrivemaader.get(i.navn) ?? 0) + 1);
						// Vejer bare ÉN af linjerne noget, skal ingrediensen kobles.
						// Ellers ryger den ud af bunken nedenfor.
						if (v.gram > 0) {
							op.nogetVejer = true;
							if (op.gram === 0) op.eksempel = `${i.maengde} ${i.enhed} ${i.navn}`;
							if (op.gram === 0) op.gram = v.gram;
						}
					}
				}

				opgaver = [...samlet.values()]
					// Salt, peber og alt andet der ganges med nul gram ud af
					// bunken. De kan ikke aendre et eneste tal, uanset hvilken
					// foedevare de kobles til. Linns beslutning 13. august.
					.filter((o) => o.nogetVejer && !bidragerIkke(o.kerne))
					.map((o) => {
						const hyppigst = [...o.skrivemaader.entries()].sort((a, b) => b[1] - a[1])[0][0];
						return {
							kerne: o.kerne,
							visNavn: hyppigst,
							tilstand: o.tilstand,
							antal: o.antal,
							varianter: [...o.skrivemaader.keys()],
							eksempel: o.eksempel,
							gram: o.gram,
							vejerNul: !o.nogetVejer
						} satisfies Opgave;
					})
					.sort((a, b) => b.antal - a.antal);
			} catch (e) {
				console.error('[admin] kunne ikke hente ingredienser', e);
				besked = 'Kunne ikke hente. Prøv at hente siden igen.';
			} finally {
				henter = false;
			}
		})();
	});

	/** Forslagene til én opgave. Regnes kun naar der er varer at slaa op i. */
	function budFor(op: Opgave): Kandidat[] {
		if (varer.length === 0) return [];
		return foreslaaKobling(op.kerne, op.tilstand, varer).forslag;
	}

	const antalKlar = $derived(opgaver.filter((o) => kort[o.kerne]).length);
	const linjerKlar = $derived(
		opgaver.filter((o) => kort[o.kerne]).reduce((s, o) => s + o.antal, 0)
	);
	const linjerIalt = $derived(opgaver.reduce((s, o) => s + o.antal, 0));

	const synlige = $derived.by(() => {
		const s = soegeord.trim().toLowerCase();
		return opgaver.filter((o) => {
			if (visKun === 'mangler' && kort[o.kerne]) return false;
			if (visKun === 'klar' && !kort[o.kerne]) return false;
			// Der soeges baade i det Linn ser og i maskinens navn, saa hun
			// kan skrive baade "røde linser" og "linser".
			if (
				s &&
				!o.visNavn.toLowerCase().includes(s) &&
				!o.kerne.includes(s) &&
				!o.varianter.some((v) => v.toLowerCase().includes(s))
			)
				return false;
			return true;
		});
	});

	function vareVed(id: string | undefined): Fodevare | undefined {
		return id ? varer.find((v) => v.id === id) : undefined;
	}

	async function vaelg(kerne: string, foodId: string | null) {
		if (gemmer || !user) return;
		gemmer = true;
		besked = '';
		try {
			kort = await saetKobling(kort, kerne, foodId, user.uid);
		} catch (e) {
			console.error('[admin] kunne ikke gemme kobling', e);
			besked = 'Kunne ikke gemme. Prøv igen.';
		} finally {
			gemmer = false;
		}
	}

	/**
	 * Saetter alle de koblinger maskinen selv er sikker paa.
	 * De markeres som ikke bekraeftede, saa det altid kan ses hvad et
	 * menneske har valgt og hvad en maskine har gaettet.
	 */
	async function koblDeSikre() {
		if (gemmer || !user) return;
		gemmer = true;
		besked = '';
		try {
			const nyt: Koblingskort = { ...kort };
			let n = 0;
			for (const op of opgaver) {
				if (nyt[op.kerne]) continue;
				const r = foreslaaKobling(op.kerne, op.tilstand, varer);
				if (r.sikker && r.foodId) {
					nyt[op.kerne] = { foodId: r.foodId, bekraeftet: false, af: 'auto' };
					n++;
				}
			}
			await gemKoblinger(nyt, user.uid);
			kort = nyt;
			besked = `${n} ingredienser blev koblet automatisk. De står som ikke bekræftede indtil du har set dem.`;
		} catch (e) {
			console.error('[admin] kunne ikke koble automatisk', e);
			besked = 'Kunne ikke gemme. Prøv igen.';
		} finally {
			gemmer = false;
		}
	}
</script>

<svelte:head><title>Ingredienser · Admin</title></svelte:head>

<div class="ing-side">
	{#if !maaVaereHer}
		<!-- Beskeden siger HVEM den ser. Uden det er der ingen maade at
		     vide om man er logget ind som testbruger, eller om noget er
		     galt med selve adgangen. -->
		<p class="ing-tom">
			Siden er kun for admin.
			{#if user?.email}
				Du er logget ind som {user.email}. Log ind med din admin-konto for at bruge siden.
			{:else}
				Der er ingen der er logget ind lige nu.
			{/if}
		</p>
	{:else if henter}
		<Ventetegn />
	{:else}
		<Sidehoved
			titel="Ingredienser"
			tilbage="/ny/admin"
			tilbageTekst="Admin"
			under="Hver ingrediens skal pege på en fødevare, før makroen kan regnes ud af mængderne. Vælger du én gang, gælder det alle steder ingrediensen bruges."
			kant={false}
		/>
		<div class="ing-top">
			<div class="ing-tal">
				<div class="ing-tal-boks">
					<strong>{antalKlar}</strong> af {opgaver.length} ingredienser
				</div>
				<div class="ing-tal-boks">
					<strong>{Math.round((linjerKlar / Math.max(1, linjerIalt)) * 100)}%</strong> af linjerne
				</div>
			</div>

			<button class="ing-auto" type="button" onclick={koblDeSikre} disabled={gemmer}>
				Kobl dem maskinen er sikker på
			</button>
			<p class="ing-note">
				Kun fødevarer hvor navnet passer helt, tilstanden stemmer og tallene hænger sammen. Er der
				den mindste tvivl, bliver ingrediensen liggende til dig.
			</p>
		</div>

		{#if besked}
			<p class="ing-besked">{besked}</p>
		{/if}

		<div class="ing-filter">
			<input
				class="ing-soeg"
				type="search"
				bind:value={soegeord}
				placeholder="Søg efter ingrediens"
				aria-label="Søg efter ingrediens"
			/>
			<div class="ing-faner" role="tablist">
				{#each [['mangler', 'Mangler'], ['klar', 'Klar'], ['alle', 'Alle']] as [id, navn] (id)}
					<button
						type="button"
						role="tab"
						class="ing-fane"
						class:paa={visKun === id}
						aria-selected={visKun === id}
						onclick={() => (visKun = id as typeof visKun)}
					>
						{navn}
					</button>
				{/each}
			</div>
		</div>

		{#if synlige.length === 0}
			<p class="ing-tom">Ingen ingredienser her.</p>
		{/if}

		<div class="ing-liste">
			{#each synlige.slice(0, 40) as op (op.kerne)}
				{@const valgt = vareVed(kort[op.kerne]?.foodId)}
				<article class="ing-kort" class:klar={!!valgt}>
					<header class="ing-k-top">
						<div>
							<h2>{op.visNavn}</h2>
							<p class="ing-k-under">
								{op.antal}
								{op.antal === 1 ? 'linje' : 'linjer'}
								{#if op.tilstand === 'toer'}<span class="ing-tilstand">tørre</span>
								{:else if op.tilstand === 'afdryppet'}<span class="ing-tilstand">afdryppede</span>
								{:else if op.tilstand === 'kogt'}<span class="ing-tilstand">kogte</span>{/if}
							</p>
						</div>
						{#if valgt}
							<button type="button" class="ing-ryd" onclick={() => vaelg(op.kerne, null)}>
								Ryd
							</button>
						{/if}
					</header>

					{#if op.varianter.length > 1}
						<!-- Kun naar der ER flere skrivemaader. Ellers gentager
						     linjen bare overskriften og stjaeler plads. -->
						<p class="ing-varianter">
							Står også som: {op.varianter
								.filter((v) => v !== op.visNavn)
								.slice(0, 4)
								.join(', ')}
						</p>
					{/if}
					<p class="ing-eksempel">
						Eksempel: {op.eksempel} giver {Math.round(op.gram)} g
					</p>

					{#if valgt}
						<div class="ing-valgt">
							<span class="ing-v-navn">{valgt.name}</span>
							<span class="ing-v-makro">
								{valgt.p} g protein, {valgt.kcal ?? '?'} kcal pr 100 g
							</span>
							{#if !kort[op.kerne].bekraeftet}
								<button
									type="button"
									class="ing-bekraeft"
									onclick={() => vaelg(op.kerne, valgt.id)}
								>
									Bekræft
								</button>
							{/if}
						</div>
					{:else}
						<div class="ing-bud">
							{#each budFor(op) as b (b.vare.id)}
								<button
									type="button"
									class="ing-b"
									class:advarsel={taleneErUmulige(b.vare)}
									disabled={gemmer}
									onclick={() => vaelg(op.kerne, b.vare.id)}
								>
									<span class="ing-b-navn">{b.vare.name}</span>
									<span class="ing-b-makro">
										{b.vare.p} g protein, {b.vare.kcal ?? '?'} kcal
										{#if b.vare.kilde !== 'frida'}<span class="ing-b-kilde">uden kilde</span>{/if}
										{#if taleneErUmulige(b.vare)}<span class="ing-b-advarsel"
												>tallene hænger ikke sammen</span
											>{/if}
									</span>
									<span class="ing-b-hvorfor">{b.hvorfor}</span>
								</button>
							{:else}
								<p class="ing-intet">Ingen fødevare ligner. Den skal oprettes i databasen først.</p>
							{/each}
						</div>
					{/if}
				</article>
			{/each}
		</div>

		{#if synlige.length > 40}
			<p class="ing-flere">Viser de 40 hyppigste af {synlige.length}. Søg for at finde resten.</p>
		{/if}
	{/if}
</div>
