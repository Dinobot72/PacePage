import { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Button, Image, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';

export default function AddRunScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const cameraRef = useRef<any>(null);
  const router = useRouter();

  // Form State
  const [distance, setDistance] = useState('');
  const [time, setTime] = useState('');
  const [pace, setPace] = useState('');

  // --- AUTO-CALCULATE PACE ---
  useEffect(() => {
    const dist = parseFloat(distance);
    
    // Only run math if distance is valid and time looks like "MM:SS"
    if (dist > 0 && time.includes(':')) {
      const timeParts = time.split(':');
      if (timeParts.length === 2) {
        const minutes = parseInt(timeParts[0], 10);
        const seconds = parseInt(timeParts[1], 10);
        
        if (!isNaN(minutes) && !isNaN(seconds)) {
          // Convert everything to seconds, divide by distance, then convert back to MM:SS
          const totalSeconds = (minutes * 60) + seconds;
          const paceInSeconds = Math.round(totalSeconds / dist);
          
          const paceMins = Math.floor(paceInSeconds / 60);
          const paceSecs = paceInSeconds % 60;
          
          // Format with leading zeros for seconds (e.g., 8:05 instead of 8:5)
          setPace(`${paceMins}:${paceSecs.toString().padStart(2, '0')}`);
        }
      }
    }
  }, [distance, time]); // This runs every time distance or time changes

  if (!permission) return <View style={styles.container}><Text style={styles.text}>Loading camera...</Text></View>;
  
  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.text}>We need permission to use your camera for the scrapbook.</Text>
        <Button onPress={requestPermission} title="Grant Permission" color="#FF5252" />
      </View>
    );
  }

  const takePic = async () => {
    if (cameraRef.current) {
      const newPhoto = await cameraRef.current.takePictureAsync({ quality: 0.8 });
      setPhotoUri(newPhoto.uri);
    }
  };

  const saveRun = async () => {
    if (!photoUri) return;

    try {
      const filename = photoUri.split('/').pop() || `run_${Date.now()}.jpg`;
      const newPath = `${FileSystem.documentDirectory}${filename}`;
      // copyAsync's RelocatingOptions signature is deprecated in typings; cast to any to avoid the TS/linters
      await FileSystem.copyAsync({ from: photoUri, to: newPath } as any);

      const newRun = {
        id: Date.now().toString(),
        date: new Date().toISOString(),
        imageUri: newPath,
        distance,
        time,
        pace
      };

      const existingRunsJson = await AsyncStorage.getItem('@runs');
      const existingRuns = existingRunsJson ? JSON.parse(existingRunsJson) : [];
      const updatedRuns = [newRun, ...existingRuns];
      
      await AsyncStorage.setItem('@runs', JSON.stringify(updatedRuns));

      setPhotoUri(null);
      setDistance('');
      setTime('');
      setPace('');
      
      router.push('/');
    } catch (error) {
      console.error("Failed to save run:", error);
      alert('Error saving your run. Check the console.');
    }
  };

  if (photoUri) {
    return (
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Fix: resizeMode moved to a prop */}
          <Image source={{ uri: photoUri }} style={styles.previewSmall} resizeMode="cover" />
          
          <View style={styles.form}>
            <Text style={styles.label}>Distance (miles)</Text>
            <TextInput style={styles.input} keyboardType="numeric" placeholder="e.g. 3.1" value={distance} onChangeText={setDistance} />
            
            <Text style={styles.label}>Time (MM:SS)</Text>
            <TextInput style={styles.input} placeholder="e.g. 25:30" value={time} onChangeText={setTime} />
            
            <Text style={styles.label}>Pace / mile (Auto-calculated)</Text>
            <TextInput style={styles.input} placeholder="e.g. 8:15" value={pace} onChangeText={setPace} />
            
            <View style={styles.buttonRow}>
              <Button title="Retake Photo" onPress={() => setPhotoUri(null)} color="#666" />
              <Button title="Save Run" onPress={saveRun} color="#FF5252" />
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  return (
    <View style={styles.container}>
      {/* Fix: Children removed from CameraView */}
      <CameraView style={styles.camera} facing="back" ref={cameraRef} />
      
      {/* Fix: Overlay is now absolutely positioned on top of the camera */}
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.captureButton} onPress={takePic}>
          <View style={styles.captureInner} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  scrollContent: { flexGrow: 1, justifyContent: 'center' },
  text: { textAlign: 'center', color: '#fff', marginBottom: 20, paddingHorizontal: 20 },
  camera: { flex: 1 },
  overlay: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 40, alignItems: 'center' },
  captureButton: { width: 74, height: 74, borderRadius: 37, backgroundColor: 'rgba(255, 255, 255, 0.3)', justifyContent: 'center', alignItems: 'center' },
  captureInner: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#fff' },
  previewSmall: { width: '100%', height: 350 },
  form: { padding: 20, backgroundColor: '#fff', flex: 1, borderTopLeftRadius: 20, borderTopRightRadius: 20, marginTop: -20 },
  label: { fontSize: 16, fontWeight: 'bold', marginTop: 15, marginBottom: 5 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, fontSize: 16 },
  buttonRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 30 }
});
```</CameraView>