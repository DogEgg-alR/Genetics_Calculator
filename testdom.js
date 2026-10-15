/* 共享：最小 DOM 桩 + 在页面作用域内执行 index.html 脚本，并提供测试 API */
const vm=require('vm');
function mkClassList(el){
  return {
    add(c){if(!el._cls.includes(c))el._cls.push(c)},
    remove(c){el._cls=el._cls.filter(x=>x!==c)},
    toggle(c,on){const has=el._cls.includes(c);const want=(on===undefined)?!has:!!on;
      if(want&&!has)el._cls.push(c);if(!want&&has)el._cls=el._cls.filter(x=>x!==c);return want},
    contains(c){return el._cls.includes(c)}
  };
}
function matchSel(el,sel){
  if(sel.indexOf('details')===0)return el.tag==='details';
  if(sel.charAt(0)==='.')return el._cls.indexOf(sel.slice(1))>=0;
  return el.tag===sel;
}
function findDesc(el,sel){
  for(const c of el.children){if(matchSel(c,sel))return c;const r=findDesc(c,sel);if(r)return r}
  return null;
}
class E{
  constructor(tag){
    this.tag=(tag||'div').toLowerCase();
    this.children=[];this.attrs={};this._cls=[];this._text='';this._html='';
    this.dataset={};this.style={};this.value='';this.placeholder='';
    this.listeners={};this.nodeType=1;this.open=false;
  }
  get className(){return this._cls.join(' ')}
  set className(v){this._cls=String(v||'').split(/\s+/).filter(Boolean)}
  get classList(){return mkClassList(this)}
  get textContent(){return this._text||this.children.map(c=>c.textContent).join('')}
  set textContent(v){this._text=String(v);this.children.length=0}
  get innerHTML(){return this._html}
  set innerHTML(v){this._html=String(v);this.children.length=0;if(this._html==='')this._text=''}
  setAttribute(k,v){this.attrs[k]=String(v);if(k==='class')this.className=v;if(k==='value')this.value=v}
  getAttribute(k){return this.attrs[k]===undefined?null:this.attrs[k]}
  removeAttribute(k){delete this.attrs[k]}
  addEventListener(t,fn){(this.listeners[t]=this.listeners[t]||[]).push(fn)}
  removeEventListener(){}
  dispatch(t,ev){(this.listeners[t]||[]).forEach(f=>f(ev||{stopPropagation(){},preventDefault(){}}))}
  append(...kids){kids.forEach(k=>{if(k==null)return;if(typeof k==='string'){this._text+=k;return}this.children.push(k);k.parentNode=this})}
  prepend(...kids){kids.forEach(k=>{if(k)this.children.unshift(k)})}
  querySelector(sel){return findDesc(this,sel)}
  querySelectorAll(sel){const out=[];const walk=e=>{e.children.forEach(c=>{if(matchSel(c,sel))out.push(c);walk(c)})};walk(this);return out}
  scrollIntoView(){}focus(){}
  get firstChild(){return this.children[0]||null}
  get options(){return this.children.filter(c=>c.tag==='option')}
  set selected(v){this._selected=!!v}
  get selected(){return !!this._selected}
}
const API=`
function __reset(){
  S=freshState();selectedChip=null;lastResult=null;revStale=false;
  S.chromFocus=null;CALC=newCalcCaches();GEN_CACHE=new Map();
  return S;
}
function __setSimple(n,letters){
  const L=letters||'ABCDEFGHIJ';
  S.simpleCount=n;
  S.simple.length=n;   /* 必须真正截断，否则旧基因残留在 S.simple 里会变成"多余基因" */
  S.multiCount=0;S.multi.length=0;S.cytoCount=0;S.cyto.length=0;
  S.sexEnabled=false;S.sexSystem='none';S.barr=false;
  S.gLethal={enabled:false,rules:[]};S.zLethal={enabled:false,rules:[]};
  S.removals=[];DOM_FLIP=new Set();
  for(let i=0;i<n;i++)S.simple[i]={letter:L[i],dom:'显'+(i+1),rec:'隐'+(i+1),mid:'中'+L[i],mode:'complete',inherit:'auto',maternal:false,sexDomM:true};
  ['simple','multi','cyto'].forEach(g=>{S.chrom[g]=chromDef();S.chrom[g].pairs=Math.max(1,n);S.chrom[g].pairsAuto=false;});
  rebuildLoci();
  return S.simple.map(x=>x.letter);
}
function __setMulti(tiers,letter){
  S.simpleCount=0;S.simple.length=0;S.cytoCount=0;S.cyto.length=0;
  S.multiCount=1;S.multi.length=1;
  S.multi[0]={letter:letter||'I',tiers:tiers};
  S.sexEnabled=false;S.sexSystem='none';DOM_FLIP=new Set();
  S.chrom.multi=chromDef();S.chrom.multi.pairs=1;S.chrom.multi.pairsAuto=false;
  rebuildLoci();return S.multi[0];
}
function __setCyto(variants,letter){
  S.simpleCount=0;S.simple=[];S.multiCount=0;S.multi=[];S.cytoCount=1;
  S.cyto[0]={letter:letter||'L',variants:variants};
  S.chrom.cyto=chromDef();S.chrom.cyto.pairs=1;S.chrom.cyto.pairsAuto=false;
  rebuildLoci();return S.cyto[0];
}
function __sex(system,barr,inherit){
  S.sexEnabled=true;S.sexSystem=system||'XY';S.barr=!!barr;
  S.simple[0].inherit=inherit||'X';
  rebuildLoci();return S.sexSystem;
}
function __link(pairs,placements,rec){
  const ch=S.chrom.simple;
  ch.pairs=pairs;ch.pairsAuto=false;ch.placed=placements||[];ch.rec=rec||{};
  normalizeChrom('simple');
  return JSON.stringify(ch.placed);
}
function __p(all,sex,cyto){return{all:all||{},cyto:cyto||{},sex:sex||'F'}}
function __x(p1,p2,N,nextMode,mode){
  CALC=newCalcCaches();GEN_CACHE=new Map();
  return forwardChain(p1,p2,mode||'cross',N||2,nextMode||'self');
}
function __self(p,N){CALC=newCalcCaches();GEN_CACHE=new Map();return forwardChain(p,'','self',N||2,'self')}
function __gen(parent,role){CALC=newCalcCaches();GEN_CACHE=new Map();return makeGametes(parent,role||'F').list}
function __gamStr(list){
  /* 配子符号串：不带空格/HTML，便于断言 */
  const sym=g=>{
    const out=[];
    LOC.forEach(l=>{
      if(l.group==='cyto')return;
      const a=g.hap[l.id];
      if(a&&a.length)out.push(sortAlleles(l,a).join(''));
      else if(a&&a.length===0)out.push('O');
    });
    if(g.sexType)out.push(g.sexType);
    return out.join('');
  };
  return list.filter(e=>!rIs0(e.pn)).map(e=>sym(e.g)+'='+rStr(e.pn)).sort().join(' ');
}
function __ratio(pop){
  const m=new Map();
  pop.forEach(v=>{const t=zygPhenotype(v.z);if(!t)return;const c=m.get(t);m.set(t,c?rAdd(c,v.pn):v.pn)});
  const arr=[...m.entries()].sort((a,b)=>rNum(b[1])-rNum(a[1]));
  return ratioStr(arr.map(x=>x[1]));
}
function __ratioList(pop){
  const m=new Map();
  pop.forEach(v=>{const t=zygPhenotype(v.z);if(!t)return;const c=m.get(t);m.set(t,c?rAdd(c,v.pn):v.pn)});
  const arr=[...m.entries()].sort((a,b)=>rNum(b[1])-rNum(a[1]));
  return arr.map(x=>x[0]);
}
function __genoRatio(pop){
  const m=new Map();
  pop.forEach(v=>{const k=zKey(v.z);const c=m.get(k);m.set(k,c?rAdd(c,v.pn):v.pn)});
  const arr=[...m.entries()].sort((a,b)=>rNum(b[1])-rNum(a[1]));
  return ratioStr(arr.map(x=>x[1]));
}
function __genoMap(pop){
  const clean=s=>String(s||'').replace(/<[^>]*>/g,'').replace(/\s+/g,'');
  const m=new Map();
  pop.forEach(v=>{const k=clean(genoHtml(v.z));const c=m.get(k);m.set(k,c?rAdd(c,v.pn):v.pn)});
  return [...m.entries()].sort((a,b)=>String(a[0]).localeCompare(String(b[0]))).map(x=>[x[0],rStr(x[1])]);
}
function __sum(pop){let t=rZero;pop.forEach(v=>t=rAdd(t,v.pn));return rStr(t)}
/* 把 buildStepsText 的混合数组（文字 + DOM 节点）拉平成纯文本，供断言检查 */
function __stepsText(g){
  const NL=String.fromCharCode(10);
  const items=buildStepsText(g);
  const txt=[];
  const walk=e=>{
    if(!e)return;
    if(e._text)txt.push(e._text);
    if(e.tag==='td'||e.tag==='th')txt.push('  ');
    if(e.children)for(const c of e.children)walk(c);
    if(e.tag==='tr')txt.push(NL);
  };
  items.forEach(x=>{
    if(x==null)return;
    if(typeof x==='string'){txt.push(x);txt.push(NL);return}
    if(x.nodeType===1){walk(x);txt.push(NL);return}
    txt.push(String(x));txt.push(NL);
  });
  return txt.join('');
}
function __inter(type,traits,extra){
  S.inter=Object.assign({enabled:true,type:type,locusA:'n0',locusB:'n1',traits:traits,
    addLoci:['n0','n1'],pathway:{steps:[],final:''},custom:{},customLoci:[]},extra||{});
  return S.inter.type;
}
function __freq(pop,pred){
  let t=rZero;
  pop.forEach(v=>{if(v&&v.z&&pred(v.z))t=rAdd(t,v.pn)});
  return rStr(t);
}
function __rev(setup){
  const rv=S.rev;
  rv.genes=(setup.genes||['A','B']).map(g=>({letter:g,dom:'',rec:''}));
  rv.phenList=setup.phenList||'';
  rv.nGen=(setup.nGen==null?0:setup.nGen);
  rv.chrom=[];rv.rec=(setup.rec==null?20:setup.rec);
  rv.obs=(setup.obs||[]).map(o=>({gen:o[0],ratio:o[1],sep:false}));
  rv.firstMode=setup.firstMode||'cross';
  rv.nextMode=setup.nextMode||'self';
  rv.trySex=!!setup.trySex;rv.tryLethal=!!setup.tryLethal;rv.tryInter=!!setup.tryInter;
  rv.pure=!!setup.pure;rv.trySexInf=false;rv.domUnknown=!!setup.domUnknown;
  rv.p1Phen={};rv.p2Phen={};rv.result=null;rv.pw.enabled=false;rv.pw.reactions=[];
  rebuildLoci();
  runReverse(true);
  return S.rev.result;
}
function __note(){ return 'ok'; }
`;
function makeContext(script){
  const body=new E('body');
  const doc={
    documentElement:new E('html'),body,
    createElement:t=>new E(t),
    createElementNS:(ns,t)=>new E(t),
    createTextNode:t=>{const e=new E('#text');e._text=String(t);return e},
    createDocumentFragment:()=>new E('fragment'),
    _byId:{},
    getElementById(id){
      if(!doc._byId[id]){const e=new E('div');e.attrs.id=id;body.append(e);doc._byId[id]=e}
      return doc._byId[id];
    },
    querySelector:s=>body.querySelector(s),
    querySelectorAll:s=>body.querySelectorAll(s),
    addEventListener(){}
  };
  doc.documentElement.dataset={};
  const win={
    document:doc,
    getComputedStyle:()=>({}),
    addEventListener(){},removeEventListener(){},
    requestAnimationFrame:fn=>setTimeout(fn,0),
    setTimeout,clearTimeout,setInterval,clearInterval,
    console
  };
  win.window=win;win.self=win;win.globalThis=win;
  const ctx=vm.createContext(win);
  vm.runInContext(script,ctx,{filename:'index.html#script'});
  vm.runInContext(API,ctx,{filename:'test-api'});
  return ctx;
}
module.exports={makeContext,E};
