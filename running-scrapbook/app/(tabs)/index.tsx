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
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';

interface Run {
  id: string;
  date: string;
  imageUri: string;
  distance: number;
  totalSeconds: number;
  paceSeconds: number;
  notes?: string;
}

function formatPace(paceSeconds: number): string {
  if (!paceSeconds) return '—';
  const m = Math.floor(paceSeconds / 60);
  const s = Math.round(paceSeconds % 60);
  return `${m}:${String(s).padStart(2, '0')} /mi`;
}

function formatDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.round(totalSeconds % 60);
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: 'short', month: 'short', day: 'numeric',
  });
}

export default function ScrapbookScreen() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadRuns = useCallback(async () => {
    try {
      const json = await AsyncStorage.getItem('@runs');
      setRuns(json ? JSON.parse(json) : []);
    } catch (e) {
      console.warn('Failed to load runs:', e);
    }
  }, []);

  useFocusEffect(useCallback(() => { loadRuns(); }, [loadRuns]));

  const onRefresh = async () => {
    setRefreshing(true);
    await loadRuns();
    setRefreshing(false);
  };

  const deleteRun = (id: string) => {
    Alert.alert('Delete run', 'Remove this run from your scrapbook?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          const updated = runs.filter((r) => r.id !== id);
          setRuns(updated);
          await AsyncStorage.setItem('@runs', JSON.stringify(updated));
        },
      },
    ]);
  };

  if (runs.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyEmoji}>🏃</Text>
        <Text style={styles.emptyTitle}>No runs yet</Text>
        <Text style={styles.emptySubtitle}>
          Tap "Add Run" to log your first run and snap a photo.
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      data={runs}
      keyExtractor={(r) => r.id}
      contentContainerStyle={styles.list}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#FF5252']} />
      }
      renderItem={({ item }) => (
        <TouchableOpacity
          style={styles.card}
          onLongPress={() => deleteRun(item.id)}
          activeOpacity={0.9}
        >
          <Image source={{ uri: item.imageUri }} style={styles.photo} resizeMode="cover" />

          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{item.distance} mi</Text>
              <Text style={styles.statLabel}>DISTANCE</Text>
            </View>
            <View style={[styles.stat, styles.statCenter]}>
              <Text style={styles.statValue}>{formatPace(item.paceSeconds)}</Text>
              <Text style={styles.statLabel}>PACE</Text>
            </View>
            <View style={[styles.stat, styles.statRight]}>
              <Text style={styles.statValue}>{formatDuration(item.totalSeconds)}</Text>
              <Text style={styles.statLabel}>TIME</Text>
            </View>
          </View>

          <View style={styles.footer}>
            <Text style={styles.date}>{formatDate(item.date)}</Text>
            {item.notes ? (
              <Text style={styles.notes} numberOfLines={2}>{item.notes}</Text>
            ) : null}
          </View>
        </TouchableOpacity>
      )}
    />
  );
}

const styles = StyleSheet.create({
  // No gap prop — use marginBottom on cards instead
  list: { padding: 12, paddingBottom: 24 },

  empty: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    padding: 40, backgroundColor: '#f5f5f5',
  },
  emptyEmoji: { fontSize: 56, marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: '#333', marginBottom: 8 },
  emptySubtitle: { fontSize: 15, color: '#888', textAlign: 'center', lineHeight: 22 },

  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,       // was gap — safe on all Android versions
    elevation: 3,           // Android shadow
    shadowColor: '#000',    // iOS shadow (harmless on Android)
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  photo: { width: '100%', height: 220 },

  statsRow: {
    flexDirection: 'row',
    paddingVertical: 14, paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#eee',
  },
  stat: { flex: 1 },
  statCenter: { alignItems: 'center' },
  statRight: { alignItems: 'flex-end' },
  statValue: { fontSize: 17, fontWeight: '700', color: '#222' },
  statLabel: { fontSize: 10, color: '#aaa', marginTop: 2, letterSpacing: 0.5 },

  footer: { paddingHorizontal: 16, paddingVertical: 12 },
  date: { fontSize: 13, color: '#888', marginBottom: 4 },
  notes: { fontSize: 14, color: '#444', lineHeight: 20 },
});