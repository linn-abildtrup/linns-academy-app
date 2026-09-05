<script lang="ts">
	// ============================================================
	// "Dine smaa skridt": hun vaelger dem selv.
	//
	// Linns valg 22. august 2026, plan A i mockups-vaelg-smaa-skridt.html.
	// En side for sig og ikke et ark: listen med forslag vokser med tiden,
	// og et ark kan ikke baere en lang liste paa en telefon.
	//
	// TO SPOR PAA SAMME SIDE. Begge ser Linns forslag og kan skrive deres
	// egne. Forskellen er hvor det havner: medlemmets valg bliver til
	// hendes liste, forloebskundens bliver til ét af HENDES EGNE skridt
	// oveni Linns plan, som hun ikke kan fjerne.
	//
	// Forloebskunden fik foerst ingen forslag at se og skulle skrive alt
	// selv. Linns rettelse 22. august.
	// Se content/vaelgSkridt3.ts for reglerne bag.
	//
	// DER ER INGEN GEM-KNAP. Hvert valg gemmes med det samme. Den gamle
	// side har en knap nederst, og gaar hun tilbage uden at trykke, er
	// alt vaek. Det er den fejl vi ikke gentager.
	// ============================================================

	import { getContext } from 'svelte';
	import type { User } from 'firebase/auth';
	import type { Adgangsbillede } from '$lib/content/adgang3';
	import {
		MAKS_SKRIDT3,
		MAKS_TEGN3,
		egetSkridtFejl3,
		fjernSkridt3,
		grupperForslag3,
		kanVaelgeFlere3,
		matchForslag3,
		skiftForslag3,
		tilbageTekst3,
		type Forslag3,
		type ValgtSkridt3
	} from '$lib/content/vaelgSkridt3';
	import {
		fjernEgetSkridt3,
		gemMedlemsSkridt3,
		hentSkridtValg3,
		tilfoejEgetSkridt3,
		type SkridtValg3
	} from '$lib/firestore/vaelgSkridt3';
	import Venter from '$lib/components/ny/Venter.svelte';
	import Sidehoved from '$lib/components/ny/Sidehoved.svelte';
	import Fluebe from '$lib/components/ny/Fluebe.svelte';

	const hentUser = getContext<() => User | null>('user');
	const hentAdgang = getContext<() => Adgangsbillede>('adgang');
	const user = $derived(hentUser());
	const adgang = $derived(hentAdgang());
	const forlob = $derived(adgang.aktiveForlob[0] ?? null);

	let data = $state<SkridtValg3 | null>(null);
	let valgte = $state<ValgtSkridt3[]>([]);
	let henter = $state(true);
	let gemmer = $state(false);
	let gemtLige = $state(false);
	let fejl = $state('');

	let egenTekst = $state('');
	let skriverEget = $state(false);

	const kategorier = $derived(grupperForslag3(data?.forslag ?? []));
	const erForlob = $derived(data?.kilde === 'forlob');
	const plads = $derived(kanVaelgeFlere3(valgte));
	const fuldTekst = $derived(tilbageTekst3(valgte));
	const egenFejl = $derived(egenTekst.trim() ? egetSkridtFejl3(egenTekst, valgte) : null);

	$effect(() => {
		const uid = user?.uid;
		if (!uid) return;
		const f = forlob;
		let afbrudt = false;

		(async () => {
			henter = true;
			const d = await hentSkridtValg3(uid, f ? { produkt: f.produkt } : null);
			if (afbrudt) return;
			data = d;
			valgte = d.valgte;
			henter = false;
		})().catch((e) => {
			console.error('[ny] kunne ikke hente dine skridt', e);
			fejl = 'Kunne ikke hente dine skridt. Prøv igen om lidt.';
			henter = false;
		});

		return () => {
			afbrudt = true;
		};
	});

	/** Kvitteringen. Den staar kort, for hun skal bare vide at det sad fast. */
	function kvitter() {
		gemtLige = true;
		setTimeout(() => (gemtLige = false), 1600);
	}

	/**
	 * Medlemmets valg. Hele listen skrives, og skaermen skifter foerst,
	 * saa det foeles med det samme. Gaar skrivningen galt, ruller vi
	 * tilbage til det hun havde.
	 */
	async function gemMedlem(ny: ValgtSkridt3[]) {
		const uid = user?.uid;
		if (!uid) return;
		const foer = valgte;
		valgte = ny;
		gemmer = true;
		fejl = '';
		try {
			await gemMedlemsSkridt3(uid, ny);
			kvitter();
		} catch (e) {
			console.error('[ny] kunne ikke gemme dine skridt', e);
			valgte = foer;
			fejl = 'Kunne ikke gemme. Prøv igen.';
		} finally {
			gemmer = false;
		}
	}

	async function skiftForslag(f: Forslag3) {
		if (gemmer) return;

		// Forloebskunden: forslaget bliver til ét af hendes egne, og der
		// skrives ét skridt ad gangen. Se firestore-laget for hvorfor.
		if (erForlob && data?.produktId) {
			const har = matchForslag3(valgte, f);
			if (har) {
				await fjern(har.id);
			} else if (plads) {
				await gemEget(f.label);
			}
			return;
		}

		const ny = skiftForslag3(valgte, f);
		if (ny === valgte) return;
		void gemMedlem(ny);
	}

	/** Skriver ét eget skridt paa forloebs-sporet. Bruges af begge veje ind. */
	async function gemEget(tekst: string): Promise<boolean> {
		const uid = user?.uid;
		if (!uid || !data?.produktId) return false;
		gemmer = true;
		fejl = '';
		try {
			const r = await tilfoejEgetSkridt3(uid, data.produktId, tekst);
			if (!r.ok) {
				fejl = r.fejl;
				return false;
			}
			valgte = [...valgte, { id: r.id, label: tekst, kilde: 'egen' }];
			kvitter();
			return true;
		} catch (e) {
			console.error('[ny] kunne ikke gemme dit skridt', e);
			fejl = 'Kunne ikke gemme. Prøv igen.';
			return false;
		} finally {
			gemmer = false;
		}
	}

	async function tilfoejEget() {
		const uid = user?.uid;
		if (!uid || gemmer) return;
		if (egetSkridtFejl3(egenTekst, valgte)) return;
		const tekst = egenTekst.trim();

		if (erForlob && data?.produktId) {
			if (await gemEget(tekst)) {
				egenTekst = '';
				skriverEget = false;
			}
			return;
		}

		// Medlemmet: id'et er vores eget, og det bliver noeglen paa hendes
		// afkrydsninger, saa det maa aldrig laves om bagefter.
		const id = `egen-${Date.now()}`;
		await gemMedlem([...valgte, { id, label: tekst, kilde: 'egen' }]);
		egenTekst = '';
		skriverEget = false;
	}

	async function fjern(id: string) {
		const uid = user?.uid;
		if (!uid || gemmer) return;

		if (erForlob && data?.produktId) {
			const foer = valgte;
			valgte = fjernSkridt3(valgte, id);
			gemmer = true;
			try {
				await fjernEgetSkridt3(uid, data.produktId, id);
				kvitter();
			} catch (e) {
				console.error('[ny] kunne ikke fjerne dit skridt', e);
				valgte = foer;
				fejl = 'Kunne ikke fjerne det. Prøv igen.';
			} finally {
				gemmer = false;
			}
			return;
		}

		await gemMedlem(fjernSkridt3(valgte, id));
	}

	const egne = $derived(valgte.filter((v) => v.kilde === 'egen'));
</script>

<div class="ny-pad skridt-side">
	<Sidehoved
		titel={erForlob ? 'Dine egne små skridt' : 'Dine små skridt'}
		tilbage="/ny"
		tilbageTekst="Forside"
		under={erForlob
			? `Op til ${MAKS_SKRIDT3}, oveni dem Linn har lagt ind i forløbet.`
			: `Vælg op til ${MAKS_SKRIDT3} små ting du vil gøre hver dag. Du kan altid skifte dem ud.`}
		kant={false}
	/>

	{#if henter}
		<Venter tekst="Henter dine skridt" />
	{:else}
		<div class="vs-taeller" class:fuld={!plads}>
			<span class="vs-t">
				{plads ? 'Valgt' : 'Du har valgt tre'}
				{#if gemtLige}<span class="vs-gemt">✓ Gemt</span>{/if}
			</span>
			<span class="vs-n">{valgte.length} / {MAKS_SKRIDT3}</span>
		</div>

		{#if fejl}
			<div class="kort rolig vs-fejl">{fejl}</div>
		{/if}

		{#if kategorier.length === 0}
			<div class="kort rolig">
				Linn har ikke lagt nogen forslag op endnu. Du kan skrive dine egne herunder.
			</div>
		{:else}
			<section class="kort">
				{#if erForlob}
					<div class="vs-egne-t">Linns forslag</div>
					<div class="vs-hjaelp">Vælger du et, bliver det til ét af dine egne.</div>
				{/if}
				{#each kategorier as k (k.navn)}
					<div class="vs-kat">{k.navn}</div>
					{#each k.forslag as f (f.id)}
						{@const valgt = !!matchForslag3(valgte, f)}
						<button
							class="vs-forslag"
							class:valgt
							class:slukket={!valgt && !plads}
							disabled={gemmer || (!valgt && !plads)}
							aria-pressed={valgt}
							onclick={() => void skiftForslag(f)}
						>
							<span class="vs-cirkel" class:valgt aria-hidden="true">
								{#if valgt}<Fluebe />{/if}
							</span>
							<span class="vs-l">{f.label}</span>
						</button>
					{/each}
				{/each}
			</section>
		{/if}

		<section class="kort">
			<div class="vs-egne-t">{erForlob ? 'Dine egne' : 'Skriv dine egne'}</div>

			{#each egne as e (e.id)}
				<div class="vs-egen">
					<span class="vs-egen-l">{e.label}</span>
					<button
						class="vs-x"
						disabled={gemmer}
						aria-label={`Fjern ${e.label}`}
						onclick={() => fjern(e.id)}>×</button
					>
				</div>
			{/each}

			{#if skriverEget}
				<div class="vs-skriv">
					<input
						class="vs-felt"
						type="text"
						maxlength={MAKS_TEGN3}
						placeholder="Fx: Drik vand før kaffe"
						bind:value={egenTekst}
						disabled={gemmer}
						onkeydown={(e) => {
							if (e.key === 'Enter') void tilfoejEget();
						}}
					/>
					<button
						class="vs-tilfoej"
						disabled={gemmer || !!egetSkridtFejl3(egenTekst, valgte)}
						onclick={() => void tilfoejEget()}>Tilføj</button
					>
				</div>
				{#if egenFejl}<div class="vs-lille-fejl">{egenFejl}</div>{/if}
			{:else if plads}
				<button
					class="vs-plus"
					disabled={gemmer}
					onclick={() => {
						skriverEget = true;
						egenTekst = '';
					}}>＋ Skriv dit eget</button
				>
			{/if}
		</section>

		{#if fuldTekst}
			<div class="kort rolig vs-fuld">{fuldTekst}</div>
		{/if}

		{#if erForlob}
			<div class="kort rolig vs-fuld">
				Linns skridt for dagen kan du ikke fjerne. De følger forløbet.
			</div>
		{/if}
	{/if}
</div>
