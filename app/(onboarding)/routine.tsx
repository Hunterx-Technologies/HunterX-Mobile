import { useCallback, useEffect, useRef, useState } from 'react';
import { router } from 'expo-router';
import {
    ActivityIndicator,
    Animated,
    Easing,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { Button } from '@/components/common/Button';
import { Screen } from '@/components/common/Screen';
import { StepIndicator } from '@/components/common/StepIndicator';
import { RoutineTaskGrid } from '@/components/features/routine/RoutineTaskGrid';
import { fetchRoutineTaskOptions } from '@/services/api/tasks.service';
import { colors } from '@/theme/colors';
import { fontFamilies } from '@/theme/typography';
import { useOnboardingStore } from '@/store/useOnboardingStore';
import type { RoutineTask } from '@/types/task';

const TOTAL_STEPS = 9;
const CURRENT_STEP = 7; // eighth step (0-indexed)

export default function RoutineScreen() {
    const storeRoutineTaskIds = useOnboardingStore((s) => s.routineTaskIds);
    const setRoutineTaskIds = useOnboardingStore((s) => s.setRoutineTaskIds);
    const gender = useOnboardingStore((s) => s.gender);

    const [tasks, setTasks] = useState<RoutineTask[]>([]);
    const [selectedIds, setSelectedIds] = useState<string[]>(storeRoutineTaskIds);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState(false);

    // Animations
    const headerAnim = useRef(new Animated.Value(0)).current;
    const listAnim = useRef(new Animated.Value(0)).current;
    const buttonAnim = useRef(new Animated.Value(0)).current;

    const loadTasks = useCallback(async () => {
        setLoading(true);
        setLoadError(false);
        try {
            const options = await fetchRoutineTaskOptions();
            setTasks(options);
            // Drop picks that no longer exist (e.g. coming back after a task was retired).
            setSelectedIds((current) => current.filter((id) => options.some((t) => t.id === id)));
        } catch {
            setLoadError(true);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadTasks();
        Animated.stagger(150, [
            Animated.timing(headerAnim, {
                toValue: 1,
                duration: 700,
                easing: Easing.out(Easing.cubic),
                useNativeDriver: true,
            }),
            Animated.timing(listAnim, {
                toValue: 1,
                duration: 700,
                easing: Easing.out(Easing.cubic),
                useNativeDriver: true,
            }),
            Animated.timing(buttonAnim, {
                toValue: 1,
                duration: 700,
                easing: Easing.out(Easing.cubic),
                useNativeDriver: true,
            }),
        ]).start();
    }, [loadTasks, headerAnim, listAnim, buttonAnim]);

    const fadeSlideStyle = (anim: Animated.Value) => ({
        opacity: anim,
        transform: [
            {
                translateY: anim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [30, 0],
                }),
            },
        ],
    });

    const handleToggle = useCallback((id: string) => {
        setSelectedIds((current) =>
            current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
        );
    }, []);

    const handleContinue = () => {
        if (selectedIds.length === 0) return;
        setRoutineTaskIds(selectedIds);
        router.push('/(onboarding)/oath');
    };

    return (
        <Screen style={styles.screen}>
            {/* ─── Top Bar: Back + Step Indicator ─── */}
            <View style={styles.topBar}>
                <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backButton}>
                    <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
                </Pressable>
                <View style={styles.indicatorWrapper}>
                    <StepIndicator totalSteps={TOTAL_STEPS} currentStep={CURRENT_STEP} />
                </View>
                <View style={styles.backButton} />
            </View>

            {/* ─── Scrollable Content ─── */}
            <ScrollView
                bounces={false}
                overScrollMode="never"
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                <Animated.View style={fadeSlideStyle(headerAnim)}>
                    <Text style={styles.sectionLabel}>DAILY ROUTINE</Text>
                    <Text style={styles.title}>Pick the habits{'\n'}you want to build</Text>
                    <Text style={styles.description}>
                        These become your daily quests. Choose at least one — you can add or remove them later from Home.
                    </Text>
                </Animated.View>

                <Animated.View style={fadeSlideStyle(listAnim)}>
                    {loading ? (
                        <View style={styles.stateBox}>
                            <ActivityIndicator color={colors.accentGold} />
                        </View>
                    ) : loadError ? (
                        <View style={styles.stateBox}>
                            <Text style={styles.stateText}>Couldn&apos;t load the routine tasks.</Text>
                            <Pressable onPress={loadTasks} hitSlop={10}>
                                <Text style={styles.retryText}>Try again</Text>
                            </Pressable>
                        </View>
                    ) : (
                        <>
                            <RoutineTaskGrid
                                tasks={tasks}
                                selectedIds={selectedIds}
                                onToggle={handleToggle}
                                gender={gender}
                            />
                            <Text style={styles.selectionHint}>
                                {selectedIds.length === 0
                                    ? 'Tap a card to add it to your routine.'
                                    : `${selectedIds.length} of ${tasks.length} selected`}
                            </Text>
                        </>
                    )}
                </Animated.View>
            </ScrollView>

            {/* ─── Bottom CTA ─── */}
            <Animated.View style={[styles.bottomBar, fadeSlideStyle(buttonAnim)]}>
                <Button
                    label="LOCK IN MY ROUTINE"
                    onPress={handleContinue}
                    variant="primary"
                    disabled={selectedIds.length === 0}
                    style={styles.ctaButton}
                    labelStyle={styles.ctaLabel}
                />
            </Animated.View>
        </Screen>
    );
}

const styles = StyleSheet.create({
    screen: {
        backgroundColor: '#0A0A0A',
    },

    /* ─── Top Bar ─── */
    topBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingTop: 8,
        paddingBottom: 16,
    },
    backButton: {
        width: 38,
        height: 38,
        alignItems: 'center',
        justifyContent: 'center',
    },
    indicatorWrapper: {
        flex: 1,
        alignItems: 'center',
    },

    /* ─── Scroll Content ─── */
    scrollContent: {
        flexGrow: 1,
        paddingHorizontal: 24,
        paddingTop: 16,
        paddingBottom: 24,
    },
    sectionLabel: {
        fontFamily: fontFamilies.semiBold,
        fontSize: 11,
        letterSpacing: 3,
        color: colors.accentGold,
        marginBottom: 12,
        textTransform: 'uppercase',
    },
    title: {
        fontFamily: fontFamilies.bold,
        fontSize: 28,
        lineHeight: 36,
        color: '#FFFFFF',
        marginBottom: 16,
    },
    description: {
        fontFamily: fontFamilies.regular,
        fontSize: 14,
        lineHeight: 21,
        color: '#8E8E93',
        marginBottom: 32,
    },

    /* ─── States ─── */
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

    /* ─── Bottom CTA ─── */
    bottomBar: {
        paddingHorizontal: 24,
        paddingBottom: Platform.OS === 'ios' ? 8 : 20,
        paddingTop: 12,
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
