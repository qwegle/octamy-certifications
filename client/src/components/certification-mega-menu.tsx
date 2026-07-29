import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FocusEvent,
  type KeyboardEvent,
} from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  ArrowRight,
  Award,
  BadgeIndianRupee,
  BookOpenCheck,
  ChevronDown,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import {
  publicAssessmentCategoryPath,
  publicAssessmentPath,
  publicPracticeCategoryPath,
  publicPracticePath,
} from "@shared/public-assessment-routes";

type CatalogItem = {
  id: number;
  title: string;
  slug: string;
  price: string;
  category: { id: number; name: string; slug: string };
};

type CatalogResponse = {
  items: CatalogItem[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
};

type CatalogGroup = {
  id: number;
  name: string;
  slug: string;
  items: CatalogItem[];
};

const CERTIFICATION_API = "/api/assessments";
const PRACTICE_API = "/api/practice-assessments";
const MENU_CATEGORY_LIMIT = 8;

async function fetchCompleteCatalog(endpoint: string): Promise<CatalogResponse> {
  const first = await apiRequest("GET", `${endpoint}?page=1&pageSize=48`).then((response) => response.json()) as CatalogResponse;
  if (first.pagination.totalPages <= 1) return first;
  const remaining = await Promise.all(
    Array.from({ length: first.pagination.totalPages - 1 }, (_, index) => index + 2).map(async (page) =>
      await apiRequest("GET", `${endpoint}?page=${page}&pageSize=48`).then((response) => response.json()) as CatalogResponse,
    ),
  );
  return { ...first, items: [first, ...remaining].flatMap((response) => response.items) };
}

function groupCatalog(items: CatalogItem[] = []): CatalogGroup[] {
  const groups = new Map<string, CatalogGroup>();
  for (const item of items) {
    const group = groups.get(item.category.slug) ?? {
      id: item.category.id,
      name: item.category.name,
      slug: item.category.slug,
      items: [],
    };
    group.items.push(item);
    groups.set(item.category.slug, group);
  }
  return Array.from(groups.values())
    .filter((group) => group.items.length > 0)
    .sort((left, right) => right.items.length - left.items.length || left.name.localeCompare(right.name));
}

function useCatalogMenu() {
  const certifications = useQuery<CatalogResponse>({
    queryKey: [CERTIFICATION_API, "complete-menu-catalog"],
    queryFn: () => fetchCompleteCatalog(CERTIFICATION_API),
    staleTime: 5 * 60_000,
  });
  const practice = useQuery<CatalogResponse>({
    queryKey: [PRACTICE_API, "complete-menu-catalog"],
    queryFn: () => fetchCompleteCatalog(PRACTICE_API),
    staleTime: 5 * 60_000,
  });

  return {
    certifications,
    practice,
    certificationGroups: useMemo(
      () => groupCatalog(certifications.data?.items),
      [certifications.data?.items],
    ),
    practiceGroups: useMemo(
      () => groupCatalog(practice.data?.items),
      [practice.data?.items],
    ),
  };
}

function focusableElements(container: HTMLElement | null) {
  if (!container) return [];
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((element) => !element.hasAttribute("disabled") && element.offsetParent !== null);
}

export function CertificationMegaMenu({ currentPath }: { currentPath: string }) {
  const { certifications, practice, certificationGroups, practiceGroups } = useCatalogMenu();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const focusOnOpenRef = useRef(false);
  const current = currentPath.startsWith("/get-certified") || currentPath.startsWith("/practice");

  const cancelClose = () => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    closeTimerRef.current = null;
  };
  const openMenu = (focusFirst = false) => {
    cancelClose();
    focusOnOpenRef.current = focusFirst;
    setOpen(true);
  };
  const closeMenu = (restoreFocus = false) => {
    cancelClose();
    setOpen(false);
    if (restoreFocus) requestAnimationFrame(() => triggerRef.current?.focus());
  };
  const scheduleClose = () => {
    cancelClose();
    closeTimerRef.current = setTimeout(() => setOpen(false), 220);
  };

  useEffect(() => closeMenu(false), [currentPath]);
  useEffect(() => () => cancelClose(), []);

  useEffect(() => {
    if (!open) return;
    if (focusOnOpenRef.current) {
      focusOnOpenRef.current = false;
      requestAnimationFrame(() =>
        containerRef.current?.querySelector<HTMLElement>("[data-menu-entry]")?.focus(),
      );
    }
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) closeMenu(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const handleBlur = (event: FocusEvent<HTMLDivElement>) => {
    if (!containerRef.current?.contains(event.relatedTarget as Node | null)) scheduleClose();
  };

  const handleKeyboard = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!open) return;
    const focusable = focusableElements(containerRef.current);
    const index = focusable.indexOf(document.activeElement as HTMLElement);
    if (event.key === "Escape") {
      event.preventDefault();
      closeMenu(true);
      return;
    }
    if (event.key === "Tab") {
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
      return;
    }
    const direction = event.key === "ArrowDown" || event.key === "ArrowRight"
      ? 1
      : event.key === "ArrowUp" || event.key === "ArrowLeft"
        ? -1
        : 0;
    if (direction && focusable.length > 0) {
      event.preventDefault();
      focusable[(index + direction + focusable.length) % focusable.length]?.focus();
    } else if (event.key === "Home") {
      event.preventDefault();
      focusable[0]?.focus();
    } else if (event.key === "End") {
      event.preventDefault();
      focusable[focusable.length - 1]?.focus();
    }
  };

  return (
    <div
      ref={containerRef}
      className="static"
      onMouseEnter={() => openMenu(false)}
      onMouseLeave={scheduleClose}
      onFocus={() => openMenu(false)}
      onBlur={handleBlur}
      onKeyDown={handleKeyboard}
    >
      <button
        ref={triggerRef}
        type="button"
        className={`inline-flex min-h-11 items-center gap-1 rounded-xl px-3 text-sm font-bold transition-colors ${current || open ? "bg-violet-50 text-violet-800" : "text-slate-700 hover:bg-slate-50 hover:text-slate-950"}`}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-controls="certification-mega-menu"
        onClick={() => (open ? closeMenu(false) : openMenu(false))}
        onKeyDown={(event) => {
          if (["ArrowDown", "Enter", " "].includes(event.key) && !open) {
            event.preventDefault();
            openMenu(true);
          }
        }}
      >
        Certifications <span className="text-slate-300">&amp;</span> practice
        <ChevronDown aria-hidden="true" className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div
          id="certification-mega-menu"
          role="dialog"
          aria-modal="true"
          aria-label="Certification and practice catalog navigation"
          className="absolute left-1/2 top-[calc(100%-1px)] z-50 w-[min(calc(100vw-2rem),76rem)] -translate-x-1/2 pt-2"
          onClick={(event) => {
            if ((event.target as HTMLElement).closest("a")) closeMenu(false);
          }}
        >
          <div className="grid max-h-[min(38rem,calc(100vh-6rem))] overflow-y-auto overscroll-contain rounded-[1.5rem] border border-slate-200 bg-white text-left shadow-2xl shadow-slate-950/20 lg:grid-cols-[14rem_minmax(0,1.15fr)_minmax(18rem,.85fr)]">
            <section className="bg-slate-950 p-5 text-white" aria-labelledby="catalog-menu-heading">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-400/20 text-violet-200">
                <Sparkles className="h-5 w-5" aria-hidden="true" />
              </div>
              <h2 id="catalog-menu-heading" className="mt-4 text-xl font-black tracking-tight">Prove it. Or practise it.</h2>
              <p className="mt-2 text-xs leading-5 text-slate-300">Certification scores and Practice Pass are separate products with separate outcomes.</p>
              <div className="mt-5 grid gap-2 text-xs">
                <div className="rounded-xl border border-violet-300/20 bg-violet-400/10 p-3">
                  <p className="font-bold text-violet-100">Certification</p>
                  <p className="mt-1 text-slate-300">Your score is free. Detailed review and an optional credential require payment.</p>
                </div>
                <div className="rounded-xl border border-cyan-300/20 bg-cyan-400/10 p-3">
                  <p className="font-bold text-cyan-100">Practice Pass</p>
                  <p className="mt-1 text-slate-300">Subscription practice only. No Octamy credential is issued.</p>
                </div>
              </div>
            </section>

            <CatalogSection
              kind="certification"
              title="Get certified"
              description="Career evidence with an optional, separately priced credential after your score."
              total={certifications.data?.pagination.total}
              groups={certificationGroups}
              items={certifications.data?.items}
              loading={certifications.isLoading}
              error={certifications.isError}
            />

            <CatalogSection
              kind="practice"
              title="Practice Pass"
              description="Prepare and repeat with subscription access. Practice results are not credentials."
              total={practice.data?.pagination.total}
              groups={practiceGroups}
              items={practice.data?.items}
              loading={practice.isLoading}
              error={practice.isError}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function CatalogSection({
  kind,
  title,
  description,
  total,
  groups,
  items = [],
  loading,
  error,
}: {
  kind: "certification" | "practice";
  title: string;
  description: string;
  total?: number;
  groups: CatalogGroup[];
  items?: CatalogItem[];
  loading: boolean;
  error: boolean;
}) {
  const certification = kind === "certification";
  const hub = certification ? "/get-certified" : "/practice";
  const categoryPath = certification ? publicAssessmentCategoryPath : publicPracticeCategoryPath;
  const itemPath = certification ? publicAssessmentPath : publicPracticePath;
  const Icon = certification ? Award : BookOpenCheck;

  return (
    <section className={`p-5 ${certification ? "border-r border-slate-200" : "bg-cyan-50/45"}`} aria-labelledby={`${kind}-menu-heading`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className={`flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] ${certification ? "text-violet-700" : "text-cyan-800"}`}>
            <Icon className="h-4 w-4" aria-hidden="true" /> {title}
          </p>
          <h3 id={`${kind}-menu-heading`} className="mt-2 text-lg font-black text-slate-950">
            {loading ? "Loading catalog…" : `${total ?? items.length} published ${total === 1 ? "assessment" : "assessments"}`}
          </h3>
          <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>
        </div>
        <Link
          data-menu-entry={certification ? true : undefined}
          href={hub}
          className={`inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-2 text-xs font-bold ${certification ? "bg-violet-100 text-violet-900 hover:bg-violet-200" : "bg-cyan-100 text-cyan-950 hover:bg-cyan-200"}`}
        >
          View all <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </div>

      {loading ? (
        <div className="mt-5 grid grid-cols-2 gap-2" aria-label={`Loading ${title}`}>
          {Array.from({ length: 4 }, (_, index) => <div key={index} className="h-14 animate-pulse rounded-xl bg-slate-100" />)}
        </div>
      ) : error ? (
        <p role="status" className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">This catalog is temporarily unavailable. Use “View all” to try again.</p>
      ) : groups.length === 0 ? (
        <p role="status" className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs leading-5 text-slate-600">No published assessments are available in this catalog yet.</p>
      ) : (
        <>
          <nav aria-label={`${title} most populated categories`} className="mt-5 grid grid-cols-2 gap-2">
            {groups.slice(0, MENU_CATEGORY_LIMIT).map((group) => (
              <Link
                key={group.id}
                href={categoryPath(group.slug)}
                className={`group flex min-h-14 items-center justify-between gap-2 rounded-xl border bg-white px-3 py-2 transition ${certification ? "border-violet-100 hover:border-violet-300 hover:bg-violet-50" : "border-cyan-100 hover:border-cyan-300 hover:bg-cyan-50"}`}
              >
                <span className="text-xs font-bold leading-4 text-slate-800">{group.name}</span>
                <span aria-label={`${group.items.length} assessments`} className={`rounded-full px-2 py-1 text-[10px] font-black ${certification ? "bg-violet-100 text-violet-800" : "bg-cyan-100 text-cyan-900"}`}>{group.items.length}</span>
              </Link>
            ))}
          </nav>
          {groups.length > MENU_CATEGORY_LIMIT && (
            <p className="mt-3 text-xs font-semibold text-slate-500">
              Showing the {MENU_CATEGORY_LIMIT} largest subjects · {groups.length - MENU_CATEGORY_LIMIT} more in View all
            </p>
          )}
          <div className="mt-5 border-t border-slate-200 pt-4">
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Explore assessments</p>
            <div className="mt-2 grid gap-1">
              {items.slice(0, certification ? 3 : 4).map((item) => (
                <Link key={item.id} href={itemPath(item.slug)} className="group flex items-center justify-between gap-3 rounded-lg px-2 py-2 text-xs font-semibold leading-4 text-slate-700 hover:bg-white hover:text-slate-950">
                  <span>{item.title}</span><ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-400 group-hover:text-slate-800" aria-hidden="true" />
                </Link>
              ))}
            </div>
          </div>
        </>
      )}
    </section>
  );
}

export function MobileCertificationMenu({ onNavigate }: { onNavigate: () => void }) {
  const { certifications, practice, certificationGroups, practiceGroups } = useCatalogMenu();
  return (
    <div className="grid gap-2" aria-label="Certification and practice catalogs">
      <MobileCatalogSection
        kind="certification"
        total={certifications.data?.pagination.total}
        groups={certificationGroups}
        loading={certifications.isLoading}
        error={certifications.isError}
        onNavigate={onNavigate}
      />
      <MobileCatalogSection
        kind="practice"
        total={practice.data?.pagination.total}
        groups={practiceGroups}
        loading={practice.isLoading}
        error={practice.isError}
        onNavigate={onNavigate}
      />
    </div>
  );
}

function MobileCatalogSection({ kind, total, groups, loading, error, onNavigate }: {
  kind: "certification" | "practice";
  total?: number;
  groups: CatalogGroup[];
  loading: boolean;
  error: boolean;
  onNavigate: () => void;
}) {
  const certification = kind === "certification";
  const hub = certification ? "/get-certified" : "/practice";
  const categoryPath = certification ? publicAssessmentCategoryPath : publicPracticeCategoryPath;
  return (
    <details className={`group overflow-hidden rounded-2xl border ${certification ? "border-violet-200 bg-violet-50" : "border-cyan-200 bg-cyan-50"}`}>
      <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4 text-sm font-black text-slate-950">
        <span className="flex items-center gap-2">{certification ? <Award className="h-4 w-4 text-violet-700" /> : <BadgeIndianRupee className="h-4 w-4 text-cyan-800" />}{certification ? "Certifications" : "Practice Pass"}<span className="text-xs font-semibold text-slate-500">{loading ? "…" : total ?? 0}</span></span>
        <ChevronDown className="h-4 w-4 transition group-open:rotate-180" aria-hidden="true" />
      </summary>
      <div className="border-t border-slate-200 bg-white p-2">
        <p className="px-3 py-2 text-xs leading-5 text-slate-500">{certification ? "Score free; detailed review and optional credential after payment." : "Subscription practice only; no credential issued."}</p>
        <Link href={hub} onClick={onNavigate} className={`flex min-h-11 items-center justify-between rounded-xl px-3 text-sm font-bold ${certification ? "text-violet-800 hover:bg-violet-50" : "text-cyan-900 hover:bg-cyan-50"}`}>Browse all <ArrowRight className="h-4 w-4" /></Link>
        {loading ? <div className="m-3 h-16 animate-pulse rounded-xl bg-slate-100" /> : error ? <p className="m-3 text-xs text-amber-800">Catalog temporarily unavailable.</p> : groups.length === 0 ? <p className="m-3 text-xs text-slate-500">No published assessments yet.</p> : groups.map((group) => (
          <Link key={group.id} href={categoryPath(group.slug)} onClick={onNavigate} className="flex min-h-11 items-center justify-between rounded-xl px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            {group.name}<span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-black">{group.items.length}</span>
          </Link>
        ))}
      </div>
    </details>
  );
}
