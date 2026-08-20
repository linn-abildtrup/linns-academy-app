<script lang="ts">
	// ============================================================
	// Admin: traeningskategorier. Bid 1, 15. august 2026.
	//
	// Kategorien er det udstyr kunden traener med. Linn opretter dem selv,
	// saa der kan komme et sjippetov ind uden en kodeaendring.
	//
	// "Vises altid" saettes paa kropsvaegt. Uden det flueben kunne kunden
	// vaelge haandvaegte og staa tilbage med en tom skaerm.
	// ============================================================

	import { getContext, onMount } from 'svelte';
	import type { User } from 'firebase/auth';
	import { isAdmin } from '$lib/admin';
	import Ventetegn from '$lib/components/ny/Ventetegn.svelte';
	import type { Udstyr } from '$lib/content/mikrotraening';
	import {
		UDSTYR_VALG,
		flytKategori3,
		kategoriKanSlettes3,
		naesteRaekkefolge3,
		validerKategori3,
		type TraeningKategori3
	} from '$lib/content/traeningKategori3';
	import { antalPrKategori, type Traeningsprogram3 } from '$lib/content/traeningsprogram3';
	import {
		gemKategori3,
		gemRaekkefolge3,
		hentKategorier3,
		opretKategori3,
		sletKategori3
	} from '$lib/firestore/traeningKategori3';
	import { hentProgrammer3 } from '$lib/firestore/traeningsprogram3';
	import Sidehoved from '$lib/components/ny/Sidehoved.svelte';

	const hentUser = getContext<() => User | null>('user');
	const user = $derived(hentUser());
	const maaVaereHer = $derived(isAdmin(user));

	let henter = $state(true);
	let kategorier = $state<TraeningKategori3[]>([]);
	let programmer = $state<Traeningsprogram3[]>([]);
	let fejl = $state('');
	let besked = $state('');
	let gemmer = $state(false);

	/** Doc-id paa den kategori der rettes, eller 'ny' naar der oprettes. */
	let redigerer = $state<string | null>(null);
	let navn = $state('');
	let visesAltid = $state(false);
	let udstyrTag = $state<Udstyr | null>(null);

	const tal = $derived(antalPrKategori(programmer));

	onMount(async () => {
		if (!isAdmin(user)) {
			henter = false;
			return;
		}
		try {
			const [k, p] = await Promise.all([hentKategorier3(), hentProgrammer3()]);
			kategorier = k;
			programmer = p;
		} catch (e) {
			console.error('[admin] kunne ikke hente kategorier', e);
			fejl = 'Kunne ikke hente. Tjek at reglerne i Firebase er lagt ind.';
		} finally {
			henter = false;
		}
	});

	function aabnNy() {
		redigerer = 'ny';
		navn = '';
		visesAltid = false;
		udstyrTag = null;
		fejl = '';
		besked = '';
	}

	function aabnRet(k: TraeningKategori3) {
		redigerer = k.id;
		navn = k.navn;
		visesAltid = k.visesAltid;
		udstyrTag = k.udstyrTag;
		fejl = '';
		besked = '';
	}

	async function gem() {
		if (gemmer || !redigerer) return;
		const egetId = redigerer === 'ny' ? undefined : redigerer;
		const problem = validerKategori3(navn, kategorier, egetId);
		if (problem) {
			fejl = problem;
			return;
		}
		gemmer = true;
		fejl = '';
		try {
			if (redigerer === 'ny') {
				await opretKategori3({
					navn: navn.trim(),
					visesAltid,
					udstyrTag,
					raekkefolge: naesteRaekkefolge3(kategorier)
				});
				besked = 'Kategorien er oprettet.';
			} else {
				const gammel = kategorier.find((k) => k.id === redigerer);
				if (!gammel) return;
				await gemKategori3({ ...gammel, navn: navn.trim(), visesAltid, udstyrTag });
				besked = 'Kategorien er rettet.';
			}
			kategorier = await hentKategorier3();
			redigerer = null;
		} catch (e) {
			console.error('[admin] kunne ikke gemme kategori', e);
			fejl = 'Kunne ikke gemme.';
		} finally {
			gemmer = false;
		}
	}

	async function flyt(id: string, retning: 'op' | 'ned') {
		const ny = flytKategori3(kategorier, id, retning);
		if (ny === kategorier) return;
		kategorier = ny;
		try {
			await gemRaekkefolge3(ny);
		} catch (e) {
			console.error('[admin] kunne ikke gemme raekkefoelgen', e);
			fejl = 'Rækkefølgen blev ikke gemt.';
		}
	}

	async function slet(k: TraeningKategori3) {
		const spaerre = kategoriKanSlettes3(k.id, programmer);
		if (spaerre) {
			fejl = spaerre;
			return;
		}
		if (!confirm(`Slet kategorien "${k.navn}"?`)) return;
		try {
			await sletKategori3(k.id);
			kategorier = await hentKategorier3();
			if (redigerer === k.id) redigerer = null;
			besked = 'Kategorien er slettet.';
		} catch (e) {
			console.error('[admin] kunne ikke slette kategori', e);
			fejl = 'Kunne ikke slette.';
		}
	}

	function udstyrLabel(tag: Udstyr | null): string {
		return UDSTYR_VALG.find((v) => v.vaerdi === tag)?.label ?? 'Ingen kobling';
	}
</script>

<svelte:head><title>Kategorier · admin</title></svelte:head>

<div class="ny-pad adm">
	{#if !maaVaereHer}
		<div class="adm-kort">Siden er kun for admin.</div>
	{:else if henter}
		<div class="adm-venter"><Ventetegn variant="lille" /><span>Henter</span></div>
	{:else}
		<Sidehoved
			titel="Kategorier"
			tilbage="/ny/admin/traening"
			tilbageTekst="Træning"
			under="Det udstyr kunden kan vælge imellem."
			kant={false}
		/>

		{#if besked}<p class="adm-besked">{besked}</p>{/if}
		{#if fejl}<p class="adm-fejl">{fejl}</p>{/if}

		{#if redigerer}
			<section class="adm-kort">
				<h2>{redigerer === 'ny' ? 'Ny kategori' : 'Ret kategori'}</h2>

				<label class="adm-felt">
					<span>Navn</span>
					<input type="text" bind:value={navn} placeholder="Med håndvægte" />
				</label>
				<p class="adm-hjaelp">Det navn kunden ser når hun vælger sit udstyr.</p>

				<label class="adm-tjek">
					<input type="checkbox" bind:checked={visesAltid} />
					<span>Vises altid til alle</span>
				</label>
				<p class="adm-hjaelp">
					Sæt flueben her på kropsvægt. Så ser hun altid de programmer, uanset hvad hun ellers har
					valgt, fordi hun altid har sin egen krop med.
				</p>

				<label class="adm-felt">
					<span>Øvelser i banken</span>
					<select bind:value={udstyrTag}>
						{#each UDSTYR_VALG as valg (valg.label)}
							<option value={valg.vaerdi}>{valg.label}</option>
						{/each}
					</select>
				</label>
				<p class="adm-hjaelp">
					Bruges kun når du vælger øvelser eller beder om et udkast. Så foreslår den kun øvelser der
					passer. Et nyt redskab som sjippetov findes ikke i banken endnu, og så vælger du selv fra
					hele listen.
				</p>

				<div class="adm-knapper">
					<button type="button" class="ch-knap primaer" onclick={gem} disabled={gemmer}>
						{gemmer ? 'Gemmer' : 'Gem'}
					</button>
					<button
						type="button"
						class="ch-knap sekundaer"
						onclick={() => (redigerer = null)}
						disabled={gemmer}
					>
						Fortryd
					</button>
				</div>
			</section>
		{/if}

		{#if kategorier.length === 0}
			<p class="adm-tom">Du har ingen kategorier endnu.</p>
		{:else}
			<div class="adm-liste">
				{#each kategorier as k, i (k.id)}
					<div class="adm-raekke">
						<div class="adm-raekke-t">
							<span>{k.navn}</span>
							{#if k.visesAltid}<span class="adm-mrk altid">Vises altid</span>{/if}
						</div>
						<div class="adm-raekke-s">
							{(tal[k.id] ?? 0) === 1 ? '1 program' : `${tal[k.id] ?? 0} programmer`} · {udstyrLabel(
								k.udstyrTag
							)}
						</div>
						<div class="tr-mini-raekke">
							<button
								type="button"
								class="tr-mini"
								onclick={() => flyt(k.id, 'op')}
								disabled={i === 0}
								aria-label="Flyt op">↑</button
							>
							<button
								type="button"
								class="tr-mini"
								onclick={() => flyt(k.id, 'ned')}
								disabled={i === kategorier.length - 1}
								aria-label="Flyt ned">↓</button
							>
							<button type="button" class="tr-mini" onclick={() => aabnRet(k)}>Ret</button>
							<button type="button" class="tr-mini" onclick={() => slet(k)}>Slet</button>
						</div>
					</div>
				{/each}
			</div>
		{/if}

		{#if !redigerer}
			<button type="button" class="ch-knap primaer" onclick={aabnNy}>+ Ny kategori</button>
		{/if}
	{/if}
</div>
