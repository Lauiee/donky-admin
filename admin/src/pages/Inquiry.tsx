import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { getRole } from "../auth";
import { PageHeader } from "../components/PageHeader";
import { ProjectSelect } from "../components/ProjectSelect";
import {
  createInquiry,
  getInquiriesAll,
  getInquiriesList,
  getProjects,
  uploadInquiryAttachment,
  type InquiryItem,
  type ProjectItem,
} from "../api";

const PAGE_SIZE = 20;

const STATUS_OPTIONS = [
  { value: "", label: "전체" },
  { value: "pending", label: "대기중" },
  { value: "in_progress", label: "처리 중" },
  { value: "completed", label: "완료" },
] as const;

function formatDate(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleString("ko-KR", {
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function statusLabel(s: string) {
  const map: Record<string, string> = {
    pending: "대기중",
    in_progress: "처리 중",
    completed: "완료",
  };
  return map[s] ?? s;
}

function statusColor(s: string) {
  const map: Record<string, string> = {
    pending: "bg-amber-100 text-amber-800",
    in_progress: "bg-brand-mint/25 text-brand-navy",
    completed: "bg-brand-accent/20 text-brand-navy",
  };
  return map[s] ?? "bg-brand-surface text-brand-navy";
}

export function Inquiry() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const isAdmin = getRole() === "admin";
  const statusFromUrl = searchParams.get("status") ?? "";
  const qFromUrl = searchParams.get("q") ?? "";

  const [items, setItems] = useState<InquiryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState(statusFromUrl);
  const [searchInput, setSearchInput] = useState(qFromUrl);
  const [searchQuery, setSearchQuery] = useState(qFromUrl);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createTitle, setCreateTitle] = useState("");
  const [createBody, setCreateBody] = useState("");
  const [createProjectId, setCreateProjectId] = useState("");
  const [createAttachmentUrls, setCreateAttachmentUrls] = useState<string[]>(
    [],
  );
  const [createFiles, setCreateFiles] = useState<File[]>([]);
  const [createUploading, setCreateUploading] = useState(false);
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const fileInputActiveRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedProject, setSelectedProject] = useState(
    searchParams.get("project_id") ?? "",
  );

  useEffect(() => {
    getProjects()
      .then((res) => setProjects(res.items ?? []))
      .catch(() => setProjects([]));
  }, []);

  useEffect(() => {
    setStatusFilter(statusFromUrl);
    setSearchInput(qFromUrl);
    setSearchQuery(qFromUrl);
  }, [statusFromUrl, qFromUrl]);

  useEffect(() => {
    setSelectedProject(searchParams.get("project_id") ?? "");
  }, [searchParams]);

  const handleProjectChange = (value: string) => {
    setSelectedProject(value);
    setPage(1);
    const next = new URLSearchParams(searchParams);
    if (value) next.set("project_id", value);
    else next.delete("project_id");
    setSearchParams(next, { replace: true });
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const fetchList = isAdmin ? getInquiriesAll : getInquiriesList;
    fetchList(
      page,
      PAGE_SIZE,
      statusFilter || undefined,
      searchQuery || undefined,
      selectedProject || undefined,
    )
      .then(({ items: list, total: t }) => {
        if (!cancelled) {
          setItems(list);
          setTotal(t);
        }
      })
      .catch((e) => {
        if (!cancelled)
          setError(e instanceof Error ? e.message : "문의 목록 조회 실패");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [page, statusFilter, searchQuery, selectedProject, isAdmin]);

  const handleStatusChange = (value: string) => {
    setStatusFilter(value);
    setPage(1);
    const next = new URLSearchParams(searchParams);
    if (value) next.set("status", value);
    else next.delete("status");
    setSearchParams(next, { replace: true });
  };

  const handleCreate = async () => {
    if (!createTitle.trim() || !createBody.trim()) return;
    setCreateSubmitting(true);
    setCreateError(null);
    try {
      let attachmentUrls = [...createAttachmentUrls];
      if (createFiles.length > 0) {
        setCreateUploading(true);
        for (const file of createFiles) {
          const { url } = await uploadInquiryAttachment(file);
          attachmentUrls = [...attachmentUrls, url];
        }
        setCreateUploading(false);
      }
      const created = await createInquiry(
        createTitle.trim(),
        createBody.trim(),
        createProjectId || undefined,
        attachmentUrls,
      );
      setCreateModalOpen(false);
      setCreateTitle("");
      setCreateBody("");
      setCreateAttachmentUrls([]);
      setCreateFiles([]);
      setPage(1);
      getInquiriesList(
        1,
        PAGE_SIZE,
        statusFilter || undefined,
        searchQuery || undefined,
      )
        .then(({ items: list, total: t }) => {
          setItems(list);
          setTotal(t);
        })
        .catch(() => {});
      navigate(`/inquiry/${created.id}`);
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : "문의 등록 실패");
    } finally {
      setCreateSubmitting(false);
    }
  };

  const handleSearch = () => {
    setSearchQuery(searchInput.trim());
    setPage(1);
    const next = new URLSearchParams(searchParams);
    if (searchInput.trim()) next.set("q", searchInput.trim());
    else next.delete("q");
    setSearchParams(next, { replace: true });
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      <PageHeader
        title="이용 문의"
        subtitle={
          isAdmin
            ? "문의를 등록하거나 이전 문의 내역을 확인하세요."
            : "문의를 등록하거나 내 문의 내역을 확인하세요."
        }
        actions={
          <>
            {!isAdmin && (
              <button
                type="button"
                onClick={() => {
                  setCreateModalOpen(true);
                  setCreateError(null);
                  setCreateTitle("");
                  setCreateBody("");
                  setCreateProjectId(selectedProject);
                  setCreateAttachmentUrls([]);
                  setCreateFiles([]);
                }}
                className="admin-btn-primary shrink-0"
              >
                새 문의
              </button>
            )}
            {projects.length > 0 && (
              <ProjectSelect
                value={selectedProject}
                onChange={handleProjectChange}
                projects={projects}
                placeholder="전체 프로젝트"
                className="shrink-0"
              />
            )}
          </>
        }
      />

      {/* 문의 등록 모달 */}
      {createModalOpen && (
        <div
          className="admin-modal-backdrop"
          onClick={() => {
            if (fileInputActiveRef.current) return;
            if (!createSubmitting) setCreateModalOpen(false);
          }}
        >
          <div
            className="admin-card w-full max-w-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 border-b border-brand-line/70">
              <h3 className="font-semibold text-brand-ink">새 문의</h3>
              <p className="text-sm text-brand-slate mt-0.5">
                문의 내용을 입력해 주세요. 담당자가 확인 후 답변드립니다.
              </p>
            </div>
            <div className="p-5 space-y-4">
              {createError && (
                <p className="text-sm text-red-600">{createError}</p>
              )}
              {projects.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-brand-slate mb-1.5">
                    프로젝트
                  </label>
                  <ProjectSelect
                    value={createProjectId}
                    onChange={setCreateProjectId}
                    projects={projects}
                    placeholder="프로젝트 선택"
                  />
                  <p className="text-xs text-brand-slate mt-1">
                    문의와 관련된 프로젝트를 선택하세요
                  </p>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-brand-slate mb-1.5">
                  제목
                </label>
                <input
                  type="text"
                  value={createTitle}
                  onChange={(e) => setCreateTitle(e.target.value)}
                  placeholder="문의 제목을 입력하세요"
                  className="w-full px-4 py-2.5 rounded-lg border border-brand-line text-sm text-brand-ink placeholder:text-brand-mint focus:outline-none focus:ring-2 focus:ring-brand-accent focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-brand-slate mb-1.5">
                  첨부파일
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    const input = e.currentTarget;
                    const files = input.files;
                    if (files && files.length > 0) {
                      const list = Array.from(files);
                      setCreateFiles((prev) => [...prev, ...list]);
                    }
                    input.value = "";
                  }}
                />
                <button
                  type="button"
                  onClick={() => {
                    fileInputActiveRef.current = true;
                    setTimeout(() => {
                      fileInputActiveRef.current = false;
                    }, 1500);
                    fileInputRef.current?.click();
                  }}
                  className="px-3 py-2 rounded-lg text-sm font-medium border border-brand-line bg-brand-surface text-brand-navy hover:bg-brand-surface"
                >
                  파일 선택
                </button>
                {createFiles.length > 0 && (
                  <ul className="mt-2 space-y-1 text-sm text-brand-slate">
                    {createFiles.map((f, i) => (
                      <li key={i} className="flex items-center gap-2">
                        <span>{f.name}</span>
                        <button
                          type="button"
                          onClick={() =>
                            setCreateFiles((prev) =>
                              prev.filter((_, j) => j !== i),
                            )
                          }
                          className="text-red-500 hover:text-red-600 text-xs"
                        >
                          삭제
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-brand-slate mb-1.5">
                  내용
                </label>
                <textarea
                  value={createBody}
                  onChange={(e) => setCreateBody(e.target.value)}
                  placeholder="문의 내용을 상세히 입력해 주세요"
                  rows={5}
                  className="w-full px-4 py-2.5 rounded-lg border border-brand-line text-sm text-brand-ink placeholder:text-brand-mint focus:outline-none focus:ring-2 focus:ring-brand-accent focus:border-transparent"
                />
              </div>
            </div>
            <div className="p-5 border-t border-brand-line/70 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => !createSubmitting && setCreateModalOpen(false)}
                disabled={createSubmitting}
                className="px-4 py-2 rounded-lg text-sm font-medium text-brand-navy bg-brand-surface hover:bg-brand-line/50 disabled:opacity-50"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleCreate}
                disabled={
                  createSubmitting ||
                  createUploading ||
                  !createTitle.trim() ||
                  !createBody.trim()
                }
                className="px-4 py-2 rounded-lg text-sm font-medium bg-brand-accent text-brand-ink hover:bg-brand-accentDark disabled:opacity-50 disabled:pointer-events-none"
              >
                {createUploading
                  ? "업로드 중…"
                  : createSubmitting
                    ? "등록 중…"
                    : "등록"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="admin-toolbar">
        <h3 className="admin-section-title mb-4">검색 및 필터</h3>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex rounded-full border border-brand-line/90 bg-brand-surface p-0.5 shadow-[inset_0_1px_2px_rgba(10,36,101,0.06)]">
            {STATUS_OPTIONS.map((opt) => (
              <button
                key={opt.value || "all"}
                type="button"
                onClick={() => handleStatusChange(opt.value)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-all ${
                  statusFilter === opt.value
                    ? "bg-white text-brand-navy shadow-sm ring-1 ring-black/[0.06]"
                    : "text-brand-slate hover:text-brand-navy"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="제목·내용 검색"
            className="admin-input flex-1 min-w-[200px]"
          />
          <button
            type="button"
            onClick={handleSearch}
            className="admin-btn-secondary"
          >
            검색
          </button>
        </div>
      </div>

      {loading ? (
        <div className="admin-card p-8 text-brand-slate">불러오는 중...</div>
      ) : error ? (
        <div className="admin-card p-8 text-red-600">{error}</div>
      ) : (
        <div className="admin-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-brand-surface text-left text-brand-slate">
                  <th className="px-5 py-3 font-medium">상태</th>
                  <th className="px-5 py-3 font-medium">제목</th>
                  {projects.length > 0 && (
                    <th className="px-5 py-3 font-medium">프로젝트</th>
                  )}
                  {isAdmin && (
                    <th className="px-5 py-3 font-medium">작성자</th>
                  )}
                  <th className="px-5 py-3 font-medium">등록일</th>
                  <th className="px-5 py-3 font-medium w-24"> </th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td
                      colSpan={
                        (projects.length > 0 ? 1 : 0) + (isAdmin ? 1 : 0) + 4
                      }
                      className="px-5 py-8 text-center text-brand-slate"
                    >
                      문의가 없습니다.
                    </td>
                  </tr>
                ) : (
                  items.map((item) => (
                    <tr
                      key={item.id}
                      className="border-t border-brand-line/70 hover:bg-brand-surface/80"
                    >
                      <td className="px-5 py-3">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${statusColor(
                            item.status,
                          )}`}
                        >
                          {statusLabel(item.status)}
                        </span>
                      </td>
                      <td
                        className="px-5 py-3 text-brand-navy max-w-[280px] truncate"
                        title={item.title}
                      >
                        {item.title || "(제목 없음)"}
                      </td>
                      {projects.length > 0 && (
                        <td className="px-5 py-3 text-brand-slate">
                          {item.project_id
                            ? (projects.find((p) => p.id === item.project_id)
                                ?.name ?? item.project_id)
                            : "-"}
                        </td>
                      )}
                      {isAdmin && (
                        <td className="px-5 py-3 text-brand-slate">
                          {item.author || "-"}
                        </td>
                      )}
                      <td className="px-5 py-3 text-brand-slate">
                        {formatDate(item.created_at)}
                      </td>
                      <td className="px-5 py-3">
                        <button
                          type="button"
                          onClick={() => navigate(`/inquiry/${item.id}`)}
                          className="px-3 py-1.5 rounded-lg text-sm font-medium text-brand-navy bg-brand-surface hover:bg-brand-line/50"
                        >
                          상세
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="px-5 py-3 border-t border-brand-line/70 flex items-center justify-between">
              <span className="text-sm text-brand-slate">
                전체 {total}건 ({(page - 1) * PAGE_SIZE + 1}–
                {Math.min(page * PAGE_SIZE, total)})
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="px-3 py-1.5 rounded-lg text-sm font-medium text-brand-navy bg-brand-surface hover:bg-brand-line/50 disabled:opacity-50 disabled:pointer-events-none"
                >
                  이전
                </button>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="px-3 py-1.5 rounded-lg text-sm font-medium text-brand-navy bg-brand-surface hover:bg-brand-line/50 disabled:opacity-50 disabled:pointer-events-none"
                >
                  다음
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
