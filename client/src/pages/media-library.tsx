import { useEffect } from "react";
import { useLocation } from "wouter";
import DashboardLayout from "@/components/dashboard-layout";
import { MediaLibrary } from "@/components/media-library";
import { SEO } from "@/components/seo";
import { useAuth } from "@/lib/auth";

export default function MediaLibraryPage({ role }: { role: "creator" | "institute" }) {
  const { user, token, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && (!user || !token)) setLocation("/login");
  }, [isLoading, user, token, setLocation]);

  if (!user) return null;

  return (
    <DashboardLayout
      role={role}
      title="Media library"
      description="Upload once, inspect every file, and reuse it across your Octamy workspace."
      breadcrumbs={[{ label: "Workspace" }, { label: "Media library" }]}
    >
      <SEO title="Media library" description="Manage reusable media in your Octamy workspace." path={`/${role}/media`} noIndex />
      <MediaLibrary />
    </DashboardLayout>
  );
}
