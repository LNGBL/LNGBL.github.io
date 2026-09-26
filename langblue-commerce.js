(function(window){

'use strict';


var PLANS = {


irt_7d:{
id:'irt_7d',
days:7,
label:'۷ روز',
price:201998,
priceStr:'201,998 T',
feature:'دسترسی کامل به Grammar + Vocabulary + Deutsch'
},


irt_14d:{
id:'irt_14d',
days:14,
label:'۱۴ روز',
price:527998,
priceStr:'527,998 T',
feature:'دسترسی کامل به محصولات LangBlue'
},


irt_21d:{
id:'irt_21d',
days:21,
label:'۲۱ روز',
price:913998,
priceStr:'913,998 T',
feature:'دسترسی کامل به محصولات LangBlue'
},


irt_3m:{
id:'irt_3m',
months:3,
days:90,
label:'۳ ماه',
price:1469998,
priceStr:'1,469,998 T',
feature:'Grammar + Vocabulary + Deutsch بدون محدودیت'
},


irt_6m:{
id:'irt_6m',
months:6,
days:180,
label:'۶ ماه',
price:1661998,
priceStr:'1,661,998 T',
feature:'دسترسی کامل اکوسیستم زبان LangBlue'
},


irt_12m:{
id:'irt_12m',
months:12,
days:365,
label:'۱۲ ماه',
price:1901998,
priceStr:'1,901,998 T',
feature:'دسترسی کامل + مدیریت داده + پرینت اطلاعات'
}


};





var FESTIVALS=[

{key:'cyrus',title:'👑 روز کوروش بزرگ',type:'jalali',month:8,day:7,discount:20},

{key:'amordadgan',title:'🌿 امردادگان',type:'jalali',month:5,day:7,discount:20},

{key:'yalda',title:'🍉 یلدا',type:'jalali',month:9,day:30,discount:20},

{key:'christmas',title:'🎄 Christmas',type:'gregorian',month:12,day:25,discount:20},

{key:'blackfriday',title:'🛍️ Black Friday',type:'gregorian',month:11,day:20,discount:20},

{key:'valentine',title:'❤️ Valentine',type:'gregorian',month:2,day:14,discount:20}

];





function discountedPrice(price,discount){

return Math.max(
0,
Math.round(
Number(price)*(100-Number(discount||0))/100
)
);

}



function comma(n){

return Number(n||0)
.toLocaleString('en-US');

}




function activeFestival(date){

var d = date instanceof Date ? date : new Date();


for(
var i=0;
i<FESTIVALS.length;
i++
){

var f=FESTIVALS[i];


if(
f.type==='gregorian'
&&
d.getMonth()+1===f.month
&&
d.getDate()===f.day
)

return f;


}


return null;

}





function displayPlan(plan,date){


var p =
typeof plan==='string'
?
PLANS[plan]
:
plan;



if(!p)
return null;



var festival=
activeFestival(date);



var discount =
festival && p.id==='irt_12m'
?
festival.discount/2
:
0;



var finalPrice =
discountedPrice(
p.price,
discount
);



return Object.assign({},p,{

festival:festival,

discount:discount,

finalPrice:finalPrice,

finalPriceStr:
comma(finalPrice)+' T'


});


}







var CODES={


'Verify_mU#2292':'irt_7d',

'Verify_m!!2992':'irt_14d',

'Verify_I@112':'irt_21d',

'Verify_MIR_ss1':'irt_3m',

'Verify_ll39332':'irt_6m',

'Verify_311012':'irt_12m'


};







var PRODUCTS={


grammar:{

id:'grammar',

label:'LangBlue Grammar',

icon:'📐',

url:'LangBlue-grammer.html'

},



vocabulary:{

id:'vocabulary',

label:'LangBlue Vocabulary',

icon:'📚',

url:'vocab.html'

},



deutsch:{

id:'deutsch',

label:'LangBlue Deutsch',

icon:'🇩🇪',

url:'LangBlue-De.html'

},



kurmanci:{

id:'kurmanci',

label:'LangBlue Kurmancî',

icon:'🟦',

url:'Kurmanci.html'

}


};







var ALL_PRODUCT_IDS=['grammar','vocabulary','deutsch'];



var ALL_PRODUCTS_12M_DISCOUNT=15;


var ALL_PRODUCTS_12M_PLAN_ID='irt_12m';


var ALL_PRODUCTS_12M_VERIFY_CODE='Verify_311012';








function isAllProducts12M(productIds,planId){


var ids=
Array.isArray(productIds)
?
productIds
:
[productIds];



return (

planId===ALL_PRODUCTS_12M_PLAN_ID

&&

ids.length===ALL_PRODUCT_IDS.length

&&

ALL_PRODUCT_IDS.every(function(id){

return ids.indexOf(id)!==-1;

})

);


}








function buildOrder(productIds,planId,date){


var ids=
Array.isArray(productIds)
?
productIds
:
[productIds];



var plan=
displayPlan(
planId,
date
);



var products=
ids.map(function(id){

return PRODUCTS[id];

})
.filter(Boolean);




if(
!plan
||
!products.length
)

return null;






var subtotal =
plan.finalPrice *
products.length;



var bundleDiscount =
isAllProducts12M(
ids,
planId
)
?
ALL_PRODUCTS_12M_DISCOUNT
:
0;





var total =
discountedPrice(
subtotal,
bundleDiscount
);






return {


id:

'LB-'
+
Date.now()
.toString(36)
.toUpperCase()
+
'-'
+
Math.random()
.toString(36)
.slice(2,7)
.toUpperCase(),



createdAt:
Date.now(),



plan:plan,



products:products,



quantity:
products.length,



subtotal:subtotal,



bundleDiscount:bundleDiscount,



verificationCode:null,



total:total,



totalStr:

comma(total)+' T'


};


}








var DAILY_PLAN_IDS=[

'irt_7d',

'irt_14d',

'irt_21d'

];



var MONTHLY_PLAN_IDS=[

'irt_3m',

'irt_6m',

'irt_12m'

];








window.LangBlueCommerce={


PLANS:PLANS,


PRODUCTS:PRODUCTS,


CODES:CODES,


FESTIVALS:FESTIVALS,


DAILY_PLAN_IDS:DAILY_PLAN_IDS,


MONTHLY_PLAN_IDS:MONTHLY_PLAN_IDS,


ALL_PRODUCT_IDS:ALL_PRODUCT_IDS,


ALL_PRODUCTS_12M_DISCOUNT:ALL_PRODUCTS_12M_DISCOUNT,


ALL_PRODUCTS_12M_PLAN_ID:ALL_PRODUCTS_12M_PLAN_ID,


ALL_PRODUCTS_12M_VERIFY_CODE:ALL_PRODUCTS_12M_VERIFY_CODE,


isAllProducts12M:isAllProducts12M,


buildOrder:buildOrder,


displayPlan:displayPlan,


discountedPrice:discountedPrice,


formatPrice:comma,


activeFestival:activeFestival


};



})(window);
