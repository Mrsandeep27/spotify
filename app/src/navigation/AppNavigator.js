import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import * as SplashScreen from 'expo-splash-screen';
import { AuthService } from '../services/authService';
import useStore from '../store/useStore';
import LoginScreen from '../screens/auth/LoginScreen';
import MainNavigator from './MainNavigator';
import PlayerScreen from '../screens/PlayerScreen';
import GroupSessionScreen from '../screens/GroupSessionScreen';
import VolumeBoosterScreen from '../screens/VolumeBoosterScreen';
import { COLORS } from '../theme/colors';

const Stack = createStackNavigator();

const screenOptions = {
  headerShown: false,
  cardStyle: { backgroundColor: COLORS.background },
  presentation: 'modal',
};

export default function AppNavigator() {
  const { setUser, hydrate } = useStore();
  const [authLoading, setAuthLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    hydrate();

    const timeout = setTimeout(() => {
      setAuthLoading(false);
      SplashScreen.hideAsync().catch(() => {});
    }, 5000);

    let unsub = () => {};
    try {
      unsub = AuthService.onAuthStateChange((user) => {
        clearTimeout(timeout);
        setUser(user);
        setIsLoggedIn(!!user);
        setAuthLoading(false);
        SplashScreen.hideAsync().catch(() => {});
      });
    } catch (e) {
      clearTimeout(timeout);
      setAuthLoading(false);
      SplashScreen.hideAsync().catch(() => {});
    }

    return () => {
      clearTimeout(timeout);
      unsub();
    };
  }, []);

  if (authLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.background, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color={COLORS.primary} size="large" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!isLoggedIn ? (
          <Stack.Screen name="Login" component={LoginScreen} />
        ) : (
          <>
            <Stack.Screen name="Main" component={MainNavigator} />
            <Stack.Screen
              name="Player"
              component={PlayerScreen}
              options={{ ...screenOptions, gestureEnabled: true }}
            />
            <Stack.Screen
              name="GroupSession"
              component={GroupSessionScreen}
              options={{ ...screenOptions, gestureEnabled: true }}
            />
            <Stack.Screen
              name="VolumeBooster"
              component={VolumeBoosterScreen}
              options={{ ...screenOptions, gestureEnabled: true }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
