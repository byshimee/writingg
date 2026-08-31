import React, { useState } from "react";
import { StudentFeedback } from "../types";
import { Award, Calendar, Printer, TrendingUp, User, FileText, CheckCircle2 } from "lucide-react";
import { motion } from "motion/react";

interface GrowthDashboardProps {
  feedbacks: StudentFeedback[];
}

export default function GrowthDashboard({ feedbacks }: GrowthDashboardProps) {
  // Sort student identifiers naturally by number (e.g. 1번, 2번, ..., 10번)
  const uniqueStudents = Array.from(new Set(feedbacks.map((f) => f.studentIdentifier))).sort((a, b) => {
    const numA = parseInt(a.replace(/[^0-9]/g, "")) || 0;
    const numB = parseInt(b.replace(/[^0-9]/g, "")) || 0;
    return numA - numB;
  });

  const [selectedStudent, setSelectedStudent] = useState<string>(
    uniqueStudents[0] || "1번"
  );

  // Fallback to update selected student if initial was empty and new ones came in
  React.useEffect(() => {
    if ((!selectedStudent || !uniqueStudents.includes(selectedStudent)) && uniqueStudents.length > 0) {
      setSelectedStudent(uniqueStudents[0]);
    }
  }, [uniqueStudents, selectedStudent]);

  // Filter feedbacks for the selected student
  const studentLogs = feedbacks.filter(
    (f) => f.studentIdentifier === selectedStudent
  ).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  // Generate an automated Growth Tag based on student identifier or history
  const getGrowthTagAndDescription = (student: string, logs: StudentFeedback[]) => {
    if (logs.length === 0) return { tag: "성장 꿈나무 🌱", desc: "차근차근 배움을 쌓아가며 첫 발걸음을 떼고 있습니다." };

    const idNum = parseInt(student.replace(/[^0-9]/g, "")) || 1;
    if (idNum % 3 === 1) {
      return {
        tag: "생각의 살을 붙이는 깊은 사유가 ✍️",
        desc: "풍부한 표현력과 진지한 성찰을 가지고 논리를 정밀하게 직조할 줄 아는 역량이 돋보입니다."
      };
    } else if (idNum % 3 === 2) {
      return {
        tag: "생활 밀착형 창의적 제안가 💡",
        desc: "일상 속 작은 현상을 관찰하고 신선하고 톡톡 튀는 현실적 해결책을 기발하게 이끌어내는 힘이 있습니다."
      };
    } else {
      return {
        tag: "정교하고 꼼꼼한 사실 탐구 대장 🔍",
        desc: "정량적 사실 수치와 논리 전개를 바탕으로 한 탐구를 즐기고 끈기 있게 서술하는 성실함이 무기입니다."
      };
    }
  };

  const { tag: growthTag, desc: growthDesc } = getGrowthTagAndDescription(selectedStudent, studentLogs);

  // Simple print action
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="neo-card p-6 flex flex-col h-full bg-white" id="growth-dashboard-container">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5 border-b-2 border-slate-900 pb-4">
        <div className="flex items-center gap-3">
          <div className="bg-yellow-300 border-2 border-slate-900 p-2.5 rounded-lg shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]">
            <TrendingUp className="w-5 h-5 text-slate-900" />
          </div>
          <div>
            <span className="text-[10px] font-black bg-indigo-200 border border-slate-900 text-slate-900 px-1.5 py-0.5 rounded uppercase">
              학습자별 성장 누적 데이터 📈
            </span>
            <h2 className="text-xl font-extrabold text-slate-900 text-editorial-title">
              3. 학생별 누적 성장 대시보드
            </h2>
          </div>
        </div>
        {selectedStudent && studentLogs.length > 0 && (
          <button
            onClick={handlePrint}
            className="px-3.5 py-2 bg-yellow-200 hover:bg-yellow-300 text-slate-900 border-2 border-slate-900 rounded font-black text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-[2px_2px_0px_0px_#000] active:translate-x-[1px] active:translate-y-[1px]"
            title="현재 학생 성장 통지서 인쇄"
            id="btn-print-growth-card"
          >
            <Printer className="w-4 h-4" />
            <span>성장 통지표 인쇄/PDF 저장</span>
          </button>
        )}
      </div>

      {uniqueStudents.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-slate-400 text-xs py-12" id="dashboard-empty-state">
          <Award className="w-10 h-10 text-slate-300 mb-2.5 animate-pulse" />
          <p className="font-extrabold text-slate-700">아직 작성된 학생 성장 피드백 기록이 없습니다.</p>
          <p className="text-[10px] text-slate-500 mt-1.5 font-bold bg-slate-100 px-3 py-1.5 rounded border border-slate-300">
            '교사용 피드백 작성 & 허용' 탭에서 학생 답안에 피드백을 작성하시면 누적 성장 리포트가 자동으로 생성됩니다!
          </p>
        </div>
      ) : (
        <div className="flex-1 flex flex-col md:flex-row gap-6 min-h-0" id="dashboard-workspace">
          {/* Left: Student Number List */}
          <div className="md:w-1/4 flex flex-col border-r-2 border-slate-900 pr-5 shrink-0 max-h-[500px] overflow-y-auto">
            <span className="text-[10px] font-black text-slate-900 uppercase tracking-wider mb-2.5">
              학생 번호 목록 ({uniqueStudents.length}명)
            </span>
            <div className="space-y-2" id="dashboard-student-list">
              {uniqueStudents.map((student) => {
                const isActive = selectedStudent === student;
                const count = feedbacks.filter((f) => f.studentIdentifier === student).length;
                return (
                  <button
                    key={student}
                    onClick={() => setSelectedStudent(student)}
                    className={`w-full text-left px-3 py-2.5 rounded border-2 border-slate-900 text-xs transition-all flex items-center justify-between cursor-pointer ${
                      isActive
                        ? "bg-indigo-300 text-slate-900 font-black shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]"
                        : "bg-slate-50 text-slate-800 hover:bg-slate-100 shadow-[1px_1px_0px_0px_#000]"
                    }`}
                    id={`student-selector-${student}`}
                  >
                    <div className="flex items-center gap-1.5 truncate">
                      <User className="w-3.5 h-3.5 text-slate-900" />
                      <span className="truncate font-black">{student}</span>
                    </div>
                    <span className={`text-[9px] px-2 py-0.5 rounded border border-slate-950 font-black ${
                      isActive ? "bg-white text-slate-900" : "bg-slate-200 text-slate-700"
                    }`}>
                      {count}회 기록
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right: Selected Student Growth Narrative & Timeline */}
          <div className="flex-1 flex flex-col min-h-0 print:p-0" id="growth-report-card">
            <div className="flex-1 overflow-y-auto pr-1 space-y-5 print:overflow-visible">
              
              {/* Student Growth Title Card */}
              <div className="bg-indigo-50/70 p-5 rounded border-2 border-slate-900 shadow-[3px_3px_0px_0px_rgba(15,23,42,1)] relative overflow-hidden" id="growth-student-header-card">
                <div className="absolute right-[-10px] top-[-10px] opacity-10">
                  <Award className="w-24 h-24 text-slate-900" />
                </div>
                <div className="flex items-start gap-3.5">
                  <div className="bg-white border-2 border-slate-900 p-2.5 rounded-lg shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]">
                    <Award className="w-6 h-6 text-slate-900" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-900 flex items-center gap-2 text-editorial-title">
                      <span>{selectedStudent} 학생 성장 리포트 통지표</span>
                    </h3>
                    <div className="mt-2 flex flex-wrap gap-1.5 items-center">
                      <span className="text-xs font-black text-slate-900 bg-yellow-200 border border-slate-900 px-3 py-1 rounded shadow-[1px_1px_0px_0px_#000]">
                        {growthTag}
                      </span>
                    </div>
                    <p className="text-xs text-slate-800 mt-2.5 leading-relaxed font-bold">
                      {growthDesc}
                    </p>
                  </div>
                </div>
              </div>

              {/* Historical Timeline Logs */}
              <div>
                <span className="text-[10px] font-black text-slate-950 uppercase tracking-wider mb-2.5 block">
                  과제별 누적 성장 기록지 ({studentLogs.length}개 평가 기록)
                </span>
                
                <div className="space-y-4 relative before:absolute before:left-3 before:top-2 before:bottom-2 before:w-[2px] before:bg-slate-900" id="growth-timeline-items">
                  {studentLogs.map((log) => (
                    <div key={log.id} className="relative pl-7 group" id={`timeline-log-${log.id}`}>
                      <div className="absolute left-[8px] top-3 w-3 h-3 rounded-full bg-yellow-400 border-2 border-slate-900 transition-transform group-hover:scale-125" />

                      <div className="bg-white p-4 rounded border-2 border-slate-900 shadow-[3px_3px_0px_0px_rgba(15,23,42,1)]">
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-slate-900 pb-2 mb-3">
                          <div className="flex items-center gap-1.5">
                            <FileText className="w-4 h-4 text-slate-900" />
                            <span className="text-xs font-black text-slate-900">{log.assignmentTitle}</span>
                          </div>
                          <div className="flex items-center gap-1 bg-slate-100 px-2.5 py-0.5 rounded border border-slate-900">
                            <Calendar className="w-3 h-3 text-slate-700" />
                            <span className="text-[10px] text-slate-800 font-extrabold">
                              {new Date(log.createdAt).toLocaleDateString("ko-KR", {
                                year: "numeric",
                                month: "long",
                                day: "numeric"
                              })}
                            </span>
                          </div>
                        </div>

                        {/* Student original answer */}
                        <div className="bg-slate-50 p-3 rounded border border-slate-300 mb-3.5 text-xs leading-relaxed text-slate-800 font-bold">
                          <strong className="text-slate-900 block mb-1">📝 학생 제출 답안:</strong>
                          <p className="italic font-medium whitespace-pre-wrap font-sans">"{log.studentAnswer}"</p>
                        </div>

                        {/* Criterion feedback lists */}
                        <div className="space-y-3">
                          {log.feedbacks.map((f, fIdx) => (
                            <div key={f.criterionId || fIdx} className="text-xs space-y-1.5">
                              <span className="font-black text-slate-900 block bg-yellow-100 border border-slate-900 px-2 py-1 rounded inline-block">
                                📌 [성취 기준] {f.criterionName}
                              </span>
                              
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                                <div className="leading-relaxed bg-emerald-50 p-2.5 rounded border border-emerald-300">
                                  <strong className="text-emerald-950 text-xs block font-black mb-0.5">🌱 아주 칭찬해요 (잘한 점)</strong>
                                  <p className="text-slate-800 text-[11px] font-bold">{f.goodPoints}</p>
                                </div>
                                <div className="leading-relaxed bg-amber-50 p-2.5 rounded border border-amber-300">
                                  <strong className="text-amber-950 text-xs block font-black mb-0.5">🍂 조금 더 힘내요 (보완점)</strong>
                                  <p className="text-slate-800 text-[11px] font-bold">{f.needsImprovement}</p>
                                </div>
                                <div className="leading-relaxed bg-sky-50 p-2.5 rounded border border-sky-300">
                                  <strong className="text-sky-950 text-xs block font-black mb-0.5">🚀 다음 한 걸음 (제안)</strong>
                                  <p className="text-slate-800 text-[11px] font-bold">{f.nextStep}</p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  );
}
