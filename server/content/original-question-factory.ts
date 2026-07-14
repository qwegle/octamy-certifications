export const ORIGINAL_QUESTION_PACK_SOURCE_KEY = "octamy-original:quant-science:v1";
export const ORIGINAL_QUESTION_PACK_VERSION = "1.0.0";

export type OriginalQuestionDifficulty = "easy" | "medium" | "hard";

export interface CalculationProof {
  operation: string;
  inputs: number[];
  result: number;
  precision: number;
}

export interface OriginalQuestionRecord {
  schemaVersion: 1;
  sourceRecordId: string;
  language: "en";
  question: string;
  format: "mcq_single";
  options: string[];
  answer: { kind: "single_choice"; correctOption: number };
  explanation: string;
  subject: string;
  topic: string;
  syllabus: string;
  exam: string | null;
  examYear: null;
  objective: string;
  difficulty: OriginalQuestionDifficulty;
  maxPoints: number;
  negativeMarks: number;
  timeLimitSec: number;
  tags: string[];
  provenance: {
    sourceLocator: string;
    questionOrigin: "original";
    answerEvidence: string;
    explanationOrigin: "original";
  };
  metadata: {
    generatorVersion: string;
    templateId: string;
    variant: number;
    bankSlug: string;
    topicSlug: string;
    assessmentSlugs: string[];
    proof: CalculationProof;
  };
}

interface TemplateContext {
  variant: number;
  digits: number[];
}

interface TemplateDraft {
  question: string;
  result: number;
  precision?: number;
  explanation: string;
  proof: Omit<CalculationProof, "result" | "precision">;
}

export interface OriginalQuestionTemplate {
  id: string;
  subject: string;
  topic: string;
  topicSlug: string;
  objective: string;
  syllabus: string;
  exam: string | null;
  difficulty: OriginalQuestionDifficulty;
  timeLimitSec: number;
  tags: string[];
  assessmentSlugs: string[];
  create(context: TemplateContext): TemplateDraft;
}

export const ORIGINAL_QUESTION_BANK_SLUG = "octamy-original-quantitative-and-numerical-v1";
const VARIANT_RADIX = 50;

function mixedRadixDigits(value: number, count = 4): number[] {
  const digits: number[] = [];
  let remaining = value;
  for (let index = 0; index < count; index += 1) {
    digits.push(remaining % VARIANT_RADIX);
    remaining = Math.floor(remaining / VARIANT_RADIX);
  }
  return digits;
}

function gcd(a: number, b: number): number {
  let left = Math.abs(Math.trunc(a));
  let right = Math.abs(Math.trunc(b));
  while (right !== 0) [left, right] = [right, left % right];
  return left;
}

function lcm(a: number, b: number): number {
  return Math.abs(a * b) / gcd(a, b);
}

function round(value: number, precision: number): number {
  const factor = 10 ** precision;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function formatNumber(value: number, precision: number): string {
  const normalized = Object.is(value, -0) ? 0 : round(value, precision);
  return precision === 0
    ? String(Math.round(normalized))
    : normalized.toFixed(precision)
      .replace(/(\.\d*?[1-9])0+$/, "$1")
      .replace(/\.0+$/, "");
}

function buildOptions(result: number, precision: number, variant: number): {
  options: string[];
  correctOption: number;
} {
  const normalizedResult = round(result, precision);
  const magnitude = Math.max(1, Math.abs(normalizedResult));
  const baseStep = precision === 0
    ? Math.max(1, Math.round(magnitude * 0.08))
    : Math.max(10 ** -precision, round(magnitude * 0.08, precision));
  const candidates = [
    normalizedResult,
    round(normalizedResult + baseStep, precision),
    round(normalizedResult - baseStep, precision),
    round(normalizedResult + baseStep * 2, precision),
    round(normalizedResult - baseStep * 2, precision),
    round(normalizedResult + baseStep * 3, precision),
  ];
  const distinct = Array.from(new Set(candidates.map((value) => formatNumber(value, precision))));
  for (let offset = 1; distinct.length < 4; offset += 1) {
    const candidate = formatNumber(normalizedResult + baseStep * (offset + 3), precision);
    if (!distinct.includes(candidate)) distinct.push(candidate);
  }
  const correctText = formatNumber(normalizedResult, precision);
  const distractors = distinct.filter((value) => value !== correctText).slice(0, 3);
  const correctOption = variant % 4;
  const options = [...distractors];
  options.splice(correctOption, 0, correctText);
  return { options, correctOption };
}

function makeTemplate(
  template: Omit<OriginalQuestionTemplate, "syllabus" | "exam" | "timeLimitSec"> &
    Partial<Pick<OriginalQuestionTemplate, "syllabus" | "exam" | "timeLimitSec">>,
): OriginalQuestionTemplate {
  return {
    syllabus: "Octamy competency map aligned to NCERT/CBSE and published examination syllabi",
    exam: null,
    timeLimitSec: template.difficulty === "easy" ? 45 : template.difficulty === "hard" ? 120 : 75,
    ...template,
  };
}

const SCHOOL_MATH_BY_GRADE = Object.fromEntries(
  Array.from({ length: 10 }, (_, index) => {
    const grade = index + 1;
    return [
      grade,
      `grade-${grade}-mathematics-${grade <= 2 ? "diagnostic" : "practice"}`,
    ];
  }),
) as Record<number, string>;

function schoolMathGrades(from: number, to: number): string[] {
  return Array.from({ length: to - from + 1 }, (_, index) => SCHOOL_MATH_BY_GRADE[from + index]);
}

const APTITUDE = [
  "ssc-cgl-tier-1-quantitative-aptitude-practice",
  "ssc-chsl-tier-1-quantitative-aptitude-practice",
  "ssc-mts-numerical-aptitude-practice",
  "rrb-ntpc-mathematics-practice",
  "rrb-group-d-mathematics-practice",
  "ibps-po-quantitative-aptitude-practice",
  "ibps-clerk-quantitative-aptitude-practice",
];

const ENTRANCE_PHYSICS = [
  "neet-ug-physics-numerical-practice",
  "jee-main-physics-numerical-practice",
  "grade-11-physics-numerical-practice",
  "grade-12-physics-numerical-practice",
];

const ENTRANCE_CHEMISTRY = [
  "neet-ug-chemistry-numerical-practice",
  "jee-main-chemistry-numerical-practice",
  "grade-11-chemistry-numerical-practice",
  "grade-12-chemistry-numerical-practice",
];

export const ORIGINAL_QUESTION_TEMPLATES: OriginalQuestionTemplate[] = [
  makeTemplate({
    id: "whole-number-addition", subject: "Mathematics", topic: "Whole-number addition", topicSlug: "whole-number-addition",
    objective: "Add two whole numbers accurately", difficulty: "easy", tags: ["arithmetic", "addition"], assessmentSlugs: schoolMathGrades(1, 5),
    create: ({ digits: [x, y] }) => {
      const a = 120 + x * 17; const b = 85 + y * 19; const result = a + b;
      return { question: `What is ${a} + ${b}?`, result, explanation: `${a} + ${b} = ${result}.`, proof: { operation: "add", inputs: [a, b] } };
    },
  }),
  makeTemplate({
    id: "whole-number-subtraction", subject: "Mathematics", topic: "Whole-number subtraction", topicSlug: "whole-number-subtraction",
    objective: "Subtract whole numbers without producing a negative result", difficulty: "easy", tags: ["arithmetic", "subtraction"], assessmentSlugs: schoolMathGrades(1, 5),
    create: ({ digits: [x, y] }) => {
      const b = 40 + x * 11; const a = b + 70 + y * 13; const result = a - b;
      return { question: `What is ${a} − ${b}?`, result, explanation: `${a} − ${b} = ${result}.`, proof: { operation: "subtract", inputs: [a, b] } };
    },
  }),
  makeTemplate({
    id: "whole-number-multiplication", subject: "Mathematics", topic: "Multiplication", topicSlug: "multiplication",
    objective: "Multiply two whole numbers", difficulty: "easy", tags: ["arithmetic", "multiplication"], assessmentSlugs: schoolMathGrades(2, 6),
    create: ({ digits: [x, y] }) => {
      const a = 2 + x; const b = 3 + y; const result = a * b;
      return { question: `Calculate ${a} × ${b}.`, result, explanation: `${a} groups of ${b} equal ${result}.`, proof: { operation: "multiply", inputs: [a, b] } };
    },
  }),
  makeTemplate({
    id: "exact-division", subject: "Mathematics", topic: "Division", topicSlug: "division",
    objective: "Divide a whole number exactly", difficulty: "easy", tags: ["arithmetic", "division"], assessmentSlugs: schoolMathGrades(2, 6),
    create: ({ digits: [x, y] }) => {
      const divisor = 2 + x; const result = 3 + y; const dividend = divisor * result;
      return { question: `What is ${dividend} ÷ ${divisor}?`, result, explanation: `${divisor} × ${result} = ${dividend}, so ${dividend} ÷ ${divisor} = ${result}.`, proof: { operation: "divide", inputs: [dividend, divisor] } };
    },
  }),
  makeTemplate({
    id: "missing-addend", subject: "Mathematics", topic: "Missing-number equations", topicSlug: "missing-number-equations",
    objective: "Find a missing addend", difficulty: "easy", tags: ["arithmetic", "equations"], assessmentSlugs: schoolMathGrades(1, 5),
    create: ({ digits: [x, y] }) => {
      const known = 25 + x * 7; const result = 15 + y * 5; const total = known + result;
      return { question: `${known} + □ = ${total}. What number belongs in the box?`, result, explanation: `Subtract the known addend: ${total} − ${known} = ${result}.`, proof: { operation: "missing_addend", inputs: [total, known] } };
    },
  }),
  makeTemplate({
    id: "fraction-of-quantity", subject: "Mathematics", topic: "Fractions of quantities", topicSlug: "fractions-of-quantities",
    objective: "Calculate a unit fraction of a divisible quantity", difficulty: "medium", tags: ["fractions"], assessmentSlugs: [...schoolMathGrades(3, 7), ...APTITUDE],
    create: ({ digits: [x, y] }) => {
      const denominator = 2 + x; const result = 5 + y; const quantity = denominator * result;
      return { question: `What is 1/${denominator} of ${quantity}?`, result, explanation: `Divide ${quantity} by ${denominator}: ${quantity} ÷ ${denominator} = ${result}.`, proof: { operation: "fraction_of", inputs: [1, denominator, quantity] } };
    },
  }),
  makeTemplate({
    id: "percentage-of-number", subject: "Quantitative aptitude", topic: "Percentages", topicSlug: "percentages",
    objective: "Find a percentage of a number", difficulty: "medium", tags: ["percentages", "arithmetic"], assessmentSlugs: [...schoolMathGrades(5, 10), ...APTITUDE],
    create: ({ digits: [x, y] }) => {
      const percent = 5 + x; const base = 80 + y * 40; const result = base * percent / 100;
      return { question: `What is ${percent}% of ${base}?`, result, precision: 1, explanation: `${percent}% of ${base} = (${percent}/100) × ${base} = ${formatNumber(result, 1)}.`, proof: { operation: "percentage", inputs: [percent, base] } };
    },
  }),
  makeTemplate({
    id: "mean-average", subject: "Quantitative aptitude", topic: "Averages", topicSlug: "averages",
    objective: "Calculate the arithmetic mean", difficulty: "medium", tags: ["averages"], assessmentSlugs: [...schoolMathGrades(5, 10), ...APTITUDE],
    create: ({ digits: [x, y] }) => {
      const first = 20 + x; const difference = 2 + y; const values = [first, first + difference, first + 2 * difference, first + 3 * difference]; const result = values.reduce((sum, value) => sum + value, 0) / values.length;
      return { question: `Find the average of ${values.join(", ")}.`, result, precision: 1, explanation: `Their sum is ${values.reduce((sum, value) => sum + value, 0)}; dividing by 4 gives ${formatNumber(result, 1)}.`, proof: { operation: "average", inputs: values } };
    },
  }),
  makeTemplate({
    id: "linear-equation", subject: "Mathematics", topic: "Linear equations", topicSlug: "linear-equations",
    objective: "Solve a one-variable linear equation", difficulty: "medium", tags: ["algebra", "linear-equations"], assessmentSlugs: [...schoolMathGrades(6, 10), ...APTITUDE],
    create: ({ digits: [x, y] }) => {
      const coefficient = 2 + x; const result = 3 + y; const constant = 5 + y; const total = coefficient * result + constant;
      return { question: `Solve for x: ${coefficient}x + ${constant} = ${total}.`, result, explanation: `Subtract ${constant}, then divide by ${coefficient}: x = (${total} − ${constant})/${coefficient} = ${result}.`, proof: { operation: "linear_equation", inputs: [coefficient, constant, total] } };
    },
  }),
  makeTemplate({
    id: "rectangle-perimeter", subject: "Mathematics", topic: "Perimeter", topicSlug: "perimeter",
    objective: "Calculate the perimeter of a rectangle", difficulty: "easy", tags: ["geometry", "perimeter"], assessmentSlugs: [...schoolMathGrades(3, 8), ...APTITUDE],
    create: ({ digits: [x, y] }) => {
      const length = 4 + x; const width = 3 + y; const result = 2 * (length + width);
      return { question: `A rectangle is ${length} cm long and ${width} cm wide. What is its perimeter in centimetres?`, result, explanation: `Perimeter = 2 × (${length} + ${width}) = ${result} cm.`, proof: { operation: "rectangle_perimeter", inputs: [length, width] } };
    },
  }),
  makeTemplate({
    id: "rectangle-area", subject: "Mathematics", topic: "Area", topicSlug: "area",
    objective: "Calculate the area of a rectangle", difficulty: "easy", tags: ["geometry", "area"], assessmentSlugs: [...schoolMathGrades(4, 8), ...APTITUDE],
    create: ({ digits: [x, y] }) => {
      const length = 4 + x; const width = 3 + y; const result = length * width;
      return { question: `A rectangle measures ${length} cm by ${width} cm. What is its area in square centimetres?`, result, explanation: `Area = length × width = ${length} × ${width} = ${result} cm².`, proof: { operation: "rectangle_area", inputs: [length, width] } };
    },
  }),
  makeTemplate({
    id: "triangle-area", subject: "Mathematics", topic: "Area of triangles", topicSlug: "area-of-triangles",
    objective: "Calculate triangle area from base and height", difficulty: "medium", tags: ["geometry", "triangles", "area"], assessmentSlugs: [...schoolMathGrades(6, 10), ...APTITUDE],
    create: ({ digits: [x, y] }) => {
      const base = 4 + x * 2; const height = 3 + y; const result = base * height / 2;
      return { question: `A triangle has base ${base} cm and perpendicular height ${height} cm. What is its area in square centimetres?`, result, precision: 1, explanation: `Area = ½ × ${base} × ${height} = ${formatNumber(result, 1)} cm².`, proof: { operation: "triangle_area", inputs: [base, height] } };
    },
  }),
  makeTemplate({
    id: "unitary-price", subject: "Quantitative aptitude", topic: "Unitary method", topicSlug: "unitary-method",
    objective: "Use unit cost to scale a purchase", difficulty: "medium", tags: ["unitary-method", "money"], assessmentSlugs: [...schoolMathGrades(4, 8), ...APTITUDE],
    create: ({ digits: [x, y] }) => {
      const unitPrice = 3 + x; const firstQuantity = 2 + y; const askedQuantity = 60 + x + y; const firstCost = unitPrice * firstQuantity; const result = unitPrice * askedQuantity;
      return { question: `${firstQuantity} identical notebooks cost ₹${firstCost}. At the same rate, what is the cost in rupees of ${askedQuantity} notebooks?`, result, explanation: `One notebook costs ₹${firstCost} ÷ ${firstQuantity} = ₹${unitPrice}; ${askedQuantity} cost ₹${unitPrice} × ${askedQuantity} = ₹${result}.`, proof: { operation: "unitary_price", inputs: [firstCost, firstQuantity, askedQuantity] } };
    },
  }),
  makeTemplate({
    id: "elapsed-time", subject: "Mathematics", topic: "Elapsed time", topicSlug: "elapsed-time",
    objective: "Calculate elapsed time in minutes", difficulty: "medium", tags: ["time", "measurement"], assessmentSlugs: schoolMathGrades(2, 5),
    create: ({ digits: [x, y] }) => {
      const start = 360 + x * 5; const duration = 20 + y * 3; const end = start + duration; const result = duration;
      const clock = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
      return { question: `A lesson starts at ${clock(start)} and ends at ${clock(end)}. How many minutes does it last?`, result, explanation: `${clock(end)} is ${duration} minutes after ${clock(start)}.`, proof: { operation: "elapsed_minutes", inputs: [start, end] } };
    },
  }),
  makeTemplate({
    id: "speed-distance", subject: "Quantitative aptitude", topic: "Speed, distance and time", topicSlug: "speed-distance-time",
    objective: "Find distance from constant speed and time", difficulty: "medium", tags: ["speed", "distance", "time"], assessmentSlugs: [...APTITUDE, ...ENTRANCE_PHYSICS],
    create: ({ digits: [x, y] }) => {
      const speed = 20 + x * 2; const time = 1 + y; const result = speed * time;
      return { question: `A vehicle travels at ${speed} km/h for ${time} hours. What distance does it cover in kilometres?`, result, explanation: `Distance = speed × time = ${speed} × ${time} = ${result} km.`, proof: { operation: "multiply", inputs: [speed, time] } };
    },
  }),
  makeTemplate({
    id: "speed-time", subject: "Quantitative aptitude", topic: "Speed, distance and time", topicSlug: "speed-distance-time",
    objective: "Find travel time from distance and speed", difficulty: "medium", tags: ["speed", "distance", "time"], assessmentSlugs: APTITUDE,
    create: ({ digits: [x, y] }) => {
      const speed = 20 + x * 2; const result = 1 + y; const distance = speed * result;
      return { question: `How many hours are required to travel ${distance} km at a constant speed of ${speed} km/h?`, result, explanation: `Time = distance ÷ speed = ${distance} ÷ ${speed} = ${result} hours.`, proof: { operation: "divide", inputs: [distance, speed] } };
    },
  }),
  makeTemplate({
    id: "simple-interest", subject: "Quantitative aptitude", topic: "Simple interest", topicSlug: "simple-interest",
    objective: "Calculate simple interest", difficulty: "medium", tags: ["finance", "interest"], assessmentSlugs: APTITUDE,
    create: ({ digits: [x, y] }) => {
      const principal = 1000 + x * 200; const rate = 2 + y; const time = 1 + (x % 5); const result = principal * rate * time / 100;
      return { question: `Find the simple interest in rupees on ₹${principal} at ${rate}% per year for ${time} years.`, result, precision: 1, explanation: `SI = PRT/100 = ${principal} × ${rate} × ${time} / 100 = ₹${formatNumber(result, 1)}.`, proof: { operation: "simple_interest", inputs: [principal, rate, time] } };
    },
  }),
  makeTemplate({
    id: "compound-interest", subject: "Quantitative aptitude", topic: "Compound interest", topicSlug: "compound-interest",
    objective: "Calculate annually compounded interest", difficulty: "hard", tags: ["finance", "compound-interest"], assessmentSlugs: APTITUDE,
    create: ({ variant, digits: [x, y] }) => {
      const principal = 1000 + variant * 100; const rates = [5, 10, 20]; const rate = rates[y % rates.length]; const time = 2 + (x % 3); const result = principal * ((1 + rate / 100) ** time - 1);
      return { question: `What is the compound interest in rupees on ₹${principal} at ${rate}% per year for ${time} years, compounded annually?`, result, precision: 2, explanation: `CI = ${principal}[(1 + ${rate}/100)^${time} − 1] = ₹${formatNumber(result, 2)}.`, proof: { operation: "compound_interest", inputs: [principal, rate, time] } };
    },
  }),
  makeTemplate({
    id: "profit-percentage", subject: "Quantitative aptitude", topic: "Profit and loss", topicSlug: "profit-and-loss",
    objective: "Calculate profit percentage", difficulty: "medium", tags: ["profit", "percentages"], assessmentSlugs: APTITUDE,
    create: ({ variant, digits: [, y] }) => {
      const cost = 100 + variant * 20; const rates = [5, 10, 15, 20, 25, 30, 40, 50]; const result = rates[y % rates.length]; const selling = cost * (1 + result / 100);
      return { question: `An item bought for ₹${cost} is sold for ₹${formatNumber(selling, 1)}. What is the profit percentage?`, result, explanation: `Profit = ₹${formatNumber(selling - cost, 1)}; profit percentage = profit/cost × 100 = ${result}%.`, proof: { operation: "profit_percentage", inputs: [cost, selling] } };
    },
  }),
  makeTemplate({
    id: "discount-amount", subject: "Quantitative aptitude", topic: "Discounts", topicSlug: "discounts",
    objective: "Calculate the discount amount", difficulty: "medium", tags: ["discount", "percentages"], assessmentSlugs: APTITUDE,
    create: ({ variant, digits: [, y] }) => {
      const marked = 200 + variant * 20; const rates = [5, 10, 15, 20, 25, 30]; const rate = rates[y % rates.length]; const result = marked * rate / 100;
      return { question: `A product marked ₹${marked} is offered at ${rate}% off. What is the discount amount in rupees?`, result, precision: 1, explanation: `Discount = ${rate}% of ₹${marked} = ₹${formatNumber(result, 1)}.`, proof: { operation: "percentage", inputs: [rate, marked] } };
    },
  }),
  makeTemplate({
    id: "ratio-share", subject: "Quantitative aptitude", topic: "Ratio and proportion", topicSlug: "ratio-and-proportion",
    objective: "Divide a total in a given ratio", difficulty: "medium", tags: ["ratio", "proportion"], assessmentSlugs: [...schoolMathGrades(6, 10), ...APTITUDE],
    create: ({ digits: [x, y] }) => {
      const first = 1 + x; const second = 1 + y; const unit = 10 + x + y; const total = (first + second) * unit; const result = first * unit;
      return { question: `₹${total} is divided in the ratio ${first}:${second}. How many rupees are in the first share?`, result, explanation: `There are ${first + second} ratio units. Each is ₹${unit}, so the first share is ${first} × ₹${unit} = ₹${result}.`, proof: { operation: "ratio_share", inputs: [total, first, second] } };
    },
  }),
  makeTemplate({
    id: "direct-proportion", subject: "Quantitative aptitude", topic: "Direct proportion", topicSlug: "direct-proportion",
    objective: "Solve a direct proportion", difficulty: "medium", tags: ["ratio", "proportion"], assessmentSlugs: [...schoolMathGrades(6, 10), ...APTITUDE],
    create: ({ digits: [x, y] }) => {
      const a = 2 + x; const multiplier = 2 + y; const b = a * multiplier; const c = 60 + x + y; const result = c * multiplier;
      return { question: `If ${a} units correspond to ${b}, what value corresponds to ${c} units at the same rate?`, result, explanation: `The scale factor is ${b} ÷ ${a} = ${multiplier}; ${c} × ${multiplier} = ${result}.`, proof: { operation: "direct_proportion", inputs: [a, b, c] } };
    },
  }),
  makeTemplate({
    id: "highest-common-factor", subject: "Mathematics", topic: "Factors and multiples", topicSlug: "factors-and-multiples",
    objective: "Find the highest common factor", difficulty: "medium", tags: ["hcf", "number-theory"], assessmentSlugs: [...schoolMathGrades(4, 8), ...APTITUDE],
    create: ({ digits: [x, y] }) => {
      const factor = 2 + x; const a = factor * (2 + y); const b = factor * (53 + x); const result = gcd(a, b);
      return { question: `What is the highest common factor (HCF) of ${a} and ${b}?`, result, explanation: `Applying repeated division gives HCF(${a}, ${b}) = ${result}.`, proof: { operation: "gcd", inputs: [a, b] } };
    },
  }),
  makeTemplate({
    id: "least-common-multiple", subject: "Mathematics", topic: "Factors and multiples", topicSlug: "factors-and-multiples",
    objective: "Find the least common multiple", difficulty: "medium", tags: ["lcm", "number-theory"], assessmentSlugs: [...schoolMathGrades(4, 8), ...APTITUDE],
    create: ({ digits: [x, y] }) => {
      const a = 2 + x; const b = 3 + y; const result = lcm(a, b);
      return { question: `What is the least common multiple (LCM) of ${a} and ${b}?`, result, explanation: `LCM(${a}, ${b}) = (${a} × ${b}) ÷ HCF(${a}, ${b}) = ${result}.`, proof: { operation: "lcm", inputs: [a, b] } };
    },
  }),
  makeTemplate({
    id: "simple-probability", subject: "Quantitative aptitude", topic: "Probability", topicSlug: "probability",
    objective: "Express a simple probability as a percentage", difficulty: "medium", tags: ["probability", "percentages"], assessmentSlugs: [...schoolMathGrades(7, 10), ...APTITUDE],
    create: ({ digits: [x, y] }) => {
      const total = 100 + x; const favourable = 1 + y; const result = favourable / total * 100;
      return { question: `A bag contains ${total} equally likely tokens, of which ${favourable} are blue. What is the probability of drawing a blue token, as a percentage?`, result, precision: 2, explanation: `Probability = ${favourable}/${total} × 100 = ${formatNumber(result, 2)}%.`, proof: { operation: "probability_percent", inputs: [favourable, total] } };
    },
  }),
  makeTemplate({
    id: "arithmetic-sequence", subject: "Quantitative aptitude", topic: "Number sequences", topicSlug: "number-sequences",
    objective: "Continue an arithmetic sequence", difficulty: "medium", tags: ["sequences", "reasoning"], assessmentSlugs: [...schoolMathGrades(6, 10), ...APTITUDE],
    create: ({ digits: [x, y] }) => {
      const first = 2 + x; const difference = 2 + y; const shown = [0, 1, 2, 3].map((n) => first + n * difference); const result = first + 4 * difference;
      return { question: `What is the next number in the sequence ${shown.join(", ")}, …?`, result, explanation: `Each term increases by ${difference}, so the next term is ${shown[3]} + ${difference} = ${result}.`, proof: { operation: "arithmetic_next", inputs: [first, difference, 4] } };
    },
  }),
  makeTemplate({
    id: "integer-powers", subject: "Mathematics", topic: "Powers and exponents", topicSlug: "powers-and-exponents",
    objective: "Evaluate a small integer power", difficulty: "medium", tags: ["exponents"], assessmentSlugs: [...schoolMathGrades(6, 10), ...APTITUDE],
    create: ({ digits: [x, y] }) => {
      const base = 2 + x + 50 * y; const exponent = 2 + (y % 3); const result = base ** exponent;
      return { question: `Evaluate ${base}^${exponent}.`, result, explanation: `${base} multiplied by itself ${exponent} times equals ${result}.`, proof: { operation: "power", inputs: [base, exponent] } };
    },
  }),
  makeTemplate({
    id: "newtons-second-law", subject: "Physics", topic: "Force and Newton's laws", topicSlug: "force-and-newtons-laws",
    objective: "Apply F = ma", difficulty: "medium", tags: ["mechanics", "force"], assessmentSlugs: ENTRANCE_PHYSICS,
    create: ({ digits: [x, y] }) => {
      const mass = 2 + x; const acceleration = 1 + y; const result = mass * acceleration;
      return { question: `A ${mass} kg object accelerates at ${acceleration} m/s². What net force acts on it, in newtons?`, result, explanation: `F = ma = ${mass} × ${acceleration} = ${result} N.`, proof: { operation: "multiply", inputs: [mass, acceleration] } };
    },
  }),
  makeTemplate({
    id: "uniform-acceleration", subject: "Physics", topic: "Motion in a straight line", topicSlug: "motion-in-a-straight-line",
    objective: "Calculate uniform acceleration", difficulty: "medium", tags: ["kinematics", "acceleration"], assessmentSlugs: ENTRANCE_PHYSICS,
    create: ({ digits: [x, y] }) => {
      const initial = x; const time = 2 + y; const result = 1 + x; const finalVelocity = initial + result * time;
      return { question: `Velocity changes uniformly from ${initial} m/s to ${finalVelocity} m/s in ${time} s. What is the acceleration in m/s²?`, result, explanation: `a = (v − u)/t = (${finalVelocity} − ${initial})/${time} = ${result} m/s².`, proof: { operation: "acceleration", inputs: [initial, finalVelocity, time] } };
    },
  }),
  makeTemplate({
    id: "mechanical-work", subject: "Physics", topic: "Work, energy and power", topicSlug: "work-energy-and-power",
    objective: "Calculate work for a force parallel to displacement", difficulty: "medium", tags: ["mechanics", "work"], assessmentSlugs: ENTRANCE_PHYSICS,
    create: ({ digits: [x, y] }) => {
      const force = 5 + x * 2; const distance = 2 + y; const result = force * distance;
      return { question: `A constant ${force} N force moves an object ${distance} m in the force's direction. How much work is done, in joules?`, result, explanation: `W = Fs = ${force} × ${distance} = ${result} J.`, proof: { operation: "multiply", inputs: [force, distance] } };
    },
  }),
  makeTemplate({
    id: "kinetic-energy", subject: "Physics", topic: "Work, energy and power", topicSlug: "work-energy-and-power",
    objective: "Apply KE = ½mv²", difficulty: "medium", tags: ["mechanics", "kinetic-energy"], assessmentSlugs: ENTRANCE_PHYSICS,
    create: ({ digits: [x, y] }) => {
      const mass = 2 * (1 + x); const velocity = 1 + y; const result = 0.5 * mass * velocity ** 2;
      return { question: `What is the kinetic energy, in joules, of a ${mass} kg object moving at ${velocity} m/s?`, result, explanation: `KE = ½mv² = ½ × ${mass} × ${velocity}² = ${result} J.`, proof: { operation: "kinetic_energy", inputs: [mass, velocity] } };
    },
  }),
  makeTemplate({
    id: "gravitational-potential-energy", subject: "Physics", topic: "Work, energy and power", topicSlug: "work-energy-and-power",
    objective: "Apply gravitational potential energy mgh", difficulty: "medium", tags: ["mechanics", "potential-energy"], assessmentSlugs: ENTRANCE_PHYSICS,
    create: ({ digits: [x, y] }) => {
      const mass = 1 + x; const height = 1 + y; const gravity = 10; const result = mass * gravity * height;
      return { question: `Using g = 10 m/s², what gravitational potential energy in joules does a ${mass} kg mass gain when raised ${height} m?`, result, explanation: `PE = mgh = ${mass} × 10 × ${height} = ${result} J.`, proof: { operation: "multiply_three", inputs: [mass, gravity, height] } };
    },
  }),
  makeTemplate({
    id: "ohms-law", subject: "Physics", topic: "Current electricity", topicSlug: "current-electricity",
    objective: "Apply Ohm's law V = IR", difficulty: "medium", tags: ["electricity", "ohms-law"], assessmentSlugs: ENTRANCE_PHYSICS,
    create: ({ digits: [x, y] }) => {
      const current = 1 + x; const resistance = 2 + y; const result = current * resistance;
      return { question: `A current of ${current} A flows through a ${resistance} Ω resistor. What is the potential difference in volts?`, result, explanation: `V = IR = ${current} × ${resistance} = ${result} V.`, proof: { operation: "multiply", inputs: [current, resistance] } };
    },
  }),
  makeTemplate({
    id: "electric-power", subject: "Physics", topic: "Current electricity", topicSlug: "current-electricity",
    objective: "Calculate electric power from voltage and current", difficulty: "medium", tags: ["electricity", "power"], assessmentSlugs: ENTRANCE_PHYSICS,
    create: ({ digits: [x, y] }) => {
      const voltage = 5 + x * 2; const current = 1 + y; const result = voltage * current;
      return { question: `An appliance operates at ${voltage} V and draws ${current} A. What power does it use, in watts?`, result, explanation: `P = VI = ${voltage} × ${current} = ${result} W.`, proof: { operation: "multiply", inputs: [voltage, current] } };
    },
  }),
  makeTemplate({
    id: "mass-density-volume", subject: "Physics", topic: "Properties of matter", topicSlug: "properties-of-matter",
    objective: "Calculate density from mass and volume", difficulty: "medium", tags: ["density", "matter"], assessmentSlugs: ENTRANCE_PHYSICS,
    create: ({ digits: [x, y] }) => {
      const volume = 2 + x; const result = 1 + y; const mass = volume * result;
      return { question: `A sample has mass ${mass} g and volume ${volume} cm³. What is its density in g/cm³?`, result, explanation: `Density = mass/volume = ${mass}/${volume} = ${result} g/cm³.`, proof: { operation: "divide", inputs: [mass, volume] } };
    },
  }),
  makeTemplate({
    id: "specific-heat", subject: "Physics", topic: "Thermal properties", topicSlug: "thermal-properties",
    objective: "Calculate heat using Q = mcΔT", difficulty: "hard", tags: ["thermal-physics", "specific-heat"], assessmentSlugs: ENTRANCE_PHYSICS,
    create: ({ digits: [x, y] }) => {
      const mass = 1 + x; const specificHeat = 2 + (y % 9); const temperatureChange = 5 + y; const result = mass * specificHeat * temperatureChange;
      return { question: `A ${mass} kg material with specific heat ${specificHeat} J/(kg·°C) warms by ${temperatureChange}°C. How much heat is absorbed, in joules?`, result, explanation: `Q = mcΔT = ${mass} × ${specificHeat} × ${temperatureChange} = ${result} J.`, proof: { operation: "multiply_three", inputs: [mass, specificHeat, temperatureChange] } };
    },
  }),
  makeTemplate({
    id: "amount-of-substance", subject: "Chemistry", topic: "Mole concept", topicSlug: "mole-concept",
    objective: "Calculate moles from mass and molar mass", difficulty: "medium", tags: ["moles", "stoichiometry"], assessmentSlugs: ENTRANCE_CHEMISTRY,
    create: ({ digits: [x, y] }) => {
      const molarMass = 2 + x; const result = 1 + y; const mass = molarMass * result;
      return { question: `How many moles are present in ${mass} g of a substance with molar mass ${molarMass} g/mol?`, result, explanation: `Moles = mass/molar mass = ${mass}/${molarMass} = ${result} mol.`, proof: { operation: "divide", inputs: [mass, molarMass] } };
    },
  }),
  makeTemplate({
    id: "solution-molarity", subject: "Chemistry", topic: "Solutions and concentration", topicSlug: "solutions-and-concentration",
    objective: "Calculate molarity from moles and solution volume", difficulty: "medium", tags: ["molarity", "solutions"], assessmentSlugs: ENTRANCE_CHEMISTRY,
    create: ({ digits: [x, y] }) => {
      const volumeLitres = 1 + x; const result = 1 + y; const moles = volumeLitres * result;
      return { question: `${moles} mol of solute is dissolved to make ${volumeLitres} L of solution. What is the molarity in mol/L?`, result, explanation: `Molarity = moles/volume = ${moles}/${volumeLitres} = ${result} mol/L.`, proof: { operation: "divide", inputs: [moles, volumeLitres] } };
    },
  }),
  makeTemplate({
    id: "linear-momentum", subject: "Physics", topic: "Momentum", topicSlug: "momentum",
    objective: "Calculate linear momentum", difficulty: "medium", tags: ["mechanics", "momentum"], assessmentSlugs: ENTRANCE_PHYSICS,
    create: ({ digits: [x, y] }) => {
      const mass = 1 + x; const velocity = 1 + y; const result = mass * velocity;
      return { question: `What is the momentum, in kg·m/s, of a ${mass} kg object moving at ${velocity} m/s?`, result, explanation: `p = mv = ${mass} × ${velocity} = ${result} kg·m/s.`, proof: { operation: "multiply", inputs: [mass, velocity] } };
    },
  }),
  makeTemplate({
    id: "mechanical-pressure", subject: "Physics", topic: "Mechanical properties of fluids", topicSlug: "mechanical-properties-of-fluids",
    objective: "Calculate pressure from force and area", difficulty: "medium", tags: ["pressure", "mechanics"], assessmentSlugs: ENTRANCE_PHYSICS,
    create: ({ digits: [x, y] }) => {
      const area = 1 + x; const result = 10 + y; const force = area * result;
      return { question: `A normal force of ${force} N acts uniformly over ${area} m². What pressure is produced, in pascals?`, result, explanation: `Pressure = force/area = ${force}/${area} = ${result} Pa.`, proof: { operation: "divide", inputs: [force, area] } };
    },
  }),
  makeTemplate({
    id: "wave-speed", subject: "Physics", topic: "Waves", topicSlug: "waves",
    objective: "Apply v = fλ", difficulty: "medium", tags: ["waves", "wavelength"], assessmentSlugs: ENTRANCE_PHYSICS,
    create: ({ digits: [x, y] }) => {
      const frequency = 2 + x; const wavelength = 1 + y; const result = frequency * wavelength;
      return { question: `A wave has frequency ${frequency} Hz and wavelength ${wavelength} m. What is its speed in m/s?`, result, explanation: `v = fλ = ${frequency} × ${wavelength} = ${result} m/s.`, proof: { operation: "multiply", inputs: [frequency, wavelength] } };
    },
  }),
  makeTemplate({
    id: "ph-from-concentration", subject: "Chemistry", topic: "Equilibrium and pH", topicSlug: "equilibrium-and-ph",
    objective: "Calculate pH for a power-of-ten hydrogen-ion concentration", difficulty: "medium", tags: ["ph", "equilibrium"], assessmentSlugs: ENTRANCE_CHEMISTRY,
    create: ({ variant }) => {
      const exponent = 1 + variant / 1000; const result = exponent;
      return { question: `For a solution with [H⁺] = 10^−${formatNumber(exponent, 3)} mol/L, what is the pH?`, result, precision: 3, explanation: `pH = −log₁₀[H⁺] = −log₁₀(10^−${formatNumber(exponent, 3)}) = ${formatNumber(result, 3)}.`, proof: { operation: "ph_power_ten", inputs: [exponent] } };
    },
  }),
  makeTemplate({
    id: "ideal-gas-law", subject: "Chemistry", topic: "States of matter", topicSlug: "states-of-matter",
    objective: "Apply the ideal-gas relationship using a stated gas constant", difficulty: "hard", tags: ["gas-laws", "ideal-gas"], assessmentSlugs: ENTRANCE_CHEMISTRY,
    create: ({ digits: [x, y] }) => {
      const moles = 1 + (x % 10); const temperature = 250 + y * 5; const volume = 5 + x; const gasConstant = 0.082; const result = moles * gasConstant * temperature / volume;
      return { question: `Using R = 0.082 L·atm·mol⁻¹·K⁻¹, find the pressure in atm of ${moles} mol of an ideal gas at ${temperature} K occupying ${volume} L.`, result, precision: 2, explanation: `P = nRT/V = ${moles} × 0.082 × ${temperature} / ${volume} = ${formatNumber(result, 2)} atm.`, proof: { operation: "ideal_gas_pressure", inputs: [moles, gasConstant, temperature, volume] } };
    },
  }),
  makeTemplate({
    id: "frequency-from-period", subject: "Physics", topic: "Oscillations", topicSlug: "oscillations",
    objective: "Calculate frequency from period", difficulty: "medium", tags: ["oscillations", "frequency"], assessmentSlugs: ENTRANCE_PHYSICS,
    create: ({ variant }) => {
      const result = 1 + variant; const period = 1 / result;
      return { question: `An oscillator has period 1/${result} s. What is its frequency in hertz?`, result, explanation: `f = 1/T = 1/(1/${result}) = ${result} Hz.`, proof: { operation: "reciprocal", inputs: [period] } };
    },
  }),
  makeTemplate({
    id: "stoichiometric-mass", subject: "Chemistry", topic: "Stoichiometry", topicSlug: "stoichiometry",
    objective: "Use a mole ratio to calculate product mass", difficulty: "hard", tags: ["stoichiometry", "moles"], assessmentSlugs: ENTRANCE_CHEMISTRY,
    create: ({ digits: [x, y] }) => {
      const reactantCoefficient = 1 + (x % 5); const productCoefficient = 1 + (y % 5); const reactantMoles = reactantCoefficient * (2 + x); const productMolarMass = 10 + y * 2; const productMoles = reactantMoles * productCoefficient / reactantCoefficient; const result = productMoles * productMolarMass;
      return { question: `A reaction produces ${productCoefficient} mol of product for every ${reactantCoefficient} mol of reactant. If ${reactantMoles} mol of reactant is used completely and the product's molar mass is ${productMolarMass} g/mol, what mass of product forms, in grams?`, result, explanation: `Product moles = ${reactantMoles} × ${productCoefficient}/${reactantCoefficient} = ${productMoles}; mass = ${productMoles} × ${productMolarMass} = ${result} g.`, proof: { operation: "stoichiometric_mass", inputs: [reactantMoles, reactantCoefficient, productCoefficient, productMolarMass] } };
    },
  }),
];

export function evaluateCalculationProof(proof: CalculationProof): number {
  const [a, b, c, d] = proof.inputs;
  switch (proof.operation) {
    case "add": return a + b;
    case "subtract": return a - b;
    case "multiply": return a * b;
    case "multiply_three": return a * b * c;
    case "divide": return a / b;
    case "missing_addend": return a - b;
    case "fraction_of": return a / b * c;
    case "percentage": return a / 100 * b;
    case "average": return proof.inputs.reduce((sum, value) => sum + value, 0) / proof.inputs.length;
    case "linear_equation": return (c - b) / a;
    case "rectangle_perimeter": return 2 * (a + b);
    case "rectangle_area": return a * b;
    case "triangle_area": return a * b / 2;
    case "unitary_price": return a / b * c;
    case "elapsed_minutes": return b - a;
    case "simple_interest": return a * b * c / 100;
    case "compound_interest": return a * ((1 + b / 100) ** c - 1);
    case "profit_percentage": return (b - a) / a * 100;
    case "ratio_share": return a * b / (b + c);
    case "direct_proportion": return b / a * c;
    case "gcd": return gcd(a, b);
    case "lcm": return lcm(a, b);
    case "probability_percent": return a / b * 100;
    case "arithmetic_next": return a + b * c;
    case "power": return a ** b;
    case "acceleration": return (b - a) / c;
    case "kinetic_energy": return 0.5 * a * b ** 2;
    case "ph_power_ten": return a;
    case "ideal_gas_pressure": return a * b * c / d;
    case "reciprocal": return 1 / a;
    case "stoichiometric_mass": return a * c / b * d;
    default: throw new Error(`Unsupported calculation proof operation: ${proof.operation}`);
  }
}

export function verifyOriginalQuestionRecord(record: OriginalQuestionRecord): boolean {
  if (record.options.length !== 4 || new Set(record.options).size !== 4) return false;
  const correctText = record.options[record.answer.correctOption];
  if (correctText === undefined) return false;
  const proofResult = round(evaluateCalculationProof(record.metadata.proof), record.metadata.proof.precision);
  const expectedText = formatNumber(proofResult, record.metadata.proof.precision);
  return correctText === expectedText && proofResult === round(record.metadata.proof.result, record.metadata.proof.precision);
}

export function generateOriginalQuestion(index: number): OriginalQuestionRecord {
  if (!Number.isInteger(index) || index < 0) throw new Error("Question index must be a non-negative integer");
  const template = ORIGINAL_QUESTION_TEMPLATES[index % ORIGINAL_QUESTION_TEMPLATES.length];
  const variant = Math.floor(index / ORIGINAL_QUESTION_TEMPLATES.length);
  const draft = template.create({ variant, digits: mixedRadixDigits(variant) });
  const precision = draft.precision ?? 0;
  const result = round(draft.result, precision);
  const { options, correctOption } = buildOptions(result, precision, variant);
  const proof: CalculationProof = { ...draft.proof, result, precision };
  const record: OriginalQuestionRecord = {
    schemaVersion: 1,
    sourceRecordId: `${ORIGINAL_QUESTION_PACK_SOURCE_KEY}:${template.id}:${String(variant + 1).padStart(6, "0")}`,
    language: "en",
    question: draft.question,
    format: "mcq_single",
    options,
    answer: { kind: "single_choice", correctOption },
    explanation: draft.explanation,
    subject: template.subject,
    topic: template.topic,
    syllabus: template.syllabus,
    exam: template.exam,
    examYear: null,
    objective: template.objective,
    difficulty: template.difficulty,
    maxPoints: template.difficulty === "hard" ? 2 : 1,
    negativeMarks: 0,
    timeLimitSec: template.timeLimitSec,
    tags: Array.from(new Set([...template.tags, template.topicSlug, "octamy-original"])),
    provenance: {
      sourceLocator: `generator:${template.id}:v${ORIGINAL_QUESTION_PACK_VERSION}:variant-${variant + 1}`,
      questionOrigin: "original",
      answerEvidence: `${draft.explanation} Independently recomputable as ${draft.proof.operation}(${draft.proof.inputs.join(", ")}).`,
      explanationOrigin: "original",
    },
    metadata: {
      generatorVersion: ORIGINAL_QUESTION_PACK_VERSION,
      templateId: template.id,
      variant,
      bankSlug: ORIGINAL_QUESTION_BANK_SLUG,
      topicSlug: template.topicSlug,
      assessmentSlugs: template.assessmentSlugs,
      proof,
    },
  };
  if (!verifyOriginalQuestionRecord(record)) {
    throw new Error(`Generated question failed deterministic verification: ${record.sourceRecordId}`);
  }
  return record;
}

export function generateOriginalQuestions(count: number): OriginalQuestionRecord[] {
  if (!Number.isInteger(count) || count < 1 || count > 100_000) {
    throw new Error("Question count must be an integer between 1 and 100000");
  }
  return Array.from({ length: count }, (_, index) => generateOriginalQuestion(index));
}
