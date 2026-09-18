/**
 * Pure helpers for reconciling a saved audio-device preference against the
 * devices currently reported by the backend.
 *
 * Kept out of the component so they can be unit tested without React or Tauri.
 */

export interface AudioDeviceOption {
  name: string;
  device_type: 'Input' | 'Output';
}

/** The option value a device renders as, and the string persisted in preferences. */
export const toDeviceOptionValue = (d: AudioDeviceOption) =>
  `${d.name} (${d.device_type.toLowerCase()})`;

export const UNAVAILABLE_DEVICE_VALUE = '__saved_device__';

/**
 * Value a device <Select> should display for a saved preference.
 *
 * A saved string matching no <SelectItem> makes Radix render a BLANK trigger:
 * the placeholder only shows for '' or undefined, and a stale preference is
 * neither. The component renders a disabled item for UNAVAILABLE_DEVICE_VALUE.
 * Keeping it distinct from 'default' lets an explicit Default selection clear
 * the preference, while merely disconnecting a device never writes it away.
 *
 * Display-only on purpose — it never writes, so the saved preference survives a
 * device being temporarily absent and returns when the device does.
 */
export function deviceSelectValue(saved: string | null, available: string[]): string {
  if (!saved) return 'default';
  return available.includes(saved) ? saved : UNAVAILABLE_DEVICE_VALUE;
}

/** "JBL Tune 770NC (System Audio) (output)" -> "JBL Tune 770NC (System Audio)" */
export function deviceDisplayName(stored: string): string {
  return stored.replace(/\s*\((input|output)\)$/i, '');
}
