/**
 * Feature Flags & Pipeline Cutover Controls
 */

export function isLocalFirstPipelineEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  // Default to enabled, allow override via localStorage if rollback is desired
  const override = localStorage.getItem('kitchflow_local_first_v2');
  if (override === 'false') return false;
  return true;
}

