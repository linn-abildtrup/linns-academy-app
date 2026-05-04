<div class="page">
	<h1>Linn's Academy — brand-test</h1>
	<p class="lede">Hvis du kan se Playfair Display i overskriften og DM Sans her, virker fonts.</p>

	<h2>Farver</h2>
	<div class="swatches">
		<div class="swatch" style="background: var(--bg);">
			<span>--bg</span>
			<small>#FAF6F1</small>
		</div>
		<div class="swatch" style="background: var(--header);">
			<span>--header</span>
			<small>#F2EBE3</small>
		</div>
		<div class="swatch" style="background: var(--bg2);">
			<span>--bg2</span>
			<small>#F5EFE8</small>
		</div>
		<div class="swatch dark" style="background: var(--terra);">
			<span>--terra</span>
			<small>#B87B6E</small>
		</div>
		<div class="swatch dark" style="background: var(--terra2);">
			<span>--terra2</span>
			<small>#CC9080</small>
		</div>
		<div class="swatch dark" style="background: var(--sage);">
			<span>--sage</span>
			<small>#6F9E7E</small>
		</div>
		<div class="swatch dark" style="background: var(--gold);">
			<span>--gold</span>
			<small>#B8956A</small>
		</div>
		<div class="swatch" style="background: var(--ic-rose);">
			<span>--ic-rose</span>
			<small>#F0DDD7</small>
		</div>
		<div class="swatch" style="background: var(--ic-sage);">
			<span>--ic-sage</span>
			<small>#E2EFE6</small>
		</div>
	</div>

	<h2>Typografi</h2>
	<div class="type-stack">
		<div>
			<div class="type-label">h1 — Playfair Display 700</div>
			<h1 style="margin: 0;">Hormoner og søvn</h1>
		</div>
		<div>
			<div class="type-label">h2 — Playfair Display 700</div>
			<h2 style="margin: 0;">Dagens lektion</h2>
		</div>
		<div>
			<div class="type-label">h3 — Playfair Display 700</div>
			<h3 style="margin: 0;">Note fra Linn</h3>
		</div>
		<div>
			<div class="type-label">body — DM Sans 400</div>
			<p style="margin: 0;">
				Du er på dag 8 af forløbet. I dag handler det om hvorfor du vågner kl. 3 om
				natten — og hvad du kan gøre ved det.
			</p>
		</div>
		<div>
			<div class="type-label">eyebrow — DM Sans 600 caps</div>
			<div class="eyebrow">Tirsdag · 4. juni</div>
		</div>
	</div>

	<h2>Tekst-trin</h2>
	<div class="text-stack">
		<p style="color: var(--text);">--text — primær tekstfarve</p>
		<p style="color: var(--text2);">--text2 — sekundær</p>
		<p style="color: var(--text3);">--text3 — tertiær (labels, dæmpet)</p>
	</div>
</div>

<style>
	.page {
		max-width: 480px;
		margin: 0 auto;
		padding: 32px 20px 60px;
	}

	.lede {
		color: var(--text2);
		margin: 8px 0 32px;
	}

	h2 {
		margin-top: 40px;
		margin-bottom: 16px;
	}

	.swatches {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 10px;
	}

	.swatch {
		border: 1px solid var(--border);
		border-radius: var(--r);
		padding: 16px;
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-height: 70px;
	}

	.swatch span {
		font-weight: 600;
		font-size: 13px;
	}

	.swatch small {
		font-size: 11px;
		opacity: 0.7;
		font-family: ui-monospace, 'SF Mono', monospace;
	}

	.swatch.dark {
		color: var(--white);
	}

	.type-stack {
		display: flex;
		flex-direction: column;
		gap: 20px;
	}

	.type-label {
		font-size: 10px;
		font-weight: 600;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--text3);
		margin-bottom: 4px;
	}

	.eyebrow {
		font-size: 11px;
		font-weight: 600;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--text3);
	}

	.text-stack {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
</style>