<script lang="ts">
	import { onMount } from 'svelte';
	import {
		hentAlleVidenbaseDokumenter,
		gemVidenbaseDokument,
		sletVidenbaseDokument
	} from '$lib/firestore/linnAi';
	import type { VidenbaseDokument, VidenbaseKilde } from '$lib/content/linnAi';
	import { chunkTekst } from '$lib/content/linnAi';
	import Icon from '$lib/components/Icon.svelte';
	import Loading from '$lib/components/Loading.svelte';

	let dokumenter = $state<VidenbaseDokument[]>([]);
	let loading = $state(true);
	let fejl = $state<string | null>(null);
	let uploadStatus = $state<'klar' | 'parser' | 'gemmer' | 'fejl' | 'ok'>('klar');
	let uploadBesked = $state('');
	let dragOver = $state(false);

	onMount(async () => {
		try {
			dokumenter = await hentAlleVidenbaseDokumenter();
		} catch (e) {
			console.error(e);
			fejl = 'Kunne ikke hente videnbasen.';
		} finally {
			loading = false;
		}
	});

	async function handleFiles(files: FileList | File[]) {
		const liste = Array.from(files);
		uploadStatus = 'parser';
		uploadBesked = '';
		try {
			for (const fil of liste) {
				const navn = fil.name;
				const tekst = await parseFil(fil);
				const chunks = chunkTekst(tekst);
				const kilde: VidenbaseKilde = navn.toLowerCase().endsWith('.pdf')
					? 'pdf'
					: navn.toLowerCase().match(/\.(ppt|pptx)$/)
						? 'slide'
						: 'manual';

				uploadStatus = 'gemmer';
				if (chunks.length === 1) {
					const id = `doc_${Date.now()}_${navn.replace(/[^a-z0-9]/gi, '_')}`;
					await gemVidenbaseDokument(id, { navn, kilde, tekst: chunks[0] });
				} else {
					for (let i = 0; i < chunks.length; i++) {
						const id = `doc_${Date.now()}_${navn.replace(/[^a-z0-9]/gi, '_')}_del${i + 1}`;
						await gemVidenbaseDokument(id, {
							navn: `${navn} (del ${i + 1}/${chunks.length})`,
							kilde,
							tekst: chunks[i]
						});
					}
				}
			}
			dokumenter = await hentAlleVidenbaseDokumenter();
			uploadStatus = 'ok';
			uploadBesked = `${liste.length} fil(er) uploadet og indekseret.`;
			setTimeout(() => (uploadStatus = 'klar'), 3000);
		} catch (e) {
			console.error(e);
			uploadStatus = 'fejl';
			uploadBesked = e instanceof Error ? e.message : 'Kunne ikke uploade.';
		}
	}

	async function parseFil(fil: File): Promise<string> {
		const lower = fil.name.toLowerCase();
		if (lower.endsWith('.pdf')) {
			return parsePdf(fil);
		}
		if (lower.endsWith('.txt') || lower.endsWith('.md')) {
			return await fil.text();
		}
		throw new Error(`Filtype ikke understøttet: ${fil.name}. Brug PDF eller .txt.`);
	}

	async function parsePdf(fil: File): Promise<string> {
		// Dynamisk import så pdfjs kun loades når admin uploader PDF
		const pdfjs = await import('pdfjs-dist');
		// pdfjs kræver workerSrc — peg på CDN-version
		const pdfjsLib = pdfjs as unknown as { GlobalWorkerOptions: { workerSrc: string }; getDocument: typeof pdfjs.getDocument };
		pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;

		const buffer = await fil.arrayBuffer();
		const pdf = await pdfjs.getDocument({ data: buffer }).promise;
		const dele: string[] = [];
		for (let i = 1; i <= pdf.numPages; i++) {
			const side = await pdf.getPage(i);
			const tekst = await side.getTextContent();
			const sideTekst = tekst.items
				.map((item) => ('str' in item ? item.str : ''))
				.join(' ');
			dele.push(sideTekst);
		}
		return dele.join('\n\n');
	}

	function handleDrop(e: DragEvent) {
		e.preventDefault();
		dragOver = false;
		if (e.dataTransfer?.files) handleFiles(e.dataTransfer.files);
	}

	function handleFileInput(e: Event) {
		const input = e.target as HTMLInputElement;
		if (input.files) handleFiles(input.files);
	}

	async function handleSlet(id: string, navn: string) {
		if (!confirm(`Slet '${navn}' fra videnbasen?`)) return;
		try {
			await sletVidenbaseDokument(id);
			dokumenter = await hentAlleVidenbaseDokumenter();
		} catch (e) {
			console.error(e);
			alert('Kunne ikke slette.');
		}
	}

	function tegnFormat(antal: number): string {
		if (antal < 1000) return `${antal} tegn`;
		return `${(antal / 1000).toFixed(1)}k tegn`;
	}

	const totalTegn = $derived(dokumenter.reduce((s, d) => s + d.tekst.length, 0));
</script>

<div class="page">
	<header class="page-header">
		<a class="back" href="/app/admin">
			<Icon name="arrow-l" size={14} color="var(--text2)" />
			<span>Admin</span>
		</a>
		<div class="eyebrow">Admin · Linn AI</div>
		<h1>Videnbase</h1>
		<p class="page-sub">
			Upload PDFs eller .txt-filer som Linn AI bruger til at svare premium-klienter.
			Klient-spørgsmål du har besvaret kommer automatisk med — du behøver ikke uploade dem.
		</p>
	</header>

	{#if loading}
		<Loading tekst="Henter videnbase..." />
	{:else if fejl}
		<div class="status-besked fejl">{fejl}</div>
	{:else}
		<div
			class="dropzone"
			class:over={dragOver}
			role="button"
			tabindex="0"
			ondragover={(e) => {
				e.preventDefault();
				dragOver = true;
			}}
			ondragleave={() => (dragOver = false)}
			ondrop={handleDrop}
		>
			<Icon name="plus" size={24} color="var(--text2)" />
			<div class="drop-titel">Drop PDF eller .txt her</div>
			<div class="drop-sub">eller klik for at vælge fil</div>
			<input
				type="file"
				class="drop-input"
				accept=".pdf,.txt,.md"
				multiple
				onchange={handleFileInput}
			/>
		</div>

		{#if uploadStatus !== 'klar'}
			<div class="status-besked" class:fejl={uploadStatus === 'fejl'} class:ok={uploadStatus === 'ok'}>
				{#if uploadStatus === 'parser'}
					Læser fil...
				{:else if uploadStatus === 'gemmer'}
					Gemmer i videnbase...
				{:else}
					{uploadBesked}
				{/if}
			</div>
		{/if}

		<section class="card">
			<div class="card-head">
				<div class="section-label">Indekseret</div>
				<div class="card-tael">
					{dokumenter.length} {dokumenter.length === 1 ? 'dokument' : 'dokumenter'} · {tegnFormat(totalTegn)}
				</div>
			</div>
			{#if dokumenter.length === 0}
				<p class="hint">Videnbasen er tom. Upload din første fil ovenfor.</p>
			{:else}
				<ul class="doc-liste">
					{#each dokumenter as d (d.id)}
						<li class="doc-item">
							<div class="doc-tekst">
								<div class="doc-navn">{d.navn}</div>
								<div class="doc-meta">
									{kildeLabel(d.kilde)} · {tegnFormat(d.tekst.length)}
								</div>
							</div>
							<button
								class="slet-btn"
								type="button"
								onclick={() => handleSlet(d.id, d.navn)}
								aria-label="Slet"
							>
								×
							</button>
						</li>
					{/each}
				</ul>
			{/if}
		</section>
	{/if}
</div>

<script module lang="ts">
	import type { VidenbaseKilde as VK } from '$lib/content/linnAi';
	function kildeLabel(k: VK): string {
		switch (k) {
			case 'pdf':
				return 'PDF';
			case 'slide':
				return 'Præsentation';
			case 'klient_spoergsmaal':
				return 'Klient-svar';
			case 'manual':
				return 'Notat';
		}
	}
</script>

<style>
	.page {
		padding: 18px 18px 100px;
		max-width: 640px;
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
		font-size: calc(28px * var(--fs-scale, 1));
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
		line-height: 1.4;
	}

	.dropzone {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 6px;
		padding: 30px 20px;
		border: 2px dashed var(--border2, var(--border));
		border-radius: 14px;
		background: var(--white);
		text-align: center;
		cursor: pointer;
		margin-bottom: 14px;
	}

	.dropzone.over {
		border-color: var(--terra);
		background: var(--tdim);
	}

	.drop-titel {
		font-size: calc(14px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--text);
		margin-top: 6px;
	}

	.drop-sub {
		font-size: calc(11px * var(--fs-scale, 1));
		color: var(--text3);
	}

	.drop-input {
		position: absolute;
		inset: 0;
		opacity: 0;
		cursor: pointer;
	}

	.status-besked {
		padding: 10px 14px;
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 10px;
		font-size: calc(12px * var(--fs-scale, 1));
		text-align: center;
		margin-bottom: 14px;
	}

	.status-besked.ok {
		background: var(--sdim);
		border-color: var(--sage);
		color: var(--text);
	}

	.status-besked.fejl {
		background: #fbeeea;
		border-color: #f0d6cf;
		color: #8a4a3e;
	}

	.card {
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 14px;
		padding: 16px;
	}

	.card-head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		margin-bottom: 12px;
	}

	.section-label {
		font-size: calc(10px * var(--fs-scale, 1));
		font-weight: 600;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: var(--text3);
	}

	.card-tael {
		font-size: calc(11px * var(--fs-scale, 1));
		color: var(--text3);
	}

	.hint {
		font-size: calc(12px * var(--fs-scale, 1));
		color: var(--text3);
		margin: 0;
	}

	.doc-liste {
		list-style: none;
		padding: 0;
		margin: 0;
	}

	.doc-item {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 10px 0;
		border-top: 1px solid var(--border);
	}

	.doc-item:first-child {
		border-top: none;
	}

	.doc-tekst {
		flex: 1;
		min-width: 0;
	}

	.doc-navn {
		font-size: calc(13px * var(--fs-scale, 1));
		font-weight: 500;
		color: var(--text);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.doc-meta {
		font-size: calc(11px * var(--fs-scale, 1));
		color: var(--text3);
		margin-top: 2px;
	}

	.slet-btn {
		width: 28px;
		height: 28px;
		flex-shrink: 0;
		border: 1px solid var(--border);
		background: var(--white);
		color: var(--text3);
		border-radius: 6px;
		font-size: 16px;
		cursor: pointer;
	}

	.slet-btn:hover {
		background: #fbeeea;
		border-color: #f0d6cf;
		color: #8a4a3e;
	}
</style>
