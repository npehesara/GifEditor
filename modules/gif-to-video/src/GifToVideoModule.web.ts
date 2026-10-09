import { registerWebModule, NativeModule } from 'expo';

// GifToVideoModule is not available on the web platform.
class GifToVideoModule extends NativeModule<{}> {}

export default registerWebModule(GifToVideoModule, 'GifToVideoModule');
