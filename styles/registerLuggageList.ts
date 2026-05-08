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
        marginBottom: 16,
    },
    section: {
        marginVertical: 8,
    },
    sectionTitle: {
        fontSize: 18,
        fontFamily: 'Ubuntu_Bold',
        marginBottom: 16,
    },
    loadingContainer: {
        paddingVertical: 40,
        alignItems: 'center',
    },
    emptyContainer: {
        paddingVertical: 40,
        alignItems: 'center',
    },
    emptyText: {
        fontSize: 14,
        fontFamily: 'Ubuntu_Regular',
        marginTop: 12,
    },
    luggageCard: {
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        marginBottom: 12,
    },
    luggageHeader: {
        marginBottom: 12,
    },
    luggageHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        flexWrap: 'wrap',
    },
    luggageTitle: {
        fontSize: 16,
        fontFamily: 'Ubuntu_Bold',
    },
    typeBadge: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
    },
    typeText: {
        fontSize: 12,
        fontFamily: 'Ubuntu_Medium',
    },
    luggageDetails: {
        gap: 8,
    },
    detailRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 8,
    },
    detailLabel: {
        fontSize: 14,
        fontFamily: 'Ubuntu_Regular',
    },
    detailValue: {
        fontSize: 14,
        fontFamily: 'Ubuntu_Medium',
        flex: 1,
        textAlign: 'right',
    },
    fragileBadge: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
    },
    fragileText: {
        fontSize: 12,
        fontFamily: 'Ubuntu_Medium',
    },
    headerBadges: {
        flexDirection: 'row',
        gap: 8,
        alignItems: 'center',
    },
    statusSection: {
        marginBottom: 12,
    },
    statusBadge: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
    },
    statusText: {
        fontSize: 12,
        fontFamily: 'Ubuntu_Medium',
    },
    statusBadgeLarge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 12,
        gap: 8,
        alignSelf: 'flex-start',
    },
    statusTextLarge: {
        fontSize: 14,
        fontFamily: 'Ubuntu_Bold',
    },
    tapHint: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 12,
        paddingTop: 12,
        borderTopWidth: 1,
    },
    tapHintText: {
        fontSize: 12,
        fontFamily: 'Ubuntu_Regular',
    },
    addButtonContainer: {
        alignItems: 'center',
        marginTop: 16,
        marginBottom: 20,
    },
    addButton: {
        width: 64,
        height: 64,
        borderRadius: 32,
        alignItems: 'center',
        justifyContent: 'center',
        // shadowColor: '#000',
        // shadowOffset: { width: 0, height: 2 },
        // shadowOpacity: 0.25,
        // shadowRadius: 3.84,
        // elevation: 5,
    },
    sheetOverlay: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    sheetBackdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0, 0, 0, 0.35)',
    },
    sheetContainer: {
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        borderWidth: 1,
        borderBottomWidth: 0,
        paddingHorizontal: 16,
        paddingTop: 10,
        paddingBottom: 24,
        gap: 12,
    },
    sheetHandle: {
        width: 44,
        height: 5,
        borderRadius: 4,
        alignSelf: 'center',
        marginBottom: 6,
    },
    sheetTitle: {
        fontSize: 18,
        fontFamily: 'Ubuntu_Bold',
    },
    sheetSubtitle: {
        fontSize: 13,
        fontFamily: 'Ubuntu_Regular',
        marginBottom: 4,
    },
    sheetOptionButton: {
        borderWidth: 1,
        borderRadius: 12,
        padding: 12,
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 10,
    },
    sheetOptionContent: {
        flex: 1,
        gap: 4,
    },
    sheetOptionTitle: {
        fontSize: 15,
        fontFamily: 'Ubuntu_Bold',
    },
    sheetOptionDescription: {
        fontSize: 13,
        fontFamily: 'Ubuntu_Regular',
    },
    priceInput: {
        height: 48,
        borderWidth: 1,
        borderRadius: 10,
        paddingHorizontal: 12,
        fontSize: 15,
        fontFamily: 'Ubuntu_Regular',
    },
    sheetSubmitButton: {
        backgroundColor: '#1776BA',
        height: 48,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    sheetSubmitButtonText: {
        color: '#FFFFFF',
        fontSize: 15,
        fontFamily: 'Ubuntu_Bold',
    },
});