import { useRef, useState } from 'react';
import type { AnswerAsset, InterviewMaterialDraftItem, InterviewSession, JobFile, ReviewReport } from '../domain/types';
import type { MaterialChunk } from '../domain/materialTypes';
import type { FocusQuestionWorks } from '../domain/focusFlowDraft';
import { FocusAnswersPanel } from './FocusAnswersPanel';
import { buildMaterialImportSavePayload } from '../workflow/materialImportDraft';
import { saveAnswerAssetVersion } from '../workflow/answerAssetVersions';

type Props = { job: JobFile; session: InterviewSession; review: ReviewReport; assets: AnswerAsset[];
  chunks: MaterialChunk[]; materialsReady: boolean; onSave: (asset: AnswerAsset) => void };

function mapSavedAssets(job: JobFile, session: InterviewSession, assets: AnswerAsset[]) {
  const scoped = assets.filter(asset => asset.sourceJobId === job.id && asset.sourceInterviewId === session.id);
  const saved = new Map<string, AnswerAsset>();
  const usedIds = new Set<string>();
  for (const question of session.questions) {
    let candidates = scoped.filter(asset => asset.sourceQuestionId === question.id);
    if (!candidates.length) {
      // Check all original questions, not just those left after assigning explicit IDs.
      if (session.questions.filter(entry => entry.question === question.question).length !== 1) continue;
      candidates = scoped.filter(asset => !asset.sourceQuestionId && asset.originalQuestion === question.question);
    }
    if (candidates.length === 1 && !usedIds.has(candidates[0].id)) {
      saved.set(question.id, candidates[0]);
      usedIds.add(candidates[0].id);
    }
  }
  return saved;
}

// This draft is deliberately local to the job detail, never the main flow's persisted draft.
export function JobAnswersPanel({ job, session, review, assets, chunks, materialsReady, onSave }: Props) {
  const [savedByQuestion] = useState(() => mapSavedAssets(job, session, assets));
  const assetIds = useRef(new Map([...savedByQuestion].map(([questionId, asset]) => [questionId, asset.id])));
  const [items, setItems] = useState<InterviewMaterialDraftItem[]>(() => session.questions.map((question, index) => {
    const saved = savedByQuestion.get(question.id);
    return { id: question.id, title: `问题 ${index + 1}`, question: saved?.originalQuestion ?? question.question, originalAnswer: saved?.originalAnswer ?? question.answer,
      issue: saved?.issue ?? question.feedback, improvementSuggestion: saved?.answerRationale?.requestedRewriteFocus ?? '',
      improvedAnswer: saved?.improvedAnswer ?? '', evidence: saved?.evidence, generation: saved?.generation,
      missingFacts: saved?.missingFacts, modelRationale: saved?.modelRationale, answerAssetCandidate: true, confidence: saved?.confidence ?? 'medium' };
  }));
  const [work, setWork] = useState<FocusQuestionWorks>({});
  return <FocusAnswersPanel items={items} job={job} chunks={chunks} materialsReady={materialsReady} work={work}
    onWorkChange={(id, value) => setWork(current => ({ ...current, [id]: value }))} onActiveChange={() => {}}
    onChange={updated => setItems(current => current.map(item => item.id === updated.id ? updated : item))}
    onSave={statuses => {
      const payload = buildMaterialImportSavePayload({ job, rawText: '', selectedItemIds: statuses.keys(), confirmationStatuses: statuses,
        runId: `${session.id}-answers`, draft: { sourceType: 'review_notes', jobContext: {}, interviewItems: items, globalInsights: {}, missingInfoWarnings: [] } });
      const acceptedItems = items.filter(item => statuses.has(item.id));
      for (const [index, candidate] of payload.assets.entries()) {
        const item = acceptedItems[index];
        const existing = assets.find(asset => asset.id === assetIds.current.get(item.id) &&
          asset.sourceJobId === job.id && asset.sourceInterviewId === session.id);
        const saved = existing ? saveAnswerAssetVersion(existing, { answer: candidate.improvedAnswer, note: '采用新回答', source: 'generated',
          evidence: candidate.evidence, generation: candidate.generation, missingFacts: candidate.missingFacts,
          modelRationale: candidate.modelRationale, answerRationale: candidate.answerRationale }) :
          { ...candidate, id: assets.some(asset => asset.id === candidate.id) ? `asset-${crypto.randomUUID()}` : candidate.id };
        onSave({ ...saved, sourceQuestionId: item.id, originalQuestion: candidate.originalQuestion, originalAnswer: candidate.originalAnswer,
          issue: candidate.issue, sourceInterviewId: session.id, sourceReviewId: review.id, confirmationStatus: candidate.confirmationStatus });
        assetIds.current.set(item.id, saved.id);
      }
    }} />;
}
