import { Platform, StyleSheet } from "react-native";

export const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        paddingHorizontal: 16,
        paddingBottom: 16,
        zIndex: 10,
    },
    title: {
        fontSize: 32,
        fontFamily: 'Ubuntu_Bold',
        marginBottom: 12,
    },
    filterButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 16,
        alignSelf: 'flex-start',
    },
    filterButtonText: {
        marginLeft: 8,
        fontSize: 14,
        fontFamily: 'Ubuntu_Medium',
    },
    filterBadge: {
        width: 10,
        height: 10,
        borderRadius: 100,
        marginLeft: 8,
    },
    contentContainer: {
        padding: 16,
        paddingTop: 8,
    },
    contentContainerLoading: {
        flexGrow: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingContainer: {
        justifyContent: 'center',
        alignItems: 'center',
        width: '100%',
    },
    loadingText: {
        marginTop: 16,
        fontSize: 16,
        fontFamily: 'Ubuntu_Medium',
    },
    errorContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 60,
    },
    errorText: {
        fontSize: 16,
        fontFamily: 'Ubuntu_Medium',
        color: '#FF3B30',
        textAlign: 'center',
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 60,
    },
    emptyText: {
        fontSize: 16,
        fontFamily: 'Ubuntu_Medium',
        textAlign: 'center',
    },
    footerLoader: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 60,
    },
    footerLoaderText: {
        fontSize: 14,
        fontFamily: 'Ubuntu_Regular',
        marginLeft: 8,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        paddingTop: 20,
        paddingBottom: 40,
        maxHeight: '80%',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingBottom: 20,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0, 0, 0, 0.1)',
    },
    modalTitle: {
        fontSize: 24,
        fontFamily: 'Ubuntu_Bold',
    },
    filterOptions: {
        paddingHorizontal: 20,
        paddingTop: 20,
    },
    filterOption: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 16,
        paddingHorizontal: 16,
        borderRadius: 12,
        marginBottom: 8,
    },
    filterOptionActive: {
        // Style déjà géré par backgroundColor dynamique
    },
    filterOptionText: {
        fontSize: 16,
        fontFamily: 'Ubuntu_Regular',
    },
    filterOptionTextActive: {
        fontFamily: 'Ubuntu_Medium',
    },
    modalFooter: {
        paddingHorizontal: 20,
        paddingTop: 20,
    },
    resetButton: {
        paddingVertical: 14,
        paddingHorizontal: 20,
        borderRadius: 12,
        alignItems: 'center',
    },
    resetButtonText: {
        fontSize: 16,
        fontFamily: 'Ubuntu_Medium',
    },
    datePickerOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    datePickerContainer: {
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        paddingTop: 20,
        paddingBottom: Platform.OS === 'ios' ? 40 : 20,
        maxHeight: '80%',
    },
    datePickerHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingBottom: 20,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0, 0, 0, 0.1)',
    },
    datePickerTitle: {
        fontSize: 20,
        fontFamily: 'Ubuntu_Bold',
    },
    datePickerContent: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 20,
    },
    datePickerFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingTop: 20,
        gap: 12,
    },
    datePickerButton: {
        flex: 1,
        paddingVertical: 14,
        paddingHorizontal: 20,
        borderRadius: 12,
        alignItems: 'center',
    },
    datePickerButtonPrimary: {
        // Style pour le bouton primaire
    },
    datePickerButtonText: {
        fontSize: 16,
        fontFamily: 'Ubuntu_Medium',
    },
    datePickerButtonTextPrimary: {
        color: '#FFFFFF',
    },
});