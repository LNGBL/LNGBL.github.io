/* LangBlue Account — shared local account/session layer. */
(function(window){
'use strict';
const Store = {
  _globalKeys: new Set(['accounts', 'session']),
  _storageKey(key) {
    if (this._globalKeys.has(key)) return 'lb:' + key;
    const session = (() => {
      try { return JSON.parse(localStorage.getItem('lb:session') || 'null'); } catch { return null; }
    })();
    const uid = session?.userId || 'anonymous';
    return 'lb:user:' + uid + ':' + key;
  },
  get(key, fallback = null) {
    try {
      const v = localStorage.getItem(this._storageKey(key));
      return v ? JSON.parse(v) : fallback;
    } catch { return fallback; }
  },
  set(key, val) { localStorage.setItem(this._storageKey(key), JSON.stringify(val)); },
  update(key, fn, fallback) {
    const cur = this.get(key, fallback);
    const next = fn(cur);
    this.set(key, next);
    return next;
  }
};

const Auth = {
  current() { return Store.get('user', null); },
  isLoggedIn() { return !!this.current(); },

  async hashPassword(password, saltBytes) {
    const enc = new TextEncoder();
    const salt = saltBytes || crypto.getRandomValues(new Uint8Array(16));
    const key = await crypto.subtle.importKey(
      'raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']
    );
    const bits = await crypto.subtle.deriveBits(
      { name:'PBKDF2', salt, iterations:120000, hash:'SHA-256' },
      key, 256
    );
    return {
      hash: Array.from(new Uint8Array(bits)).map(b=>b.toString(16).padStart(2,'0')).join(''),
      salt: Array.from(salt).map(b=>b.toString(16).padStart(2,'0')).join('')
    };
  },

  async verifyPassword(password, account) {
    const salt = new Uint8Array((account.salt.match(/.{2}/g)||[]).map(h=>parseInt(h,16)));
    const result = await this.hashPassword(password, salt);
    return result.hash === account.passwordHash;
  },

  async init() {
    const session = Store.get('session', null);
    if (!session?.userId) {
      Store.set('user', null);
      return null;
    }
    const accounts = Store.get('accounts', {});
    const a = Object.values(accounts).find(x => x.id === session.userId);
    if (!a) {
      Store.set('session', null);
      Store.set('user', null);
      return null;
    }
    const user = {
      id:a.id,
      name:a.name || a.fullName || '',
      fullName:a.fullName || a.name || '',
      sex:a.sex || a.gender || '',
      gender:a.gender || a.sex || '',
      username:a.username,
      country:a.country || null,
      countryName:a.countryName || '',
      currency:a.currency || null,
      at:a.at || a.createdAt
    };
    Store.set('user', user);
    return user;
  },

  async register(data) {
    const accounts = Store.get('accounts', {});
    const key = data.username.toLowerCase();
    if (accounts[key]) return {ok:false,error:'این نام کاربری قبلاً ثبت شده است.'};

    const hashed = await this.hashPassword(data.password);
    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    accounts[key] = {
      id, name:data.name, fullName:data.name, sex:data.sex || '', gender:data.sex || '',
      username:data.username, age:data.age || '',
      country:data.country || null, countryName:data.countryName || '',
      currency:data.currency || null,
      passwordHash:hashed.hash, salt:hashed.salt, at:createdAt, createdAt:createdAt
    };
    Store.set('accounts', accounts);
    Store.set('session', {userId:id, createdAt:Date.now()});
    await this.init();
    Audit.log('user_register', {username:data.username});
    return {ok:true,user:this.current()};
  },

  async login(username, password) {
    const accounts = Store.get('accounts', {});
    const a = accounts[username.trim().toLowerCase()];
    if (!a || !(await this.verifyPassword(password, a))) {
      return {ok:false,error:'نام کاربری یا رمز عبور نادرست است.'};
    }
    Store.set('session', {userId:a.id, createdAt:Date.now()});
    await this.init();
    Audit.log('user_login', {username:a.username});
    return {ok:true,user:this.current()};
  },

  async logout() {
    Audit.log('user_logout');
    Store.set('session', null);
    Store.set('user', null);
  }
};

window.LangBlueAccount={Store:Store,Auth:Auth};
})(window);
