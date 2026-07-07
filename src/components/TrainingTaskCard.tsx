import { getAbilityLabel } from './AbilityScoreCard';
import type { TrainingTask } from '../domain/types';

type TrainingTaskCardProps = {
  task: TrainingTask;
};

export function TrainingTaskCard({ task }: TrainingTaskCardProps) {
  return (
    <article className="training-card">
      <header>
        <div>
          <p className="eyebrow">{getAbilityLabel(task.dimension)}</p>
          <h3>{task.goal}</h3>
        </div>
        <span>{task.status === 'open' ? '待训练' : '已完成'}</span>
      </header>
      <p>
        <strong>练习题：</strong>
        {task.practiceQuestion}
      </p>
      <p>
        <strong>参考框架：</strong>
        {task.referenceFramework}
      </p>
      <p>
        <strong>时间：</strong>
        {task.dueLabel}
      </p>
    </article>
  );
}
