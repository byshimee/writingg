/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { Assignment, StudentSubmission, StudentFeedback, SessionTrendSummary, RubricCriterion } from "./types";
import { INITIAL_ASSIGNMENTS, INITIAL_SUBMISSIONS, mapSubmissionsToFeedbacks } from "./sampleData";
import AssignmentPanel from "./components/AssignmentPanel";
import FeedbackConsole from "./components/FeedbackConsole";
import GrowthDashboard from "./components/GrowthDashboard";
import TrendsSummary from "./components/TrendsSummary";
import StudentView from "./components/StudentView";
import TeacherAuthModal from "./components/TeacherAuthModal";
import { 
  GraduationCap, Sparkles, TrendingUp, CheckCircle2, 
  Heart, MessageSquare, UserCheck, ShieldCheck, Lock, Unlock, HelpCircle, ArrowRight
} from "lucide-react";

type AppViewMode = "student" | "teacher" | "dashboard";

export default function App() {
  // LocalStorage-backed state for persistent school records
  const [assignments, setAssignments] = useState<Assignment[]>(() => {
    const saved = localStorage.getItem("seum_assignments");
    return saved ? JSON.parse(saved) : INITIAL_ASSIGNMENTS;
  });

  const [submissions, setSubmissions] = useState<StudentSubmission[]>(() => {
    const saved = localStorage.getItem("seum_submissions");
    return saved ? JSON.parse(saved) : INITIAL_SUBMISSIONS;
  });

  const [activeAssignment, setActiveAssignment] = useState<Assignment | null>(null);
  const [trendSummary, setTrendSummary] = useState<SessionTrendSummary | null>(null);
  
  // Navigation mode: "student" (student submit & feedback view), "teacher" (assignment & feedback console), "dashboard" (analytics)
  const [viewMode, setViewMode] = useState<AppViewMode>("student");
  const [appNotice, setAppNotice] = useState<string>("");

  // Teacher Authentication state: default always locked (no auto persistent storage)
  const [isTeacherAuthenticated, setIsTeacherAuthenticated] = useState<boolean>(false);
  const [showTeacherAuthModal, setShowTeacherAuthModal] = useState(false);
  const [pendingViewMode, setPendingViewMode] = useState<AppViewMode | null>(null);

  // Sync to localStorage on updates
  useEffect(() => {
    localStorage.setItem("seum_assignments", JSON.stringify(assignments));
  }, [assignments]);

  useEffect(() => {
    localStorage.setItem("seum_submissions", JSON.stringify(submissions));
  }, [submissions]);

  // Set initial active assignment
  useEffect(() => {
    if (assignments.length > 0 && !activeAssignment) {
      setActiveAssignment(assignments[0]);
    }
  }, [assignments, activeAssignment]);

  // Mode change handler: Teacher mode & Dashboard are always locked by default
  const handleRequestViewMode = (targetMode: AppViewMode) => {
    if (targetMode === "student") {
      setViewMode("student");
      // Always lock when returning to student view
      setIsTeacherAuthenticated(false);
      sessionStorage.removeItem("teacher_is_authenticated");
      return;
    }

    // If teacher mode or dashboard is requested
    if (isTeacherAuthenticated) {
      setViewMode(targetMode);
    } else {
      setPendingViewMode(targetMode);
      setShowTeacherAuthModal(true);
    }
  };

  const handleTeacherAuthSuccess = () => {
    setIsTeacherAuthenticated(true);
    setShowTeacherAuthModal(false);
    if (pendingViewMode) {
      setViewMode(pendingViewMode);
      setPendingViewMode(null);
    } else {
      setViewMode("teacher");
    }
    setAppNotice("선생님 전용 관리실에 접속하였습니다. 👩‍🏫");
    setTimeout(() => setAppNotice(""), 3500);
  };

  // Convert submissions to feedbacks for the GrowthDashboard and TrendsSummary
  const currentFeedbacks = mapSubmissionsToFeedbacks(submissions);

  // Handle Select Assignment
  const handleSelectAssignment = (assignment: Assignment) => {
    setActiveAssignment(assignment);
  };

  // Handle Add New Assignment (with its rubric)
  const handleAddAssignment = (newAssignment: Assignment) => {
    setAssignments((prev) => [newAssignment, ...prev]);
    setActiveAssignment(newAssignment);
    setAppNotice(`과제 '${newAssignment.title}' 및 루브릭이 성공적으로 등록되었습니다.`);
    setTimeout(() => setAppNotice(""), 4000);
  };

  // Handle Rubric Modification (live updates in the rubric table)
  const handleUpdateRubric = (assignmentId: string, updatedRubric: RubricCriterion[]) => {
    setAssignments((prev) =>
      prev.map((a) => (a.id === assignmentId ? { ...a, rubric: updatedRubric } : a))
    );
    if (activeAssignment && activeAssignment.id === assignmentId) {
      setActiveAssignment({ ...activeAssignment, rubric: updatedRubric });
    }
    setAppNotice("수준별 루브릭이 성공적으로 편집 및 반영되었습니다.");
    setTimeout(() => setAppNotice(""), 3000);
  };

  // Handle Delete Assignment
  const handleDeleteAssignment = (assignmentId: string) => {
    setAssignments((prev) => prev.filter((a) => a.id !== assignmentId));
    if (activeAssignment?.id === assignmentId) {
      const remaining = assignments.filter((a) => a.id !== assignmentId);
      setActiveAssignment(remaining.length > 0 ? remaining[0] : null);
    }
  };

  // Handle Student Submission (Student submits draft)
  const handleSubmitAnswer = (newSubmission: StudentSubmission) => {
    setSubmissions((prev) => {
      const existingIdx = prev.findIndex(
        (s) => s.assignmentId === newSubmission.assignmentId && s.studentNumber === newSubmission.studentNumber
      );
      if (existingIdx >= 0) {
        const next = [...prev];
        next[existingIdx] = {
          ...next[existingIdx],
          ...newSubmission,
        };
        return next;
      }
      return [newSubmission, ...prev];
    });
    setAppNotice(`${newSubmission.studentNumber}번 학생의 과제가 성공적으로 제출되었습니다! 🎉`);
    setTimeout(() => setAppNotice(""), 4000);
  };

  // Handle Teacher adding / updating feedback on a submission
  const handleAddOrUpdateSubmission = (updatedSubmission: StudentSubmission) => {
    setSubmissions((prev) => {
      const existingIdx = prev.findIndex(
        (s) => s.assignmentId === updatedSubmission.assignmentId && s.studentNumber === updatedSubmission.studentNumber
      );
      if (existingIdx >= 0) {
        const next = [...prev];
        next[existingIdx] = updatedSubmission;
        return next;
      }
      return [updatedSubmission, ...prev];
    });
  };

  // Handle Teacher bulk adding submissions from Class PDF
  const handleBulkAddSubmissions = (newSubmissions: StudentSubmission[]) => {
    setSubmissions((prev) => {
      let next = [...prev];
      for (const sub of newSubmissions) {
        const existingIdx = next.findIndex(
          (s) => s.assignmentId === sub.assignmentId && s.studentNumber === sub.studentNumber
        );
        if (existingIdx >= 0) {
          next[existingIdx] = {
            ...next[existingIdx],
            ...sub,
          };
        } else {
          next.push(sub);
        }
      }
      return next;
    });
    setAppNotice(`총 ${newSubmissions.length}명 학생의 과제 결과물이 등록되었습니다! 📄✨`);
    setTimeout(() => setAppNotice(""), 4500);
  };

  // Handle Teacher toggling publish (allow student to view feedback)
  const handlePublishToggle = (submissionId: string, publish: boolean) => {
    setSubmissions((prev) =>
      prev.map((s) => {
        if (s.id === submissionId) {
          return {
            ...s,
            status: publish ? "published" : "feedback_ready",
            publishedAt: publish ? new Date().toISOString() : undefined,
          };
        }
        return s;
      })
    );
  };

  // Handle Teacher bulk publishing all feedback for an assignment
  const handlePublishAll = (assignmentId: string) => {
    setSubmissions((prev) =>
      prev.map((s) => {
        if (s.assignmentId === assignmentId && s.feedbacks && s.feedbacks.length > 0) {
          return {
            ...s,
            status: "published",
            publishedAt: new Date().toISOString(),
          };
        }
        return s;
      })
    );
    setAppNotice("해당 과제의 모든 작성된 피드백이 학생들에게 일괄 공개되었습니다! 💌");
    setTimeout(() => setAppNotice(""), 4000);
  };

  return (
    <div className="min-h-screen bg-[#faf8f5] flex flex-col font-sans" id="app-root-container">
      {/* Top Navigation Bar */}
      <header className="bg-white border-b-4 border-slate-900 sticky top-0 z-40 shadow-xs" id="app-header">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="bg-yellow-300 text-slate-900 p-2.5 rounded border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]">
              <GraduationCap className="w-5 h-5 text-slate-900" />
            </div>
            <div>
              <span className="text-[10px] tracking-widest text-indigo-900 font-extrabold block uppercase">
                초등 3학년 맞춤형 피드백 페이지
              </span>
              <h1 className="text-base font-black text-slate-900 text-editorial-title flex items-center gap-1.5 leading-none">
                <span>삼색일냥 글쓰기 연습 페이지</span>
              </h1>
            </div>
          </div>

          {/* Mode Switcher Tabs */}
          <div className="flex items-center gap-2" id="role-mode-switcher">
            {/* 1. Student View Tab */}
            <button
              onClick={() => handleRequestViewMode("student")}
              className={`px-3.5 py-2.5 rounded text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer border-2 border-slate-900 ${
                viewMode === "student"
                  ? "bg-yellow-300 text-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]"
                  : "bg-white text-slate-700 hover:bg-slate-50 shadow-[1px_1px_0px_0px_rgba(15,23,42,1)]"
              }`}
              id="tab-btn-student"
            >
              <UserCheck className="w-4 h-4 text-slate-900" />
              <span>🧒 학생 화면 (과제 제출 & 피드백 확인)</span>
            </button>

            {/* 2. Teacher View Tab (Always locked for students) */}
            <button
              onClick={() => handleRequestViewMode("teacher")}
              className={`px-3.5 py-2.5 rounded text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer border-2 border-slate-900 ${
                viewMode === "teacher"
                  ? "bg-indigo-300 text-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]"
                  : "bg-white text-slate-700 hover:bg-slate-50 shadow-[1px_1px_0px_0px_rgba(15,23,42,1)]"
              }`}
              id="tab-btn-teacher"
            >
              <ShieldCheck className="w-4 h-4 text-slate-900" />
              <span>👩‍🏫 선생님 화면 (루브릭 & 피드백 관리)</span>
              <Lock className="w-3.5 h-3.5 text-slate-600 ml-0.5" />
            </button>

            {/* 3. Dashboard Tab (Always locked for students) */}
            <button
              onClick={() => handleRequestViewMode("dashboard")}
              className={`px-3.5 py-2.5 rounded text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer border-2 border-slate-900 ${
                viewMode === "dashboard"
                  ? "bg-emerald-300 text-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]"
                  : "bg-white text-slate-700 hover:bg-slate-50 shadow-[1px_1px_0px_0px_rgba(15,23,42,1)]"
              }`}
              id="tab-btn-dashboard"
            >
              <TrendingUp className="w-4 h-4 text-slate-900" />
              <span>📊 성장 대시보드 & 경향 분석</span>
              <Lock className="w-3.5 h-3.5 text-slate-600 ml-0.5" />
            </button>
          </div>
        </div>
      </header>

      {/* Global Alerts Notification */}
      {appNotice && (
        <div className="bg-indigo-600 border-b-2 border-slate-900 text-white text-xs font-extrabold py-2.5 px-4 text-center animate-pulse flex items-center justify-center gap-1.5 shadow-sm" id="global-app-notice">
          <CheckCircle2 className="w-4 h-4" />
          <span>{appNotice}</span>
        </div>
      )}

      {/* Teacher Authentication Modal */}
      <TeacherAuthModal
        isOpen={showTeacherAuthModal}
        onSuccess={handleTeacherAuthSuccess}
        onCancel={() => {
          setShowTeacherAuthModal(false);
          setPendingViewMode(null);
        }}
      />

      {/* Main Workspace Layout */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col min-h-0" id="main-content-layout">
        
        {/* Role Guideline Info Banner */}
        <section className="bg-yellow-100 p-4 rounded border-2 border-slate-900 mb-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)]">
          <div className="flex items-start gap-3">
            <div className="bg-white border-2 border-slate-900 p-2 rounded shadow-[1px_1px_0px_0px_rgba(15,23,42,1)] mt-0.5">
              <Sparkles className="w-4 h-4 text-slate-900" />
            </div>
            <div>
              <p className="text-xs font-black text-slate-900">
                {viewMode === "student" && "🧒 [학생 배움터] 내 출석 번호를 누르고 사진이나 말하기로 생각을 자유롭게 표현해 봐요!"}
                {viewMode === "teacher" && "👩‍🏫 [선생님 전용 관리실] 학생 답안 확인, 루브릭 기반 맞춤 피드백 작성 및 학생 공개 관리"}
                {viewMode === "dashboard" && "📊 [성장 대시보드] 학생별 누적 성장 기록과 우리 반 글쓰기 경향 분석"}
              </p>
              <p className="text-[11px] text-slate-700 mt-1 leading-relaxed font-bold">
                {viewMode === "student" && "글쓰기 부담 없이 찰칵 찍거나 편하게 말하면, 선생님의 따뜻한 맞춤 응원 편지(피드백)가 도착해요! 💌"}
                {viewMode === "teacher" && "학생 번호별 답안을 확인하고 3단 성장 피드백(잘한 점 → 보완점 → 다음 단계)을 검토 후 학생에게 허용(공개)해 주세요."}
                {viewMode === "dashboard" && "학생별 누적 성장 기록을 조회하고, 오늘 수업의 공통 보완점과 다음 수업 전략을 확인합니다."}
              </p>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {viewMode === "student" ? (
              <>
                <span className="text-[10px] bg-white text-slate-950 font-black border border-slate-900 px-2 py-1 rounded shadow-[1px_1px_0px_0px_#000]">
                  📸 사진으로 찰칵!
                </span>
                <span className="text-[10px] bg-white text-slate-950 font-black border border-slate-900 px-2 py-1 rounded shadow-[1px_1px_0px_0px_#000]">
                  🎙️ 말하기로 쏙쏙!
                </span>
                <span className="text-[10px] bg-white text-slate-950 font-black border border-slate-900 px-2 py-1 rounded shadow-[1px_1px_0px_0px_#000]">
                  💌 선생님 응원 편지
                </span>
              </>
            ) : viewMode === "teacher" ? (
              <>
                <span className="text-[10px] bg-white text-slate-950 font-black border border-slate-900 px-2 py-1 rounded shadow-[1px_1px_0px_0px_#000]">
                  번호 간편 선택 🔢
                </span>
                <span className="text-[10px] bg-white text-slate-950 font-black border border-slate-900 px-2 py-1 rounded shadow-[1px_1px_0px_0px_#000]">
                  피드백 승인 공개 💌
                </span>
                <span className="text-[10px] bg-white text-slate-950 font-black border border-slate-900 px-2 py-1 rounded shadow-[1px_1px_0px_0px_#000]">
                  성장 중심 지원 🌱
                </span>
              </>
            ) : (
              <>
                <span className="text-[10px] bg-white text-slate-950 font-black border border-slate-900 px-2 py-1 rounded shadow-[1px_1px_0px_0px_#000]">
                  누적 기록 인쇄 🖨️
                </span>
                <span className="text-[10px] bg-white text-slate-950 font-black border border-slate-900 px-2 py-1 rounded shadow-[1px_1px_0px_0px_#000]">
                  학급 경향 요약 📈
                </span>
              </>
            )}
          </div>
        </section>

        {/* View Mode Switching */}
        {viewMode === "student" && (
          <StudentView
            assignments={assignments}
            activeAssignmentId={activeAssignment?.id || ""}
            submissions={submissions}
            onSubmitAnswer={handleSubmitAnswer}
            onSelectAssignment={handleSelectAssignment}
          />
        )}

        {viewMode === "teacher" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start" id="teacher-workspace-container">
            {/* Left Column: Assignment & Rubric Panel */}
            <div className="lg:col-span-5 flex flex-col gap-6">
              <AssignmentPanel
                assignments={assignments}
                activeAssignment={activeAssignment}
                onSelectAssignment={handleSelectAssignment}
                onAddAssignment={handleAddAssignment}
                onUpdateRubric={handleUpdateRubric}
                onDeleteAssignment={handleDeleteAssignment}
              />
            </div>

            {/* Right Column: Feedback Generation & Teacher Approval Console */}
            <div className="lg:col-span-7 flex flex-col gap-6">
              <FeedbackConsole
                activeAssignment={activeAssignment}
                submissions={submissions}
                feedbacks={currentFeedbacks}
                onAddOrUpdateSubmission={handleAddOrUpdateSubmission}
                onBulkAddSubmissions={handleBulkAddSubmissions}
                onPublishToggle={handlePublishToggle}
                onPublishAll={handlePublishAll}
              />
            </div>
          </div>
        )}

        {viewMode === "dashboard" && (
          <div className="space-y-6" id="dashboard-view-container">
            <TrendsSummary
              feedbacks={currentFeedbacks}
              summary={trendSummary}
              onSaveSummary={(newSummary) => setTrendSummary(newSummary)}
            />
            <GrowthDashboard feedbacks={currentFeedbacks} />
          </div>
        )}

      </main>

      {/* Educational Footer */}
      <footer className="bg-white border-t-2 border-slate-900 py-5 text-center text-[10px] text-slate-600 mt-8" id="app-footer">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2 font-bold">
          <p>© 2026 아침글쓰기 도우미. 해솔초 심쌤</p>
          <p className="flex items-center gap-1.5 text-[11px] font-black text-indigo-900">
            <Heart className="w-4 h-4 text-rose-500 fill-rose-500" />
            <span>삼색일냥 친구들의 스마트배움터</span>
          </p>
        </div>
      </footer>
    </div>
  );
}

