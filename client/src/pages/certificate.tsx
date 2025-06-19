import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Header from "@/components/header";
import Footer from "@/components/footer";
import {
  Download,
  Printer,
  Share2,
  CheckCircle,
  XCircle,
  Loader2,
  Shield,
  Award,
  Calendar,
  User,
  Globe,
} from "lucide-react";
import type { Certificate } from "@shared/schema";
import octamyLogo from "@/assets/image_1750054465427.png";
import { useState } from "react";

export default function CertificateView() {
  const { certificateId } = useParams();
  const [isDownloading, setIsDownloading] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);

  const {
    data: certificate,
    isLoading,
    error,
  } = useQuery<Certificate>({
    queryKey: [`/api/certificates/${certificateId}`],
    enabled: !!certificateId,
  });

  const handleDownload = async () => {
    if (!certificate?.isPaid) {
      alert("Certificate payment is required before download");
      return;
    }

    setIsDownloading(true);
    try {
      const response = await fetch(
        `/api/certificates/${certificateId}/download?format=pdf`
      );
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.style.display = "none";
        a.href = url;
        a.download = `Certificate-${certificate.userName}-${certificate.courseTitle}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        alert("Failed to download certificate. Please try again.");
      }
    } catch (error) {
      console.error("Error downloading certificate:", error);
      alert("Failed to download certificate. Please try again.");
    } finally {
      setIsDownloading(false);
    }
  };

  const handlePrint = async () => {
    if (!certificate?.isPaid) {
      alert("Certificate payment is required before printing");
      return;
    }

    setIsPrinting(true);
    try {
      const iframe = document.querySelector("iframe") as HTMLIFrameElement;
      if (iframe && iframe.contentWindow) {
        iframe.contentWindow.print();
      } else {
        // Fallback: open in new window for printing
        window.open(`/api/certificates/${certificateId}/download`, "_blank");
      }
    } catch (error) {
      console.error("Error printing certificate:", error);
      alert("Failed to print certificate. Please try again.");
    } finally {
      setIsPrinting(false);
    }
  };

  const handleShare = async () => {
    const shareText = `I've earned a professional certificate in ${certificate?.courseTitle}! 
Score: ${certificate?.score}% 
Verified by Octamy Solutions Private Limited
View certificate: ${window.location.href}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: `Certificate - ${certificate?.courseTitle}`,
          text: shareText,
          url: window.location.href,
        });
      } catch (error) {
        // User canceled share or share failed
        if ((error as Error).name !== "AbortError") {
          console.error("Share failed:", error);
          // Fallback to clipboard
          fallbackToClipboard(shareText);
        }
      }
    } else {
      fallbackToClipboard(shareText);
    }
  };

  const fallbackToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      alert("Certificate details copied to clipboard!");
    } catch (error) {
      console.error("Clipboard failed:", error);
      // Final fallback - show text in alert for manual copy
      alert(`Please copy this text manually:\n\n${text}`);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black text-white">
        <Header />
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
            <p>Loading certificate...</p>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  if (error || !certificate) {
    return (
      <div className="min-h-screen bg-black text-white">
        <Header />
        <div className="container mx-auto px-4 py-16 text-center">
          <XCircle className="w-16 h-16 text-red-500 mx-auto mb-6" />
          <h1 className="text-3xl font-bold mb-4">Certificate Not Found</h1>
          <p className="text-gray-400 mb-8">
            The certificate you're looking for doesn't exist or has been
            removed.
          </p>
          <p className="text-gray-400 mb-8">
            Please verify the certificate ID and try again.
          </p>
          <Button asChild className="bg-white text-black hover:bg-gray-200">
            <a href="/">Return to Home</a>
          </Button>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <Header />

      {/* Hero Section with Octamy Branding */}
      <div className=" py-16 pb-8">
        <div className="container mx-auto px-4 text-center">
          <div className="flex items-center justify-center mb-6">
            <img
              src={octamyLogo}
              alt="Octamy Solutions"
              className=" h-16 mr-4"
            />
            <div className="text-left">
              <h1 className="text-3xl font-bold">Professional Certificate</h1>
              <p className="text-gray-400">
                Verified by Octamy Solutions Private Limited
              </p>
            </div>
          </div>

          <div className="flex items-center justify-center gap-4 mb-6">
            <Badge
              variant="outline"
              className="border-green-500 text-green-500"
            >
              <CheckCircle className="w-4 h-4 mr-1" />
              Verified Authentic
            </Badge>
            <Badge variant="outline" className="border-blue-500 text-blue-500">
              <Shield className="w-4 h-4 mr-1" />
              Blockchain Secured
            </Badge>
            <Badge
              variant="outline"
              className="border-purple-500 text-purple-500"
            >
              <Globe className="w-4 h-4 mr-1" />
              Globally Recognized
            </Badge>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-12 pt-2">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Certificate Display */}
          <div className="lg:col-span-2">
            <Card className="bg-white-900 border-white-800">
              <CardContent className="p-6">
                <div className="mb-4">
                  <h2 className="text-xl font-semibold mb-2 text-white">
                    Certificate Document
                  </h2>
                  <p className="text-gray-400 text-sm">
                    ID: {certificate.certificateId}
                  </p>
                </div>

                {certificate.isPaid ? (
                  <iframe
                    src={`/api/certificates/${certificateId}/download`}
                    className="w-full h-[600px] border border-white-700 rounded bg-white"
                    title="Certificate Preview"
                    style={{ backgroundColor: "white" }}
                  />
                ) : (
                  <div className="w-full h-[600px] border border-gray-700 rounded bg-gray-800 flex items-center justify-center relative">
                    <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-10">
                      <div className="text-center p-8">
                        <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
                        <h3 className="text-xl font-semibold mb-2">
                          Payment Required
                        </h3>
                        <p className="text-gray-400 mb-4">
                          This certificate requires payment to view and
                          download.
                        </p>
                        <Button className="border-white-600 bg-black text-white hover:bg-gray-200">
                          Complete Payment
                        </Button>
                      </div>
                    </div>
                    <div className="text-center p-8 opacity-30">
                      <Award className="w-24 h-24 text-gray-600 mx-auto mb-4" />
                      <h3 className="text-2xl font-bold text-white-600">
                        Professional Certificate
                      </h3>
                      <p className="text-white-600 mt-2">
                        {certificate.courseTitle}
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-4 mt-6">
              <Button
                onClick={handleDownload}
                disabled={!certificate.isPaid || isDownloading}
                className="bg-white text-black hover:bg-gray-200 disabled:opacity-50"
              >
                {isDownloading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Download className="w-4 h-4 mr-2" />
                )}
                Download PDF
              </Button>

              <Button
                variant="outline"
                onClick={handlePrint}
                disabled={!certificate.isPaid || isPrinting}
                className="border-white-600 bg-white text-black  hover:bg-white-800 disabled:opacity-50"
              >
                {isPrinting ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Printer className="w-4 h-4 mr-2" />
                )}
                Print
              </Button>

              <Button
                variant="outline"
                onClick={handleShare}
                className="border-white-600 bg-white text-black  hover:bg-white-800"
              >
                <Share2 className="w-4 h-4 mr-2" />
                Share
              </Button>
            </div>
          </div>

          {/* Certificate Details Sidebar */}
          <div className="space-y-6">
            {/* Verification Status */}
            <Card className="bg-white-900 border-white-800">
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center text-white">
                  <Shield className="w-5 h-5 mr-2 text-green-500" />
                  Verification Status
                </h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Authenticity</span>
                    <Badge className="bg-green-500 hover:bg-green-600">
                      Verified
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Digital Signature</span>
                    <Badge className="bg-green-500 hover:bg-green-600">
                      Valid
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Payment Status</span>
                    <Badge
                      className={
                        certificate.isPaid
                          ? "bg-green-500 hover:bg-green-600"
                          : "bg-red-500 hover:bg-red-600"
                      }
                    >
                      {certificate.isPaid ? "Paid" : "Pending"}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Certificate Information */}
            <Card className="bg-white-900 border-white-800">
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center text-white">
                  <Award className="w-5 h-5 mr-2 text-blue-500" />
                  Certificate Details
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm text-gray-400 flex items-center mb-1">
                      <User className="w-4 h-4 mr-1" />
                      Recipient
                    </label>
                    <p className="font-medium text-white">
                      {certificate.userName}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm text-gray-400 mb-1 block">
                      Course
                    </label>
                    <p className="font-medium text-white">
                      {certificate.courseTitle}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm text-gray-400 mb-1 block">
                      Score
                    </label>
                    <p className="font-medium text-green-400">
                      {certificate.score}%
                    </p>
                  </div>
                  <div>
                    <label className="text-sm text-gray-400 mb-1 block">
                      Badge
                    </label>
                    <Badge className="bg-yellow-500 hover:bg-yellow-600">
                      {certificate.badge}
                    </Badge>
                  </div>
                  <div>
                    <label className="text-sm text-gray-400 flex items-center mb-1">
                      <Calendar className="w-4 h-4 mr-1" />
                      Issue Date
                    </label>
                    <p className="font-medium text-white">
                      {new Date(certificate.issuedAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm text-gray-400 mb-1 block">
                      Valid Until
                    </label>
                    <p className="font-medium text-white">
                      {new Date(certificate.expiresAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Issuer Information */}
            <Card className="bg-gray-900 border-white-800">
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold mb-4 text-white">
                  Issued By
                </h3>
                <div className="flex items-center mb-3">
                  <img
                    src={octamyLogo}
                    alt="Octamy Solutions"
                    className=" h-12 mr-3"
                  />
                  <div>
                    <p className="font-semibold text-white">
                      Octamy Solutions Private Limited
                    </p>
                    <p className="text-sm text-gray-400">
                      An ISO Certified Company
                    </p>
                  </div>
                </div>
                <div className="text-sm text-gray-400 space-y-1">
                  <p>• Professional Certification Authority</p>
                  <p>• Globally Recognized Standards</p>
                  <p>• Blockchain Verified</p>
                  <p>• Industry Partnership Program</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
