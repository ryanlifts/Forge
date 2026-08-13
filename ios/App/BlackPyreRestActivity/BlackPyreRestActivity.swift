import ActivityKit
import SwiftUI
import WidgetKit

@main
struct BlackPyreRestActivityBundle: WidgetBundle {
    var body: some Widget {
        BlackPyreRestActivity()
    }
}

struct BlackPyreRestActivity: Widget {
    private let ember = Color(red: 1.0, green: 0.71, blue: 0.08)

    var body: some WidgetConfiguration {
        ActivityConfiguration(for: RestTimerActivityAttributes.self) { context in
            HStack(spacing: 14) {
                Image(systemName: "flame.fill")
                    .font(.title2.weight(.bold))
                    .foregroundStyle(ember)

                VStack(alignment: .leading, spacing: 3) {
                    Text("BLACKPYRE REST")
                        .font(.caption.weight(.bold))
                        .tracking(1.1)
                    Text(context.state.isPaused ? "PAUSED" : "REST BETWEEN SETS")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }

                Spacer(minLength: 8)
                timerText(for: context.state)
                    .font(.title2.monospacedDigit().weight(.bold))
                    .foregroundStyle(context.state.isPaused ? .white : ember)
            }
            .padding(.horizontal, 16)
            .activityBackgroundTint(Color(red: 0.06, green: 0.07, blue: 0.08))
            .activitySystemActionForegroundColor(ember)
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    Label("BLACKPYRE", systemImage: "flame.fill")
                        .font(.caption.weight(.bold))
                        .foregroundStyle(ember)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    timerText(for: context.state)
                        .font(.headline.monospacedDigit().weight(.bold))
                        .foregroundStyle(context.state.isPaused ? .white : ember)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    HStack {
                        Text(context.state.isPaused ? "REST TIMER PAUSED" : "REST BETWEEN SETS")
                            .font(.caption.weight(.semibold))
                        Spacer()
                        Text("Open BlackPyre to adjust")
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                    }
                }
            } compactLeading: {
                Image(systemName: "flame.fill")
                    .foregroundStyle(ember)
            } compactTrailing: {
                timerText(for: context.state)
                    .font(.caption.monospacedDigit().weight(.bold))
                    .foregroundStyle(context.state.isPaused ? .white : ember)
                    .frame(maxWidth: 46)
            } minimal: {
                Image(systemName: context.state.isPaused ? "pause.fill" : "timer")
                    .foregroundStyle(ember)
            }
            .keylineTint(ember)
        }
    }

    @ViewBuilder
    private func timerText(for state: RestTimerActivityAttributes.ContentState) -> some View {
        if state.isPaused || state.endAt <= Date.now {
            Text(Self.format(seconds: state.pausedRemaining))
        } else {
            Text(timerInterval: Date.now...state.endAt, countsDown: true)
        }
    }

    private static func format(seconds: Int) -> String {
        let safe = max(0, seconds)
        return String(format: "%d:%02d", safe / 60, safe % 60)
    }
}
