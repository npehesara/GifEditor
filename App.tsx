import { StatusBar } from 'expo-status-bar';
import { StyleSheet, SafeAreaView, Alert, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import React, { useState } from 'react';
import * as ImagePicker from 'expo-image-picker';

import { useFonts } from 'expo-font';
import { Roboto_400Regular, Roboto_700Bold } from '@expo-google-fonts/roboto';
import { Lato_400Regular } from '@expo-google-fonts/lato';
import { Oswald_400Regular } from '@expo-google-fonts/oswald';
import { Raleway_400Regular } from '@expo-google-fonts/raleway';
import { Montserrat_400Regular } from '@expo-google-fonts/montserrat';
import { Poppins_400Regular } from '@expo-google-fonts/poppins';
import { Nunito_400Regular } from '@expo-google-fonts/nunito';
import { PlayfairDisplay_400Regular } from '@expo-google-fonts/playfair-display';
import { Merriweather_400Regular } from '@expo-google-fonts/merriweather';
import { Lora_400Regular } from '@expo-google-fonts/lora';
import { PTSerif_400Regular } from '@expo-google-fonts/pt-serif';
import { DancingScript_400Regular } from '@expo-google-fonts/dancing-script';
import { Pacifico_400Regular } from '@expo-google-fonts/pacifico';
import { AmaticSC_400Regular } from '@expo-google-fonts/amatic-sc';
import { Bangers_400Regular } from '@expo-google-fonts/bangers';
import { FjallaOne_400Regular } from '@expo-google-fonts/fjalla-one';
import { Righteous_400Regular } from '@expo-google-fonts/righteous';
import { Lobster_400Regular } from '@expo-google-fonts/lobster';
import { AbrilFatface_400Regular } from '@expo-google-fonts/abril-fatface';
import { Anton_400Regular } from '@expo-google-fonts/anton';
import HomeScreen from './src/screens/HomeScreen';
import PreviewScreen from './src/screens/PreviewScreen';
import GifEditorScreen from './src/screens/GifEditorScreen';
import GifToVideoScreen from './src/screens/GifToVideoScreen';
import Mp4OutputScreen from './src/screens/Mp4OutputScreen';
import VideoToGifScreen from './src/screens/VideoToGifScreen';
import GifOutputScreen, { GifOutputInfo } from './src/screens/GifOutputScreen';
import GifCollageScreen from './src/screens/GifCollageScreen';
import { DecodedGifInfo } from './src/services/gif/decoder';

type ScreenState = 'Home' | 'Preview' | 'GifEditor' | 'GifToVideo' | 'Mp4Output' | 'VideoToGif' | 'GifOutput' | 'GifCollage';

export interface Mp4OutputInfo {
  uri: string;
  filename: string;
  width: number;
  height: number;
  durationMs: number;
  sizeBytes: number;
}

export interface SelectedVideoInfo {
  uri: string;
  filename: string;
  width: number;
  height: number;
  durationMs: number;
}

export default function App() {
  const [fontsLoaded] = useFonts({
    Roboto_400Regular, Roboto_700Bold,
    Lato_400Regular, Oswald_400Regular, Raleway_400Regular, Montserrat_400Regular,
    Poppins_400Regular, Nunito_400Regular, PlayfairDisplay_400Regular,
    Merriweather_400Regular, Lora_400Regular, PTSerif_400Regular,
    DancingScript_400Regular, Pacifico_400Regular, AmaticSC_400Regular,
    Bangers_400Regular, FjallaOne_400Regular, Righteous_400Regular,
    Lobster_400Regular, AbrilFatface_400Regular, Anton_400Regular
  });

  const [currentScreen, setCurrentScreen] = useState<ScreenState>('Home');
  const [selectedGifUri, setSelectedGifUri] = useState<string | null>(null);
  const [mp4Info, setMp4Info] = useState<Mp4OutputInfo | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<SelectedVideoInfo | null>(null);
  const [gifInfo, setGifInfo] = useState<GifOutputInfo | null>(null);

  if (!fontsLoaded) {
    return null; // Or a loading spinner
  }

  const pickGif = async (): Promise<string | null> => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 1,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const uri = asset.uri;
        const fileName = asset.fileName || '';
        const mimeType = asset.mimeType || '';

        // Check if it's a GIF
        const isGifByMime = mimeType === 'image/gif';
        const isGifByExt = uri.toLowerCase().endsWith('.gif') || fileName.toLowerCase().endsWith('.gif');

        if (!isGifByMime && !isGifByExt) {
          Alert.alert('Invalid format', 'Please select a valid GIF file.');
          return null;
        }

        return uri;
      }
    } catch (error) {
      console.warn('Error picking image:', error);
      Alert.alert('Error', 'Could not open image picker.');
    }
    return null;
  };

  const pickVideo = async (): Promise<SelectedVideoInfo | null> => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['videos'],
        allowsEditing: false,
        quality: 1,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        return {
          uri: asset.uri,
          filename: asset.fileName || asset.uri.split('/').pop() || 'video.mp4',
          width: asset.width || 0,
          height: asset.height || 0,
          durationMs: asset.duration || 0,
        };
      }
    } catch (error) {
      console.warn('Error picking video:', error);
      Alert.alert('Error', 'Could not open video picker.');
    }
    return null;
  };

  const handleImportGif = async () => {
    const uri = await pickGif();
    if (uri) {
      setSelectedGifUri(uri);
      setCurrentScreen('GifEditor');
    }
  };

  const handleGifToVideo = async () => {
    const uri = await pickGif();
    if (uri) {
      setSelectedGifUri(uri);
      setCurrentScreen('GifToVideo');
    }
  };

  const handleVideoToGif = async () => {
    const videoInfo = await pickVideo();
    if (videoInfo) {
      setSelectedVideo(videoInfo);
      setCurrentScreen('VideoToGif');
    }
  };

  const handleGifCollage = () => {
    setCurrentScreen('GifCollage');
  };

  const handleConversionComplete = (info: Mp4OutputInfo) => {
    setMp4Info(info);
    setCurrentScreen('Mp4Output');
  };

  const handleGifCreationComplete = (info: GifOutputInfo) => {
    setGifInfo(info);
    setCurrentScreen('GifOutput');
  };

  const handleBackToHome = () => {
    setSelectedGifUri(null);
    setMp4Info(null);
    setSelectedVideo(null);
    setGifInfo(null);
    setCurrentScreen('Home');
  };

  const handleBackToGifToVideo = () => {
    setCurrentScreen('GifToVideo');
  };

  const handleBackToVideoToGif = () => {
    setCurrentScreen('VideoToGif');
  };

  const handleStartEditing = (info: DecodedGifInfo) => {
    Alert.alert('Coming soon', `Editor not implemented yet for: ${info.filename}`);
  };

  return (
    <SafeAreaProvider>
      <View style={styles.container}>
        <StatusBar style="light" />
        {currentScreen === 'Home' && (
          <HomeScreen
            onImportGif={handleImportGif}
            onGifToVideo={handleGifToVideo}
            onVideoToGif={handleVideoToGif}
            onGifCollage={handleGifCollage}
          />
        )}
        {currentScreen === 'GifEditor' && selectedGifUri && (
          <GifEditorScreen
            uri={selectedGifUri}
            onBack={handleBackToHome}
            onExport={handleGifCreationComplete}
          />
        )}
        {currentScreen === 'GifToVideo' && selectedGifUri && (
          <GifToVideoScreen
            uri={selectedGifUri}
            onBack={handleBackToHome}
            onConversionComplete={handleConversionComplete}
          />
        )}
        {currentScreen === 'Mp4Output' && mp4Info && (
          <Mp4OutputScreen
            info={mp4Info}
            onBack={handleBackToGifToVideo}
            onDone={handleBackToHome}
          />
        )}
        {currentScreen === 'VideoToGif' && selectedVideo && (
          <VideoToGifScreen
            videoInfo={selectedVideo}
            onBack={handleBackToHome}
            onConversionComplete={handleGifCreationComplete}
          />
        )}
        {currentScreen === 'GifOutput' && gifInfo && (
          <GifOutputScreen
            info={gifInfo}
            onBack={handleBackToVideoToGif}
            onDone={handleBackToHome}
          />
        )}
        {currentScreen === 'GifCollage' && (
          <GifCollageScreen
            onBack={handleBackToHome}
            onConversionComplete={handleGifCreationComplete}
          />
        )}
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
});
