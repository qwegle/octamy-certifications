import { describe, expect, it } from "@jest/globals";
import {
  assessmentCatalogQuerySchema,
  catalogCertificationLabel,
} from "../../server/routes/catalogRoutes";

describe("assessment catalogue contract", () => {
  it("normalizes bounded public filters", () => {
    expect(assessmentCatalogQuerySchema.parse({
      page: "2",
      pageSize: "24",
      search: "  algebra  ",
      audience: "grade_6_10",
      level: "intermediate",
      featured: "true",
    })).toEqual({
      page: 2,
      pageSize: 24,
      search: "algebra",
      audience: "grade_6_10",
      level: "intermediate",
      featured: true,
    });
    expect(assessmentCatalogQuerySchema.safeParse({ pageSize: "500" }).success).toBe(false);
    expect(assessmentCatalogQuerySchema.safeParse({ level: "beginner" }).success).toBe(false);
  });

  it("keeps issuer claims distinct and truthful", () => {
    expect(catalogCertificationLabel("admin", "octamy")).toBe("Octamy-certified");
    expect(catalogCertificationLabel("creator", "creator")).toBe("Creator-issued · verified on Octamy");
    expect(catalogCertificationLabel("creator", "octamy_creator")).toBe("Octamy + creator certified");
  });
});
