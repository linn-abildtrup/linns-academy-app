<script lang="ts">
	import Icon from '$lib/components/Icon.svelte';

	const omraader = [
		{
			id: 'forlob',
			navn: 'Forløb',
			beskrivelse: 'Opret runder, upload whitelist og rediger forløbets vaneprogram',
			rute: '/app/admin/forlob',
			accent: '#B87B6E',
			icon: 'cal' as const
		},
		{
			id: 'opskrifter',
			navn: 'Opskrifter',
			beskrivelse: 'Opret og rediger opskrifter til 30-30-3-modulet',
			rute: '/app/admin/opskrifter',
			accent: '#6F9E7E',
			icon: 'book' as const
		},
		{
			id: 'mikrotraening',
			navn: 'Mikrotræning',
			beskrivelse: 'Rediger træningsprogrammer og dage',
			rute: '/app/admin/mikrotraening',
			accent: '#C9A07A',
			icon: 'flame' as const
		}
	];
</script>

<div class="page">
	<header class="page-header">
		<div class="eyebrow">Admin</div>
		<h1>Indstillinger</h1>
		<p class="page-sub">Rediger indhold der vises til kunderne.</p>
	</header>

	<div class="omraade-liste">
		{#each omraader as omraade (omraade.id)}
			<a class="omraade-row" href={omraade.rute}>
				<div class="omraade-icon" style="background: {omraade.accent};">
					<Icon name={omraade.icon} size={18} color="#fff" />
				</div>
				<div class="omraade-tekst">
					<div class="omraade-navn">{omraade.navn}</div>
					<div class="omraade-sub">{omraade.beskrivelse}</div>
				</div>
				<Icon name="chevron-r" size={14} color="var(--text3)" />
			</a>
		{/each}
	</div>
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

	.omraade-liste {
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 14px;
		overflow: hidden;
	}

	.omraade-row {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 14px 14px;
		border-top: 1px solid var(--border);
		text-decoration: none;
		color: inherit;
	}

	.omraade-row:first-child {
		border-top: none;
	}

	.omraade-row:hover {
		background: var(--bg2);
	}

	.omraade-icon {
		width: 40px;
		height: 40px;
		border-radius: 11px;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.omraade-tekst {
		flex: 1;
		min-width: 0;
	}

	.omraade-navn {
		font-size: 14px;
		font-weight: 600;
		color: var(--text);
	}

	.omraade-sub {
		font-size: 11.5px;
		color: var(--text3);
		margin-top: 2px;
		line-height: 1.35;
	}
</style>
