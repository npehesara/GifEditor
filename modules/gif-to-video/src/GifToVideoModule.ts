import { NativeModule, requireNativeModule } from 'expo';

declare class GifToVideoModule extends NativeModule<{}> {
  initVideoEncoder(width: number, height: number, fps: number, bitRate: number, outPath: string): Promise<boolean>;
  encodeFrame(rgbaArray: Uint8Array, durationMs: number): Promise<boolean>;
  finishVideoEncoder(): Promise<string>;
}

export default requireNativeModule<GifToVideoModule>('GifToVideo');
