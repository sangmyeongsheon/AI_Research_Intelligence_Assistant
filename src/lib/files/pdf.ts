import { FileProcessingError } from "./errors";

export interface ExtractedPdfPage {
  pageNumber: number;
  text: string;
}

export interface PdfExtractionResult {
  pageCount: number;
  pages: ExtractedPdfPage[];
  fullText: string;
  hasExtractableText: boolean;
}

export interface ExtractPdfOptions {
  /**
   * 스캔 PDF처럼 텍스트 레이어가 없을 때 오류 대신 빈 페이지 결과를 반환합니다.
   * API OCR/멀티모달 분석으로 넘길 때 사용합니다.
   */
  allowEmptyText?: boolean;
  password?: string;
}

type PdfDataSource = Blob | ArrayBuffer | Uint8Array;

interface PdfTextItemLike {
  str: string;
  hasEOL?: boolean;
}

function isPdfTextItem(item: unknown): item is PdfTextItemLike {
  return (
    typeof item === "object" &&
    item !== null &&
    "str" in item &&
    typeof (item as PdfTextItemLike).str === "string"
  );
}

function joinPdfTextItems(items: unknown[]): string {
  let text = "";
  for (const item of items) {
    if (!isPdfTextItem(item)) continue;
    const value = item.str.trim();
    if (value) {
      const needsSpace =
        text.length > 0 && !text.endsWith("\n") && !/\s$/.test(text);
      text += `${needsSpace ? " " : ""}${value}`;
    }
    if (item.hasEOL && !text.endsWith("\n")) text += "\n";
  }
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n");
}

async function toPdfBytes(source: PdfDataSource): Promise<Uint8Array> {
  if (source instanceof Uint8Array) return source;
  if (source instanceof ArrayBuffer) return new Uint8Array(source);
  return new Uint8Array(await source.arrayBuffer());
}

/**
 * pdfjs-dist를 사용해 페이지 경계를 유지한 채 PDF 텍스트를 추출합니다.
 * 반환 fullText에는 명시적인 페이지 표식이 들어가 출처 페이지를 잃지 않습니다.
 */
export async function extractPdfPages(
  source: PdfDataSource,
  options: ExtractPdfOptions = {},
): Promise<PdfExtractionResult> {
  let loadingTask:
    | {
        promise: Promise<{
          numPages: number;
          getPage: (pageNumber: number) => Promise<{
            getTextContent: () => Promise<{ items: unknown[] }>;
            cleanup?: () => void;
          }>;
        }>;
        destroy?: () => Promise<void>;
      }
    | undefined;
  let documentProxy:
    | {
        numPages: number;
        getPage: (pageNumber: number) => Promise<{
          getTextContent: () => Promise<{ items: unknown[] }>;
          cleanup?: () => void;
        }>;
        destroy?: () => Promise<void>;
      }
    | undefined;

  try {
    const bytes = await toPdfBytes(source);
    if (bytes.byteLength === 0) {
      throw new FileProcessingError({
        code: "EMPTY_FILE",
        title: "빈 PDF는 분석할 수 없습니다",
        message: "선택한 PDF에 읽을 데이터가 없습니다.",
        recovery: "내용이 있는 PDF를 다시 선택해 주세요.",
        dataPreserved: true,
      });
    }

    const pdfWorker = await import(
      "pdfjs-dist/legacy/build/pdf.worker.mjs"
    );
    (
      globalThis as typeof globalThis & {
        pdfjsWorker?: { WorkerMessageHandler: unknown };
      }
    ).pdfjsWorker = {
      WorkerMessageHandler: pdfWorker.WorkerMessageHandler,
    };
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    loadingTask = pdfjs.getDocument({
      data: bytes,
      password: options.password,
      useWorkerFetch: false,
    });
    documentProxy = await loadingTask.promise;

    const pages: ExtractedPdfPage[] = [];
    for (let pageNumber = 1; pageNumber <= documentProxy.numPages; pageNumber += 1) {
      const page = await documentProxy.getPage(pageNumber);
      const content = await page.getTextContent();
      pages.push({
        pageNumber,
        text: joinPdfTextItems(content.items),
      });
      page.cleanup?.();
    }

    const hasExtractableText = pages.some((page) => page.text.length > 0);
    if (!hasExtractableText && !options.allowEmptyText) {
      throw new FileProcessingError({
        code: "PDF_TEXT_EMPTY",
        title: "PDF에서 텍스트를 찾지 못했습니다",
        message:
          "스캔 이미지로만 구성되었거나 텍스트 레이어가 없는 PDF일 수 있습니다.",
        recovery:
          "API Mode에서 이미지 분석을 사용하거나 OCR이 적용된 PDF로 다시 저장해 주세요.",
        dataPreserved: true,
      });
    }

    return {
      pageCount: documentProxy.numPages,
      pages,
      hasExtractableText,
      fullText: pages
        .map(
          (page) =>
            `--- PDF ${page.pageNumber}페이지 ---\n${page.text || "텍스트 없음"}`,
        )
        .join("\n\n"),
    };
  } catch (cause) {
    if (cause instanceof FileProcessingError) throw cause;
    throw new FileProcessingError({
      code: "BROKEN_PDF",
      title: "PDF를 열지 못했습니다",
      message:
        "파일이 손상되었거나 암호화되어 있어 페이지를 읽을 수 없습니다.",
      recovery:
        "PDF가 다른 프로그램에서 열리는지 확인하고, 암호를 해제해 다시 저장한 뒤 업로드해 주세요.",
      dataPreserved: true,
      cause,
    });
  } finally {
    await loadingTask?.destroy?.().catch(() => undefined);
  }
}

export const extractPdfText = extractPdfPages;
