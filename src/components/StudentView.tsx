import React, { useState, useRef, useEffect } from "react";
import { Assignment, StudentSubmission, CriterionFeedback } from "../types";
import {
  Mic, MicOff, Camera, FileUp, FileText, Send, CheckCircle2,
  Clock, Sparkles, UploadCloud, AlertCircle, RefreshCw, Trash2, Heart, Award,
  ChevronLeft, ChevronRight
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface StudentViewProps {
  assignments: Assignment[];
  activeAssignmentId: string;
  submissions: StudentSubmission[];
  onSubmitAnswer: (submission: StudentSubmission) => void;
  onSelectAssignment: (assignment: Assignment) => void;
}

type InputMode = "photo" | "text" | "voice" | "pdf";

export default function StudentView({
  assignments,
  activeAssignmentId,
  submissions,
  onSubmitAnswer,
  onSelectAssignment,
}: StudentViewProps) {
  // 1. Selected Student Number (1 to 25)
  const [selectedNumber, setSelectedNumber] = useState<number>(1);
  const maxStudents = 25;

  // 2. Active Assignment
  const currentAssignment = assignments.find((a) => a.id === activeAssignmentId) || assignments[0] || null;
  const assignmentScrollRef = useRef<HTMLDivElement>(null);

  // 3. Current Student's Submission for this assignment
  const currentSubmission = submissions.find(
    (s) => s.assignmentId === currentAssignment?.id && s.studentNumber === selectedNumber
  );

  // Input states (default to photo as requested)
  const [studentAnswer, setStudentAnswer] = useState("");
  const [inputMode, setInputMode] = useState<InputMode>("photo");
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // Media recording / camera states
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);

  const [showCamera, setShowCamera] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // File Inputs
  const audioFileInputRef = useRef<HTMLInputElement>(null);
  const photoFileInputRef = useRef<HTMLInputElement>(null);
  const pdfFileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);

  // Scroll assignment carousel
  const handleScrollAssignments = (direction: "left" | "right") => {
    if (assignmentScrollRef.current) {
      const scrollAmount = direction === "left" ? -240 : 240;
      assignmentScrollRef.current.scrollBy({ left: scrollAmount, behavior: "smooth" });
    }
  };

  const handleSelectPreviousAssignment = () => {
    if (!currentAssignment || assignments.length <= 1) return;
    const currentIndex = assignments.findIndex((a) => a.id === currentAssignment.id);
    const prevIndex = currentIndex > 0 ? currentIndex - 1 : assignments.length - 1;
    onSelectAssignment(assignments[prevIndex]);
  };

  const handleSelectNextAssignment = () => {
    if (!currentAssignment || assignments.length <= 1) return;
    const currentIndex = assignments.findIndex((a) => a.id === currentAssignment.id);
    const nextIndex = currentIndex < assignments.length - 1 ? currentIndex + 1 : 0;
    onSelectAssignment(assignments[nextIndex]);
  };

  // Cleanup media
  useEffect(() => {
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach((track) => track.stop());
      }
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
    };
  }, [cameraStream]);

  // Sync draft if student already submitted or change student number
  useEffect(() => {
    if (currentSubmission) {
      setStudentAnswer(currentSubmission.studentAnswer);
    } else {
      setStudentAnswer("");
    }
    setErrorMessage("");
    setSuccessMessage("");
  }, [selectedNumber, currentAssignment?.id]);

  // Base64 converter
  const convertFileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(",")[1];
        resolve(base64);
      };
      reader.onerror = (error) => reject(error);
    });
  };

  const convertBlobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onloadend = () => {
        const base64 = (reader.result as string).split(",")[1];
        resolve(base64);
      };
      reader.onerror = reject;
    });
  };

  // Multimodal file transcription (Voice / Photo / PDF)
  const handleTranscribeFile = async (base64Data: string, mimeType: string) => {
    setIsTranscribing(true);
    setErrorMessage("");
    setSuccessMessage("Gemini가 소중한 답안을 읽어서 글자로 변환하고 있어요... 🧸");

    try {
      const res = await fetch("/api/gemini/transcribe-file", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileData: base64Data, mimeType }),
      });

      if (!res.ok) {
        throw new Error("답안을 인식하는 데 실패했습니다. 다시 시도해 주세요.");
      }

      const data = await res.json();
      setStudentAnswer(data.text);
      setSuccessMessage("성공적으로 글자가 입력되었습니다! 아래 [선생님께 제출하기]를 눌러주세요.");
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || "파일 변환 중 오류가 발생했습니다.");
    } finally {
      setIsTranscribing(false);
    }
  };

  // Audio Recording
  const handleStartRecording = async () => {
    try {
      setErrorMessage("");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(chunks, { type: "audio/webm" });
        const base64 = await convertBlobToBase64(audioBlob);
        await handleTranscribeFile(base64, "audio/webm");
        stream.getTracks().forEach((t) => t.stop());
      };

      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
      setRecordingSeconds(0);
      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error(err);
      setErrorMessage("마이크를 켤 수 없습니다. 대신 직접 타이핑하거나 모의 음성 버튼을 눌러보세요!");
    }
  };

  const handleStopRecording = () => {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
      setIsRecording(false);
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
    }
  };

  // Camera
  const handleStartCamera = async () => {
    try {
      setErrorMessage("");
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      setCameraStream(stream);
      setShowCamera(true);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      }, 200);
    } catch (err) {
      console.error(err);
      setErrorMessage("카메라를 켤 수 없습니다. 사진 파일 업로드를 이용해 주세요.");
    }
  };

  const handleStopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((t) => t.stop());
      setCameraStream(null);
    }
    setShowCamera(false);
  };

  const handleCapturePhoto = () => {
    if (videoRef.current) {
      const video = videoRef.current;
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL("image/png");
        const base64 = dataUrl.split(",")[1];
        handleTranscribeFile(base64, "image/png");
        handleStopCamera();
      }
    }
  };

  // Mock Simulations for easy testing
  const handleLoadVoiceSimulation = () => {
    setStudentAnswer("선생님, 오늘 수업 시간에 쓰레기를 줄이는 방법을 배웠어요. 저는 앞으로 급식을 먹을 때 남기지 않고 다 먹을 거고, 플라스틱 물병 대신 개인 텀블러를 가지고 다닐 거예요!");
    setSuccessMessage("초3 학생의 말하기 음성이 자동으로 텍스트로 들어왔습니다! 🎙️");
    setTimeout(() => setSuccessMessage(""), 4000);
  };

  const handleLoadPhotoSimulation = () => {
    setStudentAnswer("우리는 지구를 지키기 위해 비닐봉지 대신 장바구니를 쓰고, 가까운 거리는 차를 타지 않고 걸어 다녀야 합니다. 친구들과 함께 실천하면 지구가 깨끗해집니다.");
    setSuccessMessage("공책 손글씨 사진이 깨끗하게 인식되었습니다! 📸");
    setTimeout(() => setSuccessMessage(""), 4000);
  };

  // File Upload Handlers
  const handleAudioFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const base64 = await convertFileToBase64(file);
      await handleTranscribeFile(base64, file.type || "audio/mp3");
    }
  };

  const handlePhotoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const base64 = await convertFileToBase64(file);
      await handleTranscribeFile(base64, file.type || "image/png");
    }
  };

  const handlePdfFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const base64 = await convertFileToBase64(file);
      await handleTranscribeFile(base64, file.type || "application/pdf");
    }
  };

  // Drag & Drop
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type.includes("image")) {
        convertFileToBase64(file).then((b) => handleTranscribeFile(b, file.type));
      } else if (file.type.includes("pdf")) {
        convertFileToBase64(file).then((b) => handleTranscribeFile(b, "application/pdf"));
      } else {
        const reader = new FileReader();
        reader.onload = (event) => {
          if (event.target && typeof event.target.result === "string") {
            setStudentAnswer(event.target.result);
          }
        };
        reader.readAsText(file);
      }
    }
  };

  // Student Submits Answer (No feedback trigger here - only Teacher can review and publish)
  const handleSubmitAssignment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentAssignment) {
      setErrorMessage("제출할 과제가 없습니다.");
      return;
    }
    if (!studentAnswer.trim()) {
      setErrorMessage("답안 내용을 적어주시거나, 말하기/사진으로 답안을 넣어주세요!");
      return;
    }

    const newSubmission: StudentSubmission = {
      id: currentSubmission?.id || `sub-${currentAssignment.id}-${selectedNumber}-${Date.now()}`,
      assignmentId: currentAssignment.id,
      assignmentTitle: currentAssignment.title,
      studentNumber: selectedNumber,
      studentAnswer: studentAnswer.trim(),
      submittedAt: new Date().toISOString(),
      // Retain existing feedback if re-submitting or keep status
      status: currentSubmission?.status === "published" ? "submitted" : (currentSubmission?.status || "submitted"),
      feedbacks: currentSubmission?.feedbacks,
      publishedAt: currentSubmission?.publishedAt,
    };

    onSubmitAnswer(newSubmission);
    setSuccessMessage(`${selectedNumber}번 학생의 과제가 선생님께 성공적으로 제출되었습니다! 🎉`);
    setTimeout(() => setSuccessMessage(""), 5000);
  };

  return (
    <div className="space-y-6" id="student-view-container">
      {/* 1. Assignment Selection Banner with Carousel Navigation */}
      <div className="bg-white p-5 rounded border-2 border-slate-900 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3 border-b-2 border-slate-900 pb-3">
          <div className="flex items-center gap-2">
            <span className="bg-yellow-300 border-2 border-slate-900 text-slate-900 font-extrabold text-xs px-2 py-1 rounded shadow-[1px_1px_0px_0px_#000]">
              1단계
            </span>
            <h2 className="text-base font-black text-slate-900">오늘 할 과제 선택하기</h2>
          </div>

          {/* Carousel Arrows and Assignment Pills */}
          <div className="flex items-center gap-1.5 max-w-full sm:max-w-xl">
            {assignments.length > 1 && (
              <button
                type="button"
                onClick={() => {
                  handleSelectPreviousAssignment();
                  handleScrollAssignments("left");
                }}
                className="p-1.5 rounded bg-slate-100 hover:bg-yellow-200 border-2 border-slate-900 text-slate-900 shadow-[1px_1px_0px_0px_#000] cursor-pointer shrink-0 active:translate-y-0.5"
                title="이전 과제 보기"
                id="btn-assignment-prev"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            )}

            <div 
              ref={assignmentScrollRef}
              className="flex items-center gap-2 overflow-x-auto py-1 px-0.5 no-scrollbar scroll-smooth"
              style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
            >
              {assignments.map((a, idx) => {
                const isSelected = a.id === currentAssignment?.id;
                return (
                  <button
                    key={a.id}
                    onClick={() => onSelectAssignment(a)}
                    className={`px-3 py-1.5 rounded text-xs font-black transition-all cursor-pointer border-2 border-slate-900 shrink-0 whitespace-nowrap ${
                      isSelected
                        ? "bg-yellow-200 text-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] scale-[1.02]"
                        : "bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                    id={`student-select-assignment-${a.id}`}
                  >
                    <span>{idx + 1}. {a.title}</span>
                  </button>
                );
              })}
            </div>

            {assignments.length > 1 && (
              <button
                type="button"
                onClick={() => {
                  handleSelectNextAssignment();
                  handleScrollAssignments("right");
                }}
                className="p-1.5 rounded bg-slate-100 hover:bg-yellow-200 border-2 border-slate-900 text-slate-900 shadow-[1px_1px_0px_0px_#000] cursor-pointer shrink-0 active:translate-y-0.5"
                title="다음 과제 보기"
                id="btn-assignment-next"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {currentAssignment && (
          <div className="bg-indigo-50/60 p-3.5 rounded border border-indigo-200">
            <h3 className="text-xs font-black text-indigo-950 mb-1">📖 {currentAssignment.title}</h3>
            <p className="text-xs font-bold text-slate-700 leading-relaxed">{currentAssignment.description}</p>
          </div>
        )}
      </div>

      {/* 2. Number Toggle Selector (1 ~ 25 Grid) */}
      <div className="bg-white p-5 rounded border-2 border-slate-900 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)]" id="student-number-selector-box">
        <div className="flex items-center justify-between gap-3 mb-3.5">
          <div className="flex items-center gap-2">
            <span className="bg-yellow-300 border-2 border-slate-900 text-slate-900 font-extrabold text-xs px-2 py-1 rounded shadow-[1px_1px_0px_0px_#000]">
              2단계
            </span>
            <h2 className="text-base font-black text-slate-900">내 출석 번호 선택하기 (1번 ~ 25번)</h2>
          </div>
          <span className="text-xs font-black bg-indigo-100 text-indigo-950 px-2.5 py-1 rounded border border-indigo-300">
            현재 선택: <strong>{selectedNumber}번 학생</strong>
          </span>
        </div>

        <div className="grid grid-cols-5 sm:grid-cols-10 md:grid-cols-13 lg:grid-cols-25 gap-1.5" id="number-toggle-grid">
          {Array.from({ length: maxStudents }, (_, i) => i + 1).map((num) => {
            const isSelected = selectedNumber === num;
            const sub = submissions.find(
              (s) => s.assignmentId === currentAssignment?.id && s.studentNumber === num
            );
            const hasSubmitted = !!sub;
            const isPublished = sub?.status === "published";

            return (
              <button
                key={num}
                type="button"
                onClick={() => setSelectedNumber(num)}
                className={`py-2 px-1 rounded text-xs font-black transition-all cursor-pointer border-2 border-slate-900 flex flex-col items-center justify-center relative ${
                  isSelected
                    ? "bg-yellow-300 text-slate-900 scale-105 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] z-10"
                    : isPublished
                    ? "bg-emerald-100 text-slate-800 hover:bg-emerald-200"
                    : hasSubmitted
                    ? "bg-indigo-100 text-slate-800 hover:bg-indigo-200"
                    : "bg-slate-50 text-slate-700 hover:bg-slate-100"
                }`}
                id={`btn-number-${num}`}
              >
                <span>{num}번</span>
                {isPublished ? (
                  <span className="text-[8px] text-emerald-800 font-bold leading-none mt-0.5">💌 피드백</span>
                ) : hasSubmitted ? (
                  <span className="text-[8px] text-indigo-800 font-bold leading-none mt-0.5">제출됨</span>
                ) : null}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-3 mt-3 text-[11px] font-bold text-slate-600 border-t border-slate-200 pt-2.5">
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-yellow-300 border border-slate-900 inline-block"></span>
            현재 선택된 내 번호
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-indigo-100 border border-slate-900 inline-block"></span>
            과제 제출 완료 (선생님 확인 대기)
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-emerald-100 border border-slate-900 inline-block"></span>
            선생님 피드백 도착! 💌
          </span>
        </div>
      </div>

      {/* 3. Main Workspace: Submit Answer vs View Teacher's Feedback */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left (or Top): Student Answer Submission Form */}
        <div className="lg:col-span-7 bg-white p-5 rounded border-2 border-slate-900 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)]" id="student-submit-box">
          <div className="flex items-center justify-between mb-4 border-b-2 border-slate-900 pb-3">
            <div className="flex items-center gap-2">
              <span className="bg-yellow-300 border-2 border-slate-900 text-slate-900 font-extrabold text-xs px-2 py-1 rounded shadow-[1px_1px_0px_0px_#000]">
                3단계
              </span>
              <h3 className="text-sm font-black text-slate-900">
                {selectedNumber}번 학생의 답안 제출하기
              </h3>
            </div>
            {currentSubmission && (
              <span className="text-[10px] bg-slate-100 border border-slate-900 text-slate-800 px-2 py-0.5 rounded font-black">
                제출 시각: {new Date(currentSubmission.submittedAt).toLocaleTimeString("ko-KR")}
              </span>
            )}
          </div>

          {/* Input Mode Selector (Photo First as requested) */}
          <div className="grid grid-cols-4 gap-2 bg-slate-100 p-1.5 rounded border-2 border-slate-900 mb-4">
            <button
              type="button"
              onClick={() => { setInputMode("photo"); }}
              className={`py-2 rounded text-xs font-black transition-all flex items-center justify-center gap-1 cursor-pointer ${
                inputMode === "photo"
                  ? "bg-emerald-300 text-slate-900 border-2 border-slate-900 shadow-[1px_1px_0px_0px_#000]"
                  : "text-slate-700 hover:bg-slate-200"
              }`}
            >
              <Camera className="w-3.5 h-3.5 text-emerald-800" />
              <span>사진 찍기 📸</span>
            </button>
            <button
              type="button"
              onClick={() => { setInputMode("text"); handleStopCamera(); }}
              className={`py-2 rounded text-xs font-black transition-all flex items-center justify-center gap-1 cursor-pointer ${
                inputMode === "text"
                  ? "bg-indigo-300 text-slate-900 border-2 border-slate-900 shadow-[1px_1px_0px_0px_#000]"
                  : "text-slate-700 hover:bg-slate-200"
              }`}
            >
              <FileText className="w-3.5 h-3.5 text-indigo-800" />
              <span>직접 쓰기 ✍️</span>
            </button>
            <button
              type="button"
              onClick={() => { setInputMode("voice"); handleStopCamera(); }}
              className={`py-2 rounded text-xs font-black transition-all flex items-center justify-center gap-1 cursor-pointer ${
                inputMode === "voice"
                  ? "bg-yellow-300 text-slate-900 border-2 border-slate-900 shadow-[1px_1px_0px_0px_#000]"
                  : "text-slate-700 hover:bg-slate-200"
              }`}
            >
              <Mic className="w-3.5 h-3.5 text-rose-500 animate-pulse" />
              <span>말하기 녹음 🎙️</span>
            </button>
            <button
              type="button"
              onClick={() => { setInputMode("pdf"); handleStopCamera(); }}
              className={`py-2 rounded text-xs font-black transition-all flex items-center justify-center gap-1 cursor-pointer ${
                inputMode === "pdf"
                  ? "bg-pink-300 text-slate-900 border-2 border-slate-900 shadow-[1px_1px_0px_0px_#000]"
                  : "text-slate-700 hover:bg-slate-200"
              }`}
            >
              <FileUp className="w-3.5 h-3.5 text-pink-700" />
              <span>PDF/이미지 📄</span>
            </button>
          </div>

          <form onSubmit={handleSubmitAssignment} className="space-y-4">
            {/* Direct Keyboard Text Mode */}
            {inputMode === "text" && (
              <div
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                className={`relative rounded border-2 border-slate-900 transition-all ${
                  dragActive ? "bg-indigo-50" : "bg-white"
                } shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]`}
              >
                {/* Paragraph Formatting Helper Bar */}
                <div className="flex flex-wrap items-center justify-between px-3 py-1.5 bg-slate-100 border-b border-slate-300 text-xs gap-2">
                  <span className="text-[11px] font-black text-slate-700">
                    ✍️ 문단 서식 도구 (들여쓰기 & 줄바꿈)
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
                      + 새 문단 들여쓰기(  )
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const lines = studentAnswer.split("\n");
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
                  placeholder="내가 생각한 답이나 글을 여기에 정성껏 적어보세요... (Tab 키 또는 위 버튼으로 문단 들여쓰기가 가능합니다)"
                  className="w-full h-44 p-3 bg-transparent text-sm font-bold focus:outline-none resize-y block leading-relaxed text-slate-900 whitespace-pre-wrap font-sans"
                  disabled={isTranscribing}
                  id="student-answer-textarea"
                />
                {dragActive && (
                  <div className="absolute inset-0 bg-yellow-200/95 rounded flex flex-col items-center justify-center text-slate-900 font-extrabold text-xs">
                    <UploadCloud className="w-8 h-8 text-slate-900 mb-1 animate-bounce" />
                    <span>파일을 여기에 놓으면 글자를 읽어옵니다!</span>
                  </div>
                )}
              </div>
            )}

            {/* Voice Recorder Mode */}
            {inputMode === "voice" && (
              <div className="bg-rose-50/70 p-4 rounded border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  {isRecording ? (
                    <div className="flex items-center gap-1.5 bg-rose-200 border border-slate-900 px-3 py-1.5 rounded-full text-xs font-extrabold text-rose-900 animate-pulse">
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-600"></span>
                      <span>목소리 녹음 중... {recordingSeconds}초</span>
                    </div>
                  ) : (
                    <span className="text-xs font-black text-rose-950">
                      🎙️ 마이크를 켜고 큰 소리로 또박또박 말해보세요!
                    </span>
                  )}

                  <div className="flex items-center gap-2">
                    {!isRecording ? (
                      <button
                        type="button"
                        onClick={handleStartRecording}
                        disabled={isTranscribing}
                        className="px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white font-black text-xs rounded border-2 border-slate-900 shadow-[2px_2px_0px_0px_#000] cursor-pointer flex items-center gap-1.5 active:translate-y-[1px]"
                      >
                        <Mic className="w-4 h-4" />
                        <span>녹음 시작</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={handleStopRecording}
                        className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-black text-xs rounded border-2 border-slate-900 shadow-[2px_2px_0px_0px_#000] cursor-pointer flex items-center gap-1.5"
                      >
                        <MicOff className="w-4 h-4" />
                        <span>녹음 끝내기</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={handleLoadVoiceSimulation}
                      className="px-3 py-2 bg-yellow-200 hover:bg-yellow-300 text-slate-900 font-bold text-xs rounded border border-slate-900 shadow-[1px_1px_0px_0px_#000] cursor-pointer"
                      title="연습용 모의 음성 불러오기"
                    >
                      모의 음성 불러오기 🧸
                    </button>
                  </div>
                </div>

                <div className="border-t border-slate-200 pt-2 flex items-center justify-between text-[11px]">
                  <span className="font-bold text-slate-600">또는 녹음 파일 업로드:</span>
                  <button
                    type="button"
                    onClick={() => audioFileInputRef.current?.click()}
                    className="font-bold text-slate-900 underline hover:text-indigo-600"
                  >
                    파일 선택하기
                  </button>
                  <input
                    type="file"
                    ref={audioFileInputRef}
                    onChange={handleAudioFileChange}
                    accept="audio/*"
                    className="hidden"
                  />
                </div>

                {studentAnswer && (
                  <div className="bg-white p-3 rounded border border-slate-300">
                    <span className="text-[10px] font-black text-slate-500 block mb-1">인식된 나의 대답:</span>
                    <p className="text-xs font-bold text-slate-800 leading-relaxed whitespace-pre-wrap font-sans">{studentAnswer}</p>
                  </div>
                )}
              </div>
            )}

            {/* Photo / Camera Mode */}
            {inputMode === "photo" && (
              <div className="bg-emerald-50/70 p-4 rounded border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {showCamera ? (
                      <button
                        type="button"
                        onClick={handleCapturePhoto}
                        className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-black text-xs rounded border-2 border-slate-900 shadow-[2px_2px_0px_0px_#000] cursor-pointer"
                      >
                        찰칵! 사진 찍기 📸
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={handleStartCamera}
                        className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-black text-xs rounded border-2 border-slate-900 shadow-[2px_2px_0px_0px_#000] cursor-pointer flex items-center gap-1.5"
                      >
                        <Camera className="w-4 h-4" />
                        <span>카메라 켜기</span>
                      </button>
                    )}

                    {showCamera && (
                      <button
                        type="button"
                        onClick={handleStopCamera}
                        className="px-3 py-2 bg-white text-slate-700 font-bold text-xs rounded border border-slate-300 cursor-pointer"
                      >
                        끄기
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => photoFileInputRef.current?.click()}
                      className="px-3 py-2 bg-white text-slate-900 border border-slate-900 shadow-[1px_1px_0px_0px_#000] rounded text-xs font-bold cursor-pointer"
                    >
                      손글씨 사진 올리기
                    </button>
                    <input
                      type="file"
                      ref={photoFileInputRef}
                      onChange={handlePhotoFileChange}
                      accept="image/*"
                      className="hidden"
                    />

                    <button
                      type="button"
                      onClick={handleLoadPhotoSimulation}
                      className="px-3 py-2 bg-yellow-200 hover:bg-yellow-300 text-slate-900 font-bold text-xs rounded border border-slate-900 shadow-[1px_1px_0px_0px_#000] cursor-pointer"
                    >
                      모의 사진글 추출 🧸
                    </button>
                  </div>
                </div>

                {showCamera && (
                  <div className="border-2 border-slate-900 rounded overflow-hidden bg-black max-w-md mx-auto aspect-video relative">
                    <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                  </div>
                )}

                {studentAnswer && (
                  <div className="bg-white p-3 rounded border border-slate-300">
                    <span className="text-[10px] font-black text-slate-500 block mb-1">사진에서 읽어온 글:</span>
                    <p className="text-xs font-bold text-slate-800 leading-relaxed whitespace-pre-wrap font-sans">{studentAnswer}</p>
                  </div>
                )}
              </div>
            )}

            {/* PDF / File Mode */}
            {inputMode === "pdf" && (
              <div className="bg-pink-50/70 p-4 rounded border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-pink-950">
                    📄 과제 PDF나 공책 사진 파일을 선택해 주세요.
                  </span>
                  <button
                    type="button"
                    onClick={() => pdfFileInputRef.current?.click()}
                    className="px-4 py-2 bg-pink-500 hover:bg-pink-600 text-white font-black text-xs rounded border-2 border-slate-900 shadow-[2px_2px_0px_0px_#000] cursor-pointer flex items-center gap-1.5"
                  >
                    <FileUp className="w-4 h-4" />
                    <span>파일 선택</span>
                  </button>
                  <input
                    type="file"
                    ref={pdfFileInputRef}
                    onChange={handlePdfFileChange}
                    accept=".pdf, image/*"
                    className="hidden"
                  />
                </div>

                {studentAnswer && (
                  <div className="bg-white p-3 rounded border border-slate-300">
                    <span className="text-[10px] font-black text-slate-500 block mb-1">파일에서 추출된 내용:</span>
                    <p className="text-xs font-bold text-slate-800 leading-relaxed whitespace-pre-wrap font-sans">{studentAnswer}</p>
                  </div>
                )}
              </div>
            )}

            {/* Notification messages */}
            {errorMessage && (
              <div className="text-xs text-rose-950 font-bold bg-rose-200 p-3 rounded border-2 border-rose-900 flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}
            {successMessage && (
              <div className="text-xs text-emerald-950 font-bold bg-emerald-200 p-3 rounded border-2 border-emerald-900 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{successMessage}</span>
              </div>
            )}

            {/* Action Bar (Student only has Submit button!) */}
            <div className="flex items-center justify-between gap-3 pt-2">
              {studentAnswer && (
                <button
                  type="button"
                  onClick={() => setStudentAnswer("")}
                  className="px-3 py-2 text-slate-700 bg-white hover:bg-slate-50 text-xs font-bold rounded border border-slate-300 cursor-pointer flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>내용 지우기</span>
                </button>
              )}

              <button
                type="submit"
                disabled={isTranscribing}
                className="ml-auto bg-yellow-300 hover:bg-yellow-400 text-slate-900 text-sm font-black py-3 px-6 rounded border-2 border-slate-900 shadow-[3px_3px_0px_0px_rgba(15,23,42,1)] active:translate-x-[1px] active:translate-y-[1px] cursor-pointer flex items-center gap-2 transition-all"
                id="btn-student-submit-answer"
              >
                <Send className="w-4 h-4" />
                <span>선생님께 과제 제출하기 🚀</span>
              </button>
            </div>
          </form>
        </div>

        {/* Right (or Bottom): Teacher's Feedback View (Only visible after teacher publishes) */}
        <div className="lg:col-span-5 flex flex-col" id="student-feedback-display-box">
          <div className="bg-white p-5 rounded border-2 border-slate-900 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] flex-1 flex flex-col">
            <div className="flex items-center justify-between mb-4 border-b-2 border-slate-900 pb-3">
              <div className="flex items-center gap-2">
                <div className="bg-yellow-300 border-2 border-slate-900 p-1.5 rounded shadow-[1px_1px_0px_0px_#000]">
                  <Award className="w-4 h-4 text-slate-900" />
                </div>
                <h3 className="text-sm font-black text-slate-900">
                  {selectedNumber}번 학생의 선생님 피드백
                </h3>
              </div>
            </div>

            {/* Conditional feedback states */}
            <div className="flex-1 flex flex-col justify-center">
              {!currentSubmission ? (
                // State A: Not submitted yet
                <div className="text-center p-6 bg-slate-50 rounded border-2 border-dashed border-slate-300">
                  <FileText className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                  <p className="text-xs font-black text-slate-700">아직 과제를 제출하지 않았어요!</p>
                  <p className="text-[11px] text-slate-500 mt-1 font-bold">
                    왼쪽 화면에서 내 생각이나 과제를 적고 [선생님께 과제 제출하기]를 눌러주세요.
                  </p>
                </div>
              ) : currentSubmission.status !== "published" ? (
                // State B: Submitted, but Teacher has not published feedback yet
                <div className="text-center p-6 bg-yellow-50 rounded border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] space-y-3">
                  <div className="w-12 h-12 bg-yellow-200 border-2 border-slate-900 rounded-full flex items-center justify-center mx-auto shadow-[1px_1px_0px_0px_#000] animate-bounce">
                    <Clock className="w-6 h-6 text-slate-900" />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-slate-900">선생님이 확인 중이에요! ⏳</h4>
                    <p className="text-xs font-bold text-slate-700 mt-1 leading-relaxed">
                      {selectedNumber}번 학생의 답안이 선생님께 잘 전달되었습니다.<br />
                      선생님이 꼼꼼히 읽어보시고 따뜻한 피드백을 보내주실 때까지 조금만 기다려주세요! 🧸
                    </p>
                  </div>
                  <div className="text-[10px] bg-white p-2 rounded border border-slate-300 text-slate-600 font-bold">
                    💡 선생님 화면에서 검토 후 [학생에게 피드백 공개]를 누르시면 여기에 피드백이 나타납니다.
                  </div>
                </div>
              ) : (
                // State C: Published! Teacher allowed feedback viewing
                <div className="space-y-4 overflow-y-auto max-h-[500px] pr-1" id="published-feedback-card-list">
                  <div className="bg-emerald-100 p-3 rounded border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-800 shrink-0" />
                    <div>
                      <h4 className="text-xs font-black text-emerald-950">선생님의 성장 피드백이 도착했어요! 💌</h4>
                      <span className="text-[10px] text-emerald-800 font-bold">
                        발행일: {currentSubmission.publishedAt ? new Date(currentSubmission.publishedAt).toLocaleDateString("ko-KR") : "오늘"}
                      </span>
                    </div>
                  </div>

                  {currentSubmission.feedbacks && currentSubmission.feedbacks.length > 0 ? (
                    currentSubmission.feedbacks.map((f, idx) => (
                      <div
                        key={f.criterionId || idx}
                        className="bg-white p-4 rounded border-2 border-slate-900 shadow-[3px_3px_0px_0px_rgba(15,23,42,1)] space-y-2.5"
                      >
                        <span className="inline-block bg-yellow-200 border border-slate-900 text-slate-900 text-xs font-black px-2.5 py-1 rounded">
                          📌 {f.criterionName}
                        </span>

                        <div className="bg-emerald-50 p-2.5 rounded border border-emerald-200 text-xs leading-relaxed">
                          <strong className="text-emerald-950 block font-black mb-0.5">🌱 아주 칭찬해요 (잘한 점)</strong>
                          <p className="text-slate-800 font-bold text-[11px]">{f.goodPoints}</p>
                        </div>

                        <div className="bg-amber-50 p-2.5 rounded border border-amber-200 text-xs leading-relaxed">
                          <strong className="text-amber-950 block font-black mb-0.5">🍂 조금 더 힘내요 (보완점)</strong>
                          <p className="text-slate-800 font-bold text-[11px]">{f.needsImprovement}</p>
                        </div>

                        <div className="bg-sky-50 p-2.5 rounded border border-sky-200 text-xs leading-relaxed">
                          <strong className="text-sky-950 block font-black mb-0.5">🚀 다음 수업 한 걸음 (제안)</strong>
                          <p className="text-slate-800 font-bold text-[11px]">{f.nextStep}</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-slate-500 italic text-center">작성된 피드백 항목이 없습니다.</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
