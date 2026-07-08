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

  return (
    <div className="assets-page" id="assets">
      <section className="hero-panel hero-panel--compact">
        <p className="eyebrow">回答资产库</p>
        <h1>核心产出不是打分，而是下次面试能直接复用的回答</h1>
        <p>每条资产都保留来源岗位、来源面试、原问题、原回答、问题点、优化回答和适用类似问题，优先支持同岗位多轮和同方向类似岗位复用。</p>
      </section>

      <section className="filter-panel">
        <FilterSelect label="岗位方向" value={direction} values={directions} onChange={setDirection} />
        <FilterSelect label="问题类型" value={questionType} values={questionTypes} onChange={setQuestionType} />
        <FilterSelect label="能力短板" value={weakness} values={weaknesses} onChange={setWeakness} />
        <FilterSelect label="置信度" value={confidence} values={confidences} onChange={setConfidence} />
      </section>

      <div className="assets-grid assets-grid--library">
        <section className="panel panel--wide-library">
          <div className="section-heading">
            <p className="eyebrow">Reusable Answers</p>
            <h2>{filteredAssets.length} 条可复用回答资产</h2>
          </div>
          <div className="asset-list">
            {filteredAssets.map((asset) => (
              <AnswerAssetCard
                asset={asset}
                key={asset.id}
                sourceInterview={interviewSessions.find((session) => session.id === asset.sourceInterviewId)}
                sourceJob={jobFiles.find((job) => job.id === asset.sourceJobId)}
              />
            ))}
          </div>
        </section>

        <section className="panel">
          <div className="section-heading">
            <p className="eyebrow">下一场面试前</p>
            <h2>建议练习的问题</h2>
          </div>
          <div className="asset-list">
            {trainingTasks.map((task) => (
              <TrainingTaskCard task={task} key={task.id} />
            ))}
          </div>
        </section>
      </div>
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
