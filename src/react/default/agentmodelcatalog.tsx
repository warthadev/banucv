import React from "react";
import { getAgentModelClassification, isLocalInferenceAgentModel } from "@config/agentmodes";
import type { AgentModel } from "@config/agentmodels";

type AgentModelCatalogProps = {
  models: AgentModel[];
  isLoading: boolean;
  error: string | null;
};

const AgentModelCatalog: React.FC<AgentModelCatalogProps> = ({ models, isLoading, error }) => {
  const cloudModels = models.filter((model) => !isLocalInferenceAgentModel(model.id));
  const groups = [
    { title: "Thinking", models: cloudModels.filter((model) => getAgentModelClassification(model.id, cloudModels) === "Thinking") },
    { title: "Fast (reasoning:false)", models: cloudModels.filter((model) => getAgentModelClassification(model.id, cloudModels) === "Fast") },
    { title: "Other / unclassified", models: cloudModels.filter((model) => getAgentModelClassification(model.id, cloudModels) === "Other / unclassified") },
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
          <span>{cloudModels.length} {cloudModels.length === 1 ? "model" : "models"} in this account&apos;s cloud catalog</span>
          {cloudModels.length === 0 ? (
            <span>This account&apos;s cloud model catalog is empty; global models are not shown.</span>
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
