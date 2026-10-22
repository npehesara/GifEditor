import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, Alert, ActivityIndicator, Image, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Settings2 } from 'lucide-react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { SelectedVideoInfo } from '../../App';
import VideoFrameExtractorModule from '../../modules/video-frame-extractor/src/VideoFrameExtractorModule';
import { Header } from '../components/common/Header';
// @ts-ignore
import { GIFEncoder, quantize, applyPalette } from 'gifenc';
import * as FileSystem from 'expo-file-system';
import { Buffer } from 'buffer';
import { GifOutputInfo } from './GifOutputScreen';
import { Colors } from '../constants/colors';

interface VideoToGifScreenProps {
  videoInfo: SelectedVideoInfo;
  onBack: () => void;
  onConversionComplete: (info: GifOutputInfo) => void;
}

export default function VideoToGifScreen({ videoInfo, onBack, onConversionComplete }: VideoToGifScreenProps) {
  const [extracting, setExtracting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const player = useVideoPlayer(videoInfo.uri, player => {
    player.loop = true;
    player.play();
  });

  const aspectRatio = videoInfo.width && videoInfo.height ? videoInfo.width / videoInfo.height : 1;

  useEffect(() => {
    if (videoInfo.durationMs > 60000) {
      setError('Video is too long.\nPlease select a video up to 60 seconds.');
    }
  }, [videoInfo]);

  const handleCreateGif = async () => {
    if (videoInfo.durationMs > 60000) {
      Alert.alert('Too long', 'Please select a video up to 60 seconds.');
      return;
    }

    try {
      setExtracting(true);
      setError(null);
      setProgress(0);

      // 10 FPS = 100ms interval
      const intervalMs = 100;
      const durationMs = videoInfo.durationMs;
      const totalFrames = Math.floor(durationMs / intervalMs);
      
      if (totalFrames <= 0) {
        throw new Error('Video is too short to extract frames.');
      }

      // Max 480x480
      const targetSize = await VideoFrameExtractorModule.beginExtraction(videoInfo.uri, 480, 480);
      
      const gif = GIFEncoder();
      
      for (let i = 0; i <= totalFrames; i++) {
        const timestampMs = i * intervalMs;
        const rgbaBuffer = await VideoFrameExtractorModule.getFrame(timestampMs);
        
        if (rgbaBuffer) {
          // Quantize and add to GIF
          const palette = quantize(rgbaBuffer, 256, { format: 'rgba4444' });
          const index = applyPalette(rgbaBuffer, palette, 'rgba4444');
          gif.writeFrame(index, targetSize.width, targetSize.height, {
            palette,
            delay: intervalMs
          });
        }
        
        setProgress(Math.round(((i + 1) / (totalFrames + 1)) * 100));
        
        // Small delay to allow UI to update
        await new Promise(resolve => setTimeout(resolve, 5));
      }
      
      gif.finish();
      const outputBuffer = gif.bytes();
      
      await VideoFrameExtractorModule.endExtraction();
      
      // Save GIF using new FileSystem API
      const filename = `video_to_gif_${Date.now()}.gif`;
      const fileInfo = new FileSystem.File(FileSystem.Paths.cache, filename);
      await fileInfo.write(outputBuffer);
      const outUri = fileInfo.uri;
      
      onConversionComplete({
        uri: outUri,
        filename: filename,
        width: targetSize.width,
        height: targetSize.height,
        durationMs: totalFrames * intervalMs,
        sizeBytes: outputBuffer.length
      });

    } catch (err: any) {
      setError(err.message || 'Failed to create GIF.');
      try {
        await VideoFrameExtractorModule.endExtraction();
      } catch (e) {}
    } finally {
      setExtracting(false);
    }
  };

  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      <Header title="Video → GIF" onBack={onBack} />

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}>
        <View style={styles.videoContainer}>
          <VideoView
            style={[styles.videoPlayer, { aspectRatio }]}
            player={player}
            contentFit="contain"
          />
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.filename}>{videoInfo.filename}</Text>
          
          <View style={styles.statsContainer}>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>Resolution</Text>
              <Text style={styles.statValue}>
                {videoInfo.width}x{videoInfo.height}
              </Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>Duration</Text>
              <Text style={styles.statValue}>
                {(videoInfo.durationMs / 1000).toFixed(2)}s
              </Text>
            </View>
          </View>
        </View>

        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <TouchableOpacity 
          style={[styles.primaryButton, (extracting || videoInfo.durationMs > 60000) && { opacity: 0.5 }]}
          onPress={handleCreateGif}
          disabled={extracting || videoInfo.durationMs > 60000}
        >
          {extracting ? (
            <>
              <ActivityIndicator color="#ffffff" />
              <Text style={styles.primaryButtonText}>Creating GIF... {progress}%</Text>
            </>
          ) : (
            <>
              <Settings2 size={24} color="#ffffff" />
              <Text style={styles.primaryButtonText}>Create GIF</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text,
  },
  content: {
    padding: 20,
  },
  videoContainer: {
    backgroundColor: Colors.previewBg,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: Colors.border,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoPlayer: {
    width: '100%',
    maxHeight: 400,
  },
  infoCard: {
    backgroundColor: Colors.card,
    borderRadius: 20,
    padding: 24,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filename: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 24,
    textAlign: 'center',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statBox: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
  },
  primaryButton: {
    backgroundColor: Colors.primary,
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
  errorContainer: {
    padding: 16,
    backgroundColor: 'rgba(244, 63, 94, 0.12)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(244, 63, 94, 0.35)',
    marginBottom: 20,
  },
  errorText: {
    color: Colors.danger,
    textAlign: 'center',
  },
  framesResultContainer: {
    backgroundColor: Colors.card,
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 40,
  },
  framesResultTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 8,
  },
  framesResultSubtitle: {
    color: Colors.textSecondary,
    marginBottom: 16,
  },
  timestampsList: {
    maxHeight: 150,
    backgroundColor: Colors.backgroundDark,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  timestampText: {
    color: Colors.secondaryLight,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginBottom: 4,
  },
  previewFrameContainer: {
    alignItems: 'center',
  },
  previewFrameTitle: {
    color: Colors.textSecondary,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
  },
  previewImage: {
    width: '100%',
    borderRadius: 12,
    backgroundColor: Colors.previewBg,
  },
});
