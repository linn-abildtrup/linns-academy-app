<script lang="ts">
	// Viser app'ens build-version + en "tjek efter opdatering"-knap. Appen
	// opdaterer sig normalt selv (service worker, se src/routes/+layout.svelte),
	// saa det her er primaert til SUPPORT: kunden kan se sin version naar hun
	// rapporterer et problem, og knappen er en sikkerhedsventil hvis auto-
	// opdateringen glipper (i stedet for at skulle rydde cache/geninstallere).
	import { version } from '$app/environment';

	type Status = 'idle' | 'tjekker' | 'opdaterer' | 'nyeste';
	let status = $state<Status>('idle');

	async function tjekOpdatering() {
		if (status === 'tjekker' || status === 'opdaterer') return;
		status = 'tjekker';

		if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
			// Ingen service worker — hård genindlæsning henter nyeste.
			setTimeout(() => window.location.reload(), 300);
			return;
		}

		try {
			const reg = await navigator.serviceWorker.getRegistration();
			if (!reg) {
				status = 'nyeste';
				return;
			}

			// Lyt efter om en ny version begynder at installere ved update().
			let fandtOpdatering = false;
			const onUpdate = () => {
				if (reg.installing) fandtOpdatering = true;
			};
			reg.addEventListener('updatefound', onUpdate);

			await reg.update();
			// Giv browseren et øjeblik til at opdage en evt. ny version.
			await new Promise((r) => setTimeout(r, 1200));
			reg.removeEventListener('updatefound', onUpdate);

			if (fandtOpdatering || reg.installing || reg.waiting) {
				status = 'opdaterer';
				// Den nye version aktiverer (skipWaiting) og siden genindlæses via
				// root-layoutets controllerchange-listener. Fallback-reload her,
				// hvis det mod forventning ikke sker af sig selv.
				setTimeout(() => window.location.reload(), 2500);
			} else {
				status = 'nyeste';
			}
		} catch (e) {
			console.warn('Opdaterings-tjek fejlede:', e);
			// Ved tvivl: lad kunden hente nyeste via en genindlæsning.
			setTimeout(() => window.location.reload(), 300);
		}
	}
</script>

<div class="app-version">
	<div class="av-info">
		<span class="av-label">App-version</span>
		<span class="av-vaerdi">{version}</span>
	</div>
	<button
		type="button"
		class="av-knap"
		onclick={tjekOpdatering}
		disabled={status === 'tjekker' || status === 'opdaterer'}
	>
		{#if status === 'tjekker'}
			Tjekker...
		{:else if status === 'opdaterer'}
			Henter ny version...
		{:else}
			Tjek efter opdatering
		{/if}
	</button>
	{#if status === 'nyeste'}
		<span class="av-status">Du har den nyeste version ✓</span>
	{/if}
</div>

<style>
	.app-version {
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding: 14px 16px;
		border: 1px solid var(--border);
		border-radius: 12px;
		background: var(--white);
	}

	.av-info {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 8px;
	}

	.av-label {
		font-size: calc(12px * var(--fs-scale, 1));
		color: var(--text2);
		font-family: var(--ff-b);
	}

	.av-vaerdi {
		font-size: calc(12.5px * var(--fs-scale, 1));
		color: var(--text);
		font-family: var(--ff-d);
		font-variant-numeric: tabular-nums;
	}

	.av-knap {
		padding: 9px 12px;
		border: 1px solid var(--border);
		background: var(--bg);
		border-radius: 9px;
		font-size: calc(13px * var(--fs-scale, 1));
		font-family: var(--ff-b);
		color: var(--text);
		cursor: pointer;
	}

	.av-knap:disabled {
		opacity: 0.6;
		cursor: default;
	}

	.av-status {
		font-size: calc(12px * var(--fs-scale, 1));
		color: var(--sage, #6f9e7e);
		font-family: var(--ff-b);
	}
</style>
