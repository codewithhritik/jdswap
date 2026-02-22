import type { SourceLayout, TailoredResume } from "./schema";

export interface EditorState {
  resume: TailoredResume | null;
  sourceLayout: SourceLayout | null;
}

export type EditorAction =
  | {
      type: "BULK_REPLACE";
      payload: { resume: TailoredResume | null; sourceLayout: SourceLayout | null };
    }
  | {
      type: "FORM_PATCH";
      payload: { resume: TailoredResume };
    };

export function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case "BULK_REPLACE":
      return {
        ...state,
        resume: action.payload.resume,
        sourceLayout: action.payload.sourceLayout,
      };
    case "FORM_PATCH":
      return {
        ...state,
        resume: action.payload.resume,
      };
    default:
      return state;
  }
}
