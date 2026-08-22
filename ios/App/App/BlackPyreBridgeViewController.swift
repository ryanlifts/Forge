import Foundation
import WebKit
import Capacitor
import ActivityKit

@objc(BlackPyreBridgeViewController)
final class BlackPyreBridgeViewController: CAPBridgeViewController {
    private let blackPyreDataPlugin = BlackPyreDataPlugin()
    private let blackPyreRestActivityPlugin = BlackPyreRestActivityPlugin()
    private var contentSizeObserver: NSObjectProtocol?

    deinit {
        if let contentSizeObserver {
            NotificationCenter.default.removeObserver(contentSizeObserver)
        }
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        contentSizeObserver = NotificationCenter.default.addObserver(
            forName: UIContentSizeCategory.didChangeNotification,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            self?.applyDynamicTypeScale()
        }
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        applyDynamicTypeScale()
    }

    override func webViewConfiguration(for instanceConfiguration: InstanceConfiguration) -> WKWebViewConfiguration {
        let configuration = super.webViewConfiguration(for: instanceConfiguration)
        let identifier = "BlackPyre/1.0 (+https://ryanlifts.github.io/Forge/support.html)"
        if let existing = configuration.applicationNameForUserAgent, !existing.isEmpty {
            configuration.applicationNameForUserAgent = "\(existing) \(identifier)"
        } else {
            configuration.applicationNameForUserAgent = identifier
        }
        let dynamicType = dynamicTypeParameters()
        configuration.userContentController.addUserScript(WKUserScript(
            source: dynamicTypeScript(scale: dynamicType.scale, category: dynamicType.category),
            injectionTime: .atDocumentEnd,
            forMainFrameOnly: true
        ))
        return configuration
    }

    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(blackPyreDataPlugin)
        bridge?.registerPluginInstance(blackPyreRestActivityPlugin)
        applyDynamicTypeScale()
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) { [weak self] in
            self?.applyDynamicTypeScale()
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 2.0) { [weak self] in
            self?.applyDynamicTypeScale()
        }
    }

    private func applyDynamicTypeScale() {
        let dynamicType = dynamicTypeParameters()
        webView?.evaluateJavaScript(dynamicTypeScript(
            scale: dynamicType.scale,
            category: dynamicType.category
        ))
    }

    private func dynamicTypeParameters() -> (scale: CGFloat, category: String) {
        let baseSize: CGFloat = 17
        let scaledSize = UIFontMetrics(forTextStyle: .body).scaledValue(
            for: baseSize,
            compatibleWith: traitCollection
        )
        let rawScale = scaledSize / baseSize
        let pageScale = min(max(1 + ((rawScale - 1) * 0.45), 0.9), 1.6)
        let category = UIApplication.shared.preferredContentSizeCategory.rawValue
        return (pageScale, category)
    }

    private func dynamicTypeScript(scale: CGFloat, category: String) -> String {
        """
        (() => {
          const scale = \(scale);
          const category = '\(category)';
          const excluded = 'script,style,svg,path,img,#brandLaunchOverlay *, .brand-story-header *, .hdr *';
          const apply = root => {
            const nodes = [];
            if (root instanceof Element) nodes.push(root);
            if (root === document && document.body) {
              nodes.push(...document.body.querySelectorAll('*'));
            } else if (root.querySelectorAll) {
              nodes.push(...root.querySelectorAll('*'));
            }
            for (const element of nodes) {
              if (element.matches(excluded)) continue;
              let base = Number(element.dataset.bpBaseFontSize || 0);
              if (!base) {
                base = parseFloat(getComputedStyle(element).fontSize);
                if (!Number.isFinite(base) || base < 8) continue;
                element.dataset.bpBaseFontSize = String(base);
              }
              const controlScale = element.matches('input,select,textarea')
                ? Math.min(scale, 1.25)
                : scale;
              element.style.setProperty('font-size', `${base * controlScale}px`, 'important');
            }
          };
          window.__bpDynamicTypeScale = scale;
          document.documentElement.dataset.bpDynamicType = category;
          apply(document);
          if (!window.__bpDynamicTypeObserver) {
            window.__bpDynamicTypeObserver = new MutationObserver(records => {
              for (const record of records) {
                for (const node of record.addedNodes) {
                  if (node instanceof Element) apply(node);
                }
              }
            });
            window.__bpDynamicTypeObserver.observe(document.body, { childList: true, subtree: true });
          }
        })();
        """
    }
}

@objc(BlackPyreRestActivityPlugin)
final class BlackPyreRestActivityPlugin: CAPPlugin, CAPBridgedPlugin {
    let identifier = "BlackPyreRestActivityPlugin"
    let jsName = "BlackPyreRestActivity"
    let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "sync", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "end", returnType: CAPPluginReturnPromise)
    ]

    @objc func sync(_ call: CAPPluginCall) {
        guard #available(iOS 16.1, *) else {
            call.resolve(["supported": false, "active": false])
            return
        }
        guard ActivityAuthorizationInfo().areActivitiesEnabled else {
            call.resolve(["supported": true, "enabled": false, "active": false])
            return
        }

        let status = call.getString("status") ?? "running"
        let paused = status == "paused"
        let remaining = max(0, call.getInt("remainingSec") ?? 0)
        let endAtMilliseconds = call.getDouble("endAt") ?? 0
        let endAt = paused
            ? Date().addingTimeInterval(TimeInterval(remaining))
            : Date(timeIntervalSince1970: endAtMilliseconds / 1000)

        guard paused ? remaining > 0 : endAt > Date() else {
            Task {
                await Self.endAllActivities()
                call.resolve(["supported": true, "enabled": true, "active": false])
            }
            return
        }

        let state = RestTimerActivityAttributes.ContentState(
            endAt: endAt,
            pausedRemaining: remaining,
            isPaused: paused
        )

        Task {
            let activities = Activity<RestTimerActivityAttributes>.activities
            if let primary = activities.first {
                await primary.update(using: state)
                for extra in activities.dropFirst() {
                    await extra.end(using: nil, dismissalPolicy: .immediate)
                }
                call.resolve([
                    "supported": true,
                    "enabled": true,
                    "active": true,
                    "id": primary.id
                ])
                return
            }

            do {
                let activity = try Activity.request(
                    attributes: RestTimerActivityAttributes(title: "BlackPyre Rest"),
                    contentState: state,
                    pushType: nil
                )
                call.resolve([
                    "supported": true,
                    "enabled": true,
                    "active": true,
                    "id": activity.id
                ])
            } catch {
                call.reject("BlackPyre could not start the Live Activity.", nil, error)
            }
        }
    }

    @objc func end(_ call: CAPPluginCall) {
        guard #available(iOS 16.1, *) else {
            call.resolve(["supported": false, "active": false])
            return
        }
        Task {
            await Self.endAllActivities()
            call.resolve(["supported": true, "active": false])
        }
    }

    @available(iOS 16.1, *)
    private static func endAllActivities() async {
        for activity in Activity<RestTimerActivityAttributes>.activities {
            await activity.end(using: nil, dismissalPolicy: .immediate)
        }
    }
}

@objc(BlackPyreDataPlugin)
final class BlackPyreDataPlugin: CAPPlugin, CAPBridgedPlugin {
    let identifier = "BlackPyreDataPlugin"
    let jsName = "BlackPyreData"
    let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "protectFile", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "readHealthCache", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "writeHealthCache", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "fetchFoodCatalog", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "fetchOpenFoodFacts", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "eraseNativeFiles", returnType: CAPPluginReturnPromise)
    ]

    private static let libraryNames: Set<String> = [
        "blackpyre-native-vault.json",
        "blackpyre-native-vault.candidate.json",
        "blackpyre-native-restore-quarantine.json",
        "blackpyre-health-cache.json"
    ]

    private static let documentExportPrefixes = [
        "blackpyre-backup-",
        "blackpyre-PARTIAL-"
    ]

    private static let healthCacheName = "blackpyre-health-cache.json"
    private static let healthCacheLimit = 2_000_000
    private static let foodCatalogCacheLimit = 50_000_000

    private static func foodCatalogCacheURL(key: String) -> URL? {
        guard !key.isEmpty,
              key.count <= 160,
              key.range(of: "^[A-Za-z0-9._:-]+$", options: .regularExpression) != nil,
              let root = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).first else {
            return nil
        }
        let directory = root.appendingPathComponent("BlackPyreFoodCatalog", isDirectory: true)
        do {
            try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
            return directory.appendingPathComponent(key + ".json", isDirectory: false)
        } catch {
            return nil
        }
    }

    private static func cachedFoodCatalogBody(key: String) -> String? {
        guard let url = foodCatalogCacheURL(key: key),
              let data = try? Data(contentsOf: url),
              data.count <= foodCatalogCacheLimit else {
            return nil
        }
        return String(data: data, encoding: .utf8)
    }

    @objc func fetchFoodCatalog(_ call: CAPPluginCall) {
        guard let rawURL = call.getString("url"),
              let cacheKey = call.getString("cacheKey"),
              let url = URL(string: rawURL),
              url.scheme == "https",
              let host = url.host?.lowercased(),
              host == "github.com",
              url.path.hasPrefix("/ryanlifts/BlackPyre-Food-Catalog/releases/") else {
            call.reject("Invalid BlackPyre Food Catalog request.")
            return
        }

        guard let cacheURL = Self.foodCatalogCacheURL(key: cacheKey) else {
            call.reject("Invalid BlackPyre Food Catalog cache key.")
            return
        }

        if call.getBool("offlineOnly") == true {
            if let cached = Self.cachedFoodCatalogBody(key: cacheKey) {
                call.resolve(["status": 200, "body": cached, "cached": true])
            } else {
                call.resolve(["status": 404, "body": "", "cached": false])
            }
            return
        }

        var request = URLRequest(url: url)
        request.timeoutInterval = 20
        request.cachePolicy = .reloadRevalidatingCacheData
        request.setValue(
            "BlackPyre/1.0 (blackpyrestrong@gmail.com)",
            forHTTPHeaderField: "User-Agent"
        )
        request.setValue("application/json", forHTTPHeaderField: "Accept")

        URLSession.shared.dataTask(with: request) { data, response, error in
            if let http = response as? HTTPURLResponse,
               (200..<300).contains(http.statusCode),
               let data,
               !data.isEmpty,
               data.count <= Self.foodCatalogCacheLimit,
               String(data: data, encoding: .utf8) != nil {
                do {
                    try data.write(to: cacheURL, options: .atomic)
                    call.resolve([
                        "status": http.statusCode,
                        "body": String(data: data, encoding: .utf8) ?? "",
                        "cached": false
                    ])
                    return
                } catch {
                    // The fresh result is still safe to return even if caching
                    // fails because iOS is under temporary storage pressure.
                    call.resolve([
                        "status": http.statusCode,
                        "body": String(data: data, encoding: .utf8) ?? "",
                        "cached": false
                    ])
                    return
                }
            }

            if let cached = Self.cachedFoodCatalogBody(key: cacheKey) {
                call.resolve(["status": 200, "body": cached, "cached": true])
                return
            }

            if let error {
                call.reject("BlackPyre Food Catalog could not be reached.", nil, error)
                return
            }
            let status = (response as? HTTPURLResponse)?.statusCode ?? 0
            call.resolve(["status": status, "body": "", "cached": false])
        }.resume()
    }

    @objc func fetchOpenFoodFacts(_ call: CAPPluginCall) {
        guard let rawURL = call.getString("url"),
              let url = URL(string: rawURL),
              url.scheme == "https",
              let host = url.host?.lowercased(),
              host == "openfoodfacts.org" || host.hasSuffix(".openfoodfacts.org") else {
            call.reject("Invalid Open Food Facts URL.")
            return
        }

        var request = URLRequest(url: url)
        request.timeoutInterval = 15
        request.setValue(
            "BlackPyre/1.0 (blackpyrestrong@gmail.com)",
            forHTTPHeaderField: "User-Agent"
        )
        request.setValue("application/json", forHTTPHeaderField: "Accept")

        URLSession.shared.dataTask(with: request) { data, response, error in
            if let error {
                call.reject("Open Food Facts could not be reached.", nil, error)
                return
            }
            guard let http = response as? HTTPURLResponse else {
                call.reject("Open Food Facts returned an invalid response.")
                return
            }
            let body = data.flatMap { String(data: $0, encoding: .utf8) } ?? ""
            call.resolve(["status": http.statusCode, "body": body])
        }.resume()
    }

    override func load() {
        Self.protectManagedFiles()
    }

    private static func directoryURL(named directory: String) -> URL? {
        switch directory {
        case "DOCUMENTS":
            return FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first
        case "LIBRARY":
            return FileManager.default.urls(for: .libraryDirectory, in: .userDomainMask).first
        default:
            return nil
        }
    }

    private static func isManaged(name: String, directory: String) -> Bool {
        if directory == "LIBRARY" {
            return libraryNames.contains(name)
        }
        return directory == "DOCUMENTS"
            && documentExportPrefixes.contains(where: { name.hasPrefix($0) })
            && name.hasSuffix(".json")
    }

    private static func managedURL(path: String, directory: String) -> URL? {
        guard path == URL(fileURLWithPath: path).lastPathComponent,
              isManaged(name: path, directory: directory),
              let base = directoryURL(named: directory) else {
            return nil
        }
        return base.appendingPathComponent(path, isDirectory: false)
    }

    @discardableResult
    private static func excludeFromBackup(_ url: URL) -> Bool {
        guard FileManager.default.fileExists(atPath: url.path) else {
            return false
        }
        do {
            var values = URLResourceValues()
            values.isExcludedFromBackup = true
            var mutableURL = url
            try mutableURL.setResourceValues(values)
            return try mutableURL.resourceValues(forKeys: [.isExcludedFromBackupKey]).isExcludedFromBackup == true
        } catch {
            return false
        }
    }

    static func protectManagedFiles() {
        for directory in ["DOCUMENTS", "LIBRARY"] {
            guard let base = directoryURL(named: directory),
                  let files = try? FileManager.default.contentsOfDirectory(
                    at: base,
                    includingPropertiesForKeys: nil,
                    options: [.skipsHiddenFiles]
                  ) else {
                continue
            }
            for file in files where isManaged(name: file.lastPathComponent, directory: directory) {
                _ = excludeFromBackup(file)
            }
        }
    }

    @objc func protectFile(_ call: CAPPluginCall) {
        guard let path = call.getString("path"),
              let directory = call.getString("directory"),
              let url = Self.managedURL(path: path, directory: directory) else {
            call.reject("BlackPyre refused an unmanaged backup path.")
            return
        }
        guard Self.excludeFromBackup(url) else {
            call.reject("BlackPyre could not exclude the file from device backup.")
            return
        }
        call.resolve(["protected": true])
    }

    @objc func readHealthCache(_ call: CAPPluginCall) {
        guard let url = Self.managedURL(path: Self.healthCacheName, directory: "LIBRARY") else {
            call.reject("BlackPyre could not resolve the health cache path.")
            return
        }
        guard FileManager.default.fileExists(atPath: url.path) else {
            call.resolve(["raw": NSNull(), "protected": true])
            return
        }
        guard Self.excludeFromBackup(url) else {
            call.reject("BlackPyre could not verify health cache backup exclusion.")
            return
        }
        do {
            let data = try Data(contentsOf: url)
            guard data.count <= Self.healthCacheLimit,
                  let raw = String(data: data, encoding: .utf8) else {
                call.reject("BlackPyre health cache is unreadable.")
                return
            }
            call.resolve(["raw": raw, "protected": true])
        } catch {
            call.reject("BlackPyre could not read the health cache.")
        }
    }

    @objc func writeHealthCache(_ call: CAPPluginCall) {
        guard let raw = call.getString("raw"),
              let data = raw.data(using: .utf8),
              data.count <= Self.healthCacheLimit,
              let object = try? JSONSerialization.jsonObject(with: data),
              let dictionary = object as? [String: Any],
              dictionary["healthFormatVersion"] as? Int == 1,
              dictionary["cacheKey"] as? String == "blackpyre:health-cache",
              let url = Self.managedURL(path: Self.healthCacheName, directory: "LIBRARY") else {
            call.reject("BlackPyre refused an invalid health cache record.")
            return
        }
        do {
            try data.write(to: url, options: .atomic)
            guard Self.excludeFromBackup(url) else {
                try? FileManager.default.removeItem(at: url)
                call.reject("BlackPyre could not exclude the health cache from device backup.")
                return
            }
            let verified = try Data(contentsOf: url)
            guard verified == data else {
                try? FileManager.default.removeItem(at: url)
                call.reject("BlackPyre health cache verification failed.")
                return
            }
            call.resolve(["written": true, "protected": true])
        } catch {
            call.reject("BlackPyre could not write the health cache.")
        }
    }

    @objc func eraseNativeFiles(_ call: CAPPluginCall) {
        let manager = FileManager.default
        var failures: [String] = []
        for directory in ["DOCUMENTS", "LIBRARY"] {
            guard let base = Self.directoryURL(named: directory),
                  let files = try? manager.contentsOfDirectory(
                    at: base,
                    includingPropertiesForKeys: nil,
                    options: [.skipsHiddenFiles]
                  ) else {
                continue
            }
            for file in files where Self.isManaged(name: file.lastPathComponent, directory: directory) {
                do {
                    try manager.removeItem(at: file)
                } catch {
                    failures.append(file.lastPathComponent)
                }
            }
        }
        if failures.isEmpty {
            call.resolve(["erased": true])
        } else {
            call.reject("BlackPyre could not erase: \(failures.joined(separator: ", ")).")
        }
    }
}
