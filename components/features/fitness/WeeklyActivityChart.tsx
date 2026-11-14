import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { fontFamilies } from '@/theme/typography';

export interface DayBarData {
  day: string;
  label: string;
  value: number; // 0 to 100 percentage
  steps?: number;
  isCurrent?: boolean;
  /** YYYY-MM-DD, for daily bars: the day number shows under the label. */
  date?: string;
}

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** "2026-11-15" → { dayOfMonth: "15", long: "15 Nov" }; null when absent or malformed. */
function parseBarDate(date?: string): { dayOfMonth: string; long: string } | null {
  const m = date ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(date) : null;
  if (!m) return null;
  const day = parseInt(m[3], 10);
  return { dayOfMonth: `${day}`, long: `${day} ${MONTHS_SHORT[parseInt(m[2], 10) - 1]}` };
}

interface WeeklyActivityChartProps {
  avgSteps?: string;
  days?: DayBarData[];
  /** Card title, e.g. "Weekly Activity" / "Monthly Activity" / "Yearly Activity". */
  title?: string;
  /** Which period the bars cover — picks the empty-state wording. */
  period?: 'week' | 'month' | 'year';
  /** False while the period is still being read: shows a loader instead of an empty state. */
  loaded?: boolean;
  /** First day of the period and first day with steps (YYYY-MM-DD) — "Recorded since 13 Nov". */
  periodStart?: string;
  firstDataDate?: string | null;
  /** "Apple Health" / "Health Connect", for the empty-state hint. */
  healthAppName?: string;
}

/** Empty-state copy per period. */
function emptyCopy(period: 'week' | 'month' | 'year', now: Date, healthAppName: string) {
  const check = `Been moving? Make sure HunterX can read Steps in ${healthAppName}.`;
  if (period === 'month') {
    return {
      title: `No steps in ${MONTHS_LONG[now.getMonth()]} yet`,
      body: `Each week of the month fills in as your phone or watch records steps. ${check}`,
    };
  }
  if (period === 'year') {
    return {
      title: `No steps in ${now.getFullYear()} yet`,
      body: `Each month fills in as your phone or watch records steps. ${check}`,
    };
  }
  return {
    title: 'No steps this week yet',
    body: `Your week started on Sunday. Steps from your phone or watch show up here day by day. ${check}`,
  };
}

/** 245000 → "245k", 1200000 → "1.2M": fits the narrow bars of the 12-month chart. */
function compactSteps(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1).replace(/\.0$/, '')}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 100_000 ? 0 : 1).replace(/\.0$/, '')}k`;
  return `${n}`;
}

// Shown only if no bars were passed: an empty week, never made-up numbers.
const EMPTY_WEEK: DayBarData[] = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => ({
  day: d,
  label: d,
  value: 0,
  steps: 0,
}));

export function WeeklyActivityChart({
  avgSteps,
  days,
  title = 'Weekly Activity',
  period = 'week',
  loaded = true,
  periodStart,
  firstDataDate,
  healthAppName = 'your health app',
}: WeeklyActivityChartProps) {
  const chartDays = days && days.length > 0 ? days : EMPTY_WEEK;
  const hasAnySteps = chartDays.some((d) => (d.steps || 0) > 0);
  const state: 'loading' | 'empty' | 'data' = !loaded ? 'loading' : hasAnySteps ? 'data' : 'empty';
  // Data starts partway through the period (e.g. steps only from 13 Nov this year).
  const recordedSince =
    state === 'data' && firstDataDate && periodStart && firstDataDate > periodStart ? parseBarDate(firstDataDate)?.long : null;

  // Default selected day is today / current day or last day in array
  const currentDayObj = chartDays.find((d) => d.isCurrent) || chartDays[chartDays.length - 1];
  const [selectedDay, setSelectedDay] = useState<string>(currentDayObj?.day || 'Sun');
  // A different period (Week → Year) has different bars: select its current one.
  const barsKey = chartDays.map((d) => d.day).join('|');
  React.useEffect(() => {
    setSelectedDay(currentDayObj?.day || chartDays[chartDays.length - 1]?.day || '');
    // Only when the set of bars changes, not on every refresh of their values.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [barsKey]);
  const compact = chartDays.length > 7;

  const trackHeight = 84;

  // Calculate average steps if not passed explicitly
  const computedAvgSteps = React.useMemo(() => {
    if (avgSteps) return avgSteps;
    const total = chartDays.reduce((acc, curr) => acc + (curr.steps || 0), 0);
    const avg = Math.round(total / (chartDays.length || 7));
    return avg.toLocaleString('en-US');
  }, [avgSteps, chartDays]);

  const handleBarPress = (dayName: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedDay(dayName);
  };

  const selectedDayItem = chartDays.find((d) => d.day === selectedDay) || chartDays[0];

  return (
    <View style={styles.cardWrapper}>
      <LinearGradient
        colors={['#16171E', '#101117', '#0C0D12']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.cardGradient}
      >
        {/* Header: Title on Left, Avg Steps on Right */}
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.headerTitle}>{title}</Text>
            <Text style={[styles.headerSubtitle, state !== 'data' && styles.headerSubtitleMuted]}>
              {state === 'loading'
                ? 'Reading your activity…'
                : state === 'empty'
                  ? 'Daily step breakdown'
                  : selectedDayItem
                    ? `${selectedDayItem.label || selectedDayItem.day}${parseBarDate(selectedDayItem.date) ? `, ${parseBarDate(selectedDayItem.date)!.long}` : ''}: ${(selectedDayItem.steps || 0).toLocaleString()} steps`
                    : 'Daily step breakdown'}
            </Text>
          </View>
          <View style={styles.avgContainer}>
            <Text style={styles.avgValue}>{state === 'data' ? computedAvgSteps : '–'}</Text>
            <Text style={styles.avgLabel}>avg. steps</Text>
          </View>
        </View>

        {state === 'loading' ? (
          <View style={styles.stateBlock}>
            <ActivityIndicator color="#FE5B01" />
          </View>
        ) : state === 'empty' ? (
          <View style={styles.stateBlock}>
            <View style={styles.emptyIcon}>
              <Ionicons name="footsteps-outline" size={22} color="#FE5B01" />
            </View>
            <Text style={styles.emptyTitle}>{emptyCopy(period, new Date(), healthAppName).title}</Text>
            <Text style={styles.emptyBody}>{emptyCopy(period, new Date(), healthAppName).body}</Text>
          </View>
        ) : (
        <>
        {recordedSince ? <Text style={styles.recordedSince}>Recorded since {recordedSince}</Text> : null}

        {/* 7 Vertical Capsule Bars Container */}
        <View style={styles.chartArea}>
          {/* Horizontal Grid lines */}
          <View style={styles.gridLinesContainer} pointerEvents="none">
            <View style={styles.gridLine} />
            <View style={styles.gridLine} />
            <View style={styles.gridLine} />
          </View>

          <View style={styles.barsContainer}>
            {chartDays.map((item) => {
              const isSelected = item.day === selectedDay;
              const isToday = !!item.isCurrent;
              const hasData = (item.steps || 0) > 0;
              const fillPct = Math.min(Math.max(item.value, 0), 100);
              const fillHeight = fillPct > 0 ? Math.max(Math.round((fillPct / 100) * trackHeight), 10) : 4;
              const stepCountStr = compact ? compactSteps(item.steps || 0) : (item.steps || 0).toLocaleString();

              return (
                <TouchableOpacity
                  key={item.day}
                  style={styles.barColumn}
                  onPress={() => handleBarPress(item.day)}
                  activeOpacity={0.8}
                >
                  {/* Capsule Track */}
                  <View style={[styles.capsuleTrack, { height: trackHeight }]}>
                    <LinearGradient
                      colors={
                        hasData || isSelected || isToday
                          ? ['#FE5B01', '#FF3B30', '#D82618']
                          : ['#3A3F50', '#282C38', '#1F222C']
                      }
                      start={{ x: 0, y: 0 }}
                      end={{ x: 0, y: 1 }}
                      style={[
                        styles.capsuleFill,
                        { height: fillHeight },
                        isSelected && styles.activeFillGlow,
                      ]}
                    />
                  </View>

                  {/* Day Label */}
                  <Text
                    style={[
                      styles.dayLabel,
                      isSelected && styles.activeDayLabel,
                      isToday && !isSelected && styles.todayDayLabel,
                    ]}
                  >
                    {item.label || item.day}
                  </Text>
                  {parseBarDate(item.date) ? (
                    <Text
                      style={[
                        styles.dateLabel,
                        isSelected && styles.activeDayLabel,
                        isToday && !isSelected && styles.todayDayLabel,
                      ]}
                    >
                      {parseBarDate(item.date)!.dayOfMonth}
                    </Text>
                  ) : null}

                  {/* Reserved Fixed-Height Step Count Badge Below */}
                  <View style={styles.badgeSlot}>
                    {isSelected ? (
                      <View style={styles.stepBadge}>
                        <Text style={styles.stepBadgeText}>{stepCountStr}</Text>
                      </View>
                    ) : null}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
        </>
        )}
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  cardWrapper: {
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 1.2,
    borderColor: '#222530',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 3,
    marginBottom: 24,
  },
  cardGradient: {
    paddingTop: 20,
    paddingBottom: 16,
    paddingHorizontal: 18,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 22,
  },
  headerTitle: {
    fontFamily: fontFamilies.bold,
    fontSize: 18,
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontFamily: fontFamilies.medium,
    fontSize: 12,
    color: '#FE5B01',
    marginTop: 2,
  },
  headerSubtitleMuted: {
    color: '#8A8F9E',
  },
  stateBlock: {
    minHeight: 150,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingBottom: 6,
  },
  emptyIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(254, 91, 1, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyTitle: {
    fontFamily: fontFamilies.bold,
    fontSize: 15,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  emptyBody: {
    fontFamily: fontFamilies.regular,
    fontSize: 12.5,
    lineHeight: 18,
    color: '#8A8F9E',
    textAlign: 'center',
    marginTop: 6,
  },
  recordedSince: {
    fontFamily: fontFamilies.medium,
    fontSize: 11.5,
    color: '#8A8F9E',
    marginTop: -12,
    marginBottom: 12,
  },
  avgContainer: {
    alignItems: 'flex-end',
  },
  avgValue: {
    fontFamily: fontFamilies.bold,
    fontSize: 22,
    color: '#FFFFFF',
    letterSpacing: -0.5,
    lineHeight: 24,
  },
  avgLabel: {
    fontFamily: fontFamilies.regular,
    fontSize: 12,
    color: '#8A8F9E',
    marginTop: 2,
  },
  chartArea: {
    position: 'relative',
    paddingTop: 8,
  },
  gridLinesContainer: {
    position: 'absolute',
    top: 8,
    left: 0,
    right: 0,
    height: 84,
    justifyContent: 'space-between',
  },
  gridLine: {
    height: 1,
    backgroundColor: '#1E222D',
  },
  barsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  barColumn: {
    alignItems: 'center',
    flex: 1,
  },
  capsuleTrack: {
    width: 16,
    backgroundColor: '#14161F',
    borderRadius: 8,
    justifyContent: 'flex-end',
    overflow: 'hidden',
    marginBottom: 10,
  },
  capsuleFill: {
    width: '100%',
    borderRadius: 8,
  },
  activeFillGlow: {
    shadowColor: '#FE5B01',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
  },
  dayLabel: {
    fontFamily: fontFamilies.medium,
    fontSize: 12,
    color: '#71788E',
    marginBottom: 4,
  },
  dateLabel: {
    fontFamily: fontFamilies.medium,
    fontSize: 11,
    color: '#71788E',
    marginTop: -2,
    marginBottom: 4,
  },
  activeDayLabel: {
    fontFamily: fontFamilies.bold,
    color: '#FFFFFF',
  },
  todayDayLabel: {
    color: '#FE5B01',
  },
  badgeSlot: {
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepBadge: {
    backgroundColor: '#272B38',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#3D4356',
  },
  stepBadgeText: {
    fontFamily: fontFamilies.bold,
    fontSize: 10,
    color: '#FE5B01',
  },
});
