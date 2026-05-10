import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLocation } from "wouter";

export default function TermsOfService() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <header className="bg-cream-soft dark:bg-gray-900 shadow-sm border-b border-cream-deep dark:border-gray-700">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Button variant="ghost" onClick={() => setLocation("/")}>
              <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">Octamy</span>
            </Button>
            <Button onClick={() => setLocation("/")}>
              Back to Home
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">Terms of Service</h1>
          <p className="text-gray-600 dark:text-gray-300">
            Last updated: {new Date().toLocaleDateString()}
          </p>
        </div>

        <Card>
          <CardContent className="prose prose-gray dark:prose-invert max-w-none p-8">
            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">1. Acceptance of Terms</h2>
              <p className="mb-4">
                By accessing and using Octamy's certification platform, you accept and agree to be bound by the terms 
                and provision of this agreement. If you do not agree to abide by the above, please do not use this service.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">2. Description of Service</h2>
              <p className="mb-4">
                Octamy provides online professional certification services, including but not limited to:
              </p>
              <ul className="list-disc pl-6 mb-4 space-y-2">
                <li>Online assessments and examinations</li>
                <li>Digital certificate issuance</li>
                <li>Certificate verification services</li>
                <li>Virtual internship programs</li>
                <li>Professional skill validation</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">3. User Accounts</h2>
              <p className="mb-4">
                To access certain features, you must register for an account. You agree to:
              </p>
              <ul className="list-disc pl-6 mb-4 space-y-2">
                <li>Provide accurate and complete information</li>
                <li>Maintain the security of your password</li>
                <li>Accept responsibility for all activities under your account</li>
                <li>Notify us immediately of any unauthorized use</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">4. Assessment and Certification</h2>
              <h3 className="text-lg font-semibold mb-2">4.1 Assessment Rules</h3>
              <ul className="list-disc pl-6 mb-4 space-y-2">
                <li>You must complete assessments honestly and without external assistance</li>
                <li>Multiple attempts are allowed with a 24-hour cooling period</li>
                <li>Assessment results are final and binding</li>
                <li>Cheating or fraudulent behavior will result in account termination</li>
              </ul>
              
              <h3 className="text-lg font-semibold mb-2">4.2 Certificate Issuance</h3>
              <ul className="list-disc pl-6 mb-4 space-y-2">
                <li>Certificates are issued only upon successful completion and payment</li>
                <li>Certificate information is publicly verifiable</li>
                <li>Certificates cannot be modified after issuance (except internship certificates during application)</li>
                <li>We reserve the right to revoke certificates for fraudulent activity</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">5. Virtual Internship Programs</h2>
              <p className="mb-4">
                For virtual internship certificates:
              </p>
              <ul className="list-disc pl-6 mb-4 space-y-2">
                <li>You can customize duration and dates during the application process</li>
                <li>Information provided must be accurate and truthful</li>
                <li>Certificates represent completion of assessment, not actual work experience</li>
                <li>Employers may verify the nature of the program through our platform</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">6. Payment and Refunds</h2>
              <h3 className="text-lg font-semibold mb-2">6.1 Payment</h3>
              <ul className="list-disc pl-6 mb-4 space-y-2">
                <li>Payment is required before certificate issuance</li>
                <li>All prices are in Indian Rupees (INR) unless otherwise stated</li>
                <li>We use secure third-party payment processors</li>
                <li>You are responsible for any applicable taxes</li>
              </ul>
              
              <h3 className="text-lg font-semibold mb-2">6.2 Refunds</h3>
              <ul className="list-disc pl-6 mb-4 space-y-2">
                <li>30-day money-back guarantee from certificate issuance date</li>
                <li>Refunds require written request with valid reason</li>
                <li>Processing time: 5-10 business days</li>
                <li>Refunded certificates become invalid</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">7. Intellectual Property</h2>
              <p className="mb-4">
                All content, features, and functionality are owned by Octamy and protected by copyright, trademark, 
                and other intellectual property laws. You may not:
              </p>
              <ul className="list-disc pl-6 mb-4 space-y-2">
                <li>Reproduce or distribute our content without permission</li>
                <li>Reverse engineer or attempt to access source code</li>
                <li>Use our trademarks without authorization</li>
                <li>Create derivative works based on our platform</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">8. Prohibited Uses</h2>
              <p className="mb-4">You may not use our service:</p>
              <ul className="list-disc pl-6 mb-4 space-y-2">
                <li>For any unlawful purpose or to solicit unlawful acts</li>
                <li>To violate any international, federal, provincial, or state regulations or laws</li>
                <li>To harass, abuse, insult, harm, defame, slander, disparage, intimidate, or discriminate</li>
                <li>To submit false or misleading information</li>
                <li>To upload viruses or malicious code</li>
                <li>To attempt to gain unauthorized access to our systems</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">9. Disclaimers</h2>
              <p className="mb-4">
                Our services are provided "as is" without warranties of any kind. We disclaim all warranties, 
                express or implied, including merchantability and fitness for a particular purpose.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">10. Limitation of Liability</h2>
              <p className="mb-4">
                In no event shall Octamy be liable for any indirect, incidental, special, consequential, or punitive 
                damages arising out of your use of our services.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">11. Termination</h2>
              <p className="mb-4">
                We may terminate or suspend your account immediately for violation of these terms. Upon termination, 
                your right to use the service ceases immediately.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">12. Changes to Terms</h2>
              <p className="mb-4">
                We reserve the right to modify these terms at any time. Changes will be effective immediately upon 
                posting to the website.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">13. Governing Law</h2>
              <p className="mb-4">
                These terms shall be governed by and construed in accordance with the laws of India, and you submit 
                to the exclusive jurisdiction of the courts in Bangalore, Karnataka.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">14. Contact Information</h2>
              <p className="mb-4">
                For questions about these Terms of Service, please contact us at:
              </p>
              <div className="bg-cream-deep dark:bg-gray-800 p-4 rounded-lg">
                <p><strong>Email:</strong> legal@octamy.com</p>
                <p><strong>Phone:</strong> +91 9876543210</p>
                <p><strong>Address:</strong> Octamy Technologies Pvt. Ltd., Bangalore, India</p>
              </div>
            </section>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}