export interface TextDiff {
  path: string;
  before: string;
  after: string;
}

export function computeTextDiff(before: string, after: string): TextDiff {
  return { path: "", before, after };
}
