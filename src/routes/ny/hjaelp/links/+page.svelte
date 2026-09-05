<script lang="ts">
	// ============================================================
	// Links og guides. Flyttet ind under Hjaelp 18. august 2026.
	//
	// Samme kilde som det gamle Bibliotek, samme hjaelpere. Guides
	// sorteres efter dato med den nyeste oeverst, se sorterGuides.
	//
	// Alt aabner i et nyt vindue. Videoerne indlejres BEVIDST ikke her:
	// listen er til at skimme, og en side med ti indlejrede afspillere
	// er tung paa en telefon. Vil hun se en video, aabner den hos dem
	// der er gode til at afspille den.
	// ============================================================

	import { getContext } from 'svelte';
	import type { UserDoc } from '$lib/types';
	import type { Adgangsbillede } from '$lib/content/adgang3';
	import type { GuideItem } from '$lib/content/bibliotek';
	import {
		GUIDE_TYPE_LABELS,
		formatDanskDato,
		kunUdgivne,
		sorterGuides,
		sorterKategorier
	} from '$lib/content/bibliotek';
	import { fletHjaelp, hjaelpKilder, visKildeNavn, type HjaelpGruppe } from '$lib/content/hjaelp3';
	import { hentGuideItems, hentGuideKategorier } from '$lib/firestore/bibliotek';
	import Venter from '$lib/components/ny/Venter.svelte';
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

	let grupper = $state<HjaelpGruppe<GuideItem>[]>([]);
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
						hentGuideKategorier(kilde.forlobId).catch(() => []),
						hentGuideItems(kilde.forlobId).catch(() => [])
					]);
					return {
						kilde,
						kategorier: sorterKategorier(kategorier).map((k) => ({ id: k.id, navn: k.navn })),
						poster: sorterGuides(kunUdgivne(poster))
					};
				})
			);
			if (afbrudt) return;
			grupper = fletHjaelp(indhold, medNavn);
			henter = false;
		})().catch((e) => {
			console.error('[ny] kunne ikke hente links', e);
			henter = false;
		});

		return () => {
			afbrudt = true;
		};
	});

	function meta(g: GuideItem): string {
		const dele = [GUIDE_TYPE_LABELS[g.type] ?? 'Link'];
		if (g.dato) dele.push(formatDanskDato(g.dato));
		return dele.join(' · ');
	}
</script>

<div class="ny-pad hjaelp-nav">
	<Sidehoved titel="Links og guides" tilbage="/ny/hjaelp" tilbageTekst="Hjælp" kant={false} />

	{#if henter}
		<Venter tekst="Henter materialet" />
	{:else if grupper.length === 0}
		<div class="kort rolig">Der er ikke lagt links og guides ind endnu.</div>
	{:else}
		{#each grupper as gruppe (gruppe.noegle)}
			<section>
				<div class="lab">
					<h2>{gruppe.kategoriNavn}</h2>
					{#if gruppe.kildeNavn}<span class="hj-kilde">{gruppe.kildeNavn}</span>{/if}
				</div>
				<div class="hj-liste">
					{#each gruppe.poster as g (g.id)}
						<a
							class="adm-raekke tr-raekke hj-link"
							href={g.url}
							target="_blank"
							rel="noopener noreferrer"
						>
							<div class="adm-raekke-t">
								<span>{g.titel}</span>
								<span class="adm-mrk">{GUIDE_TYPE_LABELS[g.type] ?? 'Link'}</span>
							</div>
							{#if g.beskrivelse}
								<div class="adm-raekke-s">{g.beskrivelse}</div>
							{/if}
							<div class="hj-meta">{meta(g)}</div>
						</a>
					{/each}
				</div>
			</section>
		{/each}

		<p class="kort rolig">Alt herover åbner i et nyt vindue, og så er du tilbage her bagefter.</p>
	{/if}
</div>
