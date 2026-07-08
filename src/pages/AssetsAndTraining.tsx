import { useMemo, useState } from 'react';
import { AnswerAssetCard } from '../components/AnswerAssetCard';
import { TrainingTaskCard } from '../components/TrainingTaskCard';
import { answerAssets, interviewSessions, jobFiles, trainingTasks } from '../domain/sampleData';

type FilterKey = 'all' | string;

export function AssetsAndTraining() {
  const [direction, setDirection] = useState<FilterKey>('all');
  const [questionType, setQuestionType] = useState<FilterKey>('all');
  const [weakness, setWeakness] = useState<FilterKey>('all');
  const [confidence, setConfidence] = useState<FilterKey>('all');
  const [selectedAssetId, setSelectedAssetId] = useState(answerAssets[0]?.id ?? '');

  const directions = unique(answerAssets.flatMap((asset) => asset.applicableRoles));
  const questionTypes = unique(answerAssets.map((asset) => asset.questionType));
  const weaknesses = unique(answerAssets.map((asset) => asset.weaknessTag));
  const confidences = unique(answerAssets.map((asset) => asset.confidence));

  const filteredAssets = useMemo(
    () =>
      answerAssets.filter((asset) => {
        const matchesDirection = direction === 'all' || asset.applicableRoles.includes(direction);
        const matchesType = questionType === 'all' || asset.questionType === questionType;
        const matchesWeakness = weakness === 'all' || asset.weaknessTag === weakness;
        const matchesConfidence = confidence === 'all' || asset.confidence === confidence;
        return matchesDirection && matchesType && matchesWeakness && matchesConfidence;
      }),
    [confidence, direction, questionType, weakness]
  );

  const selectedAsset = filteredAssets.find((asset) => asset.id === selectedAssetId) ?? filteredAssets[0];

  return (
    <div className="asset-library" id="assets">
      <section className="library-header">
        <div>
          <p className="eyebrow">回答资产库</p>
          <h1>下次面试能直接用的回答</h1>
          <p>按岗位、问题类型快速查找。每条都附带原回答对比和具体用法建议。</p>
        </div>
      </section>

      <section className="filter-panel library-filters">
        <FilterSelect label="岗位方向" value={direction} values={directions} onChange={setDirection} />
        <FilterSelect label="问题类型" value={questionType} values={questionTypes} onChange={setQuestionType} />
        <FilterSelect label="能力短板" value={weakness} values={weaknesses} onChange={setWeakness} />
        <FilterSelect label="置信度" value={confidence} values={confidences} onChange={setConfidence} />
      </section>

      <section className="library-layout">
        <aside className="asset-index">
          <div className="section-heading">
            <p className="eyebrow">全部资产</p>
            <h2>{filteredAssets.length} 条可复用回答</h2>
          </div>
          <div className="asset-index-list">
            {filteredAssets.map((asset) => (
              <button
                className={asset.id === selectedAsset?.id ? 'asset-index-item asset-index-item--active' : 'asset-index-item'}
                key={asset.id}
                type="button"
                onClick={() => setSelectedAssetId(asset.id)}
              >
                <strong>{asset.questionType}</strong>
                <span>{asset.originalQuestion}</span>
                <small>{asset.usedInInterview ? '已复用' : '待验证'} · {asset.confidence === 'high' ? '高置信' : '中置信'}</small>
              </button>
            ))}
          </div>
        </aside>

        <main className="asset-detail-pane">
          {selectedAsset ? (
            <AnswerAssetCard
              asset={selectedAsset}
              sourceInterview={interviewSessions.find((session) => session.id === selectedAsset.sourceInterviewId)}
              sourceJob={jobFiles.find((job) => job.id === selectedAsset.sourceJobId)}
            />
          ) : (
            <section className="empty-panel">
              <h2>没有匹配的回答资产</h2>
              <p>调整筛选条件，或先在岗位工作台生成一条新的回答资产。</p>
            </section>
          )}
        </main>

        <aside className="library-training">
          <div className="section-heading">
            <p className="eyebrow">考前优先训练</p>
            <h2>建议练习的问题</h2>
          </div>
          <div className="asset-list">
            {trainingTasks.map((task) => (
              <TrainingTaskCard
                sourceJob={jobFiles.find((job) => job.id === task.jobFileId)}
                task={task}
                key={task.id}
              />
            ))}
          </div>
        </aside>
      </section>
    </div>
  );
}

function FilterSelect({
  label,
  onChange,
  value,
  values
}: {
  label: string;
  onChange: (value: string) => void;
  value: string;
  values: string[];
}) {
  return (
    <label>
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="all">全部</option>
        {values.map((item) => (
          <option key={item} value={item}>
            {item}
          </option>
        ))}
      </select>
    </label>
  );
}

function unique(values: string[]) {
  return Array.from(new Set(values));
}
