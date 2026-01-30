#!/bin/bash
# Nettoyage iOS / Xcode / CocoaPods pour un projet Expo (notamment après ajout de @rnmapbox/maps).
# À utiliser en cas d’erreurs de build ou de liaison, pas obligatoire pour un premier run.

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

echo "🧹 Nettoyage iOS / Mapbox (Expo)..."

# 1. Cache Xcode (sans sudo)
echo "→ Cache Xcode (DerivedData)..."
rm -rf ~/Library/Developer/Xcode/DerivedData/* 2>/dev/null || true
rm -rf ~/Library/Developer/Xcode/DerivedData/ModuleCache.noindex 2>/dev/null || true
rm -rf ~/Library/Developer/Xcode/DerivedData/ModuleCache 2>/dev/null || true

# 2. Cache CocoaPods
echo "→ Cache CocoaPods..."
rm -rf ~/Library/Caches/CocoaPods 2>/dev/null || true

# 3. Dossier ios (généré par Expo)
if [ -d "ios" ]; then
  echo "→ Nettoyage ios/..."
  rm -rf ios/build
  rm -rf ios/DerivedData
  rm -rf ios/Pods
  rm -f ios/Podfile.lock
  echo "→ Réinstallation des Pods..."
  (cd ios && pod cache clean --all 2>/dev/null || true; pod install)
else
  echo "→ Pas de dossier ios/ (Expo prebuild pas encore lancé)."
  echo "  Génération des projets natifs avec prebuild --clean..."
  npx expo prebuild --clean --platform ios
  echo "→ Installation des Pods..."
  (cd ios && pod install)
fi

echo "✅ Nettoyage terminé."
echo ""
echo "Lancer l’app iOS :"
echo "  npx expo run:ios"
echo "Ou dans Xcode : Product > Clean Build Folder (⇧⌘K) puis build."
