<script lang="ts">
	// ============================================================
	// Vaelg hvem der skal have noget, og hvornaar det gaelder.
	//
	// Bruges to steder: naar et program gives ud, og naar adgangen til
	// at bygge sit eget program gives ud. De to er den samme handling,
	// bare med og uden et program, saa de deler den her skaerm.
	//
	// Panelet ligger paa siden og ikke i et ark. Ark skal portalles ud af
	// det omraade der ruller, og det har kostet en aften foer.
	//
	// Klientlisten hentes foerst naar Linn faktisk vaelger Én person.
	// Der er cirka 700 kunder, og de skal ikke hentes for at give et
	// program til et hold.
	// ============================================================

	import { klientSoegeMatch } from '$lib/utils/klientSoegning';
	import { hentKlienter3, type Klient3 } from '$lib/firestore/traeningKunde3';
	import {
		findesAllerede3,
		type HoldValg3,
		type ModtagerType3,
		type NyTildeling3,
		type TildelingsType3,
		type Traeningstildeling3
	} from '$lib/content/traeningTildeling3';

	interface Props {
		type: TildelingsType3;
		programId: string;
		eksisterende: Traeningstildeling3[];
		hold: HoldValg3[];
		adminUid: string;
		gem: (nye: NyTildeling3[]) => Promise<void>;
		luk: () => void;
	}

	let { type, programId, eksisterende, hold, adminUid, gem, luk }: Props = $props();

	let trin = $state<'modtager' | 'periode'>('modtager');
	let valgtType = $state<ModtagerType3>('hold');
	let valgteHold = $state<string[]>([]);
	let valgtKunde = $state<Klient3 | null>(null);
	let gemmer = $state(false);
	let fejl = $state('');

	let klienter = $state<Klient3[]>([]);
	let henterKlienter = $state(false);
	let soegeord = $state('');
	let holdSoeg = $state('');

	// Perioden. Standarden er fra foerste dag og uden slutning, altsaa
	// den Linn bruger mest.
	let fraDag = $state(0);
	let brugTilDag = $state(false);
	let tilDag = $state(21);
	let brugFraDato = $state(false);
	let fraDato = $state('');
	let brugTilDato = $state(false);
	let tilDato = $state('');

	const synligeHold = $derived(
		holdSoeg.trim() ? hold.filter((h) => klientSoegeMatch(h.navn, holdSoeg)) : hold
	);

	const traeffere = $derived.by(() => {
		const ord = soegeord.trim();
		if (ord.length < 2) return [];
		return klienter.filter((k) => klientSoegeMatch(k.soegetekst, ord)).slice(0, 12);
	});

	const kanVidere = $derived(
		valgtType === 'hold'
			? valgteHold.length > 0
			: valgtType === 'kunde'
				? valgtKunde !== null
				: true
	);

	async function vaelgType(ny: ModtagerType3) {
		valgtType = ny;
		fejl = '';
		if (ny !== 'kunde' || klienter.length > 0 || henterKlienter) return;
		henterKlienter = true;
		try {
			klienter = await hentKlienter3();
		} catch (e) {
			console.error('[admin] kunne ikke hente klienter', e);
			fejl = 'Kunne ikke hente kunderne.';
		} finally {
			henterKlienter = false;
		}
	}

	function skiftHold(id: string) {
		valgteHold = valgteHold.includes(id)
			? valgteHold.filter((x) => x !== id)
			: [...valgteHold, id];
	}

	function holdTekst(h: HoldValg3): string {
		const dele: string[] = [];
		if (h.dag === null) dele.push('Ikke startet endnu');
		else dele.push(`Dag ${h.dag}`);
		if (h.antalKunder !== null) dele.push(`${h.antalKunder} kunder`);
		return dele.join(' · ');
	}

	/** Den linje der oversaetter dag-tallet til holdets virkelighed. */
	const dagFoelge = $derived.by(() => {
		if (valgtType !== 'hold' || valgteHold.length !== 1) return '';
		const h = hold.find((x) => x.id === valgteHold[0]);
		if (!h) return '';
		if (h.dag === null) return `${h.navn} er ikke startet endnu.`;
		if (h.dag >= fraDag) return `${h.navn} er på dag ${h.dag}, så de får det med det samme.`;
		return `${h.navn} er på dag ${h.dag} og får det om ${fraDag - h.dag} dage.`;
	});

	function byggRaekker(): NyTildeling3[] {
		const nu = Date.now();
		const basis = {
			type,
			programId,
			fraDag: valgtType === 'hold' ? Math.max(0, fraDag) : 0,
			tilDag: valgtType === 'hold' && brugTilDag ? tilDag : null,
			fraDato: valgtType !== 'hold' && brugFraDato && fraDato ? fraDato : null,
			tilDato: valgtType !== 'hold' && brugTilDato && tilDato ? tilDato : null,
			tildeltAt: nu,
			tildeltAf: adminUid
		};

		if (valgtType === 'hold') {
			return valgteHold
				.map((id) => ({
					...basis,
					modtagerType: 'hold' as const,
					modtagerId: id,
					modtagerNavn: hold.find((h) => h.id === id)?.navn ?? id
				}))
				.filter((r) => !findesAllerede3(eksisterende, r));
		}
		if (valgtType === 'kunde') {
			if (!valgtKunde) return [];
			const raekke = {
				...basis,
				modtagerType: 'kunde' as const,
				modtagerId: valgtKunde.uid,
				modtagerNavn: valgtKunde.navn
			};
			return findesAllerede3(eksisterende, raekke) ? [] : [raekke];
		}
		const raekke = {
			...basis,
			modtagerType: valgtType,
			modtagerId: '',
			modtagerNavn: valgtType === 'medlemmer' ? 'Alle med et abonnement' : 'Alle med appen'
		};
		return findesAllerede3(eksisterende, raekke) ? [] : [raekke];
	}

	async function gemNu() {
		if (gemmer) return;
		const nye = byggRaekker();
		if (nye.length === 0) {
			fejl = 'Det er givet ud i forvejen.';
			return;
		}
		gemmer = true;
		fejl = '';
		try {
			await gem(nye);
		} catch (e) {
			console.error('[admin] kunne ikke tildele', e);
			fejl = 'Kunne ikke gemme.';
		} finally {
			gemmer = false;
		}
	}
</script>

<section class="adm-kort">
	<h2>{trin === 'modtager' ? 'Giv det til' : 'Hvornår'}</h2>

	{#if fejl}<p class="adm-fejl">{fejl}</p>{/if}

	{#if trin === 'modtager'}
		<div class="tr-chips">
			<button
				type="button"
				class="tr-chip"
				class:valgt={valgtType === 'hold'}
				onclick={() => vaelgType('hold')}>Hold</button
			>
			<button
				type="button"
				class="tr-chip"
				class:valgt={valgtType === 'kunde'}
				onclick={() => vaelgType('kunde')}>Én person</button
			>
			<button
				type="button"
				class="tr-chip"
				class:valgt={valgtType === 'medlemmer'}
				onclick={() => vaelgType('medlemmer')}>Medlemmer</button
			>
			<button
				type="button"
				class="tr-chip"
				class:valgt={valgtType === 'alle'}
				onclick={() => vaelgType('alle')}>Alle</button
			>
		</div>

		{#if valgtType === 'hold'}
			{#if hold.length === 0}
				<p class="adm-tom">Der er ingen hold at vælge.</p>
			{:else}
				{#if hold.length > 6}
					<label class="adm-felt">
						<span>Søg i hold</span>
						<input type="text" bind:value={holdSoeg} placeholder="Kickstart" />
					</label>
				{/if}
				{#each synligeHold as h (h.id)}
					<label class="adm-tjek">
						<input
							type="checkbox"
							checked={valgteHold.includes(h.id)}
							onchange={() => skiftHold(h.id)}
						/>
						<span>{h.navn}<span class="tr-tjek-sub">{holdTekst(h)}</span></span>
					</label>
				{/each}
			{/if}
		{:else if valgtType === 'kunde'}
			{#if henterKlienter}
				<p class="adm-tom">Henter kunderne</p>
			{:else}
				<label class="adm-felt">
					<span>Søg</span>
					<input type="text" bind:value={soegeord} placeholder="Navn eller mail" />
				</label>
				{#if valgtKunde}
					<div class="adm-raekke">
						<div class="adm-raekke-t"><span>{valgtKunde.navn}</span></div>
						<div class="adm-raekke-s">{valgtKunde.email}</div>
						<div class="tr-mini-raekke">
							<button type="button" class="tr-mini" onclick={() => (valgtKunde = null)}>
								Vælg en anden
							</button>
						</div>
					</div>
				{:else if soegeord.trim().length < 2}
					<p class="adm-hjaelp">Skriv mindst to bogstaver.</p>
				{:else if traeffere.length === 0}
					<p class="adm-tom">Ingen kunder matcher.</p>
				{:else}
					<div class="adm-liste">
						{#each traeffere as k (k.uid)}
							<button type="button" class="adm-raekke tr-vaelg" onclick={() => (valgtKunde = k)}>
								<div class="adm-raekke-t"><span>{k.navn}</span></div>
								<div class="adm-raekke-s">{k.email}</div>
							</button>
						{/each}
					</div>
				{/if}
			{/if}
		{:else if valgtType === 'medlemmer'}
			<p class="adm-hjaelp">
				Alle med et aktivt app-abonnement. Stopper abonnementet, mister hun det samme dag.
			</p>
		{:else}
			<p class="adm-hjaelp">Alle der kan åbne appen, både dem på et forløb og dem med abonnement.</p>
		{/if}

		<div class="adm-knapper">
			<button
				type="button"
				class="ch-knap primaer"
				onclick={() => (trin = 'periode')}
				disabled={!kanVidere}
			>
				Videre
			</button>
			<button type="button" class="ch-knap sekundaer" onclick={luk}>Fortryd</button>
		</div>
	{:else}
		{#if valgtType === 'hold'}
			<label class="adm-felt">
				<span>Gælder fra dag i forløbet</span>
				<input type="number" bind:value={fraDag} min="0" max="365" />
			</label>
			<p class="adm-hjaelp">Dag 0 er forløbets første dag, som alle andre steder i appen.</p>
			{#if dagFoelge}
				<p class="tr-foelge">{dagFoelge}</p>
			{/if}

			<label class="adm-tjek">
				<input type="checkbox" checked={!brugTilDag} onchange={() => (brugTilDag = !brugTilDag)} />
				<span>Resten af forløbet</span>
			</label>
			{#if brugTilDag}
				<label class="adm-felt">
					<span>Sidste dag</span>
					<input type="number" bind:value={tilDag} min="0" max="365" />
				</label>
			{/if}
		{:else}
			<label class="adm-tjek">
				<input
					type="checkbox"
					checked={!brugFraDato}
					onchange={() => (brugFraDato = !brugFraDato)}
				/>
				<span>Med det samme</span>
			</label>
			{#if brugFraDato}
				<label class="adm-felt">
					<span>Første dag</span>
					<input type="date" bind:value={fraDato} />
				</label>
			{/if}

			<label class="adm-tjek">
				<input
					type="checkbox"
					checked={!brugTilDato}
					onchange={() => (brugTilDato = !brugTilDato)}
				/>
				<span>Ingen slutdato</span>
			</label>
			{#if brugTilDato}
				<label class="adm-felt">
					<span>Sidste dag</span>
					<input type="date" bind:value={tilDato} />
				</label>
			{/if}
		{/if}

		<div class="adm-knapper">
			<button type="button" class="ch-knap primaer" onclick={gemNu} disabled={gemmer}>
				{gemmer ? 'Gemmer' : 'Giv det'}
			</button>
			<button
				type="button"
				class="ch-knap sekundaer"
				onclick={() => (trin = 'modtager')}
				disabled={gemmer}
			>
				Tilbage
			</button>
		</div>
	{/if}
</section>
