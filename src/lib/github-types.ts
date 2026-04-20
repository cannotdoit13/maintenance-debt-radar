/** Subset of GitHub's workflow_run webhook payload we care about. */
export interface GitHubWorkflowRunPayload {
  action: "requested" | "in_progress" | "completed";
  workflow_run: {
    id: number;
    name: string;
    head_branch: string;
    conclusion: string | null;
    html_url: string;
    created_at: string;
    updated_at: string;
    repository: {
      full_name: string;
    };
  };
}

export function isWorkflowRunPayload(
  payload: unknown,
): payload is GitHubWorkflowRunPayload {
  if (typeof payload !== "object" || payload === null) return false;
  const p = payload as Record<string, unknown>;
  if (typeof p.action !== "string") return false;
  if (typeof p.workflow_run !== "object" || p.workflow_run === null) return false;

  const wr = p.workflow_run as Record<string, unknown>;
  return (
    typeof wr.id === "number" &&
    typeof wr.conclusion === "string" &&
    typeof wr.repository === "object" &&
    wr.repository !== null &&
    typeof (wr.repository as Record<string, unknown>).full_name === "string"
  );
}
