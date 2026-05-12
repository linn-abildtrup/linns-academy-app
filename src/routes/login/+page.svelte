<script lang="ts">
	import { goto } from '$app/navigation';
	import {
		createUserWithEmailAndPassword,
		signInWithEmailAndPassword,
		signOut,
		onAuthStateChanged,
		type User
	} from 'firebase/auth';
	import { auth } from '$lib/firebase';
	import { createUserDoc } from '$lib/userDoc';
	import { hentAllowedEmail } from '$lib/firestore/forlob';
	import Button from '$lib/components/Button.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import Logo from '$lib/components/Logo.svelte';

	type View = 'welcome' | 'login' | 'signup';

	let view = $state<View>('welcome');
	let email = $state('');
	let password = $state('');
	let error = $state('');
	let loading = $state(false);
	let user = $state<User | null>(null);

	onAuthStateChanged(auth, (u) => {
		user = u;
	});

	async function handleSubmit() {
		error = '';
		loading = true;
		try {
			if (view === 'login') {
				await signInWithEmailAndPassword(auth, email, password);
			} else if (view === 'signup') {
				const cred = await createUserWithEmailAndPassword(auth, email, password);
				// Tjek at email har et registreret køb i allowedEmails.
				// Auth-kontoen er allerede oprettet, men vi sletter den igen
				// hvis vi ikke kan finde et køb — så vi ikke får orphan-konti.
				// hentAllowedEmail er tilladt af Firestore-rules for den
				// netop-loggede-ind bruger (request.auth.token.email == email).
				const allowed = await hentAllowedEmail(email);
				if (!allowed) {
					try {
						await cred.user.delete();
					} catch (delErr) {
						console.warn('Kunne ikke slette uønsket signup-konto:', delErr);
					}
					error =
						`Vi kan ikke finde et køb registreret på ${email}. ` +
						'Tjek at du bruger samme email som ved købet på Simplero. ' +
						'Spørgsmål? Skriv til kontakt@linnsacademy.dk.';
					return;
				}
				await createUserDoc(cred.user.uid, cred.user.email ?? email);
			}
			await goto('/');
		} catch (e) {
			error = e instanceof Error ? e.message : 'Noget gik galt';
		} finally {
			loading = false;
		}
	}

	async function handleLogout() {
		await signOut(auth);
		email = '';
		password = '';
	}

	function goBack() {
		view = 'welcome';
		error = '';
		email = '';
		password = '';
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
						Gå til forsiden
					</Button>
					<Button variant="ghost" size="lg" full onclick={handleLogout}>Log ud</Button>
				</div>
			</div>
		</div>
	{:else if view === 'welcome'}
		<div class="welcome">
			<div class="welcome-top">
				<Logo size="lg" />
				<p class="tagline">Et roligt rum til mikrotræning, refleksion og kvinders sundhed.</p>
			</div>

			<div class="welcome-actions">
				<Button variant="primary" size="lg" full onclick={() => (view = 'login')}>Log ind</Button>
				<Button variant="outline" size="lg" full onclick={() => (view = 'signup')}>
					Opret konto
				</Button>
			</div>
		</div>
	{:else}
		<div class="form-screen">
			<button class="back-btn" onclick={goBack} aria-label="Tilbage">
				<Icon name="arrow-l" size={20} color="var(--text)" />
			</button>

			<div class="form-content">
				<div class="form-header">
					<h2 class="form-title">
						{view === 'login' ? 'Log ind' : 'Opret konto'}
					</h2>
					<p class="form-sub">
						{view === 'login' ? 'Velkommen tilbage' : 'Begynd din rejse her'}
					</p>
				</div>

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

					<label class="field">
						<span class="label">Adgangskode</span>
						<input
							type="password"
							bind:value={password}
							placeholder="Mindst 6 tegn"
							autocomplete={view === 'login' ? 'current-password' : 'new-password'}
						/>
					</label>

					{#if error}
						<p class="error">{error}</p>
					{/if}

					<Button variant="primary" size="lg" full onclick={handleSubmit}>
						{loading ? 'Vent...' : view === 'login' ? 'Log ind' : 'Opret konto'}
					</Button>
				</div>
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

	/* === Velkomst === */
	.welcome {
		flex: 1;
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		padding: 40px 28px 28px;
		max-width: 480px;
		margin: 0 auto;
		width: 100%;
		min-height: 100vh;
		box-sizing: border-box;
	}

	.welcome-top {
		flex: 1;
		display: flex;
		flex-direction: column;
		justify-content: center;
		align-items: center;
		text-align: center;
		gap: 18px;
	}

	.tagline {
		margin: 10px 0 0;
		font-size: calc(13px * var(--fs-scale, 1));
		color: var(--text2);
		max-width: 260px;
		line-height: 1.55;
	}

	.welcome-actions {
		display: flex;
		flex-direction: column;
		gap: 10px;
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

	.error {
		margin: 0;
		padding: 10px 12px;
		background: var(--ic-rose);
		color: var(--text);
		border-radius: var(--r);
		font-family: var(--ff-b);
		font-size: calc(13px * var(--fs-scale, 1));
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
