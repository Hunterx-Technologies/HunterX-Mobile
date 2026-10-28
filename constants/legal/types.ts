/** A legal page (Disclaimer, Terms, Privacy…) shown by LegalDocumentModal. */
export interface LegalSection {
  heading: string;
  paragraphs: string[];
  /** Bullet list shown after the paragraphs. */
  bullets?: string[];
  /** Paragraph shown after the bullets. */
  footer?: string;
}

export interface LegalDocument {
  title: string;
  /** Human-readable date, e.g. "27 October 2026". */
  lastUpdated: string;
  intro?: string;
  sections: LegalSection[];
}
