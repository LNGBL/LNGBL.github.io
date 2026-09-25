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


  /*
   * Central local account/auth API shared by Grammar, Vocabulary and German.
   * Accounts are intentionally local to this browser; no email or SMTP flow.
   */
  const Auth = {
    _currentUser() {
      const s = Store.get('session', null);
      if (!s || !s.userId) return null;
      return Store.get('user', null);
    },

    async init() {
      // Migrate the older session shape when present.
      const legacy = parseJSON(localStorage.getItem(ACCOUNT_KEY), null);
      if (!Store.get('session', null) && legacy && legacy.id) {
        Store.set('session', { userId: legacy.id, username: legacy.username || '' });
        Store.set('user', legacy);
      }
      return this._currentUser();
    },

    isLoggedIn() {
      return !!this._currentUser();
    },

    current() {
      return this._currentUser();
    },

    async hashPassword(password) {
      const value = String(password || '');
      const saltBytes = new Uint8Array(16);
      crypto.getRandomValues(saltBytes);
      const salt = Array.from(saltBytes).map(b => b.toString(16).padStart(2,'0')).join('');
      if (crypto.subtle) {
        const enc = new TextEncoder();
        const key = await crypto.subtle.importKey('raw', enc.encode(value), 'PBKDF2', false, ['deriveBits']);
        const bits = await crypto.subtle.deriveBits(
          {name:'PBKDF2', salt:enc.encode(salt), iterations:100000, hash:'SHA-256'},
          key, 256
        );
        const hash = Array.from(new Uint8Array(bits)).map(b => b.toString(16).padStart(2,'0')).join('');
        return {hash, salt};
      }
      // Very old browsers: keep a deterministic fallback so local accounts remain usable.
      let h = 2166136261;
      for (let i=0;i<value.length;i++) h = Math.imul(h ^ value.charCodeAt(i), 16777619);
      return {hash:(h>>>0).toString(16), salt};
    },

    async verifyPassword(password, account) {
      if (!account) return false;
      if (account.passwordHash && account.salt && crypto.subtle) {
        const enc = new TextEncoder();
        const key = await crypto.subtle.importKey('raw', enc.encode(String(password || '')), 'PBKDF2', false, ['deriveBits']);
        const bits = await crypto.subtle.deriveBits(
          {name:'PBKDF2', salt:enc.encode(account.salt), iterations:100000, hash:'SHA-256'},
          key, 256
        );
        const hash = Array.from(new Uint8Array(bits)).map(b => b.toString(16).padStart(2,'0')).join('');
        return hash === account.passwordHash;
      }
      return account.password === String(password || '');
    },

    async register(data) {
      const username = String(data && data.username || '').trim();
      const key = username.toLowerCase();
      const accounts = Store.get('accounts', {});
      if (accounts[key]) return {ok:false, error:'این نام کاربری قبلاً استفاده شده است'};
      const hashed = await this.hashPassword(data.password);
      const now = Date.now();
      const id = (crypto.randomUUID ? crypto.randomUUID() : 'lb-' + now + '-' + Math.random().toString(36).slice(2));
      const user = {
        id, name:String(data.name || '').trim(), sex:data.sex || '',
        username, country:data.country || null, countryName:data.countryName || null,
        currency:data.currency || null, at:now
      };
      accounts[key] = {
        id:user.id, name:user.name, sex:user.sex, username:user.username,
        country:user.country, countryName:user.countryName, currency:user.currency, at:now,
        passwordHash:hashed.hash, salt:hashed.salt
      };
      Store.set('accounts', accounts);
      Store.set('session', {userId:id, username});
      Store.set('user', user);

      const sbAuth = window.LangBlueSupabase;
      let backendAuth = null;
      if (window.LangBlueBackendConfig && window.LangBlueBackendConfig.enabled && sbAuth && typeof sbAuth.signUpLocal === 'function') {
        backendAuth = await sbAuth.signUpLocal(username, String(data.password || ''));
      }
      return {ok:true, user, backendAuth};
    },

    async login(username, password) {
      const key = String(username || '').trim().toLowerCase();
      const accounts = Store.get('accounts', {});
      const account = accounts[key];
      if (!account || !(await this.verifyPassword(password, account))) {
        return {ok:false, error:'نام کاربری یا رمز عبور نادرست است'};
      }
      const user = {
        id:account.id, name:account.name || '', sex:account.sex || '',
        username:account.username || username, country:account.country || null,
        countryName:account.countryName || null, currency:account.currency || null,
        at:account.at || Date.now()
      };
      Store.set('session', {userId:user.id, username:user.username});
      Store.set('user', user);

      const sbAuth = window.LangBlueSupabase;
      let backendAuth = null;
      if (window.LangBlueBackendConfig && window.LangBlueBackendConfig.enabled && sbAuth && typeof sbAuth.signInLocal === 'function') {
        backendAuth = await sbAuth.signInLocal(user.username, String(password || ''));
      }
      return {ok:true, user, backendAuth};
    },

    async logout() {
      const sbAuth = window.LangBlueSupabase;
      if (window.LangBlueBackendConfig && window.LangBlueBackendConfig.enabled && sbAuth && typeof sbAuth.signOut === 'function') {
        await sbAuth.signOut();
      }
      Store.remove('session');
      Store.remove('user');
      return true;
    }
  };

  window.Auth = Auth;


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

    const planId =
      commerce && commerce.CODES
        ? commerce.CODES[normalized]
        : null;

    const plan =
      planId && commerce.PLANS
        ? commerce.PLANS[planId]
        : null;

    if (!plan) {
      return {
        ok:false,
        error:'کد فعال‌سازی نامعتبر است.'
      };
    }

    return {
      ok:true,
      code:normalized,
      plan:Object.assign({}, plan)
    };
  },


  activate(code, productIds){

    if (!hasPermission()) {
      return {
        ok:false,
        error:'ACCOUNT_REQUIRED'
      };
    }


    const result = this.validateCode(code);

    if (!result.ok) {
      return result;
    }


    const now = Date.now();

    const ids = Array.isArray(productIds)
      ? productIds.filter(Boolean)
      : [];


    const sub = {

      planId:result.plan.id,

      plan:result.plan,

      productIds:ids,

      verifiedByCode:true,

      verifiedAt:now,

      activatedAt:now,

      expiresAt:
        now + Number(result.plan.days || 0) * 86400000,

      expired:false
    };


    storage.set(subscriptionKey(), sub);


    storage.set(
      'used_codes',
      Object.assign(
        storage.get('used_codes', {}),
        {
          [result.code]:{
            planId:sub.planId,
            productIds:ids,
            usedAt:now
          }
        }
      )
    );


    return {
      ok:true,
      plan:result.plan,
      productIds:ids,
      expiresAt:sub.expiresAt,
      subscription:sub
    };
  },


  async activateAsync(code, productIds){

    if (!hasPermission()) {
      return {
        ok:false,
        error:'ACCOUNT_REQUIRED'
      };
    }


    const ids = Array.isArray(productIds)
      ? productIds.filter(Boolean)
      : [];


    const backend = window.LangBlueBackend;


    if (
      backend &&
      typeof backend.activateCode === 'function' &&
      backend.CONFIG &&
      backend.CONFIG.enabled
    ){

      const remote =
        await backend.activateCode(code, ids);


      console.log(
        "BACKEND ACTIVATION RESULT:",
        remote
      );


      if (remote && remote.ok){

        const remoteSub =
          remote.subscription || {};


        const localSub = Object.assign(
          {},
          remoteSub,
          {

            planId:
              remote.plan && remote.plan.id
                ? remote.plan.id
                : remoteSub.planId,


            plan:
              remote.plan ||
              remoteSub.plan ||
              null,


            productIds:
              Array.isArray(remoteSub.product_ids)
                ? remoteSub.product_ids
                :
                (
                  Array.isArray(remoteSub.productIds)
                    ? remoteSub.productIds
                    : ids
                ),


            verifiedByCode:true,

            verifiedAt:Date.now()
          }
        );


        storage.set(
          subscriptionKey(),
          localSub
        );


        return Object.assign(
          {},
          remote,
          {
            subscription:localSub,

            plan:localSub.plan,

            expiresAt:localSub.expiresAt,

            productIds:localSub.productIds
          }
        );
      }


      if (
        remote &&
        remote.error &&
        remote.error !== 'BACKEND_NOT_ENABLED'
      ){
        return remote;
      }
    }


    // اگر Backend در دسترس نبود، فعال‌سازی محلی
    return this.activate(code, ids);
  },


  current(){

    const sub =
      storage.get(subscriptionKey(), null);


    if (!sub) {
      return null;
    }


    const expired =
      !sub.expiresAt ||
      Date.now() >= Number(sub.expiresAt);


    return Object.assign(
      {},
      sub,
      {
        expired
      }
    );
  }

};

  const ids = Array.isArray(productIds)
    ? productIds.filter(Boolean)
    : [];

  const backend = window.LangBlueBackend;

  if (
    backend &&
    typeof backend.activateCode === 'function' &&
    backend.CONFIG &&
    backend.CONFIG.enabled
  ) {

    const remote = await backend.activateCode(code, ids);

    console.log("BACKEND ACTIVATION RESULT:", remote);


    if (remote && remote.ok) {

      const remoteSub = remote.subscription || {};

      const localSub = Object.assign({}, remoteSub, {

        planId:
          remote.plan && remote.plan.id
            ? remote.plan.id
            : remoteSub.planId,

        plan:
          remote.plan ||
          remoteSub.plan ||
          null,

        productIds:
          Array.isArray(remoteSub.product_ids)
            ? remoteSub.product_ids
            : (
                Array.isArray(remoteSub.productIds)
                  ? remoteSub.productIds
                  : ids
              ),

        verifiedByCode:true,
        verifiedAt:Date.now()
      });


      storage.set(subscriptionKey(), localSub);


      return Object.assign({}, remote, {
        subscription:localSub,
        plan:localSub.plan,
        expiresAt:localSub.expiresAt,
        productIds:localSub.productIds
      });
    }


    if (
      remote &&
      remote.error &&
      remote.error !== 'BACKEND_NOT_ENABLED'
    ) {
      return remote;
    }
  }


  // fallback local activation
  return this.activate(code, ids);
},);
          storage.set(subscriptionKey(), localSub);
return Object.assign({}, remote, {
  subscription: localSub,
  plan: localSub.plan,
  expiresAt: localSub.expiresAt,
  productIds: localSub.productIds
});        }
        if (remote && remote.error && remote.error !== 'BACKEND_NOT_ENABLED') return remote;
      }
     alert("CALLING BACKEND");
const remote = await backend.activateCode(code, ids);
alert(JSON.stringify(remote));
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
