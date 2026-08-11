<script lang="ts">
	// ============================================================
	// Admin: laeg billeder paa opskrifterne. Se SPEC-3.0.md afsnit 26.7.
	//
	// Ny side i 3.0. Den gamle admin-side under app/admin/opskrifter maa
	// ikke roeres, og der staar stadig at upload tilfoejes senere.
	//
	// ÉN ret ad gangen, Linns beslutning 11. august. Et forslag om at
	// slippe mange filer og gaette hvilken opskrift de hoerer til blev
	// droppet: gaettet bygger paa filnavnet, og fotograferer hun en ret,
	// hedder filen IMG_4821.jpg.
	//
	// Bygget smalt foerst, fordi billedet ligger i telefonen lige efter
	// maden er lavet. Bliver bredere paa en laptop.
	// ============================================================

	import { getContext, onMount } from 'svelte';
	import type { User } from 'firebase/auth';
	import { isAdmin } from '$lib/admin';
	import { hentOpskrifter3, type Opskrift3 } from '$lib/firestore/opskrifter3';
	import { gemBillede, fjernBillede } from '$lib/firestore/opskriftBillede3';
	import { forberedBillede, type BilledeSaet } from '$lib/utils/billede3';
	import {
		sorterTilAdmin,
		taelBilleder,
		harBillede,
		manglerLille,
		vaegtTekst,
		sparetProcent,
		STOERRELSER
	} from '$lib/content/opskriftBillede3';
	import { filtrerOpskrifter3, soegetermer } from '$lib/content/opskriftSoeg3';
	import { KATEGORI_NAVN, farveKategori } from '$lib/content/opskriftKategori3';
	import Ventetegn from '$lib/components/ny/Ventetegn.svelte';

	const hentUser = getContext<() => User | null>('user');
	const user = $derived(hentUser());
	const maaVaereHer = $derived(isAdmin(user));

	type Udsnit = 'mangler' | 'har' | 'alle';

	let opskrifter = $state<Opskrift3[]>([]);
	let henter = $state(true);
	let fejl = $state<string | null>(null);
	let soegeord = $state('');
	let udsnit = $state<Udsnit>('mangler');

	/** Den opskrift hun er ved at give et billede. */
	let aaben = $state<Opskrift3 | null>(null);
	let saet = $state<BilledeSaet | null>(null);
	let visning = $state<string | null>(null);
	let arbejder = $state(false);
	let arkFejl = $state<string | null>(null);
	let bekraeftFjern = $state(false);
	let kvittering = $state<string | null>(null);

	const tal = $derived(taelBilleder(opskrifter));

	const viste = $derived.by(() => {
		const traef = filtrerOpskrifter3(opskrifter, { soegeord }).map((r) => r.opskrift);
		const udvalgt =
			udsnit === 'mangler'
				? traef.filter((o) => !harBillede(o))
				: udsnit === 'har'
					? traef.filter(harBillede)
					: traef;
		return sorterTilAdmin(udvalgt);
	});

	const soeger = $derived(soegetermer(soegeord).length > 0);

	async function hent() {
		henter = true;
		fejl = null;
		try {
			opskrifter = await hentOpskrifter3();
		} catch (e) {
			console.error('[ny] kunne ikke hente opskrifter', e);
			fejl = 'Kunne ikke hente opskrifterne. Prøv at genindlæse siden.';
		} finally {
			henter = false;
		}
	}

	onMount(hent);

	function luk() {
		if (visning) URL.revokeObjectURL(visning);
		aaben = null;
		saet = null;
		visning = null;
		arkFejl = null;
		bekraeftFjern = false;
	}

	function aabn(o: Opskrift3) {
		luk();
		aaben = o;
	}

	/** Billedet behandles med det samme, saa hun ser resultatet foer hun gemmer. */
	async function vaelgFil(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const fil = input.files?.[0];
		input.value = ''; // saa den samme fil kan vaelges igen efter en fejl
		if (!fil) return;

		arbejder = true;
		arkFejl = null;
		try {
			const nyt = await forberedBillede(fil);
			if (visning) URL.revokeObjectURL(visning);
			saet = nyt;
			visning = URL.createObjectURL(nyt.lille.blob);
		} catch (e) {
			console.error('[ny] kunne ikke behandle billedet', e);
			arkFejl = e instanceof Error ? e.message : 'Kunne ikke behandle billedet.';
		} finally {
			arbejder = false;
		}
	}

	async function gem() {
		const o = aaben;
		const s = saet;
		if (!o || !s) return;
		arbejder = true;
		arkFejl = null;
		try {
			const gemt = await gemBillede(o.id, o.titel, s, {
				billedeSti: o.billedeSti,
				billedeStiLille: o.billedeStiLille
			});
			// Opdatér listen her, saa den ikke skal hentes forfra.
			opskrifter = opskrifter.map((x) => (x.id === o.id ? { ...x, ...gemt } : x));
			kvittering = `Billedet er lagt på ${o.titel}`;
			setTimeout(() => (kvittering = null), 3000);
			luk();
		} catch (e) {
			console.error('[ny] kunne ikke gemme billedet', e);
			arkFejl = 'Kunne ikke gemme billedet. Prøv igen.';
		} finally {
			arbejder = false;
		}
	}

	async function fjern() {
		const o = aaben;
		if (!o) return;
		arbejder = true;
		arkFejl = null;
		try {
			await fjernBillede(o.id, {
				billedeSti: o.billedeSti,
				billedeStiLille: o.billedeStiLille
			});
			opskrifter = opskrifter.map((x) =>
				x.id === o.id
					? { ...x, billedeUrl: null, billedeUrlLille: null, billedeSti: null, billedeStiLille: null }
					: x
			);
			kvittering = `Billedet er fjernet fra ${o.titel}`;
			setTimeout(() => (kvittering = null), 3000);
			luk();
		} catch (e) {
			console.error('[ny] kunne ikke fjerne billedet', e);
			arkFejl = 'Kunne ikke fjerne billedet. Prøv igen.';
		} finally {
			arbejder = false;
		}
	}

	const samletVaegt = $derived(saet ? saet.lille.blob.size + saet.stor.blob.size : 0);
</script>

<svelte:head><title>Opskrift-billeder · admin</title></svelte:head>

{#if !maaVaereHer}
	<p class="ob-nej">Siden er kun for admin.</p>
{:else}
	<header class="ob-hoved">
		<h1 class="ob-h1">Opskrift-billeder</h1>
		<div class="ob-tael">
			<span class="ob-tal">{tal.medBillede} af {tal.ialt}</span>
			<span class="ob-bar"><span style="width:{tal.procent}%"></span></span>
			<span class="ob-tekst">har billede</span>
		</div>
	</header>

	{#if henter}
		<Ventetegn />
	{:else if fejl}
		<p class="ob-fejl">{fejl}</p>
	{:else}
		<input
			class="ob-soeg"
			type="search"
			bind:value={soegeord}
			placeholder="Søg blandt {tal.ialt} opskrifter"
			aria-label="Søg i opskrifter"
		/>

		<div class="ob-udsnit" role="group" aria-label="Vis">
			<button
				type="button"
				class="ob-chip"
				class:valgt={udsnit === 'mangler'}
				onclick={() => (udsnit = 'mangler')}>Mangler <span class="ob-n">{tal.uden}</span></button
			>
			<button
				type="button"
				class="ob-chip"
				class:valgt={udsnit === 'har'}
				onclick={() => (udsnit = 'har')}>Har billede <span class="ob-n">{tal.medBillede}</span></button
			>
			<button
				type="button"
				class="ob-chip"
				class:valgt={udsnit === 'alle'}
				onclick={() => (udsnit = 'alle')}>Alle <span class="ob-n">{tal.ialt}</span></button
			>
		</div>

		{#if tal.kunStor > 0 && udsnit !== 'mangler'}
			<p class="ob-note">
				{tal.kunStor}
				{tal.kunStor === 1 ? 'opskrift har' : 'opskrifter har'} kun den store udgave, fra dengang billederne
				lå i Firestore. De virker, men fliserne henter mere end de behøver. Læg billedet på igen for at
				rette det.
			</p>
		{/if}

		{#if viste.length === 0}
			<p class="ob-tom">
				{soeger ? 'Ingen opskrifter passer på det ord.' : 'Der er ingen opskrifter her.'}
			</p>
		{:else}
			<ul class="ob-liste">
				{#each viste as o (o.id)}
					{@const farve = farveKategori(o.kategorier3)}
					<li>
						<button type="button" class="ob-raekke" onclick={() => aabn(o)}>
							<span class="ob-thumb f-{farve ?? 'andet'}">
								{#if o.billedeUrlLille || o.billedeUrl}
									<img src={o.billedeUrlLille ?? o.billedeUrl} alt="" loading="lazy" />
								{:else}
									<span class="ob-mangler">mangler</span>
								{/if}
							</span>
							<span class="ob-midt">
								<span class="ob-navn">{o.titel}</span>
								<span class="ob-under">
									{#if farve}{KATEGORI_NAVN[farve]}{/if}
									{#if manglerLille(o)}<span class="ob-advar">kun stor udgave</span>{/if}
								</span>
							</span>
							<span class="ob-handling">{harBillede(o) ? 'Skift' : 'Vælg'}</span>
						</button>
					</li>
				{/each}
			</ul>
		{/if}
	{/if}

	{#if kvittering}
		<p class="ob-kvit" aria-live="polite">{kvittering}</p>
	{/if}
{/if}

{#if aaben}
	<div class="ark-lag ny-tokens" role="dialog" aria-modal="true" aria-labelledby="ob-ark-titel">
		<button type="button" class="ark-luk-flade" onclick={luk} aria-label="Luk"></button>
		<div class="ob-ark">
			<div class="ma-greb" aria-hidden="true"></div>
			<button type="button" class="ma-luk" onclick={luk} aria-label="Luk">×</button>

			<h2 class="ob-ark-titel" id="ob-ark-titel">{aaben.titel}</h2>

			<div class="ob-ark-rul">
				{#if arkFejl}
					<p class="ob-fejl">{arkFejl}</p>
				{/if}

				{#if saet && visning}
					<!-- De rigtige former, ikke ét stort billede der snyder. Flisen er
					     kun 62 px hoej, saa noget vigtigt kan sagtens blive skaaret af. -->
					<p class="ob-etiket">Sådan ser den ud i gitteret</p>
					<div class="ob-demo-flise">
						<span class="ob-demo-top" style="background-image:url({visning})"></span>
						<span class="ob-demo-tekst">
							<span class="ob-demo-navn">{aaben.titel}</span>
						</span>
					</div>

					<p class="ob-etiket">Når hun åbner opskriften</p>
					<div class="ob-demo-ark" style="background-image:url({visning})"></div>

					<p class="ob-etiket">Hvad der sker med filen</p>
					<dl class="ob-maal">
						<div>
							<dt>Din fil</dt>
							<dd>{vaegtTekst(saet.kildeBytes)} · {saet.kildeBredde} × {saet.kildeHoejde}</dd>
						</div>
						<div>
							<dt>Lille, {STOERRELSER.lille.bruges}</dt>
							<dd>{saet.lille.bredde} px · {vaegtTekst(saet.lille.blob.size)} · {saet.lille.endelse}</dd>
						</div>
						<div>
							<dt>Stor, {STOERRELSER.stor.bruges}</dt>
							<dd>{saet.stor.bredde} px · {vaegtTekst(saet.stor.blob.size)} · {saet.stor.endelse}</dd>
						</div>
						<div>
							<dt>Sparet</dt>
							<dd>{sparetProcent(saet.kildeBytes, samletVaegt)} %</dd>
						</div>
					</dl>
				{:else if harBillede(aaben)}
					<p class="ob-etiket">Det billede der ligger nu</p>
					<div class="ob-demo-ark" style="background-image:url({aaben.billedeUrl})"></div>
				{:else}
					<p class="ob-hjaelp">
						Vælg et billede af retten. Det bliver lavet mindre i to størrelser her på telefonen, før
						noget sendes, så du ikke bruger data på en fil på flere megabyte.
					</p>
				{/if}

				{#if bekraeftFjern}
					<div class="ob-bekraeft">
						<p>Fjern billedet fra <b>{aaben.titel}</b>? Filerne slettes også fra Storage.</p>
						<div class="ob-bekraeft-knapper">
							<button type="button" class="ob-rolig" onclick={() => (bekraeftFjern = false)}>
								Nej, behold
							</button>
							<button type="button" class="ob-farlig" onclick={fjern} disabled={arbejder}>
								Ja, fjern
							</button>
						</div>
					</div>
				{/if}
			</div>

			<div class="ob-ark-bund">
				{#if harBillede(aaben) && !bekraeftFjern}
					<button
						type="button"
						class="ob-rolig"
						onclick={() => (bekraeftFjern = true)}
						disabled={arbejder}>Fjern</button
					>
				{/if}
				<label class="ob-rolig ob-vaelg" class:travl={arbejder}>
					{arbejder && !saet ? 'Behandler' : saet ? 'Vælg en anden' : 'Vælg billede'}
					<input type="file" accept="image/*" onchange={vaelgFil} disabled={arbejder} />
				</label>
				{#if saet}
					<button type="button" class="ob-gem" onclick={gem} disabled={arbejder}>
						{arbejder ? 'Gemmer' : 'Gem billedet'}
					</button>
				{/if}
			</div>
		</div>
	</div>
{/if}
