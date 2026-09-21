/* LangBlue local account compatibility layer. */
(function(window){
  'use strict';

  const KEY = 'langblue_account';
  const EMPTY_USER = () => ({
    id: null,
    profile: {},
    learning: {kurmanci: {level:'A1', words:[], lessons:[], reviews:[]}}
  });

  const LangBlueAccount = window.LangBlueAccount || {
    user: EMPTY_USER(),
    load(){
      try {
        const stored = JSON.parse(localStorage.getItem(KEY) || 'null');
        if (stored && typeof stored === 'object') this.user = Object.assign(EMPTY_USER(), stored);
      } catch (error) {
        console.warn('LangBlue: invalid account data was ignored.', error);
        this.user = EMPTY_USER();
      }
      return this.user;
    },
    save(){
      localStorage.setItem(KEY, JSON.stringify(this.user));
      return this.user;
    },
    addKurmanciWord(word){
      this.user.learning.kurmanci.words.push(word);
      return this.save();
    },
    updateProgress(data){
      Object.assign(this.user.learning.kurmanci, data || {});
      return this.save();
    },
    getKurmanci(){ return this.user.learning.kurmanci; }
  };

  if (!LangBlueAccount.user || !LangBlueAccount.user.learning) LangBlueAccount.user = EMPTY_USER();
  window.LangBlueAccount = LangBlueAccount;
  LangBlueAccount.load();
})(window);
