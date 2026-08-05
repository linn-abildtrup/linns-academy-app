<script lang="ts">
	// ============================================================
	// "Din måling" i 3.0.
	//
	// Ét samlet skema: de elleve symptomspoergsmaal og de fem skydere,
	// altid sammen. Besluttet af Linn 5. august 2026. Bagved gemmes de
	// stadig hver for sig i mrs_scores, praecis som den gamle app goer,
	// saa Linns tal og dashboards er uaendrede.
	//
	// Hun kan afbryde og fortsaette. Svarene ligger i browseren indtil
	// skemaet sendes, saa et halvt svar ikke gaar tabt.
	// ============================================================

	import { getContext, onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import type { User } from 'firebase/auth';
	import type { UserDoc } from '$lib/types';
	import type { Adgangsbillede } from '$lib/content/adgang3';
	import {
		MRS_ITEMS,
		SLIDER_SPORGSMAAL,
		validerScores,
		validerSliders,
		type MrsSliders
	} from '$lib/content/mrs';
	import { gemMrsScore, hentAlleMrsScores } from '$lib/firestore/mrs';

	const hentUser = getContext<() => User | null>('user');
	const hentUserDoc = getContext<() => UserDoc | null>('userDoc');
	const hentAdgang = getContext<() => Adgangsbillede>('adgang');

	const user = $derived(hentUser());
	const userDoc = $derived(hentUserDoc());
	const adgang = $derived(hentAdgang());

	const KLADDE = 'ny-maaling-kladde';

	// 0-4, hvor 0 er ingen gener. Lavt tal er godt.
	const SVAR_TEKST = ['Ingen', 'Let', 'Moderat', 'Svær', 'Meget svær'];

	let svar = $state<Record<number, number>>({});
	let skydere = $state<Partial<MrsSliders>>({});
	let gemmer = $state(false);
	let fejl = $state('');
	let faerdig = $state(false);
	let erFoerste = $state(true);

	const antalSpoergsmaal = MRS_ITEMS.length + SLIDER_SPORGSMAAL.length;
	const besvaret = $derived(
		Object.keys(svar).length + SLIDER_SPORGSMAAL.filter((s) => skydere[s.id] !== undefined).length
	);
	const procent = $derived(Math.round((besvaret / antalSpoergsmaal) * 100));
	const kanSende = $derived(besvaret === antalSpoergsmaal && !gemmer);

	onMount(() => {
		try {
			const raa = localStorage.getItem(KLADDE);
			if (raa) {
				const k = JSON.parse(raa);
				svar = k.svar ?? {};
				skydere = k.skydere ?? {};
			}
		} catch {
			// En ulaeselig kladde skal ikke spaerre for at tage maalingen.
		}
	});

	// Gemmer kladden ved hvert svar, saa hun kan lukke appen midt i.
	$effect(() => {
		const data = JSON.stringify({ svar, skydere });
		try {
			localStorage.setItem(KLADDE, data);
		} catch {
			// Fuldt lager eller privat browsing. Skemaet virker stadig.
		}
	});

	$effect(() => {
		const uid = user?.uid;
		if (!uid) return;
		hentAlleMrsScores(uid)
			.then((alle) => {
				erFoerste = alle.filter((s) => !s.kunSliders).length === 0;
			})
			.catch(() => {
				erFoerste = true;
			});
	});

	function saetSvar(id: number, vaerdi: number) {
		svar = { ...svar, [id]: vaerdi };
		fejl = '';
	}

	function saetSkyder(id: keyof MrsSliders, vaerdi: number) {
		skydere = { ...skydere, [id]: vaerdi };
		fejl = '';
	}

	async function send() {
		const uid = user?.uid;
		const email = user?.email ?? userDoc?.email ?? '';
		if (!uid) return;

		const fejlScores = validerScores(svar);
		if (fejlScores) {
			fejl = fejlScores;
			return;
		}
		const fejlSliders = validerSliders(skydere);
		if (fejlSliders) {
			fejl = fejlSliders;
			return;
		}

		gemmer = true;
		fejl = '';
		try {
			await gemMrsScore(
				uid,
				email,
				erFoerste ? 'forste' : 'opfoelgning',
				svar,
				skydere as MrsSliders
			);
			localStorage.removeItem(KLADDE);
			faerdig = true;
		} catch (e) {
			console.error('[ny] kunne ikke gemme maalingen', e);
			fejl = 'Din måling kunne ikke gemmes. Prøv igen om lidt, dine svar står her stadig.';
		} finally {
			gemmer = false;
		}
	}

	const nytOverskud = $derived.by(() => {
		const tal = SLIDER_SPORGSMAAL.map((s) => skydere[s.id]).filter(
			(v): v is number => typeof v === 'number'
		);
		if (tal.length === 0) return null;
		return Math.round((tal.reduce((a, b) => a + b, 0) / tal.length) * 10) / 10;
	});

	const erPaaForlob = $derived(adgang.aktiveForlob.length > 0);
</script>

<div class="ny-pad maaling-side">
	{#if faerdig}
		<section class="kort takkekort">
			<h1>Tak. Den er gemt.</h1>
			{#if nytOverskud !== null}
				<p class="stort-tal">{nytOverskud.toString().replace('.', ',')} <small>af 10</small></p>
			{/if}
			<p>
				Det er dit overskud i dag. Du kan se det på forsiden sammen med resten af din udvikling.
			</p>
			<a class="btn" href="/ny">Tilbage til forsiden</a>
		</section>
	{:else}
		<header class="maaling-top">
			<a class="tilbage" href="/ny" aria-label="Tilbage til forsiden">‹ Tilbage</a>
			<h1>Din måling</h1>
			<p>
				Seksten korte spørgsmål, cirka to minutter. Du kan lukke undervejs, dine svar bliver
				stående. {erPaaForlob ? 'Du måler hver uge på dit forløb.' : 'Du måler hver fjerde uge.'}
			</p>
			<div class="fremdrift" role="progressbar" aria-valuenow={besvaret} aria-valuemin="0" aria-valuemax={antalSpoergsmaal}>
				<div class="fremdrift-fyld" style:width="{procent}%"></div>
			</div>
			<div class="fremdrift-tekst">{besvaret} af {antalSpoergsmaal} besvaret</div>
		</header>

		<section>
			<div class="lab"><h2>Hvordan har du det</h2></div>
			<div class="kort sporgsmaal-kort">
				{#each MRS_ITEMS as item (item.id)}
					<fieldset class="spm">
						<legend>
							<span class="spm-t">{item.da}</span>
							<span class="spm-b">{item.description}</span>
						</legend>
						<div class="valg">
							{#each SVAR_TEKST as tekst, vaerdi (vaerdi)}
								<button
									type="button"
									class="valg-knap"
									class:valgt={svar[item.id] === vaerdi}
									aria-pressed={svar[item.id] === vaerdi}
									onclick={() => saetSvar(item.id, vaerdi)}
								>
									{tekst}
								</button>
							{/each}
						</div>
					</fieldset>
				{/each}
			</div>
		</section>

		<section>
			<div class="lab"><h2>Dit overskud lige nu</h2></div>
			<div class="kort sporgsmaal-kort">
				{#each SLIDER_SPORGSMAAL as s (s.id)}
					<div class="skyder">
						<label for={`skyder-${s.id}`}>{s.label}</label>
						<div class="skyder-raekke">
							<input
								id={`skyder-${s.id}`}
								type="range"
								min="1"
								max="10"
								step="1"
								value={skydere[s.id] ?? 5}
								oninput={(e) => saetSkyder(s.id, Number(e.currentTarget.value))}
							/>
							<span class="skyder-v" class:tom={skydere[s.id] === undefined}>
								{skydere[s.id] ?? '–'}
							</span>
						</div>
					</div>
				{/each}
			</div>
		</section>

		{#if fejl}
			<p class="fejl" role="alert">{fejl}</p>
		{/if}

		<button class="btn stor" disabled={!kanSende} onclick={send}>
			{gemmer ? 'Gemmer …' : 'Gem min måling'}
		</button>

		{#if !kanSende && !gemmer}
			<p class="kort rolig">
				Du mangler {antalSpoergsmaal - besvaret} svar. Tag dem i det tempo du har lyst til, målingen
				venter på dig.
			</p>
		{/if}
	{/if}
</div>
