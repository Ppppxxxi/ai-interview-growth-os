import { analyzeJd } from '../agents/jdAnalyst';
import { matchExperiences } from '../agents/experienceMatcher';
import { experiences, interviewSessions, jobFiles } from '../domain/sampleData';
import type { JobFile } from '../domain/types';

type JobFileDetailProps = {
  selectedJobId: string;
  onSelectJob: (jobId: string) => void;
};

export function JobFileDetail({ selectedJobId, onSelectJob }: JobFileDetailProps) {
  const selectedJob = jobFiles.find((jobFile) => jobFile.id === selectedJobId) ?? jobFiles[0];
  const profile = selectedJob.profile ?? analyzeJd(selectedJob.jdText, selectedJob.direction);
  const matchedExperiences = matchExperiences(profile, experiences);
  const sessions = interviewSessions.filter((session) => session.jobFileId === selectedJob.id);

  return (
    <div className="workspace-layout" id="jobs">
      <aside className="sidebar-panel">
        <p className="eyebrow">岗位档案</p>
        <h2>准备中的岗位</h2>
        <div className="file-list">
          {jobFiles.map((jobFile) => (
            <button
              className={jobFile.id === selectedJob.id ? 'file-tab file-tab--active' : 'file-tab'}
              key={jobFile.id}
              type="button"
              onClick={() => onSelectJob(jobFile.id)}
            >
              <strong>{jobFile.company}</strong>
              <span>{jobFile.roleTitle}</span>
            </button>
          ))}
        </div>
      </aside>

      <section className="panel panel--workspace">
        <JobHeader jobFile={selectedJob} />

        <div className="detail-grid">
          <section>
            <p className="eyebrow">JD 画像</p>
            <h3>岗位要求拆解</h3>
            <InfoList title="核心职责" items={profile.responsibilities} />
            <InfoList title="能力关键词" items={profile.abilityKeywords} />
            <InfoList title="隐性要求" items={profile.hiddenRequirements} />
          </section>

          <section>
            <p className="eyebrow">经历匹配</p>
            <h3>可迁移素材</h3>
            <div className="matched-list">
              {matchedExperiences.map((match) => (
                <article key={match.experience.id}>
                  <strong>{match.experience.title}</strong>
                  <span>匹配度 {match.score}</span>
                  <p>{match.suggestedAngle}</p>
                </article>
              ))}
            </div>
          </section>
        </div>

        <section className="detail-section">
          <p className="eyebrow">模拟面试</p>
          <h3>高概率问题</h3>
          <div className="question-grid">
            {profile.likelyQuestions.map((question) => (
              <article key={question}>
                <span>准备题</span>
                <p>{question}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="detail-section">
          <p className="eyebrow">记录</p>
          <h3>已关联面试</h3>
          <div className="session-list">
            {sessions.map((session) => (
              <article key={session.id}>
                <strong>{session.interviewType}</strong>
                <span>{session.createdAt} · {session.source === 'externalImport' ? '外部导入' : '内置模拟'}</span>
              </article>
            ))}
          </div>
        </section>
      </section>
    </div>
  );
}

function JobHeader({ jobFile }: { jobFile: JobFile }) {
  return (
    <header className="job-detail-header">
      <div>
        <p className="eyebrow">{jobFile.company}</p>
        <h1>{jobFile.roleTitle}</h1>
        <span>{jobFile.direction}</span>
      </div>
      <div>
        <strong>{jobFile.stage}</strong>
        <span>{jobFile.status}</span>
      </div>
    </header>
  );
}

function InfoList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="info-block">
      <strong>{title}</strong>
      <ul>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
