<script lang="ts">
	// ============================================================
	// Ofte stillede spoergsmaal. Flyttet ind under Hjaelp 18. august
	// 2026, se hjaelp3.ts.
	//
	// Vi laeser den SAMME samling som det gamle Bibliotek gjorde, og
	// bruger dens egne hjaelpere til sortering og udgivelse. Retter Linn
	// et svar ét sted, er det rettet begge steder. Der er ikke bygget en
	// ny datamodel, og der er ikke roert en linje i den gamle app.
	//
	// Spoergsmaalene foldes ud ét ad gangen med <details>, saa hun kan
	// skimme listen. Browserens eget element, ingen JavaScript, og det
	// virker med tastatur og oplaesning uden at vi goer noget.
	// ============================================================

	import { getContext } from 'svelte';
	import type { UserDoc } from '$lib/types';
	import type { Adgangsbillede } from '$lib/content/adgang3';
	import type { FaqItem } from '$lib/content/bibliotek';
	import { kunUdgivne, sorterItems, sorterKategorier } from '$lib/content/bibliotek';
	import { fletHjaelp, hjaelpKilder, visKildeNavn, type HjaelpGruppe } from '$lib/content/hjaelp3';
	import { hentFaqItems, hentFaqKategorier } from '$lib/firestore/bibliotek';
	import Ventetegn from '$lib/components/ny/Ventetegn.svelte';
	import Sidehoved from '$lib/components/ny/Sidehoved.svelte';

	const hentAdgang = getContext<() => Adgangsbillede>('adgang');
	const hentUserDoc = getContext<() => UserDoc | null>('userDoc');
	const adgang = $derived(hentAdgang());
	const userDoc = $derived(hentUserDoc());

	const kilder = $derived(
		hjaelpKilder(adgang.aktiveForlob, adgang.gennemfoerte, {
			harApp: adgang.harApp,
			bonusSlutMs: userDoc?.bonusPeriodEndsAt ?? null,
			nu: Date.now()
		})
	);

	let grupper = $state<HjaelpGruppe<FaqItem>[]>([]);
	let henter = $state(true);

	$effect(() => {
		const liste = kilder;
		const medNavn = visKildeNavn(liste);
		if (liste.length === 0) {
			grupper = [];
			henter = false;
			return;
		}

		let afbrudt = false;
		(async () => {
			henter = true;
			const indhold = await Promise.all(
				liste.map(async (kilde) => {
					const [kategorier, poster] = await Promise.all([
						hentFaqKategorier(kilde.forlobId).catch(() => []),
						hentFaqItems(kilde.forlobId).catch(() => [])
					]);
					return {
						kilde,
						kategorier: sorterKategorier(kategorier).map((k) => ({ id: k.id, navn: k.navn })),
						poster: sorterItems(kunUdgivne(poster))
					};
				})
			);
			if (afbrudt) return;
			grupper = fletHjaelp(indhold, medNavn);
			henter = false;
		})().catch((e) => {
			console.error('[ny] kunne ikke hente FAQ', e);
			henter = false;
		});

		return () => {
			afbrudt = true;
		};
	});
</script>

<div class="ny-pad hjaelp-nav">
	<Sidehoved
		titel="Ofte stillede spørgsmål"
		tilbage="/ny/hjaelp"
		tilbageTekst="Hjælp"
		kant={false}
	/>

	{#if henter}
		<div class="lektion-venter">
			<Ventetegn variant="lille" />
			<span>Henter spørgsmålene</span>
		</div>
	{:else if grupper.length === 0}
		<div class="kort rolig">
			Der er ikke lagt spørgsmål ind endnu.
			<a href="/ny/hjaelp/spoerg">Spørg om appen i stedet</a>
		</div>
	{:else}
		{#each grupper as g (g.noegle)}
			<section>
				<div class="lab">
					<h2>{g.kategoriNavn}</h2>
					{#if g.kildeNavn}<span class="hj-kilde">{g.kildeNavn}</span>{/if}
				</div>
				<div class="hj-liste">
					{#each g.poster as f (f.id)}
						<details class="hj-post">
							<summary>{f.spoergsmaal}</summary>
							<div class="hj-svar">{f.svar}</div>
						</details>
					{/each}
				</div>
			</section>
		{/each}

		<p class="kort rolig">
			Fandt du ikke svaret? <a href="/ny/hjaelp/spoerg">Spørg om appen</a>, eller
			<a href="/ny/beskeder">skriv til Linn</a>.
		</p>
	{/if}
</div>
