<script lang="ts">
	// ============================================================
	// Profil i 3.0. Kun den del der har et hjem nu: hvem hun er, hvor
	// laenge hun har vaeret med, og de forloeb hun har gennemfoert.
	//
	// Diplomerne bor her, fordi de fyldte for meget i forsidens hoved.
	// Resten af siden bygges i etape 5, se SPEC-3.0.md afsnit 7.
	// ============================================================

	import { getContext, onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { signOut, type User } from 'firebase/auth';
	import { auth } from '$lib/firebase';
	import type { UserDoc } from '$lib/types';
	import { isAdmin } from '$lib/admin';
	import { formatMedlemstid, type Adgangsbillede } from '$lib/content/adgang3';
	import { byggForlobRaekker } from '$lib/content/lektionsliste3';
	import {
		rensUdstyr3,
		udstyrFra,
		udstyrTekst3,
		type TraeningKategori3
	} from '$lib/content/traeningKategori3';
	import { hentKategorier3 } from '$lib/firestore/traeningKategori3';
	import Sidehoved from '$lib/components/ny/Sidehoved.svelte';

	const hentUserDoc = getContext<() => UserDoc | null>('userDoc');
	const hentAdgang = getContext<() => Adgangsbillede>('adgang');
	const hentUser = getContext<() => User | null>('user');

	const userDoc = $derived(hentUserDoc());
	const adgang = $derived(hentAdgang());
	// Vejen ind i 3.0's admin. Kun for admin, saa ingen kunde ser den.
	const visAdmin = $derived(isAdmin(hentUser()));

	// "Sådan træner jeg" laa her indtil 19. august og flyttede til
	// Traening, hvor den hoerer hjemme. Derfor hentes traenings-
	// kategorierne ikke laengere paa den her side.

	// Uden navn staar der ingenting. Foer stod der "Din konto", men nu hedder
	// hele siden det samme, og saa ville ordene staa to gange lige under
	// hinanden. Linjen falder helt vaek i stedet.
	const navn = $derived([userDoc?.firstName, userDoc?.lastName].filter(Boolean).join(' '));
	const medlemstid = $derived(formatMedlemstid(adgang.medlemstidMs));

	// De 90 dage efter et forloeb. Se SPEC 35. Bruges kun til at skjule det
	// der ikke virker. Selve porten ligger i skallen.
	const hentTilstand = getContext<() => 'fuld' | 'bonus' | 'lukket'>('tilstand');
	const erBonus = $derived(hentTilstand() === 'bonus');

	// Ét forloeb pr raekke. Det der koerer oeverst med en ring om hvor langt
	// hun er, de gennemfoerte under med deres stjerne. Hele raekken foerer
	// ind til forloebets lektioner.
	// Bonussen bor paa kunden selv og ikke paa forloebet, saa den laeses
	// direkte af userDoc. Se HANDOVER-GAMMEL-APP: bonusPeriodEndsAt er
	// skriv-én-gang og forlaenges, men forkortes aldrig.
	// Log ud. Sender hende til 3.0's egen login-side og ikke til den gamle
	// apps. Fejler det, staar hun bare hvor hun er, og saa er hun stadig
	// logget ind. Det er det mindst forvirrende udfald.
	let logudGaar = $state(false);
	async function logUd() {
		if (logudGaar) return;
		logudGaar = true;
		try {
			await signOut(auth);
			await goto('/ny/login', { replaceState: true });
		} catch (e) {
			console.error('[ny] kunne ikke logge ud', e);
			logudGaar = false;
		}
	}

	const forlobRaekker = $derived(
		byggForlobRaekker(adgang.aktiveForlob, adgang.gennemfoerte, {
			harApp: adgang.harApp,
			bonusSlutMs: userDoc?.bonusPeriodEndsAt ?? null,
			nu: Date.now()
		})
	);
</script>

<div class="ny-pad profil-side">
	<Sidehoved titel="Din side" kant={false} />

	<section class="profil-hoved">
		<span class="linn-ava" role="img" aria-label={navn || 'Din side'}></span>
		<div>
			{#if navn}<div class="profil-navn">{navn}</div>{/if}
			{#if medlemstid}
				<span class="status medlem" style="margin-top:6px">
					<span class="prik" aria-hidden="true"></span>
					Medlem i {medlemstid}
				</span>
			{/if}
		</div>
	</section>

	{#if forlobRaekker.length}
		<section>
			<div class="lab"><h2>Dine lektioner</h2></div>
			<div class="diplom-liste">
				{#each forlobRaekker as r (r.forlobId)}
					<a
						class="diplom-stor forlob-raekke"
						class:igang={r.aktiv}
						class:lukket={r.adgang === 'lukket'}
						href={`/ny/lektioner/${r.forlobId}`}
					>
						{#if r.aktiv}
							<!-- Ringen viser hvor langt hun er. Den er pynt for oejet,
							     saa tallet staar i teksten ved siden af. -->
							<span
								class="forlob-ring"
								style={`--andel:${Math.round((r.fremgang ?? 0) * 100)}%`}
								aria-hidden="true"
							></span>
						{:else}
							<svg viewBox="0 0 24 24" aria-hidden="true">
								<path
									d="M12 2.6l2.7 5.8 6.3.8-4.6 4.4 1.2 6.2L12 16.7l-5.6 3.1 1.2-6.2L3 9.2l6.3-.8z"
								/>
							</svg>
						{/if}
						<div class="forlob-tekst">
							<div class="t">{r.navn}</div>
							<div class="s">{r.under}</div>
						</div>
						{#if r.aktiv}<span class="forlob-igang">I gang</span>{/if}
						<span class="forlob-pil" aria-hidden="true">›</span>
					</a>
				{/each}
			</div>
		</section>
	{/if}

	<!-- TO KORT OG IKKE TO TEKSTRAEKKER. Linns valg 20. august, model M1.
	     Raekkerne saa ud som indstillinger, og det her er indhold hun kan
	     gaa paa opdagelse i. Tallet staar med, fordi "130 opskrifter" er
	     en grund til at trykke og "med søgning" ikke er.

	     Farverne er appens egne: sand hoerer til mad, groen til traening.

	     Oevelserne skal vaere her og ikke kun under Traening. I de 90 dage
	     efter et forloeb har hun ikke traeningen, og saa er det her det
	     eneste sted hun kan slaa en oevelse op. Se SPEC 35. -->
	<section>
		<div class="lab"><h2>Materiale</h2></div>
		<div class="mat-par">
			<a class="mat-kort mad" href="/ny/profil/opskrifter">
				<span class="mat-i" aria-hidden="true">◠</span>
				<span class="mat-t">Opskrifter</span>
				<span class="mat-s">Søg blandt dem alle</span>
			</a>
			<a class="mat-kort trae" href="/ny/profil/oevelser">
				<span class="mat-i" aria-hidden="true">◈</span>
				<span class="mat-t">Øvelser</span>
				<span class="mat-s">Se hvordan de laves</span>
			</a>
		</div>
	</section>

	<!-- Opstarten hoerer til en kunde der er i gang. I de 90 dage ville de
	     to raekker sende hende tilbage hertil med det samme. -->
	{#if !erBonus}
		<section>
			<div class="lab"><h2>Opstart</h2></div>
			<a class="adm-raekke tr-raekke" href="/ny/velkommen?kun=gennemgang">
				<div class="adm-raekke-t"><span>Gennemgå appen</span></div>
				<div class="adm-raekke-s">Se gennemgangen igen</div>
			</a>
			<a class="adm-raekke tr-raekke" href="/ny/velkommen?igen=1">
				<div class="adm-raekke-t"><span>Kør opstarten igen</span></div>
				<div class="adm-raekke-s">Både spørgsmål og gennemgang</div>
			</a>
		</section>
	{/if}

	{#if visAdmin}
		<section>
			<div class="lab"><h2>Admin</h2></div>
			<a class="adm-raekke tr-raekke" href="/ny/admin">
				<div class="adm-raekke-t"><span>Værktøjerne i den nye app</span></div>
				<div class="adm-raekke-s">Træning, mad og challenges</div>
			</a>
		</section>
	{/if}

	{#if !erBonus}
		<p class="kort rolig">Resten af din profil kommer her. Siden er ikke bygget færdig endnu.</p>
	{/if}

	<section>
		<div class="lab"><h2>Konto</h2></div>
		<button class="adm-raekke tr-raekke logud" disabled={logudGaar} onclick={logUd}>
			<div class="adm-raekke-t"><span>{logudGaar ? 'Logger dig ud …' : 'Log ud'}</span></div>
			{#if userDoc?.email}
				<div class="adm-raekke-s">{userDoc.email}</div>
			{/if}
		</button>
	</section>
</div>
