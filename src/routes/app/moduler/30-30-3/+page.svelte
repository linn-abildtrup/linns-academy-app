<script lang="ts">
	import Icon from '$lib/components/Icon.svelte';

	const undermoduler = [
		{
			id: 'beregner',
			navn: '30-30-3 beregner',
			beskrivelse: 'Slå fødevarer op og byg måltider mod dit 30g protein-mål',
			rute: '/app/moduler/30-30-3/beregner',
			accent: '#B87B6E',
			icon: 'leaf' as const
		},
		{
			id: 'opskrifter',
			navn: 'Opskrifter',
			beskrivelse: 'Linns opskrifter med protein og fiber i fokus',
			rute: '/app/moduler/30-30-3/opskrifter',
			accent: '#6F9E7E',
			icon: 'book' as const
		}
	];
</script>

<div class="page">
	<header class="page-header">
		<a class="back" href="/app/moduler">
			<Icon name="arrow-l" size={14} color="var(--text2)" />
			<span>Moduler</span>
		</a>
		<div class="eyebrow">Kost</div>
		<h1>30-30-3</h1>
		<p class="page-sub">
			30g protein til morgenmad. 30g fiber pr dag. 3 minutters mikrotræning. Brug beregneren
			til at ramme dit protein-mål, og find opskrifter der hjælper dig på vej.
		</p>
	</header>

	<div class="liste">
		{#each undermoduler as u (u.id)}
			<a class="row" href={u.rute}>
				<div class="ikon" style="background: {u.accent};">
					<Icon name={u.icon} size={18} color="#fff" />
				</div>
				<div class="tekst">
					<div class="navn">{u.navn}</div>
					<div class="sub">{u.beskrivelse}</div>
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
		font-size: 32px;
		font-weight: 600;
		letter-spacing: -0.02em;
		margin: 4px 0 0;
		line-height: 1.05;
		color: var(--text);
	}

	.page-sub {
		font-size: 13px;
		color: var(--text2);
		margin: 8px 0 0;
		line-height: 1.5;
	}

	.liste {
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 14px;
		overflow: hidden;
	}

	.row {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 14px 14px;
		border-top: 1px solid var(--border);
		text-decoration: none;
		color: inherit;
	}

	.row:first-child {
		border-top: none;
	}

	.row:hover {
		background: var(--bg2);
	}

	.ikon {
		width: 40px;
		height: 40px;
		border-radius: 11px;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.tekst {
		flex: 1;
		min-width: 0;
	}

	.navn {
		font-size: 14px;
		font-weight: 600;
		color: var(--text);
	}

	.sub {
		font-size: 11.5px;
		color: var(--text3);
		margin-top: 2px;
		line-height: 1.35;
	}
</style>
