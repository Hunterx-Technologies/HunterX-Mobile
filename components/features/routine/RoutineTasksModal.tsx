import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/common/Button';
import { Screen } from '@/components/common/Screen';
import { RoutineTaskGrid } from '@/components/features/routine/RoutineTaskGrid';
import { fetchMyRoutineTasks, saveMyRoutineTasks } from '@/services/api/tasks.service';
import { showGlobalToast } from '@/store/useToastStore';
import { colors } from '@/theme/colors';
import { fontFamilies } from '@/theme/typography';
import type { RoutineTask } from '@/types/task';

type Props = {
  visible: boolean;
  onClose: () => void;
  /** After a save, so Home can reload today's tasks. */
  onSaved: () => void;
};

const HEADER_HEIGHT = 56;

function sameSet(a: string[], b: string[]) {
  return a.length === b.length && a.every((id) => b.includes(id));
}

/**
 * Home > Shuffle: add or remove routine daily tasks (sleep, water, protein,
 * steps). Weekly and monthly quests aren't listed — they aren't optional.
 */
export function RoutineTasksModal({ visible, onClose, onSaved }: Props) {
  const [tasks, setTasks] = useState<RoutineTask[]>([]);
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [infoVisible, setInfoVisible] = useState(false);
  const insets = useSafeAreaInsets();

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const routine = await fetchMyRoutineTasks();
      const picked = routine.filter((t) => t.selected).map((t) => t.id);
      setTasks(routine);
      setSavedIds(picked);
      setSelectedIds(picked);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (visible) load();
    else setInfoVisible(false);
  }, [visible, load]);

  const handleToggle = useCallback((id: string) => {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    );
  }, []);

  const handleSave = async () => {
    if (selectedIds.length === 0 || saving) return;
    setSaving(true);
    try {
      await saveMyRoutineTasks(selectedIds);
      showGlobalToast('Daily routine updated', 'success');
      onSaved();
      onClose();
    } catch (err: any) {
      showGlobalToast(err?.message || "Couldn't update your routine", 'error');
    } finally {
      setSaving(false);
    }
  };

  const unchanged = sameSet(selectedIds, savedIds);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <Screen style={styles.screen}>
        <View style={styles.headerBar}>
          <TouchableOpacity style={styles.backBtn} onPress={onClose}>
            <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Daily Routine</Text>
          <Pressable
            style={styles.backBtn}
            onPress={() => setInfoVisible((v) => !v)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="How the daily routine works"
            accessibilityState={{ expanded: infoVisible }}
          >
            <Ionicons
              name={infoVisible ? 'information-circle' : 'information-circle-outline'}
              size={24}
              color="#FFFFFF"
            />
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          bounces={false}
          overScrollMode="never"
        >
          {loading ? (
            <View style={styles.stateBox}>
              <ActivityIndicator color={colors.accentGold} />
            </View>
          ) : loadError ? (
            <View style={styles.stateBox}>
              <Text style={styles.stateText}>Couldn&apos;t load your routine.</Text>
              <Pressable onPress={load} hitSlop={10}>
                <Text style={styles.retryText}>Try again</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <RoutineTaskGrid tasks={tasks} selectedIds={selectedIds} onToggle={handleToggle} />
              <Text style={styles.selectionHint}>
                {selectedIds.length === 0
                  ? 'Keep at least one routine task.'
                  : `${selectedIds.length} of ${tasks.length} selected`}
              </Text>
            </>
          )}
        </ScrollView>

        {infoVisible ? (
          // Tap anywhere to close.
          <Pressable
            // Absolute children ignore Screen's safe-area padding, so add it back.
            style={[styles.infoBackdrop, { top: insets.top + HEADER_HEIGHT }]}
            onPress={() => setInfoVisible(false)} accessibilityLabel="Close">
            <View style={styles.infoCard} accessibilityLiveRegion="polite">
              <Text style={styles.description}>
                Tick the routine tasks you want every day. New ones show up today; removed ones leave your list
                unless you&apos;ve already worked on them today. Weekly and monthly quests stay as they are.
              </Text>
            </View>
          </Pressable>
        ) : null}

        <View style={styles.bottomBar}>
          <Button
            label="ARISE"
            onPress={handleSave}
            loading={saving}
            disabled={loading || loadError || selectedIds.length === 0 || unchanged}
            variant="primary"
            style={styles.ctaButton}
            labelStyle={styles.ctaLabel}
          />
        </View>
      </Screen>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: '#0A0A0A',
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#242428',
    height: HEADER_HEIGHT,
  },
  backBtn: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: fontFamilies.bold,
    fontSize: 18,
    color: '#FFFFFF',
    textAlign: 'center',
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 20,
  },
  infoBackdrop: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10,
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  infoCard: {
    maxWidth: 320,
    backgroundColor: '#18181B',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#2A2A2E',
    padding: 14,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 12,
  },
  description: {
    fontFamily: fontFamilies.regular,
    fontSize: 14,
    lineHeight: 21,
    color: '#D4D4D8',
  },
  stateBox: {
    minHeight: 200,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  stateText: {
    fontFamily: fontFamilies.regular,
    fontSize: 14,
    color: '#A1A1AA',
    textAlign: 'center',
  },
  retryText: {
    fontFamily: fontFamilies.semiBold,
    fontSize: 14,
    color: colors.accentGold,
  },
  selectionHint: {
    fontFamily: fontFamilies.regular,
    fontSize: 12,
    color: '#71717A',
    textAlign: 'center',
    marginTop: 16,
  },
  bottomBar: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  ctaButton: {
    height: 56,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
  },
  ctaLabel: {
    fontFamily: fontFamilies.bold,
    fontSize: 14,
    letterSpacing: 2,
    color: '#000000',
  },
});
