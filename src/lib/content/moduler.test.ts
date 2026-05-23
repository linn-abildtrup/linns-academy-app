import { describe, it, expect } from 'vitest';
import { getModulerForUser } from './moduler';

describe('getModulerForUser', () => {
	describe('forløbskunde', () => {
		const moduler = getModulerForUser('forlobskunde');

		it('returnerer 6 moduler', () => {
			expect(moduler).toHaveLength(6);
		});

		it('har alle moduler aktive', () => {
			const aktive = moduler.filter((m) => m.status === 'aktiv');
			expect(aktive).toHaveLength(6);
		});

		it('har Mit forløb med progress over nul', () => {
			const forlob = moduler.find((m) => m.id === 'forlob');
			expect(forlob).toBeDefined();
			expect(forlob?.progress).toBeGreaterThan(0);
		});

		it('har Bibliotek uden progress (null)', () => {
			const bibliotek = moduler.find((m) => m.id === 'bibliotek');
			expect(bibliotek?.progress).toBeNull();
		});

		it('har subTekst på alle moduler', () => {
			moduler.forEach((m) => {
				expect(m.subTekst).toBeTruthy();
				expect(m.subTekst.length).toBeGreaterThan(0);
			});
		});

		it('har ingen låseTekst', () => {
			moduler.forEach((m) => {
				expect(m.laasTekst).toBeNull();
			});
		});
	});

	describe('modulbruger med gennemført forløb', () => {
		const moduler = getModulerForUser('modulbruger', { harGennemfoertForlob: true });

		it('returnerer 6 moduler', () => {
			expect(moduler).toHaveLength(6);
		});

		it('har Mit forløb låst med Kropsro-CTA', () => {
			const forlob = moduler.find((m) => m.id === 'forlob');
			expect(forlob?.status).toBe('laast');
			expect(forlob?.laasTekst).toBe('Tag næste skridt — Kropsro');
			expect(forlob?.subTekst).toBe('Du har gennemført Kickstart');
			expect(forlob?.kobUrl).toBe('https://linn.simplero.com/12uger');
		});

		it('har Bibliotek aktivt (personligt fra tidligere forløb)', () => {
			const bibliotek = moduler.find((m) => m.id === 'bibliotek');
			expect(bibliotek?.status).toBe('aktiv');
			expect(bibliotek?.laasTekst).toBeNull();
		});

		it('har Træning, Kost, Vaner og Bibliotek aktive', () => {
			const aktive = moduler.filter((m) => m.status === 'aktiv').map((m) => m.id);
			expect(aktive).toContain('traening');
			expect(aktive).toContain('kost');
			expect(aktive).toContain('vaner');
			expect(aktive).toContain('bibliotek');
		});

		it('har korrekt status-tekst på aktive moduler', () => {
			const traening = moduler.find((m) => m.id === 'traening');
			expect(traening?.statusTekst).toBe('Løbende');
		});

		it('viser Kropsro-CTA på låste moduler', () => {
			const laaste = moduler.filter((m) => m.status === 'laast');
			laaste.forEach((m) => {
				expect(m.laasTekst).toContain('Kropsro');
			});
		});
	});

	describe('modulbruger UDEN gennemført forløb', () => {
		const moduler = getModulerForUser('modulbruger');

		it('har Mit forløb låst med Kickstart-CTA (ikke Kropsro)', () => {
			const forlob = moduler.find((m) => m.id === 'forlob');
			expect(forlob?.status).toBe('laast');
			expect(forlob?.laasTekst).toBe('Start dit forløb — Kickstart');
			expect(forlob?.subTekst).not.toContain('gennemført');
			expect(forlob?.kobUrl).toBe('https://linn.simplero.com/21dage');
		});

		it('har samme 5 aktive moduler', () => {
			const aktive = moduler.filter((m) => m.status === 'aktiv').map((m) => m.id);
			expect(aktive).toContain('traening');
			expect(aktive).toContain('kost');
			expect(aktive).toContain('vaner');
			expect(aktive).toContain('bibliotek');
			expect(aktive).toContain('symptomcheck');
		});
	});

	describe('udlobet', () => {
		const moduler = getModulerForUser('udlobet');

		it('returnerer 6 moduler', () => {
			expect(moduler).toHaveLength(6);
		});

		it('har bibliotek aktivt (forevigt)', () => {
			const bib = moduler.find((m) => m.id === 'bibliotek');
			expect(bib?.status).toBe('aktiv');
		});

		it('har alle moduler undtagen bibliotek låst', () => {
			const traening = moduler.find((m) => m.id === 'traening');
			const kost = moduler.find((m) => m.id === 'kost');
			const vaner = moduler.find((m) => m.id === 'vaner');
			const forlob = moduler.find((m) => m.id === 'forlob');
			expect(traening?.status).toBe('laast');
			expect(kost?.status).toBe('laast');
			expect(vaner?.status).toBe('laast');
			expect(forlob?.status).toBe('laast');
		});

		it('forklarer hvor træningsøvelser og opskrifter er flyttet hen', () => {
			const traening = moduler.find((m) => m.id === 'traening');
			const kost = moduler.find((m) => m.id === 'kost');
			expect(traening?.subTekst).toContain('biblioteket');
			expect(kost?.subTekst).toContain('biblioteket');
		});

		it('har ingen progress på nogen moduler', () => {
			moduler.forEach((m) => {
				expect(m.progress).toBeNull();
			});
		});
	});

	describe('sortering og struktur', () => {
		it('returnerer Mit forløb som første modul', () => {
			const moduler = getModulerForUser('forlobskunde');
			expect(moduler[0].id).toBe('forlob');
		});

		it('returnerer Bibliotek som sidste modul', () => {
			const moduler = getModulerForUser('forlobskunde');
			expect(moduler[moduler.length - 1].id).toBe('bibliotek');
		});

		it('returnerer samme rækkefølge på tværs af brugertilstande', () => {
			const a = getModulerForUser('forlobskunde').map((m) => m.id);
			const b = getModulerForUser('modulbruger').map((m) => m.id);
			const c = getModulerForUser('udlobet').map((m) => m.id);
			expect(a).toEqual(b);
			expect(b).toEqual(c);
		});
	});
});
