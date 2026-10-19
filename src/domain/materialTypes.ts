export type MaterialKind = 'experience' | 'knowledge';
export type MaterialSourceFormat = 'paste' | 'txt' | 'markdown' | 'docx' | 'pdf';
export type MaterialLocator =
  | { type: 'paragraph'; paragraphIndex: number }
  | { type: 'page'; pageNumber: number; paragraphIndex?: number };

export type MaterialDocument = {
  id: string;
  kind: MaterialKind;
  title: string;
  tags: string[];
  text: string;
  sourceFileName?: string;
  sourceFormat: MaterialSourceFormat;
  version: number;
  createdAt: string;
  updatedAt: string;
  project?: string;
  responsibility?: string;
  action?: string;
  result?: string;
};

export type MaterialChunk = {
  id: string;
  documentId: string;
  documentVersion: number;
  kind: MaterialKind;
  title: string;
  text: string;
  locator: MaterialLocator;
  tags: string[];
};

export type MaterialChunkSelection = {
  chunkId: string;
  documentId: string;
  documentVersion: number;
};

export type MaterialDraft = {
  id: string;
  // Older document editors persisted these document metadata fields in their draft.
  version?: number;
  createdAt?: string;
  documentId?: string;
  documentVersion?: number;
  questionId?: string;
  kind: MaterialKind;
  title: string;
  tags: string[];
  text: string;
  sourceFileName?: string;
  sourceFormat: MaterialSourceFormat;
  project?: string;
  responsibility?: string;
  action?: string;
  result?: string;
  selectedChunks: MaterialChunkSelection[];
  updatedAt: string;
};

type PendingOperation = { id: string; createdAt: string };
export type PendingDeletion = PendingOperation & (
  | { kind: 'delete-document'; documentId: string }
  | { kind: 'source-updated'; documentId: string; fromVersion?: number }
  | { kind: 'clear-all'; workspaceJson?: string }
  | { kind: 'restore-backup'; backupJson: string; originalJson?: string; phase?: 'applying' | 'rollback' }
);

export type AnswerEvidence = {
  documentId: string;
  documentVersion: number;
  chunkId: string;
  kind: MaterialKind;
  titleSnapshot: string;
  quote: string;
  locatorSnapshot?: MaterialLocator;
  answerParagraphIndex: number;
  status: 'validated' | 'source-updated' | 'source-deleted' | 'needs-review';
};

export type AnswerGeneration = {
  provider: 'deepseek';
  model: string;
  generatedAt: string;
  generationId: string;
  origin: 'model' | 'sample' | 'manual';
};
