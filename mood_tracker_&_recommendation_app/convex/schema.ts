import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

const applicationTables = {
  moods: defineTable({
    userId: v.id("users"),
    text: v.string(),
    sentiment: v.string(), // "positive", "negative", "neutral"
    confidence: v.number(),
    emotions: v.array(v.string()), // ["happy", "excited", "calm"]
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
    inputMethod: v.string(), // "text" or "voice"
    riskScore: v.optional(v.number()), // 0-100
    riskLevel: v.optional(v.string()), // low | moderate | high | critical
    warningTriggered: v.optional(v.boolean()),
    modalitySignals: v.optional(
      v.object({
        textScore: v.number(),
        voiceScore: v.optional(v.number()),
        faceScore: v.optional(v.number()),
      }),
    ),
    supportResources: v.optional(v.array(v.string())),
  })
    .index("by_user", ["userId"]),

  userPreferences: defineTable({
    userId: v.id("users"),
    favoriteGenres: v.array(v.string()),
    preferredActivities: v.array(v.string()),
    darkMode: v.boolean(),
    notificationsEnabled: v.boolean(),
  })
    .index("by_user", ["userId"]),

  moodStats: defineTable({
    userId: v.id("users"),
    date: v.string(), // YYYY-MM-DD format
    averageSentiment: v.number(),
    moodCount: v.number(),
    dominantEmotion: v.string(),
  })
    .index("by_user_and_date", ["userId", "date"]),
};

export default defineSchema({
  ...authTables,
  ...applicationTables,
});
