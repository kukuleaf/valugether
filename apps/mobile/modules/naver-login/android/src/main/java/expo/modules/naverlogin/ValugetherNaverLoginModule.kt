package expo.modules.naverlogin

import android.os.Handler
import android.os.Looper
import com.navercorp.nid.NidOAuth
import com.navercorp.nid.core.data.datastore.NidOAuthInitializingCallback
import com.navercorp.nid.oauth.domain.enum.LoginBehavior
import com.navercorp.nid.oauth.util.NidOAuthCallback
import expo.modules.kotlin.Promise
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class ValugetherNaverLoginModule : Module() {
  private val mainHandler = Handler(Looper.getMainLooper())
  private var pendingPromise: Promise? = null
  private var initialized = false

  override fun definition() = ModuleDefinition {
    Name("ValugetherNaverLogin")

    AsyncFunction("login") { reauthenticate: Boolean, promise: Promise ->
      if (begin(promise)) {
        initialize(promise) {
          if (reauthenticate) {
            // SDK refresh tokens would otherwise silently bypass the reauthentication screen.
            runSafely(promise) {
              NidOAuth.logout(callback(promise) { requestLogin(promise, true) })
            }
          } else {
            requestLogin(promise, false)
          }
        }
      }
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("logout") { promise: Promise ->
      if (begin(promise)) {
        initialize(promise) {
          runSafely(promise) {
            NidOAuth.logout(callback(promise) { resolve(promise, null) })
          }
        }
      }
    }.runOnQueue(Queues.MAIN)

    OnDestroy {
      mainHandler.post {
        pendingPromise?.let { reject(it, "E_NAVER_UNAVAILABLE", "네이버 로그인 화면이 종료되었습니다. 다시 시도해 주세요.") }
      }
    }
  }

  private fun begin(promise: Promise): Boolean {
    if (pendingPromise != null) {
      promise.reject("E_NAVER_BUSY", "네이버 로그인 요청을 처리하고 있습니다.", null)
      return false
    }
    pendingPromise = promise
    return true
  }

  private fun initialize(promise: Promise, onReady: () -> Unit) {
    if (initialized) {
      onReady()
      return
    }
    val context = appContext.reactContext
    if (context == null) {
      reject(promise, "E_NAVER_UNAVAILABLE", "네이버 로그인을 시작할 수 없습니다. 다시 시도해 주세요.")
      return
    }
    val clientId = context.getString(R.string.valugether_naver_client_id).trim()
    val clientSecret = context.getString(R.string.valugether_naver_client_secret).trim()
    if (clientId.isEmpty() || clientSecret.isEmpty()) {
      reject(promise, "E_NAVER_NOT_CONFIGURED", "네이버 로그인이 설정되지 않은 앱입니다.")
      return
    }
    runSafely(promise) {
      // Never log SDK tokens or exceptions containing provider response details.
      NidOAuth.setLogEnabled(false)
      NidOAuth.initialize(
        context.applicationContext,
        clientId,
        clientSecret,
        context.getString(R.string.valugether_naver_client_name),
        object : NidOAuthInitializingCallback {
          override fun onSuccess() = onMain(promise) {
            initialized = true
            onReady()
          }

          override fun onFailure(e: Exception) = onMain(promise) {
            reject(promise, "E_NAVER_INITIALIZE", "네이버 로그인 초기화에 실패했습니다. 다시 시도해 주세요.")
          }
        },
      )
    }
  }

  private fun requestLogin(promise: Promise, reauthenticate: Boolean) {
    val activity = appContext.currentActivity
    if (activity == null || activity.isFinishing || activity.isDestroyed) {
      reject(promise, "E_NAVER_UNAVAILABLE", "앱 화면으로 돌아온 뒤 다시 시도해 주세요.")
      return
    }
    runSafely(promise) {
      // Only the SDK's Custom Tabs mode supports its explicit reauthentication flag.
      // Normal login keeps the official SDK's Naver-app-first behavior.
      NidOAuth.behavior = if (reauthenticate) LoginBehavior.CUSTOMTABS else LoginBehavior.DEFAULT
      NidOAuth.isRequiredCustomTabsReAuth = reauthenticate
      NidOAuth.isShowMarketLink = false
      NidOAuth.requestLogin(activity, callback(promise) {
        val accessToken = NidOAuth.getAccessToken()
        val refreshToken = NidOAuth.getRefreshToken()
        if (accessToken.isNullOrBlank() || refreshToken.isNullOrBlank()) {
          reject(promise, "E_NAVER_EMPTY_TOKEN", "네이버 인증 정보를 받지 못했습니다. 다시 시도해 주세요.")
        } else {
          resolve(promise, mapOf("accessToken" to accessToken, "refreshToken" to refreshToken))
        }
      })
    }
  }

  private fun callback(promise: Promise, onSuccess: () -> Unit) = object : NidOAuthCallback {
    override fun onSuccess() = onMain(promise, onSuccess)

    override fun onFailure(errorCode: String, errorDesc: String) = onMain(promise) {
      if (errorCode == "user_cancel") {
        reject(promise, "E_NAVER_CANCELLED", "네이버 로그인을 취소했습니다.")
      } else {
        reject(promise, "E_NAVER_LOGIN", "네이버 인증에 실패했습니다. 네트워크를 확인하고 다시 시도해 주세요.")
      }
    }
  }

  private fun onMain(promise: Promise, action: () -> Unit) {
    mainHandler.post {
      if (pendingPromise === promise) runSafely(promise, action)
    }
  }

  private fun runSafely(promise: Promise, action: () -> Unit) {
    if (pendingPromise !== promise) return
    try {
      action()
    } catch (e: Exception) {
      reject(promise, "E_NAVER_LOGIN", "네이버 인증을 실행하지 못했습니다. 다시 시도해 주세요.")
    }
  }

  private fun clear(promise: Promise): Boolean {
    if (pendingPromise !== promise) return false
    pendingPromise = null
    NidOAuth.oauthLoginCallback = null
    NidOAuth.isRequiredCustomTabsReAuth = false
    NidOAuth.behavior = LoginBehavior.DEFAULT
    return true
  }

  private fun resolve(promise: Promise, value: Any?) {
    if (clear(promise)) promise.resolve(value)
  }

  private fun reject(promise: Promise, code: String, message: String) {
    if (clear(promise)) promise.reject(code, message, null)
  }
}
