<script lang="ts">
	import { getContext } from 'svelte';
	import { page } from '$app/state';
	import type { User } from 'firebase/auth';
	import Icon, { type IconName } from '$lib/components/Icon.svelte';
	import type { UserDoc } from '$lib/types';
	import { isAdmin } from '$lib/admin';

	type UserState = 'forlobskunde' | 'modulbruger' | 'udlobet';

	type NavItem = {
		id: string;
		label: string;
		icon: IconName;
		href: string;
		dot?: boolean;
		lockedFor?: UserState[];
	};

	const ADMIN_ITEM: NavItem = {
		id: 'admin',
		label: 'Admin',
		icon: 'settings',
		href: '/app/admin'
	};

	const FAELLESSKAB_ITEM: NavItem = {
		id: 'faellesskab',
		label: 'Fællesskab',
		icon: 'community',
		href: '/app/faellesskab',
		lockedFor: ['udlobet']
	};

	const getUserDoc = getContext<() => UserDoc | null>('userDoc');
	const getUser = getContext<() => User | null>('user');
	const userDoc = $derived(getUserDoc?.());
	const user = $derived(getUser?.());

	const NAV_ITEMS = $derived<NavItem[]>([
		{ id: 'home', label: 'Forside', icon: 'home', href: '/app' },
		{ id: 'moduler', label: 'Moduler', icon: 'grid', href: '/app/moduler' },
		{
			id: 'beskeder',
			label: 'Beskeder',
			icon: 'mail',
			href: '/app/beskeder',
			dot: true,
			lockedFor: ['udlobet']
		},
		isAdmin(user ?? null) ? ADMIN_ITEM : FAELLESSKAB_ITEM,
		{ id: 'profil', label: 'Profil', icon: 'user', href: '/app/profil' }
	]);

	function isActive(item: NavItem, pathname: string): boolean {
		if (item.href === '/app') {
			return pathname === '/app' || pathname === '/app/';
		}
		return pathname === item.href || pathname.startsWith(item.href + '/');
	}

	function isLocked(item: NavItem, state: UserState | undefined): boolean {
		if (!state || !item.lockedFor) return false;
		return item.lockedFor.includes(state);
	}

	const items = $derived(
		NAV_ITEMS.map((item) => ({
			...item,
			active: isActive(item, page.url.pathname),
			locked: isLocked(item, userDoc?.state as UserState | undefined)
		}))
	);
</script>

<nav class="tabbar" aria-label="Hovednavigation">
	{#each items as item (item.id)}
		{#if item.locked}
			<span class="tab tab-locked" aria-disabled="true" title="Kræver aktivt abonnement">
				<span class="icon-wrap">
					<Icon name={item.icon} size={20} color="var(--text4)" />
					<span class="lock-badge" aria-hidden="true">
						<Icon name="lock" size={8} color="var(--text3)" />
					</span>
				</span>
				<span class="label">{item.label}</span>
			</span>
		{:else}
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
		{/if}
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

	.tab-locked {
		color: var(--text4);
		cursor: not-allowed;
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

	.lock-badge {
		position: absolute;
		bottom: -3px;
		right: -4px;
		width: 14px;
		height: 14px;
		border-radius: 50%;
		background: var(--bg2);
		border: 1.5px solid var(--white);
		display: flex;
		align-items: center;
		justify-content: center;
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
