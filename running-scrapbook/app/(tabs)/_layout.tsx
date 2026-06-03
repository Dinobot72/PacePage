import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function TabLayout() {
  return (
    <Tabs 
      screenOptions={{ 
        tabBarActiveTintColor: '#FF9A00', // Bright Sunrise Orange
        tabBarInactiveTintColor: '#FFD180', // Soft Peach
        tabBarStyle: { backgroundColor: '#FFFFFF', borderTopWidth: 0, elevation: 10 },
        headerStyle: { backgroundColor: '#FF9A00' },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: 'bold', fontSize: 20 },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'My Scrapbook ☀️',
          tabBarIcon: ({ color }) => <Ionicons name="images" size={26} color={color} />,
        }}
      />
      <Tabs.Screen
        name="add-run"
        options={{
          title: 'Log a Run 🏃‍♀️',
          tabBarIcon: ({ color }) => <Ionicons name="footsteps" size={26} color={color} />,
        }}
      />
    </Tabs>
  );
}