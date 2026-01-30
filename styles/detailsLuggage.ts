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
        padding: 16,
    },
    card: {
        borderRadius: 16,
        padding: 20,
        borderWidth: 1,
        marginBottom: 16,
    },
    section: {
        marginVertical: 8,
    },
    sectionTitle: {
        fontSize: 16,
        fontFamily: 'Ubuntu_Bold',
        marginBottom: 12,
    },
    typeStatusRow: {
        flexDirection: 'row',
        gap: 8,
        alignItems: 'center',
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
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
    },
    statusText: {
        fontSize: 12,
        fontFamily: 'Ubuntu_Medium',
    },
    separator: {
        height: 1,
        width: '100%',
        marginVertical: 16,
    },
    detailRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
    },
    detailLabel: {
        fontSize: 14,
        fontFamily: 'Ubuntu_Regular',
        flex: 1,
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
    qrCodeSection: {
        marginTop: 12,
        marginBottom: 12
    },
    qrCodeButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 8,
        gap: 8,
    },
    qrCodeButtonText: {
        fontSize: 14,
        fontFamily: 'Ubuntu_Bold',
        color: '#FFFFFF',
    },
    printSection: {
        marginTop: 12,
    },
    printButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 8,
        gap: 8,
    },
    printButtonText: {
        fontSize: 14,
        fontFamily: 'Ubuntu_Bold',
        color: '#FFFFFF',
    },
    totalPrice: {
        fontSize: 16,
        fontFamily: 'Ubuntu_Bold',
    },
    checkInButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        paddingHorizontal: 24,
        borderRadius: 12,
        gap: 8,
        marginBottom: 16,
    },
    checkInButtonText: {
        fontSize: 16,
        fontFamily: 'Ubuntu_Bold',
        color: '#FFFFFF',
    },
    payButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        paddingHorizontal: 24,
        borderRadius: 12,
        gap: 8,
        marginBottom: 16,
    },
    payButtonText: {
        fontSize: 14,
        fontFamily: 'Ubuntu_Bold',
        color: '#FFFFFF',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContent: {
        borderRadius: 20,
        padding: 24,
        width: '90%',
        maxWidth: 400,
        alignItems: 'center',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        width: '100%',
        marginBottom: 20,
    },
    modalTitle: {
        fontSize: 18,
        fontFamily: 'Ubuntu_Bold',
    },
    qrCodeImage: {
        width: 250,
        height: 250,
        marginBottom: 16,
    },
    tagNumber: {
        fontSize: 14,
        fontFamily: 'Ubuntu_Medium',
    },
    inputField: {
        marginTop: 12,
    },
    inputLabel: {
        fontSize: 14,
        fontFamily: 'Ubuntu_Medium',
        marginBottom: 8,
    },
    input: {
        borderRadius: 10,
        paddingHorizontal: 16,
        paddingVertical: 12,
        fontSize: 14,
        fontFamily: 'Ubuntu_Regular',
        borderWidth: 1,
    },
    textArea: {
        borderRadius: 10,
        paddingHorizontal: 16,
        paddingVertical: 12,
        fontSize: 14,
        fontFamily: 'Ubuntu_Regular',
        borderWidth: 1,
        minHeight: 80,
        textAlignVertical: 'top',
    },
    dimensionsRow: {
        flexDirection: 'row',
        gap: 8,
        marginTop: 8,
    },
    dimensionInput: {
        flex: 1,
    },
    dimensionLabel: {
        fontSize: 12,
        fontFamily: 'Ubuntu_Regular',
        marginBottom: 6,
    },
    switchField: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 16,
        paddingVertical: 8,
    },
    totalDimensionsContainer: {
        marginTop: 8,
        paddingVertical: 8,
    },
    totalDimensionsText: {
        fontSize: 13,
        fontFamily: 'Ubuntu_Medium',
        fontStyle: 'italic',
    },
    feeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        flex: 1,
        justifyContent: 'flex-end',
    },
    paidBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        gap: 4,
    },
    paidText: {
        fontSize: 11,
        fontFamily: 'Ubuntu_Medium',
    },
    paymentWarning: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderRadius: 8,
        gap: 8,
        marginTop: 12,
        borderWidth: 1,
    },
    paymentWarningText: {
        fontSize: 13,
        fontFamily: 'Ubuntu_Medium',
        flex: 1,
    },
});