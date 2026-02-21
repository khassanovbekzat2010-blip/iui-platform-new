import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import OpenAI from "openai";
import crypto from "crypto";
import fs from "fs";

dotenv.config();

const app = express();
app.use(express.json({ limit: "2mb" }));

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ===== Static site (public/)
app.use(express.static(path.join(__dirname, "public")));

// ===== OpenAI client
const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) console.warn("⚠️ OPENAI_API_KEY is missing. Put it in .env");
const client = new OpenAI({ apiKey });

// ===== Helper: map language
function languageLabel(lang) {
  if (lang?.startsWith("ru")) return "Russian";
  if (lang?.startsWith("kk")) return "Kazakh";
  return "English";
}

// ===========================
// TELEMETRY & AUTHENTICATION
// ===========================
const TEACHER_PASSWORD = process.env.TEACHER_PASSWORD || "1234";
const teacherTokens = new Map();

// Список случайных имен учеников
const studentNames = [
  "Алексей Иванов", "Мария Петрова", "Дмитрий Сидоров", "Анна Кузнецова", "Иван Смирнов",
  "Елена Попова", "Сергей Волков", "Ольга Козлова", "Михаил Новиков", "Наталья Морозова",
  "Андрей Павлов", "Юлия Семенова", "Александр Федоров", "Татьяна Николаева", "Владимир Захаров",
  "Екатерина Романова", "Павел Орлов", "Светлана Алексеева", "Николай Лебедев", "Ирина Соколова",
  "Артем Борисов", "Алина Яковлева", "Георгий Григорьев", "Валентина Титова", "Роман Марков",
  "Людмила Белова", "Виктор Комаров", "Оксана Ильина", "Станислав Гусев", "Ангелина Тимофеева"
];

// Классы и учителя
const teachers = [
  { 
    id: "teacher1", 
    name: "Анна Иванова", 
    password: "teacher123", 
    classes: ["10A", "10B"], 
    subjects: ["Математика", "Физика"],
    avatarColor: "#7c5cff"
  },
  { 
    id: "teacher2", 
    name: "Петр Сидоров", 
    password: "teacher456", 
    classes: ["11A", "11B"], 
    subjects: ["Химия", "Биология"],
    avatarColor: "#4dd6ff"
  },
  { 
    id: "teacher3", 
    name: "Мария Ким", 
    password: "teacher789", 
    classes: ["9A", "9B", "9C"], 
    subjects: ["История", "Обществознание"],
    avatarColor: "#22c55e"
  }
];

// in-memory store для телеметрии
const telemetryStore = new Map();
const simulationStore = new Map(); // Хранение симуляций

// Генерация реалистичных данных для учеников
function generateStudentData(classId, count = 8) {
  const students = [];
  const usedNames = new Set();
  
  for (let i = 1; i <= count; i++) {
    let name;
    do {
      name = studentNames[Math.floor(Math.random() * studentNames.length)];
    } while (usedNames.has(name));
    usedNames.add(name);
    
    const basePerformance = 60 + Math.random() * 35;
    const baseAttendance = 75 + Math.random() * 20;
    
    students.push({
      id: `stud_${classId}_${i}`,
      name: name,
      classId: classId,
      performance: Math.round(basePerformance),
      attendance: Math.round(baseAttendance),
      lastActive: Date.now() - Math.random() * 3600000,
      attentionDrops: generateAttentionDrops(),
      engagement: Math.round(65 + Math.random() * 30),
      understanding: Math.round(70 + Math.random() * 25),
      progress: Math.round(50 + Math.random() * 40) // Добавляем прогресс для симуляции
    });
  }
  
  return students;
}

function generateAttentionDrops() {
  const drops = [];
  const dropCount = Math.floor(Math.random() * 4);
  
  for (let i = 0; i < dropCount; i++) {
    const duration = 30 + Math.random() * 120;
    const startTime = Date.now() - (Math.random() * 3600000);
    const severity = 20 + Math.random() * 30;
    
    drops.push({
      startTime: new Date(startTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
      duration: Math.round(duration),
      severity: Math.round(severity),
      reason: getRandomDropReason()
    });
  }
  
  return drops;
}

function getRandomDropReason() {
  const reasons = [
    "Сложная тема",
    "Отвлекался на телефон",
    "Усталость",
    "Непонятное объяснение",
    "Шум в классе",
    "Проблемы с пониманием терминов",
    "Быстрый темп урока",
    "Недостаток примеров"
  ];
  return reasons[Math.floor(Math.random() * reasons.length)];
}

// Инициализация данных
function initializeTelemetryData() {
  telemetryStore.clear();
  
  teachers.forEach(teacher => {
    teacher.classes.forEach(classId => {
      const students = generateStudentData(classId, 6 + Math.floor(Math.random() * 4));
      
      students.forEach(student => {
        const historyLength = 100;
        const baseAttention = 70 + Math.random() * 25;
        const baseMeditation = 50 + Math.random() * 40;
        
        const attentionHistory = Array.from({length: historyLength}, (_, i) => {
          const trend = Math.sin(i / 20) * 10;
          const random = (Math.random() - 0.5) * 15;
          const dropFactor = student.attentionDrops.some(d => 
            Math.abs(i - (historyLength / student.attentionDrops.length)) < 5
          ) ? -30 : 0;
          
          return Math.max(20, Math.min(100, baseAttention + trend + random + dropFactor));
        });
        
        const meditationHistory = Array.from({length: historyLength}, (_, i) => {
          const trend = Math.cos(i / 25) * 8;
          const random = (Math.random() - 0.5) * 12;
          return Math.max(30, Math.min(95, baseMeditation + trend + random));
        });
        
        telemetryStore.set(student.id, {
          ...student,
          attentionHistory: attentionHistory,
          meditationHistory: meditationHistory,
          lastSeen: student.lastActive,
          last: {
            attention: attentionHistory[attentionHistory.length - 1],
            meditation: meditationHistory[meditationHistory.length - 1],
            signal: 90 + Math.random() * 10,
            blink: 80 + Math.random() * 40,
            ts: Date.now()
          }
        });
      });
    });
  });
}

initializeTelemetryData();

// Обновление данных в реальном времени
setInterval(() => {
  telemetryStore.forEach((student, id) => {
    if (student.attentionHistory) {
      const change = (Math.random() - 0.5) * 8;
      const newAttention = Math.max(20, Math.min(100, 
        student.last.attention + change
      ));
      
      student.attentionHistory.push(newAttention);
      if (student.attentionHistory.length > 120) {
        student.attentionHistory = student.attentionHistory.slice(-120);
      }
      student.last.attention = newAttention;
    }
    
    if (student.meditationHistory) {
      const change = (Math.random() - 0.5) * 6;
      const newMeditation = Math.max(25, Math.min(95, 
        student.last.meditation + change
      ));
      
      student.meditationHistory.push(newMeditation);
      if (student.meditationHistory.length > 120) {
        student.meditationHistory = student.meditationHistory.slice(-120);
      }
      student.last.meditation = newMeditation;
    }
    
    student.lastSeen = Date.now();
  });
}, 5000);

// Функции утилиты
function avg(arr) {
  if (!arr?.length) return null;
  const s = arr.reduce((a, b) => a + b, 0);
  return Math.round((s / arr.length) * 10) / 10;
}

// ===========================
// API Endpoints
// ===========================

// Получение текущих данных TGAM
app.get("/api/tgam/current", (req, res) => {
  const attention = 70 + Math.random() * 25;
  const meditation = 50 + Math.random() * 40;
  
  const hasDrop = Math.random() > 0.7;
  const dropTime = hasDrop ? 
    `${Math.floor(Math.random() * 45)}:${Math.floor(Math.random() * 60).toString().padStart(2, '0')}` : 
    null;
  
  res.json({
    ok: true,
    data: {
      attention: Math.round(attention),
      meditation: Math.round(meditation),
      blink: Math.round(80 + Math.random() * 40),
      signal: Math.round(90 + Math.random() * 10),
      delta: Math.round(30 + Math.random() * 40),
      theta: Math.round(25 + Math.random() * 35),
      alpha: Math.round(40 + Math.random() * 35),
      beta: Math.round(30 + Math.random() * 30),
      gamma: Math.round(20 + Math.random() * 25),
      lastDrop: dropTime,
      status: attention > 80 ? "high" : attention > 60 ? "normal" : "low"
    }
  });
});

// Вход учителя
app.post("/api/teacher/login", (req, res) => {
  const { teacherId, password } = req.body || {};
  
  const teacher = teachers.find(t => t.id === teacherId && t.password === password);
  if (!teacher) {
    return res.json({ ok: false, error: "Invalid credentials" });
  }
  
  const token = crypto.randomBytes(24).toString("hex");
  teacherTokens.set(token, {
    ...teacher,
    loginTime: Date.now()
  });
  
  return res.json({ 
    ok: true, 
    token,
    teacher: {
      id: teacher.id,
      name: teacher.name,
      classes: teacher.classes,
      subjects: teacher.subjects,
      avatarColor: teacher.avatarColor
    }
  });
});

// Проверка токена учителя
function verifyTeacherToken(req, res, next) {
  const token = req.headers.authorization?.replace("Bearer ", "") || req.query.token;
  
  if (!token || !teacherTokens.has(token)) {
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  }
  
  req.teacher = teacherTokens.get(token);
  next();
}

// Получение данных учителя
app.get("/api/teacher/dashboard", verifyTeacherToken, (req, res) => {
  try {
    const teacherClasses = req.teacher.classes;
    const now = Date.now();
    
    const allStudents = [];
    const classStats = {};
    
    teacherClasses.forEach(classId => {
      const classStudents = Array.from(telemetryStore.values())
        .filter(s => s.classId === classId);
      
      allStudents.push(...classStudents);
      
      const attentions = classStudents.map(s => s.last?.attention || 70);
      const meditations = classStudents.map(s => s.last?.meditation || 60);
      const performances = classStudents.map(s => s.performance || 75);
      const engagements = classStudents.map(s => s.engagement || 75);
      const understandings = classStudents.map(s => s.understanding || 75);
      
      classStats[classId] = {
        totalStudents: classStudents.length,
        avgAttention: avg(attentions),
        avgMeditation: avg(meditations),
        avgPerformance: avg(performances),
        avgEngagement: avg(engagements),
        avgUnderstanding: avg(understandings),
        lowAttentionCount: classStudents.filter(s => (s.last?.attention || 70) < 50).length,
        highPerformanceCount: classStudents.filter(s => (s.performance || 75) > 85).length
      };
    });
    
    const overallStats = {
      totalStudents: allStudents.length,
      totalClasses: teacherClasses.length,
      avgAttention: avg(allStudents.map(s => s.last?.attention || 70)),
      avgMeditation: avg(allStudents.map(s => s.last?.meditation || 60)),
      avgPerformance: avg(allStudents.map(s => s.performance || 75)),
      avgEngagement: avg(allStudents.map(s => s.engagement || 75)),
      avgUnderstanding: avg(allStudents.map(s => s.understanding || 75)),
      studentsNeedingAttention: allStudents.filter(s => (s.last?.attention || 70) < 50).length,
      topStudents: allStudents
        .sort((a, b) => (b.performance || 75) - (a.performance || 75))
        .slice(0, 5)
        .map(s => ({ 
          name: s.name, 
          performance: s.performance,
          attention: s.last?.attention,
          class: s.classId 
        })),
      recentActivity: allStudents
        .filter(s => now - s.lastSeen < 300000)
        .length
    };
    
    const studentsTable = allStudents.map(student => {
      const lastSeenMs = now - student.lastSeen;
      const lastSeenText = lastSeenMs < 60000 ? "Только что" : 
                          lastSeenMs < 3600000 ? `${Math.round(lastSeenMs / 60000)} мин назад` :
                          `${Math.round(lastSeenMs / 3600000)} ч назад`;
      
      return {
        id: student.id,
        name: student.name,
        classId: student.classId,
        attention: Math.round(student.last?.attention || 70),
        meditation: Math.round(student.last?.meditation || 60),
        performance: student.performance,
        engagement: student.engagement,
        understanding: student.understanding,
        lastSeen: lastSeenText,
        status: getStudentStatus(student),
        attentionDrops: student.attentionDrops?.length || 0,
        avatarColor: stringToColor(student.name)
      };
    });
    
    const chartData = {
      attentionByClass: teacherClasses.map(classId => ({
        class: classId,
        value: classStats[classId]?.avgAttention || 70
      })),
      performanceByClass: teacherClasses.map(classId => ({
        class: classId,
        value: classStats[classId]?.avgPerformance || 75
      })),
      engagementByClass: teacherClasses.map(classId => ({
        class: classId,
        value: classStats[classId]?.avgEngagement || 75
      })),
      understandingByClass: teacherClasses.map(classId => ({
        class: classId,
        value: classStats[classId]?.avgUnderstanding || 75
      }))
    };
    
    res.json({
      ok: true,
      teacher: {
        id: req.teacher.id,
        name: req.teacher.name,
        classes: req.teacher.classes,
        subjects: req.teacher.subjects,
        avatarColor: req.teacher.avatarColor
      },
      overallStats,
      classStats,
      students: studentsTable,
      chartData,
      lastUpdated: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
    });
    
  } catch (e) {
    console.error("Dashboard error:", e);
    res.status(500).json({ ok: false, error: "Internal server error" });
  }
});

// Сохранение симуляции
app.post("/api/simulation/save", verifyTeacherToken, (req, res) => {
  try {
    const { simulationData } = req.body;
    const simulationId = `sim_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    simulationStore.set(simulationId, {
      ...simulationData,
      id: simulationId,
      teacherId: req.teacher.id,
      savedAt: new Date().toISOString(),
      students: telemetryStore.size // Сохраняем количество студентов
    });
    
    // Обновляем прогресс студентов на основе симуляции
    if (simulationData.students) {
      simulationData.students.forEach(simStudent => {
        const realStudent = Array.from(telemetryStore.values())
          .find(s => s.name === simStudent.name && s.classId === simStudent.classId);
        
        if (realStudent) {
          // Обновляем показатели на основе симуляции
          const progressImprovement = Math.min(10, Math.max(0, (simStudent.progress - 50) / 10));
          realStudent.performance = Math.min(100, realStudent.performance + progressImprovement);
          realStudent.understanding = Math.min(100, realStudent.understanding + progressImprovement);
        }
      });
    }
    
    res.json({ 
      ok: true, 
      simulationId,
      message: "Симуляция сохранена и данные студентов обновлены"
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: "Ошибка сохранения симуляции" });
  }
});

// Получение сохраненных симуляций
app.get("/api/simulation/list", verifyTeacherToken, (req, res) => {
  try {
    const simulations = Array.from(simulationStore.values())
      .filter(sim => sim.teacherId === req.teacher.id)
      .map(sim => ({
        id: sim.id,
        name: sim.name || `Симуляция от ${new Date(sim.savedAt).toLocaleDateString()}`,
        savedAt: sim.savedAt,
        classSize: sim.classSize || 25,
        avgProgress: sim.avgProgress || 0,
        engagement: sim.engagement || 0
      }));
    
    res.json({ ok: true, simulations });
  } catch (e) {
    res.status(500).json({ ok: false, error: "Ошибка получения симуляций" });
  }
});

// Получение детальной информации о студенте
app.get("/api/teacher/student/:studentId", verifyTeacherToken, (req, res) => {
  try {
    const { studentId } = req.params;
    const student = telemetryStore.get(studentId);
    
    if (!student) {
      return res.status(404).json({ ok: false, error: "Student not found" });
    }
    
    if (!req.teacher.classes.includes(student.classId)) {
      return res.status(403).json({ ok: false, error: "Access denied" });
    }
    
    const detailedHistory = generateDetailedHistory(student);
    
    res.json({
      ok: true,
      student: {
        ...student,
        detailedHistory,
        currentStatus: getStudentStatus(student),
        improvementTips: getImprovementTips(student),
        parentContact: `+7 ${Math.floor(Math.random() * 900) + 100} ${Math.floor(Math.random() * 900) + 100} ${Math.floor(Math.random() * 90) + 10} ${Math.floor(Math.random() * 90) + 10}`,
        email: `${student.name.toLowerCase().replace(' ', '.')}@school.edu`
      }
    });
    
  } catch (e) {
    res.status(500).json({ ok: false, error: "Error fetching student data" });
  }
});

// Вспомогательные функции
function getStudentStatus(student) {
  const attention = student.last?.attention || 70;
  const performance = student.performance || 75;
  
  if (attention > 80 && performance > 85) return "excellent";
  if (attention > 70 && performance > 75) return "good";
  if (attention < 50 || performance < 60) return "needs_attention";
  return "average";
}

function getImprovementTips(student) {
  const tips = [];
  
  if ((student.last?.attention || 70) < 60) {
    tips.push("Увеличить вовлеченность через интерактивные задания");
    tips.push("Чаще обращаться к ученику во время урока");
  }
  
  if ((student.last?.meditation || 60) < 40) {
    tips.push("Рекомендовать перерывы для снижения стресса");
    tips.push("Включить расслабляющие упражнения перед сложными темами");
  }
  
  if (student.performance < 70) {
    tips.push("Дополнительные индивидуальные консультации");
    tips.push("Упрощенный материал для лучшего понимания");
  }
  
  if (tips.length === 0) {
    tips.push("Продолжать текущую стратегию обучения");
    tips.push("Поощрять участие в дополнительных занятиях");
  }
  
  return tips.slice(0, 3);
}

function generateDetailedHistory(student) {
  const history = [];
  const now = Date.now();
  
  for (let i = 6; i >= 0; i--) {
    const date = new Date(now - i * 86400000);
    const day = date.toLocaleDateString('ru-RU', { weekday: 'short' });
    
    const base = student.performance / 100;
    const attention = Math.round(60 + (base * 25) + (Math.random() * 10 - 5));
    const engagement = Math.round(65 + (base * 20) + (Math.random() * 10 - 5));
    const understanding = Math.round(70 + (base * 20) + (Math.random() * 10 - 5));
    
    history.push({
      date: day,
      dayNumber: date.getDate(),
      attention: attention,
      engagement: engagement,
      understanding: understanding,
      completedTasks: Math.round(3 + Math.random() * 4),
      status: attention > 75 ? "good" : attention < 55 ? "low" : "average"
    });
  }
  
  return history;
}

function stringToColor(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  const colors = [
    '#7c5cff', '#4dd6ff', '#22c55e', '#f59e0b', '#fb7185',
    '#8b5cf6', '#06b6d4', '#10b981', '#f97316', '#ec4899'
  ];
  
  return colors[Math.abs(hash) % colors.length];
}

// ===========================
// AI ANALYZE API
// ===========================
app.post("/api/analyze", async (req, res) => {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return res.status(400).json({ ok: false, error: "OPENAI_API_KEY is missing in .env" });
    }

    const { transcript, language } = req.body || {};
    const text = String(transcript || "").trim();
    if (text.length < 10) return res.status(400).json({ ok: false, error: "Transcript is too short" });

    const model = process.env.OPENAI_MODEL || "gpt-4o";

    const autoDrops = detectComplexSections(text);
    
    const schema = {
      name: "iui_analysis",
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          title: { type: "string" },
          summary: { type: "string" },
          key_points: { type: "array", items: { type: "string" } },
          homework: { type: "array", items: { type: "string" } },
          recommendations: { type: "array", items: { type: "string" } },
          difficulty_level: { type: "string", enum: ["beginner", "intermediate", "advanced"] },
          estimated_time: { type: "string" },
          materials_needed: { type: "array", items: { type: "string" } }
        },
        required: ["title", "summary", "key_points", "homework", "recommendations", "difficulty_level", "estimated_time", "materials_needed"]
      },
      strict: true
    };

    const langName = languageLabel(language);

    const instructions = `
You are an expert educational assistant. Analyze the lesson transcript and provide:

1. A concise but engaging title
2. A comprehensive summary in 3-4 paragraphs
3. 5-7 key points as bullet points
4. 3-5 specific homework assignments
5. 3-5 recommendations for improving the lesson
6. Difficulty level (beginner/intermediate/advanced)
7. Estimated time to complete homework
8. Materials needed

IMPORTANT: 
- Return ALL text in ${langName} language
- Make homework practical and achievable
- Be encouraging and student-friendly
- Focus on actionable insights

Format homework as clear, numbered tasks.
`;

    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: "system", content: instructions },
        { role: "user", content: `TRANSCRIPT:\n${text}` }
      ],
      response_format: { type: "json_schema", json_schema: schema },
      temperature: 0.7,
      max_tokens: 2000
    });

    const jsonText = response.choices[0].message.content;

    let data;
    try {
      data = JSON.parse(jsonText);
    } catch (e) {
      console.error("❌ Failed to parse model JSON:", jsonText);
      return res.status(500).json({ ok: false, error: "Model returned invalid JSON", details: String(e) });
    }

    return res.json({ 
      ok: true, 
      data,
      autoDetectedDrops: autoDrops 
    });
  } catch (err) {
    console.error("❌ /api/analyze error:", err);
    return res.status(500).json({
      ok: false,
      error: "Server error in /api/analyze",
      details: err?.message || String(err)
    });
  }
});

function detectComplexSections(text) {
  if (!text || text.length < 100) return [];
  
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const drops = [];
  
  const step = Math.max(3, Math.floor(sentences.length / 4));
  
  for (let i = step; i < sentences.length; i += step) {
    if (i < sentences.length - 2) {
      const context = sentences.slice(i - 1, i + 2).join('. ') + '.';
      
      const wordCount = context.split(/\s+/).length;
      const complexWords = (context.match(/[А-ЯA-Z]{3,}|\d+|[+\-*/=<>]/g) || []).length;
      const complexityScore = Math.min(5, Math.floor(wordCount / 20 + complexWords));
      
      if (complexityScore >= 2) {
        drops.push({
          id: drops.length + 1,
          position: `~${Math.round((i / sentences.length) * 100)}% урока`,
          text: context.substring(0, 120) + (context.length > 120 ? '...' : ''),
          complexity: complexityScore,
          time: `${Math.floor(i / 3)}:${((i % 3) * 20).toString().padStart(2, '0')}`
        });
      }
    }
  }
  
  if (drops.length === 0 && sentences.length > 5) {
    drops.push({
      id: 1,
      position: "~50% урока",
      text: sentences[Math.floor(sentences.length / 2)].substring(0, 100) + '...',
      complexity: 3,
      time: "15:30"
    });
  }
  
  return drops.slice(0, 3);
}

// ===========================
// Archive API
// ===========================
app.get("/api/archive/lessons", verifyTeacherToken, (req, res) => {
  try {
    // Чтение из localStorage симулируем через файл
    const archivePath = path.join(__dirname, 'data', 'archive.json');
    let lessons = [];
    
    if (fs.existsSync(archivePath)) {
      const data = fs.readFileSync(archivePath, 'utf8');
      lessons = JSON.parse(data);
    }
    
    // Фильтруем по учителю
    const teacherLessons = lessons.filter(lesson => 
      lesson.teacherId === req.teacher.id
    );
    
    res.json({ ok: true, lessons: teacherLessons });
  } catch (e) {
    console.error("Archive error:", e);
    res.json({ ok: true, lessons: [] });
  }
});

app.post("/api/archive/save", verifyTeacherToken, (req, res) => {
  try {
    const { lesson } = req.body;
    const archivePath = path.join(__dirname, 'data', 'archive.json');
    let lessons = [];
    
    if (fs.existsSync(archivePath)) {
      const data = fs.readFileSync(archivePath, 'utf8');
      lessons = JSON.parse(data);
    }
    
    // Добавляем ID учителя
    lesson.teacherId = req.teacher.id;
    lesson.savedAt = new Date().toISOString();
    lesson.id = `lesson_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    lessons.unshift(lesson);
    
    // Сохраняем обратно
    fs.writeFileSync(archivePath, JSON.stringify(lessons, null, 2));
    
    res.json({ ok: true, lessonId: lesson.id });
  } catch (e) {
    console.error("Save archive error:", e);
    res.status(500).json({ ok: false, error: "Failed to save lesson" });
  }
});

// ===========================
// Health check and routes
// ===========================
app.get("/api/health", (req, res) => {
  res.json({ 
    ok: true, 
    status: "running", 
    timestamp: new Date().toISOString(),
    students: telemetryStore.size,
    teachers: teachers.length,
    simulations: simulationStore.size
  });
});

// Создаем директорию для данных если нет
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Статические файлы
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));
app.get("/teacher", (req, res) => res.sendFile(path.join(__dirname, "public", "teacher.html")));
app.get("/archive", (req, res) => res.sendFile(path.join(__dirname, "public", "archive.html")));
app.get("/login", (req, res) => res.sendFile(path.join(__dirname, "public", "login.html")));

const port = Number(process.env.PORT || 5500);
app.listen(port, () => {
  console.log(`🚀 Server running on http://localhost:${port}`);
  console.log(`📚 Teacher dashboard: http://localhost:${port}/teacher`);
  console.log(`📁 Archive: http://localhost:${port}/archive`);
  console.log(`👥 Total students: ${telemetryStore.size}`);
  console.log(`💾 Simulations stored: ${simulationStore.size}`);
});