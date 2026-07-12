export type AbilityDimension =
  | 'roleUnderstanding'
  | 'productAnalysis'
  | 'aiProductThinking'
  | 'dataMetrics'
  | 'projectStorytelling'
  | 'structuredCommunication';

export type InterviewSource = 'builtInMock' | 'externalImport';

export type AbilityScore = {
  dimension: AbilityDimension;
  label: string;
  score: number;
  evidence: string;
  attribution: string;
  suggestion: string;
};

export type Experience = {
  id: string;
  title: string;
  context: string;
  task: string;
  action: string;
  result: string;
  abilityTags: AbilityDimension[];
  evidenceMetrics: string[];
  applicableQuestionTypes: string[];
};

export type JobProfile = {
  responsibilities: string[];
  abilityKeywords: string[];
  hiddenRequirements: string[];
  likelyQuestions: string[];
};

export type JobFile = {
  id: string;
  company: string;
  roleTitle: string;
  direction: string;
  jdText: string;
  stage: string;
  status: string;
  profile?: JobProfile;
  interviewSessionIds: string[];
};

export type InterviewQuestion = {
  id: string;
  question: string;
  answer: string;
  followUps: string[];
  feedback: string;
};

export type InterviewSession = {
  id: string;
  jobFileId: string;
  source: InterviewSource;
  interviewType: string;
  createdAt: string;
  rawConversation: string;
  questions: InterviewQuestion[];
};

export type ReviewReport = {
  id: string;
  jobFileId: string;
  sessionId: string;
  summary: string;
  scores: AbilityScore[];
  strengths: string[];
  weaknesses: string[];
  nextActions: string[];
};

export type AnswerAsset = {
  id: string;
  questionType: string;
  originalQuestion: string;
  originalAnswer: string;
  issue: string;
  improvedAnswer: string;
  applicableRoles: string[];
  applicableQuestions: string[];
  weaknessTag: string;
  sourceJobId: string;
  sourceInterviewId: string;
  sourceReviewId: string;
  reuseScope: string;
  usedInInterview: boolean;
  usageFeedback?: AnswerAssetUsageFeedback;
  linkedExperienceId?: string;
  usageNote: string;
  confidence: 'high' | 'medium' | 'low';
};

export type AnswerAssetUsageStatus = 'unused' | 'used-effective' | 'used-needs-polish' | 'needs-rewrite';

export type AnswerAssetUsageFeedback = {
  status: AnswerAssetUsageStatus;
  usedAt?: string;
  usedForJobId?: string;
  usedForInterviewId?: string;
  interviewerFollowUp?: string;
  outcomeNote?: string;
  updatedAt: string;
};

export type TrainingTask = {
  id: string;
  jobFileId?: string;
  goal: string;
  dimension: AbilityDimension;
  practiceQuestion: string;
  referenceFramework: string;
  dueLabel: string;
  status: 'open' | 'done';
  retryResult?: string;
};
