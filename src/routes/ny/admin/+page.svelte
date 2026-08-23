<script lang="ts">
	// ============================================================
	// Admin-forsiden i 3.0. Ét sted at trykke sig videre fra.
	//
	// Indtil nu har hver admin-side i 3.0 vaeret en adresse man skulle
	// skrive i haanden, fordi et menupunkt ville kraeve en rettelse i
	// den gamle app. Den her side loeser det uden at roere noget: den
	// er bare endnu en ny side under /ny.
	//
	// Alt det admin der IKKE er flyttet til 3.0 endnu ligger stadig i
	// den gamle app, og derfor staar der et link til den nederst. Uden
	// det ville siden ligne en fuld menu, og den er den ikke.
	// ============================================================

	import { getContext } from 'svelte';
	import type { User } from 'firebase/auth';
	import { isAdmin } from '$lib/admin';
	import Sidehoved from '$lib/components/ny/Sidehoved.svelte';

	const hentUser = getContext<() => User | null>('user');
	const user = $derived(hentUser());
	const maaVaereHer = $derived(isAdmin(user));

	interface Punkt {
		navn: string;
		under: string;
		href: string;
	}

	const traening: Punkt[] = [
		{
			navn: 'Træningsprogrammer',
			under: 'Byg programmer, fyld dagene ud, sæt dem til klar',
			href: '/ny/admin/traening'
		},
		{
			navn: 'Kategorier',
			under: 'Det udstyr kunden kan vælge imellem',
			href: '/ny/admin/traening/kategorier'
		},
		{
			navn: 'Hold og dækning',
			under: 'Hvem har fået hvad, og mangler nogen noget',
			href: '/ny/admin/traening/hold'
		},
		{
			navn: 'Slå en kunde op',
			under: 'Se hvad hun kan se, og hvorfor',
			href: '/ny/admin/traening/kunde'
		},
		{
			navn: 'Byg eget program',
			under: 'Hvem må sætte deres egen træning sammen',
			href: '/ny/admin/traening/byg-eget'
		}
	];

	const mad: Punkt[] = [
		{
			navn: 'Næring',
			under: 'Hvem ser udvidet næring, og hvem må rette sine mål',
			href: '/ny/admin/naering'
		},
		{
			navn: 'Ingredienser',
			under: 'Kobl opskrifternes ingredienser til fødevarerne',
			href: '/ny/admin/ingredienser'
		},
		{
			navn: 'Regnestykket bag en opskrift',
			under: 'Gå herhen når et makro-tal ser forkert ud',
			href: '/ny/admin/opskrift-makro'
		},
		{
			navn: 'Billeder på opskrifter',
			under: 'Læg et billede på én ret ad gangen',
			href: '/ny/admin/opskrift-billeder'
		}
	];

	const andet: Punkt[] = [
		{
			navn: 'Skriv til en kunde',
			under: 'Lander i hendes Beskeder. Hun kan svare',
			href: '/ny/admin/skriv'
		},
		{
			navn: 'Notifikationer',
			under: 'Beskeder på telefonen, og hvem der får dem',
			href: '/ny/admin/noti'
		},
		{
			navn: 'Challenges',
			under: 'Opret en challenge og giv den til et hold eller til alle',
			href: '/ny/admin/challenges'
		}
	];
</script>

<svelte:head><title>Admin · 3.0</title></svelte:head>

<div class="ny-pad adm">
	{#if !maaVaereHer}
		<div class="adm-kort">Siden er kun for admin.</div>
	{:else}
		<Sidehoved
			titel="Admin"
			tilbage="/ny/profil"
			tilbageTekst="Din side"
			under="Værktøjerne i den nye app. Resten ligger stadig i den gamle."
			kant={false}
		/>

		<h2 class="adm-gruppe">Træning</h2>
		<div class="adm-liste">
			{#each traening as p (p.href)}
				<a class="adm-raekke tr-raekke" href={p.href}>
					<div class="adm-raekke-t"><span>{p.navn}</span></div>
					<div class="adm-raekke-s">{p.under}</div>
				</a>
			{/each}
		</div>

		<h2 class="adm-gruppe">Mad</h2>
		<div class="adm-liste">
			{#each mad as p (p.href)}
				<a class="adm-raekke tr-raekke" href={p.href}>
					<div class="adm-raekke-t"><span>{p.navn}</span></div>
					<div class="adm-raekke-s">{p.under}</div>
				</a>
			{/each}
		</div>

		<h2 class="adm-gruppe">Andet</h2>
		<div class="adm-liste">
			{#each andet as p (p.href)}
				<a class="adm-raekke tr-raekke" href={p.href}>
					<div class="adm-raekke-t"><span>{p.navn}</span></div>
					<div class="adm-raekke-s">{p.under}</div>
				</a>
			{/each}
		</div>

		<h2 class="adm-gruppe">Den gamle admin</h2>
		<div class="adm-liste">
			<a class="adm-raekke tr-raekke" href="/app/admin">
				<div class="adm-raekke-t"><span>Gå til den gamle admin</span></div>
				<div class="adm-raekke-s">
					Kunder, forløb, lektioner, vaner, dashboard og alt det øvrige
				</div>
			</a>
		</div>

		<p class="adm-hjaelp">
			Siderne her rører kun 3.0. Kunderne i den gamle app mærker ingenting af det du gør herinde.
		</p>
	{/if}
</div>
