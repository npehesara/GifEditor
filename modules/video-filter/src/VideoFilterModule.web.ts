import { registerWebModule, NativeModule } from 'expo';

// VideoFilterModule is not available on the web platform.
class VideoFilterModule extends NativeModule<{}> {}

export default registerWebModule(VideoFilterModule, 'VideoFilterModule');
