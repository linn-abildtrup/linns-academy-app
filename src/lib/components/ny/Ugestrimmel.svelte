<script lang="ts">
	// ============================================================
	// Ugestrimlen. Bruges baade paa forsiden og paa en enkelt dag, saa
	// striben ser ens ud og opfoerer sig ens de to steder.
	//
	// Ugen regnes ud fra den dag der er valgt, saa hun kan bladre bagud
	// uge for uge ved at trykke paa mandagen.
	// ============================================================

	import { datoNoegle } from '$lib/firestore/forside3';

	interface Props {
		/** Den dag der er fremhaevet. YYYY-MM-DD. */
		aktivDato: string;
		/** Datoer hvor hun har svaret paa noget. */
		aktiveDage: Set<string>;
		/** Dagens dato, saa fremtiden kan laases. */
		iDag: string;
	}

	let { aktivDato, aktiveDage, iDag }: Props = $props();

	const UGEDAGE = ['Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør', 'Søn'];

	const ugen = $derived.by(() => {
		const [aar, m, d] = aktivDato.split('-').map(Number);
		if (!aar) return [];
		const valgt = new Date(aar, m - 1, d);
		const mandag = new Date(valgt);
		// Soendag hoerer til den uge der lige er gaaet, ikke den der kommer.
		mandag.setDate(mandag.getDate() - ((mandag.getDay() + 6) % 7));

		return UGEDAGE.map((navn, i) => {
			const dt = new Date(mandag);
			dt.setDate(mandag.getDate() + i);
			const noegle = datoNoegle(dt);
			return {
				navn,
				dato: dt.getDate(),
				noegle,
				erValgt: noegle === aktivDato,
				erFremtid: noegle > iDag,
				harData: aktiveDage.has(noegle)
			};
		});
	});
</script>

<section class="uge">
	{#each ugen as dag (dag.noegle)}
		{#if dag.erFremtid}
			<div class="dag senere">
				<span class="u">{dag.navn}</span>
				<span class="d">{dag.dato}</span>
			</div>
		{:else}
			<a class="dag" class:idag={dag.erValgt} href={`/ny/dag/${dag.noegle}`}>
				<span class="u">{dag.navn}</span>
				<span class="d">{dag.dato}</span>
				{#if dag.harData}<span class="prik"></span>{/if}
			</a>
		{/if}
	{/each}
</section>
