import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, Image, TouchableOpacity, ActivityIndicator, SafeAreaView, ScrollView, Alert } from 'react-native';
import { ArrowLeft, Film, Settings2 } from 'lucide-react-native';
import { decodeGifFromUri, DecodedGifInfo, compositeGifFrames } from '../services/gif/decoder';

interface GifToVideoScreenProps {
  uri: string;
  onBack: () => void;
  onConversionComplete?: (info: { uri: string; filename: string; width: number; height: number; durationMs: number; sizeBytes: number }) => void;
}

export default function GifToVideoScreen({ uri, onBack, onConversionComplete }: GifToVideoScreenProps) {
  const [gifInfo, setGifInfo] = useState<DecodedGifInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [converting, setConverting] = useState(false);
  const [progressText, setProgressText] = useState('');
  const [resultUri, setResultUri] = useState<string | null>(null);
  const [resultSize, setResultSize] = useState<number>(0);

  useEffect(() => {
    let mounted = true;
    
    async function loadGifInfo() {
      try {
        setLoading(true);
        const info = await decodeGifFromUri(uri);
        if (mounted) {
          setGifInfo(info);
          setError(null);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to parse GIF');
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadGifInfo();
    return () => { mounted = false; };
  }, [uri]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <ArrowLeft color="#f8fafc" size={24} />
        </TouchableOpacity>
        <Text style={styles.title}>GIF → Video</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#06b6d4" />
            <Text style={styles.loadingText}>Analyzing GIF...</Text>
          </View>
        ) : error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : gifInfo ? (
          <>
            <View style={styles.imageContainer}>
              <Image 
                source={{ uri: gifInfo.uri }} 
                style={styles.image} 
                resizeMode="contain" 
              />
            </View>

            <View style={styles.infoCard}>
              <Text style={styles.filename}>{gifInfo.filename}</Text>
              
              <View style={styles.statsContainer}>
                <View style={styles.statBox}>
                  <Text style={styles.statLabel}>Dimensions</Text>
                  <Text style={styles.statValue}>{gifInfo.width}x{gifInfo.height}</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={styles.statLabel}>Frames</Text>
                  <Text style={styles.statValue}>{gifInfo.frameCount}</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={styles.statLabel}>Duration</Text>
                  <Text style={styles.statValue}>{gifInfo.durationSeconds.toFixed(2)}s</Text>
                </View>
              </View>
            </View>

              <TouchableOpacity 
                style={[styles.primaryButton, { marginTop: 16 }, converting && { opacity: 0.5 }]}
                disabled={converting}
                onPress={async () => {
                  try {
                    setConverting(true);
                    setProgressText('Preparing...');
                    
                    // 1. Create output file URI
                    const timestamp = new Date().getTime();
                    const outFile = new (require('expo-file-system').File)(require('expo-file-system').Paths.cache, `gif_to_video_${timestamp}.mp4`);
                    const outUri = outFile.uri;
                    
                    // 2. Decode and composite GIF frames (in JS)
                    setProgressText('Decoding frames...');
                    // Use setTimeout to yield to the UI thread so 'Decoding frames...' is rendered
                    await new Promise(resolve => setTimeout(resolve, 50));
                    const frames = compositeGifFrames(gifInfo);
                    
                    if (frames.length === 0) throw new Error('No frames found in GIF');
                    
                    // 3. Ensure even dimensions
                    const outWidth = gifInfo.width % 2 !== 0 ? gifInfo.width + 1 : gifInfo.width;
                    const outHeight = gifInfo.height % 2 !== 0 ? gifInfo.height + 1 : gifInfo.height;
                    
                    // 4. Initialize native encoder
                    setProgressText('Initializing encoder...');
                    const GifToVideoModule = require('../../modules/gif-to-video').default;
                    await GifToVideoModule.initVideoEncoder(outWidth, outHeight, 30, 2000000, outUri);
                    
                    // 5. Encode frames
                    for (let i = 0; i < frames.length; i++) {
                      setProgressText(`Encoding frame ${i + 1}/${frames.length}...`);
                      await GifToVideoModule.encodeFrame(frames[i].data, frames[i].delayMs);
                    }
                    
                    // 6. Finish encoder
                    setProgressText('Finalizing video...');
                    await GifToVideoModule.finishVideoEncoder();
                    
                    // 7. Verify
                    const exists = outFile.exists;
                    if (!exists) throw new Error('Failed to create MP4 file.');
                    
                    if (onConversionComplete) {
                      onConversionComplete({
                        uri: outUri,
                        filename: `gif_to_video_${timestamp}.mp4`,
                        width: outWidth,
                        height: outHeight,
                        durationMs: gifInfo.durationMs,
                        sizeBytes: outFile.size ?? 0
                      });
                    }
                  } catch (e: any) {
                    Alert.alert('Conversion Error', e.message);
                  } finally {
                    setConverting(false);
                  }
                }}
              >
                {converting ? (
                  <>
                    <ActivityIndicator color="#ffffff" />
                    <Text style={styles.primaryButtonText}>{progressText}</Text>
                  </>
                ) : (
                  <>
                    <Film size={24} color="#ffffff" />
                    <Text style={styles.primaryButtonText}>Convert to MP4</Text>
                  </>
                )}
              </TouchableOpacity>
          </>
        ) : null}
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
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#f8fafc',
  },
  content: {
    padding: 20,
  },
  loadingContainer: {
    paddingTop: 100,
    alignItems: 'center',
  },
  loadingText: {
    color: '#94a3b8',
    marginTop: 16,
    fontSize: 16,
  },
  errorContainer: {
    paddingTop: 100,
    alignItems: 'center',
  },
  errorText: {
    color: '#ef4444',
    fontSize: 16,
  },
  imageContainer: {
    backgroundColor: '#1e293b',
    borderRadius: 20,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#334155',
    aspectRatio: 1,
  },
  image: {
    width: '100%',
    height: '100%',
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
    fontSize: 18,
    fontWeight: 'bold',
    color: '#f8fafc',
  },
  primaryButton: {
    backgroundColor: '#06b6d4',
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
  successContainer: {
    backgroundColor: '#1e293b',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
    marginTop: 16,
  },
  successIconContainer: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    padding: 16,
    borderRadius: 40,
    marginBottom: 16,
  },
  successTitle: {
    color: '#f8fafc',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  successText: {
    color: '#94a3b8',
    fontSize: 14,
    marginBottom: 4,
  },
  successActions: {
    flexDirection: 'row',
    marginTop: 20,
    width: '100%',
  },
});
