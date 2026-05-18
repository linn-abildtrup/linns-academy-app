<script lang="ts">
	import { getContext } from 'svelte';
	import type { User } from 'firebase/auth';
	import Icon from '$lib/components/Icon.svelte';

	const getUser = getContext<() => User | null>('user');
	const user = $derived(getUser());

	let email = $state('');
	let opretter = $state(false);
	let fejl = $state<string | null>(null);

	let tempPassword = $state<string | null>(null);
	let tempEmail = $state('');
	let kopieret = $state(false);

	async function nulstil() {
		const u = user;
		if (!u || opretter) return;
		const trimmet = email.trim().toLowerCase();
		if (!trimmet || !trimmet.includes('@')) {
			fejl = 'Skriv en gyldig email.';
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

	function luk() {
		tempPassword = null;
		tempEmail = '';
		kopieret = false;
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
			Sæt en midlertidig adgangskode for en hvilken som helst kunde — virker for
			abonnenter, forløbskunder og kunder i bibliotek-bonus. Brug det når en kunde ikke
			modtager 'Glemt adgangskode'-mailen, eller når du har brug for at hjælpe hende
			hurtigt videre.
		</p>
	</header>

	<section class="card">
		<label class="felt">
			<span class="felt-label">Kundens email</span>
			<input
				type="email"
				class="felt-input"
				placeholder="kunde@eksempel.dk"
				bind:value={email}
				disabled={opretter}
				autocomplete="off"
				autocapitalize="none"
				spellcheck="false"
			/>
		</label>

		{#if fejl}
			<div class="fejl">{fejl}</div>
		{/if}

		<button class="primary-knap" type="button" onclick={nulstil} disabled={opretter || !email.trim()}>
			{opretter ? 'Opretter…' : '🔑 Generér midlertidig adgangskode'}
		</button>

		<p class="hint">
			Hendes nuværende kode bliver overskrevet. Send den nye kode til hende manuelt
			(fx Messenger eller SMS), og bed hende skifte den under <em>Profil → Skift
			adgangskode</em> så snart hun er logget ind.
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
			<p class="modal-tekst">Send denne kode til <strong>{tempEmail}</strong> via Messenger eller SMS:</p>

			<div class="kode-kort">
				<div class="kode-label">Midlertidig kode</div>
				<div class="kode-vaerdi">{tempPassword}</div>
				<button class="kopier-knap" type="button" onclick={kopier}>
					{kopieret ? '✓ Kopieret!' : '📋 Kopiér kode'}
				</button>
			</div>

			<div class="instruktioner-titel">Husk at fortælle hende:</div>
			<ul class="instruktioner">
				<li>Log ind med denne kode på <strong>app.linnsacademy.dk</strong></li>
				<li>Gå derefter til Profil → Skift adgangskode og lav sin egen kode</li>
				<li>Den midlertidige kode bør ikke gemmes nogen steder</li>
			</ul>

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
	.instruktioner-titel {
		font-size: calc(12.5px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--text);
		margin-top: 14px;
		margin-bottom: 6px;
	}
	.instruktioner {
		list-style: disc inside;
		padding: 0;
		margin: 0 0 8px;
		font-size: calc(12.5px * var(--fs-scale, 1));
		color: var(--text2);
		line-height: 1.6;
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
</style>
