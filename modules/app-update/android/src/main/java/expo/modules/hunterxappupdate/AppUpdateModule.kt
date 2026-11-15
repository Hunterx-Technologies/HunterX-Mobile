package expo.modules.hunterxappupdate

import com.google.android.play.core.appupdate.AppUpdateInfo
import com.google.android.play.core.appupdate.AppUpdateManager
import com.google.android.play.core.appupdate.AppUpdateManagerFactory
import com.google.android.play.core.appupdate.AppUpdateOptions
import com.google.android.play.core.install.model.AppUpdateType
import com.google.android.play.core.install.model.UpdateAvailability
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Google Play in-app updates, immediate flow only: Play's own full-screen
 * "Update" page that downloads and installs the new version, then restarts
 * the app. Only works for installs that came from Play; anywhere else
 * (sideloaded APKs, emulators without Play) Play reports no update.
 */
class AppUpdateModule : Module() {
  private val manager: AppUpdateManager by lazy {
    val context = appContext.reactContext ?: throw Exceptions.ReactContextLost()
    AppUpdateManagerFactory.create(context)
  }

  // An immediate update that was interrupted (app killed mid-download) has to
  // be resumed, so it counts as "update available" too.
  private fun hasUpdate(info: AppUpdateInfo): Boolean {
    val availability = info.updateAvailability()
    return availability == UpdateAvailability.UPDATE_AVAILABLE ||
      availability == UpdateAvailability.DEVELOPER_TRIGGERED_UPDATE_IN_PROGRESS
  }

  override fun definition() = ModuleDefinition {
    Name("HunterxAppUpdate")

    AsyncFunction("checkForUpdate") { promise: Promise ->
      manager.appUpdateInfo
        .addOnSuccessListener { info ->
          promise.resolve(
            mapOf(
              "updateAvailable" to hasUpdate(info),
              "immediateAllowed" to info.isUpdateTypeAllowed(AppUpdateType.IMMEDIATE),
              "storeVersionCode" to info.availableVersionCode(),
            )
          )
        }
        .addOnFailureListener { error ->
          promise.reject(CodedException("ERR_UPDATE_CHECK", error.message ?: "Update check failed", error))
        }
    }

    // Resolves true when Play's update page was shown. When the user backs out
    // of it the app simply comes back; JS keeps its own blocking screen up.
    AsyncFunction("startImmediateUpdate") { promise: Promise ->
      manager.appUpdateInfo
        .addOnSuccessListener { info ->
          if (!hasUpdate(info) || !info.isUpdateTypeAllowed(AppUpdateType.IMMEDIATE)) {
            promise.resolve(false)
            return@addOnSuccessListener
          }
          val activity = appContext.currentActivity
          if (activity == null) {
            promise.resolve(false)
            return@addOnSuccessListener
          }
          try {
            manager.startUpdateFlow(info, activity, AppUpdateOptions.defaultOptions(AppUpdateType.IMMEDIATE))
            promise.resolve(true)
          } catch (e: Exception) {
            promise.reject(CodedException("ERR_UPDATE_START", e.message ?: "Could not start the update", e))
          }
        }
        .addOnFailureListener { error ->
          promise.reject(CodedException("ERR_UPDATE_START", error.message ?: "Could not start the update", error))
        }
    }
  }
}
