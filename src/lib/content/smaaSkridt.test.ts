import { describe, it, expect } from 'vitest';
import { afstemChecks, checksErEns, dageForPlan, type DagCheck } from './smaaSkridt';

const c = (id: string, label = id): DagCheck => ({ id, label });

describe('afstemChecks', () => {
	it('bevarer fremmede checks fra tiden foer smaa skridt', () => {
		const gamle = [c('pm', 'Protein til morgenmad'), c('ss-1')];
		const ud = afstemChecks(gamle, new Set(['ss-1']), [c('ss-1')]);
		expect(ud.map((x) => x.id)).toEqual(['pm', 'ss-1']);
	});

	it('fjerner et ejet check naar skridtet ikke laengere rammer dagen', () => {
		const gamle = [c('ss-1'), c('ss-2')];
		const ud = afstemChecks(gamle, new Set(['ss-1', 'ss-2']), [c('ss-1')]);
		expect(ud.map((x) => x.id)).toEqual(['ss-1']);
	});

	it('fjerner et slettet skridt, fordi dets id stadig staar i ejedeIds', () => {
		// ss-2 er slettet i admin. Den staar ikke i ejetPaaDagen, men dens id er
		// med i ejedeIds via gravstenen. Det er hele pointen med rettelsen.
		const gamle = [c('pm'), c('ss-1'), c('ss-2')];
		const ud = afstemChecks(gamle, new Set(['ss-1', 'ss-2']), [c('ss-1')]);
		expect(ud.map((x) => x.id)).toEqual(['pm', 'ss-1']);
	});

	it('fjerner IKKE en fremmed check der ligner et slettet skridt', () => {
		// Uden gravsten er ss-2 ukendt, og saa skal den bevares.
		const gamle = [c('pm'), c('ss-2')];
		const ud = afstemChecks(gamle, new Set(['ss-1']), []);
		expect(ud.map((x) => x.id)).toEqual(['pm', 'ss-2']);
	});

	it('tilfoejer et nyt skridt til en dag der ikke havde nogen', () => {
		expect(afstemChecks([], new Set(['ss-1']), [c('ss-1')]).map((x) => x.id)).toEqual(['ss-1']);
	});

	it('opdaterer teksten paa et ejet check', () => {
		const ud = afstemChecks([c('ss-1', 'Gammel tekst')], new Set(['ss-1']), [c('ss-1', 'Ny tekst')]);
		expect(ud).toEqual([{ id: 'ss-1', label: 'Ny tekst' }]);
	});

	it('er idempotent, saa to publiceringer i traek giver det samme', () => {
		const ejede = new Set(['ss-1']);
		const foerste = afstemChecks([c('pm')], ejede, [c('ss-1')]);
		const anden = afstemChecks(foerste, ejede, [c('ss-1')]);
		expect(anden).toEqual(foerste);
	});
});

describe('checksErEns', () => {
	it('er sand for ens lister', () => {
		expect(checksErEns([c('a'), c('b')], [c('a'), c('b')])).toBe(true);
	});

	it('er falsk naar raekkefoelgen er byttet om', () => {
		expect(checksErEns([c('a'), c('b')], [c('b'), c('a')])).toBe(false);
	});

	it('er falsk naar en tekst er aendret', () => {
		expect(checksErEns([c('a', 'Foer')], [c('a', 'Efter')])).toBe(false);
	});

	it('er falsk naar der er forskelligt antal', () => {
		expect(checksErEns([c('a')], [c('a'), c('b')])).toBe(false);
	});
});

describe('dageForPlan', () => {
	// 24. maj 2026 er en soendag. Dag 1 er derfor mandag.
	const start = new Date('2026-05-24T00:01:00');

	it('alle dage', () => {
		expect(dageForPlan({ type: 'alle' }, 5, start)).toEqual([1, 2, 3, 4, 5]);
	});

	it('uger regnes som syv dage ad gangen', () => {
		expect(dageForPlan({ type: 'uger', uger: [2] }, 21, start)).toEqual([8, 9, 10, 11, 12, 13, 14]);
	});

	it('interval uden slut loeber til sidste dag', () => {
		expect(dageForPlan({ type: 'interval', fra: 3, til: null }, 5, start)).toEqual([3, 4, 5]);
	});

	it('ugedage foelger den aegte ugedag fra startdatoen', () => {
		// 1 = mandag. Med soendag som dag 0 er mandag dag 1, 8 og 15.
		expect(dageForPlan({ type: 'ugedage', ugedage: [1] }, 21, start)).toEqual([1, 8, 15]);
	});

	it('bestemte dage', () => {
		expect(dageForPlan({ type: 'dage', dage: [2, 4] }, 5, start)).toEqual([2, 4]);
	});
});
