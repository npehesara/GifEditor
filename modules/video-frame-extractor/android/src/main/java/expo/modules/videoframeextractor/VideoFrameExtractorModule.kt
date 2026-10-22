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
  private var videoRotation: Int = 0

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
        val rotStr = localRetriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_ROTATION)
        val rotation = rotStr?.toIntOrNull() ?: 0

        val resultList = mutableListOf<Map<String, Any>>()
        var currentMs = startTimeMs
        while (currentMs <= endTimeMs) {
          var bitmap = localRetriever.getFrameAtTime((currentMs * 1000L).toLong(), MediaMetadataRetriever.OPTION_CLOSEST)
          if (bitmap != null) {
            if (rotation != 0) {
              val matrix = android.graphics.Matrix()
              matrix.postRotate(rotation.toFloat())
              val rotated = Bitmap.createBitmap(bitmap, 0, 0, bitmap.width, bitmap.height, matrix, true)
              bitmap.recycle()
              bitmap = rotated
            }
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
        videoRotation = rotation

        // Swap dimensions if video is rotated 90 or 270 degrees
        if (rotation == 90 || rotation == 270) {
          val temp = originalWidth
          originalWidth = originalHeight
          originalHeight = temp
        }

        // Calculate proportional scale
        val scale = Math.min(maxWidth.toFloat() / originalWidth, maxHeight.toFloat() / originalHeight)
        if (scale < 1.0f) {
          targetWidth = Math.max(2, Math.round(originalWidth * scale))
          targetHeight = Math.max(2, Math.round(originalHeight * scale))
        } else {
          targetWidth = originalWidth
          targetHeight = originalHeight
        }

        // Ensure even dimensions
        if (targetWidth % 2 != 0) targetWidth -= 1
        if (targetHeight % 2 != 0) targetHeight -= 1
        targetWidth = Math.max(2, targetWidth)
        targetHeight = Math.max(2, targetHeight)

        promise.resolve(mapOf("width" to targetWidth, "height" to targetHeight))
      } catch (e: Exception) {
        promise.reject("ERR_BEGIN_EXTRACT", e.message, e)
      }
    }

    AsyncFunction("getFrame") { timestampMs: Double, options: Map<String, Any>?, promise: Promise ->
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

        if (videoRotation != 0) {
          val matrix = android.graphics.Matrix()
          matrix.postRotate(videoRotation.toFloat())
          val rotated = Bitmap.createBitmap(bitmap, 0, 0, bitmap.width, bitmap.height, matrix, true)
          bitmap.recycle()
          bitmap = rotated
        }

        // Scale if needed
        if (bitmap.width != targetWidth || bitmap.height != targetHeight) {
          val scaled = Bitmap.createScaledBitmap(bitmap, targetWidth, targetHeight, true)
          bitmap.recycle()
          bitmap = scaled
        }

        var finalBitmap = Bitmap.createBitmap(targetWidth, targetHeight, Bitmap.Config.ARGB_8888)
        val canvas = android.graphics.Canvas(finalBitmap)
        val paint = android.graphics.Paint()

        // Apply ColorMatrix if provided
        if (options != null && options.containsKey("colorMatrix")) {
          val matrixList = options["colorMatrix"] as? List<Double>
          if (matrixList != null && matrixList.size == 20) {
            val floatArray = FloatArray(20)
            for (i in 0 until 20) floatArray[i] = matrixList[i].toFloat()
            val colorMatrix = android.graphics.ColorMatrix(floatArray)
            paint.colorFilter = android.graphics.ColorMatrixColorFilter(colorMatrix)
          }
        }
        
        canvas.drawBitmap(bitmap, 0f, 0f, paint)
        bitmap.recycle()

        // Draw text layers
        if (options != null && options.containsKey("textLayers")) {
          val textLayers = options["textLayers"] as? List<Map<String, Any>>
          if (textLayers != null) {
            for (layer in textLayers) {
              val text = layer["text"] as? String ?: continue
              val startMs = (layer["startMs"] as? Double) ?: 0.0
              val endMs = (layer["endMs"] as? Double) ?: Double.MAX_VALUE
              
              if (timestampMs < startMs || timestampMs > endMs) continue

              val xPercent = (layer["x"] as? Double) ?: 50.0
              val yPercent = (layer["y"] as? Double) ?: 50.0
              val scale = (layer["scale"] as? Double) ?: 1.0
              val rotation = (layer["rotation"] as? Double) ?: 0.0
              val fontSize = (layer["fontSize"] as? Double) ?: 48.0
              val color = (layer["color"] as? String) ?: "#FFFFFF"
              
              val textPaint = android.graphics.Paint().apply {
                isAntiAlias = true
                textSize = (fontSize * scale).toFloat()
                this.color = android.graphics.Color.parseColor(color)
              }

              val isBold = (layer["isBold"] as? Boolean) ?: false
              val isItalic = (layer["isItalic"] as? Boolean) ?: false
              val typefaceStyle = if (isBold && isItalic) android.graphics.Typeface.BOLD_ITALIC else if (isBold) android.graphics.Typeface.BOLD else if (isItalic) android.graphics.Typeface.ITALIC else android.graphics.Typeface.NORMAL

              val fontFamily = layer["fontFamily"] as? String
              val context = appContext.reactContext
              val typeface = if (!fontFamily.isNullOrBlank() && fontFamily != "sans-serif") {
                try {
                  val clazz = Class.forName("com.facebook.react.common.assets.ReactFontManager")
                  val instance = clazz.getMethod("getInstance").invoke(null)
                  
                  // 1. Direct query from fontCache (where expo-font's FontLoaderModule caches custom fonts under Typeface.NORMAL)
                  var resolvedTf: android.graphics.Typeface? = null
                  try {
                    val fontCacheField = clazz.getDeclaredField("fontCache").apply { isAccessible = true }
                    val fontCache = fontCacheField.get(instance) as? Map<*, *>
                    val assetFontFamily = fontCache?.get(fontFamily)
                    if (assetFontFamily != null) {
                      val getTfMethod = assetFontFamily.javaClass.getDeclaredMethod("getTypefaceForStyle", Int::class.javaPrimitiveType).apply { isAccessible = true }
                      resolvedTf = getTfMethod.invoke(assetFontFamily, android.graphics.Typeface.NORMAL) as? android.graphics.Typeface
                    }
                  } catch (e: Exception) {}

                  // 2. Direct query from customTypefaceCache
                  if (resolvedTf == null) {
                    try {
                      val customCacheField = clazz.getDeclaredField("customTypefaceCache").apply { isAccessible = true }
                      val customCache = customCacheField.get(instance) as? Map<*, *>
                      resolvedTf = customCache?.get(fontFamily) as? android.graphics.Typeface
                    } catch (e: Exception) {}
                  }

                  // 3. Fallback: getTypeface via method reflection with Typeface.NORMAL
                  if (resolvedTf == null) {
                    val method = clazz.methods.firstOrNull { 
                      it.name == "getTypeface" && it.parameterTypes.size == 3 && it.parameterTypes[0] == String::class.java 
                    }
                    val tf = method?.invoke(instance, fontFamily, android.graphics.Typeface.NORMAL, context?.assets) as? android.graphics.Typeface
                    if (tf != null && tf != android.graphics.Typeface.DEFAULT) {
                      resolvedTf = tf
                    }
                  }

                  if (resolvedTf != null) {
                    if (isItalic && isBold) {
                      android.graphics.Typeface.create(resolvedTf, android.graphics.Typeface.BOLD_ITALIC)
                    } else if (isBold && !fontFamily.contains("Bold", ignoreCase = true)) {
                      android.graphics.Typeface.create(resolvedTf, android.graphics.Typeface.BOLD)
                    } else if (isItalic && !fontFamily.contains("Italic", ignoreCase = true)) {
                      android.graphics.Typeface.create(resolvedTf, android.graphics.Typeface.ITALIC)
                    } else {
                      resolvedTf
                    }
                  } else {
                    android.graphics.Typeface.create(fontFamily, typefaceStyle)
                  }
                } catch (e: Exception) {
                  null
                } ?: try {
                  android.graphics.Typeface.create(fontFamily, typefaceStyle)
                } catch (e: Exception) {
                  android.graphics.Typeface.create(android.graphics.Typeface.DEFAULT, typefaceStyle)
                }
              } else {
                android.graphics.Typeface.create(android.graphics.Typeface.DEFAULT, typefaceStyle)
              }
              textPaint.typeface = typeface

              val x = (xPercent / 100.0 * targetWidth).toFloat()
              val y = (yPercent / 100.0 * targetHeight).toFloat()
              
              canvas.save()
              canvas.rotate(rotation.toFloat(), x, y)

              val lines = text.split("\n")
              val fontMetrics = textPaint.fontMetrics
              val lineHeight = (fontMetrics.descent - fontMetrics.ascent) * 1.05f
              val totalHeight = lines.size * lineHeight
              // Center vertically at y (matching SVG preview)
              val firstBaselineY = y - (totalHeight / 2f) - fontMetrics.ascent

              val textAlign = (layer["textAlign"] as? String) ?: "center"
              val maxLineWidth = lines.map { textPaint.measureText(it) }.maxOrNull() ?: 0f

              // Background
              val backgroundEnabled = (layer["backgroundEnabled"] as? Boolean) ?: false
              if (backgroundEnabled) {
                try {
                  val bgColor = (layer["backgroundColor"] as? String) ?: "#000000"
                  val bgOpacity = (layer["backgroundOpacity"] as? Double) ?: 1.0
                  val bgPadding = ((layer["backgroundPadding"] as? Double) ?: 8.0).toFloat() * scale.toFloat()
                  val bgPaint = android.graphics.Paint().apply {
                    isAntiAlias = true
                    this.color = android.graphics.Color.parseColor(bgColor)
                    alpha = (bgOpacity * 255.0).toInt().coerceIn(0, 255)
                    style = android.graphics.Paint.Style.FILL
                  }
                  val bgLeft = x - maxLineWidth / 2f - bgPadding
                  val bgTop = y - totalHeight / 2f - bgPadding
                  val bgRight = x + maxLineWidth / 2f + bgPadding
                  val bgBottom = y + totalHeight / 2f + bgPadding
                  canvas.drawRoundRect(bgLeft, bgTop, bgRight, bgBottom, 8f, 8f, bgPaint)
                } catch (e: Exception) {}
              }

              // Shadow
              val shadowEnabled = (layer["shadowEnabled"] as? Boolean) ?: false
              if (shadowEnabled) {
                try {
                  val shadowColor = (layer["shadowColor"] as? String) ?: "#000000"
                  val shadowDx = ((layer["shadowOffsetX"] as? Double) ?: 2.0).toFloat()
                  val shadowDy = ((layer["shadowOffsetY"] as? Double) ?: 2.0).toFloat()
                  textPaint.setShadowLayer(4f, shadowDx, shadowDy, android.graphics.Color.parseColor(shadowColor))
                } catch (e: Exception) {}
              }

              // Outline
              val outlineEnabled = (layer["outlineEnabled"] as? Boolean) ?: false
              var outlinePaint: android.graphics.Paint? = null
              if (outlineEnabled) {
                try {
                  val outlineColor = (layer["outlineColor"] as? String) ?: "#000000"
                  val outlineWidth = (layer["outlineWidth"] as? Double) ?: 2.0
                  outlinePaint = android.graphics.Paint(textPaint).apply {
                    style = android.graphics.Paint.Style.STROKE
                    strokeWidth = (outlineWidth * scale).toFloat() * 2f
                    this.color = android.graphics.Color.parseColor(outlineColor)
                    clearShadowLayer()
                  }
                } catch (e: Exception) {}
              }

              // Set Align.LEFT on paints and compute exact start X for each line to guarantee pixel-perfect centering
              textPaint.textAlign = android.graphics.Paint.Align.LEFT
              outlinePaint?.textAlign = android.graphics.Paint.Align.LEFT

              for (i in lines.indices) {
                val line = lines[i]
                val lineW = textPaint.measureText(line)
                val lineX = when (textAlign) {
                  "left" -> x - maxLineWidth / 2f
                  "right" -> x + maxLineWidth / 2f - lineW
                  else -> x - lineW / 2f
                }
                val lineY = firstBaselineY + i * lineHeight
                if (outlinePaint != null) {
                  canvas.drawText(line, lineX, lineY, outlinePaint)
                }
                canvas.drawText(line, lineX, lineY, textPaint)
              }

              canvas.restore()
            }
          }
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
