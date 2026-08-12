import Foundation
import ActivityKit

@available(iOS 16.1, *)
struct RestTimerActivityAttributes: ActivityAttributes {
    struct ContentState: Codable, Hashable {
        let endAt: Date
        let pausedRemaining: Int
        let isPaused: Bool
    }

    let title: String
}
