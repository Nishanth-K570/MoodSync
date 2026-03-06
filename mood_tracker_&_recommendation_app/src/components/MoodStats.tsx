import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useState } from "react";

interface MoodStatsProps {
  darkMode: boolean;
}

export function MoodStats({ darkMode }: MoodStatsProps) {
  const [timeRange, setTimeRange] = useState(7);
  const stats = useQuery(api.moods.getMoodStats, { days: timeRange });
  const recentMoods = useQuery(api.moods.getMoodHistory, { limit: 100 });
  const userPrefs = useQuery(api.moods.getUserPreferences);

  if (!stats || !recentMoods) {
    return (
      <div className="flex justify-center items-center min-h-[200px]">
        <div className={`animate-spin rounded-full h-8 w-8 border-b-2 ${
          darkMode ? "border-purple-400" : "border-purple-600"
        }`}></div>
      </div>
    );
  }

  // Calculate overall statistics
  const totalEntries = recentMoods.length;
  const positiveCount = recentMoods.filter(m => m.sentiment === "positive").length;
  const negativeCount = recentMoods.filter(m => m.sentiment === "negative").length;
  const neutralCount = recentMoods.filter(m => m.sentiment === "neutral").length;

  const positivePercentage = totalEntries > 0 ? (positiveCount / totalEntries) * 100 : 0;
  const negativePercentage = totalEntries > 0 ? (negativeCount / totalEntries) * 100 : 0;
  const neutralPercentage = totalEntries > 0 ? (neutralCount / totalEntries) * 100 : 0;

  // Get most common emotions
  const emotionCounts: Record<string, number> = {};
  recentMoods.forEach(mood => {
    mood.emotions.forEach(emotion => {
      emotionCounts[emotion] = (emotionCounts[emotion] || 0) + 1;
    });
  });

  const topEmotions = Object.entries(emotionCounts)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 5);

  const uniqueDays = Array.from(
    new Set(
      recentMoods.map((mood) =>
        new Date(mood._creationTime).toISOString().split("T")[0],
      ),
    ),
  ).sort((a, b) => (a > b ? -1 : 1));

  let currentStreak = 0;
  if (uniqueDays.length > 0) {
    const today = new Date();
    let cursor = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    for (const day of uniqueDays) {
      const dayDate = new Date(`${day}T00:00:00`);
      const diffDays = Math.round((cursor.getTime() - dayDate.getTime()) / 86400000);
      if (diffDays === 0) {
        currentStreak += 1;
        cursor = new Date(cursor.getTime() - 86400000);
        continue;
      }
      if (diffDays === 1 && currentStreak === 0) {
        currentStreak += 1;
        cursor = new Date(cursor.getTime() - 86400000 * 2);
        continue;
      }
      break;
    }
  }

  const achievements = [
    {
      title: "First Check-In",
      unlocked: totalEntries >= 1,
    },
    {
      title: "Consistency Starter",
      unlocked: totalEntries >= 7,
    },
    {
      title: "Mood Explorer",
      unlocked: topEmotions.length >= 4,
    },
    {
      title: "7-Day Streak",
      unlocked: currentStreak >= 7,
    },
  ];

  const moodsWithRisk = recentMoods
    .filter((mood) => typeof mood.riskScore === "number")
    .sort((a, b) => b._creationTime - a._creationTime);
  const warningEvents = moodsWithRisk.filter((mood) => mood.warningTriggered);

  const averageRiskScore =
    moodsWithRisk.length > 0
      ? moodsWithRisk.reduce((sum, mood) => sum + (mood.riskScore ?? 0), 0) / moodsWithRisk.length
      : 0;
  const peakRiskScore =
    moodsWithRisk.length > 0
      ? Math.max(...moodsWithRisk.map((mood) => mood.riskScore ?? 0))
      : 0;

  const recentWindow = moodsWithRisk.slice(0, 5);
  const previousWindow = moodsWithRisk.slice(5, 10);
  const recentAvg =
    recentWindow.length > 0
      ? recentWindow.reduce((sum, mood) => sum + (mood.riskScore ?? 0), 0) / recentWindow.length
      : 0;
  const previousAvg =
    previousWindow.length > 0
      ? previousWindow.reduce((sum, mood) => sum + (mood.riskScore ?? 0), 0) / previousWindow.length
      : recentAvg;

  const riskTrendLabel =
    recentAvg - previousAvg >= 6
      ? "Worsening"
      : previousAvg - recentAvg >= 6
      ? "Improving"
      : "Stable";

  const riskTrendColor =
    riskTrendLabel === "Worsening"
      ? "text-red-500"
      : riskTrendLabel === "Improving"
      ? "text-green-500"
      : "text-yellow-500";

  const topEmotion = topEmotions[0]?.[0] ?? "neutral";
  const preferredActivities = userPrefs?.preferredActivities ?? [];
  const preferredGenres = userPrefs?.favoriteGenres ?? [];

  const personalizedPlan = [
    `Primary focus today: reduce ${topEmotion} intensity with one low-pressure step.`,
    preferredActivities.length > 0
      ? `Do a 15-minute ${preferredActivities[0]} session as your first intervention.`
      : "Do a 15-minute walk + breathing reset as your first intervention.",
    preferredGenres.length > 0
      ? `Play a ${preferredGenres[0]} playlist during your reset period.`
      : "Play a calming playlist during your reset period.",
    riskTrendLabel === "Worsening"
      ? "Schedule one support conversation today with someone you trust."
      : "Keep your momentum by repeating one healthy habit tomorrow at the same time.",
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className={`text-2xl font-bold ${darkMode ? "text-white" : "text-gray-800"}`}>
          Mood Trends & Insights
        </h2>
        <select
          value={timeRange}
          onChange={(e) => setTimeRange(Number(e.target.value))}
          className={`px-4 py-2 rounded-lg border ${
            darkMode 
              ? "bg-gray-800 border-gray-600 text-white" 
              : "bg-white border-gray-300 text-gray-800"
          }`}
        >
          <option value={7}>Last 7 days</option>
          <option value={14}>Last 14 days</option>
          <option value={30}>Last 30 days</option>
        </select>
      </div>

      {totalEntries === 0 ? (
        <div className={`text-center py-12 rounded-2xl ${
          darkMode ? "bg-gray-800 text-gray-300" : "bg-white text-gray-600"
        }`}>
          <div className="text-4xl mb-4">📊</div>
          <h3 className="text-xl font-semibold mb-2">No data yet</h3>
          <p>Start tracking your mood to see trends and insights!</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Overall Sentiment Distribution */}
          <div className={`p-6 rounded-2xl shadow-lg ${
            darkMode ? "bg-gray-800 border border-gray-700" : "bg-white border border-gray-100"
          }`}>
            <h3 className={`font-semibold mb-4 ${darkMode ? "text-white" : "text-gray-800"}`}>
              📊 Sentiment Distribution
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className={`flex items-center gap-2 ${darkMode ? "text-gray-300" : "text-gray-700"}`}>
                  😊 Positive
                </span>
                <span className="text-green-500 font-semibold">
                  {positivePercentage.toFixed(1)}%
                </span>
              </div>
              <div className={`w-full bg-gray-200 rounded-full h-2 ${darkMode ? "bg-gray-700" : ""}`}>
                <div 
                  className="bg-green-500 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${positivePercentage}%` }}
                ></div>
              </div>

              <div className="flex items-center justify-between">
                <span className={`flex items-center gap-2 ${darkMode ? "text-gray-300" : "text-gray-700"}`}>
                  😐 Neutral
                </span>
                <span className="text-yellow-500 font-semibold">
                  {neutralPercentage.toFixed(1)}%
                </span>
              </div>
              <div className={`w-full bg-gray-200 rounded-full h-2 ${darkMode ? "bg-gray-700" : ""}`}>
                <div 
                  className="bg-yellow-500 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${neutralPercentage}%` }}
                ></div>
              </div>

              <div className="flex items-center justify-between">
                <span className={`flex items-center gap-2 ${darkMode ? "text-gray-300" : "text-gray-700"}`}>
                  😔 Negative
                </span>
                <span className="text-red-500 font-semibold">
                  {negativePercentage.toFixed(1)}%
                </span>
              </div>
              <div className={`w-full bg-gray-200 rounded-full h-2 ${darkMode ? "bg-gray-700" : ""}`}>
                <div 
                  className="bg-red-500 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${negativePercentage}%` }}
                ></div>
              </div>
            </div>
          </div>

          {/* Top Emotions */}
          <div className={`p-6 rounded-2xl shadow-lg ${
            darkMode ? "bg-gray-800 border border-gray-700" : "bg-white border border-gray-100"
          }`}>
            <h3 className={`font-semibold mb-4 ${darkMode ? "text-white" : "text-gray-800"}`}>
              🎭 Top Emotions
            </h3>
            <div className="space-y-3">
              {topEmotions.map(([emotion, count], index) => (
                <div key={emotion} className="flex items-center justify-between">
                  <span className={`capitalize ${darkMode ? "text-gray-300" : "text-gray-700"}`}>
                    {emotion}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className={`text-sm ${darkMode ? "text-gray-400" : "text-gray-600"}`}>
                      {count}
                    </span>
                    <div className={`w-16 bg-gray-200 rounded-full h-2 ${darkMode ? "bg-gray-700" : ""}`}>
                      <div 
                        className="bg-purple-500 h-2 rounded-full transition-all duration-500"
                        style={{ width: `${(count / totalEntries) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Stats */}
          <div className={`p-6 rounded-2xl shadow-lg ${
            darkMode ? "bg-gray-800 border border-gray-700" : "bg-white border border-gray-100"
          }`}>
            <h3 className={`font-semibold mb-4 ${darkMode ? "text-white" : "text-gray-800"}`}>
              📈 Quick Stats
            </h3>
            <div className="space-y-4">
              <div className="text-center">
                <div className={`text-2xl font-bold ${darkMode ? "text-purple-400" : "text-purple-600"}`}>
                  {totalEntries}
                </div>
                <div className={`text-sm ${darkMode ? "text-gray-400" : "text-gray-600"}`}>
                  Total Entries
                </div>
              </div>
              
              <div className="text-center">
                <div className={`text-2xl font-bold ${darkMode ? "text-blue-400" : "text-blue-600"}`}>
                  {stats.length}
                </div>
                <div className={`text-sm ${darkMode ? "text-gray-400" : "text-gray-600"}`}>
                  Active Days
                </div>
              </div>

              <div className="text-center">
                <div className={`text-2xl font-bold ${darkMode ? "text-green-400" : "text-green-600"}`}>
                  {(totalEntries / Math.max(stats.length, 1)).toFixed(1)}
                </div>
                <div className={`text-sm ${darkMode ? "text-gray-400" : "text-gray-600"}`}>
                  Avg per Day
                </div>
              </div>
            </div>
          </div>

          {/* Risk Intelligence */}
          <div className={`p-6 rounded-2xl shadow-lg ${
            darkMode ? "bg-gray-800 border border-gray-700" : "bg-white border border-gray-100"
          }`}>
            <h3 className={`font-semibold mb-4 ${darkMode ? "text-white" : "text-gray-800"}`}>
              Risk Intelligence
            </h3>
            <div className="space-y-4">
              <div className="text-center">
                <div className={`text-2xl font-bold ${darkMode ? "text-orange-400" : "text-orange-600"}`}>
                  {averageRiskScore.toFixed(1)}
                </div>
                <div className={`text-sm ${darkMode ? "text-gray-400" : "text-gray-600"}`}>
                  Average Risk Score
                </div>
              </div>

              <div className="text-center">
                <div className={`text-2xl font-bold ${darkMode ? "text-red-400" : "text-red-600"}`}>
                  {peakRiskScore.toFixed(0)}
                </div>
                <div className={`text-sm ${darkMode ? "text-gray-400" : "text-gray-600"}`}>
                  Peak Risk Score
                </div>
              </div>

              <div className="text-center">
                <div className={`text-2xl font-bold ${riskTrendColor}`}>
                  {riskTrendLabel}
                </div>
                <div className={`text-sm ${darkMode ? "text-gray-400" : "text-gray-600"}`}>
                  10-entry Risk Trend
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Daily Mood Chart */}
      {stats.length > 0 && (
        <div className={`p-6 rounded-2xl shadow-lg ${
          darkMode ? "bg-gray-800 border border-gray-700" : "bg-white border border-gray-100"
        }`}>
          <h3 className={`font-semibold mb-4 ${darkMode ? "text-white" : "text-gray-800"}`}>
            📅 Daily Mood Trends
          </h3>
          <div className="space-y-2">
            {stats.slice().reverse().map((stat) => (
              <div key={stat.date} className="flex items-center gap-4">
                <div className={`text-sm w-20 ${darkMode ? "text-gray-400" : "text-gray-600"}`}>
                  {new Date(stat.date).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                </div>
                <div className="flex-1 flex items-center gap-2">
                  <div className={`w-full bg-gray-200 rounded-full h-3 ${darkMode ? "bg-gray-700" : ""}`}>
                    <div 
                      className={`h-3 rounded-full transition-all duration-500 ${
                        stat.averageSentiment > 0.3 ? "bg-green-500" :
                        stat.averageSentiment < -0.3 ? "bg-red-500" : "bg-yellow-500"
                      }`}
                      style={{ 
                        width: `${Math.abs(stat.averageSentiment) * 100}%`,
                        marginLeft: stat.averageSentiment < 0 ? `${(1 + stat.averageSentiment) * 100}%` : '0'
                      }}
                    ></div>
                  </div>
                  <span className={`text-sm capitalize ${darkMode ? "text-gray-300" : "text-gray-700"}`}>
                    {stat.dominantEmotion}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Warning History */}
      <div className={`p-6 rounded-2xl shadow-lg ${
        darkMode ? "bg-gray-800 border border-gray-700" : "bg-white border border-gray-100"
      }`}>
        <h3 className={`font-semibold mb-4 ${darkMode ? "text-white" : "text-gray-800"}`}>
          Early Warning Timeline
        </h3>
        {warningEvents.length === 0 ? (
          <p className={darkMode ? "text-gray-400" : "text-gray-600"}>
            No high-risk warnings recorded in your recent entries.
          </p>
        ) : (
          <div className="space-y-3">
            {warningEvents.slice(0, 5).map((event) => (
              <div
                key={event._id}
                className={`p-3 rounded-lg ${
                  darkMode ? "bg-gray-700" : "bg-red-50"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-sm font-medium ${darkMode ? "text-red-300" : "text-red-700"}`}>
                    {String(event.riskLevel ?? "high").toUpperCase()} WARNING
                  </span>
                  <span className={`text-xs ${darkMode ? "text-gray-400" : "text-gray-600"}`}>
                    {new Date(event._creationTime).toLocaleDateString()}
                  </span>
                </div>
                <p className={`text-sm ${darkMode ? "text-gray-300" : "text-gray-700"}`}>
                  Risk score {event.riskScore ?? 0}/100. Top emotion: {event.emotions[0] ?? "neutral"}.
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Personalized Plan */}
      <div className={`p-6 rounded-2xl shadow-lg ${
        darkMode ? "bg-gray-800 border border-gray-700" : "bg-white border border-gray-100"
      }`}>
        <h3 className={`font-semibold mb-4 ${darkMode ? "text-white" : "text-gray-800"}`}>
          Personalized Recovery Plan
        </h3>
        <div className="space-y-2">
          {personalizedPlan.map((item, index) => (
            <div key={index} className={`text-sm ${darkMode ? "text-gray-300" : "text-gray-700"}`}>
              {index + 1}. {item}
            </div>
          ))}
        </div>
      </div>

      <div className={`p-6 rounded-2xl shadow-lg ${
        darkMode ? "bg-gray-800 border border-gray-700" : "bg-white border border-gray-100"
      }`}>
        <h3 className={`font-semibold mb-4 ${darkMode ? "text-white" : "text-gray-800"}`}>
          Achievements & Streaks
        </h3>
        <div className="grid md:grid-cols-2 gap-4">
          <div className={`p-4 rounded-lg ${darkMode ? "bg-gray-700" : "bg-gray-50"}`}>
            <div className={`text-sm ${darkMode ? "text-gray-300" : "text-gray-600"}`}>
              Current Streak
            </div>
            <div className={`text-2xl font-bold ${darkMode ? "text-purple-300" : "text-purple-700"}`}>
              {currentStreak} day{currentStreak === 1 ? "" : "s"}
            </div>
          </div>
          <div className="space-y-2">
            {achievements.map((achievement) => (
              <div
                key={achievement.title}
                className={`px-3 py-2 rounded-lg text-sm ${
                  achievement.unlocked
                    ? darkMode
                      ? "bg-green-900/40 text-green-300"
                      : "bg-green-50 text-green-700"
                    : darkMode
                    ? "bg-gray-700 text-gray-400"
                    : "bg-gray-100 text-gray-500"
                }`}
              >
                {achievement.unlocked ? "Unlocked: " : "Locked: "}
                {achievement.title}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
