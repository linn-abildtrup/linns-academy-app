import { describe, it, expect } from 'vitest';
import {
	anslaaetVarighedMinutter,
	validerProgram,
	type CustomProgram
} from './mineProgrammer';

const gyldigt: Pick<CustomProgram, 'navn' | 'oevelser'> = {
	navn: 'Mit ben-program',
	oevelser: [
		{ exerciseId: 'squat', saet: 3, arbejdsSec: 30, pauseSec: 15 },
		{ exerciseId: 'lunges', saet: 3, arbejdsSec: 40, pauseSec: 20 }
	]
};

describe('validerProgram', () => {
	it('godkender et gyldigt program', () => {
		expect(validerProgram(gyldigt)).toBeNull();
	});

	it('afviser tomt navn', () => {
		expect(validerProgram({ ...gyldigt, navn: '   ' })).toMatch(/navn/i);
	});

	it('afviser for langt navn', () => {
		expect(validerProgram({ ...gyldigt, navn: 'a'.repeat(61) })).toMatch(/60 tegn/);
	});

	it('afviser program uden øvelser', () => {
		expect(validerProgram({ ...gyldigt, oevelser: [] })).toMatch(/mindst én/);
	});

	it('afviser øvelse uden exerciseId', () => {
		expect(
			validerProgram({
				...gyldigt,
				oevelser: [{ exerciseId: '', saet: 3, arbejdsSec: 30, pauseSec: 15 }]
			})
		).toMatch(/reference/);
	});

	it('afviser ugyldigt antal sæt', () => {
		expect(
			validerProgram({
				...gyldigt,
				oevelser: [{ exerciseId: 'squat', saet: 0, arbejdsSec: 30, pauseSec: 15 }]
			})
		).toMatch(/sæt/);
		expect(
			validerProgram({
				...gyldigt,
				oevelser: [{ exerciseId: 'squat', saet: 21, arbejdsSec: 30, pauseSec: 15 }]
			})
		).toMatch(/sæt/);
	});

	it('afviser ugyldig arbejdstid', () => {
		expect(
			validerProgram({
				...gyldigt,
				oevelser: [{ exerciseId: 'squat', saet: 3, arbejdsSec: 4, pauseSec: 15 }]
			})
		).toMatch(/[Aa]rbejdstid/);
		expect(
			validerProgram({
				...gyldigt,
				oevelser: [{ exerciseId: 'squat', saet: 3, arbejdsSec: 601, pauseSec: 15 }]
			})
		).toMatch(/[Aa]rbejdstid/);
	});

	it('afviser ugyldig pause', () => {
		expect(
			validerProgram({
				...gyldigt,
				oevelser: [{ exerciseId: 'squat', saet: 3, arbejdsSec: 30, pauseSec: -1 }]
			})
		).toMatch(/[Pp]ause/);
		expect(
			validerProgram({
				...gyldigt,
				oevelser: [{ exerciseId: 'squat', saet: 3, arbejdsSec: 30, pauseSec: 601 }]
			})
		).toMatch(/[Pp]ause/);
	});

	it('tillader pause på 0 sekunder', () => {
		expect(
			validerProgram({
				...gyldigt,
				oevelser: [{ exerciseId: 'squat', saet: 3, arbejdsSec: 30, pauseSec: 0 }]
			})
		).toBeNull();
	});
});

describe('anslaaetVarighedMinutter', () => {
	it('returnerer mindst 1 minut for et lille program', () => {
		expect(
			anslaaetVarighedMinutter({
				oevelser: [{ exerciseId: 'squat', saet: 1, arbejdsSec: 5, pauseSec: 0 }]
			})
		).toBeGreaterThanOrEqual(1);
	});

	it('beregner længere program korrekt', () => {
		// 3 sæt × 30s arbejde = 90s + 2 pauser × 15s = 120s = 2 min
		expect(
			anslaaetVarighedMinutter({
				oevelser: [{ exerciseId: 'squat', saet: 3, arbejdsSec: 30, pauseSec: 15 }]
			})
		).toBe(2);
	});

	it('summerer flere øvelser', () => {
		const eet = anslaaetVarighedMinutter({
			oevelser: [{ exerciseId: 'squat', saet: 3, arbejdsSec: 30, pauseSec: 15 }]
		});
		const to = anslaaetVarighedMinutter({
			oevelser: [
				{ exerciseId: 'squat', saet: 3, arbejdsSec: 30, pauseSec: 15 },
				{ exerciseId: 'lunges', saet: 3, arbejdsSec: 30, pauseSec: 15 }
			]
		});
		expect(to).toBeGreaterThan(eet);
	});
});
