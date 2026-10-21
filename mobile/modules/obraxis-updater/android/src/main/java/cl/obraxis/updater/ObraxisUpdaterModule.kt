package cl.obraxis.updater

import android.app.DownloadManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Environment
import android.os.Build
import android.provider.Settings
import androidx.core.content.FileProvider
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.security.MessageDigest

class ObraxisUpdaterModule : Module() {
  private val context get() = requireNotNull(appContext.reactContext)
  private val manager get() = context.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
  private val prefs get() = context.getSharedPreferences("obraxis_updates", Context.MODE_PRIVATE)
  private fun file(hash: String): File {
    require(hash.matches(Regex("[a-fA-F0-9]{64}")))
    val directory = requireNotNull(context.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS)) {
      "No hay almacenamiento disponible para la actualización."
    }
    return File(directory, "updates/$hash.apk")
  }
  private fun digest(target: File): String {
    val hash = MessageDigest.getInstance("SHA-256")
    target.inputStream().buffered().use { input ->
      val buffer = ByteArray(65536)
      while (true) { val count = input.read(buffer); if (count < 0) break; hash.update(buffer, 0, count) }
    }
    return hash.digest().joinToString("") { "%02x".format(it.toInt() and 255) }
  }
  override fun definition() = ModuleDefinition {
    Name("ObraxisUpdater")
    AsyncFunction("start") { url: String, hash: String ->
      require(url.matches(Regex("https://expo\\.dev/artifacts/eas/[A-Za-z0-9_-]+\\.apk")))
      val target = file(hash)
      val previous = prefs.getLong("id", -1)
      if (previous != -1L) manager.remove(previous)
      target.parentFile?.mkdirs()
      target.parentFile?.listFiles()?.forEach { it.delete() }
      val request = DownloadManager.Request(Uri.parse(url))
        .setTitle("Actualización de Obraxis")
        .setDescription("Descargando la nueva versión")
        .setMimeType("application/vnd.android.package-archive")
        .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE)
        .setDestinationUri(Uri.fromFile(target))
      val id = manager.enqueue(request)
      prefs.edit().putLong("id", id).putString("hash", hash).remove("verified").apply()
    }
    AsyncFunction("status") { hash: String ->
      val target = file(hash)
      val id = prefs.getLong("id", -1)
      if (prefs.getString("hash", "") != hash || id == -1L) {
        mapOf("status" to "idle", "progress" to 0.0)
      } else {
        manager.query(DownloadManager.Query().setFilterById(id)).use { cursor ->
          if (!cursor.moveToFirst()) return@AsyncFunction mapOf("status" to "idle", "progress" to 0.0)
          val status = cursor.getInt(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS))
          val bytes = cursor.getLong(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_BYTES_DOWNLOADED_SO_FAR))
          val total = cursor.getLong(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_TOTAL_SIZE_BYTES))
          when (status) {
            DownloadManager.STATUS_SUCCESSFUL -> {
              if (!target.exists() || prefs.getString("verified", "") != hash) {
                if (!target.exists() || digest(target) != hash.lowercase()) {
                  manager.remove(id); target.delete(); prefs.edit().clear().apply()
                  throw IllegalStateException("El archivo no coincide con la actualización publicada. Vuelve a descargarlo.")
                }
                prefs.edit().putString("verified", hash).apply()
              }
              mapOf("status" to "ready", "progress" to 1.0)
            }
            DownloadManager.STATUS_FAILED -> {
              manager.remove(id); target.delete(); prefs.edit().clear().apply()
              throw IllegalStateException("No se pudo descargar la actualización. Revisa tu conexión y el espacio disponible.")
            }
            else -> mapOf("status" to "downloading", "progress" to if (total > 0) bytes.toDouble() / total else 0.0)
          }
        }
      }
    }
    AsyncFunction("cancel") {
      val id = prefs.getLong("id", -1)
      if (id != -1L) manager.remove(id)
      prefs.getString("hash", null)?.let { file(it).delete() }
      prefs.edit().clear().apply()
    }
    AsyncFunction("install") { hash: String ->
      val target = file(hash)
      require(target.exists() && prefs.getString("verified", "") == hash && digest(target) == hash.lowercase()) {
        "El archivo no está listo. Vuelve a descargar la actualización."
      }
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && !context.packageManager.canRequestPackageInstalls()) {
        context.startActivity(Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:${context.packageName}")).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        "permission"
      } else {
        val uri = FileProvider.getUriForFile(context, "${context.packageName}.updates", target)
        context.startActivity(Intent(Intent.ACTION_VIEW).setDataAndType(uri, "application/vnd.android.package-archive")
          .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_GRANT_READ_URI_PERMISSION))
        "installer"
      }
    }
  }
}
