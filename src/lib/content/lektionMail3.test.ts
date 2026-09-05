import { describe, it, expect } from 'vitest';
import { filnavnFor3, lektionMail3 } from './lektionMail3';

describe('filnavnFor3', () => {
	it('skriver de danske tegn om, saa filnavnet overlever enhver telefon', () => {
		expect(filnavnFor3('Når sulten ikke er sult')).toBe('naar-sulten-ikke-er-sult.pdf');
	});

	it('samler tegnsaetning til én streg og lader den ikke staa i enden', () => {
		expect(filnavnFor3('Dag 4: mad, ro & søvn!')).toBe('dag-4-mad-ro-soevn.pdf');
	});

	it('falder tilbage naar titlen er tom eller kun er tegn', () => {
		expect(filnavnFor3('')).toBe('lektion.pdf');
		expect(filnavnFor3('***')).toBe('lektion.pdf');
	});

	it('holder navnet kort', () => {
		expect(filnavnFor3('a'.repeat(200)).length).toBeLessThanOrEqual(64);
	});
});

describe('lektionMail3', () => {
	it('bruger lektionens navn som emne, saa hun kan finde den igen', () => {
		expect(lektionMail3('Når sulten ikke er sult').emne).toBe('Når sulten ikke er sult');
	});

	it('har en ren tekst-udgave ved siden af', () => {
		const m = lektionMail3('Dag 4');
		expect(m.tekst).toContain('Dag 4');
		expect(m.tekst).toContain('Linn');
	});

	it('falder tilbage til noget laeseligt naar titlen mangler', () => {
		expect(lektionMail3('   ').emne).toBe('Din lektion');
	});

	it('lukker ikke maerker ind i mailens html', () => {
		expect(lektionMail3('<script>x</script>').html).not.toContain('<script>');
	});
});
