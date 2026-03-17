import React from 'react';
import { View, StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import HomeScreen from '../screens/HomeScreen';
import SearchScreen from '../screens/SearchScreen';
import LibraryScreen from '../screens/LibraryScreen';
import AdminPanelScreen from '../screens/admin/AdminPanelScreen';
import MiniPlayer from '../components/MiniPlayer';
import useStore from '../store/useStore';
import { COLORS } from '../theme/colors';

const Tab = createBottomTabNavigator();

function TabBarIcon({ name, focused }) {
  return (
    <View style={focused ? styles.activeIconWrapper : null}>
      <Ionicons
        name={focused ? name : `${name}-outline`}
        size={24}
        color={focused ? COLORS.textPrimary : COLORS.textMuted}
      />
    </View>
  );
}

function MainLayout() {
  const user = useStore((s) => s.user);
  const isAdmin = user?.isAdmin === true;

  return (
    <View style={{ flex: 1 }}>
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarStyle: styles.tabBar,
          tabBarActiveTintColor: COLORS.textPrimary,
          tabBarInactiveTintColor: COLORS.textMuted,
          tabBarLabelStyle: styles.tabLabel,
          tabBarShowLabel: true,
        }}
      >
        <Tab.Screen
          name="Home"
          component={HomeScreen}
          options={{
            tabBarIcon: ({ focused }) => <TabBarIcon name="home" focused={focused} />,
          }}
        />
        <Tab.Screen
          name="Search"
          component={SearchScreen}
          options={{
            tabBarIcon: ({ focused }) => <TabBarIcon name="search" focused={focused} />,
          }}
        />
        <Tab.Screen
          name="Library"
          component={LibraryScreen}
          options={{
            tabBarLabel: 'Your Library',
            tabBarIcon: ({ focused }) => <TabBarIcon name="library" focused={focused} />,
          }}
        />
        {isAdmin && (
          <Tab.Screen
            name="Admin"
            component={AdminPanelScreen}
            options={{
              tabBarLabel: 'Admin',
              tabBarIcon: ({ focused }) => <TabBarIcon name="shield-checkmark" focused={focused} />,
            }}
          />
        )}
      </Tab.Navigator>
      <MiniPlayer />
    </View>
  );
}

export default MainLayout;

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: COLORS.surface,
    borderTopColor: COLORS.border,
    borderTopWidth: 1,
    height: 60,
    paddingBottom: 8,
    paddingTop: 6,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '600',
  },
  activeIconWrapper: {},
});
