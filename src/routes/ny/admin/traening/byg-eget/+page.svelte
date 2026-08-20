<script lang="ts">
	// ============================================================
	// Admin: hvem maa bygge sit eget traeningsprogram.
	// Bid 2, 15. august 2026.
	//
	// Adgangen ligger i den SAMME tabel som programmerne, bare som en
	// tildeling uden program. Linns valg, saa der er ét sted at kigge og
	// de samme fire knapper. Selve skaermen kunden bygger paa er bid 6.
	// ============================================================

	import { getContext, onMount } from 'svelte';
	import type { User } from 'firebase/auth';
	import { isAdmin } from '$lib/admin';
	import Ventetegn from '$lib/components/ny/Ventetegn.svelte';
	import TildelPanel from '$lib/components/ny/TildelPanel.svelte';
	import { getCurrentDay, toIsoLokal } from '$lib/content/forlob';
	import type { Forlob } from '$lib/content/forlobAdgang';
	import { hentAlleForlob } from '$lib/firestore/forlob';
	import {
		modtagerTekst3,
		periodeTekst3,
		sorterTildelinger3,
		tildelingStatus3,
		type HoldValg3,
		type NyTildeling3,
		type Tildelingsstatus3,
		type Traeningstildeling3
	} from '$lib/content/traeningTildeling3';
	import {
		hentTildelinger3,
		opretTildelinger3,
		sletTildeling3
	} from '$lib/firestore/traeningTildeling3';
	import { isoDato3 } from '$lib/firestore/traeningKunde3';
	import Sidehoved from '$lib/components/ny/Sidehoved.svelte';

	const hentUser = getContext<() => User | null>('user');
	const user = $derived(hentUser());
	const maaVaereHer = $derived(isAdmin(user));

	let henter = $state(true);
	let fejl = $state('');
	let besked = $state('');
	let forlob = $state<Forlob[]>([]);
	let alleTildelinger = $state<Traeningstildeling3[]>([]);
	let viserPanel = $state(false);

	const nu = Date.now();
	const idag = isoDato3(nu);

	function holdDag(forlobId: string): number | null {
		const f = forlob.find((x) => x.id === forlobId);
		if (!f) return null;
		return getCurrentDay({ startDato: toIsoLokal(f.startDato.toDate()), antalDage: f.antalDage });
	}

	function status(t: Traeningstildeling3): Tildelingsstatus3 {
		return tildelingStatus3(t, { idag, holdDag: holdDag(t.modtagerId) });
	}

	const mine = $derived(
		sorterTildelinger3(
			alleTildelinger.filter((t) => t.type === 'byg-eget'),
			status
		)
	);

	const holdValg = $derived<HoldValg3[]>(
		forlob
			.filter((f) => f.aktiv !== false)
			.map((f) => ({ id: f.id, navn: f.navn, dag: holdDag(f.id), antalKunder: null }))
	);

	onMount(async () => {
		if (!isAdmin(user)) {
			henter = false;
			return;
		}
		try {
			const [f, t] = await Promise.all([hentAlleForlob(), hentTildelinger3()]);
			forlob = f;
			alleTildelinger = t;
		} catch (e) {
			console.error('[admin] kunne ikke hente byg-eget-adgangen', e);
			fejl = 'Kunne ikke hente. Tjek at reglerne i Firebase er lagt ind.';
		} finally {
			henter = false;
		}
	});

	async function gem(nye: NyTildeling3[]) {
		await opretTildelinger3(nye);
		alleTildelinger = await hentTildelinger3();
		viserPanel = false;
		besked = 'Adgangen er givet.';
	}

	async function fjern(t: Traeningstildeling3) {
		if (!confirm(`${modtagerTekst3(t)} mister adgangen til at bygge sit eget program.`)) return;
		try {
			await sletTildeling3(t.id);
			alleTildelinger = await hentTildelinger3();
			besked = 'Adgangen er fjernet.';
		} catch (e) {
			console.error('[admin] kunne ikke fjerne adgangen', e);
			fejl = 'Kunne ikke fjerne.';
		}
	}

	function statusTekst(s: Tildelingsstatus3): string {
		return s === 'aktiv' ? 'Aktiv' : s === 'venter' ? 'Venter' : 'Slut';
	}
</script>

<svelte:head><title>Byg eget program · admin</title></svelte:head>

<div class="ny-pad adm">
	{#if !maaVaereHer}
		<div class="adm-kort">Siden er kun for admin.</div>
	{:else if henter}
		<div class="adm-venter"><Ventetegn variant="lille" /><span>Henter</span></div>
	{:else}
		<Sidehoved
			titel="Byg eget program"
			tilbage="/ny/admin/traening"
			tilbageTekst="Træning"
			under="Hvem må sætte deres egen træning sammen af dine øvelser."
			kant={false}
		/>

		{#if besked}<p class="adm-besked">{besked}</p>{/if}
		{#if fejl}<p class="adm-fejl">{fejl}</p>{/if}

		{#if mine.length === 0}
			<p class="adm-tom">Ingen har adgang endnu.</p>
		{:else}
			<div class="adm-liste">
				{#each mine as t (t.id)}
					{@const s = status(t)}
					<div class="adm-raekke">
						<div class="adm-raekke-t">
							<span>{modtagerTekst3(t)}</span>
							<span class="adm-mrk" class:klar={s === 'aktiv'} class:slut={s === 'slut'}>
								{statusTekst(s)}
							</span>
						</div>
						<div class="adm-raekke-s">{periodeTekst3(t)}</div>
						<div class="tr-mini-raekke">
							<button type="button" class="tr-mini" onclick={() => fjern(t)}>Fjern</button>
						</div>
					</div>
				{/each}
			</div>
		{/if}

		{#if viserPanel}
			<TildelPanel
				type="byg-eget"
				programId=""
				eksisterende={mine}
				hold={holdValg}
				adminUid={user?.uid ?? ''}
				{gem}
				luk={() => (viserPanel = false)}
			/>
		{:else}
			<button type="button" class="ch-knap primaer" onclick={() => (viserPanel = true)}>
				+ Giv adgang til nogen
			</button>
		{/if}

		<p class="adm-hjaelp">
			Hun bygger kun med øvelser fra din bank. Selve skærmen hun bygger på kommer i bid 6.
		</p>
	{/if}
</div>
