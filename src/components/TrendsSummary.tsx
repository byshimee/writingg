import React, { useState } from "react";
import { StudentFeedback, SessionTrendSummary } from "../types";
import { BarChart3, RefreshCw, Sparkles, Compass, Lightbulb, Quote } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface TrendsSummaryProps {
  feedbacks: StudentFeedback[];
  summary: SessionTrendSummary | null;
  onSaveSummary: (summary: SessionTrendSummary) => void;
}

export default function TrendsSummary({
  feedbacks,
  summary,
  onSaveSummary,
}: TrendsSummaryProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleGenerateSummary = async () => {
    if (feedbacks.length === 0) {
      setErrorMessage("현재 수집된 학생 피드백 데이터가 전혀 없습니다. 먼저 분석실에서 학생 답안을 입력해 주세요.");
      return;
    }

    setIsLoading(true);
    setErrorMessage("");

    try {
      const response = await fetch("/api/gemini/summarize-today", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionData: feedbacks }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "오늘 경향 요약 실패");
      }

      const data = await response.json();

      const newSummary: SessionTrendSummary = {
        commonImprovements: data.commonImprovements,
        nextLessonSuggestions: data.nextLessonSuggestions,
        createdAt: new Date().toISOString(),
      };

      onSaveSummary(newSummary);
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || "종합 분석 중 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="neo-card p-6 flex flex-col h-full bg-white" id="trends-summary-container">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5 border-b-2 border-slate-900 pb-4">
        <div className="flex items-center gap-3">
          <div className="bg-yellow-300 border-2 border-slate-900 p-2.5 rounded-lg shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]">
            <BarChart3 className="w-5 h-5 text-slate-900" />
          </div>
          <h2 className="text-xl font-extrabold text-slate-900 text-editorial-title">오늘 학급 수업 경향 요약</h2>
        </div>
        <button
          onClick={handleGenerateSummary}
          disabled={isLoading || feedbacks.length === 0}
          className="px-3.5 py-2 bg-yellow-200 hover:bg-yellow-300 text-slate-900 border-2 border-slate-900 rounded font-black text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-[2px_2px_0px_0px_#000] active:translate-x-[1px] active:translate-y-[1px]"
          id="btn-generate-trends"
        >
          {isLoading ? (
            <RefreshCw className="w-3.5 h-3.5 animate-spin text-slate-900" />
          ) : (
            <Sparkles className="w-3.5 h-3.5 text-indigo-700" />
          )}
          <span>{summary ? "경향 다시 분석하기" : "실시간 종합 분석 실행"}</span>
        </button>
      </div>

      {feedbacks.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-slate-400 text-xs py-12" id="trends-empty-state">
          <BarChart3 className="w-10 h-10 text-slate-300 mb-2 animate-pulse" />
          <p className="font-extrabold text-slate-700">오늘 평가한 학생 답안 데이터가 아직 없습니다.</p>
          <p className="text-[10px] text-slate-500 mt-1.5 font-medium bg-slate-100 px-3 py-1.5 rounded border border-slate-200">
            피드백 데이터가 누적되면 학급 전체의 공통 보완점과 맞춤형 수업 지도가 가능해집니다.
          </p>
        </div>
      ) : (
        <div className="flex-1 flex flex-col min-h-0">
          {errorMessage && (
            <div className="mb-4 text-xs text-rose-950 font-bold bg-rose-200 border border-rose-900 p-2.5 rounded" id="trends-error-msg">
              {errorMessage}
            </div>
          )}

          <AnimatePresence mode="wait">
            {isLoading ? (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex-1 flex flex-col items-center justify-center py-12 text-slate-600 text-xs gap-3"
                id="trends-loading-spinner"
              >
                <div className="relative">
                  <div className="w-12 h-12 border-4 border-slate-200 border-t-indigo-600 rounded-full animate-spin" />
                  <Sparkles className="w-4 h-4 text-indigo-600 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
                </div>
                <div className="text-center">
                  <p className="font-extrabold text-slate-800">오늘 제출된 전체 학생 답안 분석하는 중...</p>
                  <p className="text-[10px] text-slate-500 mt-1 font-bold">
                    자주 발생한 공통 보완점 3가지와 다음 학습 지도전략을 인출하는 중입니다. 🔍
                  </p>
                </div>
              </motion.div>
            ) : summary ? (
              <motion.div
                key="summary-view"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex-1 flex flex-col min-h-0 space-y-5 overflow-y-auto pr-1"
                id="trends-summary-view"
              >
                {/* 1. 자주 나온 보완점 3가지 */}
                <div className="space-y-2.5">
                  <span className="text-[10px] font-black text-slate-900 uppercase tracking-wider flex items-center gap-1">
                    <Compass className="w-4 h-4 text-yellow-600" />
                    교실 속 자주 관찰된 취약점 (공통 보완점 3가지)
                  </span>

                  <div className="grid grid-cols-1 gap-3">
                    {summary.commonImprovements.slice(0, 3).map((item, idx) => (
                      <div
                        key={idx}
                        className="bg-yellow-50 p-3.5 rounded border-2 border-slate-900 flex items-start gap-3 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]"
                      >
                        <span className="w-5 h-5 rounded-full bg-yellow-200 text-slate-900 font-black text-xs flex items-center justify-center shrink-0 border border-slate-900">
                          {idx + 1}
                        </span>
                        <p className="text-xs text-slate-800 leading-relaxed font-bold">
                          {item}
                        </p>
                      </div>
                    ))}
                    {summary.commonImprovements.length === 0 && (
                      <p className="text-xs text-slate-500 italic">공통 취약점을 추출하지 못했습니다.</p>
                    )}
                  </div>
                </div>

                {/* 2. 다음 수업 지도 제안 */}
                <div className="flex-1 flex flex-col min-h-0 space-y-2.5">
                  <span className="text-[10px] font-black text-slate-900 uppercase tracking-wider flex items-center gap-1">
                    <Lightbulb className="w-4 h-4 text-emerald-600" />
                    다음 수업을 위한 성취지향 교수·학습 전략 제안
                  </span>

                  <div className="flex-1 bg-emerald-50/60 p-4 rounded border-2 border-slate-900 shadow-[3px_3px_0px_0px_rgba(15,23,42,1)] text-xs leading-relaxed text-slate-800 overflow-y-auto max-h-[220px]">
                    <div className="relative mb-2">
                      <Quote className="w-8 h-8 text-slate-900/5 absolute left-[-8px] top-[-8px]" />
                    </div>
                    {/* Render paragraphs nicely */}
                    <div className="space-y-2.5 whitespace-pre-wrap pl-4 text-[11px] text-slate-800 font-bold" id="next-lesson-suggestions-content">
                      {summary.nextLessonSuggestions}
                    </div>
                  </div>
                </div>

                {/* Footer time */}
                <p className="text-[10px] text-slate-500 text-right mt-1.5 font-bold">
                  최종 분석 시각: {new Date(summary.createdAt).toLocaleTimeString("ko-KR")}
                </p>
              </motion.div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center text-slate-400 text-xs py-16 bg-slate-50 rounded border-2 border-slate-900 shadow-[3px_3px_0px_0px_rgba(15,23,42,1)]" id="trends-untriggered-state">
                <Sparkles className="w-8 h-8 text-yellow-500 mb-2.5 animate-bounce" />
                <p className="font-extrabold text-slate-700">오늘의 학급 누적 데이터 분석이 가능합니다!</p>
                <p className="text-[10px] text-slate-500 mt-2 max-w-[340px] leading-relaxed font-bold">
                  우측 상단의 <strong>'실시간 종합 분석 실행'</strong> 버튼을 클릭하시거나, 피드백 콘솔 하단 명령어 창에 <strong>'오늘 경향 요약'</strong>을 입력하여 우리 교실의 공통 학습 취약점과 다음 교수설계를 맞춤형으로 진단해 보세요.
                </p>
              </div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
