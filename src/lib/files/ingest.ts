import type { ExtractSourceInput } from "@/src/lib/ai/provider";
import type {
  LocalBlobRecord,
  SourceArtifact,
  SourceReliability,
} from "@/src/types";
import type { SupportedFileKind } from "./constants";
import { readBrowserTextFile } from "./read-text";

export interface UploadSourceDraft {
  id: string;
  file?: File;
  name: string;
  type: string;
  kind: SupportedFileKind | "transcript";
  size: number;
  author: string;
  sourceDate: string;
  reliability: SourceReliability;
  notes: string;
  textContent?: string;
  error?: string;
}

export interface PreparedAnalysisPayload {
  inputs: ExtractSourceInput[];
  blobs: LocalBlobRecord[];
}

function displayName(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim();
}

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      const result = String(reader.result ?? "");
      const separator = result.indexOf(",");
      if (separator < 0) {
        reject(new Error(`${file.name}을 Base64로 변환하지 못했습니다.`));
        return;
      }
      resolve(result.slice(separator + 1));
    });
    reader.addEventListener("error", () =>
      reject(
        new Error(
          `${file.name}을 읽지 못했습니다. 파일이 다른 프로그램에서 열리는지 확인해 주세요.`,
        ),
      ),
    );
    reader.readAsDataURL(file);
  });
}

async function readLocalText(draft: UploadSourceDraft): Promise<string> {
  if (draft.textContent?.trim()) return draft.textContent.trim();
  if (!draft.file) return "";
  if (draft.kind === "text" || draft.kind === "markdown") {
    return readBrowserTextFile(draft.file);
  }
  return "";
}

export async function prepareAnalysisPayload(
  drafts: UploadSourceDraft[],
  protocolId: string,
): Promise<PreparedAnalysisPayload> {
  const createdAt = new Date().toISOString();
  const prepared = await Promise.all(
    drafts.map(async (draft) => {
      const extractedText = await readLocalText(draft);
      const localBlobKey = draft.file ? `source-blob-${draft.id}` : undefined;
      const artifact: SourceArtifact = {
        id: draft.id,
        protocolId,
        type: draft.kind,
        fileName: draft.name,
        displayName: displayName(draft.name) || draft.name,
        mimeType: draft.type,
        size: draft.size,
        author: draft.author.trim() || "작성자 미상",
        sourceDate: draft.sourceDate,
        reliability: draft.reliability,
        notes: draft.notes,
        localBlobKey,
        extractedText,
        processingStatus: "pending",
        createdAt,
      };
      const input: ExtractSourceInput = {
        artifact,
        text: extractedText || undefined,
        base64Data:
          draft.file &&
          draft.kind !== "text" &&
          draft.kind !== "markdown"
            ? await fileToBase64(draft.file)
            : undefined,
      };
      const blob: LocalBlobRecord | undefined =
        draft.file && localBlobKey
          ? {
              key: localBlobKey,
              blob: draft.file,
              mimeType: draft.type,
              size: draft.size,
              createdAt,
            }
          : undefined;
      return { input, blob };
    }),
  );

  return {
    inputs: prepared.map((item) => item.input),
    blobs: prepared
      .map((item) => item.blob)
      .filter((item): item is LocalBlobRecord => Boolean(item)),
  };
}
