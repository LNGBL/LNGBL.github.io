/* LangBlue Receipt System
   Purchase summary + Telegram + Activation
*/

(function(){

"use strict";


function money(n){

    return Number(n || 0)
    .toLocaleString("en-US") + " T";

}



// دریافت محصولات انتخاب شده

function selectedProducts(){

    return Array.from(
        document.querySelectorAll(
            "#receiptProducts input:checked"
        )
    )
    .map(function(x){
        return x.value;
    });

}



// پلن انتخابی

function selectedPlan(){

    return document.getElementById(
        "receiptPlan"
    ).value;

}




// خلاصه سفارش

function renderSummary(){


    let ids = selectedProducts();

    let planId = selectedPlan();


    let box =
    document.getElementById(
        "receiptSummary"
    );



    if(!ids.length){

        box.innerHTML =
        `
        <div style="color:#ff7777">
        حداقل یک محصول را انتخاب کن.
        </div>
        `;

        return;

    }




    let plan =
    window.LangBlueCommerce.displayPlan(
        planId
    );



    let subtotal =
    plan.finalPrice * ids.length;



    let isBundle =
    planId==="irt_12m"
    &&
    ids.length===4;



    let discount =
    isBundle
    ?
    (window.LangBlueCommerce.ALL_PRODUCTS_12M_DISCOUNT || 15)
    :
    0;



    let total =
    window.LangBlueCommerce.discountedPrice(
        subtotal,
        discount
    );




    box.innerHTML = `

    <div class="receipt-summary-row">
    <span>تعداد محصولات</span>
    <strong>${ids.length}</strong>
    </div>


    <div class="receipt-summary-row">
    <span>قیمت هر محصول</span>
    <strong>${money(plan.finalPrice)}</strong>
    </div>


    ${
    discount
    ?
    `
    <div class="receipt-summary-row">
    <span>تخفیف بسته کامل</span>
    <strong>${discount}%</strong>
    </div>
    `
    :
    ""
    }


    <div class="receipt-summary-total">
    <span>مبلغ نهایی</span>
    <strong>${money(total)}</strong>
    </div>

    `;


}




// ساخت فیش

function buildReceipt(){


let ids =
selectedProducts();



if(!ids.length){

renderSummary();

return;

}



let order =
window.LangBlueCommerce.buildOrder(
ids,
selectedPlan()
);



let output =
document.getElementById(
"receiptOutput"
);



let date =
new Date(
order.createdAt
)
.toLocaleString(
"fa-IR"
);





output.innerHTML = `


<div class="receipt-head">


<div>

<strong>
LangBlue
</strong>

<br>

<small>
فیش سفارش
</small>

</div>


<div>

<small>

شماره:
${order.id}

<br>

${date}

</small>

</div>


</div>




${

order.products.map(function(p){

return `


<div class="receipt-line">

<span>
${p.icon}
${p.label}
</span>


<strong>
${money(order.plan.finalPrice)}
</strong>


</div>


`;

}).join("")

}




<div class="receipt-line">

<span>
پلن
</span>


<strong>
${order.plan.label}
</strong>


</div>





<div class="receipt-total">

<span>
مبلغ نهایی
</span>


<span>
${order.totalStr}
</span>


</div>




<div class="receipt-actions">


<button
class="btn btn-primary"
id="sendReceiptTelegram">

📨 ارسال تلگرام

</button>



<button
class="btn btn-secondary"
id="activateReceipt">

🔑 فعال‌سازی

</button>



</div>



`;




output.classList.add("show");



document.getElementById(
"printReceipt"
)
.style.display="inline-flex";





// تلگرام


document.getElementById(
"sendReceiptTelegram"
)
.onclick=function(){



let text =

`
درخواست خرید LangBlue

شماره فیش:
${order.id}


محصولات:

${
order.products
.map(p=>p.label)
.join("، ")
}


پلن:
${order.plan.label}


مبلغ:
${order.totalStr}

لطفاً بررسی شود.
`;



let url =

"https://t.me/share/url?url="
+
encodeURIComponent(
"https://lngbl.github.io/"
)
+
"&text="
+
encodeURIComponent(text);



window.open(
url,
"_blank"
);



};






// فعال سازی


document.getElementById(
"activateReceipt"
)
.onclick=function(){



if(!window.LangBlueCore.session()){


alert(
"ابتدا وارد حساب مرکزی LangBlue شوید."
);


return;


}



let code =
prompt(
"کد فعال سازی را وارد کنید:"
);



if(!code)
return;




let result =
window.LangBlueCore.subscription.activate(
code,
ids
);



if(!result.ok){


alert(
"❌ "+result.error
);


return;


}



alert(
"✅ فعال شد"
);



};



output.scrollIntoView({

behavior:"smooth"

});



}







// رویدادها


document
.querySelectorAll(
"#receiptProducts input"
)
.forEach(function(x){


x.addEventListener(
"change",
renderSummary
);


});



document
.getElementById(
"receiptPlan"
)
.addEventListener(
"change",
renderSummary
);



document
.getElementById(
"buildReceipt"
)
.addEventListener(
"click",
buildReceipt
);



document
.getElementById(
"printReceipt"
)
.addEventListener(
"click",
function(){

window.print();

});

renderSummary();
})();
