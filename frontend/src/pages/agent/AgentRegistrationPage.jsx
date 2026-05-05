import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import {
  User, CreditCard, Building2, Upload, FileText, CheckCircle,
  AlertCircle, Loader2, Download, Camera, ChevronRight, ChevronLeft,
} from 'lucide-react';
import toast from 'react-hot-toast';
import axios from 'axios';

const API = import.meta.env.VITE_API_URL || '/api';

// ── File upload helper ────────────────────────────────────────
function toBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function uploadDocumentFile(base64, category, token) {
  const { data } = await axios.post(`${API}/agent-auth/upload-file`, {
    fileData: base64, category, agentRef: token,
  });
  return data.url;
}

// ── FileUploadField ───────────────────────────────────────────
function FileUploadField({ label, category, token, value, onChange, required }) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef(null);

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error('File must be under 5MB'); return; }

    setUploading(true);
    try {
      const b64 = await toBase64(file);
      const url = await uploadDocumentFile(b64, category, token);
      onChange(url);
      toast.success(`${label} uploaded`);
    } catch {
      toast.error(`Failed to upload ${label}`);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <div
        onClick={() => !uploading && inputRef.current?.click()}
        className={`flex items-center gap-3 border-2 border-dashed rounded-lg p-3 cursor-pointer transition-colors
          ${value ? 'border-green-400 bg-green-50' : 'border-gray-300 bg-gray-50 hover:border-green-400 hover:bg-green-50'}`}
      >
        <input ref={inputRef} type="file" className="hidden" accept="image/*,.pdf" onChange={handleFile} />
        {uploading ? (
          <><Loader2 className="w-5 h-5 text-green-600 animate-spin" /><span className="text-sm text-gray-500">Uploading…</span></>
        ) : value ? (
          <><CheckCircle className="w-5 h-5 text-green-600" /><span className="text-sm text-green-700 font-medium">Uploaded</span></>
        ) : (
          <><Upload className="w-5 h-5 text-gray-400" /><span className="text-sm text-gray-500">Click to upload</span></>
        )}
      </div>
      {value && (
        <a href={value} target="_blank" rel="noreferrer" className="text-xs text-blue-600 underline mt-1 block">
          View uploaded file
        </a>
      )}
    </div>
  );
}

// ── Steps ─────────────────────────────────────────────────────
const STEPS = [
  { id: 'personal',   label: 'Personal Details', icon: User },
  { id: 'documents',  label: 'Documents',        icon: Camera },
  { id: 'bank',       label: 'Bank Details',     icon: Building2 },
  { id: 'agreement',  label: 'Agreement',        icon: FileText },
  { id: 'account',    label: 'Account Setup',    icon: CreditCard },
];

export default function AgentRegistrationPage() {
  const [params]   = useSearchParams();
  const navigate   = useNavigate();
  const token      = params.get('token') || '';

  const [tokenValid, setTokenValid]   = useState(null); // null=checking, true, false
  const [tokenNote,  setTokenNote]    = useState('');
  const [step,       setStep]         = useState(0);
  const [submitting, setSubmitting]   = useState(false);
  const [done,       setDone]         = useState(false);

  const [form, setForm] = useState({
    full_name: '', nic_number: '', driving_license_number: '', phone: '', district: '',
    nic_front_url: '', nic_back_url: '', agent_photo_url: '', bank_book_url: '',
    signed_agreement_url: '',
    bank_name: '', account_holder: '', bank_account: '', bank_branch: '',
    email: '', password: '', password_confirm: '',
  });

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const setUrl = (k) => (url) => setForm((f) => ({ ...f, [k]: url }));

  // Validate token on mount
  useEffect(() => {
    if (!token) { setTokenValid(false); return; }
    axios.get(`${API}/agent-auth/validate-token/${token}`)
      .then(({ data }) => { setTokenValid(true); setTokenNote(data.note || ''); })
      .catch(() => setTokenValid(false));
  }, [token]);

  function canProceed() {
    if (step === 0) return form.full_name && form.nic_number && form.phone;
    if (step === 1) return form.nic_front_url && form.nic_back_url && form.agent_photo_url;
    if (step === 2) return form.bank_name && form.account_holder && form.bank_account;
    if (step === 3) return true; // agreement is optional (can be uploaded later)
    if (step === 4) return form.email && form.password && form.password === form.password_confirm && form.password.length >= 8;
    return false;
  }

  async function handleDownloadAgreement() {
    if (!form.full_name || !form.nic_number) {
      toast.error('Fill in your Full Name and NIC Number first');
      return;
    }
    const url = `${API}/agent-auth/agreement/${token}?full_name=${encodeURIComponent(form.full_name)}&nic_number=${encodeURIComponent(form.nic_number)}`;
    window.open(url, '_blank');
  }

  async function handleSubmit() {
    if (form.password !== form.password_confirm) {
      toast.error('Passwords do not match');
      return;
    }
    setSubmitting(true);
    try {
      await axios.post(`${API}/agent-auth/register`, {
        token,
        full_name:                form.full_name,
        nic_number:               form.nic_number,
        driving_license_number:   form.driving_license_number || undefined,
        phone:                    form.phone,
        district:                 form.district || undefined,
        nic_front_url:            form.nic_front_url,
        nic_back_url:             form.nic_back_url,
        agent_photo_url:          form.agent_photo_url,
        bank_book_url:            form.bank_book_url || undefined,
        signed_agreement_url:     form.signed_agreement_url || undefined,
        bank_name:                form.bank_name,
        account_holder:           form.account_holder,
        bank_account:             form.bank_account,
        bank_branch:              form.bank_branch || undefined,
        email:                    form.email,
        password:                 form.password,
      });
      setDone(true);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Registration failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  const fieldCls = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500';

  // ── Token checking ────────────────────────────────────────────
  if (tokenValid === null) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-green-600 animate-spin mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Validating your registration link…</p>
        </div>
      </div>
    );
  }

  if (!tokenValid) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-gray-200 p-8 text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-900 mb-2">Invalid or Expired Link</h1>
          <p className="text-gray-500 text-sm mb-6">
            This registration link is invalid, has already been used, or has expired.
            Please contact your BillFlow administrator for a new link.
          </p>
          <Link to="/agent/login" className="text-green-700 font-semibold hover:underline text-sm">
            Go to Agent Login →
          </Link>
        </div>
      </div>
    );
  }

  // ── Success screen ────────────────────────────────────────────
  if (done) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-gray-200 p-8 text-center">
          <CheckCircle className="w-14 h-14 text-green-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-900 mb-2">Registration Submitted!</h1>
          <p className="text-gray-600 text-sm mb-6">
            Your application has been submitted and is <strong>pending admin approval</strong>.
            You will be notified once your account is reviewed. This typically takes 1–2 business days.
          </p>
          <Link
            to="/agent/login"
            className="inline-block bg-green-700 text-white px-6 py-2.5 rounded-lg text-sm font-semibold hover:bg-green-800"
          >
            Go to Agent Login
          </Link>
        </div>
      </div>
    );
  }

  // ── Main registration form ────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-gray-100">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-800 to-green-700 text-white py-5 px-4 text-center">
        <h1 className="text-xl font-bold">BillFlow Agent Registration</h1>
        {tokenNote && <p className="text-green-200 text-xs mt-1">{tokenNote}</p>}
      </div>

      {/* Step indicator */}
      <div className="max-w-xl mx-auto px-4 pt-6">
        <div className="flex items-center justify-between mb-6">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const active   = i === step;
            const complete  = i < step;
            return (
              <div key={s.id} className="flex flex-col items-center gap-1 flex-1">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors
                  ${complete ? 'bg-green-600 text-white' : active ? 'bg-green-700 text-white ring-2 ring-green-300' : 'bg-gray-200 text-gray-400'}`}>
                  {complete ? <CheckCircle className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                </div>
                <span className={`text-xs text-center hidden sm:block ${active ? 'text-green-700 font-semibold' : 'text-gray-400'}`}>
                  {s.label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Step card */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">

          {/* ── Step 0: Personal Details ─────────────────────── */}
          {step === 0 && (
            <>
              <h2 className="font-bold text-gray-800">Personal Details</h2>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Full Name *</label>
                <input value={form.full_name} onChange={set('full_name')} placeholder="As on NIC" className={fieldCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">NIC Number *</label>
                <input value={form.nic_number} onChange={set('nic_number')} placeholder="e.g. 199012345678" className={fieldCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Driving License Number (optional)</label>
                <input value={form.driving_license_number} onChange={set('driving_license_number')} placeholder="e.g. B1234567" className={fieldCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Phone Number *</label>
                <input value={form.phone} onChange={set('phone')} placeholder="+94 77 123 4567" className={fieldCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">District (optional)</label>
                <input value={form.district} onChange={set('district')} placeholder="e.g. Colombo" className={fieldCls} />
              </div>
            </>
          )}

          {/* ── Step 1: Documents ────────────────────────────── */}
          {step === 1 && (
            <>
              <h2 className="font-bold text-gray-800">Document Uploads</h2>
              <p className="text-xs text-gray-500">Upload clear photos of your documents. Max 5MB each.</p>
              <FileUploadField label="NIC / Driving License – Front" category="nic_front" token={token}
                value={form.nic_front_url} onChange={setUrl('nic_front_url')} required />
              <FileUploadField label="NIC / Driving License – Back" category="nic_back" token={token}
                value={form.nic_back_url} onChange={setUrl('nic_back_url')} required />
              <FileUploadField label="Recent Photo (passport-style)" category="agent_photo" token={token}
                value={form.agent_photo_url} onChange={setUrl('agent_photo_url')} required />
            </>
          )}

          {/* ── Step 2: Bank Details ─────────────────────────── */}
          {step === 2 && (
            <>
              <h2 className="font-bold text-gray-800">Bank Details</h2>
              <p className="text-xs text-gray-500">Used for commission payouts. Ensure accuracy.</p>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Bank Name *</label>
                <input value={form.bank_name} onChange={set('bank_name')} placeholder="e.g. Bank of Ceylon" className={fieldCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Account Holder Name *</label>
                <input value={form.account_holder} onChange={set('account_holder')} placeholder="Full name on account" className={fieldCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Account Number *</label>
                <input value={form.bank_account} onChange={set('bank_account')} placeholder="e.g. 0012345678" className={fieldCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Bank Branch</label>
                <input value={form.bank_branch} onChange={set('bank_branch')} placeholder="e.g. Colombo Main" className={fieldCls} />
              </div>
              <FileUploadField label="Bank Book Photo" category="bank_book" token={token}
                value={form.bank_book_url} onChange={setUrl('bank_book_url')} />
            </>
          )}

          {/* ── Step 3: Agreement ────────────────────────────── */}
          {step === 3 && (
            <>
              <h2 className="font-bold text-gray-800">Agent Agreement</h2>
              <p className="text-sm text-gray-600">
                Please download the agreement, sign it physically, scan or photograph it, then upload the signed copy.
              </p>
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <p className="text-xs text-blue-700 font-medium mb-3">Steps:</p>
                <ol className="text-xs text-blue-700 space-y-1 list-decimal list-inside">
                  <li>Download the agreement PDF below</li>
                  <li>Print and sign the agreement</li>
                  <li>Scan or photograph the signed document</li>
                  <li>Upload the signed copy here</li>
                </ol>
              </div>
              <button
                onClick={handleDownloadAgreement}
                className="flex items-center gap-2 w-full justify-center px-4 py-2.5 border-2 border-green-600 text-green-700 rounded-lg text-sm font-semibold hover:bg-green-50"
              >
                <Download className="w-4 h-4" />
                Download Agreement PDF
              </button>
              <FileUploadField label="Upload Signed Agreement" category="signed_agreement" token={token}
                value={form.signed_agreement_url} onChange={setUrl('signed_agreement_url')} />
              <p className="text-xs text-gray-400 text-center">
                You can also upload the signed agreement later from your agent profile.
              </p>
            </>
          )}

          {/* ── Step 4: Account Setup ────────────────────────── */}
          {step === 4 && (
            <>
              <h2 className="font-bold text-gray-800">Account Setup</h2>
              <p className="text-xs text-gray-500">These will be your login credentials for the Agent Portal.</p>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Email Address *</label>
                <input type="email" value={form.email} onChange={set('email')} placeholder="your@email.com" className={fieldCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Password * (min 8 characters)</label>
                <input type="password" value={form.password} onChange={set('password')} placeholder="••••••••" className={fieldCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Confirm Password *</label>
                <input type="password" value={form.password_confirm} onChange={set('password_confirm')} placeholder="••••••••" className={fieldCls} />
                {form.password && form.password_confirm && form.password !== form.password_confirm && (
                  <p className="text-xs text-red-500 mt-1">Passwords do not match</p>
                )}
              </div>

              {/* Summary */}
              <div className="bg-gray-50 rounded-xl p-4 mt-2 space-y-1">
                <p className="text-xs font-semibold text-gray-600 mb-2">Registration Summary</p>
                <p className="text-xs text-gray-500"><strong>Name:</strong> {form.full_name}</p>
                <p className="text-xs text-gray-500"><strong>NIC:</strong> {form.nic_number}</p>
                <p className="text-xs text-gray-500"><strong>Bank:</strong> {form.bank_name} – {form.bank_account}</p>
                <p className="text-xs text-gray-500"><strong>Email:</strong> {form.email}</p>
                <p className="text-xs text-gray-400 mt-2">
                  Your account will be reviewed by an admin before activation.
                </p>
              </div>
            </>
          )}

          {/* Navigation */}
          <div className="flex gap-3 pt-2">
            {step > 0 && (
              <button
                onClick={() => setStep((s) => s - 1)}
                className="flex items-center gap-1.5 px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
              >
                <ChevronLeft className="w-4 h-4" /> Back
              </button>
            )}
            {step < STEPS.length - 1 ? (
              <button
                onClick={() => setStep((s) => s + 1)}
                disabled={!canProceed()}
                className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 bg-green-700 text-white rounded-lg text-sm font-semibold hover:bg-green-800 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={!canProceed() || submitting}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-green-700 text-white rounded-lg text-sm font-semibold hover:bg-green-800 disabled:opacity-50"
              >
                {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Submitting…</> : 'Submit Registration'}
              </button>
            )}
          </div>
        </div>

        <p className="text-center text-xs text-gray-400 mt-4 pb-8">
          Already have an account?{' '}
          <Link to="/agent/login" className="text-green-700 font-medium hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
