import { useMemo, useState } from 'react';
import { Download, Search, SlidersHorizontal } from 'lucide-react';
import { AnswerAssetCard } from '../components/AnswerAssetCard';
import { TrainingTaskCard } from '../components/TrainingTaskCard';
import { trainingTasks } from '../domain/sampleData';
import type { AnswerAsset, InterviewSession, JobFile } from '../domain/types';
import {
  getDefaultAssetSearchFilters,
  searchAnswerAssets,
  type AssetQuickFilter,
  type AssetSearchFilters,
  type AssetUsageFilter
} from '../workflow/assetSearch';
import {
  confirmationStatusLabels,
  getAnswerAssetConfirmationStatus
} from '../workflow/answerAssetConfirmation';
import {
  getAssetUsageStatus,
  usageStatusLabels
} from '../workflow/assetUsageFeedback';
import { downloadMarkdown } from '../workflow/downloadMarkdown';
import {
  buildAssetLibraryMarkdown,
  createMarkdownFileName
} from '../workflow/markdownExport';

type AssetsAndTrainingProps = {
  answerAssets: AnswerAsset[];
  interviewSessions: InterviewSession[];
  jobFiles: JobFile[];
  onUpdateAsset: (asset: AnswerAsset) => void;
};

type FilterOption = {
  value: string;
  label: string;
};

const quickFilterOptions: Array<{ value: AssetQuickFilter; label: string }> = [
  { value: 'next-interview-ready', label: '下场面试可用' },
  { value: 'verified-effective', label: '已验证有效' },
  { value: 'needs-rewrite', label: '需要重写' },
  { value: 'same-direction', label: '同方向岗位' }
];

export function AssetsAndTraining({
  answerAssets,
  interviewSessions,
  jobFiles,
  onUpdateAsset
}: AssetsAndTrainingProps) {
  const [filters, setFilters] = useState<AssetSearchFilters>(() =>
    getDefaultAssetSearchFilters()
  );
  const [selectedAssetId, setSelectedAssetId] = useState(
    answerAssets[0]?.id ?? ''
  );

  const directions = unique(
    answerAssets.flatMap((asset) => asset.applicableRoles)
  );
  const questionTypes = unique(answerAssets.map((asset) => asset.questionType));
  const weaknesses = unique(answerAssets.map((asset) => asset.weaknessTag));
  const confidences = unique(answerAssets.map((asset) => asset.confidence));
  const sourceJobOptions = jobFiles
    .filter((job) => answerAssets.some((asset) => asset.sourceJobId === job.id))
    .map((job) => ({
      value: job.id,
      label: `${job.company} · ${job.roleTitle}`
    }));

  const searchResults = useMemo(
    () => searchAnswerAssets(answerAssets, filters, jobFiles),
    [answerAssets, filters, jobFiles]
  );

  const selectedResult =
    searchResults.find((result) => result.asset.id === selectedAssetId) ??
    searchResults[0];
  const selectedAsset = selectedResult?.asset;
  const hasActiveFilters = Object.entries(filters).some(([key, value]) =>
    key === 'query' ? value.trim().length > 0 : value !== 'all'
  );

  function updateFilter<Key extends keyof AssetSearchFilters>(
    key: Key,
    value: AssetSearchFilters[Key]
  ) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function resetFilters() {
    setFilters(getDefaultAssetSearchFilters());
  }

  function handleExportFilteredAssets() {
    const assets = searchResults.map((result) => result.asset);
    const markdown = buildAssetLibraryMarkdown({
      assets,
      jobFiles,
      interviewSessions
    });

    downloadMarkdown(
      createMarkdownFileName([
        '回答资产合集',
        filters.query.trim() || '当前筛选'
      ]),
      markdown
    );
  }

  function handleExportSelectedAsset() {
    if (!selectedAsset) return;

    const markdown = buildAssetLibraryMarkdown({
      assets: [selectedAsset],
      jobFiles,
      interviewSessions
    });

    downloadMarkdown(
      createMarkdownFileName([selectedAsset.questionType, '回答资产']),
      markdown
    );
  }

  return (
    <div className="asset-library" id="assets">
      <section className="library-header">
        <div>
          <p className="eyebrow">回答收藏</p>
          <h1>
            我的回答库{' '}
            <span className="heading-count">{answerAssets.length}</span>
          </h1>
        </div>
        <div className="library-header-actions">
          <button
            type="button"
            className="secondary-action"
            onClick={handleExportFilteredAssets}
            disabled={searchResults.length === 0}
          >
            <Download size={16} />
            导出结果
          </button>
          <button
            type="button"
            className="ghost-action"
            onClick={handleExportSelectedAsset}
            disabled={!selectedAsset}
          >
            导出回答
          </button>
        </div>
      </section>

      <section className="filter-panel library-filters">
        <label className="filter-search">
          <Search size={18} />
          <input
            type="search"
            aria-label="关键词"
            value={filters.query}
            placeholder="搜指标、追问、岗位或问题"
            onChange={(event) => updateFilter('query', event.target.value)}
          />
        </label>
        <div className="quick-filter-row" aria-label="快捷筛选">
          {quickFilterOptions.map((option) => (
            <button
              className={
                filters.quickFilter === option.value
                  ? 'quick-filter-chip quick-filter-chip--active'
                  : 'quick-filter-chip'
              }
              key={option.value}
              type="button"
              aria-pressed={filters.quickFilter === option.value}
              onClick={() =>
                updateFilter(
                  'quickFilter',
                  filters.quickFilter === option.value ? 'all' : option.value
                )
              }
            >
              <span>{option.label}</span>
            </button>
          ))}
        </div>
        <details className="advanced-filters">
          <summary>
            <SlidersHorizontal size={16} />
            筛选
          </summary>
          <div className="advanced-filter-grid">
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
              options={confidences.map((value) => ({
                value,
                label: getConfidenceLabel(value as AnswerAsset['confidence'])
              }))}
              onChange={(value) => updateFilter('confidence', value)}
            />
            <FilterSelect
              label="使用状态"
              value={filters.usageStatus}
              options={[
                { value: 'used', label: '已使用' },
                { value: 'unused', label: '待验证' }
              ]}
              onChange={(value) =>
                updateFilter('usageStatus', value as AssetUsageFilter)
              }
            />
          </div>
        </details>
        <div className="filter-actions">
          <span>{searchResults.length} 条结果</span>
          <button
            type="button"
            className="ghost-action"
            onClick={resetFilters}
            disabled={!hasActiveFilters}
          >
            清空筛选
          </button>
        </div>
      </section>

      <section className="library-layout">
        <aside className="asset-index">
          <div className="section-heading">
            <h2>{searchResults.length} 条回答</h2>
          </div>
          <div className="asset-index-list">
            {searchResults.map(({ asset, matchedFields }) => (
              <button
                className={
                  asset.id === selectedAsset?.id
                    ? 'asset-index-item asset-index-item--active'
                    : 'asset-index-item'
                }
                key={asset.id}
                type="button"
                onClick={() => setSelectedAssetId(asset.id)}
              >
                <strong>{asset.questionType}</strong>
                <span className="asset-index-question">
                  {asset.originalQuestion}
                </span>
                <span className="asset-index-answer">
                  {summarize(asset.improvedAnswer, 92)}
                </span>
                <span className="asset-index-meta">
                  <span>{asset.applicableRoles[0]}</span>
                  <span>{usageStatusLabels[getAssetUsageStatus(asset)]}</span>
                </span>
                <small>
                  {
                    confirmationStatusLabels[
                      getAnswerAssetConfirmationStatus(asset)
                    ]
                  }
                </small>
                {matchedFields.length > 0 && (
                  <em>匹配：{matchedFields.join('、')}</em>
                )}
              </button>
            ))}
          </div>
        </aside>

        <div className="asset-detail-pane">
          {selectedAsset ? (
            <AnswerAssetCard
              asset={selectedAsset}
              jobFiles={jobFiles}
              interviewSessions={interviewSessions}
              sourceInterview={interviewSessions.find(
                (session) => session.id === selectedAsset.sourceInterviewId
              )}
              sourceJob={jobFiles.find(
                (job) => job.id === selectedAsset.sourceJobId
              )}
              onUpdateAsset={onUpdateAsset}
            />
          ) : (
            <section className="empty-panel">
              <h2>
                {answerAssets.length === 0
                  ? '还没有保存的回答'
                  : '没有找到匹配回答'}
              </h2>
              <p>{getEmptySuggestion(answerAssets.length, hasActiveFilters)}</p>
              {hasActiveFilters && (
                <button
                  className="secondary-action"
                  type="button"
                  onClick={resetFilters}
                >
                  清空筛选
                </button>
              )}
            </section>
          )}
        </div>

        <details className="library-training">
          <summary>考前练习</summary>
          <div className="section-heading">
            <p className="eyebrow">考前优先训练</p>
            <h2>建议练习的问题</h2>
          </div>
          <div className="asset-list">
            {trainingTasks
              .filter((task) =>
                jobFiles.some((job) => job.id === task.jobFileId)
              )
              .map((task) => (
                <TrainingTaskCard
                  sourceJob={jobFiles.find((job) => job.id === task.jobFileId)}
                  task={task}
                  key={task.id}
                />
              ))}
          </div>
        </details>
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

function getConfidenceLabel(confidence: AnswerAsset['confidence']) {
  if (confidence === 'high') return '高置信';
  if (confidence === 'medium') return '中置信';
  return '低置信';
}

function getEmptySuggestion(assetCount: number, hasActiveFilters: boolean) {
  if (assetCount === 0) return '从一场面试开始';
  if (hasActiveFilters) return '试试其他关键词';
  return '暂无回答';
}

function summarize(value: string, maxLength: number) {
  const trimmed = value.trim();
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, maxLength)}...`;
}
