// AI-rating: brugerne kan rate AI-svar 1-5 stjerner så Linn kan se hvilke
// svar der er gode eller dårlige. Gælder både Linn AI og App-hjælp.

import type { Timestamp } from 'firebase/firestore';

export type AiType = 'linn-ai' | 'app-hjaelp';
export type Rating = 1 | 2 | 3 | 4 | 5;

export interface AiRating {
	id: string;
	aiType: AiType;
	uid: string;
	userEmail: string;
	sporgsmaal: string;
	svar: string;
	rating: Rating;
	/** Linn AI har samtaler — beskedIdx peger på den specifikke besked. */
	samtaleId?: string;
	beskedIdx?: number;
	oprettetAt?: Timestamp;
}

export const AI_TYPE_LABELS: Record<AiType, string> = {
	'linn-ai': 'Linn AI',
	'app-hjaelp': 'App-hjælp'
};

export function aiRatingDocId(
	aiType: AiType,
	uid: string,
	options: { samtaleId?: string; beskedIdx?: number } = {}
): string {
	// For Linn AI: deterministisk id pr besked så re-rating overskriver.
	if (aiType === 'linn-ai' && options.samtaleId && options.beskedIdx !== undefined) {
		return `linn-ai-${uid}-${options.samtaleId}-${options.beskedIdx}`;
	}
	// For App-hjælp: ingen samtale-id, bruger timestamp så hver rating
	// er et nyt dokument. Brugeren kan stadig rate samme svar igen senere.
	return `${aiType}-${uid}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}
