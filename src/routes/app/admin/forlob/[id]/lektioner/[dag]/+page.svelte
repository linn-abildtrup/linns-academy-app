<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import type { ForlobDag, LektionItem } from '$lib/content/forlob';
	import type { Forlob } from '$lib/content/forlobAdgang';
	import { nyLektion, tomForlobDag } from '$lib/content/forlob';
	import {
		findDageMedLektionGruppe,
		findDageMedNoteGruppe,
		gemForlobsdag,
		gemLektionPaaDage,
		gemNotePaaDage,
		hentForlob,
		hentForlobsdag,
		opdaterLektionGruppe,
		opdaterNoteGruppe,
		sletForlobsdag,
		sletLektionGruppe,
		sletNoteGruppe
	} from '$lib/firestore/forlob';
	import { uploadHtmlFil, uploadLydFil, uploadThumbnailFil } from '$lib/utils/storage';
	import Icon from '$lib/components/Icon.svelte';
	import VaelgDageDialog from '$lib/components/VaelgDageDialog.svelte';
	import RedigerGruppeDialog from '$lib/components/RedigerGruppeDialog.svelte';

	const forlobId = $derived(page.params.id ?? '');
	const dagNummer = $derived(parseInt(page.params.dag ?? '0', 10));

	let dag = $state<ForlobDag>(tomForlobDag(0));
	let forlob = $state<Forlob | null>(null);
	let loading = $state(true);
	let fejl = $state<string | null>(null);
	let gemmer = $state(false);
	let gemKvit = $state(false);
	let bekraefter = $state(false);
	let uploaderHtml = $state<string | null>(null);
	let uploaderLyd = $state<string | null>(null);
	let uploaderThumb = $state<string | null>(null);
	let dragOver = $state<string | null>(null);
	let uploadFejl = $state<string | null>(null);

	// 'Vis ogsaa paa dage'-dialog. maal er enten 'lektion:<id>' eller 'note'.
	let dialogMaal = $state<string | null>(null);
	let dialogStartDage = $state<number[]>([]);

	// 'Ret alle eller kun denne'-bekraeft-dialog
	let gruppeBekraeft = $state<{
		titel: string;
		beskrivelse: string;
		antalDage: number;
		alleLabel: string;
		denneLabel: string;
		erFarlig: boolean;
		paaAlle: () => void | Promise<void>;
		paaDenne: () => void | Promise<void>;
	} | null>(null);

	// Cache over hvilke dage hver gruppe ligger paa — bygges naar siden loader
	// og opdateres efter gem.
	let lektionGruppeDage = $state<Map<string, number[]>>(new Map());
	let noteGruppeDage = $state<Map<string, number[]>>(new Map());

	async function refreshGruppeDage() {
		const lkRes = new Map<string, number[]>();
		for (const l of dag.lektioner) {
			if (l.grupperingId && !lkRes.has(l.grupperingId)) {
				lkRes.set(l.grupperingId, await findDageMedLektionGruppe(forlobId, l.grupperingId));
			}
		}
		lektionGruppeDage = lkRes;

		const nRes = new Map<string, number[]>();
		if (dag.noteGrupperingId) {
			nRes.set(
				dag.noteGrupperingId,
				await findDageMedNoteGruppe(forlobId, dag.noteGrupperingId)
			);
		}
		noteGruppeDage = nRes;
	}

	$effect(() => {
		// Re-init når dagNummer ændrer sig (deep-link / navigation)
		dag = tomForlobDag(dagNummer);
	});

	onMount(async () => {
		await indlaes();
	});

	async function indlaes() {
		loading = true;
		fejl = null;
		try {
			const [fundet, f] = await Promise.all([
				hentForlobsdag(forlobId, dagNummer),
				forlob ? Promise.resolve(forlob) : hentForlob(forlobId)
			]);
			dag = fundet ?? tomForlobDag(dagNummer);
			forlob = f;
			await refreshGruppeDage();
		} catch (e) {
			console.error(e);
			fejl = 'Kunne ikke hente dagen.';
		} finally {
			loading = false;
		}
	}

	function tilfoejLektion() {
		dag = { ...dag, lektioner: [...dag.lektioner, nyLektion()] };
	}

	function fjernLektion(id: string) {
		const l = dag.lektioner.find((x) => x.id === id);
		if (!l) return;
		const dageMedGruppe = l.grupperingId ? lektionGruppeDage.get(l.grupperingId) ?? [] : [];
		if (l.grupperingId && dageMedGruppe.length > 1) {
			const gid = l.grupperingId;
			gruppeBekraeft = {
				titel: 'Slet lektion',
				beskrivelse:
					'Denne lektion ligger ogsaa paa andre dage. Vil du fjerne den fra alle dage eller kun fra denne ene?',
				antalDage: dageMedGruppe.length,
				alleLabel: 'Slet fra alle dage',
				denneLabel: 'Kun denne dag',
				erFarlig: true,
				paaAlle: async () => {
					gruppeBekraeft = null;
					gemmer = true;
					try {
						await sletLektionGruppe(forlobId, gid);
						dag = { ...dag, lektioner: dag.lektioner.filter((x) => x.id !== id) };
						await refreshGruppeDage();
					} catch (e) {
						console.error(e);
						fejl = 'Kunne ikke slette gruppe.';
					} finally {
						gemmer = false;
					}
				},
				paaDenne: () => {
					gruppeBekraeft = null;
					dag = { ...dag, lektioner: dag.lektioner.filter((x) => x.id !== id) };
				}
			};
			return;
		}
		dag = { ...dag, lektioner: dag.lektioner.filter((x) => x.id !== id) };
	}

	function opdaterLektion<K extends keyof LektionItem>(
		id: string,
		felt: K,
		vaerdi: LektionItem[K]
	) {
		dag = {
			...dag,
			lektioner: dag.lektioner.map((l) => (l.id === id ? { ...l, [felt]: vaerdi } : l))
		};
	}

	async function haandterHtmlUpload(lektionId: string, e: Event) {
		const input = e.target as HTMLInputElement;
		const fil = input.files?.[0];
		if (!fil) return;
		if (!/\.(html|htm)$/i.test(fil.name)) {
			uploadFejl = 'Vælg en .html- eller .htm-fil.';
			input.value = '';
			return;
		}
		uploaderHtml = lektionId;
		uploadFejl = null;
		try {
			const url = await uploadHtmlFil(forlobId, fil);
			opdaterLektion(lektionId, 'url', url);
		} catch (err) {
			console.error(err);
			uploadFejl = 'Upload fejlede. Prøv igen.';
		} finally {
			uploaderHtml = null;
			input.value = '';
		}
	}

	async function haandterLydUpload(lektionId: string, e: Event) {
		const input = e.target as HTMLInputElement;
		const fil = input.files?.[0];
		if (!fil) return;
		if (!/\.(mp3|m4a|wav|aac|ogg)$/i.test(fil.name)) {
			uploadFejl = 'Vælg en lydfil (.mp3, .m4a, .wav, .aac eller .ogg).';
			input.value = '';
			return;
		}
		uploaderLyd = lektionId;
		uploadFejl = null;
		try {
			const url = await uploadLydFil(fil);
			opdaterLektion(lektionId, 'url', url);
			// Opdater format-feltet automatisk hvis det er tomt
			const lektion = dag.lektioner.find((l) => l.id === lektionId);
			if (lektion && !lektion.format.trim()) {
				opdaterLektion(lektionId, 'format', 'Lyd');
			}
		} catch (err) {
			console.error(err);
			uploadFejl =
				err instanceof Error ? `Upload fejlede: ${err.message}` : 'Upload fejlede.';
		} finally {
			uploaderLyd = null;
			input.value = '';
		}
	}

	async function haandterThumbnailFil(lektionId: string, fil: File | undefined | null) {
		if (!fil) return;
		if (!fil.type.startsWith('image/')) {
			uploadFejl = 'Vaelg en billedfil (JPG, PNG, WebP).';
			return;
		}
		uploaderThumb = lektionId;
		uploadFejl = null;
		try {
			const url = await uploadThumbnailFil(forlobId, fil);
			opdaterLektion(lektionId, 'thumbnailUrl', url);
		} catch (err) {
			console.error(err);
			uploadFejl =
				err instanceof Error ? `Upload fejlede: ${err.message}` : 'Upload fejlede.';
		} finally {
			uploaderThumb = null;
		}
	}

	function haandterThumbnailInput(lektionId: string, e: Event) {
		const input = e.target as HTMLInputElement;
		const fil = input.files?.[0];
		haandterThumbnailFil(lektionId, fil);
		input.value = '';
	}

	function haandterDrop(lektionId: string, e: DragEvent) {
		e.preventDefault();
		dragOver = null;
		const fil = e.dataTransfer?.files?.[0];
		haandterThumbnailFil(lektionId, fil);
	}

	function haandterDragOver(lektionId: string, e: DragEvent) {
		e.preventDefault();
		dragOver = lektionId;
	}

	function haandterDragLeave() {
		dragOver = null;
	}

	async function haandterPaste(lektionId: string, e: ClipboardEvent) {
		const items = e.clipboardData?.items;
		if (!items) return;
		for (const item of items) {
			if (item.type.startsWith('image/')) {
				e.preventDefault();
				const fil = item.getAsFile();
				if (fil) {
					await haandterThumbnailFil(lektionId, fil);
				}
				return;
			}
		}
	}

	function fjernThumbnail(lektionId: string) {
		opdaterLektion(lektionId, 'thumbnailUrl', undefined);
	}

	// Sammenligner lektion-felter (ekskl id + grupperingId) saa vi kan
	// detektere om en grupperet lektion er aendret og skal trigge dialog.
	function lektionFelterEr(a: LektionItem, b: LektionItem): boolean {
		return (
			a.titel === b.titel &&
			a.beskrivelse === b.beskrivelse &&
			a.varighedMin === b.varighedMin &&
			a.format === b.format &&
			a.url === b.url &&
			(a.thumbnailUrl ?? '') === (b.thumbnailUrl ?? '')
		);
	}

	async function gem() {
		gemmer = true;
		fejl = null;
		gemKvit = false;
		try {
			const original = (await hentForlobsdag(forlobId, dagNummer)) ?? tomForlobDag(dagNummer);
			const trimmet: LektionItem[] = dag.lektioner.map((l) => ({
				...l,
				titel: l.titel.trim(),
				beskrivelse: l.beskrivelse.trim(),
				format: l.format.trim(),
				url: l.url.trim()
			}));

			// Find grupperede lektioner der er aendret ift original
			const aendredeGrupperede: LektionItem[] = [];
			for (const ny of trimmet) {
				if (!ny.grupperingId) continue;
				const dageMed = lektionGruppeDage.get(ny.grupperingId) ?? [];
				if (dageMed.length <= 1) continue;
				const original_l = original.lektioner.find((o) => o.id === ny.id);
				if (!original_l) continue;
				if (!lektionFelterEr(ny, original_l)) {
					aendredeGrupperede.push(ny);
				}
			}

			const noteAendretGrupperet =
				dag.noteGrupperingId &&
				(noteGruppeDage.get(dag.noteGrupperingId)?.length ?? 0) > 1 &&
				dag.noteFraLinn.trim() !== (original.noteFraLinn ?? '').trim();

			if (aendredeGrupperede.length > 0 || noteAendretGrupperet) {
				// Naar der er grupperede aendringer: vis dialog. Spoerg én gang
				// samlet (typisk er det én lektion eller noten der er aendret).
				const samletAntalDage = Math.max(
					...aendredeGrupperede.map(
						(l) => lektionGruppeDage.get(l.grupperingId ?? '')?.length ?? 0
					),
					noteAendretGrupperet ? noteGruppeDage.get(dag.noteGrupperingId ?? '')?.length ?? 0 : 0
				);
				gruppeBekraeft = {
					titel: 'Aendringer paa flere dage',
					beskrivelse:
						'Du har aendret indhold der ogsaa ligger paa andre dage. Vil du opdatere alle dage eller kun denne ene?',
					antalDage: samletAntalDage,
					alleLabel: 'Ret alle dage',
					denneLabel: 'Kun denne dag',
					erFarlig: false,
					paaAlle: async () => {
						gruppeBekraeft = null;
						await gemMedPropagering(trimmet, aendredeGrupperede, !!noteAendretGrupperet);
					},
					paaDenne: async () => {
						gruppeBekraeft = null;
						await gemSomStandalone(trimmet, aendredeGrupperede, !!noteAendretGrupperet);
					}
				};
				gemmer = false;
				return;
			}

			// Ingen grupperede aendringer — gem normalt
			await gemForlobsdag(forlobId, {
				dagNummer: dag.dagNummer,
				uge: dag.uge,
				lektioner: trimmet,
				noteFraLinn: dag.noteFraLinn.trim(),
				noteGrupperingId: dag.noteGrupperingId
			});
			dag = { ...dag, lektioner: trimmet };
			gemKvit = true;
			setTimeout(() => (gemKvit = false), 2000);
			await refreshGruppeDage();
		} catch (e) {
			console.error(e);
			fejl = 'Kunne ikke gemme.';
		} finally {
			gemmer = false;
		}
	}

	async function gemMedPropagering(
		trimmet: LektionItem[],
		grupperede: LektionItem[],
		noteAendret: boolean
	) {
		gemmer = true;
		try {
			// Foerst gem den aktuelle dag (med trimmede felter)
			await gemForlobsdag(forlobId, {
				dagNummer: dag.dagNummer,
				uge: dag.uge,
				lektioner: trimmet,
				noteFraLinn: dag.noteFraLinn.trim(),
				noteGrupperingId: dag.noteGrupperingId
			});
			// Propagér aendrede grupperede lektioner til alle andre dage
			for (const l of grupperede) {
				if (!l.grupperingId) continue;
				await opdaterLektionGruppe(forlobId, l.grupperingId, {
					titel: l.titel,
					beskrivelse: l.beskrivelse,
					varighedMin: l.varighedMin,
					format: l.format,
					url: l.url,
					thumbnailUrl: l.thumbnailUrl
				});
			}
			if (noteAendret && dag.noteGrupperingId) {
				await opdaterNoteGruppe(forlobId, dag.noteGrupperingId, dag.noteFraLinn.trim());
			}
			dag = { ...dag, lektioner: trimmet };
			gemKvit = true;
			setTimeout(() => (gemKvit = false), 2000);
			await refreshGruppeDage();
		} catch (e) {
			console.error(e);
			fejl = 'Kunne ikke gemme.';
		} finally {
			gemmer = false;
		}
	}

	async function gemSomStandalone(
		trimmet: LektionItem[],
		grupperede: LektionItem[],
		noteAendret: boolean
	) {
		gemmer = true;
		try {
			// 'Kun denne': fjern grupperingId fra de aendrede lektioner saa
			// de andre dage forbliver intakte med den oprindelige version.
			const grupIds = new Set(grupperede.map((l) => l.id));
			const opdateret = trimmet.map((l) =>
				grupIds.has(l.id) ? { ...l, grupperingId: undefined } : l
			);
			const noteOpdateret = noteAendret;
			await gemForlobsdag(forlobId, {
				dagNummer: dag.dagNummer,
				uge: dag.uge,
				lektioner: opdateret,
				noteFraLinn: dag.noteFraLinn.trim(),
				noteGrupperingId: noteOpdateret ? undefined : dag.noteGrupperingId
			});
			dag = {
				...dag,
				lektioner: opdateret,
				noteGrupperingId: noteOpdateret ? undefined : dag.noteGrupperingId
			};
			gemKvit = true;
			setTimeout(() => (gemKvit = false), 2000);
			await refreshGruppeDage();
		} catch (e) {
			console.error(e);
			fejl = 'Kunne ikke gemme.';
		} finally {
			gemmer = false;
		}
	}

	function aabnVaelgDageDialog(maal: string) {
		dialogMaal = maal;
		if (maal === 'note') {
			const ds = dag.noteGrupperingId
				? noteGruppeDage.get(dag.noteGrupperingId) ?? [dagNummer]
				: [dagNummer];
			dialogStartDage = ds.length > 0 ? ds : [dagNummer];
		} else if (maal.startsWith('lektion:')) {
			const id = maal.slice('lektion:'.length);
			const l = dag.lektioner.find((x) => x.id === id);
			if (l?.grupperingId) {
				dialogStartDage = lektionGruppeDage.get(l.grupperingId) ?? [dagNummer];
			} else {
				dialogStartDage = [dagNummer];
			}
		}
	}

	async function haandterVaelgDage(valgteDage: number[]) {
		if (!dialogMaal) return;
		const valgte = valgteDage.includes(dagNummer)
			? valgteDage
			: [...valgteDage, dagNummer].sort((a, b) => a - b);

		gemmer = true;
		fejl = null;
		try {
			if (dialogMaal === 'note') {
				const tekst = dag.noteFraLinn.trim();
				if (!tekst) {
					fejl = 'Skriv noten foerst, foer du vaelger flere dage.';
					gemmer = false;
					dialogMaal = null;
					return;
				}
				const { noteGrupperingId } = await gemNotePaaDage(
					forlobId,
					tekst,
					valgte,
					dag.noteGrupperingId
				);
				dag = { ...dag, noteGrupperingId };
			} else if (dialogMaal.startsWith('lektion:')) {
				const id = dialogMaal.slice('lektion:'.length);
				const l = dag.lektioner.find((x) => x.id === id);
				if (!l) {
					gemmer = false;
					dialogMaal = null;
					return;
				}
				const { grupperingId } = await gemLektionPaaDage(
					forlobId,
					{
						titel: l.titel.trim(),
						beskrivelse: l.beskrivelse.trim(),
						varighedMin: l.varighedMin,
						format: l.format.trim(),
						url: l.url.trim(),
						thumbnailUrl: l.thumbnailUrl,
						grupperingId: l.grupperingId
					},
					valgte,
					l.grupperingId
				);
				// Fjern gruppen fra dage der ikke laengere er valgt
				if (l.grupperingId) {
					const tidligereDage = lektionGruppeDage.get(l.grupperingId) ?? [];
					const fjernet = tidligereDage.filter((d) => !valgte.includes(d));
					for (const d of fjernet) {
						const andenDag = await hentForlobsdag(forlobId, d);
						if (!andenDag) continue;
						await gemForlobsdag(forlobId, {
							...andenDag,
							lektioner: andenDag.lektioner.filter((x) => x.grupperingId !== l.grupperingId)
						});
					}
				}
				dag = {
					...dag,
					lektioner: dag.lektioner.map((x) => (x.id === id ? { ...x, grupperingId } : x))
				};
			}
			await refreshGruppeDage();
		} catch (e) {
			console.error(e);
			fejl = 'Kunne ikke opdatere flere dage.';
		} finally {
			gemmer = false;
			dialogMaal = null;
		}
	}

	function fjernNoteFraGruppe() {
		if (!dag.noteGrupperingId) return;
		const dageMed = noteGruppeDage.get(dag.noteGrupperingId) ?? [];
		if (dageMed.length <= 1) {
			dag = { ...dag, noteGrupperingId: undefined };
			return;
		}
		const gid = dag.noteGrupperingId;
		gruppeBekraeft = {
			titel: 'Slet note',
			beskrivelse:
				'Denne note ligger ogsaa paa andre dage. Vil du slette den fra alle dage eller kun fra denne ene?',
			antalDage: dageMed.length,
			alleLabel: 'Slet fra alle dage',
			denneLabel: 'Kun denne dag',
			erFarlig: true,
			paaAlle: async () => {
				gruppeBekraeft = null;
				gemmer = true;
				try {
					await sletNoteGruppe(forlobId, gid);
					dag = { ...dag, noteFraLinn: '', noteGrupperingId: undefined };
					await refreshGruppeDage();
				} catch (e) {
					console.error(e);
					fejl = 'Kunne ikke slette note-gruppe.';
				} finally {
					gemmer = false;
				}
			},
			paaDenne: () => {
				gruppeBekraeft = null;
				dag = { ...dag, noteFraLinn: '', noteGrupperingId: undefined };
			}
		};
	}

	async function sletDag() {
		if (!bekraefter) {
			bekraefter = true;
			return;
		}
		gemmer = true;
		try {
			await sletForlobsdag(forlobId, dagNummer);
			goto(`/app/admin/forlob/${forlobId}/lektioner`);
		} catch (e) {
			console.error(e);
			fejl = 'Kunne ikke slette.';
			gemmer = false;
		}
	}
</script>

<div class="page">
	<header class="page-header">
		<a class="back" href="/app/admin/forlob/{forlobId}/lektioner">
			<Icon name="arrow-l" size={14} color="var(--text2)" />
			<span>Lektioner</span>
		</a>
		<div class="eyebrow">Admin · Lektioner</div>
		<h1>{dagNummer === 0 ? 'Baseline (dag 0)' : `Dag ${dagNummer}`}</h1>
		{#if dagNummer > 0}
			<p class="page-sub">Uge {dag.uge}</p>
		{/if}
	</header>

	{#if loading}
		<div class="status-besked">Henter...</div>
	{:else if fejl}
		<div class="status-besked fejl">{fejl}</div>
	{:else}
		<div class="form-card">
			<div class="form-head">
				<div class="form-titel">Note fra Linn (valgfri)</div>
				{#if dag.noteGrupperingId && (noteGruppeDage.get(dag.noteGrupperingId) ?? []).length > 1}
					<span
						class="gruppe-chip"
						title={`Noten ligger paa dage: ${(noteGruppeDage.get(dag.noteGrupperingId) ?? []).join(', ')}`}
					>
						🔗 ligger paa {noteGruppeDage.get(dag.noteGrupperingId)?.length} dage
					</span>
				{/if}
			</div>
			<textarea
				bind:value={dag.noteFraLinn}
				placeholder="Personlig note til klienterne for denne dag..."
				rows="4"
				disabled={gemmer}
			></textarea>
			<div class="vis-paa-rad">
				<button
					class="vis-paa-knap"
					type="button"
					onclick={() => aabnVaelgDageDialog('note')}
					disabled={gemmer || !dag.noteFraLinn.trim()}
					title={!dag.noteFraLinn.trim() ? 'Skriv noten foerst' : ''}
				>
					Vis ogsaa paa dage...
				</button>
				{#if dag.noteGrupperingId}
					<button
						class="vis-paa-knap ghost"
						type="button"
						onclick={fjernNoteFraGruppe}
						disabled={gemmer}
					>
						Fjern note
					</button>
				{/if}
			</div>
		</div>

		<div class="form-card">
			<div class="form-head">
				<div class="form-titel">Lektioner</div>
				<div class="form-tael">
					{dag.lektioner.length} lektion{dag.lektioner.length === 1 ? '' : 'er'}
				</div>
			</div>

			{#if dag.lektioner.length === 0}
				<p class="muted">Ingen lektioner endnu. Tilføj den første nedenfor.</p>
			{/if}

			{#each dag.lektioner as l (l.id)}
				{@const dageMed = l.grupperingId ? lektionGruppeDage.get(l.grupperingId) ?? [] : []}
				{@const erGrupperet = dageMed.length > 1}
				<article class="lektion-edit" class:grupperet={erGrupperet}>
					<header class="lektion-edit-head">
						<div class="lektion-edit-num">
							Lektion
							{#if erGrupperet}
								<span class="gruppe-chip" title={`Ligger paa dage: ${dageMed.join(', ')}`}>
									🔗 {dageMed.length} dage
								</span>
							{/if}
						</div>
						<button
							class="ikon-knap fare"
							type="button"
							onclick={() => fjernLektion(l.id)}
							disabled={gemmer}
							aria-label="Fjern"
							title="Fjern lektion"
						>
							×
						</button>
					</header>

					<label class="felt">
						<span class="felt-label">Titel</span>
						<input
							type="text"
							value={l.titel}
							oninput={(e) => opdaterLektion(l.id, 'titel', e.currentTarget.value)}
							maxlength="140"
							disabled={gemmer}
						/>
					</label>

					<label class="felt">
						<span class="felt-label">Beskrivelse</span>
						<textarea
							value={l.beskrivelse}
							oninput={(e) => opdaterLektion(l.id, 'beskrivelse', e.currentTarget.value)}
							rows="3"
							maxlength="500"
							disabled={gemmer}
						></textarea>
					</label>

					<div class="felt-rad">
						<label class="felt">
							<span class="felt-label">Varighed (min)</span>
							<input
								type="number"
								min="0"
								max="600"
								value={l.varighedMin}
								oninput={(e) =>
									opdaterLektion(l.id, 'varighedMin', parseInt(e.currentTarget.value, 10) || 0)}
								disabled={gemmer}
							/>
						</label>
						<label class="felt">
							<span class="felt-label">Format</span>
							<input
								type="text"
								value={l.format}
								oninput={(e) => opdaterLektion(l.id, 'format', e.currentTarget.value)}
								placeholder="Video, lyd, tekst..."
								maxlength="40"
								disabled={gemmer}
							/>
						</label>
					</div>

					<label class="felt">
						<span class="felt-label">URL (valgfri)</span>
						<input
							type="url"
							value={l.url}
							oninput={(e) => opdaterLektion(l.id, 'url', e.currentTarget.value)}
							placeholder="https://..."
							disabled={gemmer}
						/>
						<div class="html-upload-rad">
							<label class="html-upload-knap" class:disabled={gemmer || uploaderHtml === l.id || uploaderLyd === l.id}>
								{uploaderHtml === l.id ? 'Uploader...' : '📎 HTML-fil'}
								<input
									type="file"
									accept=".html,.htm,text/html"
									onchange={(e) => haandterHtmlUpload(l.id, e)}
									disabled={gemmer || uploaderHtml === l.id || uploaderLyd === l.id}
								/>
							</label>
							<label class="html-upload-knap" class:disabled={gemmer || uploaderHtml === l.id || uploaderLyd === l.id}>
								{uploaderLyd === l.id ? 'Uploader...' : '🎵 Lydfil'}
								<input
									type="file"
									accept=".mp3,.m4a,.wav,.aac,.ogg,audio/*"
									onchange={(e) => haandterLydUpload(l.id, e)}
									disabled={gemmer || uploaderHtml === l.id || uploaderLyd === l.id}
								/>
							</label>
							<span class="html-upload-hint">eller indsæt URL ovenfor</span>
						</div>
					</label>

					<div class="felt">
						<span class="felt-label">Thumbnail (valgfri)</span>
						<div
							class="thumb-dropzone"
							class:har-thumb={!!l.thumbnailUrl}
							class:drag-over={dragOver === l.id}
							class:uploader={uploaderThumb === l.id}
							ondrop={(e) => haandterDrop(l.id, e)}
							ondragover={(e) => haandterDragOver(l.id, e)}
							ondragleave={haandterDragLeave}
							onpaste={(e) => haandterPaste(l.id, e)}
							role="region"
							aria-label="Slip eller indsæt et billede her"
						>
							{#if l.thumbnailUrl}
								<img src={l.thumbnailUrl} alt="Thumbnail" class="thumb-preview" />
								<div class="thumb-overlay">
									<label class="thumb-knap">
										Skift
										<input
											type="file"
											accept="image/*"
											onchange={(e) => haandterThumbnailInput(l.id, e)}
											disabled={gemmer || uploaderThumb === l.id}
										/>
									</label>
									<button
										class="thumb-knap fare"
										type="button"
										onclick={() => fjernThumbnail(l.id)}
										disabled={gemmer || uploaderThumb === l.id}
									>
										Fjern
									</button>
								</div>
							{:else if uploaderThumb === l.id}
								<div class="thumb-tom">Uploader...</div>
							{:else}
								<label class="thumb-tom">
									<div class="thumb-tom-titel">Slip billede her</div>
									<div class="thumb-tom-hint">
										eller klik for at vælge · træk fra Finder · indsæt med ⌘V
									</div>
									<input
										type="file"
										accept="image/*"
										onchange={(e) => haandterThumbnailInput(l.id, e)}
										disabled={gemmer}
									/>
								</label>
							{/if}
						</div>
						<div class="thumb-hint">
							Vises i stedet for video-tjenestens auto-thumbnail. Maks 3 MB.
						</div>
					</div>

					<div class="vis-paa-rad">
						<button
							class="vis-paa-knap"
							type="button"
							onclick={() => aabnVaelgDageDialog(`lektion:${l.id}`)}
							disabled={gemmer || !l.titel.trim()}
							title={!l.titel.trim() ? 'Skriv titel foerst' : ''}
						>
							Vis ogsaa paa dage...
						</button>
					</div>
				</article>
			{/each}

			<button
				class="form-knap ghost"
				type="button"
				onclick={tilfoejLektion}
				style="border-style: dashed;"
				disabled={gemmer}
			>
				+ Tilføj lektion
			</button>

			{#if uploadFejl}
				<div class="status-besked fejl">{uploadFejl}</div>
			{/if}
		</div>

		<div class="actions">
			{#if gemKvit}
				<div class="kvit-besked">Gemt ✓</div>
			{/if}
			<button class="form-knap primary full" type="button" onclick={gem} disabled={gemmer}>
				{gemmer ? 'Gemmer...' : 'Gem'}
			</button>

			<div class="slet-omraade">
				{#if !bekraefter}
					<button class="slet-knap" type="button" onclick={sletDag} disabled={gemmer}>
						Slet alt indhold for denne dag
					</button>
				{:else}
					<div class="slet-bekraeft">
						<div class="slet-tekst">
							Slet alle lektioner og note for dag {dagNummer}?
						</div>
						<div class="slet-knapper">
							<button
								class="form-knap ghost"
								type="button"
								onclick={() => (bekraefter = false)}
								disabled={gemmer}
							>
								Annuller
							</button>
							<button class="form-knap danger" type="button" onclick={sletDag} disabled={gemmer}>
								{gemmer ? 'Sletter...' : 'Ja, slet'}
							</button>
						</div>
					</div>
				{/if}
			</div>
		</div>
	{/if}
</div>

{#if dialogMaal && forlob}
	<VaelgDageDialog
		startDato={forlob.startDato.toDate().toISOString()}
		antalDage={forlob.antalDage}
		nuvaerendeDag={dagNummer}
		valgteDageStart={dialogStartDage}
		titel={dialogMaal === 'note' ? 'Vis noten paa dage' : 'Vis lektion paa dage'}
		onGem={haandterVaelgDage}
		onAnnuller={() => (dialogMaal = null)}
	/>
{/if}

{#if gruppeBekraeft}
	<RedigerGruppeDialog
		titel={gruppeBekraeft.titel}
		beskrivelse={gruppeBekraeft.beskrivelse}
		antalDage={gruppeBekraeft.antalDage}
		alleLabel={gruppeBekraeft.alleLabel}
		denneLabel={gruppeBekraeft.denneLabel}
		erFarlig={gruppeBekraeft.erFarlig}
		onAlle={gruppeBekraeft.paaAlle}
		onDenne={gruppeBekraeft.paaDenne}
		onAnnuller={() => (gruppeBekraeft = null)}
	/>
{/if}

<style>
	.page {
		padding: 18px 18px 100px;
		max-width: 520px;
		margin: 0 auto;
	}

	.page-header {
		margin-bottom: 18px;
	}

	.back {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-size: calc(12px * var(--fs-scale, 1));
		color: var(--text2);
		text-decoration: none;
		margin-bottom: 12px;
	}

	.eyebrow {
		font-size: calc(10px * var(--fs-scale, 1));
		font-weight: 600;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--text3);
	}

	h1 {
		font-family: var(--ff-d);
		font-size: calc(26px * var(--fs-scale, 1));
		font-weight: 600;
		letter-spacing: -0.02em;
		margin: 4px 0 0;
		line-height: 1.05;
		color: var(--text);
	}

	.page-sub {
		font-size: calc(13px * var(--fs-scale, 1));
		color: var(--text2);
		margin: 6px 0 0;
	}

	.status-besked {
		padding: 14px 16px;
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 12px;
		color: var(--text2);
		font-size: calc(13px * var(--fs-scale, 1));
		text-align: center;
	}

	.status-besked.fejl {
		color: #8a4a3e;
		background: #fbeeea;
		border-color: #f0d6cf;
	}

	.form-card {
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 14px;
		padding: 16px;
		display: flex;
		flex-direction: column;
		gap: 12px;
		margin-bottom: 14px;
	}

	.form-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.form-titel {
		font-family: var(--ff-d);
		font-size: calc(16px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--text);
	}

	.form-tael {
		font-size: calc(11px * var(--fs-scale, 1));
		color: var(--text3);
		font-variant-numeric: tabular-nums;
	}

	.muted {
		font-size: calc(12px * var(--fs-scale, 1));
		color: var(--text3);
		margin: 0;
		font-style: italic;
	}

	.lektion-edit {
		display: flex;
		flex-direction: column;
		gap: 10px;
		padding: 12px;
		background: var(--bg2);
		border: 1px solid var(--border);
		border-radius: 12px;
	}

	.lektion-edit.grupperet {
		border-color: var(--terra2);
		box-shadow: 0 0 0 1px var(--tdim) inset;
	}

	.lektion-edit-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
	}

	.lektion-edit-num {
		font-size: calc(11px * var(--fs-scale, 1));
		font-weight: 600;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--text3);
		display: inline-flex;
		align-items: center;
		gap: 8px;
		flex-wrap: wrap;
	}

	.gruppe-chip {
		display: inline-flex;
		align-items: center;
		gap: 3px;
		font-size: calc(10.5px * var(--fs-scale, 1));
		font-weight: 600;
		letter-spacing: 0.04em;
		text-transform: none;
		color: var(--terra);
		background: var(--tdim);
		padding: 3px 8px;
		border-radius: 99px;
		cursor: help;
	}

	.vis-paa-rad {
		display: flex;
		gap: 8px;
		flex-wrap: wrap;
		margin-top: 4px;
	}

	.vis-paa-knap {
		padding: 7px 12px;
		font-family: var(--ff-b);
		font-size: calc(12px * var(--fs-scale, 1));
		font-weight: 600;
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 99px;
		color: var(--terra);
		cursor: pointer;
		touch-action: manipulation;
	}

	.vis-paa-knap:hover:not(:disabled) {
		border-color: var(--terra);
	}

	.vis-paa-knap:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.vis-paa-knap.ghost {
		color: var(--text3);
	}

	.ikon-knap {
		width: 28px;
		height: 28px;
		border-radius: 8px;
		border: 1px solid var(--border);
		background: var(--white);
		color: var(--text2);
		font-size: calc(14px * var(--fs-scale, 1));
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.ikon-knap.fare:hover {
		background: #fbeeea;
		color: #8a4a3e;
		border-color: #f0d6cf;
	}

	.ikon-knap:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.felt {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.felt-label {
		font-size: calc(11px * var(--fs-scale, 1));
		font-weight: 600;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--text3);
	}

	.felt input,
	.felt textarea,
	.form-card > textarea {
		padding: 10px 12px;
		font-size: calc(14px * var(--fs-scale, 1));
		border-radius: 10px;
		border: 1px solid var(--border);
		background: var(--white);
		color: var(--text);
		outline: none;
		font-family: var(--ff-b);
	}

	.felt textarea,
	.form-card > textarea {
		resize: vertical;
		min-height: 80px;
		line-height: 1.5;
	}

	.felt input:focus,
	.felt textarea:focus,
	.form-card > textarea:focus {
		border-color: var(--terra);
	}

	.felt-rad {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 10px;
	}

	.actions {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.form-knap {
		padding: 12px;
		font-size: calc(14px * var(--fs-scale, 1));
		font-weight: 600;
		border-radius: 10px;
		border: none;
		cursor: pointer;
		font-family: var(--ff-b);
	}

	.form-knap.full {
		width: 100%;
	}

	.form-knap.ghost {
		background: var(--white);
		border: 1px solid var(--border);
		color: var(--text2);
	}

	.form-knap.primary {
		background: var(--terra);
		color: #fff;
	}

	.form-knap.danger {
		background: #b8503f;
		color: #fff;
	}

	.form-knap:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.kvit-besked {
		padding: 8px 12px;
		background: var(--sdim);
		border-radius: 8px;
		font-size: calc(12px * var(--fs-scale, 1));
		color: var(--sage);
		text-align: center;
	}

	.slet-omraade {
		margin-top: 14px;
	}

	.slet-knap {
		background: none;
		border: 1px solid #e8c8c1;
		color: #b8503f;
		font-size: calc(12px * var(--fs-scale, 1));
		font-weight: 500;
		padding: 8px 14px;
		border-radius: 8px;
		cursor: pointer;
		font-family: var(--ff-b);
		width: 100%;
	}

	.slet-knap:hover {
		background: #fbeeea;
	}

	.slet-knap:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.slet-bekraeft {
		background: #fbeeea;
		border: 1px solid #f0d6cf;
		border-radius: 12px;
		padding: 14px;
	}

	.slet-tekst {
		font-size: calc(13px * var(--fs-scale, 1));
		color: #8a4a3e;
		margin-bottom: 10px;
	}

	.slet-knapper {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 10px;
	}

	.html-upload-rad {
		display: flex;
		align-items: center;
		gap: 10px;
		margin-top: 6px;
		flex-wrap: wrap;
	}

	.html-upload-knap {
		position: relative;
		display: inline-flex;
		align-items: center;
		padding: 7px 12px;
		font-size: calc(12px * var(--fs-scale, 1));
		font-weight: 500;
		border-radius: 8px;
		border: 1px dashed var(--border);
		background: var(--white);
		color: var(--text2);
		cursor: pointer;
		font-family: var(--ff-b);
	}

	.html-upload-knap:hover {
		border-color: var(--terra);
		color: var(--terra);
	}

	.html-upload-knap.disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.html-upload-knap input[type='file'] {
		position: absolute;
		inset: 0;
		opacity: 0;
		cursor: pointer;
		font-size: 0;
	}

	.html-upload-knap.disabled input[type='file'] {
		cursor: not-allowed;
	}

	.html-upload-hint {
		font-size: calc(11px * var(--fs-scale, 1));
		color: var(--text3);
		font-style: italic;
	}

	.thumb-dropzone {
		position: relative;
		aspect-ratio: 16 / 9;
		border: 2px dashed var(--border);
		border-radius: 10px;
		background: var(--white);
		overflow: hidden;
		transition: border-color 0.15s, background 0.15s;
	}

	.thumb-dropzone.drag-over {
		border-color: var(--terra);
		background: var(--tdim);
	}

	.thumb-dropzone.har-thumb {
		border-style: solid;
	}

	.thumb-preview {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}

	.thumb-overlay {
		position: absolute;
		inset: auto 0 0 0;
		display: flex;
		gap: 6px;
		padding: 8px;
		background: linear-gradient(to top, rgba(0, 0, 0, 0.55), rgba(0, 0, 0, 0));
		justify-content: flex-end;
	}

	.thumb-tom {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		width: 100%;
		height: 100%;
		gap: 4px;
		padding: 16px;
		cursor: pointer;
		color: var(--text2);
		text-align: center;
	}

	.thumb-tom-titel {
		font-size: calc(13px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--text);
	}

	.thumb-tom-hint {
		font-size: calc(11px * var(--fs-scale, 1));
		color: var(--text3);
	}

	.thumb-tom input[type='file'] {
		display: none;
	}

	.thumb-knap {
		position: relative;
		display: inline-flex;
		align-items: center;
		padding: 6px 10px;
		font-size: calc(12px * var(--fs-scale, 1));
		font-weight: 500;
		border-radius: 6px;
		border: none;
		background: rgba(255, 255, 255, 0.95);
		color: var(--text);
		cursor: pointer;
		font-family: var(--ff-b);
	}

	.thumb-knap.fare {
		background: rgba(184, 80, 63, 0.95);
		color: #fff;
	}

	.thumb-knap input[type='file'] {
		position: absolute;
		inset: 0;
		opacity: 0;
		cursor: pointer;
	}

	.thumb-knap:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.thumb-hint {
		font-size: calc(11px * var(--fs-scale, 1));
		color: var(--text3);
		font-style: italic;
	}
</style>
