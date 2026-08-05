<script lang="ts">
	// ============================================================
	// Ventetegnet i 3.0. Evighedstegnet loeber rundt i sit eget otte-tal,
	// mens der ventes. Det er timeglasset, bare Linns.
	//
	// Hvorfor egen markup i stedet for Logo.svelte: tegnet skal kunne
	// animeres, og i Logo.svelte ligger stien inde i lockup'en uden en
	// egen krog. Logo.svelte er uroert, den bruges fortsat i den gamle app.
	//
	// Tre stoerrelser:
	//   fuld   — hele lockup'en. Login og foerste hentning.
	//   lille  — kun tegnet. Inde i appen, hvor ordene ville raabe.
	//   knap   — bittesmaa, hvidt. I en knap mens der gemmes.
	// ============================================================

	interface Props {
		variant?: 'fuld' | 'lille' | 'knap';
		/** Saet den, saa tegnet staar stille. Bruges naar intet venter. */
		stille?: boolean;
	}

	let { variant = 'lille', stille = false }: Props = $props();

	const MAAL = {
		fuld: { bredde: 150, hoejde: 34, streg: 4 },
		lille: { bredde: 38, hoejde: 10, streg: 12 },
		knap: { bredde: 26, hoejde: 7, streg: 14 }
	};
	const m = $derived(MAAL[variant]);
	const farve = $derived(variant === 'knap' ? '#ffffff' : 'var(--plum)');
</script>

{#if variant === 'fuld'}
	<div class="lockup">
		<div class="linns">Linn's</div>
		<svg
			class="tegn"
			class:loeber={!stille}
			width={m.bredde}
			height={m.hoejde}
			viewBox="0 0 540 140"
			aria-hidden="true"
		>
			<path
				pathLength="1"
				d="M 110 70 C 110 30, 200 30, 270 70 C 340 110, 430 110, 430 70 C 430 30, 340 30, 270 70 C 200 110, 110 110, 110 70 Z"
				stroke={farve}
				stroke-width={m.streg}
			/>
		</svg>
		<div class="academy">Academy</div>
	</div>
{:else}
	<svg
		class="tegn"
		class:loeber={!stille}
		width={m.bredde}
		height={m.hoejde}
		viewBox="0 0 540 140"
		aria-hidden="true"
	>
		<path
			pathLength="1"
			d="M 110 70 C 110 30, 200 30, 270 70 C 340 110, 430 110, 430 70 C 430 30, 340 30, 270 70 C 200 110, 110 110, 110 70 Z"
			stroke={farve}
			stroke-width={m.streg}
		/>
	</svg>
{/if}

<style>
	.tegn {
		display: block;
	}

	.tegn path {
		fill: none;
		stroke-linejoin: round;
		stroke-linecap: round;
	}

	.tegn.loeber path {
		stroke-dasharray: 0.34 0.66;
		animation: loeb 2.6s linear infinite;
	}

	@keyframes loeb {
		from {
			stroke-dashoffset: 0;
		}
		to {
			stroke-dashoffset: -1;
		}
	}

	/* Har hun slaaet bevaegelse fra, staar tegnet stille og daempet. */
	@media (prefers-reduced-motion: reduce) {
		.tegn.loeber path {
			animation: none;
			stroke-dasharray: none;
			opacity: 0.55;
		}
	}

	.lockup {
		display: inline-flex;
		flex-direction: column;
		align-items: center;
		line-height: 1;
	}

	/* Playfair er logoets skrift og loades allerede globalt i app.html. */
	.linns {
		font-family: 'Playfair Display', Georgia, serif;
		font-style: italic;
		font-weight: 400;
		font-size: calc(30px * var(--fs-scale, 1));
		line-height: 0.95;
		letter-spacing: -0.02em;
		color: var(--espresso);
	}

	.academy {
		font-family: var(--sans);
		font-weight: 600;
		text-transform: uppercase;
		font-size: calc(9.5px * var(--fs-scale, 1));
		letter-spacing: 0.42em;
		padding-left: 0.42em;
		color: var(--plum);
		margin-top: -1px;
	}
</style>
