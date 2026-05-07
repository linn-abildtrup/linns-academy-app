<script lang="ts">
	import { onMount } from 'svelte';
	import type { VaneProgram } from '$lib/content/vaner';
	import { hentAlleVaneProgrammer } from '$lib/firestore/vaner';
	import Icon from '$lib/components/Icon.svelte';

	let programmer = $state<VaneProgram[]>([]);
	let loading = $state(true);
	let fejl = $state<string | null>(null);

	onMount(async () => {
		try {
			programmer = await hentAlleVaneProgrammer();
		} catch (e) {
			console.error(e);
			fejl = 'Kunne ikke hente vaneprogrammer.';
		} finally {
			loading = false;
		}
	});
</script>

<div class="page">
	<header class="page-header">
		<a class="back" href="/app/admin">
			<Icon name="arrow-l" size={14} color="var(--text2)" />
			<span>Admin</span>
		</a>
		<div class="eyebrow">Admin · Vaner</div>
		<h1>Vaneprogrammer</h1>
		<p class="page-sub">Vælg et program for at redigere refleksioner, vaner og bonus pr dag.</p>
	</header>

	{#if loading}
		<div class="status-besked">Henter programmer...</div>
	{:else if fejl}
		<div class="status-besked fejl">{fejl}</div>
	{:else if programmer.length === 0}
		<div class="status-besked">
			Ingen programmer endnu. Kør <code>npm run seed:vaneprogram</code> for at oprette
			kickstart_v1.
		</div>
	{:else}
		<div class="program-liste">
			{#each programmer as program (program.id)}
				<a class="program-row" href="/app/admin/vaner/{program.id}">
					<div class="program-icon" class:inaktiv={!program.aktiv}>
						<Icon name="leaf" size={18} color="#fff" />
					</div>
					<div class="program-tekst">
						<div class="program-navn">
							{program.navn}
							{#if !program.aktiv}
								<span class="badge inaktiv">Inaktiv</span>
							{/if}
						</div>
						<div class="program-sub">
							{program.antalDage} dage · {program.beskrivelse}
						</div>
					</div>
					<Icon name="chevron-r" size={14} color="var(--text3)" />
				</a>
			{/each}
		</div>
	{/if}
</div>

<style>
	.page {
		padding: 18px 18px 100px;
		max-width: 520px;
		margin: 0 auto;
	}

	.page-header {
		margin-bottom: 18px;
	}

	.back {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-size: 12px;
		color: var(--text2);
		text-decoration: none;
		margin-bottom: 12px;
	}

	.back:hover {
		color: var(--text);
	}

	.eyebrow {
		font-size: 10px;
		font-weight: 600;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--text3);
	}

	h1 {
		font-family: var(--ff-d);
		font-size: 28px;
		font-weight: 600;
		letter-spacing: -0.02em;
		margin: 4px 0 0;
		line-height: 1.05;
		color: var(--text);
	}

	.page-sub {
		font-size: 13px;
		color: var(--text2);
		margin: 6px 0 0;
		line-height: 1.4;
	}

	.status-besked {
		padding: 14px 16px;
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 12px;
		color: var(--text2);
		font-size: 13px;
		text-align: center;
	}

	.status-besked.fejl {
		color: #8a4a3e;
		background: #fbeeea;
		border-color: #f0d6cf;
	}

	.status-besked code {
		background: var(--bg2);
		padding: 1px 6px;
		border-radius: 4px;
		font-size: 11.5px;
	}

	.program-liste {
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 14px;
		overflow: hidden;
	}

	.program-row {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 14px 14px;
		border-top: 1px solid var(--border);
		text-decoration: none;
		color: inherit;
	}

	.program-row:first-child {
		border-top: none;
	}

	.program-row:hover {
		background: var(--bg2);
	}

	.program-icon {
		width: 40px;
		height: 40px;
		border-radius: 11px;
		background: var(--sage);
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.program-icon.inaktiv {
		background: var(--text3);
	}

	.program-tekst {
		flex: 1;
		min-width: 0;
	}

	.program-navn {
		font-size: 14px;
		font-weight: 600;
		color: var(--text);
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.program-sub {
		font-size: 11.5px;
		color: var(--text3);
		margin-top: 2px;
		line-height: 1.35;
	}

	.badge {
		font-size: 9.5px;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		padding: 2px 7px;
		border-radius: 99px;
		font-weight: 600;
	}

	.badge.inaktiv {
		background: var(--bg2);
		color: var(--text3);
	}
</style>
