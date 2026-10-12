const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const handlers = {};
const app = { innerHTML: '' };
const search = { focus() {}, setSelectionRange() {} };
const document = {
  body: { dataset: {} },
  getElementById(id) { return id === 'app' ? app : search; },
  querySelectorAll() { return []; },
  querySelector() { return { disabled: false }; },
  addEventListener(name, handler) { handlers[name] = handler; }
};

vm.runInNewContext(fs.readFileSync(__dirname + '/app.js', 'utf8'), { document });

function click(attribute, value) {
  handlers.click({ target: { closest(selector) { return selector === `[${attribute}]` ? { dataset: { [attribute.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())]: value } } : null; } } });
}

assert.match(app.innerHTML, /工作台/);
assert.doesNotMatch(app.innerHTML, /本方向已沉淀/);
assert.match(app.innerHTML, /正在准备/);
assert.match(app.innerHTML, /继续复盘/);
assert.match(app.innerHTML, /当前关注/);
assert.match(app.innerHTML, /class="home-readiness"/);
assert.match(app.innerHTML, /class="home-library"/);
assert.match(app.innerHTML, /class="home-ability-meter"/);
assert.match(app.innerHTML, /aria-valuenow="2.5"/);
click('data-keyword-filter', '效果评估');
assert.match(app.innerHTML, /01 条结果/);
click('data-view', 'workspace');
click('data-action', 'resume-review');
assert.match(app.innerHTML, /确认识别/);
click('data-step', '0');
assert.match(app.innerHTML, /晴川智能/);
click('data-view', 'workspace');
click('data-action', 'new-interview');
assert.match(app.innerHTML, /导入材料/);
assert.doesNotMatch(app.innerHTML, /<textarea[^>]*>公司：晴川智能/);
click('data-theme-choice', 'b');
assert.equal(document.body.dataset.theme, 'b');
click('data-view', 'flow');
assert.match(app.innerHTML, /导入材料/);
assert.match(app.innerHTML, /例如：\n面试官问了什么/);
assert.doesNotMatch(app.innerHTML, /可稍后补全|支持直接粘贴文本/);
click('data-action', 'sample');
assert.match(app.innerHTML, /晴川智能/);
click('data-action', 'parse');
assert.match(app.innerHTML, /确认识别/);
click('data-action', 'edit-classification');
assert.match(app.innerHTML, /问题归类/);
handlers.keydown({ target: { id: 'keyword-input', value: '效果验证' }, key: 'Enter', preventDefault() {} });
assert.match(app.innerHTML, /效果验证/);
handlers.change({ target: { id: 'category-select', value: '产品判断' } });
assert.match(app.innerHTML, /产品判断/);
click('data-action', 'generate');
assert.match(app.innerHTML, /下次可用回答/);
click('data-action', 'confirm');
click('data-action', 'save');
assert.match(app.innerHTML, /已保存/);
click('data-view', 'library');
assert.match(app.innerHTML, /我的回答库/);
assert.match(app.innerHTML, /效果验证/);
click('data-view', 'profile');
assert.match(app.innerHTML, /个人画像/);
assert.match(app.innerHTML, /能力雷达/);
assert.match(app.innerHTML, /已评估 2\/6/);
click('data-ability', 'aiProductThinking');
assert.match(app.innerHTML, /AI 产品思维/);
click('data-keyword-filter', '效果验证');
assert.match(app.innerHTML, /01 条结果/);
click('data-action', 'clear-filter');
click('data-filter', '需要重写');
assert.match(app.innerHTML, /01 条结果/);
handlers.input({ target: { id: 'asset-search', value: '不存在的问题', selectionStart: 6 }, isComposing: false });
assert.match(app.innerHTML, /没有找到回答/);
click('data-action', 'clear-filter');
assert.match(app.innerHTML, /03 条结果/);
click('data-action', 'clear-data');
assert.match(app.innerHTML, /导入材料/);
click('data-view', 'library');
assert.match(app.innerHTML, /还没有保存的回答/);
click('data-view', 'profile');
assert.match(app.innerHTML, /还没有复盘记录/);
assert.doesNotMatch(app.innerHTML, /已评估 2\/6/);
click('data-view', 'flow');
click('data-action', 'sample');
handlers.input({ target: { id: 'role', value: '数据产品经理' } });
click('data-action', 'parse');
assert.match(app.innerHTML, /数据产品经理/);
click('data-action', 'menu');
assert.match(app.innerHTML, /恢复示例/);
click('data-action', 'restore-example');
assert.match(app.innerHTML, /正在准备/);
assert.match(app.innerHTML, /晴川智能/);
click('data-view', 'library');
assert.doesNotMatch(app.innerHTML, /效果验证|数据产品经理/);
console.log('UI prototype smoke: passed');
