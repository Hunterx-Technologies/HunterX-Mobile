import React, { useState, useEffect } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  Linking,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { GoogleIcon } from '@/components/common/GoogleIcon';
import { Screen } from '@/components/common/Screen';
import { fontFamilies } from '@/theme/typography';
import { changePassword, forgotPassword, getCurrentUser, updateUserEmail } from '@/services/api/auth.service';
import { exportUserData } from '@/services/api/user.service';
import {
  getUserSettings,
  updateUserSettings,
  UserSettings,
} from '@/services/api/settings.service';
import { useSettingsContext } from '@/context/SettingsContext';
import { HunterSwitch } from './HunterSwitch';
import { PasswordStrengthMeter } from '@/components/common/PasswordStrengthMeter';
import { HunterToast, type HunterToastType } from '@/components/common/HunterToast';
import { showGlobalToast } from '@/store/useToastStore';
import {
  getPushPermission,
  registerDeviceIfPermitted,
  requestPushPermission,
  runPushDiagnostics,
  type PushPermission,
} from '@/services/notifications/push';

// Dev builds and test APKs (eas.json `apk-local` sets EXPO_PUBLIC_PUSH_DEBUG) — never production.
const SHOW_PUSH_DIAGNOSTICS = __DEV__ || process.env.EXPO_PUBLIC_PUSH_DEBUG === 'true';

// Daily quest reminder slots (local time) — backend default is 19:00.
const REMINDER_TIMES: { value: string; label: string }[] = [
  { value: '07:00', label: '7 AM' },
  { value: '09:00', label: '9 AM' },
  { value: '12:00', label: '12 PM' },
  { value: '17:00', label: '5 PM' },
  { value: '19:00', label: '7 PM' },
  { value: '21:00', label: '9 PM' },
];

export interface SystemSettingsModalProps {
  visible: boolean;
  onClose: () => void;
  user: any;
  onUpdateUser: (updatedUser: any) => void;
  unitSystem?: 'metric' | 'imperial';
  onUnitSystemChange?: (system: 'metric' | 'imperial') => void;
  soundEffectsEnabled?: boolean;
  setSoundEffectsEnabled?: (val: boolean) => void;
  hapticsEnabled?: boolean;
  setHapticsEnabled?: (val: boolean) => void;
}

export function SystemSettingsModal({
  visible,
  onClose,
  user,
  onUpdateUser,
  unitSystem = 'metric',
  onUnitSystemChange,
}: SystemSettingsModalProps) {
  // Local Device Settings from SettingsContext (AsyncStorage layer)
  const {
    themeMode,
    setThemeMode,
    soundEffectsEnabled,
    setSoundEffectsEnabled,
    hapticsEnabled,
    setHapticsEnabled,
  } = useSettingsContext();

  // Account-Level Preferences state (backend layer)
  const [accountSettings, setAccountSettings] = useState<UserSettings>({
    units: unitSystem || 'metric',
    notify_all: true,
    notify_daily_motivation: true,
    notify_task_reminders: true,
    notify_streak_preservation: true,
    notify_streak_milestones: true,
    notify_streak_freeze: true,
    notify_level_up: true,
    notify_reward_ready: true,
    notify_announcements: true,
    notify_social: true,
    notify_leaderboard: true,
    leaderboard_visible: true,
  });

  const [isFetchingAccountSettings, setIsFetchingAccountSettings] = useState(false);
  // OS-level push permission — the backend toggles below are moot without it.
  const [pushPermission, setPushPermission] = useState<PushPermission>('unsupported');

  // Submodals
  const [isChangePasswordModalVisible, setIsChangePasswordModalVisible] = useState(false);
  const [isChangeEmailModalVisible, setIsChangeEmailModalVisible] = useState(false);
  const [currentPasswordInput, setCurrentPasswordInput] = useState('');
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [confirmPasswordInput, setConfirmPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [visiblePasswordFields, setVisiblePasswordFields] = useState({
    current: false,
    new: false,
    confirm: false,
  });
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isSendingReset, setIsSendingReset] = useState(false);
  const [newEmailInput, setNewEmailInput] = useState('');
  const [isUpdatingEmail, setIsUpdatingEmail] = useState(false);
  const [isExportingData, setIsExportingData] = useState(false);
  const [toast, setToast] = useState<{ visible: boolean; message: string; type: HunterToastType }>({
    visible: false,
    message: '',
    type: 'success',
  });

  const showToast = (message: string, type: HunterToastType = 'success') => {
    setToast({ visible: true, message, type });
    showGlobalToast(message, type);
  };

  // Fetch account-level settings on modal mount
  useEffect(() => {
    let isMounted = true;
    if (visible) {
      setIsFetchingAccountSettings(true);
      getUserSettings()
        .then((data) => {
          if (isMounted && data) {
            setAccountSettings(data);
            if (data.units && onUnitSystemChange) {
              onUnitSystemChange(data.units);
            }
          }
        })
        .catch((err) => {
          console.warn('[SystemSettingsModal] Error fetching account settings:', err);
        })
        .finally(() => {
          if (isMounted) setIsFetchingAccountSettings(false);
        });
    }
    return () => {
      isMounted = false;
    };
  }, [visible]);

  // Re-checked on open and whenever the app returns from the OS Settings app.
  useEffect(() => {
    if (!visible) return;
    const check = () => getPushPermission().then(setPushPermission).catch(() => { });
    check();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') check();
    });
    return () => sub.remove();
  }, [visible]);

  const [isRunningPushDiagnostics, setIsRunningPushDiagnostics] = useState(false);
  const handleRunPushDiagnostics = async () => {
    setIsRunningPushDiagnostics(true);
    try {
      const lines = await runPushDiagnostics();
      getPushPermission().then(setPushPermission).catch(() => { });
      Alert.alert('Push diagnostics', lines.join('\n\n'));
    } finally {
      setIsRunningPushDiagnostics(false);
    }
  };

  const handleEnablePush = async () => {
    const result = await requestPushPermission();
    setPushPermission(result);
    if (result === 'granted') {
      registerDeviceIfPermitted({ force: true }).catch(() => { });
    } else if (result === 'denied') {
      Linking.openSettings().catch(() => { });
    }
  };

  // Optimistic handler for account settings toggle
  const handleToggleAccountSetting = async <K extends keyof UserSettings>(
    field: K,
    newValue: UserSettings[K]
  ) => {
    const previousValue = accountSettings[field];
    // Optimistic UI update
    setAccountSettings((prev) => ({ ...prev, [field]: newValue }));

    if (field === 'units' && onUnitSystemChange) {
      onUnitSystemChange(newValue as 'metric' | 'imperial');
    }

    try {
      await updateUserSettings({ [field]: newValue });
    } catch (err: any) {
      // Revert state on failure
      setAccountSettings((prev) => ({ ...prev, [field]: previousValue }));
      if (field === 'units' && onUnitSystemChange) {
        onUnitSystemChange(previousValue as 'metric' | 'imperial');
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => { });
      Alert.alert('Setting Update Failed', err.message || 'Failed to sync preference.');
    }
  };

  // Passwords start hidden every time the modal opens.
  useEffect(() => {
    if (isChangePasswordModalVisible) {
      setVisiblePasswordFields({ current: false, new: false, confirm: false });
    }
  }, [isChangePasswordModalVisible]);

  const togglePasswordVisibility = (field: keyof typeof visiblePasswordFields) => {
    setVisiblePasswordFields((prev) => ({ ...prev, [field]: !prev[field] }));
  };

  const closeChangePassword = () => {
    if (isChangingPassword) return;
    setIsChangePasswordModalVisible(false);
    setCurrentPasswordInput('');
    setNewPasswordInput('');
    setConfirmPasswordInput('');
    setPasswordError(null);
  };

  // Same rules the backend enforces (sign-up, reset and change).
  const passwordRuleError = (pw: string): string | null => {
    const missing = [
      pw.length < 8 && 'at least 8 characters',
      !/[A-Z]/.test(pw) && 'an uppercase letter',
      !/[0-9]/.test(pw) && 'a number',
      !/[^A-Za-z0-9]/.test(pw) && 'a special character',
    ].filter(Boolean);
    return missing.length ? `New password needs ${missing.join(', ')}.` : null;
  };

  const handleChangePassword = async () => {
    if (isChangingPassword) return;
    if (!currentPasswordInput || !newPasswordInput || !confirmPasswordInput) {
      setPasswordError('Please fill in all password fields.');
      return;
    }
    const ruleError = passwordRuleError(newPasswordInput);
    if (ruleError) {
      setPasswordError(ruleError);
      return;
    }
    if (newPasswordInput !== confirmPasswordInput) {
      setPasswordError('New passwords do not match.');
      return;
    }
    if (newPasswordInput === currentPasswordInput) {
      setPasswordError('New password must be different from the current one.');
      return;
    }

    setPasswordError(null);
    setIsChangingPassword(true);
    try {
      await changePassword(currentPasswordInput, newPasswordInput, confirmPasswordInput);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => { });
      setIsChangingPassword(false);
      closeChangePassword();
      showToast('Password updated. Other devices have been signed out.', 'success');
    } catch (err: any) {
      setIsChangingPassword(false);
      setPasswordError(err?.message || 'Could not change your password. Please try again.');
    }
  };

  // "Forgot password?" from inside the change dialog: email a reset link to
  // the account's own address (same flow as the login screen's).
  const handleForgotPassword = async () => {
    const email = user?.email;
    if (!email || isSendingReset) return;
    setIsSendingReset(true);
    try {
      await forgotPassword(email);
      setIsChangePasswordModalVisible(false);
      setCurrentPasswordInput('');
      setNewPasswordInput('');
      setConfirmPasswordInput('');
      setPasswordError(null);
      showToast(`Reset link sent to ${email}. It expires in 10 minutes.`, 'success');
    } catch (err: any) {
      setPasswordError(err?.message || 'Could not send the reset link. Please try again.');
    } finally {
      setIsSendingReset(false);
    }
  };

  const rawProvider =
    user?.auth_provider ?? user?.authProvider ?? user?.provider ?? 'EMAIL';
  const providerUpper = String(rawProvider).toUpperCase();
  const p = providerUpper.includes('GOOGLE')
    ? 'GOOGLE'
    : providerUpper.includes('APPLE')
      ? 'APPLE'
      : providerUpper;
  const isSocialAuth = p === 'GOOGLE' || p === 'APPLE';

  const handlePressChangeEmail = () => {
    if (!isSocialAuth) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => { });
      Alert.alert(
        'Action Restricted',
        'Accounts registered via Email & Password cannot update their primary email address.'
      );
      return;
    }
    setNewEmailInput(user?.email || '');
    setIsChangeEmailModalVisible(true);
  };

  const handleChangeEmail = async () => {
    const trimmed = newEmailInput.trim();
    if (!trimmed || !trimmed.includes('@')) {
      Alert.alert('Error', 'Please enter a valid email address.');
      return;
    }

    if (trimmed.toLowerCase() === (user?.email || '').toLowerCase()) {
      setIsChangeEmailModalVisible(false);
      return;
    }

    try {
      setIsUpdatingEmail(true);
      const updatedUser = await updateUserEmail(trimmed);
      onUpdateUser(updatedUser);

      try {
        const freshUser = await getCurrentUser();
        if (freshUser) onUpdateUser(freshUser);
      } catch { }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => { });
      Alert.alert('Success', 'Your email address has been updated to ' + trimmed + '.');
      setIsChangeEmailModalVisible(false);
      setNewEmailInput('');
    } catch (err: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => { });
      Alert.alert('Update Failed', err.message || 'Failed to update email address.');
    } finally {
      setIsUpdatingEmail(false);
    }
  };

  const handleDownloadData = async () => {
    if (isExportingData) return;
    setIsExportingData(true);
    try {
      const res = await exportUserData();
      showToast(
        res.message || 'Your data export has been sent to your registered email address.',
        'success'
      );
    } catch (err: any) {
      showToast(
        err.message || 'Unable to request data export. Please try again later.',
        'error'
      );
    } finally {
      setIsExportingData(false);
    }
  };

  const allOn = accountSettings.notify_all;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <Screen style={styles.screen}>
        {/* Header Bar */}
        <View style={styles.headerBar}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={onClose}
          >
            <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>System Settings</Text>
          <View style={{ width: 48 }} />
        </View>

        <ScrollView
          bounces={false}
          overScrollMode="never"
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* SECTION 1: APPEARANCE & THEME MODE */}
          <Text style={styles.sectionHeader}>APPEARANCE & THEME</Text>
          <View style={styles.settingsGroupCard}>
            <View style={styles.themeSelectorRow}>
              {/* Dark Mode */}
              <TouchableOpacity
                style={[
                  styles.themeModeCard,
                  themeMode === 'dark' && styles.themeModeCardSelected,
                ]}
                onPress={() => setThemeMode('dark')}
                activeOpacity={0.8}
              >
                <Ionicons name="moon" size={20} color="#FE5B01" />
                <Text
                  style={[
                    styles.themeModeText,
                    themeMode === 'dark' && styles.themeModeTextSelected,
                  ]}
                >
                  Dark Mode
                </Text>
              </TouchableOpacity>

              {/* Light Mode */}
              <View style={[styles.themeModeCard, styles.themeModeCardDisabled]}>
                <View style={styles.comingSoonPill}>
                  <Text style={styles.comingSoonPillText}>SOON</Text>
                </View>
                <Ionicons name="sunny" size={20} color="#52525B" />
                <Text style={[styles.themeModeText, styles.themeModeTextDisabled]}>
                  Light Mode
                </Text>
              </View>

              {/* System */}
              <View style={[styles.themeModeCard, styles.themeModeCardDisabled]}>
                <View style={styles.comingSoonPill}>
                  <Text style={styles.comingSoonPillText}>SOON</Text>
                </View>
                <Ionicons name="hardware-chip" size={20} color="#52525B" />
                <Text style={[styles.themeModeText, styles.themeModeTextDisabled]}>
                  System
                </Text>
              </View>
            </View>
          </View>

          {/* SECTION 2: ACCOUNT & SECURITY */}
          <Text style={styles.sectionHeader}>ACCOUNT & SECURITY</Text>
          <View style={styles.settingsGroupCard}>
            {/* Linked Sign-in Method */}
            <View style={styles.settingRow}>
              <View style={styles.settingLeftGroup}>
                <View style={styles.settingIconBox}>
                  <Ionicons name="shield-checkmark-outline" size={18} color="#FE5B01" />
                </View>
                <View style={styles.settingTextGroup}>
                  <Text style={styles.settingTitle}>Linked Sign-In Method</Text>
                  <Text style={styles.settingSubtitle}>
                    {user?.email || 'hunter@hunterx.app'}
                  </Text>
                </View>
              </View>
              {p === 'GOOGLE' ? (
                <View style={styles.googleProviderPill}>
                  <GoogleIcon size={16} />
                  <Text style={styles.googleProviderPillText}>Google</Text>
                </View>
              ) : p === 'APPLE' ? (
                <View style={styles.appleProviderPill}>
                  <Ionicons name="logo-apple" size={16} color="#FFFFFF" />
                  <Text style={styles.appleProviderPillText}>Apple</Text>
                </View>
              ) : (
                <View style={styles.emailProviderPill}>
                  <Ionicons name="mail-outline" size={16} color="#FE5B01" />
                  <Text style={styles.emailProviderPillText}>Email</Text>
                </View>
              )}
            </View>

            {/* Change Password (Only for Email accounts) */}
            {p !== 'GOOGLE' && p !== 'APPLE' && (
              <>
                <View style={styles.settingItemDivider} />
                <TouchableOpacity
                  style={styles.settingRow}
                  onPress={() => setIsChangePasswordModalVisible(true)}
                  activeOpacity={0.7}
                >
                  <View style={styles.settingLeftGroup}>
                    <View style={styles.settingIconBox}>
                      <Ionicons name="key-outline" size={18} color="#FE5B01" />
                    </View>
                    <View style={styles.settingTextGroup}>
                      <Text style={styles.settingTitle}>Change Password</Text>
                      <Text style={styles.settingSubtitle}>
                        Update your account security credentials
                      </Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color="#71717A" />
                </TouchableOpacity>
              </>
            )}

            {/* Change Email (Commented Out)
            <View style={styles.settingItemDivider} />
            <TouchableOpacity
              style={[styles.settingRow, !isSocialAuth && { opacity: 0.6 }]}
              onPress={handlePressChangeEmail}
              activeOpacity={0.7}
            >
              <View style={styles.settingLeftGroup}>
                <View style={styles.settingIconBox}>
                  <Ionicons name="mail-outline" size={18} color="#FE5B01" />
                </View>
                <View style={styles.settingTextGroup}>
                  <Text style={styles.settingTitle}>Change Email</Text>
                  <Text style={styles.settingSubtitle}>
                    {isSocialAuth
                      ? 'Update primary email address'
                      : 'Restricted for Email & Password accounts'}
                  </Text>
                </View>
              </View>
              {isSocialAuth ? (
                <Ionicons name="chevron-forward" size={16} color="#71717A" />
              ) : (
                <Ionicons name="lock-closed-outline" size={16} color="#71717A" />
              )}
            </TouchableOpacity>
            */}
          </View>

          {/* SECTION 3: PREFERENCES (ACCOUNT-LEVEL BACKEND SYNC) */}
          <Text style={styles.sectionHeader}>PREFERENCES</Text>
          <View style={styles.settingsGroupCard}>
            <View style={styles.settingRowStacked}>
              <View style={styles.settingLeftGroup}>
                <View style={styles.settingIconBox}>
                  <Ionicons name="options-outline" size={18} color="#FE5B01" />
                </View>
                <View style={styles.settingTextGroup}>
                  <Text style={styles.settingTitle}>Measurement Units</Text>
                  <Text style={styles.settingSubtitle}>Used for height, weight & goals</Text>
                </View>
              </View>
              <View style={styles.unitsSegmentedContainer}>
                <TouchableOpacity
                  style={[
                    styles.unitSegmentBtn,
                    accountSettings.units === 'metric' && styles.unitSegmentBtnActive,
                  ]}
                  onPress={() => handleToggleAccountSetting('units', 'metric')}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.unitSegmentText,
                      accountSettings.units === 'metric' && styles.unitSegmentTextActive,
                    ]}
                  >
                    Metric (cm, kg)
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.unitSegmentBtn,
                    accountSettings.units === 'imperial' && styles.unitSegmentBtnActive,
                  ]}
                  onPress={() => handleToggleAccountSetting('units', 'imperial')}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.unitSegmentText,
                      accountSettings.units === 'imperial' && styles.unitSegmentTextActive,
                    ]}
                  >
                    Imperial (ft, lbs)
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.settingItemDivider} />

            {/* Leaderboard Visibility */}
            <View style={styles.settingRow}>
              <View style={styles.settingLeftGroup}>
                <View style={styles.settingIconBox}>
                  <Ionicons name="podium-outline" size={18} color="#FE5B01" />
                </View>
                <View style={styles.settingTextGroup}>
                  <Text style={styles.settingTitle}>Show me on leaderboards</Text>
                  <Text style={styles.settingSubtitle}>
                    Let other hunters see your rank on the Global leaderboard
                  </Text>
                </View>
              </View>
              <HunterSwitch
                value={accountSettings.leaderboard_visible}
                onValueChange={(val) => handleToggleAccountSetting('leaderboard_visible', val)}
              />
            </View>
          </View>

          {/* SECTION 4: AUDIO & HAPTICS (LOCAL ASYNCSTORAGE LAYER) */}
          <Text style={styles.sectionHeader}>AUDIO & HAPTICS</Text>
          <View style={styles.settingsGroupCard}>
            {/* Sound Effects */}
            <View style={styles.settingRow}>
              <View style={styles.settingLeftGroup}>
                <View style={styles.settingIconBox}>
                  <Ionicons name="volume-high-outline" size={18} color="#FE5B01" />
                </View>
                <View style={styles.settingTextGroup}>
                  <Text style={styles.settingTitle}>Sound Effects</Text>
                  <Text style={styles.settingSubtitle}>Quest completion chimes & audio cues</Text>
                </View>
              </View>
              <HunterSwitch
                value={soundEffectsEnabled}
                onValueChange={setSoundEffectsEnabled}
              />
            </View>

            <View style={styles.settingItemDivider} />

            {/* Haptic Feedback */}
            <View style={styles.settingRow}>
              <View style={styles.settingLeftGroup}>
                <View style={styles.settingIconBox}>
                  <Ionicons name="phone-portrait-outline" size={18} color="#FE5B01" />
                </View>
                <View style={styles.settingTextGroup}>
                  <Text style={styles.settingTitle}>Haptic Feedback</Text>
                  <Text style={styles.settingSubtitle}>
                    Tactile vibration on quest & action triggers
                  </Text>
                </View>
              </View>
              <HunterSwitch
                value={hapticsEnabled}
                onValueChange={setHapticsEnabled}
              />
            </View>
          </View>

          {/* SECTION 5: HUNTER NOTIFICATIONS (ACCOUNT-LEVEL BACKEND SYNC) */}
          <Text style={styles.sectionHeader}>HUNTER NOTIFICATIONS</Text>
          {(pushPermission === 'denied' || pushPermission === 'undetermined') && (
            <TouchableOpacity style={styles.pushBanner} onPress={handleEnablePush} activeOpacity={0.8}>
              <Ionicons name="notifications-off-outline" size={18} color="#FE5B01" />
              <View style={styles.settingTextGroup}>
                <Text style={styles.settingTitle}>
                  {pushPermission === 'denied' ? 'Notifications are off on this device' : 'Push notifications are not enabled'}
                </Text>
                <Text style={styles.settingSubtitle}>
                  {pushPermission === 'denied'
                    ? 'Turn them on in your phone settings so these alerts can reach you.'
                    : 'Tap to allow HunterX to send these alerts.'}
                </Text>
              </View>
              <Text style={styles.pushBannerAction}>{pushPermission === 'denied' ? 'Settings' : 'Enable'}</Text>
            </TouchableOpacity>
          )}
          <View style={styles.settingsGroupCard}>
            {/* Master All Notifications Toggle */}
            <View style={styles.settingRow}>
              <View style={styles.settingLeftGroup}>
                <View style={styles.settingIconBox}>
                  <Ionicons
                    name={allOn ? 'notifications' : 'notifications-off-outline'}
                    size={18}
                    color={allOn ? '#FE5B01' : '#71717A'}
                  />
                </View>
                <View style={styles.settingTextGroup}>
                  <Text style={styles.settingTitle}>All Notifications</Text>
                  <Text style={styles.settingSubtitle}>
                    Master switch to enable or mute all alerts
                  </Text>
                </View>
              </View>
              <HunterSwitch
                value={allOn}
                onValueChange={(val) => handleToggleAccountSetting('notify_all', val)}
              />
            </View>

            {/* Sub-Notification Toggles */}
            <View style={{ opacity: allOn ? 1 : 0.4 }}>
              <View style={styles.settingItemDivider} />

              {/* 1. Daily Motivation */}
              <View style={styles.settingRow}>
                <View style={styles.settingLeftGroup}>
                  <View style={styles.settingSubIconBox}>
                    <Ionicons name="sunny-outline" size={16} color="#FE5B01" />
                  </View>
                  <View style={styles.settingTextGroup}>
                    <Text style={styles.settingTitle}>Daily Motivation</Text>
                    <Text style={styles.settingSubtitle}>
                      Morning awakening & motivational sparks
                    </Text>
                  </View>
                </View>
                <HunterSwitch
                  disabled={!allOn}
                  value={allOn && accountSettings.notify_daily_motivation}
                  onValueChange={(val) => handleToggleAccountSetting('notify_daily_motivation', val)}
                />
              </View>

              <View style={styles.settingItemDivider} />

              {/* 2. Task Reminders */}
              <View style={styles.settingRow}>
                <View style={styles.settingLeftGroup}>
                  <View style={styles.settingSubIconBox}>
                    <Ionicons name="checkmark-circle-outline" size={16} color="#FE5B01" />
                  </View>
                  <View style={styles.settingTextGroup}>
                    <Text style={styles.settingTitle}>Task Reminders</Text>
                    <Text style={styles.settingSubtitle}>
                      Routine quests & daily task due prompts
                    </Text>
                  </View>
                </View>
                <HunterSwitch
                  disabled={!allOn}
                  value={allOn && accountSettings.notify_task_reminders}
                  onValueChange={(val) => handleToggleAccountSetting('notify_task_reminders', val)}
                />
              </View>

              {allOn && accountSettings.notify_task_reminders && (
                <View style={styles.reminderTimeBlock}>
                  <Text style={styles.reminderTimeLabel}>Remind me at</Text>
                  <View style={styles.reminderTimeChips}>
                    {REMINDER_TIMES.map((slot) => {
                      const active = (accountSettings.reminder_time ?? '19:00') === slot.value;
                      return (
                        <TouchableOpacity
                          key={slot.value}
                          style={[styles.reminderChip, active && styles.reminderChipActive]}
                          onPress={() => {
                            if (active) return;
                            Haptics.selectionAsync().catch(() => { });
                            handleToggleAccountSetting('reminder_time', slot.value);
                          }}
                          activeOpacity={0.7}
                        >
                          <Text style={[styles.reminderChipText, active && styles.reminderChipTextActive]}>
                            {slot.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}

              <View style={styles.settingItemDivider} />

              {/* 3. Streak Preservation Alert */}
              <View style={styles.settingRow}>
                <View style={styles.settingLeftGroup}>
                  <View style={styles.settingSubIconBox}>
                    <Ionicons name="flame-outline" size={16} color="#FE5B01" />
                  </View>
                  <View style={styles.settingTextGroup}>
                    <Text style={styles.settingTitle}>Streak Preservation Alert</Text>
                    <Text style={styles.settingSubtitle}>
                      Urgent warning before daily streak expires
                    </Text>
                  </View>
                </View>
                <HunterSwitch
                  disabled={!allOn}
                  value={allOn && accountSettings.notify_streak_preservation}
                  onValueChange={(val) => handleToggleAccountSetting('notify_streak_preservation', val)}
                />
              </View>

              <View style={styles.settingItemDivider} />

              {/* 4. Streak Milestone Alerts */}
              <View style={styles.settingRow}>
                <View style={styles.settingLeftGroup}>
                  <View style={styles.settingSubIconBox}>
                    <Ionicons name="trophy-outline" size={16} color="#FE5B01" />
                  </View>
                  <View style={styles.settingTextGroup}>
                    <Text style={styles.settingTitle}>Streak Milestone Alerts</Text>
                    <Text style={styles.settingSubtitle}>
                      Celebration alerts for 7, 14, 30+ day records
                    </Text>
                  </View>
                </View>
                <HunterSwitch
                  disabled={!allOn}
                  value={allOn && accountSettings.notify_streak_milestones}
                  onValueChange={(val) => handleToggleAccountSetting('notify_streak_milestones', val)}
                />
              </View>

              <View style={styles.settingItemDivider} />

              {/* 5. Streak Status & Recovery */}
              <View style={styles.settingRow}>
                <View style={styles.settingLeftGroup}>
                  <View style={styles.settingSubIconBox}>
                    <Ionicons name="snow-outline" size={16} color="#38BDF8" />
                  </View>
                  <View style={styles.settingTextGroup}>
                    <Text style={styles.settingTitle}>Streak Freeze & Recovery</Text>
                    <Text style={styles.settingSubtitle}>
                      Alerts when streak freezes are used or restored
                    </Text>
                  </View>
                </View>
                <HunterSwitch
                  disabled={!allOn}
                  value={allOn && accountSettings.notify_streak_freeze}
                  onValueChange={(val) => handleToggleAccountSetting('notify_streak_freeze', val)}
                />
              </View>

              <View style={styles.settingItemDivider} />

              {/* 6. Level Up Alerts */}
              <View style={styles.settingRow}>
                <View style={styles.settingLeftGroup}>
                  <View style={styles.settingSubIconBox}>
                    <Ionicons name="sparkles-outline" size={16} color="#FE5B01" />
                  </View>
                  <View style={styles.settingTextGroup}>
                    <Text style={styles.settingTitle}>Level Up Alerts</Text>
                    <Text style={styles.settingSubtitle}>
                      Hunter rank promotions & XP milestone alerts
                    </Text>
                  </View>
                </View>
                <HunterSwitch
                  disabled={!allOn}
                  value={allOn && accountSettings.notify_level_up}
                  onValueChange={(val) => handleToggleAccountSetting('notify_level_up', val)}
                />
              </View>

              <View style={styles.settingItemDivider} />

              {/* 7. Reward Ready Alerts */}
              <View style={styles.settingRow}>
                <View style={styles.settingLeftGroup}>
                  <View style={styles.settingSubIconBox}>
                    <Ionicons name="gift-outline" size={16} color="#FE5B01" />
                  </View>
                  <View style={styles.settingTextGroup}>
                    <Text style={styles.settingTitle}>Reward Ready Alerts</Text>
                    <Text style={styles.settingSubtitle}>
                      Reminders when loot drops or rewards are available
                    </Text>
                  </View>
                </View>
                <HunterSwitch
                  disabled={!allOn}
                  value={allOn && accountSettings.notify_reward_ready}
                  onValueChange={(val) => handleToggleAccountSetting('notify_reward_ready', val)}
                />
              </View>

              <View style={styles.settingItemDivider} />

              {/* 8. Friends & Referrals */}
              <View style={styles.settingRow}>
                <View style={styles.settingLeftGroup}>
                  <View style={styles.settingSubIconBox}>
                    <Ionicons name="people-outline" size={16} color="#FE5B01" />
                  </View>
                  <View style={styles.settingTextGroup}>
                    <Text style={styles.settingTitle}>Friends & Referrals</Text>
                    <Text style={styles.settingSubtitle}>
                      When a friend joins with your Guest Pass
                    </Text>
                  </View>
                </View>
                <HunterSwitch
                  disabled={!allOn}
                  value={allOn && accountSettings.notify_social}
                  onValueChange={(val) => handleToggleAccountSetting('notify_social', val)}
                />
              </View>

              <View style={styles.settingItemDivider} />

              {/* 9. Leaderboard Updates */}
              <View style={styles.settingRow}>
                <View style={styles.settingLeftGroup}>
                  <View style={styles.settingSubIconBox}>
                    <Ionicons name="podium-outline" size={16} color="#FE5B01" />
                  </View>
                  <View style={styles.settingTextGroup}>
                    <Text style={styles.settingTitle}>Leaderboard Updates</Text>
                    <Text style={styles.settingSubtitle}>
                      Daily rank changes — climbs, top 10, friends passing you
                    </Text>
                  </View>
                </View>
                <HunterSwitch
                  disabled={!allOn}
                  value={allOn && accountSettings.notify_leaderboard}
                  onValueChange={(val) => handleToggleAccountSetting('notify_leaderboard', val)}
                />
              </View>

              <View style={styles.settingItemDivider} />

              {/* 10. Announcements & Broadcast */}
              <View style={styles.settingRow}>
                <View style={styles.settingLeftGroup}>
                  <View style={styles.settingSubIconBox}>
                    <Ionicons name="megaphone-outline" size={16} color="#FE5B01" />
                  </View>
                  <View style={styles.settingTextGroup}>
                    <Text style={styles.settingTitle}>Announcements & Broadcasts</Text>
                    <Text style={styles.settingSubtitle}>
                      Important messages & system updates from admin
                    </Text>
                  </View>
                </View>
                <HunterSwitch
                  disabled={!allOn}
                  value={allOn && accountSettings.notify_announcements}
                  onValueChange={(val) => handleToggleAccountSetting('notify_announcements', val)}
                />
              </View>
            </View>
          </View>

          {SHOW_PUSH_DIAGNOSTICS && (
            <TouchableOpacity
              style={[styles.pushBanner, { marginTop: 10 }]}
              onPress={handleRunPushDiagnostics}
              disabled={isRunningPushDiagnostics}
              activeOpacity={0.8}
            >
              <Ionicons name="bug-outline" size={18} color="#FE5B01" />
              <View style={styles.settingTextGroup}>
                <Text style={styles.settingTitle}>Push diagnostics</Text>
                <Text style={styles.settingSubtitle}>Checks each step and sends you a test notification</Text>
              </View>
              {isRunningPushDiagnostics ? (
                <ActivityIndicator size="small" color="#FE5B01" />
              ) : (
                <Text style={styles.pushBannerAction}>Run</Text>
              )}
            </TouchableOpacity>
          )}

          {/* SECTION 6: DATA & PRIVACY */}
          <Text style={styles.sectionHeader}>DATA & PRIVACY</Text>
          <View style={styles.settingsGroupCard}>
            <TouchableOpacity
              style={styles.settingRow}
              onPress={handleDownloadData}
              disabled={isExportingData}
              activeOpacity={0.7}
            >
              <View style={styles.settingLeftGroup}>
                <View style={styles.settingIconBox}>
                  {isExportingData ? (
                    <ActivityIndicator size="small" color="#FE5B01" />
                  ) : (
                    <Ionicons name="cloud-download-outline" size={18} color="#FE5B01" />
                  )}
                </View>
                <View style={styles.settingTextGroup}>
                  <Text style={styles.settingTitle}>Download My Data</Text>
                  <Text style={styles.settingSubtitle}>
                    Request an archive of your workouts, quests & stats
                  </Text>
                </View>
              </View>
              {isExportingData ? (
                <ActivityIndicator size="small" color="#71717A" />
              ) : (
                <Ionicons name="chevron-forward" size={16} color="#71717A" />
              )}
            </TouchableOpacity>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>

        {/* Change Password Modal */}
        <Modal
          visible={isChangePasswordModalVisible}
          transparent
          animationType="fade"
          onRequestClose={closeChangePassword}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Change Password</Text>
              <Text style={styles.modalSubtitleText}>Enter your current password, then choose a new one.</Text>
              <View style={styles.passwordInputWrap}>
                <TextInput
                  style={[styles.modalInput, styles.passwordInput]}
                  placeholder="Current Password"
                  placeholderTextColor="#71717A"
                  secureTextEntry={!visiblePasswordFields.current}
                  autoCapitalize="none"
                  textContentType="password"
                  autoComplete="current-password"
                  editable={!isChangingPassword}
                  value={currentPasswordInput}
                  onChangeText={(t) => {
                    setCurrentPasswordInput(t);
                    setPasswordError(null);
                  }}
                />
                <TouchableOpacity
                  style={styles.passwordEyeBtn}
                  onPress={() => togglePasswordVisibility('current')}
                  hitSlop={8}
                  accessibilityLabel={visiblePasswordFields.current ? 'Hide password' : 'Show password'}
                >
                  <Ionicons
                    name={visiblePasswordFields.current ? 'eye-off-outline' : 'eye-outline'}
                    size={18}
                    color="#71717A"
                  />
                </TouchableOpacity>
              </View>
              <View style={styles.passwordInputWrap}>
                <TextInput
                  style={[styles.modalInput, styles.passwordInput]}
                  placeholder="New Password"
                  placeholderTextColor="#71717A"
                  secureTextEntry={!visiblePasswordFields.new}
                  autoCapitalize="none"
                  textContentType="newPassword"
                  autoComplete="new-password"
                  editable={!isChangingPassword}
                  value={newPasswordInput}
                  onChangeText={(t) => {
                    setNewPasswordInput(t);
                    setPasswordError(null);
                  }}
                />
                <TouchableOpacity
                  style={styles.passwordEyeBtn}
                  onPress={() => togglePasswordVisibility('new')}
                  hitSlop={8}
                  accessibilityLabel={visiblePasswordFields.new ? 'Hide password' : 'Show password'}
                >
                  <Ionicons
                    name={visiblePasswordFields.new ? 'eye-off-outline' : 'eye-outline'}
                    size={18}
                    color="#71717A"
                  />
                </TouchableOpacity>
              </View>
              <PasswordStrengthMeter password={newPasswordInput} />
              <View style={styles.passwordInputWrap}>
                <TextInput
                  style={[styles.modalInput, styles.passwordInput]}
                  placeholder="Confirm New Password"
                  placeholderTextColor="#71717A"
                  secureTextEntry={!visiblePasswordFields.confirm}
                  autoCapitalize="none"
                  textContentType="newPassword"
                  autoComplete="new-password"
                  editable={!isChangingPassword}
                  value={confirmPasswordInput}
                  onChangeText={(t) => {
                    setConfirmPasswordInput(t);
                    setPasswordError(null);
                  }}
                />
                <TouchableOpacity
                  style={styles.passwordEyeBtn}
                  onPress={() => togglePasswordVisibility('confirm')}
                  hitSlop={8}
                  accessibilityLabel={visiblePasswordFields.confirm ? 'Hide password' : 'Show password'}
                >
                  <Ionicons
                    name={visiblePasswordFields.confirm ? 'eye-off-outline' : 'eye-outline'}
                    size={18}
                    color="#71717A"
                  />
                </TouchableOpacity>
              </View>
              {!!passwordError && <Text style={styles.passwordErrorText}>{passwordError}</Text>}
              {!!user?.email && (
                <TouchableOpacity
                  onPress={handleForgotPassword}
                  disabled={isSendingReset || isChangingPassword}
                  style={styles.forgotPasswordLink}
                  hitSlop={8}
                >
                  <Text style={styles.forgotPasswordText}>
                    {isSendingReset ? 'Sending reset link...' : 'Forgot password?'}
                  </Text>
                </TouchableOpacity>
              )}
              <View style={styles.modalActionRow}>
                <TouchableOpacity
                  style={[styles.modalBtn, styles.cancelBtn]}
                  onPress={closeChangePassword}
                  disabled={isChangingPassword}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalBtn, styles.saveBtn, isChangingPassword && { opacity: 0.7 }]}
                  onPress={handleChangePassword}
                  disabled={isChangingPassword}
                >
                  {isChangingPassword ? (
                    <ActivityIndicator size="small" color="#0D0F12" />
                  ) : (
                    <Text style={styles.saveBtnText}>Update</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Change Email Modal */}
        <Modal
          visible={isChangeEmailModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setIsChangeEmailModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Change Email</Text>
              <Text style={styles.modalSubtitleText}>Enter your new email address.</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="New Email Address"
                placeholderTextColor="#71717A"
                keyboardType="email-address"
                autoCapitalize="none"
                value={newEmailInput}
                onChangeText={setNewEmailInput}
              />
              <View style={styles.modalActionRow}>
                <TouchableOpacity
                  style={[styles.modalBtn, styles.cancelBtn]}
                  onPress={() => setIsChangeEmailModalVisible(false)}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalBtn, styles.saveBtn]}
                  onPress={handleChangeEmail}
                  disabled={isUpdatingEmail}
                >
                  {isUpdatingEmail ? (
                    <ActivityIndicator size="small" color="#0D0F12" />
                  ) : (
                    <Text style={styles.saveBtnText}>Save</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
        {/* Toast Notification */}
        <HunterToast
          visible={toast.visible}
          message={toast.message}
          type={toast.type}
          onHide={() => setToast((prev) => ({ ...prev, visible: false }))}
        />
      </Screen>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#09090B',
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#242428',
  },
  backBtn: {
    width: 48,
    height: 44,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: fontFamilies.bold,
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 16,
    paddingBottom: 60,
  },
  sectionHeader: {
    fontFamily: fontFamilies.bold,
    fontSize: 12,
    fontWeight: '800',
    color: '#71717A',
    letterSpacing: 1.5,
    marginTop: 8,
    marginLeft: 4,
  },
  settingsGroupCard: {
    width: '100%',
    backgroundColor: '#121215',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#242428',
    padding: 14,
  },
  pushBanner: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(254, 91, 1, 0.08)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(254, 91, 1, 0.35)',
    padding: 12,
    marginBottom: 10,
  },
  pushBannerAction: {
    fontFamily: fontFamilies.semiBold,
    fontSize: 13,
    color: '#FE5B01',
  },
  reminderTimeBlock: {
    paddingTop: 2,
    paddingBottom: 10,
    paddingLeft: 44,
  },
  reminderTimeLabel: {
    fontFamily: fontFamilies.medium,
    fontSize: 11,
    color: '#71717A',
    marginBottom: 8,
  },
  reminderTimeChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  reminderChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2A2A30',
    backgroundColor: '#18181C',
  },
  reminderChipActive: {
    borderColor: '#FE5B01',
    backgroundColor: 'rgba(254, 91, 1, 0.12)',
  },
  reminderChipText: {
    fontFamily: fontFamilies.medium,
    fontSize: 12,
    color: '#A1A1AA',
  },
  reminderChipTextActive: {
    color: '#FE5B01',
    fontFamily: fontFamilies.semiBold,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  settingRowStacked: {
    gap: 12,
    paddingVertical: 6,
  },
  settingLeftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    paddingRight: 10,
  },
  settingIconBox: {
    width: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingSubIconBox: {
    width: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingTextGroup: {
    flex: 1,
  },
  settingTitle: {
    fontFamily: fontFamilies.bold,
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  settingSubtitle: {
    fontFamily: fontFamilies.regular,
    fontSize: 11,
    color: '#71717A',
    marginTop: 2,
  },
  settingItemDivider: {
    height: 1,
    backgroundColor: '#242428',
    marginVertical: 10,
  },
  themeSelectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  themeModeCard: {
    flex: 1,
    backgroundColor: '#18181D',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#2D2D34',
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    position: 'relative',
  },
  themeModeCardSelected: {
    borderColor: '#FE5B01',
    backgroundColor: 'rgba(254, 91, 1, 0.1)',
  },
  themeModeCardDisabled: {
    opacity: 0.5,
  },
  themeModeText: {
    fontFamily: fontFamilies.bold,
    fontSize: 11,
    fontWeight: '700',
    color: '#71717A',
  },
  themeModeTextSelected: {
    color: '#FFFFFF',
  },
  themeModeTextDisabled: {
    color: '#52525B',
  },
  comingSoonPill: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: '#27272A',
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  comingSoonPillText: {
    fontFamily: fontFamilies.bold,
    fontSize: 8,
    color: '#A1A1AA',
  },
  googleProviderPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#1C1C22',
    borderWidth: 1,
    borderColor: '#2D2D35',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  googleProviderPillText: {
    fontFamily: fontFamilies.bold,
    fontSize: 12,
    color: '#FFFFFF',
  },
  appleProviderPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#1C1C22',
    borderWidth: 1,
    borderColor: '#2D2D35',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  appleProviderPillText: {
    fontFamily: fontFamilies.bold,
    fontSize: 12,
    color: '#FFFFFF',
  },
  emailProviderPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(254, 91, 1, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(254, 91, 1, 0.3)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  emailProviderPillText: {
    fontFamily: fontFamilies.bold,
    fontSize: 12,
    color: '#FE5B01',
  },
  unitsSegmentedContainer: {
    flexDirection: 'row',
    backgroundColor: '#18181D',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#27272A',
    padding: 3,
  },
  unitSegmentBtn: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
  },
  unitSegmentBtnActive: {
    backgroundColor: '#FE5B01',
  },
  unitSegmentText: {
    fontFamily: fontFamilies.bold,
    fontSize: 11,
    color: '#71717A',
  },
  unitSegmentTextActive: {
    color: '#FFFFFF',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    backgroundColor: '#141418',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#27272A',
    padding: 20,
    gap: 14,
  },
  modalTitle: {
    fontFamily: fontFamilies.bold,
    fontSize: 18,
    color: '#FFFFFF',
  },
  modalSubtitleText: {
    fontFamily: fontFamilies.regular,
    fontSize: 13,
    color: '#A1A1AA',
  },
  passwordInputWrap: {
    justifyContent: 'center',
  },
  passwordInput: {
    paddingRight: 44,
  },
  passwordEyeBtn: {
    position: 'absolute',
    right: 12,
    padding: 2,
  },
  modalInput: {
    backgroundColor: '#1E1E24',
    borderWidth: 1,
    borderColor: '#3F3F46',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#FFFFFF',
    fontFamily: fontFamilies.regular,
    fontSize: 14,
  },
  modalActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 6,
  },
  modalBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  passwordErrorText: {
    fontFamily: fontFamilies.medium,
    fontSize: 12.5,
    color: '#F87171',
    marginTop: -2,
    marginBottom: 8,
  },
  forgotPasswordLink: {
    alignSelf: 'flex-end',
    marginBottom: 12,
  },
  forgotPasswordText: {
    fontFamily: fontFamilies.semiBold,
    fontSize: 13,
    color: '#FE5B01',
  },
  cancelBtn: {
    backgroundColor: '#27272A',
  },
  cancelBtnText: {
    fontFamily: fontFamilies.bold,
    fontSize: 13,
    color: '#A1A1AA',
  },
  saveBtn: {
    backgroundColor: '#FFFFFF',
    minWidth: 70,
  },
  saveBtnText: {
    fontFamily: fontFamilies.bold,
    fontSize: 13,
    color: '#0D0F12',
  },
});
