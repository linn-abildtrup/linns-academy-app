<script lang="ts">
	// ============================================================
	// Admin: regnemaskinen. Etape 4, se SPEC-3.0.md 26.19.
	//
	// Viser hvad opskriftens ingredienser regner sig frem til, ved siden
	// af det tal der staar i opskriften i dag.
	//
	// SIDEN SKRIVER INGENTING. Hverken i opskrifterne eller andre steder.
	// Den laeser, regner og viser. Linns regel 13. august: opskrifterne
	// skal staa ordret som hun har skrevet dem.
	//
	// DAEKNING FOERST. Et tal der bygger paa halvdelen af retten er ikke
	// et daarligt tal, det er et ufaerdigt tal. Derfor staar daekningen
	// foer selve tallet, og opskrifter med for lidt daekning bliver ikke
	// sammenlignet overhovedet.
	// ============================================================

	import { getContext, onMount } from 'svelte';
	import type { User } from 'firebase/auth';
	import { isAdmin } from '$lib/admin';
	import { hentAlleOpskrifter } from '$lib/firestore/opskrifter';
	import { hentAlleFodevarer } from '$lib/firestore/kost';
	import { parseOpskriftMakro, type Opskrift } from '$lib/content/opskrifter';
	import type { Fodevare } from '$lib/content/kost';
	import {
		regnOpskrift,
		afvigelse,
		tilliden,
		afrund,
		type OpskriftBeregning
	} from '$lib/content/opskriftMakro3';
	import { hentKoblinger, type Koblingskort } from '$lib/firestore/ingrediensKobling3';
	import Ventetegn from '$lib/components/ny/Ventetegn.svelte';
	import Sidehoved from '$lib/components/ny/Sidehoved.svelte';

	const hentUser = getContext<() => User | null>('user');
	const user = $derived(hentUser());
	const maaVaereHer = $derived(isAdmin(user));

	let henter = $state(true);
	let besked = $state('');
	let raekker = $state<
		{ opskrift: Opskrift; b: OpskriftBeregning; staar: ReturnType<typeof parseOpskriftMakro> }[]
	>([]);
	let visKun = $state<'alle' | 'god' | 'mangler'>('god');
	let aaben = $state<string>('');

	onMount(() => {
		(async () => {
			try {
				const [opskrifter, varerListe, kort] = await Promise.all([
					hentAlleOpskrifter(false),
					hentAlleFodevarer(),
					hentKoblinger()
				]);
				const varer = new Map<string, Fodevare>(varerListe.map((v) => [v.id, v]));
				const enkel: Record<string, { foodId: string }> = {};
				for (const [k, v] of Object.entries(kort as Koblingskort)) enkel[k] = { foodId: v.foodId };

				raekker = opskrifter
					.map((o) => ({
						opskrift: o,
						b: regnOpskrift(o, enkel, varer),
						staar: parseOpskriftMakro(o.instruktioner ?? '')
					}))
					.sort((a, b) => b.b.daekning - a.b.daekning);
			} catch (e) {
				console.error('[admin] kunne ikke regne', e);
				besked = 'Kunne ikke hente. Prøv at hente siden igen.';
			} finally {
				henter = false;
			}
		})();
	});

	const synlige = $derived(
		raekker.filter((r) => {
			if (visKun === 'god') return tilliden(r.b.daekning) !== 'for lidt';
			if (visKun === 'mangler') return tilliden(r.b.daekning) === 'for lidt';
			return true;
		})
	);

	const antalGod = $derived(raekker.filter((r) => tilliden(r.b.daekning) === 'god').length);
	const antalDelvis = $derived(raekker.filter((r) => tilliden(r.b.daekning) === 'delvis').length);
	const antalForLidt = $derived(
		raekker.filter((r) => tilliden(r.b.daekning) === 'for lidt').length
	);

	function tal(x: number): string {
		return String(Math.round(x * 10) / 10);
	}
</script>

<svelte:head><title>Regnemaskinen · Admin</title></svelte:head>

<div class="rm-side">
	{#if !maaVaereHer}
		<p class="rm-tom">Siden er kun for admin.</p>
	{:else if henter}
		<Ventetegn />
	{:else}
		<Sidehoved
			titel="Regnemaskinen"
			tilbage="/ny/admin"
			tilbageTekst="Admin"
			under="Hvad ingredienserne regner sig frem til, ved siden af det tal der står i opskriften i dag. Siden skriver ingenting. Den viser kun."
			kant={false}
		/>
		<div class="rm-top">
			<div class="rm-tal">
				<div class="rm-tal-boks"><strong>{antalGod}</strong> god dækning</div>
				<div class="rm-tal-boks"><strong>{antalDelvis}</strong> delvis</div>
				<div class="rm-tal-boks"><strong>{antalForLidt}</strong> for lidt</div>
			</div>

			<p class="rm-note">
				Dækning er hvor stor en del af rettens vægt vi kan gøre rede for. Under 70 procent siger
				tallet mere om manglende koblinger end om opskriften.
			</p>
		</div>

		{#if besked}<p class="rm-besked">{besked}</p>{/if}

		<div class="rm-faner" role="tablist">
			{#each [['god', 'Kan bruges'], ['mangler', 'For lidt dækning'], ['alle', 'Alle']] as [id, navn] (id)}
				<button
					type="button"
					role="tab"
					class="rm-fane"
					class:paa={visKun === id}
					aria-selected={visKun === id}
					onclick={() => (visKun = id as typeof visKun)}
				>
					{navn}
				</button>
			{/each}
		</div>

		<div class="rm-liste">
			{#each synlige as r (r.opskrift.id)}
				{@const p = afrund(r.b.prPortion)}
				{@const aP = afvigelse(p.protein, r.staar.protein)}
				{@const aK = r.b.kalorierPaalidelige ? afvigelse(p.kalorier, r.staar.kalorier) : null}
				<article class="rm-kort" class:god={tilliden(r.b.daekning) === 'god'}>
					<button
						type="button"
						class="rm-hoved"
						onclick={() => (aaben = aaben === r.opskrift.id ? '' : r.opskrift.id)}
					>
						<div class="rm-h-navn">
							<h2>{r.opskrift.titel}</h2>
							<span class="rm-daek" class:lav={tilliden(r.b.daekning) === 'for lidt'}>
								{r.b.daekning}% dækket
							</span>
						</div>

						<div class="rm-sammenlign">
							<div class="rm-s-kol">
								<span class="rm-s-mrk">Protein</span>
								<span class="rm-s-vaerdi">
									{r.staar.protein ?? '?'} <span class="rm-pil">→</span>
									{p.protein}
								</span>
								{#if aP !== null}
									<span class="rm-afvig" class:stor={Math.abs(aP) > 25}
										>{aP > 0 ? '+' : ''}{aP}%</span
									>
								{/if}
							</div>
							<div class="rm-s-kol">
								<span class="rm-s-mrk">Kalorier</span>
								{#if r.b.kalorierPaalidelige}
									<span class="rm-s-vaerdi">
										{r.staar.kalorier ?? '?'} <span class="rm-pil">→</span>
										{p.kalorier}
									</span>
									{#if aK !== null}
										<span class="rm-afvig" class:stor={Math.abs(aK) > 25}
											>{aK > 0 ? '+' : ''}{aK}%</span
										>
									{/if}
								{:else}
									<span class="rm-s-vaerdi kanikke">kan ikke regnes</span>
								{/if}
							</div>
						</div>

						{#if r.b.antalMangler > 0}
							<p class="rm-advarsel">
								{r.b.antalMangler}
								{r.b.antalMangler === 1 ? 'ingrediens mangler' : 'ingredienser mangler'} en kobling,
								{Math.round(r.b.gramUden)} g i alt
							</p>
						{/if}
						{#if !r.b.kalorierPaalidelige}
							<p class="rm-advarsel">
								Kalorierne kan ikke bruges. Disse varer mangler tal: {r.b.varerUdenTal.join(', ')}
							</p>
						{/if}
					</button>

					{#if aaben === r.opskrift.id}
						<!-- Hele regnestykket, linje for linje. Det er her hun kan
						     se PRAECIS hvor et tal kommer fra. -->
						<div class="rm-linjer">
							{#each r.b.linjer as l (l.navn + l.maengde + l.enhed)}
								<div class="rm-l" class:tom={l.uden_betydning} class:mangler={!!l.mangel}>
									<div class="rm-l-venstre">
										<span class="rm-l-navn">{l.maengde} {l.enhed} {l.navn}</span>
										<span class="rm-l-vare">
											{#if l.uden_betydning}
												tæller ikke med
											{:else if l.vare}
												{Math.round(l.gram)} g · {l.vare.name}
											{:else}
												{Math.round(l.gram)} g · <strong>{l.mangel}</strong>
											{/if}
										</span>
									</div>
									{#if l.vare && !l.uden_betydning}
										<span class="rm-l-makro">
											{tal(l.makro.protein)} g protein
											{#if l.vare.kcal !== undefined}· {Math.round(l.makro.kalorier)} kcal{/if}
										</span>
									{/if}
								</div>
							{/each}

							<div class="rm-sum">
								<span>Hele ingredienslisten</span>
								<span>
									{tal(r.b.ialt.protein)} g protein
									{#if r.b.kalorierPaalidelige}· {Math.round(r.b.ialt.kalorier)} kcal{/if}
								</span>
							</div>
							{#if (r.opskrift.defaultPortioner ?? 1) > 1}
								<div class="rm-sum svag">
									<span>Delt med {r.opskrift.defaultPortioner} portioner</span>
									<span>{tal(r.b.prPortion.protein)} g protein</span>
								</div>
							{/if}
						</div>
					{/if}
				</article>
			{/each}
		</div>
	{/if}
</div>
