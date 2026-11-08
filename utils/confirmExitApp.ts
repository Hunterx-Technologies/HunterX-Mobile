import { Alert, BackHandler } from 'react-native';

// Android back button on a root screen (Home, Login): ask before closing the
// app, like most apps do, instead of silently ignoring the press.
// One dialog at a time — repeated presses while it's open don't stack more.
let isOpen = false;

export function confirmExitApp(): void {
  if (isOpen) return;
  isOpen = true;
  Alert.alert(
    'Exit HunterX?',
    'Are you sure you want to close the app?',
    [
      { text: 'Cancel', style: 'cancel', onPress: () => (isOpen = false) },
      {
        text: 'Exit',
        style: 'destructive',
        onPress: () => {
          isOpen = false;
          BackHandler.exitApp();
        },
      },
    ],
    // Tapping outside the dialog (or back again) just closes it.
    { cancelable: true, onDismiss: () => (isOpen = false) }
  );
}
