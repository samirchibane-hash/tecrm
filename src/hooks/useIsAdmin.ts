const SESSION_KEY = "te_admin_verified";

export function useIsAdmin(): boolean {
  return sessionStorage.getItem(SESSION_KEY) === "1";
}
