import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation, useParams } from "wouter";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Bot,
  Camera,
  Check,
  CheckCircle2,
  ChevronRight,
  Circle,
  Clock3,
  Code2,
  FileText,
  Info,
  Laptop,
  Loader2,
  LockKeyhole,
  Mic,
  MicOff,
  MonitorUp,
  Network,
  Play,
  RotateCcw,
  Save,
  ShieldCheck,
  Sparkles,
  Square,
  Trash2,
  Video,
  VideoOff,
  WifiOff,
  XCircle,
} from "lucide-react";
import DashboardLayout from "@/components/dashboard-layout";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth.tsx";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";

type JsonRecord = Record<string, unknown>;

type StudioStatus = {
  practiceEnabled: boolean;
  verifiedEnabled: boolean;
  aiEvaluationEnabled: boolean;
  voiceTranscriptionEnabled: boolean;
  codeRunnerEnabled: boolean;
  recordingEnabled: boolean;
  consentVersion: string;
};

type ConsentState = {
  aiProcessing: boolean;
  microphone: boolean;
  camera: boolean;
  screen: boolean;
  consentVersion: string;
};

type TestCase = {
  id?: string;
  name?: string;
  input?: unknown;
  expectedOutput?: unknown;
  description?: string;
  hidden?: boolean;
};

type BlueprintItem = {
  key: string;
  kind: string;
  title: string;
  prompt: string;
  description?: string;
  guidance?: string;
  timeLimitSeconds?: number;
  minimumWords?: number;
  maximumWords?: number;
  starterCode?: string;
  allowedLanguages: string[];
  sampleTestCases: TestCase[];
};

type StudioTemplate = {
  id: number;
  key: string;
  version: number;
  title: string;
  targetRole: string;
  description: string;
  skills: string[];
  difficulty: string;
  durationMinutes: number;
  availableModes: string[];
  itemCount: number;
  codingCount: number;
  includesCoding: boolean;
  blueprint: {
    rubricVersion?: string;
    items: BlueprintItem[];
  };
};

type ResponseDraft = {
  responseText: string;
  code: string;
  language: string;
  timeSpentSeconds: number;
  updatedAt: number;
};

type SaveStatus = "idle" | "saving" | "saved" | "offline" | "error";
type DeviceStatus = "idle" | "requesting" | "active" | "denied" | "error";
type VoiceStatus = "idle" | "recording" | "uploading" | "done" | "error";

const DEFAULT_STATUS: StudioStatus = {
  practiceEnabled: false,
  verifiedEnabled: false,
  aiEvaluationEnabled: false,
  voiceTranscriptionEnabled: false,
  codeRunnerEnabled: false,
  recordingEnabled: false,
  consentVersion: "unavailable",
};

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asString(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function asBoolean(value: unknown, fallback = false): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function titleCase(value: string): string {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function itemKind(item: JsonRecord): string {
  return asString(item.kind || item.type || item.questionType, "interview").toLowerCase();
}

function isCodingItem(item: BlueprintItem): boolean {
  return ["coding", "code", "hands_on", "hands-on", "practical"].includes(item.kind);
}

function hasMeaningfulResponse(item: BlueprintItem, draft: ResponseDraft | undefined): boolean {
  if (!draft) return false;
  if (!isCodingItem(item)) return Boolean(draft.responseText.trim());
  const code = draft.code.trim();
  return Boolean(code && code !== (item.starterCode || "").trim());
}

function wordCount(value: string): number {
  return value.trim().match(/\S+/g)?.length || 0;
}

function normalizeTestCase(value: unknown, index: number): TestCase {
  const test = asRecord(value);
  return {
    id: asString(test.id || test.key, `sample-${index + 1}`),
    name: asString(test.name || test.title, `Sample ${index + 1}`),
    input: test.input ?? test.args ?? test.stdin,
    expectedOutput: test.expectedOutput ?? test.expected ?? test.output,
    description: asString(test.description),
    hidden: asBoolean(test.hidden) || test.visibility === "hidden",
  };
}

function normalizeItem(value: unknown, index: number): BlueprintItem {
  const item = asRecord(value);
  const kind = itemKind(item);
  const tests = asArray(
    item.sampleTestCases || item.publicTestCases || item.examples || item.testCases,
  )
    .map(normalizeTestCase)
    .filter((test) => !test.hidden);
  const languages = asArray(item.allowedLanguages || item.languages || (item.language ? [item.language] : []))
    .map((language) => asString(language))
    .filter(Boolean);

  return {
    key: asString(item.key || item.itemKey || item.id, `item-${index + 1}`),
    kind,
    title: asString(item.title, isCodingItem({ kind } as BlueprintItem) ? `Coding task ${index + 1}` : `Interview question ${index + 1}`),
    prompt: asString(item.prompt || item.question || item.problemStatement || item.instructions, "Respond to this interview prompt."),
    description: asString(item.description || item.instructions),
    guidance: asString(item.guidance || item.answerGuidance),
    timeLimitSeconds: asNumber(item.timeLimitSeconds || item.timeLimit, 0) || undefined,
    minimumWords: asNumber(item.minimumWords, 0) || undefined,
    maximumWords: asNumber(item.maximumWords, 0) || undefined,
    starterCode: asString(item.starterCode || item.scaffold),
    allowedLanguages: languages.length ? languages : ["javascript"],
    sampleTestCases: tests,
  };
}

function normalizeTemplate(value: unknown, index: number): StudioTemplate {
  const template = asRecord(value);
  const blueprint = asRecord(template.blueprint);
  return {
    id: asNumber(template.id, index + 1),
    key: asString(template.key || template.templateKey || blueprint.templateKey, `template-${index + 1}`),
    version: asNumber(template.version || blueprint.version, 1),
    title: asString(template.title || blueprint.title, "Role interview practice"),
    targetRole: asString(template.targetRole || template.role || blueprint.role, "Technology role"),
    description: asString(template.description || template.summary || blueprint.summary, "Practice explaining your skills with a structured, job-relevant interview."),
    skills: asArray(template.skills || blueprint.skills).map((skill) => asString(skill)).filter(Boolean),
    difficulty: asString(template.difficulty || blueprint.level, "intermediate"),
    durationMinutes: asNumber(template.durationMinutes || template.duration || blueprint.estimatedDurationMinutes, 30),
    availableModes: asArray(template.availableModes || template.modes || template.supportedModes || blueprint.allowedModes)
      .map((mode) => asString(mode))
      .filter(Boolean),
    itemCount: asNumber(template.itemCount || blueprint.itemCount, asArray(blueprint.items || template.items).length),
    codingCount: asNumber(template.codingCount || blueprint.codingCount, asArray(blueprint.items || template.items).filter((item) => isCodingItem(normalizeItem(item, 0))).length),
    includesCoding: asBoolean(template.includesCoding, asBoolean(blueprint.includesCoding, asArray(blueprint.items || template.items).some((item) => isCodingItem(normalizeItem(item, 0))))),
    blueprint: {
      rubricVersion: asString(blueprint.rubricVersion),
      items: asArray(blueprint.items || template.items).map(normalizeItem),
    },
  };
}

function normalizeStatus(value: unknown): StudioStatus {
  const status = asRecord(value);
  return {
    practiceEnabled: asBoolean(status.practiceEnabled),
    verifiedEnabled: asBoolean(status.verifiedEnabled),
    aiEvaluationEnabled: asBoolean(status.aiEvaluationEnabled),
    voiceTranscriptionEnabled: asBoolean(status.voiceTranscriptionEnabled),
    codeRunnerEnabled: asBoolean(status.codeRunnerEnabled),
    recordingEnabled: asBoolean(status.recordingEnabled),
    consentVersion: asString(status.consentVersion, "unavailable"),
  };
}

function normalizeSessionPayload(value: unknown): JsonRecord {
  const payload = asRecord(value);
  return asRecord(payload.session || payload.item || payload);
}

function formatClock(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
    : `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function displayTestValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (value === undefined) return "Not specified";
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function studioBackupKey(sessionId: string): string {
  return `octamy:interview-studio:draft:${sessionId}`;
}

function consentBackupKey(sessionId: string): string {
  return `octamy:interview-studio:consent:${sessionId}`;
}

function getStoredRecord(key: string): JsonRecord {
  try {
    return asRecord(JSON.parse(localStorage.getItem(key) || "null"));
  } catch {
    return {};
  }
}

function StatusDot({ active, label }: { active: boolean; label: string }) {
  return (
    <span className="inline-flex min-h-8 items-center gap-2 rounded-full border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700">
      <span className={cn("h-2 w-2 rounded-full", active ? "bg-emerald-500" : "bg-slate-300")} aria-hidden="true" />
      {label}
    </span>
  );
}

function LoadingPanel({ label }: { label: string }) {
  return (
    <div className="grid min-h-[360px] place-items-center rounded-2xl border border-slate-200 bg-white">
      <div className="text-center">
        <Loader2 className="mx-auto h-6 w-6 animate-spin text-slate-500" aria-hidden="true" />
        <p className="mt-3 text-sm font-medium text-slate-600">{label}</p>
      </div>
    </div>
  );
}

export default function InterviewStudio() {
  const { sessionId = "" } = useParams<{ sessionId?: string }>();
  const [, setLocation] = useLocation();
  const { user, token, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const statusQuery = useQuery<unknown>({
    queryKey: ["/api/interview-studio/status"],
    enabled: Boolean(user && token),
  });
  const templatesQuery = useQuery<unknown>({
    queryKey: ["/api/interview-studio/templates"],
    enabled: Boolean(user && token && !sessionId),
  });
  const recentSessionsQuery = useQuery<unknown>({
    queryKey: ["/api/interview-studio/sessions"],
    enabled: Boolean(user && token && !sessionId),
  });
  const sessionQuery = useQuery<unknown>({
    queryKey: [`/api/interview-studio/sessions/${sessionId}`],
    enabled: Boolean(user && token && sessionId),
    refetchInterval: (query) => {
      const payload = asRecord(query.state.data);
      return asString(payload.status).toLowerCase() === "evaluating" ? 3_000 : false;
    },
  });

  const status = useMemo(() => normalizeStatus(statusQuery.data || DEFAULT_STATUS), [statusQuery.data]);
  const templates = useMemo(() => {
    const payload = asRecord(templatesQuery.data);
    return asArray(payload.items || payload.templates || templatesQuery.data).map(normalizeTemplate);
  }, [templatesQuery.data]);
  const recentSessions = useMemo(() => {
    const payload = asRecord(recentSessionsQuery.data);
    return asArray(payload.items || payload.sessions || recentSessionsQuery.data).map(asRecord);
  }, [recentSessionsQuery.data]);
  const session = useMemo(() => normalizeSessionPayload(sessionQuery.data), [sessionQuery.data]);

  const [selectedTemplate, setSelectedTemplate] = useState<StudioTemplate | null>(null);
  const [consent, setConsent] = useState<ConsentState>({
    aiProcessing: false,
    microphone: false,
    camera: false,
    screen: false,
    consentVersion: "unavailable",
  });
  const [privacyUnderstood, setPrivacyUnderstood] = useState(false);
  const [actionBusy, setActionBusy] = useState<"create" | "start" | "reveal" | "submit" | "delete" | null>(null);
  const [submitDialogOpen, setSubmitDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, ResponseDraft>>({});
  const draftsRef = useRef(drafts);
  const [pendingKeys, setPendingKeys] = useState<Set<string>>(new Set());
  const pendingKeysRef = useRef(pendingKeys);
  const initializedSessionRef = useRef("");
  const savingKeysRef = useRef(new Set<string>());
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [isOnline, setIsOnline] = useState(() => typeof navigator === "undefined" || navigator.onLine);
  const wasOfflineRef = useRef(false);
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const automaticSubmitRef = useRef(false);

  const cameraStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const cameraVideoRef = useRef<HTMLVideoElement | null>(null);
  const [cameraStatus, setCameraStatus] = useState<DeviceStatus>("idle");
  const [microphoneActive, setMicrophoneActive] = useState(false);
  const [screenStatus, setScreenStatus] = useState<DeviceStatus>("idle");
  const [deviceError, setDeviceError] = useState("");

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const voiceChunksRef = useRef<Blob[]>([]);
  const voiceTimeoutRef = useRef<number | undefined>();
  const voiceIntervalRef = useRef<number | undefined>();
  const voiceItemKeyRef = useRef("");
  const [voiceStatus, setVoiceStatus] = useState<VoiceStatus>("idle");
  const [voiceSeconds, setVoiceSeconds] = useState(0);
  const [runResults, setRunResults] = useState<Record<string, unknown>>({});
  const [runningItemKey, setRunningItemKey] = useState("");

  const sessionTemplate = useMemo(() => {
    const embedded = session.template || session.templateSnapshot;
    if (embedded) return normalizeTemplate(embedded, 0);
    const blueprint = asRecord(session.blueprint || session.blueprintSnapshot);
    return normalizeTemplate({
      id: session.templateId,
      key: session.templateKey,
      version: session.templateVersion,
      title: session.title,
      targetRole: session.targetRole,
      description: session.description,
      skills: session.skills,
      durationMinutes: session.durationMinutes,
      blueprint,
      items: session.items,
    }, 0);
  }, [session]);
  const items = sessionTemplate.blueprint.items;
  const navigation = asRecord(session.navigation);
  const currentIndex = asNumber(navigation.currentIndex, 0);
  const navigationCursor = asString(navigation.cursor);
  const totalItemCount = asNumber(navigation.totalItems, sessionTemplate.itemCount || items.length);
  const currentItem = items[0];
  const hasCoding = sessionTemplate.includesCoding || items.some(isCodingItem);

  const sessionStatus = asString(session.status, "draft").toLowerCase();
  const isDraftSession = ["created", "draft", "ready", "pending"].includes(sessionStatus);
  const isResultSession = ["submitted", "evaluating", "completed", "evaluated", "review_required", "expired", "cancelled"].includes(sessionStatus)
    || Boolean(session.submittedAt || session.completedAt);
  const isActiveSession = !isDraftSession && !isResultSession;

  const sessionConsent = useMemo<ConsentState>(() => {
    const stored = sessionId ? getStoredRecord(consentBackupKey(sessionId)) : {};
    const value = asRecord(session.consent || session.consentSnapshot);
    const permissions = asRecord(session.permissions || session.permissionSnapshot);
    const cameraPermission = asRecord(permissions.camera);
    const microphonePermission = asRecord(permissions.microphone);
    const screenPermission = asRecord(permissions.screen);
    const valueOrStored = (field: string, canonicalField?: string): boolean => {
      if (typeof value[field] === "boolean") return Boolean(value[field]);
      if (canonicalField && typeof value[canonicalField] === "boolean") return Boolean(value[canonicalField]);
      return asBoolean(stored[field]);
    };
    return {
      aiProcessing: valueOrStored("aiProcessing", "aiEvaluation"),
      microphone: valueOrStored("microphone", "microphoneTranscription") || asBoolean(microphonePermission.required),
      camera: valueOrStored("camera") || asBoolean(cameraPermission.required),
      screen: valueOrStored("screen") || asBoolean(screenPermission.required),
      consentVersion: asString(value.consentVersion || value.policyVersion || stored.consentVersion, status.consentVersion),
    };
  }, [session, sessionId, status.consentVersion]);

  const releaseStreams = useCallback(() => {
    cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
    screenStreamRef.current?.getTracks().forEach((track) => track.stop());
    cameraStreamRef.current = null;
    screenStreamRef.current = null;
    if (cameraVideoRef.current) cameraVideoRef.current.srcObject = null;
    setCameraStatus("idle");
    setMicrophoneActive(false);
    setScreenStatus("idle");
  }, []);

  useEffect(() => {
    if (!authLoading && !user) {
      setLocation(`/login?next=${encodeURIComponent(sessionId ? `/interview-studio/${sessionId}` : "/interview-studio")}`);
    }
  }, [authLoading, sessionId, setLocation, user]);

  useEffect(() => {
    draftsRef.current = drafts;
  }, [drafts]);

  useEffect(() => {
    pendingKeysRef.current = pendingKeys;
  }, [pendingKeys]);

  useEffect(() => {
    return () => {
      window.clearTimeout(voiceTimeoutRef.current);
      window.clearInterval(voiceIntervalRef.current);
      const recorder = mediaRecorderRef.current;
      if (recorder && recorder.state !== "inactive") {
        recorder.onstop = null;
        recorder.stop();
      }
      cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
      screenStreamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  useEffect(() => {
    const video = cameraVideoRef.current;
    const stream = cameraStreamRef.current;
    if (!video || !stream || cameraStatus !== "active") return;
    video.srcObject = stream;
    void video.play().catch(() => undefined);
  }, [cameraStatus, isActiveSession, isDraftSession]);

  const postEvent = useCallback(async (eventType: string, severity = "info", metadata: JsonRecord = {}) => {
    if (!sessionId || !navigator.onLine) return;
    try {
      await apiRequest("POST", `/api/interview-studio/sessions/${sessionId}/events`, {
        eventType,
        severity,
        metadata,
      });
    } catch {
      // Telemetry must never interrupt an answer or device preview.
    }
  }, [sessionId]);

  useEffect(() => {
    const handleOffline = () => {
      wasOfflineRef.current = true;
      setIsOnline(false);
      setSaveStatus("offline");
    };
    const handleOnline = () => {
      setIsOnline(true);
      if (wasOfflineRef.current) {
        wasOfflineRef.current = false;
        void postEvent("network_online", "info");
      }
    };
    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, [postEvent]);

  useEffect(() => {
    if (!sessionId || !items.length || initializedSessionRef.current === `${sessionId}:${items.length}`) return;
    const responseValue = session.responses || session.answers || {};
    const responseArray = Array.isArray(responseValue) ? responseValue : Object.values(asRecord(responseValue));
    const responseByKey = new Map<string, JsonRecord>();
    responseArray.forEach((response) => {
      const record = asRecord(response);
      const key = asString(record.itemKey || record.item_key || record.key);
      if (key) responseByKey.set(key, record);
    });

    const backup = getStoredRecord(studioBackupKey(sessionId));
    const backupDrafts = asRecord(backup.drafts);
    const backupPending = new Set(asArray(backup.pendingKeys).map((key) => asString(key)).filter(Boolean));
    const initialDrafts: Record<string, ResponseDraft> = {};

    items.forEach((item) => {
      const serverResponse = responseByKey.get(item.key) || {};
      const local = backupPending.has(item.key) ? asRecord(backupDrafts[item.key]) : {};
      const source = Object.keys(local).length ? local : serverResponse;
      initialDrafts[item.key] = {
        responseText: asString(source.responseText || source.answerText || source.answer || source.transcript),
        code: asString(source.code, item.starterCode || ""),
        language: asString(source.language, item.allowedLanguages[0] || "javascript"),
        timeSpentSeconds: asNumber(source.timeSpentSeconds || source.timeSpent, 0),
        updatedAt: asNumber(source.updatedAt, Date.now()),
      };
    });
    setDrafts(initialDrafts);
    setPendingKeys(backupPending);
    initializedSessionRef.current = `${sessionId}:${items.length}`;
  }, [items, session.answers, session.responses, sessionId]);

  useEffect(() => {
    if (!sessionId || !initializedSessionRef.current.startsWith(`${sessionId}:`)) return;
    try {
      localStorage.setItem(studioBackupKey(sessionId), JSON.stringify({
        version: 1,
        updatedAt: new Date().toISOString(),
        drafts,
        pendingKeys: Array.from(pendingKeys),
      }));
    } catch {
      // Browser storage can be unavailable in private mode; server autosave remains primary.
    }
  }, [drafts, pendingKeys, sessionId]);

  const updateDraft = useCallback((itemKey: string, patch: Partial<ResponseDraft>) => {
    setDrafts((current) => {
      const existing = current[itemKey] || {
        responseText: "",
        code: "",
        language: "javascript",
        timeSpentSeconds: 0,
        updatedAt: Date.now(),
      };
      return {
        ...current,
        [itemKey]: { ...existing, ...patch, updatedAt: Date.now() },
      };
    });
    setPendingKeys((current) => new Set(current).add(itemKey));
    setSaveStatus(isOnline ? "idle" : "offline");
  }, [isOnline]);

  const saveItem = useCallback(async (itemKey: string, force = false) => {
    if (!sessionId || (!force && !pendingKeysRef.current.has(itemKey))) return;
    if (!navigator.onLine) {
      setSaveStatus("offline");
      throw new Error("You are offline. Your draft is safe on this device.");
    }
    if (savingKeysRef.current.has(itemKey)) return;
    const draft = draftsRef.current[itemKey];
    if (!draft) return;
    const savedVersion = draft.updatedAt;
    savingKeysRef.current.add(itemKey);
    setSaveStatus("saving");
    try {
      await apiRequest("PUT", `/api/interview-studio/sessions/${sessionId}/responses/${encodeURIComponent(itemKey)}`, {
        responseText: draft.responseText,
        code: draft.code,
        language: draft.language,
        navigationCursor,
        timeSpentSeconds: draft.timeSpentSeconds,
      });
      if (draftsRef.current[itemKey]?.updatedAt === savedVersion) {
        setPendingKeys((current) => {
          const next = new Set(current);
          next.delete(itemKey);
          return next;
        });
      }
      setSaveStatus("saved");
    } catch (error) {
      setSaveStatus(navigator.onLine ? "error" : "offline");
      throw error;
    } finally {
      savingKeysRef.current.delete(itemKey);
    }
  }, [navigationCursor, sessionId]);

  useEffect(() => {
    if (!currentItem || !pendingKeys.has(currentItem.key) || !isOnline || !isActiveSession) return;
    const timer = window.setTimeout(() => {
      void saveItem(currentItem.key).catch(() => undefined);
    }, 900);
    return () => window.clearTimeout(timer);
  }, [currentItem, drafts, isActiveSession, isOnline, pendingKeys, saveItem]);

  useEffect(() => {
    if (!isOnline || !isActiveSession || pendingKeys.size === 0) return;
    const timer = window.setTimeout(() => {
      void Promise.allSettled(Array.from(pendingKeysRef.current).map((key) => saveItem(key)));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [isActiveSession, isOnline, pendingKeys.size, saveItem]);

  useEffect(() => {
    if (!isActiveSession || !currentItem) return;
    const timer = window.setInterval(() => {
      const draft = draftsRef.current[currentItem.key];
      if (hasMeaningfulResponse(currentItem, draft)) {
        updateDraft(currentItem.key, { timeSpentSeconds: (draft?.timeSpentSeconds || 0) + 15 });
      }
    }, 15_000);
    return () => window.clearInterval(timer);
  }, [currentItem, isActiveSession, updateDraft]);

  const deadlineMs = useMemo(() => {
    const raw = session.serverDeadlineAt || session.deadlineAt || session.expiresAt || session.endsAt;
    if (!raw) return null;
    const parsed = new Date(String(raw)).getTime();
    return Number.isFinite(parsed) ? parsed : null;
  }, [session.deadlineAt, session.endsAt, session.expiresAt, session.serverDeadlineAt]);

  useEffect(() => {
    if (!deadlineMs || !isActiveSession) {
      setRemainingSeconds(null);
      return;
    }
    const update = () => setRemainingSeconds(Math.max(0, Math.ceil((deadlineMs - Date.now()) / 1000)));
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [deadlineMs, isActiveSession]);

  const enableDevices = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setDeviceError("This browser does not support camera and microphone access.");
      setCameraStatus("error");
      return;
    }
    if (!sessionConsent.camera && !sessionConsent.microphone) return;
    setDeviceError("");
    setCameraStatus("requesting");
    try {
      cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
      const stream = await navigator.mediaDevices.getUserMedia({
        video: sessionConsent.camera,
        audio: sessionConsent.microphone,
      });
      cameraStreamRef.current = stream;
      if (cameraVideoRef.current) {
        cameraVideoRef.current.srcObject = stream;
        await cameraVideoRef.current.play().catch(() => undefined);
      }
      const cameraTrack = stream.getVideoTracks()[0];
      const microphoneTrack = stream.getAudioTracks()[0];
      setCameraStatus(cameraTrack ? "active" : "idle");
      setMicrophoneActive(Boolean(microphoneTrack));
      stream.getTracks().forEach((track) => {
        track.addEventListener("ended", () => {
          if (track.kind === "video") setCameraStatus("idle");
          if (track.kind === "audio") setMicrophoneActive(false);
          void postEvent(track.kind === "video" ? "camera_permission_ended" : "microphone_permission_ended", "info");
        }, { once: true });
      });
      void postEvent("camera_microphone_ready", "info", {
        camera: Boolean(cameraTrack),
        microphone: Boolean(microphoneTrack),
      });
    } catch (error) {
      const denied = error instanceof DOMException && ["NotAllowedError", "PermissionDeniedError"].includes(error.name);
      setCameraStatus(denied ? "denied" : "error");
      setMicrophoneActive(false);
      setDeviceError(denied
        ? "Permission was not granted. You can continue typed practice or update browser permissions."
        : "Octamy could not start the selected devices. Check that they are available and try again.");
      void postEvent("camera_microphone_unavailable", "warning", {
        reason: denied ? "permission_denied" : "device_error",
        camera: sessionConsent.camera,
        microphone: sessionConsent.microphone,
      });
    }
  }, [postEvent, sessionConsent.camera, sessionConsent.microphone]);

  const enableScreenShare = useCallback(async () => {
    if (!hasCoding || !sessionConsent.screen) return;
    if (!navigator.mediaDevices?.getDisplayMedia) {
      setDeviceError("Screen sharing is not supported by this browser.");
      setScreenStatus("error");
      return;
    }
    setDeviceError("");
    setScreenStatus("requesting");
    try {
      screenStreamRef.current?.getTracks().forEach((track) => track.stop());
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      screenStreamRef.current = stream;
      setScreenStatus("active");
      const track = stream.getVideoTracks()[0];
      track?.addEventListener("ended", () => {
        screenStreamRef.current = null;
        setScreenStatus("idle");
        void postEvent("screen_share_ended", "info");
      }, { once: true });
      void postEvent("screen_share_ready", "info");
    } catch (error) {
      const denied = error instanceof DOMException && ["NotAllowedError", "PermissionDeniedError"].includes(error.name);
      setScreenStatus(denied ? "denied" : "error");
      setDeviceError(denied
        ? "Screen sharing was not started. It remains off."
        : "Octamy could not start screen sharing. Try again from a supported browser.");
      void postEvent("screen_share_unavailable", "warning", { reason: denied ? "permission_denied" : "device_error" });
    }
  }, [hasCoding, postEvent, sessionConsent.screen]);

  const createSession = async () => {
    if (!selectedTemplate || !privacyUnderstood) return;
    setActionBusy("create");
    try {
      const response = await apiRequest("POST", "/api/interview-studio/sessions", {
        templateId: selectedTemplate.id,
        mode: "practice",
        consent: { ...consent, consentVersion: status.consentVersion },
      });
      const payload = normalizeSessionPayload(await response.json());
      const id = asString(payload.id || payload.sessionId);
      if (!id) throw new Error("The interview session was created without an ID.");
      localStorage.setItem(consentBackupKey(id), JSON.stringify({ ...consent, consentVersion: status.consentVersion }));
      void queryClient.invalidateQueries({ queryKey: ["/api/interview-studio/sessions"] });
      setSelectedTemplate(null);
      setLocation(`/interview-studio/${id}`);
    } catch (error) {
      toast({
        title: "Could not create the practice session",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setActionBusy(null);
    }
  };

  const startSession = async () => {
    if (!sessionId) return;
    setActionBusy("start");
    try {
      await apiRequest("POST", `/api/interview-studio/sessions/${sessionId}/start`, {
        permissions: {
          camera: cameraStatus === "active",
          microphone: microphoneActive,
          screen: screenStatus === "active",
        },
      });
      await sessionQuery.refetch();
    } catch (error) {
      toast({
        title: "Interview could not start",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setActionBusy(null);
    }
  };

  const navigateItem = async (index: number) => {
    if (voiceStatus === "recording" || !currentItem || actionBusy === "reveal" || index !== currentIndex + 1) return;
    if (pendingKeysRef.current.has(currentItem.key) && navigator.onLine) {
      await saveItem(currentItem.key).catch(() => undefined);
    }
    const cursor = asString(navigation.cursor);
    if (!cursor || !sessionId) return;
    setActionBusy("reveal");
    try {
      const response = await apiRequest("POST", `/api/interview-studio/sessions/${sessionId}/items/next`, { cursor });
      const payload = normalizeSessionPayload(await response.json());
      queryClient.setQueryData([`/api/interview-studio/sessions/${sessionId}`], payload);
    } catch (error) {
      toast({
        title: "Next prompt could not be opened",
        description: error instanceof Error ? error.message : "Save the current response and try again.",
        variant: "destructive",
      });
    } finally {
      setActionBusy(null);
    }
  };

  const uploadVoiceAnswer = useCallback(async (blob: Blob, itemKey: string) => {
    if (!sessionId) return;
    setVoiceStatus("uploading");
    try {
      const formData = new FormData();
      const extension = blob.type.includes("ogg") ? "ogg" : blob.type.includes("mp4") ? "m4a" : "webm";
      formData.append("audio", blob, `answer-${itemKey}.${extension}`);
      formData.append("navigationCursor", navigationCursor);
      const response = await fetch(`/api/interview-studio/sessions/${sessionId}/transcribe/${encodeURIComponent(itemKey)}`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: formData,
        credentials: "include",
      });
      const raw = await response.text();
      const payload = raw ? asRecord(JSON.parse(raw)) : {};
      if (!response.ok) throw new Error(asString(payload.message || payload.error, "Voice transcription failed."));
      const transcript = asString(payload.text || payload.transcript).trim();
      if (!transcript) throw new Error("No speech was detected. You can try again or type your answer.");
      const currentText = draftsRef.current[itemKey]?.responseText.trim() || "";
      updateDraft(itemKey, { responseText: currentText ? `${currentText}\n\n${transcript}` : transcript });
      setVoiceStatus("done");
      toast({ title: "Transcript ready", description: "Review and edit the text before you submit it." });
    } catch (error) {
      setVoiceStatus("error");
      toast({
        title: "Voice answer was not transcribed",
        description: error instanceof Error ? error.message : "Type your answer or try again.",
        variant: "destructive",
      });
    } finally {
      voiceChunksRef.current = [];
    }
  }, [navigationCursor, sessionId, toast, token, updateDraft]);

  const stopVoiceRecording = useCallback(() => {
    window.clearTimeout(voiceTimeoutRef.current);
    window.clearInterval(voiceIntervalRef.current);
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") recorder.stop();
  }, []);

  const startVoiceRecording = () => {
    const stream = cameraStreamRef.current;
    const audioTracks = stream?.getAudioTracks().filter((track) => track.readyState === "live") || [];
    if (!sessionConsent.aiProcessing) {
      setVoiceStatus("error");
      setDeviceError("Voice transcription was not selected because AI processing consent is off. Type your answer instead.");
      return;
    }
    if (!currentItem || !audioTracks.length || typeof MediaRecorder === "undefined") {
      setVoiceStatus("error");
      setDeviceError("Enable microphone access before recording a voice answer.");
      return;
    }
    const audioStream = new MediaStream(audioTracks);
    const preferredType = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"]
      .find((type) => MediaRecorder.isTypeSupported(type));
    const recorder = preferredType ? new MediaRecorder(audioStream, { mimeType: preferredType }) : new MediaRecorder(audioStream);
    mediaRecorderRef.current = recorder;
    voiceChunksRef.current = [];
    voiceItemKeyRef.current = currentItem.key;
    setVoiceSeconds(0);
    setVoiceStatus("recording");
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) voiceChunksRef.current.push(event.data);
    };
    recorder.onstop = () => {
      window.clearTimeout(voiceTimeoutRef.current);
      window.clearInterval(voiceIntervalRef.current);
      const blob = new Blob(voiceChunksRef.current, { type: recorder.mimeType || "audio/webm" });
      if (blob.size > 0) void uploadVoiceAnswer(blob, voiceItemKeyRef.current);
      else setVoiceStatus("error");
    };
    recorder.start(1000);
    voiceIntervalRef.current = window.setInterval(() => setVoiceSeconds((seconds) => seconds + 1), 1000);
    voiceTimeoutRef.current = window.setTimeout(stopVoiceRecording, 120_000);
  };

  const runSamples = async () => {
    if (!sessionId || !currentItem || !isCodingItem(currentItem) || !status.codeRunnerEnabled) return;
    const draft = draftsRef.current[currentItem.key];
    if (!draft?.code.trim()) return;
    setRunningItemKey(currentItem.key);
    try {
      await saveItem(currentItem.key, true);
      const response = await apiRequest("POST", `/api/interview-studio/sessions/${sessionId}/run-samples`, {
        itemKey: currentItem.key,
        code: draft.code,
        language: draft.language,
        navigationCursor,
      });
      const payload = await response.json();
      setRunResults((current) => ({ ...current, [currentItem.key]: payload }));
    } catch (error) {
      toast({
        title: "Samples could not run",
        description: error instanceof Error ? error.message : "Your code remains saved. Please try again.",
        variant: "destructive",
      });
    } finally {
      setRunningItemKey("");
    }
  };

  const submitSession = useCallback(async (automatic = false) => {
    if (!sessionId || actionBusy === "submit") return;
    if (voiceStatus === "recording" || voiceStatus === "uploading") {
      if (!automatic) toast({ title: "Finish the voice answer first", description: "Stop recording and wait for the editable transcript before submitting." });
      return;
    }
    if (!navigator.onLine) {
      if (!automatic) toast({ title: "You are offline", description: "Your work is backed up on this device. Reconnect before submitting." });
      return;
    }
    setActionBusy("submit");
    try {
      const saveResults = await Promise.allSettled(Array.from(pendingKeysRef.current).map((key) => saveItem(key, true)));
      if (!automatic && saveResults.some((result) => result.status === "rejected")) {
        throw new Error("One or more answers could not sync. Your browser backup is intact; reconnect and try again.");
      }
      await apiRequest("POST", `/api/interview-studio/sessions/${sessionId}/submit`);
      void queryClient.invalidateQueries({ queryKey: ["/api/interview-studio/sessions"] });
      localStorage.removeItem(studioBackupKey(sessionId));
      stopVoiceRecording();
      releaseStreams();
      setSubmitDialogOpen(false);
      await sessionQuery.refetch();
    } catch (error) {
      if (!automatic) {
        toast({
          title: "Interview was not submitted",
          description: error instanceof Error ? error.message : "Your answers remain saved. Please try again.",
          variant: "destructive",
        });
      }
    } finally {
      setActionBusy(null);
    }
  }, [actionBusy, queryClient, releaseStreams, saveItem, sessionId, sessionQuery, stopVoiceRecording, toast, voiceStatus]);

  useEffect(() => {
    if (remainingSeconds !== 0 || !isActiveSession || automaticSubmitRef.current) return;
    if (voiceStatus === "recording") {
      stopVoiceRecording();
      return;
    }
    if (voiceStatus === "uploading") return;
    automaticSubmitRef.current = true;
    void submitSession(true);
  }, [isActiveSession, remainingSeconds, stopVoiceRecording, submitSession, voiceStatus]);

  const deleteSession = async () => {
    if (!sessionId) return;
    setActionBusy("delete");
    try {
      const response = await apiRequest("DELETE", `/api/interview-studio/sessions/${sessionId}`);
      const deletionPending = response.status === 202;
      localStorage.removeItem(studioBackupKey(sessionId));
      localStorage.removeItem(consentBackupKey(sessionId));
      void queryClient.invalidateQueries({ queryKey: ["/api/interview-studio/sessions"] });
      releaseStreams();
      setDeleteDialogOpen(false);
      setLocation("/interview-studio");
      toast({
        title: deletionPending ? "Secure deletion started" : "Practice session deleted",
        description: deletionPending
          ? "An in-flight evaluator is being cancelled. The private session will disappear automatically once cancellation is acknowledged."
          : "The private practice and its saved responses were removed.",
      });
    } catch (error) {
      toast({
        title: "Session could not be deleted",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setActionBusy(null);
    }
  };

  if (authLoading || (user && statusQuery.isLoading) || (sessionId && sessionQuery.isLoading)) {
    return (
      <DashboardLayout role="learner" title="Interview studio" description="Job-relevant interview practice with evidence you control.">
        <LoadingPanel label="Preparing your interview studio…" />
      </DashboardLayout>
    );
  }

  if (!user) return null;

  if (!sessionId) {
    return (
      <DashboardLayout role="learner" title="Interview studio" description="Build stronger interview answers through private, structured practice.">
        <div className="space-y-6">
          <section className="overflow-hidden rounded-3xl bg-slate-950 text-white shadow-sm">
            <div className="grid gap-8 px-5 py-7 sm:px-8 sm:py-9 lg:grid-cols-[1.35fr_0.65fr] lg:items-center">
              <div>
                <Badge className="border-white/15 bg-white/10 text-white hover:bg-white/10">Private practice</Badge>
                <h1 className="mt-4 max-w-3xl text-3xl font-semibold tracking-tight sm:text-4xl">Turn what you know into clear, job-relevant evidence.</h1>
                <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
                  Rehearse realistic interview questions and hands-on tasks. Octamy can explain strengths and gaps, but it never promises selection or makes a hiring decision.
                </p>
                <div className="mt-6 flex flex-wrap gap-2">
                  <StatusDot active={status.aiEvaluationEnabled} label={status.aiEvaluationEnabled ? "AI feedback available" : "AI feedback not configured"} />
                  <StatusDot active={status.codeRunnerEnabled} label={status.codeRunnerEnabled ? "Sample code runner ready" : "Code runner not configured"} />
                  <StatusDot active={status.voiceTranscriptionEnabled} label={status.voiceTranscriptionEnabled ? "Voice transcription ready" : "Typed answers available"} />
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <LockKeyhole className="h-6 w-6 text-emerald-300" aria-hidden="true" />
                <p className="mt-4 font-semibold">You control the evidence</p>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  Practice sessions are private. Camera and screen previews stay in your browser and are not recorded. Recruiters cannot see this work.
                </p>
              </div>
            </div>
          </section>

          {statusQuery.isError && (
            <Alert className="border-amber-200 bg-amber-50 text-amber-950">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Interview Studio is not available yet</AlertTitle>
              <AlertDescription>The service could not confirm its capabilities. No session can be started until it is available.</AlertDescription>
            </Alert>
          )}

          {recentSessions.length > 0 && (
            <section aria-labelledby="recent-interviews-title">
              <div className="mb-3 flex items-end justify-between gap-3">
                <div>
                  <h2 id="recent-interviews-title" className="text-lg font-semibold tracking-tight text-slate-950">Recent sessions</h2>
                  <p className="mt-1 text-sm text-slate-600">Resume an unfinished practice or review private feedback.</p>
                </div>
                <span className="text-xs text-slate-500">Last {Math.min(5, recentSessions.length)} shown</span>
              </div>
              <Card className="overflow-hidden border-slate-200 shadow-sm">
                <CardContent className="divide-y divide-slate-100 p-0">
                  {recentSessions.slice(0, 5).map((recent, index) => {
                    const id = asString(recent.id);
                    const templateKey = asString(recent.templateKey);
                    const matchingTemplate = templates.find((template) => template.key === templateKey);
                    const recentStatus = asString(recent.status, "ready");
                    const completed = ["completed", "review_required", "expired", "cancelled"].includes(recentStatus);
                    const created = recent.createdAt ? new Date(String(recent.createdAt)) : null;
                    return (
                      <div key={id || index} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                        <div className="flex min-w-0 items-start gap-3">
                          <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-xl", completed ? "bg-emerald-50 text-emerald-700" : "bg-violet-50 text-violet-700")}>{completed ? <CheckCircle2 className="h-5 w-5" /> : <Bot className="h-5 w-5" />}</span>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-slate-900">{matchingTemplate?.title || titleCase(templateKey || "Interview practice")}</p>
                            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                              <span>{titleCase(recentStatus)}</span>
                              {created && Number.isFinite(created.getTime()) && <><span aria-hidden="true">·</span><span>{created.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}</span></>}
                              {typeof recent.overallScore === "number" && <><span aria-hidden="true">·</span><span>{Math.round(recent.overallScore)} rubric score</span></>}
                            </div>
                          </div>
                        </div>
                        <Button variant="outline" size="sm" asChild><Link href={`/interview-studio/${id}`}>{completed ? "View report" : "Resume"}<ChevronRight /></Link></Button>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            </section>
          )}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold tracking-tight text-slate-950">Choose a role practice</h2>
              <p className="mt-1 text-sm text-slate-600">Each session uses a versioned question and rubric blueprint.</p>
            </div>
            <div className="inline-flex items-center gap-2 text-xs font-medium text-slate-500">
              <ShieldCheck className="h-4 w-4 text-emerald-600" aria-hidden="true" />
              No face, emotion, accent, or gaze scoring
            </div>
          </div>

          {templatesQuery.isLoading ? (
            <LoadingPanel label="Loading interview practices…" />
          ) : templates.length ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {templates.map((template) => {
                return (
                  <Card key={`${template.id}-${template.version}`} className="flex h-full flex-col overflow-hidden border-slate-200 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md">
                    <CardHeader className="space-y-4 pb-4">
                      <div className="flex items-start justify-between gap-3">
                        <span className="grid h-11 w-11 place-items-center rounded-xl bg-violet-50 text-violet-700 ring-1 ring-violet-100">
                          <Bot className="h-5 w-5" aria-hidden="true" />
                        </span>
                        <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-600">{titleCase(template.difficulty)}</Badge>
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-violet-700">{template.targetRole}</p>
                        <CardTitle className="mt-1 text-xl leading-7 text-slate-950">{template.title}</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent className="flex flex-1 flex-col pt-0">
                      <p className="line-clamp-3 text-sm leading-6 text-slate-600">{template.description}</p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {template.skills.slice(0, 4).map((skill) => (
                          <span key={skill} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">{skill}</span>
                        ))}
                      </div>
                      <div className="mt-5 grid grid-cols-3 gap-2 border-y border-slate-100 py-4 text-center">
                        <div><p className="text-sm font-semibold text-slate-900">{template.itemCount}</p><p className="text-[11px] text-slate-500">Prompts</p></div>
                        <div><p className="text-sm font-semibold text-slate-900">{template.codingCount}</p><p className="text-[11px] text-slate-500">Code tasks</p></div>
                        <div><p className="text-sm font-semibold text-slate-900">{template.durationMinutes}m</p><p className="text-[11px] text-slate-500">Duration</p></div>
                      </div>
                      <Button
                        className="mt-5 w-full"
                        disabled={!status.practiceEnabled || !template.availableModes.includes("practice")}
                        onClick={() => {
                          setSelectedTemplate(template);
                          setConsent({
                            aiProcessing: false,
                            microphone: false,
                            camera: false,
                            screen: false,
                            consentVersion: status.consentVersion,
                          });
                          setPrivacyUnderstood(false);
                        }}
                      >
                        Start private practice
                        <ChevronRight className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card className="border-dashed border-slate-300 bg-white shadow-none">
              <CardContent className="py-14 text-center">
                <FileText className="mx-auto h-8 w-8 text-slate-400" aria-hidden="true" />
                <h3 className="mt-4 font-semibold text-slate-900">No interview practices are published</h3>
                <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-600">Templates will appear here only after their prompts, rubrics, and hands-on tasks have been reviewed.</p>
              </CardContent>
            </Card>
          )}

          <Card className="border-slate-200 bg-white shadow-none">
            <CardContent className="grid gap-5 p-5 sm:p-6 lg:grid-cols-3">
              <div className="flex gap-3"><LockKeyhole className="mt-0.5 h-5 w-5 shrink-0 text-slate-500" /><div><p className="text-sm font-semibold text-slate-900">Private by default</p><p className="mt-1 text-xs leading-5 text-slate-600">Practice is never recruiter-visible or presented as verified evidence.</p></div></div>
              <div className="flex gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-slate-500" /><div><p className="text-sm font-semibold text-slate-900">Evidence, not a verdict</p><p className="mt-1 text-xs leading-5 text-slate-600">Feedback is tied to a rubric and should be reviewed by a person.</p></div></div>
              <div className="flex gap-3"><Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-slate-500" /><div><p className="text-sm font-semibold text-slate-900">Verified mode is separate</p><p className="mt-1 text-xs leading-5 text-slate-600">{status.verifiedEnabled ? "Verified sessions are available only through an assigned workflow." : "Verified recruiter evidence is not enabled on this environment."}</p></div></div>
            </CardContent>
          </Card>
        </div>

        <Dialog open={Boolean(selectedTemplate)} onOpenChange={(open) => !open && setSelectedTemplate(null)}>
          <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto rounded-2xl border-slate-200 p-0">
            <DialogHeader className="border-b border-slate-200 px-5 py-5 text-left sm:px-6">
              <DialogTitle className="text-xl text-slate-950">Set up private practice</DialogTitle>
              <DialogDescription className="leading-6">Choose each capability separately. You can practise with typed answers without enabling devices.</DialogDescription>
            </DialogHeader>
            <div className="space-y-5 px-5 py-5 sm:px-6">
              <div className="rounded-xl bg-slate-50 p-4 ring-1 ring-slate-200">
                <p className="font-semibold text-slate-900">{selectedTemplate?.title}</p>
                <p className="mt-1 text-sm text-slate-600">{selectedTemplate?.durationMinutes} minutes · {selectedTemplate?.itemCount} prompts · Practice mode</p>
              </div>

              <div className="space-y-3">
                <ConsentOption
                  id="consent-ai"
                  checked={consent.aiProcessing}
                  disabled={!status.aiEvaluationEnabled}
                  onChange={(checked) => setConsent((current) => ({ ...current, aiProcessing: checked }))}
                  icon={Bot}
                  title="AI-assisted feedback"
                  description={status.aiEvaluationEnabled ? "Allow your typed answer or transcript to be evaluated against the published rubric." : "AI evaluation is not configured. No AI score will be invented."}
                />
                <ConsentOption
                  id="consent-microphone"
                  checked={consent.microphone}
                  onChange={(checked) => setConsent((current) => ({ ...current, microphone: checked }))}
                  icon={Mic}
                  title="Microphone"
                  description={status.voiceTranscriptionEnabled ? "With AI processing selected, use voice answers. Audio is sent for transcription and is not retained after processing." : "Use the microphone for a local readiness check. Voice transcription is not configured."}
                />
                <ConsentOption
                  id="consent-camera"
                  checked={consent.camera}
                  onChange={(checked) => setConsent((current) => ({ ...current, camera: checked }))}
                  icon={Camera}
                  title="Camera preview"
                  description="Check framing and readiness in your browser. Camera video is not recorded or uploaded."
                />
                <ConsentOption
                  id="consent-screen"
                  checked={consent.screen}
                  disabled={!selectedTemplate?.includesCoding}
                  onChange={(checked) => setConsent((current) => ({ ...current, screen: checked }))}
                  icon={MonitorUp}
                  title="Screen-share readiness"
                  description={selectedTemplate?.includesCoding ? "Optionally share a screen during coding practice. The screen is not recorded or uploaded." : "This practice does not include a coding task, so screen sharing stays off."}
                />
              </div>

              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                <Checkbox className="mt-0.5" checked={privacyUnderstood} onCheckedChange={(value) => setPrivacyUnderstood(value === true)} />
                <span>
                  <span className="block text-sm font-semibold text-emerald-950">I understand this is private practice</span>
                  <span className="mt-1 block text-xs leading-5 text-emerald-800">It is not a certification, hiring recommendation, or recruiter-visible verified interview.</span>
                </span>
              </label>
              <p className="text-xs text-slate-500">Consent record: {status.consentVersion}. You can delete the draft session before submitting it.</p>
            </div>
            <DialogFooter className="border-t border-slate-200 px-5 py-4 sm:px-6">
              <Button variant="outline" onClick={() => setSelectedTemplate(null)}>Cancel</Button>
              <Button disabled={!privacyUnderstood || actionBusy === "create" || !status.practiceEnabled} onClick={createSession}>
                {actionBusy === "create" && <Loader2 className="h-4 w-4 animate-spin" />}
                Create practice session
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </DashboardLayout>
    );
  }

  if (sessionQuery.isError || !Object.keys(session).length) {
    return (
      <DashboardLayout role="learner" title="Interview session" breadcrumbs={[{ label: "Interview studio", href: "/interview-studio" }, { label: "Session" }]}>
        <Card className="border-slate-200">
          <CardContent className="py-14 text-center">
            <AlertCircle className="mx-auto h-8 w-8 text-amber-600" />
            <h1 className="mt-4 text-xl font-semibold text-slate-950">This session could not be opened</h1>
            <p className="mt-2 text-sm text-slate-600">It may have been deleted, expired, or belong to another account.</p>
            <Button asChild className="mt-5"><Link href="/interview-studio">Back to Interview Studio</Link></Button>
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  if (isDraftSession) {
    return (
      <DashboardLayout role="learner" title="Device check" description="Review consent and check only the capabilities you chose." breadcrumbs={[{ label: "Interview studio", href: "/interview-studio" }, { label: sessionTemplate.title }]}>
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-5">
            <Card className="overflow-hidden border-slate-200 shadow-sm">
              <CardHeader className="border-b border-slate-100 bg-white">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div><p className="text-xs font-semibold uppercase tracking-[0.12em] text-violet-700">Private practice</p><CardTitle className="mt-1 text-2xl">{sessionTemplate.title}</CardTitle><p className="mt-2 text-sm text-slate-600">{sessionTemplate.targetRole} · {sessionTemplate.durationMinutes} minutes · {totalItemCount} prompts</p></div>
                  <Badge variant="outline" className="w-fit border-emerald-200 bg-emerald-50 text-emerald-700">Not recruiter-visible</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-6 p-5 sm:p-6">
                {(sessionConsent.camera || sessionConsent.microphone) && (
                  <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_240px]">
                    <div className="rounded-2xl border border-slate-200 bg-slate-950 p-2">
                      <div className="relative aspect-video overflow-hidden rounded-xl bg-slate-900">
                        <video
                          ref={cameraVideoRef}
                          muted
                          playsInline
                          autoPlay
                          className={cn("h-full w-full object-cover [transform:scaleX(-1)]", cameraStatus !== "active" && "opacity-0")}
                          aria-label="Private camera preview"
                        />
                        {cameraStatus !== "active" && <div className="absolute inset-0 grid place-items-center text-center text-slate-400"><div><VideoOff className="mx-auto h-7 w-7" /><p className="mt-2 text-xs">Preview is off</p></div></div>}
                        <span className="absolute bottom-2 left-2 rounded-full bg-black/65 px-2.5 py-1 text-[11px] font-medium text-white">Local preview · not recorded</span>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <CapabilityState icon={Camera} label="Camera" active={cameraStatus === "active"} optional={!sessionConsent.camera} />
                      <CapabilityState icon={Mic} label="Microphone" active={microphoneActive} optional={!sessionConsent.microphone} />
                      <Button variant="outline" className="w-full" disabled={cameraStatus === "requesting" || (!sessionConsent.camera && !sessionConsent.microphone)} onClick={enableDevices}>
                        {cameraStatus === "requesting" ? <Loader2 className="animate-spin" /> : <Video />}
                        Check selected devices
                      </Button>
                    </div>
                  </div>
                )}

                {hasCoding && sessionConsent.screen && (
                  <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-700"><MonitorUp className="h-5 w-5" /></span><div><p className="text-sm font-semibold text-slate-900">Screen-share readiness</p><p className="mt-1 text-xs leading-5 text-slate-600">A browser indicator remains visible while sharing. Octamy does not record or upload your screen.</p></div></div>
                    <Button variant="outline" disabled={screenStatus === "requesting"} onClick={enableScreenShare}>{screenStatus === "requesting" ? <Loader2 className="animate-spin" /> : <MonitorUp />}{screenStatus === "active" ? "Change shared screen" : "Share a screen"}</Button>
                  </div>
                )}

                {deviceError && <Alert className="border-amber-200 bg-amber-50 text-amber-950"><AlertCircle className="h-4 w-4" /><AlertTitle>Device check</AlertTitle><AlertDescription>{deviceError}</AlertDescription></Alert>}

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-start gap-3"><Info className="mt-0.5 h-5 w-5 shrink-0 text-slate-500" /><div><p className="text-sm font-semibold text-slate-900">What Octamy evaluates</p><p className="mt-1 text-xs leading-5 text-slate-600">Only your submitted answer, code, sample-test outcomes, and the versioned rubric. Camera appearance, emotion, gaze, accent, and background are not scored.</p></div></div>
                </div>
              </CardContent>
            </Card>
          </div>

          <aside className="space-y-4 xl:sticky xl:top-24 xl:self-start">
            <Card className="border-slate-200 shadow-sm">
              <CardHeader><CardTitle className="text-base">Before you begin</CardTitle></CardHeader>
              <CardContent className="space-y-3 pt-0">
                <ChecklistRow complete label={`${totalItemCount} prompts will be revealed one at a time`} />
                <ChecklistRow complete={isOnline} label={isOnline ? "Network connected" : "Offline backup active"} />
                <ChecklistRow complete={!sessionConsent.camera || cameraStatus === "active"} label={sessionConsent.camera ? "Camera checked" : "Camera not selected"} muted={!sessionConsent.camera} />
                <ChecklistRow complete={!sessionConsent.microphone || microphoneActive} label={sessionConsent.microphone ? "Microphone checked" : "Microphone not selected"} muted={!sessionConsent.microphone} />
                <ChecklistRow complete={!sessionConsent.screen || screenStatus === "active"} label={sessionConsent.screen ? "Screen share checked" : "Screen not selected"} muted={!sessionConsent.screen} />
                <Button className="mt-3 w-full" disabled={actionBusy === "start" || !isOnline || totalItemCount === 0} onClick={startSession}>{actionBusy === "start" ? <Loader2 className="animate-spin" /> : <Play />}Start practice</Button>
                <p className="text-center text-[11px] leading-4 text-slate-500">Starting confirms the consent choices recorded for this session.</p>
              </CardContent>
            </Card>
            <Button variant="ghost" className="w-full text-rose-700 hover:bg-rose-50 hover:text-rose-800" onClick={() => setDeleteDialogOpen(true)}><Trash2 />Delete draft session</Button>
          </aside>
        </div>
        <DeleteDialog open={deleteDialogOpen} busy={actionBusy === "delete"} onOpenChange={setDeleteDialogOpen} onDelete={deleteSession} />
      </DashboardLayout>
    );
  }

  if (isResultSession) {
    const report = asRecord(session.report || session.evaluation || session.result);
    const overallScore = typeof report.overallScore === "number"
      ? report.overallScore
      : typeof report.score === "number"
        ? report.score
        : typeof session.overallScore === "number"
          ? session.overallScore
          : typeof session.score === "number"
            ? session.score
            : null;
    const reportStatus = asString(report.status || session.evaluationStatus);
    const responseFeedback = asArray(session.responses).map((response) => {
      const record = asRecord(response);
      const evaluation = asRecord(record.evaluation);
      return Object.keys(evaluation).length ? { ...evaluation, itemKey: record.itemKey } : null;
    }).filter(Boolean);
    const itemFeedback = asArray(report.items || report.itemFeedback || session.feedback || responseFeedback);
    return (
      <DashboardLayout role="learner" title="Practice report" breadcrumbs={[{ label: "Interview studio", href: "/interview-studio" }, { label: sessionTemplate.title }]}>
        <div className="mx-auto max-w-5xl space-y-6">
          <section className="overflow-hidden rounded-3xl bg-slate-950 px-5 py-7 text-white sm:px-8 sm:py-9">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
              <div><Badge className="border-white/15 bg-white/10 text-white hover:bg-white/10">Private practice report</Badge><h1 className="mt-4 text-3xl font-semibold tracking-tight">{sessionTemplate.title}</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">Use this report to improve your next answer. It is not a certification, selection prediction, or recruiter-visible record.</p></div>
              {overallScore !== null ? <div className="rounded-2xl border border-white/10 bg-white/5 px-6 py-4 text-center"><p className="text-4xl font-semibold">{Math.round(overallScore)}</p><p className="mt-1 text-xs text-slate-300">Rubric score</p></div> : <LockKeyhole className="h-8 w-8 text-emerald-300" />}
            </div>
          </section>

          {!status.aiEvaluationEnabled || !sessionConsent.aiProcessing ? (
            <Alert className="border-blue-200 bg-blue-50 text-blue-950"><Info className="h-4 w-4" /><AlertTitle>No AI feedback was generated</AlertTitle><AlertDescription>{!sessionConsent.aiProcessing ? "You did not consent to AI processing for this session. Your submitted answers remain available without invented feedback." : "AI evaluation is not configured on this environment. Deterministic coding results can still appear when the isolated runner is available."}</AlertDescription></Alert>
          ) : !Object.keys(report).length || ["pending", "queued", "processing", "in_progress"].includes(reportStatus) ? (
            <Alert className="border-violet-200 bg-violet-50 text-violet-950"><Loader2 className="h-4 w-4 animate-spin" /><AlertTitle>Rubric feedback is being prepared</AlertTitle><AlertDescription>Your submitted evidence is saved. Refresh later to see feedback; Octamy will not infer a result while evaluation is incomplete.</AlertDescription></Alert>
          ) : ["failed", "review_required"].includes(reportStatus) && asArray(report.humanReviewReasons).length > 0 ? (
            <Alert className="border-amber-200 bg-amber-50 text-amber-950"><AlertCircle className="h-4 w-4" /><AlertTitle>Feedback is incomplete</AlertTitle><AlertDescription>{asArray(report.humanReviewReasons).map(String).join(" ")}</AlertDescription></Alert>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-3">
            <MetricCard label="Prompts" value={String(totalItemCount)} helper="Server-sequenced session" icon={FileText} />
            <MetricCard label="Answered" value={String(items.filter((item) => hasMeaningfulResponse(item, drafts[item.key])).length || asNumber(session.answeredCount, 0))} helper="Submitted responses" icon={CheckCircle2} />
            <MetricCard label="Visibility" value="Private" helper="Not shared with recruiters" icon={LockKeyhole} />
          </div>

          {(asString(report.summary) || asArray(report.strengths).length > 0 || asArray(report.improvementAreas).length > 0) && (
            <Card className="border-slate-200 shadow-sm">
              <CardHeader><CardTitle>Overall feedback</CardTitle></CardHeader>
              <CardContent className="space-y-4 pt-0">
                {asString(report.summary) && <p className="text-sm leading-6 text-slate-700">{asString(report.summary)}</p>}
                <div className="grid gap-4 md:grid-cols-2">
                  {asArray(report.strengths).length > 0 && <FeedbackList title="Evidence demonstrated" items={asArray(report.strengths)} tone="success" />}
                  {asArray(report.improvementAreas).length > 0 && <FeedbackList title="Practise next" items={asArray(report.improvementAreas)} tone="warning" />}
                </div>
              </CardContent>
            </Card>
          )}

          {itemFeedback.length > 0 && (
            <Card className="border-slate-200 shadow-sm">
              <CardHeader><CardTitle>Prompt-by-prompt feedback</CardTitle></CardHeader>
              <CardContent className="space-y-4 pt-0">
                {itemFeedback.map((value, index) => {
                  const feedback = asRecord(value);
                  return <div key={asString(feedback.itemKey, String(index))} className="rounded-2xl border border-slate-200 p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Prompt {index + 1}</p><p className="mt-1 font-semibold text-slate-900">{asString(feedback.title, items[index]?.title || "Interview response")}</p></div>{typeof feedback.score === "number" && <Badge variant="outline">{Math.round(feedback.score)} / 100</Badge>}</div><p className="mt-3 text-sm leading-6 text-slate-600">{asString(feedback.feedback || feedback.summary, asArray(feedback.criterionScores).length ? "Feedback is grounded in the rubric evidence below." : "No written feedback was returned for this prompt.")}</p>{asArray(feedback.strengths).length > 0 && <p className="mt-3 text-xs text-emerald-700"><strong>Evidence:</strong> {asArray(feedback.strengths).map(String).join(" · ")}</p>}{asArray(feedback.improvements || feedback.improvementAreas).length > 0 && <p className="mt-2 text-xs text-amber-700"><strong>Try next:</strong> {asArray(feedback.improvements || feedback.improvementAreas).map(String).join(" · ")}</p>}</div>;
                })}
              </CardContent>
            </Card>
          )}

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
            <Button variant="outline" asChild><Link href="/interview-studio"><ArrowLeft />Back to Interview Studio</Link></Button>
            <div className="flex flex-col gap-2 sm:flex-row"><Button variant="outline" onClick={() => window.location.reload()}><RotateCcw />Refresh report</Button><Button variant="ghost" className="text-rose-700 hover:bg-rose-50" onClick={() => setDeleteDialogOpen(true)}><Trash2 />Delete session</Button></div>
          </div>
        </div>
        <DeleteDialog open={deleteDialogOpen} busy={actionBusy === "delete"} onOpenChange={setDeleteDialogOpen} onDelete={deleteSession} />
      </DashboardLayout>
    );
  }

  const draft = currentItem ? drafts[currentItem.key] : undefined;
  const answeredCount = items.filter((item) => {
    return hasMeaningfulResponse(item, drafts[item.key]);
  }).length;
  const currentRunPayload = currentItem ? asRecord(runResults[currentItem.key]) : {};
  const currentRunResult = asRecord(currentRunPayload.result || currentRunPayload);
  const currentRunTests = asArray(currentRunResult.results || currentRunResult.testResults || currentRunResult.items || currentRunResult.cases)
    .filter((value) => asString(asRecord(value).visibility) !== "hidden");

  return (
    <DashboardLayout role="learner" title={sessionTemplate.title} breadcrumbs={[{ label: "Interview studio", href: "/interview-studio" }, { label: "Practice in progress" }]} actions={<Button variant="outline" onClick={() => setSubmitDialogOpen(true)}>Submit practice</Button>}>
      <div className="space-y-4">
        <div className="sticky top-[72px] z-20 -mx-4 border-y border-slate-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Private practice</Badge>
              <DeviceIndicator active={cameraStatus === "active"} icon={cameraStatus === "active" ? Camera : VideoOff} label={cameraStatus === "active" ? "Camera preview on" : "Camera off"} />
              <DeviceIndicator active={microphoneActive} icon={microphoneActive ? Mic : MicOff} label={microphoneActive ? "Microphone on" : "Microphone off"} />
              {hasCoding && <DeviceIndicator active={screenStatus === "active"} icon={MonitorUp} label={screenStatus === "active" ? "Screen shared" : "Screen not shared"} />}
              {!isOnline && <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800"><WifiOff className="h-3.5 w-3.5" />Offline backup</span>}
            </div>
            <div className="flex items-center gap-3">
              <SaveIndicator status={saveStatus} pending={pendingKeys.size} />
              {remainingSeconds !== null && <span className={cn("inline-flex items-center gap-2 rounded-lg px-3 py-2 font-mono text-sm font-semibold", remainingSeconds <= 300 ? "bg-rose-50 text-rose-700" : "bg-slate-100 text-slate-700")}><Clock3 className="h-4 w-4" />{formatClock(remainingSeconds)}</span>}
            </div>
          </div>
        </div>

        {!isOnline && <Alert className="border-amber-200 bg-amber-50 text-amber-950"><WifiOff className="h-4 w-4" /><AlertTitle>You are offline</AlertTitle><AlertDescription>Keep working. Answers are backed up in this browser and will sync when the connection returns. Do not clear site data or switch devices.</AlertDescription></Alert>}

        <div className="grid gap-5 xl:grid-cols-[260px_minmax(0,1fr)_260px]">
          <aside className="order-2 xl:order-1">
            <Card className="border-slate-200 shadow-sm xl:sticky xl:top-40">
              <CardHeader className="pb-3"><div className="flex items-center justify-between"><CardTitle className="text-base">Questions</CardTitle><span className="text-xs font-medium text-slate-500">{answeredCount}/{totalItemCount} answered</span></div></CardHeader>
              <CardContent className="pt-0">
                <div className="grid grid-cols-5 gap-2 sm:grid-cols-8 xl:grid-cols-4" role="navigation" aria-label="Interview question navigator">
                  {items.map((item) => {
                    const answer = drafts[item.key];
                    const answered = hasMeaningfulResponse(item, answer);
                    const active = true;
                    return <button key={item.key} type="button" disabled aria-label={`Question ${currentIndex + 1}${answered ? ", answered" : ""}`} aria-current={active ? "step" : undefined} className={cn("grid h-11 min-w-11 place-items-center rounded-xl border text-sm font-semibold outline-none transition focus-visible:ring-2 focus-visible:ring-slate-900", active ? "border-slate-950 bg-slate-950 text-white" : answered ? "border-emerald-200 bg-emerald-50 text-emerald-800 hover:border-emerald-300" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50")}>{currentIndex + 1}</button>;
                  })}
                </div>
                <div className="mt-4 flex items-center gap-4 text-[11px] text-slate-500"><span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" />Answered</span><span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-slate-300" />Not answered</span></div>
              </CardContent>
            </Card>
          </aside>

          <main className="order-1 min-w-0 xl:order-2">
            {currentItem ? (
              <Card className="overflow-hidden border-slate-200 shadow-sm">
                <CardHeader className="border-b border-slate-100 bg-white pb-5">
                  <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2"><Badge variant="outline" className={isCodingItem(currentItem) ? "border-blue-200 bg-blue-50 text-blue-700" : "border-violet-200 bg-violet-50 text-violet-700"}>{isCodingItem(currentItem) ? <><Code2 className="mr-1 h-3 w-3" />Hands-on task</> : <><Bot className="mr-1 h-3 w-3" />Interview prompt</>}</Badge><span className="text-xs font-medium text-slate-500">Question {currentIndex + 1} of {totalItemCount}</span></div>{currentItem.timeLimitSeconds && <span className="text-xs text-slate-500">Suggested: {Math.ceil(currentItem.timeLimitSeconds / 60)} min</span>}</div>
                  <CardTitle className="mt-4 text-xl leading-7 sm:text-2xl">{currentItem.title}</CardTitle>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{currentItem.prompt}</p>
                  {currentItem.description && <p className="mt-3 rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-600">{currentItem.description}</p>}
                </CardHeader>
                <CardContent className="space-y-5 p-5 sm:p-6">
                  {isCodingItem(currentItem) ? (
                    <>
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                        <div className="w-full sm:w-52"><Label htmlFor="code-language" className="text-sm font-semibold">Language</Label><Select value={draft?.language || currentItem.allowedLanguages[0]} onValueChange={(language) => updateDraft(currentItem.key, { language })}><SelectTrigger id="code-language" className="mt-2 h-11"><SelectValue /></SelectTrigger><SelectContent>{currentItem.allowedLanguages.map((language) => <SelectItem key={language} value={language}>{titleCase(language)}</SelectItem>)}</SelectContent></Select></div>
                        {sessionConsent.screen && <Button variant="outline" onClick={enableScreenShare} disabled={screenStatus === "requesting"}>{screenStatus === "requesting" ? <Loader2 className="animate-spin" /> : <MonitorUp />}{screenStatus === "active" ? "Screen shared" : "Share screen"}</Button>}
                      </div>
                      <div><Label htmlFor={`code-${currentItem.key}`} className="text-sm font-semibold">Your solution</Label><Textarea id={`code-${currentItem.key}`} spellCheck={false} autoCapitalize="off" autoCorrect="off" value={draft?.code || ""} onChange={(event) => updateDraft(currentItem.key, { code: event.target.value })} className="mt-2 min-h-[340px] resize-y rounded-xl border-slate-300 bg-slate-950 p-4 font-mono text-[13px] leading-6 text-slate-100 caret-white focus-visible:ring-blue-500" aria-describedby={`code-help-${currentItem.key}`} /><p id={`code-help-${currentItem.key}`} className="mt-2 text-xs text-slate-500">Write a complete solution. Sample tests are visible; final evaluation can include hidden tests.</p></div>

                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><div className="flex items-center justify-between gap-3"><p className="text-sm font-semibold text-slate-900">Visible sample cases</p><span className="text-right text-xs text-slate-500">{currentItem.sampleTestCases.length} visible</span></div>{currentItem.sampleTestCases.length ? <div className="mt-3 space-y-3">{currentItem.sampleTestCases.map((test, index) => <div key={test.id || index} className="rounded-xl border border-slate-200 bg-white p-3"><p className="text-xs font-semibold text-slate-800">{test.name || `Sample ${index + 1}`}</p>{test.description && <p className="mt-1 text-xs text-slate-500">{test.description}</p>}<div className="mt-3 grid gap-3 sm:grid-cols-2"><div><p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Input</p><pre className="mt-1 overflow-x-auto whitespace-pre-wrap rounded-lg bg-slate-950 p-2.5 text-xs text-slate-100">{displayTestValue(test.input)}</pre></div><div><p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Expected</p><pre className="mt-1 overflow-x-auto whitespace-pre-wrap rounded-lg bg-slate-950 p-2.5 text-xs text-slate-100">{displayTestValue(test.expectedOutput)}</pre></div></div></div>)}</div> : <p className="mt-3 text-xs leading-5 text-slate-600">This task does not publish sample cases. Your code can still be saved for review.</p>}</div>

                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><Button onClick={runSamples} disabled={!status.codeRunnerEnabled || runningItemKey === currentItem.key || !draft?.code.trim() || !isOnline}>{runningItemKey === currentItem.key ? <Loader2 className="animate-spin" /> : <Play />}{status.codeRunnerEnabled ? "Run visible samples" : "Code runner not configured"}</Button><p className="text-xs text-slate-500">Running samples does not submit the interview.</p></div>

                      {currentRunTests.length > 0 && <div className="space-y-2" aria-live="polite"><p className="text-sm font-semibold text-slate-900">Latest sample run</p>{currentRunTests.map((value, index) => { const result = asRecord(value); const passed = asBoolean(result.passed || result.success); return <div key={index} className={cn("flex items-start gap-3 rounded-xl border p-3", passed ? "border-emerald-200 bg-emerald-50" : "border-rose-200 bg-rose-50")}>{passed ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-700" />}<div><p className={cn("text-sm font-semibold", passed ? "text-emerald-900" : "text-rose-900")}>{asString(result.name, `Sample ${index + 1}`)} · {passed ? "Passed" : "Did not pass"}</p>{asString(result.message || result.error) && <p className="mt-1 whitespace-pre-wrap text-xs leading-5 text-slate-700">{asString(result.message || result.error)}</p>}</div></div>; })}</div>}
                    </>
                  ) : (
                    <>
                      <div>
                        <div className="flex items-center justify-between gap-3">
                          <Label htmlFor={`answer-${currentItem.key}`} className="text-sm font-semibold">Your answer</Label>
                          <span className={cn(
                            "text-xs font-medium",
                            currentItem.maximumWords && wordCount(draft?.responseText || "") > currentItem.maximumWords
                              ? "text-rose-700"
                              : "text-slate-500",
                          )}>
                            {wordCount(draft?.responseText || "")} words
                            {currentItem.minimumWords || currentItem.maximumWords
                              ? ` · target ${currentItem.minimumWords || 0}–${currentItem.maximumWords || "∞"}`
                              : ""}
                          </span>
                        </div>
                        <Textarea id={`answer-${currentItem.key}`} value={draft?.responseText || ""} onChange={(event) => updateDraft(currentItem.key, { responseText: event.target.value })} placeholder="Structure your answer with the situation, your decisions, the actions you took, and measurable outcomes…" className="mt-2 min-h-[280px] resize-y rounded-xl border-slate-300 p-4 text-[15px] leading-7 focus-visible:ring-violet-500" />
                      </div>
                      {sessionConsent.microphone && <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-semibold text-slate-900">Answer by voice</p><p className="mt-1 text-xs leading-5 text-slate-600">Up to 2 minutes. Raw audio is transient and is not retained after transcription. You can edit the transcript before saving.</p></div>{voiceStatus === "recording" ? <Button variant="destructive" onClick={stopVoiceRecording}><Square />Stop · {formatClock(voiceSeconds)}</Button> : <Button variant="outline" disabled={!status.voiceTranscriptionEnabled || !sessionConsent.aiProcessing || !microphoneActive || voiceStatus === "uploading"} onClick={startVoiceRecording}>{voiceStatus === "uploading" ? <Loader2 className="animate-spin" /> : <Mic />}{!status.voiceTranscriptionEnabled ? "Transcription unavailable" : !sessionConsent.aiProcessing ? "AI consent not selected" : voiceStatus === "uploading" ? "Transcribing…" : "Record answer"}</Button>}</div>{!microphoneActive && status.voiceTranscriptionEnabled && sessionConsent.aiProcessing && <Button variant="link" className="mt-2 h-auto p-0 text-xs" onClick={enableDevices}>Enable the selected microphone first</Button>}</div>}
                    </>
                  )}

                  <div className="flex flex-col gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-between"><Button variant="outline" disabled><ArrowLeft />Previous unavailable</Button><div className="text-center text-xs text-slate-500">{pendingKeys.has(currentItem.key) ? "Changes pending sync" : "Current answer saved"}</div>{currentIndex < totalItemCount - 1 ? <Button disabled={voiceStatus === "recording" || actionBusy === "reveal" || !hasMeaningfulResponse(currentItem, draft)} onClick={() => void navigateItem(currentIndex + 1)}>{actionBusy === "reveal" ? <Loader2 className="animate-spin" /> : null}Next<ArrowRight /></Button> : <Button onClick={() => setSubmitDialogOpen(true)}>Review & submit<Check /></Button>}</div>
                </CardContent>
              </Card>
            ) : <Card><CardContent className="py-14 text-center text-sm text-slate-600">This interview blueprint has no questions.</CardContent></Card>}
          </main>

          <aside className="order-3 space-y-4">
            <Card className="border-slate-200 shadow-sm xl:sticky xl:top-40">
              <CardHeader className="pb-3"><CardTitle className="text-base">Practice integrity</CardTitle></CardHeader>
              <CardContent className="space-y-4 pt-0">
                {sessionConsent.camera && (
                  <div className="relative aspect-video overflow-hidden rounded-xl bg-slate-950">
                    <video ref={cameraVideoRef} muted playsInline autoPlay className={cn("h-full w-full object-cover [transform:scaleX(-1)]", cameraStatus !== "active" && "opacity-0")} aria-label="Private camera preview" />
                    {cameraStatus !== "active" && <div className="absolute inset-0 grid place-items-center text-center text-slate-400"><div><VideoOff className="mx-auto h-5 w-5" /><p className="mt-1 text-[10px]">Preview off</p></div></div>}
                    <span className="absolute bottom-1.5 left-1.5 rounded-full bg-black/65 px-2 py-0.5 text-[9px] font-medium text-white">Not recorded</span>
                  </div>
                )}
                <div className="space-y-3"><CapabilityState icon={Camera} label="Camera preview" active={cameraStatus === "active"} optional={!sessionConsent.camera} /><CapabilityState icon={Mic} label="Microphone" active={microphoneActive} optional={!sessionConsent.microphone} />{hasCoding && <CapabilityState icon={MonitorUp} label="Screen share" active={screenStatus === "active"} optional={!sessionConsent.screen} />}</div>
                {(sessionConsent.camera || sessionConsent.microphone) && cameraStatus !== "active" && !microphoneActive && <Button variant="outline" className="w-full" onClick={enableDevices}>Check devices</Button>}
                <div className="border-t border-slate-100 pt-4"><p className="text-xs leading-5 text-slate-600"><strong className="text-slate-800">No surveillance scoring.</strong> Device state is never used to infer emotion, personality, honesty, or employability.</p></div>
                <Button variant="outline" className="w-full" onClick={() => setSubmitDialogOpen(true)}>Submit practice</Button>
              </CardContent>
            </Card>
          </aside>
        </div>
      </div>

      <AlertDialog open={submitDialogOpen} onOpenChange={setSubmitDialogOpen}>
        <AlertDialogContent className="rounded-2xl border-slate-200">
          <AlertDialogHeader><AlertDialogTitle>Submit this practice session?</AlertDialogTitle><AlertDialogDescription className="leading-6">You answered {answeredCount} of {totalItemCount} prompts. Submitted practice stays private. You cannot edit answers after submission.</AlertDialogDescription></AlertDialogHeader>
          {answeredCount < totalItemCount && <Alert className="border-amber-200 bg-amber-50 text-amber-950"><AlertCircle className="h-4 w-4" /><AlertTitle>Some prompts are unanswered</AlertTitle><AlertDescription>You can submit now, or return and complete them.</AlertDescription></Alert>}
        {(voiceStatus === "recording" || voiceStatus === "uploading") && <p className="text-sm font-medium text-amber-700">Finish the voice answer and review its transcript before submitting.</p>}
          <AlertDialogFooter><AlertDialogCancel>Keep working</AlertDialogCancel><AlertDialogAction disabled={actionBusy === "submit" || !isOnline || voiceStatus === "recording" || voiceStatus === "uploading"} onClick={(event) => { event.preventDefault(); void submitSession(false); }}>{actionBusy === "submit" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Submit private practice</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}

function ConsentOption({ id, checked, disabled, onChange, icon: Icon, title, description }: {
  id: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
  icon: typeof Camera;
  title: string;
  description: string;
}) {
  return (
    <label htmlFor={id} className={cn("flex items-start gap-3 rounded-xl border p-4 transition", checked ? "border-violet-300 bg-violet-50" : "border-slate-200 bg-white", disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:border-slate-300")}>
      <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-xl", checked ? "bg-violet-100 text-violet-700" : "bg-slate-100 text-slate-500")}><Icon className="h-5 w-5" /></span>
      <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-slate-900">{title}</span><span className="mt-1 block text-xs leading-5 text-slate-600">{description}</span></span>
      <Checkbox id={id} checked={checked} disabled={disabled} onCheckedChange={(value) => onChange(value === true)} className="mt-1" />
    </label>
  );
}

function CapabilityState({ icon: Icon, label, active, optional = false }: { icon: typeof Camera; label: string; active: boolean; optional?: boolean }) {
  return <div className="flex min-h-10 items-center gap-3"><span className={cn("grid h-9 w-9 place-items-center rounded-lg", active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500")}><Icon className="h-4 w-4" /></span><span className="flex-1 text-sm font-medium text-slate-700">{label}</span><span className={cn("text-xs font-semibold", active ? "text-emerald-700" : "text-slate-400")}>{active ? "Ready" : optional ? "Not selected" : "Off"}</span></div>;
}

function ChecklistRow({ complete, label, muted = false }: { complete: boolean; label: string; muted?: boolean }) {
  return <div className={cn("flex min-h-9 items-center gap-2.5 text-sm", muted ? "text-slate-400" : "text-slate-700")}>{complete ? <CheckCircle2 className={cn("h-4 w-4 shrink-0", muted ? "text-slate-300" : "text-emerald-600")} /> : <Circle className="h-4 w-4 shrink-0 text-slate-300" />}<span>{label}</span></div>;
}

function DeviceIndicator({ active, icon: Icon, label }: { active: boolean; icon: typeof Camera; label: string }) {
  return <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold", active ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-500")}><Icon className="h-3.5 w-3.5" />{label}</span>;
}

function SaveIndicator({ status, pending }: { status: SaveStatus; pending: number }) {
  const content = status === "saving" ? { icon: Loader2, text: "Saving", className: "text-blue-700", spin: true }
    : status === "offline" ? { icon: WifiOff, text: "Saved on device", className: "text-amber-700", spin: false }
      : status === "error" ? { icon: AlertCircle, text: "Sync paused", className: "text-rose-700", spin: false }
        : pending > 0 ? { icon: Save, text: `${pending} pending`, className: "text-slate-500", spin: false }
          : { icon: Check, text: "Saved", className: "text-emerald-700", spin: false };
  const Icon = content.icon;
  return <span className={cn("inline-flex items-center gap-1.5 text-xs font-semibold", content.className)} aria-live="polite"><Icon className={cn("h-3.5 w-3.5", content.spin && "animate-spin")} />{content.text}</span>;
}

function MetricCard({ label, value, helper, icon: Icon }: { label: string; value: string; helper: string; icon: typeof Camera }) {
  return <Card className="border-slate-200 shadow-sm"><CardContent className="flex items-center gap-4 p-5"><span className="grid h-11 w-11 place-items-center rounded-xl bg-slate-100 text-slate-600"><Icon className="h-5 w-5" /></span><div><p className="text-xs font-medium text-slate-500">{label}</p><p className="mt-0.5 text-xl font-semibold text-slate-950">{value}</p><p className="mt-0.5 text-[11px] text-slate-500">{helper}</p></div></CardContent></Card>;
}

function FeedbackList({ title, items, tone }: { title: string; items: unknown[]; tone: "success" | "warning" }) {
  const success = tone === "success";
  return <div className={cn("rounded-2xl border p-4", success ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50")}><p className={cn("text-sm font-semibold", success ? "text-emerald-950" : "text-amber-950")}>{title}</p><ul className={cn("mt-2 space-y-2 text-xs leading-5", success ? "text-emerald-900" : "text-amber-900")}>{items.map((item, index) => <li key={index} className="flex gap-2">{success ? <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" /> : <ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0" />}<span>{String(item)}</span></li>)}</ul></div>;
}

function DeleteDialog({ open, busy, onOpenChange, onDelete }: { open: boolean; busy: boolean; onOpenChange: (open: boolean) => void; onDelete: () => void }) {
  return <AlertDialog open={open} onOpenChange={onOpenChange}><AlertDialogContent className="rounded-2xl border-slate-200"><AlertDialogHeader><AlertDialogTitle>Delete this interview session?</AlertDialogTitle><AlertDialogDescription>This removes the session and its saved responses from your account. This action cannot be undone.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction className="border-rose-700 bg-rose-700 hover:bg-rose-800" disabled={busy} onClick={(event) => { event.preventDefault(); onDelete(); }}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Delete session</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>;
}
