<script lang="ts">
	// Dagens tal: protein og fiber holdt op mod hendes egne maal.
	// Vises kun naar hun faktisk har maal sat, ellers er der intet at maale mod.

	import type { DagensTal } from '$lib/firestore/forside3';

	interface Props {
		tal: DagensTal;
	}

	let { tal }: Props = $props();

	const pct = (v: number, maal: number) =>
		maal > 0 ? Math.max(0, Math.min(100, Math.round((v / maal) * 100))) : 0;
</script>

<section>
	<div class="lab">
		<h2>Dagens tal</h2>
		<a href="/ny/moduler">Åbn mad</a>
	</div>
	<div class="kort maal-kort">
		<div class="maal">
			<span class="maal-k">Protein</span>
			<div class="spor">
				<div class="fyld p" style:width="{pct(tal.protein, tal.proteinMaal)}%"></div>
			</div>
			<span class="maal-v">{tal.protein}<small> / {tal.proteinMaal} g</small></span>
		</div>
		<div class="maal">
			<span class="maal-k">Fiber</span>
			<div class="spor">
				<div class="fyld f" style:width="{pct(tal.fiber, tal.fiberMaal)}%"></div>
			</div>
			<span class="maal-v">{tal.fiber}<small> / {tal.fiberMaal} g</small></span>
		</div>
	</div>
</section>
