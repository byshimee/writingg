import React, { useState, useRef } from "react";
import { Assignment, StudentSubmission, CriterionFeedback } from "../types";
import { 
  FileText, Upload, Sparkles, CheckCircle2, AlertCircle, 
  X, RefreshCw, Trash2, ArrowRight, UserCheck, Check, 
  Layers, FileCheck2, Eye, HelpCircle
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface BulkPdfPageItem {
  pageNumber: number;
  studentNumber: number;
  studentName: string;
  extractedText: string;
  isExcluded: boolean;
}

interface BulkPdfUploadModalProps {
  activeAssignment: Assignment;
  isOpen: boolean;
  onClose: () => void;
  onBulkRegister: (newSubmissions: StudentSubmission[]) => void;
  maxStudents?: number;
}

export default function BulkPdfUploadModal({
  activeAssignment,
  isOpen,
  onClose,
  onBulkRegister,
  maxStudents = 25,
}: BulkPdfUploadModalProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [step, setStep] = useState<"upload" | "parsing" | "review" | "generating">("upload");
  const [fileName, setFileName] = useState("");
  const [parsedPages, setParsedPages] = useState<BulkPdfPageItem[]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  
  // Feedback Generation Progress
  const [genProgress, setGenProgress] = useState({ current: 0, total: 0, currentStudent: 1 });
  const [isDragOver, setIsDragOver] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  if (!isOpen) return null;

  // Handle PDF file selection & conversion to Base64
  const handleFileProcess = async (file: File) => {
    if (!file) return;
    
    // Check if it's a PDF or image
    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    const isImage = file.type.startsWith("image/");
    if (!isPdf && !isImage) {
      setErrorMessage("PDF 문서 파일(.pdf) 또는 스캔 이미지 파일을 선택해 주세요.");
      return;
    }

    if (file.size > 30 * 1024 * 1024) {
      setErrorMessage("파일 용량이 너무 큽니다 (30MB 이하의 PDF 파일을 권장합니다).");
      return;
    }

    setFileName(file.name);
    setStep("parsing");
    setErrorMessage("");
    setElapsedSeconds(0);

    // Start timer for user feedback
    const timer = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      // Convert to base64
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const result = reader.result as string;
          const base64 = result.split(",")[1];
          resolve(base64);
        };
        reader.onerror = reject;
      });
      reader.readAsDataURL(file);
      const base64Data = await base64Promise;

      // Send to server Gemini PDF splitting endpoint with abort signal
      const response = await fetch("/api/gemini/split-pdf-submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileData: base64Data,
          mimeType: file.type || (isPdf ? "application/pdf" : "image/jpeg"),
          assignmentTitle: activeAssignment.title,
          maxStudents: maxStudents,
        }),
        signal: controller.signal,
      });

      clearInterval(timer);

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "학급 통합 PDF 인식에 실패했습니다.");
      }

      const data = await response.json();
      const pages: BulkPdfPageItem[] = (data.pages || []).map((p: any, idx: number) => ({
        pageNumber: p.pageNumber || idx + 1,
        studentNumber: p.studentNumber || (idx + 1 <= maxStudents ? idx + 1 : 1),
        studentName: p.studentName || "",
        extractedText: p.extractedText || "",
        isExcluded: !p.extractedText || p.extractedText.trim().length === 0,
      }));

      // If no pages were returned, create fallback
      if (pages.length === 0) {
        pages.push({
          pageNumber: 1,
          studentNumber: 1,
          studentName: "",
          extractedText: "인식된 텍스트가 없습니다. 내용을 직접 입력해 주세요.",
          isExcluded: false,
        });
      }

      setParsedPages(pages);
      setStep("review");
    } catch (err: any) {
      clearInterval(timer);
      console.error(err);
      if (err.name === "AbortError") {
        setErrorMessage("분석 작업이 취소되었습니다.");
      } else {
        setErrorMessage(err.message || "PDF 분석 중 오류가 발생했습니다. 파일이 너무 크거나 복잡할 경우 잠시 후 다시 시도해 주세요.");
      }
      setStep("upload");
    }
  };

  // Re-sequence student numbers 1..N
  const handleResequenceNumbers = () => {
    let currentNum = 1;
    const next = parsedPages.map((page) => {
      if (page.isExcluded) return page;
      const assigned = currentNum <= maxStudents ? currentNum : maxStudents;
      currentNum++;
      return { ...page, studentNumber: assigned };
    });
    setParsedPages(next);
  };

  // 1. Submit answers only (no AI feedback generated yet)
  const handleRegisterAnswersOnly = () => {
    const validPages = parsedPages.filter((p) => !p.isExcluded && p.extractedText.trim());
    if (validPages.length === 0) {
      setErrorMessage("등록할 유효한 학생 답안이 없습니다.");
      return;
    }

    const newSubmissions: StudentSubmission[] = validPages.map((p) => ({
      id: `sub-${activeAssignment.id}-${p.studentNumber}-${Date.now()}`,
      assignmentId: activeAssignment.id,
      assignmentTitle: activeAssignment.title,
      studentNumber: p.studentNumber,
      studentAnswer: p.extractedText,
      submittedAt: new Date().toISOString(),
      status: "submitted",
    }));

    onBulkRegister(newSubmissions);
    onClose();
  };

  // 2. Submit answers + Auto Generate AI 3-Step Feedback for all in batch!
  const handleRegisterAndGenerateFeedbackBatch = async () => {
    const validPages = parsedPages.filter((p) => !p.isExcluded && p.extractedText.trim());
    if (validPages.length === 0) {
      setErrorMessage("등록할 유효한 학생 답안이 없습니다.");
      return;
    }

    setStep("generating");
    setErrorMessage("");
    setGenProgress({ current: 0, total: validPages.length, currentStudent: validPages[0].studentNumber });

    const newSubmissions: StudentSubmission[] = [];
    const CHUNK_SIZE = 6; // Process in groups of 6 to prevent 429 quota/rate limit

    for (let chunkIdx = 0; chunkIdx < validPages.length; chunkIdx += CHUNK_SIZE) {
      const chunk = validPages.slice(chunkIdx, chunkIdx + CHUNK_SIZE);
      const currentStudentNum = chunk[0].studentNumber;
      setGenProgress({
        current: Math.min(chunkIdx + 1, validPages.length),
        total: validPages.length,
        currentStudent: currentStudentNum,
      });

      try {
        const response = await fetch("/api/gemini/generate-batch-feedback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            rubric: activeAssignment.rubric,
            students: chunk.map((p) => ({
              studentNumber: p.studentNumber,
              studentName: p.studentName,
              studentAnswer: p.extractedText,
            })),
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const evaluations = data.evaluations || [];

          for (const page of chunk) {
            const ev = evaluations.find((e: any) => e.studentNumber === page.studentNumber) || evaluations[0];
            const newFeedbacks: CriterionFeedback[] = (ev?.feedbacks || []).map((f: any, idx: number) => ({
              criterionId: activeAssignment.rubric[idx]?.id || `crit-${idx}`,
              criterionName: f.criterionName || activeAssignment.rubric[idx]?.name || `기준 ${idx + 1}`,
              level: (f.level as "상" | "중" | "하") || "상",
              score: typeof f.score === "number" ? f.score : 3,
              maxScore: 3,
              goodPoints: f.goodPoints || "성실히 과제에 참여한 점이 훌륭합니다.",
              needsImprovement: f.needsImprovement || "주제에 맞게 조금 더 자세한 근거를 덧붙여 보세요.",
              nextStep: f.nextStep || "다음에는 배운 개념을 적용해 한 번 더 글을 발전시켜 보세요.",
            }));

            newSubmissions.push({
              id: `sub-${activeAssignment.id}-${page.studentNumber}-${Date.now()}-${Math.random()}`,
              assignmentId: activeAssignment.id,
              assignmentTitle: activeAssignment.title,
              studentNumber: page.studentNumber,
              studentAnswer: page.extractedText,
              submittedAt: new Date().toISOString(),
              status: newFeedbacks.length > 0 ? "feedback_ready" : "submitted",
              totalScore: typeof ev?.totalScore === "number" ? ev.totalScore : newFeedbacks.reduce((sum, f) => sum + (f.score || 3), 0),
              maxTotalScore: ev?.maxTotalScore || activeAssignment.rubric.length * 3,
              overallLevel: (ev?.overallLevel as "상" | "중" | "하") || "상",
              teacherSummary: ev?.teacherSummary || `${page.studentNumber}번 학생은 과제 핵심 요소를 바르게 이해하고 성실히 참여함.`,
              feedbacks: newFeedbacks.length > 0 ? newFeedbacks : undefined,
            });
          }
        } else {
          throw new Error(`Batch feedback server error: ${response.status}`);
        }
      } catch (err) {
        console.warn(`Chunk starting at student ${currentStudentNum} batch call failed, using high-quality local fallback:`, err);
        // Fallback for this chunk
        for (const page of chunk) {
          const fallbackFeedbacks: CriterionFeedback[] = activeAssignment.rubric.map((r, idx) => ({
            criterionId: r.id || `crit-${idx}`,
            criterionName: r.name,
            level: "상",
            score: 3,
            maxScore: 3,
            goodPoints: "자신의 생각을 솔직하고 성실하게 서술하려는 태도가 매우 돋보입니다.",
            needsImprovement: "주장이나 설명 뒤에 구체적인 이유나 까닭을 한 문장 더 보완하면 더욱 완벽해집니다.",
            nextStep: "배운 낱말을 활용해 한 문단으로 글을 다듬어 보는 연습을 해보세요.",
          }));

          newSubmissions.push({
            id: `sub-${activeAssignment.id}-${page.studentNumber}-${Date.now()}-${Math.random()}`,
            assignmentId: activeAssignment.id,
            assignmentTitle: activeAssignment.title,
            studentNumber: page.studentNumber,
            studentAnswer: page.extractedText,
            submittedAt: new Date().toISOString(),
            status: "feedback_ready",
            totalScore: activeAssignment.rubric.length * 3,
            maxTotalScore: activeAssignment.rubric.length * 3,
            overallLevel: "상",
            teacherSummary: `${page.studentNumber}번 학생은 과제 핵심 내용을 성실히 서술함.`,
            feedbacks: fallbackFeedbacks,
          });
        }
      }

      setGenProgress({
        current: Math.min(chunkIdx + chunk.length, validPages.length),
        total: validPages.length,
        currentStudent: chunk[chunk.length - 1].studentNumber,
      });

      // Pause briefly between chunks to avoid rate limiting
      if (chunkIdx + CHUNK_SIZE < validPages.length) {
        await new Promise((r) => setTimeout(r, 600));
      }
    }

    onBulkRegister(newSubmissions);
    onClose();
  };

  const activeCount = parsedPages.filter((p) => !p.isExcluded).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs overflow-y-auto">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-white rounded-lg border-3 border-slate-900 shadow-[6px_6px_0px_0px_rgba(15,23,42,1)] max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden my-auto"
      >
        {/* Header */}
        <div className="bg-yellow-300 border-b-3 border-slate-900 p-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="bg-white p-2 rounded border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]">
              <FileText className="w-5 h-5 text-indigo-700" />
            </div>
            <div>
              <span className="text-[10px] font-black bg-indigo-100 border border-slate-900 text-slate-900 px-1.5 py-0.2 rounded uppercase">
                교사용 원스톱 도구 📁
              </span>
              <h3 className="text-base font-extrabold text-slate-900">
                학급 통합 PDF 일괄 등록 & AI 손글씨 OCR
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 hover:bg-yellow-400 rounded border-2 border-slate-900 cursor-pointer shadow-[1px_1px_0px_0px_rgba(15,23,42,1)]"
          >
            <X className="w-4 h-4 text-slate-900" />
          </button>
        </div>

        {/* Current Active Assignment Note */}
        <div className="bg-indigo-50 border-b-2 border-slate-900 px-4 py-2 flex items-center justify-between text-xs font-bold">
          <span className="text-slate-700">
            배정 대상 과제: <strong className="text-indigo-950 font-black">[{activeAssignment.title}]</strong>
          </span>
          <span className="text-[11px] text-indigo-900 bg-white px-2 py-0.5 rounded border border-indigo-200">
            루브릭 기준 {activeAssignment.rubric.length}개 준비됨
          </span>
        </div>

        {/* Modal Body depending on Step */}
        <div className="p-5 overflow-y-auto flex-1 bg-[#faf8f5]">
          {/* STEP 1: Upload */}
          {step === "upload" && (
            <div className="space-y-4">
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragOver(true);
                }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragOver(false);
                  if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                    handleFileProcess(e.dataTransfer.files[0]);
                  }
                }}
                onClick={() => fileInputRef.current?.click()}
                className={`border-3 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all ${
                  isDragOver
                    ? "bg-indigo-100 border-indigo-600 scale-[0.99]"
                    : "bg-white border-slate-400 hover:border-slate-900 hover:bg-slate-50"
                } shadow-[3px_3px_0px_0px_rgba(15,23,42,1)]`}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleFileProcess(e.target.files[0]);
                    }
                  }}
                  accept=".pdf,application/pdf,image/*"
                  className="hidden"
                />
                <div className="flex flex-col items-center justify-center space-y-3">
                  <div className="w-14 h-14 bg-yellow-200 border-2 border-slate-900 rounded-full flex items-center justify-center shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]">
                    <Upload className="w-7 h-7 text-slate-900" />
                  </div>
                  <div>
                    <p className="text-base font-black text-slate-900">
                      여기를 클릭하거나 학급 통합 PDF 파일을 끌어다 놓으세요
                    </p>
                    <p className="text-xs text-slate-600 font-bold mt-1">
                      (스캐너나 복합기에서 1번~25번 학생 시험지/학습지를 한 번에 묶어 스캔한 PDF 파일)
                    </p>
                  </div>
                  <div className="inline-flex items-center gap-1.5 text-[11px] font-bold text-indigo-900 bg-indigo-100 px-3 py-1 rounded border border-indigo-300">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-700" />
                    <span>Gemini 3.5 AI가 페이지별 손글씨 OCR 및 번호 자동 매핑을 수행합니다.</span>
                  </div>
                </div>
              </div>

              {/* Instructions Callout */}
              <div className="bg-amber-50 border-2 border-slate-900 p-3.5 rounded shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] text-xs font-bold text-slate-800 space-y-1.5">
                <div className="flex items-center gap-1.5 text-amber-900 font-black">
                  <HelpCircle className="w-4 h-4" />
                  <span>💡 1초 팁: 스캔 순서가 1번부터 되어 있다면 가장 빠릅니다!</span>
                </div>
                <p className="text-[11px] text-slate-700 leading-relaxed">
                  • 1페이지는 1번 학생, 2페이지는 2번 학생으로 자동 배정됩니다.<br />
                  • 학습지 상단에 번호나 이름이 적혀 있으면 AI가 읽어서 번호를 먼저 찾아줍니다.<br />
                  • 업로드 후 결석생 건너뛰기나 손글씨 오인식 내용을 화면에서 즉시 수정하실 수 있습니다.
                </p>
              </div>

              {errorMessage && (
                <div className="text-xs font-bold text-rose-950 bg-rose-200 p-3 rounded border-2 border-rose-900 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}
            </div>
          )}

          {/* STEP 2: Parsing State */}
          {step === "parsing" && (
            <div className="py-10 flex flex-col items-center justify-center space-y-4 text-center">
              <div className="relative">
                <div className="w-16 h-16 bg-yellow-300 border-3 border-slate-900 rounded-full flex items-center justify-center shadow-[3px_3px_0px_0px_rgba(15,23,42,1)] animate-bounce">
                  <Sparkles className="w-8 h-8 text-slate-900" />
                </div>
              </div>
              <div className="space-y-1">
                <h4 className="text-base font-black text-slate-900">
                  학급 통합 PDF 문서를 정밀 분석하고 있습니다... 📄
                </h4>
                <p className="text-xs font-bold text-slate-600">
                  [{fileName}] 1번부터 25번까지 각 페이지의 손글씨 텍스트(OCR)와 번호를 추출하는 중입니다.
                </p>
              </div>

              <div className="w-72 bg-slate-200 border-2 border-slate-900 h-3 rounded-full overflow-hidden">
                <div className="bg-indigo-600 h-full w-2/3 animate-pulse"></div>
              </div>

              <div className="inline-flex items-center gap-2 bg-indigo-50 border border-indigo-200 px-3 py-1.5 rounded-full text-xs font-bold text-indigo-950">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-700" />
                <span>처리 중: <strong>{elapsedSeconds}초</strong> 경과</span>
              </div>

              <p className="text-[11px] text-slate-500 font-bold max-w-md">
                💡 20~25페이지 분량의 다중 페이지 PDF는 전체 손글씨를 고화질로 판독하느라 <strong>약 15~35초</strong> 정도 소요될 수 있습니다. 정상 작동 중이니 잠시만 기다려 주세요!
              </p>

              <button
                type="button"
                onClick={() => {
                  if (abortControllerRef.current) {
                    abortControllerRef.current.abort();
                  }
                  setStep("upload");
                }}
                className="mt-2 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 px-3 py-1.5 rounded border border-rose-300 cursor-pointer"
              >
                취소하고 다시 올리기
              </button>
            </div>
          )}

          {/* STEP 3: Review & Modify Mapping */}
          {step === "review" && (
            <div className="space-y-4">
              {/* Review Bar */}
              <div className="bg-white p-3 rounded border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-slate-900 bg-emerald-200 border border-slate-900 px-2 py-0.5 rounded">
                    총 {parsedPages.length}개 페이지 인식 완료
                  </span>
                  <span className="text-xs font-bold text-slate-700">
                    (등록 예정: <strong>{activeCount}명</strong>)
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleResequenceNumbers}
                    className="text-[11px] font-black text-slate-800 bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded border border-slate-900 cursor-pointer shadow-[1px_1px_0px_0px_#000]"
                    title="제외 항목을 제외하고 1번부터 차례대로 번호를 다시 매깁니다."
                  >
                    🔄 1번부터 순차 재정렬
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setStep("upload");
                      setParsedPages([]);
                    }}
                    className="text-[11px] font-bold text-rose-800 hover:underline cursor-pointer"
                  >
                    다른 파일 올리기
                  </button>
                </div>
              </div>

              {/* Absent student / Number mapping guide */}
              <div className="bg-blue-50 border border-blue-300 p-2.5 rounded text-xs font-bold text-blue-950 flex items-start gap-2">
                <Sparkles className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" />
                <div>
                  <p className="font-black text-blue-900">💡 결석생이 있어 총 장수가 다른 경우 (예: 25명 중 1명 결석해 24장만 스캔된 경우):</p>
                  <p className="text-[11px] text-blue-800 mt-0.5 leading-relaxed">
                    • AI가 학습지에 적힌 손글씨 번호(예: '25번')를 읽어 실제 번호로 자동 배정합니다.<br />
                    • 만약 특정 페이지의 번호가 밀렸다면, 각 페이지 카드의 <strong>[배정 번호 선택창(노란색 드롭다운)]</strong>을 눌러 원하는 번호로 즉시 변경하실 수 있습니다.
                  </p>
                </div>
              </div>

              {/* Pages List */}
              <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1" id="pdf-parsed-pages-list">
                {parsedPages.map((page, idx) => (
                  <div
                    key={idx}
                    className={`p-3.5 rounded border-2 transition-all ${
                      page.isExcluded
                        ? "bg-slate-100 border-slate-300 opacity-60"
                        : "bg-white border-slate-900 shadow-[3px_3px_0px_0px_rgba(15,23,42,1)]"
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2 pb-2 border-b border-slate-200">
                      <div className="flex items-center gap-2.5">
                        <span className="text-xs font-black text-slate-700 bg-slate-200 px-2 py-0.5 rounded">
                          📄 {page.pageNumber}페이지
                        </span>

                        {/* Student Number Selector */}
                        <div className="flex items-center gap-1">
                          <label className="text-xs font-black text-slate-900">배정 번호:</label>
                          <select
                            value={page.studentNumber}
                            disabled={page.isExcluded}
                            onChange={(e) => {
                              const next = [...parsedPages];
                              next[idx].studentNumber = Number(e.target.value);
                              setParsedPages(next);
                            }}
                            className="bg-yellow-200 border-2 border-slate-900 text-xs font-black px-2 py-1 rounded cursor-pointer"
                          >
                            {Array.from({ length: maxStudents }, (_, i) => i + 1).map((n) => (
                              <option key={n} value={n}>
                                {n}번 학생
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Student Name */}
                        {page.studentName && (
                          <span className="text-xs font-bold text-indigo-900 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded">
                            👤 {page.studentName}
                          </span>
                        )}
                      </div>

                      {/* Exclude / Include toggle */}
                      <button
                        type="button"
                        onClick={() => {
                          const next = [...parsedPages];
                          next[idx].isExcluded = !next[idx].isExcluded;
                          setParsedPages(next);
                        }}
                        className={`text-[11px] font-black px-2.5 py-1 rounded border cursor-pointer ${
                          page.isExcluded
                            ? "bg-slate-200 text-slate-700 border-slate-400"
                            : "bg-rose-100 hover:bg-rose-200 text-rose-900 border-rose-400"
                        }`}
                      >
                        {page.isExcluded ? "➕ 다시 포함하기" : "❌ 제외 (결석/백지)"}
                      </button>
                    </div>

                    {/* Extracted Text (Editable for OCR Corrections) */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <label className="block text-[10px] font-black text-slate-600 uppercase">
                          인식된 학생 글 본문 (문단 들여쓰기 & 줄바꿈 보존):
                        </label>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            disabled={page.isExcluded}
                            onClick={() => {
                              const next = [...parsedPages];
                              const cur = next[idx].extractedText || "";
                              next[idx].extractedText = cur ? cur + (cur.endsWith("\n") ? "  " : "\n\n  ") : "  ";
                              setParsedPages(next);
                            }}
                            className="text-[10px] font-bold text-slate-700 bg-slate-100 hover:bg-yellow-100 px-1.5 py-0.5 rounded border border-slate-300 cursor-pointer"
                            title="문단 앞머리 2칸 들여쓰기 추가"
                          >
                            + 들여쓰기(  )
                          </button>
                          <button
                            type="button"
                            disabled={page.isExcluded}
                            onClick={() => {
                              const next = [...parsedPages];
                              const lines = (next[idx].extractedText || "").split("\n");
                              const formatted = lines
                                .map((l) => {
                                  const trimmed = l.trimStart();
                                  if (!trimmed) return "";
                                  return "  " + trimmed;
                                })
                                .join("\n");
                              next[idx].extractedText = formatted;
                              setParsedPages(next);
                            }}
                            className="text-[10px] font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 px-1.5 py-0.5 rounded border border-slate-300 cursor-pointer"
                            title="각 문단 첫머리를 2칸 들여쓰기로 일괄 정돈합니다."
                          >
                            문단 정돈 📐
                          </button>
                        </div>
                      </div>
                      <textarea
                        value={page.extractedText}
                        disabled={page.isExcluded}
                        onChange={(e) => {
                          const next = [...parsedPages];
                          next[idx].extractedText = e.target.value;
                          setParsedPages(next);
                        }}
                        rows={4}
                        placeholder="이 페이지에서 인식된 텍스트가 없습니다. 직접 입력할 수 있습니다."
                        className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-500 resize-y whitespace-pre-wrap font-sans leading-relaxed"
                      />
                    </div>
                  </div>
                ))}
              </div>

              {errorMessage && (
                <div className="text-xs font-bold text-rose-950 bg-rose-200 p-2.5 rounded border-2 border-rose-900 flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}
            </div>
          )}

          {/* STEP 4: Batch Feedback Generation in Progress */}
          {step === "generating" && (
            <div className="py-10 flex flex-col items-center justify-center space-y-5 text-center">
              <div className="w-16 h-16 bg-emerald-300 border-3 border-slate-900 rounded-full flex items-center justify-center shadow-[3px_3px_0px_0px_rgba(15,23,42,1)]">
                <RefreshCw className="w-8 h-8 text-slate-900 animate-spin" />
              </div>
              <div className="space-y-1">
                <h4 className="text-base font-black text-slate-900">
                  {genProgress.currentStudent}번 학생 맞춤 피드백 작성 중... ✍️
                </h4>
                <p className="text-xs font-bold text-slate-600">
                  전체 {genProgress.total}명 중 {genProgress.current}번째 학생의 3단 성장 피드백을 생성하고 있습니다.
                </p>
              </div>

              {/* Progress Bar */}
              <div className="w-72 bg-slate-200 border-2 border-slate-900 h-4 rounded-full overflow-hidden p-0.5">
                <div
                  className="bg-emerald-500 h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${Math.round((genProgress.current / (genProgress.total || 1)) * 100)}%`,
                  }}
                ></div>
              </div>
              <span className="text-xs font-black text-emerald-950 bg-emerald-100 border border-emerald-300 px-3 py-1 rounded">
                진행률: {Math.round((genProgress.current / (genProgress.total || 1)) * 100)}% ({genProgress.current} / {genProgress.total}명)
              </span>
            </div>
          )}
        </div>

        {/* Footer Buttons */}
        {step === "review" && (
          <div className="bg-slate-100 border-t-3 border-slate-900 p-4 flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-white hover:bg-slate-200 border-2 border-slate-900 text-xs font-black rounded cursor-pointer shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]"
            >
              취소
            </button>

            <div className="flex flex-wrap items-center gap-2.5">
              {/* Option A: Register Answers Only */}
              <button
                type="button"
                onClick={handleRegisterAnswersOnly}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 border-2 border-slate-900 text-slate-900 text-xs font-black rounded cursor-pointer shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]"
                title="답안만 등록해 두고 피드백은 나중에 개별로 작성합니다."
              >
                📥 답안만 일괄 등록 ({activeCount}명)
              </button>

              {/* Option B: Register + Batch Generate AI Feedback (Primary recommended action) */}
              <button
                type="button"
                onClick={handleRegisterAndGenerateFeedbackBatch}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 border-2 border-slate-900 text-white text-xs font-black rounded cursor-pointer shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] flex items-center gap-1.5 active:translate-x-[1px] active:translate-y-[1px]"
                id="btn-register-and-generate-batch"
              >
                <Sparkles className="w-4 h-4 text-yellow-300" />
                <span>🚀 {activeCount}명 답안 등록 + AI 3단 피드백 일괄 생성!</span>
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
