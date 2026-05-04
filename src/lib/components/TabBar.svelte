<script lang="ts">
	import { page } from '$app/state';
	import Icon, { type IconName } from '$lib/components/Icon.svelte';

	type NavItem = {
		id: string;
		label: string;
		icon: IconName;
		href: string;
		dot?: boolean;
	};

	const NAV_ITEMS: NavItem[] = [
		{ id: 'home', label: 'Forside', icon: 'home', href: '/app' },
		{ id: 'moduler', label: 'Moduler', icon: 'grid', href: '/app/moduler' },
		{ id: 'beskeder', label: 'Beskeder', icon: 'mail', href: '/app/beskeder', dot: true },
		{ id: 'faellesskab', label: 'Fællesskab', icon: 'community', href: '/app/faellesskab' },
		{ id: 'profil', label: 'Profil', icon: 'user', href: '/app/profil' }
	];

	function isActive(item: NavItem, pathname: string): boolean {
		if (item.href === '/app') {
			return pathname === '/app' || pathname === '/app/';
		}
		return pathname === item.href || pathname.startsWith(item.href + '/');
	}

	const items = $derived(
		NAV_ITEMS.map((item) => ({
			...item,
			active: isActive(item, page.url.pathname)
		}))
	);
</script>

<nav class="tabbar" aria-label="Hovednavigation">
	{#each items as item (item.id)}
		<a
			href={item.href}
			class="tab"
			class:active={item.active}
			aria-current={item.active ? 'page' : undefined}
		>
			<span class="icon-wrap">
				<Icon name={item.icon} size={20} />
				{#if item.dot}
					<span class="dot" aria-hidden="true"></span>
				{/if}
			</span>
			<span class="label">{item.label}</span>
			{#if item.active}
				<span class="active-marker" aria-hidden="true"></span>
			{/if}
		</a>
	{/each}
</nav>

<style>
	.tabbar {
		border-top: 1px solid var(--border);
		background: var(--white);
		display: flex;
		padding: 8px 4px 18px;
		flex-shrink: 0;
	}

	.tab {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 3px;
		background: none;
		border: none;
		padding: 6px 2px;
		color: var(--text3);
		position: relative;
		text-decoration: none;
	}

	.tab.active {
		color: var(--terra);
	}

	.icon-wrap {
		position: relative;
		display: inline-flex;
	}

	.dot {
		position: absolute;
		top: -2px;
		right: -3px;
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--terra);
		border: 1.5px solid var(--white);
	}

	.label {
		font-size: 9.5px;
		font-weight: 500;
	}

	.tab.active .label {
		font-weight: 600;
	}

	.active-marker {
		position: absolute;
		bottom: -2px;
		width: 4px;
		height: 4px;
		border-radius: 50%;
		background: var(--terra);
	}
</style>
