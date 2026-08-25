const SUPABASE_URL = 'https://xraqenrrfhsvinrxvkyn.supabase.co';
const SUPABASE_KEY = 'sb_publishable_q6wPihobxYCyZB-VCCaIJA_kClDgGqG';
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const authBox = document.getElementById('authBox');
const studentApp = document.getElementById('studentApp');
const loginForm = document.getElementById('loginForm');
const signupBtn = document.getElementById('signupBtn');
const authMessage = document.getElementById('authMessage');

let course = null;
let lessons = [];
let progress = new Map();
let currentUser = null;

function esc(v='') { return String(v).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
function setMsg(text, ok=false) { authMessage.textContent = text; authMessage.className = ok ? 'ok' : ''; }
function pct() { return lessons.length ? Math.round([...progress.values()].filter(p=>p.completed).length / lessons.length * 100) : 0; }

async function boot() {
  const {data:{session}} = await db.auth.getSession();
  currentUser = session?.user || null;
  if (currentUser) await openStudentArea(); else closeStudentArea();
  db.auth.onAuthStateChange(async (_event, session) => {
    currentUser = session?.user || null;
    if (currentUser) await openStudentArea(); else closeStudentArea();
  });
  window.addEventListener('hashchange', () => { if (currentUser) renderRoute(); });
}

function closeStudentArea() {
  authBox.classList.remove('hidden');
  studentApp.classList.add('hidden');
}

async function openStudentArea() {
  authBox.classList.add('hidden');
  studentApp.classList.remove('hidden');
  await loadCourse();
  renderRoute();
}

async function loadCourse() {
  const {data: courses, error: cErr} = await db.from('courses').select('*').eq('slug','porteiro-profissional').limit(1);
  if (cErr || !courses?.length) { studentApp.innerHTML = '<div class="notice error">Não foi possível carregar o curso.</div>'; return; }
  course = courses[0];
  const {data: ls, error:lErr} = await db.from('lessons').select('*').eq('course_id',course.id).eq('is_published',true).order('lesson_number');
  if (lErr) { studentApp.innerHTML = '<div class="notice error">Não foi possível carregar as aulas.</div>'; return; }
  lessons = ls || [];
  const {data: ps} = await db.from('lesson_progress').select('*').eq('user_id',currentUser.id).in('lesson_id',lessons.map(x=>x.id));
  progress = new Map((ps || []).map(x=>[x.lesson_id,x]));
}

function headerHtml() {
  const done = [...progress.values()].filter(x=>x.completed).length;
  return `<div class="course-top"><div><p class="tag">CURSO KHALID</p><h3>${esc(course.title)}</h3><p class="course-desc">${esc(course.description||'')}</p></div><div class="course-stat"><b>${done}/${lessons.length}</b><span>aulas concluídas</span><div class="progress"><i style="width:${pct()}%"></i></div><strong>${pct()}%</strong></div></div>`;
}

function menuHtml() {
  return `<aside class="lesson-menu"><button class="back-course" onclick="location.hash='curso'">← Visão geral</button>${lessons.map(l=>{const p=progress.get(l.id);return `<button class="lesson-link ${p?.completed?'done':''}" onclick="location.hash='aula-${l.lesson_number}'"><span>${p?.completed?'✓':'○'}</span><b>${String(l.lesson_number).padStart(2,'0')}</b><em>${esc(l.title)}</em></button>`}).join('')}<button class="exam-link" onclick="location.hash='prova-final'">📝 Prova final · 30 questões</button></aside>`;
}

async function renderRoute() {
  if (!course) return;
  const hash = location.hash.replace('#','');
  if (hash === 'portal' || hash === '') return renderDashboard();
  if (hash === 'curso') return renderDashboard();
  if (hash === 'prova-final') return renderFinalExam();
  const m = hash.match(/^aula-(\d+)$/);
  if (m) return renderLesson(Number(m[1]));
  return renderDashboard();
}

function renderDashboard() {
  studentApp.innerHTML = `${headerHtml()}<div class="student-toolbar"><span>Olá, ${esc(currentUser.email)}</span><button class="btn small" id="logoutBtn">Sair</button></div><div class="course-layout"><div class="lesson-list">${lessons.map(l=>{const p=progress.get(l.id);return `<article class="lesson-card"><div class="lesson-num">${String(l.lesson_number).padStart(2,'0')}</div><div><span class="type">AULA ${String(l.lesson_number).padStart(2,'0')}</span><h4>${esc(l.title)}</h4><p>${esc(l.objectives||'')}</p><span class="meta">${l.duration_minutes} min · ${p?.completed?'Concluída':'Não concluída'}</span></div><button class="btn" onclick="location.hash='aula-${l.lesson_number}'">${p?.completed?'Revisar':'Estudar aula'}</button></article>`}).join('')}</div><div class="final-card"><span class="type">AVALIAÇÃO</span><h3>Prova Final</h3><p>30 questões · aprovação com 70%.</p><button class="btn" onclick="location.hash='prova-final'">Abrir prova final</button></div></div>`;
  document.getElementById('logoutBtn').onclick = async () => { await db.auth.signOut(); location.hash='portal'; };
}

function renderLesson(n) {
  const l = lessons.find(x=>x.lesson_number===n);
  if (!l) return renderDashboard();
  const sections = l.content?.sections || [];
  const p = progress.get(l.id);
  studentApp.innerHTML = `${headerHtml()}<div class="student-toolbar"><button class="btn small outline" onclick="location.hash='curso'">← Curso</button><span>Aula ${String(n).padStart(2,'0')} · ${l.duration_minutes} min</span></div><div class="course-layout"><div class="lesson-main"><div class="lesson-hero"><span class="type">AULA ${String(n).padStart(2,'0')}</span><h2>${esc(l.title)}</h2><p>${esc(l.objectives||'')}</p></div>${sections.map(s=>`<section class="lesson-section"><h3>${esc(s.heading)}</h3><p>${esc(s.text)}</p></section>`).join('')}<div id="quizArea" class="quiz-box"><h3>Quiz da aula</h3><p>Responda às questões para registrar seu aprendizado.</p><div id="quizQuestions">Carregando quiz...</div></div><div class="lesson-actions"><button class="btn" id="completeLesson">${p?.completed?'✓ Aula concluída':'Marcar aula como concluída'}</button></div><div id="quizResult"></div></div>${menuHtml()}</div>`;
  document.getElementById('completeLesson').onclick = async () => { await saveProgress(l,true); };
  loadLessonQuiz(l);
}

async function saveProgress(l, completed=true) {
  const {data,error} = await db.rpc('save_lesson_progress',{p_lesson_id:l.id,p_progress:completed?100:0,p_completed:completed,p_position_seconds:0});
  if (error) { document.getElementById('quizResult').innerHTML='<div class="notice error">Não foi possível salvar o progresso.</div>'; return; }
  progress.set(l.id,data);
  document.getElementById('quizResult').innerHTML='<div class="notice success">Progresso salvo online.</div>';
  renderLesson(l.lesson_number);
}

async function loadLessonQuiz(l) {
  const box = document.getElementById('quizQuestions');
  const {data:quiz,error:qErr} = await db.from('lesson_quizzes').select('*').eq('lesson_id',l.id).limit(1);
  if (qErr || !quiz?.length) { box.textContent='Quiz ainda não disponível.'; return; }
  const {data:qs,error} = await db.rpc('get_lesson_quiz',{p_lesson_id:l.id});
  if (error || !qs?.length) { box.textContent='Quiz ainda não disponível.'; return; }
  box.innerHTML = `<form id="lessonQuizForm">${qs.map((q,i)=>`<fieldset class="q"><legend>${i+1}. ${esc(q.question)}</legend>${['A','B','C','D'].map(k=>`<label><input type="radio" name="q${q.question_number}" value="${k}" required><span><b>${k}</b> ${esc(q.options[k])}</span></label>`).join('')}</fieldset>`).join('')}<button class="btn" type="submit">Corrigir quiz</button></form>`;
  document.getElementById('lessonQuizForm').onsubmit = async e => {
    e.preventDefault();
    const answers={}; qs.forEach(q=>{answers[q.question_number]=new FormData(e.target).get('q'+q.question_number);});
    const {data,error} = await db.rpc('submit_lesson_quiz',{p_quiz_id:quiz[0].id,p_answers:answers});
    const result=document.getElementById('quizResult');
    if(error){result.innerHTML='<div class="notice error">Não foi possível corrigir o quiz.</div>';return;}
    const r=data?.[0];
    if(r?.passed){ await saveProgress(l,true); return; }
    result.innerHTML=`<div class="notice warn">Resultado: <b>${r?.score ?? 0}%</b>. Você precisa de 70% para aprovação. Revise a aula e tente novamente.</div>`;
  };
}

async function renderFinalExam() {
  studentApp.innerHTML = `${headerHtml()}<div class="student-toolbar"><button class="btn small outline" onclick="location.hash='curso'">← Curso</button><span>Prova final · 30 questões</span></div><div class="exam-page"><div class="lesson-hero"><span class="type">AVALIAÇÃO FINAL</span><h2>Prova Final — Porteiro Profissional</h2><p>Aprovação com 70%. A correção acontece no servidor e o resultado fica registrado online.</p></div><div id="examQuestions">Carregando prova...</div><div id="examResult"></div></div>`;
  const {data:exam} = await db.from('final_exams').select('*').eq('course_id',course.id).limit(1);
  if (!exam?.length) { document.getElementById('examQuestions').textContent='Prova não disponível.'; return; }
  const {data:qs,error}=await db.rpc('get_final_exam',{p_exam_id:exam[0].id});
  if(error || !qs?.length){document.getElementById('examQuestions').textContent='Prova não disponível.';return;}
  document.getElementById('examQuestions').innerHTML=`<form id="finalExamForm">${qs.map((q,i)=>`<fieldset class="q"><legend>${i+1}. ${esc(q.question)}</legend>${['A','B','C','D'].map(k=>`<label><input type="radio" name="q${q.question_number}" value="${k}" required><span><b>${k}</b> ${esc(q.options[k])}</span></label>`).join('')}</fieldset>`).join('')}<button class="btn" type="submit">Enviar prova final</button></form>`;
  document.getElementById('finalExamForm').onsubmit=async e=>{
    e.preventDefault();
    const answers={}; qs.forEach(q=>{answers[q.question_number]=new FormData(e.target).get('q'+q.question_number);});
    const {data,error}=await db.rpc('submit_final_exam',{p_exam_id:exam[0].id,p_answers:answers});
    const box=document.getElementById('examResult');
    if(error){box.innerHTML='<div class="notice error">Não foi possível enviar a prova.</div>';return;}
    const r=data?.[0];
    if(r?.passed){box.innerHTML=`<div class="notice success"><h3>Parabéns! Você foi aprovado.</h3><p>Resultado: <b>${r.score}%</b>.</p>${r.certificate_code?`<p>Certificado liberado: <b>${esc(r.certificate_code)}</b></p>`:'<p>O certificado será liberado quando todas as 16 aulas estiverem concluídas.</p>'}</div>`;} else {box.innerHTML=`<div class="notice warn"><h3>Resultado: ${r?.score ?? 0}%</h3><p>Você precisa de 70% para aprovação. Revise o conteúdo e faça uma nova tentativa.</p></div>`;}
  };
}

loginForm.addEventListener('submit',async e=>{
  e.preventDefault(); setMsg('Entrando...');
  const email=document.getElementById('email').value.trim(); const password=document.getElementById('password').value;
  const {error}=await db.auth.signInWithPassword({email,password});
  if(error) setMsg('Não foi possível entrar. Confira e-mail e senha.');
});

signupBtn.addEventListener('click',async()=>{
  const email=document.getElementById('email').value.trim(); const password=document.getElementById('password').value;
  if(!email || password.length<6){setMsg('Informe um e-mail e uma senha com pelo menos 6 caracteres.');return;}
  setMsg('Criando conta...');
  const {data,error}=await db.auth.signUp({email,password});
  if(error){setMsg(error.message);return;}
  if(data.session) setMsg('Conta criada.',true); else setMsg('Conta criada. Confira seu e-mail para confirmar o acesso.',true);
});

boot();