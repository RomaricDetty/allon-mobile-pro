import React from 'react';
import { Dimensions, Image, StyleSheet, Text, View } from 'react-native';

const { width, height } = Dimensions.get('window');

const CustomSplashScreen = ({ onLayout }: { onLayout?: () => void }) => {
    return (
        <View style={styles.splashContainer} onLayout={onLayout}>
            <Text style={
                { 
                    fontSize: 50, 
                    fontFamily: 'Ubuntu_Bold', 
                    color: '#1776BA',
                }
            }>AllOn Pro</Text>
            <Image
                source={require('@/assets/images/allon-logo-transparent.png')}
                resizeMode="contain"
                style={styles.logo}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    splashContainer: {
        flex: 1,
        backgroundColor: '#ffffff',
        justifyContent: 'center',
        alignItems: 'center',
        width: width,
        height: height,
        // position: 'absolute',
        // bottom: 30,
        // zIndex: 1000,
    },
    logo: {
        width: 80,
        height: 80,
        position: 'absolute',
        bottom: 30,
        zIndex: 1000,
    },
});

export default CustomSplashScreen;