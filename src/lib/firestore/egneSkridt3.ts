// ============================================================
// Forloebskundens EGNE smaa skridt, 3.0's egen skuffe.
//
// HVORFOR DEN FINDES. Den gamle app gemmer hendes egne skridt paa
// kundens produkt-dokument. Det dokument oprettes ved koeb, og det
// findes IKKE altid: testkontiene har ingen, og admin i klient-mode har
// ingen. Saa svarede appen "Produkt ikke fundet", og hun kunne ikke
// laegge et skridt til. Linn saa det paa test-Mette 22. august.
//
// VI OPRETTER IKKE DET GAMLE DOKUMENT. Det laeses af den gamle app 760
// steder i drift, og et halvt dokument derinde er praecis den slags
// risiko regel 10 handler om. 3.0 skriver sin egen skuffe i stedet.
//
// HENDES GAMLE SKRIDT FORSVINDER IKKE. Der laeses fra begge, se
// vaelgSkridt3.ts, saa en kunde der har skrevet noget i den gamle app
// stadig kan se og fjerne det.
//
// ÉN SKUFFE PR PRODUKT. To forloeb maa ikke dele skridt, paa samme maade
// som vanedagene er delt op. Se HANDOVER om dataskuffer pr forloeb.
// ============================================================

import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '$lib/firebase';
import { aktivBrugerBasisPath } from '$lib/utils/adminKlient';

export interface EgetSkridt3 {
	id: string;
	label: string;
	oprettetMs: number;
}

function egneRef(uid: string, produktId: string) {
	return doc(db, `${aktivBrugerBasisPath(uid)}/egneSkridt3/${produktId}`);
}

/** Hendes egne skridt paa dette produkt. Tom liste hvis der ingen er. */
export async function hentEgneSkridt3(uid: string, produktId: string): Promise<EgetSkridt3[]> {
	try {
		const snap = await getDoc(egneRef(uid, produktId));
		if (!snap.exists()) return [];
		const raa = snap.data()?.skridt;
		if (!Array.isArray(raa)) return [];
		return raa
			.filter(
				(s): s is EgetSkridt3 =>
					!!s && typeof s.id === 'string' && typeof s.label === 'string' && !!s.label.trim()
			)
			.map((s) => ({ id: s.id, label: s.label, oprettetMs: s.oprettetMs ?? 0 }));
	} catch (e) {
		console.warn('[ny] kunne ikke hente dine egne skridt', e);
		return [];
	}
}

/** Skriver hele listen. Den er paa hoejst tre, saa der er intet at spare. */
export async function gemEgneSkridt3(
	uid: string,
	produktId: string,
	skridt: EgetSkridt3[]
): Promise<void> {
	await setDoc(egneRef(uid, produktId), { skridt, opdateretMs: Date.now() }, { merge: true });
}

/** Nyt id. Praefikset goer det tydeligt hvor skridtet kommer fra. */
export function nytEgetSkridtId3(): string {
	const r =
		typeof crypto !== 'undefined' && 'randomUUID' in crypto
			? crypto.randomUUID().slice(0, 8)
			: Math.random().toString(36).slice(2, 10);
	return `es3-${r}`;
}
