import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { OverviewView } from "@/src/components/DashboardViews";
import { PRODUCT_CONFIG } from "@/src/config/product";
import { answerGuideQuestion } from "@/src/lib/guide";

describe("ARIA example collection download", () => {
  it("renders a downloadable ZIP action on the overview", () => {
    const html = renderToStaticMarkup(
      <OverviewView
        conflicts={[]}
        missingFields={[]}
        onCreateExample={() => undefined}
        onNavigate={() => undefined}
        onOpenProtocol={() => undefined}
        onSaveLab={() => undefined}
        protocols={[]}
        sources={[]}
      />,
    );

    expect(html).toContain("예제 모음집 다운로드");
    expect(html).toContain('download="ARIA-example-collection.zip"');
    expect(html).toContain(`href="${PRODUCT_CONFIG.demoBundleSrc}"`);
  });

  it("explains how to use the downloaded examples", () => {
    const answer = answerGuideQuestion("데모 예제 파일은 어디서 다운로드해?");

    expect(answer).toContain("예제 모음집 다운로드");
    expect(answer).toContain("New protocol");
    expect(answer).toContain("ZIP");
  });
});
