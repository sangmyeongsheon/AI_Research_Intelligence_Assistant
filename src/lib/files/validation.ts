import {
  SUPPORTED_FILE_DEFINITIONS,
  SUPPORTED_FILE_EXTENSIONS,
  formatFileSize,
  type SupportedFileDefinition,
  type SupportedFileExtension,
} from "./constants";
import { FileProcessingError } from "./errors";
import { getFileExtension, sanitizeFileName } from "./filename";

export interface UploadFileLike {
  name: string;
  size: number;
  type?: string;
}

export interface ValidatedUploadFile {
  originalFileName: string;
  sanitizedFileName: string;
  extension: SupportedFileExtension;
  kind: SupportedFileDefinition["kind"];
  mimeType: string;
  size: number;
  maxSizeBytes: number;
}

export type FileValidationResult =
  | { ok: true; value: ValidatedUploadFile }
  | { ok: false; error: FileProcessingError };

const GENERIC_MIME_TYPES = new Set(["", "application/octet-stream"]);

function unsupportedTypeError(file: UploadFileLike): FileProcessingError {
  return new FileProcessingError({
    code: "UNSUPPORTED_FILE_TYPE",
    title: "지원하지 않는 파일 형식입니다",
    message: `${file.name || "선택한 파일"}은(는) ARIA에서 읽을 수 없는 형식입니다.`,
    recovery: `TXT, MD, PDF, JPG, PNG, MP3, WAV, M4A, AAC, OGG, FLAC 중 하나로 변환한 뒤 다시 추가해 주세요.`,
    dataPreserved: true,
    fileName: file.name,
  });
}

export function validateUploadFile(file: UploadFileLike): FileValidationResult {
  const originalFileName = String(file.name ?? "");
  const sanitizedFileName = sanitizeFileName(originalFileName);
  const extension = getFileExtension(originalFileName);

  if (
    !extension ||
    !SUPPORTED_FILE_EXTENSIONS.includes(extension as SupportedFileExtension)
  ) {
    return { ok: false, error: unsupportedTypeError(file) };
  }

  const definition =
    SUPPORTED_FILE_DEFINITIONS[extension as SupportedFileExtension];

  if (!Number.isFinite(file.size) || file.size <= 0) {
    return {
      ok: false,
      error: new FileProcessingError({
        code: "EMPTY_FILE",
        title: "빈 파일은 추가할 수 없습니다",
        message: `${originalFileName}에 읽을 내용이 없습니다.`,
        recovery: "파일에 내용이 있는지 확인하거나 다른 파일을 선택해 주세요.",
        dataPreserved: true,
        fileName: originalFileName,
      }),
    };
  }

  if (file.size > definition.maxSizeBytes) {
    return {
      ok: false,
      error: new FileProcessingError({
        code: "FILE_TOO_LARGE",
        title: "파일 용량이 너무 큽니다",
        message: `${originalFileName}의 크기는 ${formatFileSize(file.size)}이며, ${definition.label} 제한은 ${formatFileSize(definition.maxSizeBytes)}입니다.`,
        recovery:
          definition.kind === "audio"
            ? "녹음을 구간별로 나누거나 음질을 낮춘 뒤 다시 추가해 주세요."
            : "파일을 나누거나 압축한 뒤 다시 추가해 주세요.",
        dataPreserved: true,
        fileName: originalFileName,
        maxSizeBytes: definition.maxSizeBytes,
      }),
    };
  }

  const mimeType = (file.type ?? "").trim().toLowerCase();
  if (
    !GENERIC_MIME_TYPES.has(mimeType) &&
    !(definition.acceptedMimeTypes as readonly string[]).includes(mimeType)
  ) {
    return {
      ok: false,
      error: new FileProcessingError({
        code: "MIME_EXTENSION_MISMATCH",
        title: "파일 형식 정보가 일치하지 않습니다",
        message: `${originalFileName}의 확장자(.${extension})와 브라우저가 확인한 형식(${mimeType})이 다릅니다.`,
        recovery:
          "확장자만 바꾸지 말고 원본 프로그램에서 지원 형식으로 다시 저장해 주세요.",
        dataPreserved: true,
        fileName: originalFileName,
      }),
    };
  }

  return {
    ok: true,
    value: {
      originalFileName,
      sanitizedFileName,
      extension: definition.extension,
      kind: definition.kind,
      // Browsers report aliases such as audio/x-m4a that Gemini does not
      // consistently accept for inline data. The extension/MIME pair has
      // already been validated, so send the provider's canonical media type.
      mimeType: definition.canonicalMimeType,
      size: file.size,
      maxSizeBytes: definition.maxSizeBytes,
    },
  };
}

export function assertValidUploadFile(
  file: UploadFileLike,
): ValidatedUploadFile {
  const result = validateUploadFile(file);
  if (!result.ok) throw result.error;
  return result.value;
}

export const validateFile = validateUploadFile;
export const assertValidFile = assertValidUploadFile;
