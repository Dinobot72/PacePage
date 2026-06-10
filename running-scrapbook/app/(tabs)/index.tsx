// app/(tabs)/index.tsx
import { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  RefreshControl,
  TouchableOpacity,
  Alert,
  StatusBar,
  Dimensions,
  Animated,
  ScrollView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: SCREEN_W } = Dimensions.get('window');
const GRID_COL = (SCREEN_W - 20 * 2 - 8) / 2; // 2 cols with padding+gap

const C = {
  cream:   '#F5F0E8',
  ink:     '#2C2416',
  tan:     '#EDE5D4',
  muted:   '#9C8F7A',
  divider: '#F0E8D8',
  white:   '#FFFFFF',
  accent:  '#C4763A',
};

interface Run {
  id: string;
  date: string;
  imageUri: string;
  distance: number;
  totalSeconds: number;
  paceSeconds: number;
  notes?: string;
  label?: string; // 'before' | 'after' | undefined
}

function formatPace(s: number) {
  if (!s) return '—';
  return `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;
}
function formatDuration(s: number) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.round(s % 60);
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
    : `${m}:${String(sec).padStart(2, '0')}`;
}
function formatDateShort(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: 'short', month: 'short', day: 'numeric',
  });
}
function formatMonth(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'long', year: 'numeric',
  });
}
function calcStreak(runs: Run[]): number {
  if (!runs.length) return 0;
  const days = [...new Set(runs.map(r => new Date(r.date).toDateString()))];
  let streak = 1;
  for (let i = 1; i < days.length; i++) {
    const diff = (new Date(days[i - 1]).getTime() - new Date(days[i]).getTime()) / 86400000;
    if (diff === 1) streak++;
    else break;
  }
  return streak;
}
function bestPace(runs: Run[]): Run | null {
  if (!runs.length) return null;
  return runs.reduce((best, r) =>
    r.paceSeconds > 0 && r.paceSeconds < (best?.paceSeconds ?? Infinity) ? r : best,
    null as Run | null,
  );
}
function longestRun(runs: Run[]): Run | null {
  if (!runs.length) return null;
  return runs.reduce((best, r) => (r.distance > (best?.distance ?? 0) ? r : best), null as Run | null);
}

// Group runs by month
function groupByMonth(runs: Run[]): { month: string; data: Run[] }[] {
  const map = new Map<string, Run[]>();
  for (const r of runs) {
    const key = formatMonth(r.date);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(r);
  }
  return Array.from(map.entries()).map(([month, data]) => ({ month, data }));
}

type ViewMode = 'list' | 'grid' | 'timeline';

export default function ScrapbookScreen() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const loadRuns = useCallback(async () => {
    try {
      const json = await AsyncStorage.getItem('@runs');
      setRuns(json ? JSON.parse(json) : []);
    } catch (e) { console.warn(e); }
  }, []);

  useFocusEffect(useCallback(() => { loadRuns(); }, [loadRuns]));

  const onRefresh = async () => {
    setRefreshing(true);
    await loadRuns();
    setRefreshing(false);
  };

  const switchView = (mode: ViewMode) => {
    Animated.sequence([
      Animated.timing(fadeAnim, { toValue: 0, duration: 120, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 180, useNativeDriver: true }),
    ]).start();
    setViewMode(mode);
  };

  const deleteRun = (id: string) => {
    Alert.alert('Remove run', 'Delete this entry from your scrapbook?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          const updated = runs.filter(r => r.id !== id);
          setRuns(updated);
          await AsyncStorage.setItem('@runs', JSON.stringify(updated));
        },
      },
    ]);
  };

  const openDetail = (run: Run) => {
    router.push({ pathname: '/run-detail' as any, params: { id: run.id } });
  };

  const totalMiles = runs.reduce((s, r) => s + (r.distance || 0), 0);
  const avgPace = runs.length ? runs.reduce((s, r) => s + r.paceSeconds, 0) / runs.length : 0;
  const streak = calcStreak(runs);
  const pr = bestPace(runs);
  const longest = longestRun(runs);

  // ── Header ────────────────────────────────────────────────────────────────
  const Header = (
    <View style={[s.header, { paddingTop: insets.top + 12 }]}>
      {/* Brand */}
      <View style={s.brandRow}>
        <View>
          <Text style={s.brandEyebrow}>MY</Text>
          <Text style={s.brandTitle}>Stride</Text>
        </View>
        {streak > 0 && (
          <View style={s.streakPill}>
            <Text style={s.streakText}>🔥 {streak} day streak</Text>
          </View>
        )}
      </View>

      {/* Stats row */}
      {runs.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.statsScroll}
          contentContainerStyle={s.statsContainer}>
          <View style={s.statChip}>
            <Text style={s.statVal}>{totalMiles.toFixed(1)}</Text>
            <Text style={s.statLbl}>TOTAL MI</Text>
          </View>
          <View style={s.statChip}>
            <Text style={s.statVal}>{runs.length}</Text>
            <Text style={s.statLbl}>RUNS</Text>
          </View>
          <View style={s.statChip}>
            <Text style={s.statVal}>{avgPace > 0 ? formatPace(avgPace) : '—'}</Text>
            <Text style={s.statLbl}>AVG PACE</Text>
          </View>
          {longest && (
            <View style={[s.statChip, { marginRight: 0 }]}>
              <Text style={s.statVal}>{longest.distance} mi</Text>
              <Text style={s.statLbl}>LONGEST</Text>
            </View>
          )}
        </ScrollView>
      )}

      {/* PR banner */}
      {pr && (
        <View style={s.prBanner}>
          <View>
            <Text style={s.prLabel}>BEST PACE</Text>
            <Text style={s.prVal}>
              {formatPace(pr.paceSeconds)}
              <Text style={s.prUnit}> /mi</Text>
            </Text>
            <Text style={s.prDate}>{formatDateShort(pr.date)}</Text>
          </View>
          <Text style={s.prMedal}>🏅</Text>
        </View>
      )}

      {/* View mode toggle */}
      {runs.length > 0 && (
        <View style={s.viewToggle}>
          {(['list', 'grid', 'timeline'] as ViewMode[]).map((mode) => (
            <TouchableOpacity
              key={mode}
              style={[s.toggleBtn, viewMode === mode && s.toggleBtnActive]}
              onPress={() => switchView(mode)}
              activeOpacity={0.7}
            >
              <Ionicons
                name={mode === 'list' ? 'list-outline' : mode === 'grid' ? 'grid-outline' : 'time-outline'}
                size={16}
                color={viewMode === mode ? C.cream : C.muted}
              />
            </TouchableOpacity>
          ))}
        </View>
      )}

      {runs.length > 0 && (
        <Text style={s.sectionLabel}>
          {viewMode === 'timeline' ? 'TIMELINE' : 'RECENT RUNS'}
        </Text>
      )}
    </View>
  );

  // ── Empty state ───────────────────────────────────────────────────────────
  if (runs.length === 0) {
    return (
      <View style={[s.root, { paddingTop: insets.top }]}>
        <StatusBar barStyle="dark-content" backgroundColor={C.cream} />
        {Header}
        <View style={s.emptyWrap}>
          <Text style={s.emptyEmoji}>👟</Text>
          <Text style={s.emptyTitle}>Your scrapbook awaits</Text>
          <Text style={s.emptyBody}>
            Tap <Text style={{ fontWeight: '700' }}>LOG RUN</Text> to add your first run,
            snap a photo, and start filling these pages.
          </Text>
          <View style={s.emptyHints}>
            <Text style={s.emptyHint}>📸  Photo before or after</Text>
            <Text style={s.emptyHint}>📏  Distance & pace tracking</Text>
            <Text style={s.emptyHint}>📓  Notes & reflections</Text>
            <Text style={s.emptyHint}>🏅  Personal records</Text>
          </View>
        </View>
      </View>
    );
  }

  // ── List view ─────────────────────────────────────────────────────────────
  if (viewMode === 'list') {
    return (
      <View style={s.root}>
        <StatusBar barStyle="dark-content" backgroundColor={C.cream} />
        <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
          <FlatList
            data={runs}
            keyExtractor={r => r.id}
            contentContainerStyle={[s.listContent, { paddingBottom: insets.bottom + 24 }]}
            ListHeaderComponent={Header}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[C.ink]} />}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={s.card}
                onPress={() => openDetail(item)}
                onLongPress={() => deleteRun(item.id)}
                activeOpacity={0.93}
              >
                <Image source={{ uri: item.imageUri }} style={s.cardPhoto} resizeMode="cover" />
                {item.label && (
                  <View style={s.labelBadge}>
                    <Text style={s.labelBadgeText}>{item.label.toUpperCase()}</Text>
                  </View>
                )}
                <View style={s.dateBadge}>
                  <Text style={s.dateBadgeText}>{formatDateShort(item.date)}</Text>
                </View>
                <View style={s.cardBody}>
                  {item.notes ? <Text style={s.notes}>"{item.notes}"</Text> : null}
                  <View style={s.cardStats}>
                    <View style={s.cardStat}>
                      <Text style={s.cardStatVal}>{item.distance}</Text>
                      <Text style={s.cardStatLbl}>MI</Text>
                    </View>
                    <View style={[s.cardStat, s.cardStatBorder]}>
                      <Text style={s.cardStatVal}>{formatPace(item.paceSeconds)}</Text>
                      <Text style={s.cardStatLbl}>PACE</Text>
                    </View>
                    <View style={[s.cardStat, s.cardStatBorder]}>
                      <Text style={s.cardStatVal}>{formatDuration(item.totalSeconds)}</Text>
                      <Text style={s.cardStatLbl}>TIME</Text>
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            )}
          />
        </Animated.View>
      </View>
    );
  }

  // ── Grid view ─────────────────────────────────────────────────────────────
  if (viewMode === 'grid') {
    // Pair up runs for 2-col masonry effect
    const pairs: [Run, Run | null][] = [];
    for (let i = 0; i < runs.length; i += 2) {
      pairs.push([runs[i], runs[i + 1] ?? null]);
    }
    return (
      <View style={s.root}>
        <StatusBar barStyle="dark-content" backgroundColor={C.cream} />
        <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
          <FlatList
            data={pairs}
            keyExtractor={(_, i) => `pair-${i}`}
            contentContainerStyle={[s.listContent, { paddingBottom: insets.bottom + 24 }]}
            ListHeaderComponent={Header}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[C.ink]} />}
            renderItem={({ item: [left, right], index }) => (
              <View style={s.gridRow}>
                <GridCell
                  run={left}
                  height={index % 3 === 0 ? 200 : 160}
                  onPress={openDetail}
                  onLongPress={deleteRun}
                />
                {right ? (
                  <GridCell
                    run={right}
                    height={index % 3 === 0 ? 160 : 200}
                    onPress={openDetail}
                    onLongPress={deleteRun}
                  />
                ) : (
                  <View style={{ flex: 1 }} />
                )}
              </View>
            )}
          />
        </Animated.View>
      </View>
    );
  }

  // ── Timeline view ─────────────────────────────────────────────────────────
  const grouped = groupByMonth(runs);
  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" backgroundColor={C.cream} />
      <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
        <FlatList
          data={grouped}
          keyExtractor={g => g.month}
          contentContainerStyle={[s.listContent, { paddingBottom: insets.bottom + 24 }]}
          ListHeaderComponent={Header}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[C.ink]} />}
          renderItem={({ item: group }) => (
            <View>
              {/* Month header */}
              <View style={s.monthHeader}>
                <Text style={s.monthTitle}>{group.month}</Text>
                <View style={s.monthLine} />
                <Text style={s.monthCount}>{group.data.length} run{group.data.length !== 1 ? 's' : ''}</Text>
              </View>

              {/* Runs in this month */}
              {group.data.map((item, i) => (
                <View key={item.id} style={s.timelineRow}>
                  {/* Timeline spine */}
                  <View style={s.timelineSpine}>
                    <View style={s.timelineDot} />
                    {i < group.data.length - 1 && <View style={s.timelineLine} />}
                  </View>

                  {/* Card */}
                  <TouchableOpacity
                    style={s.timelineCard}
                    onPress={() => openDetail(item)}
                    onLongPress={() => deleteRun(item.id)}
                    activeOpacity={0.93}
                  >
                    <Image source={{ uri: item.imageUri }} style={s.timelinePhoto} resizeMode="cover" />
                    <View style={s.timelineBody}>
                      <Text style={s.timelineDate}>{formatDateShort(item.date)}</Text>
                      <View style={s.timelineStatsRow}>
                        <Text style={s.timelineStat}>{item.distance} mi</Text>
                        <Text style={s.timelineStatSep}>·</Text>
                        <Text style={s.timelineStat}>{formatPace(item.paceSeconds)}/mi</Text>
                        <Text style={s.timelineStatSep}>·</Text>
                        <Text style={s.timelineStat}>{formatDuration(item.totalSeconds)}</Text>
                      </View>
                      {item.notes ? (
                        <Text style={s.timelineNotes} numberOfLines={2}>"{item.notes}"</Text>
                      ) : null}
                    </View>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        />
      </Animated.View>
    </View>
  );
}

// ── Grid Cell ─────────────────────────────────────────────────────────────────
function GridCell({
  run, height, onPress, onLongPress,
}: {
  run: Run;
  height: number;
  onPress: (r: Run) => void;
  onLongPress: (id: string) => void;
}) {
  return (
    <TouchableOpacity
      style={[s.gridCell, { height }]}
      onPress={() => onPress(run)}
      onLongPress={() => onLongPress(run.id)}
      activeOpacity={0.9}
    >
      <Image source={{ uri: run.imageUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      <View style={s.gridOverlay}>
        <Text style={s.gridDist}>{run.distance} mi</Text>
        <Text style={s.gridDate}>{formatDateShort(run.date)}</Text>
      </View>
    </TouchableOpacity>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.cream },
  listContent: { paddingBottom: 32 },

  header: {
    backgroundColor: C.cream,
    paddingBottom: 4,
  },

  brandRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-end', paddingHorizontal: 20, paddingBottom: 14,
  },
  brandEyebrow: { fontSize: 11, letterSpacing: 3, color: C.muted, fontWeight: '500' },
  brandTitle: { fontSize: 38, fontWeight: '800', color: C.ink, letterSpacing: -1, lineHeight: 40 },

  streakPill: {
    backgroundColor: C.ink, borderRadius: 100,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  streakText: { fontSize: 12, color: C.cream, fontWeight: '500' },

  statsScroll: { marginBottom: 14 },
  statsContainer: { paddingHorizontal: 20, flexDirection: 'row' },
  statChip: {
    backgroundColor: C.tan, borderRadius: 12,
    paddingVertical: 10, paddingHorizontal: 16,
    alignItems: 'center', marginRight: 8,
  },
  statVal: { fontSize: 20, fontWeight: '800', color: C.ink },
  statLbl: { fontSize: 9, letterSpacing: 1, color: C.muted, marginTop: 2, fontWeight: '500' },

  prBanner: {
    marginHorizontal: 20, marginBottom: 16, backgroundColor: C.ink,
    borderRadius: 16, padding: 16,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  prLabel: { fontSize: 9, letterSpacing: 2, color: C.muted, fontWeight: '500', marginBottom: 4 },
  prVal: { fontSize: 28, fontWeight: '800', color: C.cream },
  prUnit: { fontSize: 16, fontWeight: '400', color: C.muted },
  prDate: { fontSize: 12, color: C.muted, marginTop: 2 },
  prMedal: { fontSize: 32 },

  viewToggle: {
    flexDirection: 'row', paddingHorizontal: 20,
    marginBottom: 14, gap: 8,
  },
  toggleBtn: {
    width: 38, height: 38, borderRadius: 10,
    backgroundColor: C.tan,
    justifyContent: 'center', alignItems: 'center',
  },
  toggleBtnActive: {
    backgroundColor: C.ink,
  },

  sectionLabel: {
    fontSize: 10, letterSpacing: 2, color: C.muted,
    fontWeight: '500', paddingHorizontal: 20, marginBottom: 12,
  },

  // List cards
  card: {
    marginHorizontal: 20, marginBottom: 16,
    backgroundColor: C.white, borderRadius: 20,
    overflow: 'hidden', elevation: 2,
    shadowColor: C.ink, shadowOpacity: 0.08,
    shadowRadius: 8, shadowOffset: { width: 0, height: 2 },
  },
  cardPhoto: { width: '100%', height: 220 },
  dateBadge: {
    position: 'absolute', top: 14, right: 14,
    backgroundColor: 'rgba(44,36,22,0.65)',
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5,
  },
  dateBadgeText: { fontSize: 11, color: C.cream, fontWeight: '500' },
  labelBadge: {
    position: 'absolute', top: 14, left: 14,
    backgroundColor: C.accent,
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5,
  },
  labelBadgeText: { fontSize: 10, color: C.white, fontWeight: '700', letterSpacing: 0.5 },
  cardBody: { padding: 16 },
  notes: {
    fontSize: 15, color: C.ink, lineHeight: 22,
    fontStyle: 'italic', marginBottom: 14,
  },
  cardStats: { flexDirection: 'row' },
  cardStat: { flex: 1, alignItems: 'center' },
  cardStatBorder: { borderLeftWidth: 1, borderLeftColor: C.divider },
  cardStatVal: { fontSize: 17, fontWeight: '800', color: C.ink },
  cardStatLbl: { fontSize: 9, letterSpacing: 1, color: C.muted, marginTop: 2, fontWeight: '500' },

  // Grid view
  gridRow: { flexDirection: 'row', paddingHorizontal: 20, gap: 8, marginBottom: 8 },
  gridCell: {
    flex: 1, borderRadius: 16, overflow: 'hidden',
    backgroundColor: C.tan,
  },
  gridOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    padding: 10,
    backgroundColor: 'rgba(44,36,22,0.55)',
  },
  gridDist: { fontSize: 14, fontWeight: '800', color: C.cream },
  gridDate: { fontSize: 10, color: 'rgba(245,240,232,0.7)', marginTop: 1 },

  // Timeline view
  monthHeader: {
    paddingHorizontal: 20, paddingVertical: 10,
    flexDirection: 'row', alignItems: 'center', gap: 10,
  },
  monthTitle: { fontSize: 13, fontWeight: '700', color: C.ink, letterSpacing: 0.5 },
  monthLine: { flex: 1, height: 1, backgroundColor: C.divider },
  monthCount: { fontSize: 11, color: C.muted },

  timelineRow: {
    flexDirection: 'row', paddingLeft: 20, paddingRight: 20, marginBottom: 12,
  },
  timelineSpine: { width: 24, alignItems: 'center', paddingTop: 16, marginRight: 12 },
  timelineDot: {
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: C.ink, borderWidth: 2, borderColor: C.cream,
    zIndex: 1,
  },
  timelineLine: { flex: 1, width: 1.5, backgroundColor: C.divider, marginTop: 4 },

  timelineCard: {
    flex: 1, backgroundColor: C.white, borderRadius: 16,
    overflow: 'hidden', elevation: 1,
    shadowColor: C.ink, shadowOpacity: 0.06,
    shadowRadius: 6, shadowOffset: { width: 0, height: 1 },
  },
  timelinePhoto: { width: '100%', height: 130 },
  timelineBody: { padding: 12 },
  timelineDate: { fontSize: 11, fontWeight: '700', color: C.muted, letterSpacing: 0.5, marginBottom: 4 },
  timelineStatsRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 },
  timelineStat: { fontSize: 13, fontWeight: '700', color: C.ink },
  timelineStatSep: { fontSize: 11, color: C.muted },
  timelineNotes: { fontSize: 12, color: C.muted, fontStyle: 'italic', lineHeight: 18 },

  // Empty state
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyEmoji: { fontSize: 52, marginBottom: 16 },
  emptyTitle: { fontSize: 22, fontWeight: '800', color: C.ink, marginBottom: 10, letterSpacing: -0.5 },
  emptyBody: { fontSize: 15, color: C.muted, textAlign: 'center', lineHeight: 22, marginBottom: 28 },
  emptyHints: { gap: 10, alignSelf: 'flex-start' },
  emptyHint: { fontSize: 14, color: C.ink, fontWeight: '500' },
});