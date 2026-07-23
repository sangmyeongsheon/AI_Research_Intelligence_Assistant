export type FileErrorCode =
  | "UNSUPPORTED_FILE_TYPE"
  | "EMPTY_FILE"
  | "FILE_TOO_LARGE"
  | "MIME_EXTENSION_MISMATCH"
  | "INVALID_FILE_NAME"
  | "TEXT_READ_FAILED"
  | "BROKEN_PDF"
  | "PDF_TEXT_EMPTY"
  | "SOURCE_REF_INVALID";

export interface FriendlyFileErrorDetails {
  code: FileErrorCode;
  title: string;
  message: string;
  recovery: string;
  dataPreserved: boolean;
  fileName?: string;
  maxSizeBytes?: number;
  cause?: unknown;
}

/**
 * 파일 처리 계층에서 UI로 안전하게 전달할 수 있는 오류입니다.
 * 내부 stack이나 원본 예외 메시지를 사용자 문구에 섞지 않습니다.
 */
export class FileProcessingError extends Error {
  readonly code: FileErrorCode;
  readonly title: string;
  readonly recovery: string;
  readonly dataPreserved: boolean;
  readonly fileName?: string;
  readonly maxSizeBytes?: number;
  override readonly cause?: unknown;

  constructor(details: FriendlyFileErrorDetails) {
    super(details.message);
    this.name = "FileProcessingError";
    this.code = details.code;
    this.title = details.title;
    this.recovery = details.recovery;
    this.dataPreserved = details.dataPreserved;
    this.fileName = details.fileName;
    this.maxSizeBytes = details.maxSizeBytes;
    this.cause = details.cause;
  }

  toJSON(): Omit<FriendlyFileErrorDetails, "cause"> {
    return {
      code: this.code,
      title: this.title,
      message: this.message,
      recovery: this.recovery,
      dataPreserved: this.dataPreserved,
      fileName: this.fileName,
      maxSizeBytes: this.maxSizeBytes,
    };
  }
}

export function isFileProcessingError(
  error: unknown,
): error is FileProcessingError {
  return error instanceof FileProcessingError;
}

