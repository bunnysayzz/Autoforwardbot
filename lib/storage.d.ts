export function loadChannels(): Promise<string[]>;
export function saveChannels(channels: string[]): Promise<void>;
export function addChannel(channelId: string): Promise<void>;
export function removeChannel(channelId: string): Promise<void>;
export function loadFooter(): Promise<string>;
export function saveFooter(text: string): Promise<void>;
export function clearFooter(): Promise<void>;

// Database initialization
export function initializeDb(): Promise<void>;
export function initializeSchedulingDb(): Promise<void>;

// Scheduled posts
export interface ScheduledPost {
  _id: string;
  userId: string;
  messageType: 'text' | 'photo' | 'video' | 'document' | 'audio' | 'voice' | 'animation';
  content: string;
  fileId?: string;
  caption?: string;
  createdAt: string;
  title?: string;
}

export function saveScheduledPost(post: Omit<ScheduledPost, '_id' | 'createdAt'>): Promise<string>;
export function getUserScheduledPosts(userId: string): Promise<ScheduledPost[]>;
export function getScheduledPostsByIds(postIds: string[]): Promise<ScheduledPost[]>;
export function deleteScheduledPost(postId: string, userId: string): Promise<boolean>;

// User schedules
export interface UserSchedule {
  _id: string;
  userId: string;
  times: string[];
  postIds: string[];
  postsPerTime: number;
  isActive: boolean;
  createdAt: string;
  lastExecuted?: string;
}

export function saveUserSchedule(schedule: Omit<UserSchedule, '_id' | 'createdAt'>): Promise<string>;
export function getUserSchedules(userId: string): Promise<UserSchedule[]>;
export function getAllActiveSchedules(): Promise<UserSchedule[]>;
export function updateScheduleLastExecuted(scheduleId: string): Promise<void>;
export function deleteUserSchedule(scheduleId: string, userId: string): Promise<boolean>;
export function toggleScheduleStatus(scheduleId: string, userId: string): Promise<boolean>;

// User states
export interface UserState {
  _id: string;
  currentFlow?: 'schedule_setup' | 'post_management' | 'time_input' | 'post_selection';
  tempData?: any;
  lastActivity: string;
}

export function saveUserState(userId: string, state: Omit<UserState, '_id' | 'lastActivity'>): Promise<void>;
export function getUserState(userId: string): Promise<UserState | null>;
export function clearUserState(userId: string): Promise<void>;
export function cleanOldUserStates(): Promise<void>; 