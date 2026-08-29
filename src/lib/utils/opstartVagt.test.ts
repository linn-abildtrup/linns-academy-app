import { describe, it, expect } from 'vitest';
import { AERLIG_SKAERM_MS, boerNulstille, VAGT_MS } from './opstartVagt';

describe('boerNulstille', () => {
	it('rydder og genstarter naar appen er sat fast uden ét eneste kald', () => {
		// Kendetegnet fra maalingen 29. august: Auth svarede, og derefter
		// blev der ikke sendt noget som helst til databasen.
		expect(boerNulstille({ stadigIGang: true, harKontakt: false, alleredeNulstillet: false })).toBe(
			true
		);
	});

	it('roerer IKKE en kunde med daarligt signal', () => {
		// Er der kald undervejs, arbejder appen. En kunde i toget maa aldrig
		// faa sit lager ryddet, bare fordi serveren er lidt om det.
		expect(boerNulstille({ stadigIGang: true, harKontakt: true, alleredeNulstillet: false })).toBe(
			false
		);
	});

	it('genstarter aldrig to gange i samme session', () => {
		// En app der genstarter sig selv i ring er vaerre end en der staar stille.
		expect(boerNulstille({ stadigIGang: true, harKontakt: false, alleredeNulstillet: true })).toBe(
			false
		);
	});

	it('goer intet naar opstarten allerede er faerdig', () => {
		expect(
			boerNulstille({ stadigIGang: false, harKontakt: false, alleredeNulstillet: false })
		).toBe(false);
	});
});

describe('tidsgraenserne', () => {
	it('vagten slaar til foer den aerlige skaerm', () => {
		// Ellers ville kunden se "det tager laengere end normalt" et oejeblik
		// foer appen selv naaede at loese problemet.
		expect(VAGT_MS).toBeLessThan(AERLIG_SKAERM_MS);
	});

	it('vagten ligger langt over en normal opstart', () => {
		// Den normale kunde er inde paa under to sekunder, og den hurtige
		// opstart lukker hende ind paa kopien efter 2,5.
		expect(VAGT_MS).toBeGreaterThan(5000);
	});
});
