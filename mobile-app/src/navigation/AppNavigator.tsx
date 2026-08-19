import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import HomeScreen from '../screens/HomeScreen';
import AddCardScreen from '../screens/AddCardScreen';
import CardDetailScreen from '../screens/CardDetailScreen';

export type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  Home: undefined;
  AddCard: { cardId?: string } | undefined;
  CardDetail: { cardId: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Login"
        screenOptions={{
          headerShown: false,
        }}>
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Register" component={RegisterScreen} />
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="AddCard" component={AddCardScreen} />
        <Stack.Screen name="CardDetail" component={CardDetailScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
