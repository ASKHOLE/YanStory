import { z } from "zod";

export const BasePropertiesSchema = z.object({
  summary: z.string().optional(),
  notes: z.string().optional(),
  tags: z.array(z.string()).default([]),
});

export const ChapterPropertiesSchema = BasePropertiesSchema.extend({
  chapterNumber: z.number().int().nonnegative(),
  targetWords: z.number().int().nonnegative().optional(),
  status: z.enum(["draft", "revised", "final"]).default("draft"),
});

export const ScenePropertiesSchema = BasePropertiesSchema.extend({
  sceneNumber: z.number().int().nonnegative(),
  viewpointCharacter: z.string().optional(),
  setting: z.string().optional(),
  mood: z.string().optional(),
});

export const ParagraphPropertiesSchema = BasePropertiesSchema.extend({
  paragraphNumber: z.number().int().nonnegative(),
});

export const CharacterPropertiesSchema = BasePropertiesSchema.extend({
  aliases: z.array(z.string()).default([]),
  age: z.union([z.number(), z.string()]).optional(),
  appearance: z.string().optional(),
  motivation: z.string().optional(),
  goal: z.string().optional(),
  fear: z.string().optional(),
  secret: z.string().optional(),
});

export const LocationPropertiesSchema = BasePropertiesSchema.extend({
  region: z.string().optional(),
  atmosphere: z.string().optional(),
  significance: z.string().optional(),
});

export const EventPropertiesSchema = BasePropertiesSchema.extend({
  time: z.string().optional(),
  importance: z.enum(["minor", "major", "turning"]).default("minor"),
});

export const PromisePropertiesSchema = BasePropertiesSchema.extend({
  madeBy: z.string(),
  madeTo: z.string(),
  chapterMade: z.string(),
  status: z.enum(["active", "broken", "fulfilled"]).default("active"),
});

export const NodePropertiesSchema = z.union([
  ChapterPropertiesSchema,
  ScenePropertiesSchema,
  ParagraphPropertiesSchema,
  CharacterPropertiesSchema,
  LocationPropertiesSchema,
  EventPropertiesSchema,
  PromisePropertiesSchema,
  BasePropertiesSchema,
]);

export type BaseProperties = z.infer<typeof BasePropertiesSchema>;
export type ChapterProperties = z.infer<typeof ChapterPropertiesSchema>;
export type SceneProperties = z.infer<typeof ScenePropertiesSchema>;
export type ParagraphProperties = z.infer<typeof ParagraphPropertiesSchema>;
export type CharacterProperties = z.infer<typeof CharacterPropertiesSchema>;
export type LocationProperties = z.infer<typeof LocationPropertiesSchema>;
export type EventProperties = z.infer<typeof EventPropertiesSchema>;
export type PromiseProperties = z.infer<typeof PromisePropertiesSchema>;
export type NodeProperties = z.infer<typeof NodePropertiesSchema>;
