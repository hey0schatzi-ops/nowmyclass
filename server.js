require('dotenv').config();
const express = require('express');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use((req, res, next) => {
  console.log('[REQUEST]', req.method, req.url);
  next();
});
app.use(express.static(path.join(__dirname, 'public')));

// 게임 상태 저장 (실제로는 DB를 사용해야 함)
let gameState = {
  currentWeek: 1,
  currentMonth: 3,
  year: 2024,
  students: [],
  consultationHistory: [],
  events: [],
  currentEvent: null,
  teacherNotes: [],
  reports: [],
  summerBreaks: [],
  classAtmosphere: 50,
  weeklyActionsRemaining: 5,
  nextReportWeek: 3
};

// 학생 이름 풀
const lastNames = ['김', '이', '박', '최', '정', '강', '조', '윤', '장', '임', '한', '오', '서', '신', '권', '황', '안', '송', '류', '전'];
const maleFirstNames = ['민준', '서준', '도윤', '예준', '시우', '하준', '주원', '지호', '지후', '준서', '준우', '현우', '도현', '지훈', '건우', '우진', '선우', '서진', '민재', '현준'];
const femaleFirstNames = ['서연', '서윤', '지우', '서현', '하윤', '하은', '민서', '지유', '윤서', '채원', '지민', '수아', '지아', '다은', '은서', '예은', '수빈', '지은', '소율', '유나'];

// 성격 특성
const personalities = [
  { type: '차분함', traits: ['신중하다', '조용하다', '책임감이 강하다'] },
  { type: '활발함', traits: ['밝다', '에너지가 넘친다', '친구를 좋아한다'] },
  { type: '예민함', traits: ['세심하다', '감수성이 풍부하다', '생각이 깊다'] },
  { type: '고집셈', traits: ['자기주관이 뚜렷하다', '목표지향적이다', '완벽주의자다'] },
  { type: '수줍음', traits: ['조심스럽다', '관찰력이 좋다', '진심이 깊다'] },
  { type: '리더형', traits: ['통솔력이 있다', '정의감이 강하다', '책임감이 강하다'] },
  { type: '창의적', traits: ['상상력이 풍부하다', '독창적이다', '자유분방하다'] },
  { type: '배려심', traits: ['따뜻하다', '타인을 배려한다', '감성이 풍부하다'] }
];

// 취미
const hobbies = ['독서', '게임', '운동', '음악 감상', '그림 그리기', '요리', '사진 촬영', '춤', '기타 연주', '피아노', '영화 감상', '만화', '프로그래밍', '원예', '베이킹', '댄스', '노래', '글쓰기'];

// 장래희망
const dreams = ['의사', '간호사', '선생님', '변호사', '판사', '검사', '경찰', '소방관', '프로그래머', '디자이너', '작가', '배우', '가수', '운동선수', '요리사', '파일럿', '연구원', '공무원', '기자', '아나운서', '아직 모름'];

// 고민 유형
const worries = [
  '진로에 대한 고민',
  '친구 관계 문제',
  '성적 스트레스',
  '가정 문제',
  '자존감 문제',
  '이성 친구 문제',
  '진학 압박',
  '외모 컴플렉스',
  '꿈을 찾지 못함',
  '부모님 기대에 부응하지 못함'
];

const subjects = ['국어', '수학', '영어', '통합사회', '통합과학', '한국사', '문학', '확률과 통계'];
const clubs = ['방송부', '댄스부', '축구부', '밴드부', '도서부', '미술부', '요리동아리', '과학동아리', '학생회', '없음'];
const academies = ['수학학원', '영어학원', '논술학원', '댄스학원', '미술학원', '보컬학원', '안 다님'];

// OpenRouter API 호출 함수
async function callOpenRouter(messages, temperature = 0.8) {
  try {
    const apiKey = process.env.OPENROUTER_API_KEY;
    console.log('[OPENROUTER CALL START]');
    console.log('[MODEL]', process.env.OPENROUTER_MODEL);
    console.log('[HAS_KEY]', !!apiKey);
    console.log('OPENROUTER KEY:', !!apiKey);
    console.log('MODEL:', process.env.OPENROUTER_MODEL);
    console.log('REQUEST:', messages);
    if (!apiKey) {
      throw new Error('OPENROUTER_API_KEY 환경변수가 설정되지 않았습니다.');
    }

    const body = {
      model: process.env.OPENROUTER_MODEL || 'google/gemini-3.1-flash-lite',
      messages: messages,
      temperature: temperature,
      max_tokens: 1000,
    };

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'http://localhost:3000',
        'X-OpenRouter-Title': 'Our Class Now - AI School Simulation',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    console.log('STATUS:', response.status);
    console.log('[OPENROUTER STATUS]', response.status);

    if (!response.ok) {
      const errText = await response.text();
      console.error('OpenRouter API error:', response.status, errText);
      throw new Error(`AI API 호출 실패: ${errText}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    console.log('[OPENROUTER SUCCESS]', {
      model: body.model,
      status: response.status,
      hasContent: !!content
    });
    return content;
  } catch (error) {
    console.error('[OPENROUTER FAILED]');
    console.error('OpenRouter Error:', error);
    throw error;
  }
}

function logFallbackResponse(feature, reason = '') {
  console.log('[FALLBACK USED]', {
    feature,
    reason
  });
  console.log('[FALLBACK RESPONSE]', {
    feature,
    reason
  });
}

function clampStat(value, fallback = 50) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(0, Math.min(100, Math.round(number)));
}

function parseJsonFromAi(response) {
  const cleaned = String(response || '')
    .replace(/```json/gi, '```')
    .replace(/```/g, '')
    .trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');

  if (start === -1 || end === -1 || end <= start) {
    throw new Error('AI 응답에서 JSON 객체를 찾지 못했습니다.');
  }

  const jsonStr = cleaned
    .slice(start, end + 1)
    .replace(/,\s*([}\]])/g, '$1');

  return JSON.parse(jsonStr);
}

function normalizeStudentData(studentData, fallback) {
  const normalizedAppearance = studentData.appearance || fallback.appearance;
  const shouldUseFallbackAppearance = fallback.gender === '남자'
    && (normalizedAppearance.includes('머리를 낮게 묶') || normalizedAppearance.includes('머리끈') || normalizedAppearance.includes('반묶음'));

  return {
    ...fallback,
    ...studentData,
    name: studentData.name || fallback.name,
    gender: studentData.gender || fallback.gender,
    appearance: shouldUseFallbackAppearance ? fallback.appearance : normalizedAppearance,
    schoolGrade: fallback.schoolGrade,
    role: fallback.role,
    avatarProfile: studentData.avatarProfile || fallback.avatarProfile,
    weakSubjects: Array.isArray(studentData.weakSubjects) ? studentData.weakSubjects : fallback.weakSubjects,
    traits: Array.isArray(studentData.traits) ? studentData.traits : fallback.traits,
    club: studentData.club || fallback.club,
    academy: studentData.academy || fallback.academy,
    reportStyle: studentData.reportStyle || fallback.reportStyle,
    relationshipBias: studentData.relationshipBias || fallback.relationshipBias,
    stressLevel: clampStat(studentData.stressLevel, fallback.stressLevel),
    selfEsteem: clampStat(studentData.selfEsteem, fallback.selfEsteem),
    trustInTeacher: clampStat(studentData.trustInTeacher, 50)
  };
}

function pickBySeed(items, seed) {
  return items[Math.abs(seed) % items.length];
}

function hashText(text) {
  return String(text).split('').reduce((sum, char, index) => {
    return sum + char.charCodeAt(0) * (index + 3);
  }, 0);
}

function randomInt(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

const fallbackCommonAppearances = [
  '앞머리를 자주 만지고, 교복 단추를 끝까지 잠근 단정한 인상',
  '동그란 안경을 쓰고 노트 모서리에 작은 낙서를 자주 남기는 편',
  '체육복을 교복 위에 걸치고 다니며 걸음이 빠른 편',
  '표정 변화가 크지 않지만 웃을 때 한쪽 보조개가 살짝 보임',
  '키가 큰 편이고 발표할 때는 허리를 곧게 세우려 애씀',
  '늘 작은 물병을 들고 다니며 손톱 주변을 만지는 버릇이 있음',
  '교복은 깔끔하지만 운동화 끈이 자주 풀려 있는 활동적인 인상',
  '눈 밑에 피곤한 기색이 있고 쉬는 시간엔 창가 쪽에 자주 서 있음'
];

const fallbackMaleAppearances = [
  '짧은 머리에 앞머리를 살짝 내리고 교복 셔츠를 단정하게 입는 편',
  '머리 옆선을 깔끔하게 정리했고 발표할 때 귀가 살짝 빨개지는 편',
  '체육복 지퍼를 끝까지 올리고 쉬는 시간엔 운동장 쪽을 자주 바라봄',
  '교복 재킷은 자주 벗어 팔에 걸치고 다니며 걸음이 빠른 편',
  '짧은 곱슬머리에 웃을 때 눈이 먼저 휘어지는 인상',
  '안경을 쓰고 필통과 공책을 각 맞춰 놓는 깔끔한 인상'
];

const fallbackFemaleAppearances = [
  '머리를 낮게 묶고 말할 때 시선을 잠깐 피하는 차분한 인상',
  '책가방에 키링이 많고 손목에 낡은 머리끈을 늘 차고 있음',
  '단발머리에 머리핀을 꽂고 공책 여백에 작은 표시를 자주 남김',
  '긴 앞머리를 귀 뒤로 넘기며 대답하기 전 잠깐 생각하는 편',
  '교복 리본을 단정히 매고 웃을 때 표정이 부드러워지는 인상',
  '머리를 반묶음으로 정리하고 쉬는 시간엔 창가 근처에 자주 있음'
];

const fallbackFamilies = [
  '부모님이 맞벌이라 집에서는 혼자 보내는 시간이 길다',
  '동생을 자주 챙겨야 해서 방과 후 시간이 늘 빠듯하다',
  '가족끼리 성적 이야기가 자주 나와 식탁 분위기가 무거워질 때가 있다',
  '부모님은 다정하지만 기대가 커서 학생이 부담을 혼자 삼키는 편이다',
  '집에서는 말수가 적어지고 학교에서 있었던 일을 잘 꺼내지 않는다',
  '조부모와 함께 살아 어른들의 시선과 잔소리를 많이 의식한다',
  '최근 가족 사이에 대화가 줄어 학생이 눈치를 보는 시간이 많아졌다',
  '경제적으로 큰 문제는 없지만 진로 선택에는 현실적인 압박을 많이 받는다',
  '형제자매와 비교를 자주 당해 작은 평가에도 예민하게 반응한다',
  '가족은 학생을 믿어주려 하지만 학생은 실망시키지 않으려 애쓴다'
];

const fallbackSpeakingStyles = [
  '처음엔 짧게 대답하지만 편해지면 예시를 들어 조심스럽게 설명함',
  '말끝을 흐리는 편이고 중요한 얘기 앞에서는 잠깐 침묵함',
  '괜찮다는 말을 자주 하지만 표정에는 걱정이 먼저 드러남',
  '논리적으로 말하려 애쓰지만 감정이 올라오면 문장이 길어짐',
  '농담으로 넘기려 하다가도 신뢰가 생기면 속마음을 직접 말함',
  '작은 목소리로 말하고, 확인받고 싶을 때 선생님 눈치를 봄',
  '감정을 바로 말하기보다 상황 설명을 길게 한 뒤 마지막에 속마음을 덧붙임',
  '대답은 빠르지만 정말 중요한 말은 몇 박자 늦게 꺼냄',
  '존댓말이 또렷하고 자기 생각을 말한 뒤 "제가 이상한 건가요?"라고 확인함',
  '처음에는 무심한 척하지만 구체적인 질문에는 꽤 솔직하게 답함'
];

const reportStyles = [
  { id: 'short', label: '단문형' },
  { id: 'polite', label: '존댓말형' },
  { id: 'slang', label: '줄임말형' },
  { id: 'emotive', label: '이모티콘형' },
  { id: 'careful', label: '조심형' },
  { id: 'rumor', label: '소문확대형' },
  { id: 'long', label: '장문형' },
  { id: 'typo', label: '맞춤법흔들림형' }
];

function createAvatarProfile(seed, isMale, appearance) {
  const hairStyles = ['short', 'bob', 'bangs', 'tied', 'wavy'];
  const hairColors = ['#2f241f', '#3a2a22', '#1f1b18', '#5a3b2e', '#2d2d34'];
  const skinTones = ['#f6d2b8', '#f1c6a8', '#e8b994', '#dba77f'];
  const outfits = ['#2f5597', '#6c5ce7', '#0984a3', '#00a86b', '#8e5a44'];

  let hairStyle = pickBySeed(hairStyles, seed + 11);
  let accessory = pickBySeed(['none', 'none', 'none', 'glasses', 'hairTie'], seed + 17);
  let expression = pickBySeed(['neutral', 'soft', 'tired', 'shy', 'bright'], seed + 23);

  if (appearance.includes('안경')) accessory = 'glasses';
  if (appearance.includes('머리를 낮게 묶') || appearance.includes('머리끈')) {
    hairStyle = 'tied';
    accessory = 'hairTie';
  }
  if (appearance.includes('앞머리')) hairStyle = 'bangs';
  if (appearance.includes('피곤')) expression = 'tired';
  if (appearance.includes('시선을 잠깐 피')) expression = 'shy';
  if (appearance.includes('웃을 때')) expression = 'soft';

  return {
    hairStyle,
    hairColor: pickBySeed(hairColors, seed + 31),
    skinTone: pickBySeed(skinTones, seed + 37),
    outfitColor: pickBySeed(outfits, seed + 41),
    accessory,
    expression,
    genderHint: isMale ? 'male' : 'female'
  };
}

function createFallbackStudent(studentNumber, fullName, isMale, personality, hobby, dream, assignedGrade, assignedRole, worry) {
  const seed = hashText(`${studentNumber}-${fullName}-${personality.type}-${hobby}-${dream}-${worry}`);
  const appearancePool = isMale
    ? [...fallbackCommonAppearances, ...fallbackMaleAppearances]
    : [...fallbackCommonAppearances, ...fallbackFemaleAppearances];
  const appearance = pickBySeed(appearancePool, seed);
  const familyEnvironment = pickBySeed(fallbackFamilies, seed + worry.length);
  const speakingStyle = pickBySeed(fallbackSpeakingStyles, seed + personality.type.length);
  const weakSubjects = [
    pickBySeed(subjects, seed + 5),
    pickBySeed(subjects.filter(subject => subject !== pickBySeed(subjects, seed + 5)), seed + 9)
  ];
  const club = pickBySeed(clubs, seed + 13);
  const academy = pickBySeed(academies, seed + 19);
  const reportStyle = pickBySeed(reportStyles, seed + 29).id;
  const avatarProfile = createAvatarProfile(seed, isMale, appearance);
  const introByPersonality = {
    '차분함': `안녕하세요, ${fullName}입니다. 말이 빠른 편은 아니지만 맡은 일은 조용히 끝까지 해보려고 해요.`,
    '활발함': `안녕하세요! ${fullName}입니다. 분위기 밝게 만드는 건 자신 있는데, 가끔은 저도 생각이 많아져요.`,
    '예민함': `안녕하세요, ${fullName}입니다. 사소한 것도 오래 생각하는 편이라 천천히 봐주시면 좋겠어요.`,
    '고집셈': `안녕하세요, ${fullName}입니다. 제가 정한 건 쉽게 놓지 않는 편인데, 요즘은 그게 장점인지 잘 모르겠어요.`,
    '수줍음': `안녕하세요... ${fullName}입니다. 처음엔 낯을 가리지만 익숙해지면 제 얘기도 조금씩 할 수 있어요.`,
    '리더형': `안녕하세요, ${fullName}입니다. 반에서 필요한 일이 있으면 해보려고 하는데, 가끔은 부담도 느껴요.`,
    '창의적': `안녕하세요, ${fullName}입니다. 평범한 방식보다 제 방식대로 해보는 걸 좋아해요.`,
    '배려심': `안녕하세요, ${fullName}입니다. 다른 사람 기분을 많이 보는 편이라 제 얘기는 조금 늦게 하는 편이에요.`
  };

  return {
    id: studentNumber,
    name: fullName,
    gender: isMale ? '남자' : '여자',
    appearance,
    avatarProfile,
    personality: personality.type,
    traits: personality.traits,
    hobby: hobby,
    dream: dream,
    schoolGrade: assignedGrade,
    familyEnvironment,
    hiddenWorry: worry,
    secret: '',
    speakingStyle,
    weakSubjects,
    club,
    academy,
    reportStyle,
    relationshipBias: {
      romanceOpen: seed % 100 < 28,
      rumorProne: seed % 100 < 34,
      sociability: personality.type === '활발함' || personality.type === '리더형' ? 70 : personality.type === '수줍음' ? 35 : 50
    },
    role: assignedRole || '',
    stressLevel: 30 + Math.floor(Math.random() * 40),
    selfEsteem: 40 + Math.floor(Math.random() * 40),
    trustInTeacher: 50,
    introduction: introByPersonality[personality.type] || `안녕하세요, ${fullName}입니다. 아직은 선생님이 낯설지만 천천히 이야기해보고 싶어요.`,
    number: studentNumber,
    friends: [],
    conflicts: [],
    memories: [],
    consultationTurns: [],
    weeklyConsulted: false,
    growthLog: [],
    summerChanges: [],
    attendance: { present: 0, absent: 0, late: 0 }
  };
}

const worryProfiles = {
  '진로에 대한 고민': {
    surface: '진로 얘기만 나오면 괜히 숨이 막혀요',
    detail: '다들 하고 싶은 게 있는 것 같은데 저는 아직 확신이 없어서, 상담 시간이나 수행평가에서도 계속 비교하게 돼요',
    need: '바로 정답을 정하라기보다 제가 뭘 좋아하는지부터 같이 정리해보고 싶어요'
  },
  '친구 관계 문제': {
    surface: '친구들 사이에서 제가 좀 겉도는 느낌이 있어요',
    detail: '점심시간이나 조별활동 때 아무렇지 않은 척하는데, 사실 누구랑 있어야 할지 계속 눈치를 보게 돼요',
    need: '제가 너무 예민한 건지, 아니면 거리를 둬야 하는 건지 잘 모르겠어요'
  },
  '성적 스트레스': {
    surface: '시험이랑 성적 생각이 머리에서 안 떠나요',
    detail: '공부를 안 하는 건 아닌데 결과가 안 나오니까, 시작하기 전부터 망할 것 같은 기분이 들어요',
    need: '혼나는 것보다 어디서부터 다시 잡아야 할지 같이 봐주시면 좋겠어요'
  },
  '가정 문제': {
    surface: '집 분위기가 요즘 좀 불편해요',
    detail: '학교에서는 티 안 내려고 하는데 집에 가면 말 한마디도 조심하게 돼서 쉬는 느낌이 안 들어요',
    need: '자세히 말하는 건 아직 어렵지만, 학교에서라도 조금 숨 돌릴 수 있었으면 좋겠어요'
  },
  '자존감 문제': {
    surface: '제가 뭘 해도 별로인 것 같다는 생각이 자주 들어요',
    detail: '칭찬을 들어도 그냥 운이 좋았던 것 같고, 실수하면 그게 진짜 제 모습 같아서 오래 남아요',
    need: '제가 잘하고 있는 것도 있다는 걸 스스로 믿을 방법을 알고 싶어요'
  },
  '이성 친구 문제': {
    surface: '누군가랑 관계가 애매해져서 신경이 쓰여요',
    detail: '친구로 지내야 하는지, 제가 착각한 건지 모르겠고 마주칠 때마다 어색해요',
    need: '소문나지 않게 차분히 정리하고 싶어요'
  },
  '진학 압박': {
    surface: '진학 얘기만 나오면 마음이 급해져요',
    detail: '지금 성적으로 갈 수 있는 곳이랑 제가 가고 싶은 곳 사이가 너무 멀게 느껴져요',
    need: '현실적으로 뭘 먼저 해야 하는지 알고 싶어요'
  },
  '외모 컴플렉스': {
    surface: '사람들이 저를 어떻게 보는지 너무 신경 쓰여요',
    detail: '별말 아닌 농담도 제 얘기처럼 들리고, 사진 찍거나 앞에 나서는 일이 부담돼요',
    need: '이런 얘기를 유난스럽다고 안 봐주셨으면 좋겠어요'
  },
  '꿈을 찾지 못함': {
    surface: '하고 싶은 게 없다는 게 제일 불안해요',
    detail: '친구들은 하나씩 정하는 것 같은데 저는 뭘 해도 오래 좋아할 자신이 없어요',
    need: '거창한 꿈 말고 작은 관심부터 찾아보고 싶어요'
  },
  '부모님 기대에 부응하지 못함': {
    surface: '부모님 기대가 고마운데도 부담스러워요',
    detail: '실망시키기 싫어서 괜찮은 척하는데, 사실은 제가 원하는 건 뭔지 잘 모르겠어요',
    need: '제 생각을 어떻게 말해야 할지 연습해보고 싶어요'
  }
};

function includesAny(text, keywords) {
  return keywords.some(keyword => text.includes(keyword));
}

function getWorryProfile(student) {
  return worryProfiles[student.hiddenWorry] || {
    surface: '요즘 마음이 계속 복잡해요',
    detail: `${student.hiddenWorry || '말로 정리하기 어려운 일'} 때문에 집중이 잘 안 되고, 혼자 생각이 많아져요`,
    need: '제가 뭘 먼저 말해야 할지 같이 정리해주시면 좋겠어요'
  };
}

function getFriendContext(student) {
  const friendNames = (student.friends || [])
    .slice(0, 2)
    .map(id => gameState.students.find(s => s.id === id)?.name)
    .filter(Boolean);
  if (!friendNames.length) return '같이 다니던 애들';
  return friendNames
    .map((name, index) => index === friendNames.length - 1 ? name : josa(name, '이랑', '랑'))
    .join(' ');
}

function getClassLeaderName() {
  return gameState.students.find(s => s.role === '반장')?.name || '반장';
}

function getMentionedStudentNames(message, currentStudent) {
  return gameState.students
    .filter(s => s.id !== currentStudent.id)
    .filter(s => {
      const givenName = s.name.length > 1 ? s.name.slice(1) : s.name;
      return message.includes(s.name) || message.includes(givenName);
    })
    .map(s => s.name);
}

function describeFamilySituation(raw = '') {
  if (includesAny(raw, ['조부모', '할머니', '할아버지', '어른들의 시선', '잔소리'])) {
    return '할머니 할아버지랑 같이 지내는 시간이 있어서 챙겨주시는 것도 있지만, 어른들 눈치를 볼 때가 많아요';
  }
  if (includesAny(raw, ['대화가 줄어', '눈치를'])) {
    return '요즘 집에서 대화가 줄어서 말 꺼내기 전에 눈치를 보게 돼요';
  }
  if (includesAny(raw, ['성적 이야기', '식탁 분위기'])) {
    return '집에서 성적 이야기가 나오면 식탁 분위기가 무거워져서 먼저 말을 아끼게 돼요';
  }
  if (includesAny(raw, ['맞벌이', '혼자 보내는 시간'])) {
    return '부모님이 바쁘셔서 집에 혼자 있는 시간이 많고, 괜찮은 척하는 게 습관이 된 것 같아요';
  }
  if (includesAny(raw, ['동생', '챙겨야'])) {
    return '집에서는 동생을 챙겨야 할 때가 많아서 제 얘기는 뒤로 미루게 돼요';
  }
  if (includesAny(raw, ['기대', '부담'])) {
    return '부모님 기대가 큰 걸 알아서 고마운데도 부담스럽게 느껴질 때가 있어요';
  }
  if (includesAny(raw, ['진로 선택', '현실적인 압박'])) {
    return '집에서는 진로 이야기가 현실적인 문제로 이어져서 제 마음을 말하기가 조심스러워요';
  }
  if (includesAny(raw, ['비교', '평가'])) {
    return '형제자매랑 비교되는 말이 나오면 작은 평가에도 제가 예민해져요';
  }
  if (includesAny(raw, ['믿어주려', '실망시키지'])) {
    return '가족이 저를 믿어주려는 건 아는데, 그래서 더 실망시키면 안 될 것 같아요';
  }
  return '집 이야기는 어디까지 말해도 되는지 아직 조심스러워요';
}

function getAbsoluteWeek(month = gameState.currentMonth, week = gameState.currentWeek) {
  return (month - 3) * 4 + week;
}

function getDateLabel() {
  return `${gameState.year}년 ${gameState.currentMonth}월 ${gameState.currentWeek}주차`;
}

function hasFinalConsonant(text) {
  const last = String(text).charCodeAt(String(text).length - 1);
  return last >= 0xac00 && last <= 0xd7a3 && (last - 0xac00) % 28 !== 0;
}

function josa(name, withConsonant, withoutConsonant) {
  return `${name}${hasFinalConsonant(name) ? withConsonant : withoutConsonant}`;
}

async function generateReport() {
  if (!gameState.students.length) return null;

  const seed = hashText(`${gameState.currentMonth}-${gameState.currentWeek}-${gameState.reports.length}`);
  const recentReports = gameState.reports.slice(-4);
  const recentTargetIds = new Set(recentReports.flatMap(report => report.relatedStudents || []));
  const stressed = [...gameState.students]
    .map(student => ({
      student,
      score: student.stressLevel + (recentTargetIds.has(student.id) ? -28 : 0) + ((seed + student.id * 5) % 9)
    }))
    .sort((a, b) => b.score - a.score)
    .map(item => item.student);
  const target = pickBySeed(stressed.slice(0, Math.min(8, stressed.length)), seed);
  const recentReporterNames = new Set(recentReports.map(report => report.reporterName).filter(Boolean));
  const reporterPool = gameState.students.filter(s => s.id !== target.id && !recentReporterNames.has(s.name));
  const reporter = pickBySeed(reporterPool.length ? reporterPool : gameState.students.filter(s => s.id !== target.id), seed + 11);
  const shouldReveal = target.stressLevel >= 72 || target.trustInTeacher >= 62 || seed % 5 === 0;
  const types = ['dating', 'isolation', 'family', 'bullying', 'self'];
  let type = pickBySeed(types, seed + target.stressLevel);
  if (target.hiddenWorry === '친구 관계 문제') type = seed % 2 === 0 ? 'isolation' : 'bullying';
  if (target.hiddenWorry === '가정 문제' || target.hiddenWorry === '부모님 기대에 부응하지 못함') type = 'family';
  if (target.hiddenWorry === '이성 친구 문제') type = 'dating';
  if (recentReports.slice(-2).every(report => report.type === type)) {
    type = pickBySeed(types.filter(candidate => candidate !== type), seed + 17);
  }
  const second = type === 'dating'
    ? pickRealisticRumorPartner(target, seed)
    : pickBySeed(gameState.students.filter(s => s.id !== target.id), seed + 5);

  const templates = {
    dating: {
      title: '이성교제 소문',
      content: buildDatingRumor(target, second, seed),
      severity: 1
    },
    isolation: {
      title: '무리에서 겉도는 학생',
      content: `요즘 ${josa(target.name, '이', '가')} 쉬는 시간마다 혼자 있는 것 같아요. 원래 같이 다니던 애들이랑도 말이 줄어서 조금 걱정돼요.`,
      severity: 2
    },
    family: {
      title: '가정 문제 의심',
      content: `${josa(target.name, '이', '가')} 집 얘기만 나오면 표정이 굳어요. 본인은 괜찮다고 하는데 자꾸 눈치를 보는 것 같아서 선생님이 조심스럽게 봐주셨으면 해요.`,
      severity: 3
    },
    bullying: {
      title: '따돌림 제보',
      content: `${josa(target.name, '이', '가')} 조별활동에서 계속 빠지는 것 같아요. 장난처럼 보이는데 당하는 사람은 힘들어 보였어요.`,
      severity: 3
    },
    self: {
      title: '직접 도움 요청',
      content: `선생님 저 ${target.name}인데요. 애들한테 따돌림 당하는 것 같아요. 제 이름은 아직 말하지 말아주세요. 그래도 너무 힘들어서 적어요.`,
      severity: 3,
      forceReveal: true
    }
  };

  const selected = templates[type];
  const fallbackContent = stylizeReportContent(selected.content, reporter, target, second, type, seed);
  const styledContent = await generateReportContentWithAI({
    reporter,
    target,
    second,
    type,
    selected,
    fallbackContent,
    seed
  });
  return {
    id: Date.now() + seed,
    date: getDateLabel(),
    type,
    title: selected.title,
    content: styledContent,
    relatedStudents: [target.id, second.id],
    reporterName: selected.forceReveal ? target.name : shouldReveal ? reporter.name : '익명',
    isAnonymous: !(selected.forceReveal || shouldReveal),
    severity: selected.severity,
    source: styledContent === fallbackContent ? 'fallback' : 'openrouter',
    read: false
  };
}

async function generateReportContentWithAI({ reporter, target, second, type, selected, fallbackContent, seed }) {
  const style = reporter.reportStyle || pickBySeed(reportStyles, seed).id;
  const recentReports = gameState.reports.slice(-4).map(report => `- ${report.title}: ${report.content}`).join('\n') || '없음';
  const prompt = `익명제보함에 들어갈 고등학교 2학년 학생의 제보 문장을 작성해줘.

반드시 지킬 사실:
- 제보 유형: ${type}
- 제목: ${selected.title}
- 제보 대상: ${target.name} (${target.personality}, 고민: ${target.hiddenWorry})
- 관련 학생: ${second?.name || '없음'}
- 제보자가 가진 말투 스타일: ${style}
- 기본 내용: ${selected.content}
- 최근 제보와 같은 문장 패턴 금지

최근 제보:
${recentReports}

스타일 지침:
- short: 짧고 건조하게
- polite: 조심스러운 존댓말
- slang: 쌤, 거 같아요 같은 학생식 줄임말
- emotive: ㅠㅠ, ... 같은 감정 표현
- careful: 확신 없고 조심스러운 말투
- rumor: 소문을 들은 듯한 말투
- long: 길고 걱정이 많은 말투
- typo: 약한 오타나 학생다운 문장

규칙:
1. 학생이 쓴 제보처럼 자연스럽게 써.
2. 사실을 바꾸지 마.
3. 폭력/따돌림/연애 루머를 과장하지 말고 학교에서 실제 돌 법한 수준으로 써.
4. 최근 제보와 같은 문장으로 시작하지 마.
5. 1~3문장만 출력하고, JSON이나 제목 없이 제보 본문만 출력해.`;

  try {
    const response = await callOpenRouter([
      { role: 'system', content: '너는 한국 고등학생의 익명제보 문장을 학생마다 다른 말투로 작성하는 도우미야.' },
      { role: 'user', content: prompt }
    ], 0.9);
    const content = cleanAiPlainText(response);
    return content || fallbackContent;
  } catch (error) {
    console.error('익명제보 OpenRouter 생성 실패, 기본 제보 사용:', error);
    logFallbackResponse('anonymous-report', error.message);
    return fallbackContent;
  }
}

function cleanAiPlainText(text) {
  return String(text || '')
    .replace(/```[\s\S]*?```/g, match => match.replace(/```[a-z]*|```/gi, ''))
    .replace(/^["'“”]+|["'“”]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function pickRealisticRumorPartner(target, seed) {
  const candidates = gameState.students
    .filter(student => student.id !== target.id)
    .map(student => {
      let score = 0;
      if (target.friends?.includes(student.id) || student.friends?.includes(target.id)) score += 35;
      if (target.club && target.club !== '없음' && target.club === student.club) score += 24;
      if (target.academy && target.academy !== '안 다님' && target.academy === student.academy) score += 22;
      if (target.gender !== student.gender) score += 38;
      else score += seed % 100 < 8 ? 18 : -50;
      if (target.relationshipBias?.romanceOpen) score += 10;
      if (student.relationshipBias?.romanceOpen) score += 10;
      score += (seed + student.id * 7) % 12;
      return { student, score };
    })
    .sort((a, b) => b.score - a.score);
  return candidates[0]?.student || pickBySeed(gameState.students.filter(s => s.id !== target.id), seed);
}

function buildDatingRumor(target, second, seed) {
  const contexts = [];
  if (target.club && target.club !== '없음' && target.club === second.club) contexts.push(`${target.club} 끝나고 같이 남아 있던데요`);
  if (target.academy && target.academy !== '안 다님' && target.academy === second.academy) contexts.push(`둘이 ${target.academy}도 같이 간다는 말이 있어요`);
  if (target.friends?.includes(second.id) || second.friends?.includes(target.id)) contexts.push('원래 친하긴 한데 요즘 쉬는 시간마다 더 붙어 다녀요');
  contexts.push('체육시간에 둘이 계속 장난치던데 반 애들이 계속 쳐다봤어요');
  contexts.push(`${target.name}${hasFinalConsonant(target.name) ? '이' : ''}가 ${second.name}${hasFinalConsonant(second.name) ? '을' : '를'} 좋아한다는 말이 돌아요`);
  const line = pickBySeed(contexts, seed);
  return `${target.name}${hasFinalConsonant(target.name) ? '이랑' : '랑'} ${second.name} 얘기가 조금 돌아요. ${line}. 진짜 사귀는지는 모르겠는데 둘 다 신경 쓰는 것 같아요.`;
}

function stylizeReportContent(content, reporter, target, second, type, seed) {
  const style = reporter.reportStyle || pickBySeed(reportStyles, seed).id;
  const intro = {
    short: ['', '그냥 봤는데요, ', '음... '],
    polite: ['선생님, ', '조심스럽게 말씀드리면, ', '혹시 참고해주셨으면 해서요. '],
    slang: ['쌤 ', '근데요 ', '약간 '],
    emotive: ['선생님ㅠㅠ ', '음... ', '저만 그런가요? '],
    careful: ['확실한 건 아닌데요, ', '제가 오해한 걸 수도 있는데, ', '괜히 말하는 건가 싶긴 한데, '],
    rumor: ['애들이 그러는데 ', '반에서 말 돌던데 ', '제가 들은 바로는 '],
    long: ['선생님, 이걸 말씀드려도 되는지 모르겠는데 계속 마음에 걸려서 남겨요. ', '며칠 지켜보다가 적는 건데요. '],
    typo: ['쌤 그게요 ', '저기요 선생님 ', '제가 보기엔요 ']
  }[style] || [''];
  let text = `${pickBySeed(intro, seed + reporter.id)}${content}`;
  if (style === 'slang') text = text.replace(/선생님/g, '쌤').replace(/것 같아요/g, '거 같아요').replace(/요\./g, '요');
  if (style === 'emotive') text += pickBySeed([' ㅠㅠ', '...', ' 혹시 한번 봐주세요.'], seed + 3);
  if (style === 'careful') text += ' 혹시 티 안 나게만 봐주세요.';
  if (style === 'rumor') text += ' 물론 진짜인지는 모르겠어요.';
  if (style === 'long') text += ` ${target.name}${hasFinalConsonant(target.name) ? '이' : ''}가 괜찮다고 해도 표정이 계속 걸려요.`;
  if (style === 'typo') text = text.replace(/계속/g, '계속').replace(/같아요/g, pickBySeed(['같아요', '가타요'], seed));
  return text;
}

function generateFallbackConsultationResponse(student, teacherMessage) {
  if (!Array.isArray(student.consultationTurns)) student.consultationTurns = [];
  if (!student.localDialogueState) {
    student.localDialogueState = {
      disclosure: 0,
      acceptedHelp: false,
      lastTopic: topicFromWorry(student.hiddenWorry),
      lastNeed: '',
      topicMomentum: 0
    };
  }

  const message = String(teacherMessage || '').replace(/\s+/g, ' ').trim();
  const context = buildConsultationContext(student, message);
  const move = interpretTeacherMessage(message, student, context, student.localDialogueState);
  const inputType = classifyTeacherInput(message);
  if (['clarification', 'reason', 'meaningless', 'short', 'aggressive', 'empathy', 'encouragement'].includes(inputType)) {
    const metaResponse = buildMetaConsultationResponse(student, inputType, context);
    if (metaResponse) {
      student.localDialogueState.disclosure = Math.min(6, (student.localDialogueState.disclosure || 0) + 1);
      return ensureNonRepeatingResponse(student, message, metaResponse, context);
    }
  }
  const responseParts = [];

  if (move.reassures) {
    responseParts.push(pickFresh([
      '그렇게 말해주시니까 바로 다 말하지 않아도 될 것 같아서 조금 안심돼요.',
      '혼내려고 묻는 게 아니라는 건 알겠어요.',
      '천천히 들어주신다고 하니까 말하기가 조금 덜 무서워요.'
    ], context.previousStudentText));
  }

  const directAnswer = buildDirectAnswer(student, move, context);
  if (move.proposes) {
    responseParts.push(buildAdaptiveProposalReaction(student, move, context));
    student.localDialogueState.acceptedHelp = true;
  } else if (directAnswer) {
    responseParts.push(directAnswer);
  } else if (move.isQuestion || move.asksOpen) {
    responseParts.push(buildOpenDisclosure(student, move, context));
  } else {
    responseParts.push(buildReflectiveResponse(student, message, context.issue));
  }

  const followUp = buildAdaptiveFollowUp(student, move, context, responseParts.join(' '));
  if (followUp) responseParts.push(followUp);

  student.localDialogueState.disclosure = Math.min(6, (student.localDialogueState.disclosure || 0) + 1);
  student.localDialogueState.lastTopic = move.topic;
  student.localDialogueState.topicMomentum = move.topic === 'general'
    ? Math.max(0, (student.localDialogueState.topicMomentum || 0) - 1)
    : 3;
  student.localDialogueState.lastNeed = context.issue.need;

  return ensureNonRepeatingResponse(student, message, cleanResponse(responseParts), context);
}

function classifyTeacherInput(message) {
  const text = String(message || '').trim();
  const compact = text.replace(/\s+/g, '');
  if (!compact) return 'meaningless';
  if (/^[?.!~ㅋㅎㅠㅜㅇ…]+$/.test(compact) || ['몰라', '모름', '글쎄', '아', '음', '응', 'ㅇㅇ', 'ㄴㄴ'].includes(compact)) return 'meaningless';
  if (/(그게무슨말|그게뭔말|무슨뜻|무슨의미|무슨말이지|뭔뜻|이게무슨|다시말해|설명해)/.test(compact)) return 'clarification';
  if (/(왜그렇게생각|왜그런생각|왜그렇게느껴|왜그런느낌|이유가뭐|왜그랬|왜그래|어째서|왜그런데)/.test(compact)) return 'reason';
  if (compact.length <= 3) return 'short';
  if (/(꺼져|닥쳐|바보|멍청|짜증나|쓸모없|왜그래|한심|거짓말|관심없)/.test(compact)) return 'aggressive';
  if (/(괜찮아|네잘못은아니야|니잘못은아니야|네탓이아니야|혼자잘못한거아니야|힘들었겠다)/.test(compact)) return 'empathy';
  if (/(잘하고있어|해볼수있어|응원|믿어|괜찮을거야|잘될거야)/.test(compact)) return 'encouragement';
  return 'serious';
}

function pickByStudent(student, candidates, salt = '') {
  const previous = (student.consultationTurns || []).map(turn => turn.student).join(' ');
  const seed = hashText(`${student.id}-${student.personality}-${student.trustInTeacher}-${salt}-${previous.length}`);
  const rotated = candidates.map((_, index) => candidates[(index + seed) % candidates.length]);
  return rotated.find(candidate => !previous.includes(candidate.slice(0, 14))) || rotated[0];
}

function buildMetaConsultationResponse(student, inputType, context) {
  const personality = student.personality || '';
  const trust = student.trustInTeacher || 50;

  if (inputType === 'clarification') {
    return buildClarificationResponse(student, context);
  }

  if (inputType === 'reason') {
    return buildReasonResponse(student, context);
  }

  if (inputType === 'aggressive') {
    student.stressLevel = clamp((student.stressLevel || 50) + 4);
    student.trustInTeacher = clamp((student.trustInTeacher || 50) - 3);
    return pickByStudent(student, [
      '선생님이 그렇게 말씀하시면 제가 더 말하기 어려워져요. 지금은 조금 시간을 두고 싶어요.',
      '제가 잘못 들은 거면 좋겠는데, 그 말은 좀 무서웠어요. 상담을 계속해도 되는지 모르겠어요.',
      '그렇게 말하시면 제가 뭘 대답해야 할지 모르겠어요. 조금만 차분하게 물어봐 주시면 좋겠어요.'
    ], inputType);
  }

  if (inputType === 'meaningless') {
    const cautious = personality === '수줍음' || personality === '예민함' || trust < 45;
    return pickByStudent(student, cautious ? [
      '선생님, 무슨 뜻인지 잘 모르겠어요. 제가 뭘 대답해야 할지도 조금 헷갈려요.',
      '혹시 제 얘기가 별로 중요하지 않은 건가요? 지금은 어떻게 받아들여야 할지 모르겠어요.',
      '제가 잘못 말한 게 있나요? 짧게만 말씀하시면 제가 눈치를 보게 돼요.'
    ] : [
      '선생님, 그건 무슨 뜻이에요? 제가 이어서 말하면 되는 건지 잘 모르겠어요.',
      '음... 제가 뭘 대답해야 할지 모르겠어요. 조금만 더 구체적으로 말해주시면 좋겠어요.',
      '지금은 질문인지 반응인지 헷갈려요. 어떤 얘기를 더 듣고 싶으신 거예요?'
    ], inputType);
  }

  if (inputType === 'short') {
    return pickByStudent(student, [
      '짧게 말씀하시니까 제가 어떻게 이어가야 할지 모르겠어요. 그래도 더 물어보시면 대답해볼게요.',
      '네... 그런데 선생님이 어떤 부분을 더 듣고 싶으신지 잘 모르겠어요.',
      '제가 계속 말해도 되는 건가요? 조금 더 구체적으로 물어봐 주시면 좋겠어요.'
    ], inputType);
  }

  if (inputType === 'empathy') {
    student.trustInTeacher = clamp((student.trustInTeacher || 50) + 1);
    if (trust >= 58 || context.turnCount >= 2) {
      return pickByStudent(student, [
        `그렇게 말해주시니까 조금 숨이 놓여요. 사실 ${context.issue.surface.replace(/요$/, '')}는 마음이 계속 있었어요.`,
        '제 잘못만은 아니라고 들으니까 조금 덜 무서워요. 그래서 다음 얘기도 해볼 수 있을 것 같아요.',
        '그 말을 듣고 나니까 제가 너무 혼자 책임지려고 했던 것 같아요. 조금 더 말해봐도 될 것 같아요.'
      ], inputType);
    }
    return pickByStudent(student, [
      '그렇게 말해주셔서 조금 안심돼요. 아직 바로 다 말하긴 어렵지만, 계속 들어주시면 좋겠어요.',
      '네... 그 말은 고마워요. 제가 괜찮은 척하느라 힘들었던 것 같아요.',
      '제 잘못이 아니라고 해주시니까 조금 덜 막혀요. 그래도 아직은 천천히 말하고 싶어요.'
    ], inputType);
  }

  if (inputType === 'encouragement') {
    student.selfEsteem = clamp((student.selfEsteem || 50) + 1);
    return pickByStudent(student, [
      '응원해주시는 건 고마워요. 그런데 제가 뭘 어떻게 해보면 좋을지 같이 정리해주시면 더 도움이 될 것 같아요.',
      '그 말은 듣기 좋아요. 그래도 막연히 괜찮다는 말보다, 제가 지금 할 수 있는 작은 걸 같이 정해보고 싶어요.',
      '믿어주신다고 하니까 조금 힘이 나요. 제가 도망치지 않게 한 단계씩 봐주시면 좋겠어요.'
    ], inputType);
  }

  return '';
}

function buildClarificationResponse(student, context) {
  const lastStudentText = getLastStudentText(student);
  const topic = inferTopicFromText(lastStudentText) || student.localDialogueState?.lastTopic || topicFromWorry(student.hiddenWorry);
  const openings = [
    '아, 제가 너무 뭉뚱그려 말했죠.',
    '제가 방금 말을 좀 애매하게 한 것 같아요.',
    '그 말은 그냥 힘들다는 뜻으로만 한 건 아니었어요.'
  ];
  const explanation = buildConcreteExplanation(student, topic, context, lastStudentText);
  return cleanResponse([
    pickByStudent(student, openings, `clarification-${topic}`),
    explanation
  ]);
}

function buildReasonResponse(student, context) {
  const lastStudentText = getLastStudentText(student);
  const topic = inferTopicFromText(lastStudentText) || student.localDialogueState?.lastTopic || topicFromWorry(student.hiddenWorry);
  const reasons = {
    self: '칭찬을 들어도 그 순간만 지나면 제가 실수했던 장면이 더 크게 떠올라요. 그래서 좋은 말을 들어도 제가 진짜 괜찮은 사람이라는 증거처럼 느껴지기보다, 금방 들킬 것 같은 느낌이 들어요.',
    friends: '친구들이 대놓고 뭐라고 한 건 아닌데, 제가 말했을 때 웃음이나 정적이 생기면 그게 계속 머리에 남아요. 그 뒤로는 제가 분위기를 망친 건 아닌지 먼저 의심하게 돼요.',
    family: '집에서는 제 말이 설명으로 들리기보다 변명처럼 들릴까 봐 겁나요. 그래서 별일 아닌 대화도 시작하기 전에 이미 조심하게 돼요.',
    study: '문제를 틀린 것보다, 다시 봐도 어디서 막혔는지 모르는 게 더 무서워요. 그러면 다음에도 똑같이 틀릴 것 같아서 시작하기 전부터 위축돼요.',
    future: '제가 하고 싶은 것과 해야 할 것 사이가 잘 구분이 안 돼요. 누가 물어보면 그럴듯한 답은 할 수 있는데, 그게 제 마음인지 확신이 없어요.',
    appearance: '사람들이 아무 말 안 해도 저를 보고 판단하는 것처럼 느껴질 때가 있어요. 그래서 사진이나 시선이 걸리는 상황이 먼저 부담스러워져요.',
    school: '반 분위기가 나쁜 건 아닌데, 장난으로 넘어가는 말들이 조용한 애들한테는 크게 느껴질 때가 있어요. 저도 그럴 때 괜히 눈치를 보게 돼요.'
  };
  return cleanResponse([
    pickByStudent(student, [
      '왜 그렇게 생각하냐면요,',
      '제가 그렇게 느끼는 이유는요,',
      '생각해보면 이유가 하나만 있는 건 아닌데요,'
    ], `reason-${topic}`),
    reasons[topic] || buildConcreteExplanation(student, topic, context, lastStudentText)
  ]);
}

function buildConcreteExplanation(student, topic, context, lastStudentText) {
  const explanations = {
    self: '예를 들면 잘했다는 말을 들어도 금방 사라지고, 작은 실수는 하루 종일 남아요. 그래서 선생님이 괜찮다고 해도 제 안에서는 "정말 그런가?" 하고 계속 의심하게 돼요.',
    friends: '친구들이 저를 싫어한다고 확실히 말할 수는 없어요. 그런데 제가 말을 꺼냈을 때 대화가 끊기거나 웃고 넘어가면, 그 순간부터 제가 잘못 낀 사람처럼 느껴져요.',
    family: '집이 항상 나쁘다는 뜻은 아니에요. 다만 제가 제 생각을 말하면 걱정이나 꾸중으로 이어질 때가 있어서, 말하기 전에 먼저 눈치를 보게 된다는 뜻이에요.',
    study: `${context.weakSubject} 문제를 틀렸다는 것보다, 다시 봐도 어디서부터 모르는지 모르겠는 게 답답해요. 그러면 공부를 해야 하는데도 책을 펴는 것부터 무서워져요.`,
    future: `${student.dream}${hasFinalConsonant(student.dream) ? '이' : '가'} 싫다는 뜻은 아니에요. 다만 그게 제가 진짜 원하는 건지, 그냥 어른들이 안심할 만한 답을 고른 건지 헷갈린다는 뜻이에요.`,
    appearance: '누가 뭐라고 하지 않아도 제가 먼저 신경이 쓰여요. 사진 찍거나 시선이 모이는 상황에서 몸이 먼저 굳는다는 뜻이에요.',
    school: '반 전체가 나쁘다는 말은 아니에요. 그냥 장난처럼 지나가는 말이나 분위기 때문에 조용한 애들이 더 조심하게 되는 순간이 있다는 뜻이에요.'
  };
  return explanations[topic] || `제가 말한 건 "${summarizeForReply(lastStudentText)}" 이 부분이에요. 그게 큰 사건 하나라기보다, 비슷한 순간이 쌓이면서 제가 먼저 겁을 먹게 된다는 뜻이었어요.`;
}

function buildConsultationContext(student, message) {
  const profile = getWorryProfile(student);
  const weakSubject = student.weakSubjects?.[0] || pickBySeed(subjects, student.id + student.name.length);
  const secondWeakSubject = student.weakSubjects?.[1] || pickBySeed(subjects, student.id + 7);
  const friendContext = getFriendContext(student);
  const previousStudentText = student.consultationTurns.map(turn => turn.student).join(' ');
  const recentSituation = buildRecentSituationSummary(student);
  const issue = {
    topic: student.hiddenWorry,
    surface: profile.surface,
    detail: profile.detail,
    need: profile.need,
    scene: getIssueScene(student, profile, weakSubject, secondWeakSubject, friendContext)
  };

  return {
    message,
    issue,
    weakSubject,
    secondWeakSubject,
    friendContext,
    mentionedStudents: getMentionedStudentNames(message, student),
    previousStudentText,
    recentSituation,
    familyEnvironment: student.familyEnvironment || '집안 이야기는 아직 자세히 말하기가 조심스러워요',
    turnCount: student.consultationTurns.length,
    trustGate: student.trustInTeacher + student.consultationTurns.length * 4
  };
}

function buildRecentSituationSummary(student) {
  const lines = [];
  if (gameState.currentEvent) {
    lines.push(`이번 주 이벤트: ${gameState.currentEvent.title} - ${gameState.currentEvent.description}`);
  }
  const relatedReports = (gameState.reports || [])
    .filter(report => report.relatedStudents?.includes(student.id))
    .slice(-2);
  relatedReports.forEach(report => {
    lines.push(`최근 제보 관련: ${report.title} - ${report.content}`);
  });
  const recentSummerChanges = (student.summerChanges || []).slice(-3);
  if (recentSummerChanges.length > 0) {
    lines.push(`방학 이후 변화: ${recentSummerChanges.map(change => change.text || change).join(', ')}`);
  }
  return lines.join('\n') || '특별히 공유된 최근 사건은 없음';
}

function getIssueScene(student, profile, weakSubject, secondWeakSubject, friendContext) {
  return {
    '진로에 대한 고민': `진로시간에 희망 학과를 적으라고 했을 때 빈칸으로 오래 있었어요. ${student.hobby}는 좋아하지만 그걸 미래라고 말해도 되는지 모르겠어요.`,
    '친구 관계 문제': `${friendContext}하고 있을 때 특히 그래요. 제가 말하면 대화가 잠깐 끊기는 느낌이 들어서 그 뒤로는 그냥 가만히 있게 돼요.`,
    '성적 스트레스': `${weakSubject}에서 틀린 문제를 다시 보면 어디서부터 모르는 건지 모르겠어요. 그러다 ${secondWeakSubject}까지 밀리면 그냥 다 놓고 싶어져요.`,
    '가정 문제': '집에 들어가기 전 엘리베이터에서 괜히 시간을 끌 때가 있어요. 문을 열면 또 눈치를 봐야 할 것 같아서요.',
    '자존감 문제': '잘했다는 말을 들어도 잠깐뿐이고, 작은 실수 하나가 계속 머리에 남아요. 그래서 새로 뭘 시작하는 것도 겁나요.',
    '이성 친구 문제': '복도에서 마주치면 아무렇지 않은 척하는데, 지나가고 나면 제가 한 말이 이상했나 계속 되감게 돼요.',
    '진학 압박': '모의고사 표를 보면 숫자가 제 가능성을 딱 정해버리는 것 같아요. 그래서 상담 자료를 보는 것도 피하게 돼요.',
    '외모 컴플렉스': '사진 찍자는 말이 나오면 먼저 뒤로 빠져요. 웃고 있어도 사람들이 제 얼굴만 볼 것 같아요.',
    '꿈을 찾지 못함': `친구들이 꿈 얘기할 때 저는 ${student.hobby}는 좋아하지만 그걸 진짜 꿈이라고 해도 되는지 모르겠어요.`,
    '부모님 기대에 부응하지 못함': `부모님은 ${student.dream}처럼 안정적인 길을 좋아하세요. 저도 싫은 건 아닌데, 그게 제 마음인지 기대에 맞추는 건지 헷갈려요.`
  }[student.hiddenWorry] || profile.detail;
}

function interpretTeacherMessage(message, student, context, state = {}) {
  const explicitTopic = detectTopicFromText(message);
  const refersBack = includesAny(message, [
    '그럼', '그러면', '그 친구', '그 애', '그 아이', '그 문제', '그 말',
    '아까', '방금', '이어서', '계속', '조용히', '자리', '먼저',
    '그렇게', '그런', '그게', '그랬', '그랬던', '그 부분', '그 상황', '둘이', '그 과목', '그 사람'
  ]);
  const topic = explicitTopic !== 'general'
    ? explicitTopic
    : refersBack && state.lastTopic
      ? state.lastTopic
      : topicFromWorry(student.hiddenWorry);

  const isQuestion = /[?？]|니$|나요$|까$|어$|니\?|나요\?|까\?/.test(message)
    || includesAny(message, ['혹시', '무슨', '어떤', '뭐', '왜', '언제', '누구', '어디', '얼마나', '자주']);
  const proposes = /(해보자|해볼까|해 볼까|하는 건 어떨까|보는 건 어떨까|말해보는 건|정리해보|연습해보|확인해보|도와줄까|불러줄까|만들어줄까|같이 해보|같이 보자|얘기.*해\s*봐도|말.*해\s*봐도|물어.*봐도|상담.*해\s*봐도)/.test(message);

  return {
    topic,
    explicitTopic,
    isQuestion,
    asksOpen: includesAny(message, ['무슨', '어떤', '뭐가', '힘들', '어려', '말해줄', '말해볼', '괜찮']),
    asksSpecific: isQuestion && includesAny(message, ['누구', '누가', '언제', '왜', '이유', '과목', '어느', '뭐야', '뭔데', '어디서부터', '사니', '살아', '듣니', '들어', '자주', '얼마나']),
    asksHelp: includesAny(message, ['도와', '어떻게 해', '필요', '해줄', '좋을까', '원하', '바라']),
    proposes,
    reassures: includesAny(message, ['괜찮아', '괜찮으니까', '천천히', '기다릴', '편하게', '혼내려고', '네 잘못', '네 탓']),
    targets: detectQuestionTargets(message, topic),
    refersBack
  };
}

function detectTopicFromText(message) {
  return includesAny(message, ['학교생활', '학교 생활', '반 분위기', '학급', '반장', '부반장', '담임', '수업시간', '쉬는 시간', '조회', '말을 잘 안 따라', '말 잘 안 따라', '따라주니', '따라주'])
    ? 'school'
    : includesAny(message, ['친구', '관계', '따돌', '무리', '단둘이', '조별', '소문', '사귀', '짝사랑'])
    ? 'friends'
    : includesAny(message, ['성적', '시험', '공부', '과목', '수행'])
      ? 'study'
      : includesAny(message, ['부모', '가족', '집', '가정', '할머니', '할아버지', '어른', '꾸중', '혼나', '잔소리'])
        ? 'family'
        : includesAny(message, ['진로', '꿈', '장래', '하고 싶은', '공무원', '직업', '미래'])
          ? 'future'
          : includesAny(message, ['외모', '얼굴', '사진', '키', '몸', '생김새'])
            ? 'appearance'
            : includesAny(message, ['자존감', '자신감', '내가 싫', '쓸모', '못난'])
              ? 'self'
              : 'general';
}

function topicFromWorry(worry = '') {
  if (includesAny(worry, ['친구', '이성'])) return 'friends';
  if (includesAny(worry, ['성적', '진학'])) return 'study';
  if (includesAny(worry, ['가정', '부모'])) return 'family';
  if (includesAny(worry, ['진로', '꿈'])) return 'future';
  if (includesAny(worry, ['외모'])) return 'appearance';
  if (includesAny(worry, ['자존감'])) return 'self';
  return 'general';
}

function detectQuestionTargets(message, topic) {
  const targets = new Set();
  if (includesAny(message, ['학교생활', '학교 생활', '반 분위기', '학급', '반장', '부반장', '수업시간', '쉬는 시간', '조회', '말을 잘 안 따라', '말 잘 안 따라', '따라주니', '따라주'])) targets.add('school');
  if (includesAny(message, ['반장', '부반장', '말은 잘 들어', '말 잘 들어', '말을 잘 안 따라', '말 잘 안 따라', '따라주니', '따라주'])) targets.add('leader');
  if (/(얘기.*해\s*봐도|말.*해\s*봐도|물어.*봐도|상담.*해\s*봐도|불러서|불러볼|중재)/.test(message)) targets.add('mediation');
  if (includesAny(message, ['누구랑', '같이 사', '가족', '할머니', '할아버지', '부모님', '엄마', '아빠'])) targets.add('people');
  if (includesAny(message, ['꾸중', '혼나', '잔소리', '때리', '맞', '무섭', '위험'])) targets.add('discipline');
  if (includesAny(message, ['탐탁찮', '반대', '싫어하', '못마땅', '허락', '응원'])) targets.add('approval');
  if (includesAny(message, ['과목', '시험', '성적', '공부', '어디서부터', '단원'])) targets.add('study');
  if (includesAny(message, ['누구', '누가', '친구', '그 애', '그 친구', '무리'])) targets.add('person');
  if (includesAny(message, ['왜', '이유', '때문'])) targets.add('reason');
  if (includesAny(message, ['기분', '마음', '느낌', '괜찮', '힘들', '어려'])) targets.add('emotion');
  if (includesAny(message, ['하고 싶', '원하', '바라', '필요'])) targets.add('need');
  if (includesAny(message, ['자주', '얼마나', '언제부터', '언제'])) targets.add('frequency');
  if (includesAny(message, ['꿈', '진로', '장래', '미래', '직업'])) targets.add('future');
  if (includesAny(message, ['외모', '사진', '얼굴', '몸', '키'])) targets.add('appearance');
  if (targets.size === 0 && topic !== 'general') targets.add(topic);
  return [...targets];
}

function pickFresh(candidates, previousText) {
  return candidates.find(candidate => !previousText.includes(candidate.slice(0, 10))) || candidates[candidates.length - 1];
}

function buildDirectAnswer(student, move, context) {
  const message = context.message;
  const targets = move.targets;

  if (targets.includes('mediation')) {
    const names = context.mentionedStudents.length
      ? context.mentionedStudents.join(', ')
      : '그 친구들';
    return `${names}${hasFinalConsonant(names) ? '한테' : '한테'} 물어보셔도 되는데, 제가 선생님께 말한 거라고 바로 얘기하지는 말아주세요. 그냥 요즘 쉬는 시간이나 조별활동 분위기가 어떤지 먼저 물어봐주시면 덜 무서울 것 같아요.`;
  }

  if (move.topic === 'school' || targets.includes('school') || targets.includes('leader')) {
    const leaderName = getClassLeaderName();
    if (targets.includes('frequency')) {
      return `처음부터 심했던 건 아니고, ${gameState.currentMonth}월 들어 조별활동이나 쉬는 시간이 많아지면서 더 눈에 띄었어요. 반장 말도 대체로 듣긴 하는데 장난처럼 넘기는 애들이 생기면 조용한 애들은 그냥 따라가게 되는 것 같아요.`;
    }
    if (targets.includes('leader')) {
      if (includesAny(message, ['네 말', '너 말', '네가 말', '니 말', '네 말을', '너의 말'])) {
        return '제 말을 아예 안 듣는다는 느낌은 아닌데, 제가 조심스럽게 말하면 장난처럼 넘기는 애들이 있어요. 그러면 제가 괜히 나서는 사람처럼 보일까 봐 더 작게 말하게 돼요.';
      }
      if (student.role === '반장') {
        return '제가 반장이긴 한데, 다들 제 말을 엄청 잘 듣는다는 느낌은 아니에요. 그래도 대놓고 무시한다기보다는 장난치다가 분위기가 흐트러질 때가 있어서 그때 제가 괜히 눈치를 보게 돼요.';
      }
      return `${leaderName}${hasFinalConsonant(leaderName) ? '이' : ''}가 반장으로 챙기려고 하면 대부분은 따라주는 편이에요. 다만 몇몇 애들은 장난처럼 넘길 때가 있어서, 분위기가 산만해지면 말 꺼내기가 조금 조심스러워져요.`;
    }
    if (includesAny(message, ['학교생활', '학교 생활', '어떠'])) {
      return '학교에서는 크게 튀지 않으려고 지내요. 친구들이랑 웃을 때도 있는데, 쉬는 시간이나 조별활동에서는 제가 괜히 분위기를 못 맞추는 건 아닌지 신경 쓰일 때가 있어요.';
    }
    return '반 분위기는 나쁘진 않은데, 조용한 애들이나 눈치 보는 애들은 잘 안 보일 때가 있어요. 저도 괜찮은 척하고 지나가는 날이 많아요.';
  }

  if (move.topic === 'family' || targets.includes('people') || targets.includes('discipline')) {
    if (targets.includes('frequency')) {
      return '완전히 갑자기 그런 건 아니고, 요즘 들어 집에 가기 전부터 눈치를 더 보게 됐어요. 별일 아닌 날도 있는데 대화가 길어지면 제가 먼저 조심하게 돼요.';
    }
    if (targets.includes('approval')) {
      const activity = includesAny(message, ['춤', '댄스'])
        ? '춤추는 것'
        : includesAny(message, [student.hobby])
          ? student.hobby
          : '제가 좋아하는 것';
      return `대놓고 하지 말라고 하신 건 아닌데, ${activity} 얘기를 꺼내면 공부나 진로부터 걱정하시는 느낌이에요. 그래서 좋아한다고 말해도 되는 건지 자꾸 눈치를 보게 돼요.`;
    }
    if (targets.includes('discipline')) {
      if (includesAny(message, ['맞', '때리', '폭력'])) {
        return '맞는다고 딱 말하기는 아직 무서워요. 그래도 집에서 큰소리가 나거나 분위기가 싸해지면 제가 먼저 숨게 되는 건 맞아요.';
      }
      return '자주 크게 혼나는 건 아닌데, 작은 실수에도 바로 한마디 들을까 봐 눈치를 봐요. 그래서 집에서는 편하게 쉬기보다 조용히 문제 안 만들려고 하는 편이에요.';
    }
    if (targets.includes('people')) {
      const hasGrandparents = includesAny(message + context.familyEnvironment, ['할머니', '할아버지', '조부모']);
      if (hasGrandparents) {
        return '네, 같이 지내는 시간이 있어요. 챙겨주시는 것도 있는데 어른들이 많다 보니까 집에서도 말이나 행동을 조심하게 돼요.';
      }
      return `${describeFamilySituation(context.familyEnvironment)}. 자세히 말하면 가족 흉을 보는 것처럼 들릴까 봐 아직은 조금 조심스러워요.`;
    }
    return '집 얘기는 어디까지 말해도 되는지 잘 모르겠어요. 괜찮은 날도 있는데, 눈치를 보는 시간이 많아서 집에 가기 전부터 마음이 무거울 때가 있어요.';
  }

  if (move.topic === 'study' || targets.includes('study')) {
    if (context.previousStudentText.includes(`${context.weakSubject}가 제일`) || context.previousStudentText.includes(`${context.weakSubject}에서`)) {
      return `${context.weakSubject}는 해설을 보면 알 것 같은데 혼자 풀려고 하면 첫 단계에서 멈춰요. 틀린 이유를 쓰라고 하면 그냥 "몰라서"라고밖에 못 쓰겠어서 더 답답해요.`;
    }
    return `${context.weakSubject}가 제일 걱정돼요. 틀린 문제를 다시 봐도 어디서부터 모르는지 모르겠고, ${context.secondWeakSubject}까지 밀리면 그냥 늦었다는 생각이 들어요.`;
  }

  if (move.topic === 'friends' || targets.includes('person')) {
    if (targets.includes('frequency')) {
      return '처음엔 그냥 한두 번 어색한 정도였는데, 쉬는 시간이나 조별활동 때 비슷한 느낌이 반복되면서 제가 더 신경 쓰게 됐어요.';
    }
    if (includesAny(message, ['사귀', '좋아하', '이성', '소문'])) {
      return '그 얘기가 반에서 돌면 괜히 더 의식하게 돼요. 진짜 마음이 뭔지도 헷갈리는데 남들이 먼저 정해버리는 것 같아서 불편해요.';
    }
    if (context.previousStudentText.includes(context.friendContext) || context.previousStudentText.includes('분위기가')) {
      return '제가 말을 꺼냈을 때 잠깐 정적이 생기거나 웃으면서 넘기면 그때부터 머리가 하얘져요. 싫다는 표시인지 아닌지 모르겠어서 그냥 제가 눈치 없는 사람처럼 느껴져요.';
    }
    return `${context.friendContext}하고 있을 때 특히 그래요. 대놓고 괴롭히는 건 아닌데, 제가 말하면 분위기가 끊기는 느낌이 들어서 그 뒤로는 가만히 있게 돼요.`;
  }

  if (move.topic === 'future' || targets.includes('future')) {
    if (context.previousStudentText.includes(student.hobby) || context.previousStudentText.includes(student.dream)) {
      return `${student.hobby} 얘기를 하면 편한데, 그걸 진짜 진로로 적으려면 갑자기 장난처럼 보일까 봐 겁나요. ${student.dream}은 안정적이긴 한데 제 마음이 따라가는지는 잘 모르겠어요.`;
    }
    return `${student.dream}이 싫다기보다는, 그게 제 선택인지 그냥 안전한 답인지 모르겠어요. ${student.hobby} 얘기를 할 때는 더 편한데 그걸 진로라고 말하기는 겁나요.`;
  }

  if (move.topic === 'appearance' || targets.includes('appearance')) {
    return '사진 찍자는 말이 나오면 먼저 뒤로 빠지게 돼요. 별말 아닌 농담도 제 얘기처럼 들려서, 사람들이 저를 보는 것 같으면 표정부터 굳어요.';
  }

  if (move.topic === 'self' || context.issue.topic === '자존감 문제') {
    return '잘했다는 말을 들어도 잠깐뿐이고, 실수한 것만 오래 남아요. 그래서 선생님이 괜찮다고 해도 제가 진짜 괜찮은 사람인지 잘 믿어지지 않아요.';
  }

  if (targets.includes('emotion')) {
    return `${context.issue.surface}. 말로 하면 별일 아닌 것처럼 들릴까 봐 계속 삼키게 돼요.`;
  }

  return '';
}

function buildAdaptiveProposalReaction(student, move, context) {
  if (move.targets.includes('mediation')) {
    const names = context.mentionedStudents.length
      ? context.mentionedStudents.join(', ')
      : '그 친구들';
    return `${names}${hasFinalConsonant(names) ? '한테' : '한테'} 조심스럽게 물어봐주시는 건 괜찮아요. 다만 제가 고자질한 것처럼 보이면 더 어색해질 것 같아서, 제 이름은 먼저 꺼내지 말아주세요.`;
  }
  if (move.topic === 'friends') {
    if (includesAny(context.message, ['자리', '불러', '중재', '조용히'])) {
      return '그렇게 자리를 만들어주시면 해볼 수 있을 것 같아요. 다만 처음부터 제가 힘들었다고 꺼내면 울컥할 것 같아서, 선생님이 먼저 서로 오해가 있는지 확인해보자고 열어주시면 좋겠어요.';
    }
    return '그 말은 제가 하고 싶었던 말에 가까워요. 바로 말하면 목소리가 떨릴 것 같아서, 먼저 종이에 적어보고 말해도 될까요?';
  }
  if (move.topic === 'study') {
    return `그렇게 작게 나눠서 해보는 건 괜찮을 것 같아요. 오늘은 ${context.weakSubject}에서 틀린 문제를 전부 보려 하지 말고, 제가 어디서 멈추는지만 같이 확인해보고 싶어요.`;
  }
  if (move.topic === 'family') {
    return '바로 집에서 말하라고 하면 못 할 것 같은데, 먼저 제 생각을 짧게 적어보는 건 해볼 수 있을 것 같아요. 선생님이 너무 공격적으로 들리지 않는지 봐주시면 좋겠어요.';
  }
  if (move.topic === 'future') {
    return `정답을 바로 정하지 않아도 된다면 조금 편해요. 제가 ${student.hobby}를 좋아하는 이유랑 ${student.dream}이 부담스러운 이유를 나눠서 적어볼게요.`;
  }
  return '바로 잘할 자신은 없지만, 선생님이 옆에서 한 번만 더 확인해주시면 피하지 않고 해볼게요.';
}

function buildReflectiveResponse(student, message, issue) {
  const shortEcho = message.length > 34 ? `${message.slice(0, 34)}...` : message;
  if (!message) return `${issue.surface}. 어디서부터 말해야 할지 아직 잘 모르겠어요.`;
  return `"${shortEcho}"라고 말씀하시니까 제가 그냥 넘기던 부분을 다시 보게 돼요. ${issue.scene}`;
}

function buildOpenDisclosure(student, move, context) {
  if (context.trustGate < 52 && context.turnCount < 2) {
    return `아직 자세히 말하기는 조금 조심스러운데, ${context.issue.surface}.`;
  }
  if (context.previousStudentText.includes(context.issue.detail.slice(0, 12))) {
    return context.issue.scene;
  }
  if (move.topic === 'family' || includesAny(context.issue.detail, ['가족', '부모', '집', '눈치'])) {
    return describeFamilySituation(context.familyEnvironment);
  }
  return context.issue.detail;
}

function buildAdaptiveFollowUp(student, move, context, currentText) {
  if (move.targets.includes('mediation')) return '';
  if (move.topic === 'school') return '';
  if (!move.proposes && !move.asksHelp) {
    if (context.turnCount < 1 || currentText.includes('될까요')) return '';
    return pickFresh([
      '선생님이 바로 해결해주길 바란다기보다, 제가 피하지 않게 옆에서 한 번만 더 물어봐 주시면 좋겠어요.',
      '오늘은 여기까지 말한 것만으로도 조금 정리가 된 것 같아요.',
      '다음에는 제가 실제로 어떤 상황에서 멈칫하는지부터 더 말해볼게요.'
    ], context.previousStudentText + currentText);
  }
  if (move.topic === 'friends') return '다음엔 제가 실제로 하고 싶은 말을 한 문장으로 먼저 써볼게요.';
  if (move.topic === 'study') return `다음 상담 때 ${context.weakSubject} 오답 하나만 가져와도 될까요?`;
  if (move.topic === 'family') return '오늘은 집에 가서 바로 말하기보다, 제가 하고 싶은 말을 메모해볼게요.';
  if (move.topic === 'future') return '다음에는 좋아하는 것과 부담스러운 것을 따로 적어와볼게요.';
  return '다음에는 제가 피하지 않고 한 가지는 더 구체적으로 말해볼게요.';
}

function cleanResponse(parts) {
  const text = parts
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
  const sentences = text.match(/[^.!?。？！]+[.!?。？！]?/g) || [text];
  return sentences
    .slice(0, 4)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getLastStudentText(student) {
  const turns = student.consultationTurns || [];
  return turns.length ? turns[turns.length - 1].student || '' : '';
}

function inferTopicFromText(text = '') {
  if (includesAny(text, ['친구', '애들', '무리', '조별', '분위기', '대화가 끊', '혼자'])) return 'friends';
  if (includesAny(text, ['가족', '부모', '집', '꾸중', '눈치', '어른'])) return 'family';
  if (includesAny(text, ['성적', '공부', '문제', '과목', '오답', '시험'])) return 'study';
  if (includesAny(text, ['진로', '꿈', '장래', '직업', '미래'])) return 'future';
  if (includesAny(text, ['외모', '사진', '얼굴', '몸', '키', '시선'])) return 'appearance';
  if (includesAny(text, ['괜찮은 사람', '자존감', '실수', '잘했다', '믿어지지', '못난'])) return 'self';
  if (includesAny(text, ['학교', '반장', '부반장', '학급', '쉬는 시간', '수업'])) return 'school';
  return '';
}

function summarizeForReply(text = '') {
  return String(text).replace(/\s+/g, ' ').trim().slice(0, 34);
}

function normalizeForSimilarity(text = '') {
  return String(text)
    .replace(/[^\p{L}\p{N}]+/gu, '')
    .toLowerCase();
}

function makeBigrams(text = '') {
  const normalized = normalizeForSimilarity(text);
  if (normalized.length <= 1) return new Set(normalized ? [normalized] : []);
  const result = new Set();
  for (let i = 0; i < normalized.length - 1; i++) {
    result.add(normalized.slice(i, i + 2));
  }
  return result;
}

function textSimilarity(a = '', b = '') {
  const setA = makeBigrams(a);
  const setB = makeBigrams(b);
  if (setA.size === 0 || setB.size === 0) return 0;
  let overlap = 0;
  setA.forEach(item => {
    if (setB.has(item)) overlap++;
  });
  return (2 * overlap) / (setA.size + setB.size);
}

function isTooSimilarToRecent(student, response, context) {
  const recent = (student.consultationTurns || []).slice(-5).map(turn => turn.student || '').filter(Boolean);
  const basicTexts = [
    context?.issue?.surface,
    context?.issue?.detail,
    context?.issue?.scene
  ].filter(Boolean);
  return [...recent, ...basicTexts].some(previous => {
    if (!previous || previous.length < 12) return false;
    if (response.includes(previous) || previous.includes(response)) return true;
    return textSimilarity(response, previous) >= 0.7;
  });
}

function buildNonRepeatingRepair(student, message, context) {
  const inputType = classifyTeacherInput(message);
  const lastStudentText = getLastStudentText(student);
  const topic = inferTopicFromText(lastStudentText) || student.localDialogueState?.lastTopic || topicFromWorry(student.hiddenWorry);

  if (inputType === 'clarification') {
    return cleanResponse([
      '제가 같은 말만 반복한 것 같아요.',
      buildConcreteExplanation(student, topic, context, lastStudentText)
    ]);
  }
  if (inputType === 'reason') {
    return cleanResponse([
      '이유를 더 정확히 말해보면요,',
      buildReasonDetailByTopic(student, topic, context)
    ]);
  }
  if (inputType === 'meaningless' || inputType === 'short') {
    return pickByStudent(student, [
      '선생님, 지금은 제가 뭘 대답해야 할지 잘 모르겠어요. 질문을 조금만 더 구체적으로 해주시면 그 부분에 맞춰서 말해볼게요.',
      '제가 같은 얘기만 반복하고 있는 것 같아요. 어느 부분을 더 듣고 싶으신지 말씀해주시면 거기부터 다시 말할게요.',
      '짧게만 말씀하시면 제가 방향을 잘 못 잡겠어요. 방금 말 중에서 궁금한 부분을 하나만 집어주실 수 있을까요?'
    ], `repair-${inputType}`);
  }
  return cleanResponse([
    '제가 방금은 너무 비슷하게 말한 것 같아요.',
    buildConcreteExplanation(student, topic, context, lastStudentText)
  ]);
}

function buildReasonDetailByTopic(student, topic, context) {
  const details = {
    self: '칭찬보다 실수가 더 오래 기억나요. 그래서 좋은 말을 들어도 잠깐 안심했다가, 곧 제가 또 망칠 거라는 생각으로 돌아가요.',
    friends: '상대가 싫다고 직접 말한 건 아닌데, 표정이나 웃음이 애매하면 제가 먼저 물러나게 돼요. 확인하기 전에 이미 거절당한 것처럼 느껴질 때가 있어요.',
    family: '집에서는 말 한마디가 분위기를 바꿀까 봐 겁나요. 그래서 제 생각을 말하기보다 괜찮은 척하고 넘어가는 쪽을 고르게 돼요.',
    study: `${context.weakSubject}를 못해서라기보다, 어디서부터 다시 해야 하는지 모르는 게 커요. 시작점을 못 찾으니까 계속 미루게 돼요.`,
    future: `${student.dream}${hasFinalConsonant(student.dream) ? '이라는' : '라는'} 답은 할 수 있는데, 그 답을 말할 때 마음이 편하지 않아요. 누군가 실망하지 않을 답을 고르는 느낌이 있어요.`,
    appearance: '누가 놀리지 않아도 제가 먼저 비교하게 돼요. 그래서 별일 아닌 시선도 제 단점만 보는 것처럼 느껴져요.',
    school: '반 분위기가 커질수록 조용한 애들이 말하기 어려워져요. 저도 그중 하나가 되는 순간이 있어서 더 크게 느끼는 것 같아요.'
  };
  return details[topic] || '큰 사건 하나 때문이라기보다 작은 순간들이 쌓였어요. 그래서 말로 설명하려고 하면 별일 아닌 것처럼 들릴까 봐 더 망설이게 돼요.';
}

function ensureNonRepeatingResponse(student, message, response, context = null) {
  const safeContext = context || buildConsultationContext(student, message);
  let cleaned = cleanResponse([response]);
  if (!cleaned) {
    cleaned = buildNonRepeatingRepair(student, message, safeContext);
  }
  if (isTooSimilarToRecent(student, cleaned, safeContext)) {
    const repaired = buildNonRepeatingRepair(student, message, safeContext);
    if (!isTooSimilarToRecent(student, repaired, safeContext)) {
      return repaired;
    }
    return '제가 방금은 같은 말만 반복한 것 같아요. 이번엔 상황을 하나로 좁혀서 말해볼게요. 그 순간에 저는 대답을 못 해서가 아니라, 뭘 말해도 이상하게 들릴까 봐 먼저 멈추게 돼요.';
  }
  return cleaned;
}

function generateEmergencyConsultationResponse(student, teacherMessage) {
  const message = String(teacherMessage || '').replace(/\s+/g, ' ').trim();
  const compact = message.replace(/\s+/g, '');
  const relationship = buildRelationshipSummary(student);
  const recent = getRecentStudentResponses(student, 3).join(' ');
  const seed = hashText(`${student.id}-${student.name}-${message}-${recent.length}`);
  const friendNames = relationship.friends;
  const firstFriend = friendNames.length ? friendNames[seed % friendNames.length] : '';
  const secondFriend = friendNames.length > 1 ? friendNames[(seed + 1) % friendNames.length] : '';
  const sameClub = relationship.sameClub[0];
  const sameAcademy = relationship.sameAcademy[0];

  const speakingPrefix = student.personality === '수줍음' || student.personality === '예민함'
    ? '음... '
    : student.personality === '활발함'
      ? '아, '
      : '';

  let response;
  if (/(누구랑|친하게|친한|친구|같이\s*지내|같이있|같이다녀)/.test(compact)) {
    if (friendNames.length >= 2) {
      response = `${speakingPrefix}${josa(firstFriend, '이랑', '랑')} ${josa(secondFriend, '이랑', '랑')}은 쉬는 시간에 자주 같이 있어요. 엄청 떠드는 사이는 아니어도, 같이 있으면 제가 덜 어색해서 자연스럽게 붙어 있게 돼요.`;
    } else if (friendNames.length === 1) {
      response = `${speakingPrefix}${josa(firstFriend, '이랑', '랑')} 제일 자주 같이 있어요. 막 깊은 얘기를 매번 하는 건 아닌데, 점심시간이나 이동할 때 같이 있으면 마음이 조금 편해요.`;
    } else if (sameClub) {
      response = `${speakingPrefix}아직 엄청 친하다고 말할 친구는 잘 모르겠어요. 그래도 ${josa(sameClub, '이랑', '랑')}은 ${student.club}에서 자주 마주쳐서 다른 애들보다는 덜 어색해요.`;
    } else {
      response = `${speakingPrefix}딱 누구랑 제일 친하다고 말하기는 조금 애매해요. 쉬는 시간에는 가까운 자리에 있는 애들이랑 얘기하지만, 제가 먼저 깊게 다가가는 편은 아니에요.`;
    }
  } else if (/(학교생활|학교 생활|반 분위기|요즘학교|학교는|반은|수업|쉬는시간|어때)/.test(compact)) {
    const withFriend = firstFriend ? `${josa(firstFriend, '이랑', '랑')} 있을 때는 그래도 말이 조금 편해요` : '';
    if (student.role) {
      if (student.personality === '리더형' || student.personality === '활발함') {
        response = `${speakingPrefix}${student.role} 맡고 나서는 반이 어떻게 돌아가는지 먼저 보게 돼요. 애들이 잘 따라와 주는 날은 괜찮은데, 장난이 길어지면 제가 어디까지 말해야 할지 고민돼요. ${withFriend || '그래도 쉬는 시간엔 애들이랑 웃으면서 풀려고 해요.'}`;
      } else if (student.personality === '수줍음' || student.personality === '예민함') {
        response = `${speakingPrefix}${student.role}이긴 한데 앞에서 말하는 게 매번 편하진 않아요. 반 분위기가 흐트러지면 제가 괜히 예민하게 구는 것처럼 보일까 봐 한 번 더 망설여요. ${withFriend || '그래서 쉬는 시간에도 분위기를 먼저 살피게 돼요.'}`;
      } else {
        response = `${speakingPrefix}${student.role}이라 그런지 반 분위기를 자꾸 살피게 돼요. 애들이 웃고 떠들면 괜찮아 보이는데, 조용한 애들이 그냥 묻히는 순간도 보여서 신경 쓰여요. ${withFriend || '쉬는 시간에는 제가 먼저 분위기를 보느라 조금 지칠 때도 있어요.'}`;
      }
    } else if (student.personality === '활발함') {
      response = `${speakingPrefix}학교는 막 싫진 않아요. 쉬는 시간에 얘기할 때는 괜찮은데, 수업이나 조별활동에서 분위기가 이상해지면 갑자기 눈치가 보여요. ${withFriend || '그래도 친한 애들이 옆에 있으면 금방 풀리는 편이에요.'}`;
    } else if (student.personality === '수줍음' || student.personality === '예민함') {
      response = `${speakingPrefix}학교에서는 그냥 조용히 지내려고 해요. 쉬는 시간도 편한 날은 있는데, 말 한마디 잘못하면 어색해질까 봐 먼저 생각이 많아져요. ${withFriend || '그래서 혼자 있는 시간이 생겨도 티 안 내려고 해요.'}`;
    } else {
      response = `${speakingPrefix}요즘은 수업보다 쉬는 시간 분위기가 더 신경 쓰여요. 반이 시끄러운 날엔 괜찮은 척 따라가는데, 사실은 제가 어디에 끼어야 할지 잠깐 헷갈릴 때가 있어요. ${withFriend || '그래도 크게 문제 만들지 않으려고 지내고 있어요.'}`;
    }
  } else if (/(그게무슨말|무슨뜻|무슨말이야|뭔뜻|그게뭐야|설명)/.test(compact)) {
    response = getLastStudentText(student)
      ? `${speakingPrefix}제가 방금 너무 뭉뚱그려 말한 것 같아요. 제 말은 큰 사건 하나가 있다는 뜻보다, 그런 상황이 반복되면 제가 먼저 눈치를 보게 된다는 뜻이었어요.`
      : `${speakingPrefix}제가 아직 정리를 잘 못 해서 애매하게 말한 것 같아요. 한마디로 말하면 괜찮은 척은 하는데, 속으로는 계속 신경 쓰이는 게 있다는 뜻이에요.`;
  } else if (/^[?.!~ㅋㅎㅠㅜㅇ…]+$/.test(compact) || ['몰라', '모름', '글쎄', '아', '음', '응', 'ㅇㅇ', 'ㄴㄴ'].includes(compact)) {
    response = student.personality === '예민함' || student.personality === '수줍음'
      ? '선생님, 방금은 무슨 뜻인지 잘 모르겠어요. 제가 계속 말해도 되는 건지 아니면 멈춰야 하는 건지 조금 헷갈려요.'
      : '그건 무슨 반응이에요? 제가 이어서 말하면 되는 건지 잘 모르겠어서, 조금만 더 구체적으로 말해주시면 좋겠어요.';
  } else if (/(왜|이유|어째서)/.test(compact)) {
    response = `${speakingPrefix}그렇게 느끼는 이유는 한 번에 생긴 일 때문은 아니에요. 비슷한 상황이 몇 번 반복되면, 제가 먼저 조심하고 피하는 쪽으로 생각이 굳어져요.`;
  } else {
    response = `${speakingPrefix}선생님이 방금 하신 말은 들었어요. 바로 답을 잘 고르긴 어렵지만, 제 입장에서는 그 얘기를 들으니까 제가 평소에 넘기던 부분을 다시 생각하게 돼요.`;
  }

  return ensureNonRepeatingResponse(student, message, response, buildConsultationContext(student, message));
}

function getRecentStudentResponses(student, count = 5) {
  return (student.consultationTurns || [])
    .slice(-count)
    .map(turn => turn.student)
    .filter(Boolean);
}

function getStudentNamesByIds(ids = []) {
  return ids
    .map(id => gameState.students.find(student => student.id === id)?.name)
    .filter(Boolean);
}

function buildRelationshipSummary(student) {
  const friendNames = getStudentNamesByIds(student.friends || []);
  const conflictNames = getStudentNamesByIds(student.conflicts || []);
  const sameClub = student.club && student.club !== '없음'
    ? gameState.students.filter(other => other.id !== student.id && other.club === student.club).map(other => other.name)
    : [];
  const sameAcademy = student.academy && student.academy !== '안 다님'
    ? gameState.students.filter(other => other.id !== student.id && other.academy === student.academy).map(other => other.name)
    : [];

  return {
    friends: friendNames,
    conflicts: conflictNames,
    sameClub,
    sameAcademy,
    text: [
      `친한 친구: ${friendNames.join(', ') || '아직 뚜렷하지 않음'}`,
      `껄끄러운 학생: ${conflictNames.join(', ') || '아직 뚜렷하지 않음'}`,
      `같은 동아리: ${sameClub.slice(0, 5).join(', ') || '없음'}`,
      `같은 학원: ${sameAcademy.slice(0, 5).join(', ') || '없음'}`
    ].join('\n')
  };
}

function describeEmotionState(student) {
  const stress = student.stressLevel || 50;
  const esteem = student.selfEsteem || 50;
  const trust = student.trustInTeacher || 50;
  const stressText = stress >= 70 ? '매우 긴장하고 방어적임' : stress >= 55 ? '걱정이 많고 조심스러움' : '비교적 안정적임';
  const esteemText = esteem <= 40 ? '자기확신이 낮음' : esteem <= 60 ? '자존감이 흔들림' : '자기표현 여지가 있음';
  const trustText = trust >= 65 ? '담임을 꽤 신뢰함' : trust >= 45 ? '조심스럽지만 대화 가능' : '담임에게 아직 경계심이 큼';
  return `${stressText}, ${esteemText}, ${trustText}`;
}

function buildConsultationSystemPrompt(student, userIntent, userMessage) {
  const recentResponses = getRecentStudentResponses(student, 5);
  const consultationSummary = (student.memories || []).slice(-5).map(m => `- ${m}`).join('\n') || '아직 기억이 없음';
  const relationshipSummary = buildRelationshipSummary(student);

  return `너는 한국 일반계 고등학교 2학년 학생 "${student.name}"이다. 담임 선생님과 1:1 상담 중이며, 반드시 학생 1인칭으로만 답한다.

학생 정보:
- 이름: ${student.name}
- 성별: ${student.gender}
- 성격: ${student.personality} (${(student.traits || []).join(', ')})
- 말투: ${student.speakingStyle}
- 취미: ${student.hobby}
- 장래희망: ${student.dream}
- 성적: ${student.schoolGrade}
- 가정환경: ${student.familyEnvironment}
- 현재 고민: ${student.hiddenWorry}
- 인간관계:
${relationshipSummary.text}
- 감정 상태: ${describeEmotionState(student)}
- 스트레스/자존감/담임 신뢰도: ${student.stressLevel}/100, ${student.selfEsteem}/100, ${student.trustInTeacher}/100
${student.secret ? `- 비밀: ${student.secret}` : ''}

최근 발생한 반 상황:
${buildRecentSituationSummary(student)}

이전 상담 기록:
${consultationSummary}

최근 학생 응답 ${recentResponses.length}개:
${recentResponses.map((text, index) => `${index + 1}. ${text}`).join('\n') || '없음'}

선생님의 실제 마지막 입력:
"${userMessage}"

판별된 userMessage intent:
${userIntent}

응답 규칙:
1. 마지막 입력 "${userMessage}"에 반드시 직접 반응한다.
2. "현재 고민" 문장을 그대로 재출력하지 않는다.
3. 최근 학생 응답과 같은 문장이나 70% 이상 비슷한 문장을 쓰지 않는다.
4. 질문이면 질문에 먼저 답하고, 그 뒤에 학생의 감정을 짧게 덧붙인다.
5. 친구, 친한 사람, 누구랑 지내는지 묻는 질문에는 반드시 인간관계 정보를 바탕으로 답한다. 가족/성적/외모 고민으로 새지 않는다.
6. 학교생활을 묻는 질문에는 반 분위기, 수업/쉬는 시간, 친구 관계 중 현재 학생이 실제로 느낄 법한 것을 답한다.
7. "그게 무슨 말이지?", "무슨 뜻이야?"는 방금 네가 한 말의 의미를 구체적으로 풀어 설명한다.
8. "왜 그렇게 생각해?"는 이유와 근거가 되는 상황을 설명한다.
9. "ㅎㅎ", "?", "몰라" 같은 무의미한 입력에는 고민을 반복하지 말고, 무슨 뜻인지 모르겠다는 반응을 학생 성격에 맞게 한다.
10. 모든 학생에게 공통으로 쓰일 법한 안전한 상담 문장이나 템플릿 문장을 쓰지 않는다.
11. 학생마다 말투가 달라야 하며, ${student.name}의 말투 "${student.speakingStyle}"를 반영한다.
12. 2~4문장, 한국 고등학생이 담임에게 말하는 자연스러운 존댓말로 답한다.
13. JSON이나 설명문 없이 학생 대사만 출력한다.`;
}

function analyzeTeacherMove(message) {
  return interpretTeacherMessage(message, {}, { issue: { topic: '' } }, {});
}

function applyDialogueContinuity(move) {
  return move;
}

function buildProposalReaction(student, message, move, issue, context) {
  return buildAdaptiveProposalReaction(student, move, { ...context, message, issue });
}

function buildSpecificAnswer(student, move, issue, context) {
  return buildDirectAnswer(student, move, { ...context, issue, message: context.teacherMessage || '' });
}

function buildTopicResponse(student, topic, issue, context) {
  return buildDirectAnswer(student, { topic, targets: [topic] }, { ...context, issue, message: context.teacherMessage || '' });
}

function buildNextStep(student, issue, move, context) {
  return buildAdaptiveFollowUp(student, move, { ...context, issue, turnCount: 1, previousStudentText: '' }, '');
}

// 학생 생성 함수
async function generateStudent(studentNumber, existingNames, assignedGrade, assignedRole) {
  const isMale = Math.random() > 0.5;
  const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
  let firstName;
  
  if (isMale) {
    firstName = maleFirstNames[Math.floor(Math.random() * maleFirstNames.length)];
  } else {
    firstName = femaleFirstNames[Math.floor(Math.random() * femaleFirstNames.length)];
  }
  
  let fullName = lastName + firstName;
  let attempts = 0;
  while (existingNames.includes(fullName) && attempts < 10) {
    if (isMale) {
      firstName = maleFirstNames[Math.floor(Math.random() * maleFirstNames.length)];
    } else {
      firstName = femaleFirstNames[Math.floor(Math.random() * femaleFirstNames.length)];
    }
    fullName = lastName + firstName;
    attempts++;
  }
  existingNames.push(fullName);
  
  const personality = personalities[Math.floor(Math.random() * personalities.length)];
  const hobby = hobbies[Math.floor(Math.random() * hobbies.length)];
  const dream = dreams[Math.floor(Math.random() * dreams.length)];
  const worry = worries[Math.floor(Math.random() * worries.length)];
  const fallbackStudent = createFallbackStudent(
    studentNumber,
    fullName,
    isMale,
    personality,
    hobby,
    dream,
    assignedGrade,
    assignedRole,
    worry
  );
  
  // AI를 통해 학생 상세 정보 생성
  const prompt = `고등학교 2학년 학생 한 명의 상세 프로필을 생성해줘. 한 반의 25명 중 한 명이야. 다른 학생들과 겹치지 않게 개성 있게 만들어줘.

이름: ${fullName}
성별: ${isMale ? '남자' : '여자'}
성격 유형: ${personality.type}
성격 특성: ${personality.traits.join(', ')}
취미: ${hobby}
장래희망: ${dream}
숨겨진 고민: ${worry}
지정된 성적 등급: ${assignedGrade} (반드시 이 등급을 사용해)
지정된 역할: ${assignedRole || '없음 (일반 학생)'}

다음 사항을 반드시 지켜:
1. 성적 등급은 반드시 "${assignedGrade}"로 설정해. 다른 값으로 바꾸지 마.
2. 성격 유형이 "${personality.type}"라도, 구체적인 성격 묘사와 말투는 다른 학생과 확실히 다르게 만들어줘. 같은 성격 유형이라도 표현 방식, 관심사, 태도가 달라야 해.
3. 역할은 반드시 "${assignedRole || ''}"로 설정해. 반장/부반장은 다른 학생에게 부여하지 마.
4. 외모, 가정환경, 비밀, 말투는 구체적이고 독특하게 적어줘. 평범한 묘사(예: "평범한 외모", "일반적인 가정")는 피해.
5. 스트레스와 자존감은 1-100 사이에서 다양하게(낮은 학생도 있고 높은 학생도 있게) 정해줘.

다음 형식으로 JSON으로만 답해줘:
{
  "name": "이름",
  "gender": "성별",
  "appearance": "외모 설명 (구체적으로 한 줄)",
  "personality": "성격 유형",
  "traits": ["성격 특성 배열 (구체적 표현)"],
  "hobby": "취미",
  "dream": "장래희망",
  "schoolGrade": "${assignedGrade}",
  "familyEnvironment": "가정환경 설명 (구체적으로 한 줄)",
  "hiddenWorry": "숨겨진 고민",
  "secret": "비밀 (있거나 없거나, 구체적으로)",
  "speakingStyle": "말투 특징 (독특하게)",
  "role": "${assignedRole || ''}",
  "stressLevel": 58,
  "selfEsteem": 62,
  "trustInTeacher": 50,
  "introduction": "간단한 자기소개 (학생이 말하는 것처럼, 개성 있게)"
}

숫자 필드는 반드시 숫자만 넣고, 설명이나 주석을 붙이지 마. 마크다운 코드블록 없이 순수 JSON만 답해.`;

  try {
    const response = await callOpenRouter([
      { role: 'system', content: '너는 한국 고등학생의 프로필을 생성하는 어시스턴트야. 항상 JSON 형식으로만 답해야 해.' },
      { role: 'user', content: prompt }
    ], 0.9);

    const studentData = normalizeStudentData(parseJsonFromAi(response), fallbackStudent);
    
    return {
      id: studentNumber,
      ...studentData,
      number: studentNumber,
      friends: [],
      conflicts: [],
      memories: [],
      consultationTurns: [],
      weeklyConsulted: false,
      growthLog: [],
      summerChanges: [],
      attendance: { present: 0, absent: 0, late: 0 }
    };
  } catch (error) {
    console.error('학생 생성 오류:', error);
    logFallbackResponse('student-profile', error.message);
    return fallbackStudent;
  }
}

// 성적 분포 (25명 기준 균형 배분)
const gradeDistribution = [
  '상', '상', '상',
  '중상', '중상', '중상', '중상',
  '중', '중', '중', '중', '중', '중', '중',
  '중하', '중하', '중하', '중하',
  '하', '하', '하'
];

// 게임 초기화 API
app.post('/api/game/init', async (req, res) => {
  try {
    gameState = {
      currentWeek: 1,
      currentMonth: 3,
      year: 2024,
      students: [],
      consultationHistory: [],
      events: [],
      currentEvent: null,
      teacherNotes: [],
      reports: [],
      summerBreaks: [],
      classAtmosphere: 50,
      weeklyActionsRemaining: 5,
      lastSummerBreakYear: null,
      nextReportWeek: 2 + Math.floor(Math.random() * 2)
    };

    const existingNames = [];
    const studentPromises = [];
    
    // 성적 분포 셔플
    const shuffledGrades = [...gradeDistribution].sort(() => Math.random() - 0.5);
    // 25명 중 4명은 랜덤 추가 (분포 21개 + 4 랜덤)
    const extraGrades = ['상', '중상', '중', '중하', '하'];
    for (let i = 0; i < 4; i++) {
      shuffledGrades.push(extraGrades[Math.floor(Math.random() * extraGrades.length)]);
    }
    
    // 역할 배정: 1번=반장, 2번=부반장 (고정)
    const roles = {};
    roles[1] = '반장';
    roles[2] = '부반장';
    
    for (let i = 1; i <= 25; i++) {
      const assignedGrade = shuffledGrades[i - 1];
      const assignedRole = roles[i] || '';
      studentPromises.push(generateStudent(i, existingNames, assignedGrade, assignedRole));
    }
    
    gameState.students = await Promise.all(studentPromises);
    
    // 초기 학생 관계 설정
    for (let i = 0; i < gameState.students.length; i++) {
      const friendCount = Math.floor(Math.random() * 4) + 1;
      for (let j = 0; j < friendCount; j++) {
        const friendIndex = Math.floor(Math.random() * gameState.students.length);
        if (friendIndex !== i && !gameState.students[i].friends.includes(friendIndex + 1)) {
          gameState.students[i].friends.push(friendIndex + 1);
        }
      }
    }

    res.json({
      success: true,
      gameState: {
        currentWeek: gameState.currentWeek,
        currentMonth: gameState.currentMonth,
        year: gameState.year,
        students: gameState.students.map(s => ({
          id: s.id,
          number: s.number,
          name: s.name,
          gender: s.gender,
          avatarProfile: s.avatarProfile,
          appearance: s.appearance,
          personality: s.personality,
          traits: s.traits,
          hobby: s.hobby,
          dream: s.dream,
          familyEnvironment: s.familyEnvironment,
          hiddenWorry: s.hiddenWorry,
          secret: s.secret,
          speakingStyle: s.speakingStyle,
          introduction: s.introduction,
          club: s.club,
          academy: s.academy,
          schoolGrade: s.schoolGrade,
          role: s.role || '',
          stressLevel: s.stressLevel,
          selfEsteem: s.selfEsteem,
          trustInTeacher: s.trustInTeacher,
          friends: s.friends,
          weeklyConsulted: s.weeklyConsulted
        })),
        classAtmosphere: gameState.classAtmosphere,
        weeklyActionsRemaining: gameState.weeklyActionsRemaining,
        reports: gameState.reports,
        currentEvent: gameState.currentEvent,
        summerBreaks: gameState.summerBreaks
      }
    });
  } catch (error) {
    console.error('게임 초기화 오류:', error);
    res.status(500).json({ error: '게임 초기화 실패', message: error.message });
  }
});

// 학생 상세 정보 조회
app.get('/api/student/:id', (req, res) => {
  const studentId = parseInt(req.params.id);
  const student = gameState.students.find(s => s.id === studentId);
  
  if (!student) {
    return res.status(404).json({ error: '학생을 찾을 수 없습니다.' });
  }
  
  res.json(student);
});

app.get('/api/debug/openrouter', async (req, res) => {
  console.log('[DEBUG OPENROUTER TEST]');
  console.log('[MODEL]', process.env.OPENROUTER_MODEL);
  console.log('[HAS_KEY]', !!process.env.OPENROUTER_API_KEY);

  try {
    const reply = await callOpenRouter([
      {
        role: 'system',
        content: 'You are a connection test. Reply with exactly: OK'
      },
      {
        role: 'user',
        content: 'OpenRouter connection test'
      }
    ], 0);

    res.json({
      success: true,
      model: process.env.OPENROUTER_MODEL,
      hasKey: !!process.env.OPENROUTER_API_KEY,
      reply
    });
  } catch (error) {
    console.error('[DEBUG OPENROUTER FAILED]', error);
    res.status(502).json({
      success: false,
      model: process.env.OPENROUTER_MODEL,
      hasKey: !!process.env.OPENROUTER_API_KEY,
      error: error.message
    });
  }
});

// 학생과의 상담
app.post('/api/consultation', async (req, res) => {
  const { studentId, message } = req.body;
  console.log('[CHAT API HIT]', req.body);
  console.log('[STUDENT ID]', studentId);
  console.log('[USER MESSAGE]', message);
  
  if (gameState.weeklyActionsRemaining <= 0) {
    return res.status(400).json({ error: '이번 주 행동 횟수를 모두 사용했습니다.' });
  }
  
  const student = gameState.students.find(s => s.id === studentId);
  if (!student) {
    return res.status(404).json({ error: '학생을 찾을 수 없습니다.' });
  }
  if (!Array.isArray(student.memories)) {
    student.memories = [];
  }
  if (!Array.isArray(student.consultationTurns)) {
    student.consultationTurns = [];
  }

  // 상담 세션제: 이미 이번 주에 상담한 학생이면 행동력 추가 소모 없음
  const isFirstConsultation = !student.weeklyConsulted;
  const userIntent = classifyTeacherInput(message);
  const systemPrompt = buildConsultationSystemPrompt(student, userIntent, message);

  let response;
  try {
    const previousMessages = student.consultationTurns.slice(-6).flatMap(turn => ([
      { role: 'user', content: `담임 선생님: ${turn.teacher}` },
      { role: 'assistant', content: turn.student }
    ]));

    response = await callOpenRouter([
      { role: 'system', content: systemPrompt },
      ...previousMessages,
      { role: 'user', content: `담임 선생님: ${message}` }
    ], 0.85);
    if (!response || !response.trim()) {
      throw new Error('OpenRouter returned an empty consultation response.');
    }
  } catch (error) {
    console.error('[OPENROUTER FAILED] consultation response was not generated.');
    console.error('OpenRouter Error:', error);
    return res.status(502).json({
      success: false,
      error: 'OPENROUTER_FAILED',
      message: 'OpenRouter 응답 생성에 실패했습니다. fallback 없이 상담을 중단했습니다.',
      responseSource: 'openrouter_failed',
      openRouterError: error.message,
      weeklyActionsRemaining: gameState.weeklyActionsRemaining
    });
    console.error('상담 AI 호출 오류, 기본 응답으로 대체:', error);
  }
  response = ensureNonRepeatingResponse(student, message, response, buildConsultationContext(student, message));
  if (isFirstConsultation) {
    gameState.weeklyActionsRemaining--;
  }

  // 기억 저장
  student.memories.push(`선생님: "${message}" → 나: "${response.substring(0, 100)}..."`);
  student.consultationTurns.push({
    date: `${gameState.year}년 ${gameState.currentMonth}월 ${gameState.currentWeek}주차`,
    teacher: message,
    student: response
  });
  if (student.consultationTurns.length > 20) {
    student.consultationTurns = student.consultationTurns.slice(-20);
  }
  student.weeklyConsulted = true;
  
  // 신뢰도 증가 (첫 상담일 때 더 크게)
  const trustGain = isFirstConsultation ? 3 : 1;
  student.trustInTeacher = Math.min(100, student.trustInTeacher + trustGain);

  // 스트레스 감소 (상담으로 안도감)
  const stressReduction = isFirstConsultation ? 5 : 2;
  student.stressLevel = Math.max(0, student.stressLevel - stressReduction);
  
  // 상담 기록 저장
  gameState.consultationHistory.push({
    date: `${gameState.year}년 ${gameState.currentMonth}월 ${gameState.currentWeek}주차`,
    studentId: studentId,
    studentName: student.name,
    teacherMessage: message,
    studentResponse: response
  });

  res.json({
    success: true,
    studentResponse: response,
    trustChange: trustGain,
    stressChange: -stressReduction,
    newTrustLevel: student.trustInTeacher,
    newStressLevel: student.stressLevel,
    weeklyActionsRemaining: gameState.weeklyActionsRemaining,
    isFirstConsultation: isFirstConsultation,
    responseSource: 'openrouter',
    openRouterError: null
  });
});

// 주간 진행
app.post('/api/game/next-week', async (req, res) => {
  try {
    const consultedStudentIds = new Set(
      gameState.students.filter(s => s.weeklyConsulted).map(s => s.id)
    );

    gameState.currentWeek++;
    
    // 주간 초기화
    gameState.weeklyActionsRemaining = 5;
    
    // 월 변경
    if (gameState.currentWeek > 4) {
      gameState.currentWeek = 1;
      gameState.currentMonth++;
      
      if (gameState.currentMonth > 12) {
        // 게임 종료 - 엔딩 생성
        const ending = await generateEnding();
        return res.json({
          success: true,
          gameEnded: true,
          ending: ending
        });
      }
    }

    const summerBreak = await handleSummerBreakIfNeeded();
    if (summerBreak) {
      gameState.students.forEach(student => {
        student.weeklyConsulted = false;
      });

      const teacherNote = {
        date: `${gameState.year}년 ${gameState.currentMonth}월 ${gameState.currentWeek}주차`,
        content: summerBreak.message
      };
      gameState.teacherNotes.push(teacherNote);

      return res.json({
        success: true,
        currentWeek: gameState.currentWeek,
        currentMonth: gameState.currentMonth,
        weeklyActionsRemaining: gameState.weeklyActionsRemaining,
        classAtmosphere: gameState.classAtmosphere,
        event: null,
        currentEvent: null,
        report: null,
        teacherNote,
        summerBreak
      });
    }
    
    // 랜덤 이벤트 생성
    const event = await generateWeeklyEvent();
    if (event) {
      gameState.events.push(event);
    }
    gameState.currentEvent = event || null;

    // 2~3주마다 학생 제보 생성
    let report = null;
    const absoluteWeek = getAbsoluteWeek();
    if (absoluteWeek >= gameState.nextReportWeek) {
      report = await generateReport();
      if (report) {
        gameState.reports.push(report);
      }
      gameState.nextReportWeek = absoluteWeek + 2 + Math.floor(Math.random() * 2);
    }
    
    // 학생 상태 변화 (스트레스는 자연 감소 bias, 상담 안 한 학생은 약간 상승)
    gameState.students.forEach(student => {
      const consulted = consultedStudentIds.has(student.id);
      // 상담한 학생: 스트레스 -3~+1, 상담 안 한 학생: -1~+5 (방치 시 상승)
      const stressChange = consulted
        ? Math.floor(Math.random() * 5) - 3  // -3 ~ +1
        : Math.floor(Math.random() * 7) - 1;  // -1 ~ +5
      const esteemChange = consulted
        ? Math.floor(Math.random() * 4) - 1  // -1 ~ +2
        : Math.floor(Math.random() * 6) - 3;  // -3 ~ +2
      
      student.stressLevel = Math.max(0, Math.min(100, student.stressLevel + stressChange));
      student.selfEsteem = Math.max(0, Math.min(100, student.selfEsteem + esteemChange));
      student.weeklyConsulted = false;
    });
    
    // 학급 분위기 계산
    const avgStress = gameState.students.reduce((sum, s) => sum + s.stressLevel, 0) / gameState.students.length;
    const avgEsteem = gameState.students.reduce((sum, s) => sum + s.selfEsteem, 0) / gameState.students.length;
    const avgTrust = gameState.students.reduce((sum, s) => sum + s.trustInTeacher, 0) / gameState.students.length;
    
    gameState.classAtmosphere = Math.floor((avgEsteem + avgTrust + (100 - avgStress)) / 3);
    
    // 교무수첩 작성
    const teacherNote = await generateTeacherNote();
    gameState.teacherNotes.push(teacherNote);

    res.json({
      success: true,
      currentWeek: gameState.currentWeek,
      currentMonth: gameState.currentMonth,
      weeklyActionsRemaining: gameState.weeklyActionsRemaining,
      classAtmosphere: gameState.classAtmosphere,
      event: event,
      currentEvent: gameState.currentEvent,
      report: report,
      teacherNote: teacherNote
    });
  } catch (error) {
    console.error('주간 진행 오류:', error);
    res.status(500).json({ error: '주간 진행 실패', message: error.message });
  }
});

// 주간 이벤트 생성
async function generateWeeklyEvent() {
  const scheduled = generateScheduledEvent();
  if (scheduled) return scheduled;

  const eventTypes = [
    '갈등', '우정', '시험', '축제', '체육대회', '상담요청', '가정문제', '진로'
  ];
  
  const eventType = eventTypes[Math.floor(Math.random() * eventTypes.length)];
  
  // 30% 확률로 이벤트 발생
  if (Math.random() > 0.3) {
    return null;
  }
  
  const prompt = `고등학교 2학년 반에서 일어날 수 있는 "${eventType}" 관련 이벤트를 생성해줘.

현재 시기: ${gameState.currentMonth}월 ${gameState.currentWeek}주차
학생 수: 25명

중요: 이 게임의 플레이어는 이 반의 담임교사야. 모든 선택지는 담임교사인 플레이어가 직접 할 수 있는 행동이어야 해. "선생님을 찾아간다", "선생님께 말한다" 같은 선택지는 절대 만들지 마. 대신 "직접 개입한다", "학생들과 대화한다", "방관한다", "학부모에게 연락한다", "단체 지도를 한다" 등 담임교사의 행동으로 만들어줘.

다음 JSON 형식으로만 답해줘:
{
  "title": "이벤트 제목",
  "description": "이벤트 설명 (담임교사 관점에서 상황을 전달)",
  "relatedStudents": [관련된 학생 번호들],
  "type": "${eventType}",
  "choices": [
    {"id": 1, "text": "담임교사가 할 수 있는 행동 선택지 1"},
    {"id": 2, "text": "담임교사가 할 수 있는 행동 선택지 2"},
    {"id": 3, "text": "담임교사가 할 수 있는 행동 선택지 3"}
  ]
}`;

  try {
    const response = await callOpenRouter([
      { role: 'system', content: '너는 한국 고등학교에서 일어날 수 있는 다양한 이벤트를 생성하는 어시스턴트야. JSON 형식으로만 답해.' },
      { role: 'user', content: prompt }
    ], 0.9);

    const event = parseJsonFromAi(response);
    // 고유 id 부여 (이벤트 해결 시 매칭용)
    event.id = Date.now();
    return event;
  } catch (error) {
    console.error('이벤트 생성 오류:', error);
    logFallbackResponse('weekly-event', error.message);
    return generateFallbackEvent(eventType);
  }
}

function makeEvent(type, title, description, relatedStudents, choices) {
  return {
    id: Date.now() + hashText(`${type}-${gameState.currentMonth}-${gameState.currentWeek}`),
    type,
    title,
    description,
    relatedStudents: relatedStudents.map(s => typeof s === 'number' ? s : s.id),
    choices
  };
}

function generateScheduledEvent() {
  const key = `${gameState.currentMonth}-${gameState.currentWeek}`;
  const stressed = [...gameState.students].sort((a, b) => b.stressLevel - a.stressLevel);
  const leader = gameState.students.find(s => s.role === '반장') || gameState.students[0];
  const quiet = gameState.students.find(s => s.personality === '수줍음' || s.personality === '예민함') || stressed[0];
  const athlete = gameState.students.find(s => s.hobby.includes('운동') || s.dream === '운동선수') || gameState.students[6];

  const scheduled = {
    '3-2': () => makeEvent('시험', '3월 모의고사 후폭풍', '첫 모의고사 결과가 나오자 몇몇 학생들이 눈에 띄게 풀이 죽었다. 반 분위기도 평소보다 가라앉아 있다.', [stressed[0], stressed[1]], [
      { id: 1, text: '점수보다 오답 분석 시간을 먼저 마련한다' },
      { id: 2, text: '성적 하락 학생을 따로 불러 상담한다' },
      { id: 3, text: '전체 훈화로 공부 분위기를 다잡는다' }
    ]),
    '4-2': () => makeEvent('청소', '반 청소 역할 갈등', '청소 구역을 두고 일부 학생들이 서로 미루는 분위기가 생겼다. 말은 장난처럼 하지만 불만이 쌓이는 중이다.', [leader, quiet], [
      { id: 1, text: '청소표를 다시 짜고 이유를 설명한다' },
      { id: 2, text: '반장과 함께 조용히 상황을 조율한다' },
      { id: 3, text: '오늘은 담임이 같이 청소하며 분위기를 푼다' }
    ]),
    '5-2': () => makeEvent('체육대회', '체육대회 달리기 선수 선정', '체육대회 계주 선수를 정하는 과정에서 부담스러워하는 학생과 나서고 싶어 하는 학생이 갈렸다.', [athlete, quiet], [
      { id: 1, text: '지원자를 먼저 받고 부족한 자리를 조율한다' },
      { id: 2, text: '운동을 잘하는 학생에게 대표를 부탁한다' },
      { id: 3, text: '승부보다 참여 분위기를 강조한다' }
    ]),
    '9-2': () => makeEvent('축제', '축제 준비 역할 분담', '축제 준비가 시작되며 적극적인 학생과 빠지고 싶어 하는 학생 사이의 온도 차가 커지고 있다.', [leader, stressed[0]], [
      { id: 1, text: '역할을 작게 나눠 부담을 낮춘다' },
      { id: 2, text: '학생들이 직접 팀을 정하게 한다' },
      { id: 3, text: '준비가 늦어진 팀을 담임이 직접 챙긴다' }
    ]),
    '10-2': () => makeEvent('진로', '진로 행사 신청', '진로 체험 신청서를 받는 날, 아직 꿈을 정하지 못한 학생들이 빈칸 앞에서 오래 머뭇거렸다.', [stressed[0], quiet], [
      { id: 1, text: '관심사부터 적어도 된다고 안내한다' },
      { id: 2, text: '진로 미정 학생을 따로 모아 상담한다' },
      { id: 3, text: '기한을 연장하고 자료를 더 제공한다' }
    ])
  };
  return scheduled[key]?.() || null;
}

function generateFallbackEvent(eventType = '갈등') {
  if (Math.random() > 0.45) return null;
  const seed = hashText(`${eventType}-${gameState.currentMonth}-${gameState.currentWeek}`);
  const students = [...gameState.students].sort((a, b) => (b.stressLevel - a.stressLevel) || (a.id - b.id));
  const a = pickBySeed(students.slice(0, 8), seed);
  const b = pickBySeed(gameState.students.filter(s => s.id !== a.id), seed + 3);
  const templates = {
    갈등: ['학생 간 작은 갈등', `${a.name}${hasFinalConsonant(a.name) ? '이' : ''}와 ${b.name} 사이에 조별활동 중 말다툼이 있었다.`],
    우정: ['친구 관계 변화', `${a.name}${hasFinalConsonant(a.name) ? '이' : ''}가 쉬는 시간에 혼자 있는 시간이 늘었다.`],
    시험: ['시험 준비 긴장', '다가오는 수행평가 때문에 반 전체가 예민해져 있다.'],
    축제: ['행사 준비 갈등', '행사 준비 역할을 두고 적극적인 학생과 빠지려는 학생 사이에 온도 차가 생겼다.'],
    체육대회: ['체육 활동 부담', '체육 활동 조 편성 과정에서 부담을 느끼는 학생이 보인다.'],
    상담요청: ['학생의 간접 신호', `${a.name}${hasFinalConsonant(a.name) ? '이' : ''}가 상담실 앞을 맴돌다가 그냥 돌아갔다.`],
    가정문제: ['가정 문제 의심', `${a.name}${hasFinalConsonant(a.name) ? '이' : ''}가 집 이야기가 나오자 표정이 굳었다.`],
    진로: ['진로 고민 확산', '진로 희망 조사지를 두고 몇몇 학생이 오래 고민하고 있다.']
  };
  const [title, description] = templates[eventType] || templates.갈등;
  return makeEvent(eventType, title, description, [a, b], [
    { id: 1, text: '관련 학생을 조용히 불러 이야기를 듣는다' },
    { id: 2, text: '학급 전체에 짧게 안내하고 분위기를 살핀다' },
    { id: 3, text: '며칠 더 관찰한 뒤 개입한다' }
  ]);
}

function resolveFallbackEvent(event, choiceId) {
  const choice = Number(choiceId);
  const affectedStudents = (event.relatedStudents || []).map(id => ({
    id,
    stressChange: choice === 1 ? -5 : choice === 2 ? -2 : 1,
    trustChange: choice === 1 ? 4 : choice === 2 ? 2 : -1,
    esteemChange: choice === 1 ? 2 : choice === 2 ? 1 : 0
  }));
  const atmosphereChange = choice === 1 ? 3 : choice === 2 ? 1 : -1;
  gameState.classAtmosphere = clamp(gameState.classAtmosphere + atmosphereChange);
  affectedStudents.forEach(affected => {
    const student = gameState.students.find(s => s.id === affected.id);
    if (!student) return;
    student.stressLevel = clamp(student.stressLevel + affected.stressChange);
    student.trustInTeacher = clamp(student.trustInTeacher + affected.trustChange);
    student.selfEsteem = clamp(student.selfEsteem + affected.esteemChange);
  });
  return {
    result: choice === 1
      ? '담임이 직접 이야기를 들어주자 학생들이 조금 안심했다. 문제는 완전히 해결되지 않았지만, 적어도 혼자 넘기지 않아도 된다는 분위기가 생겼다.'
      : choice === 2
        ? '전체 안내로 반 분위기는 조금 정리되었다. 다만 당사자들의 속마음까지 풀리지는 않아 이후 관찰이 필요하다.'
        : '며칠 더 지켜보기로 했지만, 일부 학생은 담임이 상황을 놓쳤다고 느꼈다.',
    affectedStudents,
    classAtmosphereChange: atmosphereChange
  };
}

async function handleSummerBreakIfNeeded() {
  const enteringSummerBreak = gameState.currentMonth === 7 && gameState.currentWeek === 3;
  if (!enteringSummerBreak || gameState.lastSummerBreakYear === gameState.year) {
    return null;
  }

  const changesByStudent = gameState.students.map(student => {
    const changes = buildSummerChanges(student);
    changes.forEach(change => applySummerChange(student, change));
    student.summerChanges = [...(student.summerChanges || []), ...changes];
    if (changes.length > 0) {
      student.growthLog = student.growthLog || [];
      student.growthLog.push({
        date: `${gameState.year}년 여름방학`,
        content: changes.map(c => c.text).join(' / ')
      });
    }
    return {
      studentId: student.id,
      studentName: student.name,
      changes
    };
  });

  gameState.currentMonth = 8;
  gameState.currentWeek = 4;
  gameState.weeklyActionsRemaining = 5;
  gameState.currentEvent = null;
  gameState.lastSummerBreakYear = gameState.year;

  await describeSummerChangesWithAI(changesByStudent);
  recalculateClassAtmosphere();

  const summary = {
    message: '여름방학이 끝났습니다. 학생들에게 여러 변화가 생긴 것 같습니다.',
    skippedFrom: '7월 3주차',
    skippedTo: '8월 4주차',
    changesByStudent
  };
  gameState.summerBreaks.push(summary);
  return summary;
}

async function describeSummerChangesWithAI(changesByStudent) {
  const changed = changesByStudent.filter(item => item.changes.length > 0);
  if (changed.length === 0) return;

  const compactStudents = changed.map(item => {
    const student = gameState.students.find(s => s.id === item.studentId);
    return {
      studentId: item.studentId,
      name: item.studentName,
      personality: student?.personality,
      speakingStyle: student?.speakingStyle,
      worry: student?.hiddenWorry,
      changes: item.changes.map(change => change.text)
    };
  });

  const prompt = `여름방학이 끝난 뒤 학생별 변화를 담임교사가 관찰한 문장으로 써줘.

학생 변화 목록:
${JSON.stringify(compactStudents, null, 2)}

규칙:
1. 학생별 변화 사실은 바꾸지 마.
2. 상담, 제보, 이벤트에 이어질 수 있게 구체적이지만 과장하지 마.
3. 각 학생마다 1문장으로 써.
4. 다음 JSON 형식만 출력해:
{
  "descriptions": [
    {"studentId": 1, "description": "관찰 문장"}
  ]
}`;

  try {
    const response = await callOpenRouter([
      { role: 'system', content: '너는 한국 고등학교 담임교사의 관찰 기록을 작성하는 도우미야. JSON으로만 답해.' },
      { role: 'user', content: prompt }
    ], 0.7);
    const parsed = parseJsonFromAi(response);
    const descriptions = Array.isArray(parsed.descriptions) ? parsed.descriptions : [];
    descriptions.forEach(item => {
      const target = changesByStudent.find(change => change.studentId === Number(item.studentId));
      if (target && item.description) {
        target.description = cleanAiPlainText(item.description);
        const student = gameState.students.find(s => s.id === target.studentId);
        if (student) {
          student.growthLog = student.growthLog || [];
          student.growthLog.push({
            date: `${gameState.year}년 여름방학 관찰`,
            content: target.description
          });
        }
      }
    });
  } catch (error) {
    console.error('방학 변화 OpenRouter 서술 실패, 기본 변화 문장 사용:', error);
    logFallbackResponse('summer-break-description', error.message);
    changed.forEach(item => {
      item.description = `${item.studentName}: ${item.changes.map(change => change.text).join(', ')}`;
    });
  }
}

function buildSummerChanges(student) {
  const seed = hashText(`${student.id}-${student.name}-${student.personality}-${student.stressLevel}-${student.schoolGrade}`);
  const maxChanges = seed % 4;
  if (maxChanges === 0) return [];

  const candidates = [];
  const add = (category, text, weight, effect = {}) => candidates.push({ category, text, weight, effect });

  add('외모', '머리 스타일이 조금 바뀌었다', 4, { appearanceNote: '방학 뒤 머리 스타일이 조금 달라짐' });
  add('외모', '키가 조금 큰 것 같다', student.hobby?.includes('운동') ? 5 : 2, { appearanceNote: '키가 조금 커 보임', esteem: 2 });
  add('외모', '안경을 쓰기 시작했다', 2, { appearanceNote: '안경을 쓰기 시작함' });
  add('성격', '전보다 표정이 밝아졌다', student.stressLevel < 60 ? 4 : 2, { stress: -4, esteem: 3 });
  add('성격', '말수가 조금 줄었다', student.personality === '수줍음' || student.stressLevel > 65 ? 5 : 2, { stress: 3 });
  add('성격', '자신감이 조금 붙었다', student.selfEsteem < 55 ? 4 : 2, { esteem: 5 });
  add('인간관계', '새로 가까워진 친구가 생겼다', student.personality === '외향적' ? 5 : 2, { trust: 1, relation: 'friend' });
  add('인간관계', '친구 관계에서 작은 갈등이 생겼다', student.stressLevel > 55 ? 4 : 2, { stress: 5, relation: 'conflict' });
  add('인간관계', '누군가를 좋아하게 된 것 같다', student.relationshipBias > 45 ? 4 : 1, { relation: 'crush' });
  add('학업', '학원에 다니기 시작하며 공부 시간이 늘었다', student.schoolGrade === '하' || student.schoolGrade === '중하' ? 5 : 2, { stress: 3, esteem: 2, academy: true });
  add('학업', '성적에 대한 압박이 커졌다', student.stressLevel > 60 ? 4 : 2, { stress: 4 });
  add('학업', '진로를 다시 고민하기 시작했다', 3, { stress: 1 });
  add('가정', '집안 분위기 때문에 예민해졌다', student.familyEnvironment?.includes('갈등') || student.familyEnvironment?.includes('어려') ? 5 : 1, { stress: 6 });
  add('개인', '새로운 취미가 생겼다', 3, { stress: -2, esteem: 2 });
  add('개인', '방학 동안 아르바이트를 시작했다', student.familyEnvironment?.includes('어려') ? 5 : 1, { stress: 2, esteem: 2 });

  const chosen = [];
  const pool = candidates.sort((a, b) => {
    const scoreA = ((seed + hashText(a.text)) % 100) + a.weight * 10;
    const scoreB = ((seed + hashText(b.text)) % 100) + b.weight * 10;
    return scoreB - scoreA;
  });

  for (const candidate of pool) {
    if (chosen.length >= maxChanges) break;
    if (chosen.some(c => c.category === candidate.category && candidate.category !== '인간관계')) continue;
    chosen.push({
      category: candidate.category,
      text: candidate.text,
      effect: candidate.effect
    });
  }
  return chosen;
}

function applySummerChange(student, change) {
  const effect = change.effect || {};
  if (effect.stress) student.stressLevel = clamp(student.stressLevel + effect.stress);
  if (effect.esteem) student.selfEsteem = clamp(student.selfEsteem + effect.esteem);
  if (effect.trust) student.trustInTeacher = clamp(student.trustInTeacher + effect.trust);
  if (effect.appearanceNote && !student.appearance.includes(effect.appearanceNote)) {
    student.appearance = `${student.appearance} (${effect.appearanceNote})`;
  }
  if (effect.academy && (!student.academy || student.academy === '안 다님')) {
    student.academy = pickBySeed(academies.filter(a => a !== '안 다님'), student.id + student.stressLevel);
  }
  if (effect.relation === 'friend') {
    const friend = pickBySeed(gameState.students.filter(s => s.id !== student.id), student.id + 13);
    if (friend && !student.friends.includes(friend.id)) student.friends.push(friend.id);
    if (friend && !friend.friends.includes(student.id)) friend.friends.push(student.id);
  }
  if (effect.relation === 'conflict') {
    const target = pickBySeed(gameState.students.filter(s => s.id !== student.id), student.id + 29);
    student.conflicts = student.conflicts || [];
    if (target && !student.conflicts.includes(target.id)) student.conflicts.push(target.id);
  }
}

function recalculateClassAtmosphere() {
  const avgStress = gameState.students.reduce((sum, s) => sum + s.stressLevel, 0) / gameState.students.length;
  const avgEsteem = gameState.students.reduce((sum, s) => sum + s.selfEsteem, 0) / gameState.students.length;
  const avgTrust = gameState.students.reduce((sum, s) => sum + s.trustInTeacher, 0) / gameState.students.length;
  gameState.classAtmosphere = Math.floor((avgEsteem + avgTrust + (100 - avgStress)) / 3);
}

// 교무수첩 생성
async function generateTeacherNote() {
  const recentConsultations = gameState.consultationHistory.slice(-5);
  const avgStress = gameState.students.reduce((sum, s) => sum + s.stressLevel, 0) / gameState.students.length;
  const avgTrust = gameState.students.reduce((sum, s) => sum + s.trustInTeacher, 0) / gameState.students.length;
  
  const prompt = `${gameState.currentMonth}월 ${gameState.currentWeek}주차 담임 교무수첩을 작성해줘.

이번 주 상담 내용:
${recentConsultations.map(c => `- ${c.studentName}: ${c.studentResponse.substring(0, 50)}...`).join('\n') || '상담 없음'}

학급 현황:
- 평균 스트레스: ${avgStress.toFixed(1)}
- 평균 신뢰도: ${avgTrust.toFixed(1)}
- 학급 분위기 점수: ${gameState.classAtmosphere}

형식:
[날짜]
오늘의 관찰:
(2-3문장으로 학급 분위기와 특이사항 기록)

담임 소감:
(1-2문장으로 교사의 느낌)`;

  try {
    const response = await callOpenRouter([
      { role: 'system', content: '너는 고등학교 담임교사야. 교무수첩을 작성해줘.' },
      { role: 'user', content: prompt }
    ], 0.7);

    return {
      date: `${gameState.year}년 ${gameState.currentMonth}월 ${gameState.currentWeek}주차`,
      content: response
    };
  } catch (error) {
    console.error('교무수첩 생성 오류:', error);
    return {
      date: `${gameState.year}년 ${gameState.currentMonth}월 ${gameState.currentWeek}주차`,
      content: '이번 주는 특별한 사항 없이 무난하게 지나갔다.'
    };
  }
}

// 엔딩 생성
async function generateEnding() {
  const avgStress = gameState.students.reduce((sum, s) => sum + s.stressLevel, 0) / gameState.students.length;
  const avgEsteem = gameState.students.reduce((sum, s) => sum + s.selfEsteem, 0) / gameState.students.length;
  const avgTrust = gameState.students.reduce((sum, s) => sum + s.trustInTeacher, 0) / gameState.students.length;
  
  const prompt = `1년 동안의 담임 생활을 마무리하며 엔딩을 생성해줘.

학급 최종 현황:
- 평균 스트레스: ${avgStress.toFixed(1)}
- 평균 자존감: ${avgEsteem.toFixed(1)}
- 평균 신뢰도: ${avgTrust.toFixed(1)}
- 학급 분위기: ${gameState.classAtmosphere}

총 상담 횟수: ${gameState.consultationHistory.length}

다음 JSON 형식으로 답해줘:
{
  "endingType": "엔딩 타입 (최고의 학급/행복한 학급/평범한 학급/아쉬운 학급)",
  "title": "엔딩 제목",
  "description": "엔딩 설명 (3-4문장)",
  "studentLetters": [
    {"name": "학생이름", "letter": "학생이 선생님께 쓰는 편지 (2-3문장)"}
  ]
}`;

  try {
    const response = await callOpenRouter([
      { role: 'system', content: '너는 학교 시뮬레이션 게임의 엔딩을 생성하는 어시스턴트야.' },
      { role: 'user', content: prompt }
    ], 0.8);

    return parseJsonFromAi(response);
    
    return {
      endingType: '평범한 학급',
      title: '또 하나의 학기가 지나고',
      description: '1년 동안의 담임 생활이 마무리되었습니다. 학생들은 각자의 길로 떠나갑니다.'
    };
  } catch (error) {
    console.error('엔딩 생성 오류:', error);
    return generateFallbackEnding(avgStress, avgEsteem, avgTrust);
  }
}

function generateFallbackEnding(avgStress, avgEsteem, avgTrust) {
  const endingScore = Math.round((avgEsteem + avgTrust + (100 - avgStress) + gameState.classAtmosphere) / 4);
  const endingType = endingScore >= 75
    ? '최고의 학급'
    : endingScore >= 62
      ? '행복한 학급'
      : endingScore >= 48
        ? '평범한 학급'
        : '아쉬운 학급';
  const consultedNames = [...new Set(gameState.consultationHistory.map(c => c.studentName))];
  const reportCount = gameState.reports.length;
  const seriousReports = gameState.reports.filter(r => r.severity >= 3).length;
  const title = endingScore >= 62 ? '우리 반은 지금, 서로를 조금 더 아는 중' : '끝까지 다 알 수는 없었지만';
  const description = `3월부터 12월까지의 담임 생활이 마무리되었습니다. 선생님은 총 ${gameState.consultationHistory.length}번의 상담을 했고, ${consultedNames.length}명의 학생과 직접 이야기를 나누었습니다. 익명 제보함에는 ${reportCount}건의 목소리가 남았고${seriousReports ? `, 그중 ${seriousReports}건은 즉각적인 관심이 필요한 내용이었습니다` : ''}. 학급은 완벽하지 않았지만, 학생들은 적어도 누군가 자신을 보고 있다는 감각을 조금씩 배웠습니다.`;

  const featuredStudents = [...gameState.students]
    .sort((a, b) => b.trustInTeacher - a.trustInTeacher || a.stressLevel - b.stressLevel)
    .slice(0, 8);

  const studentLetters = featuredStudents.map(student => {
    const consultations = gameState.consultationHistory.filter(c => c.studentId === student.id);
    const relatedReports = gameState.reports.filter(r => r.relatedStudents?.includes(student.id));
    let letter;
    if (consultations.length > 0) {
      const last = consultations[consultations.length - 1];
      letter = `선생님, ${last.teacherMessage.replace(/[.!?。]$/g, '')}라고 물어봐 주셨던 게 기억나요. 그때 바로 다 말하진 못했지만, 제 이야기를 그냥 지나치지 않는 사람이 있다는 게 생각보다 오래 남았어요.`;
    } else if (relatedReports.length > 0) {
      letter = `선생님, 그때 반에서 들려온 작은 제보를 그냥 넘기지 않아 주셔서 감사했어요. 저는 아무렇지 않은 척했지만, 누군가 알아차려 준 것만으로도 조금 덜 혼자인 느낌이었어요.`;
    } else {
      letter = `선생님, 자주 이야기하진 못했지만 1년 동안 저희 반을 지켜봐 주셔서 감사해요. 다음에는 저도 제 얘기를 조금 더 먼저 꺼내볼 수 있을 것 같아요.`;
    }
    return { name: student.name, letter };
  });

  return {
    endingType,
    title,
    description,
    studentLetters
  };
}

// 이벤트 선택 처리
app.post('/api/event/resolve', async (req, res) => {
  const { eventId, choiceId } = req.body;
  
  const event = gameState.events.find(e => e.id === eventId);
  if (!event) {
    return res.status(404).json({ error: '이벤트를 찾을 수 없습니다.' });
  }
  
  // 선택에 따른 결과 생성
  const prompt = `학급 이벤트를 해결한 결과를 생성해줘.

이벤트: ${event.title}
${event.description}

선택한 행동: ${event.choices.find(c => c.id === choiceId)?.text}

관련 학생들: ${event.relatedStudents?.map(id => gameState.students.find(s => s.id === id)?.name).join(', ') || '없음'}

다음 JSON 형식으로 답해줘:
{
  "result": "결과 설명",
  "affectedStudents": [
    {"id": 학생ID, "stressChange": -10~10, "trustChange": -10~10, "esteemChange": -10~10}
  ]
}`;

  try {
    const response = await callOpenRouter([
      { role: 'system', content: '너는 게임 이벤트 결과를 생성하는 어시스턴트야. JSON으로만 답해.' },
      { role: 'user', content: prompt }
    ], 0.8);

    try {
      const result = parseJsonFromAi(response);
      
      // 학생 상태 업데이트
      result.affectedStudents?.forEach(affected => {
        const student = gameState.students.find(s => s.id === affected.id);
        if (student) {
          student.stressLevel = Math.max(0, Math.min(100, student.stressLevel + (affected.stressChange || 0)));
          student.trustInTeacher = Math.max(0, Math.min(100, student.trustInTeacher + (affected.trustChange || 0)));
          student.selfEsteem = Math.max(0, Math.min(100, student.selfEsteem + (affected.esteemChange || 0)));
        }
      });
      if (gameState.currentEvent?.id === event.id) {
        gameState.currentEvent = null;
      }
      
      res.json({
        success: true,
        result: result
      });
    } catch (parseError) {
      console.error('이벤트 결과 JSON 파싱 오류:', parseError);
      logFallbackResponse('event-resolve-parse', parseError.message);
      const fallback = resolveFallbackEvent(event, choiceId);
      if (gameState.currentEvent?.id === event.id) {
        gameState.currentEvent = null;
      }
      res.json({
        success: true,
        result: fallback
      });
    }
  } catch (error) {
    console.error('이벤트 해결 오류:', error);
    logFallbackResponse('event-resolve', error.message);
    const fallback = resolveFallbackEvent(event, choiceId);
    if (gameState.currentEvent?.id === event.id) {
      gameState.currentEvent = null;
    }
    res.json({
      success: true,
      result: fallback
    });
  }
});

// 게임 상태 조회
app.get('/api/game/state', (req, res) => {
  res.json({
    currentWeek: gameState.currentWeek,
    currentMonth: gameState.currentMonth,
    year: gameState.year,
    classAtmosphere: gameState.classAtmosphere,
    weeklyActionsRemaining: gameState.weeklyActionsRemaining,
    currentEvent: gameState.currentEvent,
    summerBreaks: gameState.summerBreaks,
    reports: gameState.reports,
    totalStudents: gameState.students.length,
    students: gameState.students.map(s => ({
      id: s.id,
      number: s.number,
      name: s.name,
      gender: s.gender,
      avatarProfile: s.avatarProfile,
      appearance: s.appearance,
      personality: s.personality,
      hobby: s.hobby,
      dream: s.dream,
      club: s.club,
      academy: s.academy,
      schoolGrade: s.schoolGrade,
      role: s.role || '',
      stressLevel: s.stressLevel,
      selfEsteem: s.selfEsteem,
      trustInTeacher: s.trustInTeacher,
      friends: s.friends,
      conflicts: s.conflicts,
      summerChanges: s.summerChanges || [],
      growthLog: s.growthLog || [],
      weeklyConsulted: s.weeklyConsulted
    }))
  });
});

// 교무수첩 조회
app.get('/api/teacher-notes', (req, res) => {
  res.json(gameState.teacherNotes);
});

if (require.main === module) {
  console.log('[ENV CHECK]', {
    hasOpenRouterKey: !!process.env.OPENROUTER_API_KEY,
    model: process.env.OPENROUTER_MODEL
  });

  app.listen(PORT, () => {
  console.log(`🏫 우리 반은 지금 서버 실행 중: http://localhost:${PORT}`);
});
}

module.exports = app;
