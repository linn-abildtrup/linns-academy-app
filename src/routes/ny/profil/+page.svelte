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

	const hentUserDoc = getContext<() => UserDoc | null>('userDoc');
	const hentAdgang = getContext<() => Adgangsbillede>('adgang');
	const hentUser = getContext<() => User | null>('user');

	const userDoc = $derived(hentUserDoc());
	const adgang = $derived(hentAdgang());
	// Vejen ind i 3.0's admin. Kun for admin, saa ingen kunde ser den.
	const visAdmin = $derived(isAdmin(hentUser()));

	// Kategorierne hentes for at kunne skrive hendes valg med ord. Fejler
	// det, staar der bare ingenting paa linjen. Profilen skal ikke gaa i
	// staa fordi en undertekst ikke kunne hentes.
	let kategorier = $state<TraeningKategori3[]>([]);
	const udstyrTekst = $derived(
		kategorier.length === 0
			? 'Vælg det udstyr du har'
			: udstyrTekst3(rensUdstyr3(udstyrFra(userDoc), kategorier), kategorier)
	);

	onMount(async () => {
		try {
			kategorier = await hentKategorier3();
		} catch (e) {
			console.warn('[ny] kunne ikke hente traeningskategorier', e);
		}
	});

	// Uden navn staar der ingenting. Foer stod der "Din konto", men nu hedder
	// hele siden det samme, og saa ville ordene staa to gange lige under
	// hinanden. Linjen falder helt vaek i stedet.
	const navn = $derived([userDoc?.firstName, userDoc?.lastName].filter(Boolean).join(' '));
	const medlemstid = $derived(formatMedlemstid(adgang.medlemstidMs));

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
	<header class="side-top" style="padding-left:0;padding-right:0">
		<h1>Din side</h1>
	</header>

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

	<section>
		<div class="lab"><h2>Træning</h2></div>
		<a class="adm-raekke tr-raekke" href="/ny/profil/traening">
			<div class="adm-raekke-t"><span>Sådan træner jeg</span></div>
			<div class="adm-raekke-s">{udstyrTekst}</div>
		</a>
	</section>

	{#if visAdmin}
		<section>
			<div class="lab"><h2>Admin</h2></div>
			<a class="adm-raekke tr-raekke" href="/ny/admin">
				<div class="adm-raekke-t"><span>Værktøjerne i den nye app</span></div>
				<div class="adm-raekke-s">Træning, mad og challenges</div>
			</a>
		</section>
	{/if}

	<p class="kort rolig">Resten af din profil kommer her. Siden er ikke bygget færdig endnu.</p>

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
