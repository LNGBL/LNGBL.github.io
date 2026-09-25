(function(window){
  'use strict';


  const DB_KEY = 'langblue_central_database';
  const ACCOUNT_KEY = 'langblue_account';
  const SESSION_KEY = 'lb:session';
  const STORAGE_PREFIX = 'lb:';


  function parseJSON(value, fallback){
    if(!value) return fallback;

    try{
      return JSON.parse(value);
    }
    catch(error){
      console.warn(
        'LangBlue: invalid JSON',
        error
      );
      return fallback;
    }
  }



  /*
   * Central Storage
   *
   * Global:
   *   lb:accounts
   *   lb:session
   *
   * User:
   *   lb:user:<id>:key
   */

  const Store = {


    _globalKeys:
      new Set([
        'accounts',
        'session'
      ]),



    _storageKey(key){

      key = String(key);


      if(this._globalKeys.has(key)){
        return STORAGE_PREFIX + key;
      }


      const session =
        parseJSON(
          localStorage.getItem(SESSION_KEY),
          null
        );


      const uid =
        session && session.userId
          ? session.userId
          : 'anonymous';


      return (
        STORAGE_PREFIX +
        'user:' +
        uid +
        ':' +
        key
      );
    },



    get(key, fallback){

      if(fallback === undefined){
        fallback = null;
      }


      try{

        const raw =
          localStorage.getItem(
            this._storageKey(key)
          );


        return raw === null
          ? fallback
          : JSON.parse(raw);

      }
      catch(error){

        console.warn(
          'Store.get error:',
          key,
          error
        );

        return fallback;
      }

    },



    set(key,value){

      try{

        localStorage.setItem(
          this._storageKey(key),
          JSON.stringify(value)
        );


        return value;

      }
      catch(error){

        console.warn(
          'Store.set error:',
          key,
          error
        );

        return value;
      }

    },



    remove(key){

      try{

        localStorage.removeItem(
          this._storageKey(key)
        );

      }
      catch(e){}

    },



    update(key, updater, fallback){

      const current =
        this.get(
          key,
          fallback
        );


      const next =
        typeof updater === 'function'
          ? updater(current)
          : updater;


      this.set(
        key,
        next
      );


      return next;
    }

  };



  window.Store = Store;





  /*
   * Authentication
   *
   * No email / SMTP.
   * Local account system.
   */


  const Auth = {


    _currentUser(){

      const session =
        Store.get(
          'session',
          null
        );


      if(
        !session ||
        !session.userId
      ){
        return null;
      }


      return Store.get(
        'user',
        null
      );

    },



    async init(){

      const legacy =
        parseJSON(
          localStorage.getItem(
            ACCOUNT_KEY
          ),
          null
        );



      if(
        !Store.get('session',null)
        &&
        legacy
        &&
        legacy.id
      ){

        Store.set(
          'session',
          {
            userId:legacy.id,
            username:
              legacy.username || ''
          }
        );


        Store.set(
          'user',
          legacy
        );

      }


      return this._currentUser();

    },



    isLoggedIn(){

      return !!this._currentUser();

    },



    current(){

      return this._currentUser();

    },



    async hashPassword(password){

      const value =
        String(password || '');



      const saltBytes =
        new Uint8Array(16);



      crypto.getRandomValues(
        saltBytes
      );



      const salt =
        Array.from(
          saltBytes
        )
        .map(
          b =>
          b.toString(16)
          .padStart(2,'0')
        )
        .join('');



      if(
        crypto.subtle
      ){

        const enc =
          new TextEncoder();



        const key =
          await crypto.subtle.importKey(
            'raw',
            enc.encode(value),
            'PBKDF2',
            false,
            ['deriveBits']
          );



        const bits =
          await crypto.subtle.deriveBits(
            {
              name:'PBKDF2',
              salt:enc.encode(salt),
              iterations:100000,
              hash:'SHA-256'
            },
            key,
            256
          );



        const hash =
          Array.from(
            new Uint8Array(bits)
          )
          .map(
            b =>
            b.toString(16)
            .padStart(2,'0')
          )
          .join('');



        return {
          hash,
          salt
        };

      }



      return {
        hash:value,
        salt
      };

    },



    async verifyPassword(password,account){

      if(!account)
        return false;



      if(
        account.passwordHash &&
        account.salt &&
        crypto.subtle
      ){

        const enc =
          new TextEncoder();



        const key =
          await crypto.subtle.importKey(
            'raw',
            enc.encode(
              String(password || '')
            ),
            'PBKDF2',
            false,
            ['deriveBits']
          );



        const bits =
          await crypto.subtle.deriveBits(
            {
              name:'PBKDF2',
              salt:
                enc.encode(
                  account.salt
                ),
              iterations:100000,
              hash:'SHA-256'
            },
            key,
            256
          );



        const hash =
          Array.from(
            new Uint8Array(bits)
          )
          .map(
            b =>
            b.toString(16)
            .padStart(2,'0')
          )
          .join('');



        return hash === account.passwordHash;

      }



      return (
        account.password ===
        String(password || '')
      );

    },



    async register(data){

      const username =
        String(
          data.username || ''
        ).trim();



      const key =
        username.toLowerCase();



      const accounts =
        Store.get(
          'accounts',
          {}
        );



      if(accounts[key]){

        return {
          ok:false,
          error:
          'این نام کاربری قبلاً استفاده شده است'
        };

      }



      const hashed =
        await this.hashPassword(
          data.password
        );



      const id =
        crypto.randomUUID
        ? crypto.randomUUID()
        :
        'lb-' +
        Date.now();



      const user={

        id,

        name:
          String(data.name || '')
          .trim(),

        sex:
          data.sex || '',

        username,

        country:
          data.country || null,

        countryName:
          data.countryName || null,

        currency:
          data.currency || null,

        at:
          Date.now()
      };



      accounts[key]={

        ...user,

        passwordHash:
          hashed.hash,

        salt:
          hashed.salt

      };



      Store.set(
        'accounts',
        accounts
      );


      Store.set(
        'session',
        {
          userId:id,
          username
        }
      );


      Store.set(
        'user',
        user
      );



      return {
        ok:true,
        user
      };

    },
        async login(username, password){

      const key =
        String(username || '')
        .trim()
        .toLowerCase();


      const accounts =
        Store.get(
          'accounts',
          {}
        );


      const account =
        accounts[key];



      if(
        !account ||
        !(await this.verifyPassword(
          password,
          account
        ))
      ){

        return {
          ok:false,
          error:
          'نام کاربری یا رمز عبور نادرست است'
        };

      }



      const user={

        id:
          account.id,

        name:
          account.name || '',

        sex:
          account.sex || '',

        username:
          account.username || username,


        country:
          account.country || null,


        countryName:
          account.countryName || null,


        currency:
          account.currency || null,


        at:
          account.at || Date.now()

      };



      Store.set(
        'session',
        {
          userId:user.id,
          username:user.username
        }
      );


      Store.set(
        'user',
        user
      );



      return {
        ok:true,
        user
      };

    },





    async logout(){

      const backend =
        window.LangBlueBackend;



      if(
        backend &&
        typeof backend.signOut === 'function'
      ){

        try{

          await backend.signOut();

        }
        catch(e){}

      }
      Store.remove(
        'session'
      );
      Store.remove(
        'user'
      );


      return true;

    }
  };

  window.Auth = Auth;

   /*
   * Central Database
   */


  function loadDB(){

    const stored =
      parseJSON(
        localStorage.getItem(DB_KEY),
        null
      );



    if(
      stored &&
      stored.languages &&
      typeof stored.languages === 'object'
    ){

      return stored;

    }



    const db={

      users:[],

      languages:{

        kurmanci:{
          words:[]
        },

        vocabulary:{
          words:[]
        },

        deutsch:{
          words:[]
        }

      },


      settings:{

        version:'3.0'

      }

    };



    saveDB(db);


    return db;

  }





  function saveDB(db){

    try{

      localStorage.setItem(
        DB_KEY,
        JSON.stringify(db)
      );

    }
    catch(error){

      console.warn(
        'LangBlue database save failed',
        error
      );

    }

  }






  function session(){

    const account =
      parseJSON(
        localStorage.getItem(
          ACCOUNT_KEY
        ),
        null
      );



    if(account){

      return account;

    }



    return parseJSON(
      localStorage.getItem(
        SESSION_KEY
      ),
      null
    );

  }






  function hasPermission(){

    return !!session();

  }







  function getLanguage(name){

    const db =
      loadDB();



    if(
      !db.languages[name]
    ){

      db.languages[name]={
        words:[]
      };


      saveDB(db);

    }



    if(
      !Array.isArray(
        db.languages[name].words
      )
    ){

      db.languages[name].words=[];

    }



    return db.languages[name];

  }









  function addWord(language, word){


    if(
      !hasPermission()
    ){

      return {
        ok:false,
        error:'ACCOUNT_REQUIRED'
      };

    }



    if(
      !word ||
      typeof word !== 'object'
    ){

      return {
        ok:false,
        error:'INVALID_WORD'
      };

    }



    const db =
      loadDB();



    if(
      !db.languages[language]
    ){

      db.languages[language]={
        words:[]
      };

    }



    const now =
      Date.now();



    const item={

      ...word,


      id:
        word.id ||
        now,


      createdAt:
        word.createdAt ||
        now

    };



    db.languages[language]
      .words
      .push(item);



    saveDB(db);



    return {

      ok:true,

      word:item

    };

  }









  function updateWord(language,id,data){


    if(
      !hasPermission()
    ){

      return false;

    }



    const lang =
      getLanguage(language);



    const index =
      lang.words.findIndex(
        w =>
        w.id === id
      );



    if(
      index === -1
    ){

      return false;

    }



    lang.words[index]=Object.assign(
      {},
      lang.words[index],
      data || {}
    );



    const db =
      loadDB();



    db.languages[language]
      .words[index]
      =
      lang.words[index];



    saveDB(db);



    return true;

  }









  function deleteWord(language,id){


    if(
      !hasPermission()
    ){

      return false;

    }



    const db =
      loadDB();



    if(
      !db.languages[language]
    ){

      return false;

    }



    db.languages[language]
      .words =
      db.languages[language]
      .words
      .filter(
        w =>
        w.id !== id
      );



    saveDB(db);



    return true;

  }









  function words(language){

    return getLanguage(language)
      .words;

  }

 
  /*
   * Compatibility Storage Layer
   */

  const storage = {

    key(key){

      return Store._storageKey(key);

    },


    get(key,fallback){

      return Store.get(
        key,
        fallback
      );

    },


    set(key,value){

      return Store.set(
        key,
        value
      );

    },


    remove(key){

      return Store.remove(
        key
      );

    }

  };





  function subscriptionKey(){

    return 'subscription';

  }







  /*
   * Central Subscription API
   * Shared by:
   * Grammar
   * Vocabulary
   * German
   */


  const LangBlueSubscription = {




    validateCode(code){


      const normalized =
        String(code || '')
        .trim();



      const commerce =
        window.LangBlueCommerce;



      const planId =
        commerce &&
        commerce.CODES
          ?
          commerce.CODES[normalized]
          :
          null;




      const plan =
        planId &&
        commerce &&
        commerce.PLANS
          ?
          commerce.PLANS[planId]
          :
          null;




      if(!plan){


        return {

          ok:false,

          error:
          'کد فعال‌سازی نامعتبر است.'

        };


      }





      return {


        ok:true,


        code:
          normalized,


        plan:
          Object.assign(
            {},
            plan
          )

      };


    },










    activate(code,productIds){



      if(
        !hasPermission()
      ){

        return {

          ok:false,

          error:
          'ACCOUNT_REQUIRED'

        };

      }






      const result =
        this.validateCode(code);





      if(!result.ok){

        return result;

      }






      const now =
        Date.now();





      const ids =
        Array.isArray(productIds)
          ?
          productIds.filter(Boolean)
          :
          [];







      const subscription={



        planId:
          result.plan.id,



        plan:
          result.plan,



        productIds:
          ids,



        verifiedByCode:
          true,



        verifiedAt:
          now,



        activatedAt:
          now,



        expiresAt:
          now +
          Number(
            result.plan.days || 0
          )
          *
          86400000



      };







      storage.set(

        subscriptionKey(),

        subscription

      );








      return {


        ok:true,


        subscription,


        plan:
          result.plan,


        productIds:
          ids,


        expiresAt:
          subscription.expiresAt


      };


    },









    async activateAsync(code,productIds){



      if(
        !hasPermission()
      ){

        return {

          ok:false,

          error:
          'ACCOUNT_REQUIRED'

        };

      }






      const ids =
        Array.isArray(productIds)
          ?
          productIds.filter(Boolean)
          :
          [];





      const backend =
        window.LangBlueBackend;








      if(

        backend &&

        backend.CONFIG &&

        backend.CONFIG.enabled &&

        typeof backend.activateCode === 'function'

      ){





        try{



          const remote =
            await backend.activateCode(
              code,
              ids
            );






          console.log(

            'LangBlue backend activation:',
            remote

          );







          if(
            remote &&
            remote.ok
          ){



            const remoteSub =
              remote.subscription ||
              remote;






            const localSub = Object.assign(

              {},

              remoteSub,

              {


                verifiedByCode:
                  true,



                verifiedAt:
                  Date.now(),



                productIds:

                  Array.isArray(
                    remoteSub.productIds
                  )

                  ?

                  remoteSub.productIds

                  :

                  ids


              }

            );







            storage.set(

              subscriptionKey(),

              localSub

            );







            return {


              ok:true,


              subscription:
                localSub,


              plan:

                remote.plan ||

                localSub.plan ||

                null,



              expiresAt:
                localSub.expiresAt,



              productIds:
                localSub.productIds


            };



          }








          if(
            remote &&
            remote.error
          ){

            return remote;

          }






        }
        catch(error){



          console.error(

            'Activation backend error:',
            error

          );



        }



      }







      // fallback local activation

      return this.activate(
        code,
        ids
      );


    },









    current(){



      const sub =
        storage.get(
          subscriptionKey(),
          null
        );






      if(!sub){

        return null;

      }






      return Object.assign(

        {},

        sub,

        {

          expired:

            !sub.expiresAt ||

            Date.now() >=
            Number(
              sub.expiresAt
            )

        }

      );
    }
  };


  window.LangBlueSubscription =
    LangBlueSubscription;

 
  /*
   * Final Public API
   *
   * Used by:
   * Grammar
   * Vocabulary
   * German
   */


  const LangBlueCore = {


    Store,


    Auth,



    storage,



    addWord,


    updateWord,


    deleteWord,


    words,



    subscription:
      LangBlueSubscription



  };






  /*
   * Global compatibility exports
   *
   * Older pages may call these directly.
   */


  window.LangBlueCore =
    LangBlueCore;



  window.Store =
    Store;



  window.Auth =
    Auth;



  window.LangBlueSubscription =
    LangBlueSubscription;



  window.LangBlueStorage =
    storage;



  /*
   * Optional aliases for old code
   */


  window.LB = {

    Store,


    Auth,


    Subscription:
      LangBlueSubscription,


    addWord,


    updateWord,


    deleteWord,


    words

  };




})(window);
