import { GoogleGenAI } from "@google/genai";
import express, { Request, Response } from "express";
import http from "http";
import { Server as SocketIOServer } from "socket.io";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { FIXED_SUBJECTS, Question, CommentReport, User, ScoreHistory, Subject, UserNotification, PublicComment, SubjectStructureConfig } from "./src/types.js";


// Ensure data directory exists
const DATA_DIR = path.join(process.cwd(), "data");
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_FILE = path.join(DATA_DIR, "db.json");

interface Database {
  questions: Question[];
  comments: CommentReport[];
  users: User[];
  scores: ScoreHistory[];
  notifications: UserNotification[];
  publicComments: PublicComment[];
  announcements?: any[];
  subjects?: string[];
  hiddenSubjects?: string[];
  subjectConfigs?: Record<string, SubjectStructureConfig>;
  systemWarning?: string;
  bannedWords?: string[];
  landingConfig?: {
    line1: string;
    line2: string;
  };
  systemControl?: {
    disableRegistration: boolean;
    registrationReason: string;
    disableLogin: boolean;
    loginReason: string;
    autoCloseLoginTime?: string | null;
    autoOpenLoginTime?: string | null;
  };
  generalSettings?: Record<string, string>;
  faqs?: Array<{ id: string; question: string; answer: string; createdAt?: string }>;
  examUploads?: Array<{
    id: string;
    fileName: string;
    fileType: string;
    fileSize: number;
    senderName: string;
    note: string;
    uploadedAt: string;
    filePath?: string;
    driveFileId?: string;
    driveWebViewLink?: string;
    driveStatus?: string;
  }>;
  adminGoogleDriveToken?: string | null;
}

export const DEFAULT_BANNED_WORDS: string[] = [
  // คำหยาบภาษาไทย
  "ควย", "เหี้ย", "เย็ด", "สัส", "สัด", "เหดียว", "ดอกทอง", "กวนส้นตีน", "ส้นตีน", 
  "ชาติชั่ว", "ระยำ", "จัญไร", "กู", "มึง", "หน้าตัวเมีย", "อีสัตว์", "ไอ้สัตว์", 
  "ห่า", "พ่องตาย", "แม่ง", "แรด", "ตอแหล", "เงี่ยน", "หี", "แตด", "หำ", 
  "ปี้", "เสือก", "กะหรี่", "ไอ้เหี้ย", "อีเหี้ย", "ควาย", "อีควาย", 
  "ไอ้ควาย", "หน้าควาย", "ชาติหมา", "หัวดอ", "กระดอ", "ชิหาย", "ฉิบหาย", 
  "ปัญญาอ่อน", "ดักดาน", "เสี้ยน", "หน้าเหี้ย", "อีดอก", "ไอ้สัส", "อีสัส",
  "เชี่ย", "ไอ้เชี่ย", "อีเชี่ย", "หน้าส้นตีน", "หัวควย", "เย็ดแม่", "เย็ดเข้",
  // English vulgar / profanity words
  "fuck", "fucker", "fucking", "shit", "bitch", "bastard", "dick", "pussy", 
  "asshole", "cunt", "cock", "slut", "whore", "nigger", "motherfucker"
];

export function checkProfanity(text: string, bannedWords: string[] = DEFAULT_BANNED_WORDS): { isProfane: boolean; foundWord?: string } {
  if (!text || typeof text !== "string") {
    return { isProfane: false };
  }

  const list = Array.isArray(bannedWords) && bannedWords.length > 0 ? bannedWords : DEFAULT_BANNED_WORDS;
  const normalized = text.toLowerCase().trim();
  const stripped = normalized.replace(/[\s\.\-_*+~`!@#$%^&()=[\]{}|;:'",<>/?\\0-9]/g, "");

  for (const rawWord of list) {
    if (!rawWord || typeof rawWord !== "string") continue;
    const word = rawWord.trim().toLowerCase();
    if (!word) continue;

    // Check 1: Direct containment in normalized text
    if (normalized.includes(word)) {
      return { isProfane: true, foundWord: rawWord };
    }

    // Check 2: Containment in stripped text (for spaced-out or symbol-separated words)
    const strippedWord = word.replace(/[\s\.\-_*+~`!@#$%^&()=[\]{}|;:'",<>/?\\0-9]/g, "");
    if (strippedWord.length >= 2 && stripped.includes(strippedWord)) {
      return { isProfane: true, foundWord: rawWord };
    }

    // Check 3: Word boundary / Regex matching
    try {
      const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`(^|\\b|\\s|\\W)${escaped}($|\\b|\\s|\\W)`, 'i');
      if (regex.test(normalized)) {
        return { isProfane: true, foundWord: rawWord };
      }
    } catch {
      // ignore regex error
    }
  }

  return { isProfane: false };
}

// Initial Database state
let db: Database = {
  questions: [],
  comments: [],
  users: [
    {
      username: "bank",
      role: "admin",
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString()
    }
  ],
  scores: [],
  notifications: [],
  publicComments: [],
  announcements: [],
  subjects: [...FIXED_SUBJECTS],
  hiddenSubjects: [],
  subjectConfigs: {},
  bannedWords: [...DEFAULT_BANNED_WORDS],
  landingConfig: {
    line1: "จัดทำโดย",
    line2: "เพจเล่าเรื่องจากห้องแล็บ"
  },
  systemControl: {
    disableRegistration: false,
    registrationReason: "",
    disableLogin: false,
    loginReason: ""
  },
  faqs: [
    { id: "1", question: "วิธีการใช้งานระบบสอบ MT EXAM ทำอย่างไร?", answer: "สามารถเลือกหมวดหมู่ข้อสอบที่ต้องการทำ ฝึกทำโจทย์ หรือสร้างห้องแข่งขันกับเพื่อนได้ทันทีหลังจากเข้าสู่ระบบ" },
    { id: "2", question: "ลืมรหัสผ่านต้องทำอย่างไร?", answer: "สามารถติดต่อแอดมินผ่านช่องทางติดต่อเพื่อขอรีเซ็ตรหัสผ่านได้อย่างรวดเร็ว" },
    { id: "3", question: "คะแนนและสถิติการทำข้อสอบถูกบันทึกไว้อย่างไร?", answer: "ระบบจะบันทึกประวัติการสอบ สถิติความแม่นยำ และคะแนนสะสมในระบบ Leaderboard โดยอัตโนมัติเมื่อเข้าสู่ระบบ" }
  ]
};

function getSubjects(): string[] {
  if (!db.subjects || !Array.isArray(db.subjects) || db.subjects.length === 0) {
    db.subjects = [...FIXED_SUBJECTS];
  }
  return db.subjects;
}

function getHiddenSubjects(): string[] {
  if (!db.hiddenSubjects || !Array.isArray(db.hiddenSubjects)) {
    db.hiddenSubjects = [];
  }
  return db.hiddenSubjects;
}

function getSubjectConfigs(): Record<string, SubjectStructureConfig> {
  if (!db.subjectConfigs || typeof db.subjectConfigs !== "object") {
    db.subjectConfigs = {};
  }
  const currentSubjects = getSubjects();
  currentSubjects.forEach((sub, idx) => {
    if (!db.subjectConfigs![sub]) {
      db.subjectConfigs![sub] = {
        morningCount: 20,
        afternoonCount: 20,
        morningOrder: idx + 1,
        afternoonOrder: idx + 1
      };
    }
  });
  return db.subjectConfigs!;
}

// Password store (separate from public user list for safety)
const passwords: Record<string, string> = {
  bank: "123456"
};

// Load database from file if exists
function loadDb() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const content = fs.readFileSync(DB_FILE, "utf-8");
      const loaded = JSON.parse(content);
      db = {
        questions: loaded.questions || [],
        comments: loaded.comments || [],
        users: loaded.users || [
          { username: "bank", role: "admin", createdAt: new Date().toISOString(), lastLoginAt: new Date().toISOString() }
        ],
        scores: loaded.scores || [],
        notifications: loaded.notifications || [],
        publicComments: loaded.publicComments || [],
        announcements: loaded.announcements || [],
        subjects: loaded.subjects && Array.isArray(loaded.subjects) && loaded.subjects.length > 0 ? loaded.subjects : [...FIXED_SUBJECTS],
        hiddenSubjects: loaded.hiddenSubjects && Array.isArray(loaded.hiddenSubjects) ? loaded.hiddenSubjects : [],
        subjectConfigs: loaded.subjectConfigs && typeof loaded.subjectConfigs === "object" ? loaded.subjectConfigs : {},
        bannedWords: loaded.bannedWords && Array.isArray(loaded.bannedWords) && loaded.bannedWords.length > 0 ? loaded.bannedWords : [...DEFAULT_BANNED_WORDS],
        systemWarning: loaded.systemWarning || "",
        landingConfig: loaded.landingConfig || { line1: "จัดทำโดย", line2: "เพจเล่าเรื่องจากห้องแล็บ" },
        systemControl: loaded.systemControl || { disableRegistration: false, registrationReason: "", disableLogin: false, loginReason: "" },
        generalSettings: loaded.generalSettings || {},
        faqs: loaded.faqs && Array.isArray(loaded.faqs) ? loaded.faqs : [],
        examUploads: loaded.examUploads && Array.isArray(loaded.examUploads) ? loaded.examUploads : [],
        adminGoogleDriveToken: loaded.adminGoogleDriveToken || null
      };
      if (loaded.passwords) {
        Object.assign(passwords, loaded.passwords);
      }
    }
  } catch (err) {
    console.error("Failed to load DB file, using default", err);
  }
}

// Save database to file
function saveDb() {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify({ ...db, passwords }, null, 2), "utf-8");
  } catch (err) {
    console.error("Failed to save DB file", err);
  }
}

// Password Complexity Validator
function validatePasswordComplexity(password: string): string | null {
  if (!password || password.length < 8) {
    return "รหัสผ่านต้องมีความยาวอย่างน้อย 8 ตัวอักษร";
  }
  if (!/[A-Z]/.test(password)) {
    return "รหัสผ่านต้องมีตัวอักษรภาษาอังกฤษพิมพ์ใหญ่ (A-Z) อย่างน้อย 1 ตัว";
  }
  if (!/[a-z]/.test(password)) {
    return "รหัสผ่านต้องมีตัวอักษรภาษาอังกฤษพิมพ์เล็ก (a-z) อย่างน้อย 1 ตัว";
  }
  if (!/[0-9]/.test(password)) {
    return "รหัสผ่านต้องมีตัวเลข (0-9) อย่างน้อย 1 ตัว";
  }
  return null;
}

// Username Complexity Validator (Min 5 chars, at least 1 uppercase, at least 1 lowercase, numbers allowed, NO special characters)
function validateUsernameComplexity(username: string): string | null {
  if (!username || typeof username !== "string" || !username.trim()) {
    return "กรุณาระบุชื่อผู้ใช้ (Username)";
  }
  const trimmed = username.trim();
  if (trimmed.length < 5) {
    return "ชื่อผู้ใช้ (Username) ต้องมีความยาวไม่ต่ำกว่า 5 ตัวอักษรขึ้นไป";
  }
  if (!/^[A-Za-z0-9]+$/.test(trimmed)) {
    return "ชื่อผู้ใช้ (Username) ต้องประกอบด้วยตัวอักษรภาษาอังกฤษและตัวเลขเท่านั้น ไม่อนุญาตให้ใช้อักษรพิเศษหรือช่องว่าง";
  }

  return null;
}

// Display Name Validator (Flexible casing/numbers, Thai/English/numbers/spaces allowed, NO special characters)
function validateDisplayNameComplexity(displayName: string): string | null {
  if (!displayName || typeof displayName !== "string" || !displayName.trim()) {
    return "กรุณาระบุชื่อที่แสดง (Display Name)";
  }
  const trimmed = displayName.trim();
  if (!/^[A-Za-z0-9\u0E00-\u0E7F\s]+$/.test(trimmed)) {
    return "ชื่อที่แสดง (Display Name) ไม่อนุญาตให้ใช้อักษรพิเศษหรือสัญลักษณ์ใดๆ";
  }
  return null;
}

// Active sessions map for Single-Session Enforcement
// activeSessions stores sessionId and lastSeen timestamp
const activeSessions = new Map<string, { sessionId: string, lastSeen: number }>();

function getNormalizedSessionKey(username: string): string {
  if (!username) return "";
  const trimmed = username.trim().toLowerCase();
  if (trimmed === "bank.sahapun@gmail.com" || trimmed === "bank" || trimmed === "admin") {
    return "bank";
  }
  return trimmed;
}

// Completely purge all user account & associated data from DB
function purgeUserDataCompletely(username: string): void {
  const key = getNormalizedSessionKey(username);
  activeSessions.delete(key);

  const targetLower = username.trim().toLowerCase();

  // 1. Remove from users list
  db.users = db.users.filter((u) => u.username.toLowerCase() !== targetLower);

  // 2. Remove passwords
  delete passwords[targetLower];
  Object.keys(passwords).forEach((k) => {
    if (k.toLowerCase() === targetLower) {
      delete passwords[k];
    }
  });

  // 3. Remove all exam score history
  db.scores = db.scores.filter((s) => s.username.toLowerCase() !== targetLower);

  // 4. Remove all error report comments
  db.comments = db.comments.filter((c) => c.username.toLowerCase() !== targetLower);

  // 5. Remove targeted user notifications
  if (db.notifications) {
    db.notifications = db.notifications.filter((n) => n.targetUser.toLowerCase() !== targetLower);
  }

  // 6. Remove public chat messages
  if (db.publicComments) {
    db.publicComments = db.publicComments.filter((pc) => pc.username.toLowerCase() !== targetLower);
  }

  saveDb();
}

loadDb();

async function autoRestoreFromCloud() {
  try {
    // Only attempt auto-restore if the local DB seems fresh/empty (e.g., questions <= 10)
    // To prevent overwriting active local changes during dev
    if (db.questions.length > 50) return;

    console.log("Local DB might be empty/fresh. Attempting to auto-restore from Firestore...");
    const configPath = path.join(process.cwd(), "firebase-applet-config.json");
    if (!fs.existsSync(configPath)) return;
    
    const FIREBASE_CONFIG = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    const projectId = FIREBASE_CONFIG.projectId;
    const dbId = FIREBASE_CONFIG.firestoreDatabaseId || "(default)";
    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${dbId}/documents/system/backup`;

    const response = await fetch(url);
    if (!response.ok) {
       console.log("No cloud backup found or unable to fetch.");
       return;
    }
    const json = await response.json();
    if (json.fields && json.fields.data && json.fields.data.stringValue) {
       const backupData = JSON.parse(json.fields.data.stringValue);
       
       if ((backupData.questions && backupData.questions.length > db.questions.length) || (backupData.faqs && backupData.faqs.length > (db.faqs ? db.faqs.length : 0))) {
         if (backupData.passwords) {
           Object.assign(passwords, backupData.passwords);
           delete backupData.passwords;
         }
         db = { ...db, ...backupData };
         if (!db.faqs || !Array.isArray(db.faqs)) {
           db.faqs = [];
         }
         saveDb();
         console.log("Auto-restore from Cloud successful! Recovered " + db.questions.length + " questions and " + db.faqs.length + " FAQs.");
       } else {
         console.log("Cloud backup has fewer or equal items. Skipping auto-restore.");
       }
    }
  } catch (err) {
    console.error("Auto-restore failed:", err);
  }
}

autoRestoreFromCloud();

// SSE Connected Clients for Real-time Sync
const sseClients: Response[] = [];

function broadcastEvent(eventType: string, data: any) {
  const payload = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
  sseClients.forEach((client) => {
    try {
      client.write(payload);
    } catch (e) {
      // client disconnected
    }
  });
}

// ----------------------------------------------------
// BACKGROUND SECURITY & DEFENSE ENGINE (เบื้องหลัง)
// ----------------------------------------------------
interface SecurityMetrics {
  startTime: number;
  blockedBruteForceCount: number;
  sanitizedAttacksCount: number;
  autoHealingCycles: number;
  lastAutoHealingAt: string;
  threatsDetected: { type: string; details: string; timestamp: string; ip?: string }[];
}

const securityMetrics: SecurityMetrics = {
  startTime: Date.now(),
  blockedBruteForceCount: 0,
  sanitizedAttacksCount: 0,
  autoHealingCycles: 0,
  lastAutoHealingAt: new Date().toISOString(),
  threatsDetected: []
};

function logSecurityEvent(type: string, details: string, ip?: string) {
  securityMetrics.threatsDetected.unshift({
    type,
    details,
    timestamp: new Date().toISOString(),
    ip
  });
  if (securityMetrics.threatsDetected.length > 50) {
    securityMetrics.threatsDetected.pop();
  }
}

// 1. Recursive Input Sanitizer (Prevents XSS, Script Injection & Prototype Pollution)
function sanitizeStringValue(str: string): string {
  if (typeof str !== "string") return str;
  let clean = str;

  const hasScriptTag = /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi.test(clean);
  const hasJsProtocol = /javascript\s*:/gi.test(clean);
  const hasEventHandlers = /\bon\w+\s*=/gi.test(clean);
  const hasDangerousTags = /<(iframe|embed|object|applet)\b/gi.test(clean);

  if (hasScriptTag || hasJsProtocol || hasEventHandlers || hasDangerousTags) {
    securityMetrics.sanitizedAttacksCount++;
    logSecurityEvent("XSS_PAYLOAD_NEUTRALIZED", `Neutralized dangerous pattern in input: ${str.slice(0, 40)}...`);
  }

  clean = clean
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/javascript\s*:/gi, "")
    .replace(/<(iframe|embed|object|applet)\b[^>]*>.*?<\/\1>/gi, "")
    .replace(/<(iframe|embed|object|applet)\b[^>]*>/gi, "")
    .replace(/\bon\w+\s*=\s*(['"]).*?\1/gi, "")
    .replace(/\bon\w+\s*=\s*[^ >]+/gi, "");

  return clean;
}

function deepSanitize(target: any): any {
  if (target === null || target === undefined) return target;
  if (typeof target === "string") {
    return sanitizeStringValue(target);
  }
  if (Array.isArray(target)) {
    return target.map((item) => deepSanitize(item));
  }
  if (typeof target === "object") {
    const cleanedObj: Record<string, any> = {};
    for (const [key, value] of Object.entries(target)) {
      if (key === "__proto__" || key === "constructor" || key === "prototype") {
        securityMetrics.sanitizedAttacksCount++;
        logSecurityEvent("PROTOTYPE_POLLUTION_BLOCKED", `Blocked prototype pollution key: ${key}`);
        continue;
      }
      cleanedObj[key] = deepSanitize(value);
    }
    return cleanedObj;
  }
  return target;
}

// 2. Sliding Window Rate Limiter (Anti-Brute Force & Anti-Spam)
interface RateLimitBucket {
  count: number;
  resetAt: number;
  lastMessage?: string;
  lastMessageAt?: number;
}

const rateLimitBuckets = new Map<string, RateLimitBucket>();

function checkRateLimit(key: string, limit: number, windowMs: number): { allowed: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  const bucket = rateLimitBuckets.get(key);

  if (!bucket || now > bucket.resetAt) {
    rateLimitBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  bucket.count++;
  if (bucket.count > limit) {
    const retryAfterSeconds = Math.ceil((bucket.resetAt - now) / 1000);
    return { allowed: false, retryAfterSeconds };
  }

  return { allowed: true, retryAfterSeconds: 0 };
}

// 3. Background Auto-Healing & Database Integrity Guardian
function runBackgroundAutoHealing() {
  let healed = false;
  securityMetrics.autoHealingCycles++;
  securityMetrics.lastAutoHealingAt = new Date().toISOString();

  // A. Super Admin Account Armor (Guarantees bank admin & bank.sahapun@gmail.com always exist and are valid)
  const adminBank = db.users.find((u) => u.username.toLowerCase() === "bank");
  if (!adminBank) {
    db.users.unshift({
      username: "bank",
      role: "admin",
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString()
    });
    passwords["bank"] = passwords["bank"] || "123456";
    healed = true;
    logSecurityEvent("AUTO_HEAL_SUPER_ADMIN", "Restored primary admin 'bank' account");
  } else {
    if (adminBank.role !== "admin") {
      adminBank.role = "admin";
      healed = true;
    }
    if (!passwords["bank"]) {
      passwords["bank"] = "123456";
      healed = true;
    }
  }

  const adminEmail = db.users.find((u) => u.username.toLowerCase() === "bank.sahapun@gmail.com");
  if (!adminEmail) {
    db.users.unshift({
      username: "bank.sahapun@gmail.com",
      role: "admin",
      displayName: "Bank Sahapun",
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString()
    });
    passwords["bank.sahapun@gmail.com"] = passwords["bank"] || "123456";
    healed = true;
  } else {
    if (adminEmail.role !== "admin") {
      adminEmail.role = "admin";
      healed = true;
    }
    // Keep bank.sahapun@gmail.com password in sync with bank password
    if (passwords["bank"] && passwords["bank.sahapun@gmail.com"] !== passwords["bank"]) {
      passwords["bank.sahapun@gmail.com"] = passwords["bank"];
      healed = true;
    }
  }

  // B. Question bank structural integrity
  if (Array.isArray(db.questions)) {
    const seenIds = new Set<string>();
    const validQuestions: Question[] = [];
    db.questions.forEach((q, index) => {
      if (!q || typeof q !== "object") return;
      let qId = q.id || `q_auto_${Date.now()}_${index}`;
      if (seenIds.has(qId)) {
        qId = `${qId}_dup_${index}`;
        q.id = qId;
        healed = true;
      }
      seenIds.add(qId);

      if (!Array.isArray(q.options) || q.options.length !== 5) {
        q.options = ["ตัวเลือกที่ 1", "ตัวเลือกที่ 2", "ตัวเลือกที่ 3", "ตัวเลือกที่ 4", "ตัวเลือกที่ 5"];
        healed = true;
      }
      if (typeof q.correctAnswer !== "number" || q.correctAnswer < 0 || q.correctAnswer >= q.options.length) {
        q.correctAnswer = 0;
        healed = true;
      }
      validQuestions.push(q);
    });
    if (validQuestions.length !== db.questions.length) {
      db.questions = validQuestions;
      healed = true;
    }
  }

  // C. Score percentage integrity
  if (Array.isArray(db.scores)) {
    db.scores.forEach((s) => {
      if (typeof s.percentage !== "number" || isNaN(s.percentage)) {
        s.percentage = s.totalAttempted > 0 ? Math.round((s.totalCorrect / s.totalAttempted) * 100) : 0;
        healed = true;
      }
    });
  }

  // D. Memory Bounds Protection
  if (Array.isArray(db.publicComments) && db.publicComments.length > 300) {
    db.publicComments = db.publicComments.slice(0, 300);
    healed = true;
  }
  if (Array.isArray(db.notifications) && db.notifications.length > 500) {
    db.notifications = db.notifications.slice(-500);
    healed = true;
  }

  // D2. FAQ Bank structural integrity
  if (!db.faqs || !Array.isArray(db.faqs)) {
    db.faqs = [];
    healed = true;
  } else {
    db.faqs.forEach((f, index) => {
      if (!f || typeof f !== "object") return;
      if (!f.id) {
        f.id = `faq_auto_${Date.now()}_${index}`;
        healed = true;
      }
      if (typeof f.question !== "string") {
        f.question = "";
        healed = true;
      }
      if (typeof f.answer !== "string") {
        f.answer = "";
        healed = true;
      }
    });
  }

  // E. Atomic Database Backup Snapshot
  try {
    const BACKUP_FILE = path.join(DATA_DIR, "db.backup.json");
    fs.writeFileSync(BACKUP_FILE, JSON.stringify({ ...db, passwords }, null, 2), "utf-8");
  } catch (e) {
    // backup write warning
  }

  if (healed) {
    saveDb();
  }
}

// Run auto-healing immediately on startup, then every 60 seconds
runBackgroundAutoHealing();
setInterval(runBackgroundAutoHealing, 60000);

const DEFAULT_SYSTEM_WARNING = "ข้อควรระวัง: ข้อสอบชุดนี้เป็นแนวข้อสอบที่รวบรวมจากการจำโดยนักศึกษา ซึ่งอาจมีความคลาดเคลื่อนของเนื้อหา ตัวเลือก หรือเฉลยได้ หากผู้ใช้งานพบข้อผิดพลาด กรุณาใช้ระบบช่องคอมเมนต์ที่แนบไว้กับข้อสอบแต่ละข้อ เพื่อแจ้งเตือนผู้ดูแลระบบให้ดำเนินการตรวจสอบและแก้ไขข้อมูลให้ถูกต้องต่อไป";


function checkAutoLoginSystem() {
  if (!db.systemControl) return;
  const now = new Date();
  let updated = false;

  if (db.systemControl.autoCloseLoginTime) {
    const closeTime = new Date(db.systemControl.autoCloseLoginTime);
    if (now >= closeTime && !db.systemControl.disableLogin) {
      db.systemControl.disableLogin = true;
      updated = true;
      console.log("[System] Auto-closing login system at ", now.toISOString());
    }
  }

  if (db.systemControl.autoOpenLoginTime) {
    const openTime = new Date(db.systemControl.autoOpenLoginTime);
    if (now >= openTime && db.systemControl.disableLogin) {
      db.systemControl.disableLogin = false;
      // Also clear the autoOpen and autoClose if they passed to prevent loop
      db.systemControl.autoCloseLoginTime = null;
      db.systemControl.autoOpenLoginTime = null;
      updated = true;
      console.log("[System] Auto-opening login system at ", now.toISOString());
    }
  }

  if (updated) {
    saveDb();
    broadcastEvent("system_control_updated", db.systemControl);
  }
}
setInterval(checkAutoLoginSystem, 15000);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Mobile & Cross-Origin Friendly Headers & CORS Preflight Handling
  app.use((req: Request, res: Response, next) => {
    const origin = req.headers.origin;
    if (origin) {
      res.setHeader("Access-Control-Allow-Origin", origin);
    } else {
      res.setHeader("Access-Control-Allow-Origin", "*");
    }
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, PATCH");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, Accept, Origin");
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-XSS-Protection", "1; mode=block");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");

    if (req.method === "OPTIONS") {
      return res.status(200).end();
    }
    next();
  });

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // Background Defense: Automated Recursive Input Sanitization & Prototype Pollution Shield
  app.use((req: Request, res: Response, next) => {
    if (req.body && typeof req.body === 'object') {
      req.body = deepSanitize(req.body);
    }
    if (req.query && typeof req.query === 'object') {
      req.query = deepSanitize(req.query);
    }
    next();
  });

  // Background Defense: Global API Flood Shield (150 requests per 10s window per IP)
  app.use("/api", (req: Request, res: Response, next) => {
    if (req.path === "/events") return next(); // Exclude long-lived SSE connection
    const clientIp = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.ip || "unknown_ip";
    const floodCheck = checkRateLimit(`global_flood_${clientIp}`, 150, 10000);
    if (!floodCheck.allowed) {
      logSecurityEvent("GLOBAL_FLOOD_BLOCKED", `Client IP exceeded API rate threshold (150 req/10s)`, clientIp);
      return res.status(429).json({
        error: `ระบบจำกัดความถี่คำขอความปลอดภัย กรุณารอสักครู่ (${floodCheck.retryAfterSeconds} วินาที)`
      });
    }
    next();
  });

  // ----------------------------------------------------
  // REAL-TIME SSE ENDPOINT
  // ----------------------------------------------------
  app.get("/api/events", (req: Request, res: Response) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    sseClients.push(res);

    req.on("close", () => {
      const idx = sseClients.indexOf(res);
      if (idx !== -1) sseClients.splice(idx, 1);
    });
  });

  // ----------------------------------------------------
  // SUBJECTS MANAGEMENT ENDPOINTS
  // ----------------------------------------------------
  app.get("/api/subjects", (req: Request, res: Response) => {
    res.json({
      subjects: getSubjects(),
      hiddenSubjects: getHiddenSubjects(),
      subjectConfigs: getSubjectConfigs()
    });
  });

  app.put("/api/subjects/structure", (req: Request, res: Response) => {
    const { subjectConfigs } = req.body;
    if (!subjectConfigs || typeof subjectConfigs !== "object") {
      return res.status(400).json({ error: "ข้อมูลโครงสร้างข้อสอบไม่ถูกต้อง" });
    }

    db.subjectConfigs = subjectConfigs;
    saveDb();

    broadcastEvent("subjects_updated", {
      subjects: getSubjects(),
      hiddenSubjects: getHiddenSubjects(),
      subjectConfigs: db.subjectConfigs
    });

    res.json({
      success: true,
      message: "บันทึกโครงสร้างและลำดับข้อสอบภาคเช้า/ภาคบ่าย เรียบร้อยแล้ว",
      subjects: getSubjects(),
      hiddenSubjects: getHiddenSubjects(),
      subjectConfigs: db.subjectConfigs
    });
  });

  app.put("/api/subjects/rename", (req: Request, res: Response) => {
    const { oldSubject, newSubject } = req.body;
    if (!oldSubject || !newSubject) {
      return res.status(400).json({ error: "กรุณาระบุชื่อวิชาเดิมและชื่อวิชาใหม่" });
    }
    const trimmedOld = oldSubject.trim();
    const trimmedNew = newSubject.trim();

    if (!trimmedNew) {
      return res.status(400).json({ error: "ชื่อวิชาใหม่ต้องไม่เป็นค่าว่าง" });
    }

    const currentSubjects = getSubjects();
    const index = currentSubjects.indexOf(trimmedOld);
    if (index === -1) {
      return res.status(404).json({ error: "ไม่พบรายวิชาที่ต้องการเปลี่ยนชื่อ" });
    }

    if (trimmedOld !== trimmedNew && currentSubjects.includes(trimmedNew)) {
      return res.status(400).json({ error: "มีชื่อวิชานี้อยู่ในระบบแล้ว" });
    }

    // 1. Rename in subjects list
    currentSubjects[index] = trimmedNew;
    db.subjects = currentSubjects;

    // 2. Rename in hiddenSubjects if present
    db.hiddenSubjects = getHiddenSubjects().map((s) => (s === trimmedOld ? trimmedNew : s));

    // 3. Rename in subjectConfigs
    const configs = getSubjectConfigs();
    if (configs[trimmedOld]) {
      configs[trimmedNew] = configs[trimmedOld];
      delete configs[trimmedOld];
      db.subjectConfigs = configs;
    }

    // 4. Cascade rename in db.questions
    let updatedQuestionsCount = 0;
    db.questions.forEach((q) => {
      if (q.subject === trimmedOld) {
        q.subject = trimmedNew;
        updatedQuestionsCount++;
      }
    });

    // 5. Cascade rename in db.comments
    db.comments.forEach((c) => {
      if (c.subject === trimmedOld) {
        c.subject = trimmedNew;
      }
    });

    // 6. Cascade rename in db.scores
    db.scores.forEach((s) => {
      if (s.subject === trimmedOld) {
        s.subject = trimmedNew;
      }
    });

    saveDb();

    // Broadcast SSE event
    broadcastEvent("subjects_renamed", {
      oldSubject: trimmedOld,
      newSubject: trimmedNew,
      subjects: db.subjects,
      hiddenSubjects: db.hiddenSubjects,
      subjectConfigs: getSubjectConfigs()
    });

    res.json({
      success: true,
      message: `เปลี่ยนชื่อวิชาจาก "${trimmedOld}" เป็น "${trimmedNew}" เรียบร้อยแล้ว (อัปเดตข้อสอบ ${updatedQuestionsCount} ข้อ)`,
      subjects: db.subjects,
      hiddenSubjects: db.hiddenSubjects,
      subjectConfigs: getSubjectConfigs(),
      updatedQuestionsCount
    });
  });

  app.post("/api/subjects", (req: Request, res: Response) => {
    const { subjectName } = req.body;
    if (!subjectName || !subjectName.trim()) {
      return res.status(400).json({ error: "กรุณาระบุชื่อวิชาใหม่" });
    }
    const name = subjectName.trim();
    const currentSubjects = getSubjects();

    if (currentSubjects.includes(name)) {
      return res.status(400).json({ error: "มีชื่อวิชานี้อยู่ในระบบแล้ว" });
    }

    currentSubjects.push(name);
    db.subjects = currentSubjects;

    const configs = getSubjectConfigs();
    configs[name] = {
      morningCount: 20,
      afternoonCount: 20,
      morningOrder: currentSubjects.length,
      afternoonOrder: currentSubjects.length
    };
    db.subjectConfigs = configs;

    saveDb();

    broadcastEvent("subjects_updated", {
      subjects: db.subjects,
      hiddenSubjects: getHiddenSubjects(),
      subjectConfigs: getSubjectConfigs()
    });

    res.status(201).json({
      success: true,
      message: `เพิ่มรายวิชา "${name}" เรียบร้อยแล้ว`,
      subjects: db.subjects,
      hiddenSubjects: getHiddenSubjects(),
      subjectConfigs: getSubjectConfigs()
    });
  });

  app.put("/api/subjects/toggle-hide", (req: Request, res: Response) => {
    const { subjectName } = req.body;
    if (!subjectName || !subjectName.trim()) {
      return res.status(400).json({ error: "กรุณาระบุชื่อวิชาที่ต้องการปรับสถานะ" });
    }
    const name = subjectName.trim();
    const currentSubjects = getSubjects();

    if (!currentSubjects.includes(name)) {
      return res.status(404).json({ error: "ไม่พบวิชานี้ในระบบ" });
    }

    const hiddenList = getHiddenSubjects();
    const isCurrentlyHidden = hiddenList.includes(name);

    if (isCurrentlyHidden) {
      db.hiddenSubjects = hiddenList.filter((s) => s !== name);
    } else {
      db.hiddenSubjects = [...hiddenList, name];
    }

    saveDb();

    const isHiddenNow = !isCurrentlyHidden;

    broadcastEvent("subjects_updated", {
      subjects: db.subjects,
      hiddenSubjects: db.hiddenSubjects,
      subjectConfigs: getSubjectConfigs()
    });

    res.json({
      success: true,
      isHidden: isHiddenNow,
      message: isHiddenNow
        ? `ซ่อนวิชา "${name}" จากผู้ใช้งานทั่วไปแล้ว`
        : `ยกเลิกการซ่อนวิชา "${name}" แล้ว (เปิดให้ผู้ใช้งานทำข้อสอบได้)`,
      subjects: db.subjects,
      hiddenSubjects: db.hiddenSubjects,
      subjectConfigs: getSubjectConfigs()
    });
  });

  app.delete("/api/subjects/:subjectName", (req: Request, res: Response) => {
    const { subjectName } = req.params;
    if (!subjectName) {
      return res.status(400).json({ error: "กรุณาระบุชื่อวิชาที่ต้องการลบ" });
    }
    const name = decodeURIComponent(subjectName).trim();
    const currentSubjects = getSubjects();
    const index = currentSubjects.indexOf(name);

    if (index === -1) {
      return res.status(404).json({ error: "ไม่พบวิชาที่ต้องการลบในระบบ" });
    }

    // 1. Remove from subjects list
    currentSubjects.splice(index, 1);
    db.subjects = currentSubjects;

    // 2. Remove from hiddenSubjects
    db.hiddenSubjects = getHiddenSubjects().filter((s) => s !== name);

    // 3. Remove from subjectConfigs
    if (db.subjectConfigs && db.subjectConfigs[name]) {
      delete db.subjectConfigs[name];
    }

    // 4. Delete questions associated with this subject
    const initialQCount = db.questions.length;
    db.questions = db.questions.filter((q) => q.subject !== name);
    const deletedQCount = initialQCount - db.questions.length;

    // 5. Delete comments associated with this subject
    db.comments = db.comments.filter((c) => c.subject !== name);

    saveDb();

    broadcastEvent("subjects_updated", {
      subjects: db.subjects,
      hiddenSubjects: db.hiddenSubjects,
      subjectConfigs: getSubjectConfigs()
    });

    res.json({
      success: true,
      message: `ลบวิชา "${name}" เรียบร้อยแล้ว (ลบข้อสอบในวิชานี้ออก ${deletedQCount} ข้อ)`,
      subjects: db.subjects,
      hiddenSubjects: db.hiddenSubjects,
      subjectConfigs: getSubjectConfigs(),
      deletedQCount
    });
  });

  // ----------------------------------------------------
  // SYSTEM WARNING & INFO
  // ----------------------------------------------------
  app.put("/api/system/warning", (req: Request, res: Response) => {
    const requester = (req.headers["x-requester"] as string) || "";
    const user = db.users.find((u) => u.username.toLowerCase() === requester.toLowerCase());
    if (!user || user.role !== "admin") return res.status(403).json({ error: "Forbidden" });
    const { warning } = req.body;
    db.systemWarning = warning;
    saveDb();
    res.json({ success: true });
  });

  app.get("/api/system/warning", (req: Request, res: Response) => {
    res.json({ warning: db.systemWarning || DEFAULT_SYSTEM_WARNING, subjects: getSubjects() });
  });

  app.get("/api/stats", (req: Request, res: Response) => {
    const questionsBySubject: Record<string, number> = {};
    getSubjects().forEach((sub) => {
      questionsBySubject[sub] = db.questions.filter((q) => q.subject === sub).length;
    });

    res.json({
      totalQuestions: db.questions.length,
      questionsBySubject,
      totalUsers: db.users.length,
      totalComments: db.comments.length,
      pendingComments: db.comments.filter((c) => c.status === "pending").length
    });
  });

  // ----------------------------------------------------
  // BACKGROUND SECURITY & DEFENSE ENGINE STATUS
  // ----------------------------------------------------
  app.get("/api/admin/security-status", (req: Request, res: Response) => {
    res.json({
      engineStatus: "ACTIVE",
      uptimeSeconds: Math.floor(process.uptime()),
      blockedBruteForceCount: securityMetrics.blockedBruteForceCount,
      sanitizedAttacksCount: securityMetrics.sanitizedAttacksCount,
      autoHealingCycles: securityMetrics.autoHealingCycles,
      lastAutoHealingAt: securityMetrics.lastAutoHealingAt,
      recentThreats: securityMetrics.threatsDetected.slice(0, 10),
      dbIntegrity: {
        status: "HEALTHY",
        totalQuestions: db.questions.length,
        totalUsers: db.users.length,
        totalScores: db.scores.length,
        activeSessionsCount: activeSessions.size,
        sseConnectedCount: sseClients.length
      },
      activeDefenseLayers: [
        { name: "Anti-Brute Force Rate Limiter", status: "ONLINE", icon: "Lock" },
        { name: "Deep XSS & Injection Shield", status: "ONLINE", icon: "ShieldCheck" },
        { name: "Single-Session Guard", status: "ONLINE", icon: "Users" },
        { name: "Background Auto-Healing Guardian", status: "ONLINE", interval: "60s" },
        { name: "Super Admin Permanent Armor", status: "ONLINE", target: "bank" },
        { name: "Real-time SSE Event Monitor", status: "ONLINE", activeClients: sseClients.length }
      ]
    });
  });

  app.post("/api/admin/security-heal-now", (req: Request, res: Response) => {
    runBackgroundAutoHealing();
    res.json({
      success: true,
      message: "ดำเนินการตรวจสอบความสมบูรณ์และซ่อมแซมฐานข้อมูลเบื้องหลังสำเร็จ",
      lastAutoHealingAt: securityMetrics.lastAutoHealingAt,
      autoHealingCycles: securityMetrics.autoHealingCycles
    });
  });

  // ----------------------------------------------------
  // QUESTIONS CRUD (Unified Cloud Store & Hard Delete)
  // ----------------------------------------------------
  app.get("/api/questions", (req: Request, res: Response) => {
    const subject = req.query.subject as string | undefined;

    const shuffleQuestionOptions = (q: Question) => {
      if (!q.options || q.options.length <= 1) return q;
      
      let opts = [];
      let isDerangement = false;
      let attempts = 0;
      
      // Try to find a derangement (no element in original position)
      while (!isDerangement && attempts < 20) {
        opts = q.options.map((opt: string, idx: number) => ({ opt, idx }));
        for (let i = opts.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [opts[i], opts[j]] = [opts[j], opts[i]];
        }
        
        isDerangement = true;
        for (let i = 0; i < opts.length; i++) {
          if (opts[i].idx === i) {
            isDerangement = false;
            break;
          }
        }
        attempts++;
      }
      
      const newCorrect = opts.findIndex((o: any) => o.idx === q.correctAnswer);
      return {
        ...q,
        options: opts.map((o: any) => o.opt),
        correctAnswer: newCorrect !== -1 ? newCorrect : q.correctAnswer
      };
    };

    if (subject && subject !== "ALL") {
      const filtered = db.questions.filter((q) => q.subject === subject).map(shuffleQuestionOptions);
      return res.json(filtered);
    }
    res.json(db.questions.map(shuffleQuestionOptions));
  });

  app.post("/api/questions", (req: Request, res: Response) => {
    const { subject, question, options, correctAnswer, createdBy, status } = req.body;

    if (!getSubjects().includes(subject)) {
      return res.status(400).json({ error: "วิชาต้องอยู่ในรายวิชาของระบบเท่านั้น" });
    }

    if (!question || !Array.isArray(options) || options.length !== 5 || typeof correctAnswer !== "number") {
      return res.status(400).json({ error: "ข้อมูลข้อสอบไม่ครบถ้วน (ต้องมีโจทย์, ตัวเลือก 5 ข้อ, และเฉลย)" });
    }

    const newQuestion: Question = {
      id: "q_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7),
      subject: subject as Subject,
      question: question.trim(),
      options: options.map((opt: string) => opt.trim()) as [string, string, string, string, string],
      correctAnswer,
      createdAt: new Date().toISOString(),
      createdBy: createdBy || "admin",
      status: status || "approved"
    };

    db.questions.push(newQuestion);
    saveDb();
    broadcastEvent("question_added", newQuestion);

    res.status(201).json(newQuestion);
  });

  app.put("/api/questions/:id", (req: Request, res: Response) => {
    const { id } = req.params;
    const { subject, question, options, correctAnswer, status } = req.body;

    const idx = db.questions.findIndex((q) => q.id === id);
    if (idx === -1) {
      return res.status(404).json({ error: "ไม่พบข้อสอบที่ต้องการแก้ไข" });
    }

    if (subject && !getSubjects().includes(subject)) {
      return res.status(400).json({ error: "วิชาต้องอยู่ในรายวิชาของระบบเท่านั้น" });
    }

    const current = db.questions[idx];
    const updated: Question = {
      ...current,
      status: status || current.status || "approved",
      subject: (subject as Subject) || current.subject,
      question: question !== undefined ? question.trim() : current.question,
      options: Array.isArray(options) && options.length === 5 ? (options.map((o) => o.trim()) as [string, string, string, string, string]) : current.options,
      correctAnswer: typeof correctAnswer === "number" ? correctAnswer : current.correctAnswer
    };

    db.questions[idx] = updated;
    saveDb();
    broadcastEvent("question_updated", updated);

    res.json(updated);
  });

  // Hard Delete / Clear All Questions (Must be defined BEFORE /:id)
  app.delete("/api/questions/all/clear", (req: Request, res: Response) => {
    db.questions = [];
    saveDb();
    broadcastEvent("bank_cleared", {});
    res.json({ message: "ล้างข้อสอบในคลังเรียบร้อยแล้ว (Hard Delete All)" });
  });

  // Hard Delete: Permanent removal from cloud
  app.delete("/api/questions/:id", (req: Request, res: Response) => {
    const { id } = req.params;
    const targetId = id.trim();
    const initialLength = db.questions.length;
    db.questions = db.questions.filter((q) => q.id.trim() !== targetId);

    if (db.questions.length === initialLength) {
      return res.status(404).json({ error: "ไม่พบข้อสอบ ID นี้ในคลาวด์" });
    }

    saveDb();
    broadcastEvent("question_deleted", { id: targetId });
    res.json({ success: true, message: "ลบข้อสอบออกจากคลาวด์ถาวรแล้ว (Hard Delete)" });
  });


  // ----------------------------------------------------
  // GENERAL SETTINGS MANAGEMENT
  // ----------------------------------------------------
  app.get("/api/admin/general-settings", (req: Request, res: Response) => {
    res.json(db.generalSettings || {});
  });

  app.post("/api/admin/general-settings", (req: Request, res: Response) => {
    db.generalSettings = req.body;
    saveDb();
    broadcastEvent("general_settings_updated", db.generalSettings);
    res.json(db.generalSettings);
  });

  // ----------------------------------------------------
  // ADMIN USER MANAGEMENT
  // ----------------------------------------------------
  app.get("/api/admin/users", (req: Request, res: Response) => {
    res.json(db.users);
  });

  app.delete("/api/admin/users/:username", (req: Request, res: Response) => {
    const { username } = req.params;
    const requester = (req.headers["x-requester"] as string) || "";
    if (username.toLowerCase() === 'bank') {
      return res.status(403).json({ error: "ไม่สามารถลบ Super Admin ได้" });
    }
    if (requester && requester.toLowerCase() !== 'bank') {
      return res.status(403).json({ error: "เฉพาะแอดมินหลัก (Super Admin) เท่านั้นที่สามารถลบผู้ใช้งานได้" });
    }
    purgeUserDataCompletely(username);
    broadcastEvent("user_deleted", { username: username.toLowerCase() });
    res.json({ success: true, message: "ลบผู้ใช้งานและข้อมูลทั้งหมดที่เกี่ยวข้องเรียบร้อยแล้ว" });
  });

  app.post("/api/admin/users", (req: Request, res: Response) => {
    const { username, password, role } = req.body;
    if (!username || !password || username.trim().length < 2) {
      return res.status(400).json({ error: "ข้อมูลผู้ใช้ไม่ถูกต้อง" });
    }
    const passErr = validatePasswordComplexity(password);
    if (passErr) {
      return res.status(400).json({ error: passErr });
    }
    if (db.users.find(u => u.username.toLowerCase() === username.toLowerCase())) {
      return res.status(400).json({ error: "ชื่อผู้ใช้นี้มีในระบบแล้ว" });
    }
    
    db.users.push({
      username: username.trim(),
      role: role === 'admin' ? 'admin' : 'user',
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString()
    });
    passwords[username.trim()] = password;
    saveDb();
    res.json({ success: true });
  });

  // ----------------------------------------------------
  // PUBLIC COMMENTS DELETE
  // ----------------------------------------------------
  app.delete("/api/public-comments/:id", (req: Request, res: Response) => {
    const { id } = req.params;
    if (db.publicComments) {
      db.publicComments = db.publicComments.filter(c => c.id !== id);
      saveDb();
      broadcastEvent("public_comment_deleted", { id });
    }
    res.json({ success: true });
  });

  // ----------------------------------------------------
  // LANDING CONFIG & SYSTEM CONTROL
  // ----------------------------------------------------
  app.get("/api/landing-config", (req: Request, res: Response) => {
    res.json(db.landingConfig || { line1: "จัดทำโดย", line2: "เพจเล่าเรื่องจากห้องแล็บ" });
  });

  app.post("/api/admin/landing-config", (req: Request, res: Response) => {
    const { line1, line2 } = req.body;
    if (typeof line1 !== "string" || typeof line2 !== "string") {
      return res.status(400).json({ error: "ข้อมูลข้อความไม่ถูกต้อง" });
    }
    db.landingConfig = { line1: line1.trim(), line2: line2.trim() };
    saveDb();
    broadcastEvent("landing_config_updated", db.landingConfig);
    res.json(db.landingConfig);
  });

  app.get("/api/system-control", (req: Request, res: Response) => {
    res.json(db.systemControl || { disableRegistration: false, registrationReason: "", disableLogin: false, loginReason: "", autoCloseLoginTime: null, autoOpenLoginTime: null });
  });

  app.post("/api/admin/system-control", (req: Request, res: Response) => {
    const { disableRegistration, registrationReason, disableLogin, loginReason, autoCloseLoginTime, autoOpenLoginTime } = req.body;
    db.systemControl = {
      disableRegistration: !!disableRegistration,
      registrationReason: typeof registrationReason === "string" ? registrationReason.trim() : "",
      disableLogin: !!disableLogin,
      loginReason: typeof loginReason === "string" ? loginReason.trim() : "",
      autoCloseLoginTime: autoCloseLoginTime || null,
      autoOpenLoginTime: autoOpenLoginTime || null
    };
    saveDb();
    broadcastEvent("system_control_updated", db.systemControl);
    res.json(db.systemControl);
  });

  // ----------------------------------------------------
  // AUTHENTICATION & USERS (Admin & Member Credentials)
  // ----------------------------------------------------
  app.post("/api/auth/login", (req: Request, res: Response) => {
    const { username, password, force, loginMode, sessionId: clientSessionId } = req.body;
    const clientIp = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.ip || "unknown_ip";

    if (!username || !password) {
      return res.status(400).json({ error: "กรุณาระบุ Username และ Password" });
    }

    const trimmedUser = username.trim();

    // Background Defense: Anti-Brute Force Protection (Max 20 attempts per 60s per user/IP)
    const rateCheck = checkRateLimit(`login_${clientIp}_${trimmedUser}`, 20, 60000);
    if (!rateCheck.allowed) {
      securityMetrics.blockedBruteForceCount++;
      logSecurityEvent("BRUTE_FORCE_BLOCKED", `Exceeded login limit for user: ${trimmedUser}`, clientIp);
      return res.status(429).json({
        error: `ตรวจพบการพยายามเข้าสู่ระบบถี่เกินไป เพื่อความปลอดภัยกรุณารอสักครู่ (${rateCheck.retryAfterSeconds} วินาที)`
      });
    }

    // Username Matching (Strict)
    const existingUser = db.users.find((u) => u.username === trimmedUser);
    const isAdminAccount = existingUser && existingUser.role === "admin";
    const isSystemAdminAlias = trimmedUser === "bank" || trimmedUser === "admin" || trimmedUser === "bank.sahapun@gmail.com";

    if (db.systemControl?.disableLogin && !isAdminAccount) {
      const reason = db.systemControl.loginReason || "ระบบเข้าสู่ระบบถูกปิดใช้งานในขณะนี้";
      return res.status(403).json({ error: reason, systemClosed: true, reason });
    }

    // 1. Password Verification (Strict against CURRENT password)
    let isPasswordCorrect = false;

    if (isSystemAdminAlias) {
      const bankPass = passwords[trimmedUser] || "123456";
      if (password === bankPass || password.trim() === bankPass) {
        isPasswordCorrect = true;
      }
    } else if (existingUser) {
      const savedPass = passwords[existingUser.username];
      if (savedPass && (savedPass === password || savedPass === password.trim())) {
        isPasswordCorrect = true;
      }
    }

    // 2. Return Unified Error Messages on Failure
    if (!isPasswordCorrect) {
      if (loginMode === 'admin_login') {
        return res.status(401).json({ error: "ชื่อผู้ใช้นี้ไม่มีสิทธิ์เข้าสู่ระบบแอดมิน" });
      } else {
        return res.status(401).json({ error: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" });
      }
    }

    // 3. Password is correct, Check Channel
    if (loginMode === 'admin_login' && !isAdminAccount) {
      return res.status(401).json({ error: "ชื่อผู้ใช้นี้ไม่มีสิทธิ์เข้าสู่ระบบแอดมิน" });
    }
    if (loginMode === 'login' && isAdminAccount) {
      return res.status(401).json({ error: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" });
    }

    const rawSessionKey = existingUser ? existingUser.username : trimmedUser;
    const sessionKey = getNormalizedSessionKey(rawSessionKey);

    // 4. Concurrent Login Check (Enforce single session with warning prompt & auto-logout)
    const existingSessionData = activeSessions.get(sessionKey);
    let existingSessionActive = false;
    if (existingSessionData) {
      // If the client supplies the same sessionId that is currently active, this is the same browser/device
      if (clientSessionId && existingSessionData.sessionId === clientSessionId) {
        existingSessionActive = false;
      } else if (Date.now() - existingSessionData.lastSeen < 20000) {
        existingSessionActive = true;
      } else {
        // Session expired/stale
        activeSessions.delete(sessionKey);
      }
    }

    if (existingSessionActive && force !== true) {
      return res.status(409).json({
        conflict: true,
        message: "บัญชีนี้กำลังถูกใช้งานจากอุปกรณ์อื่น คุณต้องการออกจากระบบจากอุปกรณ์อื่นเพื่อเข้าสู่ระบบในอุปกรณ์นี้หรือไม่"
      });
    }

    const newSessionId = isSystemAdminAlias 
      ? ("sess_admin_" + Date.now() + "_" + Math.random().toString(36).substring(2, 8))
      : ("sess_" + Date.now() + "_" + Math.random().toString(36).substring(2, 8));

    if (existingSessionActive && existingSessionData?.sessionId && existingSessionData.sessionId !== clientSessionId) {
      // Broadcast force_logout specifically targeted at the previous device/session
      broadcastEvent("force_logout", {
        targetUser: rawSessionKey,
        oldSessionId: existingSessionData.sessionId,
        newSessionId: newSessionId,
        reason: "มีการเข้าสู่ระบบบัญชีนี้จากอุปกรณ์หรือหน้าต่างอื่น"
      });
      activeSessions.delete(sessionKey);
    }

    activeSessions.set(sessionKey, { sessionId: newSessionId, lastSeen: Date.now() });

    // 5. Admin Special Alias Completion
    if (isSystemAdminAlias) {
      let adminUser = db.users.find((u) => u.username === trimmedUser || u.username.toLowerCase() === "bank");
      if (!adminUser) {
        adminUser = { username: trimmedUser, role: "admin", createdAt: new Date().toISOString(), lastLoginAt: new Date().toISOString() };
        db.users.push(adminUser);
      } else {
        adminUser.lastLoginAt = new Date().toISOString();
      }
      saveDb();

      const isAdminMustChange = password === "000000" || adminUser.mustChangePassword === true;
      return res.json({
        user: { 
          username: trimmedUser, 
          role: "admin", 
          displayName: adminUser.displayName || trimmedUser,
          mustChangePassword: isAdminMustChange
        },
        token: "admin-token-bank",
        sessionId: newSessionId
      });
    }

    // 6. Normal User Completion (or normal admin account in db)
    existingUser.lastLoginAt = new Date().toISOString();
    saveDb();

    const userMustChange = password === "000000" || existingUser.mustChangePassword === true;

    res.json({
      user: {
        username: existingUser.username,
        displayName: existingUser.displayName || existingUser.username,
        role: existingUser.role,
        userCategory: existingUser.userCategory,
        studentYear: existingUser.studentYear,
        faculty: existingUser.faculty,
        university: existingUser.university,
        interestMedTech: existingUser.interestMedTech,
        optOutLeaderboard: existingUser.optOutLeaderboard,
        mustChangePassword: userMustChange
      },
      token: `user-token-${existingUser.username}`,
      sessionId: newSessionId
    });
  });

  app.post("/api/auth/register", (req: Request, res: Response) => {
    if (db.systemControl?.disableRegistration) {
      const reason = db.systemControl.registrationReason || "ระบบสมัครสมาชิกถูกปิดใช้งานในขณะนี้";
      return res.status(403).json({ error: reason, systemClosed: true, reason });
    }

    const { username, password, displayName, userCategory, studentYear, faculty, university, interestMedTech, optOutLeaderboard } = req.body;
    const clientIp = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.ip || "unknown_ip";

    // Background Defense: Registration Rate Limiting (Max 30 per 10 mins per IP)
    const regCheck = checkRateLimit(`register_${clientIp}`, 30, 600000);
    if (!regCheck.allowed) {
      logSecurityEvent("REGISTRATION_SPAM_BLOCKED", `Exceeded registration threshold from IP`, clientIp);
      return res.status(429).json({
        error: `มีการสมัครสมาชิกถี่เกินไปจากเครือข่ายของคุณ กรุณารอสักครู่ (${regCheck.retryAfterSeconds} วินาที)`
      });
    }

    const userErr = validateUsernameComplexity(username);
    if (userErr) {
      return res.status(400).json({ error: userErr });
    }

    const passError = validatePasswordComplexity(password);
    if (passError) {
      return res.status(400).json({ error: passError });
    }

    const trimmed = username.trim();
    if (db.users.some((u) => u.username.toLowerCase() === trimmed.toLowerCase())) {
      return res.status(400).json({ error: "ชื่อผู้ใช้นี้ (Username) มีผู้ใช้งานแล้ว กรุณาใช้ชื่ออื่น" });
    }

    const trimmedDisplayName = displayName && typeof displayName === 'string' && displayName.trim().length > 0
      ? displayName.trim()
      : trimmed;

    const displayErr = validateDisplayNameComplexity(trimmedDisplayName);
    if (displayErr) {
      return res.status(400).json({ error: displayErr });
    }

    // Check Unique Display Name Policy (Must not match any existing user's displayName or username)
    if (db.users.some((u) => (u.displayName || u.username).toLowerCase() === trimmedDisplayName.toLowerCase())) {
      return res.status(400).json({ error: "ชื่อที่แสดง (Display Name) นี้มีผู้ใช้งานแล้ว กรุณาใช้ชื่ออื่น" });
    }

    const cat = userCategory || 'student';
    const isStudent = cat === 'student';
    const isMedTechStudent = cat === 'medtech_student';

    const newUser: User = {
      username: trimmed,
      displayName: trimmedDisplayName,
      role: "user",
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
      userCategory: cat,
      studentYear: (isStudent || isMedTechStudent) ? (studentYear || 'ปี 1') : undefined,
      faculty: isStudent ? (faculty && typeof faculty === 'string' ? faculty.trim() : undefined) : undefined,
      university: (isStudent || isMedTechStudent) ? (university && typeof university === 'string' ? university.trim() : undefined) : undefined,
      interestMedTech: cat === 'highschool' ? (interestMedTech || 'สนใจเรียนเทคนิคการแพทย์') : undefined,
      optOutLeaderboard: optOutLeaderboard !== undefined ? optOutLeaderboard : false
    };

    db.users.push(newUser);
    passwords[trimmed] = password.trim();
    passwords[trimmed.toLowerCase()] = password.trim();
    saveDb();

    const newSessionId = "sess_" + Date.now() + "_" + Math.random().toString(36).substring(2, 8);
    broadcastEvent("user_registered", { username: trimmed, displayName: trimmedDisplayName });

    if (db.systemControl?.disableLogin) {
      return res.status(201).json({
        message: 'สมัครสมาชิกสำเร็จ',
        loginDisabled: true,
        loginReason: db.systemControl.loginReason || 'ระบบปิดการเข้าสู่ระบบชั่วคราว'
      });
    }

    activeSessions.set(getNormalizedSessionKey(newUser.username), { sessionId: newSessionId, lastSeen: Date.now() });

    res.status(201).json({
      user: {
        username: newUser.username,
        displayName: newUser.displayName,
        role: newUser.role,
        userCategory: newUser.userCategory,
        studentYear: newUser.studentYear,
        faculty: newUser.faculty,
        university: newUser.university,
        interestMedTech: newUser.interestMedTech,
        optOutLeaderboard: newUser.optOutLeaderboard
      },
      token: `user-token-${newUser.username}`,
      sessionId: newSessionId
    });
  });

  
  app.post("/api/auth/ping", (req: Request, res: Response) => {
    const { username, sessionId } = req.body;
    if (!username) {
      return res.json({ success: false });
    }
    const trimmedUser = typeof username === "string" ? username.trim() : "";
    const isSystemAdminAlias = trimmedUser === "bank" || trimmedUser === "admin" || trimmedUser === "bank.sahapun@gmail.com";
    const existingUser = db.users.find((u) => u.username === trimmedUser);
    const isAdminAccount = isSystemAdminAlias || (existingUser && existingUser.role === "admin");
    
    if (db.systemControl?.disableLogin && !isAdminAccount) {
      return res.status(403).json({ error: db.systemControl.loginReason || "ระบบถูกปิด", systemClosed: true });
    }

    if (trimmedUser && sessionId) {
      const userKey = getNormalizedSessionKey(existingUser ? existingUser.username : trimmedUser);
      const sessionData = activeSessions.get(userKey);
      if (sessionData) {
        if (sessionData.sessionId === sessionId) {
          sessionData.lastSeen = Date.now();
          activeSessions.set(userKey, sessionData);
          return res.json({ success: true, active: true });
        } else {
          // Session was replaced by a newer login on another device
          return res.status(401).json({
            forceLogout: true,
            error: "บัญชีนี้มีการเข้าสู่ระบบจากอุปกรณ์อื่น ระบบได้นำคุณออกจากระบบอัตโนมัติ"
          });
        }
      } else {
        // If session is not tracked in memory, force logout stale sessions
        return res.status(401).json({
          forceLogout: true,
          error: "เซสชันนี้หมดอายุหรือถูกนำออกจากระบบแล้ว"
        });
      }
    }
    res.json({ success: true });
  });

  app.post("/api/auth/logout", (req: Request, res: Response) => {
    const { username, sessionId } = req.body;
    if (username && typeof username === 'string') {
      const userKey = getNormalizedSessionKey(username);
      const sessionData = activeSessions.get(userKey);
      if (sessionData) {
        if (!sessionId || sessionData.sessionId === sessionId) {
          activeSessions.delete(userKey);
        }
      }
    }
    res.json({ success: true });
  });

  app.post("/api/auth/restore-session", (req: Request, res: Response) => {
    const { username, sessionId } = req.body;
    if (!username || !sessionId) {
      return res.status(400).json({ error: "ข้อมูลไม่ครบถ้วน" });
    }
    const trimmedUser = username.trim();
    const isSystemAdminAlias = trimmedUser === "bank" || trimmedUser === "admin" || trimmedUser === "bank.sahapun@gmail.com";
    const existingUser = db.users.find((u) => u.username === trimmedUser);
    
    if (!existingUser && !isSystemAdminAlias) {
      return res.status(404).json({ error: "ไม่พบผู้ใช้นี้" });
    }

    const sessionKey = getNormalizedSessionKey(trimmedUser);
    const sessionData = activeSessions.get(sessionKey);

    if (sessionData && sessionData.sessionId === sessionId) {
      sessionData.lastSeen = Date.now();
      activeSessions.set(sessionKey, sessionData);
      
      const role = isSystemAdminAlias ? "admin" : (existingUser?.role || "student");
      const displayName = isSystemAdminAlias 
        ? (existingUser?.displayName || "Bank Sahapun")
        : (existingUser?.displayName || trimmedUser);

      return res.json({
        success: true,
        user: {
          username: trimmedUser,
          role,
          displayName,
          mustChangePassword: existingUser ? (passwords[trimmedUser] === "000000" || existingUser.mustChangePassword === true) : false
        }
      });
    }

    if (!sessionData) {
      activeSessions.set(sessionKey, { sessionId, lastSeen: Date.now() });
      const role = isSystemAdminAlias ? "admin" : (existingUser?.role || "student");
      const displayName = isSystemAdminAlias 
        ? (existingUser?.displayName || "Bank Sahapun")
        : (existingUser?.displayName || trimmedUser);

      return res.json({
        success: true,
        user: {
          username: trimmedUser,
          role,
          displayName,
          mustChangePassword: existingUser ? (passwords[trimmedUser] === "000000" || existingUser.mustChangePassword === true) : false
        }
      });
    }

    return res.status(401).json({ error: "เซสชันไม่ถูกต้องหรือถูกใช้งานโดยอุปกรณ์อื่นแล้ว" });
  });

  app.post("/api/auth/change-password", (req: Request, res: Response) => {
    const { username, oldPassword, newPassword } = req.body;

    if (!username || !newPassword) {
      return res.status(400).json({ error: "กรุณาระบุ Username และรหัสผ่านใหม่" });
    }

    if (newPassword.trim() === "000000") {
      return res.status(400).json({ error: "ไม่สามารถใช้รหัสผ่านชั่วคราว 000000 เป็นรหัสผ่านใหม่ได้ กรุณาตั้งรหัสผ่านที่มีความปลอดภัย" });
    }

    const passError = validatePasswordComplexity(newPassword);
    if (passError) {
      return res.status(400).json({ error: passError });
    }

    const targetKey = username.trim().toLowerCase();
    const isSystemAdminAlias = targetKey === "bank" || targetKey === "admin" || targetKey === "bank.sahapun@gmail.com";
    const targetUser = db.users.find((u) => u.username.toLowerCase() === targetKey);
    if (!targetUser && !isSystemAdminAlias) {
      return res.status(404).json({ error: "ไม่พบผู้ใช้งาน" });
    }

    const currentPass = isSystemAdminAlias
      ? (passwords["bank"] || passwords["bank.sahapun@gmail.com"] || passwords[targetKey] || "123456")
      : (passwords[targetUser!.username] || passwords[targetKey] || "123456");

    if (oldPassword && currentPass !== oldPassword && currentPass !== "000000") {
      return res.status(401).json({ error: "รหัสผ่านเดิมไม่ถูกต้อง" });
    }

    const cleanedNewPass = newPassword.trim();

    if (isSystemAdminAlias) {
      passwords["bank"] = cleanedNewPass;
      passwords["admin"] = cleanedNewPass;
      passwords["bank.sahapun@gmail.com"] = cleanedNewPass;
      passwords[targetKey] = cleanedNewPass;
      if (targetUser) {
        passwords[targetUser.username] = cleanedNewPass;
        targetUser.mustChangePassword = false;
      }
      const adminBank = db.users.find((u) => u.username.toLowerCase() === "bank");
      if (adminBank) adminBank.mustChangePassword = false;
      const adminEmail = db.users.find((u) => u.username.toLowerCase() === "bank.sahapun@gmail.com");
      if (adminEmail) adminEmail.mustChangePassword = false;
    } else if (targetUser) {
      passwords[targetKey] = cleanedNewPass;
      passwords[targetUser.username] = cleanedNewPass;
      Object.keys(passwords).forEach((k) => {
        if (k.toLowerCase() === targetKey) {
          passwords[k] = cleanedNewPass;
        }
      });
      targetUser.mustChangePassword = false;
    }

    saveDb();

    broadcastEvent("user_password_changed", {
      username: targetUser ? targetUser.username : username.trim(),
      mustChangePassword: false
    });

    res.json({ success: true, message: "เปลี่ยนรหัสผ่านสำเร็จเรียบร้อยแล้ว (รหัสผ่านใหม่มีผลทันที)" });
  });

  // Admin Reset User Password to 000000
  app.post("/api/admin/users/reset-password", (req: Request, res: Response) => {
    const { username } = req.body;
    if (!username || typeof username !== "string") {
      return res.status(400).json({ error: "กรุณาระบุ Username ที่ต้องการรีเซ็ตรหัสผ่าน" });
    }

    const targetKey = username.trim().toLowerCase();
    const isSystemAdminAlias = targetKey === "bank" || targetKey === "admin" || targetKey === "bank.sahapun@gmail.com";
    const targetUser = db.users.find((u) => u.username.toLowerCase() === targetKey);
    if (!targetUser && !isSystemAdminAlias) {
      return res.status(404).json({ error: "ไม่พบข้อมูลผู้ใช้งานนี้ในระบบ" });
    }

    // Set temporary password to 000000
    if (isSystemAdminAlias) {
      passwords["bank"] = "000000";
      passwords["admin"] = "000000";
      passwords["bank.sahapun@gmail.com"] = "000000";
      passwords[targetKey] = "000000";
      if (targetUser) {
        passwords[targetUser.username] = "000000";
        targetUser.mustChangePassword = true;
      }
      const adminBank = db.users.find((u) => u.username.toLowerCase() === "bank");
      if (adminBank) adminBank.mustChangePassword = true;
      const adminEmail = db.users.find((u) => u.username.toLowerCase() === "bank.sahapun@gmail.com");
      if (adminEmail) adminEmail.mustChangePassword = true;
    } else if (targetUser) {
      passwords[targetKey] = "000000";
      passwords[targetUser.username] = "000000";
      Object.keys(passwords).forEach((k) => {
        if (k.toLowerCase() === targetKey) {
          passwords[k] = "000000";
        }
      });
      targetUser.mustChangePassword = true;
    }

    saveDb();

    // Broadcast SSE update so admin views update in real-time
    broadcastEvent("user_password_reset", {
      username: targetUser ? targetUser.username : username.trim(),
      mustChangePassword: true
    });

    res.json({
      success: true,
      message: `รีเซ็ตรหัสผ่านของ "${targetUser ? targetUser.username : username}" เป็น "000000" สำเร็จเรียบร้อยแล้ว`,
      user: {
        ...(targetUser || { username: username.trim(), role: "user" }),
        password: "000000",
        mustChangePassword: true
      }
    });
  });

  app.post("/api/user/profile", (req: Request, res: Response) => {
    const { username, displayName, userCategory, studentYear, faculty, university, interestMedTech, optOutLeaderboard } = req.body;

    if (!username || typeof username !== "string") {
      return res.status(400).json({ error: "กรุณาระบุ Username" });
    }

    const targetKey = username.trim().toLowerCase();
    const targetUser = db.users.find((u) => u.username.toLowerCase() === targetKey);
    if (!targetUser) {
      return res.status(404).json({ error: "ไม่พบผู้ใช้ในระบบ" });
    }

    const newDisplayName = displayName && typeof displayName === 'string' && displayName.trim().length > 0
      ? displayName.trim()
      : targetUser.username;

    const displayErr = validateDisplayNameComplexity(newDisplayName);
    if (displayErr) {
      return res.status(400).json({ error: displayErr });
    }

    // Check Unique Display Name Policy for profile update
    if (db.users.some((u) => u.username.toLowerCase() !== targetKey && (u.displayName || u.username).toLowerCase() === newDisplayName.toLowerCase())) {
      return res.status(400).json({ error: "ชื่อที่แสดง (Display Name) นี้มีผู้ใช้งานแล้ว กรุณาใช้ชื่ออื่น" });
    }

    if (optOutLeaderboard !== undefined) { targetUser.optOutLeaderboard = optOutLeaderboard; }
    targetUser.displayName = newDisplayName;

    if (userCategory) {
      const isStudent = userCategory === 'student';
      const isMedTechStudent = userCategory === 'medtech_student';

      targetUser.userCategory = userCategory;
      targetUser.studentYear = (isStudent || isMedTechStudent) ? (studentYear || 'ปี 1') : undefined;
      targetUser.faculty = isStudent ? (faculty && typeof faculty === 'string' ? faculty.trim() : undefined) : undefined;
      targetUser.university = (isStudent || isMedTechStudent) ? (university && typeof university === 'string' ? university.trim() : undefined) : undefined;
      targetUser.interestMedTech = userCategory === 'highschool' ? (interestMedTech || 'สนใจเรียนเทคนิคการแพทย์') : undefined;
    }

    // Update public comments display names for this user
    if (db.publicComments && Array.isArray(db.publicComments)) {
      db.publicComments.forEach((pc) => {
        if (pc.username && pc.username.toLowerCase() === targetKey) {
          pc.displayName = newDisplayName;
        }
      });
    }

    saveDb();
    broadcastEvent("user_profile_updated", { username: targetUser.username, displayName: newDisplayName });

    res.json({
      success: true,
      message: "อัปเดตข้อมูลส่วนตัวเรียบร้อยแล้ว",
      user: {
        username: targetUser.username,
        displayName: targetUser.displayName,
        role: targetUser.role,
        userCategory: targetUser.userCategory,
        studentYear: targetUser.studentYear,
        faculty: targetUser.faculty,
        university: targetUser.university,
        interestMedTech: targetUser.interestMedTech,
        optOutLeaderboard: targetUser.optOutLeaderboard
      }
    });
  });

  // Self Account & Data Deletion
  app.delete("/api/account/self", (req: Request, res: Response) => {
    const { username } = req.body;
    if (!username || typeof username !== "string") {
      return res.status(400).json({ error: "กรุณาระบุ Username ที่ต้องการลบ" });
    }

    const targetLower = username.trim().toLowerCase();
    if (targetLower === "bank") {
      return res.status(403).json({ error: "ไม่สามารถลบบัญชี Super Admin ได้" });
    }

    const exists = db.users.some(u => u.username.toLowerCase() === targetLower);
    if (!exists) {
      return res.status(404).json({ error: "ไม่พบข้อมูลบัญชีผู้ใช้งานนี้ในระบบ" });
    }

    purgeUserDataCompletely(username);
    broadcastEvent("user_deleted", { username: targetLower });

    res.json({ success: true, message: "ลบข้อมูลบัญชีและประวัติการทำข้อสอบออกจากระบบถาวรเรียบร้อยแล้ว" });
  });

  // Guest Mode logging (records backend access history for Admin review)
  app.post("/api/auth/guest", (req: Request, res: Response) => {
    const id = "guest_" + Date.now();
    res.json({
      user: { username: "Guest (" + id.slice(-4) + ")", role: "guest" },
      guestLogId: id
    });
  });

  // Get Users & Guest Logs (Admin Only)
    app.get("/api/users/status", (req: Request, res: Response) => {
    const members = db.users.filter(u => u.role !== 'admin' && u.username.toLowerCase() !== 'bank' && u.username.toLowerCase() !== 'admin');
    const list = members.map(u => ({
      username: u.username,
      displayName: u.displayName || u.username,
      isOnline: (() => {
        const sd = activeSessions.get(getNormalizedSessionKey(u.username));
        return sd ? (Date.now() - sd.lastSeen < 15000) : false;
      })()
    }));
    res.json(list);
  });

  app.get("/api/users", (req: Request, res: Response) => {
    res.json({
      users: db.users.map((u) => {
        const lower = u.username.toLowerCase();
        const pwd = passwords[lower] || passwords[u.username] || passwords[u.username.trim()] || ((lower === "bank" || lower === "admin") ? (passwords["bank"] || "123456") : "");
        const mustChange = u.mustChangePassword === true || pwd === "000000";
        return {
          ...u,
          password: pwd,
          mustChangePassword: mustChange
        };
      })
    });
  });

  app.delete("/api/users/:username", (req: Request, res: Response) => {
    const { username } = req.params;
    const requester = (req.headers["x-requester"] as string) || "";
    if (username.toLowerCase() === 'bank') {
      return res.status(403).json({ error: "ไม่สามารถลบ Super Admin ได้" });
    }
    if (requester && requester.toLowerCase() !== 'bank') {
      return res.status(403).json({ error: "เฉพาะแอดมินหลัก (Super Admin) เท่านั้นที่สามารถลบผู้ใช้งานได้" });
    }
    purgeUserDataCompletely(username);
    broadcastEvent("user_deleted", { username: username.toLowerCase() });
    res.json({ success: true });
  });

  app.post("/api/users", (req: Request, res: Response) => {
    const { username, password, role, displayName } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: "ข้อมูลผู้ใช้ไม่ถูกต้อง" });
    }
    const userErr = validateUsernameComplexity(username);
    if (userErr) {
      return res.status(400).json({ error: userErr });
    }
    const passErr = validatePasswordComplexity(password);
    if (passErr) {
      return res.status(400).json({ error: passErr });
    }
    if (db.users.find(u => u.username.toLowerCase() === username.toLowerCase())) {
      return res.status(400).json({ error: "ชื่อผู้ใช้นี้มีในระบบแล้ว" });
    }
    const targetDisplayName = displayName && typeof displayName === 'string' && displayName.trim().length > 0
      ? displayName.trim()
      : username.trim();
    const displayErr = validateDisplayNameComplexity(targetDisplayName);
    if (displayErr) {
      return res.status(400).json({ error: displayErr });
    }
    if (db.users.some(u => (u.displayName || u.username).toLowerCase() === targetDisplayName.toLowerCase())) {
      return res.status(400).json({ error: "ชื่อที่แสดง (Display Name) นี้มีผู้ใช้งานแล้ว" });
    }
    db.users.push({
      username: username.trim(),
      displayName: targetDisplayName,
      role: role === 'admin' ? 'admin' : 'user',
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString()
    });
    passwords[username.trim()] = password;
    saveDb();
    res.json({ success: true });
  });


  // ----------------------------------------------------
  // COMMENTS / ERROR REPORTS
  // ----------------------------------------------------
  app.delete("/api/comments/:id", (req: Request, res: Response) => {
    const { id } = req.params;
    db.comments = db.comments.filter(c => c.id !== id);
    saveDb();
    broadcastEvent("comment_deleted", { id });
    res.json({ success: true });
  });

  app.delete("/api/comments", (req: Request, res: Response) => {
    db.comments = [];
    saveDb();
    broadcastEvent("comments_cleared", {});
    res.json({ success: true });
  });

  app.get("/api/comments", (req: Request, res: Response) => {
    res.json(db.comments);
  });

  app.post("/api/comments", (req: Request, res: Response) => {
    const { questionId, questionText, subject, username, comment } = req.body;
    const clientIp = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.ip || "unknown_ip";
    const userKey = (username || "guest").trim().toLowerCase();

    // Background Defense: Error Report Rate Limiting (Max 10 per 5 mins)
    const reportCheck = checkRateLimit(`report_${clientIp}_${userKey}`, 10, 300000);
    if (!reportCheck.allowed) {
      logSecurityEvent("REPORT_SPAM_BLOCKED", `Exceeded comment report threshold`, clientIp);
      return res.status(429).json({
        error: `คุณส่งรายงานข้อผิดพลาดถี่เกินไป กรุณารอสักครู่ (${reportCheck.retryAfterSeconds} วินาที)`
      });
    }

    if (!questionId || !comment || !comment.trim()) {
      return res.status(400).json({ error: "กรุณาระบุข้อความคอมเมนต์แจ้งข้อผิดพลาด" });
    }

    const newComment: CommentReport = {
      id: "comm_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
      questionId,
      questionText: questionText || "",
      subject: subject || "ทั่วไป",
      username: username || "Guest",
      comment: comment.trim(),
      createdAt: new Date().toISOString(),
      status: "pending"
    };

    db.comments.unshift(newComment);
    saveDb();

    broadcastEvent("comment_added", newComment);

    res.status(201).json(newComment);
  });

  app.post("/api/comments/:id/reply", (req: Request, res: Response) => {
    const { id } = req.params;
    const { reply } = req.body;

    const comm = db.comments.find((c) => c.id === id);
    if (!comm) {
      return res.status(404).json({ error: "ไม่พบรายการคอมเมนต์" });
    }

    comm.adminReply = reply ? reply.trim() : "";
    comm.status = "resolved";
    comm.repliedAt = new Date().toISOString();

    // Generate targeted user notification
    const newNotif: UserNotification = {
      id: "notif_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
      targetUser: comm.username,
      commentId: comm.id,
      questionId: comm.questionId,
      questionText: comm.questionText,
      commentText: comm.comment,
      adminReply: comm.adminReply,
      createdAt: new Date().toISOString(),
      read: false
    };

    if (!db.notifications) {
      db.notifications = [];
    }
    db.notifications.unshift(newNotif);

    saveDb();
    broadcastEvent("comment_replied", comm);
    broadcastEvent("notification_created", newNotif);

    res.json(comm);
  });

  // ----------------------------------------------------
  // PUBLIC COMMENTS (General Chat)
  // ----------------------------------------------------
  app.get("/api/public-comments", (req: Request, res: Response) => {
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    const comments = (db.publicComments || []).map(c => {
      const lower = (c.username || "").trim().toLowerCase();
      const isAdmin = c.isAdmin || c.role === "admin" || lower === "bank" || lower === "admin";
      let roomStatus: string | undefined = undefined;
      let cleanId = c.roomId ? c.roomId.trim().toUpperCase() : "";
      if (!cleanId && c.message) {
        const match = c.message.match(/\[([A-Z0-9]{4,10})\]/i) || c.message.match(/room=([A-Z0-9]{4,10})/i);
        if (match) cleanId = match[1].trim().toUpperCase();
      }
      if (cleanId) {
        const isPermanentlyClosed = Array.isArray(db.closedRooms) && db.closedRooms.includes(cleanId);
        const r = rooms[cleanId] || (c.roomId ? rooms[c.roomId] : null);
        if (isPermanentlyClosed) {
          roomStatus = "closed";
        } else if (r) {
          roomStatus = r.status === "finished" ? "closed" : r.status;
        } else {
          roomStatus = c.roomStatus || "closed";
        }
      }
      return {
        ...c,
        roomId: cleanId || c.roomId,
        displayName: isAdmin ? "แอดมิน" : (c.displayName || c.username),
        isAdmin,
        roomStatus: roomStatus || (cleanId ? "closed" : undefined)
      };
    });
    res.json(comments);
  });

  app.get("/api/multiplayer/room-statuses", (req: Request, res: Response) => {
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    const statuses: Record<string, { status: string; playersCount: number; questionCount: number; currentQuestionIndex: number }> = {};
    if (Array.isArray(db.closedRooms)) {
      for (const cId of db.closedRooms) {
        statuses[cId.trim().toUpperCase()] = {
          status: "closed",
          playersCount: 0,
          questionCount: 0,
          currentQuestionIndex: 0
        };
      }
    }
    for (const [roomId, room] of Object.entries(rooms)) {
      const cleanId = roomId.trim().toUpperCase();
      const isClosed = Array.isArray(db.closedRooms) && db.closedRooms.includes(cleanId);
      statuses[cleanId] = {
        status: isClosed ? "closed" : (room.status === "finished" ? "closed" : room.status),
        playersCount: isClosed ? 0 : room.players.length,
        questionCount: room.questions ? room.questions.length : 0,
        currentQuestionIndex: room.currentQuestionIndex || 0
      };
    }
    res.json({ statuses });
  });

  app.delete("/api/public-comments/:id", (req: Request, res: Response) => {
    const { id } = req.params;
    if (db.publicComments) {
      db.publicComments = db.publicComments.filter(c => c.id !== id);
      saveDb();
      broadcastEvent("public_comment_deleted", { id });
    }
    res.json({ success: true });
  });

  app.delete("/api/public-comments", (req: Request, res: Response) => {
    db.publicComments = [];
    saveDb();
    broadcastEvent("public_comments_cleared", {});
    res.json({ success: true });
  });

  // ----------------------------------------------------
  // BANNED WORDS / PROFANITY FILTER MANAGEMENT
  // ----------------------------------------------------
  app.get("/api/banned-words", (req: Request, res: Response) => {
    if (!db.bannedWords || !Array.isArray(db.bannedWords) || db.bannedWords.length === 0) {
      db.bannedWords = [...DEFAULT_BANNED_WORDS];
    }
    res.json({ bannedWords: db.bannedWords });
  });

  app.post("/api/banned-words", (req: Request, res: Response) => {
    const { word, words } = req.body;
    if (!db.bannedWords) db.bannedWords = [...DEFAULT_BANNED_WORDS];

    const wordsToAdd: string[] = [];
    if (typeof word === "string" && word.trim()) {
      word.split(",").forEach(w => {
        const tr = w.trim();
        if (tr) wordsToAdd.push(tr);
      });
    }
    if (Array.isArray(words)) {
      words.forEach(w => {
        if (typeof w === "string" && w.trim()) wordsToAdd.push(w.trim());
      });
    }

    if (wordsToAdd.length === 0) {
      return res.status(400).json({ error: "กรุณาระบุคำที่ต้องการเพิ่ม" });
    }

    let addedCount = 0;
    wordsToAdd.forEach(w => {
      const exists = db.bannedWords!.some(bw => bw.toLowerCase() === w.toLowerCase());
      if (!exists) {
        db.bannedWords!.push(w);
        addedCount++;
      }
    });

    saveDb();
    broadcastEvent("banned_words_updated", { bannedWords: db.bannedWords });
    res.json({ success: true, addedCount, bannedWords: db.bannedWords });
  });

  app.post("/api/banned-words/delete", (req: Request, res: Response) => {
    const { word } = req.body;
    if (!word || typeof word !== "string" || !word.trim()) {
      return res.status(400).json({ error: "ไม่พบคำที่ต้องการลบ" });
    }
    const targetWord = word.trim().toLowerCase();
    if (!db.bannedWords) db.bannedWords = [...DEFAULT_BANNED_WORDS];
    db.bannedWords = db.bannedWords.filter(bw => bw.toLowerCase() !== targetWord);
    saveDb();
    broadcastEvent("banned_words_updated", { bannedWords: db.bannedWords });
    res.json({ success: true, bannedWords: db.bannedWords });
  });

  app.delete("/api/banned-words/:word", (req: Request, res: Response) => {
    const rawWord = req.params.word || "";
    const targetWord = decodeURIComponent(rawWord).trim().toLowerCase();
    if (!targetWord) {
      return res.status(400).json({ error: "ไม่พบคำที่ต้องการลบ" });
    }
    if (!db.bannedWords) db.bannedWords = [...DEFAULT_BANNED_WORDS];
    db.bannedWords = db.bannedWords.filter(bw => bw.toLowerCase() !== targetWord);
    saveDb();
    broadcastEvent("banned_words_updated", { bannedWords: db.bannedWords });
    res.json({ success: true, bannedWords: db.bannedWords });
  });

  app.post("/api/banned-words/reset", (req: Request, res: Response) => {
    db.bannedWords = [...DEFAULT_BANNED_WORDS];
    saveDb();
    broadcastEvent("banned_words_updated", { bannedWords: db.bannedWords });
    res.json({ success: true, bannedWords: db.bannedWords });
  });

  app.get("/api/users/display-names", (req: Request, res: Response) => {
    const userList: { username: string; displayName: string; role?: string; userCategory?: string; optOutLeaderboard?: boolean }[] = [];
    const seenNames = new Set<string>();

    if (db.users) {
      db.users.forEach((u) => {
        const isAdminUser = u.role === 'admin' || u.username.toLowerCase() === 'bank' || u.username.toLowerCase() === 'admin';
        const dName = isAdminUser ? "แอดมิน" : (u.displayName || u.username);
        if (dName && !seenNames.has(dName.toLowerCase())) {
          seenNames.add(dName.toLowerCase());
          userList.push({
            username: u.username,
            displayName: dName,
            role: u.role,
            userCategory: u.userCategory, 
            optOutLeaderboard: u.optOutLeaderboard
          });
        }
      });
    }

    if (!seenNames.has("แอดมิน") && !seenNames.has("admin") && !seenNames.has("bank")) {
      userList.push({
        username: "bank",
        displayName: "แอดมิน",
        role: "admin",
        userCategory: "admin"
      });
    }

    res.json(userList);
  });

  app.post("/api/public-comments/mark-read", (req: Request, res: Response) => {
    const { username, messageIds } = req.body;
    if (!username) {
      return res.json({ success: true, updated: false });
    }

    const trimmedUser = username.trim();
    let updated = false;

    if (db.publicComments) {
      db.publicComments.forEach((pc) => {
        if (messageIds === "all" || (Array.isArray(messageIds) && messageIds.includes(pc.id))) {
          if (!pc.readBy) pc.readBy = [];
          if (!pc.readBy.includes(trimmedUser)) {
            pc.readBy.push(trimmedUser);
            updated = true;
          }
        }
      });
    }

    // Cascade clear mention notifications for this user for the read messages
    let notifUpdated = false;
    if (db.notifications) {
      db.notifications.forEach((n) => {
        if (n.targetUser.toLowerCase() === trimmedUser.toLowerCase()) {
          if (messageIds === "all" || (n.messageId && Array.isArray(messageIds) && messageIds.includes(n.messageId))) {
            if (!n.read) {
              n.read = true;
              notifUpdated = true;
            }
          }
        }
      });
    }

    if (updated || notifUpdated) {
      saveDb();
    }

    if (updated) {
      broadcastEvent("public_comments_read_updated", { username: trimmedUser, messageIds, publicComments: db.publicComments });
    }
    if (notifUpdated) {
      broadcastEvent("notifications_updated", { username: trimmedUser });
    }

    res.json({ success: true, updated });
  });

  app.post("/api/public-comments/room-invite", (req: Request, res: Response) => {
    const { username, displayName, role, roomId, roomSubject, roomQuestionCount, customMessage } = req.body;
    if (!username || !roomId) {
      return res.status(400).json({ error: "ข้อมูลห้องหรือผู้ใช้ไม่ครบถ้วน" });
    }
    const cleanRoomId = roomId.toString().trim().toUpperCase();
    const lowerUser = username.trim().toLowerCase();
    const userObj = db.users.find((u) => u.username.toLowerCase() === lowerUser);
    const isAdmin = role === 'admin' || userObj?.role === 'admin' || lowerUser === 'bank' || lowerUser === 'admin';
    const finalDisplayName = isAdmin ? "แอดมิน" : (displayName?.trim() || userObj?.displayName || username.trim());
    const subjectName = roomSubject === "all" ? "รวมทุกวิชา" : (roomSubject || "รวมทุกวิชา");
    const qCount = typeof roomQuestionCount === "number" ? roomQuestionCount : (parseInt(roomQuestionCount) || 10);

    const defaultMsg = customMessage || `⚔️ [คำเชิญห้องแข่งขัน] ${finalDisplayName} ได้เปิดห้องแข่งขันในโหมดประลองปัญญา รหัสห้อง [${cleanRoomId}] (วิชา: ${subjectName}, จำนวน: ${qCount} ข้อ) เชิญชวนผู้สนใจเข้าร่วมท้าประลองความรู้ร่วมกัน!`;

    const newPc: PublicComment = {
      id: Date.now().toString(),
      username: username.trim(),
      displayName: finalDisplayName,
      message: defaultMsg,
      createdAt: new Date().toISOString(),
      role: isAdmin ? 'admin' : (userObj?.role || role || 'user'),
      isAdmin: isAdmin,
      readBy: [username.trim()],
      roomId: cleanRoomId,
      roomSubject: subjectName,
      roomQuestionCount: qCount,
      isRoomInvite: true
    };

    if (!db.publicComments) db.publicComments = [];
    db.publicComments.unshift(newPc);
    if (db.publicComments.length > 200) db.publicComments.pop();

    saveDb();
    broadcastEvent("public_comment_added", newPc);
    res.status(201).json(newPc);
  });

  app.post("/api/public-comments", (req: Request, res: Response) => {
    const { username, message, role, displayName, roomId, roomSubject, roomQuestionCount, isRoomInvite } = req.body;
    const clientIp = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.ip || "unknown_ip";
    const userKey = (username || "guest").trim().toLowerCase();

    if (!username || !message || !message.trim()) {
      return res.status(400).json({ error: "ข้อมูลไม่ครบถ้วน" });
    }

    // Profanity Filter Check (Skip if standard system room invite)
    if (!isRoomInvite) {
      if (!db.bannedWords || !Array.isArray(db.bannedWords) || db.bannedWords.length === 0) {
        db.bannedWords = [...DEFAULT_BANNED_WORDS];
      }
      const profanityResult = checkProfanity(message, db.bannedWords);
      if (profanityResult.isProfane) {
        return res.status(400).json({
          error: "ตรวจพบคำไม่เหมาะสม กรุณาแก้ไขคำไม่เหมาะสมและส่งใหม่อีกครั้ง",
          detectedWord: profanityResult.foundWord
        });
      }
    }

    // Background Defense: Chat Rate Limiting (Max 20 per 30s)
    const chatCheck = checkRateLimit(`chat_${clientIp}_${userKey}`, 20, 30000);
    if (!chatCheck.allowed) {
      logSecurityEvent("CHAT_SPAM_BLOCKED", `Chat spam limit exceeded for user: ${userKey}`, clientIp);
      return res.status(429).json({
        error: `คุณส่งข้อความแชทเร็วเกินไป กรุณารอสักครู่ (${chatCheck.retryAfterSeconds} วินาที)`
      });
    }

    // Background Defense: Duplicate Message Spam Block (Cannot send identical text within 3s)
    const now = Date.now();
    const bucket = rateLimitBuckets.get(`chat_${clientIp}_${userKey}`);
    if (bucket && bucket.lastMessage === message.trim() && bucket.lastMessageAt && (now - bucket.lastMessageAt < 3000)) {
      return res.status(429).json({
        error: "ข้อความซ้ำกัน กรุณารอสักครู่ก่อนส่งข้อความเดิมอีกครั้ง"
      });
    }
    if (bucket) {
      bucket.lastMessage = message.trim();
      bucket.lastMessageAt = now;
    }

    const lowerUser = username.trim().toLowerCase();
    const userObj = db.users.find((u) => u.username.toLowerCase() === lowerUser);
    const isAdmin = role === 'admin' || userObj?.role === 'admin' || lowerUser === 'bank' || lowerUser === 'admin';
    const finalDisplayName = isAdmin ? "แอดมิน" : (displayName?.trim() || userObj?.displayName || username.trim());

    const cleanRoomId = roomId ? roomId.toString().trim().toUpperCase() : undefined;
    const cleanRoomSubject = roomSubject ? (roomSubject === "all" ? "รวมทุกวิชา" : roomSubject.toString().trim()) : undefined;
    const cleanQuestionCount = typeof roomQuestionCount === "number" ? roomQuestionCount : (parseInt(roomQuestionCount) || undefined);

    const newPc: PublicComment = { 
      id: Date.now().toString(), 
      username: username.trim(), 
      displayName: finalDisplayName,
      message: message.trim(), 
      createdAt: new Date().toISOString(),
      role: isAdmin ? 'admin' : (userObj?.role || role || 'user'),
      isAdmin: isAdmin,
      readBy: [username.trim()], // Sender has read their own message
      roomId: cleanRoomId,
      roomSubject: cleanRoomSubject,
      roomQuestionCount: cleanQuestionCount,
      isRoomInvite: Boolean(isRoomInvite || cleanRoomId)
    };
    
    if (!db.publicComments) db.publicComments = [];
    db.publicComments.unshift(newPc);
    if (db.publicComments.length > 200) db.publicComments.pop(); // keep limit

    // Detect @mentions in message (Display Name only)
    const msgLower = message.trim().toLowerCase();
    db.users.forEach((u) => {
      if (u.username.toLowerCase() !== lowerUser) {
        const isAdminTarget = u.role === 'admin' || u.username.toLowerCase() === 'bank' || u.username.toLowerCase() === 'admin';
        const dLower = (isAdminTarget ? "แอดมิน" : (u.displayName || u.username)).trim().toLowerCase();
        const isMentionedByD = dLower.length > 0 && (msgLower.includes(`@${dLower}`) || (isAdminTarget && (msgLower.includes("@แอดมิน") || msgLower.includes("@admin"))));

        if (isMentionedByD) {
          const mentionNotif: UserNotification = {
            id: "notif_mention_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
            targetUser: u.username,
            commentText: message.trim(),
            adminReply: "",
            questionId: "",
            questionText: "",
            createdAt: new Date().toISOString(),
            read: false,
            type: 'mention',
            senderDisplayName: finalDisplayName,
            messageId: newPc.id
          };
          if (!db.notifications) db.notifications = [];
          db.notifications.unshift(mentionNotif);
          broadcastEvent("mention_notification", mentionNotif);
          broadcastEvent("notification_created", mentionNotif);
        }
      }
    });
    
    saveDb();
    broadcastEvent("public_comment_added", newPc);
    res.status(201).json(newPc);
  });

  // ----------------------------------------------------
  // USER NOTIFICATIONS (Targeted for specific user)
  // ----------------------------------------------------
  app.get("/api/notifications", (req: Request, res: Response) => {
    const username = req.query.username as string | undefined;
    if (!db.notifications) db.notifications = [];
    if (username) {
      const userNotifs = db.notifications.filter(
        (n) => n.targetUser.toLowerCase() === username.trim().toLowerCase()
      );
      return res.json(userNotifs);
    }
    res.json(db.notifications);
  });

  app.put("/api/notifications/:id/read", (req: Request, res: Response) => {
    const { id } = req.params;
    if (!db.notifications) db.notifications = [];
    const notif = db.notifications.find((n) => n.id === id);
    if (notif) {
      notif.read = true;
      saveDb();
      broadcastEvent("notification_read", { id, targetUser: notif.targetUser });
    }
    res.json({ success: true });
  });

  app.delete("/api/notifications/:id", (req: Request, res: Response) => {
    const { id } = req.params;
    if (!db.notifications) db.notifications = [];
    db.notifications = db.notifications.filter((n) => n.id !== id);
    saveDb();
    broadcastEvent("notification_deleted", { id });
    res.json({ success: true, message: "Notification deleted" });
  });

  app.put("/api/notifications/read-all", (req: Request, res: Response) => {
    const { username } = req.body;
    if (!db.notifications) db.notifications = [];
    if (username) {
      const trimmed = username.trim().toLowerCase();
      db.notifications.forEach((n) => {
        if (n.targetUser.toLowerCase() === trimmed) {
          n.read = true;
        }
      });
      saveDb();
      broadcastEvent("notifications_read_all", { username: username.trim() });
    }
    res.json({ success: true });
  });

  // ----------------------------------------------------
  // SCORES HISTORY
  // ----------------------------------------------------
  app.get("/api/scores", (req: Request, res: Response) => {
    const username = req.query.username as string | undefined;
    if (username) {
      return res.json(db.scores.filter((s) => s.username.toLowerCase() === username.toLowerCase()));
    }
    res.json(db.scores);
  });

  app.post("/api/scores", (req: Request, res: Response) => {
    const { username, subject, totalAttempted, totalCorrect, incorrectQuestionIds } = req.body;

    if (totalAttempted <= 0) {
      return res.status(400).json({ error: "จำนวนข้อที่ทำต้องมากกว่า 0" });
    }

    const percentage = Number(((totalCorrect / totalAttempted) * 100).toFixed(2));
    const passed = percentage >= 60.0;

    const newScore: ScoreHistory = {
      id: "sc_" + Date.now(),
      username: username || "Guest",
      subject: subject || "รวมทุกวิชา",
      totalAttempted,
      totalCorrect,
      percentage,
      passed,
      incorrectQuestionIds: incorrectQuestionIds || [],
      timestamp: new Date().toISOString()
    };

    db.scores.unshift(newScore);
    saveDb();

    broadcastEvent("score_saved", newScore);

    res.status(201).json(newScore);
  });

  // ----------------------------------------------------
  // ANNOUNCEMENT API ENDPOINTS
  // ----------------------------------------------------
  app.get("/api/announcements", (req: Request, res: Response) => {
    res.json({ announcements: db.announcements || [] });
  });

  app.post("/api/announcements", (req: Request, res: Response) => {
    const { text, imageUrl } = req.body;
    if (!db.announcements) db.announcements = [];
    const newAnnouncement = {
      id: "ann_" + Date.now() + "_" + Math.random().toString(36).substring(2, 8),
      text: text || undefined,
      imageUrl: imageUrl || undefined,
      createdAt: new Date().toISOString()
    };
    db.announcements.push(newAnnouncement);
    saveDb();
    broadcastEvent("announcements_updated", { announcements: db.announcements });
    res.json({ success: true, announcement: newAnnouncement });
  });

  app.delete("/api/announcements/:id", (req: Request, res: Response) => {
    const id = req.params.id;
    if (db.announcements) {
      db.announcements = db.announcements.filter(a => a.id !== id);
      saveDb();
      broadcastEvent("announcements_updated", { announcements: db.announcements });
    }
    res.json({ success: true });
  });

  const httpServer = http.createServer(app);
  const io = new SocketIOServer(httpServer, {
    cors: { origin: "*" },
  });

  // ----------------------------------------------------
  // MULTIPLAYER STATE (IN-MEMORY)
  // ----------------------------------------------------
  interface Player {
    id: string;
    username: string;
    score: number;
    hasAnsweredCurrent: boolean;
    isReady?: boolean;
  }
  
  interface Room {
    id: string;
    hostId: string;
    hostUsername?: string;
    subject: string;
    status: "waiting" | "playing" | "finished";
    players: Player[];
    questions: Question[];
    currentQuestionIndex: number;
    questionStartTime: number;
  }
  
  const rooms: Record<string, Room> = {};

  
// Fisher-Yates Shuffle for true randomness
function shuffleArray<T>(array: T[]): T[] {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
}

  function notifyRoomStatus(roomId: string, status?: string) {
    if (!roomId) return;
    const cleanId = roomId.trim().toUpperCase();
    const room = rooms[cleanId] || rooms[roomId];
    let currentStatus = status || (room ? room.status : "closed");
    if (currentStatus === "finished") currentStatus = "closed";

    if (!db.closedRooms || !Array.isArray(db.closedRooms)) {
      db.closedRooms = [];
    }

    if (currentStatus === "closed") {
      if (!db.closedRooms.includes(cleanId)) {
        db.closedRooms.push(cleanId);
      }
      if (roomId && roomId !== cleanId && !db.closedRooms.includes(roomId)) {
        db.closedRooms.push(roomId);
      }
    } else if (currentStatus === "waiting" || currentStatus === "playing") {
      db.closedRooms = db.closedRooms.filter((id: string) => id !== cleanId && id !== roomId);
    }

    if (db.closedRooms.includes(cleanId) && currentStatus !== "closed" && currentStatus !== "waiting" && currentStatus !== "playing") {
      if (!room || (room.status !== "waiting" && room.status !== "playing")) {
        currentStatus = "closed";
      }
    }

    const playersCount = (currentStatus === "closed") ? 0 : (room ? room.players.length : 0);

    // Update in-memory public comments status and save to DB
    let updated = false;
    if (db.publicComments && Array.isArray(db.publicComments)) {
      db.publicComments.forEach((pc: any) => {
        const pcRoomId = pc.roomId ? pc.roomId.trim().toUpperCase() : "";
        const hasMatch = pcRoomId === cleanId || (pc.message && pc.message.toUpperCase().includes(`[${cleanId}]`));
        if (hasMatch) {
          if (pc.roomStatus !== currentStatus) {
            pc.roomStatus = currentStatus;
            updated = true;
          }
        }
      });
    }

    if (updated || currentStatus === "closed" || currentStatus === "waiting" || currentStatus === "playing") {
      saveDb();
    }

    const payload = {
      roomId: cleanId,
      status: currentStatus,
      playersCount,
      questionCount: room?.questions?.length || 0,
      currentQuestionIndex: room?.currentQuestionIndex || 0
    };

    broadcastEvent("room_status_updated", payload);
    broadcastEvent("multiplayer_room_status_changed", payload);

    if (io) {
      io.emit("room_status_updated", payload);
      io.emit("multiplayer_room_status_changed", payload);
    }
  }

  function broadcastRoomState(roomId: string) {
    const cleanRoomId = (roomId || "").toString().trim().toUpperCase();
    const room = rooms[cleanRoomId] || rooms[roomId];
    if (!room) return;
        
    const effectiveStatus = room.status === "finished" ? "closed" : room.status;
    notifyRoomStatus(cleanRoomId, effectiveStatus);
    if (room.status === "finished") {
      io.to(cleanRoomId).emit("room_state", { ...room, serverTime: Date.now() });
      if (roomId && roomId !== cleanRoomId) {
        io.to(roomId).emit("room_state", { ...room, serverTime: Date.now() });
      }
    } else {
      const hiddenRoom = {
        ...room,
        serverTime: Date.now(),
        players: room.players.map(p => ({ ...p, score: 0 }))
      };
      io.to(cleanRoomId).emit("room_state", hiddenRoom);
      if (roomId && roomId !== cleanRoomId) {
        io.to(roomId).emit("room_state", hiddenRoom);
      }
    }
  }

  io.on("connection", (socket) => {
    socket.on("join_room", ({ roomId, username }) => {
      const cleanRoomId = (roomId || "").toString().trim().toUpperCase();
      let room = rooms[cleanRoomId] || rooms[roomId];
      if (!room) {
        return socket.emit("error", { message: "ไม่พบห้องแข่งขันดังกล่าว หรือห้องได้ถูกปิดไปแล้ว" });
      }
      if (room.status !== "waiting") {
        return socket.emit("error", { message: "การแข่งขันได้เริ่มขึ้นแล้ว หรือจบลงแล้ว ไม่สามารถเข้าร่วมได้" });
      }
      
      // Clean up player membership from any other rooms
      for (const rId of Object.keys(rooms)) {
        if (rId !== roomId) {
          const r = rooms[rId];
          if (r) {
            r.players = r.players.filter(p => p.username !== username && p.id !== socket.id);
            if (r.players.length === 0) {
              delete rooms[rId];
              notifyRoomStatus(rId, "closed");
            } else {
              if (r.hostUsername === username || r.hostId === socket.id) {
                r.hostUsername = r.players[0].username;
                r.hostId = r.players[0].id;
              }
              broadcastRoomState(rId);
            }
          }
        }
      }

      socket.join(roomId);
      const isRoomHost = room.hostUsername === username || (!room.hostUsername && room.players[0]?.username === username);
      const existingPlayer = room.players.find(p => p.username === username);
      if (!existingPlayer) {
        room.players.push({
          id: socket.id,
          username,
          score: 0,
          hasAnsweredCurrent: false,
          isReady: isRoomHost ? true : false
        });
      } else {
        existingPlayer.id = socket.id; // Update socket id
        if (!isRoomHost) {
          existingPlayer.isReady = false;
        }
      }

      // Sync host identity if reconnecting
      if (room.hostUsername === username || (!room.hostUsername && room.players[0]?.username === username)) {
        room.hostId = socket.id;
        room.hostUsername = username;
      }
      
      broadcastRoomState(cleanRoomId || roomId);
    });

    socket.on("create_room", ({ roomId, hostId, username, subject, limit = 10 }) => {
      const cleanRoomId = (roomId || "").toString().trim().toUpperCase();
      if (Array.isArray(db.closedRooms)) {
        db.closedRooms = db.closedRooms.filter((id: string) => id !== cleanRoomId);
        saveDb();
      }
      // Clean up any other active/stale rooms for this user or socket
      for (const rId of Object.keys(rooms)) {
        const r = rooms[rId];
        if (r) {
          r.players = r.players.filter(p => p.username !== username && p.id !== socket.id);
          if (r.players.length === 0) {
            delete rooms[rId];
            notifyRoomStatus(rId, "closed");
          } else {
            if (r.hostUsername === username || r.hostId === socket.id) {
              r.hostUsername = r.players[0].username;
              r.hostId = r.players[0].id;
            }
            broadcastRoomState(rId);
          }
        }
      }

      // Validate subject questions
      let selectedQuestions: Question[] = [];
      const numQuestions = Math.max(1, parseInt(limit as any) || 10);
      if (subject === "all") {
        selectedQuestions = shuffleArray([...db.questions]).slice(0, numQuestions);
      } else {
        selectedQuestions = shuffleArray(db.questions.filter(q => q.subject === subject)).slice(0, numQuestions);
      }

      const roomData = {
        id: cleanRoomId || roomId,
        hostId: socket.id,
        hostUsername: username,
        subject,
        status: "waiting",
        players: [{ id: socket.id, username, score: 0, hasAnsweredCurrent: false }],
        questions: selectedQuestions,
        currentQuestionIndex: 0,
        questionStartTime: 0
      };
      
      rooms[cleanRoomId] = roomData;
      if (roomId && roomId !== cleanRoomId) {
        rooms[roomId] = roomData;
      }
      
      socket.join(cleanRoomId);
      if (roomId && roomId !== cleanRoomId) {
        socket.join(roomId);
      }
      broadcastRoomState(cleanRoomId);
    });

    socket.on("start_game", (roomId) => {
      const cleanRoomId = (roomId || "").toString().trim().toUpperCase();
      const room = rooms[cleanRoomId] || rooms[roomId];
      if (room && room.status === "waiting") {
        const player = room.players.find(p => p.id === socket.id);
        const isHost = socket.id === room.hostId || 
                       (player && room.hostUsername && player.username.toLowerCase() === room.hostUsername.toLowerCase()) || 
                       (room.players[0] && (room.players[0].id === socket.id || (player && room.players[0].username.toLowerCase() === player.username.toLowerCase())));
        if (isHost) {
          const participants = room.players.filter(p => {
            const isPHost = p.id === room.hostId || 
                            (room.hostUsername && p.username && p.username.toLowerCase() === room.hostUsername.toLowerCase()) || 
                            (room.players[0] && p.username && p.username.toLowerCase() === room.players[0].username.toLowerCase());
            return !isPHost;
          });
          const allReady = participants.length === 0 || participants.every(p => p.isReady === true);
          if (!allReady) {
            socket.emit("error", { message: "ผู้เล่นทุกคนยังไม่พร้อม กรุณารอให้ทุกคนกดพร้อมก่อนเริ่มการแข่งขัน" });
            return;
          }
          room.status = "playing";
          room.questionStartTime = Date.now();
          notifyRoomStatus(cleanRoomId, "playing");
          broadcastRoomState(cleanRoomId || roomId);
        }
      }
    });

    socket.on("submit_answer", ({ roomId, username, isCorrect, clientTimeSpent }) => {
      const cleanRoomId = (roomId || "").toString().trim().toUpperCase();
      const room = rooms[cleanRoomId] || rooms[roomId];
      if (!room || room.status !== "playing") return;

      const player = room.players.find(p => p.username === username);
      if (player && !player.hasAnsweredCurrent) {
        player.hasAnsweredCurrent = true;
        if (isCorrect) {
          let timeSpentSeconds = (Date.now() - room.questionStartTime) / 1000;
          if (typeof clientTimeSpent === "number" && clientTimeSpent >= 0 && clientTimeSpent <= 130) {
            timeSpentSeconds = clientTimeSpent;
          }
          let points = 100;
          if (timeSpentSeconds > 5) {
            points -= Math.floor(timeSpentSeconds - 5);
          }
          points = Math.max(30, points); // Ensure minimum is 30
          player.score += points;
        }
        
        broadcastRoomState(cleanRoomId || roomId);

        // Check if everyone has answered
        const allAnswered = room.players.every(p => p.hasAnsweredCurrent);
        if (allAnswered) {
          // Advance to next question immediately
          advanceQuestion(cleanRoomId || roomId);
        }
      }
    });

    socket.on("next_question", (roomId) => {
      const cleanRoomId = (roomId || "").toString().trim().toUpperCase();
      advanceQuestion(cleanRoomId || roomId);
    });

    socket.on("end_game", (roomId) => {
      const cleanRoomId = (roomId || "").toString().trim().toUpperCase();
      const room = rooms[cleanRoomId] || rooms[roomId];
      if (room && room.status === "playing") {
        const player = room.players.find(p => p.id === socket.id);
        const isHost = socket.id === room.hostId || (player && player.username === room.hostUsername) || (room.players[0] && room.players[0].id === socket.id);
        if (isHost) {
          room.status = "finished";
          notifyRoomStatus(cleanRoomId, "closed");
          broadcastRoomState(cleanRoomId || roomId);
        }
      }
    });

    socket.on("request_rematch", ({ roomId, username }) => {
      const cleanRoomId = (roomId || "").toString().trim().toUpperCase();
      const room = rooms[cleanRoomId] || rooms[roomId];
      if (!room) return;

      const isHost = room.hostUsername === username || room.hostId === socket.id || (!room.hostUsername && room.players[0]?.username === username);
      if (!isHost) {
        socket.emit("room_error", { message: "รอหัวหน้าห้องกดแข่งขันอีกครั้ง" });
        return;
      }

      // Reselect fresh questions matching the room subject and length
      let selectedQuestions: Question[] = [];
      const numQuestions = Math.max(1, room.questions?.length || 10);
      if (room.subject === "all") {
        selectedQuestions = shuffleArray([...db.questions]).slice(0, numQuestions);
      } else {
        selectedQuestions = shuffleArray(db.questions.filter(q => q.subject === room.subject)).slice(0, numQuestions);
      }
      room.questions = selectedQuestions;
      room.status = "waiting";
      room.currentQuestionIndex = 0;
      room.questionStartTime = 0;

      // Requester becomes or stays host
      const player = room.players.find(p => (username && p.username.toLowerCase() === username.toLowerCase()) || p.id === socket.id);
      if (player) {
        player.id = socket.id;
        room.hostId = socket.id;
        room.hostUsername = username;
      }

      // Reset all player scores, answer flags, and force all players' ready status to false
      room.players.forEach(p => {
        p.score = 0;
        p.hasAnsweredCurrent = false;
        p.isReady = false; // Always require everyone to click ready again!
      });

      // Strictly unclose room and re-open on public board
      if (Array.isArray(db.closedRooms)) {
        db.closedRooms = db.closedRooms.filter((id: string) => id !== cleanRoomId && id !== roomId);
      }
      if (db.publicComments && Array.isArray(db.publicComments)) {
        db.publicComments.forEach((pc: any) => {
          const pcRoomId = pc.roomId ? pc.roomId.trim().toUpperCase() : "";
          const hasMatch = pcRoomId === cleanRoomId || (pc.message && pc.message.toUpperCase().includes(`[${cleanRoomId}]`));
          if (hasMatch) {
            pc.roomStatus = "waiting";
          }
        });
      }
      saveDb();

      // Notify public board to immediately change back to "waiting" ("เปิดรับผู้ท้าชิง")
      notifyRoomStatus(cleanRoomId, "waiting");

      // Send rematch invitation notification to all other clients in the room
      socket.to(cleanRoomId).emit("rematch_invite", {
        fromUsername: username,
        roomId: cleanRoomId || roomId
      });
      if (roomId && roomId !== cleanRoomId) {
        socket.to(roomId).emit("rematch_invite", {
          fromUsername: username,
          roomId: cleanRoomId || roomId
        });
      }

      // Broadcast room state to everyone in the room
      broadcastRoomState(cleanRoomId || roomId);
    });

    socket.on("accept_rematch", ({ roomId, username }) => {
      const cleanRoomId = (roomId || "").toString().trim().toUpperCase();
      const room = rooms[cleanRoomId] || rooms[roomId];
      if (!room) return;
      socket.join(cleanRoomId);
      if (roomId && roomId !== cleanRoomId) socket.join(roomId);
      const player = room.players.find(p => username && p.username.toLowerCase() === username.toLowerCase());
      if (player) {
        player.id = socket.id;
        player.score = 0;
        player.hasAnsweredCurrent = false;
        player.isReady = false; // Reset to false when accepting rematch
      } else {
        room.players.push({
          id: socket.id,
          username,
          score: 0,
          hasAnsweredCurrent: false,
          isReady: false // Reset to false
        });
      }
      broadcastRoomState(cleanRoomId || roomId);
    });

    socket.on("decline_rematch", ({ roomId, username }) => {
      const cleanRoomId = (roomId || "").toString().trim().toUpperCase();
      const room = rooms[cleanRoomId] || rooms[roomId];
      if (room) {
        room.players = room.players.filter(p => p.username !== username && p.id !== socket.id);
        socket.leave(cleanRoomId);
        if (roomId && roomId !== cleanRoomId) socket.leave(roomId);
        if (room.players.length === 0) {
          delete rooms[cleanRoomId];
          delete rooms[roomId];
          notifyRoomStatus(cleanRoomId, "closed");
        } else {
          if (room.hostUsername === username || room.hostId === socket.id) {
            room.hostUsername = room.players[0].username;
            room.hostId = room.players[0].id;
          }
          broadcastRoomState(cleanRoomId || roomId);
        }
      }
    });

    socket.on("toggle_ready", ({ roomId, username, isReady }) => {
      const cleanRoomId = (roomId || "").toString().trim().toUpperCase();
      const room = rooms[cleanRoomId] || rooms[roomId];
      if (room && room.status === "waiting") {
        const player = room.players.find(p => (username && p.username.toLowerCase() === username.toLowerCase()) || p.id === socket.id);
        if (player) {
          player.isReady = Boolean(isReady);
          broadcastRoomState(cleanRoomId || roomId);
        }
      }
    });

    socket.on("kick_player", ({ roomId, targetUsername, hostUsername }) => {
      const cleanRoomId = (roomId || "").toString().trim().toUpperCase();
      const room = rooms[cleanRoomId] || rooms[roomId];
      if (room) {
        const isHost = socket.id === room.hostId || 
                       (room.hostUsername && hostUsername && room.hostUsername.toLowerCase() === hostUsername.toLowerCase()) || 
                       (room.players[0] && (room.players[0].id === socket.id || (hostUsername && room.players[0].username.toLowerCase() === hostUsername.toLowerCase())));
        if (isHost && targetUsername && targetUsername.toLowerCase() !== (room.hostUsername || "").toLowerCase()) {
          const kickedPlayer = room.players.find(p => p.username.toLowerCase() === targetUsername.toLowerCase());
          const kickedSocketId = kickedPlayer?.id;
          
          room.players = room.players.filter(p => p.username.toLowerCase() !== targetUsername.toLowerCase());
          
          if (kickedSocketId) {
            const targetSocket = io.sockets.sockets.get(kickedSocketId);
            if (targetSocket) {
              targetSocket.leave(cleanRoomId);
              if (roomId && roomId !== cleanRoomId) targetSocket.leave(roomId);
            }
            io.to(kickedSocketId).emit("player_kicked", {
              username: targetUsername,
              message: "คุณถูกหัวหน้าห้องเตะออกจากห้องแข่งขัน"
            });
          }
          
          io.to(cleanRoomId).emit("player_kicked", {
            username: targetUsername,
            message: `ผู้เล่น ${targetUsername} ถูกหัวหน้าห้องเตะออกจากห้อง`
          });
          if (roomId && roomId !== cleanRoomId) {
            io.to(roomId).emit("player_kicked", {
              username: targetUsername,
              message: `ผู้เล่น ${targetUsername} ถูกหัวหน้าห้องเตะออกจากห้อง`
            });
          }
          
          broadcastRoomState(cleanRoomId || roomId);
        }
      }
    });

    socket.on("leave_room", ({ roomId, username }) => {
       const cleanRoomId = (roomId || "").toString().trim().toUpperCase();
       const room = rooms[cleanRoomId] || rooms[roomId];
       if (room) {
         room.players = room.players.filter(p => p.username !== username && p.id !== socket.id);
         socket.leave(cleanRoomId);
         if (roomId && roomId !== cleanRoomId) socket.leave(roomId);

         // If the game was already finished OR no players remain, permanently lock card as closed on public board
         if (room.status === "finished" || room.players.length === 0) {
           delete rooms[cleanRoomId];
           delete rooms[roomId];
           if (!db.closedRooms || !Array.isArray(db.closedRooms)) {
             db.closedRooms = [];
           }
           if (!db.closedRooms.includes(cleanRoomId)) {
             db.closedRooms.push(cleanRoomId);
           }
           if (roomId && roomId !== cleanRoomId && !db.closedRooms.includes(roomId)) {
             db.closedRooms.push(roomId);
           }
           if (db.publicComments && Array.isArray(db.publicComments)) {
             db.publicComments.forEach((pc: any) => {
               const pcRoomId = pc.roomId ? pc.roomId.trim().toUpperCase() : "";
               const hasMatch = pcRoomId === cleanRoomId || (pc.message && pc.message.toUpperCase().includes(`[${cleanRoomId}]`));
               if (hasMatch) {
                 pc.roomStatus = "closed";
               }
             });
           }
           saveDb();
           notifyRoomStatus(cleanRoomId, "closed");
         } else {
           if (room.hostUsername === username || room.hostId === socket.id) {
             room.hostUsername = room.players[0].username;
             room.hostId = room.players[0].id;
           }
           broadcastRoomState(cleanRoomId || roomId);
         }
       } else {
         if (!db.closedRooms || !Array.isArray(db.closedRooms)) {
           db.closedRooms = [];
         }
         if (!db.closedRooms.includes(cleanRoomId)) {
           db.closedRooms.push(cleanRoomId);
         }
         if (db.publicComments && Array.isArray(db.publicComments)) {
           db.publicComments.forEach((pc: any) => {
             const pcRoomId = pc.roomId ? pc.roomId.trim().toUpperCase() : "";
             const hasMatch = pcRoomId === cleanRoomId || (pc.message && pc.message.toUpperCase().includes(`[${cleanRoomId}]`));
             if (hasMatch) {
               pc.roomStatus = "closed";
             }
           });
         }
         saveDb();
         notifyRoomStatus(cleanRoomId, "closed");
       }
    });

    socket.on("disconnect", () => {
       for (const rId of Object.keys(rooms)) {
         const r = rooms[rId];
         if (r) {
           const beforeCount = r.players.length;
           r.players = r.players.filter(p => p.id !== socket.id);
           if (r.players.length !== beforeCount) {
             if (r.players.length === 0) {
               delete rooms[rId];
               notifyRoomStatus(rId, "closed");
             } else {
               if (r.hostId === socket.id) {
                 r.hostUsername = r.players[0].username;
                 r.hostId = r.players[0].id;
               }
               broadcastRoomState(rId);
             }
           }
         }
       }
    });
  });

  function advanceQuestion(roomId: string) {
    const cleanRoomId = (roomId || "").toString().trim().toUpperCase();
    const room = rooms[cleanRoomId] || rooms[roomId];
    if (!room || room.status !== "playing") return;

    room.currentQuestionIndex++;
    if (room.currentQuestionIndex >= room.questions.length) {
      room.status = "finished";
      notifyRoomStatus(cleanRoomId, "closed");
    } else {
      room.questionStartTime = Date.now();
      room.players.forEach(p => p.hasAnsweredCurrent = false);
    }
    broadcastRoomState(cleanRoomId || roomId);
  }

  app.get("/api/faqs", (req: Request, res: Response) => {
    if (!db.faqs || !Array.isArray(db.faqs)) {
      db.faqs = [
        { id: "1", question: "วิธีการใช้งานระบบสอบ MT EXAM ทำอย่างไร?", answer: "สามารถเลือกหมวดหมู่ข้อสอบที่ต้องการทำ ฝึกทำโจทย์ หรือสร้างห้องแข่งขันกับเพื่อนได้ทันทีหลังจากเข้าสู่ระบบ" },
        { id: "2", question: "ลืมรหัสผ่านต้องทำอย่างไร?", answer: "สามารถติดต่อแอดมินผ่านช่องทางติดต่อเพื่อขอรีเซ็ตรหัสผ่านได้อย่างรวดเร็ว" },
        { id: "3", question: "คะแนนและสถิติการทำข้อสอบถูกบันทึกไว้อย่างไร?", answer: "ระบบจะบันทึกประวัติการสอบ สถิติความแม่นยำ และคะแนนสะสมในระบบ Leaderboard โดยอัตโนมัติเมื่อเข้าสู่ระบบ" }
      ];
      saveDb();
    }
    res.json(db.faqs);
  });

  app.post("/api/faqs", (req: Request, res: Response) => {
    const { question, answer, adminUser } = req.body;
    if (!question || !answer) {
      return res.status(400).json({ error: "Missing question or answer" });
    }
    if (!db.faqs || !Array.isArray(db.faqs)) {
      db.faqs = [];
    }
    const newFaq = {
      id: Date.now().toString(),
      question: question.trim(),
      answer: answer.trim(),
      createdBy: adminUser || "Admin",
      createdAt: new Date().toISOString()
    };
    db.faqs.push(newFaq);
    saveDb();
    console.log(`[Admin FAQ] Created FAQ ID ${newFaq.id} by ${newFaq.createdBy}`);
    res.json({ success: true, faq: newFaq, faqs: db.faqs });
  });

  app.delete("/api/faqs/:id", (req: Request, res: Response) => {
    const { id } = req.params;
    const adminUser = req.query.adminUser || req.body?.adminUser || "Admin";
    if (db.faqs && Array.isArray(db.faqs)) {
      const initialLength = db.faqs.length;
      db.faqs = db.faqs.filter(f => String(f.id) !== String(id));
      saveDb();
      console.log(`[Admin FAQ] Deleted FAQ ID ${id} by ${adminUser} (Before: ${initialLength}, After: ${db.faqs.length})`);
    }
    res.json({ success: true, faqs: db.faqs || [] });
  });

  // Google Drive Upload Helper
  async function uploadFileToGoogleDrive(
    accessToken: string,
    fileName: string,
    fileType: string,
    fileBuffer: Buffer,
    description?: string
  ): Promise<{ id: string; webViewLink?: string; webContentLink?: string }> {
    const metadata = {
      name: fileName,
      mimeType: fileType || "application/octet-stream",
      description: description || "Uploaded via MT EXAM App"
    };

    const boundary = "-------314159265358979323846";
    const delimiter = "\r\n--" + boundary + "\r\n";
    const close_delim = "\r\n--" + boundary + "--";

    const multipartRequestBody =
      delimiter +
      "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
      JSON.stringify(metadata) +
      delimiter +
      `Content-Type: ${fileType || "application/octet-stream"}\r\n` +
      "Content-Transfer-Encoding: base64\r\n\r\n" +
      fileBuffer.toString("base64") +
      close_delim;

    const response = await fetch(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,webContentLink",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": `multipart/related; boundary="${boundary}"`
        },
        body: multipartRequestBody
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Google Drive API error: ${response.status} - ${errorText}`);
    }

    return response.json();
  }

  // Exam Upload API
  app.post("/api/upload-exam", async (req: Request, res: Response) => {
    try {
      const { senderName, note, fileName, fileType, fileSize, fileDataBase64, googleAccessToken } = req.body;

      if (!fileName || !fileDataBase64) {
        return res.status(400).json({ error: "Missing required file data or file name" });
      }

      if (senderName) {
        const profCheck = checkProfanity(senderName, db.bannedWords);
        if (profCheck.isProfane) {
          return res.status(400).json({ error: "ชื่อผู้ส่งมีคำไม่สุภาพ กรุณาแก้ไข" });
        }
      }

      const uploadsDir = path.join(DATA_DIR, "uploads");
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }

      const uploadId = `upload_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const safeFileName = fileName.replace(/[^a-zA-Z0-9.\-_ก-๙]/g, "_");
      const diskFilePath = path.join(uploadsDir, `${uploadId}_${safeFileName}`);

      const base64Clean = fileDataBase64.includes(",") ? fileDataBase64.split(",")[1] : fileDataBase64;
      const fileBuffer = Buffer.from(base64Clean, "base64");
      fs.writeFileSync(diskFilePath, fileBuffer);

      let driveFileId: string | undefined;
      let driveWebViewLink: string | undefined;
      let driveStatus = "Saved Locally";

      const tokenToUse = googleAccessToken || db.adminGoogleDriveToken;
      if (tokenToUse) {
        try {
          const driveRes = await uploadFileToGoogleDrive(
            tokenToUse,
            `[MT EXAM] ${fileName}`,
            fileType || "application/octet-stream",
            fileBuffer,
            `ผู้ส่ง: ${senderName || "ไม่ระบุชื่อ"} | หมายเหตุ: ${note || "ไม่มี"} | วันที่: ${new Date().toLocaleString("th-TH")}`
          );
          driveFileId = driveRes.id;
          driveWebViewLink = driveRes.webViewLink;
          driveStatus = "Uploaded to Google Drive";
          console.log(`[Exam Upload] File ${fileName} successfully uploaded to Google Drive ID: ${driveFileId}`);
        } catch (driveErr: any) {
          console.error("[Exam Upload] Google Drive upload warning:", driveErr?.message || driveErr);
          driveStatus = `Google Drive Upload Warning: ${driveErr?.message || "Failed"}`;
        }
      }

      if (!db.examUploads || !Array.isArray(db.examUploads)) {
        db.examUploads = [];
      }

      const newUpload = {
        id: uploadId,
        fileName: safeFileName,
        fileType: fileType || "application/octet-stream",
        fileSize: fileSize || fileBuffer.length,
        senderName: (senderName || "ผู้ใช้งาน").trim(),
        note: (note || "").trim(),
        uploadedAt: new Date().toISOString(),
        filePath: diskFilePath,
        driveFileId,
        driveWebViewLink,
        driveStatus
      };

      db.examUploads.unshift(newUpload);
      if (db.examUploads.length > 200) {
        db.examUploads = db.examUploads.slice(0, 200);
      }
      saveDb();

      res.json({
        success: true,
        upload: newUpload,
        message: driveFileId
          ? "ส่งไฟล์ข้อสอบไปยัง Google Drive สำเร็จเรียบร้อยแล้ว!"
          : "ส่งไฟล์ข้อสอบเรียบร้อยแล้ว! (บันทึกในระบบ)"
      });
    } catch (err: any) {
      console.error("[Exam Upload Error]", err);
      res.status(500).json({ error: err?.message || "Failed to upload exam file" });
    }
  });

  // Admin Get Exam Uploads
  app.get("/api/admin/exam-uploads", (req: Request, res: Response) => {
    if (!db.examUploads || !Array.isArray(db.examUploads)) {
      db.examUploads = [];
    }
    res.json({
      success: true,
      uploads: db.examUploads,
      hasAdminDriveToken: !!db.adminGoogleDriveToken
    });
  });

  // Download Exam Upload File
  app.get("/api/exam-uploads/download/:id", (req: Request, res: Response) => {
    const { id } = req.params;
    const upload = db.examUploads?.find(u => u.id === id);
    if (!upload || !upload.filePath || !fs.existsSync(upload.filePath)) {
      return res.status(404).send("File not found");
    }
    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(upload.fileName)}"`);
    res.setHeader("Content-Type", upload.fileType || "application/octet-stream");
    fs.createReadStream(upload.filePath).pipe(res);
  });

  // Admin Delete Exam Upload
  app.delete("/api/admin/exam-uploads/:id", (req: Request, res: Response) => {
    const { id } = req.params;
    if (db.examUploads && Array.isArray(db.examUploads)) {
      const upload = db.examUploads.find(u => u.id === id);
      if (upload && upload.filePath && fs.existsSync(upload.filePath)) {
        try { fs.unlinkSync(upload.filePath); } catch (e) {}
      }
      db.examUploads = db.examUploads.filter(u => u.id !== id);
      saveDb();
    }
    res.json({ success: true, uploads: db.examUploads || [] });
  });

  // Admin Save Google Drive OAuth Token
  app.post("/api/admin/save-google-drive-token", (req: Request, res: Response) => {
    const { accessToken } = req.body;
    db.adminGoogleDriveToken = accessToken || null;
    saveDb();
    res.json({ success: true, hasAdminDriveToken: !!db.adminGoogleDriveToken });
  });

  app.get("/api/backup", (req: Request, res: Response) => {
    res.json({ ...db, passwords });
  });

  app.post("/api/restore", (req: Request, res: Response) => {
    const backupData = req.body;
    if (backupData && typeof backupData === "object") {
      if (backupData.passwords) {
         Object.assign(passwords, backupData.passwords);
         delete backupData.passwords;
      }
      db = { ...db, ...backupData };
      if (!db.faqs || !Array.isArray(db.faqs)) {
        db.faqs = [];
      }
      saveDb();
      res.json({ success: true, faqCount: db.faqs.length });
    } else {
      res.status(400).json({ error: "Invalid backup data" });
    }
  });

  app.post("/api/analyze-error", async (req: Request, res: Response) => {
    try {
      const { step, errorMessage } = req.body;
      if (!process.env.GEMINI_API_KEY) {
        return res.json({ analysis: "⚠️ ไม่พบ GEMINI_API_KEY ในระบบ ไม่สามารถใช้ AI วิเคราะห์ได้ แต่โปรดตรวจสอบข้อผิดพลาดตาม Error Message ด้านบน" });
      }
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const prompt = `ในฐานะผู้เชี่ยวชาญด้านระบบ Full-stack ของแอปพลิเคชัน React+Express (ระบบสอบ)\nเกิดข้อผิดพลาดในขั้นตอนทดสอบ: "${step}"\nError Message: "${errorMessage}"\nโปรดวิเคราะห์สาเหตุที่เป็นไปได้แบบสั้นๆ กระชับ และเสนอแนวทางแก้ไข 1-2 ข้อ (เป็นภาษาไทย)`;
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
      });
      res.json({ analysis: response.text });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/admin/parse-pdf", async (req, res) => {
    try {
      const { pdfBase64 } = req.body;
      if (!pdfBase64) {
        return res.status(400).json({ error: "Missing pdfBase64 in request body" });
      }
      if (!process.env.GEMINI_API_KEY) {
        return res.status(500).json({ error: "Missing GEMINI_API_KEY in server configuration." });
      }

      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const prompt = `คุณคือผู้เชี่ยวชาญด้านการวิเคราะห์และดึงข้อมูลข้อสอบจากไฟล์ PDF
โปรดดึงข้อสอบทั้งหมดออกมา โดยให้แยกแยะองค์ประกอบดังนี้:
1. คำถาม (text)
2. ตัวเลือก (options) ก. ข. ค. ง. จ. หรือ A B C D E (ให้รวมทั้ง text ของตัวเลือก)
3. เฉลย (correctAnswer) ระบุตัวอักษรของคำตอบที่ถูกต้อง (ก, ข, ค, ง, จ หรือ A, B, C, D, E) (ถ้าในไฟล์ไม่ได้ระบุ ให้คุณวิเคราะห์หาคำตอบที่ถูกต้องที่สุดด้วยตัวเอง แต่ถ้ามีให้ใช้ตามไฟล์)
4. หมวดหมู่รายวิชา (subject) เช่น กายวิภาคศาสตร์, สรีรวิทยา, จุลชีววิทยา, ฯลฯ ถ้าหาไม่ได้ให้เดาจากเนื้อหาข้อสอบ หรือใส่ 'ไม่ระบุหมวดหมู่'

คืนค่าเป็นรูปแบบ JSON array ตามโครงสร้างนี้:
[
  {
    "text": "คำถาม...",
    "options": ["ก. ...", "ข. ...", "ค. ...", "ง. ...", "จ. ..."],
    "correctAnswer": "ก",
    "subject": "กายวิภาคศาสตร์"
  }
]
เอาแค่ JSON อย่างเดียว ไม่ต้องมี markdown หรือคำอธิบายเพิ่มเติม`;

      let base64Data = pdfBase64;
      if (pdfBase64.includes(",")) {
        base64Data = pdfBase64.split(",")[1];
      }
      base64Data = base64Data.replace(/[^A-Za-z0-9+/=]/g, "");

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [
          {
            role: "user",
            parts: [
              {
                inlineData: {
                  data: base64Data,
                  mimeType: "application/pdf",
                },
              },
              { text: prompt },
            ],
          },
        ],
        config: {
          responseMimeType: "application/json",
        }
      });

      let resultText = response.text || "[]";
      // Remove markdown code block if present
      if (resultText.startsWith("```")) {
        resultText = resultText.replace(/^```[a-z]*\n/, "").replace(/\n```$/, "");
      }
      try {
        const questions = JSON.parse(resultText);
        res.json({ questions });
      } catch (parseError) {
        res.status(500).json({ error: "Failed to parse AI response as JSON", raw: resultText });
      }
    } catch (err: any) {
      console.error("Error parsing PDF:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // ----------------------------------------------------
  // VITE OR STATIC SERVING
  // ----------------------------------------------------
  const distPath = path.join(process.cwd(), "dist");
  if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
  }

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.get("*", (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }


  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
