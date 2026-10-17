/* 反推面板诊断脚本（开发用，与 test.js 互补）
 * 用法：在本目录执行   node diagrev.js
 * 需要同目录的 index.html 与 testdom.js（极简 DOM 桩）。
 *
 * 针对"反推栏"的几个易回归点做逐项体检：
 *   1. 面板能正常构建，"点开看"长说明默认折叠
 *   2. 一键示例「两基因 9:3:4」「单基因 3:1」填好后可直接反推出解
 *   3. 第 5 步写带名比例（紫:9,红:3,白:4）会自动补「表型清单」（已手填则不覆盖）
 *   4. 亲本表型下拉能原位刷新（输入性状后出现新选项）
 *   5. runReverse 结束时 S 被整体替换，之后的勾选不会被清空
 */
const fs=require('fs'), vm=require('vm'), path=require('path');
const dom=require('./testdom.js');

const html=fs.readFileSync(path.join(__dirname,'index.html'),'utf8');
const raw=(html.match(/<script>([\s\S]*?)<\/script>/)||[])[1];
if(!raw){console.error('未在 index.html 里找到 <script> 块');process.exit(1)}
/* 页面脚本顶部的 const 在 vm 里跨脚本引用会报错，统一降级为 var */
const script=raw.replace(/^const (rAdd|rSub|rMul|rZero|rOne|rNum|rIs0|rEq)=/gm,'var $1=');
const ctx=dom.makeContext(script);
const EV=code=>vm.runInContext(code,ctx,{filename:'diagrev'});
const NL=String.fromCharCode(10);

let pass=0,fail=0;
function check(name,code,want){
  let got;
  try{got=EV(code)}catch(e){fail++;console.log('  [X] '+name+NL+'      异常：'+e.message);return}
  const okv=(want===undefined)?(got===true||got==='ok'):(String(got)===String(want));
  if(okv){pass++;console.log('  [OK] '+name)}
  else{fail++;console.log('  [X]  '+name+NL+'      期望：'+want+NL+'      实际：'+String(got))}
}

console.log('反推面板诊断（node diagrev.js）');
console.log('----------------------------------------');

console.log('1) 面板构建');
check('面板能构建且长说明默认折叠（details 全部收起）',
 `(function(){__reset();var box=el('div');renderRevPanel(box);
   var det=0,open=0,geneGrid=false,preset=false;
   (function w(e){
     if(e.tag==='details'){det++;if(e.attrs&&e.attrs.open)open++}
     if(e.className==='revgrid')geneGrid=true;
     if(e._text&&String(e._text).indexOf('两基因 9:3:4')>=0)preset=true;
     (e.children||[]).forEach(w);
   })(box);
   return JSON.stringify([det,open,geneGrid,preset]);
 })()`, '[3,0,true,true]');

console.log('2) 一键示例');
check('「两基因 9:3:4」示例填好后能反推出解',
 `(function(){__reset();revPreset('epi');runReverse(true);
   return S.rev.result.matches.length>0 ? 'ok' : '无解';
 })()`, 'ok');
check('「单基因 3:1」示例填好后能反推出解',
 `(function(){__reset();revPreset('one');runReverse(true);
   return S.rev.result.matches.length>0 ? 'ok' : '无解';
 })()`, 'ok');

console.log('3) 表型清单自动补全');
check('写「紫:9,红:3,白:4」后表型清单自动变成 紫,红,白',
 `(function(){__reset();var box=el('div');renderRevPanel(box);
   var inp=null;
   (function w(e){ if(!inp&&e.tag==='input'&&e.placeholder&&String(e.placeholder).indexOf('3:1、紫')>=0) inp=e;
     (e.children||[]).forEach(w); })(box);
   if(!inp)return '找不到观测输入框';
   inp.value='紫:9,红:3,白:4';inp.oninput();
   return S.rev.phenList;
 })()`, '紫,红,白');
check('已手填的表型清单不会被自动补覆盖',
 `(function(){__reset();S.rev.phenList='甲,乙';var box=el('div');renderRevPanel(box);
   var inp=null;
   (function w(e){ if(!inp&&e.tag==='input'&&e.placeholder&&String(e.placeholder).indexOf('3:1、紫')>=0) inp=e;
     (e.children||[]).forEach(w); })(box);
   inp.value='紫:9,红:7';inp.oninput();
   return S.rev.phenList;
 })()`, '甲,乙');

console.log('4) 亲本表型下拉原位刷新');
check('给基因填上显性性状后，下拉出现该选项',
 `(function(){__reset();var box=el('div');renderRevPanel(box);
   document.body.append(box);
   S.rev.genes[0].dom='紫花';
   refreshRevPhenSelects();
   var sel=document.querySelectorAll('.revPhenSel')[0];
   if(!sel)return '找不到表型下拉';
   return sel.options.map(function(o){return o.value}).join('|');
 })()`, '|紫花');

console.log('5) 勾选状态不被清空');
check('runReverse 换掉状态对象后，点「尝试从性遗传」不会清空右列三个勾选',
 `(function(){__reset();S.calcMode='rev';
   var rp=document.getElementById('runPanel');renderRun();
   function boxes(){var a=[];(function w(e){if(e.tag==='input'&&e.attrs&&e.attrs.type==='checkbox')a.push(e);(e.children||[]).forEach(w)})(rp);return a}
   var b=boxes();
   [2,4,6].forEach(function(i){b[i].checked=true;b[i].onchange()});
   S=cloneState();
   var b2=boxes();b2[5].checked=true;b2[5].onchange();
   var a3=boxes();
   return JSON.stringify([a3[2].checked,a3[4].checked,a3[6].checked,a3[5].checked]);
 })()`, '[true,true,true,true]');

console.log('----------------------------------------');
console.log('通过 '+pass+' 项，失败 '+fail+' 项');
process.exit(fail?1:0);
