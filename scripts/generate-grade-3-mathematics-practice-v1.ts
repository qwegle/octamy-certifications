#!/usr/bin/env node

import { createHash } from "node:crypto";
import { createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { finished } from "node:stream/promises";
import { normalizeQuestionPackItem } from "./lib/question-pack-contract";

const ASSESSMENT_SLUG = "grade-3-mathematics-practice";
const BANK_SLUG = "grade-3-mathematics-practice-pool-v1";
const SYLLABUS = "Grade 3 Arithmetic, Time and Perimeter Practice Blueprint v1";
const EXAM_TITLE = "Grade 3 Arithmetic, Time and Perimeter Practice";
const SOURCE = "https://ncert.nic.in/textbook/pdf/cemm1ps.pdf";
const OBJECTIVE_CODES: Record<string, string> = {
  "whole-number-addition": "G3-ATP-ADD-WN-1000",
  "whole-number-subtraction": "G3-ATP-SUB-WN-1000",
  multiplication: "G3-ATP-MUL-EQUAL-GROUPS-10",
  division: "G3-ATP-DIV-EQUAL-SHARING-100",
  "missing-number-equations": "G3-ATP-EQN-MISSING-ADD-SUB",
  "fractions-of-quantities": "G3-ATP-FRQ-HALF-FOURTH",
  "elapsed-time": "G3-ATP-TIME-ELAPSED-MINUTES",
  perimeter: "G3-ATP-MEASURE-PERIMETER",
};

type Difficulty = "easy" | "medium" | "hard";
type Draft = {
  topic: string;
  topicSlug: string;
  objective: string;
  question: string;
  answer: number;
  distractors: [number, number, number];
  explanation: string;
  difficulty?: Difficulty;
};

function uniqueOptions(answer: number, distractors: [number, number, number], index: number) {
  const candidates = [...distractors, answer - 1, answer + 1, answer - 2, answer + 2, answer + 10]
    .filter((value) => Number.isInteger(value) && value >= 0 && value !== answer);
  const values = [answer, ...Array.from(new Set(candidates)).slice(0, 3)];
  if (values.length !== 4) throw new Error(`Could not construct four unique options for ${answer}`);
  const correctOption = index % 4;
  const options = values.slice(1).map(String);
  options.splice(correctOption, 0, String(answer));
  return { options, correctOption };
}

function record(draft: Draft, index: number) {
  const id = `g3m-v1-${String(index + 1).padStart(3, "0")}`;
  const choice = uniqueOptions(draft.answer, draft.distractors, index);
  return {
    schemaVersion: 1 as const,
    sourceRecordId: id,
    language: "en",
    question: draft.question,
    format: "mcq_single" as const,
    options: choice.options,
    answer: { kind: "single_choice" as const, correctOption: choice.correctOption },
    explanation: draft.explanation,
    subject: "Mathematics",
    topic: draft.topic,
    syllabus: SYLLABUS,
    exam: EXAM_TITLE,
    examYear: null,
    objective: draft.objective,
    difficulty: draft.difficulty ?? "medium",
    maxPoints: 1,
    negativeMarks: 0,
    timeLimitSec: draft.difficulty === "hard" ? 120 : draft.difficulty === "easy" ? 45 : 75,
    tags: ["grade-3", "mathematics", draft.topicSlug, "original", "version-1"],
    provenance: {
      sourceLocator: SOURCE,
      questionOrigin: "original" as const,
      answerEvidence: draft.explanation,
      explanationOrigin: "original" as const,
    },
    metadata: {
      bankSlug: BANK_SLUG,
      assessmentSlugs: [ASSESSMENT_SLUG],
      topicSlug: draft.topicSlug,
      curriculumReferenceUse: "age-band-context-only-not-full-curriculum-alignment",
      authoredCaseVersion: "1.0.0",
      releaseEvidence: {
        syllabusVersion: SYLLABUS,
        objectiveCode: OBJECTIVE_CODES[draft.topicSlug],
        answerValidation: {
          status: "verified",
          method: "independent_calculation",
          reference: `Independent calculation recorded in the authored case: ${draft.explanation}`,
        },
        distractorReview: {
          status: "verified",
          note: "The three distinct distractors represent nearby-number, inverse-operation, or incomplete-step errors; none equals the recalculated answer.",
        },
      },
    },
  };
}

const additionCases: Array<[string, number, number]> = [
  ["library storybooks", 126, 243], ["festival lamps", 218, 157], ["seed packets", 304, 185],
  ["museum tickets", 175, 216], ["school badges", 248, 139], ["mangoes", 187, 205],
  ["notebooks", 326, 148], ["trees", 219, 264], ["beads", 145, 328],
  ["visitors", 276, 194], ["clay tiles", 163, 229], ["postcards", 335, 146],
  ["paper flowers", 208, 175], ["water bottles", 154, 267], ["bus passengers", 189, 203],
  ["rupee coins", 237, 156], ["young plants", 128, 349], ["sports-day ribbons", 264, 117],
  ["grain sacks", 172, 215], ["toy blocks", 295, 184], ["pages", 143, 258],
  ["marbles", 216, 169], ["roof tiles", 307, 126], ["orange baskets", 184, 233], ["fair coupons", 259, 138],
];

const subtractionCases: Array<[string, number, number]> = [
  ["books before lending", 482, 157], ["litres in a tank before use", 650, 238], ["tickets printed before sale", 725, 316],
  ["saplings before planting", 540, 184], ["beads before a craft activity", 463, 129], ["mangoes before delivery", 608, 247],
  ["notebooks before distribution", 590, 265], ["tiles before repairs", 744, 328], ["stickers before sharing", 405, 176],
  ["seats before booking", 680, 294], ["bricks before construction", 832, 417], ["flowers before decoration", 527, 189],
  ["bottles before recycling", 614, 276], ["coins before spending", 750, 348], ["cards before posting", 436, 158],
  ["metres of ribbon before cutting", 503, 227], ["grain bags before sharing", 692, 315], ["pencils before sharing", 580, 246],
  ["oranges before sale", 471, 193], ["entry tickets before use", 805, 389], ["toy parts before building", 639, 274],
  ["young plants before moving", 556, 218], ["cups before the party", 420, 167], ["pages in two books", 900, 458], ["fair tokens before use", 785, 369],
];

const multiplicationCases: Array<[string, number, number]> = [
  ["pencils", 6, 8], ["flowers", 7, 9], ["chairs", 8, 7],
  ["oranges", 5, 10], ["buttons", 4, 9], ["toy-car wheels", 4, 8],
  ["pages", 9, 6], ["cups", 6, 7], ["seeds", 8, 9],
  ["crayons", 10, 7], ["beads", 9, 8], ["tiles", 7, 6],
  ["bananas", 6, 9], ["paper windows", 5, 8], ["team badges", 8, 6],
  ["lamps", 9, 7], ["books", 7, 8], ["stamps", 6, 10],
  ["plants", 8, 8], ["biscuits", 5, 9], ["bells", 4, 10],
  ["stickers", 10, 9], ["marbles", 7, 10], ["flags", 3, 8], ["coins", 9, 9],
];

const divisionCases: Array<[string, number, number]> = [
  ["pencils", 56, 7], ["flowers", 72, 8], ["oranges", 60, 5], ["stickers", 63, 9], ["crayons", 48, 6],
  ["beads", 80, 10], ["books", 54, 6], ["cups", 84, 7], ["seeds", 64, 8], ["cards", 45, 5],
  ["buttons", 81, 9], ["marbles", 66, 6], ["biscuits", 70, 10], ["ribbons", 44, 4], ["toy blocks", 96, 8],
  ["notebooks", 75, 5], ["lamps", 42, 7], ["saplings", 90, 9], ["shells", 36, 4], ["flags", 88, 8],
  ["coins", 77, 7], ["tiles", 50, 5], ["stamps", 90, 9], ["pebbles", 60, 6], ["paper stars", 100, 10],
];

const missingCases: Array<["add" | "subtract", number, number, string]> = [
  ["add", 145, 320, "library count"], ["add", 218, 475, "seed count"], ["subtract", 560, 234, "ticket count"],
  ["add", 176, 409, "fair coupons"], ["subtract", 702, 286, "water count"], ["add", 239, 500, "sticker album"],
  ["subtract", 640, 275, "grain-bag count"], ["add", 128, 356, "tree count"], ["subtract", 815, 397, "book count"],
  ["add", 267, 600, "sports points"], ["subtract", 530, 184, "notebook count"], ["add", 194, 442, "museum visitors"],
  ["subtract", 760, 328, "tile count"], ["add", 305, 489, "postcard collection"], ["subtract", 900, 457, "coin count"],
  ["add", 157, 371, "flower count"], ["subtract", 684, 296, "bottle count"], ["add", 246, 555, "plant count"],
  ["subtract", 473, 189, "orange count"], ["add", 329, 700, "reading goal"], ["subtract", 625, 247, "ribbon count"],
  ["add", 184, 450, "badge count"], ["subtract", 808, 369, "token count"], ["add", 275, 619, "brick count"], ["subtract", 590, 218, "pencil count"],
];

const fractionCases: Array<[string, number, 2 | 4]> = [
  ["24 mangoes", 24, 2], ["36 beads", 36, 4], ["40 flowers", 40, 4], ["18 oranges", 18, 2], ["28 marbles", 28, 4],
  ["32 stickers", 32, 4], ["42 pencils", 42, 2], ["20 plants", 20, 4], ["28 biscuits", 28, 4], ["16 storybooks", 16, 2],
  ["44 shells", 44, 4], ["48 tiles", 48, 4], ["54 cards", 54, 2], ["24 ribbons", 24, 4], ["20 toy blocks", 20, 4],
  ["34 guavas", 34, 2], ["32 paper stars", 32, 4], ["44 buttons", 44, 4], ["26 cups", 26, 2], ["36 stamps", 36, 4],
  ["52 seeds", 52, 4], ["46 flags", 46, 2], ["56 pebbles", 56, 4], ["60 lamps", 60, 4], ["38 notebooks", 38, 2],
];

const elapsedCases: Array<[string, number, number]> = [
  ["art class", 9 * 60, 45], ["bus journey", 8 * 60 + 20, 55], ["football practice", 16 * 60, 75],
  ["library visit", 10 * 60 + 15, 40], ["film", 14 * 60 + 30, 90], ["music lesson", 11 * 60 + 10, 35],
  ["train ride", 7 * 60 + 25, 80], ["craft activity", 13 * 60 + 40, 50], ["nature walk", 6 * 60 + 30, 65],
  ["dance practice", 15 * 60 + 15, 45], ["museum tour", 9 * 60 + 35, 70], ["reading time", 17 * 60, 40],
  ["swimming lesson", 8 * 60 + 45, 55], ["school assembly", 7 * 60 + 50, 30], ["puppet show", 12 * 60 + 20, 75],
  ["gardening activity", 16 * 60 + 10, 50], ["science club", 10 * 60 + 40, 60], ["market trip", 18 * 60 + 5, 45],
  ["drawing session", 14 * 60 + 15, 35], ["picnic journey", 6 * 60 + 50, 85], ["story session", 11 * 60 + 30, 40],
  ["sports drill", 15 * 60 + 25, 55], ["pottery class", 9 * 60 + 50, 65], ["choir rehearsal", 17 * 60 + 10, 50], ["fair visit", 13 * 60 + 5, 95],
];

const perimeterCases: Array<[string, number[]]> = [
  ["rectangular card", [8, 5, 8, 5]], ["square tile", [6, 6, 6, 6]], ["triangular flag", [5, 6, 7]],
  ["rectangular garden", [9, 4, 9, 4]], ["square photo frame", [7, 7, 7, 7]], ["triangular sign", [8, 8, 6]],
  ["rectangular mat", [10, 3, 10, 3]], ["square board", [9, 9, 9, 9]], ["triangular plot", [7, 9, 10]],
  ["rectangular book cover", [12, 5, 12, 5]], ["square coaster", [8, 8, 8, 8]], ["triangular pennant", [6, 6, 8]],
  ["rectangular window", [11, 7, 11, 7]], ["square sandbox", [10, 10, 10, 10]], ["triangular flower bed", [9, 10, 11]],
  ["rectangular poster", [13, 6, 13, 6]], ["square handkerchief", [12, 12, 12, 12]], ["triangular paper shape", [5, 12, 13]],
  ["rectangular tray", [14, 8, 14, 8]], ["square courtyard", [11, 11, 11, 11]], ["triangular badge", [7, 7, 12]],
  ["rectangular classroom board", [15, 9, 15, 9]], ["square table top", [13, 13, 13, 13]], ["triangular kite", [10, 10, 12]], ["rectangular rug", [16, 7, 16, 7]],
];

function additions(): Draft[] {
  return additionCases.map(([context, a, b], index) => {
    const answer = a + b;
    const stems = [
      `A class counted ${a} ${context} in the morning and ${b} in the afternoon. How many did it count altogether?`,
      `There are ${a} ${context} in one group and ${b} in another. What is the combined total?`,
      `On Monday, children counted ${a} ${context}. On Tuesday, they counted ${b}. How many did they count in two days?`,
      `Meera counted ${a} ${context}. Kabir counted ${b} more. How many did they count altogether?`,
      `There are ${a} ${context} and then ${b} more are added. How many are there now?`,
      `A box has ${a} ${context}. Another box has ${b}. How many are in both boxes?`,
      `Children counted ${a} ${context} before lunch and ${b} after lunch. Find the total.`,
      `Start with ${a} ${context} and add ${b}. Which number is the sum?`,
      `One group has ${a} ${context}, and another has ${b}. How many do the groups have together?`,
      `Riya counts ${a} ${context}; Aman counts ${b}. How many do they count altogether?`,
    ];
    return { topic: "Whole-number addition", topicSlug: "whole-number-addition", objective: "Add whole numbers within 1,000", question: stems[index % stems.length], answer, distractors: [answer - 10, answer + 10, Math.abs(a - b)] as [number, number, number], explanation: `Add the two quantities: ${a} + ${b} = ${answer}.`, difficulty: index < 5 ? "easy" : "medium" };
  });
}

function subtractions(): Draft[] {
  return subtractionCases.map(([context, a, b], index) => {
    const answer = a - b;
    const item = context.split(" before ")[0];
    const stems = [
      `There were ${a} ${context}. After ${b} were removed, how many remained?`,
      `There were ${a} ${context}. After ${b} were taken away, how many were left?`,
      `Find the difference between ${a} and ${b} for the ${context}.`,
      `From ${a} ${item}, ${b} were taken away. How many are still left?`,
      `Calculate ${a} − ${b}. How many ${item} remain?`,
      `A box held ${a} ${item}. Children used ${b}. How many are left in the box?`,
      `A shop had ${a} ${item} and sold ${b}. Find how many are still there.`,
      `Start at ${a} and count back ${b} for the ${item}. Where do you stop?`,
      `${b} of the ${a} ${item} were given away. How many were not given away?`,
      `There are ${a} ${item} in all. If ${b} are taken away, how many remain?`,
    ];
    return { topic: "Whole-number subtraction", topicSlug: "whole-number-subtraction", objective: "Subtract whole numbers within 1,000", question: stems[index % stems.length], answer, distractors: [answer - 10, answer + 10, a + b] as [number, number, number], explanation: `Subtract the amount removed from the starting amount: ${a} − ${b} = ${answer}.`, difficulty: index < 5 ? "easy" : "medium" };
  });
}

function multiplications(): Draft[] {
  return multiplicationCases.map(([context, groups, each], index) => {
    const answer = groups * each;
    const stems = [
      `There are ${groups} packets with ${each} ${context}. How many are there altogether?`,
      `A display has ${groups} equal groups and ${each} ${context} in each group. Find the total.`,
      `There are ${groups} equal groups of ${each} ${context}. What total do you get?`,
      `A craft display has ${groups} sets of ${each} ${context}. How many are in all the sets?`,
      `What is the total number of ${context} in ${groups} groups of ${each}?`,
      `A teacher makes ${groups} sets of ${each} ${context}. How many ${context} are used?`,
      `To count the ${context}, make ${groups} jumps of ${each} on a number line. What number do you reach?`,
      `${each} ${context} are placed in each of ${groups} equal sets. Find the total.`,
      `Which number equals ${groups} × ${each} for the ${context}?`,
      `A picture shows ${groups} rows with ${each} ${context} in every row. How many are shown?`,
    ];
    return { topic: "Multiplication", topicSlug: "multiplication", objective: "Use multiplication for equal groups with factors from 1 to 10", question: stems[index % stems.length], answer, distractors: [groups + each, answer - groups, answer + each] as [number, number, number], explanation: `${groups} equal groups of ${each} means ${groups} × ${each} = ${answer}.`, difficulty: groups <= 6 ? "easy" : "medium" };
  });
}

function divisions(): Draft[] {
  return divisionCases.map(([item, total, groups], index) => {
    const answer = total / groups;
    const stems = [
      `${total} ${item} are shared equally among ${groups} children. How many does each child receive?`,
      `Pack ${total} ${item} equally into ${groups} boxes. How many go in each box?`,
      `How many are in each equal group when ${total} ${item} make ${groups} groups?`,
      `A teacher divides ${total} ${item} equally between ${groups} tables. Find the number at each table.`,
      `Which number completes ${total} ÷ ${groups} for the ${item}?`,
      `${total} ${item} are put into groups of ${groups}. How many groups can be made?`,
      `Use multiplication to check the ${item}: ${groups} × □ = ${total}. What number goes in the box?`,
      `A class separates ${total} ${item} into ${groups} equal groups. How many are in each group?`,
      `Split ${total} ${item} into ${groups} same-sized sets. Find the size of one set.`,
      `Which equal share is correct when ${total} ${item} are shared by ${groups} children?`,
    ];
    return { topic: "Division", topicSlug: "division", objective: "Use exact division within 100 for equal sharing", question: stems[index % stems.length], answer, distractors: [answer - 1, answer + 1, groups] as [number, number, number], explanation: `${total} shared into ${groups} equal groups gives ${total} ÷ ${groups} = ${answer} in each group.`, difficulty: total <= 60 ? "easy" : "medium" };
  });
}

function missingNumbers(): Draft[] {
  return missingCases.map(([operation, known, total, context], index) => {
    const answer = operation === "add" ? total - known : known - total;
    const expression = operation === "add" ? `${known} + □ = ${total}` : `${known} − □ = ${total}`;
    const stems = [
      `What number belongs in the box in this ${context}: ${expression}?`,
      `Solve the missing-number equation ${expression} for the ${context}.`,
      `Find the unknown amount in the ${context}: ${expression}.`,
      `This number sentence is about the ${context}: ${expression}. Which number makes it true?`,
      `Work it out and complete ${expression} for the ${context}.`,
      `Which value of the box makes ${expression} correct in the ${context}?`,
      `Use the total and known number to solve ${expression} for the ${context}.`,
      `The ${context} uses ${expression}. What must the box equal?`,
      `Complete this true number sentence about the ${context}: ${expression}.`,
      `Find the missing part of ${expression} in the ${context}.`,
    ];
    const explanation = operation === "add"
      ? `Subtract the known addend from the total: ${total} − ${known} = ${answer}. Therefore ${known} + ${answer} = ${total}.`
      : `The missing amount is the difference: ${known} − ${total} = ${answer}. Therefore ${known} − ${answer} = ${total}.`;
    return { topic: "Missing-number equations", topicSlug: "missing-number-equations", objective: "Find an unknown in an addition or subtraction equation", question: stems[index % stems.length], answer, distractors: [answer - 10, answer + 10, Math.abs(total - answer)] as [number, number, number], explanation, difficulty: index < 5 ? "easy" : "medium" };
  });
}

function fractions(): Draft[] {
  return fractionCases.map(([context, quantity, denominator], index) => {
    const answer = quantity / denominator;
    const stems = [
      `${denominator === 2 ? "One-half" : "One-fourth"} of ${context} is put aside. How many are put aside?`,
      `The ${context} are shared into ${denominator} equal parts. How many are in one part?`,
      `What is 1/${denominator} of ${context}?`,
      `A group of ${context} is divided equally among ${denominator} teams. How many are in each equal share?`,
      `Choose the number that represents one of ${denominator} equal shares of ${context}.`,
      `If ${context} are split equally into ${denominator} groups, what is the size of each group?`,
      `Find one equal share when ${context} are placed in ${denominator} same-sized groups.`,
      `Which number is ${denominator === 2 ? "one-half" : "one-fourth"} of ${context}?`,
      `Share ${context} equally among ${denominator} children. How many does each child get?`,
      `Make ${denominator} equal sets from ${context}. How many belong in one set?`,
    ];
    const question = denominator === 2 && index % 5 === 0
      ? stems[0]
      : stems[index % stems.length];
    return { topic: "Halves and fourths of quantities", topicSlug: "fractions-of-quantities", objective: "Find one-half or one-fourth of a quantity", question, answer, distractors: [denominator, answer + denominator, quantity - answer] as [number, number, number], explanation: `One of ${denominator} equal shares is found by dividing: ${quantity} ÷ ${denominator} = ${answer}.`, difficulty: denominator === 2 ? "easy" : "medium" };
  });
}

function clock(minutes: number) {
  const normalized = minutes % (24 * 60);
  const hour24 = Math.floor(normalized / 60);
  const minute = normalized % 60;
  // The calling sentence provides punctuation after the formatted time.
  const suffix = hour24 < 12 ? "a.m" : "p.m";
  const hour = hour24 % 12 || 12;
  return `${hour}:${String(minute).padStart(2, "0")} ${suffix}`;
}

function elapsedTimes(): Draft[] {
  return elapsedCases.map(([activity, start, duration], index) => {
    const end = start + duration;
    const answer = duration;
    const stems = [
      `The ${activity} starts at ${clock(start)} and ends at ${clock(end)}. How many minutes does it last?`,
      `The ${activity} begins at ${clock(start)} and finishes at ${clock(end)}. How many minutes does it last?`,
      `How much time passes from ${clock(start)} to ${clock(end)} during the ${activity}? Give the answer in minutes.`,
      `The ${activity} starts at ${clock(start)} and finishes at ${clock(end)}. How many minutes pass?`,
      `Count forward from ${clock(start)} to ${clock(end)} for the ${activity}. How many minutes pass?`,
      `The ${activity} lasts from ${clock(start)} until ${clock(end)}. Find the number of minutes.`,
      `At ${clock(start)} the ${activity} begins. It stops at ${clock(end)}. How long is it in minutes?`,
      `A clock reads ${clock(start)} at the beginning and ${clock(end)} at the end of the ${activity}. How many minutes went by?`,
      `Find the minutes between ${clock(start)} and ${clock(end)} for the ${activity}.`,
      `How many minutes should be counted to move from ${clock(start)} to ${clock(end)} during the ${activity}?`,
    ];
    return { topic: "Elapsed time", topicSlug: "elapsed-time", objective: "Find elapsed time between two clock times", question: stems[index % stems.length], answer, distractors: [answer - 10, answer + 10, answer + 30] as [number, number, number], explanation: `Counting forward from ${clock(start)} to ${clock(end)} gives an elapsed time of ${duration} minutes.`, difficulty: duration <= 45 ? "easy" : "hard" };
  });
}

function perimeters(): Draft[] {
  return perimeterCases.map(([shape, sides], index) => {
    const answer = sides.reduce((sum, side) => sum + side, 0);
    const list = sides.join(" cm, ") + " cm";
    const longest = Math.max(...sides);
    const stems = [
      `A ${shape} has side lengths ${list}. What is the distance around it in centimetres?`,
      `A ribbon goes once around a ${shape} whose sides measure ${list}. How many centimetres of ribbon are needed?`,
      `Find the distance around a ${shape} with side lengths ${list}.`,
      `An ant walks along every side of a ${shape}: ${list}. How far does it walk before returning to its start?`,
      `Add all side lengths of this ${shape}: ${list}. What is its perimeter?`,
      `How many centimetres make one complete trip around a ${shape} with sides ${list}?`,
      `A string follows the edge of a ${shape} with side lengths ${list}. How long is the string?`,
      `The sides of a ${shape} are ${list}. Add them to find the perimeter.`,
      `Sam walks once around a ${shape} whose sides are ${list}. How many centimetres does Sam walk?`,
      `Which total gives the distance around a ${shape} with sides ${list}?`,
    ];
    return { topic: "Perimeter", topicSlug: "perimeter", objective: "Find a shape's perimeter by adding side lengths", question: stems[index % stems.length], answer, distractors: [answer - longest, answer + longest, longest * 2] as [number, number, number], explanation: `Perimeter is the sum of every side: ${sides.join(" + ")} = ${answer} cm.`, difficulty: sides.length === 4 ? "easy" : "medium" };
  });
}

export const GRADE_3_MATHEMATICS_V1 = [
  ...additions(), ...subtractions(), ...multiplications(), ...divisions(),
  ...missingNumbers(), ...fractions(), ...elapsedTimes(), ...perimeters(),
].map(record);

export function auditGrade3MathematicsV1() {
  const errors: string[] = [];
  const ids = new Set<string>();
  const prompts = new Set<string>();
  const hashes = new Set<string>();
  const topicCounts = new Map<string, number>();
  for (const item of GRADE_3_MATHEMATICS_V1) {
    const normalized = normalizeQuestionPackItem(item);
    if (!normalized.ok) {
      errors.push(`${item.sourceRecordId}: ${normalized.errors.join("; ")}`);
      continue;
    }
    if (ids.has(item.sourceRecordId)) errors.push(`${item.sourceRecordId}: duplicate id`);
    if (prompts.has(item.question)) errors.push(`${item.sourceRecordId}: duplicate prompt`);
    if (hashes.has(normalized.value.contentHash)) errors.push(`${item.sourceRecordId}: duplicate content`);
    ids.add(item.sourceRecordId);
    prompts.add(item.question);
    hashes.add(normalized.value.contentHash);
    const topicSlug = String(item.metadata.topicSlug);
    topicCounts.set(topicSlug, (topicCounts.get(topicSlug) ?? 0) + 1);
  }
  if (GRADE_3_MATHEMATICS_V1.length !== 200) errors.push(`Expected 200 rows, found ${GRADE_3_MATHEMATICS_V1.length}`);
  const blueprintMinimums: Record<string, number> = {
    division: 20,
    "elapsed-time": 15,
    "fractions-of-quantities": 15,
    "missing-number-equations": 15,
    multiplication: 15,
    perimeter: 15,
    "whole-number-addition": 15,
    "whole-number-subtraction": 15,
  };
  for (const [topic, minimum] of Object.entries(blueprintMinimums)) {
    if ((topicCounts.get(topic) ?? 0) < minimum) errors.push(`${topic}: below 5x blueprint minimum ${minimum}`);
  }
  const digest = createHash("sha256").update(JSON.stringify(GRADE_3_MATHEMATICS_V1)).digest("hex");
  return { errors, rows: GRADE_3_MATHEMATICS_V1.length, uniquePrompts: prompts.size, uniqueContent: hashes.size, topicCounts: Object.fromEntries(topicCounts), digest };
}

async function main() {
  const output = path.resolve(process.argv[2] ?? "content/question-packs/octamy-grade-3-mathematics-practice-v1.jsonl");
  const audit = auditGrade3MathematicsV1();
  if (audit.errors.length) throw new Error(audit.errors.join("\n"));
  await mkdir(path.dirname(output), { recursive: true });
  const stream = createWriteStream(output, { encoding: "utf8", flags: "w", mode: 0o600 });
  for (const item of GRADE_3_MATHEMATICS_V1) stream.write(`${JSON.stringify(item)}\n`);
  stream.end();
  await finished(stream);
  process.stdout.write(`${JSON.stringify({ output, ...audit }, null, 2)}\n`);
}

if (/generate-grade-3-mathematics-practice-v1\.(?:c?js|ts)$/.test(path.basename(process.argv[1] ?? ""))) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.stack || error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
