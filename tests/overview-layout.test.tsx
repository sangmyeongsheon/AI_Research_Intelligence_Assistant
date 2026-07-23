import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { OverviewView } from "@/src/components/DashboardViews";
import { demoProtocol } from "@/src/lib/demo";

describe("overview recent protocol layout", () => {
  it("uses dedicated fixed-width columns for compact single-line metadata", () => {
    const html = renderToStaticMarkup(
      <OverviewView
        conflicts={[]}
        missingFields={[]}
        onCreateExample={() => undefined}
        onNavigate={() => undefined}
        onOpenProtocol={() => undefined}
        onSaveLab={() => undefined}
        protocols={[demoProtocol]}
        sources={[]}
      />,
    );

    expect(html).toContain('class="data-table recent-protocol-table"');
    expect(html).toContain('class="recent-protocol-status-column"');
    expect(html).toContain('class="recent-protocol-updated-column"');
    expect(html).toContain('class="recent-protocol-status"');
    expect(html).toContain('class="mono recent-protocol-updated"');
  });
});
