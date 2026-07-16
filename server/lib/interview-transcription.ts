import fs from "node:fs";
import OpenAI from "openai";

const DEFAULT_TRANSCRIPTION_MODEL = "gpt-4o-mini-transcribe";
const TRANSCRIPTION_TIMEOUT_MS = 45_000;

function hasUsableOpenAiKey(value: string | undefined): value is string {
  const key = value?.trim();
  if (!key || key.length < 20) return false;
  return !/(placeholder|change[_-]?me|replace[_-]?me|your[_-]?openai|example|test[_-]?key)/i.test(key);
}

export function isInterviewTranscriptionEnabled(env: NodeJS.ProcessEnv = process.env) {
  return hasUsableOpenAiKey(env.OPENAI_API_KEY);
}

export function interviewTranscriptionModel(env: NodeJS.ProcessEnv = process.env) {
  return env.OPENAI_TRANSCRIPTION_MODEL?.trim() || DEFAULT_TRANSCRIPTION_MODEL;
}

export async function transcribeInterviewAudio(
  filePath: string,
  options: {
    language?: string;
    apiKey?: string;
    model?: string;
  } = {},
) {
  const apiKey = options.apiKey?.trim() || process.env.OPENAI_API_KEY?.trim();
  if (!hasUsableOpenAiKey(apiKey)) {
    throw Object.assign(new Error("Voice transcription is not configured"), {
      code: "INTERVIEW_TRANSCRIPTION_DISABLED",
      status: 503,
    });
  }

  const client = new OpenAI({
    apiKey,
    timeout: TRANSCRIPTION_TIMEOUT_MS,
    maxRetries: 1,
  });
  const response = await client.audio.transcriptions.create({
    file: fs.createReadStream(filePath),
    model: options.model?.trim() || interviewTranscriptionModel(),
    response_format: "json",
    ...(options.language?.trim() ? { language: options.language.trim().slice(0, 16) } : {}),
  });

  const text = typeof response === "string" ? response : response.text;
  const normalized = text?.trim();
  if (!normalized) {
    throw Object.assign(new Error("No speech could be transcribed from this response"), {
      code: "INTERVIEW_TRANSCRIPTION_EMPTY",
      status: 422,
    });
  }
  return {
    text: normalized.slice(0, 12_000),
    model: options.model?.trim() || interviewTranscriptionModel(),
  };
}

