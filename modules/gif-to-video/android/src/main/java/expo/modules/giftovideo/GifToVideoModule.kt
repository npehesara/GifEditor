package expo.modules.giftovideo

import android.media.MediaCodec
import android.media.MediaCodecInfo
import android.media.MediaCodecList
import android.media.MediaFormat
import android.media.MediaMuxer
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File
import java.nio.ByteBuffer

class GifToVideoModule : Module() {
  private var mediaCodec: MediaCodec? = null
  private var mediaMuxer: MediaMuxer? = null
  private var videoTrackIndex = -1
  private var isMuxerStarted = false
  private var outputPath: String? = null
  private var currentPtsMicro: Long = 0
  private var colorFormat = 0
  private var videoWidth = 0
  private var videoHeight = 0

  override fun definition() = ModuleDefinition {
    Name("GifToVideo")

    AsyncFunction("initVideoEncoder") { width: Int, height: Int, fps: Int, bitRate: Int, outPath: String ->
      try {
        val cleanPath = if (outPath.startsWith("file://")) outPath.substring(7) else outPath
        videoWidth = if (width % 2 != 0) width - 1 else width
        videoHeight = if (height % 2 != 0) height - 1 else height
        outputPath = cleanPath
        videoTrackIndex = -1
        isMuxerStarted = false
        currentPtsMicro = 0

        val mimeType = MediaFormat.MIMETYPE_VIDEO_AVC
        val codecInfo = selectCodec(mimeType) ?: throw Exception("No suitable H.264 encoder found")
        colorFormat = selectColorFormat(codecInfo, mimeType)
        if (colorFormat == 0) throw Exception("No supported YUV420 color format found")

        val format = MediaFormat.createVideoFormat(mimeType, videoWidth, videoHeight)
        format.setInteger(MediaFormat.KEY_COLOR_FORMAT, colorFormat)
        format.setInteger(MediaFormat.KEY_BIT_RATE, bitRate)
        format.setInteger(MediaFormat.KEY_FRAME_RATE, fps)
        format.setInteger(MediaFormat.KEY_I_FRAME_INTERVAL, 1)

        mediaCodec = MediaCodec.createByCodecName(codecInfo.name)
        mediaCodec?.configure(format, null, null, MediaCodec.CONFIGURE_FLAG_ENCODE)
        mediaCodec?.start()

        mediaMuxer = MediaMuxer(cleanPath, MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4)
        true
      } catch (e: Exception) {
        releaseResources()
        throw Exception("Failed to init encoder: ${e.message}")
      }
    }

    AsyncFunction("encodeFrame") { rgbaArray: ByteArray, durationMs: Long ->
      val codec = mediaCodec ?: throw Exception("Codec not initialized")

      val yuv420 = rgbaToYuv420(rgbaArray, videoWidth, videoHeight, colorFormat)

      val inputBufferIndex = codec.dequeueInputBuffer(10000)
      if (inputBufferIndex >= 0) {
        val inputBuffer = codec.getInputBuffer(inputBufferIndex)
        inputBuffer?.clear()
        inputBuffer?.put(yuv420)
        codec.queueInputBuffer(inputBufferIndex, 0, yuv420.size, currentPtsMicro, 0)
        currentPtsMicro += durationMs * 1000
      } else {
        throw Exception("No input buffer available")
      }

      drainEncoder(false)
      true
    }

    AsyncFunction("finishVideoEncoder") { ->
      val codec = mediaCodec ?: throw Exception("Codec not initialized")

      val inputBufferIndex = codec.dequeueInputBuffer(10000)
      if (inputBufferIndex >= 0) {
        codec.queueInputBuffer(inputBufferIndex, 0, 0, currentPtsMicro, MediaCodec.BUFFER_FLAG_END_OF_STREAM)
      }

      drainEncoder(true)
      val path = outputPath
      releaseResources()
      path
    }
  }

  private fun selectCodec(mimeType: String): MediaCodecInfo? {
    val numCodecs = MediaCodecList.getCodecCount()
    for (i in 0 until numCodecs) {
      val codecInfo = MediaCodecList.getCodecInfoAt(i)
      if (!codecInfo.isEncoder) continue
      val types = codecInfo.supportedTypes
      if (types.contains(mimeType)) return codecInfo
    }
    return null
  }

  private fun selectColorFormat(codecInfo: MediaCodecInfo, mimeType: String): Int {
    val capabilities = codecInfo.getCapabilitiesForType(mimeType)
    for (i in capabilities.colorFormats.indices) {
      val format = capabilities.colorFormats[i]
      if (isRecognizedFormat(format)) return format
    }
    return 0
  }

  private fun isRecognizedFormat(colorFormat: Int): Boolean {
    return when (colorFormat) {
      MediaCodecInfo.CodecCapabilities.COLOR_FormatYUV420Planar,
      MediaCodecInfo.CodecCapabilities.COLOR_FormatYUV420SemiPlanar -> true
      else -> false
    }
  }

  private fun rgbaToYuv420(rgba: ByteArray, width: Int, height: Int, colorFormat: Int): ByteArray {
    val frameSize = width * height
    val yuv = ByteArray(frameSize * 3 / 2)
    var yIndex = 0
    var uIndex = frameSize
    var vIndex = frameSize + frameSize / 4
    var uvIndex = frameSize

    var argbIndex = 0
    for (j in 0 until height) {
      for (i in 0 until width) {
        val r = rgba[argbIndex].toInt() and 0xFF
        val g = rgba[argbIndex + 1].toInt() and 0xFF
        val b = rgba[argbIndex + 2].toInt() and 0xFF

        val y = ((66 * r + 129 * g + 25 * b + 128) shr 8) + 16
        val u = ((-38 * r - 74 * g + 112 * b + 128) shr 8) + 128
        val v = ((112 * r - 94 * g - 18 * b + 128) shr 8) + 128

        yuv[yIndex++] = y.coerceIn(0, 255).toByte()

        if (j % 2 == 0 && i % 2 == 0) {
          if (colorFormat == MediaCodecInfo.CodecCapabilities.COLOR_FormatYUV420SemiPlanar) {
            yuv[uvIndex++] = u.coerceIn(0, 255).toByte()
            yuv[uvIndex++] = v.coerceIn(0, 255).toByte()
          } else {
            yuv[uIndex++] = u.coerceIn(0, 255).toByte()
            yuv[vIndex++] = v.coerceIn(0, 255).toByte()
          }
        }
        argbIndex += 4
      }
    }
    return yuv
  }

  private fun drainEncoder(endOfStream: Boolean) {
    val codec = mediaCodec ?: return
    val muxer = mediaMuxer ?: return
    val bufferInfo = MediaCodec.BufferInfo()

    while (true) {
      val outputBufferIndex = codec.dequeueOutputBuffer(bufferInfo, 10000)
      if (outputBufferIndex == MediaCodec.INFO_TRY_AGAIN_LATER) {
        if (!endOfStream) break
      } else if (outputBufferIndex == MediaCodec.INFO_OUTPUT_FORMAT_CHANGED) {
        if (isMuxerStarted) throw RuntimeException("Format changed twice")
        val newFormat = codec.outputFormat
        videoTrackIndex = muxer.addTrack(newFormat)
        muxer.start()
        isMuxerStarted = true
      } else if (outputBufferIndex >= 0) {
        val outputBuffer = codec.getOutputBuffer(outputBufferIndex)
        if (outputBuffer != null && bufferInfo.size != 0) {
          if (!isMuxerStarted) throw RuntimeException("Muxer hasn't started")
          outputBuffer.position(bufferInfo.offset)
          outputBuffer.limit(bufferInfo.offset + bufferInfo.size)
          muxer.writeSampleData(videoTrackIndex, outputBuffer, bufferInfo)
        }
        codec.releaseOutputBuffer(outputBufferIndex, false)
        if (bufferInfo.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM != 0) {
          break
        }
      }
    }
  }

  private fun releaseResources() {
    try {
      mediaCodec?.stop()
      mediaCodec?.release()
    } catch (e: Exception) {}
    mediaCodec = null

    try {
      if (isMuxerStarted) {
        mediaMuxer?.stop()
      }
      mediaMuxer?.release()
    } catch (e: Exception) {}
    mediaMuxer = null
  }
}
