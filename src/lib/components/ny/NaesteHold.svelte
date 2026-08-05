<script lang="ts">
	// ============================================================
	// Det naeste hold, vist roligt nederst paa forsiden for en der ikke
	// er paa et forloeb lige nu. Har hun gennemfoert Kickstart, peger det
	// paa Kropsro og ikke paa Kickstart igen.
	//
	// Det er stedet hvor et medlemskab bliver til en tilmelding, og
	// derfor staar det nederst og raaber ikke.
	// ============================================================

	import type { NaesteHold } from '$lib/firestore/forside3';
	import { formaterKortDato } from '$lib/content/forside3';

	interface Props {
		hold: NaesteHold;
		nu: number;
	}

	let { hold, nu }: Props = $props();
</script>

<section class="hold">
	<span class="hold-ic" aria-hidden="true">✦</span>
	<div>
		<div class="hold-k">Dit næste hold</div>
		<div class="hold-t">{hold.navn}</div>
		<div class="hold-s">Starter {formaterKortDato(hold.startMs, nu)}</div>
	</div>
</section>
