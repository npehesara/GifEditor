package expo.modules.videofilter

import android.os.Handler
import android.os.Looper
import android.view.View
import android.view.ViewGroup
import androidx.media3.common.Effect
import androidx.media3.effect.RgbMatrix
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.PlayerView
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class VideoFilterModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("VideoFilter")

    Function("applyColorMatrix") { viewTag: Int, matrix: List<Double>? ->
      Handler(Looper.getMainLooper()).post {
        val view = appContext.findView<View>(viewTag)
        if (view != null) {
          val playerView = findPlayerView(view)
          val player = playerView?.player as? ExoPlayer

          if (player != null) {
            if (matrix == null || matrix.size != 16) {
                player.setVideoEffects(emptyList())
            } else {
                val floatMatrix = FloatArray(16)
                // Transpose row-major (JS) to column-major (OpenGL)
                for (r in 0 until 4) {
                    for (c in 0 until 4) {
                        floatMatrix[c * 4 + r] = matrix[r * 4 + c].toFloat()
                    }
                }
                val effect = RgbMatrix { _, _ -> floatMatrix }
                player.setVideoEffects(listOf<Effect>(effect))
            }
          }
        }
      }
    }
  }

  private fun findPlayerView(view: View): PlayerView? {
      if (view is PlayerView) return view
      if (view is ViewGroup) {
          for (i in 0 until view.childCount) {
              val child = view.getChildAt(i)
              val result = findPlayerView(child)
              if (result != null) return result
          }
      }
      return null
  }
}
