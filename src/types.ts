/**
 * MT EXAM - Shared Types & Interfaces
 */

export const DEFAULT_SUBJECTS: string[] = [
  'วิชาชีพกฎหมายและจรรยาบรรณวิชาชีพ มาตรฐานงานวิชาชีพ เทคนิคการแพทย์',
  'วิชาเคมีคลินิก',
  'วิชาจุลชีววิทยา',
  'วิชาธนาคารโลหิต',
  'วิชาภูมิคุ้มกันวิทยา',
  'วิชาจุลทรรศน์ศาสตร์และปรสิตวิทยา',
  'วิชาโลหิตวิทยา'
];
export const FIXED_SUBJECTS = DEFAULT_SUBJECTS;

export type Subject = string;

export interface Question {
  id: string;
  subject: Subject;
  question: string;
  options: [string, string, string, string, string]; // Exactly 5 options
  correctAnswer: number; // Index 0 to 4
  createdAt: string;
  createdBy: string;
  status?: 'pending' | 'approved';
}

export interface CommentReport {
  id: string;
  questionId: string;
  questionText: string;
  subject: Subject;
  username: string;
  comment: string;
  createdAt: string;
  status: 'pending' | 'reviewed' | 'resolved';
  adminReply?: string;
  repliedAt?: string;
}

export type UserCategory = 'student' | 'medtech_student' | 'medtech' | 'exam_prep' | 'general' | 'highschool';

export interface User {
  username: string;
  displayName?: string;
  role: 'admin' | 'user';
  createdAt: string;
  lastLoginAt: string;
  password?: string;
  mustChangePassword?: boolean;
  userCategory?: UserCategory | string;
  studentYear?: 'ปี 1' | 'ปี 2' | 'ปี 3' | 'ปี 4' | 'อื่น ๆ' | string;
  faculty?: string;
  university?: string;
  optOutLeaderboard?: boolean;
  interestMedTech?: 'สนใจเรียนเทคนิคการแพทย์' | 'ยังไม่สนใจ' | string;
}


export interface ScoreHistory {
  id: string;
  username: string;
  subject: string;
  totalAttempted: number;
  totalCorrect: number;
  percentage: number;
  passed: boolean;
  incorrectQuestionIds?: string[];
  timestamp: string;
}

export interface SubjectStructureConfig {
  morningCount: number;
  afternoonCount: number;
  morningOrder: number;
  afternoonOrder: number;
}

export interface SubjectBreakdown {
  subject: string;
  total: number;
  correct: number;
  percentage: number;
}

export interface ExamSummaryData {
  totalAttempted: number;
  totalCorrect: number;
  percentage: number;
  passed: boolean;
  incorrectQuestionIds?: string[]; // >= 60%
  subject: string;
  message: string;
  subjectBreakdown?: SubjectBreakdown[];
}

export interface SystemStats {
  totalQuestions: number;
  questionsBySubject: Record<string, number>;
  totalUsers: number;
    totalComments: number;
  pendingComments: number;
}

export interface UserNotification {
  id: string;
  targetUser: string;
  commentId?: string;
  questionId?: string;
  questionText?: string;
  commentText?: string;
  adminReply?: string;
  createdAt: string;
  read: boolean;
  type?: 'reply' | 'mention';
  senderDisplayName?: string;
  messageId?: string;
}

export interface PublicComment {
  id: string;
  username: string;
  displayName?: string;
  message: string;
  createdAt: string;
  role?: 'admin' | 'user' | 'guest';
  isAdmin?: boolean;
  readBy?: string[];
  roomId?: string;
  roomSubject?: string;
  roomQuestionCount?: number;
  isRoomInvite?: boolean;
}


export const FACULTY_OPTIONS: string[] = [
  'คณะแพทยศาสตร์',
  'คณะทันตแพทยศาสตร์',
  'คณะเภสัชศาสตร์',
  'คณะพยาบาลศาสตร์',
  'คณะสัตวแพทยศาสตร์',
  'คณะสหเวชศาสตร์',
  'คณะสาธารณสุขศาสตร์',
  'คณะวิศวกรรมศาสตร์',
  'คณะสถาปัตยกรรมศาสตร์',
  'คณะบริหารธุรกิจ / พาณิชยศาสตร์และการบัญชี',
  'คณะนิติศาสตร์',
  'คณะเศรษฐศาสตร์',
  'คณะอักษรศาสตร์ / ศิลปศาสตร์ / มนุษยศาสตร์',
  'คณะนิเทศศาสตร์ / วารสารศาสตร์',
  'คณะวิทยาศาสตร์',
  'คณะครุศาสตร์ / ศึกษาศาสตร์',
  'คณะศิลปกรรมศาสตร์ / วิจิตรศิลป์',
  'คณะเทคโนโลยีสารสนเทศ / วิทยาการคอมพิวเตอร์',
  'อื่นๆ (โปรดระบุ)'
];

export const UNIVERSITY_OPTIONS: string[] = [
  'จุฬาลงกรณ์มหาวิทยาลัย',
  'มหาวิทยาลัยมหิดล',
  'มหาวิทยาลัยธรรมศาสตร์',
  'มหาวิทยาลัยเกษตรศาสตร์',
  'มหาวิทยาลัยเชียงใหม่',
  'มหาวิทยาลัยขอนแก่น',
  'มหาวิทยาลัยสงขลานครินทร์',
  'มหาวิทยาลัยศรีนครินทรวิโรฒ',
  'มหาวิทยาลัยศิลปากร',
  'มหาวิทยาลัยบูรพา',
  'มหาวิทยาลัยนเรศวร',
  'มหาวิทยาลัยอุบลราชธานี',
  'มหาวิทยาลัยมหาสารคาม',
  'มหาวิทยาลัยแม่โจ้',
  'มหาวิทยาลัยแม่ฟ้าหลวง',
  'สถาบันเทคโนโลยีพระจอมเกล้าเจ้าคุณทหารลาดกระบัง (KMITL)',
  'มหาวิทยาลัยเทคโนโลยีพระจอมเกล้าธนบุรี (KMUTT)',
  'มหาวิทยาลัยเทคโนโลยีพระจอมเกล้าพระนครเหนือ (KMUTNB)',
  'มหาวิทยาลัยเทคโนโลยีสุรนารี',
  'มหาวิทยาลัยวลัยลักษณ์',
  'มหาวิทยาลัยกรุงเทพ',
  'มหาวิทยาลัยรังสิต',
  'มหาวิทยาลัยหอการค้าไทย',
  'มหาวิทยาลัยธุรกิจบัณฑิตย์',
  'มหาวิทยาลัยศรีปทุม',
  'มหาวิทยาลัยหัวเฉียวเฉลิมพระเกียรติ',
  'มหาวิทยาลัยราชภัฏ',
  'มหาวิทยาลัยเทคโนโลยีราชมงคล',
  'อื่นๆ (โปรดระบุ)'
];

export interface Announcement {
  id: string;
  text?: string;
  imageUrl?: string;
  createdAt: string;
}
