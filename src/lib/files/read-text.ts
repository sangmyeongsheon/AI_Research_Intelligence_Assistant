import { FileProcessingError } from "./errors";
import { assertValidUploadFile, type UploadFileLike } from "./validation";

export interface BrowserTextFile extends UploadFileLike {
  text?: () => Promise<string>;
  arrayBuffer: () => Promise<ArrayBuffer>;
}

export interface ReadTextFileOptions {
  validate?: boolean;
  encoding?: string;
  trimBom?: boolean;
}

function normalizeExtractedText(text: string, trimBom: boolean): string {
  const withoutBom = trimBom ? text.replace(/^\uFEFF/, "") : text;
  return withoutBom.replace(/\r\n?/g, "\n").replace(/\u0000/g, "");
}

/**
 * TXT/Markdown을 서버 업로드 없이 브라우저에서 읽습니다.
 */
export async function readBrowserTextFile(
  file: BrowserTextFile,
  options: ReadTextFileOptions = {},
): Promise<string> {
  const { validate = true, encoding = "utf-8", trimBom = true } = options;

  if (validate) {
    const metadata = assertValidUploadFile(file);
    if (metadata.kind !== "text" && metadata.kind !== "markdown") {
      throw new FileProcessingError({
        code: "UNSUPPORTED_FILE_TYPE",
        title: "텍스트로 읽을 수 없는 파일입니다",
        message: `${file.name}은(는) 브라우저 텍스트 읽기 대상이 아닙니다.`,
        recovery: "TXT 또는 Markdown 파일을 선택해 주세요.",
        dataPreserved: true,
        fileName: file.name,
      });
    }
  }

  try {
    const text =
      typeof file.text === "function" && encoding.toLowerCase() === "utf-8"
        ? await file.text()
        : new TextDecoder(encoding, { fatal: false }).decode(
            await file.arrayBuffer(),
          );
    return normalizeExtractedText(text, trimBom);
  } catch (cause) {
    if (cause instanceof FileProcessingError) throw cause;
    throw new FileProcessingError({
      code: "TEXT_READ_FAILED",
      title: "텍스트 파일을 읽지 못했습니다",
      message: `${file.name}을(를) 브라우저에서 읽는 중 문제가 발생했습니다.`,
      recovery:
        "UTF-8 형식으로 다시 저장하거나 파일이 다른 프로그램에서 정상적으로 열리는지 확인해 주세요.",
      dataPreserved: true,
      fileName: file.name,
      cause,
    });
  }
}

export const readTextFile = readBrowserTextFile;

