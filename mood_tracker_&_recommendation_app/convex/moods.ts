import { v } from "convex/values";
import { query, mutation, internalMutation, internalQuery, action } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";

type RiskLevel = "low" | "moderate" | "high" | "critical";

type RiskAssessment = {
  riskScore: number;
  riskLevel: RiskLevel;
  warningTriggered: boolean;
  modalitySignals: {
    textScore: number;
    voiceScore?: number;
    faceScore?: number;
  };
  supportResources: string[];
};

function buildUserContextSummary(params: {
  favoriteGenres: string[];
  preferredActivities: string[];
  recentMoods: Array<{ sentiment: string; emotions: string[] }>;
}) {
  const { favoriteGenres, preferredActivities, recentMoods } = params;
  const sentimentCounts = { positive: 0, neutral: 0, negative: 0 };
  const emotionCounts: Record<string, number> = {};

  for (const mood of recentMoods) {
    if (mood.sentiment === "positive") sentimentCounts.positive += 1;
    else if (mood.sentiment === "negative") sentimentCounts.negative += 1;
    else sentimentCounts.neutral += 1;

    for (const emotion of mood.emotions) {
      emotionCounts[emotion] = (emotionCounts[emotion] ?? 0) + 1;
    }
  }

  const topEmotions = Object.entries(emotionCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([emotion]) => emotion);

  const dominantSentiment =
    sentimentCounts.negative > sentimentCounts.positive &&
    sentimentCounts.negative > sentimentCounts.neutral
      ? "negative"
      : sentimentCounts.positive > sentimentCounts.neutral
        ? "positive"
        : "neutral";

  return [
    `Preferred music genres: ${favoriteGenres.length > 0 ? favoriteGenres.join(", ") : "not set"}`,
    `Preferred activities: ${preferredActivities.length > 0 ? preferredActivities.join(", ") : "not set"}`,
    `Recent sentiment trend (${recentMoods.length} entries): positive=${sentimentCounts.positive}, neutral=${sentimentCounts.neutral}, negative=${sentimentCounts.negative}`,
    `Dominant recent sentiment: ${dominantSentiment}`,
    `Frequent recent emotions: ${topEmotions.length > 0 ? topEmotions.join(", ") : "none yet"}`,
  ].join("\n");
}

function toScoreRange(value: number) {
  return Math.max(0, Math.min(100, value));
}

function sentimentBaseRisk(sentiment: string, confidence: number) {
  const normalizedConfidence = Math.max(0, Math.min(1, confidence));
  if (sentiment === "negative") return 50 + normalizedConfidence * 40;
  if (sentiment === "neutral") return 30 + normalizedConfidence * 20;
  return 8 + normalizedConfidence * 12;
}

function emotionRiskAdjustment(emotions: string[]) {
  const weights: Record<string, number> = {
    depressed: 20,
    hopeless: 20,
    panic: 18,
    anxious: 14,
    overwhelmed: 12,
    stressed: 10,
    angry: 8,
    lonely: 10,
    sad: 10,
    calm: -10,
    grateful: -10,
    hopeful: -8,
    joyful: -12,
    happy: -10,
    content: -8,
  };
  const score = emotions.reduce((sum, emotion) => {
    return sum + (weights[emotion.toLowerCase()] ?? 0);
  }, 0);
  return Math.max(-15, Math.min(25, score));
}

function cueRiskScore(
  cue: string | undefined,
  confidence: number | undefined,
) {
  if (!cue) return undefined;
  const scoreMap: Record<string, number> = {
    depressed: 95,
    panic: 90,
    anxious: 78,
    stressed: 72,
    angry: 68,
    sad: 70,
    tired: 55,
    neutral: 45,
    calm: 20,
    happy: 15,
    joyful: 12,
  };
  const base = scoreMap[cue.toLowerCase()] ?? 50;
  if (confidence === undefined) return base;
  const normalizedConfidence = Math.max(0, Math.min(1, confidence));
  return toScoreRange(base * (0.65 + normalizedConfidence * 0.35));
}

function riskLevelFromScore(score: number): RiskLevel {
  if (score >= 85) return "critical";
  if (score >= 65) return "high";
  if (score >= 40) return "moderate";
  return "low";
}

function supportResourcesForLevel(level: RiskLevel): string[] {
  if (level === "critical") {
    return [
      "Immediate grounding: 5-4-3-2-1 sensory reset for 2 minutes.",
      "Contact a trusted person now and share that you need support.",
      "If you feel unsafe, call emergency services in your area immediately.",
    ];
  }
  if (level === "high") {
    return [
      "Take a 10-minute breathing and hydration break.",
      "Use a short journaling prompt: 'What is one thing I can control right now?'",
      "Reach out to a friend, mentor, or counselor today.",
    ];
  }
  if (level === "moderate") {
    return [
      "Take a 10-minute walk or light stretch.",
      "Pick one low-pressure task and complete it fully.",
      "Play one calming song from your recommended list.",
    ];
  }
  return [
    "Maintain momentum with one healthy habit today.",
    "Log one gratitude note to reinforce emotional stability.",
  ];
}

function deriveRiskAssessment(args: {
  sentiment: string;
  confidence: number;
  emotions: string[];
  voiceEmotion?: string;
  facialEmotion?: string;
  voiceConfidence?: number;
  facialConfidence?: number;
}): RiskAssessment {
  const textScore = toScoreRange(
    sentimentBaseRisk(args.sentiment, args.confidence) +
      emotionRiskAdjustment(args.emotions),
  );
  const voiceScore = cueRiskScore(args.voiceEmotion, args.voiceConfidence);
  const faceScore = cueRiskScore(args.facialEmotion, args.facialConfidence);

  const weightedScore = toScoreRange(
    textScore * 0.65 +
      (voiceScore ?? textScore) * 0.2 +
      (faceScore ?? textScore) * 0.15,
  );
  const riskLevel = riskLevelFromScore(weightedScore);
  return {
    riskScore: Math.round(weightedScore),
    riskLevel,
    warningTriggered: riskLevel === "high" || riskLevel === "critical",
    modalitySignals: {
      textScore: Math.round(textScore),
      voiceScore: voiceScore !== undefined ? Math.round(voiceScore) : undefined,
      faceScore: faceScore !== undefined ? Math.round(faceScore) : undefined,
    },
    supportResources: supportResourcesForLevel(riskLevel),
  };
}

// Get user's mood history
export const getMoodHistory = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    return await ctx.db
      .query("moods")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(args.limit ?? 20);
  },
});

// Get mood statistics for charts
export const getMoodStats = query({
  args: { days: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const daysBack = args.days ?? 7;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);

    return await ctx.db
      .query("moodStats")
      .withIndex("by_user_and_date", (q) => q.eq("userId", userId))
      .filter((q) => q.gte(q.field("date"), startDate.toISOString().split('T')[0]))
      .collect();
  },
});

// Get user preferences
export const getUserPreferences = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const prefs = await ctx.db
      .query("userPreferences")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    return prefs ?? {
      favoriteGenres: [],
      preferredActivities: [],
      darkMode: false,
      notificationsEnabled: true,
    };
  },
});

// Update user preferences
export const updatePreferences = mutation({
  args: {
    favoriteGenres: v.optional(v.array(v.string())),
    preferredActivities: v.optional(v.array(v.string())),
    darkMode: v.optional(v.boolean()),
    notificationsEnabled: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const existing = await ctx.db
      .query("userPreferences")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, args);
    } else {
      await ctx.db.insert("userPreferences", {
        userId,
        favoriteGenres: args.favoriteGenres ?? [],
        preferredActivities: args.preferredActivities ?? [],
        darkMode: args.darkMode ?? false,
        notificationsEnabled: args.notificationsEnabled ?? true,
      });
    }
  },
});

// Analyze mood and get recommendations
export const analyzeMood = action({
  args: {
    text: v.string(),
    inputMethod: v.string(),
    voiceEmotion: v.optional(v.string()),
    voiceConfidence: v.optional(v.number()),
    facialEmotion: v.optional(v.string()),
    facialConfidence: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const [prefs, recentMoods] = await Promise.all([
      ctx.runQuery(internal.moods.getCurrentUserPreferencesInternal, { userId }),
      ctx.runQuery(internal.moods.getRecentMoodContextInternal, { userId, limit: 12 }),
    ]);
    const userContext = buildUserContextSummary({
      favoriteGenres: prefs.favoriteGenres,
      preferredActivities: prefs.preferredActivities,
      recentMoods,
    });

    // Call AI analysis
    const analysis: any = await ctx.runAction(internal.ai.analyzeSentiment, {
      text: args.text,
    });
    const riskAssessment = deriveRiskAssessment({
      sentiment: analysis.sentiment,
      confidence: analysis.confidence,
      emotions: analysis.emotions,
      voiceEmotion: args.voiceEmotion,
      facialEmotion: args.facialEmotion,
      voiceConfidence: args.voiceConfidence,
      facialConfidence: args.facialConfidence,
    });

    // Generate recommendations based on mood
    const recommendations: any = await ctx.runAction(internal.ai.generateRecommendations, {
      sentiment: analysis.sentiment,
      emotions: analysis.emotions,
      text: `${args.text}\n\nUser context:\n${userContext}`,
    });

    // Generate personalized AI message
    const aiMessage: string = await ctx.runAction(internal.ai.generatePersonalizedMessage, {
      sentiment: analysis.sentiment,
      emotions: analysis.emotions,
      text: `${args.text}\n\nUser context:\n${userContext}`,
    });

    // Save mood entry
    const moodId: Id<"moods"> = await ctx.runMutation(internal.moods.saveMoodEntry, {
      userId,
      text: args.text,
      sentiment: analysis.sentiment,
      confidence: analysis.confidence,
      emotions: analysis.emotions,
      recommendations,
      aiMessage,
      inputMethod: args.inputMethod,
      riskScore: riskAssessment.riskScore,
      riskLevel: riskAssessment.riskLevel,
      warningTriggered: riskAssessment.warningTriggered,
      modalitySignals: riskAssessment.modalitySignals,
      supportResources: riskAssessment.supportResources,
    });

    // Update daily stats
    await ctx.runMutation(internal.moods.updateDailyStats, {
      userId,
      sentiment: analysis.sentiment,
      emotions: analysis.emotions,
    });

    return {
      moodId,
      analysis,
      recommendations,
      aiMessage,
      riskAssessment,
    };
  },
});

export const analyzeFaceSignal = action({
  args: {
    imageDataUrl: v.string(),
  },
  handler: async (ctx, args): Promise<{ emotion: string; confidence: number }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const result = await ctx.runAction(internal.ai.analyzeFaceEmotion, {
      imageDataUrl: args.imageDataUrl,
    });
    return {
      emotion: result.emotion,
      confidence: result.confidence,
    };
  },
});

export const analyzeVoiceSignal = action({
  args: {
    audioBase64: v.string(),
    mimeType: v.string(),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ transcript: string; emotion: string; confidence: number }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const result = await ctx.runAction(internal.ai.analyzeVoiceEmotion, {
      audioBase64: args.audioBase64,
      mimeType: args.mimeType,
    });
    return {
      transcript: result.transcript,
      emotion: result.emotion,
      confidence: result.confidence,
    };
  },
});

export const getCurrentUserPreferencesInternal = internalQuery({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const prefs = await ctx.db
      .query("userPreferences")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .unique();

    return (
      prefs ?? {
        favoriteGenres: [],
        preferredActivities: [],
        darkMode: false,
        notificationsEnabled: true,
      }
    );
  },
});

export const getRecentMoodContextInternal = internalQuery({
  args: {
    userId: v.id("users"),
    limit: v.number(),
  },
  handler: async (ctx, args) => {
    const moods = await ctx.db
      .query("moods")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(args.limit);

    return moods.map((mood) => ({
      sentiment: mood.sentiment,
      emotions: mood.emotions,
    }));
  },
});

// Internal function to save mood entry
export const saveMoodEntry = internalMutation({
  args: {
    userId: v.id("users"),
    text: v.string(),
    sentiment: v.string(),
    confidence: v.number(),
    emotions: v.array(v.string()),
    recommendations: v.object({
      songs: v.array(v.object({
        title: v.string(),
        artist: v.string(),
        genre: v.string(),
        reason: v.string()
      })),
      movies: v.array(v.object({
        title: v.string(),
        genre: v.string(),
        year: v.number(),
        reason: v.string()
      })),
      activities: v.array(v.object({
        title: v.string(),
        description: v.string(),
        category: v.string()
      }))
    }),
    aiMessage: v.string(),
    inputMethod: v.string(),
    riskScore: v.optional(v.number()),
    riskLevel: v.optional(v.string()),
    warningTriggered: v.optional(v.boolean()),
    modalitySignals: v.optional(
      v.object({
        textScore: v.number(),
        voiceScore: v.optional(v.number()),
        faceScore: v.optional(v.number()),
      }),
    ),
    supportResources: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("moods", args);
  },
});

// Internal function to update daily stats
export const updateDailyStats = internalMutation({
  args: {
    userId: v.id("users"),
    sentiment: v.string(),
    emotions: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const today = new Date().toISOString().split('T')[0];
    
    const existing = await ctx.db
      .query("moodStats")
      .withIndex("by_user_and_date", (q) => 
        q.eq("userId", args.userId).eq("date", today)
      )
      .unique();

    const sentimentScore = args.sentiment === "positive" ? 1 : 
                          args.sentiment === "negative" ? -1 : 0;

    if (existing) {
      const newCount = existing.moodCount + 1;
      const newAverage = (existing.averageSentiment * existing.moodCount + sentimentScore) / newCount;
      
      await ctx.db.patch(existing._id, {
        averageSentiment: newAverage,
        moodCount: newCount,
        dominantEmotion: args.emotions[0] || existing.dominantEmotion,
      });
    } else {
      await ctx.db.insert("moodStats", {
        userId: args.userId,
        date: today,
        averageSentiment: sentimentScore,
        moodCount: 1,
        dominantEmotion: args.emotions[0] || "neutral",
      });
    }
  },
});
