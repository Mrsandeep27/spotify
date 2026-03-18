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

function MainLayout() {
  const user = useStore((s) => s.user);
  const isAdmin = user?.isAdmin === true;

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarStyle: styles.tabBar,
          tabBarActiveTintColor: '#fff',
          tabBarInactiveTintColor: COLORS.textMuted,
          tabBarLabelStyle: styles.tabLabel,
          tabBarShowLabel: true,
        }}
      >
        <Tab.Screen
          name="Home"
          component={HomeScreen}
          options={{
            tabBarIcon: ({ focused }) => (
              <Ionicons name={focused ? 'home' : 'home-outline'} size={24} color={focused ? '#fff' : COLORS.textMuted} />
            ),
          }}
        />
        <Tab.Screen
          name="Search"
          component={SearchScreen}
          options={{
            tabBarIcon: ({ focused }) => (
              <Ionicons name={focused ? 'search' : 'search-outline'} size={24} color={focused ? '#fff' : COLORS.textMuted} />
            ),
          }}
        />
        <Tab.Screen
          name="Library"
          component={LibraryScreen}
          options={{
            tabBarLabel: 'Your Library',
            tabBarIcon: ({ focused }) => (
              <Ionicons name={focused ? 'library' : 'library-outline'} size={24} color={focused ? '#fff' : COLORS.textMuted} />
            ),
          }}
        />
        {isAdmin && (
          <Tab.Screen
            name="Admin"
            component={AdminPanelScreen}
            options={{
              tabBarLabel: 'Admin',
              tabBarIcon: ({ focused }) => (
                <Ionicons name={focused ? 'shield-checkmark' : 'shield-checkmark-outline'} size={24} color={focused ? '#fff' : COLORS.textMuted} />
              ),
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
    backgroundColor: '#000',
    borderTopWidth: 0,
    elevation: 0,
    height: 56,
    paddingBottom: 6,
    paddingTop: 4,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: -2,
  },
});
