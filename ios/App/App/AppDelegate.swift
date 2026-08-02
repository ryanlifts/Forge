import UIKit
import Capacitor
import Vision
import CoreImage
import ImageIO

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Override point for customization after application launch.
        return true
    }

    func applicationWillResignActive(_ application: UIApplication) {
        // Sent when the application is about to move from active to inactive state. This can occur for certain types of temporary interruptions (such as an incoming phone call or SMS message) or when the user quits the application and it begins the transition to the background state.
        // Use this method to pause ongoing tasks, disable timers, and invalidate graphics rendering callbacks. Games should use this method to pause the game.
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        // Use this method to release shared resources, save user data, invalidate timers, and store enough application state information to restore your application to its current state in case it is terminated later.
        // If your application supports background execution, this method is called instead of applicationWillTerminate: when the user quits.
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
        // Called as part of the transition from the background to the active state; here you can undo many of the changes made on entering the background.
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        // Restart any tasks that were paused (or not yet started) while the application was inactive. If the application was previously in the background, optionally refresh the user interface.
    }

    func applicationWillTerminate(_ application: UIApplication) {
        // Called when the application is about to terminate. Save data if appropriate. See also applicationDidEnterBackground:.
    }

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        // Called when the app was launched with a url. Feel free to add additional processing here,
        // but if you want the App API to support tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        // Called when the app was launched with an activity, including Universal Links.
        // Feel free to add additional processing here, but if you want the App API to support
        // tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }

}

// MARK: - BlackPyre Nutrition Label Scanner

@objc(BlackPyreBridgeViewController)
open class BlackPyreBridgeViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(
            NutritionLabelScannerPlugin()
        )
    }
}

@objc(NutritionLabelScannerPlugin)
public class NutritionLabelScannerPlugin:
    CAPPlugin,
    CAPBridgedPlugin
{
    public let identifier =
        "NutritionLabelScannerPlugin"

    public let jsName =
        "NutritionLabelScanner"

    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(
            name: "recognize",
            returnType: CAPPluginReturnPromise
        )
    ]

    private struct OCRVariant {
        let name: String
        let image: CIImage
    }

    private func exifOrientation(
        for orientation: UIImage.Orientation
    ) -> CGImagePropertyOrientation {
        switch orientation {
        case .up:
            return .up
        case .upMirrored:
            return .upMirrored
        case .down:
            return .down
        case .downMirrored:
            return .downMirrored
        case .left:
            return .left
        case .leftMirrored:
            return .leftMirrored
        case .right:
            return .right
        case .rightMirrored:
            return .rightMirrored
        @unknown default:
            return .up
        }
    }

    private func variants(
        for image: UIImage
    ) -> [OCRVariant] {
        guard
            let input = CIImage(image: image)
        else {
            return []
        }

        let oriented = input.oriented(
            exifOrientation(
                for: image.imageOrientation
            )
        )

        let contrast = oriented
            .applyingFilter(
                "CIColorControls",
                parameters: [
                    kCIInputSaturationKey: 0.0,
                    kCIInputContrastKey: 2.35,
                    kCIInputBrightnessKey: 0.05
                ]
            )
            .applyingFilter(
                "CISharpenLuminance",
                parameters: [
                    kCIInputSharpnessKey: 0.85
                ]
            )

        let inverted =
            contrast.applyingFilter(
                "CIColorInvert"
            )

        return [
            OCRVariant(
                name: "original",
                image: oriented
            ),
            OCRVariant(
                name: "contrast",
                image: contrast
            ),
            OCRVariant(
                name: "inverted",
                image: inverted
            )
        ]
    }

    private func recognize(
        image: CIImage,
        pass: String,
        frame: CGRect = CGRect(
            x: 0,
            y: 0,
            width: 1,
            height: 1
        ),
        minimumTextHeight: Float = 0.0025
    ) throws -> [[String: Any]] {
        let request =
            VNRecognizeTextRequest()

        request.recognitionLevel = .accurate
        request.usesLanguageCorrection = false
        request.recognitionLanguages = ["en-US"]
        request.minimumTextHeight =
            minimumTextHeight

        request.customWords = [
            "Nutrition Facts",
            "Serving size",
            "Calories",
            "Calories per serving",
            "Total Fat",
            "Total Carbohydrate",
            "Protein",
            "bottle",
            "serving",
            "10",
            "100"
        ]

        let handler =
            VNImageRequestHandler(
                ciImage: image,
                orientation: .up,
                options: [:]
            )

        try handler.perform([request])

        var lines: [[String: Any]] = []

        for observation in request.results ?? [] {
            for (
                rank,
                candidate
            ) in observation
                .topCandidates(3)
                .enumerated()
            {
                let value =
                    candidate.string
                    .trimmingCharacters(
                        in: .whitespacesAndNewlines
                    )

                guard !value.isEmpty else {
                    continue
                }

                let box =
                    observation.boundingBox

                lines.append([
                    "text": value,
                    "confidence":
                        Double(candidate.confidence),
                    "x":
                        Double(
                            frame.minX + box.minX*frame.width
                        ),
                    "y":
                        Double(
                            frame.minY + box.minY*frame.height
                        ),
                    "width":
                        Double(
                            box.width*frame.width
                        ),
                    "height":
                        Double(
                            box.height*frame.height
                        ),
                    "pass":
                        pass + "-rank" + String(rank + 1)
                ])
            }
        }

        return lines
    }

    private func calorieFrames(
        from lines: [[String: Any]]
    ) -> [CGRect] {
        var frames: [CGRect] = []

        for line in lines {
            guard
                let value =
                    line["text"] as? String,
                value
                    .lowercased()
                    .contains("calorie"),
                let x =
                    line["x"] as? Double,
                let y =
                    line["y"] as? Double,
                let width =
                    line["width"] as? Double,
                let height =
                    line["height"] as? Double
            else {
                continue
            }

            let padding =
                max(0.055, height*1.15)

            let focusedX =
                max(
                    0.0,
                    x+width-0.09
                )

            let focusedY =
                max(
                    0.0,
                    y-padding
                )

            let focusedTop =
                min(
                    1.0,
                    y+height+padding
                )

            frames.append(
                CGRect(
                    x: focusedX,
                    y: focusedY,
                    width:
                        max(
                            0.01,
                            1.0-focusedX
                        ),
                    height:
                        max(
                            0.01,
                            focusedTop-focusedY
                        )
                )
            )

            let rowX =
                max(0.0, x-0.03)

            frames.append(
                CGRect(
                    x: rowX,
                    y: focusedY,
                    width:
                        max(
                            0.01,
                            1.0-rowX
                        ),
                    height:
                        max(
                            0.01,
                            focusedTop-focusedY
                        )
                )
            )
        }

        var unique: [CGRect] = []

        for frame in frames {
            let duplicate =
                unique.contains { existing in
                    abs(
                        existing.minX-frame.minX
                    )<0.02
                    && abs(
                        existing.minY-frame.minY
                    )<0.02
                    && abs(
                        existing.width-frame.width
                    )<0.03
                    && abs(
                        existing.height-frame.height
                    )<0.03
                }

            if !duplicate {
                unique.append(frame)
            }
        }

        return Array(
            unique.prefix(4)
        )
    }

    private func croppedImage(
        _ image: CIImage,
        normalizedFrame: CGRect
    ) -> CIImage? {
        let extent =
            image.extent

        let pixelFrame = CGRect(
            x:
                extent.minX + normalizedFrame.minX * extent.width,
            y:
                extent.minY + normalizedFrame.minY * extent.height,
            width:
                normalizedFrame.width * extent.width,
            height:
                normalizedFrame.height * extent.height
        ).intersection(extent)

        guard
            !pixelFrame.isNull,
            pixelFrame.width>4,
            pixelFrame.height>4
        else {
            return nil
        }

        let cropped =
            image.cropped(
                to: pixelFrame
            )

        let scale =
            max(
                2.5,
                min(
                    6.0,
                    1600.0/pixelFrame.width
                )
            )

        return cropped.transformed(
            by: CGAffineTransform(
                scaleX: scale,
                y: scale
            )
        )
    }

    @objc public func recognize(
        _ call: CAPPluginCall
    ) {
        guard
            let encoded =
                call.getString("base64"),
            let imageData =
                Data(
                    base64Encoded: encoded,
                    options: .ignoreUnknownCharacters
                ),
            let image =
                UIImage(data: imageData)
        else {
            call.reject(
                "The selected nutrition-label image could not be opened."
            )
            return
        }

        DispatchQueue
            .global(qos: .userInitiated)
            .async {
                let variants =
                    self.variants(for: image)

                guard !variants.isEmpty else {
                    DispatchQueue.main.async {
                        call.reject(
                            "The selected image could not be prepared."
                        )
                    }
                    return
                }

                var allLines:
                    [[String: Any]] = []

                for variant in variants {
                    do {
                        allLines.append(
                            contentsOf:
                                try self.recognize(
                                    image: variant.image,
                                    pass: variant.name
                                )
                        )
                    } catch {
                        // Continue with the remaining passes.
                    }
                }

                let calorieFrames =
                    self.calorieFrames(
                        from: allLines
                    )

                for variant in variants {
                    for (
                        frameIndex,
                        frame
                    ) in calorieFrames.enumerated() {
                        guard
                            let cropped =
                                self.croppedImage(
                                    variant.image,
                                    normalizedFrame: frame
                                )
                        else {
                            continue
                        }

                        do {
                            allLines.append(
                                contentsOf:
                                    try self.recognize(
                                        image: cropped,
                                        pass:
                                            "calorie-" + variant.name + "-" + String(frameIndex),
                                        frame: frame,
                                        minimumTextHeight: 0.006
                                    )
                            )
                        } catch {
                            // General OCR remains available.
                        }
                    }
                }

                guard !allLines.isEmpty else {
                    DispatchQueue.main.async {
                        call.reject(
                            "BlackPyre could not read text from that image."
                        )
                    }
                    return
                }

                DispatchQueue.main.async {
                    call.resolve([
                        "lines": allLines
                    ])
                }
            }
    }
}
