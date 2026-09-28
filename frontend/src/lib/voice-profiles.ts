/**
 * Labs voice profiles: a contact's voice, learned from the call audio of a
 * meeting they spoke in. Later meetings name a matching speaker after them
 * when speakers are identified. Rust keeps each voice under its contact's
 * current name and forgets it when the contact is deleted.
 */
import { invoke } from '@tauri-apps/api/core';

export interface VoiceProfile {
  person_id: string;
  name: string;
  /** Clear turns the voice was learned from. */
  samples: number;
}

export const VOICE_PROFILES_CHANGED_EVENT = 'meetily-voice-profiles-changed';

function announce() {
  window.dispatchEvent(new Event(VOICE_PROFILES_CHANGED_EVENT));
}

export function listVoiceProfiles(): Promise<VoiceProfile[]> {
  return invoke<VoiceProfile[]>('list_voice_profiles');
}

/** From the meeting given, or else the contact's most recent meetings. */
export async function learnContactVoice(personId: string, meetingId?: string): Promise<VoiceProfile> {
  const profile = await invoke<VoiceProfile>('enroll_person_voice', { personId, meetingId: meetingId ?? null });
  announce();
  return profile;
}

/** From one named speaker's lines in a saved meeting. */
export async function learnSpeakerVoice(meetingId: string, speaker: string): Promise<VoiceProfile> {
  const profile = await invoke<VoiceProfile>('enroll_voice_profile', { meetingId, speaker });
  announce();
  return profile;
}

export async function forgetVoice(personId: string): Promise<void> {
  await invoke('delete_voice_profile', { personId });
  announce();
}

export function describeVoiceError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
