(function(window){
'use strict';
// Server Rest is controlled by the server-side maintenance policy.
// Do not block the site using a hard-coded browser clock or a CSS overlay.
const MESSAGE = 'Server Rest status is controlled by the server-side policy.';
function active(){ return false; }
function apply(){ return false; }
window.LangBlueMaintenance = { active, apply, message: MESSAGE };
})(window);
