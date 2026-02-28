//@ts-nocheck
import { processScanApi, verifyLuggageQRCode } from '@/api/departures';
import { styles } from '@/styles/scan-bagage';
import { MaterialIcons } from '@expo/vector-icons';
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
    Text,
    View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const SCAN_AREA_SIZE = 280;
const SCAN_COOLDOWN = 2000;
const API_TIMEOUT = 10000;
const ALLOWED_ROLE = 'PORTER';

/** Résumé réservation associée au bagage */
interface BaggageBooking {
    id: string;
    code: string;
    trip: string;
    bookingDateTime: string;
}

/** Dimensions (total, width, height, length en cm) */
interface BaggageDimensions {
    total: number;
    width: number;
    height: number;
    length: number;
}

/** Utilisateur (createdBy / updatedBy) */
interface BaggageUser {
    id: string;
    firstName: string;
    lastName: string;
    username: string;
    middleName: string | null;
    dateOfBirth: string;
    picture: string | null;
    email: string;
    civility: string;
    address: string;
    roleID: string;
    roleCode: string;
    phones?: Array<{ type: string; digits: string }>;
    createdAt: string;
    active: boolean;
}

/** Réponse API vérification QR code bagage (GET /luggage/tag/:tag) */
interface BaggageFromQR {
    id: string;
    bookingItemId: string;
    booking: BaggageBooking;
    type: string;
    status: string;
    estimatedWeight: number;
    actualWeight: number;
    estimatedDimensions: BaggageDimensions;
    actualDimensions: BaggageDimensions;
    price: number;
    basePrice: number;
    excessWeightFee: number;
    oversizedFee: number;
    fragileFee: number;
    currency: string;
    tagNumber: string;
    qrCode: string | null;
    registeredAt: string;
    checkedInAt: string | null;
    loadedAt: string | null;
    unloadedAt: string | null;
    deliveredAt: string | null;
    cancelledAt: string | null;
    excessFeePaymentId: string | null;
    excessFeePaidAt: string | null;
    description: string;
    isFragile: boolean;
    vehicleCompartment: string | null;
    position: string | null;
    checkedInBy: string;
    loadedBy: string | null;
    unloadedBy: string | null;
    deliveredBy: string | null;
    stationId: string;
    cancelReason: string | null;
    createdBy: BaggageUser;
    updatedBy: BaggageUser;
    createdAt: string;
    updatedAt: string;
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
 * Vérifie si l'utilisateur a le rôle PORTER (accès réservé au scan bagage).
 */
const usePorterAccess = () => {
    const [hasAccess, setHasAccess] = useState<boolean | null>(null);

    useEffect(() => {
        const check = async () => {
            const role = await AsyncStorage.getItem('user_role');
            setHasAccess(role?.toUpperCase() === ALLOWED_ROLE);
        };
        check();
    }, []);

    return hasAccess;
};

/**
 * Écran de scan de QR Code bagage : même logique que scan-qr, réservé au rôle PORTER.
 */
const ScanBagageScreen = () => {
    const insets = useSafeAreaInsets();
    const hasPorterAccess = usePorterAccess();
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
    const scanLockRef = useRef(false);

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

    useEffect(() => {
        const measureScanArea = () => {
            if (!scanAreaRef.current) return;
            scanAreaRef.current.measure((x, y, width, height, pageX, pageY) => {
                if (pageX === 0 && pageY === 0 && measureAttempts.current < 5) {
                    measureAttempts.current++;
                    setTimeout(measureScanArea, 200);
                    return;
                }
                setScanAreaPosition({ x: pageX, y: pageY, width, height });
            });
        };
        const t1 = setTimeout(measureScanArea, 300);
        const t2 = setTimeout(measureScanArea, 800);
        return () => {
            clearTimeout(t1);
            clearTimeout(t2);
        };
    }, []);

    const playBeepSound = async () => {
        try {
            if (soundRef.current) await soundRef.current.unloadAsync();
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
        } catch (e) {
            console.log('[AUDIO] Impossible de jouer le son:', e);
        }
    };

    const triggerHapticFeedback = async (type: 'success' | 'error' | 'warning' = 'success') => {
        try {
            const map = {
                success: Haptics.NotificationFeedbackType.Success,
                error: Haptics.NotificationFeedbackType.Error,
                warning: Haptics.NotificationFeedbackType.Warning,
            };
            await Haptics.notificationAsync(map[type]);
        } catch (e) {
            console.log('[HAPTIC] Erreur:', e);
        }
    };

    const isQRCodeInScanArea = (bounds, cornerPoints): boolean => {
        if (!scanAreaPosition) return false;
        let centerX: number, centerY: number;
        if (cornerPoints?.length === 4) {
            centerX = cornerPoints.reduce((s, p) => s + p.x, 0) / 4;
            centerY = cornerPoints.reduce((s, p) => s + p.y, 0) / 4;
        } else if (bounds) {
            const norm = bounds.origin.x <= 1 && bounds.origin.y <= 1;
            const qrX = norm ? bounds.origin.x * SCREEN_WIDTH : bounds.origin.x;
            const qrY = norm ? bounds.origin.y * SCREEN_HEIGHT : bounds.origin.y;
            const qrW = norm ? bounds.size.width * SCREEN_WIDTH : bounds.size.width;
            const qrH = norm ? bounds.size.height * SCREEN_HEIGHT : bounds.size.height;
            centerX = qrX + qrW / 2;
            centerY = qrY + qrH / 2;
        } else return false;
        const { x, y, width, height } = scanAreaPosition;
        return centerX >= x && centerX <= x + width && centerY >= y && centerY <= y + height;
    };

    const withTimeout = <T,>(promise: Promise<T>, ms = API_TIMEOUT): Promise<T> =>
        Promise.race([
            promise,
            new Promise<T>((_, rej) => setTimeout(() => rej(new Error('Request timeout')), ms)),
        ]);

    const verifyQRCodeApi = async (data: string): Promise<BaggageFromQR | null> => {
        try {
            const token = await AsyncStorage.getItem('token');
            if (!token) {
                Alert.alert('Erreur', 'Session expirée. Veuillez vous reconnecter.');
                return null;
            }
            console.log("[SCAN] Vérification du QR code:", data);
            const response = await withTimeout(verifyLuggageQRCode(data, token));
            console.log("[SCAN] Réponse de la vérification du QR code:", response);
            console.log("[SCAN] Réponse de la vérification du QR code:", response.data);
            if (response?.data) {
                console.log("SCAN OKAY !!!");
                return response.data as BaggageFromQR;
            }
            console.log("SCAN NOT OKAY !!!");
            return null;
        } catch (error: any) {
            if (error.message?.includes('timeout')) {
                Alert.alert('Délai dépassé', 'Vérifiez votre connexion.');
            } else if (error.message?.includes('Network')) {
                Alert.alert('Erreur réseau', 'Vérifiez votre connexion internet.');
            }
            console.log("SCAN NOT OKAY 2 !!!");
            return null;
        }
    };

    const processScan = async (baggage: BaggageFromQR, retryCount = 0) => {
        const MAX_RETRIES = 2;
        try {
            const token = await AsyncStorage.getItem('token');
            if (!token) throw new Error('Token non disponible');
            const response = await withTimeout(processScanApi(baggage, token));
            if (response?.data) {
                // let departure: any = null;
                // try {
                //     if (params.departure) departure = JSON.parse(params.departure);
                // } catch (_) {}
                // const bookingDepartureId = (response.data as any)?.booking?.departure?.id ?? (response.data as BaggageFromQR)?.booking?.id;
                // const departureId = departure?.id;
                // if (departureId && bookingDepartureId && departureId !== bookingDepartureId) {
                //     await triggerHapticFeedback('error');
                //     setLoadingScanProcess(false);
                //     Alert.alert(
                //         'Ticket invalide',
                //         'Ce ticket ne correspond pas au départ sélectionné.',
                //         [{ text: 'OK', onPress: resetScan }]
                //     );
                //     return;
                // }
                await triggerHapticFeedback('success');
                router.push({
                    pathname: '/scan-result',
                    params: { bookingData: JSON.stringify(response.data) },
                });
            } else {
                Alert.alert(
                    'Erreur',
                    response?.data?.message || response?.data?.error || 'Erreur lors du traitement.',
                    [{ text: 'OK' }],
                    { cancelable: true }
                );
            }
        } catch (error: any) {
            const statusCode = error.response?.status;
            if (statusCode === 403) {
                await triggerHapticFeedback('error');
                Alert.alert(
                    'Accès refusé',
                    'Vous n\'avez pas le droit de scanner ce QR code.',
                    [{ text: 'OK', onPress: resetScan }],
                    { cancelable: true }
                );
                return;
            }
            if (
                retryCount < MAX_RETRIES &&
                (error.message?.includes('Network') || error.message?.includes('timeout'))
            ) {
                await new Promise((r) => setTimeout(r, 1000));
                return processScan(baggage, retryCount + 1);
            }
            await triggerHapticFeedback('error');
            Alert.alert(
                'Erreur',
                retryCount >= MAX_RETRIES
                    ? 'Impossible de traiter le scan après plusieurs tentatives.'
                    : 'Une erreur est survenue.',
                [{ text: 'OK', onPress: resetScan }],
                { cancelable: true }
            );
        } finally {
            setLoadingScanProcess(false);
        }
    };

    const handleBarCodeScanned = async ({ type, data, bounds, cornerPoints }) => {
        if (scanLockRef.current) return;
        if (scanned || !isScanningEnabled) return;
        if (lastScannedData.current === data) return;
        const now = Date.now();
        if (now - lastScanTime.current < SCAN_COOLDOWN) return;
        if (!isQRCodeInScanArea(bounds, cornerPoints)) {
            setDetectedQRs((prev) => [...prev.slice(-4), { data: data.substring(0, 20), inZone: false, timestamp: now }]);
            return;
        }
        scanLockRef.current = true;
        setIsScanningEnabled(false);
        setScanned(true);
        setLoadingScanProcess(true);
        setHasScannedOnce(true);
        lastScanTime.current = now;
        lastScannedData.current = data;

        console.log("[SCAN] Scanné le QR code:", data);

        await Promise.all([playBeepSound(), triggerHapticFeedback('success')]);
        const validationData = await verifyQRCodeApi(data);
        console.log("[SCAN] Validation data:", validationData);
        if (!validationData) {
            setLoadingScanProcess(false);
            setScanned(false);
            scanLockRef.current = false;
            await triggerHapticFeedback('error');
            Alert.alert('QR Code invalide', 'Le QR code scanné n\'est pas valide.', [
                {
                    text: 'Réessayer',
                    onPress: () => {
                        scanLockRef.current = false;
                        setIsScanningEnabled(true);
                        lastScannedData.current = null;
                    },
                },
            ]);
            return;
        }
        setDetectedQRs((prev) => [...prev.slice(-4), { data: data.substring(0, 20), inZone: true, timestamp: now }]);
        // await processScan(validationData);
        router.push({
            pathname: '/scan-luggage-result',
            params: { luggageData: JSON.stringify(validationData) },
        });
    };

    const toggleTorch = () => {
        setTorchEnabled(!torchEnabled);
        triggerHapticFeedback('warning');
    };

    const resetScan = () => {
        scanLockRef.current = false;
        setScanned(false);
        setIsScanningEnabled(true);
        lastScanTime.current = 0;
        lastScannedData.current = null;
    };

    // Accès réservé PORTER
    if (hasPorterAccess === false) {
        return (
            <View style={styles.container}>
                <View style={styles.restrictedContainer}>
                    <MaterialCommunityIcons name="lock" size={80} color="rgba(255,255,255,0.5)" />
                    <Text style={styles.restrictedTitle}>Accès réservé</Text>
                    <Text style={styles.restrictedText}>
                        Le scan des QR codes bagage est réservé aux porteurs (rôle PORTER).
                    </Text>
                    <Pressable style={styles.restrictedButton} onPress={() => router.back()}>
                        <MaterialIcons name="arrow-back" size={24} color="#000" />
                        <Text style={styles.restrictedButtonText}>Retour</Text>
                    </Pressable>
                </View>
            </View>
        );
    }

    if (hasPorterAccess === null) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#FFF" />
            </View>
        );
    }

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
                        Nous avons besoin d'accéder à votre caméra pour scanner les QR codes bagage.
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
        outputRange: [-SCAN_AREA_SIZE / 2, SCAN_AREA_SIZE / 2],
    });

    return (
        <View style={styles.container}>
            <CameraView
                style={styles.camera}
                facing="back"
                enableTorch={torchEnabled}
                onBarcodeScanned={isScanningEnabled && !scanned ? handleBarCodeScanned : undefined}
                barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            >
                <View style={styles.overlay}>
                    <Pressable style={[styles.closeButton, { top: insets.top + 16 }]} onPress={() => router.back()}>
                        <MaterialIcons name="arrow-back" size={24} color="#FFF" />
                    </Pressable>
                    <Pressable style={[styles.torchButton, { top: insets.top + 16 }]} onPress={toggleTorch}>
                        <MaterialCommunityIcons
                            name={torchEnabled ? 'flashlight' : 'flashlight-off'}
                            size={24}
                            color="#FFF"
                        />
                    </Pressable>
                    <View style={styles.overlayTop} />
                    <View style={styles.scanRow}>
                        <View style={styles.overlaySide} />
                        <View ref={scanAreaRef} style={styles.scanArea} collapsable={false}>
                            {!scanned && isScanningEnabled && (
                                <Animated.View style={[styles.scanLine, { transform: [{ translateY: scanLineTranslateY }] }]} />
                            )}
                            <View style={[styles.corner, styles.topLeft]} />
                            <View style={[styles.corner, styles.topRight]} />
                            <View style={[styles.corner, styles.bottomLeft]} />
                            <View style={[styles.corner, styles.bottomRight]} />
                            {!scanned && isScanningEnabled && (
                                <View style={styles.gridContainer}>
                                    <View style={[styles.gridLineVertical, { left: '33.33%' }]} />
                                    <View style={[styles.gridLineVertical, { left: '66.66%' }]} />
                                    <View style={[styles.gridLineHorizontal, { top: '33.33%' }]} />
                                    <View style={[styles.gridLineHorizontal, { top: '66.66%' }]} />
                                </View>
                            )}
                        </View>
                        <View style={styles.overlaySide} />
                    </View>
                    {loadingScanProcess && (
                        <View style={styles.loadingScanProcess} pointerEvents="box-only">
                            <ActivityIndicator size="large" color="#FFF" />
                            <Text style={styles.loadingText}>Traitement en cours...</Text>
                        </View>
                    )}
                    <View style={styles.overlayBottom}>
                        <View style={styles.instructionContainer}>
                            <Text style={styles.instructionTitle}>
                                {scanned ? 'QR Code du bagage scanné !' : 'Placez le QR code du bagage dans la zone de scan'}
                            </Text>
                            <Text style={styles.instructionText}>
                                {scanned ? 'Scan effectué avec succès' : 'Le QR code du bagage doit être centré dans la zone blanche'}
                            </Text>
                            {hasScannedOnce && !loadingScanProcess && (
                                <Pressable
                                    style={[styles.rescanButton, scanned && styles.rescanButtonActive]}
                                    onPress={resetScan}
                                >
                                    <MaterialCommunityIcons name="refresh" size={20} color={scanned ? '#FFF' : '#000'} />
                                    <Text style={[styles.rescanButtonText, scanned && styles.rescanButtonTextActive]}>
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

export default ScanBagageScreen;
