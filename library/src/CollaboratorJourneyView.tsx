"use client";

import { useMemo, useState } from "react";
import { BriefcaseBusiness, ChevronDown, MessageSquareText, Users } from "lucide-react";
import type { ResponsibilityKind, ViewDataset } from "./types";

const roleClass: Record<ResponsibilityKind, string> = {
  Pilote: "role-pilot",
  Contributeur: "role-contributor",
  Validation: "role-validation",
  Consulté: "role-consulted",
};

export function CollaboratorJourneyView({ data }: { data: ViewDataset }) {
  const [currentId, setCurrentId] = useState(data.collaborators[0]?.id ?? "");
  const [selectedProcessId, setSelectedProcessId] = useState<string | null>(null);
  const current = data.collaborators.find((item) => item.id === currentId) ?? data.collaborators[0];

  const responsibilities = useMemo(
    () => data.responsibilities.filter((item) => item.collaboratorId === current?.id),
    [current?.id, data.responsibilities],
  );
  const processes = responsibilities
    .map((responsibility) => ({
      process: data.processes.find((item) => item.id === responsibility.processId),
      responsibility,
    }))
    .filter((item) => item.process);
  const colleagueIds = new Set(
    data.responsibilities
      .filter((item) => processes.some((entry) => entry.process?.id === item.processId))
      .map((item) => item.collaboratorId)
      .filter((id) => id !== current?.id),
  );
  const colleagues = data.collaborators.filter((item) => colleagueIds.has(item.id)).slice(0, 7);
  const selectedProcess = data.processes.find((item) => item.id === selectedProcessId);
  const selectedResponsibilities = data.responsibilities.filter((item) => item.processId === selectedProcessId);

  if (!current) return <div className="empty-state">Ajoutez un collaborateur pour afficher cette vue.</div>;

  return (
    <section className="view-workspace collaborator-workspace">
      <div className="view-toolbar">
        <div><p className="eyebrow">Vue centrée collaborateur</p><h1>Écosystème de collaboration</h1></div>
        <label className="select-control">
          <span>Point de vue</span>
          <div>
            <select value={current.id} onChange={(event) => setCurrentId(event.target.value)}>
              {data.collaborators.map((collaborator) => <option value={collaborator.id} key={collaborator.id}>{collaborator.name}</option>)}
            </select>
            <ChevronDown size={15} aria-hidden="true" />
          </div>
        </label>
      </div>

      <div className="journey-summary">
        <span><BriefcaseBusiness size={15} /> {processes.length} processus</span>
        <span><Users size={15} /> {colleagues.length} collaborateurs liés</span>
        <span><MessageSquareText size={15} /> {responsibilities.length} responsabilités</span>
      </div>

      <div className="galaxy-stage" aria-label={`Écosystème de ${current.name}`}>
        <div className="orbit orbit-one" /><div className="orbit orbit-two" />
        {processes.map(({ process, responsibility }, index) => {
          if (!process) return null;
          const angle = -90 + (360 / Math.max(processes.length, 1)) * index;
          return (
            <button key={process.id} className={`galaxy-node process-node ${selectedProcessId === process.id ? "is-selected" : ""}`} style={{ "--angle": `${angle}deg` } as React.CSSProperties} onClick={() => setSelectedProcessId(process.id)}>
              <span className={`responsibility-dot ${roleClass[responsibility.kind]}`} />
              <strong>{process.name}</strong><small>{responsibility.kind}</small>
            </button>
          );
        })}
        {colleagues.map((colleague, index) => {
          const angle = -65 + (310 / Math.max(colleagues.length, 1)) * index;
          const shared = data.responsibilities.filter((item) => item.collaboratorId === colleague.id && processes.some((entry) => entry.process?.id === item.processId)).length;
          return (
            <div key={colleague.id} className="galaxy-node colleague-node" style={{ "--angle": `${angle}deg` } as React.CSSProperties} title={`${colleague.name} · ${shared} processus partagés`}>
              <span>{colleague.initials}</span><small>{colleague.name.split(" ")[0]}</small>
            </div>
          );
        })}
        <div className="galaxy-center">
          <div className="center-avatar">{current.initials}</div><strong>{current.name}</strong><span>{current.role}</span>
        </div>
      </div>

      {selectedProcess && (
        <aside className="context-panel">
          <button className="panel-close" onClick={() => setSelectedProcessId(null)} aria-label="Fermer le détail">×</button>
          <p className="eyebrow">Processus sélectionné</p><h2>{selectedProcess.name}</h2><span className="status-chip">{selectedProcess.status}</span>
          <div className="panel-section"><h3>Équipe associée</h3>
            {selectedResponsibilities.map((responsibility) => {
              const collaborator = data.collaborators.find((item) => item.id === responsibility.collaboratorId);
              return collaborator ? <div className="person-row" key={responsibility.id}><span className="mini-avatar">{collaborator.initials}</span><div><strong>{collaborator.name}</strong><small>{responsibility.kind}</small></div></div> : null;
            })}
          </div>
        </aside>
      )}
    </section>
  );
}
