<script lang="ts">
	// Arket der kommer frem naar kunden gemmer en favorit med et navn hun
	// allerede har brugt. Se favoritNavn.ts for baggrunden.
	//
	// VIGTIGT: maaltidet er ALLEREDE skrevet i dagbogen naar dette ark vises.
	// Arket handler kun om favoritten, og teksten siger det hoejt. Lukker
	// kunden arket sker der ingenting med favoritterne, og maden staar der
	// stadig. Uden den sikkerhed ville hun trykke gem igen og lave dubletter.
	import { onDestroy, onMount } from 'svelte';
	import { favoritNavnErOptaget } from '$lib/content/favoritNavn';
	import type { FavoritMaaltid } from '$lib/content/kost';

	interface Props {
		/** Navnet kunden forsoegte at gemme. Vises i overskriften. */
		navn: string;
		/** Alle kundens favoritter. Bruges til at tjekke det nye navn. */
		favoritter: FavoritMaaltid[];
		/** True mens en af handlingerne skriver til serveren. */
		arbejder?: boolean;
		/** Erstat den favorit der allerede baerer navnet. */
		onOpdater: () => void;
		/** Gem en ny favorit under et navn kunden selv skriver. */
		onGemNy: (nytNavn: string) => void;
		/** Luk uden at roere favoritterne. */
		onAnnuller: () => void;
	}

	let { navn, favoritter, arbejder = false, onOpdater, onGemNy, onAnnuller }: Props = $props();

	// Navnefeltet er skjult indtil kunden vaelger "Gem som en ny favorit", og
	// det starter TOMT. Vi forudfylder bevidst ikke med "Morgenmad 2": det
	// ville rydde listen teknisk og efterlade hende med navne hun stadig ikke
	// kan laese. Bedre at bede om et rigtigt navn den ene gang det kraeves.
	let viserNytNavn = $state(false);
	let nytNavn = $state('');
	let felt = $state<HTMLInputElement | null>(null);

	const optaget = $derived(favoritNavnErOptaget(favoritter, nytNavn));
	const kanGemme = $derived(nytNavn.trim().length > 0 && !optaget && !arbejder);

	function portalToBody(node: HTMLElement) {
		document.body.appendChild(node);
		return {
			destroy() {
				if (node.parentNode === document.body) {
					document.body.removeChild(node);
				}
			}
		};
	}

	function annuller() {
		if (arbejder) return;
		onAnnuller();
	}

	function aabnNytNavn() {
		if (arbejder) return;
		viserNytNavn = true;
		// Vent en frame saa feltet findes i DOM'en foer vi giver det fokus.
		requestAnimationFrame(() => felt?.focus());
	}

	function gemNy() {
		if (!kanGemme) return;
		onGemNy(nytNavn.trim());
	}

	onMount(() => {
		const original = document.body.style.overflow;
		document.body.style.overflow = 'hidden';
		return () => {
			document.body.style.overflow = original;
		};
	});

	onDestroy(() => {
		if (typeof document !== 'undefined') {
			document.body.style.overflow = '';
		}
	});
</script>

<div
	class="bag"
	role="dialog"
	aria-modal="true"
	use:portalToBody
	onclick={(e) => {
		if (e.target === e.currentTarget) annuller();
	}}
	onkeydown={(e) => {
		if (e.key === 'Escape') annuller();
	}}
	tabindex="-1"
>
	<div class="ark">
		<div class="head">
			<div class="titel">Du har allerede en favorit der hedder "{navn}"</div>
			<button class="luk" type="button" onclick={annuller} aria-label="Luk" disabled={arbejder}>
				×
			</button>
		</div>

		<p class="besk">
			Måltidet er gemt i din dagbog. Nu skal du kun vælge hvad der skal ske med favoritten, så din
			liste ikke fyldes med ens navne.
		</p>

		<div class="valg">
			<button
				type="button"
				class="valg-knap"
				class:frem={!viserNytNavn}
				onclick={onOpdater}
				disabled={arbejder}
			>
				<span class="valg-titel">Opdater "{navn}"</span>
				<span class="valg-sub">Din favorit kommer til at indeholde det du lige har tastet</span>
			</button>

			{#if viserNytNavn}
				<div class="valg-knap frem statisk">
					<span class="valg-titel">Gem som en ny favorit</span>
					<input
						bind:this={felt}
						type="text"
						class="felt-input"
						placeholder="fx Yoghurt med bær og æg"
						bind:value={nytNavn}
						disabled={arbejder}
						onkeydown={(e) => {
							if (e.key === 'Enter') gemNy();
						}}
					/>
					{#if optaget}
						<span class="advarsel">Det navn bruger du allerede. Prøv et andet.</span>
					{/if}
				</div>
			{:else}
				<button type="button" class="valg-knap" onclick={aabnNytNavn} disabled={arbejder}>
					<span class="valg-titel">Gem som en ny favorit</span>
					<span class="valg-sub">Du giver den et andet navn, så du kan kende dem fra hinanden</span>
				</button>
			{/if}
		</div>

		{#if viserNytNavn}
			<button type="button" class="primary-knap" onclick={gemNy} disabled={!kanGemme}>
				{arbejder ? 'Gemmer…' : 'Gem favoritten'}
			</button>
		{/if}

		<button type="button" class="link" onclick={annuller} disabled={arbejder}>
			Behold min favorit som den er
		</button>
	</div>
</div>

<style>
	.bag {
		position: fixed;
		inset: 0;
		z-index: 700;
		background: rgba(42, 31, 23, 0.55);
		display: flex;
		align-items: flex-end;
		justify-content: center;
	}

	@media (min-width: 600px) {
		.bag {
			align-items: center;
		}
	}

	.ark {
		width: 100%;
		max-width: 520px;
		background: var(--bg, #faf6f1);
		border-radius: 18px 18px 0 0;
		padding: 18px 18px calc(18px + env(safe-area-inset-bottom));
		display: flex;
		flex-direction: column;
		gap: 14px;
		box-shadow: 0 -8px 24px rgba(0, 0, 0, 0.15);
	}

	@media (min-width: 600px) {
		.ark {
			border-radius: 18px;
		}
	}

	.head {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 10px;
	}

	.titel {
		font-family: var(--ff-d);
		font-size: calc(18px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--text);
		line-height: 1.25;
	}

	.luk {
		background: none;
		border: none;
		font-size: 26px;
		color: var(--text3);
		cursor: pointer;
		line-height: 1;
		padding: 0 4px;
	}

	.luk:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.besk {
		font-size: calc(13.5px * var(--fs-scale, 1));
		color: var(--text2);
		margin: 0;
		line-height: 1.5;
	}

	.valg {
		display: flex;
		flex-direction: column;
		gap: 9px;
	}

	.valg-knap {
		display: block;
		width: 100%;
		text-align: left;
		padding: 13px 14px;
		border-radius: 12px;
		border: 1px solid var(--border2);
		background: var(--white, #ffffff);
		font-family: var(--ff-b);
		cursor: pointer;
	}

	.valg-knap.statisk {
		cursor: default;
	}

	.valg-knap.frem {
		border-color: var(--terra);
		background: #fdf6f3;
	}

	.valg-knap:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.valg-titel {
		display: block;
		font-size: calc(14px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--text);
		line-height: 1.3;
	}

	.valg-sub {
		display: block;
		font-size: calc(11.5px * var(--fs-scale, 1));
		color: var(--text3);
		margin-top: 3px;
		line-height: 1.4;
	}

	.felt-input {
		width: 100%;
		margin-top: 9px;
		padding: 11px 12px;
		border: 1px solid var(--border2);
		border-radius: 10px;
		background: var(--bg, #faf6f1);
		font-family: var(--ff-b);
		font-size: calc(14px * var(--fs-scale, 1));
		color: var(--text);
	}

	.felt-input:focus {
		outline: none;
		border-color: var(--terra);
	}

	.advarsel {
		display: block;
		margin-top: 7px;
		font-size: calc(11.5px * var(--fs-scale, 1));
		color: #c5544a;
		line-height: 1.4;
	}

	.primary-knap {
		display: block;
		width: 100%;
		padding: 13px;
		font-size: calc(14px * var(--fs-scale, 1));
		font-weight: 600;
		font-family: var(--ff-b);
		border-radius: 10px;
		border: none;
		background: var(--terra);
		color: #fff;
		cursor: pointer;
	}

	.primary-knap:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.link {
		background: none;
		border: none;
		color: var(--text3);
		font-family: var(--ff-b);
		font-size: calc(12.5px * var(--fs-scale, 1));
		text-decoration: underline;
		padding: 2px 0;
		width: 100%;
		cursor: pointer;
	}

	.link:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
</style>
