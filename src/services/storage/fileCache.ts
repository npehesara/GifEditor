import { File, Directory, Paths } from 'expo-file-system';

class FileCacheService {
  private framesDir: Directory;
  private exportDir: Directory;

  constructor() {
    this.framesDir = new Directory(Paths.cache, 'gif_frames');
    this.exportDir = new Directory(Paths.cache, 'gif_exports');
    this.initDirs();
  }

  private initDirs() {
    try {
      if (!this.framesDir.exists) {
        this.framesDir.create();
      }
      if (!this.exportDir.exists) {
        this.exportDir.create();
      }
    } catch {
      // Dirs might already exist
    }
  }

  public async saveFrameDataUri(id: string, base64Png: string): Promise<string> {
    this.initDirs();
    const cleanBase64 = base64Png.replace(/^data:image\/\w+;base64,/, '');
    const file = new File(this.framesDir, `frame_${id}.png`);
    try {
      if (file.exists) {
        file.delete();
      }
      file.create();
      file.write(cleanBase64);
      return file.uri;
    } catch (e) {
      // If writing fails, return standard data URI as fallback
      return base64Png.startsWith('data:') ? base64Png : `data:image/png;base64,${cleanBase64}`;
    }
  }

  public async saveExportGif(filename: string, gifBytes: Uint8Array): Promise<string> {
    this.initDirs();
    const file = new File(this.exportDir, filename);
    if (file.exists) {
      file.delete();
    }
    file.create();
    file.write(gifBytes);
    return file.uri;
  }

  public async clearCache(): Promise<void> {
    try {
      if (this.framesDir.exists) {
        this.framesDir.delete();
      }
      if (this.exportDir.exists) {
        this.exportDir.delete();
      }
      this.initDirs();
    } catch (e) {
      console.warn('Failed to clear cache', e);
    }
  }
}

export const fileCache = new FileCacheService();
