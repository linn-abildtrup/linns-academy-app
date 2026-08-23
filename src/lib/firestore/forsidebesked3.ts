// ============================================================
// Beskederne paa forsiden, gemt ét sted.
//
// ÉN SAMLING, og den er lille med vilje: der staar hoejst en haandfuld
// ad gangen, og de udloebne ryddes. Derfor laeses de alle sammen paa én
// gang, og kunden regner selv ud hvilken der er hendes. Se
// content/forsidebesked3.ts.
//
// KUN ADMIN SKRIVER. Alle logget ind maa laese: en besked til et hold er
// ikke fortrolig, og kunden skal kunne se sin egen med det samme.
//
// DE UDLOEBNE SLETTES IKKE AF SIG SELV. De filtreres fra naar de laeses,
// og Linn kan rydde dem i admin. En baggrundsopgave til at slette dem
// ville vaere mere maskineri end det er vaerd.
//
// Bygget 23. august 2026, se HANDOVER 9.44.
// ============================================================

import { collection, deleteDoc, doc, getDocs, setDoc } from 'firebase/firestore';
import { db } from '$lib/firebase';
import type { Forsidebesked3, Modtager3 } from '$lib/content/forsidebesked3';

const SAMLING = 'forsidebesked3';

/** Alle beskeder, ogsaa de udloebne. Kalderen filtrerer. */
export async function hentForsidebeskeder3(): Promise<Forsidebesked3[]> {
	try {
		const snap = await getDocs(collection(db, SAMLING));
		return snap.docs.map((d) => {
			const x = d.data() as Omit<Forsidebesked3, 'id'>;
			return {
				id: d.id,
				tekst: x.tekst ?? '',
				modtager: x.modtager ?? { slags: 'alle' },
				slutMs: x.slutMs ?? 0,
				oprettetMs: x.oprettetMs ?? 0,
				prik: x.prik === true
			};
		});
	} catch (e) {
		// Forsiden skal virke selvom det her fejler. Saa staar der bare
		// ingen besked.
		console.warn('[ny] kunne ikke hente forsidebeskeder', e);
		return [];
	}
}

function nytId(): string {
	const r =
		typeof crypto !== 'undefined' && 'randomUUID' in crypto
			? crypto.randomUUID().slice(0, 10)
			: Math.random().toString(36).slice(2, 12);
	return `fb-${r}`;
}

/** Opretter eller retter. Kun admin. */
export async function gemForsidebesked3(
	besked: Omit<Forsidebesked3, 'id' | 'oprettetMs'> & { id?: string; oprettetMs?: number }
): Promise<string> {
	const id = besked.id ?? nytId();
	await setDoc(
		doc(db, SAMLING, id),
		{
			tekst: besked.tekst.trim(),
			modtager: besked.modtager as Modtager3,
			slutMs: besked.slutMs,
			// Retter hun teksten, bevares tidspunktet: det afgoer hvilken der
			// vinder, og en rettelse skal ikke skubbe den foran de andre.
			oprettetMs: besked.oprettetMs ?? Date.now(),
			prik: besked.prik
		},
		{ merge: true }
	);
	return id;
}

/** Fjerner den med det samme. */
export async function fjernForsidebesked3(id: string): Promise<void> {
	await deleteDoc(doc(db, SAMLING, id));
}
