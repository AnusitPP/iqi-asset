import { AuthenticatedWorkspace } from '@/components/layout/workspace';
import { PortalHomePage } from '@/features/home/home-page';
export default function HomePage() {
  return (
    <AuthenticatedWorkspace>
      <PortalHomePage />
    </AuthenticatedWorkspace>
  );
}
