import type { ReactNode } from "react";

export function Section({
  id,
  title,
  note,
  children,
}: {
  id: string;
  title: string;
  note?: string;
  children: ReactNode;
}) {
  return (
    <section data-testid={id} className="card">
      <h2>{title}</h2>
      {note ? <p className="note">{note}</p> : null}
      <div className="demo">{children}</div>
    </section>
  );
}
