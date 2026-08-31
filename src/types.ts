export interface RubricLevel {
  level: string; // e.g., "상", "중", "하"
  description: string;
}

export interface RubricCriterion {
  id: string;
  name: string; // e.g., "주제의 명확성", "근거의 타당성"
  description: string;
  levels: RubricLevel[];
}

export interface Assignment {
  id: string;
  title: string;
  description: string;
  rubric: RubricCriterion[];
  createdAt: string;
}

export interface CriterionFeedback {
  criterionId: string;
  criterionName: string;
  level?: "상" | "중" | "하";       // 교사용 성취 수준
  score?: number;                  // 교사용 기준별 점수 (예: 3점 만점 중 3점)
  maxScore?: number;               // 기준 만점 (기본 3점)
  goodPoints: string;              // 잘한 점
  needsImprovement: string;        // 보완점
  nextStep: string;                // 다음 단계 제안
}

export type SubmissionStatus = "submitted" | "feedback_ready" | "published";

export interface StudentSubmission {
  id: string;
  assignmentId: string;
  assignmentTitle: string;
  studentNumber: number;           // 번호 (1 ~ 25)
  studentAnswer: string;
  submittedAt: string;
  status: SubmissionStatus;        // "submitted": 제출됨, "feedback_ready": 피드백작성됨(미공개), "published": 학생에게 공개(허용)
  totalScore?: number;             // 교사용 종합 점수 (예: 8)
  maxTotalScore?: number;          // 만점 (예: 9)
  overallLevel?: "상" | "중" | "하"; // 교사용 종합 성취도
  teacherSummary?: string;         // 교사용 관찰 평가 평어 (나이스 세특/생활기록부 참고용)
  feedbacks?: CriterionFeedback[];
  publishedAt?: string;
}

// Legacy-compatible interface
export interface StudentFeedback {
  id: string;
  assignmentId: string;
  assignmentTitle: string;
  studentIdentifier: string;       // e.g., "1번"
  studentAnswer: string;
  feedbacks: CriterionFeedback[];
  totalScore?: number;
  maxTotalScore?: number;
  overallLevel?: "상" | "중" | "하";
  teacherSummary?: string;
  createdAt: string;
  isPublished?: boolean;           // 교사 허용 여부
}

export interface SessionTrendSummary {
  commonImprovements: string[];    // 3 items
  nextLessonSuggestions: string;   // Markdown or paragraph
  createdAt: string;
}
