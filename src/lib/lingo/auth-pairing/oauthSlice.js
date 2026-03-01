export function createOAuthSlice({
  getState,
  patch,
  emitToast,
} = {}) {
  function normalizeOAuthReturnUrl() {
    if (typeof window === "undefined") return false;
    const url = new URL(window.location.href);
    const hash = String(url.hash || "");
    let changed = false;
    const nestedTokenHashIndex = hash.indexOf("#access_token=");

    if (nestedTokenHashIndex > 0) {
      url.hash = hash.slice(nestedTokenHashIndex);
      url.searchParams.delete("error");
      url.searchParams.delete("error_description");
      url.searchParams.delete("auth_error");
      changed = true;
    }

    if (changed) history.replaceState({}, "", url);
    return changed;
  }

  function consumeAuthQueryFlags() {
    if (typeof window === "undefined") return;
    normalizeOAuthReturnUrl();

    const url = new URL(window.location.href);
    let changed = false;
    const hasTokenHash = /(?:^#|&)access_token=/.test(String(url.hash || ""));
    const authOk = url.searchParams.get("auth");
    const authErr = url.searchParams.get("auth_error") || url.searchParams.get("error");
    const autoPair = url.searchParams.get("autoPair");

    if (autoPair === "create") {
      patch({
        autoPairRequestedFromQuery: true,
        pendingAutoPairAfterAuth: true,
      });
      url.searchParams.delete("autoPair");
      changed = true;
    }

    if (authOk) {
      emitToast("Đăng nhập thành công.");
      url.searchParams.delete("auth");
      url.searchParams.delete("error");
      url.searchParams.delete("error_description");
      url.searchParams.delete("auth_error");
      changed = true;
    }

    if (authErr && !hasTokenHash) {
      patch({ errorText: `Đăng nhập lỗi: ${authErr}` });
      url.searchParams.delete("auth_error");
      url.searchParams.delete("error");
      url.searchParams.delete("error_description");
      changed = true;
    } else if (hasTokenHash && url.searchParams.has("error_description")) {
      url.searchParams.delete("error");
      url.searchParams.delete("auth_error");
      url.searchParams.delete("error_description");
      changed = true;
    }

    if (changed) history.replaceState({}, "", url);
  }

  function buildAuthRedirectUrl() {
    const callbackUrl = new URL(window.location.href);
    callbackUrl.hash = "";
    callbackUrl.searchParams.delete("error");
    callbackUrl.searchParams.delete("error_description");
    callbackUrl.searchParams.delete("auth_error");
    callbackUrl.searchParams.set("auth", "oauth_ok");
    if (getState().pendingAutoPairAfterAuth) {
      callbackUrl.searchParams.set("autoPair", "create");
    }
    return callbackUrl.toString();
  }

  return {
    normalizeOAuthReturnUrl,
    consumeAuthQueryFlags,
    buildAuthRedirectUrl,
  };
}
