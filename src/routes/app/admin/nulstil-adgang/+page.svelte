<script lang="ts">
	import { getContext, onMount } from 'svelte';
	import type { User } from 'firebase/auth';
	import { collection, getDocs } from 'firebase/firestore';
	import { db } from '$lib/firebase';
	import { klientSoegeMatch } from '$lib/utils/klientSoegning';
	import Icon from '$lib/components/Icon.svelte';

	const getUser = getContext<() => User | null>('user');
	const user = $derived(getUser());

	type Kunde = { email: string; firstName: string; lastName: string };

	let soeg = $state('');
	let email = $state('');
	let opretter = $state(false);
	let fejl = $state<string | null>(null);
	let alleKunder = $state<Kunde[]>([]);
	let indlaeserKunder = $state(true);

	let tempPassword = $state<string | null>(null);
	let tempEmail = $state('');
	let kopieret = $state(false);

	const matches = $derived.by<Kunde[]>(() => {
		if (soeg.trim().length < 2) return [];
		return alleKunder
			.filter((k) => klientSoegeMatch(`${k.firstName} ${k.lastName} ${k.email}`, soeg))
			.slice(0, 30);
	});

	onMount(async () => {
		try {
			const map = new Map<string, Kunde>();
			// allowedEmails har firstName + lastName for alle kunder fra Simplero
			const allowedSnap = await getDocs(collection(db, 'allowedEmails'));
			for (const d of allowedSnap.docs) {
				const data = d.data() as { email?: string; firstName?: string; lastName?: string };
				const e = (data.email ?? '').toLowerCase();
				if (!e) continue;
				map.set(e, {
					email: e,
					firstName: data.firstName ?? '',
					lastName: data.lastName ?? ''
				});
			}
			// users-collection som fallback for navne der ikke er i allowedEmails
			try {
				const usersSnap = await getDocs(collection(db, 'users'));
				for (const d of usersSnap.docs) {
					const data = d.data() as { email?: string; firstName?: string; lastName?: string };
					const e = (data.email ?? '').toLowerCase();
					if (!e) continue;
					if (!map.has(e)) {
						map.set(e, {
							email: e,
							firstName: data.firstName ?? '',
							lastName: data.lastName ?? ''
						});
					} else if (data.firstName && !map.get(e)!.firstName) {
						map.get(e)!.firstName = data.firstName;
					}
				}
			} catch (e) {
				console.warn('Kunne ikke hente users-collection:', e);
			}
			alleKunder = Array.from(map.values()).sort((a, b) =>
				(a.firstName || a.email).localeCompare(b.firstName || b.email, 'da')
			);
		} catch (e) {
			console.error('Kunne ikke hente kundeliste:', e);
		} finally {
			indlaeserKunder = false;
		}
	});

	function vaelgKunde(k: Kunde) {
		email = k.email;
		soeg = `${k.firstName} ${k.lastName}`.trim() || k.email;
	}

	async function nulstil() {
		const u = user;
		if (!u || opretter) return;
		const trimmet = email.trim().toLowerCase();
		if (!trimmet || !trimmet.includes('@')) {
			fejl = 'Vælg en kunde fra listen eller skriv en gyldig email.';
			return;
		}
		fejl = null;
		opretter = true;
		try {
			const idToken = await u.getIdToken(true);
			const res = await fetch('/api/admin/set-temp-password', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${idToken}`
				},
				body: JSON.stringify({ email: trimmet })
			});
			if (!res.ok) {
				const errBody = await res.text();
				let melding = 'Kunne ikke sætte ny adgangskode.';
				try {
					const parsed = JSON.parse(errBody);
					if (parsed.message) melding = parsed.message;
				} catch {
					if (errBody) melding = errBody;
				}
				fejl = melding;
				return;
			}
			const data = (await res.json()) as { tempPassword: string };
			tempPassword = data.tempPassword;
			tempEmail = trimmet;
			email = '';
		} catch (e) {
			console.error(e);
			fejl = 'Kunne ikke kontakte serveren. Prøv igen.';
		} finally {
			opretter = false;
		}
	}

	async function kopier() {
		if (!tempPassword) return;
		try {
			await navigator.clipboard.writeText(tempPassword);
			kopieret = true;
			setTimeout(() => (kopieret = false), 2000);
		} catch (e) {
			console.warn('Clipboard fejlede:', e);
		}
	}

	let beskedKopieret = $state(false);
	const klientBesked = $derived(
		tempPassword
			? `Jeg har nulstillet din adgangskode, som er ${tempPassword}. Du skal logge ind med den og kan efterfølgende ændre den under Profil.`
			: ''
	);
	async function kopierBesked() {
		if (!klientBesked) return;
		try {
			await navigator.clipboard.writeText(klientBesked);
			beskedKopieret = true;
			setTimeout(() => (beskedKopieret = false), 2000);
		} catch (e) {
			console.warn('Clipboard fejlede:', e);
		}
	}

	function luk() {
		tempPassword = null;
		tempEmail = '';
		kopieret = false;
		beskedKopieret = false;
	}
</script>

<svelte:window
	onkeydown={(e) => {
		if (e.key === 'Escape' && tempPassword) luk();
	}}
/>

<div class="page">
	<header class="page-header">
		<a class="back" href="/app/admin">
			<Icon name="arrow-l" size={14} color="var(--text2)" />
			<span>Admin</span>
		</a>
		<div class="eyebrow">Admin</div>
		<h1>Nulstil adgangskode</h1>
		<p class="page-sub">
			Sæt en midlertidig adgangskode for en hvilken som helst kunde — virker for abonnenter,
			forløbskunder og kunder i bibliotek-bonus. Brug det når en kunde ikke modtager 'Glemt
			adgangskode'-mailen, eller når du har brug for at hjælpe hende hurtigt videre.
		</p>
	</header>

	<section class="card">
		<label class="felt">
			<span class="felt-label">Søg på navn eller email</span>
			<input
				type="text"
				class="felt-input"
				placeholder={indlaeserKunder ? 'Indlæser kunder…' : 'Fx Pia, Mette Drustrup, mie@…'}
				bind:value={soeg}
				disabled={opretter || indlaeserKunder}
				autocomplete="off"
				autocapitalize="none"
				spellcheck="false"
			/>
		</label>

		{#if soeg.trim().length >= 2 && matches.length > 0 && email !== matches[0]?.email}
			<div class="resultater">
				{#each matches as k (k.email)}
					{@const navn = `${k.firstName} ${k.lastName}`.trim()}
					{@const erValgt = k.email === email}
					<button
						type="button"
						class="resultat-rad"
						class:valgt={erValgt}
						onclick={() => vaelgKunde(k)}
					>
						<div class="resultat-navn">{navn || '(uden navn)'}</div>
						<div class="resultat-email">{k.email}</div>
						{#if erValgt}<span class="resultat-check">✓</span>{/if}
					</button>
				{/each}
			</div>
		{:else if soeg.trim().length >= 2 && matches.length === 0 && !indlaeserKunder}
			<div class="ingen-match">
				Ingen kunder matcher søgningen. Skriv den fulde email hvis hun ikke står i listen.
			</div>
		{/if}

		{#if email}
			<div class="valgt-kunde">
				Valgt: <strong>{email}</strong>
				<button
					type="button"
					class="ryd-knap"
					onclick={() => {
						email = '';
						soeg = '';
					}}
				>
					ryd
				</button>
			</div>
		{/if}

		{#if fejl}
			<div class="fejl">{fejl}</div>
		{/if}

		<button
			class="primary-knap"
			type="button"
			onclick={nulstil}
			disabled={opretter || !email.trim()}
		>
			{opretter ? 'Opretter…' : '🔑 Generér midlertidig adgangskode'}
		</button>

		<p class="hint">
			Hendes nuværende kode bliver overskrevet. Send den nye kode til hende manuelt (fx Messenger
			eller SMS), og bed hende skifte den under <em>Profil → Skift adgangskode</em> så snart hun er logget
			ind.
		</p>
	</section>
</div>

{#if tempPassword}
	<div class="modal-overlay" role="presentation" onclick={luk}>
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<div
			class="modal"
			role="dialog"
			tabindex="-1"
			aria-modal="true"
			aria-labelledby="kode-titel"
			onclick={(e) => e.stopPropagation()}
		>
			<h2 id="kode-titel" class="modal-titel">Midlertidig adgangskode oprettet 🔑</h2>
			<p class="modal-tekst">
				Send denne kode til <strong>{tempEmail}</strong> via Messenger eller SMS:
			</p>

			<div class="kode-kort">
				<div class="kode-label">Midlertidig kode</div>
				<div class="kode-vaerdi">{tempPassword}</div>
				<button class="kopier-knap" type="button" onclick={kopier}>
					{kopieret ? '✓ Kopieret!' : '📋 Kopiér kode'}
				</button>
			</div>

			<div class="besked-kort">
				<div class="besked-label">Besked til kunden</div>
				<div class="besked-tekst">{klientBesked}</div>
				<button class="kopier-knap" type="button" onclick={kopierBesked}>
					{beskedKopieret ? '✓ Kopieret!' : '📋 Kopiér besked'}
				</button>
			</div>

			<div class="modal-knapper">
				<button class="modal-knap primary" type="button" onclick={luk}>Luk</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.page {
		max-width: 600px;
		margin: 0 auto;
		padding: 16px 18px 80px;
	}
	.page-header {
		margin-bottom: 18px;
	}
	.back {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		color: var(--text2);
		font-size: calc(12px * var(--fs-scale, 1));
		text-decoration: none;
		margin-bottom: 8px;
	}
	.eyebrow {
		font-size: calc(11px * var(--fs-scale, 1));
		font-weight: 600;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--text3);
	}
	h1 {
		font-family: var(--ff-d);
		font-size: calc(22px * var(--fs-scale, 1));
		font-weight: 600;
		margin: 4px 0 6px;
	}
	.page-sub {
		font-size: calc(13px * var(--fs-scale, 1));
		color: var(--text2);
		line-height: 1.5;
	}
	.card {
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 14px;
		padding: 18px;
	}
	.felt {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.felt-label {
		font-size: calc(12px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--text2);
	}
	.felt-input {
		width: 100%;
		padding: 12px 14px;
		font-size: calc(16px * var(--fs-scale, 1));
		font-family: var(--ff-b);
		border: 1px solid var(--border);
		border-radius: 10px;
		background: var(--bg2);
		color: var(--text);
		outline: none;
		box-sizing: border-box;
	}
	.felt-input:focus {
		border-color: var(--terra);
	}
	.fejl {
		padding: 10px 14px;
		background: #fbeeea;
		color: #8a4a3e;
		border-radius: 8px;
		font-size: calc(12.5px * var(--fs-scale, 1));
		margin-top: 10px;
	}
	.primary-knap {
		display: block;
		width: 100%;
		padding: 13px;
		margin-top: 14px;
		background: var(--terra);
		color: #fff;
		font-size: calc(14px * var(--fs-scale, 1));
		font-weight: 600;
		font-family: var(--ff-b);
		border: none;
		border-radius: 10px;
		cursor: pointer;
	}
	.primary-knap:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
	.hint {
		margin-top: 14px;
		font-size: calc(12px * var(--fs-scale, 1));
		color: var(--text3);
		line-height: 1.5;
	}

	.modal-overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.45);
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 18px;
		z-index: 100;
	}
	.modal {
		background: var(--white);
		border-radius: 14px;
		padding: 22px;
		max-width: 460px;
		width: 100%;
		max-height: 90vh;
		overflow-y: auto;
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
	}
	.modal-titel {
		font-family: var(--ff-d);
		font-size: calc(18px * var(--fs-scale, 1));
		font-weight: 600;
		margin: 0 0 12px;
		color: var(--text);
	}
	.modal-tekst {
		font-size: calc(13px * var(--fs-scale, 1));
		color: var(--text2);
		line-height: 1.5;
		margin: 0 0 10px;
	}
	.kode-kort {
		background: var(--bg2);
		border: 1px solid var(--border);
		border-radius: 12px;
		padding: 16px;
		margin: 14px 0;
		text-align: center;
	}
	.kode-label {
		font-size: calc(10px * var(--fs-scale, 1));
		font-weight: 700;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--text3);
		margin-bottom: 8px;
	}
	.kode-vaerdi {
		font-family: 'SF Mono', Menlo, monospace;
		font-size: calc(22px * var(--fs-scale, 1));
		font-weight: 600;
		letter-spacing: 0.05em;
		color: var(--terra);
		user-select: all;
		margin-bottom: 12px;
		word-break: break-all;
	}
	.besked-kort {
		background: var(--bg2);
		border: 1px solid var(--border);
		border-radius: 12px;
		padding: 16px;
		margin: 14px 0;
	}
	.besked-label {
		font-size: calc(10px * var(--fs-scale, 1));
		font-weight: 700;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--text3);
		margin-bottom: 8px;
	}
	.besked-tekst {
		font-size: calc(13px * var(--fs-scale, 1));
		color: var(--text);
		line-height: 1.5;
		margin-bottom: 12px;
		user-select: all;
	}
	.kopier-knap {
		padding: 9px 16px;
		font-size: calc(12.5px * var(--fs-scale, 1));
		font-weight: 600;
		font-family: var(--ff-b);
		border-radius: 8px;
		background: var(--terra);
		color: #fff;
		border: none;
		cursor: pointer;
	}
	.modal-knapper {
		display: flex;
		gap: 10px;
		justify-content: flex-end;
		margin-top: 16px;
	}
	.modal-knap {
		padding: 11px 16px;
		font-size: calc(13px * var(--fs-scale, 1));
		font-weight: 600;
		font-family: var(--ff-b);
		border-radius: 10px;
		cursor: pointer;
		border: 1px solid var(--border);
	}
	.modal-knap.primary {
		background: var(--terra);
		color: #fff;
		border-color: var(--terra);
	}

	.resultater {
		max-height: 280px;
		overflow-y: auto;
		margin-top: 6px;
		border: 1px solid var(--border);
		border-radius: 10px;
		background: var(--white);
	}

	.resultat-rad {
		display: flex;
		align-items: center;
		gap: 10px;
		width: 100%;
		padding: 10px 14px;
		background: none;
		border: none;
		border-bottom: 1px solid var(--border);
		cursor: pointer;
		text-align: left;
		font-family: inherit;
	}

	.resultat-rad:last-child {
		border-bottom: none;
	}

	.resultat-rad:hover {
		background: var(--bg2);
	}

	.resultat-rad.valgt {
		background: var(--sdim);
	}

	.resultat-navn {
		font-size: calc(13.5px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--text);
		flex: 1;
	}

	.resultat-email {
		font-size: calc(11.5px * var(--fs-scale, 1));
		color: var(--text3);
	}

	.resultat-check {
		color: var(--sage);
		font-size: calc(14px * var(--fs-scale, 1));
	}

	.ingen-match {
		margin-top: 8px;
		padding: 10px 14px;
		background: var(--bg2);
		border-radius: 8px;
		font-size: calc(12.5px * var(--fs-scale, 1));
		color: var(--text3);
	}

	.valgt-kunde {
		margin-top: 12px;
		padding: 10px 14px;
		background: var(--sdim);
		border-radius: 8px;
		font-size: calc(13px * var(--fs-scale, 1));
		color: var(--text);
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 10px;
	}

	.ryd-knap {
		background: none;
		border: none;
		color: var(--text3);
		font-size: calc(12px * var(--fs-scale, 1));
		text-decoration: underline;
		cursor: pointer;
		padding: 0;
		font-family: inherit;
	}
</style>
