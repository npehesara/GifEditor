import { registerWebModule, NativeModule } from 'expo';

class VideoFrameExtractorModule extends NativeModule<{}> {}

export default registerWebModule(VideoFrameExtractorModule, 'VideoFrameExtractorModule');
