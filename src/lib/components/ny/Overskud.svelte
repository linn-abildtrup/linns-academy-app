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
	import { holdNavn } from '$lib/content/udvikling3';

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

	const harPause = $derived(kurve.pauser.length > 0);
</script>

<section class="score">
	<div class="score-krop">
		<div class="score-k">Dit overskud</div>

		{#if kurve.seneste}
			<!-- Samme fordeling som paa Udvikling siden 18. august: overskrift
			     og plakat til venstre, tallet til hoejre. De to spalter bliver
			     lige hoeje, og kurven kan komme laengere op. Linns oenske. -->
			<div class="score-tal">
				<span class="score-venstre">
					{#if kurve.aendring !== 0}
						<span class="score-chip">
							{kurve.aendring > 0 ? '▲' : '▼'}
							{Math.abs(kurve.aendring).toString().replace('.', ',')} siden start
						</span>
					{/if}
				</span>
				<span class="score-hoejre">
					<span class="score-n">{kurve.seneste.vaerdi.toString().replace('.', ',')}</span>
					<span class="score-af">af 10</span>
				</span>
			</div>

			<div class="kurve">
				<!-- Maalene kommer fra kurve.flade, se FLADE_FORSIDE i
				     content/forside3.ts. Kortet blev gjort lavere 18. august,
				     fordi kurven fyldte for meget paa siden. Linns oenske. -->
				<svg
					viewBox="0 0 {kurve.flade.bredde} {kurve.flade.hoejde}"
					width="100%"
					height={kurve.flade.hoejde}
					role="img"
					aria-label={`Dit overskud fra ${formaterKortDato(kurve.foerste?.ms ?? nu, nu)} til ${formaterKortDato(kurve.seneste.ms, nu)}, ${kurve.foerste?.vaerdi} til ${kurve.seneste.vaerdi} af 10`}
				>
					<!-- Y-aksen. Den daekker hendes egne tal og runder ud til hele
					     tal, praecis som paa Udvikling. Se beregnAkse. -->
					{#if kurve.akse.midt !== null}
						{@const yMidt = (kurve.flade.yTop + kurve.flade.yBund) / 2}
						<line
							x1={kurve.flade.akseBredde}
							y1={kurve.flade.yTop}
							x2={kurve.flade.xHoejre}
							y2={kurve.flade.yTop}
							stroke="rgba(251,248,242,.16)"
							stroke-width="1"
						/>
						<line
							x1={kurve.flade.akseBredde}
							y1={yMidt}
							x2={kurve.flade.xHoejre}
							y2={yMidt}
							stroke="rgba(251,248,242,.12)"
							stroke-width="1"
							stroke-dasharray="2 3"
						/>
						<line
							x1={kurve.flade.akseBredde}
							y1={kurve.flade.yBund}
							x2={kurve.flade.xHoejre}
							y2={kurve.flade.yBund}
							stroke="rgba(251,248,242,.16)"
							stroke-width="1"
						/>
						<text class="v-akse" x={kurve.flade.akseBredde - 5} y={kurve.flade.yTop + 3}
							>{kurve.akse.hoej}</text
						>
						<text class="v-akse" x={kurve.flade.akseBredde - 5} y={yMidt + 3}
							>{kurve.akse.midt}</text
						>
						<text class="v-akse" x={kurve.flade.akseBredde - 5} y={kurve.flade.yBund + 3}
							>{kurve.akse.lav}</text
						>
					{/if}

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
						<!-- Navnet staar HVOR forloebet laa. Forklaringen under kortet
						     bliver derfor overfloedig, og en linje er sparet. -->
						{#if b.bredde >= 34}
							<text class="v-baand" x={b.x} y={kurve.flade.baandTekstY}>{holdNavn(b.navn)}</text>
						{/if}
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

					<!-- Fladen under linjen. En tynd streg i et stort kort ser tom
					     ud, en flade goer ikke. -->
					<defs>
						<linearGradient id="score-fyld" x1="0" y1="0" x2="0" y2="1">
							<stop offset="0%" stop-color="#d6a15e" stop-opacity="0.3" />
							<stop offset="100%" stop-color="#d6a15e" stop-opacity="0" />
						</linearGradient>
					</defs>
					{#each kurve.fyld as f, i (i)}
						<path d={f} fill="url(#score-fyld)" />
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

			<!-- Holdnavnene staar nu paa selve baandet, saa forklaringen er
			     overfloedig. Kun pausen er tilbage at forklare, for den kan man
			     ikke gaette sig til. -->
			{#if harPause}
				<div class="legende">
					<span><i class="sw pause"></i>Pause</span>
				</div>
			{/if}
		{:else}
			<p class="score-tom">
				Din første måling viser dig, hvor du står i dag. Derefter kan du følge din udvikling her.
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
