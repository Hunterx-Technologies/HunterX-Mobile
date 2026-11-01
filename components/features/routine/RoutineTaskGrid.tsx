import { memo, useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';

import { DEFAULT_BLURHASH, optimizeCloudinaryUrl } from '@/services/media/cloudinary';
import { colors } from '@/theme/colors';
import { fontFamilies } from '@/theme/typography';
import type { RoutineTask } from '@/types/task';

const COLUMNS = 2;
const GAP = 12;
// Card height as a share of its width (the art is landscape-ish).
const CARD_ASPECT = 0.62;

function imageFor(task: RoutineTask, gender?: string): string | null {
  if (gender === 'female') return task.image_url_female ?? task.image_url;
  if (gender) return task.image_url_male ?? task.image_url;
  return task.image_url;
}

type Props = {
  tasks: RoutineTask[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  /** Onboarding: the gender picked earlier, to match the art. Signed in: omit. */
  gender?: 'male' | 'female' | 'other';
};

/**
 * Routine tasks as image cards (title along the bottom) with a checkbox,
 * two per row. Card size
 * follows the width it's given, so it fits phones and tablets alike.
 */
export function RoutineTaskGrid({ tasks, selectedIds, onToggle, gender }: Props) {
  const [width, setWidth] = useState(0);
  const cardWidth = width > 0 ? (width - GAP * (COLUMNS - 1)) / COLUMNS : 0;

  const handleLayout = (event: LayoutChangeEvent) => {
    const next = Math.floor(event.nativeEvent.layout.width);
    if (next !== width) setWidth(next);
  };

  return (
    <View style={styles.grid} onLayout={handleLayout}>
      {cardWidth > 0 &&
        tasks.map((task) => (
          <RoutineTaskCard
            key={task.id}
            task={task}
            imageUrl={imageFor(task, gender)}
            selected={selectedIds.includes(task.id)}
            onToggle={onToggle}
            width={cardWidth}
          />
        ))}
    </View>
  );
}

const RoutineTaskCard = memo(function RoutineTaskCard({
  task,
  imageUrl,
  selected,
  onToggle,
  width,
}: {
  task: RoutineTask;
  imageUrl: string | null;
  selected: boolean;
  onToggle: (id: string) => void;
  width: number;
}) {
  return (
    <Pressable
      onPress={() => onToggle(task.id)}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={task.title}
      style={({ pressed }) => [
        styles.card,
        { width, height: Math.round(width * CARD_ASPECT) },
        selected && styles.cardSelected,
        pressed && styles.cardPressed,
      ]}
    >
      {imageUrl ? (
        <Image
          source={{ uri: optimizeCloudinaryUrl(imageUrl, 600) }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          cachePolicy="memory-disk"
          placeholder={{ blurhash: DEFAULT_BLURHASH }}
          transition={150}
        />
      ) : null}
      {/* Darkest at the bottom, behind the title. */}
      <LinearGradient
        colors={selected ? ['rgba(0,0,0,0.1)', 'rgba(0,0,0,0.75)'] : ['rgba(0,0,0,0.35)', 'rgba(0,0,0,0.85)']}
        style={StyleSheet.absoluteFill}
      />

      <View style={[styles.checkbox, selected && styles.checkboxSelected]}>
        {selected ? <Ionicons name="checkmark" size={16} color="#000000" /> : null}
      </View>

      <View style={styles.cardContent}>
        <Text style={styles.cardTitle} numberOfLines={2}>
          {task.title}
        </Text>
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GAP,
  },
  card: {
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: '#141416',
  },
  cardSelected: {
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  cardPressed: {
    opacity: 0.85,
  },
  checkbox: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 24,
    height: 24,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.7)',
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  checkboxSelected: {
    borderColor: colors.accentGold,
    backgroundColor: colors.accentGold,
  },
  cardContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: 10,
    paddingBottom: 12,
  },
  cardTitle: {
    fontFamily: fontFamilies.bold,
    fontSize: 16,
    color: '#FFFFFF',
    textAlign: 'center',
  },
});
