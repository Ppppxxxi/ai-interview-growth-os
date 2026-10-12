const sampleMaterial = `公司：晴川智能\n岗位：AI 产品经理\n\n面试官：如何判断企业知识库助手真正提升了检索效率？\n我：可以看满意度和使用次数。\n追问：这些指标如何证明员工更快解决了问题？\n复盘：没有区分过程指标和结果指标。`;

const questions = [
  {
    type: '指标设计',
    role: 'AI 产品经理',
    keywords: ['效果评估', '检索效率'],
    question: '如何判断知识库助手真正提升了检索效率？',
    original: '可以看满意度和使用次数。',
    issue: '指标只覆盖感受与活跃，缺少任务完成结果。',
    answer: '我会先定义关键任务，再把指标拆成三层：检索耗时与首次命中率、问题解决率与转人工率、知识复用与重复提问趋势。上线前后按同类任务对照，同时抽查低置信回答，避免使用次数增长掩盖质量问题。'
  },
  {
    type: '产品判断',
    role: 'AI 产品经理',
    keywords: ['用户体验', '问题定位'],
    question: '检索准确率提高，但用户仍觉得不好用，怎么排查？',
    original: '先收集用户反馈，再优化检索。',
    issue: '缺少按任务路径定位问题的步骤。',
    answer: '我会把一次检索拆成提问、理解、召回、答案呈现和后续行动五段，结合会话样本与行为数据定位断点，再决定优化内容、交互还是检索策略。'
  },
  {
    type: '协作推进',
    role: '产品经理',
    keywords: ['跨团队协作', '上线标准'],
    question: '业务方和算法团队对上线标准不一致，如何推进？',
    original: '组织会议对齐目标。',
    issue: '没有给出可执行的上线门槛。',
    answer: '先明确共同目标和风险边界，把上线标准写成可测量的指标与样本清单；对有争议的场景分批灰度，并约定复盘时间和回退条件。'
  }
];

const initialQuestionMetadata = questions.map(({ type, role, keywords }) => ({ type, role, keywords: [...keywords] }));

function resetQuestionMetadata() {
  questions.forEach((item, index) => {
    item.type = initialQuestionMetadata[index].type;
    item.role = initialQuestionMetadata[index].role;
    item.keywords = [...initialQuestionMetadata[index].keywords];
  });
}

const assets = [
  { type: '指标设计', question: questions[0].question, answer: questions[0].answer, role: 'AI 产品经理', status: '已验证有效', feedback: '最近使用 · 表达清晰', tags: ['已验证有效', '下场面试可用', '同方向岗位'], source: '晴川智能 · 二面复盘' },
  { type: '产品判断', question: questions[1].question, answer: questions[1].answer, role: 'AI 产品经理', status: '下场面试可用', feedback: '尚未使用', tags: ['下场面试可用', '同方向岗位'], source: '晴川智能 · 模拟面试' },
  { type: '协作推进', question: questions[2].question, answer: questions[2].answer, role: '产品经理', status: '需要重写', feedback: '最近使用 · 案例不够具体', tags: ['需要重写'], source: '晴川智能 · 一面复盘' }
];

const categories = ['指标设计', '产品判断', '协作推进', '项目经历', '其他'];
const roles = ['AI 产品经理', '产品经理', '同方向岗位'];
const abilities = [
  { key: 'roleUnderstanding', label: '岗位理解', score: null, evidence: '暂无复盘评分。' },
  { key: 'productAnalysis', label: '产品分析', score: null, evidence: '暂无复盘评分。' },
  { key: 'aiProductThinking', label: 'AI 产品思维', score: 3, evidence: '能围绕 AI 产品展开，但还需讲清输出确认与沉淀节点。' },
  { key: 'dataMetrics', label: '数据与指标', score: 2.5, evidence: '两场复盘都指出指标拆解不够具体。' },
  { key: 'projectStorytelling', label: '项目叙事', score: null, evidence: '暂无复盘评分。' },
  { key: 'structuredCommunication', label: '结构化表达', score: null, evidence: '暂无复盘评分。' }
];

const state = { theme: 'a', view: 'workspace', step: 0, selectedQuestion: 0, selectedAsset: 0, selectedAbility: 'dataMetrics', filter: '全部', categoryFilter: '全部类别', query: '', material: '', company: '', role: '', confirmed: new Set(), menuOpen: false, editorOpen: false, hasData: true };
const app = document.getElementById('app');

function esc(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}

function render() {
  document.body.dataset.theme = state.theme;
  document.querySelectorAll('[data-theme-choice]').forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.themeChoice === state.theme));
  });
  const current = { workspace: '工作台', flow: '开始新面试', library: '我的回答库', profile: '个人画像' }[state.view];
  app.innerHTML = `
    <div class="product-shell">
      <aside class="product-nav" aria-label="主导航">
        <div class="product-identity"><span class="identity-mark">面</span><span class="identity-name">面试成长 <em>OS</em></span></div>
        <nav class="nav-links">
          ${navButton('workspace', '工作台', '01')}
          ${navButton('flow', '开始新面试', '02')}
          ${navButton('library', '我的回答库', '03')}
          ${navButton('profile', '个人画像', '04')}
        </nav>
        <div class="nav-bottom"><span class="profile-mark">我</span><span>个人空间</span></div>
      </aside>
      <div class="product-content">
        <header class="product-topbar"><span class="breadcrumb">个人空间 <span>/</span> ${current}</span><div class="topbar-right"><button type="button" class="data-menu-trigger" data-action="menu" aria-expanded="${state.menuOpen}">数据管理 <span>⌄</span></button>${state.menuOpen ? '<div class="data-menu"><button type="button" data-action="restore-example">恢复示例</button><button type="button" data-action="clear-data">清空本地数据</button></div>' : ''}</div></header>
        <main class="view-content">${state.view === 'workspace' ? workspaceView() : state.view === 'flow' ? flowView() : state.view === 'library' ? libraryView() : profileView()}</main>
      </div>
    </div>`;
}

function navButton(id, label, count) {
  return `<button type="button" class="nav-link ${state.view === id ? 'is-active' : ''}" data-view="${id}" title="${label}" aria-label="${label}" ${state.view === id ? 'aria-current="page"' : ''}><span class="nav-number">${count}</span><span>${label}</span><span class="nav-arrow">↗</span></button>`;
}

function workspaceView() {
  if (!state.hasData) {
    return `<div class="page-head"><h1>工作台</h1></div><section class="workspace-empty"><h2>还没有面试记录</h2><button type="button" class="primary-button" data-view="flow">开始新面试 <span>↗</span></button></section>`;
  }
  const readyCount = assets.filter((asset) => asset.status !== '需要重写').length;
  const focusAbility = abilities.find((ability) => ability.key === 'dataMetrics');
  return `<div class="page-head workspace-head"><h1>工作台</h1><button type="button" class="quiet-link" data-action="new-interview">开始新面试 <span>↗</span></button></div>
    <section class="home-current" aria-label="正在准备的岗位">
      <div class="home-current-top"><span class="home-live"><span class="signal-dot"></span> 正在准备</span><span class="home-status">第二轮面试</span></div>
      <div class="home-current-main"><div class="home-current-copy"><h2>晴川智能</h2><p>AI 产品经理 <span>·</span> 企业知识库助手</p><button type="button" class="primary-button" data-action="resume-review">继续复盘 <span>↗</span></button></div><div class="home-readiness" role="img" aria-label="${questions.length} 个问题中 ${readyCount} 条回答可用" style="--home-progress:${Math.round(readyCount / questions.length * 100)}%"><div class="home-readiness-inner"><strong>${readyCount}<span> / ${questions.length}</span></strong><small>回答可用</small></div></div></div>
      <div class="home-current-foot"><span>最近复盘</span><strong>第二轮面试</strong><span>${questions.length} 个问题</span></div>
    </section>
    <div class="home-summaries"><section class="home-library"><div class="home-module-head"><span class="section-label">我的回答库</span><strong>${String(readyCount).padStart(2, '0')}</strong></div><div class="home-library-entry"><span class="home-library-index">01</span><div><span>指标设计</span><h2>如何证明检索效率提升？</h2></div></div><button type="button" class="text-action" data-keyword-filter="效果评估">查看回答 <span>↗</span></button></section><section class="home-ability"><div class="home-module-head"><span class="section-label">当前关注</span><strong>${focusAbility.score} / 5</strong></div><h2>${focusAbility.label}</h2><div class="home-ability-meter" role="meter" aria-label="${focusAbility.label}评分" aria-valuemin="0" aria-valuemax="5" aria-valuenow="${focusAbility.score}"><span style="width:${focusAbility.score / 5 * 100}%"></span></div><button type="button" class="text-action" data-view="profile">查看画像 <span>↗</span></button></section></div>`;
}

function flowView() {
  const stepNames = ['导入材料', '确认识别', '整理回答', '完成'];
  return `<div class="page-head flow-head"><h1>${stepNames[state.step]}</h1></div>
    <div class="flow-progress" aria-label="流程进度">${stepNames.map((name, index) => `<button type="button" data-step="${index}" class="progress-step ${index === state.step ? 'is-current' : ''} ${index < state.step ? 'is-done' : ''}" ${index > state.step && !(index === 1 && state.material.trim()) ? 'disabled' : ''}><span class="step-no">0${index + 1}</span><span>${name}</span></button>`).join('')}</div>
    ${state.step === 0 ? importStep() : state.step === 1 ? reviewStep() : state.step === 2 ? answerStep() : doneStep()}`;
}

function importStep() {
  return `<div class="flow-layout"><section class="flow-main"><div class="section-top"><span class="section-label">面试材料</span><button type="button" class="quiet-link" data-action="sample">填入示例 ↗</button></div><label class="visually-hidden" for="material">面试材料</label><textarea id="material" class="material-input" placeholder="粘贴 JD、面试记录或模拟面试对话\n\n例如：\n面试官问了什么？\n你当时怎么回答？\n有哪些追问或复盘？">${esc(state.material)}</textarea><div class="flow-actions"><span>${state.material.trim().length ? `${state.material.trim().length} 字` : ''}</span><button type="button" class="primary-button" data-action="parse" ${state.material.trim() ? '' : 'disabled'}>解析材料 <span>↗</span></button></div></section><aside class="flow-aside"><span class="section-label">目标岗位</span><label>公司<input id="company" type="text" placeholder="例如：晴川智能" value="${esc(state.company)}"></label><label>岗位<input id="role" type="text" placeholder="例如：AI 产品经理" value="${esc(state.role)}"></label></aside></div>`;
}

function questionList() {
  return `<div class="question-list">${questions.map((item, index) => `<button type="button" class="question-row ${index === state.selectedQuestion ? 'is-selected' : ''}" data-question="${index}"><span class="question-row-num">0${index + 1}</span><span><small>${esc(item.type)}</small><strong>${esc(item.question)}</strong></span><span class="row-arrow">↗</span></button>`).join('')}</div>`;
}

function classificationStrip(item, editable) {
  return `<div class="classification-wrap"><div class="classification-strip" aria-label="问题分类"><span class="classification-kind">${esc(item.type)}</span><span>${esc(item.role)}</span>${item.keywords.slice(0, 2).map((tag) => `<span class="keyword-pill"># ${esc(tag)}</span>`).join('')}${editable ? `<button type="button" class="classification-edit" data-action="edit-classification" aria-expanded="${state.editorOpen}" aria-label="编辑问题归类">编辑</button>` : ''}</div>${editable && state.editorOpen ? classificationEditor(item) : ''}</div>`;
}

function classificationEditor(item) {
  const availableRoles = [...new Set([...roles, ...questions.map((question) => question.role)])];
  return `<div class="classification-editor"><div class="classification-editor-head"><strong>问题归类</strong><button type="button" data-action="edit-classification" aria-label="关闭分类编辑">×</button></div><div class="classification-fields"><label>类别<select id="category-select">${categories.map((category) => `<option value="${esc(category)}" ${item.type === category ? 'selected' : ''}>${esc(category)}</option>`).join('')}</select></label><label>适用岗位<select id="role-select">${availableRoles.map((role) => `<option value="${esc(role)}" ${item.role === role ? 'selected' : ''}>${esc(role)}</option>`).join('')}</select></label></div><label class="keyword-label" for="keyword-input">关键词</label><div class="keyword-input-box">${item.keywords.map((tag) => `<span class="editable-keyword">${esc(tag)}<button type="button" data-keyword-remove="${esc(tag)}" aria-label="移除关键词 ${esc(tag)}">×</button></span>`).join('')}<input id="keyword-input" type="text" maxlength="12" placeholder="输入后按回车" aria-label="新增关键词"></div></div>`;
}

function reviewStep() {
  const item = questions[state.selectedQuestion];
  return `<div class="review-layout"><section class="review-list"><div class="section-top"><span class="section-label">识别到的问题</span><strong>03</strong></div>${questionList()}</section><section class="review-detail"><div class="detail-kicker">问题 0${state.selectedQuestion + 1}</div><h2>${esc(item.question)}</h2>${classificationStrip(item, true)}<div class="detail-block"><span>我的回答</span><p>${esc(item.original)}</p></div><div class="detail-block"><span>需要改进</span><p>${esc(item.issue)}</p></div><div class="detail-action"><button type="button" class="primary-button" data-action="generate">整理下次可用回答 <span>↗</span></button></div></section></div>`;
}

function answerStep() {
  const item = questions[state.selectedQuestion];
  const accepted = state.confirmed.has(state.selectedQuestion);
  return `<div class="review-layout"><section class="review-list"><div class="section-top"><span class="section-label">待确认回答</span><strong>${String(state.confirmed.size).padStart(2, '0')} / 03</strong></div>${questionList()}</section><section class="review-detail answer-detail"><div class="detail-kicker">下次可用回答</div><h2>${esc(item.question)}</h2>${classificationStrip(item, false)}<div class="answer-body">${esc(item.answer)}</div><div class="answer-proof"><span>改写重点</span><p>${esc(item.issue)}</p></div><div class="detail-action answer-actions"><button type="button" class="primary-button" data-action="confirm">${accepted ? '已采用 ✓' : '采用这条回答'}</button><button type="button" class="quiet-link" data-action="next-question">下一条 →</button><button type="button" class="quiet-link save-link" data-action="save" ${state.confirmed.size ? '' : 'disabled'}>保存 ${state.confirmed.size} 条回答 ↗</button></div></section></div>`;
}

function doneStep() {
  return `<section class="done-view"><span class="done-symbol">✓</span><h2>已保存这场复盘</h2><p>1 场复盘 · ${state.confirmed.size} 条回答</p><div class="done-actions"><button type="button" class="primary-button" data-view="library">打开我的回答库 ↗</button><button type="button" class="quiet-link" data-action="reset-flow">开始下一场</button></div></section>`;
}

function libraryView() {
  const filtered = (state.hasData ? assets : []).map((asset, index) => ({
    ...asset,
    index,
    type: questions[index].type,
    role: questions[index].role,
    keywords: questions[index].keywords
  })).filter((asset) => {
    const matchesStatus = state.filter === '全部' || asset.tags.includes(state.filter);
    const matchesCategory = state.categoryFilter === '全部类别' || asset.type === state.categoryFilter;
    const text = `${asset.type} ${asset.question} ${asset.answer} ${asset.role} ${asset.keywords.join(' ')}`.toLowerCase();
    return matchesStatus && matchesCategory && text.includes(state.query.trim().toLowerCase());
  });
  const selected = filtered.find((asset) => asset.index === state.selectedAsset) || filtered[0];
  return `<div class="page-head library-head"><h1>我的回答库</h1><button type="button" class="quiet-link" data-view="flow">新增回答 ↗</button></div>
    <div class="library-tools"><div class="library-search-tools"><label class="search-box"><span aria-hidden="true">⌕</span><span class="visually-hidden">搜索回答</span><input id="asset-search" type="text" inputmode="search" placeholder="搜索问题或关键词" value="${esc(state.query)}"></label><label class="category-filter-label"><span class="visually-hidden">问题类别</span><select id="asset-category"><option value="全部类别">全部类别</option>${categories.map((category) => `<option value="${esc(category)}" ${state.categoryFilter === category ? 'selected' : ''}>${esc(category)}</option>`).join('')}</select></label></div><div class="filter-row" role="group" aria-label="回答筛选">${['全部', '下场面试可用', '已验证有效', '需要重写', '同方向岗位'].map((filter) => `<button type="button" class="filter-chip ${filter === state.filter ? 'is-active' : ''}" data-filter="${filter}" aria-pressed="${filter === state.filter}">${filter}</button>`).join('')}</div></div>
    <div class="library-layout"><section class="asset-list" aria-label="回答结果"><div class="list-header"><span>回答</span><span>${String(filtered.length).padStart(2, '0')} 条结果</span></div>${filtered.length ? filtered.map((asset) => `<button type="button" class="asset-row ${asset.index === selected.index ? 'is-selected' : ''}" data-asset="${asset.index}"><span class="asset-type">${esc(asset.type)}</span><strong>${esc(asset.question)}</strong><span class="asset-preview">${esc(asset.answer)}</span><span class="asset-keywords">${asset.keywords.slice(0, 2).map((tag) => `<span># ${esc(tag)}</span>`).join('')}</span><span class="asset-meta">${esc(asset.role)} <span>·</span> ${esc(asset.status)}</span></button>`).join('') : state.hasData ? `<div class="empty-result"><strong>没有找到回答</strong><p>换一个问题关键词，或清空筛选。</p><button type="button" class="text-action" data-action="clear-filter">清空筛选 ↗</button></div>` : `<div class="empty-result"><strong>还没有保存的回答</strong><button type="button" class="text-action" data-view="flow">开始新面试 ↗</button></div>`}</section>
    <aside class="asset-detail" aria-label="回答详情">${selected ? `<div class="detail-kicker">${esc(selected.type)} <span>·</span> ${esc(selected.status)}</div><h2>${esc(selected.question)}</h2><div class="asset-detail-answer"><span>下次可用回答</span><p>${esc(selected.answer)}</p></div><div class="asset-detail-foot"><div><span>适用方向</span><strong>${esc(selected.role)}</strong></div><div><span>关键词</span><strong>${selected.keywords.map(esc).join(' · ')}</strong></div><div><span>最近反馈</span><strong>${esc(selected.feedback)}</strong></div><div><span>来源</span><strong>${esc(selected.source)}</strong></div></div>` : `<div class="detail-empty">选择一条回答查看详情</div>`}</aside></div>`;
}

function radarPoint(index, fraction, radius = 115) {
  const angle = (-90 + index * 60) * Math.PI / 180;
  return [230 + Math.cos(angle) * radius * fraction, 170 + Math.sin(angle) * radius * fraction];
}

function radarChart() {
  const pointString = (fraction) => abilities.map((_, index) => radarPoint(index, fraction).map((number) => number.toFixed(1)).join(',')).join(' ');
  const rated = abilities.map((ability, index) => ({ ...ability, index })).filter((ability) => ability.score !== null);
  const wedge = rated.map((ability) => radarPoint(ability.index, ability.score / 5).map((number) => number.toFixed(1)).join(',')).join(' ');
  return `<svg class="ability-radar" viewBox="0 0 460 350" role="group" aria-label="六维能力雷达，已有 ${rated.length} 维复盘评分">
    ${[1, 2, 3, 4, 5].map((ring) => `<polygon class="radar-ring" points="${pointString(ring / 5)}"></polygon>`).join('')}
    ${abilities.map((_, index) => `<line class="radar-spoke" x1="230" y1="170" x2="${radarPoint(index, 1)[0].toFixed(1)}" y2="${radarPoint(index, 1)[1].toFixed(1)}"></line>`).join('')}
    <polygon class="radar-evidence" points="230,170 ${wedge}"></polygon>
    ${abilities.map((ability, index) => {
      const [pointX, pointY] = radarPoint(index, ability.score === null ? 1 : ability.score / 5);
      const [labelX, labelY] = radarPoint(index, 1, 152);
      const anchor = labelX < 210 ? 'end' : labelX > 250 ? 'start' : 'middle';
      return `<g class="radar-axis ${state.selectedAbility === ability.key ? 'is-selected' : ''} ${ability.score === null ? 'is-unrated' : ''}" data-ability="${ability.key}" role="button" tabindex="0" aria-label="${ability.label}，${ability.score === null ? '暂无评分' : `${ability.score} 分`}"><circle class="radar-hit" cx="${labelX.toFixed(1)}" cy="${labelY.toFixed(1)}" r="25"></circle><circle class="radar-point" cx="${pointX.toFixed(1)}" cy="${pointY.toFixed(1)}" r="${state.selectedAbility === ability.key ? 6 : 4}"></circle><text x="${labelX.toFixed(1)}" y="${(labelY + 5).toFixed(1)}" text-anchor="${anchor}">${ability.label}</text></g>`;
    }).join('')}
  </svg>`;
}

function profileView() {
  if (!state.hasData) {
    return `<div class="page-head"><h1>个人画像</h1></div><section class="workspace-empty"><h2>还没有复盘记录</h2><button type="button" class="primary-button" data-view="flow">开始新面试 <span>↗</span></button></section>`;
  }
  const selected = abilities.find((ability) => ability.key === state.selectedAbility);
  const categoryCounts = categories.map((category) => ({ label: category, count: questions.filter((item) => item.type === category).length })).filter((item) => item.count);
  const roleCounts = [...new Set(questions.map((item) => item.role))].map((role) => ({ label: role, count: questions.filter((item) => item.role === role).length }));
  const keywordCounts = new Map();
  questions.forEach((item) => item.keywords.forEach((tag) => keywordCounts.set(tag, (keywordCounts.get(tag) || 0) + 1)));
  const keywords = [...keywordCounts.entries()].sort((first, second) => second[1] - first[1]).slice(0, 8);
  return `<div class="page-head profile-page-head"><h1>个人画像</h1><span>已评估 ${abilities.filter((ability) => ability.score !== null).length}/${abilities.length}</span></div>
    <div class="profile-top"><section class="profile-chart-panel"><div class="section-top"><span class="section-label">能力雷达</span><span class="profile-scale">复盘评分 / 5</span></div>${radarChart()}</section><section class="profile-insight"><div class="section-top"><span class="section-label">当前维度</span><span class="profile-scale">${selected.score === null ? '待积累' : `${selected.score} / 5`}</span></div><h2>${selected.label}</h2><p>${selected.evidence}</p><div class="profile-insight-actions">${selected.score === null ? `<button type="button" class="text-action" data-view="flow">继续复盘 <span>↗</span></button>` : `<button type="button" class="text-action" data-action="view-ability-answers">查看相关回答 <span>↗</span></button>`}</div></section></div>
    <section class="profile-taxonomy"><div class="section-top"><span class="section-label">问题画像</span><span class="profile-scale">${questions.length} 条问题</span></div><div class="taxonomy-columns"><div><h3>问题类别</h3><div class="taxonomy-stack">${categoryCounts.map((item) => `<button type="button" data-category-filter="${esc(item.label)}"><span>${esc(item.label)}</span><strong>${item.count}</strong></button>`).join('')}</div></div><div><h3>关键词</h3><div class="taxonomy-tags">${keywords.map(([tag]) => `<button type="button" data-keyword-filter="${esc(tag)}"># ${esc(tag)}</button>`).join('')}</div></div><div><h3>岗位方向</h3><div class="taxonomy-stack">${roleCounts.map((item) => `<button type="button" data-role-filter="${esc(item.label)}"><span>${esc(item.label)}</span><strong>${item.count}</strong></button>`).join('')}</div></div></div></section>`;
}

document.addEventListener('click', (event) => {
  const theme = event.target.closest('[data-theme-choice]');
  if (theme) { state.theme = theme.dataset.themeChoice; render(); return; }
  const view = event.target.closest('[data-view]');
  if (view) { state.view = view.dataset.view; state.menuOpen = false; state.editorOpen = false; render(); return; }
  const step = event.target.closest('[data-step]');
  if (step && !step.disabled) { state.step = Number(step.dataset.step); state.editorOpen = false; render(); return; }
  const question = event.target.closest('[data-question]');
  if (question) { state.selectedQuestion = Number(question.dataset.question); state.editorOpen = false; render(); return; }
  const asset = event.target.closest('[data-asset]');
  if (asset) { state.selectedAsset = Number(asset.dataset.asset); render(); return; }
  const ability = event.target.closest('[data-ability]');
  if (ability) { state.selectedAbility = ability.dataset.ability; render(); return; }
  const keywordRemove = event.target.closest('[data-keyword-remove]');
  if (keywordRemove) { questions[state.selectedQuestion].keywords = questions[state.selectedQuestion].keywords.filter((tag) => tag !== keywordRemove.dataset.keywordRemove); render(); return; }
  const keywordFilter = event.target.closest('[data-keyword-filter]');
  if (keywordFilter) { state.query = keywordFilter.dataset.keywordFilter; state.filter = '全部'; state.categoryFilter = '全部类别'; state.view = 'library'; render(); return; }
  const categoryFilter = event.target.closest('[data-category-filter]');
  if (categoryFilter) { state.categoryFilter = categoryFilter.dataset.categoryFilter; state.query = ''; state.filter = '全部'; state.view = 'library'; render(); return; }
  const roleFilter = event.target.closest('[data-role-filter]');
  if (roleFilter) { state.query = roleFilter.dataset.roleFilter; state.filter = '全部'; state.categoryFilter = '全部类别'; state.view = 'library'; render(); return; }
  const filter = event.target.closest('[data-filter]');
  if (filter) { state.filter = filter.dataset.filter; render(); return; }
  const action = event.target.closest('[data-action]')?.dataset.action;
  if (action === 'menu') { state.menuOpen = !state.menuOpen; render(); return; }
  if (action === 'restore-example') { resetQuestionMetadata(); state.material = sampleMaterial; state.company = '晴川智能'; state.role = 'AI 产品经理'; state.menuOpen = false; state.editorOpen = false; state.view = 'workspace'; state.step = 0; state.selectedQuestion = 0; state.hasData = true; state.query = ''; state.filter = '全部'; state.categoryFilter = '全部类别'; state.confirmed.clear(); render(); return; }
  if (action === 'clear-data') { resetQuestionMetadata(); state.material = ''; state.company = ''; state.role = ''; state.query = ''; state.filter = '全部'; state.categoryFilter = '全部类别'; state.menuOpen = false; state.editorOpen = false; state.view = 'flow'; state.step = 0; state.selectedQuestion = 0; state.hasData = false; state.confirmed.clear(); render(); return; }
  if (action === 'new-interview') { state.material = ''; state.company = ''; state.role = ''; state.selectedQuestion = 0; state.step = 0; state.view = 'flow'; state.confirmed.clear(); state.menuOpen = false; state.editorOpen = false; render(); return; }
  if (action === 'resume-review') { if (!state.material.trim()) { state.material = sampleMaterial; state.company = '晴川智能'; state.role = 'AI 产品经理'; } state.selectedQuestion = 0; state.step = 1; state.view = 'flow'; state.menuOpen = false; state.editorOpen = false; render(); return; }
  if (action === 'edit-classification') { state.editorOpen = !state.editorOpen; render(); return; }
  if (action === 'sample') { resetQuestionMetadata(); state.material = sampleMaterial; state.company = '晴川智能'; state.role = 'AI 产品经理'; render(); }
  if (action === 'parse' && state.material.trim()) { if (state.role.trim()) questions.forEach((item) => { item.role = state.role.trim(); }); state.step = 1; render(); }
  if (action === 'generate') { state.step = 2; state.editorOpen = false; render(); }
  if (action === 'confirm') { state.confirmed.add(state.selectedQuestion); render(); }
  if (action === 'next-question') { state.selectedQuestion = (state.selectedQuestion + 1) % questions.length; render(); }
  if (action === 'save' && state.confirmed.size) { state.step = 3; state.hasData = true; render(); }
  if (action === 'reset-flow') { state.step = 0; state.material = ''; state.company = ''; state.role = ''; state.selectedQuestion = 0; state.confirmed.clear(); render(); }
  if (action === 'view-ability-answers') { state.query = '效果评估'; state.categoryFilter = '全部类别'; state.filter = '全部'; state.view = 'library'; render(); }
  if (action === 'clear-filter') { state.filter = '全部'; state.categoryFilter = '全部类别'; state.query = ''; render(); }
});

document.addEventListener('change', (event) => {
  const target = event.target;
  if (target.id === 'category-select') { questions[state.selectedQuestion].type = target.value; render(); }
  if (target.id === 'role-select') { questions[state.selectedQuestion].role = target.value; render(); }
  if (target.id === 'asset-category') { state.categoryFilter = target.value; render(); }
});

document.addEventListener('keydown', (event) => {
  if (event.target.id === 'keyword-input' && event.key === 'Enter' && !event.isComposing) {
    event.preventDefault();
    const keyword = event.target.value.trim().slice(0, 12);
    const currentKeywords = questions[state.selectedQuestion].keywords;
    if (keyword && currentKeywords.length < 6 && !currentKeywords.includes(keyword)) {
      currentKeywords.push(keyword);
      render();
      document.getElementById('keyword-input').focus();
    }
    return;
  }
  const ability = event.target.closest?.('[data-ability]');
  if (ability && (event.key === 'Enter' || event.key === ' ')) {
    event.preventDefault();
    state.selectedAbility = ability.dataset.ability;
    render();
  }
});

document.addEventListener('input', (event) => {
  const target = event.target;
  if (target.id === 'material') { state.material = target.value; const button = document.querySelector('[data-action="parse"]'); if (button) button.disabled = !state.material.trim(); return; }
  if (target.id === 'company') { state.company = target.value; return; }
  if (target.id === 'role') { state.role = target.value; return; }
  if (target.id === 'asset-search') {
    state.query = target.value;
    if (event.isComposing) return;
    const cursor = target.selectionStart;
    render();
    const next = document.getElementById('asset-search');
    next.focus();
    next.setSelectionRange(cursor, cursor);
  }
});

document.addEventListener('compositionend', (event) => {
  if (event.target.id !== 'asset-search') return;
  state.query = event.target.value;
  render();
  document.getElementById('asset-search').focus();
});

render();
