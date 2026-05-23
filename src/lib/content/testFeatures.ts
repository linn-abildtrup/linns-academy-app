// Katalog over test-features brugere kan have adgang til før udrulning.
//
// Admin tildeler test-adgang per kunde via /admin/testere. I koden
// tjekkes med harTestAdgang(userDoc, 'feature-key') fra utils/userAdgang.
//
// Når en feature er færdig-testet:
// 1. Fjern harTestAdgang-tjekken i koden — alle får funktionen
// 2. Sæt 'udrullet: true' her så admin-siden viser at testen er afsluttet
// 3. Listen over testere i Firestore bevares — kan genbruges til næste
//    funktion eller fjernes manuelt via admin-siden

export interface TestFeature {
	key: string;
	navn: string;
	beskrivelse: string;
	udrullet?: boolean;
}

/**
 * Liste over kendte test-features. Tilføj nye HERE før du bruger dem i
 * koden — så admin-siden ved hvad der kan tildeles.
 */
export const TEST_FEATURES: TestFeature[] = [
	{
		key: 'foreslaa-madplan',
		navn: 'Foreslå madplan',
		beskrivelse:
			'AI-genereret madplan-forslag i 30-30-3-beregneren. Tab i tabbaren og knap der åbner modal med konfiguration (antal forslag, glutenfri, undgå-ingredienser) og resultat med 1-3 opskriftforslag pr måltidstype + snack-suppleringer.'
	},
	{
		key: 'byg-eget-program',
		navn: 'Byg dit eget program',
		beskrivelse:
			'Custom-builder hvor kunden selv vælger øvelser, sæt, reps og pause. Inkluderer 14-dages auto-byg-flow. Skjuler både CTA og kundens egne programmer på Træning-modul-siden samt root-ruten for ikke-testere.'
	},
	{
		key: 'nul-dage',
		navn: 'Nul-dage (pause-dage)',
		beskrivelse:
			'Klienten kan markere et interval (fra-til dato) som nul-dage og skubbe forløbet uden aktivitet på de dage. Pulje på 21 pr Kropsro-forløb. Slutdatoen rykkes automatisk. Kun samme-dag-fortryd. Profil-siden viser kontroller og forbrug.'
	}
];

export function hentTestFeature(key: string): TestFeature | undefined {
	return TEST_FEATURES.find((f) => f.key === key);
}
