import React from 'react';
import { StyleSheet, View } from 'react-native';
import AppNavigator from './src/navigation/AppNavigator';

export default function App() {
  // A dark root view underneath everything. React Navigation's theme handles
  // its own scenes, but this covers the window itself — the frame or two
  // before the navigator has mounted, and any gap a transition leaves behind.
  // Without it the default white window shows through as a flash.
  return (
    <View style={styles.root}>
      <AppNavigator />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
});
