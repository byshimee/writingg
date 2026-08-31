import React, { useState } from "react";
import { Assignment, RubricCriterion } from "../types";
import { Sparkles, Plus, BookOpen, Layers, Edit3, Check, Trash2, HelpCircle } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface AssignmentPanelProps {
  assignments: Assignment[];
  activeAssignment: Assignment | null;
  onSelectAssignment: (assignment: Assignment) => void;
  onAddAssignment: (assignment: Assignment) => void;
  onUpdateRubric: (assignmentId: string, rubric: RubricCriterion[]) => void;
  onDeleteAssignment: (assignmentId: string) => void;
}

export default function AssignmentPanel({
  assignments,
  activeAssignment,
  onSelectAssignment,
  onAddAssignment,
  onUpdateRubric,
  onDeleteAssignment,
}: AssignmentPanelProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [isLoadingRubric, setIsLoadingRubric] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [editingCriterionId, setEditingCriterionId] = useState<string | null>(null);
  const [editedCriterion, setEditedCriterion] = useState<RubricCriterion | null>(null);
  const [isExpandedAssignments, setIsExpandedAssignments] = useState(false);
  const [isExpandedRubric, setIsExpandedRubric] = useState(false);

  // Call API to generate Rubric via Gemini
  const handleGenerateRubric = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newDesc.trim()) {
      setErrorMessage("과제 제목과 과제 설명을 모두 입력해 주세요.");
      return;
    }

    setIsLoadingRubric(true);
    setErrorMessage("");

    try {
      const response = await fetch("/api/gemini/generate-rubric", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle, description: newDesc }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "루브릭 생성 실패");
      }

      const data = await response.json();

      // Formulate new assignment
      const newAssignment: Assignment = {
        id: "task-" + Date.now(),
        title: newTitle,
        description: newDesc,
        rubric: data.rubric.map((item: any, idx: number) => ({
          id: `c-${idx}-${Date.now()}`,
          name: item.name,
          description: item.description,
          levels: item.levels,
        })),
        createdAt: new Date().toISOString(),
      };

      onAddAssignment(newAssignment);
      setNewTitle("");
      setNewDesc("");
      setIsCreating(false);
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || "서버와 연결하는 중 오류가 발생했습니다.");
    } finally {
      setIsLoadingRubric(false);
    }
  };

  // Start editing a criterion
  const startEditCriterion = (criterion: RubricCriterion) => {
    setEditingCriterionId(criterion.id);
    setEditedCriterion(JSON.parse(JSON.stringify(criterion))); // deep copy
  };

  // Handle edited criterion fields
  const saveCriterionEdit = () => {
    if (!editedCriterion || !activeAssignment) return;

    const updatedRubric = activeAssignment.rubric.map((c) =>
      c.id === editedCriterion.id ? editedCriterion : c
    );

    onUpdateRubric(activeAssignment.id, updatedRubric);
    setEditingCriterionId(null);
    setEditedCriterion(null);
  };

  return (
    <div className="neo-card p-6 flex flex-col h-full bg-white" id="assignment-panel-container">
      {/* Header */}
      <div className="flex items-center justify-between mb-5 border-b-2 border-slate-900 pb-4">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-300 border-2 border-slate-900 p-2.5 rounded-lg shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]">
            <BookOpen className="w-5 h-5 text-slate-900" />
          </div>
          <h2 className="text-xl font-extrabold text-slate-900 text-editorial-title">1. 평가 과제 및 루브릭 설계</h2>
        </div>
        <button
          onClick={() => setIsCreating(!isCreating)}
          className={`px-3 py-1.5 rounded text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer border-2 border-slate-900 ${
            isCreating
              ? "bg-slate-100 text-slate-700 shadow-none"
              : "bg-indigo-500 text-white hover:bg-indigo-600 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] active:translate-x-[1px] active:translate-y-[1px]"
          }`}
          id="btn-toggle-create-assignment"
        >
          {isCreating ? "취소" : <><Plus className="w-3.5 h-3.5" /> 새 과제 등록</>}
        </button>
      </div>

      <AnimatePresence mode="wait">
        {isCreating ? (
          <motion.form
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            onSubmit={handleGenerateRubric}
            className="space-y-4 bg-indigo-50 p-4 rounded border-2 border-slate-900 shadow-[3px_3px_0px_0px_rgba(15,23,42,1)] mb-5 text-slate-900"
            id="create-assignment-form"
          >
            <div>
              <label className="block text-xs font-black text-slate-900 mb-1.5 uppercase">과제 제목</label>
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="예: 초3 환경 보호를 위한 주장하는 글쓰기"
                className="w-full px-3 py-2 rounded border-2 border-slate-900 bg-white text-sm font-bold text-slate-900 focus:outline-none focus:border-indigo-500 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]"
                disabled={isLoadingRubric}
                id="input-new-assignment-title"
              />
            </div>

            <div>
              <label className="block text-xs font-black text-slate-900 mb-1.5 uppercase">과제 설명 및 가이드라인</label>
              <textarea
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="예: 학생들이 작성해야 하는 과제에 대한 상세 설명 및 글쓰기 지시사항을 적어 주세요. 초3 수준의 쉽고 재미있는 평가 기준이 자동 설계됩니다."
                className="w-full h-24 px-3 py-2 rounded border-2 border-slate-900 bg-white text-sm font-bold text-slate-900 focus:outline-none focus:border-indigo-500 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] resize-none"
                disabled={isLoadingRubric}
                id="textarea-new-assignment-desc"
              />
            </div>

            {errorMessage && (
              <p className="text-xs text-rose-950 font-bold bg-rose-200 border border-rose-900 p-2.5 rounded">
                {errorMessage}
              </p>
            )}

            <button
              type="submit"
              disabled={isLoadingRubric}
              className="w-full bg-indigo-500 hover:bg-indigo-600 disabled:bg-slate-300 text-white text-xs font-extrabold py-2.5 px-4 rounded border-2 border-slate-900 shadow-[3px_3px_0px_0px_rgba(15,23,42,1)] active:translate-x-[1px] active:translate-y-[1px] flex items-center justify-center gap-2 transition-all cursor-pointer"
              id="btn-generate-rubric"
            >
              {isLoadingRubric ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>Gemini AI가 초3 맞춤 수준별 루브릭을 집필하는 중...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>AI 루브릭 설계 및 과제 등록</span>
                </>
              )}
            </button>
          </motion.form>
        ) : null}
      </AnimatePresence>

      {/* Assignment Selector with 3~5 Max Display and Expand Handle */}
      <div className="mb-5">
        <div className="flex items-center justify-between mb-2">
          <label className="block text-xs font-black text-slate-700 uppercase tracking-wider">
            등록된 과제 목록 ({assignments.length}개)
          </label>
          {assignments.length > 3 && (
            <button
              type="button"
              onClick={() => setIsExpandedAssignments(!isExpandedAssignments)}
              className="text-[11px] font-black text-indigo-900 bg-indigo-50 hover:bg-indigo-100 px-2 py-0.5 rounded border border-indigo-300 cursor-pointer flex items-center gap-1 shadow-xs"
              id="btn-toggle-expand-assignments"
            >
              {isExpandedAssignments ? "🔼 3개만 접어보기" : `🔽 전체 ${assignments.length}개 펼치기`}
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 gap-2.5 max-h-[300px] overflow-y-auto pr-1" id="assignment-list-selector">
          {(isExpandedAssignments ? assignments : assignments.slice(0, 3)).map((assignment) => {
            const isActive = activeAssignment?.id === assignment.id;
            return (
              <div
                key={assignment.id}
                onClick={() => onSelectAssignment(assignment)}
                className={`group p-3 rounded border-2 border-slate-900 text-left transition-all cursor-pointer flex items-center justify-between ${
                  isActive
                    ? "bg-yellow-200 text-slate-900 shadow-[3px_3px_0px_0px_rgba(15,23,42,1)] scale-[1.01]"
                    : "bg-slate-50 hover:bg-slate-100 shadow-[1px_1px_0px_0px_rgba(15,23,42,1)]"
                }`}
                id={`assignment-item-${assignment.id}`}
              >
                <div className="flex-1 min-w-0 pr-2">
                  <h3 className="text-xs font-black truncate text-slate-900">
                    {assignment.title}
                  </h3>
                  <p className="text-[10px] text-slate-600 truncate mt-0.5 font-medium">{assignment.description}</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className={`text-[9px] px-2 py-0.5 rounded font-black border border-slate-950 ${
                    isActive ? "bg-white text-slate-900" : "bg-slate-200 text-slate-700"
                  }`}>
                    기준 {assignment.rubric.length}개
                  </span>
                  {assignments.length > 1 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm("이 과제와 루브릭을 삭제하시겠습니까? 관련 피드백 데이터는 삭제되지 않지만 보기가 비활성화됩니다.")) {
                          onDeleteAssignment(assignment.id);
                        }
                      }}
                      className="opacity-100 p-1 text-slate-600 hover:text-rose-600 rounded transition-all"
                      title="과제 삭제"
                      id={`btn-delete-assignment-${assignment.id}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Active Rubric Criteria Table (수준별 평가 기준표) */}
      <div className="flex-1 flex flex-col min-h-[250px]">
        {activeAssignment ? (
          <div className="flex flex-col h-full" id="active-rubric-table-section">
            <div className="border-t-2 border-slate-900 pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-indigo-600" />
                  성취 기준표 (루브릭 {activeAssignment.rubric.length}개)
                </span>
                {activeAssignment.rubric.length > 3 && (
                  <button
                    type="button"
                    onClick={() => setIsExpandedRubric(!isExpandedRubric)}
                    className="text-[10px] font-black text-indigo-900 bg-indigo-50 hover:bg-indigo-100 px-2 py-0.5 rounded border border-indigo-300 cursor-pointer flex items-center gap-1"
                    id="btn-toggle-expand-rubric"
                  >
                    {isExpandedRubric ? "🔼 3개만 접기" : `🔽 전체 ${activeAssignment.rubric.length}개 펼치기`}
                  </button>
                )}
              </div>
              <span className="text-[10px] text-indigo-950 font-black bg-indigo-100 border border-indigo-200 px-2.5 py-0.5 rounded">
                💡 행을 누르면 실시간 개별 편집 가능
              </span>
            </div>

            {/* Rubric View Table */}
            <div className="flex-1 overflow-y-auto border-2 border-slate-900 rounded overflow-hidden bg-white max-h-[350px]">
              <table className="w-full text-left border-collapse text-xs font-medium">
                <thead>
                  <tr className="bg-slate-900 text-white font-extrabold text-xs">
                    <th className="p-2.5 w-1/4 border-r border-white/20">평가 기준 항목</th>
                    <th className="p-2.5 w-1/4 bg-indigo-900 border-r border-white/20">수준: 상 ⭐⭐⭐</th>
                    <th className="p-2.5 w-1/4 bg-slate-800 border-r border-white/20">수준: 중 ⭐⭐</th>
                    <th className="p-2.5 w-1/4 bg-slate-700">수준: 하 ⭐</th>
                  </tr>
                </thead>
                <tbody className="divide-y-2 divide-slate-900">
                  {(isExpandedRubric ? activeAssignment.rubric : activeAssignment.rubric.slice(0, 3)).map((criterion) => {
                    const isSelectedForEdit = editingCriterionId === criterion.id;
                    const levelSang = criterion.levels.find(l => l.level === "상")?.description || "";
                    const levelJung = criterion.levels.find(l => l.level === "중")?.description || "";
                    const levelHa = criterion.levels.find(l => l.level === "하")?.description || "";

                    return (
                      <tr
                        key={criterion.id}
                        onClick={() => startEditCriterion(criterion)}
                        className={`hover:bg-slate-50 cursor-pointer transition-colors ${
                          isSelectedForEdit ? "bg-yellow-50 font-semibold" : ""
                        }`}
                        id={`rubric-row-${criterion.id}`}
                      >
                        <td className="p-2.5 align-top border-r-2 border-slate-900">
                          <div className="font-extrabold text-slate-900 flex items-center gap-1">
                            {criterion.name}
                          </div>
                          <p className="text-[10px] text-slate-500 mt-1 leading-relaxed">{criterion.description}</p>
                        </td>
                        <td className="p-2.5 align-top text-slate-800 bg-indigo-50/15 leading-relaxed border-l-2 border-slate-900">
                          {levelSang}
                        </td>
                        <td className="p-2.5 align-top text-slate-700 leading-relaxed border-l-2 border-slate-900">
                          {levelJung}
                        </td>
                        <td className="p-2.5 align-top text-slate-500 leading-relaxed border-l-2 border-slate-900">
                          {levelHa}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Rubric Interactive Editor (하단 편집 패널) */}
            <AnimatePresence>
              {editingCriterionId && editedCriterion ? (
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 15 }}
                  className="mt-3 bg-yellow-100 p-4 rounded border-2 border-slate-900 shadow-[3px_3px_0px_0px_rgba(15,23,42,1)] text-xs space-y-3"
                  id="rubric-editor-panel"
                >
                  <div className="flex items-center justify-between border-b border-slate-900/10 pb-2">
                    <span className="font-black text-slate-900 flex items-center gap-1.5">
                      <Edit3 className="w-3.5 h-3.5 text-indigo-700" />
                      [{editedCriterion.name}] 기준 및 수준별 문구 개별 편집
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setEditingCriterionId(null)}
                        className="px-2 py-1 bg-white hover:bg-slate-50 border border-slate-900 rounded text-[10px] font-bold text-slate-700 cursor-pointer"
                        id="btn-cancel-rubric-edit"
                      >
                        취소
                      </button>
                      <button
                        onClick={saveCriterionEdit}
                        className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-white border border-slate-900 rounded text-[10px] font-black flex items-center gap-1 cursor-pointer shadow-[1px_1px_0px_0px_#000]"
                        id="btn-save-rubric-edit"
                      >
                        <Check className="w-3 h-3" /> 저장
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-slate-800 mb-1">기준명</label>
                      <input
                        type="text"
                        value={editedCriterion.name}
                        onChange={(e) => setEditedCriterion({ ...editedCriterion, name: e.target.value })}
                        className="w-full px-2 py-1.5 rounded border border-slate-900 bg-white font-bold text-slate-900"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-800 mb-1">기준 세부 설명</label>
                      <input
                        type="text"
                        value={editedCriterion.description}
                        onChange={(e) => setEditedCriterion({ ...editedCriterion, description: e.target.value })}
                        className="w-full px-2 py-1.5 rounded border border-slate-900 bg-white text-slate-800"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2 pt-1.5 border-t border-slate-900/10">
                    <div>
                      <label className="block font-black text-indigo-900 mb-0.5">상 성취 수준</label>
                      <textarea
                        value={editedCriterion.levels.find(l => l.level === "상")?.description || ""}
                        onChange={(e) => {
                          const updatedLevels = editedCriterion.levels.map(l =>
                            l.level === "상" ? { ...l, description: e.target.value } : l
                          );
                          setEditedCriterion({ ...editedCriterion, levels: updatedLevels });
                        }}
                        className="w-full h-16 p-1.5 rounded border border-slate-900 bg-white text-[11px] font-medium resize-none text-slate-800"
                      />
                    </div>
                    <div>
                      <label className="block font-black text-slate-700 mb-0.5">중 성취 수준</label>
                      <textarea
                        value={editedCriterion.levels.find(l => l.level === "중")?.description || ""}
                        onChange={(e) => {
                          const updatedLevels = editedCriterion.levels.map(l =>
                            l.level === "중" ? { ...l, description: e.target.value } : l
                          );
                          setEditedCriterion({ ...editedCriterion, levels: updatedLevels });
                        }}
                        className="w-full h-16 p-1.5 rounded border border-slate-900 bg-white text-[11px] font-medium resize-none text-slate-800"
                      />
                    </div>
                    <div>
                      <label className="block font-black text-slate-600 mb-0.5">하 성취 수준</label>
                      <textarea
                        value={editedCriterion.levels.find(l => l.level === "하")?.description || ""}
                        onChange={(e) => {
                          const updatedLevels = editedCriterion.levels.map(l =>
                            l.level === "하" ? { ...l, description: e.target.value } : l
                          );
                          setEditedCriterion({ ...editedCriterion, levels: updatedLevels });
                        }}
                        className="w-full h-16 p-1.5 rounded border border-slate-900 bg-white text-[11px] font-medium resize-none text-slate-800"
                      />
                    </div>
                  </div>
                </motion.div>
              ) : (
                <div className="mt-3 bg-slate-50 p-3 rounded border border-slate-300 text-[11px] text-slate-600 flex items-center justify-center gap-1 font-bold">
                  <HelpCircle className="w-3.5 h-3.5 text-slate-500" />
                  <span>위 표에서 평가 기준의 행(Row)을 누르면 성취 수준별 문구를 자유롭게 수정할 수 있습니다.</span>
                </div>
              )}
            </AnimatePresence>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 text-xs p-6" id="no-active-assignment-rubric">
            <Layers className="w-8 h-8 text-slate-300 mb-2" />
            <p>선택된 과제가 없습니다. 위 목록에서 과제를 선택해 주세요.</p>
          </div>
        )}
      </div>
    </div>
  );
}
