import {
  Subject,
  Topic,
  Assignment,
  StudySession,
  StudyPreferences,
  UserProfile,
} from '../types';
import {
  DEMO_USER,
  DEMO_SUBJECTS,
  DEMO_TOPICS,
  DEMO_ASSIGNMENTS,
  DEMO_PREFERENCES,
  generateInitialSessions,
} from './demoData';
import { getSupabaseClient, isSupabaseConfigured } from './supabase';

const STORAGE_PREFIX = 'study_planner_';

const getStorageKey = (userId: string, entity: string) =>
  `${STORAGE_PREFIX}${userId}_${entity}`;

// Local storage helpers
export const loadLocalData = <T>(userId: string, entity: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(getStorageKey(userId, entity));
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error(`Failed to read ${entity} from localStorage:`, e);
  }
  return fallback;
};

export const saveLocalData = <T>(userId: string, entity: string, data: T): void => {
  try {
    localStorage.setItem(getStorageKey(userId, entity), JSON.stringify(data));
  } catch (e) {
    console.error(`Failed to save ${entity} to localStorage:`, e);
  }
};

// Storage Service with Dual Backend (Supabase or Local Persistence)
export const StorageService = {
  // --- Profiles ---
  async getProfile(userId: string): Promise<UserProfile | null> {
    const supabase = getSupabaseClient();
    if (supabase && isSupabaseConfigured()) {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single();
        if (!error && data) return data as UserProfile;
      } catch (err) {
        console.warn('Supabase fetch profile failed, using local:', err);
      }
    }
    return loadLocalData<UserProfile | null>(userId, 'profile', null);
  },

  async saveProfile(profile: UserProfile): Promise<void> {
    saveLocalData(profile.id, 'profile', profile);
    const supabase = getSupabaseClient();
    if (supabase && isSupabaseConfigured()) {
      try {
        await supabase.from('profiles').upsert(profile);
      } catch (err) {
        console.warn('Supabase save profile failed:', err);
      }
    }
  },

  // --- Subjects ---
  async getSubjects(userId: string): Promise<Subject[]> {
    const supabase = getSupabaseClient();
    if (supabase && isSupabaseConfigured()) {
      try {
        const { data, error } = await supabase
          .from('subjects')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false });
        if (!error && data) return data as Subject[];
      } catch (err) {
        console.warn('Supabase getSubjects failed, fallback local:', err);
      }
    }
    return loadLocalData<Subject[]>(userId, 'subjects', []);
  },

  async saveSubject(userId: string, subject: Subject): Promise<Subject> {
    const subjects = loadLocalData<Subject[]>(userId, 'subjects', []);
    const index = subjects.findIndex((s) => s.id === subject.id);
    let updated: Subject[];
    if (index >= 0) {
      updated = [...subjects];
      updated[index] = subject;
    } else {
      updated = [subject, ...subjects];
    }
    saveLocalData(userId, 'subjects', updated);

    const supabase = getSupabaseClient();
    if (supabase && isSupabaseConfigured()) {
      try {
        await supabase.from('subjects').upsert(subject);
      } catch (err) {
        console.warn('Supabase saveSubject failed:', err);
      }
    }
    return subject;
  },

  async deleteSubject(userId: string, subjectId: string): Promise<void> {
    const subjects = loadLocalData<Subject[]>(userId, 'subjects', []).filter(
      (s) => s.id !== subjectId
    );
    saveLocalData(userId, 'subjects', subjects);

    // Cascade local topics & assignments & sessions
    const topics = loadLocalData<Topic[]>(userId, 'topics', []).filter(
      (t) => t.subject_id !== subjectId
    );
    saveLocalData(userId, 'topics', topics);

    const assignments = loadLocalData<Assignment[]>(userId, 'assignments', []).filter(
      (a) => a.subject_id !== subjectId
    );
    saveLocalData(userId, 'assignments', assignments);

    const sessions = loadLocalData<StudySession[]>(userId, 'sessions', []).filter(
      (s) => s.subject_id !== subjectId
    );
    saveLocalData(userId, 'sessions', sessions);

    const supabase = getSupabaseClient();
    if (supabase && isSupabaseConfigured()) {
      try {
        await supabase.from('subjects').delete().eq('id', subjectId).eq('user_id', userId);
      } catch (err) {
        console.warn('Supabase deleteSubject failed:', err);
      }
    }
  },

  // --- Topics ---
  async getTopics(userId: string): Promise<Topic[]> {
    const supabase = getSupabaseClient();
    if (supabase && isSupabaseConfigured()) {
      try {
        const { data, error } = await supabase
          .from('topics')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false });
        if (!error && data) return data as Topic[];
      } catch (err) {
        console.warn('Supabase getTopics failed, fallback local:', err);
      }
    }
    return loadLocalData<Topic[]>(userId, 'topics', []);
  },

  async saveTopic(userId: string, topic: Topic): Promise<Topic> {
    const topics = loadLocalData<Topic[]>(userId, 'topics', []);
    const index = topics.findIndex((t) => t.id === topic.id);
    let updated: Topic[];
    if (index >= 0) {
      updated = [...topics];
      updated[index] = topic;
    } else {
      updated = [topic, ...topics];
    }
    saveLocalData(userId, 'topics', updated);

    const supabase = getSupabaseClient();
    if (supabase && isSupabaseConfigured()) {
      try {
        await supabase.from('topics').upsert(topic);
      } catch (err) {
        console.warn('Supabase saveTopic failed:', err);
      }
    }
    return topic;
  },

  async deleteTopic(userId: string, topicId: string): Promise<void> {
    const topics = loadLocalData<Topic[]>(userId, 'topics', []).filter(
      (t) => t.id !== topicId
    );
    saveLocalData(userId, 'topics', topics);

    const supabase = getSupabaseClient();
    if (supabase && isSupabaseConfigured()) {
      try {
        await supabase.from('topics').delete().eq('id', topicId).eq('user_id', userId);
      } catch (err) {
        console.warn('Supabase deleteTopic failed:', err);
      }
    }
  },

  // --- Assignments ---
  async getAssignments(userId: string): Promise<Assignment[]> {
    const supabase = getSupabaseClient();
    if (supabase && isSupabaseConfigured()) {
      try {
        const { data, error } = await supabase
          .from('assignments')
          .select('*')
          .eq('user_id', userId)
          .order('due_date', { ascending: true });
        if (!error && data) return data as Assignment[];
      } catch (err) {
        console.warn('Supabase getAssignments failed, fallback local:', err);
      }
    }
    return loadLocalData<Assignment[]>(userId, 'assignments', []);
  },

  async saveAssignment(userId: string, assignment: Assignment): Promise<Assignment> {
    const assignments = loadLocalData<Assignment[]>(userId, 'assignments', []);
    const index = assignments.findIndex((a) => a.id === assignment.id);
    let updated: Assignment[];
    if (index >= 0) {
      updated = [...assignments];
      updated[index] = assignment;
    } else {
      updated = [assignment, ...assignments];
    }
    saveLocalData(userId, 'assignments', updated);

    const supabase = getSupabaseClient();
    if (supabase && isSupabaseConfigured()) {
      try {
        await supabase.from('assignments').upsert(assignment);
      } catch (err) {
        console.warn('Supabase saveAssignment failed:', err);
      }
    }
    return assignment;
  },

  async deleteAssignment(userId: string, assignmentId: string): Promise<void> {
    const assignments = loadLocalData<Assignment[]>(userId, 'assignments', []).filter(
      (a) => a.id !== assignmentId
    );
    saveLocalData(userId, 'assignments', assignments);

    const supabase = getSupabaseClient();
    if (supabase && isSupabaseConfigured()) {
      try {
        await supabase.from('assignments').delete().eq('id', assignmentId).eq('user_id', userId);
      } catch (err) {
        console.warn('Supabase deleteAssignment failed:', err);
      }
    }
  },

  // --- Study Sessions ---
  async getStudySessions(userId: string): Promise<StudySession[]> {
    const supabase = getSupabaseClient();
    if (supabase && isSupabaseConfigured()) {
      try {
        const { data, error } = await supabase
          .from('study_sessions')
          .select('*')
          .eq('user_id', userId)
          .order('date', { ascending: true })
          .order('start_time', { ascending: true });
        if (!error && data) return data as StudySession[];
      } catch (err) {
        console.warn('Supabase getStudySessions failed, fallback local:', err);
      }
    }
    return loadLocalData<StudySession[]>(userId, 'sessions', []);
  },

  async saveStudySession(userId: string, session: StudySession): Promise<StudySession> {
    const sessions = loadLocalData<StudySession[]>(userId, 'sessions', []);
    const index = sessions.findIndex((s) => s.id === session.id);
    let updated: StudySession[];
    if (index >= 0) {
      updated = [...sessions];
      updated[index] = session;
    } else {
      updated = [...sessions, session];
    }
    saveLocalData(userId, 'sessions', updated);

    const supabase = getSupabaseClient();
    if (supabase && isSupabaseConfigured()) {
      try {
        await supabase.from('study_sessions').upsert(session);
      } catch (err) {
        console.warn('Supabase saveStudySession failed:', err);
      }
    }
    return session;
  },

  async saveBulkStudySessions(userId: string, newSessions: StudySession[], replaceFromDate?: string): Promise<StudySession[]> {
    let existing = loadLocalData<StudySession[]>(userId, 'sessions', []);
    if (replaceFromDate) {
      // Keep sessions prior to replaceFromDate or completed ones
      existing = existing.filter((s) => s.date < replaceFromDate || s.status === 'Completed');
    }
    const combined = [...existing, ...newSessions];
    saveLocalData(userId, 'sessions', combined);

    const supabase = getSupabaseClient();
    if (supabase && isSupabaseConfigured()) {
      try {
        if (replaceFromDate) {
          await supabase
            .from('study_sessions')
            .delete()
            .eq('user_id', userId)
            .gte('date', replaceFromDate)
            .neq('status', 'Completed');
        }
        await supabase.from('study_sessions').upsert(newSessions);
      } catch (err) {
        console.warn('Supabase saveBulkStudySessions failed:', err);
      }
    }
    return combined;
  },

  async deleteStudySession(userId: string, sessionId: string): Promise<void> {
    const sessions = loadLocalData<StudySession[]>(userId, 'sessions', []).filter(
      (s) => s.id !== sessionId
    );
    saveLocalData(userId, 'sessions', sessions);

    const supabase = getSupabaseClient();
    if (supabase && isSupabaseConfigured()) {
      try {
        await supabase.from('study_sessions').delete().eq('id', sessionId).eq('user_id', userId);
      } catch (err) {
        console.warn('Supabase deleteStudySession failed:', err);
      }
    }
  },

  // --- Study Preferences ---
  async getStudyPreferences(userId: string): Promise<StudyPreferences> {
    const supabase = getSupabaseClient();
    if (supabase && isSupabaseConfigured()) {
      try {
        const { data, error } = await supabase
          .from('study_preferences')
          .select('*')
          .eq('user_id', userId)
          .single();
        if (!error && data) return data as StudyPreferences;
      } catch (err) {
        console.warn('Supabase getStudyPreferences failed:', err);
      }
    }
    return loadLocalData<StudyPreferences>(userId, 'preferences', {
      ...DEMO_PREFERENCES,
      user_id: userId,
    });
  },

  async saveStudyPreferences(userId: string, preferences: StudyPreferences): Promise<StudyPreferences> {
    saveLocalData(userId, 'preferences', preferences);
    const supabase = getSupabaseClient();
    if (supabase && isSupabaseConfigured()) {
      try {
        await supabase.from('study_preferences').upsert(preferences);
      } catch (err) {
        console.warn('Supabase saveStudyPreferences failed:', err);
      }
    }
    return preferences;
  },

  // --- Seed Demo Data for a User ---
  async seedDemoData(userId: string): Promise<void> {
    const userProfile: UserProfile = {
      ...DEMO_USER,
      id: userId,
    };
    const subjects = DEMO_SUBJECTS.map((s) => ({ ...s, user_id: userId }));
    const topics = DEMO_TOPICS.map((t) => ({ ...t, user_id: userId }));
    const assignments = DEMO_ASSIGNMENTS.map((a) => ({ ...a, user_id: userId }));
    const sessions = generateInitialSessions().map((s) => ({ ...s, user_id: userId }));
    const preferences: StudyPreferences = {
      ...DEMO_PREFERENCES,
      user_id: userId,
    };

    saveLocalData(userId, 'profile', userProfile);
    saveLocalData(userId, 'subjects', subjects);
    saveLocalData(userId, 'topics', topics);
    saveLocalData(userId, 'assignments', assignments);
    saveLocalData(userId, 'sessions', sessions);
    saveLocalData(userId, 'preferences', preferences);

    // If Supabase is connected, seed there too
    const supabase = getSupabaseClient();
    if (supabase && isSupabaseConfigured()) {
      try {
        await supabase.from('profiles').upsert(userProfile);
        await supabase.from('subjects').upsert(subjects);
        await supabase.from('topics').upsert(topics);
        await supabase.from('assignments').upsert(assignments);
        await supabase.from('study_sessions').upsert(sessions);
        await supabase.from('study_preferences').upsert(preferences);
      } catch (e) {
        console.warn('Supabase seed demo data partial/error:', e);
      }
    }
  },

  // Reset all student data
  async resetUserData(userId: string): Promise<void> {
    ['profile', 'subjects', 'topics', 'assignments', 'sessions', 'preferences'].forEach(
      (key) => {
        localStorage.removeItem(getStorageKey(userId, key));
      }
    );
  },
};
