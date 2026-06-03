import { useState, useCallback } from 'react';
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
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';

// ── Palette ───────────────────────────────────────────────────────────────────
const C = {
  cream:   '#F5F0E8',
  ink:     '#2C2416',
  tan:     '#EDE5D4',
  muted:   '#9C8F7A',
  divider: '#F0E8D8',
  white:   '#FFFFFF',
};

// ── Types ─────────────────────────────────────────────────────────────────────
interface Run {
  id: string;
  date: string;
  imageUri: string;
  distance: number;
  totalSeconds: number;
  paceSeconds: number;
  notes?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
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
function calcStreak(runs: Run[]): number {
  if (!runs.length) return 0;
  const days = runs
    .map(r => new Date(r.date).toDateString())
    .filter((d, i, a) => a.indexOf(d) === i); // unique days
  let streak = 1;
  for (let i = 1; i < days.length; i++) {
    const diff =
      (new Date(days[i - 1]).getTime() - new Date(days[i]).getTime()) /
      86400000;
    if (diff === 1) streak++;
    else break;
  }
  return streak;
}
function bestPace(runs: Run[]): Run | null {
  if (!runs.length) return null;
  return runs.reduce((best, r) =>
    r.paceSeconds > 0 && r.paceSeconds < (best?.paceSeconds ?? Infinity) ? r : best,
    null as Run | null
  );
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function ScrapbookScreen() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [refreshing, setRefreshing] = useState(false);

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

  const totalMiles = runs.reduce((s, r) => s + (r.distance || 0), 0);
  const avgPace = runs.length
    ? runs.reduce((s, r) => s + r.paceSeconds, 0) / runs.length
    : 0;
  const streak = calcStreak(runs);
  const pr = bestPace(runs);

  const ListHeader = (
    <View>
      {/* ── App header ────────────────────────────────── */}
      <View style={s.appHeader}>
        <View>
          <Text style={s.appLabel}>MY</Text>
          <Text style={s.appTitle}>Stride</Text>
        </View>
        {streak > 0 && (
          <View style={s.streakPill}>
            <Text style={s.streakText}>🔥 {streak} day streak</Text>
          </View>
        )}
      </View>

      {/* ── Stats row ─────────────────────────────────── */}
      <View style={s.statsRow}>
        <View style={s.statChip}>
          <Text style={s.statVal}>{totalMiles.toFixed(1)}</Text>
          <Text style={s.statLbl}>MILES</Text>
        </View>
        <View style={s.statChip}>
          <Text style={s.statVal}>{runs.length}</Text>
          <Text style={s.statLbl}>RUNS</Text>
        </View>
        <View style={s.statChip}>
          <Text style={s.statVal}>{avgPace > 0 ? formatPace(avgPace) : '—'}</Text>
          <Text style={s.statLbl}>AVG PACE</Text>
        </View>
      </View>

      {/* ── PR banner ─────────────────────────────────── */}
      {pr && (
        <View style={s.prBanner}>
          <View>
            <Text style={s.prLabel}>PERSONAL BEST PACE</Text>
            <Text style={s.prVal}>{formatPace(pr.paceSeconds)}<Text style={s.prUnit}> /mi</Text></Text>
            <Text style={s.prDate}>{formatDateShort(pr.date)}</Text>
          </View>
          <Text style={s.prMedal}>🏅</Text>
        </View>
      )}

      {runs.length > 0 && (
        <Text style={s.sectionLabel}>RECENT RUNS</Text>
      )}
    </View>
  );

  if (runs.length === 0) {
    return (
      <View style={s.root}>
        <StatusBar barStyle="dark-content" backgroundColor={C.cream} />
        {ListHeader}
        <View style={s.emptyWrap}>
          <Text style={s.emptyEmoji}>👟</Text>
          <Text style={s.emptyTitle}>Your scrapbook awaits</Text>
          <Text style={s.emptyBody}>
            Tap Add Run to log your first run and snap a photo.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" backgroundColor={C.cream} />
      <FlatList
        data={runs}
        keyExtractor={r => r.id}
        contentContainerStyle={s.list}
        ListHeaderComponent={ListHeader}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[C.ink]} />
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={s.card}
            onLongPress={() => deleteRun(item.id)}
            activeOpacity={0.95}
          >
            {/* Photo */}
            <Image source={{ uri: item.imageUri }} style={s.photo} resizeMode="cover" />
            <View style={s.dateBadge}>
              <Text style={s.dateBadgeText}>{formatDateShort(item.date)}</Text>
            </View>

            <View style={s.cardBody}>
              {/* Notes in italic serif */}
              {item.notes ? (
                <Text style={s.notes}>"{item.notes}"</Text>
              ) : null}

              {/* Stats */}
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
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.cream },
  list: { paddingBottom: 32 },

  // Header
  appHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-end', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 14,
  },
  appLabel: { fontSize: 11, letterSpacing: 3, color: C.muted, fontWeight: '500' },
  appTitle: { fontSize: 38, fontWeight: '800', color: C.ink, letterSpacing: -1, lineHeight: 40 },
  streakPill: {
    backgroundColor: C.ink, borderRadius: 100,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  streakText: { fontSize: 12, color: C.cream, fontWeight: '500' },

  // Stats row
  statsRow: { flexDirection: 'row', paddingHorizontal: 20, marginBottom: 14 },
  statChip: {
    flex: 1, backgroundColor: C.tan, borderRadius: 12,
    paddingVertical: 10, alignItems: 'center', marginRight: 8,
  },
  statVal: { fontSize: 20, fontWeight: '800', color: C.ink },
  statLbl: { fontSize: 9, letterSpacing: 1, color: C.muted, marginTop: 2, fontWeight: '500' },

  // PR banner
  prBanner: {
    marginHorizontal: 20, marginBottom: 20, backgroundColor: C.ink,
    borderRadius: 16, padding: 16,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  prLabel: { fontSize: 9, letterSpacing: 2, color: C.muted, fontWeight: '500', marginBottom: 4 },
  prVal: { fontSize: 28, fontWeight: '800', color: C.cream },
  prUnit: { fontSize: 16, fontWeight: '400', color: C.muted },
  prDate: { fontSize: 12, color: C.muted, marginTop: 2 },
  prMedal: { fontSize: 32 },

  sectionLabel: {
    fontSize: 10, letterSpacing: 2, color: C.muted,
    fontWeight: '500', paddingHorizontal: 20, marginBottom: 12,
  },

  // Cards
  card: {
    marginHorizontal: 20, marginBottom: 16,
    backgroundColor: C.white, borderRadius: 20,
    overflow: 'hidden', elevation: 2,
    shadowColor: C.ink, shadowOpacity: 0.08,
    shadowRadius: 8, shadowOffset: { width: 0, height: 2 },
  },
  photo: { width: '100%', height: 220 },
  dateBadge: {
    position: 'absolute', top: 14, right: 14,
    backgroundColor: 'rgba(44,36,22,0.65)',
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5,
  },
  dateBadgeText: { fontSize: 11, color: C.cream, fontWeight: '500' },

  cardBody: { padding: 16 },
  notes: {
    fontSize: 15, color: C.ink, lineHeight: 22,
    fontStyle: 'italic', marginBottom: 14,
    fontWeight: '400',
  },

  cardStats: { flexDirection: 'row' },
  cardStat: { flex: 1, alignItems: 'center' },
  cardStatBorder: {
    borderLeftWidth: 1, borderLeftColor: C.divider,
  },
  cardStatVal: { fontSize: 17, fontWeight: '800', color: C.ink },
  cardStatLbl: { fontSize: 9, letterSpacing: 1, color: C.muted, marginTop: 2, fontWeight: '500' },

  // Empty state
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyEmoji: { fontSize: 52, marginBottom: 16 },
  emptyTitle: { fontSize: 22, fontWeight: '800', color: C.ink, marginBottom: 8, letterSpacing: -0.5 },
  emptyBody: { fontSize: 15, color: C.muted, textAlign: 'center', lineHeight: 22 },
});