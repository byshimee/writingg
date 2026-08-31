import { Assignment, StudentFeedback, StudentSubmission } from "./types";

export const INITIAL_ASSIGNMENTS: Assignment[] = [
  {
    id: "task-1",
    title: "환경 보호를 위한 주장하는 글쓰기",
    description: "환경 오염의 심각성을 알리고, 일상생활에서 실천할 수 있는 구체적인 해결 방안을 제안하는 주장하는 글을 작성합니다. 주장과 까닭이 분명하게 연결되어야 합니다.",
    createdAt: "2026-07-08T10:00:00Z",
    rubric: [
      {
        id: "c1",
        name: "주장의 명확성 및 타당성",
        description: "주장과 까닭이 뚜렷하게 연결되며 환경 문제를 올바르게 짚고 있는가",
        levels: [
          { level: "상", description: "주장이 매우 분명하고 환경 문제에 대한 까닭과 생각이 알기 쉽게 잘 드러납니다." },
          { level: "중", description: "주장은 알 수 있으나 까닭이 조금 부족하거나 설명이 덜 구체적입니다." },
          { level: "하", description: "주장과 까닭이 잘 어울리지 않거나 생각이 명확히 드러나지 않습니다." }
        ]
      },
      {
        id: "c2",
        name: "해결 방안의 구체성 및 실천성",
        description: "일상에서 우리가 바로 실천할 수 있는 구체적인 방법을 제안하였는가",
        levels: [
          { level: "상", description: "실천할 수 있는 구체적인 방법을 2가지 이상 자세히 설명했습니다." },
          { level: "중", description: "방법을 제시했으나 일반적인 표어 수준에 머물러 조금 더 자세한 설명이 필요합니다." },
          { level: "하", description: "제안한 방법이 너무 어렵거나 일상에서 실천하기 어렵습니다." }
        ]
      },
      {
        id: "c3",
        name: "글의 구성 및 어조의 적절성",
        description: "처음-가운데-끝 구성을 갖추고 읽는 이를 생각하는 바른 말을 사용했는가",
        levels: [
          { level: "상", description: "문단의 흐름이 자연스럽고 읽는 사람을 배려하는 정중한 문장으로 썼습니다." },
          { level: "중", description: "내용은 이어지나 문단 구분이 조금 어색하거나 끝맺음이 다소 급합니다." },
          { level: "하", description: "문장의 연결이 매끄럽지 못하고 생각나는 대로 단순 나열했습니다." }
        ]
      }
    ]
  },
  {
    id: "task-2",
    title: "강낭콩 한살이 관찰 보고서 작성",
    description: "직접 강낭콩을 기르며 관찰한 과정을 날짜와 숫자를 넣어 정리하고, 생명을 아끼는 마음을 담아 관찰 일기를 작성합니다.",
    createdAt: "2026-07-09T14:30:00Z",
    rubric: [
      {
        id: "t2-c1",
        name: "관찰 기록의 사실성과 정량성",
        description: "날짜별 변화를 자로 잰 길이 등 구체적인 숫자를 넣어 기록했는가",
        levels: [
          { level: "상", description: "날짜와 자로 잰 수치(cm, 잎의 수)를 꼼꼼하게 기록했습니다." },
          { level: "중", description: "성장 모습은 잘 썼으나 구체적인 수치 기록이 조금 부족합니다." },
          { level: "하", description: "날짜가 띄엄띄엄 있고 식물의 모습을 대충 썼습니다." }
        ]
      },
      {
        id: "t2-c2",
        name: "과학적 생명 개념의 올바른 활용",
        description: "싹, 떡잎, 본잎, 줄기 등 배운 과학 낱말을 바르게 썼는가",
        levels: [
          { level: "상", description: "식물의 자람 단계에 맞는 과학 낱말(떡잎, 본잎 등)을 정확히 썼습니다." },
          { level: "중", description: "기초적인 낱말은 썼으나 식물 부위의 명칭이 일부 헷갈려 있습니다." },
          { level: "하", description: "과학적 낱말을 거의 쓰지 않고 단순 느낌 위주로 적었습니다." }
        ]
      },
      {
        id: "t2-c3",
        name: "생명 존중 태도 및 자아 성찰",
        description: "식물을 소중히 돌보며 느낀 보람과 책임감이 잘 나타나 있는가",
        levels: [
          { level: "상", description: "식물을 사랑과 책임감으로 돌본 과정과 따뜻한 마음이 잘 나타납니다." },
          { level: "중", description: "느낀 점이 있으나 '신기했다' 정도로 짧게 끝났습니다." },
          { level: "하", description: "식물을 기르며 느낀 생각이나 마음이 드러나지 않았습니다." }
        ]
      }
    ]
  }
];

export const INITIAL_SUBMISSIONS: StudentSubmission[] = [
  {
    id: "sub-task-1-1",
    assignmentId: "task-1",
    assignmentTitle: "환경 보호를 위한 주장하는 글쓰기",
    studentNumber: 1,
    studentAnswer: "  우리는 일회용 플라스틱 컵을 쓰면 안 됩니다. 왜냐하면 바다거북이 코에 빨대가 꽂혀서 아파하기 때문입니다.\n\n  그래서 저는 매일 텀블러를 챙겨 다니겠습니다. 그리고 학교 급식실에서도 플라스틱 수저 대신 쇠 수저를 쓰면 좋겠습니다.\n\n  지구를 지키기 위해 우리 모두 함께 작은 일부터 실천합시다!",
    submittedAt: "2026-07-09T11:00:00Z",
    status: "published", // 교사가 이미 허용한 상태
    publishedAt: "2026-07-09T11:30:00Z",
    totalScore: 8,
    maxTotalScore: 9,
    overallLevel: "상",
    teacherSummary: "환경 문제에 대한 문제의식이 뚜렷하며, 바다거북 사례와 텀블러 사용 등 구체적이고 실천 가능한 대안을 설득력 있게 제시함.",
    feedbacks: [
      {
        criterionId: "c1",
        criterionName: "주장의 명확성 및 타당성",
        level: "상",
        score: 3,
        maxScore: 3,
        goodPoints: "일회용 플라스틱을 쓰지 말자는 주장을 아주 똑똑하게 밝히고, 바다거북의 이야기를 들어 친구들의 마음을 움직이게 쓴 점이 훌륭해요.",
        needsImprovement: "플라스틱이 썩는 데 몇 백 년이 걸리는지 같은 재미있는 사실 한 줄을 덧붙이면 친구들이 더 크게 고개를 끄덕일 거예요.",
        nextStep: "플라스틱 쓰레기가 지구에 미치는 영향에 대해 책이나 영상에서 알게 된 점을 한 문장 더 적어보세요."
      },
      {
        criterionId: "c2",
        criterionName: "해결 방안의 구체성 및 실천성",
        level: "상",
        score: 3,
        maxScore: 3,
        goodPoints: "내 텀블러 챙기기와 학교 급식실 수저 바꾸기처럼 우리가 당장 할 수 있는 방법을 2가지나 훌륭하게 생각해 냈어요.",
        needsImprovement: "친구들과 함께 텀블러를 챙기기 위해 어떤 약속을 하면 좋을지 방법을 조금만 더 적어보면 더욱 완벽해져요.",
        nextStep: "우리 반 텀블러 쓰기 챌린지를 제안하는 멋진 표어를 한 줄 지어보세요."
      },
      {
        criterionId: "c3",
        criterionName: "글의 구성 및 어조의 적절성",
        level: "중",
        score: 2,
        maxScore: 3,
        goodPoints: "처음부터 끝까지 읽는 친구들을 존중하는 따뜻하고 바른 존댓말을 정성껏 사용했어요.",
        needsImprovement: "글의 끝부분에 '환경을 사랑합시다' 뒤에 우리가 함께 실천하자는 다짐을 한 줄 더 넣어 마무리하면 훨씬 멋진 글이 돼요.",
        nextStep: "줄바꿈을 이용해 처음-가운데-끝으로 문단을 나누어 적는 연습을 해보아요."
      }
    ]
  },
  {
    id: "sub-task-1-2",
    assignmentId: "task-1",
    assignmentTitle: "환경 보호를 위한 주장하는 글쓰기",
    studentNumber: 2,
    studentAnswer: "  지구가 온난화 때문에 아파하고 있습니다. 북극의 빙하가 녹아 북극곰이 살아갈 집이 점점 사라지고 있습니다.\n\n  우리는 여름철 에어컨 희망 온도를 26도로 지켜야 합니다. 그리고 페트병과 우유갑을 깨끗이 씻어 분리배출을 잘해야 합니다.\n\n  내가 먼저 앞장서서 환경을 아끼고 보호하겠습니다.",
    submittedAt: "2026-07-09T11:15:00Z",
    status: "feedback_ready", // 피드백은 작성되었으나 아직 교사가 학생에게 공개 전
    totalScore: 7,
    maxTotalScore: 9,
    overallLevel: "중",
    teacherSummary: "지구 온난화와 북극곰 사례를 연결하여 문제의 심각성을 부각하였으며, 실천 가능한 환경 보호 방안을 성실히 제안함.",
    feedbacks: [
      {
        criterionId: "c1",
        criterionName: "주장의 명확성 및 타당성",
        level: "상",
        score: 3,
        maxScore: 3,
        goodPoints: "지구 온난화와 북극곰의 집이 사라지는 문제를 연결해 글을 시작한 감수성이 아주 뛰어납니다.",
        needsImprovement: "에어컨을 많이 켜면 왜 지구가 더워지는지 그 이유를 한 줄만 더 덧붙여 주면 친구들이 더 쉽게 이해할 수 있어요.",
        nextStep: "에어컨을 아껴 쓰면 왜 전기가 절약되고 지구가 시원해지는지 이유를 1문장 추가해 보세요."
      },
      {
        criterionId: "c2",
        criterionName: "해결 방안의 구체성 및 실천성",
        level: "중",
        score: 2,
        maxScore: 3,
        goodPoints: "에어컨 적정 온도 지키기와 분리배출이라는 누구나 쉽게 따라 할 수 있는 좋은 행동을 짚어냈어요.",
        needsImprovement: "분리배출을 할 때 우유갑이나 플라스틱을 어떻게 씻어서 버리는지 구체적인 방법을 적어주면 더 실천하기 쉬워요.",
        nextStep: "내가 집에서 분리배출을 직접 해본 경험을 짧게 덧붙여 봅시다."
      },
      {
        criterionId: "c3",
        criterionName: "글의 구성 및 어조의 적절성",
        level: "중",
        score: 2,
        maxScore: 3,
        goodPoints: "'지구가 아파하고 있습니다'라는 첫 문장이 읽는 이의 마음을 단번에 사로잡는 멋진 시작이었어요.",
        needsImprovement: "마지막에 친구들에게 작은 실천을 함께하자는 따뜻한 권유의 말로 글을 맺어보면 더욱 감동적일 거예요.",
        nextStep: "'우리 모두 지구를 위해 오늘부터 실천해요!' 같은 멋진 마무리 문장으로 고쳐 써 보세요."
      }
    ]
  }
];

// Helper to convert Submissions to Feedbacks for Dashboard/Trends
export const mapSubmissionsToFeedbacks = (submissions: StudentSubmission[]): StudentFeedback[] => {
  const result: StudentFeedback[] = [];
  submissions.forEach((sub) => {
    if (sub.feedbacks && sub.feedbacks.length > 0) {
      result.push({
        id: `fb-${sub.id}`,
        assignmentId: sub.assignmentId,
        assignmentTitle: sub.assignmentTitle,
        studentIdentifier: `${sub.studentNumber}번`,
        studentAnswer: sub.studentAnswer,
        feedbacks: sub.feedbacks,
        createdAt: sub.publishedAt || sub.submittedAt,
        isPublished: sub.status === "published",
      });
    }
  });
  return result;
};
