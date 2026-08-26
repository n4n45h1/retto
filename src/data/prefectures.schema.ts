import { z } from "zod";

export const prefectureIdSchema = z.custom<`JP-${string}`>(
  (value) =>
    typeof value === "string" && /^JP-(0[1-9]|[1-3][0-9]|4[0-7])$/.test(value),
  "Expected a JIS prefecture ID from JP-01 through JP-47",
);

export const prefectureMetadataSchema = z.object({
  id: prefectureIdSchema,
  jisCode: z.string().regex(/^(0[1-9]|[1-3][0-9]|4[0-7])$/),
  name: z.string().min(1),
  nameJa: z.string().min(1),
});

export const prefecturesSchema = z
  .array(prefectureMetadataSchema)
  .length(47)
  .superRefine((prefectures, context) => {
    const ids = new Set<string>();
    const codes = new Set<string>();
    for (const [index, prefecture] of prefectures.entries()) {
      const expectedCode = String(index + 1).padStart(2, "0");
      if (
        prefecture.jisCode !== expectedCode ||
        prefecture.id !== `JP-${expectedCode}`
      ) {
        context.addIssue({
          code: "custom",
          message: `Prefecture at index ${index} is not in JIS order`,
          path: [index],
        });
      }
      if (ids.has(prefecture.id) || codes.has(prefecture.jisCode)) {
        context.addIssue({
          code: "custom",
          message: "Prefecture IDs and JIS codes must be unique",
          path: [index],
        });
      }
      ids.add(prefecture.id);
      codes.add(prefecture.jisCode);
    }
  });

export type PrefectureId = z.infer<typeof prefectureIdSchema>;
export type PrefectureMetadata = z.infer<typeof prefectureMetadataSchema>;
