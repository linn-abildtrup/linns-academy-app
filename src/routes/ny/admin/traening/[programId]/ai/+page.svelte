<script lang="ts">
	// ============================================================
	// Admin: ret et traeningsprogram med AI. 16. august 2026.
	//
	// Den svaere af de to veje, og den hvor der skal vaere mest
	// forsigtighed.
	//
	// DER VISES ALTID PRAECIS HVILKE DAGE DER BLIVER AENDRET, foer der
	// gemmes. Med foer og efter, og med en linje om hvad der er uroert.
	// Den linje er lige saa vigtig som listen. Linns krav 15. august:
	// uden den kan hun ikke se om AI'en har roert dage hun ikke bad om.
	//
	// KUN DE DAGE SAETNINGEN HANDLER OM SENDES AFSTED. "Uge 3" bliver
	// til dag 15 til 21 her paa vores side, foer der ringes nogen steder
	// hen. Et program paa 84 dage kan ikke sendes afsted hver gang hun
	// skriver en saetning, hverken i tid eller i penge.
	//
	// KAN DET IKKE REGNES UD, SPOERGES DER. Uden at ringe til AI'en, for
	// det spoergsmaal kan vi selv stille. Et gaet der rammer forkert
	// retter dage hun ikke bad om.
	// ============================================================

	import { getContext, onMount } from 'svelte';
	import { page } from '$app/state';
	import type { User } from 'firebase/auth';
	import { isAdmin } from '$lib/admin';
	import Ventetegn from '$lib/components/ny/Ventetegn.svelte';
	import type { Exercise, TrainingDay } from '$lib/content/mikrotraening';
	import { hentAlleExercises } from '$lib/firestore/mikrotraening';
	import {
		filtrerOevelserTilKategori,
		type TraeningKategori3
	} from '$lib/content/traeningKategori3';
	import type { Traeningsprogram3 } from '$lib/content/traeningsprogram3';
	import {
		MAX_RET_DAGE,
		aendredeDage3,
		aendringsliste3,
		dageFraSaetning3,
		hvilkeDageSpoergsmaal3,
		maaSendeMere3,
		numreTekst3,
		uroerteTekst3,
		validerBesked3,
		type AiBesked3,
		type AiSvar3,
		type Aendring3
	} from '$lib/content/traeningAi3';
	import { hentKategorier3 } from '$lib/firestore/traeningKategori3';
	import { gemUdvalgteDage3, hentProgram3 } from '$lib/firestore/traeningsprogram3';
	import Sidehoved from '$lib/components/ny/Sidehoved.svelte';

	const hentUser = getContext<() => User | null>('user');
	const user = $derived(hentUser());
	const maaVaereHer = $derived(isAdmin(user));
	const programId = $derived(page.params.programId ?? '');

	let henter = $state(true);
	let fejl = $state('');
	let besked = $state('');
	let venter = $state(false);
	let gemmer = $state(false);

	let program = $state<Traeningsprogram3 | null>(null);
	let alleDage = $state<TrainingDay[]>([]);
	let kategori = $state<TraeningKategori3 | null>(null);
	let bank = $state<Exercise[]>([]);

	let beskeder = $state<AiBesked3[]>([]);
	let udkast = $state('');
	/** Forslaget der venter paa hendes ja. Der er ikke gemt noget endnu. */
	let ventendeDage = $state<TrainingDay[]>([]);

	const samtaleId = `r${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

	const puljen = $derived(filtrerOevelserTilKategori(bank, kategori?.udstyrTag ?? null));

	function navnPaa(exerciseId: string): string {
		return bank.find((e) => e.id === exerciseId)?.name ?? exerciseId;
	}

	const liste = $derived<Aendring3[]>(
		ventendeDage.length === 0 ? [] : aendringsliste3(alleDage, ventendeDage, navnPaa)
	);
	const aendrede = $derived(aendredeDage3(liste));
	const uroerte = $derived(uroerteTekst3(aendrede, alleDage.length));

	const kanSende = $derived(udkast.trim() !== '' && !venter && maaSendeMere3(beskeder));

	onMount(async () => {
		if (!isAdmin(user)) {
			henter = false;
			return;
		}
		try {
			const [data, kategorier, exercises] = await Promise.all([
				hentProgram3(programId),
				hentKategorier3(),
				hentAlleExercises()
			]);
			bank = exercises;
			if (!data) {
				fejl = 'Programmet findes ikke.';
				return;
			}
			program = data.program;
			alleDage = data.dage;
			kategori = kategorier.find((k) => k.id === data.program.kategoriId) ?? null;
		} catch (e) {
			console.error('[admin] kunne ikke hente programmet', e);
			fejl = 'Kunne ikke hente programmet. Prøv igen om lidt.';
		} finally {
			henter = false;
		}
	});

	/** Lægger et svar i samtalen uden at ringe nogen steder hen. */
	function sigSelv(tekst: string, mit: string) {
		beskeder = [...beskeder, { rolle: 'bruger', tekst: mit }, { rolle: 'ai', tekst }];
		udkast = '';
	}

	async function send() {
		const problem = validerBesked3(udkast);
		if (problem) {
			fejl = problem;
			return;
		}
		const mit = udkast.trim();
		const antalDage = alleDage.length;

		// Foerst finder vi selv ud af hvilke dage hun taler om. Kan det
		// ikke regnes ud, spoerger vi hende, og der bliver ikke ringet
		// nogen steder hen.
		const numre = dageFraSaetning3(mit, antalDage);
		if (numre === null) {
			sigSelv(hvilkeDageSpoergsmaal3(antalDage), mit);
			return;
		}
		if (numre.length === 0) {
			sigSelv(`De dage findes ikke. Programmet er på ${antalDage} dage.`, mit);
			return;
		}
		if (numre.length > MAX_RET_DAGE) {
			sigSelv(
				`Det er ${numre.length} dage, og jeg kan tage ${MAX_RET_DAGE} ad gangen. Tag en uge ad gangen, fx "uge 3".`,
				mit
			);
			return;
		}

		const sendte = alleDage.filter((d) => numre.includes(d.dagNummer));
		const naeste: AiBesked3[] = [...beskeder, { rolle: 'bruger', tekst: mit }];
		beskeder = naeste;
		udkast = '';
		fejl = '';
		venter = true;
		try {
			const token = await user?.getIdToken();
			const res = await fetch('/api/traening-ai', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${token}`
				},
				body: JSON.stringify({
					tilstand: 'ret',
					beskeder: naeste,
					medTekst: false,
					samtaleId,
					kategoriNavn: kategori?.navn ?? '',
					programNavn: program?.navn ?? '',
					programAntalDage: antalDage,
					dage: sendte,
					oevelser: puljen.map((e) => ({
						id: e.id,
						name: e.name,
						catLabel: e.catLabel,
						udstyr: e.udstyr
					}))
				})
			});
			if (!res.ok) {
				const data = (await res.json().catch(() => null)) as { message?: string } | null;
				fejl = data?.message ?? 'AI-tjenesten svarede ikke. Prøv igen.';
				return;
			}
			const svar = (await res.json()) as AiSvar3;
			beskeder = [...naeste, { rolle: 'ai', tekst: svar.svar }];
			ventendeDage = svar.forslag?.dage ?? [];
		} catch (e) {
			console.error('[admin] AI-kaldet fejlede', e);
			fejl = 'Der skete en fejl. Prøv igen om lidt.';
		} finally {
			venter = false;
		}
	}

	async function gem() {
		if (gemmer || ventendeDage.length === 0) return;
		// Kun de dage der faktisk er aendret skrives. En dag AI'en sendte
		// tilbage uaendret skal ikke roeres.
		const skalGemmes = ventendeDage.filter((d) => aendrede.includes(d.dagNummer));
		if (skalGemmes.length === 0) {
			fejl = 'Der er ikke noget at gemme, forslaget er magen til det du har.';
			return;
		}
		gemmer = true;
		fejl = '';
		try {
			await gemUdvalgteDage3(programId, skalGemmes, alleDage);
			const numre = new Map(skalGemmes.map((d) => [d.dagNummer, d]));
			alleDage = alleDage.map((d) => numre.get(d.dagNummer) ?? d);
			ventendeDage = [];
			besked = `Dag ${numreTekst3(skalGemmes.map((d) => d.dagNummer))} er gemt.`;
		} catch (e) {
			console.error('[admin] kunne ikke gemme aendringerne', e);
			fejl = 'Ændringerne kunne ikke gemmes. Prøv igen om lidt.';
		} finally {
			gemmer = false;
		}
	}

	function fortryd() {
		ventendeDage = [];
		besked = '';
	}
</script>

<svelte:head><title>Ret med AI · admin</title></svelte:head>

<div class="ny-pad adm">
	{#if !maaVaereHer}
		<div class="adm-kort">Siden er kun for admin.</div>
	{:else if henter}
		<div class="adm-venter"><Ventetegn variant="lille" /><span>Henter</span></div>
	{:else if !program}
		<p class="adm-fejl">{fejl || 'Programmet findes ikke.'}</p>
	{:else}
		<Sidehoved
			titel="Ret med AI"
			tilbage={`/ny/admin/traening/${programId}`}
			tilbageTekst={program.navn}
			under={`${kategori?.navn ?? ''} · ${alleDage.length} træninger`}
			kant={false}
		/>

		{#if besked}<p class="adm-besked">{besked}</p>{/if}
		{#if fejl}<p class="adm-fejl">{fejl}</p>{/if}

		<p class="adm-hjaelp">
			Skriv hvad der skal laves om, fx "uge 3 er for hård". Jeg henter kun de dage det handler om,
			og du ser præcis hvad der bliver ændret før der gemmes noget.
		</p>

		<div class="ai-samtale">
			{#each beskeder as b, i (i)}
				<div class="ai-boble" class:mig={b.rolle === 'bruger'}>{b.tekst}</div>
			{/each}
			{#if venter}
				<div class="ai-boble"><Ventetegn variant="lille" /></div>
			{/if}
		</div>

		{#if ventendeDage.length > 0}
			<section class="ai-forslag">
				<h2>Bliver ændret</h2>
				{#if aendrede.length === 0}
					<p class="adm-tom">Forslaget er magen til det du har. Der er ikke noget at gemme.</p>
				{:else}
					{#each liste.filter((a) => a.art === 'aendret') as a (a.dagNummer)}
						<div class="ai-dag">
							<span class="ai-dag-nr">Træning {a.dagNummer}</span>
							<span class="ai-dag-o">
								{#each a.linjer as l, i (i)}
									<span class="ai-linje">{l}</span>
								{/each}
							</span>
						</div>
					{/each}
				{/if}

				<p class="ai-uroert">{uroerte}</p>

				<button
					type="button"
					class="ch-knap primaer"
					onclick={gem}
					disabled={gemmer || aendrede.length === 0}
				>
					{gemmer ? 'Gemmer' : 'Gem ændringerne'}
				</button>
				<button type="button" class="ch-knap sekundaer" onclick={fortryd} disabled={gemmer}>
					Fortryd
				</button>
			</section>
		{/if}

		<label class="adm-felt">
			<span>Hvad skal laves om?</span>
			<textarea bind:value={udkast} rows="3" placeholder="Fx: uge 3 er for hård"></textarea>
		</label>

		<button type="button" class="ch-knap primaer" onclick={send} disabled={!kanSende}>
			{venter ? 'Tænker' : 'Send'}
		</button>

		{#if !maaSendeMere3(beskeder)}
			<p class="adm-hjaelp">Samtalen er blevet lang. Gem det du har, eller start en ny.</p>
		{/if}

		<p class="ai-note">◆ Bruger kun øvelser fra din bank</p>
	{/if}
</div>
