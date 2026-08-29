// ============================================================
// "Hvad er det her for en side?"
//
// Et lille i i hjoernet af hver side. Trykker kunden paa det, folder der
// en forklaring ud af NETOP den side hun staar paa.
//
// HVORFOR. App-hjaelpen er en chat. De 40 skrevne afsnit om hvordan
// appen virker bliver kun brugt som viden til AI'en, saa kunden skal selv
// vide hvad hun skal spoerge om, og hun skal gide at skrive. Der fandtes
// ingen side hun bare kunne laese. Linns loesning 29. august 2026: en
// samlet intro i opstarten, og en info-knap paa hver side.
//
// TONEN. Faa linjer, kundens egne ord, ingen fagudtryk. Hun staar i det
// i forvejen, saa det her er en haandsraekning og ikke en manual.
// ============================================================

export interface SideInfoPunkt {
	/** Det fremhaevede ord forrest, fx "Dag-linjen". Kan udelades. */
	navn?: string;
	tekst: string;
	/**
	 * Vises kun for en kunde paa et forloeb. 176 af kunderne har KUN et
	 * abonnement og intet forloeb, og for dem er en linje om "dit forloeb"
	 * ikke bare overfloedig, den er forvirrende: hun leder efter noget der
	 * ikke findes paa hendes skaerm.
	 */
	kunForlob?: boolean;
}

export interface SideInfoTrin {
	overskrift: string;
	skridt: string[];
}

export interface SideInfo {
	titel: string;
	/** Afsnit foer punkterne. */
	indledning: string;
	punkter: SideInfoPunkt[];
	/**
	 * En lille trin-for-trin efter punkterne. Bruges hvor det ikke er nok at
	 * vide HVAD en ting er, men hvor kunden skal vide hvad hun goer foerst.
	 */
	trin?: SideInfoTrin;
	/** Afsnit efter punkterne. Her hoerer det hjemme der ellers giver spoergsmaal. */
	slutning?: string;
	/** Samme, men kun for en kunde paa et forloeb. Se kunForlob ovenfor. */
	slutningKunForlob?: string;
}

/**
 * Teksterne pr side. Noeglen er sidens eget navn, ikke dens adresse, saa
 * en flyttet side ikke mister sin hjaelp.
 */
export const SIDE_INFO: Record<string, SideInfo> = {
	forside: {
		titel: 'Sådan læser du forsiden',
		indledning: 'Forsiden er din dag i dag. Alt det, der er aktuelt for dig lige nu, ligger her.',
		punkter: [
			{
				navn: 'Dag-linjen',
				tekst: 'øverst viser dagene. Tryk på en dag, du har haft, for at se den igen.'
			},
			{ navn: 'Dagens lektion', tekst: 'er video eller lyd fra mig.', kunForlob: true },
			{ navn: 'Dagens tal', tekst: 'viser det protein og de fibre, du har logget i dag.' },
			{ navn: 'Dagens små skridt', tekst: 'er de få ting, du øver dig på lige nu.' }
		],
		slutningKunForlob:
			'Du kan ikke se frem i forløbet. Dagene åbner sig én ad gangen, så du kan være i den, du står i.'
	},
	mad: {
		titel: 'Sådan bruger du maden',
		indledning: 'Her holder du øje med protein og fibre, uden at skulle tælle kalorier.',
		punkter: [
			{ navn: 'Byg', tekst: 'sætter et måltid sammen af enkelte fødevarer.' },
			{
				navn: 'Opskrifter',
				tekst: 'er mine egne. Du kan filtrere efter vegetar, glutenfri og mejerifri.'
			},
			{
				navn: 'Mine',
				tekst:
					'er dine egne opskrifter. Tag et billede af en opskrift, så regner appen næringen ud. Kun du kan se dem.'
			},
			{ navn: 'Dagbog', tekst: 'viser det, du har gemt i dag, og hvor langt du er.' }
		],
		trin: {
			overskrift: 'Sådan bygger du et måltid',
			skridt: [
				'Tryk Søg fødevare og skriv fx skyr eller havregryn.',
				'Tryk på den, du vil bruge. Nu ligger den i dit måltid.',
				'Ret mængden. Du kan skifte mellem gram, deciliter og spiseskeer.',
				'Tilføj flere fødevarer på samme måde. Tallene øverst tæller med undervejs.',
				'Tryk Gem i dagbog, giv måltidet et navn, og vælg om det er morgenmad, frokost, aftensmad eller snack.'
			]
		},
		slutning:
			'Sæt flueben i Gem også som favorit, hvis det er noget, du spiser tit. Så kan du hente det frem igen med ét tryk.',
		slutningKunForlob:
			'Er du på et forløb, der bygger op ét måltid ad gangen, følger dit mål med. Det står øverst.'
	},
	traening: {
		titel: 'Sådan virker træningen',
		indledning: 'Træningen er korte daglige sessioner.',
		punkter: [
			{ navn: 'Dagens træning', tekst: 'ligger på forsiden, når den er åbnet for dig.' },
			{
				navn: 'Med eller uden kettlebell',
				tekst: 'vælger du selv. Du kan skifte under Profil, hvis du ombestemmer dig.'
			},
			{
				navn: 'Bliver du afbrudt',
				tekst: 'husker appen, hvor du kom til, så du kan tage resten senere.'
			}
		]
	},
	forlob: {
		titel: 'Sådan bruger du Mit forløb',
		indledning:
			'Her ligger alle dagene i dit forløb, med det indhold jeg har lagt op til hver dag.',
		punkter: [
			{ navn: 'Dagens lektion', tekst: 'er øverst. Der kan godt være mere end én.' },
			{
				navn: 'Mine noter',
				tekst: 'nederst i en lektion er dine egne. Det gemmer sig selv, og kun du kan se det.'
			},
			{ navn: 'En prik', tekst: 'ved en lektion betyder, at du har skrevet en note til den.' }
		],
		slutning:
			'Du kan altid gå tilbage til en dag, du har haft. Fremtidige dage åbner sig én ad gangen.'
	},
	vaner: {
		titel: 'Sådan virker de små skridt',
		indledning: 'Små skridt er de få ting, du øver dig på lige nu. De skifter i takt med forløbet.',
		punkter: [
			{ navn: 'Sæt et flueben', tekst: 'når du har gjort det. Det er hele registreringen.' },
			{ navn: 'Bonussen', tekst: 'er et ekstra lille skridt. Den er frivillig.' },
			{ navn: 'Refleksionen', tekst: 'er et spørgsmål til dig selv. Dit svar er kun dit.' }
		],
		slutning: 'Det er ikke meningen, at du skal nå det hele hver dag. Et flueben er bedre end nul.'
	},
	symptomcheck: {
		titel: 'Hvorfor spørger vi om det her?',
		indledning:
			'Symptomchecken er dit eget billede af, hvordan du har det. Søvn, mave, energi, humør og trang til sødt.',
		punkter: [
			{ navn: 'Første gang', tekst: 'er dit udgangspunkt. Det er det, vi måler op imod.' },
			{ navn: 'Senere', tekst: 'bliver du spurgt igen, så du kan se, hvad der har flyttet sig.' },
			{ navn: 'Svarene', tekst: 'er dine. Jeg ser dem samlet, ikke som en karakterbog.' }
		],
		slutning: 'Der er ingen rigtige svar. Svar på, hvordan du har det lige nu.'
	},
	udvikling: {
		titel: 'Sådan læser du din udvikling',
		indledning: 'Her kan du se, hvad der har flyttet sig, i stedet for at gætte.',
		punkter: [
			{ navn: '7 og 30 dage', tekst: 'viser protein og fibre dag for dag.' },
			{ navn: 'Den stiplede streg', tekst: 'er dit mål.' },
			{ navn: 'Gennemsnittet', tekst: 'tæller kun de dage, hvor du har logget mad.' }
		],
		slutning: 'En tom dag er ikke et nederlag. Kurven er til at se en retning, ikke til at dømme.'
	},
	bibliotek: {
		titel: 'Hvad er der i biblioteket?',
		indledning: 'Alt det, du har adgang til, samlet ét sted.',
		punkter: [
			{
				navn: 'En fane pr forløb',
				tekst: 'du har været på, med alle lektionerne fra det forløb.'
			},
			{ navn: 'Træningsøvelser', tekst: 'med video og vejledning til hver øvelse.' },
			{ navn: 'Opskrifter', tekst: 'kan filtreres efter vegetar, glutenfri og mejerifri.' }
		],
		slutning:
			'Materialet bliver liggende, når et forløb er slut, så længe du abonnerer eller er i gang med et nyt.'
	},
	beskeder: {
		titel: 'Sådan stiller du et spørgsmål',
		indledning:
			'Skriv til mig her. Jeg samler spørgsmålene og svarer på dem samlet, og svarene finder du på forsiden.',
		punkter: [
			{ navn: 'Alle spørgsmål', tekst: 'deles anonymt, så flere kan få glæde af svaret.' },
			{
				navn: 'Du får ikke',
				tekst: 'nødvendigvis et personligt svar her, men dit spørgsmål bliver taget med.'
			},
			{
				navn: 'Går appen i stykker',
				tekst:
					'eller kan du ikke finde noget, så brug AI-hjælpen på forsiden. Den svarer med det samme.'
			}
		]
	},
	profil: {
		titel: 'Hvad kan du her?',
		indledning: 'Din konto og de indstillinger, der følger dig.',
		punkter: [
			{ navn: 'Tekststørrelse', tekst: 'ændrer skriften i hele appen. Vælg det, der er rart.' },
			{ navn: 'Dine mål', tekst: 'for protein og fibre kan du selv rette, hvis du vil.' },
			{ navn: 'Med eller uden kettlebell', tekst: 'skifter du her, hvis du ombestemmer dig.' }
		],
		slutning: 'Er du i tvivl om dit abonnement eller din adgang, så skriv til mig under Beskeder.'
	}
};

/** Henter teksten for en side. Null naar siden ikke har nogen endnu. */
export function sideInfoFor(noegle: string): SideInfo | null {
	return SIDE_INFO[noegle] ?? null;
}
