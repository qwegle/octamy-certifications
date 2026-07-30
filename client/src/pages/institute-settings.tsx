import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Building2, CheckCircle2, Image as ImageIcon, ShieldCheck } from "lucide-react";
import DashboardLayout from "@/components/dashboard-layout";
import { MediaLibraryDialog, type MediaAsset } from "@/components/media-library";
import { SEO } from "@/components/seo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type Institute = {
  id: number;
  name: string;
  legalName: string | null;
  logoUrl: string | null;
  websiteUrl: string | null;
  contactEmail: string | null;
  status: "pending" | "verified" | "rejected";
  memberRole: "owner" | "admin" | "teacher" | "staff";
};

type BrandingForm = Pick<Institute, "name" | "legalName" | "logoUrl" | "websiteUrl" | "contactEmail">;

const emptyForm: BrandingForm = { name: "", legalName: "", logoUrl: null, websiteUrl: "", contactEmail: "" };

export default function InstituteSettings() {
  const { toast } = useToast();
  const [form, setForm] = useState<BrandingForm>(emptyForm);
  const [mediaOpen, setMediaOpen] = useState(false);
  const { data: institute, isLoading } = useQuery<Institute>({
    queryKey: ["/api/me/institute"],
    queryFn: async () => (await apiRequest("GET", "/api/me/institute")).json(),
  });

  useEffect(() => {
    if (!institute) return;
    setForm({
      name: institute.name,
      legalName: institute.legalName || "",
      logoUrl: institute.logoUrl,
      websiteUrl: institute.websiteUrl || "",
      contactEmail: institute.contactEmail || "",
    });
  }, [institute]);

  const save = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("PATCH", "/api/institute/profile", form);
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.message || "Institute branding could not be saved");
      return body as Institute;
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(["/api/me/institute"], (current: Institute | undefined) => ({ ...current, ...updated }));
      toast({ title: "Institute identity saved", description: updated.status === "verified" ? "New Octamy credentials can now use the approved co-branding details." : "Your workspace details were updated." });
    },
    onError: (error: Error) => toast({ title: "Branding was not saved", description: error.message, variant: "destructive" }),
  });

  const canEdit = institute?.memberRole === "owner" || institute?.memberRole === "admin";
  const verified = institute?.status === "verified";

  return (
    <DashboardLayout
      role="institute"
      title="Institute identity"
      description="Manage the verified identity that appears on institute-issued Octamy credentials."
      breadcrumbs={[{ label: "Institute", href: "/institute/dashboard" }, { label: "Identity" }]}
    >
      <SEO title="Institute Identity — Octamy" description="Manage verified institute branding." path="/institute/settings" noIndex />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="border-b border-slate-100">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle className="flex items-center gap-2 text-xl"><Building2 className="h-5 w-5" /> Workspace identity</CardTitle>
              <Badge variant={verified ? "default" : "secondary"} className={verified ? "bg-slate-700" : ""}>{verified ? "Verified co-issuer" : `${institute?.status || "pending"} review`}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-5 p-6">
            <div className="grid gap-5 md:grid-cols-2">
              <Field id="institute-public-name" label="Public institute name" required><Input id="institute-public-name" className="min-h-11" required aria-required="true" value={form.name} disabled={!canEdit || isLoading} onChange={(event) => setForm((value) => ({ ...value, name: event.target.value }))} placeholder="Northstar Institute" /></Field>
              <Field id="institute-legal-name" label="Registered legal name"><Input id="institute-legal-name" className="min-h-11" value={form.legalName || ""} disabled={!canEdit || isLoading} onChange={(event) => setForm((value) => ({ ...value, legalName: event.target.value }))} placeholder="Northstar Learning Pvt. Ltd." /></Field>
              <Field id="institute-website" label="Website (HTTPS)"><Input id="institute-website" className="min-h-11" type="url" value={form.websiteUrl || ""} disabled={!canEdit || isLoading} onChange={(event) => setForm((value) => ({ ...value, websiteUrl: event.target.value }))} placeholder="https://institute.example" /></Field>
              <Field id="institute-contact-email" label="Credential contact email"><Input id="institute-contact-email" className="min-h-11" type="email" value={form.contactEmail || ""} disabled={!canEdit || isLoading} onChange={(event) => setForm((value) => ({ ...value, contactEmail: event.target.value }))} placeholder="credentials@institute.example" /></Field>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <div className="grid h-24 w-36 shrink-0 place-items-center overflow-hidden rounded-xl border border-slate-200 bg-white">
                  {form.logoUrl ? <img src={form.logoUrl} alt="Institute logo preview" className="h-full w-full object-contain p-3" /> : <ImageIcon className="h-8 w-8 text-slate-300" />}
                </div>
                <div className="min-w-0 flex-1">
                  <Label htmlFor="institute-logo-picker" className="font-bold text-slate-950">Credential logo</Label>
                  <p id="institute-logo-help" className="mt-1 text-sm leading-6 text-slate-600">Choose an image owned by this account. Octamy appears at the top left and the verified institute logo appears at the top right.</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button id="institute-logo-picker" type="button" variant="outline" disabled={!canEdit} aria-describedby="institute-logo-help" onClick={() => setMediaOpen(true)}>Choose from media</Button>
                    {form.logoUrl && <Button type="button" variant="ghost" disabled={!canEdit} onClick={() => setForm((value) => ({ ...value, logoUrl: null }))}>Remove</Button>}
                  </div>
                </div>
              </div>
            </div>

            {!canEdit && <p className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-950">Only institute owners and admins can change public identity details.</p>}
            <div className="flex justify-end"><Button className="bg-slate-950 text-white hover:bg-slate-800" disabled={!canEdit || save.isPending || form.name.trim().length < 2} onClick={() => save.mutate()}>{save.isPending ? "Saving…" : "Save identity"}</Button></div>
          </CardContent>
        </Card>

        <Card className="h-fit border-slate-200 bg-gradient-to-b from-slate-50 to-white shadow-sm">
          <CardContent className="p-6">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-slate-700 text-white"><ShieldCheck className="h-6 w-6" /></span>
            <h2 className="mt-5 text-xl font-black text-slate-950">What co-branding means</h2>
            <div className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
              <p className="flex gap-2"><CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-slate-700" /> Octamy records and verifies the digital assessment evidence.</p>
              <p className="flex gap-2"><CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-slate-700" /> A verified institute can appear as a co-issuer on new credentials for its own programs.</p>
              <p className="flex gap-2"><CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-slate-700" /> The verification page states the score, status, issuer, and evidence boundaries.</p>
            </div>
            {!verified && <p className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs leading-5 text-slate-950">Branding can be prepared now, but it is not rendered as a public co-issuer until Octamy verifies the workspace.</p>}
          </CardContent>
        </Card>
      </div>

      <MediaLibraryDialog open={mediaOpen} onOpenChange={setMediaOpen} allowedKinds={["image"]} selectedUrl={form.logoUrl} title="Choose institute logo" onSelect={(asset: MediaAsset) => setForm((value) => ({ ...value, logoUrl: asset.url }))} />
    </DashboardLayout>
  );
}

function Field({ id, label, required, children }: { id: string; label: string; required?: boolean; children: React.ReactNode }) {
  return <div className="space-y-2"><Label htmlFor={id}>{label}{required && <span className="text-slate-700" aria-hidden="true"> *</span>}</Label>{children}</div>;
}
