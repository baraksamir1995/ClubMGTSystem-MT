import Flutter
import UIKit

class SceneDelegate: FlutterSceneDelegate {
  override func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
    super.scene(scene, willConnectTo: session, options: connectionOptions)
    bridgeWindow(scene)
  }

  override func sceneDidBecomeActive(_ scene: UIScene) {
    super.sceneDidBecomeActive(scene)
    bridgeWindow(scene)
  }

  /// Expose the scene's window via AppDelegate so plugins that use
  /// UIApplication.shared.delegate?.window (e.g. image_cropper) can find it.
  private func bridgeWindow(_ scene: UIScene) {
    guard let windowScene = scene as? UIWindowScene,
          let appDelegate = UIApplication.shared.delegate as? AppDelegate else { return }
    appDelegate.window = windowScene.keyWindow ?? windowScene.windows.first
  }
}
