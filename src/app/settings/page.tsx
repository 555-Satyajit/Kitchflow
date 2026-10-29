import { Suspense } from 'react';
import { SettingsClientView, SettingsSkeleton } from './components/settings-client-view';
import { getOrganizationKitchensAction, getStaffMembersAction } from '@/actions/settings';
import { requirePermission } from '@/lib/session';

export const metadata = {
  title: 'Kitchen & Outlet Settings | KitchFlow',
  description: 'Manage physical kitchen outlets, staff logins, tax compliance, and brand-wise invoice customizations.',
};

export default function SettingsPage() {
  return (
    <div className="min-h-screen bg-muted/20 pb-24 lg:pb-12 pt-4 px-3 sm:px-6 max-w-5xl mx-auto space-y-6">
      <Suspense fallback={<SettingsSkeleton />}>
        <SettingsSection />
      </Suspense>
    </div>
  );
}

async function SettingsSection() {
  await requirePermission('settings');

  const [kitchensRes, staffRes] = await Promise.all([
    getOrganizationKitchensAction(),
    getStaffMembersAction(),
  ]);

  const initialKitchensData = kitchensRes.ok && kitchensRes.data ? kitchensRes.data : undefined;
  const initialStaffData = staffRes.ok && staffRes.data ? staffRes.data : undefined;

  return (
    <SettingsClientView
      initialKitchensData={initialKitchensData}
      initialStaffData={initialStaffData}
    />
  );
}
