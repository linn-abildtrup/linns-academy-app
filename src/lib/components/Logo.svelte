<script lang="ts">
	// Linn's Academy lockup — C8-variant fra Logo Exploration v5.
	// Tre lag: "Linn's" Playfair italic, ∞ hairline (terra), Academy sperret.
	// Brug:
	//   <Logo />                  — standard header-størrelse
	//   <Logo size="lg" />        — login/loading
	//   <Logo size="sm" />        — kompakt (PDF, lille footer)
	//   <Logo tone="light" />     — hvid på mørk baggrund
	type Size = 'sm' | 'md' | 'lg';
	type Tone = 'default' | 'light';

	let { size = 'md', tone = 'default' }: { size?: Size; tone?: Tone } = $props();

	// Dimensioner pr størrelse — bevarer C8's proportioner mellem
	// Linn's-fontsize, ∞-bredde og Academy-bogstavafstand.
	const VARIANTER: Record<
		Size,
		{ linns: number; infW: number; infH: number; academy: number; tracking: number }
	> = {
		sm: { linns: 22, infW: 110, infH: 26, academy: 7, tracking: 0.42 },
		md: { linns: 32, infW: 160, infH: 36, academy: 10, tracking: 0.42 },
		lg: { linns: 60, infW: 280, infH: 60, academy: 18, tracking: 0.42 }
	};
	const v = $derived(VARIANTER[size]);

	const farveTekst = $derived(tone === 'light' ? '#FAF6F1' : 'var(--text)');
	const farveAccent = $derived(tone === 'light' ? '#FAF6F1' : 'var(--terra)');
	const farveAcademy = $derived(tone === 'light' ? '#FAF6F1' : 'var(--terra-dark, #8E5A4E)');
	const strokeWidth = $derived(size === 'lg' ? 1.8 : 2.0);
</script>

<div class="logo" data-size={size}>
	<div class="linns" style:font-size="{v.linns}px" style:color={farveTekst}>Linn's</div>
	<svg
		class="inf"
		width={v.infW}
		height={v.infH}
		viewBox="0 0 540 140"
		aria-hidden="true"
	>
		<path
			d="M 110 70 C 110 30, 200 30, 270 70 C 340 110, 430 110, 430 70 C 430 30, 340 30, 270 70 C 200 110, 110 110, 110 70 Z"
			fill="none"
			stroke={farveAccent}
			stroke-width={strokeWidth}
			stroke-linejoin="round"
			stroke-linecap="round"
		/>
	</svg>
	<div
		class="academy"
		style:font-size="{v.academy}px"
		style:letter-spacing="{v.tracking}em"
		style:padding-left="{v.tracking}em"
		style:color={farveAcademy}
	>
		Academy
	</div>
</div>

<style>
	.logo {
		display: inline-flex;
		flex-direction: column;
		align-items: center;
		line-height: 1;
		font-family: var(--ff-d);
	}

	.linns {
		font-family: var(--ff-d);
		font-style: italic;
		font-weight: 400;
		line-height: 0.95;
		letter-spacing: -0.02em;
	}

	.inf {
		display: block;
		margin: 0 auto;
	}

	.academy {
		font-family: var(--ff-b);
		font-weight: 600;
		text-transform: uppercase;
		margin-top: -2px;
	}

	.logo[data-size='sm'] {
		gap: 0;
	}
</style>
