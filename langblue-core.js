/* LangBlue Core — shared account/session/subscription/product-access foundation. */
(function(window){
'use strict';
var P='lb:';
function read(k,f){try{var v=localStorage.getItem(k);return v===null?f:JSON.parse(v);}catch(e){return f;}}
function write(k,v){try{localStorage.setItem(k,JSON.stringify(v));return true;}catch(e){return false;}}
function session(){var s=read(P+'session',null);return s&&s.userId?s:null;}
function userId(){var s=session();return s?s.userId:null;}
function account(uid){uid=uid||userId();if(!uid)return null;return read(P+'accounts',{})[uid]||null;}
function key(k,uid){return P+'user:'+(uid||userId()||'anonymous')+':'+k;}
function get(k,f,uid){return read(key(k,uid),f);}
function set(k,v,uid){return write(key(k,uid),v);}
function remove(k,uid){try{localStorage.removeItem(key(k,uid));return true;}catch(e){return false;}}
function currentSubscription(uid){var s=get('subscription',null,uid);return s&&s.expiresAt>Date.now()?s:null;}
function hasProduct(id,uid){var s=currentSubscription(uid);if(!s)return false;var p=s.activatedProducts;return !Array.isArray(p)||!p.length||p.indexOf(id)!==-1;}
function hasAny(ids,uid){return (ids||[]).some(function(id){return hasProduct(id,uid);});}
function hasAll(ids,uid){return (ids||[]).every(function(id){return hasProduct(id,uid);});}
window.LangBlueCore={version:'1.0.0-phase1',session:session,userId:userId,account:account,storage:{get:get,set:set,remove:remove,key:key},subscription:{current:currentSubscription,hasProduct:hasProduct,hasAnyProduct:hasAny,hasAllProducts:hasAll}};
})(window);
