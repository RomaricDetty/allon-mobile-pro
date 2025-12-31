//@ts-nocheck
import { Redirect } from 'expo-router';

/**
 * Écran de redirection simple
 * - Redirige instantanément vers /(tabs) qui se chargera de vérifier la session
 */
const Index = () => {
    return <Redirect href="/(tabs)" />;
};

export default Index;
