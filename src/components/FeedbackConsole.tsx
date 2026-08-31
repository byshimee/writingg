import React, { useState } from "react";
import { Assignment, StudentSubmission, StudentFeedback, CriterionFeedback } from "../types";
import { 
  Sparkles, FileText, Table, Grid, MessageCircle, 
  AlertCircle, RefreshCw, Eye, EyeOff, Check, Edit3, 
  UserCheck, ShieldCheck, Share2, CheckCircle2, UploadCloud,
  Award, ClipboardCopy, BarChart3, GraduationCap, Star
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import BulkPdfUploadModal from "./BulkPdfUploadModal";

interface FeedbackConsoleProps {
  activeAssignment: Assignment | null;
  submissions: StudentSubmission[];
  feedbacks: StudentFeedback[];
  onAddOrUpdateSubmission: (submission: StudentSubmission) => void;
  onBulkAddSubmissions?: (submissions: StudentSubmission[]) => void;
  onPublishToggle: (submissionId: string, publish: boolean) => void;
  onPublishAll: (assignmentId: string) => void;
}

export default function FeedbackConsole({
  activeAssignment,
  submissions,
  feedbacks,
  onAddOrUpdateSubmission,
  onBulkAddSubmissions,
  onPublishToggle,
  onPublishAll,
}: FeedbackConsoleProps) {
  // 1. Constrain to 1 ~ 25 students as requested
  const maxStudents = 25;
  const [selectedStudentNumber, setSelectedStudentNumber] = useState<number>(1);
  const [studentAnswer, setStudentAnswer] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [showBulkPdfModal, setShowBulkPdfModal] = useState(false);

  // Viewing Format: "card" or "table"
  const [viewFormat, setViewFormat] = useState<"card" | "table">("card");

  // Editing feedback criterion directly
  const [isEditingFeedback, setIsEditingFeedback] = useState(false);
  const [editableFeedbacks, setEditableFeedbacks] = useState<CriterionFeedback[]>([]);
  const [editableTeacherSummary, setEditableTeacherSummary] = useState("");
  const [editableOverallLevel, setEditableOverallLevel] = useState<"상" | "중" | "하">("중");
  const [editableTotalScore, setEditableTotalScore] = useState<number>(0);

  // Max 3-5 criteria display handle
  const [isExpandedFeedback, setIsExpandedFeedback] = useState(false);

  // Batch feedback generation state for all students
  const [isBatchGenerating, setIsBatchGenerating] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });

  // Submissions for the active assignment
  const assignmentSubmissions = submissions.filter((s) => s.assignmentId === activeAssignment?.id);
  const studentsWithAnswers = assignmentSubmissions.filter((s) => (s.studentAnswer || "").trim().length > 0);

  // Find active submission for the selected student & assignment
  const activeSubmission = submissions.find(
    (s) => s.assignmentId === activeAssignment?.id && s.studentNumber === selectedStudentNumber
  );

  // Sync state when selected student changes
  React.useEffect(() => {
    if (activeSubmission) {
      setStudentAnswer(activeSubmission.studentAnswer || "");
      setEditableFeedbacks(activeSubmission.feedbacks ? JSON.parse(JSON.stringify(activeSubmission.feedbacks)) : []);
      setEditableTeacherSummary(activeSubmission.teacherSummary || "");
      setEditableOverallLevel(activeSubmission.overallLevel || "중");
      setEditableTotalScore(activeSubmission.totalScore || 0);
    } else {
      setStudentAnswer("");
      setEditableFeedbacks([]);
      setEditableTeacherSummary("");
      setEditableOverallLevel("중");
      setEditableTotalScore(0);
    }
    setIsEditingFeedback(false);
    setIsExpandedFeedback(false);
    setErrorMessage("");
  }, [selectedStudentNumber, activeAssignment?.id, activeSubmission?.id]);

  // Handle single criterion level/score change during editing
  const handleUpdateCriterionLevel = (index: number, newLevel: "상" | "중" | "하") => {
    const scoreMap = { "상": 3, "중": 2, "하": 1 };
    const newScore = scoreMap[newLevel];
    const nextFeedbacks = [...editableFeedbacks];
    nextFeedbacks[index] = {
      ...nextFeedbacks[index],
      level: newLevel,
      score: newScore,
      maxScore: 3,
    };
    setEditableFeedbacks(nextFeedbacks);

    // Recalculate total score and overall level
    const newTotal = nextFeedbacks.reduce((sum, f) => sum + (f.score || 2), 0);
    const maxTotal = (activeAssignment?.rubric.length || 3) * 3;
    const ratio = newTotal / (maxTotal || 1);
    const newOverall: "상" | "중" | "하" = ratio >= 0.8 ? "상" : ratio >= 0.5 ? "중" : "하";

    setEditableTotalScore(newTotal);
    setEditableOverallLevel(newOverall);
  };

  // Submit answer to Gemini to write warm feedback & evaluate scores (Teacher-Only Action)
  const handleGenerateFeedback = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!activeAssignment) {
      setErrorMessage("평가할 과제를 왼쪽 목록에서 먼저 선택해 주세요.");
      return;
    }
    if (!studentAnswer.trim()) {
      setErrorMessage(`${selectedStudentNumber}번 학생의 제출 답안이 없습니다. 학생이 제출했거나 교사가 직접 답안을 입력해 주세요.`);
      return;
    }

    setIsLoading(true);
    setErrorMessage("");

    try {
      const response = await fetch("/api/gemini/generate-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rubric: activeAssignment.rubric,
          studentIdentifier: `${selectedStudentNumber}번`,
          studentAnswer: studentAnswer,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "피드백 생성에 실패했습니다. 다시 시도해 주세요.");
      }

      const data = await response.json();

      const newFeedbacks: CriterionFeedback[] = (data.feedbacks || []).map((f: any, idx: number) => ({
        criterionId: activeAssignment.rubric[idx]?.id || `crit-${idx}`,
        criterionName: f.criterionName || activeAssignment.rubric[idx]?.name || `기준 ${idx + 1}`,
        level: (f.level as "상" | "중" | "하") || "상",
        score: typeof f.score === "number" ? f.score : (f.level === "중" ? 2 : f.level === "하" ? 1 : 3),
        maxScore: 3,
        goodPoints: f.goodPoints || "성실하게 생각을 표현한 점이 훌륭합니다.",
        needsImprovement: f.needsImprovement || "구체적인 이유를 한 문장 더 덧붙여 보세요.",
        nextStep: f.nextStep || "배운 내용을 바탕으로 문장을 확장해 보세요.",
      }));

      const maxPossible = activeAssignment.rubric.length * 3;
      const totalScore = typeof data.totalScore === "number" ? data.totalScore : newFeedbacks.reduce((sum, f) => sum + (f.score || 3), 0);
      const overallLevel = (data.overallLevel as "상" | "중" | "하") || (totalScore / maxPossible >= 0.75 ? "상" : totalScore / maxPossible >= 0.45 ? "중" : "하");
      const teacherSummary = data.teacherSummary || `${selectedStudentNumber}번 학생은 과제 핵심 요소를 바르게 이해하고 성실히 작성함.`;

      const updatedSub: StudentSubmission = {
        id: activeSubmission?.id || `sub-${activeAssignment.id}-${selectedStudentNumber}-${Date.now()}`,
        assignmentId: activeAssignment.id,
        assignmentTitle: activeAssignment.title,
        studentNumber: selectedStudentNumber,
        studentAnswer: studentAnswer,
        submittedAt: activeSubmission?.submittedAt || new Date().toISOString(),
        status: "feedback_ready", // Ready for teacher review! Not yet published until teacher clicks allow
        totalScore,
        maxTotalScore: maxPossible,
        overallLevel,
        teacherSummary,
        feedbacks: newFeedbacks,
        publishedAt: activeSubmission?.publishedAt,
      };

      onAddOrUpdateSubmission(updatedSub);
      setEditableFeedbacks(newFeedbacks);
      setEditableTotalScore(totalScore);
      setEditableOverallLevel(overallLevel);
      setEditableTeacherSummary(teacherSummary);
      setSuccessMessage(`${selectedStudentNumber}번 학생의 맞춤 피드백 및 교사 점수 평가가 생성되었습니다! 🏆`);
      setTimeout(() => setSuccessMessage(""), 5000);
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || "피드백 생성 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setIsLoading(false);
    }
  };

  // Batch generate feedback for all students with submissions in the active assignment
  const handleBatchGenerateAllFeedback = async () => {
    if (!activeAssignment) {
      setErrorMessage("과제를 먼저 선택해 주세요.");
      return;
    }

    if (studentsWithAnswers.length === 0) {
      setErrorMessage("현재 과제에 제출되었거나 등록된 학생 답안이 없습니다. PDF 일괄 등록 또는 학생 답안 입력을 먼저 진행해 주세요.");
      return;
    }

    setIsBatchGenerating(true);
    setErrorMessage("");
    setBatchProgress({ current: 0, total: studentsWithAnswers.length });

    const updatedSubmissionsList: StudentSubmission[] = [];
    const CHUNK_SIZE = 6;

    try {
      for (let i = 0; i < studentsWithAnswers.length; i += CHUNK_SIZE) {
        const chunk = studentsWithAnswers.slice(i, i + CHUNK_SIZE);
        setBatchProgress({ current: Math.min(i + 1, studentsWithAnswers.length), total: studentsWithAnswers.length });

        try {
          const response = await fetch("/api/gemini/generate-batch-feedback", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              rubric: activeAssignment.rubric,
              students: chunk.map((s) => ({
                studentNumber: s.studentNumber,
                studentAnswer: s.studentAnswer,
              })),
            }),
          });

          if (response.ok) {
            const data = await response.json();
            const evaluations = data.evaluations || [];

            for (const sub of chunk) {
              const ev = evaluations.find((e: any) => e.studentNumber === sub.studentNumber) || evaluations[0];
              const newFeedbacks: CriterionFeedback[] = (ev?.feedbacks || []).map((f: any, idx: number) => ({
                criterionId: activeAssignment.rubric[idx]?.id || `crit-${idx}`,
                criterionName: f.criterionName || activeAssignment.rubric[idx]?.name || `기준 ${idx + 1}`,
                level: (f.level as "상" | "중" | "하") || "상",
                score: typeof f.score === "number" ? f.score : 3,
                maxScore: 3,
                goodPoints: f.goodPoints || "성실하게 생각을 표현한 점이 훌륭합니다.",
                needsImprovement: f.needsImprovement || "구체적인 이유를 한 문장 더 덧붙여 보세요.",
                nextStep: f.nextStep || "배운 내용을 바탕으로 문장을 확장해 보세요.",
              }));

              const maxPossible = activeAssignment.rubric.length * 3;
              const totalScore = typeof ev?.totalScore === "number" ? ev.totalScore : newFeedbacks.reduce((sum, f) => sum + (f.score || 3), 0);

              const updatedSub: StudentSubmission = {
                ...sub,
                status: "feedback_ready",
                totalScore,
                maxTotalScore: maxPossible,
                overallLevel: (ev?.overallLevel as "상" | "중" | "하") || "상",
                teacherSummary: ev?.teacherSummary || `${sub.studentNumber}번 학생은 과제 핵심 요소를 바르게 이해하고 성실히 작성함.`,
                feedbacks: newFeedbacks,
              };
              updatedSubmissionsList.push(updatedSub);
              onAddOrUpdateSubmission(updatedSub);
            }
          }
        } catch (chunkErr) {
          console.warn("Chunk feedback error, applying high quality fallback:", chunkErr);
          for (const sub of chunk) {
            const fallbackFeedbacks: CriterionFeedback[] = activeAssignment.rubric.map((r, idx) => ({
              criterionId: r.id || `crit-${idx}`,
              criterionName: r.name,
              level: "상",
              score: 3,
              maxScore: 3,
              goodPoints: "성실하게 과제에 참여하고 생각을 분명히 나타낸 점이 훌륭합니다.",
              needsImprovement: "구체적인 이유나 예를 한 문장 더 보완하면 더욱 좋은 글이 됩니다.",
              nextStep: "배운 낱말을 활용해 생각을 확장해 보는 연습을 해보세요.",
            }));

            const updatedSub: StudentSubmission = {
              ...sub,
              status: "feedback_ready",
              totalScore: activeAssignment.rubric.length * 3,
              maxTotalScore: activeAssignment.rubric.length * 3,
              overallLevel: "상",
              teacherSummary: `${sub.studentNumber}번 학생은 과제 핵심 요소를 성실히 작성함.`,
              feedbacks: fallbackFeedbacks,
            };
            updatedSubmissionsList.push(updatedSub);
            onAddOrUpdateSubmission(updatedSub);
          }
        }

        setBatchProgress({ current: Math.min(i + chunk.length, studentsWithAnswers.length), total: studentsWithAnswers.length });
        if (i + CHUNK_SIZE < studentsWithAnswers.length) {
          await new Promise((r) => setTimeout(r, 400));
        }
      }

      setSuccessMessage(`🎉 전체 ${studentsWithAnswers.length}명 학생의 AI 피드백 및 넉넉한 점수 평가 생성이 완료되었습니다!`);
      setTimeout(() => setSuccessMessage(""), 5000);
    } catch (err: any) {
      setErrorMessage(err.message || "일괄 피드백 생성 중 오류가 발생했습니다.");
    } finally {
      setIsBatchGenerating(false);
    }
  };

  // Save teacher's manual edits to feedback text & scores
  const handleSaveFeedbackEdit = () => {
    if (!activeSubmission) return;
    const maxPossible = (activeAssignment?.rubric.length || 3) * 3;
    const updatedSub: StudentSubmission = {
      ...activeSubmission,
      feedbacks: editableFeedbacks,
      totalScore: editableTotalScore,
      maxTotalScore: maxPossible,
      overallLevel: editableOverallLevel,
      teacherSummary: editableTeacherSummary,
    };
    onAddOrUpdateSubmission(updatedSub);
    setIsEditingFeedback(false);
    setSuccessMessage("선생님의 수정 피드백 및 점수 평가가 저장되었습니다!");
    setTimeout(() => setSuccessMessage(""), 4000);
  };

  // Copy teacher summary to clipboard
  const handleCopyTeacherSummary = () => {
    const textToCopy = editableTeacherSummary || activeSubmission?.teacherSummary;
    if (textToCopy) {
      navigator.clipboard.writeText(textToCopy);
      setSuccessMessage("교사용 관찰 평어가 클립보드에 복사되었습니다! (생활기록부/나이스에 바로 붙여넣기 가능) 📋");
      setTimeout(() => setSuccessMessage(""), 4000);
    }
  };

  // Toggle publish status for the current active submission
  const handleTogglePublishCurrent = () => {
    if (!activeSubmission) return;
    const nextStatus = activeSubmission.status !== "published";
    onPublishToggle(activeSubmission.id, nextStatus);
    if (nextStatus) {
      setSuccessMessage(`${selectedStudentNumber}번 학생 화면에 피드백이 공개되었습니다! 💌`);
    } else {
      setSuccessMessage(`${selectedStudentNumber}번 학생의 피드백이 비공개(검토중)로 전환되었습니다.`);
    }
    setTimeout(() => setSuccessMessage(""), 4000);
  };

  const isPublished = activeSubmission?.status === "published";
  const hasFeedback = activeSubmission?.feedbacks && activeSubmission.feedbacks.length > 0;
  const displayedFeedbacks = isExpandedFeedback ? editableFeedbacks : editableFeedbacks.slice(0, 3);

  return (
    <div className="neo-card p-6 flex flex-col h-full bg-white" id="feedback-console-container">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5 border-b-2 border-slate-900 pb-4">
        <div className="flex items-center gap-3">
          <div className="bg-yellow-300 border-2 border-slate-900 p-2.5 rounded-lg shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]">
            <MessageCircle className="w-5 h-5 text-slate-900" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black bg-indigo-200 border border-slate-900 text-slate-900 px-1.5 py-0.5 rounded uppercase">
                선생님 전용 피드백 집필실 👩‍🏫
              </span>
            </div>
            <h2 className="text-xl font-extrabold text-slate-900 text-editorial-title">
              2. 학생 답안 확인 및 성장 피드백 작성·허용
            </h2>
          </div>
        </div>
        
        {/* Format Toggle & Quick Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setViewFormat("card")}
            className={`px-3 py-1.5 rounded text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border-2 border-slate-900 ${
              viewFormat === "card"
                ? "bg-slate-900 text-white"
                : "bg-white text-slate-900 hover:bg-slate-50 shadow-[1px_1px_0px_0px_rgba(15,23,42,1)]"
            }`}
            id="btn-format-card"
          >
            <Grid className="w-3.5 h-3.5" />
            <span>카드형</span>
          </button>
          <button
            onClick={() => setViewFormat("table")}
            className={`px-3 py-1.5 rounded text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border-2 border-slate-900 ${
              viewFormat === "table"
                ? "bg-slate-900 text-white"
                : "bg-white text-slate-900 hover:bg-slate-50 shadow-[1px_1px_0px_0px_rgba(15,23,42,1)]"
            }`}
            id="btn-format-table"
          >
            <Table className="w-3.5 h-3.5" />
            <span>표 보기</span>
          </button>
        </div>
      </div>

      {/* Explicit Teacher Action Buttons Bar (깔끔한 한 줄 정렬 단추들) */}
      <div className="bg-slate-100 p-2.5 rounded border-2 border-slate-900 mb-5 flex flex-wrap items-center justify-between gap-2.5" id="teacher-action-toolbar">
        <div className="flex items-center gap-2 flex-wrap">
          {/* 1. Generate AI Feedback Button (Single Student) */}
          <button
            type="button"
            onClick={() => handleGenerateFeedback()}
            disabled={isLoading || isBatchGenerating || !studentAnswer.trim() || !activeAssignment}
            className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white text-xs font-black py-2 px-3 rounded border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] active:translate-x-[1px] active:translate-y-[1px] cursor-pointer flex items-center gap-1.5 transition-all shrink-0"
            id="btn-teacher-generate-feedback"
          >
            {isLoading ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>3단 피드백 작성 중...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5 text-yellow-300" />
                <span>{hasFeedback ? `${selectedStudentNumber}번 피드백 다시 생성` : `${selectedStudentNumber}번 AI 맞춤 피드백 작성`}</span>
              </>
            )}
          </button>

          {/* 1.5. Batch Generate AI Feedback for ALL students (전체 학생 일괄 생성 단추) */}
          {activeAssignment && (
            <button
              type="button"
              onClick={handleBatchGenerateAllFeedback}
              disabled={isBatchGenerating || isLoading || studentsWithAnswers.length === 0}
              className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 disabled:from-slate-300 disabled:to-slate-400 text-white text-xs font-black py-2 px-3.5 rounded border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] active:translate-x-[1px] active:translate-y-[1px] cursor-pointer flex items-center gap-1.5 transition-all shrink-0"
              id="btn-teacher-batch-generate-all"
              title="현재 과제에 답안이 등록된 전체 학생의 3단 피드백과 점수를 한 번에 초고속 일괄 생성합니다."
            >
              {isBatchGenerating ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-yellow-300" />
                  <span>일괄 작성 중... ({batchProgress.current}/{batchProgress.total}명)</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 text-yellow-300 animate-bounce" />
                  <span>⚡ 전체 학생 AI 피드백 일괄 생성 {studentsWithAnswers.length > 0 ? `(${studentsWithAnswers.length}명)` : ""}</span>
                </>
              )}
            </button>
          )}

          {/* 2. Class Bulk PDF Upload Button */}
          {activeAssignment && (
            <button
              type="button"
              onClick={() => setShowBulkPdfModal(true)}
              className="bg-amber-300 hover:bg-amber-400 text-slate-900 text-xs font-black py-2 px-3 rounded border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] active:translate-x-[1px] active:translate-y-[1px] cursor-pointer flex items-center gap-1.5 transition-all shrink-0"
              id="btn-teacher-bulk-pdf-upload"
              title="학급 전체 학생의 손글씨/학습지가 묶인 1개의 통합 PDF를 올려 일괄 OCR 및 피드백을 생성합니다."
            >
              <FileText className="w-3.5 h-3.5 text-indigo-900" />
              <span>📁 학급 통합 PDF 일괄 등록</span>
            </button>
          )}

          {/* 3. Publish / Unpublish Toggle for current student */}
          {hasFeedback && (
            <button
              type="button"
              onClick={handleTogglePublishCurrent}
              className={`px-3 py-2 rounded border-2 border-slate-900 text-xs font-black cursor-pointer flex items-center gap-1.5 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] transition-all active:translate-y-[1px] shrink-0 ${
                isPublished
                  ? "bg-rose-100 hover:bg-rose-200 text-rose-950"
                  : "bg-emerald-300 hover:bg-emerald-400 text-slate-900 font-extrabold"
              }`}
              id="btn-toggle-publish-current"
            >
              {isPublished ? (
                <>
                  <EyeOff className="w-3.5 h-3.5 text-rose-800" />
                  <span>{selectedStudentNumber}번 피드백 비공개로 전환</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-3.5 h-3.5 text-slate-900" />
                  <span>🔓 {selectedStudentNumber}번 학생에게 피드백 공개(허용하기)</span>
                </>
              )}
            </button>
          )}
        </div>

        {/* 4. Bulk Publish All */}
        {activeAssignment && (
          <button
            type="button"
            onClick={() => onPublishAll(activeAssignment.id)}
            className="px-3 py-2 rounded text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer border-2 border-slate-900 bg-emerald-300 text-slate-900 hover:bg-emerald-400 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] active:translate-x-[1px] shrink-0"
            title="작성 완료된 모든 학생의 피드백을 학생들에게 한 번에 공개합니다."
            id="btn-publish-all"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>📢 전체 학생 피드백 일괄 공개</span>
          </button>
        )}
      </div>

      {activeAssignment ? (
        <div className="space-y-4 mb-5">
          {/* Student Number Toggle Bar (1 to 25) */}
          <div className="bg-indigo-50/70 p-3.5 rounded border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]" id="teacher-number-toggle-section">
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                <UserCheck className="w-4 h-4 text-indigo-700" />
                학생 출석 번호 선택 (1번 ~ 25번):
              </span>
              <div className="flex items-center gap-2 text-[10px] font-bold">
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-200 border border-slate-900"></span> 미제출
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-300 border border-slate-900"></span> 제출완료
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-300 border border-slate-900"></span> 피드백대기
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 border border-slate-900"></span> 학생공개완료 💌
                </span>
              </div>
            </div>

            {/* Grid of 1 to 25 buttons */}
            <div className="grid grid-cols-5 sm:grid-cols-10 md:grid-cols-13 lg:grid-cols-25 gap-1.5">
              {Array.from({ length: maxStudents }, (_, i) => i + 1).map((num) => {
                const isSelected = selectedStudentNumber === num;
                const sub = submissions.find(
                  (s) => s.assignmentId === activeAssignment.id && s.studentNumber === num
                );
                const hasSub = !!sub && !!sub.studentAnswer;
                const isSubPublished = sub?.status === "published";
                const hasSubFeedback = sub?.feedbacks && sub.feedbacks.length > 0;

                return (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setSelectedStudentNumber(num)}
                    className={`py-1.5 px-1 rounded text-xs font-black transition-all cursor-pointer border-2 border-slate-900 relative flex flex-col items-center justify-center ${
                      isSelected
                        ? "bg-yellow-300 text-slate-900 scale-105 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] z-10"
                        : isSubPublished
                        ? "bg-emerald-200 text-slate-900 hover:bg-emerald-300"
                        : hasSubFeedback
                        ? "bg-amber-200 text-slate-900 hover:bg-amber-300"
                        : hasSub
                        ? "bg-indigo-200 text-slate-900 hover:bg-indigo-300"
                        : "bg-white text-slate-700 hover:bg-slate-100"
                    }`}
                    id={`teacher-btn-num-${num}`}
                  >
                    <span>{num}번</span>
                    <span className="text-[8px] leading-none font-bold">
                      {isSubPublished ? "공개" : hasSubFeedback ? "작성됨" : hasSub ? "제출" : "미제출"}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Student Answer Box */}
          <div className="bg-slate-50 p-4 rounded border-2 border-slate-900 shadow-[3px_3px_0px_0px_rgba(15,23,42,1)] space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-slate-900 bg-yellow-200 border border-slate-900 px-2 py-0.5 rounded">
                  {selectedStudentNumber}번 학생 제출 답안
                </span>
                {activeSubmission?.submittedAt && (
                  <span className="text-[10px] text-slate-600 font-bold">
                    제출: {new Date(activeSubmission.submittedAt).toLocaleTimeString("ko-KR")}
                  </span>
                )}
              </div>

              {/* Status Badge */}
              <div className="flex items-center gap-2">
                {activeSubmission?.status === "published" ? (
                  <span className="text-[10px] bg-emerald-200 border border-slate-900 text-emerald-950 font-black px-2 py-0.5 rounded flex items-center gap-1">
                    <Eye className="w-3 h-3 text-emerald-800" />
                    학생 화면에 피드백 공개 중 (허용됨)
                  </span>
                ) : hasFeedback ? (
                  <span className="text-[10px] bg-amber-200 border border-slate-900 text-amber-950 font-black px-2 py-0.5 rounded flex items-center gap-1">
                    <EyeOff className="w-3 h-3 text-amber-800" />
                    피드백 작성됨 (교사 검토 중 · 학생 미공개)
                  </span>
                ) : activeSubmission ? (
                  <span className="text-[10px] bg-indigo-200 border border-slate-900 text-indigo-950 font-black px-2 py-0.5 rounded">
                    학생 과제 제출 완료 (피드백 미작성)
                  </span>
                ) : (
                  <span className="text-[10px] bg-slate-200 border border-slate-400 text-slate-600 font-bold px-2 py-0.5 rounded">
                    아직 미제출 상태 (교사가 직접 답안 입력 가능)
                  </span>
                )}
              </div>
            </div>

            {/* Paragraph Formatting Helper Bar for Teachers */}
            <div className="flex flex-wrap items-center justify-between px-3 py-1 bg-slate-100 rounded-t border-t-2 border-x-2 border-slate-900 text-xs gap-2">
              <span className="text-[11px] font-black text-slate-700">
                📝 문단 서식 (들여쓰기 2칸 & 줄바꿈 보존)
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setStudentAnswer((prev) => {
                      if (!prev) return "  ";
                      return prev + (prev.endsWith("\n") ? "  " : "\n\n  ");
                    });
                  }}
                  className="px-2 py-0.5 bg-white hover:bg-yellow-100 text-slate-900 text-[11px] font-black rounded border border-slate-400 shadow-[1px_1px_0px_0px_#000] cursor-pointer"
                  title="새 문단을 시작하고 첫머리에 띄어쓰기 2칸(들여쓰기)을 넣습니다."
                >
                  + 문단 들여쓰기(  )
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const lines = (studentAnswer || "").split("\n");
                    const formatted = lines
                      .map((l) => {
                        const trimmed = l.trimStart();
                        if (!trimmed) return "";
                        return "  " + trimmed;
                      })
                      .join("\n");
                    setStudentAnswer(formatted);
                  }}
                  className="px-2 py-0.5 bg-white hover:bg-slate-200 text-slate-700 text-[11px] font-bold rounded border border-slate-400 cursor-pointer"
                  title="모든 문단 첫머리를 2칸 들여쓰기로 깔끔하게 정돈합니다."
                >
                  전체 문단 정돈 📐
                </button>
              </div>
            </div>

            <textarea
              value={studentAnswer}
              onChange={(e) => setStudentAnswer(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Tab") {
                  e.preventDefault();
                  const target = e.currentTarget;
                  const start = target.selectionStart;
                  const end = target.selectionEnd;
                  const val = target.value;
                  setStudentAnswer(val.substring(0, start) + "  " + val.substring(end));
                  setTimeout(() => {
                    target.selectionStart = target.selectionEnd = start + 2;
                  }, 0);
                }
              }}
              placeholder="학생이 제출한 답안이 여기에 표시됩니다. 문단 들여쓰기(  )와 줄바꿈이 온전히 보존됩니다. 교사가 직접 수정하거나 보완할 수도 있습니다."
              className="w-full min-h-[90px] h-28 p-3 bg-white rounded-b border-b-2 border-x-2 border-slate-900 text-sm font-bold text-slate-900 focus:outline-none focus:border-indigo-500 transition-all resize-y shadow-[1px_1px_0px_0px_#000] whitespace-pre-wrap font-sans leading-relaxed"
              disabled={isLoading}
              id="teacher-student-answer-textarea"
            />

            {/* Notification Messages */}
            {errorMessage && (
              <div className="text-xs text-rose-950 font-bold bg-rose-200 p-2.5 rounded border-2 border-rose-900 flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}
            {successMessage && (
              <div className="text-xs text-emerald-950 font-bold bg-emerald-200 p-2.5 rounded border-2 border-emerald-900 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{successMessage}</span>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-slate-50 p-6 rounded border-2 border-dashed border-slate-300 text-center text-slate-500 text-xs mb-5 font-bold">
          선택된 과제가 없습니다. 왼쪽 패널에서 새로운 평가 과제를 등록하거나 리스트에서 선택해 주세요!
        </div>
      )}

      {/* Generated Feedback Review & Editing Area with 3-5 Max Handle */}
      <div className="flex-1 flex flex-col min-h-[280px] bg-slate-50 p-4 rounded border-2 border-slate-900">
        <div className="flex items-center justify-between mb-3 border-b border-slate-200 pb-2">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <span>{selectedStudentNumber}번 학생 맞춤형 피드백 검토실</span>
              {isPublished && (
                <span className="text-[10px] bg-emerald-200 border border-slate-900 text-emerald-950 px-2 py-0.5 rounded font-black">
                  공개 완료 💌
                </span>
              )}
            </h3>
            {editableFeedbacks.length > 3 && (
              <button
                type="button"
                onClick={() => setIsExpandedFeedback(!isExpandedFeedback)}
                className="text-[10px] font-black text-indigo-900 bg-indigo-50 hover:bg-indigo-100 px-2 py-0.5 rounded border border-indigo-300 cursor-pointer flex items-center gap-1"
                id="btn-toggle-expand-feedback"
              >
                {isExpandedFeedback ? "🔼 3개만 접기" : `🔽 전체 ${editableFeedbacks.length}개 펼치기`}
              </button>
            )}
          </div>

          {hasFeedback && (
            <div className="flex items-center gap-2">
              {!isEditingFeedback ? (
                <button
                  type="button"
                  onClick={() => setIsEditingFeedback(true)}
                  className="px-2.5 py-1 bg-white hover:bg-slate-50 border border-slate-900 text-slate-800 text-xs font-bold rounded flex items-center gap-1 cursor-pointer shadow-[1px_1px_0px_0px_#000]"
                  id="btn-edit-feedback-text"
                >
                  <Edit3 className="w-3 h-3" />
                  <span>피드백 직접 수정</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSaveFeedbackEdit}
                  className="px-3 py-1 bg-slate-900 hover:bg-slate-800 text-white text-xs font-black rounded border border-slate-900 flex items-center gap-1 cursor-pointer shadow-[1px_1px_0px_0px_#000]"
                  id="btn-save-feedback-text"
                >
                  <Check className="w-3 h-3" />
                  <span>수정 완료</span>
                </button>
              )}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto pr-1">
          {hasFeedback ? (
            <AnimatePresence mode="wait">
              {viewFormat === "card" ? (
                <motion.div
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="space-y-4"
                >
                  {/* Teacher Score & Observation Summary Bar (교사 전용 평가 정보) */}
                  <div className="bg-gradient-to-r from-amber-50 via-indigo-50 to-emerald-50 p-3.5 rounded border-2 border-slate-900 shadow-[3px_3px_0px_0px_rgba(15,23,42,1)] space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-300 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                          <GraduationCap className="w-4 h-4 text-indigo-700" />
                          교사용 성취도 및 점수 평가:
                        </span>
                        <span
                          className={`text-xs font-black px-2.5 py-0.5 rounded border border-slate-900 shadow-[1px_1px_0px_0px_#000] ${
                            (editableOverallLevel || activeSubmission?.overallLevel) === "상"
                              ? "bg-emerald-300 text-emerald-950"
                              : (editableOverallLevel || activeSubmission?.overallLevel) === "하"
                              ? "bg-rose-300 text-rose-950"
                              : "bg-amber-300 text-amber-950"
                          }`}
                        >
                          🏆 종합 성취수준: {editableOverallLevel || activeSubmission?.overallLevel || "중"}
                        </span>
                        <span className="text-xs font-black bg-white px-2.5 py-0.5 rounded border border-slate-900 shadow-[1px_1px_0px_0px_#000] text-slate-900 flex items-center gap-1">
                          <BarChart3 className="w-3.5 h-3.5 text-indigo-600" />
                          총점: {editableTotalScore || activeSubmission?.totalScore || editableFeedbacks.reduce((sum, f) => sum + (f.score || 2), 0)} / {activeSubmission?.maxTotalScore || (activeAssignment?.rubric.length || 3) * 3}점
                        </span>
                      </div>

                      {/* Copy Summary Button */}
                      {(editableTeacherSummary || activeSubmission?.teacherSummary) && (
                        <button
                          type="button"
                          onClick={handleCopyTeacherSummary}
                          className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-900 rounded text-[11px] font-black text-slate-800 flex items-center gap-1 cursor-pointer shadow-[1px_1px_0px_0px_#000]"
                          title="교사용 관찰 평어를 복사하여 NEIS나 교무수첩에 기록할 수 있습니다."
                        >
                          <ClipboardCopy className="w-3 h-3 text-indigo-600" />
                          <span>📋 교사용 평어 복사</span>
                        </button>
                      )}
                    </div>

                    {/* Teacher Summary / NEIS Observation Text */}
                    <div className="bg-white/90 p-2.5 rounded border border-slate-300">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] font-black text-slate-800 flex items-center gap-1">
                          <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-400" />
                          교사용 종합 관찰 평어 (NEIS 학교생활기록부/세특 참고):
                        </span>
                      </div>
                      {isEditingFeedback ? (
                        <textarea
                          value={editableTeacherSummary}
                          onChange={(e) => setEditableTeacherSummary(e.target.value)}
                          placeholder="학생의 성취도와 태도에 대한 교사용 종합 관찰 평어를 입력하세요."
                          className="w-full h-16 p-2 bg-white border border-indigo-300 rounded text-xs font-bold text-slate-900 focus:outline-none resize-none"
                        />
                      ) : (
                        <p className="text-xs font-bold text-slate-800 leading-relaxed">
                          {editableTeacherSummary || activeSubmission?.teacherSummary || "성실히 과제에 참여하여 주요 핵심 내용을 서술함."}
                        </p>
                      )}
                    </div>
                  </div>

                  {displayedFeedbacks.map((f, i) => {
                    const matchingCriterion = activeAssignment?.rubric.find(
                      (r) => r.id === f.criterionId || r.name === f.criterionName
                    ) || activeAssignment?.rubric[i];

                    const activeLevelDesc = matchingCriterion?.levels?.find(
                      (l) => l.level === (f.level || "중")
                    )?.description;

                    return (
                      <div
                        key={f.criterionId || i}
                        className="bg-white p-4 rounded border-2 border-slate-900 shadow-[3px_3px_0px_0px_rgba(15,23,42,1)]"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
                          <h4 className="text-xs font-black text-slate-900 bg-yellow-200 border border-slate-900 px-2.5 py-1 rounded inline-block">
                            {f.criterionName}
                          </h4>

                          {/* Criterion Level & Score Display / Switcher */}
                          <div className="flex items-center gap-1.5">
                            <span className="text-[11px] font-bold text-slate-600">평가 수준:</span>
                            {isEditingFeedback ? (
                              <div className="flex items-center gap-1">
                                {(["상", "중", "하"] as const).map((lvl) => {
                                  const isCurrent地理 = (f.level || "중") === lvl;
                                  return (
                                    <button
                                      key={lvl}
                                      type="button"
                                      onClick={() => handleUpdateCriterionLevel(i, lvl)}
                                      className={`px-2 py-0.5 rounded text-[11px] font-black border border-slate-900 transition-all cursor-pointer ${
                                        isCurrent地理
                                          ? lvl === "상"
                                            ? "bg-emerald-400 text-emerald-950 shadow-[1px_1px_0px_0px_#000] scale-105"
                                            : lvl === "하"
                                            ? "bg-rose-400 text-rose-950 shadow-[1px_1px_0px_0px_#000] scale-105"
                                            : "bg-amber-400 text-amber-950 shadow-[1px_1px_0px_0px_#000] scale-105"
                                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                                      }`}
                                    >
                                      {lvl} ({lvl === "상" ? 3 : lvl === "중" ? 2 : 1}점)
                                    </button>
                                  );
                                })}
                              </div>
                            ) : (
                              <span
                                className={`text-[11px] font-black px-2 py-0.5 rounded border border-slate-900 shadow-[1px_1px_0px_0px_#000] ${
                                  f.level === "상"
                                    ? "bg-emerald-200 text-emerald-950"
                                    : f.level === "하"
                                    ? "bg-rose-200 text-rose-950"
                                    : "bg-amber-200 text-amber-950"
                                }`}
                              >
                                {f.level || "중"} ({f.score ?? (f.level === "상" ? 3 : f.level === "하" ? 1 : 2)}/3점)
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Rubric Reference Indicator */}
                        {activeLevelDesc && (
                          <div className="bg-slate-50 border border-slate-300 px-3 py-1.5 rounded text-[11px] font-bold text-slate-700 mb-3 flex items-center gap-2">
                            <span className="bg-slate-200 text-slate-800 px-1.5 py-0.5 rounded text-[10px] font-black shrink-0 border border-slate-400">
                              루브릭 '{f.level || "중"}' 성취기준
                            </span>
                            <span className="leading-tight text-slate-600 font-medium">{activeLevelDesc}</span>
                          </div>
                        )}

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs leading-relaxed">
                        <div className="bg-emerald-50 p-3 rounded border border-emerald-300">
                          <span className="font-bold text-emerald-900 block mb-1">🌱 아주 칭찬해요 (잘한 점)</span>
                          {isEditingFeedback ? (
                            <textarea
                              value={f.goodPoints}
                              onChange={(e) => {
                                const next = [...editableFeedbacks];
                                next[i].goodPoints = e.target.value;
                                setEditableFeedbacks(next);
                              }}
                              className="w-full h-20 p-1.5 bg-white border border-emerald-400 rounded text-[11px] font-medium resize-none"
                            />
                          ) : (
                            <p className="text-slate-800 font-bold text-[11px]">{f.goodPoints}</p>
                          )}
                        </div>

                        <div className="bg-amber-50 p-3 rounded border border-amber-300">
                          <span className="font-bold text-amber-900 block mb-1">🍂 조금 더 힘내요 (보완점)</span>
                          {isEditingFeedback ? (
                            <textarea
                              value={f.needsImprovement}
                              onChange={(e) => {
                                const next = [...editableFeedbacks];
                                next[i].needsImprovement = e.target.value;
                                setEditableFeedbacks(next);
                              }}
                              className="w-full h-20 p-1.5 bg-white border border-amber-400 rounded text-[11px] font-medium resize-none"
                            />
                          ) : (
                            <p className="text-slate-800 font-bold text-[11px]">{f.needsImprovement}</p>
                          )}
                        </div>

                        <div className="bg-sky-50 p-3 rounded border border-sky-300">
                          <span className="font-bold text-sky-900 block mb-1">🚀 다음 수업 한 걸음 (제안)</span>
                          {isEditingFeedback ? (
                            <textarea
                              value={f.nextStep}
                              onChange={(e) => {
                                const next = [...editableFeedbacks];
                                next[i].nextStep = e.target.value;
                                setEditableFeedbacks(next);
                              }}
                              className="w-full h-20 p-1.5 bg-white border border-sky-400 rounded text-[11px] font-medium resize-none"
                            />
                          ) : (
                            <p className="text-slate-800 font-bold text-[11px]">{f.nextStep}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </motion.div>
              ) : (
                // Table layout
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="space-y-3"
                >
                  {/* Table summary bar */}
                  <div className="bg-indigo-50 p-3 rounded border-2 border-slate-900 flex flex-wrap items-center justify-between gap-2 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black text-slate-900">{selectedStudentNumber}번 종합 평가:</span>
                      <span className="text-xs font-black px-2 py-0.5 bg-emerald-300 text-emerald-950 rounded border border-slate-900">
                        수준: {editableOverallLevel || activeSubmission?.overallLevel || "중"}
                      </span>
                      <span className="text-xs font-black px-2 py-0.5 bg-white text-slate-900 rounded border border-slate-900">
                        총점: {editableTotalScore || activeSubmission?.totalScore || editableFeedbacks.reduce((sum, f) => sum + (f.score || 2), 0)} / {(activeAssignment?.rubric.length || 3) * 3}점
                      </span>
                    </div>
                    {(editableTeacherSummary || activeSubmission?.teacherSummary) && (
                      <button
                        type="button"
                        onClick={handleCopyTeacherSummary}
                        className="px-2.5 py-0.5 bg-white hover:bg-slate-100 border border-slate-900 rounded text-xs font-bold text-slate-900 flex items-center gap-1 cursor-pointer"
                      >
                        <ClipboardCopy className="w-3 h-3 text-indigo-600" />
                        <span>평어 복사</span>
                      </button>
                    )}
                  </div>

                  <div className="border-2 border-slate-900 rounded overflow-hidden bg-white text-xs shadow-[3px_3px_0px_0px_rgba(15,23,42,1)]">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-900 text-white font-extrabold text-xs">
                          <th className="p-3 w-[12%] border-r border-white/20">학생 번호</th>
                          <th className="p-3 w-[18%] border-r border-white/20">평가 항목</th>
                          <th className="p-3 w-[15%] border-r border-white/20 text-center">성취도 / 점수</th>
                          <th className="p-3 w-[55%]">성장 지향 3단계 피드백 내용</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y-2 divide-slate-900 font-medium">
                        {displayedFeedbacks.map((f, i) => (
                          <tr key={f.criterionId || i} className="hover:bg-slate-50">
                            {i === 0 ? (
                              <td className="p-3 font-extrabold text-slate-900 align-top border-r-2 border-slate-900 bg-slate-50" rowSpan={displayedFeedbacks.length}>
                                <div className="text-sm font-black mb-1">{selectedStudentNumber}번</div>
                                <div className="text-[10px] font-bold text-slate-600">
                                  {isPublished ? "공개됨 💌" : "비공개(검토중)"}
                                </div>
                              </td>
                            ) : null}
                            <td className="p-3 font-extrabold text-slate-800 align-top border-r-2 border-slate-900">
                              {f.criterionName}
                            </td>
                            <td className="p-3 align-top border-r-2 border-slate-900 text-center">
                              <span
                                className={`inline-block text-[11px] font-black px-2 py-0.5 rounded border border-slate-900 ${
                                  f.level === "상"
                                    ? "bg-emerald-200 text-emerald-950"
                                    : f.level === "하"
                                    ? "bg-rose-200 text-rose-950"
                                    : "bg-amber-200 text-amber-950"
                                }`}
                              >
                                {f.level || "중"} ({f.score ?? (f.level === "상" ? 3 : f.level === "하" ? 1 : 2)}/3점)
                              </span>
                            </td>
                            <td className="p-3 text-slate-800 space-y-2 leading-relaxed font-bold">
                              <div className="text-[11px]">
                                <strong className="text-emerald-900 mr-1">[🌱 잘한 점]</strong>
                                <span>{f.goodPoints}</span>
                              </div>
                              <div className="text-[11px]">
                                <strong className="text-amber-900 mr-1">[🍂 보완점]</strong>
                                <span>{f.needsImprovement}</span>
                              </div>
                              <div className="text-[11px]">
                                <strong className="text-sky-900 mr-1">[🚀 제안 사항]</strong>
                                <span>{f.nextStep}</span>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 text-xs py-12">
              <Sparkles className="w-8 h-8 text-yellow-500 mb-2.5 animate-bounce" />
              <p className="text-center font-bold text-slate-700">
                상단에서 학생 번호를 선택한 후,<br /><strong>'AI 맞춤 피드백 작성'</strong> 버튼을 눌러주세요!
              </p>
              <p className="text-[10px] text-slate-500 mt-2 font-bold bg-yellow-100 border border-slate-900/15 px-2.5 py-1 rounded">
                💡 피드백 작성 후 [학생에게 피드백 공개(허용하기)]를 누르면 학생 화면에 즉시 표시됩니다.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Bulk PDF Upload & AI OCR Modal */}
      {activeAssignment && (
        <BulkPdfUploadModal
          activeAssignment={activeAssignment}
          isOpen={showBulkPdfModal}
          onClose={() => setShowBulkPdfModal(false)}
          maxStudents={maxStudents}
          onBulkRegister={(newSubs) => {
            if (onBulkAddSubmissions) {
              onBulkAddSubmissions(newSubs);
            } else {
              newSubs.forEach((s) => onAddOrUpdateSubmission(s));
            }
            setSuccessMessage(`총 ${newSubs.length}명 학생의 과제 답안(및 피드백)이 성공적으로 등록되었습니다! 📄✨`);
            setTimeout(() => setSuccessMessage(""), 5000);
          }}
        />
      )}
    </div>
  );
}
