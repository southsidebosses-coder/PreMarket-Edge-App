import React from 'react';
import { Text, StatusBar } from 'react-native';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AdProvider } from './src/context/AdContext';
import { SettingsProvider } from './src/context/SettingsContext';
import MorningEdgeScreen from './src/screens/MorningEdgeScreen';
import PositionSizerScreen from './src/screens/PositionSizerScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import { theme } from './src/theme';

const Tab = createBottomTabNavigator();

const navTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: theme.cyan,
    background: theme.bg,
    card: theme.card,
    text: theme.text,
    border: theme.border,
    notification: theme.red,
  },
};

const TAB_ICONS = {
  'Morning Edge': '◱',
  'Position Sizer': 'Σ',
  'Settings & Upgrade': '≡',
};

export default function App() {
  return (
    <SafeAreaProvider>
      <AdProvider>
        <SettingsProvider>
          <NavigationContainer theme={navTheme}>
            <StatusBar style="light" backgroundColor={theme.bg} />
            <Tab.Navigator
              screenOptions={({ route }) => ({
                headerStyle: { backgroundColor: theme.card, borderBottomColor: theme.border },
                headerTitleStyle: { color: theme.text, fontWeight: '700', fontSize: 15, letterSpacing: 0.5 },
                headerTitleAlign: 'center',
                headerShadowVisible: false,
                tabBarStyle: {
                  backgroundColor: theme.card,
                  borderTopColor: theme.border,
                  height: 56,
                  paddingBottom: 6,
                  paddingTop: 6,
                },
                tabBarActiveTintColor: theme.cyan,
                tabBarInactiveTintColor: theme.muted,
                tabBarLabelStyle: { fontSize: 10, fontWeight: '700', letterSpacing: 0.3 },
                tabBarIcon: ({ color, size }) => (
                  <Text style={{ fontSize: size, color, fontWeight: '700', textAlign: 'center' }}>
                    {TAB_ICONS[route.name] || '·'}
                  </Text>
                ),
              })}
            >
              <Tab.Screen name="Morning Edge" component={MorningEdgeScreen} />
              <Tab.Screen name="Position Sizer" component={PositionSizerScreen} />
              <Tab.Screen name="Settings & Upgrade" component={SettingsScreen} />
            </Tab.Navigator>
          </NavigationContainer>
        </SettingsProvider>
      </AdProvider>
    </SafeAreaProvider>
  );
}
