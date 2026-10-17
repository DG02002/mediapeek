import { ANALYZE_PROGRESS_STREAM_CONTENT_TYPE } from '@mediapeek/shared/analyze-progress';
import type {
  AnalyzeErrorCode,
} from '@mediapeek/shared/analyze-contract';
import type {
  AnalyzeProgressStage,
  AnalyzeStreamErrorEvent,
  AnalyzeStreamProgressEvent,
  AnalyzeStreamSuccessEvent,
} from '@mediapeek/shared/analyze-progress';

type AnalyzeStreamTerminalEvent =
  | AnalyzeStreamErrorEvent
  | AnalyzeStreamSuccessEvent;

const ANALYZE_PROGRESS_STAGES: readonly AnalyzeProgressStage[] = [
  'request_received',
  'source_probe_started',
  'source_probe_completed',
  'initial_fetch_started',
  'waiting_for_first_byte',
  'first_byte_received',
  'initial_segment_reading',
  'no_range_fallback_started',
  'source_range_unsupported',
  'remote_seek_fetch_started',
  'analysis_started',
  'analysis_completed',
];

const ANALYZE_ERROR_CODES: readonly AnalyzeErrorCode[] = [
  'AUTH_REQUIRED',
  'AUTH_INVALID',
  'RATE_LIMITED',
  'VALIDATION_FAILED',
  'CPU_BUDGET_EXCEEDED',
  'UPSTREAM_FETCH_FAILED',
  'INTERNAL_ERROR',
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isAnalyzeProgressStage(
  value: unknown,
): value is AnalyzeProgressStage {
  return (
    typeof value === 'string' &&
    ANALYZE_PROGRESS_STAGES.some((stage) => stage === value)
  );
}

function isAnalyzeErrorCode(value: unknown): value is AnalyzeErrorCode {
  return (
    typeof value === 'string' &&
    ANALYZE_ERROR_CODES.some((code) => code === value)
  );
}

function parseAnalyzeStreamEvent(value: unknown) {
  if (
    !isRecord(value) ||
    typeof value.type !== 'string' ||
    typeof value.requestId !== 'string'
  ) {
    return null;
  }

  if (
    value.type === 'progress' &&
    isAnalyzeProgressStage(value.stage) &&
    typeof value.title === 'string' &&
    typeof value.message === 'string'
  ) {
    const progressEvent: AnalyzeStreamProgressEvent = {
      type: 'progress',
      requestId: value.requestId,
      stage: value.stage,
      title: value.title,
      message: value.message,
    };
    return progressEvent;
  }

  if (value.type === 'success' && isRecord(value.results)) {
    const results: Record<string, string> = {};

    for (const [key, result] of Object.entries(value.results)) {
      if (typeof result !== 'string') {
        return null;
      }

      results[key] = result;
    }

    const successEvent: AnalyzeStreamSuccessEvent = {
      type: 'success',
      requestId: value.requestId,
      results,
    };
    return successEvent;
  }

  if (
    value.type === 'error' &&
    isRecord(value.error) &&
    isAnalyzeErrorCode(value.error.code) &&
    typeof value.error.message === 'string' &&
    typeof value.error.retryable === 'boolean'
  ) {
    const errorEvent: AnalyzeStreamErrorEvent = {
      type: 'error',
      requestId: value.requestId,
      error: {
        code: value.error.code,
        message: value.error.message,
        retryable: value.error.retryable,
      },
    };
    return errorEvent;
  }

  return null;
}

export function isAnalyzeProgressStreamResponse(response: Response): boolean {
  return (
    response.headers
      .get('content-type')
      ?.includes(ANALYZE_PROGRESS_STREAM_CONTENT_TYPE) ?? false
  );
}

export async function readAnalyzeStreamResponse(
  response: Response,
  onProgress: (event: AnalyzeStreamProgressEvent) => void,
): Promise<AnalyzeStreamTerminalEvent> {
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('The analysis response stream has no readable body.');
  }

  const decoder = new TextDecoder();
  let buffer = '';
  const terminalEvents: AnalyzeStreamTerminalEvent[] = [];

  const processLine = (line: string) => {
    const normalizedLine = line.trim();
    if (!normalizedLine) {
      return;
    }

    let parsedValue: unknown;
    try {
      parsedValue = JSON.parse(normalizedLine);
    } catch {
      throw new Error('The analysis response stream contains invalid JSON.');
    }

    const event = parseAnalyzeStreamEvent(parsedValue);
    if (!event) {
      throw new Error('The analysis response stream contains an invalid event.');
    }

    if (terminalEvents.length > 0) {
      throw new Error('The analysis response stream contains multiple results.');
    }

    if (event.type === 'progress') {
      onProgress(event);
      return;
    }

    terminalEvents.push(event);
  };

  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) {
        break;
      }

      buffer += decoder.decode(chunk.value, { stream: true });
      let newlineIndex = buffer.indexOf('\n');
      while (newlineIndex >= 0) {
        processLine(buffer.slice(0, newlineIndex));
        buffer = buffer.slice(newlineIndex + 1);
        newlineIndex = buffer.indexOf('\n');
      }
    }

    buffer += decoder.decode();
    processLine(buffer);

    if (terminalEvents.length === 0) {
      throw new Error('The analysis response stream ended before a result arrived.');
    }

    const terminalEvent = terminalEvents[0];
    if (!terminalEvent) {
      throw new Error('The analysis response stream ended before a result arrived.');
    }

    return terminalEvent;
  } finally {
    reader.releaseLock();
  }
}
