"use node";

import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import OpenAI from "openai";
import { toFile } from "openai/uploads";

const apiKey = process.env.OPENAI_API_TOKEN;
if (!apiKey) {
  throw new Error(
    "OPENAI_API_TOKEN is not set. Configure it with `convex env set OPENAI_API_TOKEN <key>`.",
  );
}

const openai = new OpenAI({
  apiKey,
});

const nlpModel = process.env.OPENAI_NLP_MODEL ?? "gpt-4.1-mini";
const insightModel = process.env.OPENAI_INSIGHT_MODEL ?? nlpModel;

type RecommendationPayload = {
  songs: Array<{ title: string; artist: string; genre: string; reason: string }>;
  movies: Array<{ title: string; genre: string; year: number; reason: string }>;
  activities: Array<{ title: string; description: string; category: string }>;
};

function extractUserPreferences(userContext: string) {
  const genreMatch = userContext.match(/Preferred music genres:\s*(.+)/i);
  const activityMatch = userContext.match(/Preferred activities:\s*(.+)/i);
  const genresRaw = genreMatch?.[1]?.trim() ?? "not set";
  const activitiesRaw = activityMatch?.[1]?.trim() ?? "not set";
  const favoriteGenres =
    genresRaw.toLowerCase() === "not set"
      ? []
      : genresRaw.split(",").map((g) => g.trim()).filter(Boolean);
  const preferredActivities =
    activitiesRaw.toLowerCase() === "not set"
      ? []
      : activitiesRaw.split(",").map((a) => a.trim()).filter(Boolean);
  return { favoriteGenres, preferredActivities };
}

function splitInputAndUserContext(rawText: string) {
  const marker = "\n\nUser context:\n";
  const markerIndex = rawText.indexOf(marker);
  if (markerIndex === -1) {
    return { userText: rawText, userContext: "No saved preferences or history context provided." };
  }

  const userText = rawText.slice(0, markerIndex).trim();
  const userContext = rawText.slice(markerIndex + marker.length).trim();
  return {
    userText: userText.length > 0 ? userText : rawText,
    userContext: userContext.length > 0 ? userContext : "No saved preferences or history context provided.",
  };
}

function parseJsonObject(raw: string | null | undefined): Record<string, unknown> | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  const withoutFence = trimmed
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/, "");
  try {
    return JSON.parse(withoutFence) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function heuristicSentiment(text: string): {
  sentiment: "positive" | "negative" | "neutral";
  confidence: number;
  emotions: string[];
} {
  const lower = text.toLowerCase();
  const negativeWords = [
    "sad", "depressed", "stressed", "anxious", "angry", "tired", "burnout",
    "overwhelmed", "panic", "hopeless", "lonely", "cry", "worried",
  ];
  const positiveWords = [
    "happy", "grateful", "calm", "excited", "motivated", "productive",
    "relaxed", "hopeful", "joy", "good", "great",
  ];

  const negHits = negativeWords.filter((w) => lower.includes(w)).length;
  const posHits = positiveWords.filter((w) => lower.includes(w)).length;
  const delta = posHits - negHits;

  if (delta >= 2) {
    return {
      sentiment: "positive",
      confidence: Math.min(0.9, 0.55 + delta * 0.08),
      emotions: ["hopeful", "calm"],
    };
  }
  if (delta <= -2) {
    return {
      sentiment: "negative",
      confidence: Math.min(0.92, 0.58 + Math.abs(delta) * 0.08),
      emotions: ["stressed", "overwhelmed"],
    };
  }
  return {
    sentiment: "neutral",
    confidence: 0.55,
    emotions: ["neutral"],
  };
}

function fallbackRecommendations(sentiment: string): RecommendationPayload {
  if (sentiment === "negative") {
    return {
      songs: [
        { title: "Weightless", artist: "Marconi Union", genre: "Ambient", reason: "Slow, calming texture can reduce stress." },
        { title: "Holocene", artist: "Bon Iver", genre: "Indie Folk", reason: "Gentle pacing supports emotional decompression." },
        { title: "Sunset Lover", artist: "Petit Biscuit", genre: "Chill Electronic", reason: "Soft rhythm helps settle racing thoughts." },
      ],
      movies: [
        { title: "The Secret Life of Walter Mitty", genre: "Adventure/Drama", year: 2013, reason: "Hopeful tone without being too intense." },
        { title: "Chef", genre: "Comedy/Drama", year: 2014, reason: "Warm and comforting, with a positive mood." },
        { title: "Paddington 2", genre: "Family/Comedy", year: 2017, reason: "Light and kind-hearted when you need relief." },
      ],
      activities: [
        { title: "10-Minute Walk", description: "Take a slow walk outside without your phone.", category: "wellness" },
        { title: "Breathing Reset", description: "Try 4-4-6 breathing for five rounds.", category: "mindfulness" },
        { title: "Low-Pressure Journaling", description: "Write one page with no structure or rules.", category: "creative" },
      ],
    };
  }

  if (sentiment === "positive") {
    return {
      songs: [
        { title: "Good as Hell", artist: "Lizzo", genre: "Pop", reason: "Keeps your momentum and confidence high." },
        { title: "On Top of the World", artist: "Imagine Dragons", genre: "Pop Rock", reason: "Matches upbeat energy." },
        { title: "Walking on Sunshine", artist: "Katrina and the Waves", genre: "Pop", reason: "Sustains a cheerful mood." },
      ],
      movies: [
        { title: "The Grand Budapest Hotel", genre: "Comedy/Adventure", year: 2014, reason: "Fun, vibrant, and imaginative." },
        { title: "Sing Street", genre: "Comedy/Drama", year: 2016, reason: "Optimistic story with great music." },
        { title: "Spider-Man: Into the Spider-Verse", genre: "Animation/Action", year: 2018, reason: "Energetic and inspiring." },
      ],
      activities: [
        { title: "Share a Win", description: "Message a friend and share one good thing from today.", category: "social" },
        { title: "Creative Sprint", description: "Spend 20 minutes on a hobby you enjoy.", category: "creative" },
        { title: "Plan Tomorrow", description: "Use your good energy to plan one meaningful task.", category: "productivity" },
      ],
    };
  }

  return {
    songs: [
      { title: "Bloom", artist: "The Paper Kites", genre: "Indie", reason: "Balanced mood with gentle warmth." },
      { title: "Intro", artist: "The xx", genre: "Indie Electronic", reason: "Calm focus without heavy intensity." },
      { title: "Awake", artist: "Tycho", genre: "Ambient", reason: "Steady rhythm for neutral, clear thinking." },
    ],
    movies: [
      { title: "The Martian", genre: "Sci-Fi/Drama", year: 2015, reason: "Engaging and motivating without emotional overload." },
      { title: "Kiki's Delivery Service", genre: "Animation/Fantasy", year: 1989, reason: "Gentle and comforting tone." },
      { title: "School of Rock", genre: "Comedy/Music", year: 2003, reason: "Light, fun, and uplifting." },
    ],
    activities: [
      { title: "Hydration + Stretch", description: "Drink water and do a 5-minute stretch break.", category: "wellness" },
      { title: "Focus Block", description: "Pick one small task and finish it in 25 minutes.", category: "productivity" },
      { title: "Mood Check-In", description: "Rate your mood from 1-10 and note one trigger.", category: "reflection" },
    ],
  };
}

function personalizedFallbackRecommendations(
  sentiment: string,
  userContext: string,
): RecommendationPayload {
  const base = fallbackRecommendations(sentiment);
  const { favoriteGenres, preferredActivities } = extractUserPreferences(userContext);

  if (favoriteGenres.length > 0) {
    base.songs = base.songs.map((song, index) => ({
      ...song,
      genre: favoriteGenres[index % favoriteGenres.length],
      reason:
        index === 0
          ? `Matched to your preferred ${favoriteGenres[index % favoriteGenres.length]} style for better emotional fit.`
          : song.reason,
    }));
  }

  if (preferredActivities.length > 0) {
    base.activities = base.activities.map((activity, index) => ({
      ...activity,
      title: preferredActivities[index % preferredActivities.length],
      description:
        index === 0
          ? `Chosen from your preferences (${preferredActivities.join(", ")}).`
          : activity.description,
    }));
  }

  return base;
}

function fallbackInsightMessage(
  sentiment: string,
  emotions: string[],
  text: string,
): string {
  const { userText } = splitInputAndUserContext(text);
  const primaryEmotion = emotions[0] ?? "neutral";
  const shortText = userText.trim().slice(0, 140);

  if (sentiment === "negative") {
    return `It sounds like you're feeling ${primaryEmotion}, and that can feel heavy. Try one small reset step right now, and be gentle with yourself while you process: "${shortText}".`;
  }

  if (sentiment === "positive") {
    return `You're showing strong ${primaryEmotion} energy right now, which is great momentum. If you can, channel this feeling into one meaningful action while this mood is active.`;
  }

  const neutralTemplates = [
    `From what you shared ("${shortText}"), you seem in a ${primaryEmotion} state. Try one intentional activity now to keep your balance steady.`,
    `Your message suggests a ${primaryEmotion} baseline right now. A short check-in and one focused step can help you stay clear and grounded.`,
    `You're currently reading as ${primaryEmotion}. Pick one small action from your plan to maintain emotional stability.`,
  ];
  const idx = shortText.length % neutralTemplates.length;
  return neutralTemplates[idx];
}

async function createChatCompletion(
  params: OpenAI.Chat.ChatCompletionCreateParamsNonStreaming,
) {
  try {
    return await openai.chat.completions.create(params);
  } catch (error) {
    const status = (error as { status?: number })?.status;
    if (status === 429) {
      console.warn(
        "OpenAI quota/rate limit reached (429). Returning fallback AI response.",
      );
      return null;
    }
    throw error;
  }
}

function dataUrlToBuffer(dataUrl: string) {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) throw new Error("Invalid data URL format");
  const mimeType = match[1];
  const base64 = match[2];
  return {
    mimeType,
    buffer: Buffer.from(base64, "base64"),
  };
}

function parseEmotionPayload(raw: string | null | undefined) {
  const parsed = parseJsonObject(raw);
  if (!parsed) return { emotion: "neutral", confidence: 0.5 };
  const emotion = typeof parsed.emotion === "string" ? parsed.emotion : "neutral";
  const confidence =
    typeof parsed.confidence === "number"
      ? Math.max(0, Math.min(1, parsed.confidence))
      : 0.5;
  return { emotion, confidence };
}

// Analyze sentiment and emotions
export const analyzeSentiment = internalAction({
  args: { text: v.string() },
  handler: async (ctx, args) => {
    const prompt = `Analyze the sentiment and emotions in this text: "${args.text}"

Return a JSON response with:
- sentiment: "positive", "negative", or "neutral"
- confidence: number between 0 and 1
- emotions: array of specific emotions detected (e.g., ["happy", "excited", "calm"])

Text: "${args.text}"

Response format:
{
  "sentiment": "positive|negative|neutral",
  "confidence": 0.85,
  "emotions": ["happy", "excited"]
}`;

    const response = await createChatCompletion({
      model: nlpModel,
      messages: [
        {
          role: "system",
          content:
            "You are a precise NLP sentiment analyzer. Return only valid JSON in the requested shape.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.1,
    });
    if (!response) {
      return heuristicSentiment(args.text);
    }

    try {
      const result = parseJsonObject(response.choices[0].message.content);
      if (!result) throw new Error("Invalid JSON from model");
      const sentiment =
        result.sentiment === "positive" ||
        result.sentiment === "negative" ||
        result.sentiment === "neutral"
          ? (result.sentiment as "positive" | "negative" | "neutral")
          : undefined;
      const confidence =
        typeof result.confidence === "number"
          ? Math.max(0, Math.min(1, result.confidence))
          : undefined;
      const emotions = Array.isArray(result.emotions)
        ? (result.emotions as string[]).filter((e) => typeof e === "string" && e.trim().length > 0)
        : undefined;

      if (!sentiment || confidence === undefined || !emotions || emotions.length === 0) {
        return heuristicSentiment(args.text);
      }
      return {
        sentiment,
        confidence,
        emotions,
      };
    } catch {
      return heuristicSentiment(args.text);
    }
  },
});

// Generate personalized recommendations
export const generateRecommendations = internalAction({
  args: {
    sentiment: v.string(),
    emotions: v.array(v.string()),
    text: v.string(),
  },
  handler: async (ctx, args) => {
    const { userText, userContext } = splitInputAndUserContext(args.text);
    const prompt = `Based on this mood analysis, provide personalized recommendations:

Sentiment: ${args.sentiment}
Emotions: ${args.emotions.join(", ")}
User's current text: "${userText}"
User profile context:
${userContext}

Generate recommendations in this JSON format:
{
  "songs": [
    {"title": "Song Name", "artist": "Artist", "genre": "Genre", "reason": "Why this helps"},
    {"title": "Song Name 2", "artist": "Artist 2", "genre": "Genre 2", "reason": "Why this helps"}
  ],
  "movies": [
    {"title": "Movie Name", "genre": "Genre", "year": 2023, "reason": "Why this helps"},
    {"title": "Movie Name 2", "genre": "Genre 2", "year": 2022, "reason": "Why this helps"}
  ],
  "activities": [
    {"title": "Activity Name", "description": "Brief description", "category": "wellness"},
    {"title": "Activity Name 2", "description": "Brief description", "category": "creative"}
  ]
}

Provide 3-4 items for each category. Match the recommendations to the user's emotional state.`;

    try {
      const response = await createChatCompletion({
        model: nlpModel,
        messages: [
          {
            role: "system",
            content:
              "You are a wellness recommendation engine. Personalize to user context and return only valid JSON.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.6,
      });
      if (!response) {
        return personalizedFallbackRecommendations(args.sentiment, userContext);
      }

      const result = parseJsonObject(response.choices[0].message.content);
      if (!result) throw new Error("Invalid JSON from model");
      const fallback = personalizedFallbackRecommendations(args.sentiment, userContext);
      return {
        songs: Array.isArray(result.songs)
          ? (result.songs as RecommendationPayload["songs"])
          : fallback.songs,
        movies: Array.isArray(result.movies)
          ? (result.movies as RecommendationPayload["movies"])
          : fallback.movies,
        activities: Array.isArray(result.activities)
          ? (result.activities as RecommendationPayload["activities"])
          : fallback.activities,
      };
    } catch {
      return personalizedFallbackRecommendations(args.sentiment, userContext);
    }
  },
});

// Generate personalized AI message
export const generatePersonalizedMessage = internalAction({
  args: {
    sentiment: v.string(),
    emotions: v.array(v.string()),
    text: v.string(),
  },
  handler: async (ctx, args) => {
    const { userText, userContext } = splitInputAndUserContext(args.text);
    const prompt = `Create a supportive, personalized message for someone feeling this way:

Sentiment: ${args.sentiment}
Emotions: ${args.emotions.join(", ")}
Their words: "${userText}"
User profile context:
${userContext}

Write a warm, empathetic response (2-3 sentences) that:
- Acknowledges their feelings
- Offers gentle encouragement or validation
- Is supportive but not overly cheerful if they're struggling

Keep it conversational and genuine.`;

    const response = await createChatCompletion({
      model: insightModel,
      messages: [
        {
          role: "system",
          content:
            "You are an empathetic mental wellness assistant. Be supportive, specific, and concise.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.7,
    });
    if (!response) {
      return fallbackInsightMessage(args.sentiment, args.emotions, args.text);
    }

    const content = response.choices[0].message.content?.trim();
    return content && content.length > 0
      ? content
      : fallbackInsightMessage(args.sentiment, args.emotions, args.text);
  },
});

export const analyzeFaceEmotion = internalAction({
  args: {
    imageDataUrl: v.string(),
  },
  handler: async (_ctx, args) => {
    const { mimeType, buffer } = dataUrlToBuffer(args.imageDataUrl);
    if (!mimeType.startsWith("image/")) {
      throw new Error("Unsupported face image mime type.");
    }
    if (buffer.length > 4 * 1024 * 1024) {
      throw new Error("Image is too large. Use a smaller frame.");
    }

    const response = await createChatCompletion({
      model: nlpModel,
      messages: [
        {
          role: "system",
          content:
            "You are a facial affect classifier. Return only JSON with keys emotion and confidence (0-1).",
        },
        {
          role: "user",
          content: [
            { type: "text", text: "Detect the dominant facial emotion from this image. Return JSON only: {\"emotion\":\"...\",\"confidence\":0.0}" },
            { type: "image_url", image_url: { url: args.imageDataUrl } },
          ],
        },
      ],
      temperature: 0.1,
    });

    if (!response) {
      return { emotion: "neutral", confidence: 0.5 };
    }

    return parseEmotionPayload(response.choices[0].message.content);
  },
});

export const analyzeVoiceEmotion = internalAction({
  args: {
    audioBase64: v.string(),
    mimeType: v.string(),
  },
  handler: async (_ctx, args) => {
    const buffer = Buffer.from(args.audioBase64, "base64");
    if (!args.mimeType.startsWith("audio/")) {
      throw new Error("Unsupported audio mime type.");
    }
    if (buffer.length > 8 * 1024 * 1024) {
      throw new Error("Audio is too large. Use a shorter clip.");
    }

    const file = await toFile(buffer, "voice_sample.webm", {
      type: args.mimeType,
    });
    const transcription = await openai.audio.transcriptions.create({
      file,
      model: "whisper-1",
    });
    const transcript = transcription.text?.trim() ?? "";

    if (!transcript) {
      return { transcript: "", emotion: "neutral", confidence: 0.5 };
    }

    const response = await createChatCompletion({
      model: nlpModel,
      messages: [
        {
          role: "system",
          content:
            "You classify emotion from speech transcript. Return only JSON with keys emotion and confidence (0-1).",
        },
        {
          role: "user",
          content: `Transcript: "${transcript}". Return JSON only: {"emotion":"...","confidence":0.0}`,
        },
      ],
      temperature: 0.1,
    });

    if (!response) {
      return { transcript, emotion: "neutral", confidence: 0.5 };
    }

    const signal = parseEmotionPayload(response.choices[0].message.content);
    return { transcript, emotion: signal.emotion, confidence: signal.confidence };
  },
});
