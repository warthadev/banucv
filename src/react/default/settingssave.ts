export type SettingsSaveSectionId = "github" | "openrouter" | "cloudmanager";

export type SettingsSaveStatus = "saved" | "unchanged" | "error";

export interface SettingsSaveResult {
  sectionId: SettingsSaveSectionId;
  sectionName: string;
  status: SettingsSaveStatus;
  message: string;
}

export type SettingsSaveHandler = () => Promise<SettingsSaveResult>;

export type RegisterSettingsSaveHandler = (
  sectionId: SettingsSaveSectionId,
  handler: SettingsSaveHandler | null,
) => void;
