import OpenAI from "openai";

export interface AiSwotEvaluationResult {
  score: number; // 0-1 scale with 1 decimal place
  improvementSuggestions: string;
  swotAnalysis: {
    strengths: {
      description: string;
      score: number; // 0-1 scale
    };
    weaknesses: {
      description: string;
      score: number; // 0-1 scale
    };
    opportunities: {
      description: string;
      score: number; // 0-1 scale
    };
    threats: {
      description: string;
      score: number; // 0-1 scale
    };
  };
}

export class OpenAIService {
  private openai: OpenAI | null;

  constructor() {
    this.openai = process.env.OPEN_API_KEY
      ? new OpenAI({ apiKey: process.env.OPEN_API_KEY })
      : null;
  }

  /**
   * Evaluate a single Q&A pair with detailed SWOT analysis
   */
  async evaluateQuestionAnswer(
    question: string,
    answer: string,
    evaluationCriteria: string[]
  ): Promise<AiSwotEvaluationResult> {
    if (!this.openai) {
      throw new Error("OpenAI API key not configured");
    }

    const evaluationPrompt = `Evaluate this question and answer pair based on the criteria below.

QUESTION: ${question}

ANSWER: ${answer}

EVALUATION CRITERIA:
${evaluationCriteria.map((c, i) => `${i + 1}. ${c}`).join("\n")}

Respond with ONLY this JSON structure:
{
  "score": 0.0-1.0, // 1 decimal place
  "improvementSuggestions": "concise text",
  "swotAnalysis": {
    "strengths": {"description": "text", "score": 0.0-1.0},
    "weaknesses": {"description": "text", "score": 0.0-1.0},
    "opportunities": {"description": "text", "score": 0.0-1.0},
    "threats": {"description": "text", "score": 0.0-1.0}
  }
}`;

    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content:
              "You are an evaluator that provides strict JSON output for Q&A assessments.",
          },
          { role: "user", content: evaluationPrompt },
        ],
        temperature: 0.3,
        max_tokens: 500,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) throw new Error("No evaluation content received");

      const result = JSON.parse(content);

      // Validate and normalize response
      return {
        score: this.clampScore(result.score),
        improvementSuggestions:
          result.improvementSuggestions || "No suggestions provided",
        swotAnalysis: {
          strengths: this.validateSwotItem(
            result.swotAnalysis?.strengths,
            "strengths"
          ),
          weaknesses: this.validateSwotItem(
            result.swotAnalysis?.weaknesses,
            "weaknesses"
          ),
          opportunities: this.validateSwotItem(
            result.swotAnalysis?.opportunities,
            "opportunities"
          ),
          threats: this.validateSwotItem(
            result.swotAnalysis?.threats,
            "threats"
          ),
        },
      };
    } catch (error) {
      console.error("Evaluation error:", error);
      throw new Error(
        `Evaluation failed: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  private clampScore(score: unknown): number {
    const num = typeof score === "number" ? score : parseFloat(score) || 0;
    return Math.max(0, Math.min(1, Number(num.toFixed(1))));
  }

  private validateSwotItem(
    item: any,
    type: string
  ): { description: string; score: number } {
    return {
      description: item?.description || `No ${type} identified`,
      score: this.clampScore(item?.score ?? 0),
    };
  }
}

export const openaiService = new OpenAIService();
