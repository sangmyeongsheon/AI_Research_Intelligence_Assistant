import type { SourceArtifact, SourceExcerpt } from "@/src/types";

export interface TimedTranscriptSegment {
  startSeconds: number;
  endSeconds: number;
  speaker: string;
  text: string;
}

export function formatTranscriptTimestamp(seconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const remainder = safeSeconds % 60;
  const minuteText = String(minutes).padStart(2, "0");
  const base = `${minuteText}:${String(remainder).padStart(2, "0")}`;
  return hours > 0 ? `${String(hours).padStart(2, "0")}:${base}` : base;
}

export function formatTimedTranscript(
  segments: TimedTranscriptSegment[],
): string {
  return [...segments]
    .sort((left, right) => left.startSeconds - right.startSeconds)
    .map((segment) => {
      const range = `${formatTranscriptTimestamp(segment.startSeconds)}-${formatTranscriptTimestamp(segment.endSeconds)}`;
      const speaker = segment.speaker.trim();
      return `[${range}]${speaker ? ` ${speaker}:` : ""} ${segment.text.trim()}`;
    })
    .join("\n");
}

export function resolveSourceReviewText(
  source: SourceArtifact,
  excerpts: SourceExcerpt[],
): string {
  const extractedText = source.extractedText.trim();
  if (extractedText) return extractedText;
  return excerpts
    .map((excerpt) => excerpt.excerptText.trim())
    .filter(Boolean)
    .join("\n\n");
}
