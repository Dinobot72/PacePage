// app/(tabs)/add-run.tsx
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
  Modal,
  Pressable,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as FileSystem from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const C = {
  cream:  '#F5F0E8',
  ink:    '#2C2416',
  tan:    '#EDE5D4',
  muted:  '#9C8F7A',
  white:  '#FFFFFF',
  border: '#E0D8CC',
  accent: '#C4763A',
};

async function persistPhoto(tempUri: string): Promise<string> {
  if (Platform.OS === 'web' || !FileSystem.documentDirectory) return tempUri;
  const filename = tempUri.split('/').pop() ?? `run_${Date.now()}.jpg`;
  const dest = `${FileSystem.documentDirectory}${filename}`;
  await FileSystem.copyAsync({ from: tempUri, to: dest });
  return dest;
}

type PhotoLabel = 'before' | 'after' | null;

export default function AddRunScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoLabel, setPhotoLabel] = useState<PhotoLabel>(null);
  const [showLabelModal, setShowLabelModal] = useState(false);
  const cameraRef = useRef<any>(null);
  const router = useRouter();
  const insets = useSafeAreaInsets();

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
    setPhotoLabel(null);
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
      setShowLabelModal(true);
    }
  };

  const pickFromLibrary = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow access to your photo library to pick a run photo.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.85,
    });
    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri);
      setShowLabelModal(true);
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
        label: photoLabel,
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

  // ── Label modal ────────────────────────────────────────────────────────────
  const LabelModal = (
    <Modal visible={showLabelModal} transparent animationType="fade">
      <Pressable style={s.modalBg} onPress={() => setShowLabelModal(false)}>
        <View style={s.modalSheet}>
          <Text style={s.modalTitle}>Label this photo</Text>
          <Text style={s.modalSub}>Was this taken before or after your run?</Text>
          <View style={s.labelBtns}>
            {(['before', 'after', null] as PhotoLabel[]).map((opt) => (
              <TouchableOpacity
                key={String(opt)}
                style={[s.labelBtn, photoLabel === opt && s.labelBtnActive]}
                onPress={() => { setPhotoLabel(opt); setShowLabelModal(false); }}
                activeOpacity={0.8}
              >
                <Text style={[s.labelBtnText, photoLabel === opt && s.labelBtnTextActive]}>
                  {opt === 'before' ? '🌅 Before' : opt === 'after' ? '🏁 After' : '⬜️ Skip'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Pressable>
    </Modal>
  );

  // ── Permission screens ─────────────────────────────────────────────────────
  if (!permission) {
    return <View style={s.fullDark}><Text style={s.lightText}>Loading…</Text></View>;
  }
  if (!permission.granted) {
    return (
      <View style={[s.permWrap, { paddingTop: insets.top + 20 }]}>
        <StatusBar barStyle="dark-content" backgroundColor={C.cream} />
        <Text style={s.permTitle}>Camera access needed</Text>
        <Text style={s.permBody}>
          To snap a photo for your scrapbook, we need camera access.
        </Text>
        <TouchableOpacity style={s.permBtn} onPress={requestPermission}>
          <Text style={s.permBtnText}>Grant permission</Text>
        </TouchableOpacity>
        <Text style={s.permOr}>— or —</Text>
        <TouchableOpacity style={[s.permBtn, s.permBtnOutline]} onPress={pickFromLibrary}>
          <Text style={[s.permBtnText, { color: C.ink }]}>Choose from library</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Photo review + form ────────────────────────────────────────────────────
  if (photoUri) {
    return (
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={s.formRoot}
      >
        {LabelModal}
        <StatusBar barStyle="dark-content" backgroundColor={C.cream} />
        <ScrollView contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Photo */}
          <View style={s.photoWrap}>
            <Image source={{ uri: photoUri }} style={s.preview} resizeMode="cover" />
            {photoLabel && (
              <View style={[s.labelOverlay, photoLabel === 'before' ? s.labelBefore : s.labelAfter]}>
                <Text style={s.labelOverlayText}>
                  {photoLabel === 'before' ? '🌅 BEFORE' : '🏁 AFTER'}
                </Text>
              </View>
            )}
            <TouchableOpacity style={s.retakeBtn} onPress={resetForm}>
              <Ionicons name="arrow-back" size={14} color={C.cream} />
              <Text style={s.retakeBtnText}> retake</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.relabelBtn} onPress={() => setShowLabelModal(true)}>
              <Text style={s.relabelBtnText}>
                {photoLabel ? `${photoLabel} ✎` : 'label photo'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={s.form}>
            {/* Live pace */}
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
              {[
                { val: hours, set: setHours, unit: 'h', ph: '0' },
                { val: minutes, set: setMinutes, unit: 'm', ph: '28' },
                { val: seconds, set: setSeconds, unit: 's', ph: '30' },
              ].map((f, i) => (
                <View key={i} style={[s.timeFieldWrap, i < 2 && { marginRight: 6 }]}>
                  <View style={s.timeField}>
                    <TextInput
                      style={s.timeInput}
                      keyboardType="number-pad"
                      placeholder={f.ph}
                      placeholderTextColor={C.muted}
                      value={f.val}
                      onChangeText={f.set}
                      maxLength={2}
                    />
                    <Text style={s.timeUnit}>{f.unit}</Text>
                  </View>
                  {i < 2 && <Text style={s.timeSep}>:</Text>}
                </View>
              ))}
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
              <Text style={s.saveBtnText}>Save to scrapbook ✓</Text>
            </TouchableOpacity>

            <View style={{ height: insets.bottom + 8 }} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // ── Camera + options ───────────────────────────────────────────────────────
  return (
    <View style={s.fullDark}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      <CameraView style={s.camera} facing="back" ref={cameraRef} />

      {/* Top label */}
      <View style={[s.camTopBar, { paddingTop: insets.top + 12 }]}>
        <Text style={s.camHint}>Capture your run moment</Text>
      </View>

      {/* Bottom controls */}
      <View style={[s.camBottom, { paddingBottom: insets.bottom + 16 }]}>
        {/* Library picker */}
        <TouchableOpacity style={s.sideBtn} onPress={pickFromLibrary} activeOpacity={0.8}>
          <Ionicons name="images-outline" size={24} color="#fff" />
          <Text style={s.sideBtnText}>Library</Text>
        </TouchableOpacity>

        {/* Shutter */}
        <TouchableOpacity style={s.shutter} onPress={takePic} activeOpacity={0.8}>
          <View style={s.shutterRing}>
            <View style={s.shutterDot} />
          </View>
        </TouchableOpacity>

        {/* Spacer mirror */}
        <View style={s.sideBtn} />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  fullDark: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
  lightText: { color: '#fff', fontSize: 15 },

  permWrap: {
    flex: 1, backgroundColor: C.cream,
    justifyContent: 'center', alignItems: 'center', padding: 40,
  },
  permTitle: { fontSize: 22, fontWeight: '800', color: C.ink, marginBottom: 10 },
  permBody: { fontSize: 15, color: C.muted, textAlign: 'center', lineHeight: 22, marginBottom: 28 },
  permBtn: {
    backgroundColor: C.ink, borderRadius: 14,
    paddingHorizontal: 28, paddingVertical: 14, width: '100%', alignItems: 'center',
  },
  permBtnText: { color: C.cream, fontSize: 15, fontWeight: '600' },
  permOr: { fontSize: 13, color: C.muted, marginVertical: 16 },
  permBtnOutline: {
    backgroundColor: 'transparent', borderWidth: 1.5, borderColor: C.ink,
  },

  camera: { ...StyleSheet.absoluteFill },

  camTopBar: {
    position: 'absolute', top: 0, left: 0, right: 0,
    paddingBottom: 20, alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  camHint: { color: 'rgba(255,255,255,0.85)', fontSize: 14, letterSpacing: 0.5 },

  camBottom: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around',
    paddingHorizontal: 40, paddingTop: 20,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  sideBtn: {
    width: 56, alignItems: 'center', gap: 4,
  },
  sideBtnText: { color: 'rgba(255,255,255,0.75)', fontSize: 11, marginTop: 2 },
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
  shutterDot: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#fff' },

  formRoot: { flex: 1, backgroundColor: C.cream },
  scrollContent: { flexGrow: 1 },

  photoWrap: { position: 'relative' },
  preview: { width: '100%', height: 300 },
  labelOverlay: {
    position: 'absolute', top: 14, left: 14,
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5,
  },
  labelBefore: { backgroundColor: 'rgba(196,118,58,0.85)' },
  labelAfter: { backgroundColor: 'rgba(44,36,22,0.75)' },
  labelOverlayText: { fontSize: 10, color: C.white, fontWeight: '700', letterSpacing: 1 },

  retakeBtn: {
    position: 'absolute', bottom: 14, left: 14,
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(44,36,22,0.65)',
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6,
  },
  retakeBtnText: { color: C.cream, fontSize: 12, fontWeight: '500' },

  relabelBtn: {
    position: 'absolute', bottom: 14, right: 14,
    backgroundColor: 'rgba(44,36,22,0.65)',
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6,
  },
  relabelBtnText: { color: C.cream, fontSize: 12, fontWeight: '500' },

  form: {
    backgroundColor: C.cream, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    marginTop: -24, padding: 22,
  },

  paceCard: {
    backgroundColor: C.ink, borderRadius: 16,
    paddingVertical: 16, alignItems: 'center', marginBottom: 22,
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
  timeFieldWrap: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  timeField: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.white, borderRadius: 12,
    borderWidth: 1, borderColor: C.border,
    paddingHorizontal: 10, paddingVertical: 12,
  },
  timeInput: { flex: 1, fontSize: 18, fontWeight: '700', color: C.ink, textAlign: 'center' },
  timeUnit: { fontSize: 12, color: C.muted, fontWeight: '500' },
  timeSep: { fontSize: 20, color: C.muted, paddingHorizontal: 4 },

  notesInput: {
    backgroundColor: C.white, borderRadius: 12,
    borderWidth: 1, borderColor: C.border,
    padding: 14, fontSize: 15, color: C.ink,
    minHeight: 88, textAlignVertical: 'top', lineHeight: 22,
  },

  saveBtn: {
    marginTop: 28, backgroundColor: C.ink,
    borderRadius: 16, paddingVertical: 17, alignItems: 'center',
  },
  saveBtnText: { color: C.cream, fontSize: 16, fontWeight: '700', letterSpacing: 0.3 },

  // Label modal
  modalBg: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: C.cream, borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 28, paddingBottom: 48,
  },
  modalTitle: { fontSize: 20, fontWeight: '800', color: C.ink, marginBottom: 6 },
  modalSub: { fontSize: 14, color: C.muted, marginBottom: 24 },
  labelBtns: { gap: 10 },
  labelBtn: {
    backgroundColor: C.tan, borderRadius: 14,
    paddingVertical: 16, alignItems: 'center',
    borderWidth: 1.5, borderColor: 'transparent',
  },
  labelBtnActive: { borderColor: C.ink, backgroundColor: C.white },
  labelBtnText: { fontSize: 16, fontWeight: '600', color: C.muted },
  labelBtnTextActive: { color: C.ink },
});