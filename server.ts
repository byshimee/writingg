import express, { Request, Response } from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Lazy-initialized Gemini client helper
let aiClient: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is not configured. Please set it in the Secrets panel.");
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

// Endpoint 1: Generate Rubric (수준별 평가 기준표 생성)
app.post("/api/gemini/generate-rubric", async (req: Request, res: Response) => {
  try {
    const { title, description } = req.body;
    if (!title || !description) {
      return res.status(400).json({ error: "과제 제목과 설명을 모두 입력해 주세요." });
    }

    const ai = getGeminiClient();
    const systemInstruction = 
      "You are a professional South Korean school curriculum expert and educational evaluator. " +
      "Your goal is to design clear, helpful, and realistic rubrics (수준별 평가 기준) based on an assignment description.";

    const prompt = 
      `과제 제목: ${title}\n` +
      `과제 설명: ${description}\n\n` +
      `위 과제에 적합한 학생 평가 기준(rubric)을 3개 작성해 주세요. ` +
      `각 평가 기준은 반드시 '상', '중', '하' 세 단계의 구체적이고 현실적인 성취 수준(levels)을 포함해야 합니다. ` +
      `한국어로 명확하고 교육적으로 신뢰할 수 있는 전문용어를 활용해 작성해 주세요.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.7-flash",
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            rubric: {
              type: Type.ARRAY,
              description: "평가 기준 목록 (3개)",
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING, description: "평가 기준명 (예: 주제의 명확성, 내용의 타당성, 표현의 적절성)" },
                  description: { type: Type.STRING, description: "평가 기준에 대한 핵심 설명" },
                  levels: {
                    type: Type.ARRAY,
                    description: "상, 중, 하 수준별 성취 성격 기술",
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        level: { type: Type.STRING, description: "'상', '중', '하' 중 하나" },
                        description: { type: Type.STRING, description: "이 성취 수준에 도달한 학생 답안의 구체적인 가이드라인 및 특징" }
                      },
                      required: ["level", "description"]
                    }
                  }
                },
                required: ["name", "description", "levels"]
              }
            }
          },
          required: ["rubric"]
        }
      }
    });

    if (!response.text) {
      throw new Error("Gemini로부터 빈 응답을 받았습니다.");
    }

    const data = JSON.parse(response.text.trim());
    return res.json(data);
  } catch (error: any) {
    console.error("Generate Rubric Error:", error);
    return res.status(500).json({ error: error.message || "루브릭 생성 과정에서 오류가 발생했습니다." });
  }
});

// Helper to format rubric criteria with detailed achievement levels for Gemini
function formatRubricPrompt(rubric: any[]): string {
  return rubric.map((r: any, idx: number) => {
    const levelHigh = r.levels?.find((l: any) => l.level === "상")?.description || "기준을 모범적으로 완벽히 충족하며 구체적인 사례와 근거가 풍부함";
    const levelMid = r.levels?.find((l: any) => l.level === "중")?.description || "과제의 기본 방향은 맞췄으나 구체적 설명이나 근거가 다소 미흡함";
    const levelLow = r.levels?.find((l: any) => l.level === "하")?.description || "핵심 내용이 누락되었거나 주제에서 벗어나 보완이 크게 필요함";
    return `[기준 ${idx + 1}] ${r.name} (만점: 3점)
  - 기준 설명: ${r.description || r.name}
  - [상 / 3점 성취기준]: ${levelHigh}
  - [중 / 2점 성취기준]: ${levelMid}
  - [하 / 1점 성취기준]: ${levelLow}`;
  }).join("\n\n");
}

// Robust heuristic evaluator based on actual student text properties and rubric
function evaluateStudentHeuristically(studentAnswer: string, rubric: any[], studentIdentifier: string | number) {
  const clean = (studentAnswer || "").trim();
  const len = clean.length;
  const sentenceCount = (clean.match(/[.?!~]/g) || []).length + (clean.includes("\n") ? clean.split("\n").length : 1);
  const hasCausal = /왜냐하면|때문|따라서|그래서|까닭|이유|생각합니다|생각해요|바랍니다/.test(clean);
  const hasExamples = /예를|예시|플라스틱|텀블러|빨대|나무|분리수거|급식|물|절약|실천|먼저|첫째|둘째|cm|날짜|싹|잎|줄기|물주기|바다거북/.test(clean);
  const hasPoliteEnding = /습니다|합니다|해요|됩니다|합시다|바랍니다/.test(clean);

  const feedbacks = rubric.map((r: any, idx: number) => {
    let score = 2;
    let level: "상" | "중" | "하" = "중";
    let goodPoints = "";
    let needsImprovement = "";
    let nextStep = "";

    if (len < 12) {
      level = "하";
      score = 1;
      goodPoints = "과제에 참여하려는 시도를 보인 점을 칭찬해요.";
      needsImprovement = `답안의 분량이 매우 짧아 ${r.name}에 대한 생각이 충분히 드러나지 않았어요. 자신의 생각을 2~3문장 이상으로 구체화해 보세요.`;
      nextStep = "생각나는 낱말을 먼저 적어본 뒤, '누가-무엇을-왜'의 형태로 문장을 완성해 보세요.";
    } else if (idx === 0) {
      if (hasCausal && len >= 35) {
        level = "상";
        score = 3;
        goodPoints = `주장과 까닭을 분명하게 밝히며 ${r.name} 기준을 매우 훌륭하게 충족했어요.`;
        needsImprovement = "주장을 뒷받침하는 배경이나 상황을 한 문장 더 풍부하게 풀어내면 더욱 설득력 있는 글이 됩니다.";
        nextStep = "다양한 관점을 가진 사람들도 설득할 수 있도록 객관적인 근거를 보강해 보는 연습을 해보세요.";
      } else if (len >= 18) {
        level = "중";
        score = 2;
        goodPoints = `자신의 생각과 중심 주장을 솔직하게 표현한 점이 좋습니다.`;
        needsImprovement = `주장은 알 수 있으나 '왜냐하면 ~ 때문이다'와 같이 구체적인 까닭과 이유 설명이 조금 더 필요해요.`;
        nextStep = "자신의 생각을 쓴 후 바로 다음 문장에 '그 이유는 ~이기 때문입니다'를 덧붙이는 연습을 해보세요.";
      } else {
        level = "하";
        score = 1;
        goodPoints = "생각을 짧게나마 표현하려 노력했어요.";
        needsImprovement = "단순한 결론이나 짧은 어구만 적혀 있어 어떤 이유로 그런 생각을 하게 되었는지 설명이 부족해요.";
        nextStep = "주제에 대해 '왜 그렇게 생각하는지' 스스로 묻고 답하는 문장을 작성해 보세요.";
      }
    } else if (idx === 1) {
      if (hasExamples && len >= 50) {
        level = "상";
        score = 3;
        goodPoints = `실생활에서 바로 실천할 수 있는 구체적인 해결 방안을 생생하게 제시하여 ${r.name} 측면에서 매우 우수합니다.`;
        needsImprovement = "제시한 방법들을 실천했을 때 어떤 좋은 변화가 일어날지 기대 효과까지 적으면 더욱 돋보입니다.";
        nextStep = "제시한 실천 방법을 우리 반 친구들과 함께 공유하고 실천 일기를 작성해 보세요.";
      } else if (len >= 25) {
        level = "중";
        score = 2;
        goodPoints = "실천하고자 하는 의지와 기본적인 방향을 잘 담아냈어요.";
        needsImprovement = "일반적인 다짐 수준에 머물러 있어, '언제, 어떻게' 실천할 것인지 구체적인 행동 요령을 1가지 더 자세히 적어보세요.";
        nextStep = "실천 방법을 쓸 때 '첫째, 둘째'로 번호를 매겨 구체적인 행동을 정리해 보세요.";
      } else {
        level = "하";
        score = 1;
        goodPoints = "과제에 관심을 가지고 해결하려는 태도를 보였습니다.";
        needsImprovement = "구체적인 실천 방안이나 세부 근거가 부족하여 실행 가능한 계획을 추가로 제시해야 합니다.";
        nextStep = "생활 속에서 당장 실천할 수 있는 작은 약속 1가지를 구체적인 문장으로 써보세요.";
      }
    } else {
      if (hasPoliteEnding && sentenceCount >= 3 && len >= 45) {
        level = "상";
        score = 3;
        goodPoints = "글의 흐름이 자연스럽고 읽는 이를 존중하는 정중한 어조로 완성도 높은 글을 썼습니다.";
        needsImprovement = "문단 구분을 통해 생각의 단락을 나누어 주면 글의 구조가 더욱 명확해질 것입니다.";
        nextStep = "처음-가운데-끝의 구조에 맞추어 문단을 나누어 쓰는 연습을 지속해 보세요.";
      } else if (len >= 20) {
        level = "중";
        score = 2;
        goodPoints = "문장을 차근차근 이어가며 글을 완성하려 성실히 노력했습니다.";
        needsImprovement = "문장이 다소 길어지거나 연결이 엉킬 수 있으니, 마침표를 찍어 짧고 명확한 문장들로 나누어 보세요.";
        nextStep = "글을 완성한 후 소리 내어 읽어보며 어색한 표현을 다듬는 퇴고 연습을 해보세요.";
      } else {
        level = "하";
        score = 1;
        goodPoints = "문장을 완성하려는 시도를 긍정적으로 평가합니다.";
        needsImprovement = "문장 부호와 주어-서술어 호응이 어색하여 정확한 문장 구조를 갖출 필요가 있습니다.";
        nextStep = "한 문장이라도 마침표까지 완전한 형태를 갖추어 쓰는 연습을 해보세요.";
      }
    }

    return {
      criterionName: r.name || `기준 ${idx + 1}`,
      level,
      score,
      maxScore: 3,
      goodPoints,
      needsImprovement,
      nextStep,
    };
  });

  const totalScore = feedbacks.reduce((sum, f) => sum + f.score, 0);
  const maxTotalScore = rubric.length * 3;
  const ratio = totalScore / (maxTotalScore || 1);
  const overallLevel = ratio >= 0.8 ? "상" : ratio >= 0.5 ? "중" : "하";
  
  let teacherSummary = "";
  if (totalScore >= 8) {
    teacherSummary = `${studentIdentifier}번 학생은 과제의 핵심 성취기준을 모범적으로 충족하며, 구체적인 근거와 논리적 생각 전개가 돋보임.`;
  } else if (totalScore >= 6) {
    teacherSummary = `${studentIdentifier}번 학생은 과제 기본 방향을 바르게 이해하고 성실히 작성하였으나, 구체적 사례 제시 및 문장 완성도 측면에서 지속적인 보완 지도가 유익함.`;
  } else {
    teacherSummary = `${studentIdentifier}번 학생은 과제 참여 의지를 보였으나 내용의 구체성과 논리적 까닭 제시가 미흡하여 기초 글쓰기 지도와 격려가 요구됨.`;
  }

  return {
    studentNumber: typeof studentIdentifier === "number" ? studentIdentifier : parseInt(String(studentIdentifier).replace(/[^0-9]/g, "")) || 1,
    totalScore,
    maxTotalScore,
    overallLevel,
    teacherSummary,
    feedbacks,
    fallbackUsed: true,
  };
}

// Endpoint 2: Generate Warm Feedback & Teacher Score Evaluation (루브릭 준거참조평가)
app.post("/api/gemini/generate-feedback", async (req: Request, res: Response) => {
  const { rubric, studentIdentifier, studentAnswer } = req.body;
  if (!rubric || !Array.isArray(rubric) || rubric.length === 0) {
    return res.status(400).json({ error: "평가 루브릭 기준 정보가 전달되지 않았습니다." });
  }

  const safeStudentId = studentIdentifier || "학생";
  const rawAnswer = (studentAnswer || "").trim();
  const cleanAnswer = rawAnswer.length > 0 ? rawAnswer : "(제출된 내용이 없거나 미기재 상태입니다.)";

  try {
    const ai = getGeminiClient();
    const formattedRubric = formatRubricPrompt(rubric);

    const systemInstruction = 
      "You are an expert South Korean elementary school educational evaluator and teacher.\n" +
      "You evaluate student writing strictly according to the provided Criterion-Referenced Assessment Rubric (성취기준 중심 루브릭 절대평가).\n\n" +
      "CRITICAL EVALUATION & SCORING PRINCIPLES:\n" +
      "1. Rubric-Referenced Grounding: Compare the student's submitted text against EACH criterion's exact [상/중/하 성취기준] definitions.\n" +
      "   - [상 (3점)]: Student's answer genuinely and fully satisfies the [상] description with clear logic, depth, or concrete examples.\n" +
      "   - [중 (2점)]: Student's answer fits the [중] description (has basic idea but lacks detailed reasons, simple listing, or needs improvement).\n" +
      "   - [하 (1점)]: Student's answer fits the [하] description (off-topic, very brief, or missing core elements).\n" +
      "2. Natural, Credible Score Distribution:\n" +
      "   - Never force all students to receive identical scores (such as all 9s or all 7s).\n" +
      "   - Give honest, differentiated scores (3 to 9 points) matching each student's real writing quality.\n" +
      "3. 3-Step Growth Feedback in Korean Polite Tone (~해요, ~합니다):\n" +
      "   - goodPoints (잘한 점): Quote or reference specific phrases from the student's text and praise genuine effort warmly.\n" +
      "   - needsImprovement (보완점): Explain clearly and kindly what is needed to reach the [상] level based on the rubric.\n" +
      "   - nextStep (다음 단계 제안): Suggest a concrete, actionable learning challenge for the student's next step.\n" +
      "4. totalScore must strictly equal the arithmetic sum of the individual criteria scores.\n" +
      "5. teacherSummary: A concise 1~2 sentence objective observation suitable for NEIS (학교생활기록부/세특).";

    const prompt = 
      `[평가 루브릭 성취기준표]\n${formattedRubric}\n\n` +
      `[학생 정보 및 제출 답안]\n` +
      `학생: ${safeStudentId}\n` +
      `답안 내용:\n"${cleanAnswer}"\n\n` +
      `[평가 지시사항]\n` +
      `위 학생 답안을 루브릭의 각 기준별 [상/중/하 성취기준]과 1:1로 정밀 대조하여 엄정하고 신뢰성 있게 평가하세요. ` +
      `각 기준별 점수(1, 2, 3점), 성취도('상'|'중'|'하'), 구체적 피드백(goodPoints, needsImprovement, nextStep), 총점(합계), 종합수준, 교사용 종합 관찰 평어를 JSON으로 출력하세요.`;

    let response;
    try {
      response = await ai.models.generateContent({
        model: "gemini-3.7-flash",
        contents: prompt,
        config: {
          systemInstruction,
          temperature: 0.2,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              totalScore: { type: Type.INTEGER, description: "교사용 총점 (기준 점수들의 정확한 합계)" },
              maxTotalScore: { type: Type.INTEGER, description: "만점 총점 (루브릭 개수 * 3)" },
              overallLevel: { type: Type.STRING, description: "교사용 종합 성취도 ('상', '중', '하')" },
              teacherSummary: { type: Type.STRING, description: "교사용 종합 관찰 평어 (NEIS 세특용 1~2문장)" },
              feedbacks: {
                type: Type.ARRAY,
                description: "각 루브릭 기준별 학생 피드백 및 점수 목록",
                items: {
                  type: Type.OBJECT,
                  properties: {
                    criterionName: { type: Type.STRING, description: "해당 평가 기준의 이름" },
                    level: { type: Type.STRING, description: "해당 기준의 성취도 ('상', '중', '하')" },
                    score: { type: Type.INTEGER, description: "해당 기준 점수 (1, 2, 또는 3)" },
                    maxScore: { type: Type.INTEGER, description: "기준 만점 (3)" },
                    goodPoints: { type: Type.STRING, description: "학생 답안에서 발견한 구체적인 강점과 잘한 점 (2~3문장, 따뜻한 어조)" },
                    needsImprovement: { type: Type.STRING, description: "루브릭 기준에 근거한 구체적인 보완점 (2~3문장)" },
                    nextStep: { type: Type.STRING, description: "다음 단계 성장을 위한 구체적 제안 (2~3문장)" }
                  },
                  required: ["criterionName", "level", "score", "goodPoints", "needsImprovement", "nextStep"]
                }
              }
            },
            required: ["totalScore", "maxTotalScore", "overallLevel", "teacherSummary", "feedbacks"]
          }
        }
      });
    } catch (apiErr: any) {
      console.warn("Gemini generateContent call error or rate limit, using robust heuristic evaluator...", apiErr?.message);
      return res.json(evaluateStudentHeuristically(cleanAnswer, rubric, safeStudentId));
    }

    if (!response || !response.text) {
      return res.json(evaluateStudentHeuristically(cleanAnswer, rubric, safeStudentId));
    }

    let parsedText = response.text.trim();
    if (parsedText.startsWith("```json")) {
      parsedText = parsedText.replace(/^```json\s*/, "").replace(/\s*```$/, "");
    } else if (parsedText.startsWith("```")) {
      parsedText = parsedText.replace(/^```\s*/, "").replace(/\s*```$/, "");
    }

    const data = JSON.parse(parsedText);
    
    if (data.feedbacks && Array.isArray(data.feedbacks)) {
      data.feedbacks = data.feedbacks.map((f: any, idx: number) => {
        const score = typeof f.score === "number" ? f.score : (f.level === "상" ? 3 : f.level === "하" ? 1 : 2);
        return {
          criterionName: f.criterionName || rubric[idx]?.name || `기준 ${idx + 1}`,
          level: f.level || "중",
          score,
          maxScore: 3,
          goodPoints: f.goodPoints || "성실하게 과제를 수행하려는 노력이 돋보입니다.",
          needsImprovement: f.needsImprovement || "루브릭 기준에 맞춰 구체적인 예시와 까닭을 보완해 보세요.",
          nextStep: f.nextStep || "다음에는 배운 내용을 바탕으로 한 문장씩 생각을 넓혀 보세요."
        };
      });
    }

    const maxPossible = rubric.length * 3;
    const calcTotal = (data.feedbacks || []).reduce((acc: number, cur: any) => acc + (cur.score || 2), 0);
    data.totalScore = calcTotal;
    data.maxTotalScore = maxPossible;
    const ratio = data.totalScore / (maxPossible || 1);
    data.overallLevel = ratio >= 0.8 ? "상" : ratio >= 0.5 ? "중" : "하";
    if (!data.teacherSummary) {
      data.teacherSummary = `${safeStudentId} 학생은 과제 핵심 요소를 바르게 이해하고 성실히 참여함.`;
    }

    return res.json(data);
  } catch (error: any) {
    console.error("Generate Feedback Error, fallbacking heuristically:", error);
    return res.json(evaluateStudentHeuristically(cleanAnswer, rubric, safeStudentId));
  }
});

// Endpoint 2.5: Batch Generate Warm Feedback (다수 학생 일괄 루브릭 준거참조평가)
app.post("/api/gemini/generate-batch-feedback", async (req: Request, res: Response) => {
  const { rubric, students } = req.body;
  if (!rubric || !Array.isArray(rubric) || !students || !Array.isArray(students) || students.length === 0) {
    return res.status(400).json({ error: "루브릭 및 학생 목록 데이터가 올바르지 않습니다." });
  }

  try {
    const ai = getGeminiClient();
    const formattedRubric = formatRubricPrompt(rubric);

    const systemInstruction = 
      "You are an expert South Korean elementary school educational evaluator and teacher.\n" +
      "Evaluate each student's submission strictly according to the provided Criterion-Referenced Rubric.\n\n" +
      "EVALUATION CRITERIA:\n" +
      "- Differentiated Honest Scoring: Award '상'(3), '중'(2), or '하'(1) by comparing each student's text directly against the rubric's [상/중/하 성취기준].\n" +
      "- Avoid artificial uniformity: Score each student according to their actual text length, logic, and concrete examples (scores should vary naturally from 3 to 9).\n" +
      "- Provide 3-step growth feedback (goodPoints, needsImprovement, nextStep) in warm polite Korean (~해요, ~합니다).\n" +
      "- Return an array of evaluations for each student.";

    const studentsFormatted = students.map((s: any) => ({
      studentNumber: s.studentNumber,
      studentName: s.studentName || "",
      studentAnswer: (s.studentAnswer || "").trim() || "(미작성/내용 없음)"
    }));

    const prompt = 
      `[평가 루브릭 성취기준표]\n${formattedRubric}\n\n` +
      `[학생 제출 답안 목록 (${studentsFormatted.length}명)]:\n${JSON.stringify(studentsFormatted)}\n\n` +
      `각 학생별로 루브릭 기준에 맞춰 정직하고 공정하게 채점해 주세요. ` +
      `답안의 구체성과 루브릭 부합도에 따라 1점, 2점, 3점을 부여하여 학생마다 실질적인 점수 차이가 드러나도록 평가해 주세요. ` +
      `totalScore(각 기준 점수의 정확한 합계), maxTotalScore, overallLevel('상'|'중'|'하'), teacherSummary, 그리고 각 루브릭 기준별 feedbacks(criterionName, level, score, goodPoints, needsImprovement, nextStep)를 JSON 배열로 생성해 주세요.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.7-flash",
      contents: prompt,
      config: {
        systemInstruction,
        temperature: 0.2,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            evaluations: {
              type: Type.ARRAY,
              description: "각 학생별 평가 결과 목록",
              items: {
                type: Type.OBJECT,
                properties: {
                  studentNumber: { type: Type.INTEGER, description: "학생 번호" },
                  totalScore: { type: Type.INTEGER, description: "총점" },
                  maxTotalScore: { type: Type.INTEGER, description: "만점 총점" },
                  overallLevel: { type: Type.STRING, description: "종합 성취수준 ('상', '중', '하')" },
                  teacherSummary: { type: Type.STRING, description: "교사용 종합 관찰 평어" },
                  feedbacks: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        criterionName: { type: Type.STRING },
                        level: { type: Type.STRING },
                        score: { type: Type.INTEGER },
                        maxScore: { type: Type.INTEGER },
                        goodPoints: { type: Type.STRING },
                        needsImprovement: { type: Type.STRING },
                        nextStep: { type: Type.STRING }
                      },
                      required: ["criterionName", "level", "score", "goodPoints", "needsImprovement", "nextStep"]
                    }
                  }
                },
                required: ["studentNumber", "totalScore", "maxTotalScore", "overallLevel", "teacherSummary", "feedbacks"]
              }
            }
          },
          required: ["evaluations"]
        }
      }
    });

    if (response?.text) {
      let parsedText = response.text.trim();
      if (parsedText.startsWith("```json")) {
        parsedText = parsedText.replace(/^```json\s*/, "").replace(/\s*```$/, "");
      } else if (parsedText.startsWith("```")) {
        parsedText = parsedText.replace(/^```\s*/, "").replace(/\s*```$/, "");
      }
      const parsed = JSON.parse(parsedText);
      if (parsed.evaluations && Array.isArray(parsed.evaluations)) {
        // Ensure totalScore is exact sum
        const verified = parsed.evaluations.map((ev: any) => {
          const sum = (ev.feedbacks || []).reduce((acc: number, f: any) => acc + (f.score || 2), 0);
          return {
            ...ev,
            totalScore: sum,
            maxTotalScore: rubric.length * 3,
            overallLevel: sum / (rubric.length * 3) >= 0.8 ? "상" : sum / (rubric.length * 3) >= 0.5 ? "중" : "하"
          };
        });
        return res.json({ evaluations: verified });
      }
    }

    // If parsing failed, fallback dynamically
    const fallbackResults = students.map((s: any) => evaluateStudentHeuristically(s.studentAnswer, rubric, s.studentNumber));
    return res.json({ evaluations: fallbackResults });
  } catch (err: any) {
    console.warn("Batch feedback failed, evaluating heuristically based on actual student text:", err);
    const fallbackResults = students.map((s: any) => evaluateStudentHeuristically(s.studentAnswer, rubric, s.studentNumber));
    return res.json({ evaluations: fallbackResults });
  }
});

// Endpoint 3: Summarize Today's Session Trends (오늘 경향 요약)
app.post("/api/gemini/summarize-today", async (req: Request, res: Response) => {
  try {
    const { sessionData } = req.body; // Array of student answers + feedbacks
    if (!sessionData || !Array.isArray(sessionData) || sessionData.length === 0) {
      return res.status(400).json({ error: "요약할 학생 답안 및 피드백 데이터가 비어 있습니다." });
    }

    const ai = getGeminiClient();
    const systemInstruction = 
      "You are an expert South Korean educational consultant and school learning analyzer. " +
      "Your role is to analyze a batch of student answers and feedback logs to find common learning trends and suggest effective instructional steps.";

    const prompt = 
      `다음은 오늘 교사가 이번 수업 세션에서 다루고 분석한 전체 학생들의 답안과 작성된 피드백 내역입니다:\n` +
      `${JSON.stringify(sessionData)}\n\n` +
      `이 학생들의 학습 성취 경향을 면밀히 종합 분석하여 다음 두 가지 내용을 도출해 주세요:\n` +
      `1. 학생들이 가장 흔하게 보인 '자주 나온 보완점 3가지' (각 항목은 완성된 구체적 문장이어야 하며, 실질적인 서술이어야 함)\n` +
      `2. 다음 차시 수업 지도를 위해 교사에게 제공하는 '다음 수업 지도 제안' (전체 지도를 위한 수업 전략, 보완 활동 설계 등 구체적이고 실용적인 조언, 마크다운 줄바꿈을 포함할 수 있음)\n\n` +
      `친절하고 신뢰감 있는 한국어 문체로 작성해 주세요.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.7-flash",
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            commonImprovements: {
              type: Type.ARRAY,
              description: "공통적으로 자주 나타난 주요 보완점 3가지 목록",
              items: { type: Type.STRING }
            },
            nextLessonSuggestions: {
              type: Type.STRING,
              description: "다음 수업 차시를 위한 교사 대상의 구체적이고 전문적인 수업 지도 조언 및 제안 사항"
            }
          },
          required: ["commonImprovements", "nextLessonSuggestions"]
        }
      }
    });

    if (!response.text) {
      throw new Error("Gemini로부터 빈 응답을 받았습니다.");
    }

    const data = JSON.parse(response.text.trim());
    return res.json(data);
  } catch (error: any) {
    console.error("Summarize Today Error:", error);
    return res.status(500).json({ error: error.message || "오늘 경향 요약 과정에서 오류가 발생했습니다." });
  }
});

// Endpoint 4: Transcribe student file (Audio, Image, PDF) using Gemini Multi-modal capabilities
app.post("/api/gemini/transcribe-file", async (req: Request, res: Response) => {
  try {
    const { fileData, mimeType } = req.body;
    if (!fileData || !mimeType) {
      return res.status(400).json({ error: "파일 데이터 또는 MIME 타입이 비어 있습니다." });
    }

    const ai = getGeminiClient();
    
    const prompt = 
      "초등학교 학생이 작성하거나 대답한 녹음 음성 파일, 손글씨 공책/학습지 사진, 또는 PDF 과제 파일입니다.\n\n" +
      "★ [문단 형식 및 서식(들여쓰기와 줄바꿈) 보존 절대 원칙 (CRITICAL)]:\n" +
      "1. 학생이 작성한 문단의 들여쓰기(문단 첫머리의 공백 2칸 '  ' 또는 탭)와 문단 간의 줄바꿈(\\n\\n 또는 \\n)을 원본 서식 그대로 온전히 유지하여 추출하세요.\n" +
      "2. 문단이 나뉘어 있거나 줄바꿈이 있는 경우 절대로 임의로 한 줄로 이어붙이지(collapse) 마시고, 실제 문단 구분에 맞추어 줄바꿈 문자(\\n)와 들여쓰기 공백을 정확하게 포함하세요.\n" +
      "3. 학생이 쓴 손글씨 줄바꿈과 문단 구조를 원본 그대로 살려 학생 본문 텍스트만 한글로 출력해 주세요. 부가 설명이나 시작/종료 안내 문구는 절대 추가하지 마세요.";

    const response = await ai.models.generateContent({
      model: "gemini-3.7-flash",
      contents: [
        {
          inlineData: {
            data: fileData,
            mimeType: mimeType
          }
        },
        prompt
      ]
    });

    if (!response.text) {
      throw new Error("파일에서 텍스트를 인식해내지 못했습니다.");
    }

    return res.json({ text: response.text.trim() });
  } catch (error: any) {
    console.error("Transcribe File Error:", error);
    return res.status(500).json({ error: error.message || "파일 인식을 실패했습니다." });
  }
});

// Endpoint 5: Split Class Bulk PDF into individual student submissions with OCR
app.post("/api/gemini/split-pdf-submissions", async (req: Request, res: Response) => {
  try {
    const { fileData, mimeType, assignmentTitle, maxStudents = 25 } = req.body;
    if (!fileData || !mimeType) {
      return res.status(400).json({ error: "통합 PDF 파일 데이터가 전달되지 않았습니다." });
    }

    const ai = getGeminiClient();
    const systemInstruction =
      "You are a specialized South Korean elementary school education assistant and document parsing engine.\n" +
      "Your task is to analyze a multi-page PDF document containing an entire class's handwritten or printed assignments, " +
      "perform Korean OCR on each page preserving exact paragraph structure, line breaks (\\n), and paragraph indentation ('  '), " +
      "and map each page to the correct student number (1 to 25).";

    const prompt =
      `이 문서는 초등학교 교실에서 수합한 ${assignmentTitle ? `'${assignmentTitle}'` : "과제"} 학습지/글쓰기 결과물(통합 PDF)입니다.\n\n` +
      `[작업 지침]\n` +
      `1. [문단 형식(들여쓰기와 줄바꿈) 보존 절대 원칙]:\n` +
      `   - 학생이 작성한 글의 문단 구분, 줄바꿈(\\n) 및 문단 시작 들여쓰기(띄어쓰기 2칸 '  ' 등)를 원본 학습지 형태 그대로 온전히 살려 'extractedText'에 담아주세요.\n` +
      `   - 모든 문장을 임의로 한 줄로 이어붙이지 마시고, 원본 문서에 작성된 문단 배치와 줄바꿈을 완벽히 유지해 주세요.\n` +
      `2. [학생 번호/이름 식별]: 각 페이지 상단, 이름란, 여백 등에 적힌 'N번', '출석번호 N', '1학년 2반 N번' 또는 학생 이름을 최우선으로 정밀 인식해 주세요.\n` +
      `   - 결석생이 있어 총 페이지 수가 24장이더라도 학습지에 '25번'이 적혀 있다면 해당 페이지는 25번으로 정확히 배정해야 합니다.\n` +
      `3. 만약 페이지 어디에도 번호나 이름을 식별할 수 없는 경우에만, 1페이지는 1번, 2페이지는 2번 등 순차적인 기본 studentNumber를 부여해 주세요.\n` +
      `4. 각 페이지별로 pageNumber(1부터 시작하는 실제 PDF 페이지), studentNumber(식별된 번호 1~${maxStudents}), studentName(인식된 이름, 없으면 빈 문자열), extractedText(들여쓰기와 줄바꿈이 완벽히 보존된 학생 본문 전체)를 배열로 반환해 주세요.\n` +
      `5. 백지이거나 식별 가능한 글이 적은 경우에도 추출된 텍스트를 담아주세요.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.7-flash",
      contents: [
        {
          inlineData: {
            data: fileData,
            mimeType: mimeType
          }
        },
        prompt
      ],
      config: {
        systemInstruction,
        temperature: 0.1,
        thinkingConfig: {
          thinkingBudget: 0,
        },
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            pages: {
              type: Type.ARRAY,
              description: "PDF 각 페이지별 학생 배정 및 텍스트 추출 결과 목록",
              items: {
                type: Type.OBJECT,
                properties: {
                  pageNumber: { type: Type.INTEGER, description: "PDF 파일 내의 실제 페이지 번호 (1, 2, 3...)" },
                  studentNumber: { type: Type.INTEGER, description: "매핑된 학생 출석 번호 (1~25)" },
                  studentName: { type: Type.STRING, description: "인식된 학생 이름 (없으면 빈 문자열)" },
                  extractedText: { type: Type.STRING, description: "해당 페이지에서 OCR로 인식된 학생의 본문 답안 텍스트" }
                },
                required: ["pageNumber", "studentNumber", "extractedText"]
              }
            }
          },
          required: ["pages"]
        }
      }
    });

    if (!response.text) {
      throw new Error("PDF 문서에서 페이지 및 텍스트를 추출하지 못했습니다.");
    }

    const data = JSON.parse(response.text.trim());
    return res.json(data);
  } catch (error: any) {
    console.error("Split PDF Error:", error);
    return res.status(500).json({ error: error.message || "학급 통합 PDF 분석 중 오류가 발생했습니다." });
  }
});

// Setup Vite Dev Server / Serve static resources
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Server] Running at http://localhost:${PORT}`);
  });
}

startServer();
