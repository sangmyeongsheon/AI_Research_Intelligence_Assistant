export type ExportErrorCode =
  | "EXPORT_NOT_AVAILABLE"
  | "DOWNLOAD_FAILED"
  | "PRINT_WINDOW_BLOCKED"
  | "PRINT_FAILED";

export class ExportProcessingError extends Error {
  readonly code: ExportErrorCode;
  readonly title: string;
  readonly recovery: string;
  readonly dataPreserved = true;
  override readonly cause?: unknown;

  constructor(input: {
    code: ExportErrorCode;
    title: string;
    message: string;
    recovery: string;
    cause?: unknown;
  }) {
    super(input.message);
    this.name = "ExportProcessingError";
    this.code = input.code;
    this.title = input.title;
    this.recovery = input.recovery;
    this.cause = input.cause;
  }
}

