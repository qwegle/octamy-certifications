import { describe, expect, it } from "@jest/globals";
import {
  getAssessmentCardPricing,
  getAssessmentVisualIdentity,
} from "../../client/src/lib/assessment-visual-identity";

describe("assessment card visual identity", () => {
  it("is deterministic and uses assessment topics as an accessible non-colour cue", () => {
    const aws = { slug: "aws-solutions-architecture-skills", title: "AWS Solutions Architecture Skills", category: "Cloud and DevOps" };
    expect(getAssessmentVisualIdentity(aws)).toEqual(getAssessmentVisualIdentity(aws));
    expect(getAssessmentVisualIdentity(aws).iconKey).toBe("cloud");
    expect(getAssessmentVisualIdentity({ slug: "kubernetes-administration", title: "Kubernetes Administration", category: "Cloud and DevOps" }).iconKey).toBe("containers");
    expect(getAssessmentVisualIdentity({ slug: "ssc-quantitative-aptitude", title: "SSC Quantitative Aptitude", category: "SSC" }).iconKey).toBe("calculator");
    expect(getAssessmentVisualIdentity({ slug: "neet-physics", title: "NEET Physics", category: "NEET" }).iconKey).toBe("atom");
  });
});

describe("assessment card pricing presentation", () => {
  it("labels the attempt free and treats a live sale as credential pricing", () => {
    expect(getAssessmentCardPricing({ variant: "certification", price: "199.00", originalPrice: "499.00", isOnSale: true })).toEqual({
      kind: "certification",
      primaryLabel: "Free to attempt",
      supportingLabel: "Pay only after passing to unlock the detailed review and verified credential",
      credentialPrice: "₹199",
      originalCredentialPrice: "₹499",
      isCredentialOnSale: true,
    });
  });

  it("does not invent missing prices or expose the practice payload price", () => {
    const certification = getAssessmentCardPricing({ variant: "certification", isOnSale: true });
    expect(certification.credentialPrice).toBeUndefined();
    expect(certification.originalCredentialPrice).toBeUndefined();

    const practice = getAssessmentCardPricing({ variant: "practice", price: "0.00" });
    expect(practice.primaryLabel).toBe("Included with Practice Pass");
    expect(practice).not.toHaveProperty("credentialPrice");
  });

  it("strikes through an original price only when the API explicitly marks a valid sale", () => {
    expect(getAssessmentCardPricing({ variant: "certification", price: "199.00", originalPrice: "499.00", isOnSale: false }).originalCredentialPrice).toBeUndefined();
    expect(getAssessmentCardPricing({ variant: "certification", price: "499.00", originalPrice: "199.00", isOnSale: true }).originalCredentialPrice).toBeUndefined();
  });
});
