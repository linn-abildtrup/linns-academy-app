<script lang="ts">
	import { getContext } from 'svelte';
	import { page } from '$app/state';
	import type { User } from 'firebase/auth';
	import Icon, { type IconName } from '$lib/components/Icon.svelte';
	import type { UserDoc } from '$lib/types';
	import { isAdmin } from '$lib/admin';
	import { gemAdminKlientApp, gemAdminKlientForlob, ryAdminKlientMode } from '$lib/userDoc';
	import AdminKlientVaelger from '$lib/components/AdminKlientVaelger.svelte';
	import { effektivState } from '$lib/utils/userAdgang';

	type UserState = 'forlobskunde' | 'modulbruger' | 'udlobet';

	type NavItem = {
		id: string;
		label: string;
		icon: IconName;
		href?: string;
		onAction?: () => void;
		dot?: boolean;
		lockedFor?: UserState[];
	};

	const getUserDoc = getContext<() => UserDoc | null>('userDoc');
	const getUser = getContext<() => User | null>('user');
	const userDoc = $derived(getUserDoc?.());
	const user = $derived(getUser?.());

	const erAdmin = $derived(isAdmin(user ?? null));
	const erIKlientMode = $derived(!!userDoc?.adminKlientMode || !!userDoc?.adminKlientForlobId);
	const beskederHref = $derived(
		erAdmin && !erIKlientMode ? '/app/admin/spoergsmaal' : '/app/beskeder'
	);

	let viserKlientVaelger = $state(false);

	async function aabnKlientVaelger() {
		viserKlientVaelger = true;
	}

	async function vaelgKlientForlob(forlobId: string) {
		const u = user;
		if (!u) return;
		try {
			await gemAdminKlientForlob(u.uid, forlobId);
		} catch (e) {
			console.error('Kunne ikke skifte til klient-mode:', e);
		} finally {
			viserKlientVaelger = false;
		}
	}

	async function vaelgKlientApp(mode: 'basisapp' | 'premiumapp') {
		const u = user;
		if (!u) return;
		try {
			await gemAdminKlientApp(u.uid, mode);
		} catch (e) {
			console.error('Kunne ikke skifte til klient-mode:', e);
		} finally {
			viserKlientVaelger = false;
		}
	}

	async function tilbageTilAdmin() {
		const u = user;
		if (!u) return;
		try {
			await ryAdminKlientMode(u.uid);
		} catch (e) {
			console.error('Kunne ikke skifte tilbage til admin:', e);
		}
	}

	// Admin har to ekstra ikoner i tabbaren:
	//   1. 'Admin' — fast genvej til /app/admin. Kun synlig når IKKE i
	//      klient-mode (det giver ingen mening at gå til admin-siden mens
	//      man later som klient).
	//   2. 'Klient' / 'Tilbage' — toggler mellem klient-mode og admin-mode.
	//      Hedder 'Klient' i admin-mode, 'Admin' når i klient-mode.
	const adminIndstillinger = $derived<NavItem | null>(
		erAdmin && !erIKlientMode
			? {
					id: 'admin-indstillinger',
					label: 'Admin',
					icon: 'settings' as IconName,
					href: '/app/admin'
				}
			: null
	);

	const klientToggle = $derived<NavItem | null>(
		erAdmin
			? erIKlientMode
				? {
						id: 'tilbage-admin',
						label: 'Tilbage',
						icon: 'arrow-l' as IconName,
						onAction: tilbageTilAdmin
					}
				: {
						id: 'skift-klient',
						label: 'Klient',
						icon: 'user' as IconName,
						onAction: aabnKlientVaelger
					}
			: null
	);

	// Klient-tabs (Forside/Moduler/Udvikling) skjules når admin er i normal
	// admin-mode — de hører til klient-oplevelsen og er irrelevante for
	// admin-arbejdet. De vises igen for almindelige klienter, og når admin
	// skifter til klient-mode for at teste flow.
	const skjulKlientTabs = $derived(erAdmin && !erIKlientMode);

	const NAV_ITEMS = $derived<NavItem[]>([
		...(skjulKlientTabs
			? []
			: [
					{ id: 'home', label: 'Forside', icon: 'home' as IconName, href: '/app' },
					{ id: 'moduler', label: 'Moduler', icon: 'grid' as IconName, href: '/app/moduler' },
					{
						id: 'udvikling',
						label: 'Udvikling',
						icon: 'fire' as IconName,
						href: '/app/udvikling',
						lockedFor: ['udlobet' as const]
					}
				]),
		{
			id: 'beskeder',
			label: 'Beskeder',
			icon: 'mail',
			href: beskederHref,
			dot: true,
			// Beskeder er en del af forløbskunde-relationen til Linn — ikke
			// inkluderet i basis/modulbruger-abonnementet. Admin overrides
			// nedenfor så vi (Linn) altid kan svare på spørgsmål.
			lockedFor: ['udlobet', 'modulbruger']
		},
		...(adminIndstillinger ? [adminIndstillinger] : []),
		...(klientToggle ? [klientToggle] : []),
		{ id: 'profil', label: 'Profil', icon: 'user', href: '/app/profil' }
	]);

	function isActive(item: NavItem, pathname: string): boolean {
		if (!item.href) return false;
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
			// Admin (i admin-mode) skal aldrig have låste tabs — selv om Linns
			// egen state er 'modulbruger' skal hun stadig kunne åbne admin-
			// spørgsmål-fanen. I klient-mode honoreres låsene normalt.
			locked:
				erAdmin && !erIKlientMode
					? false
					: isLocked(item, effektivState(userDoc) ?? undefined)
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
		{:else if item.onAction}
			<button class="tab tab-action" type="button" onclick={item.onAction}>
				<span class="icon-wrap">
					<Icon name={item.icon} size={20} />
				</span>
				<span class="label">{item.label}</span>
			</button>
		{:else if item.href}
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

{#if viserKlientVaelger}
	<AdminKlientVaelger
		aktivtForlobId={userDoc?.adminKlientForlobId}
		aktivMode={userDoc?.adminKlientMode}
		onVaelgForlob={vaelgKlientForlob}
		onVaelgApp={vaelgKlientApp}
		onClose={() => (viserKlientVaelger = false)}
	/>
{/if}

<style>
	.tabbar {
		border-top: 1px solid var(--border);
		background: var(--white);
		display: flex;
		padding: 8px 4px max(18px, env(safe-area-inset-bottom));
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

	.tab-action {
		font-family: inherit;
		cursor: pointer;
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
		font-size: calc(9.5px * var(--fs-scale, 1));
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
