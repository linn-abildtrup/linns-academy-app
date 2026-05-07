// Admin-konfiguration.
// Lige nu er admin-rolle baseret på email. Tilføj flere emails her hvis flere
// personer skal kunne redigere træningsprogrammer, øvelsesbibliotek osv.
// Husk at den samme liste skal være i firestore.rules under den tilsvarende sektion.

import type { User } from 'firebase/auth';

export const ADMIN_EMAILS = ['linnabildtrup00@gmail.com'] as const;

export function isAdmin(user: User | null): boolean {
	if (!user || !user.email) return false;
	return (ADMIN_EMAILS as readonly string[]).includes(user.email);
}
