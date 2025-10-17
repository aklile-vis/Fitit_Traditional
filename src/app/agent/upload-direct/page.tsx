"use client";

import React from 'react';
import { motion } from 'framer-motion';

export default function UploadDirectPage() {
  return (
    <div className="min-h-screen bg-[#f7f1e8]">
      <div className="container mx-auto px-4 py-12">
        <div className="text-center mb-8">
          <h1 className="mb-4 text-4xl font-bold text-[#2f2013]">Direct DXF Processing (Deprecated)</h1>
          <p className="text-xl text-[#7b6652]">This route has been disabled in favor of the unified robust backend.</p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-3xl mx-auto"
        >
          <div className="rounded-xl border border-[#d9c6b5] bg-[#fefbf7] p-6 text-[#2f2013] shadow-[0_18px_40px_rgba(59,42,28,0.1)]">
            <h3 className="mb-2 text-2xl font-semibold">Use the unified robust pipeline instead</h3>
            <ul className="list-disc list-inside mb-4 text-[#7b6652]">
              <li>
                Quick flow: <a className="underline" href="/agent/upload-simple">Upload (Simple)</a>
              </li>
              <li>
                Full mesh-first workflow with verification: <a className="underline" href="/agent/upload">Upload (Agent)</a>
              </li>
            </ul>
            <p className="text-sm text-[#7b6652] opacity-80">If you landed here from an old bookmark, update it to the routes above.</p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
