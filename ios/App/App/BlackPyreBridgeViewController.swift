import Foundation
import WebKit
import Capacitor

@objc(BlackPyreBridgeViewController)
final class BlackPyreBridgeViewController: CAPBridgeViewController {
    private let blackPyreDataPlugin = BlackPyreDataPlugin()

    override func webViewConfiguration(for instanceConfiguration: InstanceConfiguration) -> WKWebViewConfiguration {
        let configuration = super.webViewConfiguration(for: instanceConfiguration)
        let identifier = "BlackPyre/1.0 (+https://ryanlifts.github.io/Forge/support.html)"
        if let existing = configuration.applicationNameForUserAgent, !existing.isEmpty {
            configuration.applicationNameForUserAgent = "\(existing) \(identifier)"
        } else {
            configuration.applicationNameForUserAgent = identifier
        }
        return configuration
    }

    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(blackPyreDataPlugin)
    }
}

@objc(BlackPyreDataPlugin)
final class BlackPyreDataPlugin: CAPPlugin, CAPBridgedPlugin {
    let identifier = "BlackPyreDataPlugin"
    let jsName = "BlackPyreData"
    let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "protectFile", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "eraseNativeFiles", returnType: CAPPluginReturnPromise)
    ]

    private static let libraryNames: Set<String> = [
        "blackpyre-native-vault.json",
        "blackpyre-native-vault.candidate.json",
        "blackpyre-native-restore-quarantine.json"
    ]

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
            && name.hasPrefix("blackpyre-")
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
