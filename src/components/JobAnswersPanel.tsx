import { useRef, useState } from 'react';
import type { AnswerAsset, InterviewMaterialDraftItem, InterviewSession, JobFile, ReviewReport } from '../domain/types';
import type { MaterialChunk } from '../domain/materialTypes';
import type { FocusQuestionWorks } from '../domain/focusFlowDraft';
import { FocusAnswersPanel } from './FocusAnswersPanel';
import { buildMaterialImportSavePayload } from '../workflow/materialImportDraft';
import { saveAnswerAssetVersion } from '../workflow/answerAssetVersions';

type Props = { job: JobFile; session: InterviewSession; review: ReviewReport; assets: AnswerAsset[];
  chunks: MaterialChunk[]; materialsReady: boolean; onSave: (asset: AnswerAsset) => void };

// This draft is deliberately local to the job detail, never the main flow's persisted draft.
export function JobAnswersPanel({ job, session, review, assets, chunks, materialsReady, onSave }: Props) {
  function findSaved(question: InterviewSession['questions'][number]) {
    return assets.find(asset => asset.sourceInterviewId === session.id &&
      (asset.sourceQuestionId === question.id || (!asset.sourceQuestionId && asset.originalQuestion === question.question)));
  }
  const assetIds = useRef(new Map(session.questions.map(question => [question.id, findSaved(question)?.id])));
  const [items, setItems] = useState<InterviewMaterialDraftItem[]>(() => session.questions.map((question, index) => {
    const saved = findSaved(question);
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
        const existing = assets.find(asset => asset.id === (assetIds.current.get(item.id) ?? candidate.id));
        const saved = existing ? saveAnswerAssetVersion(existing, { answer: candidate.improvedAnswer, note: '采用新回答', source: 'generated',
          evidence: candidate.evidence, generation: candidate.generation, missingFacts: candidate.missingFacts,
          modelRationale: candidate.modelRationale, answerRationale: candidate.answerRationale }) : candidate;
        onSave({ ...saved, sourceQuestionId: item.id, originalQuestion: candidate.originalQuestion, originalAnswer: candidate.originalAnswer,
          issue: candidate.issue, sourceInterviewId: session.id, sourceReviewId: review.id, confirmationStatus: candidate.confirmationStatus });
        assetIds.current.set(item.id, saved.id);
      }
    }} />;
}
