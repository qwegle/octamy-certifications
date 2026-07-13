import { describe, expect, it } from '@jest/globals';
import { normalizeExamAnswers, scoreExam } from '../../server/utils/examScoring';

describe('exam scoring safety', () => {
  it('scores against every question in the server mapping, including unanswered questions', () => {
    const result = scoreExam({ '10': 1, '11': 2, '12': 0 }, { '10': 1, '11': 2 });
    expect(result).toEqual({ totalQuestions: 3, correctAnswers: 2, score: 67 });
  });

  it('ignores unknown question IDs instead of awarding extra marks', () => {
    const result = scoreExam({ '10': 1 }, { '10': 1, '999': 0 });
    expect(result).toEqual({ totalQuestions: 1, correctAnswers: 1, score: 100 });
  });

  it('normalizes both supported payload shapes and drops invalid selections', () => {
    expect(normalizeExamAnswers([
      { questionId: 10, selectedOption: 2 },
      { questionId: 'bad', selectedOption: 1 },
      { questionId: 11, selectedOption: -1 },
    ])).toEqual({ '10': 2 });

    expect(normalizeExamAnswers({ '20': '1', nope: 3 })).toEqual({ '20': 1 });
  });
});
