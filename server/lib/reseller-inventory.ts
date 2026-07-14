/**
 * Commercial boundary for reseller inventory.
 *
 * `resellerEligible` is optional while older deployments apply the governance
 * migration. Once present, it becomes an explicit allow-list in addition to
 * the immutable rule that creator/institute inventory can never be resold.
 */
export function isResellerCourseEligible(course: {
  ownerType: string;
  isActive: boolean;
  visibility: string;
  resellerEligible?: boolean | null;
}): boolean {
  return course.ownerType === "admin"
    && course.isActive
    && course.visibility === "public"
    && (course.resellerEligible === undefined || course.resellerEligible === true);
}
