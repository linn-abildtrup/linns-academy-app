import { describe, it, expect, beforeEach } from 'vitest';
import { registrerSide3, forrigeSide3, glemForrige3, navnFor3, kanHuskes3 } from './forrigeSide3';

describe('forrigeSide3', () => {
	beforeEach(() => glemForrige3());

	it('ved ingenting foer hun har vaeret nogen steder', () => {
		registrerSide3('/ny/skridt');
		expect(forrigeSide3()).toBeNull();
	});

	// Linns eksempel: smaa skridt naas baade fra forsiden og fra Din side.
	it('husker Din side naar hun kom derfra', () => {
		registrerSide3('/ny/profil');
		registrerSide3('/ny/skridt');
		expect(forrigeSide3()).toEqual({ sti: '/ny/profil', navn: 'Din side' });
	});

	it('husker forsiden naar hun kom derfra i stedet', () => {
		registrerSide3('/ny');
		registrerSide3('/ny/skridt');
		expect(forrigeSide3()).toEqual({ sti: '/ny', navn: 'Forside' });
	});

	// En underside har ikke et kort ord, og "‹ Tilbage" hjaelper hende ikke.
	it('husker ikke en side vi ikke har et navn til', () => {
		registrerSide3('/ny/profil');
		registrerSide3('/ny/traening/abc/3');
		registrerSide3('/ny/skridt');
		// Din side er stadig det sidste sted hun kan pege tilbage til.
		expect(forrigeSide3()).toEqual({ sti: '/ny/profil', navn: 'Din side' });
	});

	// Ellers ville knappen pege paa siden selv og ikke goere noget.
	it('peger aldrig paa den side hun staar paa', () => {
		registrerSide3('/ny/profil');
		registrerSide3('/ny/skridt');
		expect(forrigeSide3('/ny/profil')).toBeNull();
	});

	it('taeller ikke den samme side to gange', () => {
		registrerSide3('/ny');
		registrerSide3('/ny/skridt');
		registrerSide3('/ny/skridt');
		expect(forrigeSide3()).toEqual({ sti: '/ny', navn: 'Forside' });
	});

	it('glemmer alt ved log ud', () => {
		registrerSide3('/ny/profil');
		registrerSide3('/ny/skridt');
		glemForrige3();
		expect(forrigeSide3()).toBeNull();
	});
});

describe('navnFor3', () => {
	it('kender de sider man kan komme fra', () => {
		expect(navnFor3('/ny/profil')).toBe('Din side');
		expect(navnFor3('/ny/udvikling')).toBe('Udvikling');
	});

	it('siger nej til en underside', () => {
		expect(navnFor3('/ny/traening/abc/3')).toBeNull();
		expect(kanHuskes3('/ny/traening/abc/3')).toBe(false);
	});
});
