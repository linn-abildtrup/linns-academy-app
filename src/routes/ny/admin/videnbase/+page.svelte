<script lang="ts">
	// ============================================================
	// Linn AI's videnbase, i det nye design.
	//
	// Fjortende af de 19 gamle admin-sider, 1. september 2026, og den
	// tungeste af dem: den kan tage imod filer, laese PDF'er, hakke lange
	// tekster op, destillere alle besvarede spoergsmaal, og den rummer
	// AI'ens system-prompt.
	//
	// ALT DET SVAERE ER FLYTTET UAENDRET. parsePdf, chunkTekst,
	// /api/admin/laer-af-svar og de fem firestore-funktioner er de samme.
	// Der er ikke skrevet én linje ny logik: det her er skaerm.
	//
	// DEN HER SIDE BESTEMMER HVAD AI'EN SVARER UD FRA, i BEGGE apper.
	// Siden 1. september faar AI'en ogsaa kundens eget forloeb og Linns
	// tidligere svar med, se 9.61, men videnbasen her er stadig grundlaget
	// under det hele.
	//
	// Den gamle side paa /app/admin/linn-ai er uroert.
	// ============================================================

	import { getContext, onMount } from 'svelte';
	import type { User } from 'firebase/auth';
	import { isAdmin } from '$lib/admin';
	import {
		hentAlleVidenbaseDokumenter,
		gemVidenbaseDokument,
		sletVidenbaseDokument,
		hentLinnAiKonfiguration,
		gemLinnAiKonfiguration
	} from '$lib/firestore/linnAi';
	import type { VidenbaseDokument, VidenbaseKilde } from '$lib/content/linnAi';
	import {
		chunkTekst,
		DEFAULT_SYSTEM_PROMPT,
		dageSidenDestillering as dageSiden,
		destilleringAlderTekst
	} from '$lib/content/linnAi';
	import { auth } from '$lib/firebase';
	import AdmSide from '$lib/components/admin/AdmSide.svelte';
	import AdmKort from '$lib/components/admin/AdmKort.svelte';
	import AdmKnap from '$lib/components/admin/AdmKnap.svelte';
	import AdmMaerkat from '$lib/components/admin/AdmMaerkat.svelte';
	import AdmSoeg from '$lib/components/admin/AdmSoeg.svelte';
	import AdmTom from '$lib/components/admin/AdmTom.svelte';

	const hentUser = getContext<() => User | null>('user');
	const maaVaereHer = $derived(isAdmin(hentUser()));

	const KILDE_NAVN: Record<VidenbaseKilde, string> = {
		pdf: 'PDF',
		slide: 'Præsentation',
		klient_spoergsmaal: 'Destilleret af dine svar',
		manual: 'Skrevet i hånden'
	};

	let dokumenter = $state<VidenbaseDokument[]>([]);
	let henter = $state(true);
	let fejl = $state('');
	let besked = $state('');
	let soeg = $state('');

	let fane = $state<'viden' | 'prompt'>('viden');

	let uploadStatus = $state<'klar' | 'laeser' | 'gemmer' | 'fejl'>('klar');
	let uploadBesked = $state('');
	let traekOver = $state(false);

	let prompt = $state(DEFAULT_SYSTEM_PROMPT);
	let promptGemmer = $state(false);
	let promptBesked = $state('');
	let bekraefterNulstil = $state(false);

	let laerer = $state(false);
	let laerBesked = $state('');
	let bekraefterLaer = $state(false);

	let redigerId = $state('');
	let rNavn = $state('');
	let rTekst = $state('');
	let rKilde = $state<VidenbaseKilde>('manual');
	let rGemmer = $state(false);

	let sletId = $state('');
	let sletter = $state(false);

	onMount(() => void indlaes());

	async function indlaes() {
		henter = true;
		fejl = '';
		try {
			const [docs, konf] = await Promise.all([
				hentAlleVidenbaseDokumenter(),
				hentLinnAiKonfiguration()
			]);
			dokumenter = docs;
			if (konf?.systemPrompt) prompt = konf.systemPrompt;
		} catch (e) {
			console.error('[admin] videnbase', e);
			fejl = 'Kunne ikke hente videnbasen.';
		} finally {
			henter = false;
		}
	}

	function sigTil(t: string) {
		besked = t;
		setTimeout(() => {
			if (besked === t) besked = '';
		}, 3000);
	}

	const listen = $derived(
		dokumenter.filter((d) => {
			const t = soeg.trim().toLowerCase();
			if (!t) return true;
			return `${d.navn} ${d.tekst}`.toLowerCase().includes(t);
		})
	);

	const tegnIAlt = $derived(dokumenter.reduce((s, d) => s + d.tekst.length, 0));
	const alder = $derived(dageSiden(dokumenter));

	function tegn(n: number): string {
		return n < 1000 ? `${n} tegn` : `${(n / 1000).toFixed(1)}k tegn`;
	}

	// ── Filer ────────────────────────────────────────────────
	async function laesFil(fil: File): Promise<string> {
		const navn = fil.name.toLowerCase();
		if (navn.endsWith('.pdf')) return laesPdf(fil);
		if (navn.endsWith('.txt') || navn.endsWith('.md')) return fil.text();
		throw new Error(`${fil.name} er en filtype jeg ikke kan læse. Brug PDF, txt eller md.`);
	}

	async function laesPdf(fil: File): Promise<string> {
		// Hentes foerst NAAR der uploades en PDF. Biblioteket er stort, og
		// det skal ikke ligge og fylde for dem der bare kigger.
		const pdfjs = await import('pdfjs-dist');
		const lib = pdfjs as unknown as {
			GlobalWorkerOptions: { workerSrc: string };
			getDocument: typeof pdfjs.getDocument;
		};
		lib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;
		const pdf = await pdfjs.getDocument({ data: await fil.arrayBuffer() }).promise;
		const dele: string[] = [];
		for (let i = 1; i <= pdf.numPages; i++) {
			const side = await pdf.getPage(i);
			const t = await side.getTextContent();
			dele.push(t.items.map((x) => ('str' in x ? x.str : '')).join(' '));
		}
		return dele.join('\n\n');
	}

	async function tagImod(filer: FileList | File[]) {
		const liste = Array.from(filer);
		if (liste.length === 0) return;
		uploadStatus = 'laeser';
		uploadBesked = '';
		try {
			for (const fil of liste) {
				const navn = fil.name;
				const tekst = await laesFil(fil);
				// En lang tekst hakkes op. AI'en kan kun faa et udsnit med, og
				// et helt dokument paa hundrede sider ville fylde alt.
				const stykker = chunkTekst(tekst);
				const lav = navn.toLowerCase();
				const kilde: VidenbaseKilde = lav.endsWith('.pdf')
					? 'pdf'
					: lav.match(/\.(ppt|pptx)$/)
						? 'slide'
						: 'manual';

				uploadStatus = 'gemmer';
				const rent = navn.replace(/[^a-z0-9]/gi, '_');
				if (stykker.length === 1) {
					await gemVidenbaseDokument(`doc_${Date.now()}_${rent}`, {
						navn,
						kilde,
						tekst: stykker[0]
					});
				} else {
					for (let i = 0; i < stykker.length; i++) {
						await gemVidenbaseDokument(`doc_${Date.now()}_${rent}_del${i + 1}`, {
							navn: `${navn} (del ${i + 1} af ${stykker.length})`,
							kilde,
							tekst: stykker[i]
						});
					}
				}
			}
			dokumenter = await hentAlleVidenbaseDokumenter();
			uploadStatus = 'klar';
			sigTil(`${liste.length} ${liste.length === 1 ? 'fil' : 'filer'} er lagt ind`);
		} catch (e) {
			console.error('[admin] upload', e);
			uploadStatus = 'fejl';
			uploadBesked = e instanceof Error ? e.message : 'Kunne ikke lægge filen ind.';
		}
	}

	function paaFil(e: Event) {
		const i = e.target as HTMLInputElement;
		if (i.files?.length) void tagImod(i.files);
		i.value = '';
	}

	function paaSlip(e: DragEvent) {
		e.preventDefault();
		traekOver = false;
		if (e.dataTransfer?.files) void tagImod(e.dataTransfer.files);
	}

	// ── Laer af svar ─────────────────────────────────────────
	async function laerAfSvar() {
		if (laerer) return;
		bekraefterLaer = false;
		laerer = true;
		laerBesked = '';
		try {
			const token = await auth.currentUser?.getIdToken();
			if (!token) throw new Error('Du er ikke logget ind som admin.');
			const res = await fetch('/api/admin/laer-af-svar', {
				method: 'POST',
				headers: { Authorization: `Bearer ${token}` }
			});
			if (!res.ok) throw new Error(`Kunne ikke lære: ${res.status}`);
			const data = (await res.json()) as { antalDocs: number; antalSvarBrugt: number };
			dokumenter = await hentAlleVidenbaseDokumenter();
			laerBesked = `${data.antalDocs} dokumenter lavet ud af ${data.antalSvarBrugt} svar. Læs dem gerne igennem og ret dem.`;
		} catch (e) {
			console.error('[admin] lær af svar', e);
			laerBesked = e instanceof Error ? e.message : 'Kunne ikke lære af svarene.';
		} finally {
			laerer = false;
		}
	}

	// ── Prompt ───────────────────────────────────────────────
	async function gemPrompt() {
		promptGemmer = true;
		promptBesked = '';
		try {
			await gemLinnAiKonfiguration(prompt);
			promptBesked = 'Gemt';
			setTimeout(() => {
				if (promptBesked === 'Gemt') promptBesked = '';
			}, 2500);
		} catch (e) {
			console.error('[admin] gem prompt', e);
			promptBesked = 'Kunne ikke gemme.';
		} finally {
			promptGemmer = false;
		}
	}

	// ── Ret og slet ──────────────────────────────────────────
	function aabnRediger(d: VidenbaseDokument) {
		redigerId = d.id;
		rNavn = d.navn;
		rTekst = d.tekst;
		rKilde = d.kilde;
	}

	async function gemRediger() {
		if (!redigerId) return;
		rGemmer = true;
		try {
			await gemVidenbaseDokument(redigerId, {
				navn: rNavn.trim() || 'Uden titel',
				kilde: rKilde,
				tekst: rTekst
			});
			dokumenter = await hentAlleVidenbaseDokumenter();
			redigerId = '';
			sigTil('Dokumentet er gemt');
		} catch (e) {
			console.error('[admin] gem dokument', e);
			fejl = 'Kunne ikke gemme dokumentet.';
		} finally {
			rGemmer = false;
		}
	}

	async function slet(id: string) {
		sletter = true;
		try {
			await sletVidenbaseDokument(id);
			dokumenter = await hentAlleVidenbaseDokumenter();
			sletId = '';
			sigTil('Dokumentet er slettet');
		} catch (e) {
			console.error('[admin] slet dokument', e);
			fejl = 'Kunne ikke slette.';
		} finally {
			sletter = false;
		}
	}
</script>

<svelte:head><title>Linn AI's videnbase · Admin</title></svelte:head>

{#if !maaVaereHer}
	<p class="vb-kun">Siden er kun for admin.</p>
{:else}
	<AdmSide
		titel="Det AI'en svarer ud fra"
		under="Dine materialer og den viden der er destilleret af dine egne svar. Gælder både den gamle og den nye app."
		bred
	>
		{#if besked}<div class="vb-besked">{besked}</div>{/if}
		{#if fejl}<div class="vb-fejl">{fejl}</div>{/if}

		<div class="vb-faner">
			<button type="button" class="vb-chip" class:paa={fane === 'viden'} onclick={() => (fane = 'viden')}>
				Viden
			</button>
			<button type="button" class="vb-chip" class:paa={fane === 'prompt'} onclick={() => (fane = 'prompt')}>
				AI'ens stemme
			</button>
		</div>

		{#if henter}
			<AdmTom tekst="Henter videnbasen…" />
		{:else if fane === 'prompt'}
			<AdmKort>
				<p class="vb-hint">
					Det her er den besked AI'en får med hver eneste gang, og den bestemmer hvordan den taler.
					Den gælder begge apper. Lad den stå tom, og der bruges den indbyggede.
				</p>
				<textarea class="vb-prompt" rows="18" bind:value={prompt} disabled={promptGemmer}></textarea>
				<div class="vb-knapper">
					<AdmKnap slags="primaer" disabled={promptGemmer} onclick={gemPrompt}>
						{promptGemmer ? 'Gemmer…' : 'Gem'}
					</AdmKnap>
					{#if bekraefterNulstil}
						<span class="vb-advarsel">Din egen tekst forsvinder.</span>
						<AdmKnap
							slags="fare"
							onclick={() => {
								prompt = DEFAULT_SYSTEM_PROMPT;
								bekraefterNulstil = false;
							}}>Ja, sæt tilbage</AdmKnap
						>
						<AdmKnap onclick={() => (bekraefterNulstil = false)}>Fortryd</AdmKnap>
					{:else}
						<AdmKnap onclick={() => (bekraefterNulstil = true)}>Sæt tilbage til standarden</AdmKnap>
					{/if}
					{#if promptBesked}<span class="vb-kvit">{promptBesked}</span>{/if}
				</div>
			</AdmKort>
		{:else}
			<div class="vb-tal">
				<div class="vb-t-kort">
					<span class="v">{dokumenter.length}</span>
					<span class="m">dokumenter</span>
				</div>
				<div class="vb-t-kort">
					<span class="v">{tegn(tegnIAlt)}</span>
					<span class="m">i alt</span>
				</div>
				<div class="vb-t-kort">
					<span class="v">{alder === null ? '—' : alder}</span>
					<span class="m">{destilleringAlderTekst(alder)}</span>
				</div>
			</div>

			<AdmKort>
				<p class="vb-hint">
					Lær af dine besvarede spørgsmål. AI'en samler dem til viden, og de tidligere destillerede
					dokumenter bliver erstattet. Dine egne uploadede filer bliver ikke rørt.
				</p>
				{#if bekraefterLaer}
					<div class="vb-advarsel-boks">
						De dokumenter der tidligere er lavet ud af dine svar bliver skrevet over. Har du rettet
						i dem i hånden, forsvinder rettelserne. Det tager op mod et halvt minut.
					</div>
					<div class="vb-knapper">
						<AdmKnap slags="fare" disabled={laerer} onclick={laerAfSvar}>
							{laerer ? 'Lærer…' : 'Ja, lær af svarene'}
						</AdmKnap>
						<AdmKnap disabled={laerer} onclick={() => (bekraefterLaer = false)}>Fortryd</AdmKnap>
					</div>
				{:else}
					<div class="vb-knapper">
						<AdmKnap slags="primaer" disabled={laerer} onclick={() => (bekraefterLaer = true)}>
							Lær af mine svar
						</AdmKnap>
					</div>
				{/if}
				{#if laerBesked}<p class="vb-kvit-linje">{laerBesked}</p>{/if}
			</AdmKort>

			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div
				class="vb-slip"
				class:over={traekOver}
				ondragover={(e) => {
					e.preventDefault();
					traekOver = true;
				}}
				ondragleave={() => (traekOver = false)}
				ondrop={paaSlip}
			>
				<p>Træk en fil herind, eller vælg en</p>
				<label class="vb-vaelg">
					<span>Vælg fil</span>
					<input type="file" accept=".pdf,.txt,.md" multiple onchange={paaFil} />
				</label>
				<p class="vb-hint">PDF, txt og md. En lang tekst bliver delt op i flere dokumenter.</p>
				{#if uploadStatus === 'laeser'}<p class="vb-kvit-linje">Læser filen…</p>{/if}
				{#if uploadStatus === 'gemmer'}<p class="vb-kvit-linje">Gemmer…</p>{/if}
				{#if uploadStatus === 'fejl'}<p class="vb-fejl-linje">{uploadBesked}</p>{/if}
			</div>

			<AdmSoeg bind:vaerdi={soeg} placeholder="Søg i videnbasen…" />
			<p class="vb-antal">{listen.length} af {dokumenter.length} dokumenter</p>

			{#if dokumenter.length === 0}
				<AdmTom tekst="Videnbasen er tom. Læg en fil ind, eller lær af dine svar." />
			{:else if listen.length === 0}
				<AdmTom tekst="Ingen dokumenter matcher." />
			{:else}
				{#each listen as d (d.id)}
					<AdmKort>
						{#if redigerId === d.id}
							<label class="vb-felt">
								<span>Titel</span>
								<input type="text" bind:value={rNavn} disabled={rGemmer} />
							</label>
							<label class="vb-felt">
								<span>Tekst</span>
								<textarea rows="12" bind:value={rTekst} disabled={rGemmer}></textarea>
							</label>
							<div class="vb-knapper">
								<AdmKnap slags="primaer" disabled={rGemmer} onclick={gemRediger}>
									{rGemmer ? 'Gemmer…' : 'Gem'}
								</AdmKnap>
								<AdmKnap disabled={rGemmer} onclick={() => (redigerId = '')}>Annuller</AdmKnap>
							</div>
						{:else}
							<div class="vb-hoved">
								<div>
									<span class="vb-navn">{d.navn}</span>
									<div class="vb-meta">{tegn(d.tekst.length)}</div>
								</div>
								<AdmMaerkat farve={d.kilde === 'klient_spoergsmaal' ? 'klar' : 'stille'}>
									{KILDE_NAVN[d.kilde] ?? d.kilde}
								</AdmMaerkat>
							</div>
							<p class="vb-uddrag">{d.tekst.slice(0, 220)}{d.tekst.length > 220 ? '…' : ''}</p>
							<div class="vb-knapper">
								<AdmKnap onclick={() => aabnRediger(d)}>Ret</AdmKnap>
								{#if sletId === d.id}
									<span class="vb-advarsel">Dokumentet forsvinder permanent.</span>
									<AdmKnap slags="fare" disabled={sletter} onclick={() => slet(d.id)}>
										{sletter ? 'Sletter…' : 'Ja, slet'}
									</AdmKnap>
									<AdmKnap onclick={() => (sletId = '')}>Fortryd</AdmKnap>
								{:else}
									<AdmKnap slags="fare" onclick={() => (sletId = d.id)}>Slet</AdmKnap>
								{/if}
							</div>
						{/if}
					</AdmKort>
				{/each}
			{/if}
		{/if}
	</AdmSide>
{/if}

<style>
	.vb-kun {
		padding: 24px 18px;
		color: var(--ink-2);
		font-size: calc(14px * var(--fs-scale, 1));
	}

	.vb-besked,
	.vb-fejl {
		margin-bottom: 12px;
		padding: 11px 15px;
		border-radius: 12px;
		font-size: calc(13.5px * var(--fs-scale, 1));
		font-weight: 600;
	}

	.vb-besked {
		background: var(--sage-tint, #e7efe5);
		color: var(--sage-tekst, #46603f);
	}

	.vb-fejl {
		background: var(--ler-tint, #f4e6de);
		color: var(--ler-tekst, #8a5439);
	}

	.vb-faner {
		display: flex;
		gap: 6px;
		flex-wrap: wrap;
		margin-bottom: 14px;
	}

	/* Baggrunden staar eksplicit, se noten i AdmKnap. */
	.vb-chip {
		padding: 8px 14px;
		background: var(--paper-2, #f6f0e7);
		border: 1px solid var(--line, #e8dfd1);
		border-radius: 99px;
		color: var(--ink-2, #6f5f57);
		font-size: calc(12.5px * var(--fs-scale, 1));
		font-family: inherit;
		font-weight: 600;
		cursor: pointer;
	}

	.vb-chip.paa {
		background: var(--plum, #7c4f63);
		border-color: var(--plum, #7c4f63);
		color: #fff;
	}

	.vb-tal {
		display: flex;
		gap: 10px;
		flex-wrap: wrap;
		margin-bottom: 12px;
	}

	.vb-t-kort {
		flex: 1 1 130px;
		padding: 14px 16px;
		background: var(--paper-2, #f6f0e7);
		border-radius: 14px;
	}

	.vb-t-kort .v {
		display: block;
		font-size: calc(24px * var(--fs-scale, 1));
		line-height: 1.05;
	}

	.vb-t-kort .m {
		display: block;
		margin-top: 4px;
		font-size: calc(11.5px * var(--fs-scale, 1));
		color: var(--ink-3, #a3948a);
	}

	.vb-hint {
		margin: 0 0 11px;
		font-size: calc(12.5px * var(--fs-scale, 1));
		color: var(--ink-2, #6f5f57);
		line-height: 1.5;
	}

	.vb-advarsel-boks {
		margin-bottom: 11px;
		padding: 11px 14px;
		background: var(--ler-tint, #f4e6de);
		border-radius: 11px;
		color: var(--ler-tekst, #8a5439);
		font-size: calc(12.5px * var(--fs-scale, 1));
		line-height: 1.5;
	}

	.vb-advarsel {
		font-size: calc(11.5px * var(--fs-scale, 1));
		color: var(--ler-tekst, #8a5439);
		font-weight: 600;
	}

	.vb-knapper {
		display: flex;
		align-items: center;
		gap: 8px;
		flex-wrap: wrap;
	}

	.vb-kvit,
	.vb-kvit-linje {
		font-size: calc(12px * var(--fs-scale, 1));
		color: var(--sage-tekst, #46603f);
		font-weight: 600;
	}

	.vb-kvit-linje {
		margin: 10px 0 0;
		line-height: 1.45;
	}

	.vb-fejl-linje {
		margin: 10px 0 0;
		font-size: calc(12px * var(--fs-scale, 1));
		color: var(--ler-tekst, #8a5439);
		font-weight: 600;
	}

	.vb-slip {
		padding: 20px;
		margin-bottom: 12px;
		background: var(--paper-2, #f6f0e7);
		border: 1px dashed var(--line, #e8dfd1);
		border-radius: 14px;
		text-align: center;
	}

	.vb-slip.over {
		border-color: var(--plum, #7c4f63);
		background: var(--plum-tint, #f1e5e8);
	}

	.vb-slip p {
		margin: 0 0 10px;
		font-size: calc(13.5px * var(--fs-scale, 1));
		color: var(--ink-2, #6f5f57);
	}

	.vb-vaelg {
		display: inline-block;
		padding: 10px 18px;
		background: var(--plum, #7c4f63);
		border-radius: 99px;
		color: #fff;
		font-size: calc(13.5px * var(--fs-scale, 1));
		font-weight: 600;
		cursor: pointer;
	}

	.vb-vaelg input {
		display: none;
	}

	.vb-prompt,
	.vb-felt textarea,
	.vb-felt input {
		display: block;
		width: 100%;
		padding: 12px 14px;
		background: var(--paper, #fbf8f2);
		border: 1px solid var(--line, #e8dfd1);
		border-radius: 12px;
		color: var(--espresso, #382c2a);
		font-size: calc(13.5px * var(--fs-scale, 1));
		font-family: inherit;
		line-height: 1.55;
		box-sizing: border-box;
		resize: vertical;
		margin-bottom: 11px;
	}

	.vb-felt {
		display: block;
		margin-bottom: 4px;
	}

	.vb-felt span {
		display: block;
		margin-bottom: 4px;
		font-size: calc(10.5px * var(--fs-scale, 1));
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--ink-3, #a3948a);
	}

	.vb-antal {
		margin: 10px 0;
		font-size: calc(12px * var(--fs-scale, 1));
		color: var(--ink-3, #a3948a);
	}

	.vb-hoved {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 10px;
		margin-bottom: 7px;
	}

	.vb-navn {
		font-size: calc(14.5px * var(--fs-scale, 1));
		font-weight: 600;
	}

	.vb-meta {
		margin-top: 2px;
		font-size: calc(11.5px * var(--fs-scale, 1));
		color: var(--ink-3, #a3948a);
	}

	.vb-uddrag {
		margin: 0 0 11px;
		font-size: calc(12.5px * var(--fs-scale, 1));
		color: var(--ink-2, #6f5f57);
		line-height: 1.5;
	}
</style>
