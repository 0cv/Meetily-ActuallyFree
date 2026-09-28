/**
 * Starts a recording from anywhere in the app. The recorder page owns the
 * start sequence, so from another page this opens the recorder with a flag it
 * picks up on arrival; on the recorder it starts right away.
 */
import { writePendingGroup, type PendingGroup } from '@/lib/groups';

export const AUTO_START_KEY = 'autoStartRecording';
export const START_RECORDING_EVENT = 'start-recording-from-sidebar';

export function launchRecording(navigate: (href: string) => void, options: { group?: PendingGroup | null } = {}) {
  if (options.group !== undefined) writePendingGroup(options.group);
  if (window.location.pathname === '/') {
    window.dispatchEvent(new CustomEvent(START_RECORDING_EVENT));
    return;
  }
  try {
    sessionStorage.setItem(AUTO_START_KEY, 'true');
  } catch {
    // Without storage the recorder opens and waits for the button.
  }
  navigate('/');
}
