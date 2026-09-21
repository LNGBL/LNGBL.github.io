(function(window){

"use strict";


// ==================================
// LangBlue Core Database Engine
// ==================================


const DB_KEY =
"langblue_central_database";



function loadDB(){


let db =
localStorage.getItem(DB_KEY);



if(!db){


db={

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


version:"2.0"

}


};



saveDB(db);


return db;


}



return JSON.parse(db);



}





function saveDB(db){


localStorage.setItem(
DB_KEY,
JSON.stringify(db)
);


}





// ==================================
// Account System
// ==================================


function session(){


return JSON.parse(

localStorage.getItem(
"langblue_account"
)

)

||
null;


}





function hasPermission(){


return !!session();


}





// ==================================
// Language Database API
// ==================================


function getLanguage(name){


let db=loadDB();



if(!db.languages[name]){


db.languages[name]={

words:[]

};


saveDB(db);


}



return db.languages[name];



}







function addWord(language,word){



if(!hasPermission()){


return {

ok:false,

error:
"ACCOUNT_REQUIRED"

};


}




let db=loadDB();



if(!db.languages[language]){


db.languages[language]={

words:[]

};


}




word.id=
Date.now();



word.createdAt=
Date.now();



db.languages[language]
.words
.push(word);



saveDB(db);



return {

ok:true,

word:word

};


}







function updateWord(language,id,data){



if(!hasPermission())
return false;



let db=loadDB();



let list=
db.languages[language].words;



let index=
list.findIndex(function(w){

return w.id===id;

});



if(index===-1)
return false;



list[index]=Object.assign(
{},
list[index],
data
);



saveDB(db);



return true;


}







function deleteWord(language,id){



if(!hasPermission())
return false;



let db=loadDB();



db.languages[language]
.words =

db.languages[language]
.words.filter(function(w){


return w.id!==id;


});



saveDB(db);



return true;


}







function words(language){


return getLanguage(language)
.words;


}







// ==================================
// Export
// ==================================


window.LangBlueCore={


database:{


get:getLanguage,


words:words,


add:addWord,


update:updateWord,


delete:deleteWord


},


session:session,


hasPermission:hasPermission


};



})(window);
