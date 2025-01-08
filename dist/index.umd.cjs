(function(u,d){typeof exports=="object"&&typeof module<"u"?d(exports):typeof define=="function"&&define.amd?define(["exports"],d):(u=typeof globalThis<"u"?globalThis:u||self,d(u.PrettyHttpClient={}))})(this,function(u){"use strict";const d=e=>{var c,h,b,l;const r=i=>(m,R)=>x(t,{...R,url:m,method:i}),t={prefix:(e==null?void 0:e.prefix)??"",alias:(e==null?void 0:e.alias)??"",headers:{...e==null?void 0:e.headers},hooks:{beforeRequest:((c=e==null?void 0:e.hooks)==null?void 0:c.beforeRequest)||[],afterResponse:((h=e==null?void 0:e.hooks)==null?void 0:h.afterResponse)||[],beforeRetry:((b=e==null?void 0:e.hooks)==null?void 0:b.beforeRetry)||[],catchError:((l=e==null?void 0:e.hooks)==null?void 0:l.catchError)||[]},retryCount:(e==null?void 0:e.retryCount)??0,retryTimeout:(e==null?void 0:e.retryTimeout)??0,cache:new D((e==null?void 0:e.cacheSize)??1e4),get:r("GET"),post:r("POST"),put:r("PUT"),delete:r("DELETE"),patch:r("PATCH"),head:r("HEAD")};return t},x=async(e,r)=>{var C,k,P,S,g,o,q;const t=Object.assign(r,{headers:{...e.headers,...r.headers},searchParams:r.searchParams||{},data:r.data||null}),c=r.retryCount??e.retryCount,h=((C=r.hooks)==null?void 0:C.beforeRequest)??e.hooks.beforeRequest??[];for(const a of h)await a(e,t);const l=(r.prefix??e.prefix)+t.url,i=Object.fromEntries(Object.entries(t.searchParams).filter(([a,f])=>f!=null)),m=new URLSearchParams(i).toString(),R=m?`${l}?${m}`:l;let y;t.method!=="GET"&&t.method!=="HEAD"&&(t.data instanceof FormData?y=t.data:typeof t.data=="object"&&t.data!==null?y=JSON.stringify(t.data):y=t.data);let s;const j=((k=r.cache)==null?void 0:k.milliseconds)??0,w=typeof((P=r.cache)==null?void 0:P.matcher)=="function";let n;if(w&&(n=(S=r.cache)==null?void 0:S.matcher(e,t),n)){const a=e.cache.get(n);a&&(await E(0),s=a.clone())}try{if(s===void 0&&(s=await fetch(R,{method:t.method,body:y,headers:t.headers}),w&&n&&s.ok&&e.cache.set(n,s.clone(),j),!s.ok&&c>0)){const a=((g=r.hooks)==null?void 0:g.beforeRetry)??e.hooks.beforeRetry??[];for(const f of a)f(e,r);return await E(e.retryTimeout),x(e,{...r,retryCount:c-1})}}catch(a){const f=((o=r.hooks)==null?void 0:o.catchError)??e.hooks.catchError??[];for(const H of f)H(a);throw a}let T=s;const z=((q=r.hooks)==null?void 0:q.afterResponse)??e.hooks.afterResponse??[];for(const a of z){const f=await a(e,t,T);f!==void 0&&(T=f)}return T},E=(e=0)=>new Promise(r=>setTimeout(()=>r(),e));class D{constructor(r){this.cache=new Map,this.maxSize=r}set(r,t,c){if(this.cache.has(r)&&this.delete(r),this.cache.set(r,{value:t,expirationTime:c>0?Date.now()+c:null}),this.size>this.maxSize){const h=this.cache.keys().next().value;h&&this.delete(h)}}get(r){const t=this.cache.get(r);if(!t)return null;const{value:c,expirationTime:h}=t;return h!==null&&Date.now()>h?(this.delete(r),null):(this.delete(r),this.cache.set(r,t),c)}get size(){return this.cache.size}clear(){this.cache.clear()}delete(r){return this.cache.delete(r)}}u.createHttpClient=d,Object.defineProperty(u,Symbol.toStringTag,{value:"Module"})});
