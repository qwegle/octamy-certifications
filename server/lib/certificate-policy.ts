export type CredentialEligibleAssessment = {
  productType?: string | null;
  assessmentPurpose?: string | null;
  certificationMode?: string | null;
  isActive?: boolean | null;
  reviewStatus?: string | null;
};

export function isCredentialEligibleAssessment(course: CredentialEligibleAssessment): boolean {
  return course.productType === "assessment"
    && course.assessmentPurpose === "certification"
    && typeof course.certificationMode === "string"
    && course.certificationMode.trim() !== ""
    && course.certificationMode !== "none"
    && course.isActive === true
    && course.reviewStatus === "approved";
}
