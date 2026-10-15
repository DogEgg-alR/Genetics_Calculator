/* 回归自检：共享 DOM 桩 + 抽出 index.html 内联脚本在页面作用域执行 + 遗传学比例断言。
   约定：每个用例用模板串直接给出可执行代码，不使用任何会提前求值的包装函数。
   期望值来历：教科书经典比例 + 独立复算脚本核对（README「自检」一节）。 */
const fs=require('fs'), path=require('path'), vm=require('vm');
/* 默认读取同目录的 index.html（跨平台），也可用命令行参数指定其它文件 */
const FILE=process.argv[2]||path.join(__dirname,'index.html');
const html=fs.readFileSync(FILE,'utf8');
let script=(()=>{
  const m=html.match(/<script>([\s\S]*?)<\/script>/);
  if(!m)throw new Error('未找到 <script> 块');
  return m[1];
})();
script=script.replace(/^const (rAdd|rSub|rMul|rZero|rOne|rNum|rIs0|rEq)=/gm,'var $1=');
const ctx=require('./testdom.js').makeContext(script);
const ev=code=>vm.runInContext(code,ctx,{filename:'case'});

let pass=0,fail=0;const failures=[];
function T(name,code,check){
  let v;
  try{v=ev(code)}catch(e){fail++;const d='异常 '+e.message;failures.push(name+' -> '+d);console.log('  FAIL  '+name+' -> '+d);return}
  let r;
  try{r=check(v)}catch(e){r='断言异常 '+e.message}
  if(r===true){pass++;console.log('  PASS  '+name)}else{fail++;const d=(typeof r==='string')?r:JSON.stringify(v);failures.push(name+' -> '+d);console.log('  FAIL  '+name+' -> '+d)}
}
const eq=s=>(v=>v===s?true:'实际 '+JSON.stringify(v));
const numeric=s=>(v=>Math.abs(Number(v)-Number(s))<1e-9?true:'实际 '+JSON.stringify(v));
const ratioIs=s=>(v=>{const f=x=>String(x).split(' : ').map(Number).sort((a,b)=>a-b).join(':');
  return f(v)===f(s)?true:'实际 '+JSON.stringify(v)+'（排序后 '+f(v)+'）期望排序后 '+f(s)});
const gamIs=s=>(v=>{const p=x=>{const m={};String(x).split(' ').forEach(t=>{const i=t.lastIndexOf('=');if(i>0)m[t.slice(0,i)]=t.slice(i+1)});return JSON.stringify(Object.keys(m).sort().map(k=>k+'='+m[k]))};
  return p(v)===p(s)?true:'实际 '+JSON.stringify(v)});
const sortedIs=s=>(v=>{const f=x=>String(x).split(' | ').sort().join(' | ');return f(v)===f(s)?true:'实际 '+JSON.stringify(v)});
const has=s=>(v=>String(v).indexOf(s)>=0?true:'实际 '+JSON.stringify(v));
const pairOf=(f1,f2,s1,s2)=>(v=>{const p=String(v).split(' / ');if(p.length!==2)return'实际 '+v;
  return (f1(s1)(p[0])===true&&f2(s2)(p[1])===true)?true:'实际 '+v});

const P2="__p({n0:['A','a'],n1:['B','b']})";
const P3="__p({n0:['A','a'],n1:['B','b'],n2:['C','c']})";
const PLINK="[{pair:0,col:0,slot:0,locus:'n0',sym:'A'},{pair:0,col:1,slot:0,locus:'n0',sym:'a'},{pair:0,col:0,slot:1,locus:'n1',sym:'B'},{pair:0,col:1,slot:1,locus:'n1',sym:'b'}]";
const PLINK_REP="[{pair:0,col:0,slot:0,locus:'n0',sym:'A'},{pair:0,col:1,slot:0,locus:'n0',sym:'a'},{pair:0,col:0,slot:1,locus:'n1',sym:'b'},{pair:0,col:1,slot:1,locus:'n1',sym:'B'}]";

console.log('\n== A. 配子形成（分离 / 自由组合 / 连锁 / 交换 / 三体） ==');
T('Aa -> A:a = 1/2 : 1/2',
 `__reset();__setSimple(1);__gamStr(__gen(__p({n0:['A','a']})))`, gamIs('A=1/2 a=1/2'));
T('AaBb 自由组合 -> 4 种配子各 1/4',
 `__reset();__setSimple(2);__gamStr(__gen(${P2}))`, gamIs('AB=1/4 Ab=1/4 aB=1/4 ab=1/4'));
T('连锁 AB/ab、r=20% -> 亲本型各 2/5、重组型各 1/10',
 `__reset();__setSimple(2);__link(1,${PLINK},{0:{0:'20'}});__gamStr(__gen(${P2}))`, gamIs('AB=2/5 ab=2/5 Ab=1/10 aB=1/10'));
T('相斥 Ab/aB、r=20% -> 亲本型各 2/5、重组型各 1/10',
 `__reset();__setSimple(2);__link(1,${PLINK_REP},{0:{0:'20'}});__gamStr(__gen(${P2}))`, gamIs('Ab=2/5 aB=2/5 AB=1/10 ab=1/10'));
T('交换值超过理论上限 50% -> 按 50% 计算并给出提示',
 `__reset();__setSimple(2);__link(1,${PLINK},{0:{0:'80'}});(function(){var u=buildUnits().find(function(x){return x.loci.length===2});return rStr(u.rec[0])+'|'+(u.recWarn[0]?'有提示':'无提示')})()`, eq('1/2|有提示'));
T('r=50% -> 4 种配子各 1/4',
 `__reset();__setSimple(2);__link(1,${PLINK},{0:{0:'50'}});__gamStr(__gen(${P2}))`, gamIs('AB=1/4 Ab=1/4 aB=1/4 ab=1/4'));
T('三体 Aaa 独立分配 -> A:Aa:Aaa:a:aa = 1:2:1:2:1',
 `__reset();__setSimple(1);S.chrom.simple.ploidy={0:3};normalizeChrom('simple');__gamStr(__gen(__p({n0:['A','a','a']})))`, gamIs('A=1/7 Aa=2/7 Aaa=1/7 a=2/7 aa=1/7'));
T('三体 AAA -> AAA:AA:A = 1:3:3',
 `__reset();__setSimple(1);S.chrom.simple.ploidy={0:3};normalizeChrom('simple');__gamStr(__gen(__p({n0:['A','A','A']})))`, gamIs('AAA=1/7 AA=3/7 A=3/7'));
T('缺体配子记为 O（nullG=alive）',
 `__reset();__setSimple(1);S.chrom.simple.ploidy={0:3};S.chrom.simple.nullG='alive';normalizeChrom('simple');__gamStr(__gen(__p({n0:['A','a','a']})))`, has('O='));
T('复等位 I^A=I^B>i：IA i × IB i -> IAIB:IAi:IBi:ii = 1:1:1:1（表型 A/B/AB/O 各 1/4）',
 `__reset();__setMulti([{cls:'dom',alleles:[{sym:'IA',trait:'A型'},{sym:'IB',trait:'B型'}]},{cls:'rec',alleles:[{sym:'i',trait:'O型'}]}]);(function(){var g=__x(__p({m0:['IA','i']}),__p({m0:['IB','i']}),1);return __genoMap(g[0].pop).map(function(x){return x[0]+'='+x[1]}).join(' | ')})()`, sortedIs('IAIB=1/4 | IAi=1/4 | IBi=1/4 | ii=1/4'));
T('复等位符号可放到染色体图上（保持符号顺序）',
 `__reset();__setMulti([{cls:'dom',alleles:[{sym:'IA',trait:'A型'},{sym:'IB',trait:'B型'}]},{cls:'rec',alleles:[{sym:'i',trait:'O型'}]}]);__link(1,[{pair:0,col:0,slot:0,locus:'m0',sym:'IA'},{pair:0,col:1,slot:0,locus:'m0',sym:'i'}],{});(function(){normalizeChrom('multi');var q=S.chrom.multi.placed.filter(function(x){return x.locus==='m0'});return (q.length===2&&q[0].sym===alleleSyms(locusById('m0'))[0])?'ok':'实际 '+JSON.stringify(S.chrom.multi.placed)+' syms='+JSON.stringify(alleleSyms(locusById('m0')))})()`, eq('ok'));

console.log('\n== B. 杂交 / 自交经典比例 ==');
T('Aa × Aa -> 1/4 AA、1/2 Aa、1/4 aa',
 `__reset();__setSimple(1);__genoMap(__x(__p({n0:['A','a']}),__p({n0:['A','a']}),1)[0].pop).map(function(x){return x[0]+'='+x[1]}).join(' | ')`, sortedIs('AA=1/4 | Aa=1/2 | aa=1/4'));
T('Aa × Aa -> 显:隐 = 3:1',
 `__reset();__setSimple(1);__ratio(__x(__p({n0:['A','a']}),__p({n0:['A','a']}),1)[0].pop)`, ratioIs('3 : 1'));
T('Aa × aa 测交 -> 1:1',
 `__reset();__setSimple(1);__ratio(__x(__p({n0:['A','a']}),__p({n0:['a','a']}),1)[0].pop)`, ratioIs('1 : 1'));
T('Aa × Aa 的 F1=3:1；F1 群体自交得 F2=5:3（1/4AA、1/2Aa、1/4aa 自交累加）',
 `__reset();__setSimple(1);(function(){var g=__x(__p({n0:['A','a']}),__p({n0:['A','a']}),2);return __ratio(g[0].pop)+' / '+__ratio(g[1].pop)})()`, pairOf(ratioIs,ratioIs,'3 : 1','5 : 3'));
T('双杂合自交 -> 9:3:3:1',
 `__reset();__setSimple(2);__ratio(__self(${P2},1)[0].pop)`, ratioIs('9 : 3 : 3 : 1'));
T('三杂合自交 -> 27:9:9:9:3:3:3:1',
 `__reset();__setSimple(3);__ratio(__self(${P3},1)[0].pop)`, ratioIs('27 : 9 : 9 : 9 : 3 : 3 : 3 : 1'));
T('Aa 连续自交 5 代 -> 杂合子频率 (1/2)^5 = 1/32',
 `__reset();__setSimple(1);(function(){var g=__self(__p({n0:['A','a']}),5);return __freq(g[4].pop,function(z){var a=z.all.n0||[];return a.indexOf('A')>=0&&a.indexOf('a')>=0})})()`, eq('1/32'));
T('Aa 连续自交 5 代 -> 显:隐 = 33:31（(1/2)^5 杂合 + 纯合显性）',
 `__reset();__setSimple(1);(function(){var g=__self(__p({n0:['A','a']}),5);return __ratio(g[4].pop)})()`, ratioIs('33 : 31'));
T('不完全显性 Aa×Aa -> 显:中:隐 = 1:2:1',
 `__reset();__setSimple(1);S.simple[0].mode='incomplete';__ratio(__x(__p({n0:['A','a']}),__p({n0:['A','a']}),1)[0].pop)`, ratioIs('1 : 2 : 1'));
T('从性遗传（雄显雌隐） F1 雌 1:3、雄 3:1',
 `__reset();__setSimple(1);S.sexEnabled=true;S.sexSystem='XY';S.simple[0].mode='sexInfluenced';S.simple[0].sexDomM=true;rebuildLoci();(function(){var g=__x(__p({n0:['A','a']},'F'),__p({n0:['A','a']},'M'),1);return __ratio(g[0].pop.filter(function(v){return v.z.sex==='F'}))+' / '+__ratio(g[0].pop.filter(function(v){return v.z.sex==='M'}))})()`, pairOf(ratioIs,ratioIs,'1 : 3','3 : 1'));
T('自由交配达到平衡：Aa 群体随机交配后仍 1/4 AA、1/2 Aa、1/4 aa',
 `__reset();__setSimple(1);(function(){var g=__x(__p({n0:['A','a']}),__p({n0:['A','a']}),2,'free','cross');return __genoMap(g[1].pop).map(function(x){return x[0]+'='+x[1]}).join(' | ')})()`, sortedIs('AA=1/4 | Aa=1/2 | aa=1/4'));

console.log('\n== C. 连锁与交换的群体比例 ==');
T('AB/ab 测交（×ab/ab）-> 亲本型 4:4、重组型 1:1',
 `__reset();__setSimple(2);__link(1,${PLINK},{0:{0:'20'}});__ratio(__x(${P2},__p({n0:['a','a'],n1:['b','b']}),1)[0].pop)`, ratioIs('4 : 4 : 1 : 1'));
T('AB/ab 自交、r=20% -> A_B_:A_bb:aaB_:aabb = 66:9:9:16',
 `__reset();__setSimple(2);__link(1,${PLINK},{0:{0:'20'}});__ratio(__self(${P2},1)[0].pop)`, ratioIs('66 : 9 : 9 : 16'));
T('两基因分到不同染色体对 -> 自由组合 9:3:3:1',
 `__reset();__setSimple(2);__link(2,[],{});__ratio(__self(${P2},1)[0].pop)`, ratioIs('9 : 3 : 3 : 1'));
T('把已连锁的两基因移到不同对染色体 -> 恢复自由组合',
 `__reset();__setSimple(2);__link(1,${PLINK},{0:{0:'20'}});__link(2,[{pair:0,col:0,slot:0,locus:'n0',sym:'A'},{pair:0,col:1,slot:0,locus:'n0',sym:'a'},{pair:1,col:0,slot:1,locus:'n1',sym:'B'},{pair:1,col:1,slot:1,locus:'n1',sym:'b'}],{});__ratio(__self(${P2},1)[0].pop)`, ratioIs('9 : 3 : 3 : 1'));
T('三基因连锁（相邻 r=20%）自交 -> 各类表型概率之和 = 1',
 `__reset();__setSimple(3);__link(1,[{pair:0,col:0,slot:0,locus:'n0',sym:'A'},{pair:0,col:1,slot:0,locus:'n0',sym:'a'},{pair:0,col:0,slot:1,locus:'n1',sym:'B'},{pair:0,col:1,slot:1,locus:'n1',sym:'b'},{pair:0,col:0,slot:2,locus:'n2',sym:'C'},{pair:0,col:1,slot:2,locus:'n2',sym:'c'}],{0:{0:'20',1:'20'}});__sum(__self(${P3},1)[0].pop)`, numeric(1));

console.log('\n== D. 基因互作（经典比例） ==');
const IC=(type,traits,expect)=>[`__reset();__setSimple(2);__inter('${type}',${JSON.stringify(traits)});__ratio(__self(${P2},1)[0].pop)`,ratioIs(expect)];
T('互补作用 -> 9:7',...IC('complement',['显','隐'],'9 : 7'));
T('隐性上位 -> 9:3:4',...IC('recessiveEpi',['一','二','三'],'9 : 3 : 4'));
T('显性上位 -> 12:3:1',...IC('dominantEpi',['一','二','三'],'12 : 3 : 1'));
T('抑制作用 -> 13:3',...IC('inhibitor',['一','二'],'13 : 3'));
T('重叠作用 -> 15:1',...IC('duplicate',['一','二'],'15 : 1'));
T('积加作用 -> 9:6:1',...IC('additive',['一','二','三'],'9 : 6 : 1'));
T('累加效应（2 对显性基因）-> 1:4:6:4:1',
 `__reset();__setSimple(2);__inter('polygenic',['','','',''],{pgVal:false});__ratio(__self(${P2},1)[0].pop)`, ratioIs('1 : 4 : 6 : 4 : 1'));
T('累加效应（3 对显性基因）-> 1:6:15:20:15:6:1',
 `__reset();__setSimple(3);__inter('polygenic',['','','',''],{addLoci:['n0','n1','n2'],pgVal:false});__ratio(__self(${P3},1)[0].pop)`, ratioIs('1 : 6 : 15 : 20 : 15 : 6 : 1'));
T('连续数值表型（基础 150、增量 5、2 对）-> 9 级 150~170cm',
 `__reset();__setSimple(2);__inter('polygenic',['','','',''],{pgVal:true,pgName:'株高',pgUnit:'cm',pgBase:'150',pgInc:'5'});(function(){var g=__self(${P2},1);var nums=g[0].pop.map(function(v){var m=/株高 ([0-9.]+)cm/.exec(zygPhenotype(v.z));return m?parseFloat(m[1]):NaN}).filter(function(x){return !isNaN(x)});return JSON.stringify([Math.min.apply(null,nums),Math.max.apply(null,nums),nums.length])})()`, eq('[150,170,9]'));
T('通路图（串联）aabb -> 前体"白色"',
 `__reset();__setSimple(2);S.inter={enabled:true,type:'pathway',locusA:'',locusB:'',traits:['','','',''],addLoci:[],pathway:{steps:[{locus:'n0',blocked:'白色'},{locus:'n1',blocked:'红色'}],final:'紫色',sup:null},custom:{},customLoci:[]};zygPhenotype({all:{n0:['a','a'],n1:['b','b']},cyto:{},sex:'F'})`, eq('白色'));
T('通路图（串联）A_B_ -> 最终产物"紫色"',
 `__reset();__setSimple(2);S.inter={enabled:true,type:'pathway',locusA:'',locusB:'',traits:['','','',''],addLoci:[],pathway:{steps:[{locus:'n0',blocked:'白色'},{locus:'n1',blocked:'红色'}],final:'紫色',sup:null},custom:{},customLoci:[]};zygPhenotype({all:{n0:['A','a'],n1:['B','b']},cyto:{},sex:'F'})`, eq('紫色'));
T('自定义互作表 A_bb -> 指定表型',
 `__reset();__setSimple(2);__inter('custom',['','','',''],{customLoci:['n0','n1'],custom:{'n0=D,n1=r':'只有A'}});zygPhenotype({all:{n0:['A','a'],n1:['b','b']},cyto:{},sex:'F'})`, eq('只有A'));

console.log('\n== E. 致死（配子 / 合子） ==');
T('显性纯合致死 Aa×Aa -> 2:1',
 `__reset();__setSimple(1);S.zLethal={enabled:true,rules:[{rate:'100',conds:[{locus:'n0',allele:'A',type:'hom'}]}]};__ratio(__x(__p({n0:['A','a']}),__p({n0:['A','a']}),1)[0].pop)`, ratioIs('2 : 1'));
T('隐性纯合致死 Aa×Aa -> 只剩显性',
 `__reset();__setSimple(1);S.zLethal={enabled:true,rules:[{rate:'100',conds:[{locus:'n0',allele:'a',type:'hom'}]}]};__ratio(__x(__p({n0:['A','a']}),__p({n0:['A','a']}),1)[0].pop)`, ratioIs('1'));
T('含 A 的雄配子 50% 致死 -> 雄配子 A:a = 1/3 : 2/3',
 `__reset();__setSimple(1);S.gLethal={enabled:true,rules:[{sex:'male',rate:'50',conds:[{locus:'n0',allele:'A',type:'has'}]}]};__gamStr(__gen(__p({n0:['A','a']}),'M'))`, gamIs('A=1/3 a=2/3'));
T('雌雄配子死亡率不同：雄 A 全死、雌配子不变',
 `__reset();__setSimple(1);S.gLethal={enabled:true,rules:[{sex:'bothdiff',rateM:'100',rateF:'0',conds:[{locus:'n0',allele:'A',type:'has'}]}]};__gamStr(__gen(__p({n0:['A','a']}),'M'))+' / '+__gamStr(__gen(__p({n0:['A','a']}),'F'))`, pairOf(gamIs,gamIs,'a=1','A=1/2 a=1/2'));

console.log('\n== F. 伴性 / 巴氏小体 / 细胞质 / 母系遗传 ==');
T('伴X X^A X^a ♀ × X^a Y ♂ -> 4 种表型（1:1:1:1）',
 `__reset();__setSimple(1);__sex('XY',false,'X');__ratio(__x(__p({n0:['A','a']},'F'),__p({n0:['a']},'M'),1)[0].pop)`, ratioIs('1 : 1 : 1 : 1'));
T('伴X X^A X^a ♀ × X^A Y ♂ -> 雌全显性、雄 1:1',
 `__reset();__setSimple(1);__sex('XY',false,'X');(function(){var g=__x(__p({n0:['A','a']},'F'),__p({n0:['A']},'M'),1);return __ratio(g[0].pop.filter(function(v){return v.z.sex==='F'}))+' / '+__ratio(g[0].pop.filter(function(v){return v.z.sex==='M'}))})()`, pairOf(ratioIs,ratioIs,'1','1 : 1'));
T('伴Y 父传子、女儿没有该基因',
 `__reset();__setSimple(1);__sex('XY',false,'Y');(function(){var g=__x(__p({n0:[]},'F'),__p({n0:['A']},'M'),1);var males=g[0].pop.filter(function(v){return v.z.sex==='M'});var allMale=males.every(function(v){return (v.z.all.n0||[]).indexOf('A')>=0});var fems=g[0].pop.filter(function(v){return v.z.sex==='F'});var noneFem=fems.every(function(v){return (v.z.all.n0||[]).length===0});return String(allMale&&noneFem)})()`, eq('true'));
T('ZW 型：伴Z ♀ Z^A W × ♂ Z^a Z^a -> 子代 1:1',
 `__reset();__setSimple(1);__sex('ZW',false,'X');__ratio(__x(__p({n0:['A']},'F'),__p({n0:['a','a']},'M'),1)[0].pop)`, ratioIs('1 : 1'));
T('XY 同源区段 X^a X^a ♀ × X^A Y^a ♂ -> 1:1',
 `__reset();__setSimple(1);__sex('XY',false,'both');__ratio(__x(__p({n0:['a','a']},'F'),__p({n0:['A','a']},'M'),1)[0].pop)`, ratioIs('1 : 1'));
T('巴氏小体：杂合♀ X^A X^a -> 嵌合体',
 `__reset();__setSimple(1);__sex('XY',true,'X');zygPhenotype({all:{n0:['A','a']},cyto:{},sex:'F'})`, has('嵌合'));
T('巴氏小体：雄性唯一的 X 不失活（X^a Y -> 隐1）',
 `__reset();__setSimple(1);__sex('XY',true,'X');zygPhenotype({all:{n0:['a']},cyto:{},sex:'M'})`, eq('隐1（♂）'));
T('巴氏小体：伴X杂合♀的子代不出现缺体（O）',
 `__reset();__setSimple(1);__sex('XY',true,'X');(function(){var g=__x(__p({n0:['A','a']},'F'),__p({n0:['a']},'M'),1);return String(!g[0].pop.some(function(v){return !(v.z.all.n0||[]).length}))})()`, eq('true'));
T('细胞质遗传：正反交不同、子代随母本',
 `__reset();__setCyto([{sym:'G',trait:'绿枝'},{sym:'W',trait:'白枝'}]);(function(){var a=__x(__p({},'F',{c0:'W'}),__p({},'M',{c0:'G'}),1);var b=__x(__p({},'F',{c0:'G'}),__p({},'M',{c0:'W'}),1);return __ratioList(a[0].pop).join(',')+' / '+__ratioList(b[0].pop).join(',')})()`, eq('白枝 / 绿枝'));
T('母系遗传（母性效应）：子代性状由母本基因型决定',
 `__reset();__setSimple(1);S.simple[0].maternal=true;(function(){var g=__x(__p({n0:['A','A']},'F'),__p({n0:['a','a']},'M'),1);return __ratioList(g[0].pop).join(',')})()`, has('显1'));

console.log('\n== G. 反推（由比例推亲本与遗传方式） ==');
const RV=(setup,min)=>[`__reset();__setSimple(2);__rev(${setup}).matches.length`,v=>v>=(min||1)?true:'只找到 '+v+' 个解'];
T('反推 3:1（2 基因、纯合亲本、显隐未知）-> 有解',...RV("{genes:['A','B'],obs:[[2,'3:1']],pure:true,domUnknown:true}"));
T('反推 9:3:4（隐性上位 + 未写出的互补基因）-> 有解',...RV("{genes:['A','B'],phenList:'紫,红,白',obs:[[2,'紫:9,红:3,白:4']],tryInter:true,nGen:1,pure:true}"));
T('反推 12:3:1（显性上位）-> 有解',...RV("{genes:['A','B'],phenList:'紫,红,白',obs:[[2,'紫:12,红:3,白:1']],tryInter:true,nGen:1}"));
T('反推 9:7（互补）-> 有解',...RV("{genes:['A','B'],phenList:'紫,白',obs:[[2,'紫:9,白:7']],tryInter:true,nGen:1,pure:true}"));
T('反推 15:1（重叠）-> 有解',...RV("{genes:['A','B'],phenList:'紫,白',obs:[[2,'紫:15,白:1']],tryInter:true,nGen:1}"));
T('反推 2:1（显性纯合致死）-> 有解',...RV("{genes:['A'],obs:[[2,'2:1']],tryLethal:true}"));
T('反推 1:1（测交）-> 有解',...RV("{genes:['A'],obs:[[1,'1:1']]}"));
T('反推 3:1（单基因、F2 观测）-> 有解',...RV("{genes:['A'],obs:[[2,'3:1']]}"));
T('反推 1:1（含伴性搜索）-> 有解',...RV("{genes:['A'],obs:[[1,'1:1']],trySex:true}"));
T('反推无解时不抛异常、记录 tried',
 `__reset();__setSimple(1);(function(){var r=__rev({genes:['A'],obs:[[2,'7:5:3']]});return typeof r.tried+'/'+r.matches.length})()`, eq('number/0'));
T('反推后状态完全恢复（不影响正推）',
 `__reset();__setSimple(2);(function(){var b=JSON.stringify([S.simpleCount,S.simple.map(function(x){return x.letter})]);__rev({genes:['A','B'],obs:[[2,'3:1']],pure:true});return String(JSON.stringify([S.simpleCount,S.simple.map(function(x){return x.letter})])===b)})()`, eq('true'));
T('性状候选：给基因填显/隐性性状后即可选（本次修复）',
 `__reset();S.rev.phenList='';S.rev.nGen=0;S.rev.genes=[{letter:'A',dom:'紫花',rec:'白花'},{letter:'B',dom:'长粒',rec:'圆粒'}];JSON.stringify(traitOptions())`, eq('["紫花","白花","长粒","圆粒"]'));
T('性状候选：有表型清单时优先用清单',
 `__reset();S.rev.phenList='紫,绿,白';S.rev.genes=[{letter:'A',dom:'甲',rec:'乙'}];JSON.stringify(traitOptions())`, eq('["紫","绿","白"]'));
T('性状候选：支持全角逗号 / 顿号分隔',
 `__reset();S.rev.phenList='紫，绿、白';S.rev.genes=[];JSON.stringify(traitOptions())`, eq('["紫","绿","白"]'));
T('额外基因：nGen=1 时参与计算的基因数 +1、字母自动顺延',
 `__reset();__setSimple(2);S.rev.genes=[{letter:'A'},{letter:'B'}];S.rev.nGen=1;JSON.stringify([revGeneCount(),revGeneLetter(2)])`, eq('[3,"C"]'));
T('反推结果可渲染图解（不抛异常）',
 `__reset();__setSimple(2);__rev({genes:['A','B'],obs:[[2,'3:1']],pure:true});renderDiagram();'ok'`, eq('ok'));

console.log('\n== H. 性能（多代迭代 + 缓存） ==');
T('F10 两基因自交 < 3s',
 `__reset();__setSimple(2);(function(){var t=Date.now();__self(${P2},10);return Date.now()-t})()`, v=>v<3000?true:v+'ms');
T('F10 三基因自交 < 5s',
 `__reset();__setSimple(3);(function(){var t=Date.now();__self(${P3},10);return Date.now()-t})()`, v=>v<5000?true:v+'ms');
T('F10 四基因自交 < 20s',
 `__reset();__setSimple(4);(function(){var t=Date.now();__self(__p({n0:['A','a'],n1:['B','b'],n2:['C','c'],n3:['D','d']}),10);return Date.now()-t})()`, v=>v<20000?true:v+'ms');
T('F8 五基因自交 < 30s',
 `__reset();__setSimple(5);(function(){var t=Date.now();__self(__p({n0:['A','a'],n1:['B','b'],n2:['C','c'],n3:['D','d'],n4:['E','e']}),8);return Date.now()-t})()`, v=>v<30000?true:v+'ms');
T('重复同一计算第二次命中缓存（不慢于第一次）',
 `__reset();__setSimple(3);(function(){var p=${P3};var a=Date.now();__self(p,8);var b=Date.now();__self(p,8);return JSON.stringify([b-a,Date.now()-b])})()`, v=>{const[a1,a2]=JSON.parse(v);return a2<=a1*1.5+120?true:'首次'+a1+'ms 再次'+a2+'ms'});
T('F6 四基因自交结果概率和为 1',
 `__reset();__setSimple(4);(function(){var g=__self(__p({n0:['A','a'],n1:['B','b'],n2:['C','c'],n3:['D','d']}),6);return __sum(g[5].pop)})()`, numeric(1));

console.log('\n== I. 界面与渲染 ==');
T('renderConfig + 计算 + 图解 全流程无异常',
 `__reset();__setSimple(2);renderConfig();renderRun();runCalculation();renderDiagram();'ok'`, eq('ok'));
T('七个栏目 Body 都能生成',
 `__reset();__setSimple(2);var ns=['核遗传等位基因','复等位基因','细胞质遗传','连锁关系','配子致死','合子致死','基因互作'];ns.filter(function(n){return !buildPanelBody(n)}).join(',')||'ok'`, eq('ok'));
T('染色体编辑器与细胞图渲染无异常',
 `__reset();__setSimple(2);(buildChromEditor('simple')&&drawChromSVG('simple'))?'ok':'空'`, eq('ok'));
T('染色体图：放置等位后自动归到同一对',
 `__reset();__setSimple(2);selectedChip='n1|B';chromHandleSlotClick('simple',0,0,1);chromHandleSlotClick('simple',0,1,1);(function(){var q=S.chrom.simple.placed.filter(function(x){return x.locus==='n1'});return (q.length===2&&q[0].pair===q[1].pair)?'ok':JSON.stringify(q)})()`, eq('ok'));
T('染色体图：放置成功会弹模态框',
 `__reset();__setSimple(2);(function(){var hit=0;var old=openModal;window.openModal=function(){hit++};selectedChip='n0|a';chromHandleSlotClick('simple',0,1,1);window.openModal=old;return String(hit>0)})()`, eq('true'));
T('致死栏目添加规则后保持展开',
 `__reset();__setSimple(1);renderConfig();(function(){var c=document.getElementById('configPanel');var d=[].slice.call(c.querySelectorAll('details.panel')).find(function(x){return x.querySelector('summary').textContent.indexOf('配子致死')>=0});return String(!!d)})()`, eq('true'));
T('计算过程文本含分步详解（雌/雄配子、棋盘格、合并同类项、校验、∵/∴）',
 `__reset();__setSimple(2);(function(){var g=__self(${P2},1);lastResult={gens:g,p1:${P2},p2:null,mode:'self'};var t=__stepsText(g[0]);return ['雌配子（卵细胞）的形成','雄配子（精子）的形成','棋盘格','合并同类项','表型比','校验','∵','∴'].filter(function(k){return t.indexOf(k)<0}).join(',')||'ok'})()`, eq('ok'));
T('计算过程把表格作为 DOM 节点插入（不再出现 [object HTMLTableElement]）',
 `__reset();__setSimple(2);(function(){var g=__self(${P2},1);lastResult={gens:g,p1:${P2},p2:null,mode:'self'};var a=buildStepsText(g[0]);var hasTable=a.some(function(x){return x&&x.nodeType===1});return (hasTable&&String(a).indexOf('[object HTMLTableElement]')<0)?'ok':'hasTable='+hasTable})()`, eq('ok'));
T('图解模式：抑制线支持"有A则抑制B"与"无A则抑制B"两种语义',
 `__reset();__setSimple(2);(function(){
   var nd=[{id:1,name:'白',x:60,y:60},{id:2,name:'紫',x:240,y:60}];
   var rx=[{from:1,to:2,gene:'B',pri:1}];
   var mkHyp=function(mode){return {genes:[{letter:'A'},{letter:'B'}],inh:['auto','auto'],let:['none','none'],flip:[],inter:'pw',pw:{nodes:nd,reactions:rx,inhibitions:[{gene:'A',targetGene:'B',mode:mode}]}}};
   var zA={all:{n0:['A','A'],n1:['B','B']},cyto:{},sex:'F'};
   var za={all:{n0:['a','a'],n1:['B','B']},cyto:{},sex:'F'};
   return JSON.stringify([pwPhenotype(mkHyp('present'),zA),pwPhenotype(mkHyp('present'),za),pwPhenotype(mkHyp('absent'),zA),pwPhenotype(mkHyp('absent'),za)]);
 })()`, eq('["白","紫","紫","白"]'));
T('世代详情弹窗（P 与 F1）无异常',
 `__reset();__setSimple(2);(function(){var g=__self(${P2},1);lastResult={gens:g,p1:${P2},p2:null,mode:'self'};showGenDetail('F1');showGenDetail('P');return 'ok'})()`, eq('ok'));
T('多代图解渲染（F6 三基因）无异常',
 `__reset();__setSimple(3);(function(){var g=__self(${P3},6);lastResult={gens:g,p1:${P3},p2:null,mode:'self'};renderDiagram();return 'ok'})()`, eq('ok'));
T('主题切换',
 `setTheme('dark');(function(){var a=document.documentElement.dataset.theme;setTheme('light');return a+' / '+document.documentElement.dataset.theme})()`, eq('dark / light'));
T('九个预设全部可加载',
 `['epi934','comp97','additive141','polygen3','abo','link','sexlink','cyto','lethal'].map(function(k){try{window.applyPreset(k);return k+':ok'}catch(e){return k+':ERR '+e.message}}).filter(function(x){return x.indexOf('ERR')>=0}).join(',')||'ok'`, eq('ok'));
T('预设 ABO IA i × IB i -> 四种基因型各 1/4',
 `window.applyPreset('abo');renderRun();runCalculation();__genoMap(lastResult.gens[0].pop).map(function(x){return x[0]+'='+x[1]}).join(' | ')`, sortedIs('IAIB=1/4 | IAi=1/4 | IBi=1/4 | ii=1/4'));
T('预设 伴X -> 1:1:1:1',
 `window.applyPreset('sexlink');renderRun();runCalculation();__ratio(lastResult.gens[0].pop)`, ratioIs('1 : 1 : 1 : 1'));
T('预设 显性纯合致死 -> 2:1',
 `window.applyPreset('lethal');renderRun();runCalculation();__ratio(lastResult.gens[0].pop)`, ratioIs('2 : 1'));
T('预设 隐性上位 F1 -> 9:3:4',
 `window.applyPreset('epi934');renderRun();runCalculation();__ratio(lastResult.gens[0].pop)`, ratioIs('9 : 3 : 4'));
T('预设 互补 F1 -> 9:7',
 `window.applyPreset('comp97');renderRun();runCalculation();__ratio(lastResult.gens[0].pop)`, ratioIs('9 : 7'));
T('预设 累加效应 F1 -> 1:4:6:4:1',
 `window.applyPreset('additive141');renderRun();runCalculation();__ratio(lastResult.gens[0].pop)`, ratioIs('1 : 4 : 6 : 4 : 1'));
T('预设 三基因连续表型 F1 -> 1:6:15:20:15:6:1',
 `window.applyPreset('polygen3');renderRun();runCalculation();__ratio(lastResult.gens[0].pop)`, ratioIs('1 : 6 : 15 : 20 : 15 : 6 : 1'));
T('预设 连锁 F1 可算且不为空',
 `window.applyPreset('link');renderRun();runCalculation();lastResult.gens[0].pop.length>0?'ok':'空'`, eq('ok'));
T('预设 细胞质：子代随母本（单一表型）',
 `window.applyPreset('cyto');renderRun();runCalculation();__ratio(lastResult.gens[0].pop)`, v=>v==='1'?true:'实际 '+v);

console.log('\n========================================');
console.log('通过 '+pass+' 项，失败 '+fail+' 项');
if(failures.length){console.log('失败清单：');failures.forEach(f=>console.log('  - '+f))}
process.exit(fail?1:0);
