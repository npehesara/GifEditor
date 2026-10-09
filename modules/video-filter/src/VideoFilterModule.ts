import { NativeModule, requireNativeModule } from 'expo';

declare class VideoFilterModule extends NativeModule {
  applyColorMatrix(viewRef: number, matrix: number[] | null): boolean;
}

export default requireNativeModule<VideoFilterModule>('VideoFilter');
