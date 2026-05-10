<script lang="ts">
	// Vises for brugere der ikke længere har adgang til appen — hverken
	// aktivt abonnement, aktivt forløb eller bonus-periode efter forløb-slut.
	// De kan stadig logge ind (Firebase Auth virker), men ser kun denne
	// side med en venlig opfordring til at købe adgang igen.
	import { signOut } from 'firebase/auth';
	import { auth } from '$lib/firebase';
	import { goto } from '$app/navigation';
	import Logo from '$lib/components/Logo.svelte';
	import Button from '$lib/components/Button.svelte';

	async function logUd() {
		try {
			await signOut(auth);
			await goto('/login');
		} catch (e) {
			console.error('Kunne ikke logge ud', e);
		}
	}
</script>

<div class="ingen-adgang">
	<div class="logo-wrap">
		<Logo size="lg" />
	</div>

	<h1 class="titel">Velkommen tilbage</h1>
	<p class="brodtekst">
		Din adgang til Linn's Academy er udløbet. Køb et nyt forløb eller et abonnement for at få
		adgang til mikrotræning, kost, vaner og dit personlige bibliotek igen.
	</p>

	<div class="knapper">
		<Button
			variant="primary"
			size="lg"
			full
			onclick={() => window.open('https://linn.simplero.com/', '_blank', 'noopener')}
		>
			Se tilbud
		</Button>
		<Button variant="ghost" size="lg" full onclick={logUd}>Log ud</Button>
	</div>

	<p class="kontakt">
		Spørgsmål? Skriv til Linn på <a href="mailto:linn@linnsacademy.dk">linn@linnsacademy.dk</a>
	</p>
</div>

<style>
	.ingen-adgang {
		min-height: 100vh;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 32px 24px;
		max-width: 420px;
		margin: 0 auto;
		text-align: center;
		gap: 16px;
	}

	.logo-wrap {
		margin-bottom: 24px;
	}

	.titel {
		font-size: calc(28px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--text);
		margin: 0;
	}

	.brodtekst {
		font-size: calc(15px * var(--fs-scale, 1));
		color: var(--text2);
		line-height: 1.5;
		margin: 0;
	}

	.knapper {
		width: 100%;
		display: flex;
		flex-direction: column;
		gap: 8px;
		margin-top: 16px;
	}

	.kontakt {
		font-size: calc(13px * var(--fs-scale, 1));
		color: var(--text3);
		margin: 16px 0 0;
	}

	.kontakt a {
		color: var(--terra);
		text-decoration: none;
	}
</style>
