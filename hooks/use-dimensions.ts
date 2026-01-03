import { useEffect, useState } from 'react';
import { Dimensions, ScaledSize } from 'react-native';

/**
 * Hook personnalisé pour obtenir les dimensions de l'écran
 * Évite les appels répétés à Dimensions.get() et se met à jour automatiquement
 */
export const useDimensions = () => {
    const [dimensions, setDimensions] = useState(() => Dimensions.get('window'));

    useEffect(() => {
        const subscription = Dimensions.addEventListener(
            'change',
            ({ window }: { window: ScaledSize }) => {
                setDimensions(window);
            }
        );

        return () => subscription?.remove();
    }, []);

    return dimensions;
};

