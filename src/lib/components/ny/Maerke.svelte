<script lang="ts">
	// ============================================================
	// Linns Academy-maerket. Ét sted, saa der kun findes én udgave af
	// logoet i hele 3.0.
	//
	// Formen er hentet direkte fra app-ikonet i static/icon.svg. Ikonet
	// er kvadratisk med ordet over uendelighedstegnet, og det er for hoejt
	// til en top. Her staar de samme to dele ved siden af hinanden.
	//
	// TO UDGAVER, og de har hvert sit sted:
	//   fuld    forsiden. Tegn plus "Linn's Academy"
	//   stille  alle andre sider. Kun tegnet, ude i hoejre side af titlen
	//
	// SKRIVEMAADEN ER "Linn's" MED APOSTROF. Linns beslutning 20. august
	// 2026. Logoet har altid haft apostrof, og resten af appen skrev det
	// uden, saa der stod to udgaver af hendes eget navn side om side.
	// Skriver du navnet et nyt sted, saa skriv det med apostrof.
	// ============================================================

	interface Props {
		variant?: 'fuld' | 'stille';
		/** Skal maerket foere til forsiden. Slaa fra paa forsiden selv. */
		link?: boolean;
	}

	let { variant = 'stille', link = true }: Props = $props();

	// Tegnet er ren pynt naar navnet staar ved siden af. Staar det alene,
	// er det appens navn, og saa skal en skaermlaeser kunne sige det.
	const etiket = $derived(variant === 'stille' ? "Linn's Academy" : undefined);
</script>

{#snippet indhold()}
	<svg
		class="mk-tegn"
		viewBox="100 22 340 96"
		role={etiket ? 'img' : 'presentation'}
		aria-label={etiket}
		aria-hidden={etiket ? undefined : 'true'}
	>
		<path
			d="M 110 70 C 110 30, 200 30, 270 70 C 340 110, 430 110, 430 70 C 430 30, 340 30, 270 70 C 200 110, 110 110, 110 70 Z"
			fill="none"
			stroke="currentColor"
			stroke-width={variant === 'fuld' ? 11 : 10}
			stroke-linejoin="round"
			stroke-linecap="round"
		/>
	</svg>
	{#if variant === 'fuld'}
		<span class="mk-navn"><i>Linn's</i> Academy</span>
	{/if}
{/snippet}

{#if link}
	<a
		class="mk mk-{variant}"
		href="/ny"
		aria-label={variant === 'fuld' ? undefined : 'Til forsiden'}
	>
		{@render indhold()}
	</a>
{:else}
	<span class="mk mk-{variant}">{@render indhold()}</span>
{/if}
