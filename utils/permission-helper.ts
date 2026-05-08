import * as Location from 'expo-location';
import { Alert, Linking, Platform } from 'react-native';

/**
 * Résultat de la vérification des permissions
 */
export interface PermissionCheckResult {
    foreground: boolean;
    background: boolean;
    canTrack: boolean;
    canTrackInBackground: boolean;
}

/**
 * Vérifier toutes les permissions de localisation
 */
export async function checkLocationPermissions(): Promise<PermissionCheckResult> {
    try {
        const foreground = await Location.getForegroundPermissionsAsync();
        const background = await Location.getBackgroundPermissionsAsync();

        return {
            foreground: foreground.status === 'granted',
            background: background.status === 'granted',
            canTrack: foreground.status === 'granted',
            canTrackInBackground: foreground.status === 'granted' && background.status === 'granted',
        };
    } catch (error) {
        console.error('[PermissionHelper] Erreur vérification permissions:', error);
        return {
            foreground: false,
            background: false,
            canTrack: false,
            canTrackInBackground: false,
        };
    }
}

/**
 * Demander les permissions avec des messages explicites
 */
export async function requestLocationPermissionsWithExplanation(): Promise<boolean> {
    try {
        console.log('[PermissionHelper] Demande des permissions...');

        // Étape 1 : Permission foreground
        const foregroundResult = await Location.requestForegroundPermissionsAsync();

        if (foregroundResult.status !== 'granted') {
            console.error('[PermissionHelper] Permission foreground refusée');
            
            Alert.alert(
                'Permission requise',
                'Pour partager votre position en temps réel avec les passagers, l\'application a besoin d\'accéder à votre localisation.',
                [
                    { text: 'Annuler', style: 'cancel' },
                    { text: 'Ouvrir les paramètres', onPress: () => Linking.openSettings() },
                ]
            );
            
            return false;
        }

        console.log('[PermissionHelper] Permission foreground accordée');

        // Étape 2 : Permission background (critique pour tracking continu)
        const backgroundResult = await Location.requestBackgroundPermissionsAsync();

        if (backgroundResult.status !== 'granted') {
            console.warn('[PermissionHelper] Permission background refusée');
            
            Alert.alert(
                'Permission arrière-plan recommandée',
                'Pour continuer le partage de position même quand vous quittez l\'application, activez "Autoriser tout le temps" dans les paramètres.',
                [
                    { text: 'Plus tard', style: 'cancel' },
                    { text: 'Ouvrir les paramètres', onPress: () => Linking.openSettings() },
                ]
            );
            
            // On continue quand même avec foreground uniquement
            return true;
        }

        console.log('[PermissionHelper] Permission background accordée');
        return true;
    } catch (error) {
        console.error('[PermissionHelper] Erreur demande permissions:', error);
        return false;
    }
}

/**
 * Afficher un guide pour activer les permissions manuellement
 */
export function showPermissionGuide(): void {
    const message = Platform.select({
        android: 'Pour activer le partage de position :\n\n' +
            '1. Ouvrez les Paramètres\n' +
            '2. Applications → AllOn Pro\n' +
            '3. Autorisations → Position\n' +
            '4. Sélectionnez "Autoriser tout le temps"\n' +
            '5. Activez "Utiliser la position précise"',
        ios: 'Pour activer le partage de position :\n\n' +
            '1. Ouvrez Réglages\n' +
            '2. Confidentialité → Localisation\n' +
            '3. AllOn Pro\n' +
            '4. Sélectionnez "Toujours"\n' +
            '5. Activez "Position exacte"',
        default: 'Veuillez activer les permissions de localisation dans les paramètres.',
    });

    Alert.alert(
        'Guide des permissions',
        message,
        [
            { text: 'OK', style: 'default' },
            { text: 'Ouvrir les paramètres', onPress: () => Linking.openSettings() },
        ]
    );
}

/**
 * Vérifier si le GPS est activé sur l'appareil
 */
export async function isGPSEnabled(): Promise<boolean> {
    try {
        const enabled = await Location.hasServicesEnabledAsync();
        console.log('[PermissionHelper] GPS activé:', enabled);
        return enabled;
    } catch (error) {
        console.error('[PermissionHelper] Erreur vérification GPS:', error);
        return false;
    }
}

/**
 * Vérification complète avant de démarrer le tracking
 */
export async function performPreTrackingChecks(): Promise<{
    success: boolean;
    message?: string;
}> {
    console.log('[PermissionHelper] Vérification pré-tracking...');

    // 1. Vérifier si le GPS est activé
    const gpsEnabled = await isGPSEnabled();
    if (!gpsEnabled) {
        return {
            success: false,
            message: 'Le GPS est désactivé. Veuillez l\'activer dans les paramètres de votre appareil.',
        };
    }

    // 2. Vérifier les permissions
    const permissions = await checkLocationPermissions();
    
    if (!permissions.foreground) {
        return {
            success: false,
            message: 'Permission de localisation non accordée. Veuillez autoriser l\'accès à votre position.',
        };
    }

    if (!permissions.background) {
        console.warn('[PermissionHelper] Permission background manquante');
        return {
            success: true,
            message: 'Le tracking fonctionnera uniquement quand l\'app est ouverte. Pour un suivi continu, activez "Autoriser tout le temps".',
        };
    }

    console.log('[PermissionHelper] Toutes les vérifications passées');
    return { success: true };
}
