import { AnswerAssetCard } from '../components/AnswerAssetCard';
import { TrainingTaskCard } from '../components/TrainingTaskCard';
import { answerAssets, trainingTasks } from '../domain/sampleData';

export function AssetsAndTraining() {
  return (
    <div className="assets-page" id="assets">
      <section className="hero-panel hero-panel--compact">
        <p className="eyebrow">回答资产与训练计划</p>
        <h1>把一次复盘里的好表达和薄弱点，沉淀成下一场可用的材料</h1>
        <p>回答资产用于跨岗位复用，训练任务用于把重复短板转成明确练习题和参考框架。</p>
      </section>

      <div className="assets-grid">
        <section className="panel">
          <div className="section-heading">
            <p className="eyebrow">Answer Assets</p>
            <h2>回答资产库</h2>
          </div>
          <div className="asset-list">
            {answerAssets.map((asset) => (
              <AnswerAssetCard asset={asset} key={asset.id} />
            ))}
          </div>
        </section>

        <section className="panel">
          <div className="section-heading">
            <p className="eyebrow">Training Plan</p>
            <h2>训练计划</h2>
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
