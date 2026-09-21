LangBlueAccount = {

 user:{
   id:null,
   profile:{},
   learning:{
      kurmanci:{
        level:"A1",
        words:[],
        lessons:[],
        reviews:[]
      }
   }
 },


 addKurmanciWord(word){

   this.user.learning.kurmanci.words.push(word);

   this.save();

 },


 updateProgress(data){

   Object.assign(
    this.user.learning.kurmanci,
    data
   );

   this.save();

 },


 getKurmanci(){

   return this.user.learning.kurmanci;

 }

}
