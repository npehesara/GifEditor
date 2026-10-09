import GifToVideoModule from './src/GifToVideoModule';

export async function runSyntheticVideoTest(outPath: string): Promise<void> {
  const width = 320;
  const height = 240;
  const frameSize = width * height * 4;

  // Create 3 frames (Red, Green, Blue)
  const redFrame = new Uint8Array(frameSize);
  const greenFrame = new Uint8Array(frameSize);
  const blueFrame = new Uint8Array(frameSize);

  for (let i = 0; i < frameSize; i += 4) {
    redFrame[i] = 255; redFrame[i + 1] = 0; redFrame[i + 2] = 0; redFrame[i + 3] = 255; // R
    greenFrame[i] = 0; greenFrame[i + 1] = 255; greenFrame[i + 2] = 0; greenFrame[i + 3] = 255; // G
    blueFrame[i] = 0; blueFrame[i + 1] = 0; blueFrame[i + 2] = 255; blueFrame[i + 3] = 255; // B
  }

  await GifToVideoModule.initVideoEncoder(width, height, 30, 2000000, outPath);
  await GifToVideoModule.encodeFrame(redFrame, 500);
  await GifToVideoModule.encodeFrame(greenFrame, 1000);
  await GifToVideoModule.encodeFrame(blueFrame, 500);

  await GifToVideoModule.finishVideoEncoder();
}

export { default } from './src/GifToVideoModule';
export * from './src/GifToVideo.types';
