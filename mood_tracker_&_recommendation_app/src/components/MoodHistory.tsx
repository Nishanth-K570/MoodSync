import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

interface MoodHistoryProps {
  darkMode: boolean;
}

export function MoodHistory({ darkMode }: MoodHistoryProps) {
  const moods = useQuery(api.moods.getMoodHistory, { limit: 50 });

  if (!moods) {
    return (
      <div className="flex justify-center items-center min-h-[200px]">
        <div className={`animate-spin rounded-full h-8 w-8 border-b-2 ${
          darkMode ? "border-purple-400" : "border-purple-600"
        }`}></div>
      </div>
    );
  }

  if (moods.length === 0) {
    return (
      <div className={`text-center py-12 rounded-2xl ${
        darkMode ? "bg-gray-800 text-gray-300" : "bg-white text-gray-600"
      }`}>
        <div className="text-4xl mb-4">📝</div>
        <h3 className="text-xl font-semibold mb-2">No mood entries yet</h3>
        <p>Start tracking your mood to see your history here!</p>
      </div>
    );
  }

  const getSentimentEmoji = (sentiment: string) => {
    switch (sentiment) {
      case "positive": return "😊";
      case "negative": return "😔";
      default: return "😐";
    }
  };

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case "positive": return darkMode ? "text-green-400" : "text-green-600";
      case "negative": return darkMode ? "text-red-400" : "text-red-600";
      default: return darkMode ? "text-yellow-400" : "text-yellow-600";
    }
  };

  return (
    <div className="space-y-4">
      <h2 className={`text-2xl font-bold ${darkMode ? "text-white" : "text-gray-800"}`}>
        Your Mood Journey
      </h2>
      
      <div className="space-y-4">
        {moods.map((mood) => (
          <div
            key={mood._id}
            className={`p-6 rounded-2xl shadow-lg transition-colors ${
              darkMode ? "bg-gray-800 border border-gray-700" : "bg-white border border-gray-100"
            }`}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{getSentimentEmoji(mood.sentiment)}</span>
                <div>
                  <div className={`font-semibold capitalize ${getSentimentColor(mood.sentiment)}`}>
                    {mood.sentiment}
                  </div>
                  <div className={`text-sm ${darkMode ? "text-gray-400" : "text-gray-600"}`}>
                    {new Date(mood._creationTime).toLocaleDateString()} at{" "}
                    {new Date(mood._creationTime).toLocaleTimeString([], { 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    })}
                  </div>
                </div>
              </div>
              <div className={`text-xs px-2 py-1 rounded-full ${
                mood.inputMethod === "voice" 
                  ? darkMode ? "bg-purple-900 text-purple-300" : "bg-purple-100 text-purple-700"
                  : darkMode ? "bg-gray-700 text-gray-300" : "bg-gray-100 text-gray-700"
              }`}>
                {mood.inputMethod === "voice" ? "🎤 Voice" : "✏️ Text"}
              </div>
            </div>

            <div className="mb-4">
              <p className={`text-lg ${darkMode ? "text-gray-200" : "text-gray-700"}`}>
                "{mood.text}"
              </p>
            </div>

            {mood.emotions.length > 0 && (
              <div className="mb-4">
                <div className={`text-sm font-medium mb-2 ${darkMode ? "text-gray-300" : "text-gray-600"}`}>
                  Emotions detected:
                </div>
                <div className="flex flex-wrap gap-2">
                  {mood.emotions.map((emotion, index) => (
                    <span
                      key={index}
                      className={`px-3 py-1 rounded-full text-sm ${
                        darkMode ? "bg-gray-700 text-gray-300" : "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {emotion}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className={`p-4 rounded-lg ${
              darkMode ? "bg-gray-700" : "bg-gray-50"
            }`}>
              <div className={`text-sm font-medium mb-2 ${darkMode ? "text-gray-300" : "text-gray-600"}`}>
                AI Response:
              </div>
              <p className={`text-sm ${darkMode ? "text-gray-200" : "text-gray-700"}`}>
                {mood.aiMessage}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
