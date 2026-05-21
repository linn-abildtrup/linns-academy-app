import { describe, it, expect } from 'vitest';
import {
	anslaaetVarighedMinutter,
	validerProgram,
	type CustomProgram
} from './mineProgrammer';

const gyldigt: Pick<CustomProgram, 'navn' | 'oevelser'> = {
	navn: 'Mit ben-program',
	oevelser: [
		{ exerciseId: 'squat', saet: 3, reps: 10, pauseSec: 60 },
		{ exerciseId: 'lunges', saet: 3, reps: 12, pauseSec: 45 }
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
				oevelser: [{ exerciseId: '', saet: 3, reps: 10, pauseSec: 60 }]
			})
		).toMatch(/reference/);
	});

	it('afviser ugyldigt antal sæt', () => {
		expect(
			validerProgram({
				...gyldigt,
				oevelser: [{ exerciseId: 'squat', saet: 0, reps: 10, pauseSec: 60 }]
			})
		).toMatch(/sæt/);
		expect(
			validerProgram({
				...gyldigt,
				oevelser: [{ exerciseId: 'squat', saet: 21, reps: 10, pauseSec: 60 }]
			})
		).toMatch(/sæt/);
	});

	it('afviser ugyldigt antal reps', () => {
		expect(
			validerProgram({
				...gyldigt,
				oevelser: [{ exerciseId: 'squat', saet: 3, reps: 0, pauseSec: 60 }]
			})
		).toMatch(/reps/);
	});

	it('afviser ugyldig pause', () => {
		expect(
			validerProgram({
				...gyldigt,
				oevelser: [{ exerciseId: 'squat', saet: 3, reps: 10, pauseSec: -1 }]
			})
		).toMatch(/[Pp]ause/);
		expect(
			validerProgram({
				...gyldigt,
				oevelser: [{ exerciseId: 'squat', saet: 3, reps: 10, pauseSec: 601 }]
			})
		).toMatch(/[Pp]ause/);
	});

	it('tillader pause på 0 sekunder', () => {
		expect(
			validerProgram({
				...gyldigt,
				oevelser: [{ exerciseId: 'squat', saet: 3, reps: 10, pauseSec: 0 }]
			})
		).toBeNull();
	});
});

describe('anslaaetVarighedMinutter', () => {
	it('returnerer mindst 1 minut for et lille program', () => {
		expect(
			anslaaetVarighedMinutter({
				oevelser: [{ exerciseId: 'squat', saet: 1, reps: 1, pauseSec: 0 }]
			})
		).toBeGreaterThanOrEqual(1);
	});

	it('beregner længere program', () => {
		// 3 sæt × 10 reps × 3s = 90s arbejde + 2 pauser × 60s = 210s = 3.5 min
		expect(
			anslaaetVarighedMinutter({
				oevelser: [{ exerciseId: 'squat', saet: 3, reps: 10, pauseSec: 60 }]
			})
		).toBeGreaterThan(2);
	});

	it('summerer flere øvelser', () => {
		const eet = anslaaetVarighedMinutter({
			oevelser: [{ exerciseId: 'squat', saet: 3, reps: 10, pauseSec: 60 }]
		});
		const to = anslaaetVarighedMinutter({
			oevelser: [
				{ exerciseId: 'squat', saet: 3, reps: 10, pauseSec: 60 },
				{ exerciseId: 'lunges', saet: 3, reps: 10, pauseSec: 60 }
			]
		});
		expect(to).toBeGreaterThan(eet);
	});
});
