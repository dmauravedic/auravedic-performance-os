import React, { useState } from 'react';
import { useDashboard } from '../../context/DashboardContext';
import { SectionSourceBadge } from '../common/SectionSourceBadge';
import { SourcesTable } from '../common/SourcesTable';
import { parseUploadedFile } from '../../utils/fileParsers';
import {
  Database,
  UploadCloud,
  FileText,
  CheckCircle2,
  AlertCircle,
  Clock,
  RotateCcw,
  Sparkles,
  ShieldCheck,
  Check
} from 'lucide-react';

export const DataHealthIngestionView: React.FC = () => {
  const {
    updateAmazonData,
    resetToDefaults,
    defaultCOGS,
    flatShipping,
  } = useDashboard();

  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [uploadedRecordsCount, setUploadedRecordsCount] = useState<number>(0);

  const reportsNeeded = [
    { report: 'Amazon Ads Campaign Report (daily)', status: 'Monthly only, from the report sheet', fix: 'Connect amazon_ads profile 1844743165607135 in Windsor for daily spend' },
    { report: 'Stock reports for Flipkart, Nykaa, Myntra', status: 'No source', fix: 'Add a stock tab to the report sheet, or post the FBF counts so they can be loaded' },
    { report: 'Amazon Settlement (Full History)', status: 'Partial (13-25 Oct only)', fix: 'Download date range payment reports from Seller Central' },
    { report: 'Product Cost per SKU', status: 'Assumed (Flat ₹125 default)', fix: 'Upload landed unit cost spreadsheet from finance' },
    { report: 'Shopify Payment Gateway & COD Fees', status: 'Missing', fix: 'Shopify Payments payout or COD courier remittance file' },
    { report: 'Amazon 21 Oct Fee Adjustment (₹1.94L)', status: 'Unclassified & Excluded', fix: 'Seller Central -> Payments -> Transaction View audit' },
    { report: 'Flipkart Settlement Reports', status: 'Missing in Slack', fix: 'Post weekly settlement file to #flipkart-reports' },
    { report: 'Flipkart Cancellation / Return Reasons', status: 'Missing', fix: 'Post Seller Hub cancellation reason export' },
  ];

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setUploadStatus(`Parsing ${file.name}...`);

    try {
      const result = await parseUploadedFile(file);
      setIsProcessing(false);
      setUploadedRecordsCount(result.rowCount);
      setUploadStatus(result.summaryMessage);

      if (result.sourceType === 'amazon_business' && result.data.length > 0) {
        updateAmazonData(result.data);
      }
    } catch (err: any) {
      setIsProcessing(false);
      setUploadStatus(`Error parsing file: ${err.message || 'Invalid format'}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Where every number comes from */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-4">
        <div className="pb-3 border-b border-slate-100">
          <h3 className="font-semibold text-slate-900 text-sm">Where the data comes from</h3>
          <p className="text-xs text-slate-500">
            Every source behind the dashboard, how it arrives, how often, and whether it is current. A source that runs behind by design
            (Flipkart's day, Amazon's lag) is noted, not flagged; one past its accepted delay is marked stale.
          </p>
        </div>
        <SourcesTable />
      </div>

      {/* Interactive In-App File Ingestion (Drag & Drop Uploader) */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-2xs space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-50 rounded-lg text-amber-700">
              <UploadCloud className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">In-App Report Ingestion Engine</h3>
              <p className="text-xs text-slate-500">
                Drag and drop any daily/weekly report file. The engine auto-detects Amazon Business Reports, Windsor exports, or Shan-Report-Sheets.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={resetToDefaults}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-rose-50 hover:text-rose-700 text-slate-600 text-xs font-semibold rounded-lg transition-colors border border-slate-200"
              title="Reset data back to seed state"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset Defaults
            </button>
          </div>
        </div>

        {/* Upload Drop Zone */}
        <div className="border-2 border-dashed border-amber-300/80 bg-amber-50/20 rounded-xl p-8 text-center hover:bg-amber-50/40 transition-colors relative cursor-pointer">
          <input
            type="file"
            accept=".csv, .xlsx, .xls"
            onChange={handleFileUpload}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
          <div className="flex flex-col items-center justify-center">
            <UploadCloud className="w-10 h-10 text-amber-600 mb-2" />
            <div className="text-sm font-semibold text-slate-800">
              Drop report files here, or <span className="text-amber-700 underline">browse</span>
            </div>
            <p className="text-xs text-slate-500 mt-1 max-w-sm">
              Supports <strong>BusinessReport-*.csv</strong>, <strong>Shan-Report-Sheet.xlsx</strong>, Windsor CSVs, and Flipkart order exports.
            </p>
          </div>
        </div>

        {/* Ingestion Feedback Banner */}
        {uploadStatus && (
          <div className={`p-3.5 rounded-xl text-xs flex items-center justify-between gap-3 border ${
            uploadStatus.includes('Error') 
              ? 'bg-rose-50 text-rose-800 border-rose-200' 
              : 'bg-emerald-50 text-emerald-900 border-emerald-200'
          }`}>
            <div className="flex items-center gap-2">
              {uploadStatus.includes('Error') ? (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              ) : (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              )}
              <span>{uploadStatus}</span>
            </div>
            {uploadedRecordsCount > 0 && (
              <span className="font-bold font-mono text-[11px] bg-emerald-200/60 px-2 py-0.5 rounded">
                +{uploadedRecordsCount} Records Loaded
              </span>
            )}
          </div>
        )}

        <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
          <SectionSourceBadge 
            source="A file you upload here. It is read in your browser and nothing is sent anywhere."
            latency="Instant"
            sources={['browser']}
          />
        </div>
      </div>

      {/* Assumptions & Governance Audit */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-amber-600" />
            <div>
              <h3 className="font-semibold text-slate-900 text-sm">Active System Assumptions & Governance Rules</h3>
              <p className="text-xs text-slate-500">Documented assumptions currently governing financial models.</p>
            </div>
          </div>
          <SectionSourceBadge 
            source="Auravedic Financial Modeling Constants & Exclusions Policy" 
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
            <div className="text-slate-500 font-semibold mb-1">Standard Fallback COGS</div>
            <div className="text-xl font-bold text-slate-900 font-mono">₹{defaultCOGS} / unit</div>
            <p className="text-[11px] text-slate-500 mt-1">
              Applied to every product and combo, in the P&amp;L, Advertising break-even and the Products table. Sheet31's own landed costs are not used.
            </p>
            <p className="text-[10px] text-slate-500 mt-1.5">
              <span className="font-semibold text-slate-600">Data from:</span> a built-in assumption, changeable on the P&amp;L page.
            </p>
          </div>

          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
            <div className="text-slate-500 font-semibold mb-1">Outbound Shipping Rate</div>
            <div className="text-xl font-bold text-slate-900 font-mono">₹{flatShipping} / order</div>
            <p className="text-[11px] text-slate-500 mt-1">
              Applied to Shopify orders with net order value &gt; ₹499 (free shipping threshold).
            </p>
            <p className="text-[10px] text-slate-500 mt-1.5">
              <span className="font-semibold text-slate-600">Data from:</span> a built-in assumption, changeable on the P&amp;L page.
            </p>
          </div>

          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
            <div className="text-slate-500 font-semibold mb-1">Meta Ad-Day Glitch Cutoff</div>
            <div className="text-xl font-bold text-slate-900 font-mono">&gt; ₹50,000 / purchase</div>
            <p className="text-[11px] text-slate-500 mt-1">
              Ad-days exceeding ₹50k per purchase are excluded (e.g., MP2 on 21 Jul 2026).
            </p>
            <p className="text-[10px] text-slate-500 mt-1.5">
              <span className="font-semibold text-slate-600">Data from:</span> a cleaning rule applied to the Meta feed from Windsor.
            </p>
          </div>
        </div>
      </div>

      {/* Missing Reports & Outstanding Gaps Checklist */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <h3 className="font-semibold text-slate-900 text-sm">Missing & Outstanding Reports Checklist</h3>
            <p className="text-xs text-slate-500">Identified data gaps from Handbook Section 8.1 and recommended action items.</p>
          </div>
          <SectionSourceBadge 
            source="Data Pipeline & Freshness Audit (Handbook Section 8.1)" 
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-y border-slate-200">
              <tr>
                <th className="py-2.5 px-3">Report / Data Stream</th>
                <th className="py-2.5 px-3">Current Status</th>
                <th className="py-2.5 px-3">Resolution Route</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
              {reportsNeeded.map((r, idx) => (
                <tr key={idx} className="hover:bg-slate-50 transition-colors">
                  <td className="py-2.5 px-3 font-semibold text-slate-900">{r.report}</td>
                  <td className="py-2.5 px-3">
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 font-medium">
                      {r.status}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-slate-600 text-[11px]">{r.fix}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
