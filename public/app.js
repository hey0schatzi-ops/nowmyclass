// 게임 상태
let gameState = null;
let currentStudent = null;
let consultationHistory = [];

// DOM 요소들
const startScreen = document.getElementById('startScreen');
const gameScreen = document.getElementById('gameScreen');
const startGameBtn = document.getElementById('startGameBtn');
const loadingMessage = document.getElementById('loadingMessage');
const studentGrid = document.getElementById('studentGrid');
const currentMonthEl = document.getElementById('currentMonth');
const currentWeekEl = document.getElementById('currentWeek');
const actionPointsEl = document.getElementById('actionPoints');
const classAtmosphereBar = document.getElementById('classAtmosphereBar');
const classAtmosphereValue = document.getElementById('classAtmosphereValue');
const avgStressBar = document.getElementById('avgStressBar');
const avgStressValue = document.getElementById('avgStressValue');
const avgTrustBar = document.getElementById('avgTrustBar');
const avgTrustValue = document.getElementById('avgTrustValue');
const weeklyEventEl = document.getElementById('weeklyEvent');
const reportsListEl = document.getElementById('reportsList');
const nextWeekBtn = document.getElementById('nextWeekBtn');
const teacherNoteBtn = document.getElementById('teacherNoteBtn');

// 모달 요소들
const studentModal = document.getElementById('studentModal');
const closeStudentModal = document.getElementById('closeStudentModal');
const teacherNoteModal = document.getElementById('teacherNoteModal');
const closeNoteModal = document.getElementById('closeNoteModal');
const eventModal = document.getElementById('eventModal');
const endingModal = document.getElementById('endingModal');
const helpModal = document.getElementById('helpModal');
const helpBtn = document.getElementById('helpBtn');
const closeHelpModal = document.getElementById('closeHelpModal');

// 탭 요소들
const tabBtns = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');

function escapeHTML(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getStudentReplyDelay(text) {
  const length = String(text || '').length;
  return Math.min(2400, Math.max(900, 650 + length * 14));
}

// 학생 아바타 생성
function createAvatarHTML(student) {
  const isMale = student.gender === '남' || student.gender === '남자';
  return `<span class="emoji-avatar" title="${escapeHTML(student.appearance || '')}">${isMale ? '👦' : '👧'}</span>`;
}

// API 호출 함수
async function apiCall(endpoint, method = 'GET', data = null) {
  console.log('[FRONTEND API CALL]', method, `/api${endpoint}`, data || '');
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
  };

  if (data) {
    options.body = JSON.stringify(data);
  }

  const response = await fetch(`/api${endpoint}`, options);
  console.log('[FRONTEND API STATUS]', response.status, `/api${endpoint}`);
  return response.json();
}

// 게임 시작
startGameBtn.addEventListener('click', async () => {
  startGameBtn.style.display = 'none';
  loadingMessage.style.display = 'block';

  try {
    const result = await apiCall('/game/init', 'POST');
    if (result.success) {
      gameState = result.gameState;
      startScreen.classList.remove('active');
      gameScreen.classList.add('active');
      updateGameUI();
      renderStudentGrid();
    } else {
      alert('게임 초기화 실패: ' + result.error);
      startGameBtn.style.display = 'block';
      loadingMessage.style.display = 'none';
    }
  } catch (error) {
    console.error('게임 시작 오류:', error);
    alert('서버 연결 실패');
    startGameBtn.style.display = 'block';
    loadingMessage.style.display = 'none';
  }
});

// 게임 UI 업데이트
function updateGameUI() {
  currentMonthEl.textContent = gameState.currentMonth;
  currentWeekEl.textContent = gameState.currentWeek;
  actionPointsEl.textContent = gameState.weeklyActionsRemaining;

  // 학급 통계 계산
  const avgStress = gameState.students.reduce((sum, s) => sum + s.stressLevel, 0) / gameState.students.length;
  const avgTrust = gameState.students.reduce((sum, s) => sum + s.trustInTeacher, 0) / gameState.students.length;

  classAtmosphereBar.style.width = gameState.classAtmosphere + '%';
  classAtmosphereValue.textContent = gameState.classAtmosphere;

  avgStressBar.style.width = avgStress + '%';
  avgStressValue.textContent = Math.round(avgStress);

  avgTrustBar.style.width = avgTrust + '%';
  avgTrustValue.textContent = Math.round(avgTrust);

  // 다음 주 버튼 상태: 행동력이 남아있어도 진행 가능, 라벨로 유도
  nextWeekBtn.disabled = false;
  updateNextWeekButton();

  // 이벤트 패널: 빈 주차에 주의 학생 표시
  updateWeeklyEventPanel();
  updateReportsPanel();
}

// 주간 이벤트 패널: 이벤트 없으면 주의 학생 표시
function updateWeeklyEventPanel() {
  if (!gameState || !weeklyEventEl) return;

  if (gameState.currentEvent) {
    const event = gameState.currentEvent;
    weeklyEventEl.innerHTML = `
      <div class="weekly-tip event-active">
        <div class="tip-label">📌 진행 중 이벤트</div>
        <div class="tip-student"><strong>${escapeHTML(event.title)}</strong></div>
        <div class="tip-description">${escapeHTML(event.description)}</div>
        <button class="open-event-btn" type="button">선택지 확인</button>
      </div>
    `;
    weeklyEventEl.querySelector('.open-event-btn')?.addEventListener('click', () => showEvent(event));
    return;
  }

  const latestBreak = gameState.summerBreaks?.[gameState.summerBreaks.length - 1];
  const showBreakNotice = latestBreak && gameState.currentMonth === 8 && gameState.currentWeek === 4;
  if (showBreakNotice) {
    const changed = latestBreak.changesByStudent?.filter(item => item.changes?.length > 0).slice(0, 3) || [];
    weeklyEventEl.innerHTML = `
      <div class="weekly-tip summer-break">
        <div class="tip-label">🌻 2학기 시작</div>
        <div class="tip-description">${escapeHTML(latestBreak.message)}</div>
        ${changed.map(item => `<div class="tip-student">${escapeHTML(item.studentName)}: ${escapeHTML(item.changes.map(c => c.text).join(', '))}</div>`).join('')}
      </div>
    `;
    return;
  }

  // 스트레스 상위 3명
  const sorted = [...gameState.students].sort((a, b) => b.stressLevel - a.stressLevel);
  const topStress = sorted.slice(0, 3).filter(s => s.stressLevel >= 60);

  weeklyEventEl.innerHTML = `
    <div class="weekly-tip">
      <div class="tip-label">⚠️ 주의 학생 (스트레스 높음)</div>
      ${topStress.length > 0
        ? topStress.map(s => `<div class="tip-student">🔴 ${s.name} (${s.stressLevel})</div>`).join('')
        : '<div class="tip-student none">현재 위험 수치 학생 없음</div>'}
      <div class="tip-hint">💡 행동력이 ${gameState.weeklyActionsRemaining}회 남았습니다. 상담 후 "다음 주"로 진행하세요.</div>
    </div>
  `;
}

function updateReportsPanel() {
  if (!reportsListEl || !gameState) return;
  const reports = gameState.reports || [];

  if (reports.length === 0) {
    reportsListEl.innerHTML = '<p class="no-reports">아직 도착한 제보가 없습니다.</p>';
    return;
  }

  reportsListEl.innerHTML = reports.slice(-3).reverse().map(report => `
    <div class="report-item severity-${report.severity || 1}">
      <div class="report-meta">
        <span>${escapeHTML(report.date)}</span>
        <span>${report.isAnonymous ? '익명' : escapeHTML(report.reporterName || '제보자')}</span>
      </div>
      <div class="report-title">${escapeHTML(report.title)}</div>
      <div class="report-content">${escapeHTML(report.content)}</div>
    </div>
  `).join('');
}

// 다음 주 버튼 라벨/스타일 업데이트
function updateNextWeekButton() {
  if (!gameState) return;
  if (gameState.weeklyActionsRemaining > 0) {
    nextWeekBtn.textContent = `다음 주로 진행 (남은 행동 ${gameState.weeklyActionsRemaining}회 포기)`;
    nextWeekBtn.classList.add('warn');
  } else {
    nextWeekBtn.textContent = '다음 주로 진행 ▶';
    nextWeekBtn.classList.remove('warn');
  }
}

// 학생 그리드 렌더링
function renderStudentGrid() {
  studentGrid.innerHTML = '';

  gameState.students.forEach(student => {
    const card = document.createElement('div');
    card.className = 'student-card' + (student.weeklyConsulted ? ' consulted' : '');
    card.dataset.studentId = student.id;

    const roleBadge = student.role ? `<div class="role-badge">${student.role}</div>` : '';

    card.innerHTML = `
      ${roleBadge}
      <div class="student-card-avatar">${createAvatarHTML(student)}</div>
      <div class="student-card-name">${student.name}</div>
      <div class="student-card-number">${student.number}번</div>
      <div class="student-card-status">
        <span class="status-indicator stress" title="스트레스">😰 ${student.stressLevel}</span>
        <span class="status-indicator trust" title="신뢰도">💚 ${student.trustInTeacher}</span>
      </div>
    `;

    card.addEventListener('click', () => openStudentModal(student.id));
    studentGrid.appendChild(card);
  });
}

// 학생 상세 모달 열기
async function openStudentModal(studentId) {
  try {
    // 상세 정보 가져오기
    const student = await apiCall(`/student/${studentId}`);
    currentStudent = student;

    // 모달 내용 업데이트
    document.getElementById('modalStudentAvatar').innerHTML = createAvatarHTML(student);
    document.getElementById('modalStudentName').textContent = student.name;
    document.getElementById('modalStudentNumber').textContent = `${student.number}번`;
    document.getElementById('modalStudentGender').textContent = student.gender;

    // 역할 표시
    const roleEl = document.getElementById('modalStudentRole');
    if (student.role) {
      roleEl.textContent = '🏅 ' + student.role;
      roleEl.style.display = 'block';
    } else {
      roleEl.textContent = '';
      roleEl.style.display = 'none';
    }

    // 통계
    document.getElementById('modalStressBar').style.width = student.stressLevel + '%';
    document.getElementById('modalStressValue').textContent = student.stressLevel;
    document.getElementById('modalEsteemBar').style.width = student.selfEsteem + '%';
    document.getElementById('modalEsteemValue').textContent = student.selfEsteem;
    document.getElementById('modalTrustBar').style.width = student.trustInTeacher + '%';
    document.getElementById('modalTrustValue').textContent = student.trustInTeacher;

    // 프로필 정보
    document.getElementById('modalPersonality').textContent = student.personality;
    document.getElementById('modalHobby').textContent = student.hobby;
    document.getElementById('modalDream').textContent = student.dream;
    document.getElementById('modalGrade').textContent = student.schoolGrade;
    document.getElementById('modalAppearance').textContent = student.appearance;
    document.getElementById('modalFamily').textContent = student.familyEnvironment;
    document.getElementById('modalSpeakingStyle').textContent = student.speakingStyle;
    document.getElementById('modalIntroduction').textContent = student.introduction || '안녕하세요!';

    // 기억 업데이트
    updateMemories(student);

    // 상담 기록 초기화
    consultationHistory = [];
    document.getElementById('consultationMessages').innerHTML = '<p class="consultation-hint">상담을 시작하려면 메시지를 입력하세요.</p>';

    // 프로필 탭 활성화
    switchTab('profile');

    studentModal.classList.add('active');
  } catch (error) {
    console.error('학생 정보 로드 오류:', error);
    alert('학생 정보를 불러올 수 없습니다.');
  }
}

// 기억 업데이트
function updateMemories(student) {
  const memoriesEl = document.getElementById('studentMemories');

  if (!student.memories || student.memories.length === 0) {
    memoriesEl.innerHTML = '<p class="no-memories">아직 기록된 기억이 없습니다.</p>';
  } else {
    memoriesEl.innerHTML = student.memories.map(memory => 
      `<div class="memory-item">${memory}</div>`
    ).join('');
  }
}

// 탭 전환
function switchTab(tabName) {
  tabBtns.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });

  tabContents.forEach(content => {
    content.classList.toggle('active', content.id === tabName + 'Tab');
  });
}

tabBtns.forEach(btn => {
  btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});

// 모달 닫기
closeStudentModal.addEventListener('click', () => {
  studentModal.classList.remove('active');
  currentStudent = null;
});

closeNoteModal.addEventListener('click', () => {
  teacherNoteModal.classList.remove('active');
});

// 도움말 모달
helpBtn.addEventListener('click', () => {
  helpModal.classList.add('active');
});

closeHelpModal.addEventListener('click', () => {
  helpModal.classList.remove('active');
});

// 상담 폼
document.getElementById('consultationForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const input = document.getElementById('consultationInput');
  const message = input.value.trim();

  if (!message || !currentStudent) return;

  // 선생님 메시지 표시
  addChatMessage('teacher', message);
  input.value = '';
  input.disabled = true;
  const submitBtn = e.target.querySelector('button[type="submit"]');
  if (submitBtn) submitBtn.disabled = true;
  const typingEl = addTypingIndicator();
  const sentAt = Date.now();

  // 상담 API 호출
  try {
    console.log('[CONSULTATION SUBMIT]', {
      endpoint: '/api/consultation',
      studentId: currentStudent.id,
      message
    });
    const result = await apiCall('/consultation', 'POST', {
      studentId: currentStudent.id,
      message: message
    });
    console.log('[CONSULTATION RESULT]', result);
    if (result.responseSource === 'openrouter_failed') {
      console.error('[OPENROUTER FAILED]', result.openRouterError || result.message || 'OpenRouter request failed');
      const messagesEl = document.getElementById('consultationMessages');
      const warn = document.createElement('div');
      warn.className = 'consultation-tip fallback-warning';
      warn.textContent = '[OPENROUTER FAILED] 응답 생성에 실패해서 상담을 중단했습니다. fallback은 사용하지 않았습니다.';
      messagesEl.appendChild(warn);
      messagesEl.scrollTop = messagesEl.scrollHeight;
    } else if (result.responseSource === 'fallback') {
      console.warn('[OPENROUTER FAILED]', result.openRouterError || 'fallback response returned');
      console.warn('[FALLBACK USED]', result.studentResponse);
      const messagesEl = document.getElementById('consultationMessages');
      const warn = document.createElement('div');
      warn.className = 'consultation-tip fallback-warning';
      warn.textContent = '[OPENROUTER FAILED] fallback 응답이 사용되었습니다. 브라우저 콘솔과 서버 터미널을 확인하세요.';
      messagesEl.appendChild(warn);
      messagesEl.scrollTop = messagesEl.scrollHeight;
    } else if (result.responseSource === 'openrouter') {
      console.log('[OPENROUTER SUCCESS]', result.studentResponse);
    }

    if (result.success) {
      const minDelay = getStudentReplyDelay(result.studentResponse);
      const remainingDelay = Math.max(0, minDelay - (Date.now() - sentAt));
      if (remainingDelay > 0) await sleep(remainingDelay);
      removeTypingIndicator(typingEl);

      // 학생 응답 표시
      addChatMessage('student', result.studentResponse);

      // 게임 상태 업데이트
      gameState.weeklyActionsRemaining = result.weeklyActionsRemaining;
      updateGameUI();

      // 학생 카드 업데이트
      const studentCard = document.querySelector(`[data-student-id="${currentStudent.id}"]`);
      if (studentCard) {
        studentCard.classList.add('consulted');
      }

      // 현재 학생 정보 업데이트 (신뢰도 + 스트레스)
      currentStudent.trustInTeacher = result.newTrustLevel;
      currentStudent.stressLevel = result.newStressLevel;
      document.getElementById('modalTrustBar').style.width = result.newTrustLevel + '%';
      document.getElementById('modalTrustValue').textContent = result.newTrustLevel;
      document.getElementById('modalStressBar').style.width = result.newStressLevel + '%';
      document.getElementById('modalStressValue').textContent = result.newStressLevel;

      // 첫 상담 시 안내 메시지
      if (result.isFirstConsultation) {
        const messagesEl = document.getElementById('consultationMessages');
        const tip = document.createElement('div');
        tip.className = 'consultation-tip';
        tip.textContent = '💡 이 학생과의 상담이 시작되었습니다. 이번 주에는 추가 메시지마다 행동력이 소모되지 않습니다.';
        messagesEl.appendChild(tip);
        messagesEl.scrollTop = messagesEl.scrollHeight;
      }
    } else {
      removeTypingIndicator(typingEl);
      alert('상담 실패: ' + (result.message || result.error));
    }
  } catch (error) {
    console.error('상담 오류:', error);
    removeTypingIndicator(typingEl);
    alert('상담 처리 중 오류가 발생했습니다.');
  } finally {
    input.disabled = false;
    if (submitBtn) submitBtn.disabled = false;
    input.focus();
  }
});

function addTypingIndicator() {
  const messagesEl = document.getElementById('consultationMessages');
  const hint = messagesEl.querySelector('.consultation-hint');
  if (hint) hint.remove();

  const messageEl = document.createElement('div');
  messageEl.className = 'message student-message typing-message';
  messageEl.innerHTML = `
    <div class="message-content typing-content" aria-label="학생이 답변을 생각하는 중">
      <span></span><span></span><span></span>
    </div>
  `;

  messagesEl.appendChild(messageEl);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  return messageEl;
}

function removeTypingIndicator(element) {
  if (element && element.parentNode) {
    element.parentNode.removeChild(element);
  }
}

// 채팅 메시지 추가
function addChatMessage(role, content) {
  const messagesEl = document.getElementById('consultationMessages');

  // 힌트 메시지 제거
  const hint = messagesEl.querySelector('.consultation-hint');
  if (hint) hint.remove();

  const messageEl = document.createElement('div');
  messageEl.className = `message ${role === 'teacher' ? 'teacher-message' : 'student-message'}`;
  messageEl.innerHTML = `<div class="message-content">${escapeHTML(content)}</div>`;

  messagesEl.appendChild(messageEl);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

// 다음 주 진행
nextWeekBtn.addEventListener('click', async () => {
  if (gameState.weeklyActionsRemaining > 0) {
    if (!confirm('아직 행동 횟수가 남아있습니다. 그래도 다음 주로 진행하시겠습니까?')) {
      return;
    }
  }

  try {
    nextWeekBtn.disabled = true;
    nextWeekBtn.textContent = '진행 중...';

    const result = await apiCall('/game/next-week', 'POST');

    if (result.success) {
      if (result.gameEnded) {
        // 게임 종료 - 엔딩 표시
        showEnding(result.ending);
      } else {
        // 게임 상태 업데이트
        gameState.currentWeek = result.currentWeek;
        gameState.currentMonth = result.currentMonth;
        gameState.weeklyActionsRemaining = result.weeklyActionsRemaining;
        gameState.classAtmosphere = result.classAtmosphere;
        gameState.currentEvent = result.currentEvent || result.event || null;
        if (result.report) {
          gameState.reports = [...(gameState.reports || []), result.report];
        }
        if (result.summerBreak) {
          gameState.summerBreaks = [...(gameState.summerBreaks || []), result.summerBreak];
        }

        // 학생 상태 업데이트
        const stateResult = await apiCall('/game/state');
        gameState.students = stateResult.students;
        gameState.reports = stateResult.reports || gameState.reports || [];
        gameState.currentEvent = stateResult.currentEvent || gameState.currentEvent || null;
        gameState.summerBreaks = stateResult.summerBreaks || gameState.summerBreaks || [];

        updateGameUI();
        renderStudentGrid();

        // 이벤트 표시
        if (gameState.currentEvent) {
          showEvent(gameState.currentEvent);
        }

        if (result.summerBreak) {
          const changedCount = result.summerBreak.changesByStudent?.filter(item => item.changes?.length > 0).length || 0;
          alert(`${result.summerBreak.message}\n\n변화가 관찰된 학생: ${changedCount}명`);
        }

        if (result.report) {
          alert(`새 제보가 도착했습니다.\n\n[${result.report.title}]\n${result.report.content}`);
        }

        // 교무수첩 알림
        if (result.teacherNote) {
          console.log('교무수첩 작성됨:', result.teacherNote);
        }
      }
    } else {
      alert('진행 실패: ' + result.error);
    }
  } catch (error) {
    console.error('주간 진행 오류:', error);
    alert('진행 중 오류가 발생했습니다.');
  } finally {
    nextWeekBtn.disabled = false;
    nextWeekBtn.textContent = '다음 주로 진행';
  }
});

// 이벤트 표시
function showEvent(event) {
  document.getElementById('eventTitle').textContent = event.title;
  document.getElementById('eventDescription').textContent = event.description;

  const choicesEl = document.getElementById('eventChoices');
  choicesEl.innerHTML = '';

  event.choices.forEach(choice => {
    const choiceBtn = document.createElement('button');
    choiceBtn.className = 'event-choice';
    choiceBtn.textContent = choice.text;
    choiceBtn.addEventListener('click', () => resolveEvent(event, choice.id));
    choicesEl.appendChild(choiceBtn);
  });

  eventModal.classList.add('active');
}

// 이벤트 해결
async function resolveEvent(event, choiceId) {
  // 중복 클릭 방지
  const choiceBtns = document.querySelectorAll('.event-choice');
  choiceBtns.forEach(b => b.disabled = true);

  try {
    const result = await apiCall('/event/resolve', 'POST', {
      eventId: event.id,
      choiceId: choiceId
    });

    if (result.success) {
      eventModal.classList.remove('active');

      // 결과 메시지 추출 (다양한 응답 구조 대응)
      const msg = result.result?.result || result.result || '이벤트가 해결되었습니다.';
      alert(msg);

      // 게임 상태 새로고침
      const stateResult = await apiCall('/game/state');
      gameState.students = stateResult.students;
      gameState.classAtmosphere = stateResult.classAtmosphere;
      gameState.reports = stateResult.reports || gameState.reports || [];
      gameState.currentEvent = stateResult.currentEvent || null;
      gameState.summerBreaks = stateResult.summerBreaks || gameState.summerBreaks || [];
      updateGameUI();
      renderStudentGrid();
    } else {
      alert('이벤트 해결 실패: ' + (result.error || '알 수 없는 오류'));
      choiceBtns.forEach(b => b.disabled = false);
    }
  } catch (error) {
    console.error('이벤트 해결 오류:', error);
    alert('이벤트 해결 중 오류가 발생했습니다.');
    choiceBtns.forEach(b => b.disabled = false);
  }
}

// 교무수첩 보기
teacherNoteBtn.addEventListener('click', async () => {
  try {
    const notes = await apiCall('/teacher-notes');
    const notesList = document.getElementById('teacherNotesList');

    if (notes.length === 0) {
      notesList.innerHTML = '<p class="no-notes">아직 작성된 교무수첩이 없습니다.</p>';
    } else {
      notesList.innerHTML = notes.map(note => `
        <div class="note-item">
          <div class="note-date">${note.date}</div>
          <div class="note-content">${note.content}</div>
        </div>
      `).join('');
    }

    teacherNoteModal.classList.add('active');
  } catch (error) {
    console.error('교무수첩 로드 오류:', error);
  }
});

// 엔딩 표시
function showEnding(ending) {
  document.getElementById('endingTitle').textContent = ending.title;
  document.getElementById('endingType').textContent = ending.endingType;
  document.getElementById('endingDescription').textContent = ending.description;

  const lettersEl = document.getElementById('studentLetters');
  if (ending.studentLetters && ending.studentLetters.length > 0) {
    lettersEl.innerHTML = ending.studentLetters.map(letter => `
      <div class="student-letter">
        <div class="letter-name">${letter.name}</div>
        <div class="letter-content">${letter.letter}</div>
      </div>
    `).join('');
  } else {
    lettersEl.innerHTML = '';
  }

  endingModal.classList.add('active');
}

// 새 게임 시작
document.getElementById('restartGameBtn').addEventListener('click', () => {
  endingModal.classList.remove('active');
  gameScreen.classList.remove('active');
  startScreen.classList.add('active');
  startGameBtn.style.display = 'block';
  loadingMessage.style.display = 'none';
  gameState = null;
});

// 배경 클릭으로 모달 닫기
window.addEventListener('click', (e) => {
  if (e.target === studentModal) {
    studentModal.classList.remove('active');
  }
  if (e.target === teacherNoteModal) {
    teacherNoteModal.classList.remove('active');
  }
  if (e.target === eventModal) {
    // 이벤트 모달은 선택해야 닫힘
  }
  if (e.target === helpModal) {
    helpModal.classList.remove('active');
  }
});

// ESC 키로 모달 닫기
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    studentModal.classList.remove('active');
    teacherNoteModal.classList.remove('active');
    helpModal.classList.remove('active');
  }
});
