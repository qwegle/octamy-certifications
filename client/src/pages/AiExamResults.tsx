import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Brain, CheckCircle, XCircle, Clock, Award } from "lucide-react";

interface AiExamResult {
  examResult: {
    examAttempt: any;
    courseTitle: string;
    courseType: string;
    isPreferred: boolean;
  };
  conversations: Array<{
    questionId: number;
    question: string;
    scenario: string;
    scoreAwarded: number;
    maxScore: number;
    evaluation: string;
    keywordsFound: string[];
    conversationHistory: any[];
  }>;
  isRecruitmentReady: boolean;
}

export default function AiExamResults() {
  const { examAttemptId } = useParams();

  const { data: results, isLoading } = useQuery<AiExamResult>({
    queryKey: [`/api/ai-exam/results/${examAttemptId}`],
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <Brain className="w-16 h-16 text-purple-400 mx-auto mb-4 animate-pulse" />
          <p className="text-white text-lg">Loading your AI assessment results...</p>
        </div>
      </div>
    );
  }

  if (!results) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <XCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <p className="text-white text-lg">Results not found</p>
        </div>
      </div>
    );
  }

  const { examResult, conversations, isRecruitmentReady } = results;
  const totalScore = conversations.reduce((sum, conv) => sum + conv.scoreAwarded, 0);
  const maxPossibleScore = conversations.reduce((sum, conv) => sum + conv.maxScore, 0);
  const percentage = maxPossibleScore > 0 ? Math.round((totalScore / maxPossibleScore) * 100) : 0;

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="border-b border-gray-800 p-4">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Brain className="w-6 h-6 text-purple-400" />
            AI Assessment Results
          </h1>
          <p className="text-gray-400">{examResult.courseTitle}</p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-6">
        {/* Overall Results */}
        <Card className="bg-gray-900 border-gray-800 mb-6">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              {percentage >= 70 ? (
                <CheckCircle className="w-6 h-6 text-green-400" />
              ) : (
                <XCircle className="w-6 h-6 text-red-400" />
              )}
              Assessment Complete
            </CardTitle>
            <CardDescription>
              {examResult.isPreferred && (
                <Badge className="bg-yellow-600 mb-2">
                  <Award className="w-3 h-3 mr-1" />
                  Preferred by Recruiters
                </Badge>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-purple-400 mb-2">
                  {percentage}%
                </div>
                <p className="text-gray-400">Overall Score</p>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-400 mb-2">
                  {totalScore}/{maxPossibleScore}
                </div>
                <p className="text-gray-400">Points Earned</p>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-green-400 mb-2">
                  {conversations.length}
                </div>
                <p className="text-gray-400">Questions Completed</p>
              </div>
            </div>

            <Progress value={percentage} className="mb-4" />

            {isRecruitmentReady && (
              <div className="bg-green-900/30 border border-green-700 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="w-5 h-5 text-green-400" />
                  <span className="font-semibold text-green-400">Recruitment Ready</span>
                </div>
                <p className="text-green-300 text-sm">
                  Your performance in this preferred course makes you visible to recruiters looking for candidates with your skills.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Question-by-Question Results */}
        <div className="space-y-6">
          <h2 className="text-xl font-bold text-white">Detailed Question Analysis</h2>
          
          {conversations.map((conversation, index) => (
            <Card key={conversation.questionId} className="bg-gray-900 border-gray-800">
              <CardHeader>
                <CardTitle className="text-white flex items-center justify-between">
                  <span>Question {index + 1}</span>
                  <Badge className={conversation.scoreAwarded >= conversation.maxScore * 0.7 ? 'bg-green-600' : 'bg-red-600'}>
                    {conversation.scoreAwarded}/{conversation.maxScore} points
                  </Badge>
                </CardTitle>
                <CardDescription className="text-gray-300">
                  {conversation.question}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <h4 className="font-semibold text-white mb-2">Scenario:</h4>
                    <p className="text-gray-300 text-sm bg-gray-800 p-3 rounded">
                      {conversation.scenario}
                    </p>
                  </div>

                  <div>
                    <h4 className="font-semibold text-white mb-2">AI Evaluation:</h4>
                    <p className="text-gray-300 text-sm bg-gray-800 p-3 rounded">
                      {conversation.evaluation}
                    </p>
                  </div>

                  {conversation.keywordsFound && conversation.keywordsFound.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-white mb-2">Keywords Identified:</h4>
                      <div className="flex flex-wrap gap-2">
                        {conversation.keywordsFound.map((keyword, idx) => (
                          <Badge key={idx} variant="outline" className="border-green-600 text-green-400">
                            {keyword}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="bg-gray-800 rounded-lg p-4">
                    <h4 className="font-semibold text-white mb-3">Conversation Summary:</h4>
                    <div className="text-sm text-gray-400">
                      <div className="flex items-center gap-2 mb-2">
                        <Clock className="w-4 h-4" />
                        <span>{conversation.conversationHistory.length} conversation turns</span>
                      </div>
                      <p>
                        This was an interactive technical discussion where you explained your approach 
                        and the AI interviewer evaluated your technical knowledge and problem-solving skills.
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Next Steps */}
        <Card className="bg-gray-900 border-gray-800 mt-8">
          <CardHeader>
            <CardTitle className="text-white">What's Next?</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {percentage >= 70 ? (
                <>
                  <div className="flex items-center gap-2 text-green-400">
                    <CheckCircle className="w-5 h-5" />
                    <span className="font-semibold">Congratulations! You passed the assessment.</span>
                  </div>
                  {isRecruitmentReady && (
                    <p className="text-gray-300">
                      Your profile is now visible to recruiters. Companies looking for candidates with your 
                      demonstrated skills may reach out to you for interview opportunities.
                    </p>
                  )}
                  <p className="text-gray-300">
                    Consider taking additional AI interactive courses to further showcase your expertise 
                    and increase your visibility to potential employers.
                  </p>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-2 text-red-400">
                    <XCircle className="w-5 h-5" />
                    <span className="font-semibold">Assessment not passed this time.</span>
                  </div>
                  <p className="text-gray-300">
                    Review the detailed feedback above to understand areas for improvement. 
                    You can retake the assessment after studying the recommended topics.
                  </p>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}