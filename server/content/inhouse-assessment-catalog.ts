import {
  ORIGINAL_QUESTION_BANK_SLUG,
  ORIGINAL_QUESTION_TEMPLATES,
} from "./original-question-factory";

export type InhouseAssessmentLevel = "novice" | "intermediate" | "advanced" | "expert";

export interface InhouseAssessmentDefinition {
  slug: string;
  title: string;
  description: string;
  primaryCategorySlug: string;
  secondaryCategorySlugs: string[];
  audienceBandCode: string;
  durationMinutes: number;
  passingScore: number;
  level: InhouseAssessmentLevel;
  targetQuestionCount: number;
  blueprintTemplateIds: string[];
  releaseBlockers: string[];
  metaTitle: string;
  metaDescription: string;
}

export interface InhouseBlueprintDefinition {
  topicSlug: string;
  topicName: string;
  questionCount: number;
  difficulty: "mixed";
  marksPerQuestion: 1;
  negativeMarks: 0;
  sortOrder: number;
}

export const INHOUSE_ORIGINAL_BANK = {
  slug: ORIGINAL_QUESTION_BANK_SLUG,
  name: "Octamy Original Quantitative and Numerical Practice — v1",
  description:
    "First-party, deterministic practice-item drafts. Every item remains inactive and pending until subject-matter, curriculum and language review is recorded.",
  tags: ["octamy-original", "draft", "quantitative", "numerical", "version-1"],
} as const;

const BASIC_ARITHMETIC = [
  "whole-number-addition",
  "whole-number-subtraction",
  "whole-number-multiplication",
  "exact-division",
  "missing-addend",
] as const;

const UPPER_PRIMARY_MATH = [
  ...BASIC_ARITHMETIC,
  "fraction-of-quantity",
  "percentage-of-number",
  "mean-average",
  "rectangle-perimeter",
  "rectangle-area",
  "triangle-area",
  "unitary-price",
  "elapsed-time",
  "ratio-share",
  "direct-proportion",
  "highest-common-factor",
  "least-common-multiple",
] as const;

const SECONDARY_MATH = [
  ...UPPER_PRIMARY_MATH,
  "linear-equation",
  "speed-distance",
  "speed-time",
  "simple-interest",
  "compound-interest",
  "profit-percentage",
  "discount-amount",
  "simple-probability",
  "arithmetic-sequence",
  "integer-powers",
] as const;

const APTITUDE_TEMPLATES = [
  "fraction-of-quantity",
  "percentage-of-number",
  "mean-average",
  "linear-equation",
  "rectangle-perimeter",
  "rectangle-area",
  "triangle-area",
  "unitary-price",
  "speed-distance",
  "speed-time",
  "simple-interest",
  "compound-interest",
  "profit-percentage",
  "discount-amount",
  "ratio-share",
  "direct-proportion",
  "highest-common-factor",
  "least-common-multiple",
  "simple-probability",
  "arithmetic-sequence",
] as const;

const PHYSICS_TEMPLATES = [
  "newtons-second-law",
  "uniform-acceleration",
  "mechanical-work",
  "kinetic-energy",
  "gravitational-potential-energy",
  "ohms-law",
  "electric-power",
  "mass-density-volume",
  "specific-heat",
  "linear-momentum",
  "mechanical-pressure",
  "wave-speed",
  "frequency-from-period",
] as const;

const CHEMISTRY_TEMPLATES = [
  "amount-of-substance",
  "solution-molarity",
  "ph-from-concentration",
  "ideal-gas-law",
  "stoichiometric-mass",
] as const;

const COMMON_RELEASE_BLOCKERS = [
  "Approve a versioned syllabus mapping against the applicable curriculum or examination notice.",
  "Record independent subject-matter and language review for every included item.",
  "Approve a representative attempt, scoring and accessibility QA report.",
] as const;

const SCHOOL_RELEASE_BLOCKERS = [
  ...COMMON_RELEASE_BLOCKERS,
  "Confirm that number ranges, vocabulary and timing are age-appropriate for this exact grade.",
] as const;

function schoolMathDefinition(
  grade: number,
  audienceBandCode: string,
  templates: readonly string[],
  targetQuestionCount: number,
): InhouseAssessmentDefinition {
  const diagnostic = grade <= 2;
  const title = `Grade ${grade} Mathematics ${diagnostic ? "Diagnostic" : "Practice"}`;
  const slug = `grade-${grade}-mathematics-${diagnostic ? "diagnostic" : "practice"}`;
  const declaredTemplates = templates.filter((templateId) =>
    ORIGINAL_QUESTION_TEMPLATES.some((template) =>
      template.id === templateId && template.assessmentSlugs.includes(slug),
    ),
  );
  return {
    slug,
    title,
    description:
      `Original Grade ${grade} mathematics practice drafts for structured review. `
      + "This is not a board paper and will remain unavailable to learners until grade-level content review is complete.",
    primaryCategorySlug: "mathematics",
    secondaryCategorySlugs: ["school-education"],
    audienceBandCode,
    durationMinutes: diagnostic ? 0 : grade <= 5 ? 30 : 45,
    passingScore: 60,
    level: grade <= 5 ? "novice" : grade <= 8 ? "intermediate" : "advanced",
    targetQuestionCount,
    blueprintTemplateIds: [...declaredTemplates],
    releaseBlockers: [
      ...SCHOOL_RELEASE_BLOCKERS,
      ...(diagnostic
        ? ["Approve an untimed, child-friendly diagnostic experience before attaching any question blueprint."]
        : []),
    ],
    metaTitle: `${title} | Octamy Assessments`,
    metaDescription:
      `Practice Grade ${grade} mathematics with original Octamy draft questions after curriculum and subject-matter review.`,
  };
}

function competitiveDefinition(input: {
  slug: string;
  title: string;
  familySlug: string;
  subjectSlug?: string;
  templates: readonly string[];
  targetQuestionCount: number;
  durationMinutes: number;
  description: string;
}): InhouseAssessmentDefinition {
  return {
    slug: input.slug,
    title: input.title,
    description:
      `${input.description} Original practice items only; this is not an official or recalled examination paper. `
      + "The draft stays private until the applicable notification, answer evidence and content review are approved.",
    primaryCategorySlug: input.familySlug,
    secondaryCategorySlugs: [
      "competitive-exams",
      ...(input.subjectSlug ? [input.subjectSlug] : []),
    ],
    audienceBandCode: "competitive_exam",
    durationMinutes: input.durationMinutes,
    passingScore: 60,
    level: "advanced",
    targetQuestionCount: input.targetQuestionCount,
    blueprintTemplateIds: [...input.templates],
    releaseBlockers: [...COMMON_RELEASE_BLOCKERS],
    metaTitle: `${input.title} | Octamy Assessments`,
    metaDescription: `${input.description} Original Octamy practice questions, released only after documented content review.`,
  };
}

function seniorScienceDefinition(input: {
  grade: 11 | 12;
  subject: "Physics" | "Chemistry";
  subjectSlug: "physics" | "chemistry";
  templates: readonly string[];
}): InhouseAssessmentDefinition {
  const title = `Grade ${input.grade} ${input.subject} Numerical Practice`;
  return {
    slug: `grade-${input.grade}-${input.subjectSlug}-numerical-practice`,
    title,
    description:
      `Original Grade ${input.grade} ${input.subject.toLowerCase()} numerical-practice drafts. `
      + "This is not a board paper and remains private until curriculum, unit and subject-matter review are complete.",
    primaryCategorySlug: input.subjectSlug,
    secondaryCategorySlugs: ["school-education"],
    audienceBandCode: "grade_11_12",
    durationMinutes: 45,
    passingScore: 60,
    level: "advanced",
    targetQuestionCount: 30,
    blueprintTemplateIds: [...input.templates],
    releaseBlockers: [...SCHOOL_RELEASE_BLOCKERS],
    metaTitle: `${title} | Octamy Assessments`,
    metaDescription: `Original Grade ${input.grade} ${input.subject.toLowerCase()} numerical practice, released after documented curriculum and content review.`,
  };
}

// Grade 1–2 shells intentionally have no blueprint. The current numerical
// generator does not provide a defensible early-primary difficulty envelope;
// creating a URL-safe draft is useful, silently serving older-grade arithmetic
// to young learners is not.
export const INHOUSE_ASSESSMENTS: InhouseAssessmentDefinition[] = [
  schoolMathDefinition(1, "grade_1_2", [], 0),
  schoolMathDefinition(2, "grade_1_2", [], 0),
  schoolMathDefinition(3, "grade_3_5", UPPER_PRIMARY_MATH, 25),
  schoolMathDefinition(4, "grade_3_5", UPPER_PRIMARY_MATH, 30),
  schoolMathDefinition(5, "grade_3_5", UPPER_PRIMARY_MATH, 30),
  schoolMathDefinition(6, "grade_6_8", SECONDARY_MATH, 35),
  schoolMathDefinition(7, "grade_6_8", SECONDARY_MATH, 40),
  schoolMathDefinition(8, "grade_6_8", SECONDARY_MATH, 40),
  schoolMathDefinition(9, "grade_9_10", SECONDARY_MATH, 40),
  schoolMathDefinition(10, "grade_9_10", SECONDARY_MATH, 40),

  competitiveDefinition({
    slug: "ssc-cgl-tier-1-quantitative-aptitude-practice",
    title: "SSC CGL Tier I Quantitative Aptitude Practice",
    familySlug: "ssc",
    templates: APTITUDE_TEMPLATES,
    targetQuestionCount: 25,
    durationMinutes: 30,
    description: "A focused quantitative-aptitude practice set for SSC CGL Tier I preparation.",
  }),
  competitiveDefinition({
    slug: "ssc-chsl-tier-1-quantitative-aptitude-practice",
    title: "SSC CHSL Tier I Quantitative Aptitude Practice",
    familySlug: "ssc",
    templates: APTITUDE_TEMPLATES,
    targetQuestionCount: 25,
    durationMinutes: 30,
    description: "A focused quantitative-aptitude practice set for SSC CHSL Tier I preparation.",
  }),
  competitiveDefinition({
    slug: "ssc-mts-numerical-aptitude-practice",
    title: "SSC MTS Numerical Aptitude Practice",
    familySlug: "ssc",
    templates: APTITUDE_TEMPLATES,
    targetQuestionCount: 20,
    durationMinutes: 25,
    description: "A focused numerical-aptitude practice set for SSC MTS preparation.",
  }),
  competitiveDefinition({
    slug: "rrb-ntpc-mathematics-practice",
    title: "RRB NTPC Mathematics Practice",
    familySlug: "railway-exams",
    templates: APTITUDE_TEMPLATES,
    targetQuestionCount: 30,
    durationMinutes: 35,
    description: "A focused mathematics practice set for RRB NTPC preparation.",
  }),
  competitiveDefinition({
    slug: "rrb-group-d-mathematics-practice",
    title: "RRB Group D Mathematics Practice",
    familySlug: "railway-exams",
    templates: APTITUDE_TEMPLATES,
    targetQuestionCount: 25,
    durationMinutes: 30,
    description: "A focused mathematics practice set for RRB Group D preparation.",
  }),
  competitiveDefinition({
    slug: "ibps-po-quantitative-aptitude-practice",
    title: "IBPS PO Quantitative Aptitude Practice",
    familySlug: "banking-exams",
    templates: APTITUDE_TEMPLATES,
    targetQuestionCount: 30,
    durationMinutes: 35,
    description: "A focused quantitative-aptitude practice set for IBPS PO preparation.",
  }),
  competitiveDefinition({
    slug: "ibps-clerk-quantitative-aptitude-practice",
    title: "IBPS Clerk Quantitative Aptitude Practice",
    familySlug: "banking-exams",
    templates: APTITUDE_TEMPLATES,
    targetQuestionCount: 30,
    durationMinutes: 35,
    description: "A focused quantitative-aptitude practice set for IBPS Clerk preparation.",
  }),
  competitiveDefinition({
    slug: "neet-ug-physics-numerical-practice",
    title: "NEET (UG) Physics Numerical Practice",
    familySlug: "neet",
    subjectSlug: "physics",
    templates: PHYSICS_TEMPLATES,
    targetQuestionCount: 30,
    durationMinutes: 45,
    description: "A physics numerical-practice set for NEET (UG) preparation.",
  }),
  competitiveDefinition({
    slug: "jee-main-physics-numerical-practice",
    title: "JEE Main Physics Numerical Practice",
    familySlug: "jee",
    subjectSlug: "physics",
    templates: PHYSICS_TEMPLATES,
    targetQuestionCount: 30,
    durationMinutes: 45,
    description: "A physics numerical-practice set for JEE Main preparation.",
  }),
  competitiveDefinition({
    slug: "neet-ug-chemistry-numerical-practice",
    title: "NEET (UG) Chemistry Numerical Practice",
    familySlug: "neet",
    subjectSlug: "chemistry",
    templates: CHEMISTRY_TEMPLATES,
    targetQuestionCount: 25,
    durationMinutes: 40,
    description: "A chemistry numerical-practice set for NEET (UG) preparation.",
  }),
  competitiveDefinition({
    slug: "jee-main-chemistry-numerical-practice",
    title: "JEE Main Chemistry Numerical Practice",
    familySlug: "jee",
    subjectSlug: "chemistry",
    templates: CHEMISTRY_TEMPLATES,
    targetQuestionCount: 25,
    durationMinutes: 40,
    description: "A chemistry numerical-practice set for JEE Main preparation.",
  }),
  seniorScienceDefinition({ grade: 11, subject: "Physics", subjectSlug: "physics", templates: PHYSICS_TEMPLATES }),
  seniorScienceDefinition({ grade: 12, subject: "Physics", subjectSlug: "physics", templates: PHYSICS_TEMPLATES }),
  seniorScienceDefinition({ grade: 11, subject: "Chemistry", subjectSlug: "chemistry", templates: CHEMISTRY_TEMPLATES }),
  seniorScienceDefinition({ grade: 12, subject: "Chemistry", subjectSlug: "chemistry", templates: CHEMISTRY_TEMPLATES }),
];

export function buildInhouseBlueprint(
  assessment: InhouseAssessmentDefinition,
): InhouseBlueprintDefinition[] {
  if (assessment.targetQuestionCount === 0) return [];
  const selected = ORIGINAL_QUESTION_TEMPLATES.filter((template) =>
    assessment.blueprintTemplateIds.includes(template.id),
  );
  const topics = Array.from(new Map(
    selected.map((template) => [template.topicSlug, {
      topicSlug: template.topicSlug,
      topicName: template.topic,
    }]),
  ).values()).sort((left, right) => left.topicSlug.localeCompare(right.topicSlug));
  if (topics.length === 0) {
    throw new Error(`Assessment ${assessment.slug} has no blueprint topics`);
  }
  const base = Math.floor(assessment.targetQuestionCount / topics.length);
  const remainder = assessment.targetQuestionCount % topics.length;
  return topics.map<InhouseBlueprintDefinition>((topic, index) => ({
    ...topic,
    questionCount: base + (index < remainder ? 1 : 0),
    difficulty: "mixed",
    marksPerQuestion: 1,
    negativeMarks: 0,
    sortOrder: index,
  })).filter((item) => item.questionCount > 0);
}

export function validateInhouseAssessmentCatalog(): string[] {
  const errors: string[] = [];
  const slugs = new Set<string>();
  const templateIds = new Set(ORIGINAL_QUESTION_TEMPLATES.map((template) => template.id));
  const generatedAssessmentSlugs = new Set(
    ORIGINAL_QUESTION_TEMPLATES.flatMap((template) => template.assessmentSlugs),
  );
  for (const assessment of INHOUSE_ASSESSMENTS) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(assessment.slug)) {
      errors.push(`${assessment.slug}: slug is not canonical`);
    }
    if (slugs.has(assessment.slug)) errors.push(`${assessment.slug}: duplicate assessment slug`);
    slugs.add(assessment.slug);
    if (!generatedAssessmentSlugs.has(assessment.slug)) {
      errors.push(`${assessment.slug}: no deterministic generator declares this assessment`);
    }
    if (assessment.metaTitle.length > 180 || assessment.metaDescription.length > 500) {
      errors.push(`${assessment.slug}: SEO metadata exceeds the database limit`);
    }
    if (assessment.targetQuestionCount === 0 && assessment.blueprintTemplateIds.length > 0) {
      errors.push(`${assessment.slug}: zero-question shell must not have a blueprint`);
    }
    if (assessment.targetQuestionCount > 0 && assessment.blueprintTemplateIds.length === 0) {
      errors.push(`${assessment.slug}: target count requires blueprint templates`);
    }
    for (const templateId of assessment.blueprintTemplateIds) {
      if (!templateIds.has(templateId)) errors.push(`${assessment.slug}: unknown template ${templateId}`);
      const template = ORIGINAL_QUESTION_TEMPLATES.find((item) => item.id === templateId);
      if (template && !template.assessmentSlugs.includes(assessment.slug)) {
        errors.push(`${assessment.slug}: template ${templateId} does not declare the assessment`);
      }
    }
    const blueprintCount = buildInhouseBlueprint(assessment)
      .reduce((sum, item) => sum + item.questionCount, 0);
    if (blueprintCount !== assessment.targetQuestionCount) {
      errors.push(`${assessment.slug}: blueprint count ${blueprintCount} does not match target ${assessment.targetQuestionCount}`);
    }
  }
  for (const generatedSlug of Array.from(generatedAssessmentSlugs)) {
    if (!slugs.has(generatedSlug)) errors.push(`${generatedSlug}: generator assessment has no catalogue shell`);
  }
  return errors;
}
