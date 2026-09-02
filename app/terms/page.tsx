import Link from 'next/link'
import Header from '@/components/Header'

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      <Header roleTitle="Information" />
      
      <main className="flex-1 w-full max-w-3xl mx-auto px-6 py-12 flex flex-col gap-8">
        <div>
          <h1 className="text-4xl font-extrabold text-blue-900 mb-4 tracking-tight">Terms and Conditions</h1>
          <p className="text-slate-600 text-lg font-medium leading-relaxed">
            Please read these terms carefully before using Care Companion. 
            By using this application, you agree to these terms.
          </p>
        </div>

        <section className="bg-white rounded-2xl p-8 shadow-sm border border-slate-200">
          <h2 className="text-2xl font-bold text-slate-800 mb-4 flex items-center gap-3">
            <span className="text-3xl" aria-hidden="true">🩺</span>
            Medical Disclaimer
          </h2>
          <div className="prose prose-slate max-w-none text-slate-600 font-medium space-y-4">
            <p>
              <strong>Care Companion is a supportive cognitive exercise tool, not a diagnostic medical device.</strong>
            </p>
            <p>
              The activities, metrics, and insights provided by this application are designed for general cognitive engagement and wellness. They are not intended to diagnose, treat, cure, or prevent any disease, including dementia or Alzheimer's disease.
            </p>
            <p>
              Always seek the advice of your physician or other qualified health provider with any questions you may have regarding a medical condition. Do not disregard professional medical advice or delay in seeking it because of something you have read or experienced on this application.
            </p>
          </div>
        </section>

        <section className="bg-white rounded-2xl p-8 shadow-sm border border-slate-200">
          <h2 className="text-2xl font-bold text-slate-800 mb-4 flex items-center gap-3">
            <span className="text-3xl" aria-hidden="true">🔒</span>
            On-Device Privacy & Video Processing
          </h2>
          <div className="prose prose-slate max-w-none text-slate-600 font-medium space-y-4">
            <p>
              We prioritize the privacy and dignity of our users. Care Companion utilizes advanced computer vision (pose estimation) to verify physical gestures during exercises.
            </p>
            <p>
              <strong>All video processing occurs entirely on your device.</strong>
            </p>
            <p>
              At no point is live video, recorded video, or photographic imagery transmitted to our servers or any third-party cloud. The application simply converts your movements into anonymous coordinate data (skeletal tracking points) in real-time within your browser, and the visual feed is immediately discarded.
            </p>
          </div>
        </section>

        <section className="bg-white rounded-2xl p-8 shadow-sm border border-slate-200">
          <h2 className="text-2xl font-bold text-slate-800 mb-4 flex items-center gap-3">
            <span className="text-3xl" aria-hidden="true">📊</span>
            Data Telemetry & Personalization
          </h2>
          <div className="prose prose-slate max-w-none text-slate-600 font-medium space-y-4">
            <p>
              To provide a dynamic and personalized experience, Care Companion collects telemetry data regarding exercise performance (e.g., accuracy, reaction time, consistency).
            </p>
            <p>
              We also allow caregivers to optionally input personal preferences (such as favorite foods, hobbies, and routines). This data is securely stored and utilized by our AI generator to dynamically create personalized cognitive questions tailored specifically to the patient's lived experience.
            </p>
            <p>
              By providing this information, you consent to its use in generating personalized content via secure generative AI endpoints.
            </p>
          </div>
        </section>
        
        <div className="text-center mt-4">
          <Link href="/" className="inline-block px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-lg shadow-sm transition-colors">
            Return to Home
          </Link>
        </div>
      </main>
    </div>
  )
}
