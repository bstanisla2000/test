(() => {
  const AUTH_KEY = "dk-editor-session";
  const DEMO_USER = "admin";
  const DEMO_PASSWORD = "SMU-90";
  const SESSION_DURATION = 8 * 60 * 60 * 1000;
  const page = location.pathname.split("/").pop() || "index.html";

  function removeSession() {
    try { sessionStorage.removeItem(AUTH_KEY); } catch {}
  }

  function hasActiveSession() {
    try {
      const session = JSON.parse(sessionStorage.getItem(AUTH_KEY) || "null");
      if (!session || session.user !== DEMO_USER || Number(session.expiresAt) <= Date.now()) {
        removeSession();
        return false;
      }
      return true;
    } catch {
      removeSession();
      return false;
    }
  }

  function createSession() {
    try {
      sessionStorage.setItem(AUTH_KEY, JSON.stringify({
        user: DEMO_USER,
        loginAt: Date.now(),
        expiresAt: Date.now() + SESSION_DURATION
      }));
      return true;
    } catch {
      return false;
    }
  }

  function goToLogin() {
    document.documentElement.classList.add("auth-pending");
    location.replace("login.html?next=admin.html");
  }

  function bindLogout() {
    document.querySelectorAll("[data-editor-logout]").forEach(button => {
      button.addEventListener("click", () => {
        removeSession();
        location.replace("login.html");
      });
    });
  }

  function bindPasswordToggle() {
    const input = document.querySelector("#login-password");
    const button = document.querySelector("#toggle-password");
    if (!input || !button) return;
    button.addEventListener("click", () => {
      const show = input.type === "password";
      input.type = show ? "text" : "password";
      button.setAttribute("aria-label", show ? "Скрыть пароль" : "Показать пароль");
      button.querySelector("use").setAttribute("href", show ? "#icon-eye-off" : "#icon-eye");
    });
  }

  function bindLoginForm() {
    const form = document.querySelector("#login-form");
    if (!form) return;
    const error = document.querySelector("#login-error");
    const submit = form.querySelector("button[type='submit']");
    const initialButtonContent = submit.innerHTML;

    form.addEventListener("submit", async event => {
      event.preventDefault();
      error.hidden = true;
      form.querySelectorAll(".invalid").forEach(element => element.classList.remove("invalid"));

      const username = form.elements.username.value.trim();
      const password = form.elements.password.value;
      if (!username || !password) {
        error.textContent = "Введите логин и пароль.";
        error.hidden = false;
        if (!username) form.elements.username.closest(".field").classList.add("invalid");
        if (!password) form.elements.password.closest(".field").classList.add("invalid");
        return;
      }

      submit.classList.add("is-loading");
      submit.textContent = "Проверяем данные…";
      await new Promise(resolve => setTimeout(resolve, 350));

      if (username.toLowerCase() === DEMO_USER && password === DEMO_PASSWORD && createSession()) {
        submit.textContent = "Вход выполнен";
        const requestedPage = new URLSearchParams(location.search).get("next");
        location.replace(requestedPage === "admin.html" ? "admin.html" : "admin.html");
        return;
      }

      submit.classList.remove("is-loading");
      submit.innerHTML = initialButtonContent;
      error.textContent = "Неверный логин или пароль. Используйте данные для демо-доступа.";
      error.hidden = false;
      form.elements.password.select();
    });
  }

  if (page === "admin.html") {
    if (!hasActiveSession()) goToLogin();
    else document.addEventListener("DOMContentLoaded", bindLogout);
  }

  if (page === "login.html") {
    if (hasActiveSession()) {
      document.documentElement.classList.add("auth-pending");
      location.replace("admin.html");
    } else {
      document.addEventListener("DOMContentLoaded", () => {
        bindPasswordToggle();
        bindLoginForm();
      });
    }
  }
})();
