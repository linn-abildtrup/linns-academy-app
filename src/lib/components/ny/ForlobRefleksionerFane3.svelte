<script lang="ts">
	// ============================================================
	// Refleksionen paa en forloebsdag, i det nye design.
	//
	// Linn 5. september 2026: "lav de to andre faner i det nye
	// design". Den gamle komponent bruges stadig af den gamle app og
	// er derfor uroert. Denne er en ny fil ved siden af.
	//
	// GEMME-LOGIKKEN ER LOEFTET ORDRET. Den vigtige detalje er, at
	// dagens checks hentes friske lige inden der gemmes: de styres af
	// Smaa skridt-systemet, og uden det ville et "Publicér" derovre
	// blive skrevet over her. Kun markup og stil er ny.
	// ============================================================
	import type { Bonus, VaneProgramDag } from '$lib/content/vaner';
	import { gemVaneprogramDag, hentVaneprogramDag } from '$lib/firestore/vaner';

	let { forlobId, dagNummer }: { forlobId: string; dagNummer: number } = $props();

	let dag = $state<VaneProgramDag | null>(null);
	let formReflection = $state('');
	let formUge = $state(1);
	let formIsCheckin = $state(false);
	let formIsBaseline = $state(false);
	let formIsWin = $state(false);
	let formBonus = $state<Bonus | null>(null);

	let loading = $state(true);
	let fejl = $state<string | null>(null);
	let gemmer = $state(false);
	let gemFejl = $state<string | null>(null);
	let gemKvit = $state(false);

	$effect(() => {
		const nr = dagNummer;
		indlaes(forlobId, nr);
	});

	async function indlaes(fid: string, nr: number) {
		loading = true;
		fejl = null;
		gemFejl = null;
		gemKvit = false;
		try {
			const fundet = await hentVaneprogramDag(fid, nr);
			if (!fundet) {
				dag = null;
				fejl = `Dag ${nr} findes ikke i refleksions-programmet.`;
				return;
			}
			dag = fundet;
			formReflection = fundet.reflection;
			formUge = fundet.uge;
			formIsCheckin = fundet.isCheckin;
			formIsBaseline = fundet.isBaseline;
			formIsWin = fundet.isWin;
			formBonus = fundet.bonus ? { ...fundet.bonus } : null;
		} catch (e) {
			console.error(e);
			fejl = 'Kunne ikke hente refleksionen.';
		} finally {
			loading = false;
		}
	}

	function aktiverBonus() {
		if (!formBonus) formBonus = { id: `b${dagNummer}`, label: '' };
	}

	function fjernBonus() {
		formBonus = null;
	}

	async function gem() {
		gemFejl = null;
		gemKvit = false;
		gemmer = true;
		try {
			// Bevar dagens checks. De styres af Smaa skridt-systemet, saa de
			// hentes friske her: ellers ville et samtidigt "Publicér" derovre
			// blive skrevet over.
			const nuvaerende = await hentVaneprogramDag(forlobId, dagNummer);
			const renseBonus =
				formBonus && formBonus.id.trim() && formBonus.label.trim()
					? { id: formBonus.id.trim(), label: formBonus.label.trim() }
					: null;

			const opdateret: VaneProgramDag = {
				dagNummer,
				uge: formUge,
				reflection: formReflection.trim(),
				checks: nuvaerende?.checks ?? dag?.checks ?? [],
				bonus: renseBonus,
				isCheckin: formIsCheckin,
				isBaseline: formIsBaseline,
				isWin: formIsWin
			};

			await gemVaneprogramDag(forlobId, opdateret);
			dag = opdateret;
			gemKvit = true;
			setTimeout(() => (gemKvit = false), 2000);
		} catch (e) {
			console.error(e);
			gemFejl = 'Kunne ikke gemme. Prøv igen.';
		} finally {
			gemmer = false;
		}
	}
</script>

{#if loading}
	<div class="besked">Henter refleksionen...</div>
{:else if fejl}
	<div class="besked fejl">{fejl}</div>
{:else if dag}
	<div class="spalter">
		<div class="blok">
			<div class="sp-t">Spørgsmålet</div>
			<label class="felt">
				<span class="felt-navn">Hvad skal kunden tænke over i dag</span>
				<textarea
					bind:value={formReflection}
					rows="5"
					disabled={gemmer}
					placeholder="Skriv spørgsmålet, som kunden ser det..."
				></textarea>
			</label>
			<p class="de-hjaelp">Står øverst på kundens udviklings-side den dag.</p>
		</div>

		<div class="blok">
			<div class="sp-t">Hvad slags dag er det</div>
			<label class="afkrydsning">
				<input type="checkbox" bind:checked={formIsCheckin} disabled={gemmer} />
				<span>
					<span class="felt-navn">Check-in dag</span>
					<span class="de-hjaelp">Kunden svarer på de fem spørgsmål med skydeknapper.</span>
				</span>
			</label>
			<label class="afkrydsning">
				<input type="checkbox" bind:checked={formIsBaseline} disabled={gemmer} />
				<span>
					<span class="felt-navn">Baseline-dag</span>
					<span class="de-hjaelp">Dagen før forløbet går i gang, altså dag 0.</span>
				</span>
			</label>
			<label class="afkrydsning">
				<input type="checkbox" bind:checked={formIsWin} disabled={gemmer} />
				<span>
					<span class="felt-navn">Wins-dag</span>
					<span class="de-hjaelp">Kunden bliver bedt om at få øje på det, der gik godt.</span>
				</span>
			</label>

			<label class="felt uge-felt">
				<span class="felt-navn">Uge</span>
				<input
					type="number"
					min="0"
					max="3"
					bind:value={formUge}
					disabled={gemmer || formIsBaseline}
				/>
			</label>

			<div class="sp-t bonus-t">Bonus-skridt (valgfri)</div>
			{#if formBonus}
				<div class="bonus">
					<label class="felt">
						<span class="felt-navn">Spørgsmål</span>
						<input
							type="text"
							placeholder="Bonus-spørgsmål"
							bind:value={formBonus.label}
							disabled={gemmer}
						/>
					</label>
					<label class="felt smal">
						<span class="felt-navn">Kendetegn</span>
						<input type="text" placeholder="id" bind:value={formBonus.id} disabled={gemmer} />
					</label>
					<button class="fjern" type="button" onclick={fjernBonus} disabled={gemmer}>
						Fjern bonus
					</button>
				</div>
				<p class="de-hjaelp">
					Kendetegnet er det navn systemet husker svaret under. Lad det stå, medmindre du ved
					hvorfor du ændrer det.
				</p>
			{:else}
				<button class="knap stiplet" type="button" onclick={aktiverBonus} disabled={gemmer}>
					+ Tilføj bonus
				</button>
			{/if}
		</div>
	</div>

	<div class="gem-bjaelke">
		<button class="knap fyldt" type="button" onclick={gem} disabled={gemmer}>
			{gemmer ? 'Gemmer...' : 'Gem refleksionen'}
		</button>
		{#if gemFejl}<span class="gem-fejl">{gemFejl}</span>{/if}
		{#if gemKvit}<span class="de-kvit">Gemt ✓</span>{/if}
	</div>
{/if}

<style>
	.spalter {
		display: flex;
		gap: 20px;
		align-items: flex-start;
	}

	.blok {
		flex: 1;
		min-width: 280px;
	}

	.sp-t {
		font-size: calc(10.5px * var(--fs-scale, 1));
		font-weight: 700;
		letter-spacing: 0.11em;
		text-transform: uppercase;
		color: var(--ink-3);
		margin-bottom: 10px;
	}

	.bonus-t {
		margin-top: 22px;
	}

	.besked {
		padding: 14px 16px;
		background: var(--paper-2);
		border-radius: 12px;
		color: var(--ink-2);
		font-size: calc(13px * var(--fs-scale, 1));
		text-align: center;
	}

	.besked.fejl {
		color: var(--ler-tekst);
		background: var(--ler-tint);
	}

	.felt {
		display: block;
		margin-bottom: 12px;
	}

	.felt-navn {
		display: block;
		font-size: calc(11px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--ink-2);
		margin-bottom: 4px;
	}

	.uge-felt {
		max-width: 110px;
		margin-top: 16px;
	}

	input[type='text'],
	input[type='number'],
	textarea {
		width: 100%;
		border: 1px solid var(--line);
		border-radius: 9px;
		padding: 9px 11px;
		font-size: calc(13.5px * var(--fs-scale, 1));
		font-family: inherit;
		color: var(--text);
		background: var(--paper-2);
	}

	textarea {
		resize: vertical;
	}

	input:disabled,
	textarea:disabled {
		opacity: 0.55;
	}

	.de-hjaelp {
		font-size: calc(11.5px * var(--fs-scale, 1));
		color: var(--ink-3);
		line-height: 1.5;
		margin: 0;
		max-width: 56ch;
	}

	.afkrydsning {
		display: flex;
		align-items: flex-start;
		gap: 9px;
		margin-bottom: 12px;
		cursor: pointer;
	}

	.afkrydsning input {
		margin-top: 3px;
		flex: none;
	}

	/* Teksten skal fylde resten af raekken. Uden det kryber den sammen. */
	.afkrydsning > span {
		flex: 1;
		min-width: 0;
	}

	.bonus {
		display: flex;
		gap: 11px;
		align-items: flex-end;
		flex-wrap: wrap;
	}

	.bonus .felt {
		flex: 1;
		min-width: 150px;
		margin-bottom: 0;
	}

	.bonus .felt.smal {
		flex: 0 0 130px;
		min-width: 0;
	}

	.fjern {
		border: none;
		background: transparent;
		font-family: inherit;
		font-size: calc(12px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--maerke);
		cursor: pointer;
		padding: 9px 0;
	}

	.knap {
		border: 1px solid var(--line);
		background: var(--white, #fff);
		border-radius: 10px;
		padding: 9px 16px;
		font-family: inherit;
		font-size: calc(13px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--ink-2);
		cursor: pointer;
	}

	.knap:disabled {
		opacity: 0.45;
		cursor: default;
	}

	.knap.stiplet {
		border-style: dashed;
		background: transparent;
	}

	.knap.fyldt {
		background: var(--plum);
		border-color: var(--plum);
		color: #fff;
		padding: 10px 30px;
	}

	.gem-bjaelke {
		display: flex;
		align-items: center;
		gap: 12px;
		flex-wrap: wrap;
		margin-top: 22px;
		padding-top: 16px;
		border-top: 1px solid var(--line);
	}

	.gem-fejl {
		font-size: calc(12.5px * var(--fs-scale, 1));
		color: var(--ler-tekst);
	}

	.de-kvit {
		font-size: calc(12.5px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--sage-tekst);
	}

	@media (max-width: 900px) {
		.spalter {
			flex-wrap: wrap;
		}
	}
</style>
