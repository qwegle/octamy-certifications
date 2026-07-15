#!/usr/bin/env node

import "dotenv/config";

import process from "node:process";
import { parseArgs } from "node:util";
import { segregateInhouseQuestionBanks } from "./segregate-inhouse-question-banks";

const { values } = parseArgs({
  options: {
    operator: { type: "string" },
    apply: { type: "boolean", default: false },
    confirm: { type: "string" },
  },
  allowPositionals: false,
});

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
if (!values.operator) throw new Error("--operator <name> is required");

const result = await segregateInhouseQuestionBanks({
  databaseUrl: process.env.DATABASE_URL,
  operator: values.operator,
  apply: values.apply,
  confirmation: values.confirm,
});
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
