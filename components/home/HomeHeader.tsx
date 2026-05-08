import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { styles } from '@/styles/homeScreen';
import { MaterialIcons } from '@expo/vector-icons';
import React from 'react';
import { TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Props du composant HomeHeader
 */
interface HomeHeaderProps {
    filterLabel: string;
    hasActiveFilter: boolean;
    onFilterPress: () => void;
    onLayout?: (height: number) => void;
}

/**
 * Composant header de l'écran d'accueil avec titre et bouton de filtre
 */
export const HomeHeader: React.FC<HomeHeaderProps> = ({
    filterLabel,
    hasActiveFilter,
    onFilterPress,
    onLayout,
}) => {
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const insets = useSafeAreaInsets();

    const headerBackgroundColor = isDark ? '#000000' : '#F3F3F7';

    return (
        <ThemedView
            style={[
                styles.header,
                {
                    backgroundColor: headerBackgroundColor,
                    paddingTop: insets.top + 16,
                }
            ]}
            onLayout={(event) => {
                const { height } = event.nativeEvent.layout;
                onLayout?.(height);
            }}
        >
            <ThemedText type="title" style={styles.title}>Mes départs</ThemedText>

            {/* Bouton de filtre */}
            <TouchableOpacity
                style={[styles.filterButton, { backgroundColor: isDark ? '#2C2C2E' : '#E5E5EA' }]}
                onPress={onFilterPress}
            >
                <MaterialIcons
                    name="filter-list"
                    size={20}
                    color={isDark ? '#FFFFFF' : '#000000'}
                />
                <ThemedText style={styles.filterButtonText}>{filterLabel}</ThemedText>
                {hasActiveFilter && (
                    <View style={[styles.filterBadge, { backgroundColor: isDark ? '#1776BA' : '#1776BA' }]} />
                )}
            </TouchableOpacity>
        </ThemedView>
    );
};
