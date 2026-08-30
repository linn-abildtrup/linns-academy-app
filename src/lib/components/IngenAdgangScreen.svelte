<script lang="ts">
	// Vises for brugere der ikke (længere) har adgang til appen.
	// To varianter:
	//   - "Udløbet adgang": brugeren har tidligere haft et køb (har
	//     simpleroCustomerId eller forlobIds), men adgangen er nu udløbet.
	//   - "Intet køb registreret": brugeren har aldrig haft adgang (typisk
	//     hvis hun har lavet konto med en email der ikke matcher hendes køb).
	import { signOut } from 'firebase/auth';
	import { auth } from '$lib/firebase';
	import { goto } from '$app/navigation';
	import type { UserDoc } from '$lib/types';
	import Logo from '$lib/components/Logo.svelte';
	import Button from '$lib/components/Button.svelte';

	interface Props {
		userDoc: UserDoc | null;
		/**
		 * True naar vi slet ikke kunne HENTE hendes adgang, ogsaa efter at
		 * have proevet igen. Saa maa vi ikke paastaa at hendes koeb ikke
		 * findes. Se content/hentIgen.ts.
		 */
		hentningFejlede?: boolean;
	}

	const { userDoc, hentningFejlede = false }: Props = $props();

	const harTidligereHaftKob = $derived(
		!!(userDoc?.simpleroCustomerId || (userDoc?.forlobIds && userDoc.forlobIds.length > 0))
	);

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

	{#if hentningFejlede}
		<!-- Vi ved ikke om hun har adgang, vi kunne bare ikke faa fat i den.
		     Det skal hun have at vide, i stedet for at hendes koeb ikke findes. -->
		<h1 class="titel">Vi kunne ikke hente din adgang</h1>
		<p class="brodtekst">
			Der var noget galt med forbindelsen lige nu. Det er ikke dig, og dit køb fejler ikke
			noget. Prøv igen om et øjeblik.
		</p>
	{:else if harTidligereHaftKob}
		<h1 class="titel">Velkommen tilbage</h1>
		<p class="brodtekst">
			Din adgang til Linn's Academy er udløbet. Køb et nyt forløb eller et abonnement for at få
			adgang til mikrotræning, kost, vaner og dit personlige bibliotek igen.
		</p>
	{:else}
		<h1 class="titel">Vi kan ikke finde dit køb</h1>
		<p class="brodtekst">
			Vi kan ikke finde et køb registreret på{userDoc?.email ? ` ${userDoc.email}` : ' den email'}.
			Tjek at du har brugt samme email som ved købet på Simplero. Hvis du ikke har købt endnu,
			kan du komme i gang via Se tilbud.
		</p>
	{/if}

	<div class="knapper">
		{#if hentningFejlede}
			<Button variant="primary" size="lg" full onclick={() => window.location.reload()}>
				Prøv igen
			</Button>
		{:else}
			<Button
				variant="primary"
				size="lg"
				full
				onclick={() => window.open('https://linn.simplero.com/', '_blank', 'noopener')}
			>
				Se tilbud
			</Button>
		{/if}
		<Button variant="ghost" size="lg" full onclick={logUd}>Log ud</Button>
	</div>

	<p class="kontakt">
		Spørgsmål? Skriv til Linn på <a href="mailto:kontakt@linnsacademy.dk">kontakt@linnsacademy.dk</a>
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
