(function(window){
  'use strict';

  const DB_KEY = 'langblue_central_database';
  const ACCOUNT_KEY = 'langblue_account';
  const SESSION_KEY = 'lb:session';
  const STORAGE_PREFIX = 'lb:';

  function parseJSON(value, fallback){
    if (!value) return fallback;
    try { return JSON.parse(value); } catch (error) {
      console.warn('LangBlue: invalid stored JSON was ignored.', error);
      return fallback;
    }
  }

  /*
   * Central local-first storage used by Grammar, Vocabulary and German.
   *
   * Global data:
   *   lb:accounts / lb:session
   *
   * User data:
   *   lb:user:<userId>:<key>
   *
   * This object is intentionally exposed as window.Store because the existing
   * Grammar page and parts of Vocabulary use Store directly.
   */
  const Store = {
    _globalKeys: new Set(['accounts', 'session']),

    _storageKey(key){
      key = String(key);
      if (this._globalKeys.has(key)) return STORAGE_PREFIX + key;

      const session = parseJSON(localStorage.getItem(SESSION_KEY), null);
      const uid = session && session.userId ? session.userId : 'anonymous';
      return STORAGE_PREFIX + 'user:' + uid + ':' + key;
    },

    get(key, fallback){
      if (fallback === undefined) fallback = null;
      try {
        const raw = localStorage.getItem(this._storageKey(key));
        return raw === null ? fallback : JSON.parse(raw);
      } catch (e) {
        console.warn('LangBlue Store.get failed:', key, e);
        return fallback;
      }
    },

    set(key, value){
      try {
        localStorage.setItem(this._storageKey(key), JSON.stringify(value));
        return value;
      } catch (e) {
        console.warn('LangBlue Store.set failed:', key, e);
        return value;
      }
    },

    remove(key){
      try { localStorage.removeItem(this._storageKey(key)); } catch (e) {}
    },

    update(key, updater, fallback){
      const current = this.get(key, fallback);
      const next = typeof updater === 'function' ? updater(current) : updater;
      this.set(key, next);
      return next;
    }
  };

  window.Store = Store;

  function loadDB(){
    const stored = parseJSON(localStorage.getItem(DB_KEY), null);
    if (stored && stored.languages && typeof stored.languages === 'object') return stored;

    const db = {
      users: [],
      languages: { kurmanci: {words: []}, vocabulary: {words: []}, deutsch: {words: []} },
      settings: {version: '2.0'}
    };
    saveDB(db);
    return db;
  }

  function saveDB(db){
    localStorage.setItem(DB_KEY, JSON.stringify(db));
  }

  function session(){
    const account = parseJSON(localStorage.getItem(ACCOUNT_KEY), null);
    if (account) return account;
    return parseJSON(localStorage.getItem(SESSION_KEY), null);
  }

  function hasPermission(){ return !!session(); }

  function getLanguage(name){
    const db = loadDB();
    if (!db.languages[name]) {
      db.languages[name] = {words: []};
      saveDB(db);
    }
    if (!Array.isArray(db.languages[name].words)) db.languages[name].words = [];
    return db.languages[name];
  }

  function addWord(language, word){
    if (!hasPermission()) return {ok:false, error:'ACCOUNT_REQUIRED'};
    if (!word || typeof word !== 'object') return {ok:false, error:'INVALID_WORD'};
    const db = loadDB();
    if (!db.languages[language]) db.languages[language] = {words: []};
    if (!Array.isArray(db.languages[language].words)) db.languages[language].words = [];
    const now = Date.now();
    const item = Object.assign({}, word, {id: word.id || now, createdAt: word.createdAt || now});
    db.languages[language].words.push(item);
    saveDB(db);
    return {ok:true, word:item};
  }

  function updateWord(language, id, data){
    if (!hasPermission()) return false;
    const lang = getLanguage(language);
    const index = lang.words.findIndex(w => w.id === id);
    if (index === -1) return false;
    lang.words[index] = Object.assign({}, lang.words[index], data || {});
    saveDB(loadDB());
    return true;
  }

  function deleteWord(language, id){
    if (!hasPermission()) return false;
    const db = loadDB();
    if (!db.languages[language] || !Array.isArray(db.languages[language].words)) return false;
    db.languages[language].words = db.languages[language].words.filter(w => w.id !== id);
    saveDB(db);
    return true;
  }

  function words(language){ return getLanguage(language).words; }

  /*
   * Keep the newer API as a compatibility layer. It now follows the same
   * per-user storage rules as Store instead of writing subscriptions/data
   * into one shared browser-wide key.
   */
  const storage = {
    key(key){ return Store._storageKey(key); },
    get(key, fallback){ return Store.get(key, fallback); },
    set(key, value){ return Store.set(key, value); },
    remove(key){ return Store.remove(key); }
  };

  function subscriptionKey(){ return 'subscription'; }

  const subscription = {
    validateCode(code){
      const normalized = String(code || '').trim();
      const commerce = window.LangBlueCommerce;
      const planId = commerce && commerce.CODES ? commerce.CODES[normalized] : null;
      const plan = planId && commerce.PLANS ? commerce.PLANS[planId] : null;
      if (!plan) return {ok:false, error:'کد فعال‌سازی نامعتبر است.'};
      return {ok:true, code:normalized, plan:Object.assign({}, plan)};
    },

    activate(code){
      if (!hasPermission()) return {ok:false, error:'ACCOUNT_REQUIRED'};
      const result = this.validateCode(code);
      if (!result.ok) return result;

      const now = Date.now();
      const sub = {
        planId: result.plan.id,
        plan: result.plan,
        verifiedByCode: true,
        verifiedAt: now,
        activatedAt: now,
        expiresAt: now + Number(result.plan.days || 0) * 86400000,
        expired: false
      };

      storage.set(subscriptionKey(), sub);
      storage.set('used_codes', Object.assign(storage.get('used_codes', {}), {
        [result.code]: {planId: sub.planId, usedAt: now}
      }));

      return {ok:true, plan:result.plan, expiresAt:sub.expiresAt, subscription:sub};
    },

    current(){
      const sub = storage.get(subscriptionKey(), null);
      if (!sub) return null;
      const expired = !sub.expiresAt || Date.now() >= Number(sub.expiresAt);
      return Object.assign({}, sub, {expired});
    }
  };

  window.LangBlueCore = {
    database: {get:getLanguage, words, add:addWord, update:updateWord, delete:deleteWord},
    storage,
    subscription,
    session,
    hasPermission
  };
})(window);
