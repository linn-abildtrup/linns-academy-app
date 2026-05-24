<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';

	interface Props {
		dagNummer: number;
		antalDage: number;
		/**
		 * Hvis sat, navigerer pile til denne sti med ny dag. Bruges af [dag]-routes
		 * hvor dag er i URL-pathen. Default: bliv på samme sti og opdater
		 * kun previewDag-query-parametren.
		 */
		buildPath?: (nyDag: number) => string;
	}

	let { dagNummer, antalDage, buildPath }: Props = $props();

	function goTilDag(nyDag: number) {
		const clamped = Math.max(0, Math.min(antalDage, nyDag));
		const params = new URLSearchParams(page.url.search);
		params.set('previewDag', String(clamped));
		const pathname = buildPath ? buildPath(clamped) : page.url.pathname;
		void goto(pathname + '?' + params.toString(), { replaceState: true, noScroll: true });
	}

	function lukPreview() {
		const params = new URLSearchParams(page.url.search);
		params.delete('previewDag');
		const queryStr = params.toString();
		const sti = page.url.pathname + (queryStr ? '?' + queryStr : '');
		void goto(sti, { replaceState: true, noScroll: true });
	}
</script>

<div class="preview-banner" role="status">
	<div class="preview-tekst">
		<div class="preview-eyebrow">Preview · Admin</div>
		<div class="preview-titel">Dag {dagNummer} af {antalDage}</div>
	</div>
	<div class="preview-knapper">
		<button
			class="nav-knap"
			type="button"
			onclick={() => goTilDag(dagNummer - 1)}
			disabled={dagNummer <= 0}
			aria-label="Forrige dag"
		>
			◀
		</button>
		<button
			class="nav-knap"
			type="button"
			onclick={() => goTilDag(dagNummer + 1)}
			disabled={dagNummer >= antalDage}
			aria-label="Næste dag"
		>
			▶
		</button>
		<button class="luk-knap" type="button" onclick={lukPreview}>Stop</button>
	</div>
</div>

<style>
	.preview-banner {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		padding: 10px 14px;
		background: #2a1f17;
		color: #fff;
		font-family: var(--ff-b);
		position: sticky;
		top: 0;
		z-index: 90;
	}

	.preview-tekst {
		display: flex;
		flex-direction: column;
		gap: 1px;
	}

	.preview-eyebrow {
		font-size: 10px;
		font-weight: 600;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: rgba(255, 255, 255, 0.7);
	}

	.preview-titel {
		font-size: 14px;
		font-weight: 600;
	}

	.preview-knapper {
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.nav-knap {
		width: 32px;
		height: 32px;
		border-radius: 8px;
		background: rgba(255, 255, 255, 0.15);
		border: none;
		color: #fff;
		font-size: 14px;
		cursor: pointer;
		font-family: var(--ff-b);
	}

	.nav-knap:hover:not(:disabled) {
		background: rgba(255, 255, 255, 0.25);
	}

	.nav-knap:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.luk-knap {
		padding: 6px 12px;
		border-radius: 8px;
		background: var(--terra);
		border: none;
		color: #fff;
		font-size: 12px;
		font-weight: 600;
		cursor: pointer;
		font-family: var(--ff-b);
	}
</style>
