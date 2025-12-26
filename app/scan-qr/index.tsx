//@ts-nocheck
import { processScanApi, verifyQRCode } from '@/api/departures';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Audio } from 'expo-av';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { router } from 'expo-router';
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

/**
 * Écran de scan de QR Code avec zone dédiée STRICTE
 * Solution alternative : désactiver/réactiver le scanner selon la position
 */
const ScanQRScreen = () => {
    const insets = useSafeAreaInsets();
    const [permission, requestPermission] = useCameraPermissions();
    const [scanned, setScanned] = useState(false);
    const [hasScannedOnce, setHasScannedOnce] = useState(false);
    const [torchEnabled, setTorchEnabled] = useState(false);
    const [scanAreaPosition, setScanAreaPosition] = useState(null);
    const [detectedQRs, setDetectedQRs] = useState([]);
    const [hash, setHash] = useState(null);
    const [objetToValidate, setObjetToValidate] = useState<Object>({});
    const [loadingScanProcess, setLoadingScanProcess] = useState(false);
    const [isScanningEnabled, setIsScanningEnabled] = useState(true);
    const lastScannedData = useRef<string | null>(null); // Ajouter cette ligne

    const scanAreaRef = useRef(null);
    const lastScanTime = useRef(0);
    const scanAnimation = useRef(new Animated.Value(0)).current;
    const SCAN_COOLDOWN = 2000;

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
    }, []);

    /**
     * Mesure la position de la zone de scan
     */
    useEffect(() => {
        const measureScanArea = () => {
            if (scanAreaRef.current) {
                scanAreaRef.current.measure((x, y, width, height, pageX, pageY) => {
                    console.log('Zone de scan mesurée (measure):', { 
                        x, y, width, height, pageX, pageY 
                    });
                    
                    // Utiliser pageX/pageY car ce sont les coordonnées absolues
                    setScanAreaPosition({ 
                        x: pageX, 
                        y: pageY, 
                        width, 
                        height 
                    });
                });
            }
        };

        const timer = setTimeout(measureScanArea, 500);
        return () => clearTimeout(timer);
    }, []);

    /**
     * Joue un son de confirmation
     */
    const playBeepSound = async () => {
        try {
            const { sound } = await Audio.Sound.createAsync(
                require('@/assets/mp3/beep-scan.mp3'),
                { shouldPlay: true, volume: 1 }
            );
            
            sound.setOnPlaybackStatusUpdate((status) => {
                if (status.isLoaded && status.didJustFinish) {
                    sound.unloadAsync();
                }
            });
        } catch (error) {
            console.log('Impossible de jouer le son:', error);
        }
    };

    /**
     * NOUVELLE APPROCHE : Vérifier si le QR code est dans la zone
     * Cette fonction est appelée à chaque détection
     */
    const isQRCodeInScanArea = (bounds, cornerPoints) => {
        if (!scanAreaPosition) {
            console.log('Zone de scan non initialisée');
            return false;
        }

        // Essayer d'abord avec cornerPoints (plus fiable)
        if (cornerPoints && cornerPoints.length === 4) {
            console.log('Utilisation de cornerPoints:', cornerPoints);
            
            // Calculer le centre à partir des corner points
            const centerX = cornerPoints.reduce((sum, p) => sum + p.x, 0) / 4;
            const centerY = cornerPoints.reduce((sum, p) => sum + p.y, 0) / 4;

            console.log('Centre QR (cornerPoints):', { x: centerX, y: centerY });
            console.log('Zone de scan:', scanAreaPosition);

            const isInZone = 
                centerX >= scanAreaPosition.x &&
                centerX <= scanAreaPosition.x + scanAreaPosition.width &&
                centerY >= scanAreaPosition.y &&
                centerY <= scanAreaPosition.y + scanAreaPosition.height;

            console.log(isInZone ? 'Dans la zone !' : 'Hors zone !');
            return isInZone;
        }

        // Fallback : utiliser bounds si cornerPoints n'est pas disponible
        if (!bounds) {
            console.log('Pas de bounds ni cornerPoints - REFUSÉ');
            return false;
        }

        console.log('Utilisation de bounds:', bounds);

        // Vérifier si coordonnées normalisées ou pixels
        const isNormalized = bounds.origin.x <= 1 && 
                            bounds.origin.y <= 1 && 
                            bounds.size.width <= 1 && 
                            bounds.size.height <= 1;

        let qrX, qrY, qrWidth, qrHeight;

        if (isNormalized) {
            qrX = bounds.origin.x * SCREEN_WIDTH;
            qrY = bounds.origin.y * SCREEN_HEIGHT;
            qrWidth = bounds.size.width * SCREEN_WIDTH;
            qrHeight = bounds.size.height * SCREEN_HEIGHT;
        } else {
            qrX = bounds.origin.x;
            qrY = bounds.origin.y;
            qrWidth = bounds.size.width;
            qrHeight = bounds.size.height;
        }

        const centerX = qrX + qrWidth / 2;
        const centerY = qrY + qrHeight / 2;

        console.log('Centre QR (bounds):', { x: centerX, y: centerY });
        console.log('Zone de scan:', scanAreaPosition);

        const isInZone = 
            centerX >= scanAreaPosition.x &&
            centerX <= scanAreaPosition.x + scanAreaPosition.width &&
            centerY >= scanAreaPosition.y &&
            centerY <= scanAreaPosition.y + scanAreaPosition.height;

        console.log(isInZone ? 'Dans la zone !' : 'Hors zone !');
        return isInZone;
    };

    /**
     * Gère la détection du QR code
     */
    const handleBarCodeScanned = async ({ type, data, bounds, cornerPoints }) => {
        console.log('\n=== NOUVEAU SCAN DÉTECTÉ ===');
        console.log('Type:', type);
        console.log('Data:', data.substring(0, 50));
        console.log('Bounds:', bounds);
        console.log('CornerPoints:', cornerPoints);
        
        // Désactiver immédiatement le scan pour éviter les boucles
        if (scanned || !isScanningEnabled) {
            console.log('Scan désactivé - ignoré');
            return;
        }

        // Vérifier si c'est le même QR code que le dernier scanné
        if (lastScannedData.current === data) {
            console.log('Même QR code que le dernier scan - ignoré');
            return;
        }

        // Cooldown
        const now = Date.now();
        if (now - lastScanTime.current < SCAN_COOLDOWN) {
            console.log('Cooldown actif - scan ignoré');
            return;
        }

        // VÉRIFICATION STRICTE DE LA ZONE
        const isInZone = isQRCodeInScanArea(bounds, cornerPoints);
        
        if (!isInZone) {
            console.log('QR CODE HORS ZONE - IGNORÉ\n');
            // Enregistrer pour affichage debug
            setDetectedQRs(prev => [...prev.slice(-4), {
                data: data.substring(0, 20),
                inZone: false,
                timestamp: now
            }]);
            return;
        }

        console.log('QR CODE VALIDE - ACCEPTÉ\n');
        
        // Désactiver immédiatement le scan
        setIsScanningEnabled(false);
        lastScanTime.current = now;
        lastScannedData.current = data; // Enregistrer le QR code scanné
        
        setScanned(true);
        setHasScannedOnce(true);
        await playBeepSound();

        // TODO: Verifier si le QR code est valide
        const isValid = await verifyQRCodeApi(data);
        if (!isValid) {
            console.log('QR CODE NON VALIDE - IGNORÉ\n');
            setScanned(false);
            // NE PAS réactiver le scan ici - il restera désactivé jusqu'au clic sur "Réessayer"
            lastScanTime.current = 0;
            lastScannedData.current = null; // Réinitialiser pour permettre un nouveau scan
            
            Alert.alert(
                'QR Code invalide',
                'Le QR code scanné n\'est pas un QR Code valide.',
                [
                    {
                        text: 'Réessayer',
                        onPress: () => {
                            // Réactiver le scan uniquement quand l'utilisateur clique sur "Réessayer"
                            setIsScanningEnabled(true);
                            lastScanTime.current = 0;
                            lastScannedData.current = null;
                        }
                    }
                ]
            );
            return;
        }

        // Enregistrer le scan réussi
        setDetectedQRs(prev => [...prev.slice(-4), {
            data: data.substring(0, 20),
            inZone: true,
            timestamp: now
        }]);

        setHash(data);
        setLoadingScanProcess(true);
        await processScan();
    };

    /**
     * Vérifie si le QR code est valide en appelant l'API
     * @param data - Le QR code scanné
     * @returns true si le QR code est valide (format correct), false sinon
     */
    const verifyQRCodeApi = async (data: string) => {
        try {
            const token = await AsyncStorage.getItem('token');
            const response = await verifyQRCode(data, token);
            console.log('Réponse de la vérification du QR code:', response.data);
            
            // Vérifier que la réponse a le format attendu
            if (response.data && 
                typeof response.data.c === 'string' && 
                typeof response.data.cid === 'string' && 
                typeof response.data.did === 'string' && 
                typeof response.data.t === 'string') {
                    console.log('response.data dans le verifyQRCodeApi: ', response.data);
                    setObjetToValidate({... response.data});
                return true;
            }
            
            return false;
        } catch (error) {
            console.log('Erreur lors de la vérification du QR code:', error);
            return false;
        }
    };

    /**
     * Traite le scan du QR code
     */
    const processScan = async () => {
        try {
            const token = await AsyncStorage.getItem('token');
            const response = await processScanApi(objetToValidate, token);
            
            // Naviguer vers l'écran de résultat avec les données de la réservation
            if (response.data) {
                router.push({
                    pathname: '/scan-result',
                    params: {
                        bookingData: JSON.stringify(response.data),
                    },
                });
            }
        } catch (error) {
            console.log('Erreur lors du traitement du scan:', error);
            Alert.alert(
                'Erreur',
                'Une erreur est survenue lors du traitement du scan. Veuillez réessayer.',
                [
                    {
                        text: 'OK',
                        onPress: () => {
                            resetScan();
                        }
                    }
                ]
            );
        } finally {
            setLoadingScanProcess(false);
        }
    };

    /**
     * Active/désactive la torche
     */
    const toggleTorch = () => {
        setTorchEnabled(!torchEnabled);
    };

    const resetScan = () => {
        setScanned(false);
        setIsScanningEnabled(true);
        lastScanTime.current = 0;
        lastScannedData.current = null; // Réinitialiser le dernier QR code scanné
    };

    if (!permission) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#FFF" />
            </View>
        );
    }

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
                    {/* Boutons */}
                    <Pressable
                        style={[styles.closeButton, { top: insets.top + 16 }]}
                        onPress={() => router.back()}
                    >
                        <MaterialCommunityIcons name="close" size={28} color="#FFF" />
                    </Pressable>

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

                    {/* Zone supérieure */}
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

                            {/* Coins */}
                            <View style={[styles.corner, styles.topLeft]} />
                            <View style={[styles.corner, styles.topRight]} />
                            <View style={[styles.corner, styles.bottomLeft]} />
                            <View style={[styles.corner, styles.bottomRight]} />

                            {/* Grille de guidage */}
                            {!scanned && (
                                <View style={styles.gridContainer}>
                                    <View style={styles.gridLineVertical} />
                                    <View style={styles.gridLineVertical} />
                                    <View style={styles.gridLineHorizontal} />
                                    <View style={styles.gridLineHorizontal} />
                                </View>
                            )}

                            {loadingScanProcess && (
                                <View style={styles.loadingScanProcess}>
                                    <ActivityIndicator size="large" color="#FFF" />
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
                                    : 'Le QR code doit être dans la zone de scan'
                                }
                            </Text>

                            {hasScannedOnce && (
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
        left: '33.33%',
    },
    gridLineHorizontal: {
        position: 'absolute',
        width: '100%',
        height: 1,
        backgroundColor: 'rgba(255,255,255,0.2)',
        top: '33.33%',
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
    successIndicator: {
        position: 'absolute',
        backgroundColor: 'rgba(255,255,255,0.95)',
        width: 80,
        height: 80,
        borderRadius: 40,
        justifyContent: 'center',
        alignItems: 'center',
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
    debugContainer: {
        backgroundColor: 'rgba(0,0,0,0.8)',
        padding: 12,
        borderRadius: 8,
        marginBottom: 16,
        width: '100%',
    },
    debugText: {
        fontSize: 10,
        fontFamily: 'Courier',
        color: '#FFF',
        marginBottom: 2,
    },
    debugSuccess: {
        color: '#4CAF50',
    },
    debugError: {
        color: '#F44336',
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
        backgroundColor: '#4CAF50',
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