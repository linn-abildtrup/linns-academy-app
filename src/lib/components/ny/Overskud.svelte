<script lang="ts">
	// ============================================================
	// "Dit overskud" paa forsiden i 3.0.
	//
	// Kurven gaar altid fra foerste maaling til den nyeste. Perioder med
	// forloeb faar et lyst felt og en farvet streg, og en pause tegnes som
	// et hul. Er maalingen aaben, ligger baandet nederst paa kortet.
	//
	// Al geometri kommer fra content/forside3.ts. Komponenten tegner kun.
	// ============================================================

	import { formaterKortDato, type Kurve, type MaalingStatus } from '$lib/content/forside3';

	interface Props {
		kurve: Kurve;
		status: MaalingStatus;
		nu: number;
	}

	let { kurve, status, nu }: Props = $props();

	// Farve pr forloebstype, saa Kickstart og Kropsro kan skelnes.
	const FARVER: Record<string, string> = {
		kickstart: '#86a188',
		kropsro: '#d49ab0'
	};
	const farveFor = (produkt: string) => FARVER[produkt] ?? '#c9b7d6';

	// Navnene under kurven. Samme forloeb to gange (fx to Kickstart-hold)
	// skal kun staa én gang i forklaringen.
	const forklaring = $derived.by(() => {
		const set = new Map<string, string>();
		for (const b of kurve.baand) if (!set.has(b.navn)) set.set(b.navn, b.produkt);
		return [...set].map(([navn, produkt]) => ({ navn, produkt }));
	});

	const harPause = $derived(kurve.pauser.length > 0);
</script>

<section class="score">
	<div class="score-krop">
		<div class="score-k">Dit overskud</div>

		{#if kurve.seneste}
			<div class="score-tal">
				<span class="score-n">{kurve.seneste.vaerdi.toString().replace('.', ',')}</span>
				<span class="score-af">af 10</span>
				{#if kurve.aendring !== 0}
					<span class="score-chip">
						{kurve.aendring > 0 ? '▲' : '▼'}
						{Math.abs(kurve.aendring).toString().replace('.', ',')} siden start
					</span>
				{/if}
			</div>

			<div class="kurve">
				<!-- Maalene kommer fra kurve.flade, se FLADE_FORSIDE i
				     content/forside3.ts. Kortet blev gjort lavere 18. august,
				     fordi kurven fyldte for meget paa siden. Linns oenske. -->
				<svg viewBox="0 0 {kurve.flade.bredde} {kurve.flade.hoejde}" width="100%" height={kurve.flade.hoejde} role="img" aria-label={`Dit overskud fra ${formaterKortDato(kurve.foerste?.ms ?? nu, nu)} til ${formaterKortDato(kurve.seneste.ms, nu)}, ${kurve.foerste?.vaerdi} til ${kurve.seneste.vaerdi} af 10`}>
					{#each kurve.baand as b (b.fraMs + b.navn)}
						<rect
							x={b.x}
							y={kurve.flade.baandTop}
							width={b.bredde}
							height={kurve.flade.baandHoejde}
							rx="5"
							fill="rgba(251,248,242,.09)"
						/>
						<rect
							x={b.x}
							y={kurve.flade.baandStregY}
							width={b.bredde}
							height={kurve.flade.baandStregHoejde}
							rx="1.5"
							fill={farveFor(b.produkt)}
						/>
					{/each}

					{#each kurve.pauser as p, i (i)}
						<rect
							x={p.x}
							y={kurve.flade.baandStregY}
							width={p.bredde}
							height={kurve.flade.baandStregHoejde}
							rx="1.5"
							fill="rgba(251,248,242,.22)"
						/>
					{/each}

					{#each kurve.huller as h, i (i)}
						<path
							d={h}
							fill="none"
							stroke="rgba(251,248,242,.32)"
							stroke-width="2"
							stroke-linecap="round"
							stroke-dasharray="3 5"
						/>
					{/each}

					{#each kurve.stier as s, i (i)}
						<path
							d={s}
							fill="none"
							stroke="#d6a15e"
							stroke-width="2.5"
							stroke-linecap="round"
							stroke-linejoin="round"
						/>
					{/each}

					{#each kurve.punkter as p, i (p.ms)}
						{#if p.visPrik}
							<circle
								cx={p.x}
								cy={p.y}
								r={p.erSidste ? 5.2 : 3.4}
								fill={p.erSidste ? '#d6a15e' : 'rgba(251,248,242,.5)'}
								stroke={p.erSidste ? '#5e3a4b' : 'none'}
								stroke-width={p.erSidste ? 2 : 0}
							/>
						{/if}
						{#if p.visTal}
							<text
								class="v-tal"
								class:nu={p.erSidste}
								x={p.x}
								y={p.y - (p.erSidste ? 9 : 8)}
								text-anchor={p.erSidste ? 'end' : i === 0 ? 'start' : 'middle'}
							>
								{p.vaerdi.toString().replace('.', ',')}
							</text>
						{/if}
						{#if p.visDato}
							<text
								class="v-lab"
								x={p.x}
								y={kurve.flade.datoY}
								text-anchor={p.erSidste ? 'end' : i === 0 ? 'start' : 'middle'}
							>
								{formaterKortDato(p.ms, nu)}
							</text>
						{/if}
					{/each}
				</svg>
			</div>

			{#if forklaring.length || harPause}
				<div class="legende">
					{#each forklaring as f (f.navn)}
						<span><i class="sw" style:background={farveFor(f.produkt)}></i>{f.navn}</span>
					{/each}
					{#if harPause}
						<span><i class="sw pause"></i>Pause</span>
					{/if}
				</div>
			{/if}
		{:else}
			<p class="score-tom">
				Din første måling viser dig, hvor du står i dag. Derefter kan du følge din udvikling
				her.
			</p>
		{/if}
	</div>

	{#if status.erAaben}
		<a class="maaling" href="/ny/maaling">
			<span class="ic" aria-hidden="true">✿</span>
			<span class="maaling-tekst">
				<span class="mk">Åben nu</span>
				<span class="mt">{kurve.seneste ? 'Tid til din måling' : 'Tag din første måling'}</span>
			</span>
			<span class="pil" aria-hidden="true">›</span>
		</a>
	{:else}
		<div class="naeste">{status.tekst}</div>
	{/if}
</section>
