package expo.modules.videoframeextractor

import android.graphics.Bitmap
import android.media.MediaMetadataRetriever
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.io.FileOutputStream
import java.util.UUID
import expo.modules.kotlin.Promise

class VideoFrameExtractorModule : Module() {
  private var retriever: MediaMetadataRetriever? = null
  private var targetWidth: Int = -1
  private var targetHeight: Int = -1

  override fun definition() = ModuleDefinition {
    Name("VideoFrameExtractor")

    AsyncFunction("extractFrames") { videoUri: String, startTimeMs: Double, endTimeMs: Double, intervalMs: Double, promise: Promise ->
      val localRetriever = MediaMetadataRetriever()
      try {
        val path = if (videoUri.startsWith("file://")) videoUri.substring(7) else videoUri
        localRetriever.setDataSource(path)
        val cacheDir = appContext.reactContext?.cacheDir
        if (cacheDir == null) {
          promise.reject("ERR_CACHE_DIR", "Cache directory is not available", null)
          return@AsyncFunction
        }
        val resultList = mutableListOf<Map<String, Any>>()
        var currentMs = startTimeMs
        while (currentMs <= endTimeMs) {
          val bitmap = localRetriever.getFrameAtTime((currentMs * 1000L).toLong(), MediaMetadataRetriever.OPTION_CLOSEST)
          if (bitmap != null) {
            val fileName = "frame_${UUID.randomUUID()}_${currentMs.toLong()}.png"
            val file = File(cacheDir, fileName)
            FileOutputStream(file).use { out ->
              bitmap.compress(Bitmap.CompressFormat.PNG, 100, out)
            }
            bitmap.recycle()
            resultList.add(mapOf("timestampMs" to currentMs, "uri" to "file://${file.absolutePath}"))
          }
          currentMs += intervalMs
        }
        promise.resolve(resultList)
      } catch (e: Exception) {
        promise.reject("ERR_EXTRACT_FRAMES", e.message, e)
      } finally {
        localRetriever.release()
      }
    }

    AsyncFunction("beginExtraction") { videoUri: String, maxWidth: Int, maxHeight: Int, promise: Promise ->
      try {
        if (retriever != null) {
          retriever?.release()
        }
        retriever = MediaMetadataRetriever()
        val path = if (videoUri.startsWith("file://")) videoUri.substring(7) else videoUri
        retriever?.setDataSource(path)

        // Read intrinsic dimensions to calculate aspect ratio
        val widthStr = retriever?.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_WIDTH)
        val heightStr = retriever?.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_HEIGHT)
        val rotStr = retriever?.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_ROTATION)

        var originalWidth = widthStr?.toIntOrNull() ?: maxWidth
        var originalHeight = heightStr?.toIntOrNull() ?: maxHeight
        val rotation = rotStr?.toIntOrNull() ?: 0

        // Swap dimensions if video is rotated 90 or 270 degrees
        if (rotation == 90 || rotation == 270) {
          val temp = originalWidth
          originalWidth = originalHeight
          originalHeight = temp
        }

        // Calculate proportional scale
        val scale = Math.min(maxWidth.toFloat() / originalWidth, maxHeight.toFloat() / originalHeight)
        if (scale < 1.0f) {
          targetWidth = (originalWidth * scale).toInt()
          targetHeight = (originalHeight * scale).toInt()
        } else {
          targetWidth = originalWidth
          targetHeight = originalHeight
        }

        // Ensure even dimensions
        if (targetWidth % 2 != 0) targetWidth += 1
        if (targetHeight % 2 != 0) targetHeight += 1

        promise.resolve(mapOf("width" to targetWidth, "height" to targetHeight))
      } catch (e: Exception) {
        promise.reject("ERR_BEGIN_EXTRACT", e.message, e)
      }
    }

    AsyncFunction("getFrame") { timestampMs: Double, promise: Promise ->
      try {
        val r = retriever
        if (r == null) {
          promise.reject("ERR_NO_RETRIEVER", "Call beginExtraction first", null)
          return@AsyncFunction
        }

        var bitmap = r.getFrameAtTime((timestampMs * 1000L).toLong(), MediaMetadataRetriever.OPTION_CLOSEST)
        if (bitmap == null) {
          promise.resolve(null)
          return@AsyncFunction
        }

        // Scale if needed
        if (bitmap.width != targetWidth || bitmap.height != targetHeight) {
          val scaled = Bitmap.createScaledBitmap(bitmap, targetWidth, targetHeight, true)
          bitmap.recycle()
          bitmap = scaled
        }

        // Must ensure ARGB_8888 for consistent 4 bytes per pixel
        var finalBitmap = bitmap
        if (bitmap.config != Bitmap.Config.ARGB_8888) {
          finalBitmap = bitmap.copy(Bitmap.Config.ARGB_8888, false)
          bitmap.recycle()
        }

        val size = finalBitmap.width * finalBitmap.height * 4
        val buffer = java.nio.ByteBuffer.allocate(size)
        finalBitmap.copyPixelsToBuffer(buffer)

        val bytes = buffer.array()
        finalBitmap.recycle()

        promise.resolve(bytes)
      } catch (e: Exception) {
        promise.reject("ERR_GET_FRAME", e.message, e)
      }
    }

    AsyncFunction("endExtraction") { promise: Promise ->
      try {
        retriever?.release()
        retriever = null
        promise.resolve(null)
      } catch (e: Exception) {
        promise.reject("ERR_END_EXTRACT", e.message, e)
      }
    }

    AsyncFunction("decodeImage") { imageUri: String, maxWidth: Int, maxHeight: Int, promise: Promise ->
      try {
        val path = if (imageUri.startsWith("file://")) imageUri.substring(7) else imageUri
        var bitmap = android.graphics.BitmapFactory.decodeFile(path)
        if (bitmap == null) {
          promise.reject("ERR_DECODE_IMAGE", "Could not decode image at path: $path", null)
          return@AsyncFunction
        }

        // Scale if needed
        var targetW = bitmap.width
        var targetH = bitmap.height
        val scale = Math.min(maxWidth.toFloat() / targetW, maxHeight.toFloat() / targetH)
        if (scale < 1.0f) {
          targetW = (targetW * scale).toInt()
          targetH = (targetH * scale).toInt()
        }

        // Ensure even dimensions
        if (targetW % 2 != 0) targetW -= 1
        if (targetH % 2 != 0) targetH -= 1

        if (bitmap.width != targetW || bitmap.height != targetH) {
          val scaled = Bitmap.createScaledBitmap(bitmap, targetW, targetH, true)
          bitmap.recycle()
          bitmap = scaled
        }

        // Must ensure ARGB_8888 for consistent 4 bytes per pixel
        var finalBitmap = bitmap
        if (bitmap.config != Bitmap.Config.ARGB_8888) {
          finalBitmap = bitmap.copy(Bitmap.Config.ARGB_8888, false)
          bitmap.recycle()
        }

        val size = finalBitmap.width * finalBitmap.height * 4
        val buffer = java.nio.ByteBuffer.allocate(size)
        finalBitmap.copyPixelsToBuffer(buffer)

        val bytes = buffer.array()

        val result = mapOf(
          "width" to finalBitmap.width,
          "height" to finalBitmap.height,
          "rgba" to bytes
        )

        finalBitmap.recycle()

        promise.resolve(result)
      } catch (e: Exception) {
        promise.reject("ERR_DECODE_IMAGE_EX", e.message, e)
      }
    }
  }
}
