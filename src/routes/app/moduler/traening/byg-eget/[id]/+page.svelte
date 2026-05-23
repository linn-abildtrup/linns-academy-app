<script lang="ts">
	import { getContext, onMount } from 'svelte';
	import type { User } from 'firebase/auth';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import Icon from '$lib/components/Icon.svelte';
	import BekraeftModal from '$lib/components/BekraeftModal.svelte';
	import type { Exercise } from '$lib/content/mikrotraening';
	import { hentAlleExercises } from '$lib/firestore/mikrotraening';
	import {
		aktuelDag,
		anslaaetDagVarighedMin,
		anslaaetVarighedMinutter,
		STANDARD_OEVELSE,
		validerProgram,
		type CustomProgram,
		type CustomProgramOevelse
	} from '$lib/content/mineProgrammer';
	import {
		hentMitProgram,
		opdaterMitProgram,
		opretMitProgram,
		sletMitProgram
	} from '$lib/firestore/mineProgrammer';

	const getUser = getContext<() => User | null>('user');
	const user = $derived(getUser());

	const programId = $derived(page.params.id ?? '');
	const erNyt = $derived(programId === 'nyt');

	let navn = $state('');
	let oevelser = $state<CustomProgramOevelse[]>([]);
	let program = $state<CustomProgram | null>(null);
	let alleOevelser = $state<Exercise[]>([]);
	let indlaeser = $state(true);
	let gemmer = $state(false);
	let fejl = $state<string | null>(null);

	const flerdagesProgram = $derived.by(() => {
		if (!program) return null;
		const dage = program.dage;
		if (!dage || !Array.isArray(dage) || dage.length === 0) return null;
		return { program, dage };
	});
	const dagIDag = $derived(program ? aktuelDag(program) : 1);

	// Picker-modal state
	let pickerAaben = $state(false);
	let pickerSoeg = $state('');

	const filtreredeOevelser = $derived.by(() => {
		const q = pickerSoeg.trim().toLowerCase();
		const aktive = alleOevelser.filter((e) => e.aktiv);
		if (!q) return aktive;
		return aktive.filter(
			(e) =>
				e.name.toLowerCase().includes(q) ||
				e.catLabel.toLowerCase().includes(q) ||
				e.tags.some((t) => t.toLowerCase().includes(q))
		);
	});

	const anslaaetMin = $derived(anslaaetVarighedMinutter({ oevelser }));

	onMount(async () => {
		if (!user) return;
		try {
			alleOevelser = await hentAlleExercises();
			if (!erNyt) {
				const eksisterende = await hentMitProgram(user.uid, programId);
				if (eksisterende) {
					program = eksisterende;
					navn = eksisterende.navn;
					oevelser = eksisterende.oevelser;
					// Første gang programmet åbnes, sæt startetDato så vi kan
					// beregne 'I dag: Dag X' fremover. Sker kun for flerdages.
					if (
						eksisterende.dage &&
						eksisterende.dage.length > 0 &&
						!eksisterende.startetDato
					) {
						const idag = new Date();
						const yyyy = idag.getFullYear();
						const mm = String(idag.getMonth() + 1).padStart(2, '0');
						const dd = String(idag.getDate()).padStart(2, '0');
						const startetDato = `${yyyy}-${mm}-${dd}`;
						try {
							await opdaterMitProgram(user.uid, programId, { startetDato });
							program = { ...eksisterende, startetDato };
						} catch (e) {
							console.warn('Kunne ikke gemme startetDato:', e);
						}
					}
				} else {
					fejl = 'Programmet findes ikke.';
				}
			}
		} catch (e) {
			console.error(e);
			fejl = 'Kunne ikke hente data.';
		} finally {
			indlaeser = false;
		}
	});

	function aabnPicker() {
		pickerSoeg = '';
		pickerAaben = true;
	}

	function lukPicker() {
		pickerAaben = false;
	}

	function vaelgOevelse(e: Exercise) {
		oevelser = [...oevelser, { exerciseId: e.id, ...STANDARD_OEVELSE }];
		lukPicker();
	}

	function fjernOevelse(index: number) {
		oevelser = oevelser.filter((_, i) => i !== index);
	}

	function flytOp(index: number) {
		if (index === 0) return;
		const ny = [...oevelser];
		[ny[index - 1], ny[index]] = [ny[index], ny[index - 1]];
		oevelser = ny;
	}

	function flytNed(index: number) {
		if (index === oevelser.length - 1) return;
		const ny = [...oevelser];
		[ny[index], ny[index + 1]] = [ny[index + 1], ny[index]];
		oevelser = ny;
	}

	function oevelseNavn(exerciseId: string): string {
		return alleOevelser.find((e) => e.id === exerciseId)?.name ?? exerciseId;
	}

	async function gem() {
		if (!user || gemmer) return;
		const valideringsFejl = validerProgram({ navn, oevelser });
		if (valideringsFejl) {
			fejl = valideringsFejl;
			return;
		}
		gemmer = true;
		fejl = null;
		try {
			if (erNyt) {
				const ny = await opretMitProgram(user.uid, {
					navn: navn.trim(),
					oevelser
				});
				goto(`/app/moduler/traening/byg-eget/${ny.id}`, { replaceState: true });
			} else {
				await opdaterMitProgram(user.uid, programId, {
					navn: navn.trim(),
					oevelser
				});
				goto('/app/moduler/traening/byg-eget');
			}
		} catch (e) {
			console.error(e);
			fejl = 'Kunne ikke gemme programmet.';
		} finally {
			gemmer = false;
		}
	}

	let viserSletBekraeft = $state(false);
	function aabnSletBekraeft() {
		if (!user || gemmer || erNyt) return;
		viserSletBekraeft = true;
	}
	async function slet() {
		if (!user || gemmer || erNyt) return;
		viserSletBekraeft = false;
		gemmer = true;
		try {
			await sletMitProgram(user.uid, programId);
			goto('/app/moduler/traening/byg-eget');
		} catch (e) {
			console.error(e);
			fejl = 'Kunne ikke slette programmet.';
			gemmer = false;
		}
	}
</script>

<div class="page">
	<header class="page-header">
		<a class="back" href="/app/moduler/traening/byg-eget">
			<Icon name="arrow-l" size={14} color="var(--text2)" />
			<span>Mine programmer</span>
		</a>
		<div class="eyebrow">{flerdagesProgram ? 'Mit 14-dages program' : 'Custom-builder'}</div>
		<h1>{erNyt ? 'Nyt program' : navn || 'Rediger program'}</h1>
		{#if flerdagesProgram}
			<p class="page-sub">
				{flerdagesProgram.dage.length} dage · ca. {anslaaetDagVarighedMin(flerdagesProgram.dage[0])} min pr dag
			</p>
		{:else if oevelser.length > 0}
			<p class="page-sub">
				{oevelser.length} øvelse{oevelser.length === 1 ? '' : 'r'} · ca. {anslaaetMin} min
			</p>
		{/if}
	</header>

	{#if fejl}
		<div class="besked fejl">{fejl}</div>
	{/if}

	{#if indlaeser}
		<div class="besked">Henter…</div>
	{:else if flerdagesProgram}
		{@const dage = flerdagesProgram.dage}
		<!-- 14-dages read-only visning med dag-grid -->
		<section class="i-dag-kort">
			<div class="i-dag-label">I dag</div>
			<div class="i-dag-tal">Dag {dagIDag} af {dage.length}</div>
			<a
				class="start-knap"
				href={`/app/moduler/traening/byg-eget/${programId}/spil?dag=${dagIDag}`}
			>
				▶ Start dagens træning
			</a>
		</section>

		<section class="sektion">
			<div class="sektion-titel">Alle dage</div>
			<div class="dag-grid">
				{#each dage as d (d.dagNummer)}
					<a
						class="dag-celle"
						class:i-dag={d.dagNummer === dagIDag}
						href={`/app/moduler/traening/byg-eget/${programId}/spil?dag=${d.dagNummer}`}
					>
						<div class="dag-num">{d.dagNummer}</div>
						<div class="dag-meta">{d.oevelser.length} øv · {anslaaetDagVarighedMin(d)} min</div>
					</a>
				{/each}
			</div>
		</section>

		<button
			type="button"
			class="slet-knap"
			onclick={aabnSletBekraeft}
			disabled={gemmer}
		>
			Slet programmet
		</button>
	{:else}
		<label class="felt">
			<span class="felt-label">Navn på programmet</span>
			<input
				type="text"
				bind:value={navn}
				placeholder="Fx Ben & balder"
				maxlength="60"
				disabled={gemmer}
			/>
		</label>

		<section class="sektion">
			<div class="sektion-titel">Øvelser</div>

			{#if oevelser.length === 0}
				<div class="tom-tilstand">
					<p>Ingen øvelser endnu. Tilføj den første nedenfor.</p>
				</div>
			{:else}
				<div class="oevelse-liste">
					{#each oevelser as o, i (i)}
						<div class="oevelse-kort">
							<div class="oevelse-hoved">
								<div class="oevelse-navn">{oevelseNavn(o.exerciseId)}</div>
								<div class="oevelse-knapper">
									<button
										type="button"
										class="mini-knap"
										onclick={() => flytOp(i)}
										disabled={i === 0 || gemmer}
										aria-label="Flyt op"
										title="Flyt op"
									>
										↑
									</button>
									<button
										type="button"
										class="mini-knap"
										onclick={() => flytNed(i)}
										disabled={i === oevelser.length - 1 || gemmer}
										aria-label="Flyt ned"
										title="Flyt ned"
									>
										↓
									</button>
									<button
										type="button"
										class="mini-knap fjern"
										onclick={() => fjernOevelse(i)}
										disabled={gemmer}
										aria-label="Fjern øvelse"
										title="Fjern øvelse"
									>
										×
									</button>
								</div>
							</div>

							<div class="oevelse-felter">
								<label class="lille-felt">
									<span class="lille-felt-label">Sæt</span>
									<input
										type="number"
										min="1"
										max="20"
										bind:value={o.saet}
										disabled={gemmer}
									/>
								</label>
								<label class="lille-felt">
									<span class="lille-felt-label">Tid (sek)</span>
									<input
										type="number"
										min="5"
										max="600"
										step="5"
										bind:value={o.arbejdsSec}
										disabled={gemmer}
									/>
								</label>
								<label class="lille-felt">
									<span class="lille-felt-label">Pause (sek)</span>
									<input
										type="number"
										min="0"
										max="600"
										step="5"
										bind:value={o.pauseSec}
										disabled={gemmer}
									/>
								</label>
							</div>
						</div>
					{/each}
				</div>
			{/if}

			<button
				type="button"
				class="tilfoj-knap"
				onclick={aabnPicker}
				disabled={gemmer}
			>
				+ Tilføj øvelse
			</button>
		</section>

		<div class="bund-knapper">
			<button
				type="button"
				class="primary-knap"
				onclick={gem}
				disabled={gemmer || oevelser.length === 0 || !navn.trim()}
			>
				{gemmer ? 'Gemmer…' : erNyt ? 'Gem program' : 'Gem ændringer'}
			</button>
			{#if !erNyt}
				<button
					type="button"
					class="slet-knap"
					onclick={aabnSletBekraeft}
					disabled={gemmer}
				>
					Slet program
				</button>
			{/if}
		</div>
	{/if}
</div>

{#if pickerAaben}
	<div
		class="picker-overlay"
		role="button"
		tabindex="0"
		onclick={lukPicker}
		onkeydown={(e) => e.key === 'Escape' && lukPicker()}
	></div>
	<div class="picker-dialog" role="dialog" aria-modal="true" aria-labelledby="picker-titel">
		<header class="picker-head">
			<div class="form-titel" id="picker-titel">Vælg øvelse</div>
			<button class="ikon-knap" type="button" onclick={lukPicker} aria-label="Luk">×</button>
		</header>

		<input
			type="text"
			class="picker-soeg"
			bind:value={pickerSoeg}
			placeholder="Søg på navn, kategori eller tag…"
			autocomplete="off"
			autocapitalize="none"
			spellcheck="false"
		/>

		<div class="picker-liste">
			{#if filtreredeOevelser.length === 0}
				<div class="picker-tom">Ingen øvelser matcher søgningen.</div>
			{:else}
				{#each filtreredeOevelser as e (e.id)}
					<button
						type="button"
						class="picker-rad"
						onclick={() => vaelgOevelse(e)}
					>
						<div class="picker-tekst">
							<div class="picker-navn">{e.name}</div>
							<div class="picker-sub">
								{e.catLabel}{#if e.udstyr.length > 0 && !(e.udstyr.length === 1 && e.udstyr[0] === 'ingen')}
									 · {e.udstyr.filter((u) => u !== 'ingen').join(', ')}
								{/if}
							</div>
						</div>
						<Icon name="chevron-r" size={14} color="var(--text3)" />
					</button>
				{/each}
			{/if}
		</div>
	</div>
{/if}

{#if viserSletBekraeft}
	<BekraeftModal
		titel="Slet dette program?"
		beskrivelse="Programmet slettes permanent og kan ikke gendannes."
		bekraeftTekst="Slet"
		destruktiv
		arbejder={gemmer}
		onBekraeft={() => void slet()}
		onAnnuller={() => (viserSletBekraeft = false)}
	/>
{/if}

<style>
	.page {
		padding: 18px 18px 100px;
		max-width: 520px;
		margin: 0 auto;
	}

	.page-header {
		margin-bottom: 14px;
	}

	.back {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-size: calc(12px * var(--fs-scale, 1));
		color: var(--text2);
		text-decoration: none;
		margin-bottom: 12px;
	}

	.eyebrow {
		font-size: calc(10px * var(--fs-scale, 1));
		font-weight: 600;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--text3);
	}

	h1 {
		font-family: var(--ff-d);
		font-size: calc(24px * var(--fs-scale, 1));
		font-weight: 600;
		letter-spacing: -0.02em;
		margin: 4px 0 0;
		line-height: 1.05;
		color: var(--text);
	}

	.page-sub {
		font-size: calc(13px * var(--fs-scale, 1));
		color: var(--text2);
		margin: 6px 0 0;
	}

	.besked {
		padding: 12px 14px;
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 10px;
		font-size: calc(13px * var(--fs-scale, 1));
		color: var(--text2);
		text-align: center;
		margin-bottom: 12px;
	}

	.besked.fejl {
		background: #fbeeea;
		border-color: #f0d6cf;
		color: #8a4a3e;
	}

	.felt {
		display: flex;
		flex-direction: column;
		gap: 6px;
		margin-bottom: 18px;
	}

	.felt-label {
		font-size: calc(11px * var(--fs-scale, 1));
		font-weight: 600;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--text3);
	}

	.felt input {
		padding: 12px;
		font-size: calc(16px * var(--fs-scale, 1));
		border-radius: 10px;
		border: 1px solid var(--border);
		background: var(--bg2);
		color: var(--text);
		font-family: var(--ff-b);
		outline: none;
	}

	.felt input:focus {
		border-color: var(--terra);
	}

	.sektion {
		margin-bottom: 18px;
	}

	.sektion-titel {
		font-size: calc(13px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--text2);
		margin-bottom: 10px;
	}

	.tom-tilstand {
		background: var(--white);
		border: 1px dashed var(--border);
		border-radius: 10px;
		padding: 16px;
		text-align: center;
	}

	.tom-tilstand p {
		font-size: calc(13px * var(--fs-scale, 1));
		color: var(--text3);
		margin: 0;
	}

	.oevelse-liste {
		display: flex;
		flex-direction: column;
		gap: 8px;
		margin-bottom: 12px;
	}

	.oevelse-kort {
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 12px;
		padding: 14px;
	}

	.oevelse-hoved {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		margin-bottom: 12px;
	}

	.oevelse-navn {
		font-size: calc(14px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--text);
		flex: 1;
		min-width: 0;
	}

	.oevelse-knapper {
		display: flex;
		gap: 4px;
		flex-shrink: 0;
	}

	.mini-knap {
		width: 28px;
		height: 28px;
		border: 1px solid var(--border);
		background: var(--white);
		color: var(--text2);
		border-radius: 8px;
		font-size: calc(14px * var(--fs-scale, 1));
		cursor: pointer;
		font-family: var(--ff-b);
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.mini-knap:hover:not(:disabled) {
		background: var(--bg2);
	}

	.mini-knap.fjern {
		border-color: #e8c8c1;
		color: #b8503f;
	}

	.mini-knap.fjern:hover:not(:disabled) {
		background: #fbeeea;
	}

	.mini-knap:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.oevelse-felter {
		display: grid;
		grid-template-columns: 1fr 1fr 1fr;
		gap: 8px;
	}

	.lille-felt {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.lille-felt-label {
		font-size: calc(10.5px * var(--fs-scale, 1));
		font-weight: 600;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--text3);
	}

	.lille-felt input {
		padding: 8px 10px;
		font-size: calc(15px * var(--fs-scale, 1));
		border-radius: 8px;
		border: 1px solid var(--border);
		background: var(--bg2);
		color: var(--text);
		font-family: var(--ff-b);
		outline: none;
		min-width: 0;
		width: 100%;
		box-sizing: border-box;
	}

	.lille-felt input:focus {
		border-color: var(--terra);
	}

	.tilfoj-knap {
		display: block;
		width: 100%;
		padding: 12px;
		font-size: calc(13px * var(--fs-scale, 1));
		font-weight: 600;
		border-radius: 10px;
		border: 1px dashed var(--terra);
		background: var(--tdim);
		color: var(--terra);
		cursor: pointer;
		font-family: var(--ff-b);
	}

	.tilfoj-knap:hover:not(:disabled) {
		background: var(--white);
	}

	.tilfoj-knap:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.bund-knapper {
		display: flex;
		flex-direction: column;
		gap: 8px;
		margin-top: 20px;
	}

	.primary-knap {
		display: block;
		width: 100%;
		padding: 14px;
		background: var(--terra);
		color: white;
		border: none;
		border-radius: 12px;
		font-size: calc(14px * var(--fs-scale, 1));
		font-weight: 600;
		cursor: pointer;
		font-family: var(--ff-b);
	}

	.primary-knap:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.slet-knap {
		display: block;
		width: 100%;
		padding: 12px;
		background: transparent;
		color: #b8503f;
		border: 1px solid #e8c8c1;
		border-radius: 10px;
		font-size: calc(13px * var(--fs-scale, 1));
		font-weight: 500;
		cursor: pointer;
		font-family: var(--ff-b);
	}

	.slet-knap:hover:not(:disabled) {
		background: #fbeeea;
	}

	.slet-knap:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	/* 14-dages visning */
	.i-dag-kort {
		background: linear-gradient(135deg, var(--terra) 0%, #a06b60 100%);
		color: #fff;
		border-radius: 14px;
		padding: 18px 20px;
		margin-bottom: 16px;
		text-align: center;
		box-shadow: 0 4px 16px rgba(184, 123, 110, 0.25);
	}

	.i-dag-label {
		font-size: calc(11px * var(--fs-scale, 1));
		font-weight: 600;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		opacity: 0.85;
	}

	.i-dag-tal {
		font-family: var(--ff-d);
		font-size: calc(26px * var(--fs-scale, 1));
		font-weight: 600;
		margin: 4px 0 14px;
	}

	.start-knap {
		display: inline-block;
		padding: 12px 22px;
		background: #fff;
		color: var(--terra);
		border-radius: 99px;
		font-weight: 700;
		text-decoration: none;
		font-size: calc(14px * var(--fs-scale, 1));
	}

	.start-knap:hover {
		opacity: 0.92;
	}

	.dag-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(78px, 1fr));
		gap: 8px;
	}

	.dag-celle {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 4px;
		padding: 10px 6px;
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 10px;
		text-decoration: none;
		color: inherit;
	}

	.dag-celle:hover {
		border-color: var(--terra);
	}

	.dag-celle.i-dag {
		background: var(--terra);
		border-color: var(--terra);
		color: #fff;
	}

	.dag-num {
		font-family: var(--ff-d);
		font-size: calc(17px * var(--fs-scale, 1));
		font-weight: 600;
	}

	.dag-meta {
		font-size: calc(10.5px * var(--fs-scale, 1));
		opacity: 0.8;
		font-variant-numeric: tabular-nums;
	}

	/* Picker modal */
	.picker-overlay {
		position: fixed;
		inset: 0;
		background: rgba(20, 14, 18, 0.7);
		z-index: 60;
		border: none;
	}

	.picker-dialog {
		position: fixed;
		left: 50%;
		top: 50%;
		transform: translate(-50%, -50%);
		background: var(--white);
		border-radius: 16px;
		width: calc(100% - 24px);
		max-width: 520px;
		max-height: 80vh;
		display: flex;
		flex-direction: column;
		padding: 16px;
		gap: 12px;
		z-index: 61;
		box-shadow: 0 20px 50px rgba(0, 0, 0, 0.3);
	}

	.picker-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.form-titel {
		font-family: var(--ff-d);
		font-size: calc(18px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--text);
	}

	.ikon-knap {
		width: 32px;
		height: 32px;
		border-radius: 999px;
		border: 1px solid var(--border);
		background: var(--white);
		color: var(--text2);
		font-size: calc(18px * var(--fs-scale, 1));
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.picker-soeg {
		padding: 10px 12px;
		font-size: calc(16px * var(--fs-scale, 1));
		border-radius: 10px;
		border: 1px solid var(--border);
		background: var(--bg2);
		color: var(--text);
		font-family: var(--ff-b);
		outline: none;
	}

	.picker-soeg:focus {
		border-color: var(--terra);
	}

	.picker-liste {
		overflow-y: auto;
		border: 1px solid var(--border);
		border-radius: 10px;
		flex: 1;
	}

	.picker-rad {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 10px 12px;
		width: 100%;
		background: var(--white);
		border: none;
		border-top: 1px solid var(--border);
		text-align: left;
		cursor: pointer;
		color: inherit;
		font-family: var(--ff-b);
	}

	.picker-rad:first-child {
		border-top: none;
	}

	.picker-rad:hover {
		background: var(--bg2);
	}

	.picker-tekst {
		flex: 1;
		min-width: 0;
	}

	.picker-navn {
		font-size: calc(14px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--text);
	}

	.picker-sub {
		font-size: calc(11.5px * var(--fs-scale, 1));
		color: var(--text3);
		margin-top: 2px;
	}

	.picker-tom {
		padding: 30px 16px;
		text-align: center;
		color: var(--text3);
		font-size: calc(13px * var(--fs-scale, 1));
	}
</style>
