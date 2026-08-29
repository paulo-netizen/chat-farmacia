export type PharmaceuticalD2SpanResolutionStageV2 =
  | 'EXCERPT_VALIDATION'
  | 'OCCURRENCE_ENUMERATION'
  | 'OCCURRENCE_SELECTION'
  | 'SLICE_VERIFICATION';

export type PharmaceuticalD2SpanResolutionMetadataV2 = Readonly<{
  excerptLength: number;
  occurrenceIndex: number;
  exactOccurrenceCount: number;
  boundsValid: boolean;
  resolutionStage: PharmaceuticalD2SpanResolutionStageV2;
}>;

export class PharmaceuticalD2SpanResolutionErrorV2 extends Error {
  constructor(
    public readonly path: 'excerpt' | 'occurrenceIndex',
    message: string,
    public readonly metadata: PharmaceuticalD2SpanResolutionMetadataV2,
  ) {
    super(message);
    this.name = 'PharmaceuticalD2SpanResolutionErrorV2';
  }
}

export type PharmaceuticalD2ResolvedLiteralSpanV2 = Readonly<{
  excerptStart: number;
  excerptEnd: number;
}>;

export function enumerateExactPharmaceuticalD2OccurrencesV2(
  originalMessage: string,
  excerpt: string,
): readonly number[] {
  if (excerpt.length === 0) return Object.freeze([]);
  const occurrences: number[] = [];
  let fromIndex = 0;
  while (fromIndex <= originalMessage.length - excerpt.length) {
    const occurrence = originalMessage.indexOf(excerpt, fromIndex);
    if (occurrence < 0) break;
    occurrences.push(occurrence);
    fromIndex = occurrence + 1;
  }
  return Object.freeze(occurrences);
}

export function resolvePharmaceuticalD2LiteralSpanV2(
  originalMessage: string,
  excerpt: string,
  occurrenceIndex: number,
): PharmaceuticalD2ResolvedLiteralSpanV2 {
  if (excerpt.length === 0) {
    throw new PharmaceuticalD2SpanResolutionErrorV2(
      'excerpt',
      'must be a non-empty literal excerpt',
      Object.freeze({
        excerptLength: 0,
        occurrenceIndex,
        exactOccurrenceCount: 0,
        boundsValid: false,
        resolutionStage: 'EXCERPT_VALIDATION',
      }),
    );
  }
  const occurrences = enumerateExactPharmaceuticalD2OccurrencesV2(originalMessage, excerpt);
  if (occurrences.length === 0) {
    throw new PharmaceuticalD2SpanResolutionErrorV2(
      'excerpt',
      'must occur literally in the original student message',
      Object.freeze({
        excerptLength: excerpt.length,
        occurrenceIndex,
        exactOccurrenceCount: 0,
        boundsValid: false,
        resolutionStage: 'OCCURRENCE_ENUMERATION',
      }),
    );
  }
  if (!Number.isInteger(occurrenceIndex) || occurrenceIndex < 0 || occurrenceIndex >= occurrences.length) {
    throw new PharmaceuticalD2SpanResolutionErrorV2(
      'occurrenceIndex',
      'must select an existing zero-based exact excerpt occurrence',
      Object.freeze({
        excerptLength: excerpt.length,
        occurrenceIndex,
        exactOccurrenceCount: occurrences.length,
        boundsValid: false,
        resolutionStage: 'OCCURRENCE_SELECTION',
      }),
    );
  }
  const excerptStart = occurrences[occurrenceIndex];
  const excerptEnd = excerptStart + excerpt.length;
  if (originalMessage.slice(excerptStart, excerptEnd) !== excerpt) {
    throw new PharmaceuticalD2SpanResolutionErrorV2(
      'excerpt',
      'resolved span must equal the exact excerpt',
      Object.freeze({
        excerptLength: excerpt.length,
        occurrenceIndex,
        exactOccurrenceCount: occurrences.length,
        boundsValid: true,
        resolutionStage: 'SLICE_VERIFICATION',
      }),
    );
  }
  return Object.freeze({ excerptStart, excerptEnd });
}
