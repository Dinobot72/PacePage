import { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  StatusBar,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';

const C = {
  cream:  '#F5F0E8',
  ink:    '#2C2416',
  tan:    '#EDE5D4',
  muted:  '#9C8F7A',
  white:  '#FFFFFF',
  border: '#E0D8CC',
};

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
  const paceM = Math.floor(paceSeconds / 60);
  const paceS = Math.round(paceSeconds % 60);
  const paceDisplay = paceSeconds > 0
    ? `${paceM}:${String(paceS).padStart(2, '0')}`
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
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.85 });
      setPhotoUri(photo.uri);
    }
  };

  const saveRun = async () => {
    if (!photoUri) return;
    if (dist <= 0) { Alert.alert('Missing distance', 'Enter how far you ran.'); return; }
    if (totalSeconds <= 0) { Alert.alert('Missing time', 'Enter your finish time.'); return; }
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
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Could not save. Please try again.');
    }
  };

  // ── Permission screens ────────────────────────────────────────────────────
  if (!permission) {
    return <View style={s.fullDark}><Text style={s.lightText}>Loading…</Text></View>;
  }
  if (!permission.granted) {
    return (
      <View style={s.permWrap}>
        <Text style={s.permTitle}>Camera access needed</Text>
        <Text style={s.permBody}>To add a run photo to your scrapbook, we need camera access.</Text>
        <TouchableOpacity style={s.permBtn} onPress={requestPermission}>
          <Text style={s.permBtnText}>Grant permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Photo review + form ───────────────────────────────────────────────────
  if (photoUri) {
    return (
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={s.formRoot}
      >
        <StatusBar barStyle="dark-content" backgroundColor={C.cream} />
        <ScrollView contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Photo with overlay retake button */}
          <View style={s.photoWrap}>
            <Image source={{ uri: photoUri }} style={s.preview} resizeMode="cover" />
            <TouchableOpacity style={s.retakeBtn} onPress={resetForm}>
              <Text style={s.retakeBtnText}>↩ retake</Text>
            </TouchableOpacity>
          </View>

          <View style={s.form}>
            {/* Live pace display */}
            <View style={s.paceCard}>
              <Text style={s.paceLabel}>PACE / MILE</Text>
              <Text style={s.paceVal}>{paceDisplay}</Text>
            </View>

            {/* Distance */}
            <Text style={s.label}>Distance</Text>
            <View style={s.inputRow}>
              <TextInput
                style={[s.input, { flex: 1 }]}
                keyboardType="decimal-pad"
                placeholder="3.1"
                placeholderTextColor={C.muted}
                value={distance}
                onChangeText={setDistance}
              />
              <View style={s.unitBadge}><Text style={s.unitBadgeText}>mi</Text></View>
            </View>

            {/* Time */}
            <Text style={s.label}>Finish time</Text>
            <View style={s.timeRow}>
              <View style={s.timeField}>
                <TextInput
                  style={s.timeInput}
                  keyboardType="number-pad"
                  placeholder="0"
                  placeholderTextColor={C.muted}
                  value={hours}
                  onChangeText={setHours}
                  maxLength={2}
                />
                <Text style={s.timeUnit}>h</Text>
              </View>
              <Text style={s.timeSep}>:</Text>
              <View style={s.timeField}>
                <TextInput
                  style={s.timeInput}
                  keyboardType="number-pad"
                  placeholder="28"
                  placeholderTextColor={C.muted}
                  value={minutes}
                  onChangeText={setMinutes}
                  maxLength={2}
                />
                <Text style={s.timeUnit}>m</Text>
              </View>
              <Text style={s.timeSep}>:</Text>
              <View style={s.timeField}>
                <TextInput
                  style={s.timeInput}
                  keyboardType="number-pad"
                  placeholder="30"
                  placeholderTextColor={C.muted}
                  value={seconds}
                  onChangeText={setSeconds}
                  maxLength={2}
                />
                <Text style={s.timeUnit}>s</Text>
              </View>
            </View>

            {/* Notes */}
            <Text style={s.label}>How did it feel?</Text>
            <TextInput
              style={s.notesInput}
              placeholder="Legs felt strong, new route through the park…"
              placeholderTextColor={C.muted}
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />

            {/* Save */}
            <TouchableOpacity style={s.saveBtn} onPress={saveRun} activeOpacity={0.85}>
              <Text style={s.saveBtnText}>Save to scrapbook</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // ── Camera viewfinder ─────────────────────────────────────────────────────
  return (
    <View style={s.fullDark}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      <CameraView style={s.camera} facing="back" ref={cameraRef} />

      {/* Top label */}
      <View style={s.camTopBar}>
        <Text style={s.camHint}>Frame your post-run moment</Text>
      </View>

      {/* Shutter */}
      <View style={s.shutterBar}>
        <TouchableOpacity style={s.shutter} onPress={takePic} activeOpacity={0.8}>
          <View style={s.shutterRing}>
            <View style={s.shutterDot} />
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  fullDark: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
  lightText: { color: '#fff', fontSize: 15 },

  // Permission
  permWrap: {
    flex: 1, backgroundColor: C.cream,
    justifyContent: 'center', alignItems: 'center', padding: 40,
  },
  permTitle: { fontSize: 22, fontWeight: '800', color: C.ink, marginBottom: 10 },
  permBody: { fontSize: 15, color: C.muted, textAlign: 'center', lineHeight: 22, marginBottom: 28 },
  permBtn: {
    backgroundColor: C.ink, borderRadius: 14,
    paddingHorizontal: 28, paddingVertical: 14,
  },
  permBtnText: { color: C.cream, fontSize: 15, fontWeight: '600' },

  // Camera
  camera: { flex: 1 },
  camTopBar: {
    position: 'absolute', top: 0, left: 0, right: 0,
    paddingTop: 56, paddingBottom: 20, alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  camHint: { color: 'rgba(255,255,255,0.8)', fontSize: 14, letterSpacing: 0.5 },
  shutterBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingBottom: 52, alignItems: 'center',
  },
  shutter: {
    width: 84, height: 84, borderRadius: 42,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center', alignItems: 'center',
  },
  shutterRing: {
    width: 72, height: 72, borderRadius: 36,
    borderWidth: 3, borderColor: '#fff',
    justifyContent: 'center', alignItems: 'center',
  },
  shutterDot: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: '#fff',
  },

  

  // Form
  formRoot: { flex: 1, backgroundColor: C.cream },
  scrollContent: { flexGrow: 1 },
  photoWrap: { position: 'relative' },
  preview: { width: '100%', height: 300 },
  retakeBtn: {
    position: 'absolute', bottom: 14, left: 14,
    backgroundColor: 'rgba(44,36,22,0.65)',
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6,
  },
  retakeBtnText: { color: C.cream, fontSize: 12, fontWeight: '500' },

  form: {
    backgroundColor: C.cream,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    marginTop: -24, padding: 22, paddingBottom: 40,
  },

  paceCard: {
    backgroundColor: C.ink, borderRadius: 16,
    paddingVertical: 16, alignItems: 'center',
    marginBottom: 22,
  },
  paceLabel: { fontSize: 10, letterSpacing: 2, color: C.muted, fontWeight: '500', marginBottom: 4 },
  paceVal: { fontSize: 36, fontWeight: '800', color: C.cream, letterSpacing: -1 },

  label: {
    fontSize: 11, letterSpacing: 1.5, color: C.muted,
    fontWeight: '500', marginBottom: 8, marginTop: 16,
  },

  inputRow: { flexDirection: 'row', alignItems: 'center' },
  input: {
    backgroundColor: C.white, borderRadius: 12,
    borderWidth: 1, borderColor: C.border,
    paddingHorizontal: 14, paddingVertical: 13,
    fontSize: 16, color: C.ink,
  },
  unitBadge: {
    marginLeft: 8, backgroundColor: C.tan,
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 13,
  },
  unitBadgeText: { fontSize: 14, fontWeight: '600', color: C.ink },

  timeRow: { flexDirection: 'row', alignItems: 'center' },
  timeField: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.white, borderRadius: 12,
    borderWidth: 1, borderColor: C.border,
    paddingHorizontal: 10, paddingVertical: 12,
    marginRight: 4,
  },
  timeInput: { flex: 1, fontSize: 18, fontWeight: '700', color: C.ink, textAlign: 'center' },
  timeUnit: { fontSize: 12, color: C.muted, fontWeight: '500' },
  timeSep: { fontSize: 20, color: C.muted, marginRight: 4 },

  notesInput: {
    backgroundColor: C.white, borderRadius: 12,
    borderWidth: 1, borderColor: C.border,
    padding: 14, fontSize: 15, color: C.ink,
    minHeight: 88, textAlignVertical: 'top',
    lineHeight: 22,
  },

  saveBtn: {
    marginTop: 28, backgroundColor: C.ink,
    borderRadius: 16, paddingVertical: 17,
    alignItems: 'center',
  },
  saveBtnText: { color: C.cream, fontSize: 16, fontWeight: '700', letterSpacing: 0.3 },
});