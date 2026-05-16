import { cookies } from "next/headers";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Clock, Plus, Save, ShieldCheck, Trash2, XCircle } from "lucide-react";
import { ADMIN_COOKIE } from "@/lib/config";
import { getAdminCsrfToken, isAdminAuthenticated } from "@/lib/auth";
import { getDashboardData } from "@/lib/repository";
import { formatDateTime } from "@/lib/format";
import { RunCheckForm } from "./RunCheckForm";
import { SubmitButton } from "./SubmitButton";

export const dynamic = "force-dynamic";

export default async function AdminPage({
  searchParams
}: {
  searchParams?: Promise<{ check?: string; message?: string }>;
}) {
  const authed = await isAdminAuthenticated();
  const params = await searchParams;

  if (!authed) {
    return <Login />;
  }

  const { nodes, checkIntervalMinutes, lastCheckRun } = await getDashboardData();
  const csrfToken = await getAdminCsrfToken();

  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand">
          <img
            className="brand-symbol"
            src="/brand/astar-symbol-color.png"
            alt="Astar"
          />
          <div>
          <p className="eyebrow">Protected</p>
          <h1>Admin Console</h1>
          <p className="muted">Node registration and scheduler controls.</p>
          </div>
        </div>
        <nav className="nav">
          <Link className="button" href="/">
            <ArrowLeft size={16} />
            Dashboard
          </Link>
          <form action="/api/admin/logout" method="post">
            <input type="hidden" name="csrfToken" value={csrfToken} />
            <button type="submit">Logout</button>
          </form>
        </nav>
      </header>

      {params?.check === "success" ? (
        <div className="notice success">
          <CheckCircle2 size={20} />
          <div>
            <strong>Manual check completed.</strong>
            <p className="muted">
              Latest run: {formatDateTime(lastCheckRun?.checked_at)}
            </p>
          </div>
        </div>
      ) : null}

      {params?.check === "error" ? (
        <div className="notice error">
          <XCircle size={20} />
          <div>
            <strong>Manual check failed.</strong>
            <p className="muted">{params.message ?? lastCheckRun?.error_message ?? "Unknown error"}</p>
          </div>
        </div>
      ) : null}

      {params?.check === "running" ? (
        <div className="notice warning">
          <Clock size={20} />
          <div>
            <strong>Telemetry check is already running.</strong>
            <p className="muted">
              Another worker or manual check has the lock. No duplicate sample was written.
            </p>
          </div>
        </div>
      ) : null}

      <section className="forms">
        <div className="card">
          <h2>Add node pattern</h2>
          <form className="form-grid" action="/api/admin/nodes" method="post">
            <input type="hidden" name="csrfToken" value={csrfToken} />
            <label>
              Label
              <input name="label" placeholder="Astar archive Tokyo" required />
            </label>
            <label>
              Telemetry name pattern
              <input name="namePattern" placeholder="astar-archive" required />
            </label>
            <SubmitButton className="primary" pendingLabel="Adding...">
              <Plus size={16} />
              Add node
            </SubmitButton>
          </form>
        </div>

        <div className="card">
          <h2>Scheduler</h2>
          <p className="muted">
            Last check: {formatDateTime(lastCheckRun?.checked_at)}
            {lastCheckRun?.status ? ` / ${lastCheckRun.status}` : ""}
          </p>
          <form className="form-grid" action="/api/admin/settings" method="post">
            <input type="hidden" name="csrfToken" value={csrfToken} />
            <label>
              Check interval
              <select name="checkIntervalMinutes" defaultValue={checkIntervalMinutes}>
                <option value="60">60 minutes</option>
                <option value="180">180 minutes</option>
                <option value="360">360 minutes</option>
                <option value="720">720 minutes</option>
              </select>
            </label>
            <SubmitButton className="primary" pendingLabel="Saving...">
              Save interval
            </SubmitButton>
          </form>
          <RunCheckForm csrfToken={csrfToken} />
        </div>
      </section>

      <section className="panel" style={{ marginTop: 16 }}>
        <div className="panel-header">
          <h2>Registered nodes</h2>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Label</th>
                <th>Pattern</th>
                <th>Enabled</th>
                <th>Save</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {nodes.map((node) => (
                <tr key={node.id}>
                  <td>
                    <form
                      id={`edit-node-${node.id}`}
                      action={`/api/admin/nodes/${node.id}`}
                      method="post"
                    >
                      <input type="hidden" name="action" value="update" />
                      <input type="hidden" name="csrfToken" value={csrfToken} />
                      <input name="label" defaultValue={node.label} required />
                    </form>
                  </td>
                  <td>
                    <input
                      form={`edit-node-${node.id}`}
                      name="namePattern"
                      defaultValue={node.namePattern}
                      required
                    />
                  </td>
                  <td>{node.enabled ? "Yes" : "No"}</td>
                  <td>
                    <SubmitButton
                      className="primary"
                      pendingLabel="Saving..."
                      form={`edit-node-${node.id}`}
                    >
                      <Save size={16} />
                      Save
                    </SubmitButton>
                  </td>
                  <td>
                    <div className="actions">
                      <form action={`/api/admin/nodes/${node.id}/toggle`} method="post">
                        <input type="hidden" name="csrfToken" value={csrfToken} />
                        <input
                          type="hidden"
                          name="enabled"
                          value={node.enabled ? "false" : "true"}
                        />
                        <SubmitButton pendingLabel="Updating...">
                          {node.enabled ? "Disable" : "Enable"}
                        </SubmitButton>
                      </form>
                      <form action={`/api/admin/nodes/${node.id}`} method="post">
                        <input type="hidden" name="action" value="delete" />
                        <input type="hidden" name="csrfToken" value={csrfToken} />
                        <SubmitButton pendingLabel="Deleting...">
                          <Trash2 size={16} />
                          Delete
                        </SubmitButton>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

async function Login() {
  const store = await cookies();
  const failed = store.get(ADMIN_COOKIE)?.value === "failed";

  return (
    <main className="shell">
      <section className="card" style={{ maxWidth: 460, margin: "80px auto 0" }}>
        <img
          className="login-logo"
          src="/brand/astar-color-white.png"
          alt="Astar"
        />
        <p className="eyebrow">Admin login</p>
        <h1>
          <ShieldCheck size={32} /> Protected controls
        </h1>
        <p className="muted">Dashboard viewing is public. Management requires ADMIN_PASSWORD.</p>
        <form className="form-grid" action="/api/admin/login" method="post">
          <label>
            Password
            <input name="password" type="password" required />
          </label>
          {failed ? <p style={{ color: "var(--red)" }}>Invalid password.</p> : null}
          <SubmitButton className="primary" pendingLabel="Logging in...">
            Login
          </SubmitButton>
        </form>
      </section>
    </main>
  );
}
