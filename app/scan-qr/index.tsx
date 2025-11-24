//@ts-nocheck
import { Audio } from 'expo-av';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Pressable,
    StyleSheet,
    Text,
    View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

/**
 * Écran de scan de QR Code avec design moderne
 */
const ScanQRScreen = () => {

    const insets = useSafeAreaInsets();
    const [permission, requestPermission] = useCameraPermissions();
    const [scanned, setScanned] = useState(false);
    const [hasScannedOnce, setHasScannedOnce] = useState(false);
    const [torchEnabled, setTorchEnabled] = useState(false);

    /**
     * Initialise le mode audio au montage du composant
     */
    useEffect(() => {
        Audio.setAudioModeAsync({
            playsInSilentModeIOS: true,
            staysActiveInBackground: false,
        });

        return () => {
            // Nettoyage si nécessaire
        };
    }, []);

    /**
     * Joue un son de confirmation lors du scan
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
     * Gère le scan d'un QR code
     */
    const handleBarCodeScanned = async ({ type, data }: { type: string; data: string }) => {
        if (scanned) return;

        setScanned(true);
        setHasScannedOnce(true);
        console.log(`QR Code scanné - Type: ${type}, Data: ${data}`);

        // Joue un son de confirmation
        await playBeepSound();

        // Traiter les données du QR code
        Alert.alert(
            'QR Code scanné !',
            `Contenu: ${data}`,
            [
                {
                    text: 'Scanner à nouveau',
                    onPress: () => setScanned(false)
                },
                { text: 'OK', style: 'cancel' }
            ]
        );
    };

    /**
     * Toggle la torche
     */
    const toggleTorch = () => {
        setTorchEnabled(!torchEnabled);
    };

    /**
     * Réinitialise le scan pour permettre un nouveau scan
     */
    const resetScan = () => {
        setScanned(false);
    };

    // Vérification des permissions
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

    return (
        <View style={styles.container}>
            {/* Bouton Fermer (en haut à gauche) */}
            <Pressable
                style={[styles.closeButton, { top: insets.top + 16 }]}
                onPress={() => router.back()}
            >
                <MaterialCommunityIcons name="close" size={28} color="#FFF" />
            </Pressable>

            {/* Bouton Torche (en haut à droite) */}
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

            <CameraView
                style={styles.camera}
                facing="back"
                enableTorch={torchEnabled}
                onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
                barcodeScannerSettings={{
                    barcodeTypes: ['qr'],
                }}
            >
                {/* Overlay sombre avec zone de scan */}
                <View style={styles.overlay}>
                    {/* Zone supérieure sombre */}
                    <View style={styles.overlayTop} />

                    {/* Zone de scan centrale */}
                    <View style={styles.scanRow}>
                        <View style={styles.overlaySide} />

                        {/* Cadre de scan */}
                        <View style={styles.scanArea}>
                            {/* Coins du cadre */}
                            <View style={[styles.corner, styles.topLeft]} />
                            <View style={[styles.corner, styles.topRight]} />
                            <View style={[styles.corner, styles.bottomLeft]} />
                            <View style={[styles.corner, styles.bottomRight]} />
                        </View>

                        <View style={styles.overlaySide} />
                    </View>

                    {/* Zone inférieure avec texte et boutons */}
                    <View style={styles.overlayBottom}>
                        <View style={styles.instructionContainer}>
                            <Text style={styles.instructionText}>
                                Scannez les codes QR pour vérifier l'authenticité des tickets.
                            </Text>
                            {hasScannedOnce && (
                                <Pressable style={styles.rescanButton} onPress={resetScan}>
                                    <MaterialCommunityIcons name="refresh" size={20} color="#000" />
                                    <Text style={styles.rescanButtonText}>Refaire le scan</Text>
                                </Pressable>
                            )}
                        </View>
                    </View>
                </View>
            </CameraView>
        </View>
    );
}

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
        width: '100%',
        height: '100%',
    },
    closeButton: {
        position: 'absolute',
        left: 20,
        zIndex: 10,
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(0,0,0,0.5)',
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
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    overlay: {
        flex: 1,
        width: '100%',
        height: '100%',
    },
    overlayTop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    scanRow: {
        flexDirection: 'row',
        height: 300,
    },
    overlaySide: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    scanArea: {
        width: 300,
        height: 300,
        backgroundColor: 'transparent',
        position: 'relative',
    },
    corner: {
        position: 'absolute',
        width: 40,
        height: 40,
        borderColor: '#FFF',
        borderWidth: 3,
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
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-start',
        paddingTop: 40,
    },
    instructionContainer: {
        alignItems: 'center',
        paddingHorizontal: 40,
    },
    instructionText: {
        fontSize: 16,
        fontFamily: 'Ubuntu_Regular',
        color: '#FFF',
        textAlign: 'center',
        opacity: 0.9,
        marginBottom: 24,
    },
    rescanButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FFF',
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: 30,
        gap: 8,
    },
    rescanButtonText: {
        fontSize: 16,
        fontFamily: 'Ubuntu_Medium',
        color: '#000',
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