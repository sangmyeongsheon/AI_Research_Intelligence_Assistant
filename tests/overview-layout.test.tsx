import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { OverviewView } from "@/src/components/DashboardViews";
import { demoProtocol } from "@/src/lib/demo";

const globalStyles = readFileSync(
  new URL("../app/globals.css", import.meta.url),
  "utf8",
);

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

  it("keeps populated dashboard panels inside their grid tracks", () => {
    expect(globalStyles).toMatch(
      /\.dashboard-grid\s*>\s*\.stack,\s*\.dashboard-grid\s*>\s*\.stack\s*>\s*\.panel\s*\{[^}]*min-width:\s*0;[^}]*max-width:\s*100%;/,
    );
    expect(globalStyles).toMatch(
      /\.dashboard-grid\s+\.table-wrap\s*\{[^}]*width:\s*100%;/,
    );
    expect(globalStyles).toMatch(
      /\.panel-body\.no-padding\s*\{[^}]*padding:\s*0;/,
    );
    expect(globalStyles).toMatch(
      /\.recent-protocol-table\s*\{[^}]*min-width:\s*0;[^}]*table-layout:\s*fixed;/,
    );
    expect(globalStyles).toMatch(
      /\.recent-protocol-table\s+\.cell-title\s*\{[^}]*min-width:\s*0;/,
    );
  });
});
