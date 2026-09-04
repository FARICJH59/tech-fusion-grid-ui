import { notFound } from "next/navigation";
import { loadRuntime } from "@/lib/hoare/deployment/runtime-store";

export const dynamic = "force-dynamic";

export default async function OwnedRuntimePage({
  params,
}: {
  params: Promise<{ deploymentId: string }>;
}) {
  const { deploymentId } = await params;
  const runtime = await loadRuntime(deploymentId);
  if (!runtime) notFound();

  const page = runtime.workspace.files.find((file) => file.path === "frontend/app/page.tsx");
  const title = runtime.workspace.files.find((file) => file.path === "application.manifest.json");
  const applicationName = runtime.runtime.applicationId;

  return (
    <main style={{ fontFamily: "system-ui", maxWidth: 960, margin: "0 auto", padding: 40 }}>
      <p>HOARE Owned Runtime</p>
      <h1>{applicationName}</h1>
      <p>Deployment: {runtime.manifest.deploymentId}</p>
      <p>Release: {runtime.manifest.releaseDigest}</p>
      <p>Workspace digest: {runtime.workspace.digest}</p>
      <p>Generated frontend: {page ? "ready" : "missing"}</p>
      <p>Application manifest: {title ? "ready" : "missing"}</p>
    </main>
  );
}
