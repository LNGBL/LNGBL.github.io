/* LangBlue Backend Bridge
   Supabase Edge Function connector
   No secret keys are stored here.
*/

(function (window) {
  "use strict";

  const CONFIG = Object.assign(
    {
      enabled: true,
      supabaseUrl: "https://ocxeyponzzcvlrvwndji.supabase.co"
    },
    window.LangBlueBackendConfig || {}
  );

  window.LangBlueBackendConfig = CONFIG;


  async function invoke(name, body) {
    try {
      if (!CONFIG.enabled) {
        return {
          ok: false,
          error: "BACKEND_NOT_ENABLED"
        };
      }

      const sb =
        window.LangBlueSupabase &&
        typeof window.LangBlueSupabase.getClient === "function"
          ? window.LangBlueSupabase.getClient()
          : null;


      if (!sb) {
        return {
          ok: false,
          error: "SUPABASE_CLIENT_UNAVAILABLE"
        };
      }


      const {
        data: sessionData,
        error: sessionError
      } = await sb.auth.getSession();


      if (sessionError) {
        console.error("SESSION ERROR:", sessionError);

        return {
          ok: false,
          error: sessionError.message
        };
      }


      const session =
        sessionData && sessionData.session;


      if (!session) {
        return {
          ok: false,
          error: "AUTH_REQUIRED"
        };
      }


      console.log(
        "BEFORE INVOKE:",
        name,
        body
      );


      const {
        data,
        error
      } = await sb.functions.invoke(name, {
        body: body
      });


      console.log(
        "AFTER INVOKE:",
        {
          data,
          error
        }
      );


      if (error) {
        return {
          ok: false,
          error:
            error.message ||
            "FUNCTION_ERROR"
        };
      }


      return (
        data || {
          ok: false,
          error: "EMPTY_BACKEND_RESPONSE"
        }
      );


    } catch (err) {

      console.error(
        "INVOKE ERROR:",
        err
      );

      return {
        ok: false,
        error:
          err.message ||
          "UNKNOWN_ERROR"
      };
    }
  }



  async function activateCode(code, productIds) {

    return invoke(
      "activate-code",
      {
        code: String(code || "").trim(),

        productIds:
          Array.isArray(productIds)
            ? productIds
            : []
      }
    );

  }



  async function signOut(){
    const sb =
      window.LangBlueSupabase &&
      typeof window.LangBlueSupabase.getClient === "function"
        ? window.LangBlueSupabase.getClient()
        : null;
    if(sb){
      try{ await sb.auth.signOut(); }catch(e){}
    }
    return true;
  }

  window.LangBlueBackend = {
    CONFIG,
    invoke,
    activateCode,
    signOut
  };


  console.log(
    "LangBlueBackend READY",
    window.LangBlueBackend
  );


})(window);
