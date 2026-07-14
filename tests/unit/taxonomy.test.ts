import { describe, expect, it } from "@jest/globals";
import { taxonomySlug } from "../../server/routes/taxonomyRoutes";

describe("assessment taxonomy slugs", () => {
  it("creates stable, URL-safe category slugs", () => {
    expect(taxonomySlug("  JEE & Engineering  ")).toBe("jee-engineering");
    expect(taxonomySlug("English—Grades 1–5")).toBe("english-grades-1-5");
    expect(taxonomySlug("Café Skills")).toBe("cafe-skills");
  });

  it("always returns a usable fallback", () => {
    expect(taxonomySlug("***")).toBe("category");
  });
});
