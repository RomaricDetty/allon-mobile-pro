import { Icon, Label, NativeTabs } from "expo-router/unstable-native-tabs";
import React from 'react';


import { useColorScheme } from '@/hooks/use-color-scheme';

export default function TabLayout() {
    const colorScheme = useColorScheme();

    return (
        // <Tabs
        //     screenOptions={{
        //         tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
        //         headerShown: false,
        //         tabBarButton: HapticTab,
        //     }}>
        //     <Tabs.Screen
        //         name="index"
        //         options={{
        //             title: 'Mes trajets',
        //             tabBarIcon: ({ color }) => <MaterialIcons size={28} name="directions-bus-filled" color={color} />,
        //         }}
        //     />
        //     <Tabs.Screen
        //         name="profile"
        //         options={{
        //             title: 'Mon compte',
        //             tabBarIcon: ({ color }) => <MaterialIcons size={28} name="account-circle" color={color} />,
        //         }}
        //     />
        // </Tabs>
        <NativeTabs>
            <NativeTabs.Trigger name="index">
                <Label>Mes trajets</Label>
                <Icon sf="bus.fill" drawable="custom_android_drawable" />
            </NativeTabs.Trigger>
            <NativeTabs.Trigger name="profile">
                <Icon sf="person.fill" drawable="custom_android_drawable" />
                <Label>Mon compte</Label>
            </NativeTabs.Trigger>
        </NativeTabs>
    );
}
