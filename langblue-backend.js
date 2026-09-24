async function invoke(name, body) {
  try {
    if (!CONFIG.enabled) {
      return { ok:false, error:'BACKEND_NOT_ENABLED' };
    }

    const sb = window.LangBlueSupabase &&
      typeof window.LangBlueSupabase.getClient === "function"
        ? window.LangBlueSupabase.getClient()
        : null;

    if (!sb) {
      return { ok:false, error:'SUPABASE_CLIENT_UNAVAILABLE' };
    }

    const { data: sessionData, error: sessionError } = await sb.auth.getSession();

    if (sessionError) {
      console.error("SESSION ERROR:", sessionError);
      return { ok:false, error:sessionError.message };
    }

    const session = sessionData && sessionData.session;

    alert(session ? "SESSION_OK" : "NO_SESSION");

    if (!session) {
      return { ok:false, error:'AUTH_REQUIRED' };
    }

    alert("CALLING_FUNCTION");

    const { data, error } = await sb.functions.invoke(name, {
      body: body
    });

    console.log("FUNCTION RESULT:", {
      name,
      body,
      data,
      error
    });

    alert(
      error
        ? "FUNCTION_ERROR: " + error.message
        : "FUNCTION_OK"
    );

    if (error) {
      return {
        ok:false,
        error:error.message || 'BACKEND_REQUEST_FAILED'
      };
    }

    return data || {
      ok:false,
      error:'EMPTY_BACKEND_RESPONSE'
    };

  } catch (err) {
    console.error("INVOKE CRASH:", err);

    return {
      ok:false,
      error:err.message || 'UNKNOWN_ERROR'
    };
  }
}
