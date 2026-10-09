import { mkdirSync, openSync, closeSync, writeSync, fsyncSync, readFileSync, unlinkSync, realpathSync } from 'node:fs';
import { isAbsolute, join, resolve } from 'node:path';
import { covHash, covReservationMicroUsd, validateCovGrant, type CovGrant, type CovManifest } from './cov-experiment-policy';
import { validateCovR2Grant, type CovR2Grant } from './cov-r2-diagnostic-policy';
import { validateCovContinuationGrant, type CovContinuationGrant } from './cov-continuation-policy';

export type CovSafeMetadata = { responseId?: string; requestId?: string; inputTokens?: number;
  outputTokens?: number; cachedTokens?: number; cacheWriteTokens?: number; reasoningTokens?: number };
/** Positive projection only. Never serialize an error, SDK object, headers, or raw content. */
export function covSafeMetadata(value: unknown): CovSafeMetadata {
  if (!value || typeof value !== 'object') return {};
  const x = value as Record<string, unknown>, usage = x.usage as Record<string, unknown> | undefined;
  const result: CovSafeMetadata = {};
  if (typeof x.id === 'string' && /^resp_[a-zA-Z0-9_-]{1,100}$/.test(x.id)) result.responseId = x.id;
  const requestId = x._request_id ?? x.request_id;
  if (typeof requestId === 'string' && /^req_[a-zA-Z0-9_-]{1,100}$/.test(requestId)) result.requestId = requestId;
  const input = usage?.input_tokens_details as Record<string, unknown> | undefined;
  const output = usage?.output_tokens_details as Record<string, unknown> | undefined;
  for (const [key, number] of Object.entries({ inputTokens: usage?.input_tokens, outputTokens: usage?.output_tokens,
    cachedTokens: input?.cached_tokens, cacheWriteTokens: input?.cache_write_tokens, reasoningTokens: output?.reasoning_tokens })) {
    if (typeof number === 'number' && Number.isSafeInteger(number) && number >= 0) Object.assign(result, { [key]: number });
  }
  return result;
}
type Event = { kind: 'INIT' | 'RESERVED' | 'METADATA' | 'RESULT' | 'STOP'; id?: string; data: unknown };
type RecordLine = { seq: number; previous: string; event: Event; checksum: string };
const sessions = new WeakSet<CovExecutionSession>();

/** Single-host, append-only, fsync-before-send. A stale lock is NEVER stolen automatically. */
export class CovExecutionSession {
  private grant: CovGrant | CovR2Grant | CovContinuationGrant;
  private fd = -1;
  private lockFd = -1;
  private lockPath = '';
  private chain = '0'.repeat(64);
  private sequence = 0;
  private reserved = new Set<string>();
  private results = new Map<string, unknown>();
  private spent = 0;
  private activeId: string | undefined;
  private closed = false;
  private failed = false;
  private busy = false;
  private constructor(grant: CovGrant | CovR2Grant | CovContinuationGrant) { this.grant = grant; }

  static open(authorization: unknown, manifest: CovManifest): CovExecutionSession {
    return this.openValidated(validateCovGrant(authorization, manifest));
  }
  static openR2Diagnostic(authorization: unknown, manifest: CovManifest): CovExecutionSession {
    return this.openValidated(validateCovR2Grant(authorization, manifest));
  }
  static openContinuation(authorization: unknown, manifest: CovManifest): CovExecutionSession {
    return this.openValidated(validateCovContinuationGrant(authorization, manifest));
  }
  private static openValidated(grant: CovGrant | CovR2Grant | CovContinuationGrant): CovExecutionSession {
    if (!isAbsolute(grant.ledgerDirectory)) throw new Error('COV_LEDGER_PATH_INVALID');
    const directory = resolve(grant.ledgerDirectory);
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    if (realpathSync(directory).toLowerCase() !== directory.toLowerCase()) throw new Error('COV_LEDGER_PATH_INVALID');
    const session = new CovExecutionSession(grant);
    session.lockPath = join(directory, 'execution.lock');
    try { session.lockFd = openSync(session.lockPath, 'wx', 0o600); }
    catch { throw new Error('COV_LEDGER_LOCKED'); }
    try {
      fsyncSync(session.lockFd);
      const path = join(directory, 'journal.jsonl');
      session.fd = openSync(path, 'a+', 0o600);
      const text = readFileSync(session.fd, 'utf8');
      if (text && !text.endsWith('\n')) throw new Error('COV_JOURNAL_INVALID');
      const expectedInit = covHash(grant);
      for (const line of text.split('\n').filter(Boolean)) {
        const record: RecordLine = JSON.parse(line);
        const { checksum, ...unsigned } = record;
        if (record.seq !== session.sequence || record.previous !== session.chain || checksum !== covHash(unsigned)) throw new Error('COV_JOURNAL_INVALID');
        const e = record.event;
        if (record.seq === 0 && (e.kind !== 'INIT' || e.data !== expectedInit)) throw new Error('COV_JOURNAL_AUTHORIZATION_MISMATCH');
        session.apply(e);
        session.chain = checksum; session.sequence++;
      }
      if (!text) session.append({ kind: 'INIT', data: expectedInit });
      if ([...session.reserved].some(id => !session.results.has(id))) session.failed = true;
      sessions.add(session);
      return session;
    } catch {
      session.close(); throw new Error('COV_JOURNAL_UNAVAILABLE_OR_INVALID');
    }
  }
  static isAuthorized(value: unknown): value is CovExecutionSession {
    return value instanceof CovExecutionSession && sessions.has(value) && !value.closed;
  }
  private apply(event: Event) {
    if (event.kind === 'RESERVED') {
      const count = this.grant.inputCounts[this.reserved.size];
      if (!count || event.id !== count.id || this.reserved.has(count.id) || event.data !== covReservationMicroUsd(count.inputTokens)) throw new Error('COV_JOURNAL_INVALID');
      this.reserved.add(count.id); this.spent += event.data as number;
    } else if (event.kind === 'RESULT') {
      if (!event.id || !this.reserved.has(event.id) || this.results.has(event.id)) throw new Error('COV_JOURNAL_INVALID');
      this.results.set(event.id, event.data);
      // A crash between RESULT and STOP must not turn a technical failure into permission to continue.
      if ((event.data as { result?: { status?: string } } | null)?.result?.status === 'TECHNICAL_FAILURE') this.failed = true;
    } else if (event.kind === 'STOP') this.failed = true;
    else if (event.kind !== 'INIT' && event.kind !== 'METADATA') throw new Error('COV_JOURNAL_INVALID');
  }
  private append(event: Event) {
    if (this.closed) throw new Error('COV_SESSION_CLOSED');
    const unsigned = { seq: this.sequence, previous: this.chain, event };
    const checksum = covHash(unsigned), bytes = Buffer.from(JSON.stringify({ ...unsigned, checksum }) + '\n');
    try {
      let offset = 0;
      while (offset < bytes.length) { const written = writeSync(this.fd, bytes, offset, bytes.length - offset); if (!written) throw new Error(); offset += written; }
      fsyncSync(this.fd);
      this.apply(event); this.sequence++; this.chain = checksum;
    } catch { this.failed = true; throw new Error('COV_JOURNAL_WRITE_FAILED'); }
  }
  reserve(requestHash: string, config: unknown): void {
    if (!CovExecutionSession.isAuthorized(this) || this.failed || this.busy || this.activeId ||
      Date.parse(this.grant.expiresAt) <= Date.now() || covHash(config) !== covHash(this.grant.config)) throw new Error('COV_EXECUTION_BLOCKED');
    const next = this.grant.inputCounts[this.reserved.size];
    if (!next || next.requestHash !== requestHash) throw new Error('COV_REQUEST_NOT_AUTHORIZED');
    if (this.grant.version === 'cov-literal-continuation-authorization/1' && next.id !== 'R2' &&
      (this.results.get('R2') as { result?: { status?: string } } | undefined)?.result?.status !== 'REVIEW_REQUIRED') throw new Error('COV_R2_TECHNICAL_GATE_REQUIRED');
    const amount = covReservationMicroUsd(next.inputTokens);
    if (this.spent + amount > this.grant.budgetMicroUsd) { this.stop(); throw new Error('COV_BUDGET_INSUFFICIENT'); }
    this.busy = true;
    try { this.append({ kind: 'RESERVED', id: next.id, data: amount }); this.activeId = next.id; }
    finally { this.busy = false; }
  }
  metadata(value: unknown) {
    if (!this.activeId) throw new Error('COV_RESERVATION_REQUIRED');
    const metadata = covSafeMetadata(value);
    this.append({ kind: 'METADATA', id: this.activeId, data: metadata });
    const count = this.grant.inputCounts.find(c => c.id === this.activeId)!;
    if ((metadata.inputTokens !== undefined && metadata.inputTokens > count.inputTokens) ||
      (metadata.outputTokens !== undefined && metadata.outputTokens > this.grant.config.maxOutputTokens)) {
      this.stop(); throw new Error('COV_USAGE_EXCEEDS_RESERVATION');
    }
  }
  result(id: string, structuredEvaluation: unknown) {
    if (id !== this.activeId) throw new Error('COV_RESERVATION_REQUIRED');
    this.append({ kind: 'RESULT', id, data: structuredClone(structuredEvaluation) }); this.activeId = undefined;
  }
  stop() { this.failed = true; this.append({ kind: 'STOP', id: this.activeId, data: 'COV_EXECUTION_STOPPED' }); }
  get stopped() { return this.failed; }
  get reservedMicroUsd() { return this.spent; }
  saved(id: string): unknown { return structuredClone(this.results.get(id)); }
  close() {
    if (this.closed) return;
    this.closed = true; sessions.delete(this);
    if (this.fd >= 0) closeSync(this.fd);
    if (this.lockFd >= 0) { closeSync(this.lockFd); unlinkSync(this.lockPath); }
  }
}
