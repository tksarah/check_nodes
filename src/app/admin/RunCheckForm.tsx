"use client";

import { Activity, LoaderCircle, Play } from "lucide-react";
import { useEffect, useState } from "react";
import { useFormStatus } from "react-dom";

export function RunCheckForm({ csrfToken }: { csrfToken: string }) {
  const [clicked, setClicked] = useState(false);

  return (
    <form
      action="/api/admin/check"
      method="post"
      onSubmit={() => setClicked(true)}
      style={{ marginTop: 12 }}
    >
      <input type="hidden" name="csrfToken" value={csrfToken} />
      <RunCheckButton clicked={clicked} />
    </form>
  );
}

function RunCheckButton({ clicked }: { clicked: boolean }) {
  const { pending } = useFormStatus();
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!pending) {
      setElapsed(0);
      return;
    }

    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt) / 1000));
    }, 250);

    return () => window.clearInterval(timer);
  }, [pending]);

  if (pending) {
    return (
      <div className="run-check-active" role="status" aria-live="polite">
        <div className="run-check-pulse">
          <LoaderCircle className="spin" size={20} />
        </div>
        <div>
          <strong>Telemetry check is running...</strong>
          <p>Started from Run check now. Waiting for the Astar telemetry snapshot. {elapsed}s</p>
        </div>
      </div>
    );
  }

  return (
    <button className={clicked ? "clicked" : ""} type="submit">
      {clicked ? <Activity size={16} /> : <Play size={16} />}
      {clicked ? "Run check again" : "Run check now"}
    </button>
  );
}
