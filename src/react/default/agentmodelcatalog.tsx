import React from "react";
import { getAgentModelClassification } from "@config/agentmodes";
import type { AgentModel } from "@config/agentmodels";

type AgentModelCatalogProps = {
  models: AgentModel[];
  isLoading: boolean;
  error: string | null;
};

const AgentModelCatalog: React.FC<AgentModelCatalogProps> = ({ models, isLoading, error }) => {
  const groups = [
    { title: "Thinking", models: models.filter((model) => getAgentModelClassification(model.id, models) === "Thinking") },
    { title: "Fast (reasoning:false)", models: models.filter((model) => getAgentModelClassification(model.id, models) === "Fast") },
    { title: "Other / unclassified", models: models.filter((model) => getAgentModelClassification(model.id, models) === "Other / unclassified") },
    { title: "Local models", models: models.filter((model) => getAgentModelClassification(model.id, models) === "Local") },
  ];

  return (
    <div className="setting-agent-catalog" role="status" aria-busy={isLoading}>
      <strong>Models available to this account</strong>
      {isLoading ? (
        <span>Loading this account&apos;s model catalog…</span>
      ) : error ? (
        <span className="setting-agent-error-text">Failed to load this account&apos;s model catalog: {error}</span>
      ) : (
        <>
          <span>{models.length} {models.length === 1 ? "model" : "models"} in this account&apos;s catalog</span>
          {models.length === 0 ? (
            <span>This account&apos;s model catalog is empty; global models are not shown.</span>
          ) : (
            <div className="setting-agent-model-groups">
              {groups.filter((group) => group.models.length > 0).map((group) => (
                <div className="setting-agent-model-group" key={group.title}>
                  <span>{group.title}</span>
                  <ul className="setting-agent-model-list" aria-label={`${group.title} available to this account`}>
                    {group.models.map((model) => <li key={model.id}>{model.id}</li>)}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default AgentModelCatalog;
