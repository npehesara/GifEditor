import React, { useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, SafeAreaView, ScrollView, Alert } from 'react-native';
import { ArrowLeft, Check, Share2, Download, Home } from 'lucide-react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import { Mp4OutputInfo } from '../../App';

interface Mp4OutputScreenProps {
  info: Mp4OutputInfo;
  onBack: () => void;
  onDone: () => void;
}

export default function Mp4OutputScreen({ info, onBack, onDone }: Mp4OutputScreenProps) {
  const [saved, setSaved] = useState(false);
  const [permissionResponse, requestPermission] = MediaLibrary.usePermissions();

  const player = useVideoPlayer(info.uri, player => {
    player.loop = true;
    player.play();
  });

  const handleSaveToGallery = async () => {
    if (saved) return;
    
    try {
      if (!permissionResponse?.granted) {
        const result = await requestPermission();
        if (!result.granted) {
          Alert.alert('Permission Denied', 'Gallery access is required to save the video.');
          return;
        }
      }

      const asset = await MediaLibrary.Asset.create(info.uri);
      if (asset) {
        setSaved(true);
        Alert.alert('Success', 'Saved to Gallery ✓');
      } else {
        throw new Error('Asset creation returned null');
      }
    } catch (e: any) {
      Alert.alert('Error Saving', e.message || 'Could not save video to gallery.');
    }
  };

  const handleShare = async () => {
    try {
      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(info.uri);
      } else {
        Alert.alert('Sharing not available', 'Cannot share on this device.');
      }
    } catch (e: any) {
      // ignore or handle if sharing fails/cancels
    }
  };

  // Determine aspect ratio for the VideoView container to not distort
  const aspectRatio = info.width / info.height;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <ArrowLeft color="#f8fafc" size={24} />
        </TouchableOpacity>
        <Text style={styles.title}>Output Complete</Text>
        <TouchableOpacity style={styles.doneButton} onPress={onDone}>
          <Home color="#f8fafc" size={24} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.videoContainer}>
          <VideoView
            style={[styles.videoPlayer, { aspectRatio }]}
            player={player}
            contentFit="contain"
          />
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.filename}>{info.filename}</Text>
          
          <View style={styles.statsContainer}>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>Resolution</Text>
              <Text style={styles.statValue}>{info.width}x{info.height}</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>Duration</Text>
              <Text style={styles.statValue}>{(info.durationMs / 1000).toFixed(2)}s</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>Size</Text>
              <Text style={styles.statValue}>{(info.sizeBytes / 1024 / 1024).toFixed(2)} MB</Text>
            </View>
          </View>
        </View>

        <View style={styles.actionsContainer}>
          <TouchableOpacity 
            style={[styles.primaryButton, saved && { backgroundColor: '#10b981' }]}
            onPress={handleSaveToGallery}
          >
            {saved ? (
              <>
                <Check size={24} color="#ffffff" />
                <Text style={styles.primaryButtonText}>Saved to Gallery</Text>
              </>
            ) : (
              <>
                <Download size={24} color="#ffffff" />
                <Text style={styles.primaryButtonText}>Save to Gallery</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.secondaryButton, { marginTop: 16 }]}
            onPress={handleShare}
          >
            <Share2 size={24} color="#ffffff" />
            <Text style={styles.secondaryButtonText}>Share Video</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  doneButton: {
    padding: 8,
    marginRight: -8,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#f8fafc',
  },
  content: {
    padding: 20,
  },
  videoContainer: {
    backgroundColor: '#000000',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#334155',
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoPlayer: {
    width: '100%',
    maxHeight: 400,
  },
  infoCard: {
    backgroundColor: '#1e293b',
    borderRadius: 20,
    padding: 24,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#334155',
  },
  filename: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#f8fafc',
    marginBottom: 24,
    textAlign: 'center',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statBox: {
    alignItems: 'center',
    flex: 1,
  },
  statLabel: {
    fontSize: 13,
    color: '#94a3b8',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#f8fafc',
  },
  actionsContainer: {
    paddingBottom: 40,
  },
  primaryButton: {
    backgroundColor: '#6366f1',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    borderRadius: 20,
    gap: 12,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  secondaryButton: {
    backgroundColor: '#334155',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    borderRadius: 20,
    gap: 12,
    borderWidth: 1,
    borderColor: '#475569',
  },
  secondaryButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
