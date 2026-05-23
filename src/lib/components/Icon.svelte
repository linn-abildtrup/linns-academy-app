<script lang="ts" module>
	export type IconName =
		| 'home'
		| 'path'
		| 'book'
		| 'user'
		| 'play'
		| 'pause'
		| 'lock'
		| 'check'
		| 'mic'
		| 'headphones'
		| 'video'
		| 'doc'
		| 'quiz'
		| 'community'
		| 'live'
		| 'fire'
		| 'arrow'
		| 'arrow-l'
		| 'menu'
		| 'bell'
		| 'plus'
		| 'star'
		| 'sparkle'
		| 'lightbulb'
		| 'cal'
		| 'settings'
		| 'search'
		| 'chevron-r'
		| 'chevron-d'
		| 'flower'
		| 'grid'
		| 'mail'
		| 'moon'
		| 'flame'
		| 'leaf'
		| 'lightning'
		| 'unlock'
		| 'kettlebell'
		| 'stretch'
		| 'workout'
		| 'barcode'
		| 'trash';
</script>

<script lang="ts">
	let {
		name,
		size = 20,
		color = 'currentColor',
		filled = false
	}: {
		name: IconName;
		size?: number;
		color?: string;
		filled?: boolean;
	} = $props();
</script>

<svg
	width={size}
	height={size}
	viewBox="0 0 24 24"
	stroke={color}
	fill={filled ? color : 'none'}
	stroke-width="1.6"
	stroke-linecap="round"
	stroke-linejoin="round"
>
	{#if name === 'home'}
		<path d="M3 11l9-7 9 7v9a2 2 0 0 1-2 2h-4v-6h-6v6H5a2 2 0 0 1-2-2z" />
	{:else if name === 'path'}
		<circle cx="6" cy="6" r="2.5" />
		<circle cx="18" cy="18" r="2.5" />
		<path d="M6 8.5C6 13 18 11 18 15.5" />
	{:else if name === 'book'}
		<path d="M4 5a2 2 0 0 1 2-2h13v18H6a2 2 0 0 1-2-2z" />
		<path d="M4 18h15" />
	{:else if name === 'user'}
		<circle cx="12" cy="8" r="4" />
		<path d="M4 21c1-4 4-6 8-6s7 2 8 6" />
	{:else if name === 'play'}
		<path d="M7 5l12 7-12 7z" fill={color} />
	{:else if name === 'pause'}
		<rect x="6" y="5" width="4" height="14" rx="1" fill={color} />
		<rect x="14" y="5" width="4" height="14" rx="1" fill={color} />
	{:else if name === 'lock'}
		<rect x="5" y="11" width="14" height="10" rx="2" />
		<path d="M8 11V8a4 4 0 0 1 8 0v3" />
	{:else if name === 'check'}
		<path d="M5 13l4 4L19 7" />
	{:else if name === 'mic'}
		<rect x="9" y="3" width="6" height="11" rx="3" />
		<path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
	{:else if name === 'headphones'}
		<path d="M4 14a8 8 0 0 1 16 0" />
		<rect x="3" y="13" width="4" height="7" rx="1.5" />
		<rect x="17" y="13" width="4" height="7" rx="1.5" />
	{:else if name === 'video'}
		<rect x="3" y="6" width="13" height="12" rx="2" />
		<path d="M16 10l5-3v10l-5-3z" />
	{:else if name === 'doc'}
		<path d="M6 3h8l5 5v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
		<path d="M14 3v5h5" />
	{:else if name === 'quiz'}
		<circle cx="12" cy="12" r="9" />
		<path d="M9 9a3 3 0 1 1 4 2.8c-.8.4-1 .9-1 1.7M12 17h.01" />
	{:else if name === 'community'}
		<circle cx="9" cy="9" r="3" />
		<path d="M3 19c1-3 3-4 6-4s5 1 6 4" />
		<circle cx="17" cy="7" r="2.5" />
		<path d="M15 14c2 0 4 .8 5 3" />
	{:else if name === 'live'}
		<circle cx="12" cy="12" r="3" fill={color} />
		<path d="M5 5a10 10 0 0 0 0 14M19 5a10 10 0 0 1 0 14M8 8a6 6 0 0 0 0 8M16 8a6 6 0 0 1 0 8" />
	{:else if name === 'fire'}
		<path d="M12 3c1 4 5 5 5 10a5 5 0 1 1-10 0c0-2 1-3 1-5 2 1 3 0 4-5z" />
	{:else if name === 'arrow'}
		<path d="M5 12h14M13 6l6 6-6 6" />
	{:else if name === 'arrow-l'}
		<path d="M19 12H5M11 6l-6 6 6 6" />
	{:else if name === 'menu'}
		<path d="M4 7h16M4 12h16M4 17h16" />
	{:else if name === 'bell'}
		<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15zM10 21a2 2 0 0 0 4 0" />
	{:else if name === 'plus'}
		<path d="M12 5v14M5 12h14" />
	{:else if name === 'star'}
		<path
			d="M12 3l2.5 6 6.5.6-5 4.5 1.5 6.4L12 17l-5.5 3.5L8 14.1 3 9.6l6.5-.6z"
			fill={filled ? color : 'none'}
		/>
	{:else if name === 'sparkle'}
		<path d="M12 3v6M12 15v6M3 12h6M15 12h6M6 6l3 3M15 15l3 3M18 6l-3 3M9 15l-3 3" />
	{:else if name === 'lightbulb'}
		<path d="M9 18h6M10 21h4" />
		<path d="M12 3a6 6 0 0 1 4 10.5c-.8.7-1 1.4-1 2.5H9c0-1.1-.2-1.8-1-2.5A6 6 0 0 1 12 3z" />
	{:else if name === 'cal'}
		<rect x="3" y="5" width="18" height="16" rx="2" />
		<path d="M3 10h18M8 3v4M16 3v4" />
	{:else if name === 'settings'}
		<circle cx="12" cy="12" r="3" />
		<path
			d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h0a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v0a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"
		/>
	{:else if name === 'search'}
		<circle cx="11" cy="11" r="7" />
		<path d="M21 21l-5-5" />
	{:else if name === 'chevron-r'}
		<path d="M9 6l6 6-6 6" />
	{:else if name === 'chevron-d'}
		<path d="M6 9l6 6 6-6" />
	{:else if name === 'flower'}
		<circle cx="12" cy="12" r="2.5" fill={color} />
		<path
			d="M12 9.5C12 6 13 4 15 4s3 1 3 3-2 3-6 2.5zM12 14.5c0 3.5 1 5.5 3 5.5s3-1 3-3-2-3-6-2.5zM9.5 12c-3.5 0-5.5 1-5.5 3s1 3 3 3 3-2 2.5-6zM14.5 12c3.5 0 5.5-1 5.5-3s-1-3-3-3-3 2-2.5 6z"
		/>
	{:else if name === 'grid'}
		<rect x="4" y="4" width="7" height="7" rx="1.5" />
		<rect x="13" y="4" width="7" height="7" rx="1.5" />
		<rect x="4" y="13" width="7" height="7" rx="1.5" />
		<rect x="13" y="13" width="7" height="7" rx="1.5" />
	{:else if name === 'mail'}
		<rect x="3" y="5" width="18" height="14" rx="2" />
		<path d="M3 7l9 6 9-6" />
	{:else if name === 'moon'}
		<path d="M20 14A8 8 0 0 1 10 4a8 8 0 1 0 10 10z" />
	{:else if name === 'flame'}
		<path d="M12 3c1 4 5 5 5 10a5 5 0 1 1-10 0c0-2 1-3 1-5 2 1 3 0 4-5z" />
	{:else if name === 'leaf'}
		<path d="M5 19c0-8 7-14 15-14 0 9-6 15-15 15zM5 19l8-8" />
	{:else if name === 'lightning'}
		<path d="M13 3L4 14h7l-1 7 9-11h-7z" />
	{:else if name === 'unlock'}
		<rect x="5" y="11" width="14" height="10" rx="2" />
		<path d="M8 11V8a4 4 0 0 1 7-2.5" />
	{:else if name === 'kettlebell'}
		<path d="M8 9a4 4 0 0 1 8 0" />
		<path d="M10 9a2 2 0 0 1 4 0" />
		<circle cx="12" cy="15" r="5" />
	{:else if name === 'stretch'}
		<circle cx="12" cy="4.5" r="1.6" />
		<path d="M12 6.5v7" />
		<path d="M6 10l6-1.5 6 1.5" />
		<path d="M9 20l3-6.5 3 6.5" />
	{:else if name === 'workout'}
		<circle cx="12" cy="4.5" r="1.8" />
		<path d="M12 6.5v8" />
		<path d="M12 8.5 L6.5 4.5 M12 8.5 L17.5 4.5" />
		<path d="M12 14.5 L8 21 M12 14.5 L16 21" />
	{:else if name === 'barcode'}
		<rect x="3.5" y="5" width="1.4" height="14" fill={color} stroke="none" />
		<rect x="6" y="5" width="2.4" height="14" fill={color} stroke="none" />
		<rect x="9.5" y="5" width="1.4" height="14" fill={color} stroke="none" />
		<rect x="12" y="5" width="1.4" height="14" fill={color} stroke="none" />
		<rect x="14.5" y="5" width="2.8" height="14" fill={color} stroke="none" />
		<rect x="18.5" y="5" width="1.4" height="14" fill={color} stroke="none" />
	{:else if name === 'trash'}
		<path d="M4 7h16" />
		<path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
		<path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12" />
		<path d="M10 11v6" />
		<path d="M14 11v6" />
	{/if}
</svg>
