<script lang="ts">
	// ============================================================
	// Dagens tal: protein og fiber mod hendes egne maal.
	//
	// Tallet staar stort, og til hoejre staar det ene hun faktisk skal
	// bruge: hvor meget der mangler. Det er forskellen paa et regneark og
	// en hjaelp. Hun skal kunne se paa to sekunder, om der skal et aeg
	// eller et helt maaltid til.
	//
	// Kalorier staar IKKE med som standard. Det er et bevidst valg i
	// designet. Har hun selv slaaet udvidet naering til, kommer de tre
	// med som en stille linje under, uden bjaelker: fem bjaelker goer
	// kortet til et regneark, og en bjaelke paa kalorier laeser som en
	// graense hun er ved at overskride. Linns valg 22. august.
	// ============================================================

	import type { DagensTal } from '$lib/firestore/forside3';

	interface Props {
		tal: DagensTal;
		/** Har hun selv slaaet kulhydrat, fedt og kalorier til. */
		visUdvidet?: boolean;
	}

	let { tal, visUdvidet = false }: Props = $props();

	const smaa = $derived([
		{ navn: 'Kulhydrat', vaerdi: tal.kh, maal: tal.khMaal, enhed: 'g' },
		{ navn: 'Fedt', vaerdi: tal.fedt, maal: tal.fedtMaal, enhed: 'g' },
		{ navn: 'Kalorier', vaerdi: tal.kcal, maal: tal.kcalMaal, enhed: '' }
	]);

	const linjer = $derived([
		{ navn: 'Protein', vaerdi: tal.protein, maal: tal.proteinMaal, farve: 'p' },
		{ navn: 'Fiber', vaerdi: tal.fiber, maal: tal.fiberMaal, farve: 'f' }
	]);

	const pct = (v: number, maal: number) =>
		maal > 0 ? Math.max(0, Math.min(100, Math.round((v / maal) * 100))) : 0;
</script>

<section>
	<!-- Ingen genvej her. "Åbn mad" pegede paa /ny/moduler og stod som en
	     ekstra vej ind i noget der allerede har sin egen fane forneden.
	     Fjernet paa Linns oenske 18. august om aftenen. -->
	<div class="lab">
		<h2>Dagens tal</h2>
	</div>
	<div class="kort">
		{#each linjer as l (l.navn)}
			{@const mangler = Math.max(0, Math.round(l.maal - l.vaerdi))}
			<div class="tal-blok">
				<div class="tal-raekke">
					<div>
						<div class="tal-navn">{l.navn}</div>
						<div class="tal-stort">
							{l.vaerdi}<span class="tal-af">af {l.maal} g</span>
						</div>
					</div>
					{#if mangler > 0}
						<div class="tal-mangler">{mangler} g igen</div>
					{:else}
						<div class="tal-mangler i-hus">I hus</div>
					{/if}
				</div>
				<div class="tal-spor">
					<div class="tal-fyld {l.farve}" style:width="{pct(l.vaerdi, l.maal)}%"></div>
				</div>
			</div>
		{/each}

		{#if visUdvidet}
			<div class="tal-tre">
				{#each smaa as t (t.navn)}
					<div>
						<div class="tal-tre-n">{t.navn}</div>
						<div class="tal-tre-v">{t.vaerdi}{t.enhed ? ` ${t.enhed}` : ''}</div>
						<div class="tal-tre-m">af {t.maal}</div>
					</div>
				{/each}
			</div>
		{/if}
	</div>
</section>
