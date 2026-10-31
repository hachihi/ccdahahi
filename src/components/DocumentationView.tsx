import React, { useState } from 'react';
import {
  BookOpen,
  Code2,
  FileText,
  AlertTriangle,
  Play,
  Copy,
  Check,
  Search,
  ExternalLink,
  Cpu,
  Layers,
  Terminal,
  HelpCircle,
  Share2
} from 'lucide-react';
import { DUCUMENTATION_DATA } from '../mock/sampleData';
import { ApiDocItem } from '../types/hachihi';
import { HachihiDataService } from '../services/hachihiService';

interface DocumentationViewProps {
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const DocumentationView: React.FC<DocumentationViewProps> = ({ showToast }) => {
  const [activeDocTab, setActiveDocTab] = useState<'api' | 'cukcuk' | 'sdk' | 'errors' | 'tester'>('api');
  const [selectedApi, setSelectedApi] = useState<ApiDocItem>(DUCUMENTATION_DATA.apiList[0]);
  const [searchQuery, setSearchQuery] = useState('');

  // API Playground State
  const [testerEndpoint, setTesterEndpoint] = useState('/api/faceid/getAllMachine');
  const [testerPayload, setTesterPayload] = useState('{}');
  const [testerResponse, setTesterResponse] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  const filteredApis = DUCUMENTATION_DATA.apiList.filter(api =>
    (api.name + api.url + api.description).toLowerCase().includes(searchQuery.toLowerCase())
  );

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    showToast(`Đã sao chép ${label}`, 'success');
  };

  const handleRunTest = async () => {
    setIsTesting(true);
    setTesterResponse(null);
    try {
      let body = {};
      try {
        body = JSON.parse(testerPayload);
      } catch {
        showToast('Payload JSON không hợp lệ', 'error');
        setIsTesting(false);
        return;
      }
      const res = await HachihiDataService.callHachihiApi(testerEndpoint, body);
      setTesterResponse(JSON.stringify(res, null, 2));
      showToast('Thực thi API thành công', 'success');
    } catch (err: any) {
      setTesterResponse(JSON.stringify({ error: err.message }, null, 2));
      showToast('Lỗi gọi API: ' + err.message, 'error');
    } finally {
      setIsTesting(false);
    }
  };

  const loadApiToTester = (api: ApiDocItem) => {
    setTesterEndpoint(api.url);
    const sampleBody: Record<string, any> = {};
    api.inputParams.forEach(p => {
      if (p.type === 'int') {
        sampleBody[p.field] = parseInt(p.sample, 10) || 1;
      } else if (p.type === 'boolean') {
        sampleBody[p.field] = p.sample === 'true';
      } else {
        sampleBody[p.field] = p.sample || '';
      }
    });
    setTesterPayload(JSON.stringify(sampleBody, null, 2));
    setActiveDocTab('tester');
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Banner */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 text-xs font-semibold mb-2">
            <BookOpen className="w-3.5 h-3.5" />
            Tài liệu Nhà sản xuất Đính kèm
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
            Tài liệu Kỹ thuật Máy Chấm công Khuôn mặt Hachihi
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Bản số hóa đầy đủ của Hachihi Online API v2.0.0, Hướng dẫn tích hợp CUKCUK MISA và Thư viện SDK C# .NET
          </p>
        </div>

        {/* Tab Buttons */}
        <div className="flex flex-wrap gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
          <button
            onClick={() => setActiveDocTab('api')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeDocTab === 'api'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            API Online v2.0 (13 API)
          </button>
          <button
            onClick={() => setActiveDocTab('cukcuk')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeDocTab === 'cukcuk'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Hướng dẫn CUKCUK
          </button>
          <button
            onClick={() => setActiveDocTab('sdk')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeDocTab === 'sdk'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            SDK C# .NET
          </button>
          <button
            onClick={() => setActiveDocTab('errors')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeDocTab === 'errors'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Bảng mã lỗi (FARE)
          </button>
          <button
            onClick={() => setActiveDocTab('tester')}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeDocTab === 'tester'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-emerald-700 dark:text-emerald-400 hover:text-emerald-900'
            }`}
          >
            <Play className="w-3.5 h-3.5" />
            API Playground
          </button>
        </div>
      </div>

      {/* Sub-tab 1: API Online v2.0 */}
      {activeDocTab === 'api' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* List of APIs (4 cols) */}
          <div className="lg:col-span-4 bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col h-[750px]">
            <div className="relative mb-3">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Tìm API..."
                className="w-full pl-8 pr-3 py-1.5 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="overflow-y-auto flex-1 space-y-1 pr-1">
              {filteredApis.map(api => {
                const isSelected = selectedApi.id === api.id;
                return (
                  <button
                    key={api.id}
                    onClick={() => setSelectedApi(api)}
                    className={`w-full text-left p-3 rounded-xl transition ${
                      isSelected
                        ? 'bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        #{api.stt} {api.name}
                      </span>
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                        {api.method}
                      </span>
                    </div>
                    <p className="text-xs text-slate-800 dark:text-slate-200 font-mono mt-1 truncate">
                      {api.url}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-1">
                      {api.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* API Detail Card (8 cols) */}
          <div className="lg:col-span-8 bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-5 overflow-y-auto max-h-[750px]">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-md font-mono text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-400">
                    {selectedApi.method}
                  </span>
                  <h3 className="font-bold text-lg text-slate-900 dark:text-white font-mono">
                    {selectedApi.url}
                  </h3>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-300 mt-1.5">
                  {selectedApi.description}
                </p>
              </div>

              <button
                onClick={() => loadApiToTester(selectedApi)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm transition"
              >
                <Play className="w-3.5 h-3.5" />
                Thử nghiệm API
              </button>
            </div>

            {/* Headers */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                HTTP Request Headers
              </h4>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 font-mono text-xs space-y-1">
                {Object.entries(selectedApi.headers).map(([k, v]) => (
                  <div key={k} className="flex">
                    <span className="w-32 font-bold text-slate-700 dark:text-slate-300">{k}:</span>
                    <span className="text-slate-600 dark:text-slate-400 truncate">{v}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Input Parameters */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                Tham số đầu vào (Input Parameters)
              </h4>
              {selectedApi.inputParams.length === 0 ? (
                <p className="text-xs text-slate-400 italic">Không có tham số đầu vào (Body rỗng hoặc không bắt buộc)</p>
              ) : (
                <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold">
                      <tr>
                        <th className="p-2.5">Trường</th>
                        <th className="p-2.5">Kiểu</th>
                        <th className="p-2.5">Mô tả</th>
                        <th className="p-2.5">Giá trị mẫu</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                      {selectedApi.inputParams.map((p, idx) => (
                        <tr key={idx}>
                          <td className="p-2.5 font-bold text-slate-800 dark:text-slate-200">
                            {p.field}
                            {p.required && <span className="text-rose-500 ml-1">*</span>}
                          </td>
                          <td className="p-2.5 text-blue-600 dark:text-blue-400">{p.type}</td>
                          <td className="p-2.5 font-sans text-slate-600 dark:text-slate-400">{p.description}</td>
                          <td className="p-2.5 text-emerald-600 dark:text-emerald-400">{p.sample || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Output Parameters */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                Kết quả trả về (Output Parameters)
              </h4>
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold">
                    <tr>
                      <th className="p-2.5">Trường</th>
                      <th className="p-2.5">Kiểu</th>
                      <th className="p-2.5">Mô tả</th>
                      <th className="p-2.5">Mẫu</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                    {selectedApi.outputParams.map((p, idx) => (
                      <tr key={idx}>
                        <td className="p-2.5 font-bold text-slate-800 dark:text-slate-200">{p.field}</td>
                        <td className="p-2.5 text-blue-600 dark:text-blue-400">{p.type || 'string'}</td>
                        <td className="p-2.5 font-sans text-slate-600 dark:text-slate-400">{p.description}</td>
                        <td className="p-2.5 text-emerald-600 dark:text-emerald-400">{p.sample || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Error Codes for this API */}
            {selectedApi.errorCodes && selectedApi.errorCodes.length > 0 && (
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                  Mã lỗi thường gặp
                </h4>
                <div className="space-y-1.5">
                  {selectedApi.errorCodes.map(err => (
                    <div
                      key={err.code}
                      className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 flex items-center gap-3 text-xs"
                    >
                      <code className="font-bold text-rose-600 dark:text-rose-400 w-24">
                        {err.code}
                      </code>
                      <span className="text-slate-700 dark:text-slate-300">{err.message}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Sub-tab 2: CUKCUK MISA Integration Guide */}
      {activeDocTab === 'cukcuk' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
          <div className="flex items-center gap-3 pb-4 border-b border-slate-200 dark:border-slate-800">
            <div className="p-3 rounded-2xl bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400">
              <Share2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-slate-900 dark:text-white">
                Hướng dẫn Kết nối Máy Chấm công Nhận diện Khuôn mặt Hachihi (Chuẩn CUKCUK / MISA)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Tài liệu tích hợp chính thức giữa CukCuk Chấm công và Công ty TNHH Phần mềm JDI (Hachihi)
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="font-bold text-sm text-slate-900 dark:text-white">
              Các thông số kết nối bắt buộc:
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase block mb-1">
                  1. Website Hachihi
                </span>
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  Địa chỉ URL tên miền riêng do Hachihi cấp (ví dụ: <code className="font-mono">https://ten_don_vi.hachihi.vn</code>).
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                <span className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase block mb-1">
                  2. Api Secret Key
                </span>
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  Đăng nhập web Hachihi &rarr; <strong>Cài đặt &rarr; Tích hợp API</strong> &rarr; Sao chép mã <strong>Api Secret Key</strong>.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                <span className="text-xs font-bold text-teal-600 dark:text-teal-400 uppercase block mb-1">
                  3. Mã thiết bị (MachineBoxId)
                </span>
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  Vào menu <strong>Thiết bị</strong> trên web Hachihi, xem cột <em>Tên thiết bị</em> và sao chép mã số ở dòng dưới.
                </p>
              </div>
            </div>

            <div className="mt-6 p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900">
              <h5 className="font-bold text-xs uppercase text-emerald-800 dark:text-emerald-300 mb-2">
                Trình tự các bước thực hiện trên ứng dụng này:
              </h5>
              <ol className="space-y-2 text-xs text-slate-700 dark:text-slate-300 list-decimal pl-5">
                {DUCUMENTATION_DATA.cukcukGuide.map((step, idx) => (
                  <li key={idx} className="leading-relaxed">{step}</li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      )}

      {/* Sub-tab 3: C# SDK */}
      {activeDocTab === 'sdk' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
          <div className="flex items-center gap-3 pb-4 border-b border-slate-200 dark:border-slate-800">
            <div className="p-3 rounded-2xl bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-400">
              <Cpu className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-slate-900 dark:text-white">
                Thư viện SDK Hachihi Face cho Ứng dụng Desktop (C# .NET 4.5.2+)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Tài liệu tích hợp tệp thư viện <code className="font-mono">Hachihi.SDK.dll</code> và file bản quyền <code className="font-mono">mã_face.jdilic</code>
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="py-3 px-3">Tên hàm trong class FaceConnector</th>
                  <th className="py-3 px-3">Mô tả chức năng</th>
                  <th className="py-3 px-3">Tham số đầu vào (Input)</th>
                  <th className="py-3 px-3">Kết quả trả về (Output)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {DUCUMENTATION_DATA.csharpSdkMethods.map((m, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                    <td className="py-3 px-3 font-mono font-bold text-blue-600 dark:text-blue-400">
                      {m.name}
                    </td>
                    <td className="py-3 px-3 text-slate-700 dark:text-slate-300">
                      {m.description}
                    </td>
                    <td className="py-3 px-3 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                      {m.input}
                    </td>
                    <td className="py-3 px-3 font-mono text-[11px] text-emerald-600 dark:text-emerald-400">
                      {m.output}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Sub-tab 4: Error Codes Matrix */}
      {activeDocTab === 'errors' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            <h3 className="font-bold text-base text-slate-900 dark:text-white">
              Bảng tra cứu mã lỗi thiết bị Hachihi (Error Code Reference)
            </h3>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Tổng hợp tất cả các mã lỗi trả về từ API và SDK của thiết bị chấm công nhận diện khuôn mặt Hachihi
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="py-3 px-4 w-28">Mã lỗi</th>
                  <th className="py-3 px-4">Ý nghĩa thông báo</th>
                  <th className="py-3 px-4">Giải pháp & Cách xử lý</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {DUCUMENTATION_DATA.errorCodes.map((err, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                    <td className="py-3 px-4 font-mono font-bold text-rose-600 dark:text-rose-400">
                      {err.code}
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-800 dark:text-slate-200">
                      {err.message}
                    </td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-400 leading-relaxed">
                      {err.solution}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Sub-tab 5: API Playground */}
      {activeDocTab === 'tester' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Terminal className="w-5 h-5 text-emerald-500" />
              <h3 className="font-bold text-base text-slate-900 dark:text-white">
                Trình thử nghiệm API Trực quan (API Playground)
              </h3>
            </div>
            <span className="text-xs text-slate-400">
              Kiểm tra nhanh các lệnh POST tới hệ thống Hachihi
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Request Builder */}
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Đường dẫn API (Endpoint)
                </label>
                <div className="flex gap-2">
                  <span className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 font-mono text-xs font-bold text-emerald-600 flex items-center">
                    POST
                  </span>
                  <input
                    type="text"
                    value={testerEndpoint}
                    onChange={e => setTesterEndpoint(e.target.value)}
                    className="flex-1 px-3.5 py-2 rounded-xl text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Request Payload (JSON)
                </label>
                <textarea
                  rows={10}
                  value={testerPayload}
                  onChange={e => setTesterPayload(e.target.value)}
                  className="w-full p-3 rounded-xl text-xs bg-slate-950 font-mono text-emerald-400 border border-slate-800 focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>

              <button
                onClick={handleRunTest}
                disabled={isTesting}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs sm:text-sm shadow-md shadow-emerald-500/20 disabled:opacity-50 transition"
              >
                <Play className="w-4 h-4" />
                {isTesting ? 'Đang gửi yêu cầu...' : 'Gửi yêu cầu thử nghiệm'}
              </button>
            </div>

            {/* Response Viewer */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Phản hồi từ Server (Response)
                </label>
                {testerResponse && (
                  <button
                    onClick={() => copyToClipboard(testerResponse, 'Response JSON')}
                    className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1"
                  >
                    <Copy className="w-3.5 h-3.5" /> Sao chép
                  </button>
                )}
              </div>
              <div className="w-full h-[330px] p-3 rounded-xl bg-slate-950 font-mono text-xs text-slate-200 border border-slate-800 overflow-auto">
                {testerResponse ? (
                  <pre>{testerResponse}</pre>
                ) : (
                  <p className="text-slate-500 italic">Bấm "Gửi yêu cầu thử nghiệm" để xem kết quả phản hồi tại đây.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
