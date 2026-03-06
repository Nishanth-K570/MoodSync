import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { toast } from "sonner";

interface SettingsProps {
  darkMode: boolean;
}

export function Settings({ darkMode }: SettingsProps) {
  const userPrefs = useQuery(api.moods.getUserPreferences);
  const updatePrefs = useMutation(api.moods.updatePreferences);
  
  const [preferences, setPreferences] = useState({
    favoriteGenres: [] as string[],
    preferredActivities: [] as string[],
    darkMode: false,
    notificationsEnabled: true,
  });

  useEffect(() => {
    if (userPrefs) {
      setPreferences(userPrefs);
    }
  }, [userPrefs]);

  const handleSave = async () => {
    try {
      await updatePrefs(preferences);
      toast.success("Settings saved successfully!");
    } catch (error) {
      toast.error("Failed to save settings");
    }
  };

  const genreOptions = [
    "Pop", "Rock", "Hip Hop", "Electronic", "Classical", "Jazz", "Country", 
    "R&B", "Indie", "Alternative", "Folk", "Reggae", "Blues", "Metal"
  ];

  const activityOptions = [
    "Meditation", "Exercise", "Reading", "Journaling", "Walking", "Yoga", 
    "Cooking", "Art", "Music", "Gaming", "Socializing", "Nature", "Learning"
  ];

  const toggleGenre = (genre: string) => {
    setPreferences(prev => ({
      ...prev,
      favoriteGenres: prev.favoriteGenres.includes(genre)
        ? prev.favoriteGenres.filter(g => g !== genre)
        : [...prev.favoriteGenres, genre]
    }));
  };

  const toggleActivity = (activity: string) => {
    setPreferences(prev => ({
      ...prev,
      preferredActivities: prev.preferredActivities.includes(activity)
        ? prev.preferredActivities.filter(a => a !== activity)
        : [...prev.preferredActivities, activity]
    }));
  };

  return (
    <div className="space-y-6">
      <h2 className={`text-2xl font-bold ${darkMode ? "text-white" : "text-gray-800"}`}>
        Settings & Preferences
      </h2>

      <div className="grid gap-6">
        {/* Appearance */}
        <div className={`p-6 rounded-2xl shadow-lg ${
          darkMode ? "bg-gray-800 border border-gray-700" : "bg-white border border-gray-100"
        }`}>
          <h3 className={`font-semibold mb-4 ${darkMode ? "text-white" : "text-gray-800"}`}>
            🎨 Appearance
          </h3>
          <div className="space-y-4">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={preferences.darkMode}
                onChange={(e) => setPreferences(prev => ({ ...prev, darkMode: e.target.checked }))}
                className="w-5 h-5 text-purple-600 rounded focus:ring-purple-500"
              />
              <span className={darkMode ? "text-gray-300" : "text-gray-700"}>
                Dark mode
              </span>
            </label>
          </div>
        </div>

        {/* Notifications */}
        <div className={`p-6 rounded-2xl shadow-lg ${
          darkMode ? "bg-gray-800 border border-gray-700" : "bg-white border border-gray-100"
        }`}>
          <h3 className={`font-semibold mb-4 ${darkMode ? "text-white" : "text-gray-800"}`}>
            🔔 Notifications
          </h3>
          <div className="space-y-4">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={preferences.notificationsEnabled}
                onChange={(e) => setPreferences(prev => ({ ...prev, notificationsEnabled: e.target.checked }))}
                className="w-5 h-5 text-purple-600 rounded focus:ring-purple-500"
              />
              <span className={darkMode ? "text-gray-300" : "text-gray-700"}>
                Enable daily mood check-in reminders
              </span>
            </label>
          </div>
        </div>

        {/* Music Preferences */}
        <div className={`p-6 rounded-2xl shadow-lg ${
          darkMode ? "bg-gray-800 border border-gray-700" : "bg-white border border-gray-100"
        }`}>
          <h3 className={`font-semibold mb-4 ${darkMode ? "text-white" : "text-gray-800"}`}>
            🎵 Favorite Music Genres
          </h3>
          <p className={`text-sm mb-4 ${darkMode ? "text-gray-400" : "text-gray-600"}`}>
            Select your favorite genres to get better music recommendations
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {genreOptions.map((genre) => (
              <button
                key={genre}
                onClick={() => toggleGenre(genre)}
                className={`p-3 rounded-lg text-sm font-medium transition-colors ${
                  preferences.favoriteGenres.includes(genre)
                    ? darkMode
                      ? "bg-purple-600 text-white"
                      : "bg-purple-100 text-purple-700"
                    : darkMode
                    ? "bg-gray-700 text-gray-300 hover:bg-gray-600"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                {genre}
              </button>
            ))}
          </div>
        </div>

        {/* Activity Preferences */}
        <div className={`p-6 rounded-2xl shadow-lg ${
          darkMode ? "bg-gray-800 border border-gray-700" : "bg-white border border-gray-100"
        }`}>
          <h3 className={`font-semibold mb-4 ${darkMode ? "text-white" : "text-gray-800"}`}>
            🌟 Preferred Activities
          </h3>
          <p className={`text-sm mb-4 ${darkMode ? "text-gray-400" : "text-gray-600"}`}>
            Choose activities you enjoy to get personalized suggestions
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {activityOptions.map((activity) => (
              <button
                key={activity}
                onClick={() => toggleActivity(activity)}
                className={`p-3 rounded-lg text-sm font-medium transition-colors ${
                  preferences.preferredActivities.includes(activity)
                    ? darkMode
                      ? "bg-purple-600 text-white"
                      : "bg-purple-100 text-purple-700"
                    : darkMode
                    ? "bg-gray-700 text-gray-300 hover:bg-gray-600"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                {activity}
              </button>
            ))}
          </div>
        </div>

        {/* Save Button */}
        <div className="text-center">
          <button
            onClick={handleSave}
            className={`py-3 px-8 rounded-xl font-semibold transition-all transform hover:scale-105 ${
              darkMode
                ? "bg-purple-600 hover:bg-purple-700 text-white"
                : "bg-purple-600 hover:bg-purple-700 text-white"
            }`}
          >
            💾 Save Preferences
          </button>
        </div>
      </div>
    </div>
  );
}
