import { describe, it, expect } from 'vitest';
import { afgoerUdfald, koebNavnFor, normaliserEmail, seromEmailUd } from './loginOpslag';

describe('normaliserEmail', () => {
	it('fjerner mellemrum og store bogstaver', () => {
		// Telefoner tilfoejer gerne et mellemrum efter autoudfyldning, og mange
		// skriver med stort. Begge dele ville ellers ramme forbi koebslisten.
		expect(normaliserEmail('  Mette@Eksempel.DK ')).toBe('mette@eksempel.dk');
	});
});

describe('seromEmailUd', () => {
	it('godtager en almindelig adresse', () => {
		expect(seromEmailUd('mette@eksempel.dk')).toBe(true);
	});

	it('afviser tom, uden snabel-a og uden punktum', () => {
		expect(seromEmailUd('')).toBe(false);
		expect(seromEmailUd('mette')).toBe(false);
		expect(seromEmailUd('mette@eksempel')).toBe(false);
	});
});

describe('koebNavnFor', () => {
	it('foretraekker forloebets eget navn', () => {
		expect(koebNavnFor('Kickstart August 2026', 'kickstart')).toBe('Kickstart August 2026');
	});

	it('falder tilbage paa produktet for abonnenter uden forloeb', () => {
		expect(koebNavnFor(null, 'basisabo')).toBe('Adgang til appen');
	});

	it('giver intet navn naar hverken forloeb eller produkt kendes', () => {
		expect(koebNavnFor(null, null)).toBeUndefined();
		expect(koebNavnFor('   ', 'et_ukendt_produkt')).toBeUndefined();
	});
});

describe('afgoerUdfald', () => {
	it('koeb men ingen konto -> hun skal vaelge en adgangskode', () => {
		const svar = afgoerUdfald({
			harKonto: false,
			harKoeb: true,
			forlobNavn: 'Kickstart August 2026'
		});
		expect(svar.udfald).toBe('nyKunde');
		expect(svar.koebNavn).toBe('Kickstart August 2026');
	});

	it('ingen konto og intet koeb -> vi kan ikke lukke hende ind', () => {
		expect(afgoerUdfald({ harKonto: false, harKoeb: false }).udfald).toBe('intetKoeb');
	});

	it('konto findes -> log ind', () => {
		expect(afgoerUdfald({ harKonto: true, harKoeb: true }).udfald).toBe('harKonto');
	});

	it('kontoen vinder over en ryddet koebsliste', () => {
		// En tidligere kunde staar ikke laengere paa koebslisten. Uden den her
		// regel ville hun faa "vi kan ikke finde et koeb" og vaere laast ude af
		// sit eget materiale.
		expect(afgoerUdfald({ harKonto: true, harKoeb: false }).udfald).toBe('harKonto');
	});

	it('roeber aldrig hvad en eksisterende kunde har koebt', () => {
		// Skaerm B viser kun emailen. Ellers kunne en fremmed taste en email og
		// se hvilket forloeb hun gaar paa.
		const svar = afgoerUdfald({
			harKonto: true,
			harKoeb: true,
			forlobNavn: 'Kickstart August 2026'
		});
		expect(svar.koebNavn).toBeUndefined();
	});
});
