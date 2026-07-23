import { sanitizeFileName } from "../files/filename";
import { ExportProcessingError } from "./errors";

export interface DownloadResult {
  fileName: string;
  size: number;
  mimeType: string;
}

function requireBrowserDocument(): Document {
  if (
    typeof document === "undefined" ||
    typeof URL === "undefined" ||
    typeof URL.createObjectURL !== "function"
  ) {
    throw new ExportProcessingError({
      code: "EXPORT_NOT_AVAILABLE",
      title: "이 환경에서는 다운로드할 수 없습니다",
      message: "파일 다운로드는 브라우저 화면에서만 실행할 수 있습니다.",
      recovery: "LabTrace 브라우저 화면으로 돌아가 다시 시도해 주세요.",
    });
  }
  return document;
}

function ensureExtension(fileName: string, extension: string): string {
  const normalizedExtension = extension.replace(/^\./, "").toLowerCase();
  const sanitized = sanitizeFileName(fileName);
  return sanitized.toLowerCase().endsWith(`.${normalizedExtension}`)
    ? sanitized
    : `${sanitized}.${normalizedExtension}`;
}

export function downloadBlob(blob: Blob, fileName: string): DownloadResult {
  const browserDocument = requireBrowserDocument();
  const safeFileName = sanitizeFileName(fileName);
  const objectUrl = URL.createObjectURL(blob);
  const anchor = browserDocument.createElement("a");

  try {
    anchor.href = objectUrl;
    anchor.download = safeFileName;
    anchor.hidden = true;
    anchor.rel = "noopener";
    browserDocument.body.append(anchor);
    anchor.click();
  } catch (cause) {
    throw new ExportProcessingError({
      code: "DOWNLOAD_FAILED",
      title: "파일을 다운로드하지 못했습니다",
      message: `${safeFileName} 파일을 만드는 중 브라우저 오류가 발생했습니다.`,
      recovery:
        "브라우저의 다운로드 차단 설정을 확인한 뒤 다시 시도해 주세요. 편집 중인 데이터는 보존되어 있습니다.",
      cause,
    });
  } finally {
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
  }

  return {
    fileName: safeFileName,
    size: blob.size,
    mimeType: blob.type || "application/octet-stream",
  };
}

export function downloadText(
  content: string,
  fileName: string,
  mimeType = "text/plain;charset=utf-8",
): DownloadResult {
  return downloadBlob(new Blob([content], { type: mimeType }), fileName);
}

export function downloadMarkdown(
  markdown: string,
  fileName: string,
): DownloadResult {
  return downloadText(
    markdown,
    ensureExtension(fileName, "md"),
    "text/markdown;charset=utf-8",
  );
}

export function downloadHtml(html: string, fileName: string): DownloadResult {
  return downloadText(
    html,
    ensureExtension(fileName, "html"),
    "text/html;charset=utf-8",
  );
}

