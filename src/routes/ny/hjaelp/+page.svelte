<script lang="ts">
	// ============================================================
	// Hjaelp. Ét sted for alle spoergsmaal.
	//
	// Linns beslutning 18. august 2026, del af model D. Det gamle
	// Bibliotek bliver delt: lektionerne og hendes noter ligger under
	// Profil, og FAQ og links flytter herind. Ordet "Bibliotek" findes
	// ikke laengere i kundens sprog.
	//
	// Raekkefoelgen er bevidst. AI-en foerst, fordi den svarer med det
	// samme og daekker det meste. Saa opslaget, som er Linns egne svar.
	// Og til sidst vejen til et menneske, naar de to foerste ikke slog til.
	//
	// Siden henter FAQ og links for at kunne skrive HVOR MANGE der er.
	// Det koster fire opslag, men et menupunkt der lover "Ofte stillede
	// spoergsmaal" og aabner en tom side er vaerre.
	// ============================================================

	import { getContext } from 'svelte';
	import type { UserDoc } from '$lib/types';
	import type { Adgangsbillede } from '$lib/content/adgang3';
	import { hjaelpKilder } from '$lib/content/hjaelp3';
	import { kunUdgivne } from '$lib/content/bibliotek';
	import { hentFaqItems, hentGuideItems } from '$lib/firestore/bibliotek';

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

	let antalFaq = $state<number | null>(null);
	let antalLinks = $state<number | null>(null);

	$effect(() => {
		const ids = kilder.map((k) => k.forlobId);
		if (ids.length === 0) {
			antalFaq = 0;
			antalLinks = 0;
			return;
		}

		let afbrudt = false;
		(async () => {
			// Taeller vi ikke, staar der bare ingen undertekst. Det maa aldrig
			// vaelte siden, for de tre indgange skal virke uanset hvad.
			const [faq, links] = await Promise.all([
				Promise.all(ids.map((id) => hentFaqItems(id).catch(() => []))),
				Promise.all(ids.map((id) => hentGuideItems(id).catch(() => [])))
			]);
			if (afbrudt) return;
			antalFaq = kunUdgivne(faq.flat()).length;
			antalLinks = kunUdgivne(links.flat()).length;
		})().catch((e) => {
			console.warn('[ny] kunne ikke taelle hjaelpe-indholdet', e);
		});

		return () => {
			afbrudt = true;
		};
	});

	function undertekst(antal: number | null, hvad: string, tom: string): string {
		if (antal === null) return '';
		if (antal === 0) return tom;
		return `${antal} ${hvad}`;
	}
</script>

<div class="ny-pad hjaelp-nav">
	<header class="side-top" style="padding-left:0;padding-right:0">
		<a class="tilbage" href="/ny">‹ Forside</a>
		<h1>Hjælp</h1>
		<p>Start med at spørge. Finder du ikke svaret, står Linns egne svar nedenunder.</p>
	</header>

	<section>
		<div class="lab"><h2>Spørg</h2></div>
		<a class="adm-raekke tr-raekke" href="/ny/hjaelp/spoerg">
			<div class="adm-raekke-t"><span>Spørg om appen</span></div>
			<div class="adm-raekke-s">Du får svar med det samme</div>
		</a>
	</section>

	{#if kilder.length > 0 && (antalFaq === null || antalFaq > 0 || antalLinks === null || antalLinks > 0)}
		<section>
			<div class="lab"><h2>Slå op</h2></div>

			{#if antalFaq === null || antalFaq > 0}
				<a class="adm-raekke tr-raekke" href="/ny/hjaelp/faq">
					<div class="adm-raekke-t"><span>Ofte stillede spørgsmål</span></div>
					<div class="adm-raekke-s">
						{undertekst(antalFaq, 'spørgsmål og svar fra Linn', '')}
					</div>
				</a>
			{/if}

			{#if antalLinks === null || antalLinks > 0}
				<a class="adm-raekke tr-raekke" href="/ny/hjaelp/links">
					<div class="adm-raekke-t"><span>Links og guides</span></div>
					<div class="adm-raekke-s">
						{undertekst(antalLinks, 'videoer og materialer', '')}
					</div>
				</a>
			{/if}
		</section>
	{/if}

	<section>
		<div class="lab"><h2>Kan du ikke finde det</h2></div>
		<a class="adm-raekke tr-raekke" href="/ny/beskeder">
			<div class="adm-raekke-t"><span>Skriv til Linn</span></div>
			<div class="adm-raekke-s">Hun svarer dig personligt</div>
		</a>
	</section>
</div>
