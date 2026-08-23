import { describe, expect, it } from 'vitest';
import { loginMedVidere3, reneVidere3 } from './videreTil3';

describe('reneVidere3', () => {
	it('en almindelig sti i 3.0 er i orden', () => {
		expect(reneVidere3('/ny/beskeder')).toBe('/ny/beskeder');
		expect(reneVidere3('/ny/beskeder?fane=linn')).toBe('/ny/beskeder?fane=linn');
		expect(reneVidere3('/ny')).toBe('/ny');
	});

	it('INGENTING UDEN FOR APPEN', () => {
		expect(reneVidere3('https://andetsted.dk')).toBeNull();
		expect(reneVidere3('//andetsted.dk')).toBeNull();
		expect(reneVidere3('javascript:alert(1)')).toBeNull();
	});

	it('heller ikke ind i den gamle app', () => {
		expect(reneVidere3('/app')).toBeNull();
		expect(reneVidere3('/app/admin')).toBeNull();
		expect(reneVidere3('/login')).toBeNull();
	});

	it('en sti der bare LIGNER 3.0 er ikke god nok', () => {
		expect(reneVidere3('/nyheder')).toBeNull();
		expect(reneVidere3('/nyt/beskeder')).toBeNull();
	});

	it('mellemrum og linjeskift afvises', () => {
		expect(reneVidere3('/ny/besk eder')).toBeNull();
		expect(reneVidere3('/ny/beskeder\n')).toBe('/ny/beskeder');
		expect(reneVidere3('/ny\\beskeder')).toBeNull();
	});

	it('tomt er ikke en fejl, bare ingenting', () => {
		expect(reneVidere3(null)).toBeNull();
		expect(reneVidere3('')).toBeNull();
		expect(reneVidere3('   ')).toBeNull();
	});
});

describe('loginMedVidere3', () => {
	it('tager stien med', () => {
		expect(loginMedVidere3('/ny/beskeder?fane=linn')).toBe(
			'/ny/login?videre=%2Fny%2Fbeskeder%3Ffane%3Dlinn'
		);
	});

	it('forsiden er ikke vaerd at huske', () => {
		expect(loginMedVidere3('/ny')).toBe('/ny/login');
	});

	it('en sti vi ikke tør bruge bliver til almindeligt login', () => {
		expect(loginMedVidere3('https://andetsted.dk')).toBe('/ny/login');
	});
});
