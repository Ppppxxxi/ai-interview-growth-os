import { useEffect, useState } from 'react';
import { parseInterviewMaterial } from '../agents/materialImportParser';
import type { AnswerAsset, InterviewMaterialDraft, InterviewSession, JobFile, ReviewReport } from '../domain/types';
import { buildMaterialImportSavePayload } from '../workflow/materialImportDraft';

type FocusFlowPageProps = {
  selectedJobId: string;
  jobFiles: JobFile[];
  onUpdateJob: (job: JobFile) => void;
  onSaveInterviewRecord: (session: InterviewSession, review: ReviewReport) => void;
  onSaveAsset: (asset: AnswerAsset) => void;
  onFinish: (target: 'workspace' | 'assets') => void;
  onUseExample: () => void;
};

type FocusJobDraft = {
  company: string;
  roleTitle: string;
  direction: string;
  jdText: string;
};

const focusMaterialExample = `公司：晴川智能
岗位：AI 产品经理
方向：AI + 企业知识库助手

JD 摘要：
负责企业知识库助手的需求分析、用户反馈闭环、效果评估和跨团队协作。

面试记录：
面试官问我如何判断 AI 助手是否真的提升知识检索效率。我当时只回答可以看满意度和使用次数。
面试官追问：这些指标如何证明员工真的更快解决问题？
我的复盘：回答没有拆过程指标、结果指标和长期复用指标，也没有说明低置信回答如何兜底。`;

export function FocusFlowPage({
  jobFiles,
  onFinish,
  onSaveAsset,
  onSaveInterviewRecord,
  onUpdateJob,
  onUseExample,
  selectedJobId
}: FocusFlowPageProps) {
  const selectedJob = jobFiles.find((job) => job.id === selectedJobId) ?? jobFiles[0];
  const [jobDraft, setJobDraft] = useState<FocusJobDraft>(() => createFocusJobDraft(selectedJob));
  const [materialText, setMaterialText] = useState('');
  const [materialDraft, setMaterialDraft] = useState<InterviewMaterialDraft | undefined>();
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(() => new Set());
  const [answersGenerated, setAnswersGenerated] = useState(false);
  const [savedSummary, setSavedSummary] = useState<{ sessionId: string; assetCount: number } | undefined>();

  useEffect(() => {
    setJobDraft(createFocusJobDraft(selectedJob));
    setMaterialText('');
    setMaterialDraft(undefined);
    setSelectedItemIds(new Set());
    setAnswersGenerated(false);
    setSavedSummary(undefined);
  }, [selectedJob]);

  const hasMaterial = materialText.trim().length > 0;
  const selectedCount = materialDraft ? materialDraft.interviewItems.filter((item) => selectedItemIds.has(item.id)).length : 0;
  const flowStep = savedSummary ? 4 : answersGenerated ? 3 : materialDraft ? 2 : hasMaterial ? 1 : 0;

  function updateJobDraft(field: keyof FocusJobDraft, value: string) {
    setJobDraft((current) => ({
      ...current,
      [field]: value
    }));
  }

  function currentJob(): JobFile {
    return {
      ...selectedJob,
      company: jobDraft.company.trim() || selectedJob.company,
      roleTitle: jobDraft.roleTitle.trim() || selectedJob.roleTitle,
      direction: jobDraft.direction.trim() || selectedJob.direction,
      jdText: jobDraft.jdText.trim(),
      status: selectedJob.status === '待粘贴 JD 和面试对话' ? '已开始准备' : selectedJob.status
    };
  }

  function handleFillExample() {
    setJobDraft({
      company: '晴川智能',
      roleTitle: 'AI 产品经理',
      direction: 'AI + 企业知识库助手',
      jdText: '负责企业知识库助手的需求分析、用户反馈闭环、效果评估和跨团队协作。'
    });
    setMaterialText(focusMaterialExample);
    setMaterialDraft(undefined);
    setSelectedItemIds(new Set());
    setAnswersGenerated(false);
    setSavedSummary(undefined);
  }

  function handleParseMaterial() {
    if (!hasMaterial) return;

    const job = currentJob();
    onUpdateJob(job);
    const draft = parseInterviewMaterial({
      rawText: materialText,
      sourceType: 'auto',
      fallbackJob: job
    });
    setMaterialDraft(draft);
    setSelectedItemIds(
      new Set(draft.interviewItems.filter((item) => item.answerAssetCandidate && item.confidence !== 'low').map((item) => item.id))
    );
    setAnswersGenerated(false);
    setSavedSummary(undefined);
  }

  function handleToggleItem(itemId: string) {
    setSelectedItemIds((current) => {
      const next = new Set(current);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  }

  function handleDraftItemChange(
    itemId: string,
    field: 'title' | 'question' | 'originalAnswer' | 'issue' | 'improvementSuggestion' | 'improvedAnswer',
    value: string
  ) {
    setMaterialDraft((current) =>
      current
        ? {
            ...current,
            interviewItems: current.interviewItems.map((item) =>
              item.id === itemId
                ? {
                    ...item,
                    [field]: value
                  }
                : item
            )
          }
        : current
    );
  }

  function handleSave() {
    if (!materialDraft || !answersGenerated) return;

    const job = currentJob();
    onUpdateJob(job);
    const payload = buildMaterialImportSavePayload({
      draft: materialDraft,
      selectedItemIds,
      job,
      rawText: materialText,
      runId: Date.now().toString(36)
    });

    onSaveInterviewRecord(payload.session, payload.review);
    payload.assets.forEach((asset) => onSaveAsset(asset));
    setSavedSummary({
      sessionId: payload.session.id,
      assetCount: payload.assets.length
    });
  }

  function handleStartNext() {
    setMaterialText('');
    setMaterialDraft(undefined);
    setSelectedItemIds(new Set());
    setAnswersGenerated(false);
    setSavedSummary(undefined);
  }

  return (
    <section className="focus-flow-page">
      <header className="focus-flow-hero">
        <div>
          <p className="eyebrow">开始新一场面试</p>
          <h1>粘贴 JD、面试记录或模拟面试对话</h1>
          <p>先生成可确认草稿，再把下次能用的回答保存到我的回答库。首次使用不需要进入工作台配置。</p>
        </div>
        <div className="focus-flow-hero-actions">
          <button className="ghost-action" type="button" onClick={handleFillExample}>
            填入示例
          </button>
          <button className="secondary-action" type="button" onClick={onUseExample}>
            使用完整示例数据
          </button>
        </div>
      </header>

      <div className="focus-flow-steps" aria-label="当前流程">
        <FlowStep active={flowStep === 0 || flowStep === 1} done={flowStep > 1} index={1} label="粘贴材料" />
        <FlowStep active={flowStep === 2} done={flowStep > 2} index={2} label="确认识别结果" />
        <FlowStep active={flowStep === 3} done={flowStep > 3} index={3} label="生成回答" />
        <FlowStep active={flowStep === 4} done={Boolean(savedSummary)} index={4} label="保存到我的回答库" />
      </div>

      <section className="focus-flow-card">
        <div className="section-heading">
          <p className="eyebrow">目标岗位</p>
          <h2>先确认这次材料属于哪个岗位</h2>
        </div>
        <div className="focus-job-grid">
          <label>
            <span>公司</span>
            <input value={jobDraft.company} onChange={(event) => updateJobDraft('company', event.target.value)} />
          </label>
          <label>
            <span>岗位</span>
            <input value={jobDraft.roleTitle} onChange={(event) => updateJobDraft('roleTitle', event.target.value)} />
          </label>
          <label>
            <span>方向</span>
            <input value={jobDraft.direction} onChange={(event) => updateJobDraft('direction', event.target.value)} />
          </label>
        </div>
        <label className="focus-full-field">
          <span>JD 或岗位信息</span>
          <textarea
            value={jobDraft.jdText}
            placeholder="可选。粘贴岗位职责、任职要求或你自己整理的岗位信息。"
            onChange={(event) => updateJobDraft('jdText', event.target.value)}
          />
        </label>
      </section>

      <section className="focus-flow-card focus-flow-card--primary">
        <div className="focus-material-heading">
          <div>
            <p className="eyebrow">面试材料</p>
            <h2>把你手头的材料直接粘贴进来</h2>
            <p>可以混合包含 JD、面试官问题、你的回答、追问、AI 点评和复盘笔记。</p>
          </div>
          <button className="primary-action" type="button" onClick={handleParseMaterial} disabled={!hasMaterial}>
            解析材料
          </button>
        </div>
        <textarea
          className="focus-material-input"
          value={materialText}
          placeholder={'例如：\n公司/岗位/JD\n面试官问了什么\n我当时怎么答\n面试官追问了什么\nAI 或我自己的复盘点评'}
          onChange={(event) => setMaterialText(event.target.value)}
        />
      </section>

      {materialDraft && (
        <section className="focus-flow-card">
          <div className="focus-draft-heading">
            <div>
              <p className="eyebrow">确认识别结果</p>
              <h2>{materialDraft.globalInsights.summary}</h2>
              <p>{answersGenerated ? `已生成 ${selectedCount} 条下次可用回答，可以继续编辑后保存。` : '先确认系统识别是否正确，再生成下次可用回答。'}</p>
            </div>
            {answersGenerated ? (
              <button className="primary-action" type="button" onClick={handleSave}>
                保存到我的回答库
              </button>
            ) : (
              <button className="primary-action" type="button" onClick={() => setAnswersGenerated(true)}>
                生成下次可用回答
              </button>
            )}
          </div>
          {materialDraft.missingInfoWarnings.length > 0 && (
            <div className="material-warning-list">
              {materialDraft.missingInfoWarnings.map((warning) => (
                <span key={warning}>{warning}</span>
              ))}
            </div>
          )}
          <div className="focus-draft-list">
            {materialDraft.interviewItems.map((item, index) => (
              <article className="focus-draft-card" key={item.id}>
                <div className="focus-draft-card-title">
                  <label>
                    <span>问题类型 {index + 1}</span>
                    <input value={item.title} onChange={(event) => handleDraftItemChange(item.id, 'title', event.target.value)} />
                  </label>
                  <label className={item.answerAssetCandidate ? 'material-save-check' : 'material-save-check material-save-check--disabled'}>
                    <input
                      type="checkbox"
                      checked={selectedItemIds.has(item.id)}
                      disabled={!item.answerAssetCandidate}
                      onChange={() => handleToggleItem(item.id)}
                    />
                    <span>{item.answerAssetCandidate ? '保存这条回答' : '只保存为复盘记录'}</span>
                  </label>
                </div>
                <div className="focus-draft-grid">
                  <label>
                    <span>识别到的问题</span>
                    <textarea value={item.question ?? ''} onChange={(event) => handleDraftItemChange(item.id, 'question', event.target.value)} />
                  </label>
                  <label>
                    <span>你的原回答或材料片段</span>
                    <textarea
                      value={item.originalAnswer ?? ''}
                      onChange={(event) => handleDraftItemChange(item.id, 'originalAnswer', event.target.value)}
                    />
                  </label>
                  <label>
                    <span>具体问题</span>
                    <textarea value={item.issue ?? ''} onChange={(event) => handleDraftItemChange(item.id, 'issue', event.target.value)} />
                  </label>
                  <label>
                    <span>建议这样改</span>
                    <textarea
                      value={item.improvementSuggestion ?? ''}
                      onChange={(event) => handleDraftItemChange(item.id, 'improvementSuggestion', event.target.value)}
                    />
                  </label>
                </div>
                {answersGenerated && (
                  <label className="focus-answer-field">
                    <span>下次可用回答</span>
                    <textarea
                      value={item.improvedAnswer ?? ''}
                      onChange={(event) => handleDraftItemChange(item.id, 'improvedAnswer', event.target.value)}
                    />
                  </label>
                )}
              </article>
            ))}
          </div>
        </section>
      )}

      {savedSummary && (
        <section className="focus-success-card">
          <p className="eyebrow">已保存</p>
          <h2>这场面试已经沉淀下来</h2>
          <p>
            已保存 1 场面试记录和 {savedSummary.assetCount} 条回答。你可以继续管理这场复盘，也可以直接查看我的回答库。
          </p>
          <div className="focus-success-actions">
            <button className="primary-action" type="button" onClick={() => onFinish('workspace')}>
              查看工作台
            </button>
            <button className="secondary-action" type="button" onClick={() => onFinish('assets')}>
              打开我的回答库
            </button>
            <button className="ghost-action" type="button" onClick={handleStartNext}>
              开始下一场面试
            </button>
          </div>
        </section>
      )}
    </section>
  );
}

function createFocusJobDraft(job: JobFile): FocusJobDraft {
  return {
    company: job.company,
    roleTitle: job.roleTitle,
    direction: job.direction,
    jdText: job.jdText
  };
}

function FlowStep({ active, done, index, label }: { active: boolean; done: boolean; index: number; label: string }) {
  return (
    <article className={done ? 'focus-step focus-step--done' : active ? 'focus-step focus-step--active' : 'focus-step'}>
      <span>{done ? '完成' : index}</span>
      <strong>{label}</strong>
    </article>
  );
}
