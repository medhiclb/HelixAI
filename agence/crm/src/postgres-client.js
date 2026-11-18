const endpoint = "/api/postgres-access";

async function request(action, body = {}) {
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, action }),
    });
    const result = await response.json();
    if (!response.ok) return { error: new Error(result.error || "Le CRM est indisponible.") };
    return result;
  } catch {
    return { error: new Error("Le CRM est indisponible.") };
  }
}

function query(action, initial) {
  const body = { columns: "*", filters: [], orders: [], ...initial };
  const builder = {
    select(columns) { body.columns = columns; return builder; },
    eq(name, value) { body.filters.push([name, value]); return builder; },
    order(name, options) { body.orders.push([name, options?.ascending ?? true]); return builder; },
    range(start, end) { body.offset = start; body.limit = end - start + 1; return builder; },
    limit(value) { body.limit = value; return builder; },
    single() { body.single = true; return builder; },
    maybeSingle() { return builder.single(); },
    then(resolve, reject) { return request(action, body).then(resolve, reject); },
  };
  return builder;
}

const listeners = new Set();
const notify = session => listeners.forEach(listener => listener("SESSION", session));
export const postgresClient = {
  from: table => query("select", { table }),
  rpc: (name, args) => query("rpc", { name, args }),
  auth: {
    async getSession() {
      const { user, error } = await request("session");
      return { data: { session: user ? { user } : null }, error };
    },
    onAuthStateChange(listener) {
      listeners.add(listener);
      return { data: { subscription: { unsubscribe: () => listeners.delete(listener) } } };
    },
    googleChallenge: () => request("google_challenge"),
    async signInWithGoogle(credential) {
      const result = await request("google_exchange", { credential });
      if (result.user) notify({ user: result.user });
      return result;
    },
    async signInWithOtp({ email }) { return request("request", { email }); },
    async verifyOtp({ token_hash: token }) {
      const result = await request("exchange", { token });
      if (result.user) notify({ user: result.user });
      return result;
    },
    async signOut() {
      const result = await request("signout");
      if (!result.error) notify(null);
      return result;
    },
  },
};
