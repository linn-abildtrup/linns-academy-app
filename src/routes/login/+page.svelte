<script lang="ts">
	import { goto } from '$app/navigation';
	import {
		createUserWithEmailAndPassword,
		signInWithEmailAndPassword,
		signOut,
		sendPasswordResetEmail,
		onAuthStateChanged,
		type User
	} from 'firebase/auth';
	import { auth } from '$lib/firebase';
	import { createUserDoc } from '$lib/userDoc';
	import Button from '$lib/components/Button.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import Logo from '$lib/components/Logo.svelte';
	import { normaliserEmail, seromEmailUd, type OpslagSvar } from '$lib/content/loginOpslag';

	// To skaerme for kunden: hun skriver sin email, og vi viser den udgave af
	// skaerm 2 der passer til hende. Hun skal ikke selv vaelge mellem "log ind"
	// og "opret konto" — det valg var det, der drillede mest for nye kunder,
	// fordi en der lige har betalt foeler at hun HAR en konto.
	type View = 'email' | 'nyKunde' | 'harKonto' | 'intetKoeb' | 'reset';

	let view = $state<View>('email');
	let email = $state('');
	let password = $state('');
	let error = $state('');
	let loading = $state(false);
	let user = $state<User | null>(null);
	// Navnet paa det hun har koebt ("Kickstart August 2026"). Vises som
	// kvittering paa skaerm 2, saa hun kan se at koebet er naaet frem.
	let koebNavn = $state<string | undefined>(undefined);

	// Maps Firebase Auth fejl-koder til paedagogiske danske beskeder.
	// Default er 'Noget gik galt' hvis koden ikke kendes.
	const FIREBASE_FEJL_TEKSTER: Record<string, string> = {
		'auth/wrong-password': 'Forkert adgangskode.',
		'auth/invalid-credential': 'Forkert adgangskode.',
		'auth/invalid-login-credentials': 'Forkert adgangskode.',
		'auth/user-not-found':
			'Vi kan ikke finde en konto med denne email. Tjek stavemåden, eller gå tilbage og prøv en anden.',
		'auth/invalid-email': 'Email-adressen ser ikke ud til at være gyldig.',
		'auth/missing-password': 'Skriv din adgangskode.',
		'auth/too-many-requests': 'Du har prøvet for mange gange. Vent et par minutter og prøv igen.',
		'auth/user-disabled': 'Din konto er deaktiveret. Skriv til kontakt@linnsacademy.dk.',
		'auth/network-request-failed': 'Kunne ikke komme på nettet. Tjek din forbindelse og prøv igen.',
		'auth/email-already-in-use':
			'Der findes allerede en konto med denne email. Gå tilbage og skriv emailen igen, så logger vi dig ind.',
		'auth/weak-password': 'Adgangskoden er for kort. Vælg mindst 6 tegn.',
		'auth/operation-not-allowed':
			'Login-metoden er ikke aktiveret. Skriv til kontakt@linnsacademy.dk.'
	};

	function oversaetFejl(e: unknown): string {
		if (e && typeof e === 'object' && 'code' in e) {
			const code = (e as { code: string }).code;
			if (code in FIREBASE_FEJL_TEKSTER) return FIREBASE_FEJL_TEKSTER[code];
		}
		return 'Noget gik galt. Prøv igen.';
	}
	let resetSendt = $state(false);

	onAuthStateChanged(auth, (u) => {
		user = u;
	});

	/**
	 * Skaerm 1: slaa emailen op og gaa videre til den rigtige udgave af
	 * skaerm 2. Selve opslaget sker paa serveren — koebslisten kan med vilje
	 * ikke laeses foer man er logget ind.
	 */
	async function handleEmailSubmit() {
		error = '';
		const e = normaliserEmail(email);
		if (!seromEmailUd(e)) {
			error = 'Email-adressen ser ikke ud til at være gyldig.';
			return;
		}
		loading = true;
		try {
			const res = await fetch('/api/login-opslag', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email: e })
			});
			if (!res.ok) {
				const data = (await res.json().catch(() => null)) as { message?: string } | null;
				error = data?.message ?? 'Vi kunne ikke slå din email op lige nu. Prøv igen om lidt.';
				return;
			}
			const svar = (await res.json()) as OpslagSvar;
			email = e;
			koebNavn = svar.koebNavn;
			password = '';
			view = svar.udfald;
		} catch {
			error = 'Kunne ikke komme på nettet. Tjek din forbindelse og prøv igen.';
		} finally {
			loading = false;
		}
	}

	/**
	 * Skaerm 2, udgave A: koebet er fundet, og hun vaelger selv sin
	 * adgangskode. Vi opretter foerst kontoen her — altsaa EFTER at koebet er
	 * bekraeftet. Tidligere skete det omvendt, saa en forkert email lavede en
	 * konto der straks blev slettet igen.
	 */
	async function handleOpret() {
		error = '';
		if (password.length < 6) {
			error = 'Adgangskoden er for kort. Vælg mindst 6 tegn.';
			return;
		}
		loading = true;
		try {
			const cred = await createUserWithEmailAndPassword(auth, email, password);
			await createUserDoc(cred.user.uid, cred.user.email ?? email);
			await goto('/');
		} catch (e) {
			error = oversaetFejl(e);
		} finally {
			loading = false;
		}
	}

	/** Skaerm 2, udgave B: kontoen findes — almindeligt login. */
	async function handleLogIn() {
		error = '';
		loading = true;
		try {
			await signInWithEmailAndPassword(auth, email, password);
			await goto('/');
		} catch (e) {
			error = oversaetFejl(e);
		} finally {
			loading = false;
		}
	}

	async function handleLogout() {
		await signOut(auth);
		email = '';
		password = '';
	}

	/** Tilbage til skaerm 1. Adgangskoden ryddes, emailen bliver staaende. */
	function goBack() {
		view = 'email';
		error = '';
		password = '';
		koebNavn = undefined;
		resetSendt = false;
	}

	async function handleResetSubmit() {
		error = '';
		if (!email.trim()) {
			error = 'Indtast din email-adresse.';
			return;
		}
		loading = true;
		try {
			await sendPasswordResetEmail(auth, email.trim());
			resetSendt = true;
		} catch (e) {
			// For privatlivets skyld viser vi samme besked uanset om email findes
			// eller ej — så uvedkommende ikke kan teste om en bestemt email er
			// registreret.
			console.warn('Reset-fejl:', e);
			resetSendt = true;
		} finally {
			loading = false;
		}
	}
</script>

<div class="surface">
	{#if user}
		<div class="logged-in-screen">
			<div class="logged-in-card">
				<p class="hello">Du er logget ind som</p>
				<p class="email">{user.email}</p>
				<div class="actions">
					<Button variant="primary" size="lg" full onclick={() => goto('/')}>
						Fortsæt til appen
					</Button>
					<Button variant="ghost" size="lg" full onclick={handleLogout}>Log ud</Button>
				</div>
			</div>
		</div>
	{:else if view === 'email'}
		<!-- Skærm 1: den samme for alle. Ét felt, ingen valg at ramme forkert. -->
		<div class="form-screen">
			<div class="velkomst-top">
				<Logo size="lg" />
				<p class="tagline">Et roligt rum til mikrotræning, refleksion og kvinders sundhed.</p>
			</div>

			<div class="form-content">
				<div class="form-header">
					<h2 class="form-title">Velkommen</h2>
					<p class="form-sub">Skriv den email, du købte med. Så finder vi resten.</p>
				</div>

				<div class="form">
					<label class="field">
						<span class="label">Email</span>
						<input
							type="email"
							bind:value={email}
							placeholder="dig@eksempel.dk"
							autocomplete="email"
							onkeydown={(e) => e.key === 'Enter' && handleEmailSubmit()}
						/>
					</label>

					{#if error}
						<p class="error">{error}</p>
					{/if}

					<Button variant="primary" size="lg" full onclick={handleEmailSubmit}>
						{loading ? 'Vent...' : 'Fortsæt'}
					</Button>
				</div>
			</div>

			<p class="hjaelp-linje">
				Problemer? Skriv til <a href="mailto:kontakt@linnsacademy.dk">kontakt@linnsacademy.dk</a>
			</p>
		</div>
	{:else if view === 'nyKunde'}
		<!-- Skærm 2 A: købet er fundet, hun vælger selv en adgangskode. -->
		<div class="form-screen">
			<button class="back-btn" onclick={goBack} aria-label="Tilbage">
				<Icon name="arrow-l" size={20} color="var(--text)" />
			</button>

			<div class="form-content">
				<div class="form-header">
					<h2 class="form-title">Vi fandt dit køb</h2>
					<p class="form-sub">Sidste skridt: vælg en adgangskode, så er du inde.</p>
				</div>

				<div class="form">
					<div class="kvittering">
						<span class="kvittering-ikon">
							<Icon name="check" size={16} color="var(--sage)" />
						</span>
						<span class="kvittering-tekst">
							{#if koebNavn}
								<span class="kvittering-titel">{koebNavn}</span>
							{/if}
							<span class="kvittering-email">{email}</span>
						</span>
					</div>

					<label class="field">
						<span class="label">Vælg en adgangskode</span>
						<input
							type="password"
							bind:value={password}
							placeholder="Mindst 6 tegn"
							autocomplete="new-password"
							onkeydown={(e) => e.key === 'Enter' && handleOpret()}
						/>
						<span class="felt-hjaelp">
							Find selv på en. Du har ikke fået tilsendt et kodeord — og du skal bruge den næste
							gang, du logger ind.
						</span>
					</label>

					{#if error}
						<p class="error">{error}</p>
					{/if}

					<Button variant="primary" size="lg" full onclick={handleOpret}>
						{loading ? 'Vent...' : 'Kom i gang'}
					</Button>
				</div>
			</div>

			<p class="hjaelp-linje">
				Forkert email? <button class="tekst-link" onclick={goBack}>Gå tilbage</button>
			</p>
		</div>
	{:else if view === 'harKonto'}
		<!-- Skærm 2 B: kontoen findes. Vi viser kun emailen, aldrig navnet —
		     så skærmen ikke røber mere om en fremmed end nødvendigt. -->
		<div class="form-screen">
			<button class="back-btn" onclick={goBack} aria-label="Tilbage">
				<Icon name="arrow-l" size={20} color="var(--text)" />
			</button>

			<div class="form-content">
				<div class="form-header">
					<h2 class="form-title">Velkommen tilbage</h2>
					<p class="form-sub">Skriv din adgangskode, så er du inde.</p>
				</div>

				<div class="form">
					<div class="kvittering">
						<span class="kvittering-ikon rose">
							<Icon name="user" size={16} color="var(--terra)" />
						</span>
						<span class="kvittering-tekst">
							<span class="kvittering-email stor">{email}</span>
						</span>
					</div>

					<label class="field">
						<span class="label">Adgangskode</span>
						<input
							type="password"
							bind:value={password}
							placeholder="Din adgangskode"
							autocomplete="current-password"
							onkeydown={(e) => e.key === 'Enter' && handleLogIn()}
						/>
					</label>

					{#if error}
						<p class="error">{error}</p>
					{/if}

					<Button variant="primary" size="lg" full onclick={handleLogIn}>
						{loading ? 'Vent...' : 'Log ind'}
					</Button>

					<button
						class="glemt-link"
						type="button"
						onclick={() => {
							view = 'reset';
							password = '';
							error = '';
						}}
					>
						Glemt adgangskode?
					</button>
				</div>
			</div>

			<p class="hjaelp-linje">
				Ikke dig? <button class="tekst-link" onclick={goBack}>Gå tilbage</button>
			</p>
		</div>
	{:else if view === 'intetKoeb'}
		<!-- Skærm 2 C: intet køb på emailen. Der er ikke oprettet nogen konto,
		     så hun kan bare prøve igen. -->
		<div class="form-screen">
			<button class="back-btn" onclick={goBack} aria-label="Tilbage">
				<Icon name="arrow-l" size={20} color="var(--text)" />
			</button>

			<div class="form-content">
				<div class="form-header">
					<h2 class="form-title">Vi kan ikke finde et køb</h2>
					<p class="form-sub">Der er ikke registreret et køb på den email.</p>
				</div>

				<div class="form">
					<div class="besked-kort">
						<span class="besked-email">{email}</span>
						<span class="besked-tekst">
							Har du måske betalt med en anden email? Mange bruger en privat adresse ved købet. Prøv
							den i stedet.
						</span>
					</div>

					<Button variant="primary" size="lg" full onclick={goBack}>Prøv en anden email</Button>
					<Button
						variant="outline"
						size="lg"
						full
						onclick={() =>
							goto(
								'mailto:kontakt@linnsacademy.dk?subject=' +
									encodeURIComponent('Jeg kan ikke komme ind i appen')
							)}
					>
						Skriv til Linn
					</Button>
				</div>
			</div>

			<p class="hjaelp-linje">Vi svarer på hverdage · kontakt@linnsacademy.dk</p>
		</div>
	{:else if view === 'reset'}
		<div class="form-screen">
			<button
				class="back-btn"
				onclick={() => {
					view = 'harKonto';
					error = '';
					resetSendt = false;
				}}
				aria-label="Tilbage"
			>
				<Icon name="arrow-l" size={20} color="var(--text)" />
			</button>

			<div class="form-content">
				<div class="form-header">
					<h2 class="form-title">Glemt adgangskode</h2>
					<p class="form-sub">Vi sender dig et link, så du kan vælge en ny.</p>
				</div>

				{#if resetSendt}
					<div class="form">
						<div class="info-besked">
							Hvis der findes en konto med den email, har vi sendt et link til den. Kig også i dit
							spam-filter.
						</div>
						<Button variant="primary" size="lg" full onclick={() => (view = 'harKonto')}>
							Tilbage
						</Button>
					</div>
				{:else}
					<div class="form">
						<label class="field">
							<span class="label">Email</span>
							<input
								type="email"
								bind:value={email}
								placeholder="dig@eksempel.dk"
								autocomplete="email"
							/>
						</label>

						{#if error}
							<p class="error">{error}</p>
						{/if}

						<Button variant="primary" size="lg" full onclick={handleResetSubmit}>
							{loading ? 'Vent...' : 'Send link'}
						</Button>
					</div>
				{/if}
			</div>
		</div>
	{/if}
</div>

<style>
	.surface {
		min-height: 100vh;
		background: var(--bg);
		display: flex;
		flex-direction: column;
	}

	/* === Velkomst (toppen af skærm 1) === */
	.velkomst-top {
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		gap: 12px;
		padding-top: 24px;
	}

	.tagline {
		margin: 10px 0 0;
		font-size: calc(13px * var(--fs-scale, 1));
		color: var(--text2);
		max-width: 260px;
		line-height: 1.55;
	}

	/* === Formular-skærm === */
	.form-screen {
		flex: 1;
		display: flex;
		flex-direction: column;
		padding: 16px 28px 28px;
		max-width: 480px;
		margin: 0 auto;
		width: 100%;
		min-height: 100vh;
		box-sizing: border-box;
	}

	.back-btn {
		width: 40px;
		height: 40px;
		border: none;
		background: transparent;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		border-radius: 50%;
		margin-left: -8px;
		transition: background 0.15s ease;
	}

	.back-btn:hover {
		background: var(--bg2);
	}

	.form-content {
		flex: 1;
		display: flex;
		flex-direction: column;
		justify-content: center;
		padding-bottom: 40px;
	}

	.form-header {
		text-align: center;
		margin-bottom: 28px;
	}

	.form-title {
		font-family: var(--ff-d);
		font-size: calc(28px * var(--fs-scale, 1));
		font-weight: 700;
		color: var(--text);
		letter-spacing: -0.01em;
		margin: 0;
	}

	.form-sub {
		margin: 6px 0 0;
		font-size: calc(13px * var(--fs-scale, 1));
		color: var(--text2);
	}

	.form {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.label {
		font-family: var(--ff-b);
		font-size: calc(13px * var(--fs-scale, 1));
		font-weight: 500;
		color: var(--text2);
	}

	.field input {
		width: 100%;
		padding: 12px 14px;
		border: 1px solid var(--border);
		border-radius: var(--r);
		background: var(--white);
		font-family: var(--ff-b);
		font-size: calc(15px * var(--fs-scale, 1));
		color: var(--text);
		transition: border-color 0.15s ease;
		box-sizing: border-box;
	}

	.field input:focus {
		outline: none;
		border-color: var(--terra);
	}

	.field input::placeholder {
		color: var(--text4);
	}

	/* Forklaringen under adgangskode-feltet. Den fjerner den hyppigste
	   misforståelse: at kunden tror hun har fået tilsendt et kodeord. */
	.felt-hjaelp {
		font-family: var(--ff-b);
		font-size: calc(12px * var(--fs-scale, 1));
		color: var(--text3);
		line-height: 1.45;
	}

	/* Kvitteringen: det hun har købt, eller den konto vi har genkendt. */
	.kvittering {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 12px 14px;
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: var(--r);
	}

	.kvittering-ikon {
		width: 34px;
		height: 34px;
		border-radius: 50%;
		background: var(--ic-sage);
		display: flex;
		align-items: center;
		justify-content: center;
		flex: none;
	}

	.kvittering-ikon.rose {
		background: var(--ic-rose);
	}

	.kvittering-tekst {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}

	.kvittering-titel {
		font-family: var(--ff-b);
		font-size: calc(14px * var(--fs-scale, 1));
		font-weight: 700;
		color: var(--text);
	}

	.kvittering-email {
		font-family: var(--ff-b);
		font-size: calc(12px * var(--fs-scale, 1));
		color: var(--text3);
		overflow-wrap: anywhere;
	}

	.kvittering-email.stor {
		font-size: calc(14px * var(--fs-scale, 1));
		font-weight: 500;
		color: var(--text);
	}

	/* Beskeden på "vi kan ikke finde et køb" */
	.besked-kort {
		display: flex;
		flex-direction: column;
		gap: 5px;
		padding: 13px 15px;
		background: var(--white);
		border: 1px solid var(--border);
		border-left: 3px solid var(--terra);
		border-radius: var(--r);
	}

	.besked-email {
		font-family: var(--ff-b);
		font-size: calc(14px * var(--fs-scale, 1));
		font-weight: 700;
		color: var(--text);
		overflow-wrap: anywhere;
	}

	.besked-tekst {
		font-family: var(--ff-b);
		font-size: calc(13px * var(--fs-scale, 1));
		color: var(--text2);
		line-height: 1.5;
	}

	.error {
		margin: 0;
		padding: 10px 12px;
		background: var(--ic-rose);
		color: var(--text);
		border-radius: var(--r);
		font-family: var(--ff-b);
		font-size: calc(13px * var(--fs-scale, 1));
	}

	.info-besked {
		padding: 12px 14px;
		background: #eef5ef;
		color: #406a4e;
		border-radius: var(--r);
		font-family: var(--ff-b);
		font-size: calc(13px * var(--fs-scale, 1));
		line-height: 1.5;
	}

	.glemt-link {
		background: none;
		border: none;
		padding: 6px 0;
		color: var(--text2);
		font-family: var(--ff-b);
		font-size: calc(13px * var(--fs-scale, 1));
		text-decoration: underline;
		cursor: pointer;
		align-self: center;
		margin-top: 4px;
	}
	.glemt-link:hover {
		color: var(--terra);
	}

	/* Hjælpe-linjen nederst på hver skærm */
	.hjaelp-linje {
		margin: 0;
		text-align: center;
		font-family: var(--ff-b);
		font-size: calc(12px * var(--fs-scale, 1));
		color: var(--text3);
	}

	.hjaelp-linje a,
	.tekst-link {
		color: var(--terra);
		font-weight: 700;
		text-decoration: none;
		background: none;
		border: none;
		padding: 0;
		font-family: var(--ff-b);
		font-size: inherit;
		cursor: pointer;
	}

	/* === Logget ind === */
	.logged-in-screen {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 40px 28px;
		max-width: 480px;
		margin: 0 auto;
		width: 100%;
	}

	.logged-in-card {
		width: 100%;
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: var(--rl);
		padding: var(--card-pad);
		text-align: center;
	}

	.hello {
		margin: 0 0 4px;
		font-family: var(--ff-b);
		font-size: calc(14px * var(--fs-scale, 1));
		color: var(--text3);
	}

	.email {
		margin: 0 0 20px;
		font-family: var(--ff-b);
		font-size: calc(16px * var(--fs-scale, 1));
		font-weight: 500;
		color: var(--text);
	}

	.actions {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
</style>
