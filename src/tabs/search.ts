import { peekTab } from './peek.js';

export interface SearchInput {
  window: number;
  tab: number;
  pattern: string;
  regex?: boolean;
  tailLines?: number;
}

export interface SearchMatch {
  lineNumber: number;
  text: string;
}

export interface SearchResult {
  matches: SearchMatch[];
  lineCount: number;
  searchedLineCount: number;
  error?: string;
}

function splitLines(contents: string): string[] {
  const lines = contents.split('\n');
  if (lines[lines.length - 1] === '') lines.pop();
  return lines;
}

function compileMatcher(pattern: string, regex?: boolean): { matcher: (line: string) => boolean; error?: undefined } | { matcher?: undefined; error: string } {
  if (!regex) {
    return { matcher: (line: string) => line.includes(pattern) };
  }
  try {
    const compiled = new RegExp(pattern);
    return { matcher: (line: string) => compiled.test(line) };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return { error: `invalid regex: ${reason}` };
  }
}

export async function searchTab(input: SearchInput): Promise<SearchResult> {
  const peek = await peekTab(input.window, input.tab);
  const allLines = splitLines(peek.contents);
  const boundedLines = input.tailLines !== undefined && input.tailLines > 0
    ? allLines.slice(-input.tailLines)
    : allLines;
  const lineOffset = allLines.length - boundedLines.length;
  const compiled = compileMatcher(input.pattern, input.regex);

  if (!compiled.matcher) {
    return {
      matches: [],
      lineCount: peek.lineCount,
      searchedLineCount: boundedLines.length,
      error: compiled.error,
    };
  }
  const matcher = compiled.matcher;

  return {
    matches: boundedLines
      .map((text, index) => ({ lineNumber: lineOffset + index + 1, text }))
      .filter((line) => matcher(line.text)),
    lineCount: peek.lineCount,
    searchedLineCount: boundedLines.length,
  };
}
