/** INSTRUMENTASI SEMENTARA — pasangan pre-hydration untuk `shell/in-app-ads-probe.ts`.
 *
 * Hapus file ini bersama pemanggilnya di `app/layout.tsx` begitu penyebab interstitial
 * ganda terbukti. Tidak ada satu pun baris di sini yang boleh mengubah perilaku iklan:
 * semuanya membaca, mencatat, lalu meneruskan nilai aslinya apa adanya.
 *
 * ALASAN FILE INI ADA
 *
 * Probe React berjalan dari `useEffect`, jadi paling cepat ia hidup SETELAH hydration.
 * Semua yang terjadi sebelum itu tidak terlihat olehnya:
 *
 * - saat `show_<zone>` pertama kali didefinisikan SDK, dan oleh stack mana
 * - auto-start SDK dari atribut `data-zone` + `data-sdk` di script tag
 * - salinan SDK tambahan untuk related zone (`data-auto`), yang punya penjadwal sendiri
 * - tayangan pertama yang jatuh sebelum probe aktif
 * - transisi state capping (`ug4qk5tymo`) yang sudah selesai sebelum React mount
 *
 * Karena itu kode ini dikirim sebagai inline `<script>` di `<head>`: ia dieksekusi
 * sebelum `https://libtl.com/sdk.js` (yang `afterInteractive`) sehingga jebakan pada
 * `show_<zone>` sudah terpasang saat SDK mendefinisikannya.
 *
 * BENTUKNYA STRING, BUKAN MODUL
 *
 * Sama seperti `ADS_HINT_INIT_SCRIPT`: harus jalan sebelum paint pertama dan sebelum
 * bundle mana pun dievaluasi, jadi tidak bisa berupa import. Konsekuensinya kode di
 * dalam string tidak ikut dicek TypeScript — karena itu ia ditulis sesempit mungkin,
 * dibungkus `try/catch` di setiap batas yang bisa melempar (WebView Telegram mempartisi
 * storage dan bisa melempar hanya karena diakses), dan tidak punya dependensi apa pun.
 *
 * KONTRAK DENGAN PROBE REACT
 *
 * Script ini memiliki `window.__adProbePre`. Isinya buffer mentah + `origin` (titik nol
 * waktu). `startInAppAdsProbe()` MENYERAP buffer itu di awal dan memakai `origin` yang
 * sama, sehingga hasil `window.__adProbe.dump()` menjadi satu timeline berurutan dari
 * sebelum SDK dimuat sampai setelah hydration. Fungsi `show_*` yang sudah dibungkus di
 * sini ditandai `__probed` supaya probe React tidak membungkusnya dua kali. */

const SHARED_STATE_KEY = 'ug4qk5tymo'

/** Kunci global yang dipakai script inline. Diekspor supaya probe React memakai nama yang
 * sama alih-alih menyalin literalnya. */
export const PRE_SDK_PROBE_GLOBAL = '__adProbePre'

/** Override kill-switch untuk field testing. Dibaca di script inline HANYA untuk dicatat;
 * yang benar-benar memakainya untuk melewati panggilan eksplisit adalah `useInAppAds`. */
export const ADS_PROBE_SKIP_STORAGE_KEY = 'tugas-duit-ads-probe-skip'

/** Ditulis ke `<html>` supaya keberadaan instrumentasi terlihat langsung di DOM tanpa
 * harus membuka console. Murni penanda; tidak ada CSS atau kode yang membacanya. */
export const PRE_SDK_PROBE_ATTRIBUTE = 'data-ads-probe'

/** Script inline pre-SDK untuk satu zone Monetag.
 *
 * `zoneId` dan `sdkName` dijahit ke dalam sumber, jadi keduanya divalidasi dulu: hanya
 * karakter aman yang diloloskan. Zone Monetag berbentuk alfanumerik, sehingga penolakan
 * di sini berarti konfigurasinya salah — dan dalam kasus itu script-nya dikosongkan,
 * bukan dipaksa jalan dengan nilai yang bisa keluar dari literal string. */
export function preSdkAdsProbeScript({
  zoneId,
  sdkName,
}: {
  zoneId: string
  sdkName: string
}): string {
  if (!isInjectionSafe(zoneId) || !isInjectionSafe(sdkName)) return ''

  return `(function(){try{
var W=window,D=document;
if(W.${PRE_SDK_PROBE_GLOBAL})return;
var ORIGIN=Date.now();
var MAX=600;
var LOG=[];
var KEY=${JSON.stringify(SHARED_STATE_KEY)};
var SDK=${JSON.stringify(sdkName)};
var ZONE=${JSON.stringify(zoneId)};
function rec(tag,data){try{
var e={at:new Date().toISOString(),sinceStart:Date.now()-ORIGIN,phase:'pre',tag:tag};
if(data!==undefined)e.data=data;
LOG.push(e);if(LOG.length>MAX)LOG.shift();
console.log('[v0][adprobe:pre] +'+e.sinceStart+'ms '+tag,data===undefined?'':data);
}catch(x){}}
function stack(){try{
var raw=(new Error('probe').stack||'').split('\\n').slice(2,9);
var out=[];for(var i=0;i<raw.length;i++){var l=raw[i].trim();if(l)out.push(l)}
return out;}catch(x){return[]}}
function clone(v){try{return JSON.parse(JSON.stringify(v))}catch(x){return String(v)}}
function store(pick){try{return pick()}catch(x){return null}}
/* Kunci state in-app Monetag: SATU record global, bukan per zone. Dicari dengan
   indexOf karena lapisan storage SDK bisa menambah prefix. */
function readState(){var found=[];
var pairs=[['local',store(function(){return W.localStorage})],['session',store(function(){return W.sessionStorage})]];
for(var p=0;p<pairs.length;p++){var label=pairs[p][0],s=pairs[p][1];if(!s)continue;
try{for(var i=0;i<s.length;i++){var k=s.key(i);if(!k||k.indexOf(KEY)<0)continue;
var raw=s.getItem(k)||'';var parts=raw.split('/');
found.push({storage:label,key:k,sessionStart:parseInt(parts[0]||'',10)||0,showCount:parseInt(parts[1]||'',10)||0,lastShow:parseInt(parts[2]||'',10)||0});
}}catch(x){}}
return found}
function showGlobals(){var out=[];try{
var names=Object.getOwnPropertyNames(W);
for(var i=0;i<names.length;i++){var n=names[i];if(n.indexOf('show_')!==0)continue;
var v;try{v=W[n]}catch(x){continue}
if(typeof v==='function')out.push(n)}
}catch(x){}return out.sort()}
function sdkScripts(){var out=[];try{
var nodes=D.querySelectorAll('script[data-sdk],script[data-zone],script[data-auto]');
for(var i=0;i<nodes.length;i++){var n=nodes[i];var src=n.getAttribute('src')||'';var host='';
try{if(src)host=new URL(src,W.location.href).host}catch(x){}
out.push({src:src||undefined,host:host||undefined,inline:!src,dataSdk:n.getAttribute('data-sdk')||undefined,dataZone:n.getAttribute('data-zone')||undefined,dataAuto:n.getAttribute('data-auto')||undefined})}
}catch(x){}return out}
/* Membungkus fungsi SDK supaya SETIAP pemanggil tercatat, lalu meneruskan
   pemanggilan aslinya tanpa perubahan. Bukan gate: tidak ada jalur yang bisa
   menolak, menunda, atau mengubah argumen. */
var wrapped={};
function wrap(name,fn){
if(typeof fn!=='function')return fn;
if(fn.__probed)return fn;
var proxy=function(){var args=[];for(var i=0;i<arguments.length;i++)args.push(arguments[i]);
rec('show() dipanggil',{sdk:name,params:clone(args[0]),showGlobals:showGlobals(),stack:stack()});
var r=fn.apply(this,args);
try{if(r&&typeof r.then==='function'){r.then(function(){rec('show() resolve',{sdk:name,state:readState()})},function(e){rec('show() reject',{sdk:name,reason:String(e)})})}}catch(x){}
return r};
try{Object.defineProperty(proxy,'__probed',{value:true})}catch(x){proxy.__probed=true}
return proxy}
/* Jebakan pemasangan: dipasang SEBELUM SDK ada, jadi assignment pertama SDK
   tertangkap lengkap dengan stack pendefinisinya — inilah bukti yang tidak bisa
   didapat probe React. Getter/setter meneruskan nilai apa adanya. */
function watch(name){
if(wrapped[name])return;
var existing;try{existing=W[name]}catch(x){existing=undefined}
if(typeof existing==='function'){try{W[name]=wrap(name,existing);wrapped[name]=true;rec('show() dibungkus (sudah ada)',{sdk:name})}catch(x){}return}
var held;
try{Object.defineProperty(W,name,{configurable:true,enumerable:true,
get:function(){return held},
set:function(v){
/* Nilai yang SUDAH dibungkus berarti penulisnya adalah probe React yang menulis
   ulang fungsi yang sama, bukan SDK yang mendefinisikan ulang. Dicatat terpisah
   supaya "show() didefinisikan" tetap berarti pendefinisian oleh SDK. */
var reentry=!!(v&&v.__probed);
held=wrap(name,v);
rec(reentry?'show() ditulis ulang oleh probe (bukan SDK)':'show() didefinisikan',{sdk:name,tipe:typeof v,stack:stack(),sdkScripts:sdkScripts(),state:readState()})}});
wrapped[name]=true}catch(x){rec('gagal memasang jebakan',{sdk:name,reason:String(x)})}}
var skipFlag=null;try{skipFlag=W.localStorage.getItem(${JSON.stringify(ADS_PROBE_SKIP_STORAGE_KEY)})}catch(x){}
rec('pre-sdk probe start',{url:W.location.href,readyState:D.readyState,zone:ZONE,sdk:SDK,
sdkScripts:sdkScripts(),showGlobals:showGlobals(),state:readState(),
relatedZoneSdkCached:!!W.__vST,killSwitchStorage:skipFlag});
watch(SDK);
var pre=showGlobals();for(var i=0;i<pre.length;i++)watch(pre[i]);
/* Script SDK tambahan yang disuntikkan sebelum hydration. Atribut data-auto
   menandai salinan SDK untuk related zone, yang membawa penjadwalnya sendiri. */
var mo=null;
try{mo=new MutationObserver(function(muts){
for(var m=0;m<muts.length;m++){var added=muts[m].addedNodes;
for(var n=0;n<added.length;n++){var node=added[n];
if(!node||node.nodeType!==1)continue;
if(node.tagName==='SCRIPT'){
var ds=node.getAttribute('data-sdk'),da=node.getAttribute('data-auto');
if(ds||da){var src=node.getAttribute('src')||'';
/* Script SDK utama kita sendiri disuntikkan next/script saat runtime, jadi ia juga
   lewat sini. Yang menarik hanya yang BUKAN itu: zone lain, atau salinan yang
   membawa data-auto (penjadwal sendiri). Dipisah supaya satu script tambahan
   yang sebenarnya tidak tenggelam di antara pemuatan normal. */
var extra=(ds&&ds!==SDK)||!!da;
rec(extra?'SDK instance TAMBAHAN disuntikkan':'script SDK utama dimuat',{src:src||undefined,inline:!src,dataSdk:ds||undefined,dataAuto:da||undefined,dataZone:node.getAttribute('data-zone')||undefined,zoneLain:!!(ds&&ds!==SDK),showGlobalsSebelum:showGlobals()});
if(ds)watch(ds)}
continue}
if(node.tagName==='IFRAME'){var isrc=node.getAttribute('src')||'';var ihost='';
try{if(isrc)ihost=new URL(isrc,W.location.href).host}catch(x){}
rec('iframe muncul',{src:isrc||undefined,host:ihost||undefined,network:ihost.indexOf('libtl')>=0?'monetag':(ihost.indexOf('onclck')>=0||ihost.indexOf('onclickalgo')>=0?'onclicka':undefined),state:readState()})}}}
});
mo.observe(D.documentElement,{childList:true,subtree:true})}catch(x){}
var lastState=JSON.stringify(readState());
var lastGlobals=showGlobals().join(',');
var timer=null;
try{timer=setInterval(function(){
var st=readState();var ser=JSON.stringify(st);
if(ser!==lastState){lastState=ser;var now=Date.now();
rec('state capping berubah',{state:st,
umurWindowDetik:st.map(function(it){return it.sessionStart?Math.round((now-it.sessionStart)/1000):null}),
sejakTayangTerakhirDetik:st.map(function(it){return it.lastShow?Math.round((now-it.lastShow)/1000):null})})}
var g=showGlobals().join(',');
if(g!==lastGlobals){lastGlobals=g;var list=g?g.split(','):[];
rec('daftar global show_* berubah',{showGlobals:list});
for(var i=0;i<list.length;i++)watch(list[i])}
},1000)}catch(x){}
try{D.addEventListener('DOMContentLoaded',function(){rec('DOMContentLoaded',{showGlobals:showGlobals(),sdkScripts:sdkScripts(),state:readState()})})}catch(x){}
try{W.addEventListener('load',function(){rec('window load',{showGlobals:showGlobals(),sdkScripts:sdkScripts(),state:readState()})})}catch(x){}
try{W.addEventListener('pageshow',function(e){rec('pageshow',{dariBfcache:!!(e&&e.persisted),state:readState()})})}catch(x){}
W.${PRE_SDK_PROBE_GLOBAL}={origin:ORIGIN,entries:LOG,state:readState,showGlobals:showGlobals,sdkScripts:sdkScripts,
/* Diserap startInAppAdsProbe(); buffer dikosongkan supaya entri tidak terhitung dua kali. */
drain:function(){var out=LOG.slice();LOG.length=0;return out},
stop:function(){try{if(timer)clearInterval(timer)}catch(x){}try{if(mo)mo.disconnect()}catch(x){}}};
try{D.documentElement.setAttribute(${JSON.stringify(PRE_SDK_PROBE_ATTRIBUTE)},'on')}catch(x){}
}catch(e){try{console.log('[v0][adprobe:pre] gagal',String(e))}catch(x){}}})();`
}

/** Hanya alfanumerik, garis bawah, dan tanda hubung. Cukup untuk zone Monetag dan
 * `show_<zone>`, dan menutup semua karakter yang bisa keluar dari literal string atau
 * menutup tag `</script>` lebih awal. */
function isInjectionSafe(value: string): boolean {
  return value.length > 0 && /^[A-Za-z0-9_-]+$/.test(value)
}
