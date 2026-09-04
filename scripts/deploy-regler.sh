#!/bin/bash
# Laegger firestore.rules og storage.rules ud til Firebase.
#
# Der ligger et script her, i stedet for én lang kommando, saa Linn kan
# give lov til praecis DEN her handling én gang. En bred tilladelse til
# alt hvad Firebase-vaerktoejet kan, ville ogsaa daekke at slette en
# database.
#
# Reglerne skal ALTID vises til Linn og godkendes foer scriptet koeres.
# Se CLAUDE.md regel 4.
#
# Brug:
#   ./scripts/deploy-regler.sh            kun firestore-reglerne
#   ./scripts/deploy-regler.sh storage    kun storage-reglerne
#   ./scripts/deploy-regler.sh begge      begge dele
set -euo pipefail

cd "$(dirname "$0")/.."

NOEGLE="$PWD/scripts/service-account-key.json"
if [ ! -f "$NOEGLE" ]; then
	echo "Fandt ikke scripts/service-account-key.json. Uden den kan der ikke logges paa."
	exit 1
fi

case "${1:-firestore}" in
	storage) MAAL="storage" ;;
	begge) MAAL="firestore:rules,storage" ;;
	*) MAAL="firestore:rules" ;;
esac

echo "Lægger $MAAL ud til linns-academy-app…"
GOOGLE_APPLICATION_CREDENTIALS="$NOEGLE" \
	npx -y firebase-tools@latest deploy --only "$MAAL" --project linns-academy-app --non-interactive
