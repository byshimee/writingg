import React, { useState } from "react";
import { Lock, Unlock, KeyRound, AlertCircle, CheckCircle2, ShieldCheck, X, Eye, EyeOff } from "lucide-react";

interface TeacherAuthModalProps {
  isOpen: boolean;
  onSuccess: () => void;
  onCancel: () => void;
}

export default function TeacherAuthModal({ isOpen, onSuccess, onCancel }: TeacherAuthModalProps) {
  const [inputPin, setInputPin] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isChangingPin, setIsChangingPin] = useState(false);
  
  // Stored PIN (default is 'teacher312')
  const [currentSavedPin, setCurrentSavedPin] = useState<string>(() => {
    return localStorage.getItem("teacher_auth_pin") || "teacher312";
  });

  const [oldPinForChange, setOldPinForChange] = useState("");
  const [newPinForChange, setNewPinForChange] = useState("");
  const [changeSuccess, setChangeSuccess] = useState("");

  if (!isOpen) return null;

  const handleSubmitPin = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputPin.trim() === currentSavedPin.trim()) {
      setErrorMsg("");
      setInputPin("");
      onSuccess();
    } else {
      setErrorMsg("비밀번호가 일치하지 않습니다. 다시 입력해 주세요.");
    }
  };

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (oldPinForChange.trim() !== currentSavedPin.trim()) {
      setErrorMsg("현재 비밀번호가 올바르지 않습니다.");
      return;
    }
    if (newPinForChange.trim().length < 2) {
      setErrorMsg("새 비밀번호는 2자리 이상 입력해 주세요.");
      return;
    }

    localStorage.setItem("teacher_auth_pin", newPinForChange.trim());
    setCurrentSavedPin(newPinForChange.trim());
    setChangeSuccess("비밀번호가 성공적으로 변경되었습니다!");
    setErrorMsg("");
    setOldPinForChange("");
    setNewPinForChange("");
    setTimeout(() => {
      setChangeSuccess("");
      setIsChangingPin(false);
    }, 1500);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div 
        className="bg-white rounded-xl border-4 border-slate-900 shadow-[8px_8px_0px_0px_rgba(15,23,42,1)] w-full max-w-md p-6 relative animate-in fade-in zoom-in-95 duration-150"
        id="teacher-auth-modal"
      >
        {/* Close Button */}
        <button
          onClick={onCancel}
          className="absolute top-4 right-4 p-1.5 rounded-md hover:bg-slate-100 border border-transparent hover:border-slate-900 transition-colors text-slate-500 hover:text-slate-900 cursor-pointer"
          title="닫기 (학생 화면으로)"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="bg-indigo-100 border-2 border-slate-900 p-2.5 rounded-lg text-indigo-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-black text-slate-900">선생님 전용 인증</h2>
            <p className="text-xs text-slate-600 font-bold">학생들의 루브릭 평가 및 피드백 승인 관리실입니다.</p>
          </div>
        </div>

        {!isChangingPin ? (
          <div>
            <form onSubmit={handleSubmitPin} className="space-y-4">
              <div>
                <label className="block text-xs font-black text-slate-800 mb-1.5">
                  선생님 비밀번호 입력
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    autoFocus
                    value={inputPin}
                    onChange={(e) => {
                      setInputPin(e.target.value);
                      setErrorMsg("");
                    }}
                    placeholder="비밀번호를 입력하세요"
                    className="w-full text-center text-lg font-black py-3 px-10 rounded-lg border-2 border-slate-900 bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-400 focus:border-slate-900"
                  />
                  <KeyRound className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-900 p-1"
                    title={showPassword ? "비밀번호 숨기기" : "비밀번호 보기"}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Error Message */}
              {errorMsg && (
                <div className="bg-rose-50 border-2 border-rose-400 text-rose-800 text-xs font-bold p-2.5 rounded flex items-center gap-2 animate-shake">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={onCancel}
                  className="flex-1 py-2.5 px-3 rounded-lg border-2 border-slate-900 bg-white hover:bg-slate-100 text-slate-800 font-black text-xs transition-all shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] cursor-pointer"
                >
                  학생 화면으로 돌아가기
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 px-3 rounded-lg border-2 border-slate-900 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs transition-all shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Unlock className="w-4 h-4" />
                  <span>선생님 화면 열기</span>
                </button>
              </div>
            </form>

            <div className="mt-4 pt-3 border-t border-slate-200 flex justify-between items-center text-[11px]">
              <span className="text-slate-500 font-medium">비밀번호 변경이 필요하신가요?</span>
              <button
                type="button"
                onClick={() => {
                  setIsChangingPin(true);
                  setErrorMsg("");
                }}
                className="text-indigo-600 hover:text-indigo-800 font-black hover:underline cursor-pointer"
              >
                비밀번호 변경하기 ⚙️
              </button>
            </div>
          </div>
        ) : (
          /* Change Password Form */
          <form onSubmit={handleChangePassword} className="space-y-3.5">
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-300">
              <h3 className="text-xs font-black text-slate-900 mb-3 flex items-center gap-1.5">
                <KeyRound className="w-4 h-4 text-indigo-600" />
                <span>선생님 비밀번호 변경</span>
              </h3>

              <div className="space-y-2.5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">현재 비밀번호</label>
                  <input
                    type="password"
                    value={oldPinForChange}
                    onChange={(e) => setOldPinForChange(e.target.value)}
                    placeholder="현재 비밀번호 입력"
                    className="w-full text-xs font-bold py-2 px-3 rounded border border-slate-400 bg-white"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">새 비밀번호</label>
                  <input
                    type="password"
                    value={newPinForChange}
                    onChange={(e) => setNewPinForChange(e.target.value)}
                    placeholder="새로운 비밀번호 입력"
                    className="w-full text-xs font-bold py-2 px-3 rounded border border-slate-400 bg-white"
                  />
                </div>
              </div>
            </div>

            {errorMsg && (
              <div className="bg-rose-50 border border-rose-400 text-rose-800 text-xs font-bold p-2 rounded flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{errorMsg}</span>
              </div>
            )}

            {changeSuccess && (
              <div className="bg-emerald-50 border border-emerald-400 text-emerald-800 text-xs font-bold p-2 rounded flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                <span>{changeSuccess}</span>
              </div>
            )}

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setIsChangingPin(false);
                  setErrorMsg("");
                }}
                className="flex-1 py-2 px-3 rounded-lg border-2 border-slate-900 bg-white hover:bg-slate-100 text-slate-800 font-black text-xs shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] cursor-pointer"
              >
                취소
              </button>
              <button
                type="submit"
                className="flex-1 py-2 px-3 rounded-lg border-2 border-slate-900 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] cursor-pointer"
              >
                비밀번호 저장
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
