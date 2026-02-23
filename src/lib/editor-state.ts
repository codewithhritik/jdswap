import type {
  ParsedResume,
  RewriteTarget,
  SourceLayout,
  TailoredResume,
} from "./schema";

export interface EditorState {
  resume: TailoredResume | null;
  sourceLayout: SourceLayout | null;
  parsed: ParsedResume | null;
  jdText: string | null;
}

export type EditorAction =
  | {
      type: "BULK_REPLACE";
      payload: {
        resume: TailoredResume | null;
        sourceLayout: SourceLayout | null;
        parsed: ParsedResume | null;
        jdText: string | null;
      };
    }
  | {
      type: "FORM_PATCH";
      payload: { resume: TailoredResume };
    }
  | {
      type: "APPLY_REWRITE";
      payload: {
        target: RewriteTarget;
        bullets: Array<{ text: string }>;
      };
    };

export function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case "BULK_REPLACE":
      return {
        ...state,
        resume: action.payload.resume,
        sourceLayout: action.payload.sourceLayout,
        parsed: action.payload.parsed,
        jdText: action.payload.jdText,
      };
    case "FORM_PATCH":
      return {
        ...state,
        resume: action.payload.resume,
      };
    case "APPLY_REWRITE": {
      if (!state.resume) return state;
      const { target, bullets } = action.payload;
      const { section, entryIndex } = target;
      const resume = state.resume;

      if (section === "experience") {
        const entry = resume.experience[entryIndex];
        if (!entry) return state;
        const nextExperience = [...resume.experience];
        if (target.scope === "entry") {
          nextExperience[entryIndex] = { ...entry, bullets: [...bullets] };
          return {
            ...state,
            resume: { ...resume, experience: nextExperience },
          };
        }

        const bulletIndex = target.bulletIndex ?? -1;
        if (
          bulletIndex < 0 ||
          bulletIndex >= entry.bullets.length ||
          bulletIndex >= bullets.length ||
          typeof bullets[bulletIndex]?.text !== "string"
        ) {
          return state;
        }
        const nextBullets = [...entry.bullets];
        nextBullets[bulletIndex] = { text: bullets[bulletIndex]!.text };
        nextExperience[entryIndex] = { ...entry, bullets: nextBullets };
        return {
          ...state,
          resume: { ...resume, experience: nextExperience },
        };
      }

      if (!resume.projects) return state;
      const project = resume.projects[entryIndex];
      if (!project) return state;
      const nextProjects = [...resume.projects];
      if (target.scope === "entry") {
        nextProjects[entryIndex] = { ...project, bullets: [...bullets] };
        return {
          ...state,
          resume: { ...resume, projects: nextProjects },
        };
      }
      const bulletIndex = target.bulletIndex ?? -1;
      if (
        bulletIndex < 0 ||
        bulletIndex >= project.bullets.length ||
        bulletIndex >= bullets.length ||
        typeof bullets[bulletIndex]?.text !== "string"
      ) {
        return state;
      }
      const nextBullets = [...project.bullets];
      nextBullets[bulletIndex] = { text: bullets[bulletIndex]!.text };
      nextProjects[entryIndex] = { ...project, bullets: nextBullets };
      return {
        ...state,
        resume: { ...resume, projects: nextProjects },
      };
    }
    default:
      return state;
  }
}
