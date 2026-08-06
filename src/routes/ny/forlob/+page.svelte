<script lang="ts">
	// ============================================================
	// Forloebets kalender i 3.0.
	//
	// Alle dage fra baseline til sidste dag. Fremtidige dage er laaste,
	// som de er i dag. Besluttet af Linn 6. august 2026.
	//
	// Dag 0 er baseline, ikke en programdag. Se forlobAdgang.dageSidenStart.
	// ============================================================

	import { getContext } from 'svelte';
	import type { User } from 'firebase/auth';
	import type { Adgangsbillede } from '$lib/content/adgang3';
	import { dagDato } from '$lib/content/forlobAdgang';
	import { hentKlaret, datoNoegle } from '$lib/firestore/forside3';
	import { hentForlobsdage } from '$lib/firestore/forlob';
	import Ventetegn from '$lib/components/ny/Ventetegn.svelte';
	import Fluebe from '$lib/components/ny/Fluebe.svelte';

	const hentUser = getContext<() => User | null>('user');
	const hentAdgang = getContext<() => Adgangsbillede>('adgang');
	const user = $derived(hentUser());
	const adgang = $derived(hentAdgang());
	const forlob = $derived(adgang.aktiveForlob[0] ?? null);

	let antalLektioner = $state<Map<number, number>>(new Map());
	let klaret = $state<Set<string>>(new Set());
	let lektionerPrDag = $state<Map<number, string[]>>(new Map());
	let henter = $state(true);

	$effect(() => {
		const uid = user?.uid;
		const f = forlob;
		if (!uid || !f) return;
		let afbrudt = false;

		(async () => {
			henter = true;
			const [dage, k] = await Promise.all([hentForlobsdage(f.forlobId), hentKlaret(uid)]);
			if (afbrudt) return;
			const antal = new Map<number, number>();
			const ids = new Map<number, string[]>();
			for (const d of dage) {
				const liste = d.lektioner ?? [];
				antal.set(d.dagNummer, liste.length);
				ids.set(
					d.dagNummer,
					liste.map((l) => l.id)
				);
			}
			antalLektioner = antal;
			lektionerPrDag = ids;
			klaret = k;
			henter = false;
		})().catch((e) => {
			console.error('[ny] kunne ikke hente forloebet', e);
			henter = false;
		});

		return () => {
			afbrudt = true;
		};
	});

	const MAANEDER = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];

	const dage = $derived.by(() => {
		const f = forlob;
		if (!f) return [];
		return Array.from({ length: f.antalDage + 1 }, (_, dag) => {
			const dato = dagDato(new Date(f.startMs), dag);
			const ids = lektionerPrDag.get(dag) ?? [];
			return {
				dag,
				noegle: datoNoegle(dato),
				dato: `${dato.getDate()}. ${MAANEDER[dato.getMonth()]}`,
				laast: dag > f.dagNummer,
				erIDag: dag === f.dagNummer,
				antal: antalLektioner.get(dag) ?? 0,
				alleTaget: ids.length > 0 && ids.every((id) => klaret.has(id))
			};
		});
	});
</script>

<div class="ny-pad forlob-side">
	<header class="side-top" style="padding-left:0;padding-right:0">
		<a class="tilbage" href="/ny">‹ Forside</a>
		{#if forlob}
			<h1>{forlob.navn}</h1>
			<p>Dag {forlob.dagNummer} af {forlob.antalDage}. Du kan altid gå tilbage og se en dag igen.</p>
		{:else}
			<h1>Dit forløb</h1>
		{/if}
	</header>

	{#if !forlob}
		<div class="kort rolig">Du er ikke på et forløb lige nu.</div>
	{:else if henter}
		<div class="lektion-venter">
			<Ventetegn variant="lille" />
			<span>Henter dine dage</span>
		</div>
	{:else}
		<div class="dag-liste">
			{#each dage as d (d.dag)}
				{#if d.laast}
					<div class="dag-raekke laast">
						<span class="dag-nr">{d.dag}</span>
						<span class="dag-tekst">
							<span class="dag-t">{d.dag === 0 ? 'Baseline' : `Dag ${d.dag}`}</span>
							<span class="dag-s">{d.dato}</span>
						</span>
						<span class="dag-laas" aria-hidden="true">🔒</span>
					</div>
				{:else}
					<a class="dag-raekke" class:idag={d.erIDag} href={`/ny/dag/${d.noegle}`}>
						<span class="dag-nr" class:taget={d.alleTaget}>
							{#if d.alleTaget}<Fluebe />{:else}{d.dag}{/if}
						</span>
						<span class="dag-tekst">
							<span class="dag-t">{d.dag === 0 ? 'Baseline' : `Dag ${d.dag}`}</span>
							<span class="dag-s">
								{d.dato}{d.antal > 0 ? ` · ${d.antal} ${d.antal === 1 ? 'lektion' : 'lektioner'}` : ''}
							</span>
						</span>
						{#if d.erIDag}<span class="dag-idag">I dag</span>{/if}
						<span class="dag-pil" aria-hidden="true">›</span>
					</a>
				{/if}
			{/each}
		</div>
	{/if}
</div>
