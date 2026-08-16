import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  deriveTuringDomainFromUser,
  getRole,
  isDevAuthBypass,
  setRole,
  setSummaryType,
  setToken,
  setTuringDomain,
  type SummaryType,
} from "../auth";
import { getMe, login } from "../api";
import { BrandLogo } from "../components/BrandLogo";

export function Login() {
  const navigate = useNavigate();
  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isDevAuthBypass()) return;
    const role = getRole();
    navigate(role === "admin" ? "/inquiry" : "/dashboard", { replace: true });
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { access_token } = await login(userId, password);
      setToken(access_token);
      const me = await getMe();
      const role = me.role === "admin" ? "admin" : "client";
      setRole(role);
      setTuringDomain(deriveTuringDomainFromUser(me));
      if (me.summary_type) setSummaryType(me.summary_type as SummaryType);
      navigate(role === "admin" ? "/inquiry" : "/dashboard", {
        replace: true,
      });
    } catch (err) {
      let msg = err instanceof Error ? err.message : "로그인에 실패했습니다.";
      if (msg.includes("Failed to fetch") || msg.includes("NetworkError")) {
        msg = import.meta.env.DEV
          ? "API 서버에 연결할 수 없습니다. 백엔드가 localhost:8000에서 실행 중인지 확인해 주세요."
          : "API 서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.";
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-brand-canvas flex items-center justify-center p-4">
      <div className="w-full max-w-md admin-card p-8">
        <h1 className="admin-page-title mb-1">
          <BrandLogo /> 관리자
        </h1>
        <p className="text-sm text-brand-slate mb-8">로그인하여 계속하세요.</p>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label
              htmlFor="user_id"
              className="block text-sm font-medium text-brand-navy mb-1.5"
            >
              아이디
            </label>
            <input
              id="user_id"
              type="text"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              autoComplete="username"
              className="admin-input"
              required
            />
          </div>
          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-brand-navy mb-1.5"
            >
              비밀번호
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              className="admin-input"
              required
            />
          </div>
          {error && (
            <p className="text-sm text-red-700 bg-red-50 border border-red-100/80 px-3.5 py-2.5 rounded-xl">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="admin-btn-primary w-full"
          >
            {loading ? "로그인 중..." : "로그인"}
          </button>
        </form>
      </div>
    </div>
  );
}
