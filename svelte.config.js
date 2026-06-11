import adapter from '@sveltejs/adapter-cloudflare';

// Læsbar build-version (dato + tid, UTC) sat ved build-tidspunktet. Vises til
// kunderne nederst på profil-siden (App-version) og bruges af SvelteKit til at
// detektere nye deploys. Gør support nemmere: vi kan se hvilken version en
// kunde er på når hun rapporterer et problem.
const BYG_VERSION = new Date().toISOString().slice(0, 16).replace('T', ' ');

/** @type {import('@sveltejs/kit').Config} */
const config = {
	compilerOptions: {
		// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
		runes: ({ filename }) => (filename.split(/[/\\]/).includes('node_modules') ? undefined : true)
	},
	kit: {
		// adapter-auto only supports some environments, see https://svelte.dev/docs/kit/adapter-auto for a list.
		// If your environment is not supported, or you settled on a specific environment, switch out the adapter.
		// See https://svelte.dev/docs/kit/adapters for more information about adapters.
		adapter: adapter(),
		version: { name: BYG_VERSION }
	}
};

export default config;
