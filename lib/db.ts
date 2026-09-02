import { supabase } from './supabase'
import { SessionResult } from '@/components/GameScreen'

export async function saveGameSession(
  patientId: string, 
  results: SessionResult[],
  metadata?: {
    mood_reported?: string;
    did_breathing_exercise?: boolean;
    loops_completed?: number;
  }
) {
  // 1. Insert the main session
  const totalScore = results.filter((r) => r.isCorrect).length

  const { data: sessionData, error: sessionError } = await supabase
    .from('game_sessions')
    .insert({
      patient_id: patientId,
      total_score: totalScore,
      results_jsonb: results, // Storing JSON block for convenience
      mood_reported: metadata?.mood_reported,
      did_breathing_exercise: metadata?.did_breathing_exercise,
      loops_completed: metadata?.loops_completed,
    })
    .select('id')
    .single()

  if (sessionError || !sessionData) {
    console.error('Error saving session:', sessionError)
    throw new Error('Failed to save session')
  }

  // 2. Insert normalized round results
  const roundInserts = results.map((r) => ({
    session_id: sessionData.id,
    round_id: r.roundId,
    domain: r.domain,
    chosen_answer: r.chosenAnswer,
    correct_answer: r.correctAnswer,
    is_correct: r.isCorrect,
    reaction_time_ms: r.reactionTimeMs,
    physical_gesture_confirmed: r.physicalGestureConfirmed,
  }))

  const { error: resultsError } = await supabase
    .from('session_results')
    .insert(roundInserts)

  if (resultsError) {
    console.error('Error saving session results:', resultsError)
    throw new Error('Failed to save session results')
  }

  return sessionData.id
}

export async function fetchPatientHistory(patientId: string) {
  const { data, error } = await supabase
    .from('game_sessions')
    .select(`
      id,
      patient_id,
      completed_at,
      total_score,
      results_jsonb,
      mood_reported,
      did_breathing_exercise,
      loops_completed
    `)
    .eq('patient_id', patientId)
    .order('completed_at', { ascending: false })

  if (error) {
    console.error('Error fetching history:', error)
    return []
  }

  return data.map((session: any) => ({
    id: session.id,
    patientId: session.patient_id,
    completedAt: session.completed_at,
    totalScore: session.total_score,
    results: session.results_jsonb || [],
    moodReported: session.mood_reported,
    didBreathingExercise: session.did_breathing_exercise,
    loopsCompleted: session.loops_completed
  }))
}

export async function fetchPatientStreak(patientId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('current_streak, longest_streak, last_session_date')
    .eq('id', patientId)
    .single();

  if (error || !data) return null;
  return data;
}

export async function updatePatientStreak(patientId: string) {
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('current_streak, longest_streak, last_session_date')
    .eq('id', patientId)
    .single();

  if (profileError || !profile) {
    console.error('Error fetching profile for streak:', profileError);
    return null;
  }

  // Get local date string in YYYY-MM-DD format (ignoring time)
  const today = new Date();
  const todayStr = new Date(today.getTime() - (today.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
  
  const lastSessionStr = profile.last_session_date;

  let newCurrentStreak = profile.current_streak || 0;
  let newLongestStreak = profile.longest_streak || 0;
  let isNewDay = false;

  if (lastSessionStr === todayStr) {
    // Already played today.
    return { current_streak: newCurrentStreak, longest_streak: newLongestStreak, is_new_day: false, was_protected: false };
  }

  isNewDay = true;
  let wasProtected = false;

  if (lastSessionStr) {
    const todayDate = new Date(todayStr);
    const lastSessionDate = new Date(lastSessionStr);
    const diffTime = Math.abs(todayDate.getTime() - lastSessionDate.getTime());
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 1) {
      newCurrentStreak += 1;
    } else if (diffDays === 2) {
      // 2 days difference - streak protection (grace period)
      newCurrentStreak += 1;
      wasProtected = true;
    } else {
      // > 2 days difference - reset
      newCurrentStreak = 1;
    }
  } else {
    // First time playing
    newCurrentStreak = 1;
  }

  if (newCurrentStreak > newLongestStreak) {
    newLongestStreak = newCurrentStreak;
  }

  const { data: updated, error: updateError } = await supabase
    .from('profiles')
    .update({
      current_streak: newCurrentStreak,
      longest_streak: newLongestStreak,
      last_session_date: todayStr
    })
    .eq('id', patientId)
    .select('current_streak, longest_streak')
    .single();

  if (updateError) {
    console.error('Error updating streak:', updateError);
    return null;
  }

  return { ...updated, is_new_day: isNewDay, was_protected: wasProtected };
}

export async function fetchPatientPreferences(patientId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('preferences')
    .eq('id', patientId)
    .single();

  if (error || !data) return {};
  return data.preferences || {};
}

export async function savePatientPreferences(patientId: string, preferences: any) {
  const { data, error } = await supabase
    .from('profiles')
    .update({ preferences })
    .eq('id', patientId)
    .select('preferences')
    .single();

  if (error) {
    console.error('Error saving preferences:', error);
    throw error;
  }
  return data.preferences;
}

