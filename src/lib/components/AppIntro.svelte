<script lang="ts">
	// Introen en ny kunde faar, foerste gang hun er logget ind.
	//
	// RAEKKEFOELGEN. Den kommer EFTER de tre spoergsmaal om hjemmeskaerm,
	// kettlebell og Facebook. Linns valg 29. august 2026. Hun har altsaa
	// svaret paa det praktiske, og saa faar hun at vide hvor hun er.
	//
	// INGEN SPRING OVER. Ogsaa Linns valg. Fire skaerme er kort nok til at
	// alle kan komme igennem, og den der springer over er praecis den der
	// bagefter ikke kan finde noget.
	//
	// ILLUSTRATIONERNE er tegnet af appens egne dele, ikke fotografier af
	// dem. Et skaermbillede bliver forkert i samme oejeblik vi aendrer en
	// skaerm, og et forkert billede er vaerre end ingen, fordi kunden tror
	// hun kigger forkert. Det her kan ikke blive forkert.

	import Icon from '$lib/components/Icon.svelte';

	let {
		faerdig,
		paaForlob = true
	}: {
		faerdig: () => void;
		/**
		 * Er hun paa et forloeb. 176 af kunderne har KUN et abonnement, og for
		 * dem ville "dit forloeb" pege paa noget der ikke findes paa hendes
		 * skaerm. Kun foerste skaerm er forskellig, resten passer til begge.
		 */
		paaForlob?: boolean;
	} = $props();

	let trin = $state(0);
	const ANTAL = 4;

	function videre() {
		if (trin < ANTAL - 1) trin += 1;
		else faerdig();
	}
</script>

<div class="intro-lag" role="dialog" aria-modal="true" aria-label="Kom godt i gang">
	<div class="intro-kort">
		<div class="intro-pips" aria-hidden="true">
			{#each Array(ANTAL) as _, i (i)}
				<i class:on={i <= trin}></i>
			{/each}
		</div>

		{#if trin === 0}
			<div class="ill">
				<div class="ill-dage">
					{#each ['Lør', 'Søn', 'Man', 'Tir', 'Ons'] as d, i (d)}
						<span class="ill-dag" class:nu={i === 0}>
							<span class="ill-dag-navn">{d}</span>
							<span class="ill-dag-nr">{i === 0 ? 'I dag' : `D${i}`}</span>
						</span>
					{/each}
				</div>
			</div>
			{#if paaForlob}
				<h2 class="intro-titel">Her er dit forløb, dag for dag</h2>
				<p class="intro-tekst">
					Appen åbner altid på i dag. Der ligger dagens lektion, din træning og de små skridt, du
					arbejder med lige nu. Du skal ikke lede efter noget.
				</p>
			{:else}
				<h2 class="intro-titel">Her er din dag, dag for dag</h2>
				<p class="intro-tekst">
					Appen åbner altid på i dag. Der ligger din træning, dine tal for maden og de små skridt,
					du arbejder med lige nu. Du skal ikke lede efter noget.
				</p>
			{/if}
		{:else if trin === 1}
			<div class="ill">
				<div class="ill-faner">
					{#each [{ n: 'Forside', i: 'home' }, { n: 'Moduler', i: 'grid' }, { n: 'Udvikling', i: 'leaf' }, { n: 'Beskeder', i: 'mail' }, { n: 'Profil', i: 'user' }] as f, i (f.n)}
						<span class="ill-fane" class:on={i === 0}>
							<Icon
								name={f.i as never}
								size={15}
								color={i === 0 ? 'var(--terra)' : 'var(--text3)'}
							/>
							<span>{f.n}</span>
						</span>
					{/each}
				</div>
			</div>
			<h2 class="intro-titel">Fem knapper i bunden</h2>
			<p class="intro-tekst">
				Forsiden er dagen i dag. Moduler er alt det andet: mad, træning og bibliotek. Udvikling er
				dine egne tal over tid. Beskeder er til mig. Profil er dine indstillinger.
			</p>
		{:else if trin === 2}
			<div class="ill">
				<div class="ill-liste">
					<span class="ill-rk"><span class="ill-ik"></span> Dagens lektion</span>
					<span class="ill-rk"><span class="ill-ik"></span> Træning</span>
					<span class="ill-rk"><span class="ill-ik sage"></span> Mad og dagens tal</span>
				</div>
			</div>
			<h2 class="intro-titel">En dag ad gangen</h2>
			<p class="intro-tekst">
				Nogle dage er der en video, andre dage en øvelse eller et lille skridt med maden. Du behøver
				ikke nå det hele. Det, der ligger på forsiden i dag, er nok.
			</p>
		{:else}
			<div class="ill">
				<div class="ill-side">
					<span class="ill-side-tekst">
						<span class="ill-side-eyebrow">Mad</span>
						<span class="ill-side-titel">30-30 beregner</span>
					</span>
					<span class="ill-i">i</span>
				</div>
			</div>
			<h2 class="intro-titel">I tvivl? Tryk på i'et</h2>
			<p class="intro-tekst">
				Øverst på hver side er der et lille i. Det forklarer præcis den side, du står på. Og har du
				et spørgsmål til mig, skriver du under Beskeder.
			</p>
		{/if}

		<button class="intro-knap" type="button" onclick={videre}>
			{trin === ANTAL - 1 ? 'Så er jeg klar' : 'Videre'}
		</button>
	</div>
</div>

<style>
	.intro-lag {
		position: fixed;
		inset: 0;
		z-index: 70;
		background: rgba(53, 35, 24, 0.35);
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 22px;
	}

	.intro-kort {
		width: 100%;
		max-width: 400px;
		background: var(--white);
		border-radius: var(--rl);
		padding: 18px 20px 20px;
		max-height: 90dvh;
		overflow-y: auto;
	}

	.intro-pips {
		display: flex;
		gap: 5px;
		margin-bottom: 18px;
	}

	.intro-pips i {
		height: 4px;
		flex: 1;
		border-radius: 99px;
		background: var(--border2);
	}

	.intro-pips i.on {
		background: var(--terra);
	}

	/* Illustrationerne. Tegnet af appens egne dele, se kommentaren oeverst. */
	.ill {
		background: var(--bg);
		border: 1px solid var(--border);
		border-radius: var(--r);
		padding: 13px;
		margin-bottom: 18px;
	}

	.ill-dage {
		display: flex;
		gap: 6px;
	}

	.ill-dag {
		flex: 1;
		text-align: center;
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 9px;
		padding: 7px 2px;
	}

	.ill-dag.nu {
		background: var(--terra);
		border-color: var(--terra);
	}

	.ill-dag-navn {
		display: block;
		font-size: calc(9px * var(--fs-scale, 1));
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--text3);
	}

	.ill-dag-nr {
		display: block;
		font-size: calc(10.5px * var(--fs-scale, 1));
		font-weight: 700;
		color: var(--text2);
		margin-top: 2px;
	}

	.ill-dag.nu .ill-dag-navn,
	.ill-dag.nu .ill-dag-nr {
		color: #fff;
	}

	.ill-faner {
		display: flex;
		gap: 5px;
	}

	.ill-fane {
		flex: 1;
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 9px;
		padding: 8px 2px;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 3px;
		font-size: calc(8.5px * var(--fs-scale, 1));
		color: var(--text3);
	}

	.ill-fane.on {
		border-color: var(--terra);
		color: var(--terra);
		font-weight: 700;
	}

	.ill-liste {
		display: flex;
		flex-direction: column;
		gap: 7px;
	}

	.ill-rk {
		display: flex;
		align-items: center;
		gap: 10px;
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 10px;
		padding: 10px 12px;
		font-size: calc(12.5px * var(--fs-scale, 1));
		color: var(--text);
	}

	.ill-ik {
		width: 24px;
		height: 24px;
		border-radius: 7px;
		background: var(--ic-rose);
		flex: none;
	}

	.ill-ik.sage {
		background: var(--ic-sage);
	}

	.ill-side {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 10px;
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 10px;
		padding: 11px 13px;
	}

	.ill-side-eyebrow {
		display: block;
		font-size: calc(9px * var(--fs-scale, 1));
		text-transform: uppercase;
		letter-spacing: 0.1em;
		font-weight: 700;
		color: var(--text3);
	}

	.ill-side-titel {
		display: block;
		font-family: var(--ff-d);
		font-size: calc(17px * var(--fs-scale, 1));
		color: var(--text);
		margin-top: 2px;
	}

	.ill-i {
		width: 30px;
		height: 30px;
		border-radius: 50%;
		background: var(--terra);
		color: #fff;
		font-family: var(--ff-d);
		font-weight: 700;
		font-size: calc(14px * var(--fs-scale, 1));
		display: flex;
		align-items: center;
		justify-content: center;
		flex: none;
		box-shadow: 0 0 0 5px var(--tdim);
	}

	.intro-titel {
		font-family: var(--ff-d);
		font-size: calc(21px * var(--fs-scale, 1));
		font-weight: 700;
		color: var(--text);
		line-height: 1.22;
		margin: 0 0 8px;
	}

	.intro-tekst {
		margin: 0 0 18px;
		font-family: var(--ff-b);
		font-size: calc(13.5px * var(--fs-scale, 1));
		color: var(--text2);
		line-height: 1.6;
	}

	.intro-knap {
		width: 100%;
		background: var(--terra);
		color: #fff;
		border: 0;
		border-radius: 12px;
		padding: 13px;
		font-family: var(--ff-b);
		font-weight: 700;
		font-size: calc(14.5px * var(--fs-scale, 1));
		cursor: pointer;
	}

	.intro-knap:focus-visible {
		outline: 2px solid var(--text);
		outline-offset: 2px;
	}
</style>
