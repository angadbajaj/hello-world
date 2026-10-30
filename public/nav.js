// Shared session helpers and header nav. Pages put <nav id="nav"></nav> in the header.
export async function getMe() {
  try {
    const r = await fetch("/api/me");
    return r.ok ? await r.json() : { user: null };
  } catch {
    return { user: null };
  }
}

export async function api(url, { method = "GET", body } = {}) {
  const r = await fetch(url, {
    method,
    headers: body ? { "content-type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    const err = new Error(data.error || "Something went wrong.");
    Object.assign(err, { status: r.status, upgrade: data.upgrade });
    throw err;
  }
  return data;
}

export async function renderNav(me) {
  const nav = document.getElementById("nav");
  if (!nav) return me;
  me ??= await getMe();
  nav.className = "row";
  nav.innerHTML = me.user
    ? `<a class="btn ghost" href="/dashboard">Dashboard</a><a class="btn" href="/app">New quote</a>`
    : `<a class="btn ghost" href="/login">Log in</a><a class="btn" href="/app">Write a quote free</a>`;
  return me;
}

export async function logout() {
  await fetch("/api/logout", { method: "POST" });
  location.href = "/";
}
