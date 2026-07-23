export type SupportedFileKind = "text" | "markdown" | "pdf" | "image" | "audio";
export type SupportedFileExtension =
  | "txt"
  | "md"
  | "pdf"
  | "jpg"
  | "jpeg"
  | "png"
  | "mp3"
  | "wav"
  | "m4a"
  | "aac"
  | "ogg"
  | "flac";

export interface SupportedFileDefinition {
  extension: SupportedFileExtension;
  kind: SupportedFileKind;
  canonicalMimeType: string;
  acceptedMimeTypes: readonly string[];
  maxSizeBytes: number;
  label: string;
}

export const MEBIBYTE = 1024 * 1024;

const TEXT_MAX_SIZE = 10 * MEBIBYTE;
const PDF_MAX_SIZE = 25 * MEBIBYTE;
const IMAGE_MAX_SIZE = 20 * MEBIBYTE;
// Base64 encoding adds roughly 33%; keep the encoded API request below 40 MB.
const AUDIO_MAX_SIZE = 25 * MEBIBYTE;

export const SUPPORTED_FILE_DEFINITIONS = {
  txt: {
    extension: "txt",
    kind: "text",
    canonicalMimeType: "text/plain",
    acceptedMimeTypes: ["text/plain"],
    maxSizeBytes: TEXT_MAX_SIZE,
    label: "텍스트",
  },
  md: {
    extension: "md",
    kind: "markdown",
    canonicalMimeType: "text/markdown",
    acceptedMimeTypes: ["text/markdown", "text/x-markdown", "text/plain"],
    maxSizeBytes: TEXT_MAX_SIZE,
    label: "Markdown",
  },
  pdf: {
    extension: "pdf",
    kind: "pdf",
    canonicalMimeType: "application/pdf",
    acceptedMimeTypes: ["application/pdf"],
    maxSizeBytes: PDF_MAX_SIZE,
    label: "PDF",
  },
  jpg: {
    extension: "jpg",
    kind: "image",
    canonicalMimeType: "image/jpeg",
    acceptedMimeTypes: ["image/jpeg", "image/jpg"],
    maxSizeBytes: IMAGE_MAX_SIZE,
    label: "JPG 이미지",
  },
  jpeg: {
    extension: "jpeg",
    kind: "image",
    canonicalMimeType: "image/jpeg",
    acceptedMimeTypes: ["image/jpeg", "image/jpg"],
    maxSizeBytes: IMAGE_MAX_SIZE,
    label: "JPEG 이미지",
  },
  png: {
    extension: "png",
    kind: "image",
    canonicalMimeType: "image/png",
    acceptedMimeTypes: ["image/png"],
    maxSizeBytes: IMAGE_MAX_SIZE,
    label: "PNG 이미지",
  },
  mp3: {
    extension: "mp3",
    kind: "audio",
    canonicalMimeType: "audio/mpeg",
    acceptedMimeTypes: ["audio/mpeg", "audio/mp3", "audio/x-mpeg"],
    maxSizeBytes: AUDIO_MAX_SIZE,
    label: "MP3 오디오",
  },
  wav: {
    extension: "wav",
    kind: "audio",
    canonicalMimeType: "audio/wav",
    acceptedMimeTypes: ["audio/wav", "audio/x-wav", "audio/wave"],
    maxSizeBytes: AUDIO_MAX_SIZE,
    label: "WAV 오디오",
  },
  m4a: {
    extension: "m4a",
    kind: "audio",
    canonicalMimeType: "audio/mp4",
    acceptedMimeTypes: ["audio/mp4", "audio/m4a", "audio/x-m4a"],
    maxSizeBytes: AUDIO_MAX_SIZE,
    label: "M4A 오디오",
  },
  aac: {
    extension: "aac",
    kind: "audio",
    canonicalMimeType: "audio/aac",
    acceptedMimeTypes: ["audio/aac", "audio/x-aac"],
    maxSizeBytes: AUDIO_MAX_SIZE,
    label: "AAC 오디오",
  },
  ogg: {
    extension: "ogg",
    kind: "audio",
    canonicalMimeType: "audio/ogg",
    acceptedMimeTypes: ["audio/ogg", "application/ogg"],
    maxSizeBytes: AUDIO_MAX_SIZE,
    label: "OGG 오디오",
  },
  flac: {
    extension: "flac",
    kind: "audio",
    canonicalMimeType: "audio/flac",
    acceptedMimeTypes: ["audio/flac", "audio/x-flac"],
    maxSizeBytes: AUDIO_MAX_SIZE,
    label: "FLAC 오디오",
  },
} as const satisfies Record<
  SupportedFileExtension,
  SupportedFileDefinition
>;

export const SUPPORTED_FILE_EXTENSIONS = Object.freeze(
  Object.keys(SUPPORTED_FILE_DEFINITIONS) as SupportedFileExtension[],
);

export const FILE_ACCEPT_ATTRIBUTE = SUPPORTED_FILE_EXTENSIONS.map(
  (extension) => `.${extension}`,
).join(",");

export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"] as const;
  const exponent = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );
  const value = bytes / 1024 ** exponent;
  return `${value >= 10 || exponent === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[exponent]}`;
}
