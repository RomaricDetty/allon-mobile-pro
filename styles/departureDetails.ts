import { StyleSheet } from "react-native";

export const styles = StyleSheet.create({
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
    busLicensePlate: {
        fontSize: 12,
        fontFamily: 'Ubuntu_Regular',
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

    // Styles pour le modal
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    modalContentWrapper: {
        width: '100%',
        maxHeight: '90%',
    },
    modalContent: {
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        paddingTop: 20,
        paddingBottom: 20,
        paddingHorizontal: 20,
        maxHeight: '90%',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
    },
    modalTitle: {
        fontSize: 20,
        fontFamily: 'Ubuntu_Bold',
        flex: 1,
    },
    modalCloseButton: {
        width: 32,
        height: 32,
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalScrollView: {
        flexGrow: 0,
    },
    modalScrollContent: {
        flexGrow: 0,
    },
    modalBody: {
        marginBottom: 24,
    },
    modalLabel: {
        fontSize: 14,
        fontFamily: 'Ubuntu_Medium',
        marginBottom: 8,
    },
    inputContainer: {
        position: 'relative',
        marginBottom: 8,
    },
    modalInput: {
        borderWidth: 1,
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 14,
        fontSize: 16,
        fontFamily: 'Ubuntu_Regular',
    },
    clearButton: {
        position: 'absolute',
        right: 12,
        top: '50%',
        transform: [{ translateY: -10 }],
        width: 20,
        height: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalHint: {
        fontSize: 12,
        fontFamily: 'Ubuntu_Regular',
    },
    modalFooter: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 8,
    },
    modalCancelButton: {
        flex: 1,
        borderWidth: 1,
        borderRadius: 12,
        paddingVertical: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    modalCancelButtonText: {
        fontSize: 16,
        fontFamily: 'Ubuntu_Bold',
    },
    modalSearchButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 12,
        paddingVertical: 14,
        gap: 8,
    },
    modalSearchButtonText: {
        fontSize: 16,
        fontFamily: 'Ubuntu_Bold',
        color: '#FFFFFF',
    },
});