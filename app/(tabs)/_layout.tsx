import { Tabs } from 'expo-router';
import React from 'react';
import { View } from 'react-native';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useColorScheme } from '@/hooks/use-color-scheme';

// Custom tab icon component with background circle
const CustomTabIcon = ({ name, focused }: { name: 'message.fill' | 'calendar'; focused: boolean }) => (
  <View style={{ position: 'relative', alignItems: 'center', justifyContent: 'center' }}>
    {focused && (
      <View
        style={{
          position: 'absolute',
          width: 50,
          height: 50,
          borderRadius: 25,
          backgroundColor: '#9DC8B9',
          zIndex: 0,
          top: '50%',
          marginTop: -25,
        }}
      />
    )}
    <IconSymbol 
      size={28} 
      name={name} 
      color="#666666" 
      style={{ zIndex: 1, position: 'relative' }}
    />
  </View>
);

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#666666',
        tabBarInactiveTintColor: '#666666',
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarStyle: {
          backgroundColor: '#E4E3DA',
          borderTopWidth: 0,
          elevation: 8,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.1,
          shadowRadius: 8,
          position: 'absolute',
          bottom: 20,
          left: 20,
          right: 20,
          borderRadius: 25,
          height: 60,
          paddingBottom: 0,
        },
        tabBarItemStyle: {
          borderRadius: 20,
          marginHorizontal: 8,
          marginVertical: 8,
        },
      }}>
      <Tabs.Screen
        name="chat"
        options={{
          title: 'Chat',
          tabBarIcon: ({ focused }) => <CustomTabIcon name="message.fill" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          title: 'Calendar',
          tabBarIcon: ({ focused }) => <CustomTabIcon name="calendar" focused={focused} />,
        }}
      />
    </Tabs>
  );
}