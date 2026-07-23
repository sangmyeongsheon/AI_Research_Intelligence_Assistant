import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  AppShell,
  type AppShellContext,
} from "@/src/components/AppShell";
import { DepartmentLabsView } from "@/src/components/LabDirectoryViews";
import { DEPT_BRAIN_SCIENCES } from "@/src/lib/lab-directory";

const directoryContext: AppShellContext = {
  trail: "Labs",
  title: "연구실 디렉터리",
  subtitle: "Directory",
};

function renderShell(context: AppShellContext, screen: "directory" | "lab-profile") {
  return renderToStaticMarkup(
    <AppShell
      context={context}
      demoMode={false}
      onNavigate={() => undefined}
      onViewModeChange={() => undefined}
      screen={screen}
      unresolvedCount={0}
      viewMode="researcher"
    >
      <div>content</div>
    </AppShell>,
  );
}

describe("ARIA hierarchy navigation", () => {
  it("shows ARIA branding and only Labs in the top-level directory sidebar", () => {
    const html = renderShell(directoryContext, "directory");

    expect(html).toContain("aria-brand-mark");
    expect(html).toContain("AI Research Intelligence Assistant");
    expect(html).toContain(">Labs<");
    expect(html).not.toContain(">Overview<");
    expect(html).not.toContain(">Settings<");
    expect(html).not.toContain("sidebar-footer");
  });

  it("shows only the active lab title in the lab-level sidebar footer", () => {
    const labTitle = "Center for Synapse Diversity and Specificity";
    const html = renderShell(
      {
        trail: "Labs / 뇌과학과",
        title: labTitle,
        subtitle: "Synapse Diversity Center",
        activeLabTitle: labTitle,
      },
      "lab-profile",
    );

    expect(html).toContain("Labs / 뇌과학과");
    expect(html).toContain("sidebar-footer");
    expect(html).toContain(`<strong>${labTitle}</strong>`);
  });
});

describe("researcher protocol access", () => {
  const renderDepartment = (viewMode: "visitor" | "researcher") =>
    renderToStaticMarkup(
      <DepartmentLabsView
        currentLabId="lab-neural-systems"
        departmentId={DEPT_BRAIN_SCIENCES}
        onBack={() => undefined}
        onOpenProfile={() => undefined}
        onOpenWorkspace={() => undefined}
        protocols={[]}
        unresolvedCount={0}
        viewMode={viewMode}
      />,
    );

  it("enables every lab protocol button for researchers", () => {
    expect(renderDepartment("researcher")).not.toContain('disabled=""');
  });

  it("keeps protocol buttons unavailable in visitor view", () => {
    expect(renderDepartment("visitor")).toContain('disabled=""');
  });
});
