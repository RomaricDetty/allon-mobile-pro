//@ts-nocheck
import { processScanApi, verifyQRCode } from '@/api/departures';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Audio } from 'expo-av';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Animated,
    Dimensions,
    Pressable,
    StyleSheet,
    Text,
    View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const SCAN_AREA_SIZE = 280;
const SCAN_COOLDOWN = 2000;
const API_TIMEOUT = 10000;

interface QRValidationData {
    c: string;
    cid: string;
    did: string;
    t: string;
}

interface DetectedQR {
    data: string;
    inZone: boolean;
    timestamp: number;
}

interface ScanAreaPosition {
    x: number;
    y: number;
    width: number;
    height: number;
}

/**
 * Écran de scan de QR Code avec zone dédiée stricte et optimisations
 */
const ScanQRScreen = () => {
    const insets = useSafeAreaInsets();
    const [permission, requestPermission] = useCameraPermissions();
    const [scanned, setScanned] = useState(false);
    const [hasScannedOnce, setHasScannedOnce] = useState(false);
    const [torchEnabled, setTorchEnabled] = useState(false);
    const [scanAreaPosition, setScanAreaPosition] = useState<ScanAreaPosition | null>(null);
    const [detectedQRs, setDetectedQRs] = useState<DetectedQR[]>([]);
    const [loadingScanProcess, setLoadingScanProcess] = useState(false);
    const [isScanningEnabled, setIsScanningEnabled] = useState(true);

    const params = useLocalSearchParams<{ departure: string }>();

    const scanAreaRef = useRef(null);
    const lastScanTime = useRef(0);
    const lastScannedData = useRef<string | null>(null);
    const soundRef = useRef<Audio.Sound | null>(null);
    const scanAnimation = useRef(new Animated.Value(0)).current;
    const measureAttempts = useRef(0);

    console.log('params dans le scan-qr: ', JSON.stringify(params));

    /**
     * Animation de la ligne de scan
     */
    useEffect(() => {
        if (!scanned) {
            Animated.loop(
                Animated.sequence([
                    Animated.timing(scanAnimation, {
                        toValue: 1,
                        duration: 2000,
                        useNativeDriver: true,
                    }),
                    Animated.timing(scanAnimation, {
                        toValue: 0,
                        duration: 2000,
                        useNativeDriver: true,
                    }),
                ])
            ).start();
        }
    }, [scanned]);

    /**
     * Initialise le mode audio
     */
    useEffect(() => {
        Audio.setAudioModeAsync({
            playsInSilentModeIOS: true,
            staysActiveInBackground: false,
        });

        return () => {
            if (soundRef.current) {
                soundRef.current.unloadAsync();
            }
        };
    }, []);

    /**
     * Mesure la position de la zone de scan avec plusieurs tentatives
     */
    useEffect(() => {
        const measureScanArea = () => {
            if (!scanAreaRef.current) {
                console.log('[MEASURE] scanAreaRef non disponible');
                return;
            }

            scanAreaRef.current.measure((x, y, width, height, pageX, pageY) => {
                // Vérifier si la mesure est valide
                if (pageX === 0 && pageY === 0 && measureAttempts.current < 5) {
                    console.log('[MEASURE] Mesure invalide, nouvelle tentative...', {
                        attempt: measureAttempts.current + 1
                    });
                    measureAttempts.current++;
                    setTimeout(measureScanArea, 200);
                    return;
                }

                console.log('[MEASURE] Zone de scan mesurée:', {
                    pageX: pageX.toFixed(0),
                    pageY: pageY.toFixed(0),
                    width,
                    height
                });

                setScanAreaPosition({
                    x: pageX,
                    y: pageY,
                    width,
                    height
                });
            });
        };

        const timer1 = setTimeout(measureScanArea, 300);
        const timer2 = setTimeout(measureScanArea, 800);

        return () => {
            clearTimeout(timer1);
            clearTimeout(timer2);
        };
    }, []);

    /**
     * Joue un son de confirmation avec gestion des ressources
     */
    const playBeepSound = async () => {
        try {
            // Nettoyer le son précédent
            if (soundRef.current) {
                await soundRef.current.unloadAsync();
            }

            const { sound } = await Audio.Sound.createAsync(
                require('@/assets/mp3/beep-scan.mp3'),
                { shouldPlay: true, volume: 1 }
            );

            soundRef.current = sound;

            sound.setOnPlaybackStatusUpdate((status) => {
                if (status.isLoaded && status.didJustFinish) {
                    sound.unloadAsync();
                    soundRef.current = null;
                }
            });
        } catch (error) {
            console.log('[AUDIO] Impossible de jouer le son:', error);
        }
    };

    /**
     * Feedback haptique
     */
    const triggerHapticFeedback = async (type: 'success' | 'error' | 'warning' = 'success') => {
        try {
            switch (type) {
                case 'success':
                    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    break;
                case 'error':
                    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                    break;
                case 'warning':
                    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                    break;
            }
        } catch (error) {
            console.log('[HAPTIC] Erreur feedback haptique:', error);
        }
    };

    /**
     * Vérifie si le QR code est dans la zone de scan
     */
    const isQRCodeInScanArea = (bounds, cornerPoints): boolean => {
        if (!scanAreaPosition) {
            console.log('[ZONE] Zone de scan non initialisée');
            return false;
        }

        let centerX: number, centerY: number;

        // Priorité aux cornerPoints (plus fiables)
        if (cornerPoints?.length === 4) {
            centerX = cornerPoints.reduce((sum, p) => sum + p.x, 0) / 4;
            centerY = cornerPoints.reduce((sum, p) => sum + p.y, 0) / 4;
            console.log('[ZONE] Utilisation cornerPoints');
        }
        // Fallback sur bounds
        else if (bounds) {
            const isNormalized = bounds.origin.x <= 1 && bounds.origin.y <= 1;

            const qrX = isNormalized ? bounds.origin.x * SCREEN_WIDTH : bounds.origin.x;
            const qrY = isNormalized ? bounds.origin.y * SCREEN_HEIGHT : bounds.origin.y;
            const qrWidth = isNormalized ? bounds.size.width * SCREEN_WIDTH : bounds.size.width;
            const qrHeight = isNormalized ? bounds.size.height * SCREEN_HEIGHT : bounds.size.height;

            centerX = qrX + qrWidth / 2;
            centerY = qrY + qrHeight / 2;
            console.log('[ZONE] Utilisation bounds');
        }
        else {
            console.log('[ZONE] Aucune donnée de position disponible');
            return false;
        }

        const { x, y, width, height } = scanAreaPosition;
        const isInZone =
            centerX >= x && centerX <= x + width &&
            centerY >= y && centerY <= y + height;

        console.log(isInZone ? '[ZONE] QR dans la zone' : '[ZONE] QR hors zone', {
            center: { x: centerX.toFixed(0), y: centerY.toFixed(0) },
            zone: { x: x.toFixed(0), y: y.toFixed(0), width, height }
        });

        return isInZone;
    };

    /**
     * Wrapper avec timeout pour les appels API
     */
    const withTimeout = <T,>(promise: Promise<T>, timeoutMs: number = API_TIMEOUT): Promise<T> => {
        return Promise.race([
            promise,
            new Promise<T>((_, reject) =>
                setTimeout(() => reject(new Error('Request timeout')), timeoutMs)
            )
        ]);
    };

    /**
     * Vérifie si le QR code est valide via l'API
     */
    const verifyQRCodeApi = async (data: string): Promise<QRValidationData | null> => {
        try {
            const token = await AsyncStorage.getItem('token');

            if (!token) {
                console.error('[API] Token non disponible');
                Alert.alert('Erreur', 'Session expirée. Veuillez vous reconnecter.');
                return null;
            }

            console.log('[API] Vérification du QR code...');
            const response = await withTimeout(verifyQRCode(data, token));

            // Validation stricte du format
            if (response?.data &&
                typeof response.data.c === 'string' &&
                typeof response.data.cid === 'string' &&
                typeof response.data.did === 'string' &&
                typeof response.data.t === 'string') {
                console.log('[API] QR code valide:', {
                    c: response.data.c,
                    cid: response.data.cid,
                    did: response.data.did,
                    t: response.data.t
                });
                return response.data as QRValidationData;
            }

            console.log('[API] Format de réponse invalide');
            return null;
        } catch (error: any) {
            console.error('[API] Erreur vérification QR:', error.message || error);

            // Gestion spécifique des erreurs
            if (error.message?.includes('timeout')) {
                Alert.alert(
                    'Délai dépassé',
                    'La vérification du QR code a pris trop de temps. Vérifiez votre connexion.'
                );
            } else if (error.message?.includes('Network')) {
                Alert.alert(
                    'Erreur réseau',
                    'Impossible de se connecter au serveur. Vérifiez votre connexion internet.'
                );
            }

            return null;
        }
    };

    /**
     * Traite le scan du QR code avec retry
     */
    const processScan = async (validationData: QRValidationData, retryCount = 0) => {
        const MAX_RETRIES = 2;

        try {
            const token = await AsyncStorage.getItem('token');

            if (!token) {
                throw new Error('Token non disponible');
            }

            console.log('[PROCESS] Traitement du scan...', { retry: retryCount });
            const response = await withTimeout(processScanApi(validationData, token));

            if (response?.data) {
                console.log('[PROCESS] Scan traité avec succès');
                
                // Vérification que le ticket correspond au départ
                let departure: any = null;
                try {
                    if (params.departure) {
                        departure = JSON.parse(params.departure);
                    }
                } catch (error) {
                    console.error('[PROCESS] Erreur lors du parsing du départ:', error);
                }

                // Récupération de l'ID du départ depuis la réponse
                const bookingDepartureId = response.data?.booking?.departure?.id;
                const departureId = departure?.id;

                // Vérification de correspondance des IDs
                // if (departureId && bookingDepartureId && departureId !== bookingDepartureId) {
                //     console.log('[PROCESS] Les IDs ne correspondent pas:', {
                //         expected: departureId,
                //         received: bookingDepartureId
                //     });
                    
                //     await triggerHapticFeedback('error');
                //     setLoadingScanProcess(false);
                    
                //     Alert.alert(
                //         'Ticket invalide',
                //         'Ce ticket ne correspond pas au départ sélectionné. Veuillez scanner un ticket valide pour ce trajet.',
                //         [{ text: 'OK', onPress: resetScan }]
                //     );
                //     return;
                // }

                // Si tout est OK, on continue avec la redirection
                await triggerHapticFeedback('success');

                console.log('response.data dans le processScan: ', JSON.stringify(response.data));

                router.push({
                    pathname: '/scan-result',
                    params: {
                        bookingData: JSON.stringify(response.data),
                    },
                });
            } else {
                throw new Error('Réponse invalide du serveur');
            }
        } catch (error: any) {
            console.error('[PROCESS] Erreur traitement scan:', error.message || error);

            // Retry automatique pour les erreurs réseau
            if (retryCount < MAX_RETRIES &&
                (error.message?.includes('Network') || error.message?.includes('timeout'))) {
                console.log('[PROCESS] Nouvelle tentative...', { attempt: retryCount + 1 });
                await new Promise(resolve => setTimeout(resolve, 1000));
                return processScan(validationData, retryCount + 1);
            }

            // Erreur finale
            await triggerHapticFeedback('error');

            Alert.alert(
                'Erreur',
                retryCount >= MAX_RETRIES
                    ? 'Impossible de traiter le scan après plusieurs tentatives. Vérifiez votre connexion.'
                    : 'Une erreur est survenue lors du traitement du scan.',
                [{ text: 'OK', onPress: resetScan }]
            );
        } finally {
            setLoadingScanProcess(false);
        }
    };

    /**
     * Gère la détection du QR code
     */
    const handleBarCodeScanned = async ({ type, data, bounds, cornerPoints }) => {
        console.log('\n[SCAN] === NOUVEAU SCAN DÉTECTÉ ===');
        console.log('[SCAN] Type:', type);
        console.log('[SCAN] Data:', data.substring(0, 50));

        // Guards - dans l'ordre de priorité
        if (scanned || !isScanningEnabled) {
            console.log('[SCAN] Scan désactivé - ignoré');
            return;
        }

        if (lastScannedData.current === data) {
            console.log('[SCAN] QR code déjà scanné - ignoré');
            return;
        }

        const now = Date.now();
        if (now - lastScanTime.current < SCAN_COOLDOWN) {
            console.log('[SCAN] Cooldown actif - scan ignoré');
            return;
        }

        // Vérification zone AVANT toute autre action
        if (!isQRCodeInScanArea(bounds, cornerPoints)) {
            console.log('[SCAN] QR hors zone - ignoré\n');
            setDetectedQRs(prev => [...prev.slice(-4), {
                data: data.substring(0, 20),
                inZone: false,
                timestamp: now
            }]);
            return;
        }

        // Désactivation immédiate pour éviter les scans multiples
        console.log('[SCAN] QR valide - traitement...\n');
        setIsScanningEnabled(false);
        setScanned(true);
        setHasScannedOnce(true);
        lastScanTime.current = now;
        lastScannedData.current = data;

        // Feedback utilisateur immédiat
        await Promise.all([
            playBeepSound(),
            triggerHapticFeedback('success')
        ]);

        // Vérification API
        const validationData = await verifyQRCodeApi(data);

        if (!validationData) {
            console.log('[SCAN] QR code invalide ou erreur API');
            setScanned(false);
            await triggerHapticFeedback('error');

            Alert.alert(
                'QR Code invalide',
                'Le QR code scanné n\'est pas valide pour cette application.',
                [{
                    text: 'Réessayer',
                    onPress: () => {
                        setIsScanningEnabled(true);
                        lastScannedData.current = null;
                    }
                }]
            );
            return;
        }

        // Enregistrer le scan réussi
        setDetectedQRs(prev => [...prev.slice(-4), {
            data: data.substring(0, 20),
            inZone: true,
            timestamp: now
        }]);

        // Traitement final
        setLoadingScanProcess(true);
        await processScan(validationData);
    };

    /**
     * Active/désactive la torche
     */
    const toggleTorch = () => {
        setTorchEnabled(!torchEnabled);
        triggerHapticFeedback('warning');
    };

    /**
     * Réinitialise l'état du scan
     */
    const resetScan = () => {
        console.log('[SCAN] Réinitialisation du scan');
        setScanned(false);
        setIsScanningEnabled(true);
        lastScanTime.current = 0;
        lastScannedData.current = null;
    };

    // Affichage du loader initial
    if (!permission) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#FFF" />
            </View>
        );
    }

    // Écran de demande de permission
    if (!permission.granted) {
        return (
            <View style={styles.container}>
                <View style={styles.permissionContainer}>
                    <MaterialCommunityIcons name="camera-off" size={80} color="rgba(255,255,255,0.5)" />
                    <Text style={styles.permissionTitle}>Accès caméra requis</Text>
                    <Text style={styles.permissionText}>
                        Nous avons besoin d'accéder à votre caméra pour scanner les QR codes.
                    </Text>
                    <Pressable style={styles.permissionButton} onPress={requestPermission}>
                        <Text style={styles.permissionButtonText}>Autoriser la caméra</Text>
                    </Pressable>
                </View>
            </View>
        );
    }

    const scanLineTranslateY = scanAnimation.interpolate({
        inputRange: [0, 1],
        outputRange: [-SCAN_AREA_SIZE / 2, SCAN_AREA_SIZE / 2]
    });

    return (
        <View style={styles.container}>
            <CameraView
                style={styles.camera}
                facing="back"
                enableTorch={torchEnabled}
                onBarcodeScanned={isScanningEnabled && !scanned ? handleBarCodeScanned : undefined}
                barcodeScannerSettings={{
                    barcodeTypes: ['qr'],
                }}
            >
                <View style={styles.overlay}>
                    {/* Bouton fermer */}
                    <Pressable
                        style={[styles.closeButton, { top: insets.top + 16 }]}
                        onPress={() => router.back()}
                    >
                        <MaterialCommunityIcons name="close" size={28} color="#FFF" />
                    </Pressable>

                    {/* Bouton torche */}
                    <Pressable
                        style={[styles.torchButton, { top: insets.top + 16 }]}
                        onPress={toggleTorch}
                    >
                        <MaterialCommunityIcons
                            name={torchEnabled ? "flashlight" : "flashlight-off"}
                            size={24}
                            color="#FFF"
                        />
                    </Pressable>

                    {/* Zone supérieure sombre */}
                    <View style={styles.overlayTop} />

                    {/* Zone de scan centrale */}
                    <View style={styles.scanRow}>
                        <View style={styles.overlaySide} />

                        <View
                            ref={scanAreaRef}
                            style={styles.scanArea}
                            collapsable={false}
                        >
                            {/* Animation de scan */}
                            {!scanned && isScanningEnabled && (
                                <Animated.View
                                    style={[
                                        styles.scanLine,
                                        {
                                            transform: [{ translateY: scanLineTranslateY }]
                                        }
                                    ]}
                                />
                            )}

                            {/* Coins de la zone de scan */}
                            <View style={[styles.corner, styles.topLeft]} />
                            <View style={[styles.corner, styles.topRight]} />
                            <View style={[styles.corner, styles.bottomLeft]} />
                            <View style={[styles.corner, styles.bottomRight]} />

                            {/* Grille de guidage */}
                            {!scanned && isScanningEnabled && (
                                <View style={styles.gridContainer}>
                                    <View style={[styles.gridLineVertical, { left: '33.33%' }]} />
                                    <View style={[styles.gridLineVertical, { left: '66.66%' }]} />
                                    <View style={[styles.gridLineHorizontal, { top: '33.33%' }]} />
                                    <View style={[styles.gridLineHorizontal, { top: '66.66%' }]} />
                                </View>
                            )}

                            {/* Indicateur de chargement */}
                            {loadingScanProcess && (
                                <View style={styles.loadingScanProcess}>
                                    <ActivityIndicator size={50} color="#FFF" />
                                    <Text style={styles.loadingText}>Traitement...</Text>
                                </View>
                            )}
                        </View>

                        <View style={styles.overlaySide} />
                    </View>

                    {/* Zone inférieure */}
                    <View style={styles.overlayBottom}>
                        <View style={styles.instructionContainer}>
                            <Text style={styles.instructionTitle}>
                                {scanned ? 'QR Code scanné !' : 'Placez le QR dans la zone de scan'}
                            </Text>
                            <Text style={styles.instructionText}>
                                {scanned
                                    ? 'Scan effectué avec succès'
                                    : 'Le QR code doit être centré dans la zone blanche'
                                }
                            </Text>

                            {/* Bouton de rescan */}
                            {hasScannedOnce && !loadingScanProcess && (
                                <Pressable
                                    style={[
                                        styles.rescanButton,
                                        scanned && styles.rescanButtonActive
                                    ]}
                                    onPress={resetScan}
                                >
                                    <MaterialCommunityIcons
                                        name="refresh"
                                        size={20}
                                        color={scanned ? "#FFF" : "#000"}
                                    />
                                    <Text style={[
                                        styles.rescanButtonText,
                                        scanned && styles.rescanButtonTextActive
                                    ]}>
                                        Scanner à nouveau
                                    </Text>
                                </Pressable>
                            )}
                        </View>
                    </View>
                </View>
            </CameraView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    loadingContainer: {
        flex: 1,
        backgroundColor: '#000',
        justifyContent: 'center',
        alignItems: 'center',
    },
    camera: {
        flex: 1,
    },
    overlay: {
        flex: 1,
    },
    closeButton: {
        position: 'absolute',
        left: 20,
        zIndex: 10,
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(0,0,0,0.7)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    torchButton: {
        position: 'absolute',
        right: 20,
        zIndex: 10,
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(0,0,0,0.7)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    overlayTop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.7)',
    },
    scanRow: {
        flexDirection: 'row',
        height: SCAN_AREA_SIZE,
    },
    overlaySide: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.7)',
    },
    scanArea: {
        width: SCAN_AREA_SIZE,
        height: SCAN_AREA_SIZE,
        backgroundColor: 'transparent',
        justifyContent: 'center',
        alignItems: 'center',
    },
    scanLine: {
        position: 'absolute',
        width: SCAN_AREA_SIZE - 60,
        height: 2,
        backgroundColor: '#4CAF50',
        shadowColor: '#4CAF50',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: 4,
    },
    gridContainer: {
        position: 'absolute',
        width: '100%',
        height: '100%',
    },
    gridLineVertical: {
        position: 'absolute',
        width: 1,
        height: '100%',
        backgroundColor: 'rgba(255,255,255,0.2)',
    },
    gridLineHorizontal: {
        position: 'absolute',
        width: '100%',
        height: 1,
        backgroundColor: 'rgba(255,255,255,0.2)',
    },
    corner: {
        position: 'absolute',
        width: 30,
        height: 30,
        borderColor: '#FFF',
        borderWidth: 4,
    },
    topLeft: {
        top: 0,
        left: 0,
        borderRightWidth: 0,
        borderBottomWidth: 0,
    },
    topRight: {
        top: 0,
        right: 0,
        borderLeftWidth: 0,
        borderBottomWidth: 0,
    },
    bottomLeft: {
        bottom: 0,
        left: 0,
        borderRightWidth: 0,
        borderTopWidth: 0,
    },
    bottomRight: {
        bottom: 0,
        right: 0,
        borderLeftWidth: 0,
        borderTopWidth: 0,
    },
    overlayBottom: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.7)',
        paddingTop: 40,
    },
    instructionContainer: {
        alignItems: 'center',
        paddingHorizontal: 40,
    },
    instructionTitle: {
        fontSize: 20,
        fontFamily: 'Ubuntu_Bold',
        color: '#FFF',
        textAlign: 'center',
        marginBottom: 8,
    },
    instructionText: {
        fontSize: 14,
        fontFamily: 'Ubuntu_Regular',
        color: 'rgba(255,255,255,0.8)',
        textAlign: 'center',
        marginBottom: 20,
    },
    rescanButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFF',
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: 25,
        gap: 8,
    },
    rescanButtonActive: {
        backgroundColor: '#1776BA',
    },
    rescanButtonText: {
        fontSize: 16,
        fontFamily: 'Ubuntu_Medium',
        color: '#000',
    },
    rescanButtonTextActive: {
        color: '#FFF',
    },
    loadingScanProcess: {
        position: 'absolute',
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000,
        backgroundColor: 'rgba(0,0,0,0.85)',
    },
    loadingText: {
        fontSize: 16,
        fontFamily: 'Ubuntu_Medium',
        color: '#FFF',
        marginTop: 16,
    },
    permissionContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 40,
    },
    permissionTitle: {
        fontSize: 24,
        fontFamily: 'Ubuntu_Bold',
        color: '#FFF',
        marginTop: 24,
        marginBottom: 12,
        textAlign: 'center',
    },
    permissionText: {
        fontSize: 14,
        fontFamily: 'Ubuntu_Regular',
        color: 'rgba(255,255,255,0.7)',
        textAlign: 'center',
        marginBottom: 32,
        lineHeight: 22,
    },
    permissionButton: {
        backgroundColor: '#FFF',
        paddingVertical: 14,
        paddingHorizontal: 32,
        borderRadius: 30,
    },
    permissionButtonText: {
        fontSize: 16,
        fontFamily: 'Ubuntu_Bold',
        color: '#000',
    },
});

export default ScanQRScreen;