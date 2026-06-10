// app/run-detail.tsx  — full-screen view of a single run entry
import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ScrollView,
  Alert,
  StatusBar,
  Dimensions,
  Share,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: W } = Dimensions.get('window');

const C = {
  cream:  '#F5F0E8',
  ink:    '#2C2416',
  tan:    '#EDE5D4',
  muted:  '#9C8F7A',
  divider:'#F0E8D8',
  white:  '#FFFFFF',
  accent: '#C4763A',
};

interface Run {
  id: string;
  date: string;
  imageUri: string;
  distance: number;
  totalSeconds: number;
  paceSeconds: number;
  notes?: string;
  label?: string;
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
function formatFullDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
}
function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

export default function RunDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [run, setRun] = useState<Run | null>(null);
  const [allRuns, setAllRuns] = useState<Run[]>([]);
  const router = useRouter();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    (async () => {
      const json = await AsyncStorage.getItem('@runs');
      const runs: Run[] = json ? JSON.parse(json) : [];
      setAllRuns(runs);
      setRun(runs.find(r => r.id === id) ?? null);
    })();
  }, [id]);

  const deleteRun = () => {
    Alert.alert('Remove run', 'Delete this entry from your scrapbook?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          const updated = allRuns.filter(r => r.id !== id);
          await AsyncStorage.setItem('@runs', JSON.stringify(updated));
          router.back();
        },
      },
    ]);
  };

  const shareRun = async () => {
    if (!run) return;
    const msg = `🏃 ${run.distance} mi · ${formatPace(run.paceSeconds)}/mi · ${formatDuration(run.totalSeconds)}\n${run.notes ? `"${run.notes}"` : ''}\n— logged with Stride`;
    await Share.share({ message: msg });
  };

  if (!run) return null;

  // Rank this run by pace among all runs (lower = better)
  const ranked = [...allRuns].filter(r => r.paceSeconds > 0).sort((a, b) => a.paceSeconds - b.paceSeconds);
  const rank = ranked.findIndex(r => r.id === id) + 1;
  const isPR = rank === 1 && allRuns.length > 1;

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor="#000" translucent />

      {/* Hero photo */}
      <View style={s.heroWrap}>
        <Image source={{ uri: run.imageUri }} style={s.hero} resizeMode="cover" />
        {/* Gradient overlay for text legibility */}
        <View style={s.heroOverlay} />

        {/* Top nav */}
        <View style={[s.topNav, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity style={s.navBtn} onPress={() => router.back()} activeOpacity={0.8}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <View style={s.navRight}>
            <TouchableOpacity style={s.navBtn} onPress={shareRun} activeOpacity={0.8}>
              <Ionicons name="share-outline" size={22} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity style={[s.navBtn, { marginLeft: 8 }]} onPress={deleteRun} activeOpacity={0.8}>
              <Ionicons name="trash-outline" size={22} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Photo label badge */}
        {run.label && (
          <View style={[s.labelBadge, run.label === 'before' ? s.badgeBefore : s.badgeAfter]}>
            <Text style={s.labelBadgeText}>
              {run.label === 'before' ? '🌅 BEFORE' : '🏁 AFTER'}
            </Text>
          </View>
        )}

        {/* Date overlay at bottom of hero */}
        <View style={s.heroDateWrap}>
          {isPR && (
            <View style={s.prBadge}>
              <Text style={s.prBadgeText}>🏅 PERSONAL BEST</Text>
            </View>
          )}
          <Text style={s.heroDate}>{formatFullDate(run.date)}</Text>
          <Text style={s.heroTime}>{formatTime(run.date)}</Text>
        </View>
      </View>

      {/* Content */}
      <ScrollView
        style={s.content}
        contentContainerStyle={[s.contentPad, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Big stats */}
        <View style={s.statsGrid}>
          <StatBox label="DISTANCE" value={`${run.distance}`} unit="mi" accent />
          <StatBox label="PACE" value={formatPace(run.paceSeconds)} unit="/mi" />
          <StatBox label="TIME" value={formatDuration(run.totalSeconds)} unit="" />
        </View>

        {/* Secondary stats */}
        <View style={s.secondaryRow}>
          <View style={s.secondaryStat}>
            <Text style={s.secondaryVal}>{(run.distance * 1609.34).toFixed(0)} m</Text>
            <Text style={s.secondaryLbl}>IN METERS</Text>
          </View>
          <View style={s.secondaryStat}>
            <Text style={s.secondaryVal}>{(run.distance * 1.60934).toFixed(2)} km</Text>
            <Text style={s.secondaryLbl}>IN KM</Text>
          </View>
          {ranked.length > 1 && (
            <View style={s.secondaryStat}>
              <Text style={s.secondaryVal}>#{rank}</Text>
              <Text style={s.secondaryLbl}>PACE RANK</Text>
            </View>
          )}
        </View>

        {/* Notes */}
        {run.notes ? (
          <View style={s.notesCard}>
            <Text style={s.notesQuote}>"</Text>
            <Text style={s.notesText}>{run.notes}</Text>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

function StatBox({ label, value, unit, accent }: {
  label: string; value: string; unit: string; accent?: boolean;
}) {
  return (
    <View style={[s.statBox, accent && s.statBoxAccent]}>
      <Text style={[s.statBoxLabel, accent && s.statBoxLabelAccent]}>{label}</Text>
      <Text style={[s.statBoxVal, accent && s.statBoxValAccent]}>{value}</Text>
      {unit ? <Text style={[s.statBoxUnit, accent && s.statBoxUnitAccent]}>{unit}</Text> : null}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.cream },

  heroWrap: { position: 'relative', height: W * 1.1 },
  hero: { ...StyleSheet.absoluteFill },
  heroOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },

  topNav: {
    position: 'absolute', top: 0, left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingHorizontal: 16,
  },
  navBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center', alignItems: 'center',
  },
  navRight: { flexDirection: 'row' },

  labelBadge: {
    position: 'absolute', top: 100, left: 20,
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6,
  },
  badgeBefore: { backgroundColor: 'rgba(196,118,58,0.9)' },
  badgeAfter:  { backgroundColor: 'rgba(44,36,22,0.75)' },
  labelBadgeText: { fontSize: 10, color: '#fff', fontWeight: '700', letterSpacing: 1 },

  heroDateWrap: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    padding: 20,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  prBadge: {
    backgroundColor: C.accent, borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 4,
    alignSelf: 'flex-start', marginBottom: 8,
  },
  prBadgeText: { fontSize: 10, color: '#fff', fontWeight: '800', letterSpacing: 1 },
  heroDate: { fontSize: 18, fontWeight: '800', color: '#fff', marginBottom: 2 },
  heroTime: { fontSize: 13, color: 'rgba(255,255,255,0.7)' },

  content: { flex: 1, marginTop: -28 },
  contentPad: {
    backgroundColor: C.cream,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 22,
  },

  statsGrid: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  statBox: {
    flex: 1, backgroundColor: C.tan, borderRadius: 16,
    padding: 14, alignItems: 'center',
  },
  statBoxAccent: { backgroundColor: C.ink },
  statBoxLabel: { fontSize: 8, letterSpacing: 1.5, color: C.muted, fontWeight: '600', marginBottom: 4 },
  statBoxLabelAccent: { color: 'rgba(245,240,232,0.5)' },
  statBoxVal: { fontSize: 22, fontWeight: '800', color: C.ink },
  statBoxValAccent: { color: C.cream },
  statBoxUnit: { fontSize: 10, color: C.muted, marginTop: 2, fontWeight: '500' },
  statBoxUnitAccent: { color: 'rgba(245,240,232,0.5)' },

  secondaryRow: {
    flexDirection: 'row', marginBottom: 20,
    backgroundColor: C.white, borderRadius: 16,
    paddingVertical: 14, paddingHorizontal: 10,
  },
  secondaryStat: { flex: 1, alignItems: 'center' },
  secondaryVal: { fontSize: 14, fontWeight: '700', color: C.ink },
  secondaryLbl: { fontSize: 8, letterSpacing: 1, color: C.muted, marginTop: 3, fontWeight: '500' },

  notesCard: {
    backgroundColor: C.tan, borderRadius: 16,
    padding: 20,
  },
  notesQuote: { fontSize: 48, color: C.muted, lineHeight: 40, marginBottom: 4 },
  notesText: { fontSize: 17, color: C.ink, fontStyle: 'italic', lineHeight: 26 },
});