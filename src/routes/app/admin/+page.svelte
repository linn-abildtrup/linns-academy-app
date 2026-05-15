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
			id: 'traening',
			navn: 'Træningsmodul',
			beskrivelse: 'Øvelsesbank — opret og rediger øvelser til mikrotræningsprogrammer',
			rute: '/app/admin/traening',
			accent: '#C9A07A',
			icon: 'flame' as const
		},
		{
			id: 'spoergsmaal',
			navn: 'Spørgsmål fra klienter',
			beskrivelse: 'Læs, sortér og eksportér klienternes spørgsmål',
			rute: '/app/admin/spoergsmaal',
			accent: '#5C7A8C',
			icon: 'mail' as const
		},
		{
			id: 'fodevarer',
			navn: 'Fællesskabs-fødevarer',
			beskrivelse: 'Se fødevarer scannet af brugere — verificér eller slet',
			rute: '/app/admin/fodevarer',
			accent: '#B8956A',
			icon: 'community' as const
		},
		{
			id: 'abo-vaner',
			navn: 'Abo-vaner',
			beskrivelse: 'Vaneliste og bonus-pulje for basis/premium-abonnenter',
			rute: '/app/admin/abo-vaner',
			accent: '#7E9BB3',
			icon: 'flower' as const
		},
		{
			id: 'abo-traening',
			navn: 'Abo-træning',
			beskrivelse: 'Auto-genereret mikrotræning for abonnenter',
			rute: '/app/admin/abo-traening',
			accent: '#A37F66',
			icon: 'flame' as const
		},
		{
			id: 'linn-ai',
			navn: 'Linn AI — videnbase',
			beskrivelse: 'Upload PDFs og slides som AI\'en bruger til at svare premium-klienter',
			rute: '/app/admin/linn-ai',
			accent: '#5C7A8C',
			icon: 'sparkle' as const
		},
		{
			id: 'modulbruger-lektioner',
			navn: 'Modulbruger-lektioner',
			beskrivelse: 'Daglige lektioner der vises på basis/premium-app-brugernes forside',
			rute: '/app/admin/modulbruger-lektioner',
			accent: '#9D6358',
			icon: 'book' as const
		},
		{
			id: 'ai-ratings',
			navn: 'AI-ratings',
			beskrivelse: 'Se klienternes ratings af Linn AI- og App-hjælp-svar',
			rute: '/app/admin/ai-ratings',
			accent: '#C9A07A',
			icon: 'star' as const
		},
		{
			id: 'abonnenter',
			navn: 'Abonnenter',
			beskrivelse: 'Se alle basis- og premium-abonnenter (allowedEmails fra Simplero)',
			rute: '/app/admin/abonnenter',
			accent: '#7E9BB3',
			icon: 'user' as const
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
		font-size: calc(10px * var(--fs-scale, 1));
		font-weight: 600;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--text3);
	}

	h1 {
		font-family: var(--ff-d);
		font-size: calc(28px * var(--fs-scale, 1));
		font-weight: 600;
		letter-spacing: -0.02em;
		margin: 4px 0 0;
		line-height: 1.05;
		color: var(--text);
	}

	.page-sub {
		font-size: calc(13px * var(--fs-scale, 1));
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
		font-size: calc(14px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--text);
	}

	.omraade-sub {
		font-size: calc(11.5px * var(--fs-scale, 1));
		color: var(--text3);
		margin-top: 2px;
		line-height: 1.35;
	}
</style>
