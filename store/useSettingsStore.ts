import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SETTINGS_STORAGE_KEY = 'hunterx-user-settings-v1';

export interface SettingsState {
  soundEffectsEnabled: boolean;
  hapticsEnabled: boolean;
  unitSystem: 'metric' | 'imperial';

  setSoundEffectsEnabled: (enabled: boolean) => void;
  setHapticsEnabled: (enabled: boolean) => void;
  setUnitSystem: (system: 'metric' | 'imperial') => void;
}

export const useSettingsStore = create<SettingsState>((set, get) => {
  // Load saved settings from AsyncStorage on store initialization
  AsyncStorage.getItem(SETTINGS_STORAGE_KEY)
    .then((json) => {
      if (json) {
        try {
          const parsed = JSON.parse(json);
          set({ ...parsed });
        } catch (_) {}
      }
    })
    .catch(() => {});

  const saveSettings = (partial: Partial<SettingsState>) => {
    set(partial as any);
    try {
      const state = get();
      const payload = {
        soundEffectsEnabled: state.soundEffectsEnabled,
        hapticsEnabled: state.hapticsEnabled,
        unitSystem: state.unitSystem,
      };
      AsyncStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(payload)).catch(() => {});
    } catch (_) {}
  };

  return {
    soundEffectsEnabled: true,
    hapticsEnabled: true,
    unitSystem: 'metric',

    setSoundEffectsEnabled: (enabled) => saveSettings({ soundEffectsEnabled: enabled }),
    setHapticsEnabled: (enabled) => saveSettings({ hapticsEnabled: enabled }),
    setUnitSystem: (system) => saveSettings({ unitSystem: system }),
  };
});
