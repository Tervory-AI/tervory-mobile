import UIKit
import Capacitor
import WebKit
import CryptoKit
import Security

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        window = UIWindow(windowScene: windowScene)
        window?.rootViewController = MobileViewController()
        window?.makeKeyAndVisible()

        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
        if let url = connectionOptions.userActivities.first?.webpageURL {
            MobileShell.shared?.receiveLink(url)
        }
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
        if let url = userActivity.webpageURL { MobileShell.shared?.receiveLink(url) }
    }

    func sceneDidBecomeActive(_ scene: UIScene) {
        MobileShell.shared?.resumeShare()
    }
}

class MobileViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(MobileShell())
        if let handler = webView?.navigationDelegate as? WKScriptMessageHandler,
           let controller = webView?.configuration.userContentController {
            controller.removeScriptMessageHandler(forName: "bridge")
            controller.add(TrustedBridgeHandler(forward: handler), name: "bridge")
        }
        if let url = Bundle.main.url(forResource: "native", withExtension: "js", subdirectory: "public"),
           let script = try? String(contentsOf: url, encoding: .utf8) {
            webView?.configuration.userContentController.addUserScript(
                WKUserScript(source: script, injectionTime: .atDocumentEnd, forMainFrameOnly: true))
        }
    }
}

class TrustedBridgeHandler: NSObject, WKScriptMessageHandler {
    private let forward: WKScriptMessageHandler

    init(forward: WKScriptMessageHandler) {
        self.forward = forward
        super.init()
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        let origin = message.frameInfo.securityOrigin
        guard message.frameInfo.isMainFrame, origin.protocol == "https",
              origin.host == "app.tervory.com", origin.port == 0 || origin.port == 443 else { return }
        forward.userContentController(userContentController, didReceive: message)
    }
}

@objc(MobileShell)
class MobileShell: CAPPlugin, CAPBridgedPlugin {
    let identifier = "MobileShell"
    let jsName = "MobileShell"
    let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "beginSignIn", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "pending", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "acknowledge", returnType: CAPPluginReturnPromise)
    ]
    static weak var shared: MobileShell?
    private let origin = "https://app.tervory.com"
    private var state: String?
    private var verifier: String?
    private var started = Date.distantPast
    private var auth: [String: String]?

    override func load() { MobileShell.shared = self }

    private func trusted(_ url: URL?) -> Bool {
        guard let url else { return false }
        return url.scheme == "https" && url.host == "app.tervory.com"
            && (url.port == nil || url.port == 443) && url.user == nil && url.password == nil
    }

    override func shouldOverrideLoad(_ navigationAction: WKNavigationAction) -> NSNumber? {
        guard navigationAction.targetFrame?.isMainFrame != false,
              let url = navigationAction.request.url, trusted(url) else { return nil }
        if url.path == "/sign-in" || url.path.hasPrefix("/sign-in/") || url.path == "/mobile/sign-in" {
            DispatchQueue.main.async { self.signIn() }
            return true
        }
        return nil
    }

    private func randomValue() -> String? {
        var bytes = [UInt8](repeating: 0, count: 32)
        guard SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes) == errSecSuccess else { return nil }
        return encode(Data(bytes))
    }

    private func encode(_ data: Data) -> String {
        data.base64EncodedString().replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_").replacingOccurrences(of: "=", with: "")
    }

    private func signIn() {
        guard bridge?.viewController?.presentedViewController == nil else { return }
        let alert = UIAlertController(title: "Trigger sign-in",
            message: "Continue in your browser to sign in to Tervory.", preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "Cancel", style: .cancel))
        alert.addAction(UIAlertAction(title: "Continue", style: .default) { _ in self.openSignIn() })
        bridge?.viewController?.present(alert, animated: true)
    }

    private func openSignIn() {
        guard let newState = randomValue(), let newVerifier = randomValue() else { return }
        state = newState
        verifier = newVerifier
        started = Date()
        let challenge = encode(Data(SHA256.hash(data: Data(newVerifier.utf8))))
        var components = URLComponents(string: origin + "/mobile/sign-in")!
        components.queryItems = [
            URLQueryItem(name: "redirect_uri", value: origin + "/mobile/callback"),
            URLQueryItem(name: "state", value: newState),
            URLQueryItem(name: "code_challenge", value: challenge),
            URLQueryItem(name: "code_challenge_method", value: "S256")
        ]
        if let url = components.url { UIApplication.shared.open(url) }
    }

    func receiveLink(_ url: URL) {
        if trusted(url), url.path == "/mobile/share" { resumeShare(); return }
        guard trusted(url), url.path == "/mobile/callback", url.fragment == nil,
              let items = URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems,
              items.filter({ $0.name == "state" }).count == 1,
              items.filter({ $0.name == "code" }).count == 1,
              let returnedState = items.first(where: { $0.name == "state" })?.value,
              let state, state == returnedState, let verifier,
              Date().timeIntervalSince(started) < 300,
              let code = items.first(where: { $0.name == "code" })?.value,
              code.range(of: "^[A-Za-z0-9_-]{16,512}$", options: .regularExpression) != nil else { return }
        auth = ["code": code, "verifier": verifier]
        self.state = nil
        self.verifier = nil
        DispatchQueue.main.async {
            self.webView?.load(URLRequest(url: URL(string: self.origin + "/mobile/bridge")!))
        }
    }

    @objc func pending(_ call: CAPPluginCall) {
        guard trusted(webView?.url) else { call.reject("Untrusted page"); return }
        var result: [String: Any] = [:]
        if let auth { result["auth"] = auth }
        if let share = pendingShare() { result["share"] = share }
        call.resolve(result)
    }

    @objc func beginSignIn(_ call: CAPPluginCall) {
        guard trusted(webView?.url) else { call.reject("Untrusted page"); return }
        DispatchQueue.main.async { self.signIn() }
        call.resolve()
    }

    @objc func acknowledge(_ call: CAPPluginCall) {
        guard trusted(webView?.url) else { call.reject("Untrusted page"); return }
        if call.getString("kind") == "auth" { auth = nil }
        if call.getString("kind") == "share", let id = call.getString("id"),
           let share = pendingShare(), share["id"] as? String == id, let url = shareURL() {
            try? FileManager.default.removeItem(at: url)
        }
        call.resolve()
    }

    private func shareURL() -> URL? {
        FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: "group.com.tervory.app")?
            .appendingPathComponent("share-inbox.json")
    }

    private func pendingShare() -> [String: Any]? {
        guard let url = shareURL(), let attributes = try? FileManager.default.attributesOfItem(atPath: url.path),
              let size = attributes[.size] as? NSNumber, size.intValue <= 15 * 1024 * 1024,
              let data = try? Data(contentsOf: url),
              let share = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any],
              let created = share["created"] as? Double else { return nil }
        guard Date().timeIntervalSince1970 - created < 86400 else {
            try? FileManager.default.removeItem(at: url)
            return nil
        }
        return share
    }

    func resumeShare() {
        guard pendingShare() != nil else { return }
        DispatchQueue.main.async {
            self.webView?.load(URLRequest(url: URL(string: self.origin + "/chats")!))
        }
    }
}
