/* LangBlue Account — central account + learning profile layer */
(function(window){
'use strict';

const Store = {
  key:'lb:data',
  get(){
    try{return JSON.parse(localStorage.getItem(this.key)||'{"accounts":{},"session":null}')}catch{return {accounts:{},session:null}}
  },
  save(data){localStorage.setItem(this.key,JSON.stringify(data))}
};

const Auth = {
 current(){
   const d=Store.get();
   return d.session ? d.accounts[d.session] || null : null;
 },
 isLoggedIn(){return !!this.current()},

 async hashPassword(password){
   const data=new TextEncoder().encode(password);
   const hash=await crypto.subtle.digest('SHA-256',data);
   return Array.from(new Uint8Array(hash)).map(x=>x.toString(16).padStart(2,'0')).join('');
 },

 async register(data){
   const db=Store.get();
   const username=data.username.toLowerCase();
   if(db.accounts[username]) return {ok:false,error:'username exists'};

   const id=crypto.randomUUID();
   db.accounts[username]={
    id,
    username:data.username,
    name:data.name||'',
    passwordHash:await this.hashPassword(data.password),
    profile:{created:new Date().toISOString()},
    learning:{
      kurmanci:{
        level:'A1',
        wordsLearned:[],
        completedLessons:[],
        mistakes:[]
      },
      vocabulary:{
        savedWords:[],
        progress:0
      }
    }
   };
   db.session=username;
   Store.save(db);
   return {ok:true,user:this.current()};
 },

 async login(username,password){
   const db=Store.get();
   const user=db.accounts[username.toLowerCase()];
   if(!user || user.passwordHash!==await this.hashPassword(password))
     return {ok:false,error:'invalid login'};
   db.session=username.toLowerCase();
   Store.save(db);
   return {ok:true,user:user};
 },

 logout(){
   const db=Store.get();
   db.session=null;
   Store.save(db);
 },

 updateLearning(section,data){
   const user=this.current();
   if(!user)return false;
   Object.assign(user.learning[section],data);
   const db=Store.get();
   db.accounts[user.username]=user;
   Store.save(db);
   return true;
 }
};

window.Store=Store;
window.Auth=Auth;
window.LangBlueAccount={Store,Auth};

})(window);
