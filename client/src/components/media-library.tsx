import { useId, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  Clipboard,
  FileText,
  Film,
  ExternalLink,
  Image as ImageIcon,
  Info,
  Loader2,
  Search,
  Trash2,
  UploadCloud,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type MediaKind = "image" | "video" | "document";

export type MediaAsset = {
  id: number;
  originalName: string;
  mimeType: string;
  kind: MediaKind;
  url: string;
  storageProvider: "local" | "cloudinary";
  storageKey: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  altText: string | null;
  caption: string | null;
  createdAt: string;
  updatedAt: string;
  usage?: Array<{ type: string; id: number; label: string }>;
};

type MediaLibraryProps = {
  allowedKinds?: MediaKind[];
  onSelect?: (asset: MediaAsset) => void;
  selectedUrl?: string | null;
  compact?: boolean;
};

const kindMeta: Record<MediaKind, { label: string; accept: string; icon: typeof ImageIcon; limit: string }> = {
  image: { label: "Images", accept: "image/jpeg,image/png,image/webp,image/gif", icon: ImageIcon, limit: "10 MB" },
  video: { label: "Videos", accept: "video/mp4,video/webm,video/quicktime", icon: Film, limit: "500 MB" },
  document: { label: "PDFs", accept: "application/pdf", icon: FileText, limit: "50 MB" },
};

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function absoluteUrl(url: string) {
  if (typeof window === "undefined") return url;
  return new URL(url, window.location.origin).toString();
}

function AssetPreview({ asset, className }: { asset: MediaAsset; className?: string }) {
  if (asset.kind === "image") {
    return <img src={asset.url} alt={asset.altText || asset.originalName} className={cn("h-full w-full object-cover", className)} />;
  }
  if (asset.kind === "video") {
    return (
      <div className={cn("grid h-full w-full place-items-center bg-slate-950", className)}>
        <Film className="h-10 w-10 text-slate-300" />
      </div>
    );
  }
  return (
    <div className={cn("grid h-full w-full place-items-center bg-slate-50", className)}>
      <FileText className="h-10 w-10 text-slate-700" />
    </div>
  );
}

export function MediaLibrary({
  allowedKinds = ["image", "video", "document"],
  onSelect,
  selectedUrl,
  compact = false,
}: MediaLibraryProps) {
  const { token } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const controlId = useId().replace(/:/g, "");
  const [kind, setKind] = useState<"all" | MediaKind>(allowedKinds.length === 1 ? allowedKinds[0] : "all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<MediaAsset | null>(null);
  const [selectedDeliveryUrl, setSelectedDeliveryUrl] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [altText, setAltText] = useState("");
  const [caption, setCaption] = useState("");

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    params.set("kind", kind);
    if (search.trim()) params.set("search", search.trim());
    return params.toString();
  }, [kind, search]);

  const { data, isLoading, error, refetch } = useQuery<{ items: MediaAsset[]; total: number }>({
    queryKey: ["/api/media", kind, search],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/media?${queryString}`);
      if (!response.ok) throw new Error((await response.json().catch(() => ({}))).message || "Media library could not be loaded");
      return response.json();
    },
  });

  const upload = useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append("file", file);
      const response = await fetch("/api/media", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message || "Upload failed");
      return result as MediaAsset;
    },
    onSuccess: (asset) => {
      qc.invalidateQueries({ queryKey: ["/api/media"] });
      setSelected(asset);
      setSelectedDeliveryUrl(asset.kind === "image" ? asset.url : null);
      setAltText(asset.altText || "");
      setCaption(asset.caption || "");
      toast({ title: "Added to media library", description: `${asset.originalName} is ready to reuse.` });
      if (asset.kind !== "image") void prepareProtectedPreview(asset);
    },
    onError: (uploadError: Error) => toast({ title: "Upload could not be completed", description: uploadError.message, variant: "destructive" }),
  });

  const prepareProtectedPreview = async (asset: MediaAsset) => {
    if (asset.kind === "image") {
      setSelectedDeliveryUrl(asset.url);
      return;
    }
    setSelectedDeliveryUrl(null);
    try {
      const response = await apiRequest("POST", `/api/media/${asset.id}/content-session`);
      const session = await response.json();
      setSelectedDeliveryUrl(session.streamUrl);
    } catch (previewError) {
      toast({
        title: "Protected preview is unavailable",
        description: previewError instanceof Error ? previewError.message : "Try again in a moment.",
        variant: "destructive",
      });
    }
  };

  const loadDetails = async (asset: MediaAsset) => {
    setSelected(asset);
    setSelectedDeliveryUrl(asset.kind === "image" ? asset.url : null);
    setAltText(asset.altText || "");
    setCaption(asset.caption || "");
    try {
      const response = await apiRequest("GET", `/api/media/${asset.id}`);
      const detailed = await response.json() as MediaAsset;
      setSelected(detailed);
      await prepareProtectedPreview(detailed);
    } catch (detailError) {
      toast({
        title: "Media details could not be loaded",
        description: detailError instanceof Error ? detailError.message : "Try again in a moment.",
        variant: "destructive",
      });
    }
  };

  const saveDetails = useMutation({
    mutationFn: async () => {
      if (!selected) return null;
      const response = await apiRequest("PATCH", `/api/media/${selected.id}`, {
        altText: altText.trim() || null,
        caption: caption.trim() || null,
      });
      if (!response.ok) throw new Error((await response.json().catch(() => ({}))).message || "Details could not be saved");
      return response.json() as Promise<MediaAsset>;
    },
    onSuccess: (asset) => {
      if (!asset) return;
      setSelected((current) => current ? { ...current, ...asset } : asset);
      qc.invalidateQueries({ queryKey: ["/api/media"] });
      toast({ title: "Media details saved" });
    },
    onError: (saveError: Error) => toast({ title: "Details were not saved", description: saveError.message, variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: async () => {
      if (!selected) return;
      const response = await apiRequest("DELETE", `/api/media/${selected.id}`);
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        const usage = Array.isArray(result.usage) ? ` Used by: ${result.usage.map((item: any) => item.label).join(", ")}.` : "";
        throw new Error(`${result.message || "Delete failed"}${usage}`);
      }
    },
    onSuccess: () => {
      setDeleteOpen(false);
      setSelected(null);
      setSelectedDeliveryUrl(null);
      qc.invalidateQueries({ queryKey: ["/api/media"] });
      toast({ title: "Media item deleted" });
    },
    onError: (deleteError: Error) => {
      setDeleteOpen(false);
      toast({ title: "This item cannot be deleted yet", description: deleteError.message, variant: "destructive" });
    },
  });

  const handleFile = (file?: File) => {
    if (!file) return;
    const resolvedKind: MediaKind = file.type.startsWith("image/") ? "image" : file.type.startsWith("video/") ? "video" : "document";
    if (!allowedKinds.includes(resolvedKind)) {
      toast({ title: "Choose a supported file", description: `This field accepts ${allowedKinds.map((value) => kindMeta[value].label.toLowerCase()).join(" or ")}.`, variant: "destructive" });
      return;
    }
    upload.mutate(file);
  };

  const items = data?.items ?? [];
  const accept = allowedKinds.map((value) => kindMeta[value].accept).join(",");

  return (
    <div className={cn("grid gap-5", selected ? "xl:grid-cols-[minmax(0,1fr)_340px]" : "grid-cols-1")}>
      <div className="min-w-0">
        <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-wrap gap-1.5">
              {allowedKinds.length > 1 && (
                <Button size="sm" variant={kind === "all" ? "default" : "ghost"} onClick={() => setKind("all")} className="rounded-lg">All</Button>
              )}
              {allowedKinds.map((value) => {
                const Icon = kindMeta[value].icon;
                return (
                  <Button key={value} size="sm" variant={kind === value ? "default" : "ghost"} onClick={() => setKind(value)} className="rounded-lg">
                    <Icon className="mr-1.5 h-4 w-4" />{kindMeta[value].label}
                  </Button>
                );
              })}
            </div>
            <div className="flex gap-2">
              <div className="relative min-w-0 flex-1 md:w-64">
                <Label htmlFor={`media-search-${controlId}`} className="sr-only">Search your media library</Label>
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input id={`media-search-${controlId}`} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search media" className="min-h-11 pl-9" />
              </div>
              <input ref={inputRef} id={`media-upload-${controlId}`} type="file" accept={accept} className="sr-only" tabIndex={-1} onChange={(event) => { handleFile(event.target.files?.[0]); event.currentTarget.value = ""; }} />
              <Button onClick={() => inputRef.current?.click()} disabled={upload.isPending} className="shrink-0 bg-slate-950 text-white hover:bg-slate-800">
                {upload.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UploadCloud className="mr-2 h-4 w-4" />}
                {compact ? "Upload" : "Upload new"}
              </Button>
            </div>
          </div>
          <p className="mt-2 px-1 text-xs text-slate-500">
            Catalog images may be public · lesson videos and PDFs use protected inline delivery · {allowedKinds.map((value) => `${kindMeta[value].label} up to ${kindMeta[value].limit}`).join(" · ")}
          </p>
        </div>

        {error ? (
          <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50/70 p-8 text-center text-sm text-slate-700">
            <p>The media library could not be loaded.</p>
            <Button type="button" variant="outline" className="mt-4" onClick={() => refetch()}>Try again</Button>
          </div>
        ) : isLoading ? (
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {[1, 2, 3, 4, 5, 6].map((item) => <div key={item} className="aspect-square animate-pulse rounded-2xl bg-slate-200" />)}
          </div>
        ) : items.length === 0 ? (
          <button type="button" onClick={() => inputRef.current?.click()} className="mt-5 w-full rounded-3xl border-2 border-dashed border-slate-300 bg-white/60 px-6 py-16 text-center transition hover:border-slate-400 hover:bg-slate-50/50">
            <UploadCloud className="mx-auto h-10 w-10 text-slate-400" />
            <span className="mt-4 block font-bold text-slate-900">Upload once, reuse everywhere</span>
            <span className="mt-1 block text-sm text-slate-500">Your images, videos, and PDFs will appear here.</span>
          </button>
        ) : (
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {items.map((asset) => {
              const active = selected?.id === asset.id || selectedUrl === asset.url;
              return (
                <button
                  type="button"
                  key={asset.id}
                  onClick={() => void loadDetails(asset)}
                  onDoubleClick={() => onSelect?.(asset)}
                  className={cn(
                    "group overflow-hidden rounded-2xl border bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg",
                    active ? "border-slate-600 ring-2 ring-slate-200" : "border-slate-200",
                  )}
                >
                  <div className="relative aspect-square overflow-hidden bg-slate-100">
                    <AssetPreview asset={asset} />
                    {active && <span className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-slate-700 text-white"><Check className="h-4 w-4" /></span>}
                  </div>
                  <div className="p-3">
                    <p className="truncate text-sm font-semibold text-slate-900">{asset.originalName}</p>
                    <p className="mt-1 text-xs text-slate-500">{formatBytes(asset.sizeBytes)} · {new Date(asset.createdAt).toLocaleDateString()}</p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {selected && (
        <aside className="h-fit rounded-3xl border border-slate-200 bg-white p-5 shadow-xl shadow-slate-900/5 xl:sticky xl:top-24">
          <div className="aspect-video overflow-hidden rounded-2xl bg-slate-100">
            {selected.kind === "video" && selectedDeliveryUrl ? <video src={selectedDeliveryUrl} controls controlsList="nodownload" disablePictureInPicture preload="metadata" onContextMenu={(event) => event.preventDefault()} className="h-full w-full bg-black object-contain" />
              : selected.kind === "document" && selectedDeliveryUrl ? <iframe src={`${selectedDeliveryUrl}#toolbar=0&navpanes=0`} title={`${selected.originalName} protected preview`} referrerPolicy="no-referrer" className="h-full w-full border-0 bg-white" />
              : <AssetPreview asset={selected} className="object-contain" />}
          </div>
          <div className="mt-4 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="truncate font-bold text-slate-950">{selected.originalName}</h3>
              <p className="mt-1 text-xs text-slate-500">{selected.mimeType} · {formatBytes(selected.sizeBytes)}</p>
            </div>
            <Badge variant="outline" className="capitalize">{selected.kind}</Badge>
          </div>

          <div className="mt-5 space-y-4 border-t border-slate-100 pt-5">
            {selected.kind === "image" && (
              <div className="space-y-1.5">
                <Label htmlFor={`media-alt-${selected.id}`}>Alternative text</Label>
                <Input id={`media-alt-${selected.id}`} value={altText} onChange={(event) => setAltText(event.target.value)} placeholder="Describe the image for accessibility" />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor={`media-caption-${selected.id}`}>Caption</Label>
              <Textarea id={`media-caption-${selected.id}`} value={caption} onChange={(event) => setCaption(event.target.value)} rows={3} placeholder="Optional internal context" />
            </div>
            <Button variant="outline" className="w-full" onClick={() => saveDetails.mutate()} disabled={saveDetails.isPending}>Save details</Button>
          </div>

          <div className="mt-5 space-y-2 border-t border-slate-100 pt-5">
            <Button asChild variant="outline" className="w-full justify-start" disabled={selected.kind !== "image" && !selectedDeliveryUrl}>
              <a href={selected.kind === "image" ? selected.url : selectedDeliveryUrl || "#"} target="_blank" rel="noreferrer">
                <ExternalLink className="mr-2 h-4 w-4" /> Open file
              </a>
            </Button>
            <Button variant="outline" className="w-full justify-start" disabled={selected.kind !== "image" && !selectedDeliveryUrl} onClick={async () => {
              const link = selected.kind === "image" ? selected.url : selectedDeliveryUrl;
              if (!link) return;
              await navigator.clipboard.writeText(absoluteUrl(link));
              toast({ title: selected.kind === "image" ? "Media link copied" : "Protected viewer link copied", description: selected.kind === "image" ? undefined : "The link still requires the media owner's active Octamy session." });
            }}>
              <Clipboard className="mr-2 h-4 w-4" /> {selected.kind === "image" ? "Copy file link" : "Copy protected viewer link"}
            </Button>
            {onSelect && (
              <Button className="w-full bg-slate-700 text-white hover:bg-slate-800" onClick={() => onSelect(selected)}>
                <Check className="mr-2 h-4 w-4" /> Use this media
              </Button>
            )}
            <Button variant="ghost" className="w-full justify-start text-slate-700 hover:bg-slate-50 hover:text-slate-800" onClick={() => setDeleteOpen(true)}>
              <Trash2 className="mr-2 h-4 w-4" /> Delete permanently
            </Button>
          </div>

          {selected.usage && selected.usage.length > 0 && (
            <div className="mt-4 rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-900">
              <Info className="mr-1 inline h-3.5 w-3.5" /> In use by {selected.usage.map((usage) => usage.label).join(", ")}. Remove it there before deleting.
            </div>
          )}
        </aside>
      )}

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this media item?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the file. Octamy will block deletion if the item is still used by a course, lesson, question, logo, or profile.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep media</AlertDialogCancel>
            <AlertDialogAction onClick={() => remove.mutate()} className="bg-slate-950 text-white hover:bg-slate-800">Delete permanently</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export function MediaLibraryDialog({
  open,
  onOpenChange,
  allowedKinds,
  selectedUrl,
  onSelect,
  title = "Choose media",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  allowedKinds: MediaKind[];
  selectedUrl?: string | null;
  onSelect: (asset: MediaAsset) => void;
  title?: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-6xl overflow-y-auto p-5 sm:p-7">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Reuse an existing asset or upload a new one. Double-click an item to select it immediately.</DialogDescription>
        </DialogHeader>
        <div className="mt-3">
          <MediaLibrary
            allowedKinds={allowedKinds}
            selectedUrl={selectedUrl}
            compact
            onSelect={(asset) => {
              onSelect(asset);
              onOpenChange(false);
            }}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
