import { Departure } from '@/components/departure-card';
import { ThemedText } from '@/components/themed-text';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { MaterialIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Génère une couleur pour le cercle de la compagnie basée sur le nom
 */
const getCompanyColor = (companyName?: string): string => {
    if (!companyName) return '#8B4513';
    const colors = ['#8B4513', '#1776BA', '#2E7D32', '#C62828', '#6A1B9A', '#F57C00'];
    const index = companyName.length % colors.length;
    return colors[index];
};

/**
 * Extrait les initiales d'une compagnie pour le logo
 */
const getCompanyInitials = (companyName?: string): string => {
    if (!companyName) return 'C';
    const words = companyName.trim().split(/\s+/);
    if (words.length >= 2) {
        return (words[0][0] + words[1][0]).toUpperCase();
    }
    return companyName.substring(0, 2).toUpperCase();
};

/**
 * Nettoie le nom d'une station en supprimant "Gare" et "GAR"
 */
const cleanStationName = (stationName?: string): string => {
    if (!stationName) return '';
    return stationName
        .replace(/Gare\s*/gi, '')
        .replace(/GAR\s*/gi, '')
        .trim().toUpperCase();
};

/**
 * Écran de détails d'un trajet
 * Affiche toutes les informations d'un départ dans un format de carte d'embarquement
 */
export default function DepartureDetailsScreen() {
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const insets = useSafeAreaInsets();
    const params = useLocalSearchParams<{ departure: string }>();

    // Parse les données du départ depuis les paramètres
    let departure: Departure | null = null;
    try {
        if (params.departure) {
            departure = JSON.parse(params.departure) as Departure;
        }
    } catch (error) {
        console.error('Erreur lors du parsing des données du départ:', error);
    }

    // Si aucune donnée n'est disponible, retourner à l'écran précédent
    if (!departure) {
        router.back();
        return null;
    }

    // Couleurs pour le mode clair et sombre
    const headerBackgroundColor = isDark ? '#1A1A1A' : '#1776BA';
    const cardBackgroundColor = isDark ? '#1A1A1A' : '#FFFFFF';
    const primaryTextColor = isDark ? '#FFFFFF' : '#11181C';
    const secondaryTextColor = isDark ? '#9BA1A6' : '#666666';
    const labelTextColor = isDark ? '#9BA1A6' : '#999999';
    const borderColor = isDark ? '#3A3A3C' : '#E0E0E0';
    const separatorColor = isDark ? '#3A3A3C' : '#E5E5E5';
    const buttonBackgroundColor = '#1776BA';
    const busIconColor = '#1776BA';
    const companyColor = getCompanyColor(departure.company);
    const companyInitials = getCompanyInitials(departure.company);

    /**
     * Gère le retour à l'écran précédent
     */
    const handleBack = () => {
        router.back();
    };

    /**
     * Gère l'action du bouton de téléchargement
     */
    const handleDownload = () => {
        // TODO: Implémenter la fonctionnalité de téléchargement
        console.log('Téléchargement du ticket pour le départ:', departure?.id);
    };

    /**
     * Gère l'action du bouton d'options
     */
    const handleOptions = () => {
        // TODO: Implémenter le menu d'options
        console.log('Options pour le départ:', departure?.id);
    };

    /**
     * Gère la redirection vers l'écran de scan QR
     */
    const handleScanQR = () => {
        router.push('/scan-qr');
    };

    return (
        <View style={[styles.container, { backgroundColor: isDark ? '#000000' : '#F3F3F7' }]}>
            {/* Barre de navigation / En-tête */}
            <View
                style={[
                    styles.header,
                    {
                        backgroundColor: headerBackgroundColor,
                        paddingTop: insets.top + 8,
                        paddingBottom: 16,
                    },
                ]}
            >
                <View style={styles.headerContent}>
                    <TouchableOpacity
                        style={[styles.headerButton, { backgroundColor: 'rgba(255, 255, 255, 0.2)' }]}
                        onPress={handleBack}
                    >
                        <MaterialIcons name="arrow-back" size={24} color="#FFFFFF" />
                    </TouchableOpacity>

                    <ThemedText style={[styles.headerTitle, { color: '#FFFFFF' }]}>
                        Détails du trajet
                    </ThemedText>

                    {/* <TouchableOpacity
                        style={[styles.headerButton, { backgroundColor: 'rgba(255, 255, 255, 0.2)' }]}
                        onPress={handleOptions}
                    >
                        <MaterialIcons name="more-horiz" size={24} color="#FFFFFF" />
                    </TouchableOpacity> */}
                </View>
            </View>

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* Carte principale */}
                <View
                    style={[
                        styles.card,
                        {
                            backgroundColor: cardBackgroundColor,
                            borderColor: borderColor,
                        },
                    ]}
                >
                    {/* Section supérieure : Compagnie et type de véhicule */}
                    <View style={styles.topSection}>
                        <View style={styles.companyInfo}>
                            <View style={styles.companyTextContainer}>
                                <ThemedText style={[styles.companyName, { color: primaryTextColor }]}>
                                    {departure.company || 'Compagnie'}
                                </ThemedText>
                                <ThemedText style={[styles.busType, { color: primaryTextColor }]}>
                                    {departure.busType?.charAt(0).toUpperCase() + (departure.busType?.slice(1) || '') || departure.line?.charAt(0).toUpperCase() + (departure.line?.slice(1) || '') || 'Bus'}
                                </ThemedText>
                            </View>
                        </View>
                    </View>

                    {/* Section médiane : Détails du trajet */}
                    <View style={[styles.middleSection]}>
                        {/* Conteneur de l'itinéraire */}
                        <View style={styles.routeVisualization}>
                            {/* Point de départ - en haut centré */}
                            <View style={[
                                { 
                                    alignItems: 'center', 
                                    justifyContent: 'center', 
                                    flexDirection: 'row',
                                    gap: 10,
                                    // width: '100%',
                                }
                            ]}>
                                <View style={[styles.routePointCircle, { backgroundColor: 'green', borderColor: borderColor }]}>
                                    <MaterialIcons name="location-on" size={16} color="#FFFFFF" />
                                </View>
                                <View style={styles.routePointContentCenter}>
                                    <ThemedText style={[styles.cityNameCenter, { color: primaryTextColor }]}>
                                        {departure.departureCity?.toUpperCase() || 'Ville'}
                                    </ThemedText>
                                    {departure.departureStationName && (
                                        <ThemedText style={[styles.stationDetailsCenter, { color: secondaryTextColor }]}>
                                            {departure.departureStationName}
                                        </ThemedText>
                                    )}
                                    <ThemedText style={[styles.timeCenter, { color: primaryTextColor }]}>
                                        {departure.departureTime || '--:--'}
                                    </ThemedText>
                                </View>
                            </View>

                            {/* Point central - Bus et durée - au milieu */}
                            <View style={styles.routePointCenter}>
                                <View style={[styles.busIconContainer, { borderColor: borderColor, backgroundColor: cardBackgroundColor }]}>
                                    <MaterialIcons name="arrow-downward" size={28} color={'#1776BA'} />
                                </View>
                                <View style={styles.routePointContent}>
                                    <ThemedText style={[styles.duration, { color: secondaryTextColor }]}>
                                        {departure.duration || '--'}
                                    </ThemedText>
                                </View>
                            </View>

                            {/* Point d'arrivée - en bas centré */}
                            <View style={styles.routePointArrival}>
                                <View style={[styles.routePointCircle, { backgroundColor: '#b81414', borderColor: borderColor }]}>
                                    <MaterialIcons name="location-on" size={16} color="#FFFFFF" />
                                </View>
                                <View style={styles.routePointContentCenter}>
                                    <ThemedText style={[styles.cityNameCenter, { color: primaryTextColor }]}>
                                        {departure.arrivalCity?.toUpperCase() || 'Ville'}
                                    </ThemedText>
                                    {departure.arrivalStationName && (
                                        <ThemedText style={[styles.stationDetailsCenter, { color: secondaryTextColor }]}>
                                            {departure.arrivalStationName}
                                        </ThemedText>
                                    )}
                                    <ThemedText style={[styles.timeCenter, { color: primaryTextColor }]}>
                                        {departure.arrivalTime || '--:--'}
                                    </ThemedText>
                                </View>
                            </View>
                        </View>
                    </View>

                    {/* Section inférieure : Détails du passager et du billet */}
                    <View style={[styles.bottomSection, { borderTopColor: separatorColor }]}>

                        {/* Date */}
                        <View style={styles.detailRow}>
                            <ThemedText style={[styles.detailLabel, { color: labelTextColor }]}>
                                Date
                            </ThemedText>
                            <ThemedText style={[styles.detailValue, { color: primaryTextColor }]}>
                                {departure.date || departure.departureDate || '--'}
                            </ThemedText>
                        </View>

                        {/* Séparateur */}
                        <View style={[styles.separator, { backgroundColor: separatorColor }]} />

                        {/* Classe et Terminal */}
                        <View style={styles.detailRowTwoColumns}>
                            <View style={styles.detailColumn}>
                                <ThemedText style={[styles.detailLabel, { color: labelTextColor }]}>
                                    Classe
                                </ThemedText>
                                <ThemedText style={[styles.detailValue, { color: primaryTextColor }]}>
                                    {departure.classStatus || 'Économique'}
                                </ThemedText>
                            </View>
                            <View style={[styles.detailColumn, { alignItems: 'flex-end' }]}>
                                <ThemedText style={[styles.detailLabel, { color: labelTextColor, textAlign: 'center' }]}>
                                    Terminal
                                </ThemedText>
                                <ThemedText style={[styles.detailValue, { color: primaryTextColor, textAlign: 'center' }]}>
                                    {departure.departureStationName || 'N/A'}
                                </ThemedText>
                            </View>
                        </View>

                        {/* Séparateur */}
                        <View style={[styles.separator, { backgroundColor: separatorColor }]} />

                        {/* Siège et Porte */}
                        <View style={styles.detailRowTwoColumns}>
                            <View style={styles.detailColumn}>
                                <ThemedText style={[styles.detailLabel, { color: labelTextColor }]}>
                                    Siège
                                </ThemedText>
                                <ThemedText style={[styles.detailValue, { color: primaryTextColor }]}>
                                    {departure.seatsAvailable !== undefined ? `${departure.seatsAvailable} disponibles` : 'N/A'}
                                </ThemedText>
                            </View>
                            <View style={[styles.detailColumn, { alignItems: 'flex-end' }]}>
                                <ThemedText style={[styles.detailLabel, { color: labelTextColor, textAlign: 'center' }]}>
                                    Statut
                                </ThemedText>
                                <ThemedText style={[styles.detailValue, { color: primaryTextColor }]}>
                                    {departure.status?.charAt(0).toUpperCase() + (departure.status?.slice(1) || '') || 'N/A'}
                                </ThemedText>
                            </View>
                        </View>

                        {/* Prix si disponible */}
                        {departure.price && (
                            <>
                                <View style={[styles.separator, { backgroundColor: separatorColor }]} />
                                <View style={styles.detailRow}>
                                    <ThemedText style={[styles.detailLabel, { color: labelTextColor }]}>
                                        Prix
                                    </ThemedText>
                                    <ThemedText style={[styles.detailValue, { color: primaryTextColor }]}>
                                        {departure.price}
                                    </ThemedText>
                                </View>
                            </>
                        )}

                        {/* Informations supplémentaires */}
                        {departure.seatsBooked !== undefined && (
                            <>
                                <View style={[styles.separator, { backgroundColor: separatorColor }]} />
                                <View style={styles.detailRow}>
                                    <ThemedText style={[styles.detailLabel, { color: labelTextColor }]}>
                                        Sièges réservés
                                    </ThemedText>
                                    <ThemedText style={[styles.detailValue, { color: primaryTextColor }]}>
                                        {departure.seatsBooked}
                                    </ThemedText>
                                </View>
                            </>
                        )}

                        {/* Gare de départ */}
                        {departure.departureStationName && (
                            <>
                                <View style={[styles.separator, { backgroundColor: separatorColor }]} />
                                <View style={styles.detailRow}>
                                    <ThemedText style={[styles.detailLabel, { color: labelTextColor }]}>
                                        Gare de départ
                                    </ThemedText>
                                    <ThemedText style={[styles.detailValue, { color: primaryTextColor }]}>
                                        {departure.departureStationName}
                                    </ThemedText>
                                </View>
                            </>
                        )}

                        {/* Gare d'arrivée */}
                        {departure.arrivalStationName && (
                            <>
                                <View style={[styles.separator, { backgroundColor: separatorColor }]} />
                                <View style={styles.detailRow}>
                                    <ThemedText style={[styles.detailLabel, { color: labelTextColor }]}>
                                        Gare d'arrivée
                                    </ThemedText>
                                    <ThemedText style={[styles.detailValue, { color: primaryTextColor }]}>
                                        {departure.arrivalStationName}
                                    </ThemedText>
                                </View>
                            </>
                        )}
                    </View>
                </View>
            </ScrollView>

            {/* Boutons d'action - affichés uniquement si le statut est SCHEDULED */}
            {departure.status?.toUpperCase() === 'SCHEDULED' && (
                <View style={[styles.buttonContainer, { paddingBottom: insets.bottom + 16 }]}>
                    <View style={styles.buttonsRow}>
                        <TouchableOpacity
                            style={[styles.scanButton, { backgroundColor: isDark ? '#2A2A2A' : '#FFFFFF', borderColor: borderColor }]}
                            onPress={handleScanQR}
                        >
                            <MaterialIcons name="qr-code-scanner" size={24} color={primaryTextColor} />
                            <ThemedText style={[styles.scanButtonText, { color: primaryTextColor }]}>Scanner</ThemedText>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.downloadButton, { backgroundColor: "#1776BA" }]}
                            onPress={handleDownload}
                        >
                            <MaterialIcons name="directions-bus-filled" size={24} color="#FFFFFF" />
                            <ThemedText style={styles.downloadButtonText}>Démarrer</ThemedText>
                        </TouchableOpacity>
                    </View>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        paddingHorizontal: 15,
    },
    headerContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    headerButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 18,
        fontFamily: 'Ubuntu_Bold',
        flex: 1,
        textAlign: 'center',
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        padding: 10,
    },
    card: {
        borderRadius: 20,
        padding: 20,
        borderWidth: 1,
    },
    // Section supérieure
    topSection: {
        marginBottom: 24,
    },
    companyInfo: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    companyLogoCircle: {
        width: 48,
        height: 48,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    companyLogoText: {
        color: '#FFFFFF',
        fontSize: 18,
        fontFamily: 'Ubuntu_Bold',
    },
    companyTextContainer: {
        flex: 1,
    },
    companyName: {
        fontSize: 16,
        fontFamily: 'Ubuntu_Regular',
        marginBottom: 4,
    },
    busType: {
        fontSize: 18,
        fontFamily: 'Ubuntu_Bold',
    },
    // Section médiane
    middleSection: {
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 24,
        paddingVertical: 8,
    },
    /**
     * Conteneur de visualisation de l'itinéraire
     */
    routeVisualization: {
        // width: '100%',
        // height: 350,
        position: 'relative',
        // paddingHorizontal: 16,
        // paddingVertical: 20,
    },
    /**
     * Point de départ - positionné en haut centré
     */
    routePointDeparture: {
        alignItems: 'center',
        flexDirection: 'column',
        width: 200,
    },
    /**
     * Point central - Bus - positionné au milieu centré
     */
    routePointCenter: {
        alignItems: 'center',
        paddingVertical: 20,
    },
    /**
     * Point d'arrivée - positionné en bas centré
     */
    routePointArrival: {
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 10,
    },
    /**
     * Contenu du point centré
     */
    routePointContentCenter: {
        alignItems: 'center',
        justifyContent: 'center',
        // marginLeft: 10,
        // marginRight: 10,
        // flex: 1,
    },
    /**
     * Nom de la ville - centré
     */
    cityNameCenter: {
        fontSize: 16,
        fontFamily: 'Ubuntu_Bold',
        marginBottom: 2,
        lineHeight: 22,
        textAlign: 'center',
    },
    /**
     * Détails de la station - centré
     */
    stationDetailsCenter: {
        fontSize: 11,
        fontFamily: 'Ubuntu_Regular',
        marginBottom: 4,
        lineHeight: 15,
        textAlign: 'center',
    },
    /**
     * Heure - centré
     */
    timeCenter: {
        fontSize: 13,
        fontFamily: 'Ubuntu_Bold',
        textAlign: 'center',
    },
    /**
     * Contenu du point de l'itinéraire
     */
    routePointContent: {
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
    },
    /**
     * Conteneur de connexion en escalier (départ vers bus)
     */
    routeConnectionStaircase: {
        position: 'absolute',
        top: 70,
        left: '45%',
        width: '20%',
        height: 70,
        zIndex: 5,
    },
    /**
     * Segment horizontal de la ligne en escalier
     */
    routeLineHorizontal: {
        position: 'absolute',
        top: 25,
        left: 0,
        width: '55%',
        height: 2,
        backgroundColor: '#666666',
    },
    /**
     * Segment vertical de la ligne en escalier
     */
    routeLineVertical: {
        position: 'absolute',
        top: 25,
        left: '55%',
        width: 2,
        height: 45,
        backgroundColor: '#666666',
    },
    /**
     * Conteneur de la flèche en escalier
     */
    routeArrowContainerStaircase: {
        position: 'absolute',
        bottom: 0,
        left: '55%',
        transform: [{ translateX: -7 }],
        alignItems: 'center',
        justifyContent: 'center',
    },
    /**
     * Conteneur de connexion en escalier (bus vers arrivée)
     */
    routeConnectionStaircaseRight: {
        position: 'absolute',
        bottom: 70,
        right: '45%',
        width: '20%',
        height: 70,
        zIndex: 5,
    },
    /**
     * Segment horizontal de la ligne en escalier vers l'arrivée
     */
    routeLineHorizontalRight: {
        position: 'absolute',
        bottom: 25,
        right: 0,
        width: '55%',
        height: 2,
        backgroundColor: '#666666',
    },
    /**
     * Segment vertical de la ligne en escalier vers l'arrivée
     */
    routeLineVerticalRight: {
        position: 'absolute',
        bottom: 25,
        right: '55%',
        width: 2,
        height: 45,
        backgroundColor: '#666666',
    },
    /**
     * Conteneur de la flèche en escalier vers l'arrivée
     */
    routeArrowContainerStaircaseRight: {
        position: 'absolute',
        top: 0,
        right: '55%',
        transform: [{ translateX: 7 }],
        alignItems: 'center',
        justifyContent: 'center',
    },
    /**
     * Cercle pour les points de départ et d'arrivée
     */
    routePointCircle: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
    },
    /**
     * Nom de la ville - aligné à gauche
     */
    cityNameLeft: {
        fontSize: 16,
        fontFamily: 'Ubuntu_Bold',
        marginBottom: 2,
        lineHeight: 22,
        textAlign: 'left',
    },
    /**
     * Nom de la ville - aligné à droite
     */
    cityNameRight: {
        fontSize: 16,
        fontFamily: 'Ubuntu_Bold',
        marginBottom: 2,
        lineHeight: 22,
        textAlign: 'right',
    },
    /**
     * Détails de la station - aligné à gauche
     */
    stationDetailsLeft: {
        fontSize: 11,
        fontFamily: 'Ubuntu_Regular',
        marginBottom: 4,
        lineHeight: 15,
        textAlign: 'left',
    },
    /**
     * Détails de la station - aligné à droite
     */
    stationDetailsRight: {
        fontSize: 11,
        fontFamily: 'Ubuntu_Regular',
        marginBottom: 4,
        lineHeight: 15,
        textAlign: 'right',
    },
    /**
     * Heure - aligné à gauche
     */
    timeLeft: {
        fontSize: 13,
        fontFamily: 'Ubuntu_Bold',
        textAlign: 'left',
    },
    /**
     * Heure - aligné à droite
     */
    timeRight: {
        fontSize: 13,
        fontFamily: 'Ubuntu_Bold',
        textAlign: 'right',
    },
    stationContainer: {
        width: '100%',
        paddingHorizontal: 4,
    },
    stationContainerCentered: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    arrivalContainer: {
        alignItems: 'flex-end',
    },
    directionIconContainer: {
        width: 24,
        height: 24,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
    },
    directionIconRight: {
        alignSelf: 'flex-end',
    },
    textRight: {
        textAlign: 'right',
    },
    pathContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 20,
    },
    busIconContainer: {
        width: 56,
        height: 56,
        borderRadius: 28,
        borderWidth: 1,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 10,
    },
    duration: {
        fontSize: 13,
        fontFamily: 'Ubuntu_Regular',
        textAlign: 'center',
    },
    dottedLineContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
        width: '100%',
        marginTop: 4,
    },
    dottedLineDot: {
        width: 3,
        height: 1,
        borderRadius: 0.5,
    },
    // Section inférieure
    bottomSection: {
        paddingTop: 24,
        borderTopWidth: 1,
    },
    detailRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
    },
    detailRowTwoColumns: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
        // borderWidth: 1,
        // borderColor: 'red',
    },
    detailColumn: {
        flex: 1,
        // borderWidth: 1,
        // borderColor: 'blue',
        // alignItems: 'center',
        justifyContent: 'space-between',
    },
    detailLabel: {
        fontSize: 12,
        fontFamily: 'Ubuntu_Regular',
        marginBottom: 4,
    },
    detailValue: {
        fontSize: 16,
        fontFamily: 'Ubuntu_Bold',
    },
    separator: {
        height: 1,
        width: '100%',
    },
    // Bouton d'action
    buttonContainer: {
        paddingHorizontal: 16,
        paddingTop: 16,
    },
    buttonsRow: {
        flexDirection: 'row',
        gap: 12,
    },
    scanButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        borderRadius: 12,
        gap: 8,
        borderWidth: 1,
    },
    scanButtonText: {
        fontSize: 16,
        fontFamily: 'Ubuntu_Bold',
    },
    downloadButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        borderRadius: 12,
        gap: 8,
    },
    downloadButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontFamily: 'Ubuntu_Bold',
    },
});
