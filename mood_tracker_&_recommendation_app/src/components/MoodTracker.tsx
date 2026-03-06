import { useEffect, useRef, useState } from "react";
import { useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { toast } from "sonner";

interface MoodTrackerProps {
  darkMode: boolean;
}

export function MoodTracker({ darkMode }: MoodTrackerProps) {
  const [moodText, setMoodText] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [voiceEmotion, setVoiceEmotion] = useState("");
  const [facialEmotion, setFacialEmotion] = useState("");
  const [voiceConfidence, setVoiceConfidence] = useState<number | undefined>();
  const [facialConfidence, setFacialConfidence] = useState<number | undefined>();
  const [showToolkit, setShowToolkit] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [isDetectingFace, setIsDetectingFace] = useState(false);
  const [isDetectingVoice, setIsDetectingVoice] = useState(false);
  const [result, setResult] = useState<any>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const quickPrompts = [
    "I feel overwhelmed with work and need a reset.",
    "I feel low energy and unmotivated today.",
    "I feel anxious about upcoming deadlines.",
    "I feel calm and productive and want to keep it up.",
  ];

  const analyzeMood = useAction(api.moods.analyzeMood);
  const analyzeFaceSignal = useAction(api.moods.analyzeFaceSignal);
  const analyzeVoiceSignal = useAction(api.moods.analyzeVoiceSignal);

  const handleSubmit = async (inputMethod: "text" | "voice" = "text") => {
    if (!moodText.trim()) {
      toast.error("Please enter how you're feeling");
      return;
    }

    setIsAnalyzing(true);
    try {
      const analysis = await analyzeMood({
        text: moodText,
        inputMethod,
        voiceEmotion: voiceEmotion || undefined,
        voiceConfidence,
        facialEmotion: facialEmotion || undefined,
        facialConfidence,
      });
      setResult(analysis);
      toast.success("Mood analyzed with multimodal signals.");
    } catch {
      toast.error("Failed to analyze mood. Please try again.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const startVoiceInput = () => {
    if (!("webkitSpeechRecognition" in window) && !("SpeechRecognition" in window)) {
      toast.error("Voice input not supported in this browser");
      return;
    }

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();

    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";

    recognition.onstart = () => {
      setIsListening(true);
      toast.info("Listening... Speak now.");
    };

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setMoodText(transcript);
      setIsListening(false);
      toast.success("Voice captured.");
    };

    recognition.onerror = () => {
      setIsListening(false);
      toast.error("Voice input failed. Please try again.");
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.start();
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  useEffect(() => {
    return () => stopCamera();
  }, []);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
      });
      streamRef.current = stream;
      setCameraActive(true);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch {
      toast.error("Could not access camera.");
    }
  };

  const detectFaceEmotion = async () => {
    if (!videoRef.current) return;
    setIsDetectingFace(true);
    try {
      const canvas = document.createElement("canvas");
      canvas.width = videoRef.current.videoWidth || 320;
      canvas.height = videoRef.current.videoHeight || 240;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("No canvas context");

      context.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      const imageDataUrl = canvas.toDataURL("image/jpeg", 0.8);
      const signal = await analyzeFaceSignal({ imageDataUrl });
      setFacialEmotion(signal.emotion);
      setFacialConfidence(signal.confidence);
      toast.success(`Face emotion: ${signal.emotion}`);
    } catch {
      toast.error("Face emotion detection failed.");
    } finally {
      setIsDetectingFace(false);
    }
  };

  const recordVoiceAndAnalyze = async () => {
    setIsDetectingVoice(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: BlobPart[] = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };

      const stopped = new Promise<Blob>((resolve) => {
        recorder.onstop = () => {
          resolve(new Blob(chunks, { type: recorder.mimeType || "audio/webm" }));
        };
      });

      recorder.start();
      toast.info("Recording 6-second sample...");
      await new Promise((r) => setTimeout(r, 6000));
      recorder.stop();
      const blob = await stopped;
      stream.getTracks().forEach((track) => track.stop());

      const audioBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const raw = String(reader.result ?? "");
          const base64 = raw.includes(",") ? raw.split(",")[1] : "";
          resolve(base64);
        };
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
      });

      const signal = await analyzeVoiceSignal({
        audioBase64,
        mimeType: blob.type || "audio/webm",
      });
      setVoiceEmotion(signal.emotion);
      setVoiceConfidence(signal.confidence);
      if (!moodText.trim() && signal.transcript?.trim()) {
        setMoodText(signal.transcript);
      }
      toast.success(`Voice emotion: ${signal.emotion}`);
    } catch {
      toast.error("Voice emotion detection failed.");
    } finally {
      setIsDetectingVoice(false);
    }
  };

  const resetForm = () => {
    setMoodText("");
    setVoiceEmotion("");
    setFacialEmotion("");
    setVoiceConfidence(undefined);
    setFacialConfidence(undefined);
    setResult(null);
  };

  const getInsightText = () => {
    const aiMessage = result?.aiMessage?.trim();
    if (aiMessage) return aiMessage;

    const sentiment = result?.analysis?.sentiment ?? "neutral";
    const primaryEmotion = result?.analysis?.emotions?.[0] ?? "neutral";
    const userPrompt = moodText.trim();

    if (userPrompt) {
      return `From what you shared ("${userPrompt}"), your current mood looks ${sentiment} with a ${primaryEmotion} tone. Try one small step from the recommendations below to support this state.`;
    }

    return `Your current mood appears ${sentiment} with a ${primaryEmotion} tone. Use one recommendation below as your next step.`;
  };

  return (
    <div className="space-y-6">
      <div
        className={`p-6 rounded-2xl shadow-lg transition-colors ${
          darkMode ? "bg-gray-800 border border-gray-700" : "bg-white border border-gray-100"
        }`}
      >
        <div className="space-y-4">
          <label
            className={`block text-lg font-medium ${
              darkMode ? "text-white" : "text-gray-800"
            }`}
          >
            How are you feeling right now?
          </label>

          <textarea
            value={moodText}
            onChange={(e) => setMoodText(e.target.value)}
            placeholder="Tell me about your mood, what's on your mind, or how your day is going..."
            className={`w-full p-4 rounded-xl border-2 transition-colors resize-none focus:ring-2 focus:ring-purple-500 focus:border-transparent ${
              darkMode
                ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400"
                : "bg-gray-50 border-gray-200 text-gray-800 placeholder-gray-500"
            }`}
            rows={4}
            disabled={isAnalyzing}
          />

          <div className="flex flex-wrap gap-2">
            {quickPrompts.map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => setMoodText(prompt)}
                className={`px-3 py-1 rounded-full text-xs transition-colors ${
                  darkMode
                    ? "bg-gray-700 text-gray-300 hover:bg-gray-600"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                {prompt.slice(0, 28)}...
              </button>
            ))}
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => handleSubmit("text")}
              disabled={isAnalyzing || !moodText.trim()}
              className={`flex-1 py-3 px-6 rounded-xl font-semibold transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none ${
                darkMode
                  ? "bg-purple-600 hover:bg-purple-700 text-white"
                  : "bg-purple-600 hover:bg-purple-700 text-white"
              }`}
            >
              {isAnalyzing ? "Analyzing..." : "Analyze My Mood"}
            </button>

            <button
              onClick={startVoiceInput}
              disabled={isAnalyzing || isListening}
              className={`py-3 px-6 rounded-xl font-semibold transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed ${
                isListening
                  ? "bg-red-500 hover:bg-red-600 text-white animate-pulse"
                  : darkMode
                  ? "bg-gray-700 hover:bg-gray-600 text-white border border-gray-600"
                  : "bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-300"
              }`}
            >
              {isListening ? "Listening..." : "Voice Input"}
            </button>
          </div>

          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <label className={`text-sm block mb-1 ${darkMode ? "text-gray-300" : "text-gray-600"}`}>
                Voice emotion signal
              </label>
              <select
                value={voiceEmotion}
                onChange={(e) => setVoiceEmotion(e.target.value)}
                className={`w-full p-3 rounded-lg border ${
                  darkMode ? "bg-gray-700 border-gray-600 text-white" : "bg-white border-gray-300 text-gray-800"
                }`}
                disabled={isAnalyzing}
              >
                <option value="">Not provided</option>
                <option value="calm">Calm</option>
                <option value="neutral">Neutral</option>
                <option value="stressed">Stressed</option>
                <option value="anxious">Anxious</option>
                <option value="sad">Sad</option>
                <option value="angry">Angry</option>
              </select>
              {voiceConfidence !== undefined && (
                <div className={`text-xs mt-1 ${darkMode ? "text-gray-400" : "text-gray-500"}`}>
                  Confidence: {(voiceConfidence * 100).toFixed(0)}%
                </div>
              )}
            </div>
            <div>
              <label className={`text-sm block mb-1 ${darkMode ? "text-gray-300" : "text-gray-600"}`}>
                Facial emotion signal
              </label>
              <select
                value={facialEmotion}
                onChange={(e) => setFacialEmotion(e.target.value)}
                className={`w-full p-3 rounded-lg border ${
                  darkMode ? "bg-gray-700 border-gray-600 text-white" : "bg-white border-gray-300 text-gray-800"
                }`}
                disabled={isAnalyzing}
              >
                <option value="">Not provided</option>
                <option value="happy">Happy</option>
                <option value="neutral">Neutral</option>
                <option value="sad">Sad</option>
                <option value="anxious">Anxious</option>
                <option value="angry">Angry</option>
                <option value="depressed">Depressed</option>
              </select>
              {facialConfidence !== undefined && (
                <div className={`text-xs mt-1 ${darkMode ? "text-gray-400" : "text-gray-500"}`}>
                  Confidence: {(facialConfidence * 100).toFixed(0)}%
                </div>
              )}
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={recordVoiceAndAnalyze}
              disabled={isAnalyzing || isDetectingVoice}
              className={`py-2 px-4 rounded-lg font-medium transition-colors ${
                darkMode
                  ? "bg-indigo-600 hover:bg-indigo-700 text-white disabled:bg-gray-700"
                  : "bg-indigo-600 hover:bg-indigo-700 text-white disabled:bg-gray-300"
              }`}
            >
              {isDetectingVoice ? "Analyzing Voice..." : "Auto Detect Voice Emotion"}
            </button>

            {!cameraActive ? (
              <button
                type="button"
                onClick={startCamera}
                disabled={isAnalyzing}
                className={`py-2 px-4 rounded-lg font-medium transition-colors ${
                  darkMode
                    ? "bg-teal-600 hover:bg-teal-700 text-white disabled:bg-gray-700"
                    : "bg-teal-600 hover:bg-teal-700 text-white disabled:bg-gray-300"
                }`}
              >
                Start Camera
              </button>
            ) : (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={detectFaceEmotion}
                  disabled={isAnalyzing || isDetectingFace}
                  className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
                    darkMode
                      ? "bg-teal-600 hover:bg-teal-700 text-white disabled:bg-gray-700"
                      : "bg-teal-600 hover:bg-teal-700 text-white disabled:bg-gray-300"
                  }`}
                >
                  {isDetectingFace ? "Analyzing Face..." : "Capture Face Emotion"}
                </button>
                <button
                  type="button"
                  onClick={stopCamera}
                  className={`py-2 px-4 rounded-lg font-medium transition-colors ${
                    darkMode ? "bg-gray-700 hover:bg-gray-600 text-white" : "bg-gray-200 hover:bg-gray-300 text-gray-800"
                  }`}
                >
                  Stop
                </button>
              </div>
            )}
          </div>

          {cameraActive && (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full max-h-56 rounded-lg object-cover border border-gray-300"
            />
          )}
        </div>
      </div>

      {result && (
        <div className="space-y-6 animate-fade-in">
          <div
            className={`p-6 rounded-2xl shadow-lg ${
              darkMode ? "bg-gradient-to-r from-purple-900 to-blue-900" : "bg-gradient-to-r from-purple-100 to-blue-100"
            }`}
          >
            <div className="flex items-start gap-3">
              <div>
                <h3 className={`font-semibold mb-2 ${darkMode ? "text-white" : "text-gray-800"}`}>
                  AI Insight
                </h3>
                <p className={`text-lg leading-relaxed ${darkMode ? "text-gray-200" : "text-gray-700"}`}>
                  {getInsightText()}
                </p>
              </div>
            </div>
          </div>

          {result.riskAssessment && (
            <div
              className={`p-6 rounded-2xl shadow-lg ${
                darkMode ? "bg-gray-800 border border-gray-700" : "bg-white border border-gray-100"
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className={`font-semibold ${darkMode ? "text-white" : "text-gray-800"}`}>
                  Mental Health Risk Score
                </h3>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    result.riskAssessment.riskLevel === "critical"
                      ? "bg-red-100 text-red-700"
                      : result.riskAssessment.riskLevel === "high"
                      ? "bg-orange-100 text-orange-700"
                      : result.riskAssessment.riskLevel === "moderate"
                      ? "bg-yellow-100 text-yellow-700"
                      : "bg-green-100 text-green-700"
                  }`}
                >
                  {String(result.riskAssessment.riskLevel).toUpperCase()}
                </span>
              </div>

              <div className="mb-3">
                <div className={`text-sm mb-1 ${darkMode ? "text-gray-300" : "text-gray-600"}`}>
                  Score: {result.riskAssessment.riskScore}/100
                </div>
                <div className={`w-full h-2 rounded-full ${darkMode ? "bg-gray-700" : "bg-gray-200"}`}>
                  <div
                    className={`h-2 rounded-full ${
                      result.riskAssessment.riskScore >= 85
                        ? "bg-red-500"
                        : result.riskAssessment.riskScore >= 65
                        ? "bg-orange-500"
                        : result.riskAssessment.riskScore >= 40
                        ? "bg-yellow-500"
                        : "bg-green-500"
                    }`}
                    style={{ width: `${result.riskAssessment.riskScore}%` }}
                  />
                </div>
              </div>

              {result.riskAssessment.warningTriggered && (
                <div
                  className={`mb-3 p-3 rounded-lg ${
                    darkMode ? "bg-red-900/30 text-red-200" : "bg-red-50 text-red-700"
                  }`}
                >
                  Early warning: Your current signals indicate elevated emotional strain. Consider taking support actions now.
                </div>
              )}

              <div>
                <div className={`text-sm font-medium mb-2 ${darkMode ? "text-gray-300" : "text-gray-700"}`}>
                  Suggested support actions
                </div>
                <ul className="space-y-1">
                  {(result.riskAssessment.supportResources ?? []).map((item: string, index: number) => (
                    <li key={index} className={`text-sm ${darkMode ? "text-gray-300" : "text-gray-700"}`}>
                      - {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          <div className="grid md:grid-cols-3 gap-6">
            <RecommendationCard
              title="Music for You"
              items={result.recommendations.songs}
              darkMode={darkMode}
              renderItem={(song: any) => (
                <div className="space-y-1">
                  <div className="font-medium">{song.title}</div>
                  <div className={`text-sm ${darkMode ? "text-gray-400" : "text-gray-600"}`}>by {song.artist}</div>
                  <div className={`text-xs ${darkMode ? "text-gray-500" : "text-gray-500"}`}>{song.reason}</div>
                </div>
              )}
            />

            <RecommendationCard
              title="Movies to Watch"
              items={result.recommendations.movies}
              darkMode={darkMode}
              renderItem={(movie: any) => (
                <div className="space-y-1">
                  <div className="font-medium">{movie.title}</div>
                  <div className={`text-sm ${darkMode ? "text-gray-400" : "text-gray-600"}`}>
                    {movie.genre} - {movie.year}
                  </div>
                  <div className={`text-xs ${darkMode ? "text-gray-500" : "text-gray-500"}`}>{movie.reason}</div>
                </div>
              )}
            />

            <RecommendationCard
              title="Activities"
              items={result.recommendations.activities}
              darkMode={darkMode}
              renderItem={(activity: any) => (
                <div className="space-y-1">
                  <div className="font-medium">{activity.title}</div>
                  <div className={`text-sm ${darkMode ? "text-gray-400" : "text-gray-600"}`}>{activity.description}</div>
                </div>
              )}
            />
          </div>

          <div className="text-center">
            <button
              onClick={resetForm}
              className={`py-2 px-6 rounded-lg font-medium transition-colors ${
                darkMode ? "bg-gray-700 hover:bg-gray-600 text-white" : "bg-gray-100 hover:bg-gray-200 text-gray-700"
              }`}
            >
              Track Another Mood
            </button>
          </div>
        </div>
      )}

      <div
        className={`p-6 rounded-2xl shadow-lg ${
          darkMode ? "bg-gray-800 border border-gray-700" : "bg-white border border-gray-100"
        }`}
      >
        <button
          type="button"
          onClick={() => setShowToolkit((v) => !v)}
          className={`w-full flex items-center justify-between font-semibold ${
            darkMode ? "text-white" : "text-gray-800"
          }`}
        >
          <span>Wellness Toolkit</span>
          <span>{showToolkit ? "Hide" : "Show"}</span>
        </button>
        {showToolkit && (
          <div className="mt-4 space-y-3">
            <div className={`p-3 rounded-lg ${darkMode ? "bg-gray-700 text-gray-300" : "bg-gray-50 text-gray-700"}`}>
              60-second reset: inhale 4s, hold 4s, exhale 6s. Repeat 5 rounds.
            </div>
            <div className={`p-3 rounded-lg ${darkMode ? "bg-gray-700 text-gray-300" : "bg-gray-50 text-gray-700"}`}>
              If you feel unsafe, contact local emergency services immediately.
            </div>
            <a href="https://findahelpline.com/" target="_blank" rel="noreferrer" className="inline-block text-sm underline">
              Find a mental health helpline in your country
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

function RecommendationCard({
  title,
  items,
  darkMode,
  renderItem,
}: {
  title: string;
  items: any[];
  darkMode: boolean;
  renderItem: (item: any) => React.ReactNode;
}) {
  return (
    <div
      className={`p-6 rounded-2xl shadow-lg ${
        darkMode ? "bg-gray-800 border border-gray-700" : "bg-white border border-gray-100"
      }`}
    >
      <h3 className={`font-semibold mb-4 ${darkMode ? "text-white" : "text-gray-800"}`}>{title}</h3>
      <div className="space-y-4">
        {items.map((item, index) => (
          <div key={index} className={`${darkMode ? "bg-gray-700" : "bg-gray-50"} p-3 rounded-lg`}>
            {renderItem(item)}
          </div>
        ))}
      </div>
    </div>
  );
}
