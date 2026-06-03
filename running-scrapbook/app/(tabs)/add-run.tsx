import { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Button,
  Image,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';

async function persistPhoto(tempUri: string): Promise<string> {
  if (Platform.OS === 'web' || !FileSystem.documentDirectory) return tempUri;
  const filename = tempUri.split('/').pop() ?? `run_${Date.now()}.jpg`;
  const dest = `${FileSystem.documentDirectory}${filename}`;
  await FileSystem.copyAsync({ from: tempUri, to: dest });
  return dest;
}

export default function AddRunScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const cameraRef = useRef<any>(null);
  const router = useRouter();

  const [distance, setDistance] = useState('');
  const [hours, setHours] = useState('');
  const [minutes, setMinutes] = useState('');
  const [seconds, setSeconds] = useState('');
  const [notes, setNotes] = useState('');

  const totalSeconds =
    (parseInt(hours) || 0) * 3600 +
    (parseInt(minutes) || 0) * 60 +
    (parseInt(seconds) || 0);
  const dist = parseFloat(distance) || 0;
  const paceSeconds = dist > 0 && totalSeconds > 0 ? totalSeconds / dist : 0;
  const paceDisplay =
    paceSeconds > 0
      ? `${Math.floor(paceSeconds / 60)}:${String(Math.round(paceSeconds % 60)).padStart(2, '0')} /mi`
      : '—';

  const resetForm = () => {
    setPhotoUri(null);
    setDistance('');
    setHours('');
    setMinutes('');
    setSeconds('');
    setNotes('');
  };

  const takePic = async () => {
    if (cameraRef.current) {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.8 });
      setPhotoUri(photo.uri);
    }
  };

  const saveRun = async () => {
    if (!photoUri) return;
    if (dist <= 0) { Alert.alert('Missing distance', 'Please enter a valid distance.'); return; }
    if (totalSeconds <= 0) { Alert.alert('Missing time', 'Please enter a time.'); return; }

    try {
      const imageUri = await persistPhoto(photoUri);
      const newRun = {
        id: Date.now().toString(),
        date: new Date().toISOString(),
        imageUri,
        distance: dist,
        totalSeconds,
        paceSeconds,
        notes: notes.trim(),
      };
      const existing = await AsyncStorage.getItem('@runs');
      const runs = existing ? JSON.parse(existing) : [];
      await AsyncStorage.setItem('@runs', JSON.stringify([newRun, ...runs]));
      resetForm();
      router.push('/');
    } catch (error) {
      console.error('Failed to save run:', error);
      Alert.alert('Error', 'Could not save your run. Please try again.');
    }
  };

  if (!permission) {
    return <View style={styles.container}><Text style={styles.text}>Loading camera…</Text></View>;
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.text}>Camera access is needed to take a run photo.</Text>
        <Button onPress={requestPermission} title="Grant Permission" color="#FF5252" />
      </View>
    );
  }

  if (photoUri) {
    return (
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Image source={{ uri: photoUri }} style={styles.preview} resizeMode="cover" />

          <View style={styles.form}>
            {/* Live pace badge */}
            <View style={styles.paceBadge}>
              <Text style={styles.paceBadgeLabel}>Pace</Text>
              <Text style={styles.paceBadgeValue}>{paceDisplay}</Text>
            </View>

            <Text style={styles.label}>Distance (miles)</Text>
            <TextInput
              style={styles.input}
              keyboardType="decimal-pad"
              placeholder="3.1"
              placeholderTextColor="#aaa"
              value={distance}
              onChangeText={setDistance}
            />

            <Text style={styles.label}>Time</Text>
            <View style={styles.timeRow}>
              <TextInput
                style={[styles.input, styles.timeInput]}
                keyboardType="number-pad"
                placeholder="0h"
                placeholderTextColor="#aaa"
                value={hours}
                onChangeText={setHours}
                maxLength={2}
              />
              <Text style={styles.timeSep}>:</Text>
              <TextInput
                style={[styles.input, styles.timeInput]}
                keyboardType="number-pad"
                placeholder="28m"
                placeholderTextColor="#aaa"
                value={minutes}
                onChangeText={setMinutes}
                maxLength={2}
              />
              <Text style={styles.timeSep}>:</Text>
              <TextInput
                style={[styles.input, styles.timeInput]}
                keyboardType="number-pad"
                placeholder="30s"
                placeholderTextColor="#aaa"
                value={seconds}
                onChangeText={setSeconds}
                maxLength={2}
              />
            </View>

            <Text style={styles.label}>Notes (optional)</Text>
            <TextInput
              style={[styles.input, styles.notesInput]}
              placeholder="Morning run, felt great…"
              placeholderTextColor="#aaa"
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />

            <View style={styles.buttonRow}>
              <View style={styles.buttonWrap}>
                <Button title="Retake" onPress={resetForm} color="#888" />
              </View>
              <View style={styles.buttonWrap}>
                <Button title="Save Run" onPress={saveRun} color="#FF5252" />
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView style={styles.camera} facing="back" ref={cameraRef} />
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.captureButton} onPress={takePic} activeOpacity={0.7}>
          <View style={styles.captureInner} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  scrollContent: { flexGrow: 1 },
  text: { textAlign: 'center', color: '#fff', marginBottom: 20, paddingHorizontal: 20 },

  camera: { flex: 1 },
  overlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingBottom: 48, alignItems: 'center',
  },
  captureButton: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 3, borderColor: '#fff',
  },
  captureInner: { width: 62, height: 62, borderRadius: 31, backgroundColor: '#fff' },

  preview: { width: '100%', height: 300 },
  form: {
    padding: 20, backgroundColor: '#fff',
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    marginTop: -20, flex: 1,
  },

  paceBadge: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFF0F0', borderRadius: 10,
    paddingHorizontal: 16, paddingVertical: 12,
    marginBottom: 16,
  },
  paceBadgeLabel: { fontSize: 14, color: '#888' },
  paceBadgeValue: { fontSize: 22, fontWeight: '700', color: '#FF5252' },

  label: { fontSize: 14, fontWeight: '600', marginTop: 14, marginBottom: 6, color: '#333' },
  input: {
    borderWidth: 1, borderColor: '#ddd', borderRadius: 8,
    padding: 12, fontSize: 16, backgroundColor: '#fafafa', color: '#000',
  },

  // No gap — use marginRight on siblings instead
  timeRow: { flexDirection: 'row', alignItems: 'center' },
  timeInput: { flex: 1, textAlign: 'center', marginRight: 4 },
  timeSep: { fontSize: 20, color: '#bbb', marginRight: 4 },

  notesInput: { minHeight: 80 },

  buttonRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 28 },
  buttonWrap: { flex: 1, marginHorizontal: 6 },
});