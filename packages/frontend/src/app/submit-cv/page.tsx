import type { Metadata } from 'next';
import { SubmitCvForm } from '../../components/submit-cv/SubmitCvForm';

export const metadata: Metadata = {
  title: 'Submit CV',
};

export default function SubmitCvPage() {
  return (
    <main className="min-h-screen bg-gray-50 px-4 py-12">
      <div className="mx-auto max-w-lg">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-gray-900">Submit Your CV</h1>
          <p className="mt-2 text-sm text-gray-500">Fill in your details and upload your CV to apply.</p>
        </div>
        <div className="rounded-xl bg-white p-8 shadow-sm ring-1 ring-gray-200">
          <SubmitCvForm />
        </div>
      </div>
    </main>
  );
}
