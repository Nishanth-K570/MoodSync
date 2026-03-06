import { Authenticated, Unauthenticated, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { SignInForm } from "./SignInForm";
import { SignOutButton } from "./SignOutButton";
import { Toaster } from "sonner";
import { MoodTracker } from "./components/MoodTracker";
import { MoodHistory } from "./components/MoodHistory";
import { MoodStats } from "./components/MoodStats";
import { Settings } from "./components/Settings";
import { useState, useEffect } from "react";

export default function App() {
  const [activeTab, setActiveTab] = useState("tracker");
  const [darkMode, setDarkMode] = useState(false);
  const userPrefs = useQuery(api.moods.getUserPreferences);

  useEffect(() => {
    if (userPrefs?.darkMode !== undefined) {
      setDarkMode(userPrefs.darkMode);
    }
  }, [userPrefs]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
  }, [darkMode]);

  return (
    <div className={`min-h-screen flex flex-col transition-colors duration-300 ${
      darkMode ? "bg-gray-900" : "bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50"
    }`}>
      <header className={`sticky top-0 z-10 backdrop-blur-sm h-16 flex justify-between items-center border-b shadow-sm px-4 transition-colors ${
        darkMode ? "bg-gray-800/80 border-gray-700" : "bg-white/80 border-gray-200"
      }`}>
        <h2 className={`text-xl font-semibold ${darkMode ? "text-white" : "text-gray-800"}`}>
          MoodSync
        </h2>
        <div className="flex items-center gap-4">
          <Authenticated>
            <nav className="flex gap-2">
              {[
                { id: "tracker", label: "Track", icon: "🎯" },
                { id: "history", label: "History", icon: "📊" },
                { id: "stats", label: "Trends", icon: "📈" },
                { id: "settings", label: "Settings", icon: "⚙️" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    activeTab === tab.id
                      ? darkMode
                        ? "bg-purple-600 text-white"
                        : "bg-purple-100 text-purple-700"
                      : darkMode
                      ? "text-gray-300 hover:text-white hover:bg-gray-700"
                      : "text-gray-600 hover:text-gray-800 hover:bg-gray-100"
                  }`}
                >
                  <span className="mr-1">{tab.icon}</span>
                  {tab.label}
                </button>
              ))}
            </nav>
          </Authenticated>
          <SignOutButton />
        </div>
      </header>

      <main className="flex-1 p-4">
        <div className="max-w-4xl mx-auto">
          <Content activeTab={activeTab} darkMode={darkMode} />
        </div>
      </main>
      <Toaster />
    </div>
  );
}

function Content({ activeTab, darkMode }: { activeTab: string; darkMode: boolean }) {
  const loggedInUser = useQuery(api.auth.loggedInUser);

  if (loggedInUser === undefined) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className={`animate-spin rounded-full h-8 w-8 border-b-2 ${
          darkMode ? "border-purple-400" : "border-purple-600"
        }`}></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Authenticated>
        <div className="text-center mb-8">
          <h1 className={`text-4xl font-bold mb-2 ${
            darkMode ? "text-white" : "text-gray-800"
          }`}>
            How are you feeling today?
          </h1>
          <p className={`text-lg ${
            darkMode ? "text-gray-300" : "text-gray-600"
          }`}>
            Welcome back, {loggedInUser?.email?.split("@")[0] ?? "friend"}! 
          </p>
        </div>

        {activeTab === "tracker" && <MoodTracker darkMode={darkMode} />}
        {activeTab === "history" && <MoodHistory darkMode={darkMode} />}
        {activeTab === "stats" && <MoodStats darkMode={darkMode} />}
        {activeTab === "settings" && <Settings darkMode={darkMode} />}
      </Authenticated>

      <Unauthenticated>
        <div className="text-center space-y-6">
          <div>
            <h1 className={`text-5xl font-bold mb-4 ${
              darkMode ? "text-white" : "text-gray-800"
            }`}>
              MoodSync
            </h1>
            <p className={`text-xl ${
              darkMode ? "text-gray-300" : "text-gray-600"
            }`}>
              Track your mood, get personalized recommendations
            </p>
          </div>
          <SignInForm />
        </div>
      </Unauthenticated>
    </div>
  );
}
