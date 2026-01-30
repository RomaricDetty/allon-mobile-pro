# DOCUMENT D'ARCHITECTURE TECHNIQUE (DAT)
## AllOn Mobile Pro

---

## 1. VUE D'ENSEMBLE

### 1.1 Informations générales
- **Nom du projet** : AllOn Mobile Pro
- **Version** : 1.0.0
- **Type d'application** : Application mobile multiplateforme (iOS, Android, Web)
- **Framework** : React Native avec Expo
- **Langage** : TypeScript
- **Architecture de routage** : Expo Router (file-based routing)

### 1.2 Description
Application mobile professionnelle pour la gestion des trajets de transport en bus. Elle permet aux conducteurs, superviseurs et autres personnels de gérer les départs, scanner les tickets QR, suivre les trajets en temps réel, et gérer les bagages.

---

## 2. ARCHITECTURE TECHNIQUE

### 2.1 Stack technologique

#### Frontend
- **React Native** : 0.81.5
- **React** : 19.1.0
- **Expo SDK** : ~54.0.25
- **Expo Router** : ~6.0.15 (routage basé sur les fichiers)
- **TypeScript** : ~5.9.2

#### Navigation
- **@react-navigation/native** : ^7.1.8
- **@react-navigation/bottom-tabs** : ^7.4.0
- **@react-navigation/elements** : ^2.6.3

#### Communication réseau
- **Axios** : ^1.13.2

#### Stockage local
- **@react-native-async-storage/async-storage** : ^2.2.0

#### Fonctionnalités natives
- **expo-camera** : ~17.0.9 (scan QR codes)
- **expo-location** : ^19.0.8 (géolocalisation)
- **expo-maps** : ~0.12.10 (cartes)
- **react-native-maps** : 1.20.1 (cartes natives)
- **expo-av** : ~16.0.7 (audio pour scan)
- **expo-haptics** : ~15.0.7 (retour haptique)
- **@react-native-community/datetimepicker** : ^8.5.1

#### UI/UX
- **expo-font** : ~14.0.9 (polices Ubuntu)
- **expo-image** : ~3.0.10
- **expo-blur** : ~15.0.7
- **react-native-reanimated** : ~4.1.1
- **react-native-svg** : 15.12.1

### 2.2 Structure du projet

```
allon-mobile-pro/
├── app/                          # Écrans (routage basé sur les fichiers)
│   ├── _layout.tsx              # Layout racine avec gestion des thèmes
│   ├── index.tsx                # Point d'entrée (redirection)
│   ├── (tabs)/                  # Onglets principaux
│   │   ├── _layout.tsx          # Layout des onglets
│   │   ├── index.tsx            # Écran d'accueil (liste des départs)
│   │   └── profile.tsx          # Écran de profil
│   ├── login/                   # Authentification
│   │   ├── index.tsx            # Connexion
│   │   └── forgot-password.tsx  # Mot de passe oublié
│   ├── scan-qr/                 # Scan de QR codes
│   │   └── index.tsx
│   ├── scan-result/              # Résultat du scan
│   │   └── index.tsx
│   ├── register-baggage/        # Gestion des bagages
│   │   ├── index.tsx            # Liste des bagages
│   │   ├── add.tsx              # Ajout de bagage
│   │   └── details.tsx          # Détails d'un bagage
│   ├── departure-details/       # Détails d'un départ
│   │   └── index.tsx
│   ├── track-route/             # Suivi de trajet en temps réel
│   │   └── index.tsx
│   ├── bookings/                # Liste des réservations
│   │   └── index.tsx
│   └── booking-details/         # Détails d'une réservation
│       └── index.tsx
├── api/                         # Services API
│   ├── config.ts                # Configuration API (URL de base)
│   ├── auth_login.ts            # Authentification
│   └── departures.ts            # Gestion des départs
├── components/                  # Composants réutilisables
│   ├── auth/                    # Composants d'authentification
│   ├── departure-details/       # Composants pour détails départ
│   ├── home/                    # Composants de l'accueil
│   ├── map/                     # Composants de carte
│   ├── ui/                      # Composants UI génériques
│   ├── departure-card.tsx       # Carte de départ
│   ├── themed-text.tsx           # Texte avec support thème
│   └── themed-view.tsx          # Vue avec support thème
├── contexts/                    # Contextes React
│   └── ThemeContext.tsx         # Gestion du thème
├── hooks/                       # Hooks personnalisés
│   ├── use-color-scheme.ts
│   ├── use-theme-color.ts
│   ├── use-theme-preference.ts
│   └── use-dimensions.ts
├── utils/                       # Utilitaires
│   ├── date.ts                  # Manipulation des dates
│   ├── departure-events.ts      # Système d'événements pour départs
│   ├── departure-utils.ts       # Utilitaires pour départs
│   ├── location.ts              # Calculs de localisation
│   ├── logger.ts                # Système de logging
│   └── luggage-utils.ts         # Utilitaires pour bagages
├── styles/                      # Styles
│   ├── homeScreen.ts
│   ├── departureDetails.ts
│   ├── scan-result.ts
│   ├── addLuggage.ts
│   ├── detailsLuggage.ts
│   └── registerLuggageList.ts
├── constants/                   # Constantes
│   └── theme.ts                 # Thèmes et couleurs
├── assets/                      # Ressources
│   ├── fonts/                   # Polices Ubuntu
│   ├── images/                  # Images
│   └── mp3/                     # Sons (beep-scan.mp3)
├── app.json                     # Configuration Expo
├── package.json                 # Dépendances
├── tsconfig.json                # Configuration TypeScript
└── eslint.config.js             # Configuration ESLint
```

### 2.3 Architecture de routage

L'application utilise **Expo Router** avec un routage basé sur les fichiers :
- `app/` contient tous les écrans
- Les fichiers `_layout.tsx` définissent les layouts
- `(tabs)` est un groupe d'onglets
- Les routes sont automatiquement générées à partir de la structure de fichiers

### 2.4 Gestion d'état

- **État local** : React Hooks (useState, useEffect, useMemo, useCallback)
- **État global** : Context API (ThemeContext)
- **Stockage persistant** : AsyncStorage pour les tokens et préférences
- **Synchronisation entre écrans** : Système d'événements personnalisé (departure-events.ts)

### 2.5 Communication avec le backend

- **URL de base** : `https://dev-allon-backend.onrender.com/api`
- **Authentification** : JWT avec refresh token
- **Headers** : `Authorization: Bearer {token}`
- **Format** : JSON

---

## 3. FONCTIONNALITÉS PRINCIPALES

### 3.1 Authentification et sécurité

#### Connexion
- Connexion par email/nom d'utilisateur et mot de passe
- Validation des champs en temps réel
- Gestion des rôles utilisateur (driver, supervisor, etc.)
- Stockage sécurisé des tokens (access_token, refresh_token)
- Vérification automatique de la session au démarrage
- Rafraîchissement automatique des tokens expirés

#### Mot de passe oublié
- Processus en plusieurs étapes :
  1. Saisie de l'email/nom d'utilisateur/téléphone
  2. Choix de la méthode de réinitialisation (email, SMS, WhatsApp)
  3. Vérification du code à 6 chiffres
  4. Réinitialisation du mot de passe

#### Gestion de session
- Vérification automatique de la validité du token
- Redirection vers l'écran de connexion si session expirée
- Nettoyage automatique des données d'authentification

### 3.2 Gestion des départs

#### Liste des départs (Écran d'accueil)
- Affichage paginé des départs (10 par page)
- Filtrage par date :
  - Tous les trajets
  - Aujourd'hui
  - Cette semaine
  - Ce mois
  - Cette année
  - Date personnalisée (plage de dates)
- Pull-to-refresh
- Chargement infini (scroll)
- Affichage des informations :
  - Compagnie
  - Gare de départ/arrivée
  - Heures de départ/arrivée
  - Durée du trajet
  - Prix
  - Statut (Programmé, En embarquement, Parti, Arrivé, etc.)
  - Retards éventuels
- Mise à jour en temps réel via système d'événements

#### Détails d'un départ
- Informations complètes :
  - Détails de la compagnie
  - Informations du bus (type, marque, plaque d'immatriculation)
  - Visualisation de l'itinéraire
  - Stations de départ et d'arrivée
  - Horaires
  - Statut
- Actions disponibles selon le rôle :
  - Scanner un QR code
  - Rechercher une réservation par référence
  - Démarrer le trajet (conducteur/superviseur)
  - Marquer comme embarqué/départ/arrivé

### 3.3 Scan de QR codes

#### Fonctionnalités
- Scanner des QR codes de tickets
- Zone de scan dédiée avec guidage visuel
- Animation de scan
- Torche (flashlight)
- Son de confirmation (beep)
- Retour haptique
- Validation du QR code via API
- Vérification de correspondance avec le départ sélectionné
- Gestion des erreurs (QR invalide, timeout, réseau)
- Retry automatique en cas d'erreur réseau

#### Processus de scan
1. Ouverture de la caméra
2. Détection du QR code dans la zone de scan
3. Vérification via API
4. Traitement du scan
5. Affichage du résultat

### 3.4 Résultat du scan

- Affichage des informations de la réservation :
  - Code de réservation
  - Statut (Payé, En attente, etc.)
  - Informations du passager
  - Détails du trajet
  - Liste des items (passagers)
  - Informations de paiement
- Actions disponibles :
  - Voir les détails complets
  - Gérer les bagages
  - Valider la réservation

### 3.5 Gestion des réservations

#### Liste des réservations
- Affichage paginé des réservations pour un départ
- Filtrage et recherche
- Informations affichées :
  - Code de réservation
  - Statut
  - Passager
  - Montant
  - Méthode de paiement
- Pull-to-refresh

#### Détails d'une réservation
- Informations complètes :
  - Détails du passager
  - Informations du trajet
  - Items (passagers)
  - Paiement
  - Historique

### 3.6 Gestion des bagages

#### Liste des bagages
- Affichage des bagages enregistrés pour un passager
- Informations par bagage :
  - Type (Cabine, Soute, Surdimensionné, Fragile, Équipement sportif)
  - Poids estimé
  - Dimensions
  - Description
  - Statut (Enregistré, Vérifié, Chargé, Déchargé, Livré, etc.)
  - Indicateur fragile
- Actions :
  - Ajouter un bagage
  - Voir les détails d'un bagage

#### Ajout de bagage
- Formulaire avec :
  - Type de bagage
  - Poids estimé
  - Dimensions (longueur, largeur, hauteur)
  - Description
  - Indicateur fragile
- Validation des champs
- Calcul automatique du volume total

#### Détails d'un bagage
- Informations complètes :
  - Type, poids, dimensions
  - Statut actuel
  - Numéro de tag (si check-in effectué)
  - QR code (si check-in effectué)
  - Prix et frais (base, excès de poids, surdimensionné, fragile)
  - Dates (enregistrement, check-in, chargement, etc.)
- Actions selon le statut :
  - Check-in (si statut = REGISTERED)
  - Voir le QR code (si check-in effectué)
  - Payer les frais (si applicable)

### 3.7 Suivi de trajet en temps réel

#### Fonctionnalités
- Affichage de la position GPS en temps réel sur une carte
- Mise à jour automatique de la position
- Suivi de la vitesse et de la direction
- Filtrage des positions GPS (qualité, distance, vitesse)
- Actions disponibles :
  - Marquer comme "En embarquement" (Boarding)
  - Démarrer le trajet (Départ)
  - Terminer le trajet (Arrivé)
- Modales de confirmation pour les actions
- Gestion des permissions de localisation
- Optimisation de la batterie (filtrage des positions)

#### Configuration GPS
- Précision : BestForNavigation
- Intervalle de temps : 1 seconde
- Intervalle de distance : 5 mètres
- Filtrage :
  - Précision minimale : 100 mètres
  - Vitesse maximale : 50 m/s
  - Warm-up : 3 mises à jour avant filtrage strict

### 3.8 Profil utilisateur

#### Informations affichées
- Informations personnelles :
  - Nom et prénom
  - Email
  - Téléphone
  - Rôle
  - Compagnie
  - Station/Gare
- Préférences :
  - Mode sombre/clair/système
- Actions :
  - Déconnexion

### 3.9 Thème et personnalisation

#### Support des thèmes
- Mode clair
- Mode sombre
- Mode système (suit les préférences du système)
- Persistance de la préférence dans AsyncStorage
- Application automatique au démarrage

#### Polices
- Famille de polices Ubuntu :
  - Regular, Bold, Medium, Light
  - Italic variants

---

## 4. PERMISSIONS ET CAPACITÉS

### 4.1 Permissions requises

#### iOS
- **Localisation** : Accès à la position pour le suivi de trajet
- **Caméra** : Scan de QR codes

#### Android
- **CAMERA** : Scan de QR codes
- **RECORD_AUDIO** : Pour les fonctionnalités audio
- **ACCESS_FINE_LOCATION** : Localisation précise
- **ACCESS_COARSE_LOCATION** : Localisation approximative
- **ACCESS_BACKGROUND_LOCATION** : Localisation en arrière-plan

### 4.2 Capacités natives utilisées
- Caméra (scan QR)
- GPS/Géolocalisation (suivi de trajet)
- Cartes (affichage de la position)
- Audio (son de confirmation)
- Haptique (retour tactile)
- Stockage local (AsyncStorage)

---

## 5. SÉCURITÉ

### 5.1 Authentification
- JWT avec access token et refresh token
- Stockage sécurisé dans AsyncStorage
- Vérification automatique de l'expiration
- Rafraîchissement automatique des tokens
- Nettoyage automatique en cas d'erreur

### 5.2 Validation
- Validation des données côté client
- Validation des QR codes via API
- Vérification des permissions utilisateur
- Gestion des erreurs réseau

---

## 6. PERFORMANCES

### 6.1 Optimisations
- Pagination pour les listes
- Lazy loading des images
- Mémorisation des composants (React.memo, useMemo)
- Optimisation du rendu (removeClippedSubviews)
- Filtrage des positions GPS pour économiser la batterie
- Logging conditionnel (uniquement en développement)

### 6.2 Gestion de la mémoire
- Nettoyage des ressources audio
- Désabonnement des listeners d'événements
- Optimisation des animations

---

## 7. GESTION DES ERREURS

### 7.1 Stratégies
- Try-catch pour les opérations asynchrones
- Gestion des erreurs réseau avec retry
- Messages d'erreur utilisateur
- Logging des erreurs pour le débogage
- Fallback en cas d'erreur

### 7.2 Types d'erreurs gérées
- Erreurs réseau (timeout, connexion)
- Erreurs d'authentification (session expirée)
- Erreurs de validation (QR invalide)
- Erreurs de permissions
- Erreurs de parsing de données

---

## 8. TESTS ET QUALITÉ

### 8.1 Outils
- **ESLint** : Analyse statique du code
- **TypeScript** : Typage statique
- **React Compiler** : Optimisation automatique (expérimental)

### 8.2 Bonnes pratiques
- Code commenté (fonctions documentées)
- Principes Clean Code (DRY, KISS, YAGNI, SOLID)
- Structure modulaire
- Séparation des responsabilités

---

## 9. DÉPLOIEMENT

### 9.1 Plateformes supportées
- **iOS** : Bundle ID `com.allonmobilepro`
- **Android** : Package `com.allonmobilepro`
- **Web** : Build statique

### 9.2 Configuration
- **Node.js** : Version 22 recommandée (nvm use 22)
- **Expo CLI** : Pour le développement et le build

---

## 10. FONCTIONNALITÉS PAR RÔLE

### 10.1 Conducteur (Driver)
- Voir ses départs assignés
- Scanner les tickets QR
- Démarrer et suivre un trajet
- Marquer les statuts (embarquement, départ, arrivée)

### 10.2 Superviseur (Supervisor)
- Voir les départs de sa compagnie
- Scanner les tickets QR
- Rechercher des réservations
- Gérer les bagages
- Marquer les statuts des départs

### 10.3 Autres rôles
- Accès selon les permissions définies dans le backend

---

## 11. RÉSUMÉ DES FONCTIONNALITÉS

### 11.1 Fonctionnalités principales

1. **Authentification**
   - Connexion avec email/nom d'utilisateur
   - Mot de passe oublié (processus en 4 étapes)
   - Gestion de session automatique
   - Rafraîchissement de token

2. **Gestion des départs**
   - Liste paginée avec filtres par date
   - Détails complets d'un départ
   - Actions selon le rôle (scan, recherche, démarrage)

3. **Scan QR codes**
   - Scanner de tickets avec validation
   - Zone de scan dédiée
   - Retour haptique et audio
   - Gestion d'erreurs robuste

4. **Résultats de scan**
   - Affichage des informations de réservation
   - Actions sur la réservation (bagages, validation)

5. **Gestion des réservations**
   - Liste paginée des réservations
   - Détails complets d'une réservation
   - Recherche et filtrage

6. **Gestion des bagages**
   - Liste des bagages par passager
   - Ajout de bagage avec formulaire complet
   - Détails et check-in des bagages
   - QR codes pour bagages vérifiés

7. **Suivi de trajet**
   - Suivi GPS en temps réel
   - Carte interactive
   - Actions de statut (embarquement, départ, arrivée)
   - Optimisation batterie

8. **Profil utilisateur**
   - Informations personnelles
   - Préférences de thème
   - Déconnexion

9. **Thème et personnalisation**
   - Mode clair/sombre/système
   - Polices Ubuntu personnalisées

### 11.2 Fonctionnalités techniques

- **Routage** : File-based routing avec Expo Router
- **Navigation** : Onglets et navigation stack
- **État** : Hooks React + Context API
- **Stockage** : AsyncStorage pour persistance
- **Réseau** : Axios avec gestion d'erreurs
- **Permissions** : Gestion native iOS/Android
- **Performance** : Optimisations multiples
- **Sécurité** : JWT avec refresh token

---

## 12. AMÉLIORATIONS FUTURES POSSIBLES

- Notifications push
- Mode hors ligne
- Synchronisation en arrière-plan
- Statistiques et rapports
- Export de données
- Support multilingue
- Amélioration de l'accessibilité
- Tests automatisés (Jest, React Native Testing Library)
- CI/CD pipeline

---

## CONCLUSION

AllOn Mobile Pro est une application mobile professionnelle construite avec React Native et Expo, offrant une architecture modulaire et scalable. Elle utilise les meilleures pratiques de développement mobile avec un focus sur la performance, la sécurité et l'expérience utilisateur.

Le système est conçu pour être maintenable, avec une séparation claire des responsabilités, une gestion d'état efficace, et une communication robuste avec le backend.

---