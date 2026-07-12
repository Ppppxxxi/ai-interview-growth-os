import { useMemo, useState } from 'react';
import { AnswerAssetCard } from '../components/AnswerAssetCard';
import { TrainingTaskCard } from '../components/TrainingTaskCard';
import { trainingTasks } from '../domain/sampleData';
import type { AnswerAsset, InterviewSession, JobFile } from '../domain/types';
import {
  getDefaultAssetSearchFilters,
  searchAnswerAssets,
  type AssetSearchFilters,
  type AssetUsageFilter
} from '../workflow/assetSearch';

type AssetsAndTrainingProps = {
  answerAssets: AnswerAsset[];
  interviewSessions: InterviewSession[];
  jobFiles: JobFile[];
};

type FilterOption = {
  value: string;
  label: string;
};

export function AssetsAndTraining({ answerAssets, interviewSessions, jobFiles }: AssetsAndTrainingProps) {
  const [filters, setFilters] = useState<AssetSearchFilters>(() => getDefaultAssetSearchFilters());
  const [selectedAssetId, setSelectedAssetId] = useState(answerAssets[0]?.id ?? '');

  const directions = unique(answerAssets.flatMap((asset) => asset.applicableRoles));
  const questionTypes = unique(answerAssets.map((asset) => asset.questionType));
  const weaknesses = unique(answerAssets.map((asset) => asset.weaknessTag));
  const confidences = unique(answerAssets.map((asset) => asset.confidence));
  const sourceJobOptions = jobFiles
    .filter((job) => answerAssets.some((asset) => asset.sourceJobId === job.id))
    .map((job) => ({ value: job.id, label: `${job.company} · ${job.roleTitle}` }));

  const searchResults = useMemo(
    () => searchAnswerAssets(answerAssets, filters, jobFiles),
    [answerAssets, filters, jobFiles]
  );

  const selectedResult = searchResults.find((result) => result.asset.id === selectedAssetId) ?? searchResults[0];
  const selectedAsset = selectedResult?.asset;
  const hasActiveFilters = Object.entries(filters).some(([key, value]) =>
    key === 'query' ? value.trim().length > 0 : value !== 'all'
  );

  function updateFilter<Key extends keyof AssetSearchFilters>(key: Key, value: AssetSearchFilters[Key]) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function resetFilters() {
    setFilters(getDefaultAssetSearchFilters());
  }

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
        <label className="filter-search">
          <span>关键词</span>
          <input
            type="search"
            value={filters.query}
            placeholder="搜指标、追问、岗位或问题"
            onChange={(event) => updateFilter('query', event.target.value)}
          />
        </label>
        <FilterSelect
          label="岗位方向"
          value={filters.direction}
          options={toOptions(directions)}
          onChange={(value) => updateFilter('direction', value)}
        />
        <FilterSelect
          label="问题类型"
          value={filters.questionType}
          options={toOptions(questionTypes)}
          onChange={(value) => updateFilter('questionType', value)}
        />
        <FilterSelect
          label="能力短板"
          value={filters.weakness}
          options={toOptions(weaknesses)}
          onChange={(value) => updateFilter('weakness', value)}
        />
        <FilterSelect
          label="来源岗位"
          value={filters.sourceJobId}
          options={sourceJobOptions}
          onChange={(value) => updateFilter('sourceJobId', value)}
        />
        <FilterSelect
          label="置信度"
          value={filters.confidence}
          options={toOptions(confidences)}
          onChange={(value) => updateFilter('confidence', value)}
        />
        <FilterSelect
          label="使用状态"
          value={filters.usageStatus}
          options={[
            { value: 'used', label: '已使用' },
            { value: 'unused', label: '待验证' }
          ]}
          onChange={(value) => updateFilter('usageStatus', value as AssetUsageFilter)}
        />
        <div className="filter-actions">
          <span>{searchResults.length} 条结果</span>
          <button type="button" className="ghost-action" onClick={resetFilters} disabled={!hasActiveFilters}>
            清空筛选
          </button>
        </div>
      </section>

      <section className="library-layout">
        <aside className="asset-index">
          <div className="section-heading">
            <p className="eyebrow">全部资产</p>
            <h2>{searchResults.length} 条可复用回答</h2>
            <p className="result-summary">
              {filters.query.trim() ? `正在检索“${filters.query.trim()}”相关回答` : '输入关键词，快速定位下次面试能用的回答'}
            </p>
          </div>
          <div className="asset-index-list">
            {searchResults.map(({ asset, matchedFields }) => (
              <button
                className={asset.id === selectedAsset?.id ? 'asset-index-item asset-index-item--active' : 'asset-index-item'}
                key={asset.id}
                type="button"
                onClick={() => setSelectedAssetId(asset.id)}
              >
                <strong>{asset.questionType}</strong>
                <span>{asset.originalQuestion}</span>
                <small>{asset.usedInInterview ? '已复用' : '待验证'} · {asset.confidence === 'high' ? '高置信' : '中置信'}</small>
                {matchedFields.length > 0 && <em>匹配：{matchedFields.join('、')}</em>}
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
  options,
  value
}: {
  label: string;
  onChange: (value: string) => void;
  options: FilterOption[];
  value: string;
}) {
  return (
    <label>
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="all">全部</option>
        {options.map((item) => (
          <option key={item.value} value={item.value}>
            {item.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function unique(values: string[]) {
  return Array.from(new Set(values));
}

function toOptions(values: string[]): FilterOption[] {
  return values.map((value) => ({ value, label: value }));
}
