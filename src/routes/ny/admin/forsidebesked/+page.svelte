<script lang="ts">
	// ============================================================
	// Admin: besked paa forsiden.
	//
	// Til det der IKKE er en samtale. Den lander i den samme boble som
	// dagens note hos kunden, og den kan rettes og fjernes igen — det er
	// hele forskellen paa den og en besked til én kunde, som er
	// afleveret i det sekund den er sendt.
	//
	// LISTEN OVER DEM DER STAAR NU er det vigtigste paa siden. Uden den
	// bliver forsiden en opslagstavle ingen rydder.
	//
	// Linns beslutninger 23. august, se HANDOVER 9.44.
	// ============================================================

	import { getContext } from 'svelte';
	import type { User } from 'firebase/auth';
	import { isAdmin } from '$lib/admin';
	import {
		VARIGHED_NAVNE3,
		aktive3,
		modtagerTekst3,
		slutMsFor3,
		tilbageTekst3,
		type Forsidebesked3,
		type Modtager3,
		type Varighed3
	} from '$lib/content/forsidebesked3';
	import {
		fjernForsidebesked3,
		gemForsidebesked3,
		hentForsidebeskeder3
	} from '$lib/firestore/forsidebesked3';
	import { hentAlleForlob } from '$lib/firestore/forlob';
	import type { Forlob } from '$lib/content/forlobAdgang';
	import Sidehoved from '$lib/components/ny/Sidehoved.svelte';
	import Ventetegn from '$lib/components/ny/Ventetegn.svelte';

	const hentUser = getContext<() => User | null>('user');
	const user = $derived(hentUser());
	const maaVaereHer = $derived(isAdmin(user));

	let henter = $state(true);
	let gemmer = $state(false);
	let fejl = $state('');
	let kvittering = $state('');
	let beskeder = $state<Forsidebesked3[]>([]);
	let forlob = $state<{ id: string; navn: string }[]>([]);

	// Det hun er ved at skrive
	let retterId = $state<string | null>(null);
	let modtager = $state<Modtager3>({ slags: 'alle' });
	let tekst = $state('');
	let varighed = $state<Varighed3>('idag');
	let prik = $state(true);

	const VARIGHEDER: Varighed3[] = ['idag', 'tre', 'uge', 'altid'];
	const navne = $derived(Object.fromEntries(forlob.map((f) => [f.id, f.navn])));
	const staarNu = $derived(
		aktive3(beskeder, Date.now()).sort((a, b) => b.oprettetMs - a.oprettetMs)
	);

	$effect(() => {
		if (!maaVaereHer) return;
		let afbrudt = false;
		(async () => {
			const [b, f] = await Promise.all([hentForsidebeskeder3(), hentAlleForlob()]);
			if (afbrudt) return;
			beskeder = b;
			forlob = (f as Forlob[]).map((x) => ({ id: x.id, navn: x.navn }));
			henter = false;
		})().catch((e) => {
			console.error('[ny] kunne ikke hente forsidebeskeder', e);
			fejl = 'Kunne ikke hente beskederne.';
			henter = false;
		});
		return () => {
			afbrudt = true;
		};
	});

	function erValgt(m: Modtager3): boolean {
		if (m.slags !== modtager.slags) return false;
		if (m.slags === 'forlob' && modtager.slags === 'forlob') return m.forlobId === modtager.forlobId;
		return true;
	}

	function nulstil() {
		retterId = null;
		tekst = '';
		varighed = 'idag';
		prik = true;
		modtager = { slags: 'alle' };
	}

	function ret(b: Forsidebesked3) {
		retterId = b.id;
		tekst = b.tekst;
		modtager = b.modtager;
		prik = b.prik;
		// Varigheden kan ikke regnes tilbage praecist, saa vi lader den staa
		// paa den hun vaelger. Roerer hun den ikke, bevares slutdatoen.
		kvittering = '';
	}

	async function gem() {
		if (gemmer || !tekst.trim()) return;
		gemmer = true;
		fejl = '';
		kvittering = '';
		try {
			const gammel = retterId ? beskeder.find((b) => b.id === retterId) : null;
			await gemForsidebesked3({
				id: retterId ?? undefined,
				tekst,
				modtager,
				// Retter hun en eksisterende og ikke har rørt varigheden,
				// bevares slutdatoen. Ellers ville en stavefejl forlaenge den.
				slutMs: gammel && varighed === 'idag' ? gammel.slutMs : slutMsFor3(varighed, Date.now()),
				oprettetMs: gammel?.oprettetMs,
				prik
			});
			beskeder = await hentForsidebeskeder3();
			kvittering = retterId ? 'Rettet.' : 'Den står på forsiden nu.';
			nulstil();
		} catch (e) {
			console.error('[ny] kunne ikke gemme', e);
			fejl = 'Kunne ikke gemme. Prøv igen.';
		} finally {
			gemmer = false;
		}
	}

	async function fjern(id: string) {
		if (gemmer) return;
		gemmer = true;
		try {
			await fjernForsidebesked3(id);
			beskeder = beskeder.filter((b) => b.id !== id);
			if (retterId === id) nulstil();
		} catch (e) {
			console.error('[ny] kunne ikke fjerne', e);
			fejl = 'Kunne ikke fjerne den.';
		} finally {
			gemmer = false;
		}
	}
</script>

<div class="ny-pad noti-admin">
	<Sidehoved
		titel="Besked på forsiden"
		tilbage="/ny/admin"
		tilbageTekst="Admin"
		under="Til det der ikke er en samtale."
		kant={false}
	/>

	{#if !maaVaereHer}
		<div class="kort rolig">Siden er kun for admin.</div>
	{:else if henter}
		<div class="lektion-venter">
			<Ventetegn variant="lille" />
			<span>Henter beskederne</span>
		</div>
	{:else}
		{#if fejl}<div class="kort rolig nm-fejl">{fejl}</div>{/if}

		<section class="kort">
			<div class="fb-lbl">Hvem</div>
			<div class="fb-valg">
				{#each forlob as f (f.id)}
					<button
						class="fb-chip"
						class:paa={erValgt({ slags: 'forlob', forlobId: f.id })}
						onclick={() => (modtager = { slags: 'forlob', forlobId: f.id })}>{f.navn}</button
					>
				{/each}
				<button
					class="fb-chip"
					class:paa={erValgt({ slags: 'medlemmer' })}
					onclick={() => (modtager = { slags: 'medlemmer' })}>Alle medlemmer</button
				>
				<button
					class="fb-chip"
					class:paa={erValgt({ slags: 'alle' })}
					onclick={() => (modtager = { slags: 'alle' })}>Alle</button
				>
			</div>

			<textarea class="skriv-felt" rows="4" placeholder="Skriv beskeden…" bind:value={tekst}
			></textarea>

			<div class="fb-lbl" style="margin-top:12px">Hvor længe</div>
			<div class="fb-valg">
				{#each VARIGHEDER as v (v)}
					<button class="fb-chip" class:paa={varighed === v} onclick={() => (varighed = v)}>
						{VARIGHED_NAVNE3[v]}
					</button>
				{/each}
			</div>

			<div class="nk" style="border-top:1px solid var(--line);margin-top:11px">
				<div>
					<div class="nk-t">Sig også til på telefonen</div>
					<div class="nk-s">De der har sagt ja bliver prikket</div>
				</div>
				<button class="nk-sw" class:on={prik} aria-pressed={prik} aria-label="Sig til på telefonen" onclick={() => (prik = !prik)}
					><i></i></button
				>
			</div>

			<button class="nt-knap" disabled={gemmer || !tekst.trim()} onclick={gem}>
				{gemmer ? 'Gemmer' : retterId ? 'Gem rettelsen' : 'Sæt den op'}
			</button>
			{#if retterId}
				<button class="fb-annuller" onclick={nulstil}>Annuller</button>
			{/if}
			{#if kvittering}<div class="nt-kvittering">{kvittering}</div>{/if}
		</section>

		<div class="lab"><h2>Står på forsiden nu</h2></div>
		<section class="kort">
			{#if staarNu.length === 0}
				<div class="na-tom">Der står ingen beskeder på forsiden.</div>
			{:else}
				{#each staarNu as b (b.id)}
					<div class="staar">
						<button class="staar-tekst" onclick={() => ret(b)}>
							<span class="n">{b.tekst}</span>
							<span class="s">
								{modtagerTekst3(b.modtager, navne)} · {tilbageTekst3(b, Date.now())}
								{b.prik ? '· prikker' : ''}
							</span>
						</button>
						<button class="na-x" onclick={() => fjern(b.id)} aria-label="Fjern">×</button>
					</div>
				{/each}
			{/if}
		</section>

		<div class="kort rolig na-forklaring">
			Tryk på en besked for at rette teksten. Krydset fjerner den med det samme. Skal det være en
			besked hun kan svare på, så brug Skriv til en kunde i stedet.
		</div>
	{/if}
</div>
