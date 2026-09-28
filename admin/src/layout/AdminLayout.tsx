import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { Outlet, NavLink, useLocation, useNavigate } from "react-router-dom";
import { getMe, refreshSession } from "../api";
import { BrandLogo } from "../components/BrandLogo";
import {
  clearToken,
  getRole,
  getToken,
  isDevAuthBypass,
  setRole,
  setToken,
  getTokenExpiresAtMs,
  type UserRole,
} from "../auth";
import navDashboard from "../assets/dashboard/vector.svg";
import navUsage from "../assets/dashboard/vector1.svg";
import navBilling from "../assets/dashboard/vector2.svg";
import navHistory from "../assets/dashboard/vector3.svg";
import navInquiry from "../assets/dashboard/vector4.svg";
import navTuring from "../assets/dashboard/vector5.svg";
import iconTimer from "../assets/dashboard/vector6.svg";
import iconLogout from "../assets/dashboard/icon.svg";

function NavIcon({ src }: { src: string }) {
  return (
    <span className="flex h-6 w-6 shrink-0 items-center justify-center">
      <img src={src} alt="" className="h-3.5 w-3.5" />
    </span>
  );
}

const navItems: {
  to: string;
  label: string;
  icon: ReactNode;
  disabled?: boolean;
}[] = [
  { to: "/dashboard", label: "대시보드", icon: <NavIcon src={navDashboard} /> },
  { to: "/usage", label: "사용량", icon: <NavIcon src={navUsage} /> },
  { to: "/billing", label: "비용", disabled: true, icon: <NavIcon src={navBilling} /> },
  { to: "/history", label: "사용 내역", icon: <NavIcon src={navHistory} /> },
  { to: "/inquiry", label: "이용 문의", icon: <NavIcon src={navInquiry} /> },
  {
    to: "/turing",
    label: "Turing",
    icon: <NavIcon src={navTuring} />,
  },
];

function formatRemaining(ms: number): string {
  if (ms <= 0) return "세션 만료됨";
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `세션 만료까지 ${h}시간 ${m}분 ${s}초`;
  if (m > 0) return `세션 만료까지 ${m}분 ${s}초`;
  return `세션 만료까지 ${s}초`;
}

export function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const search = location.search || "";
  const [role, setRoleState] = useState<UserRole | null>(() => getRole());
  const [remaining, setRemaining] = useState<string>("");
  const [extending, setExtending] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // 페이지 이동하면 모바일 드로어 자동으로 닫기
  useEffect(() => {
    setMobileNavOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (role) return;
    if (isDevAuthBypass()) return;
    getMe()
      .then((me) => {
        const r: UserRole = me.role === "admin" ? "admin" : "client";
        setRole(r);
        setRoleState(r);
      })
      .catch(() => {
        clearToken();
        navigate("/login", { replace: true });
      });
  }, [role, navigate]);

  const handleExtend = async () => {
    if (isDevAuthBypass()) return;
    setExtending(true);
    try {
      const { access_token } = await refreshSession();
      setToken(access_token);
    } catch {
      clearToken();
      navigate("/login", { replace: true });
    } finally {
      setExtending(false);
    }
  };

  useEffect(() => {
    const tick = () => {
      const token = getToken();
      if (!token) {
        setRemaining("");
        return;
      }
      const expiresAt = getTokenExpiresAtMs(token);
      if (expiresAt == null) {
        setRemaining("");
        return;
      }
      const ms = expiresAt - Date.now();
      setRemaining(formatRemaining(ms));
      if (ms <= 0) {
        clearToken();
        navigate("/login", { replace: true });
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [navigate]);

  const handleLogout = () => {
    clearToken();
    navigate("/login", { replace: true });
  };

  return (
    <div className="font-sans h-screen overflow-hidden bg-white flex">
      {/* 모바일 드로어 배경 — 사이드바 열려 있을 때만, lg 이상에서는 안 씀 */}
      {mobileNavOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30 lg:hidden"
          onClick={() => setMobileNavOpen(false)}
          aria-hidden
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-60 flex shrink-0 flex-col overflow-y-auto border-r border-[#eaecf3] bg-[#fbfcff] transition-transform duration-200 lg:static lg:z-auto lg:h-screen lg:translate-x-0 ${
          mobileNavOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-[60px] shrink-0 items-center justify-between px-8 py-4">
          <BrandLogo className="text-xl" />
          <button
            type="button"
            onClick={() => setMobileNavOpen(false)}
            className="-mr-2 flex h-8 w-8 items-center justify-center rounded-lg text-[#56607a] lg:hidden"
            aria-label="메뉴 닫기"
          >
            ✕
          </button>
        </div>
        <nav className="flex flex-1 flex-col items-start px-5 pt-3">
          {navItems
            .filter(
              (item) =>
                role !== "admin" ||
                item.to === "/inquiry" ||
                item.to === "/turing",
            )
            .filter((item) => !item.disabled || item.to === "/billing")
            .map(({ to, label, icon, disabled }) => {
              const content =
                to === "/turing" ? (
                  <span className="flex-1 min-w-0 font-extrabold text-[14px] leading-[18px] text-[#56607a]">
                    turing<span className="text-brand-accent">.</span>
                  </span>
                ) : (
                  <span className="flex-1 min-w-0 text-[16px] font-medium leading-5 tracking-[-0.02em]">
                    {label}
                  </span>
                );
              if (disabled) {
                return (
                  <span
                    key={to}
                    className="flex w-full cursor-not-allowed items-center gap-2 rounded-[12px] p-3 text-[#97a0b8] opacity-75"
                  >
                    {icon}
                    {content}
                  </span>
                );
              }
              return (
                <NavLink
                  key={to}
                  to={`${to}${search}`}
                  className={({ isActive }) =>
                    `flex w-full items-center gap-2 rounded-[12px] p-3 transition-colors ${
                      isActive
                        ? "bg-[#ebf0ff] text-[#04044a]"
                        : "text-[#56607a] hover:bg-[#f5f6f9]"
                    }`
                  }
                >
                  {icon}
                  {content}
                </NavLink>
              );
            })}
        </nav>
        <div className="flex shrink-0 flex-col items-start gap-4 border-t border-[#eaecf3] px-8 pb-6 pt-6">
          {remaining && (
            <div className="flex w-full flex-col gap-2 rounded-[12px] bg-[#ebf0ff] p-2">
              <div className="flex w-full items-start gap-1">
                <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                  <img src={iconTimer} alt="" className="h-3 w-3" />
                </span>
                <span className="flex-1 text-[12px] leading-4 tracking-[-0.02em] text-black">
                  {remaining}
                </span>
              </div>
              <button
                type="button"
                onClick={handleExtend}
                disabled={extending || remaining === "세션 만료됨"}
                className="w-full rounded-lg bg-[#04044a] px-2 py-1 text-[12px] font-medium leading-4 tracking-[-0.02em] text-white transition-opacity disabled:opacity-50"
              >
                {extending ? "연장 중..." : "시간 연장"}
              </button>
            </div>
          )}
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[16px] font-medium leading-5 tracking-[-0.02em] text-[#56607a] transition-colors hover:text-[#04044a]"
          >
            <span className="flex-1 text-left">로그아웃</span>
            <img src={iconLogout} alt="" className="h-3.5 w-3.5 shrink-0" />
          </button>
        </div>
      </aside>
      <main className="flex min-h-0 flex-1 flex-col overflow-auto bg-white">
        {/* 모바일 상단 바 — lg 이상에서는 사이드바가 항상 보이니 필요 없음 */}
        <div className="flex h-14 shrink-0 items-center gap-3 border-b border-[#eaecf3] bg-white px-4 lg:hidden">
          <button
            type="button"
            onClick={() => setMobileNavOpen(true)}
            className="flex h-9 w-9 shrink-0 flex-col items-center justify-center gap-1 rounded-lg text-[#56607a] hover:bg-[#f5f6f9]"
            aria-label="메뉴 열기"
          >
            <span className="block h-0.5 w-5 rounded-full bg-current" />
            <span className="block h-0.5 w-5 rounded-full bg-current" />
            <span className="block h-0.5 w-5 rounded-full bg-current" />
          </button>
          <BrandLogo className="text-lg" />
        </div>
        <div className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
