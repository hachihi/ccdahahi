import { DahahiMachine, Employee, AttendanceLog, SystemUser, UserRole, UserPermission, ApiDocItem } from '../types/dahahi';

export const PERMISSION_LIST: UserPermission[] = [
  {
    key: 'manage_devices',
    label: 'Quản lý thiết bị & Kết nối',
    description: 'Thêm, sửa, ngắt kết nối máy chấm công Dahahi, kiểm tra kết nối API'
  },
  {
    key: 'manage_employees',
    label: 'Quản lý nhân viên',
    description: 'Thêm mới, chỉnh sửa thông tin, xóa nhân viên và nhập/xuất file CSV'
  },
  {
    key: 'manage_faces',
    label: 'Quản lý ảnh khuôn mặt (Face ID)',
    description: 'Chụp webcam, tải ảnh lên, tải ảnh về máy tính, đẩy ảnh lên máy chấm công'
  },
  {
    key: 'sync_data',
    label: 'Đồng bộ dữ liệu',
    description: 'Đồng bộ lịch sử quẹt thẻ từ máy, sao chép khuôn mặt giữa các máy'
  },
  {
    key: 'view_reports',
    label: 'Xem & Xuất báo cáo',
    description: 'Xem lịch sử chấm công, xem bảng tổng hợp công tháng, tải file CSV/Excel'
  },
  {
    key: 'manage_users',
    label: 'Quản trị người dùng & Phân quyền',
    description: 'Tạo tài khoản, đổi mật khẩu, phân bổ vai trò và quyền hạn truy cập'
  },
  {
    key: 'danger_actions',
    label: 'Thao tác nguy hiểm',
    description: 'Xóa toàn bộ khuôn mặt trên thiết bị (ClearAllPerson), xóa trắng dữ liệu'
  }
];

export const DEFAULT_ROLES: UserRole[] = [
  {
    id: 'SUPER_ADMIN',
    name: 'Quản trị viên tối cao (Super Admin)',
    description: 'Toàn quyền điều hành toàn bộ hệ thống, thiết bị và tài khoản người dùng',
    badgeColor: 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400 border-rose-200 dark:border-rose-900',
    permissions: [
      'manage_devices',
      'manage_employees',
      'manage_faces',
      'sync_data',
      'view_reports',
      'manage_users',
      'danger_actions'
    ]
  },
  {
    id: 'HR_MANAGER',
    name: 'Quản lý Nhân sự (HR Manager)',
    description: 'Quản lý hồ sơ nhân viên, ảnh khuôn mặt, đẩy dữ liệu và lập bảng công tháng',
    badgeColor: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900',
    permissions: [
      'manage_employees',
      'manage_faces',
      'sync_data',
      'view_reports'
    ]
  },
  {
    id: 'TECHNICIAN',
    name: 'Kỹ thuật viên Thiết bị (Technician)',
    description: 'Quản lý kết nối phần cứng Dahahi, sao chép dữ liệu giữa các máy, kiểm tra online',
    badgeColor: 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400 border-blue-200 dark:border-blue-900',
    permissions: [
      'manage_devices',
      'sync_data',
      'manage_faces',
      'view_reports'
    ]
  },
  {
    id: 'VIEWER',
    name: 'Nhân viên Xem báo cáo (Auditor / Viewer)',
    description: 'Chỉ xem danh sách nhân viên, lịch sử chấm công và xuất file báo cáo',
    badgeColor: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700',
    permissions: [
      'view_reports'
    ]
  }
];

// Initial real admin user account - no demo accounts
export const INITIAL_USERS: SystemUser[] = [
  {
    id: 'usr-admin',
    username: 'admin',
    fullName: 'Quản trị viên Hệ thống',
    email: 'admin@dahahi.local',
    role: 'SUPER_ADMIN',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    isActive: true,
    createdAt: new Date().toISOString().replace('T', ' ').slice(0, 19),
    lastLogin: new Date().toISOString().replace('T', ' ').slice(0, 19)
  }
];

// Real operational environment - completely clean, NO demo/dummy data
export const INITIAL_MACHINES: DahahiMachine[] = [];
export const SAMPLE_EMPLOYEES: Employee[] = [];
export const SAMPLE_LOGS: AttendanceLog[] = [];

export const DUCUMENTATION_DATA: {
  apiList: ApiDocItem[];
  cukcukGuide: string[];
  csharpSdkMethods: { name: string; description: string; input: string; output: string }[];
  errorCodes: { code: string; message: string; solution: string }[];
} = {
  apiList: [
    {
      id: 'getEmployeeList',
      stt: 13,
      name: 'GetEmployeeList',
      url: '/api/facereg/GetEmployeeList',
      method: 'POST',
      description: 'Lấy danh sách toàn bộ nhân viên được lưu trên Cloud Dahahi (Phiên bản v2.0.0). Dùng để đồng bộ danh bạ ban đầu.',
      headers: {
        'Content-Type': 'application/json',
        'AppKey': 'k77hcPwEXB4LTdJv96mz',
        'SecretKey': 'Lấy từ web Dahahi -> Cài đặt -> Tích hợp API'
      },
      inputParams: [
        { field: 'FullName', type: 'string', required: false, description: 'Tìm theo tên nhân viên (để trống để lấy tất cả)', sample: 'Nam' },
        { field: 'PageIndex', type: 'int', required: true, description: 'Số trang cần lấy (bắt đầu từ 1)', sample: '1' },
        { field: 'PageSize', type: 'int', required: true, description: 'Số bản ghi trên mỗi trang', sample: '50' }
      ],
      outputParams: [
        { field: 'ErrorCode', type: 'string', description: '000000: Thành công', sample: '000000' },
        { field: 'ErrorMessage', type: 'string', description: 'Thông báo kết quả', sample: 'Thành công' },
        { field: 'Total', type: 'int', description: 'Tổng số nhân viên', sample: '120' },
        { field: 'Data[].EmployeeCode', type: 'string', description: 'Mã nhân viên', sample: 'EMP001' },
        { field: 'Data[].Name', type: 'string', description: 'Họ tên nhân viên', sample: 'Nguyễn Văn An' },
        { field: 'Data[].RegisteredFace', type: 'boolean', description: 'Đã đăng ký khuôn mặt hay chưa', sample: 'true' },
        { field: 'Data[].FacePersionId', type: 'string', description: 'ID người dùng duy nhất trên thiết bị', sample: '101' }
      ],
      errorCodes: [
        { code: '000000', message: 'Thành công' },
        { code: 'FARE0008', message: 'Mã thiết bị không tồn tại' },
        { code: 'FARE0013', message: 'Tìm kiếm lỗi hoặc timeout' }
      ]
    },
    {
      id: 'getInfo',
      stt: 1,
      name: 'getInfo',
      url: '/api/facereg/getInfo',
      method: 'POST',
      description: 'Lấy thông tin và ảnh khuôn mặt gốc (Base64) của một người dùng đã đăng ký trên máy chấm công.',
      headers: {
        'Content-Type': 'application/json',
        'AppKey': 'k77hcPwEXB4LTdJv96mz',
        'SecretKey': 'Api Secret Key của đơn vị'
      },
      inputParams: [
        { field: 'FacePersionId', type: 'string', required: true, description: 'ID duy nhất của nhân viên trên máy', sample: '101' },
        { field: 'MachineBoxId', type: 'string', required: true, description: 'Mã định danh phần cứng máy chấm công', sample: '1468063' }
      ],
      outputParams: [
        { field: 'ErrorCode', type: 'string', description: '000000: Thành công', sample: '000000' },
        { field: 'ErrorMessage', type: 'string', description: 'Thông báo kết quả', sample: 'Thành công' },
        { field: 'Data.FacePersonId', type: 'string', description: 'Mã người dùng', sample: '101' },
        { field: 'Data.FullName', type: 'string', description: 'Họ và tên', sample: 'Nguyễn Văn An' },
        { field: 'Data.Base64Image', type: 'string', description: 'Chuỗi ảnh base64 chụp khi đăng ký trên thiết bị', sample: '/9j/4AAQSkZJRg...' }
      ],
      errorCodes: [
        { code: '000000', message: 'Thành công' },
        { code: 'FARE0008', message: 'Mã thiết bị không tồn tại' },
        { code: 'FARE0012', message: 'Người dùng không tồn tại trên thiết bị' }
      ]
    },
    {
      id: 'edit',
      stt: 2,
      name: 'edit',
      url: '/api/facereg/edit',
      method: 'POST',
      description: 'Đăng ký mới hoặc sửa thông tin người dùng kèm ảnh khuôn mặt (Base64) lên máy chấm công Dahahi.',
      headers: {
        'Content-Type': 'application/json',
        'AppKey': 'k77hcPwEXB4LTdJv96mz',
        'SecretKey': 'Api Secret Key của đơn vị'
      },
      inputParams: [
        { field: 'FacePersionId', type: 'string', required: true, description: 'ID duy nhất của nhân viên trên máy (string)', sample: '101' },
        { field: 'MachineBoxId', type: 'string', required: true, description: 'Mã thiết bị (MachineBoxId)', sample: '1468063' },
        { field: 'FullName', type: 'string', required: true, description: 'Họ tên nhân viên (tối đa 32 ký tự)', sample: 'Nguyễn Văn An' },
        { field: 'Base64Image', type: 'string', required: true, description: 'Ảnh khuôn mặt chuyển sang dạng base64 (chuẩn hóa <= 480px)', sample: 'iVBORw0KGgo...' },
        { field: 'FromTimeStr', type: 'string', required: false, description: 'Thời gian bắt đầu hợp lệ checkin (dd/MM/yyyy HH:mm:ss)', sample: '01/01/2026 00:00:00' },
        { field: 'ToTimeStr', type: 'string', required: false, description: 'Thời gian kết thúc hợp lệ checkin (dd/MM/yyyy HH:mm:ss)', sample: '31/12/2028 23:59:59' }
      ],
      outputParams: [
        { field: 'ErrorCode', type: 'string', description: '000000: Thành công', sample: '000000' },
        { field: 'ErrorMessage', type: 'string', description: 'Thông báo kết quả', sample: 'Thành công' }
      ],
      errorCodes: [
        { code: '000000', message: 'Thành công' },
        { code: 'FARE0001', message: 'Lỗi không thấy khuôn mặt trong ảnh' },
        { code: 'FARE0006', message: 'Face persionid không hợp lệ' },
        { code: 'FARE0008', message: 'Mã thiết bị không tồn tại' },
        { code: 'FARE0009', message: 'Ảnh base64 không hợp lệ hoặc kích thước vượt quá bộ đệm' }
      ]
    },
    {
      id: 'remove',
      stt: 3,
      name: 'remove',
      url: '/api/facereg/remove',
      method: 'POST',
      description: 'Xóa thông tin người dùng và dữ liệu khuôn mặt trên máy chấm công Dahahi.',
      headers: {
        'Content-Type': 'application/json',
        'AppKey': 'k77hcPwEXB4LTdJv96mz',
        'SecretKey': 'Api Secret Key'
      },
      inputParams: [
        { field: 'FacePersionId', type: 'string', required: true, description: 'ID người dùng cần xóa', sample: '101' },
        { field: 'MachineBoxId', type: 'string', required: true, description: 'Mã thiết bị chấm công', sample: '1468063' }
      ],
      outputParams: [
        { field: 'ErrorCode', type: 'string', description: '000000: Thành công', sample: '000000' },
        { field: 'ErrorMessage', type: 'string', description: 'Thông báo kết quả', sample: 'Thành công' }
      ],
      errorCodes: [
        { code: '000000', message: 'Thành công' },
        { code: 'FARE0008', message: 'Mã thiết bị không tồn tại' },
        { code: 'FARE0012', message: 'Người dùng không tồn tại trên thiết bị' }
      ]
    },
    {
      id: 'checkinhis',
      stt: 4,
      name: 'checkinhis',
      url: '/api/facereg/checkinhis',
      method: 'POST',
      description: 'Lấy lịch sử checkin (quẹt khuôn mặt) đã lưu trên máy chấm công trong khoảng thời gian chỉ định.',
      headers: {
        'Content-Type': 'application/json',
        'AppKey': 'k77hcPwEXB4LTdJv96mz',
        'SecretKey': 'Api Secret Key'
      },
      inputParams: [
        { field: 'MachineBoxId', type: 'string', required: true, description: 'Mã thiết bị faceid', sample: '1468063' },
        { field: 'FacePersionId', type: 'string', required: false, description: 'Lọc theo ID nhân viên (để trống nếu lấy tất cả)', sample: '' },
        { field: 'EmployeeCode', type: 'string', required: false, description: 'Lọc theo mã nhân viên', sample: '' },
        { field: 'FromTimeStr', type: 'string', required: true, description: 'Thời gian bắt đầu tìm kiếm (dd/MM/yyyy HH:mm:ss)', sample: '01/10/2026 00:00:00' },
        { field: 'ToTimeStr', type: 'string', required: true, description: 'Thời gian kết thúc tìm kiếm (dd/MM/yyyy HH:mm:ss)', sample: '31/10/2026 23:59:59' },
        { field: 'pageIndex', type: 'int', required: true, description: 'Trang bắt đầu lấy dữ liệu (1-based)', sample: '1' },
        { field: 'PageSize', type: 'int', required: true, description: 'Số bản ghi mỗi trang (tối đa 200)', sample: '100' }
      ],
      outputParams: [
        { field: 'ErrorCode', type: 'string', description: '000000: Thành công', sample: '000000' },
        { field: 'Total', type: 'int', description: 'Tổng số bản ghi checkin tìm thấy', sample: '345' },
        { field: 'Data[].FacePersionId', type: 'string', description: 'Mã nhân viên chấm công', sample: '101' },
        { field: 'Data[].CheckinTimeStr', type: 'string', description: 'Thời gian checkin (dd/MM/yyyy HH:mm:ss)', sample: '21/10/2026 08:14:22' },
        { field: 'Data[].FaceId', type: 'string', description: 'Mã thiết bị chấm công', sample: '1468063' },
        { field: 'Data[].EmployeCode', type: 'string', description: 'Mã nhân viên nghiệp vụ', sample: 'EMP001' }
      ]
    },
    {
      id: 'searchByName',
      stt: 5,
      name: 'searchByName',
      url: '/api/facereg/searchByName',
      method: 'POST',
      description: 'Tìm kiếm người dùng đã đăng ký khuôn mặt trên máy chấm công theo tên.',
      headers: {
        'Content-Type': 'application/json',
        'AppKey': 'k77hcPwEXB4LTdJv96mz',
        'SecretKey': 'Api Secret Key'
      },
      inputParams: [
        { field: 'FullName', type: 'string', required: false, description: 'Tên người dùng cần tìm (để trống lấy tất cả)', sample: '' },
        { field: 'MachineBoxId', type: 'string', required: false, description: 'Mã thiết bị (tùy chọn, để trống tìm toàn bộ đơn vị)', sample: '1468063' },
        { field: 'pageIndex', type: 'int', required: true, description: 'Thứ tự trang cần lấy dữ liệu', sample: '1' },
        { field: 'PageSize', type: 'int', required: true, description: 'Số bản ghi lấy mỗi trang', sample: '50' }
      ],
      outputParams: [
        { field: 'ErrorCode', type: 'string', description: '000000: Thành công', sample: '000000' },
        { field: 'Total', type: 'int', description: 'Tổng số người tìm thấy', sample: '4' },
        { field: 'Data[].Name', type: 'string', description: 'Tên người dùng', sample: 'Nguyễn Văn An' },
        { field: 'Data[].FacePersionId', type: 'string', description: 'ID người dùng', sample: '101' },
        { field: 'Data[].MachineBoxId', type: 'string', description: 'Thiết bị đăng ký face', sample: '1468063' }
      ]
    },
    {
      id: 'getAllMachine',
      stt: 9,
      name: 'getAllMachine',
      url: '/api/faceid/getAllMachine',
      method: 'POST',
      description: 'Lấy toàn bộ danh sách máy chấm công Dahahi đã đăng ký dưới tài khoản của đơn vị.',
      headers: {
        'Content-Type': 'application/json',
        'AppKey': 'k77hcPwEXB4LTdJv96mz',
        'SecretKey': 'Api Secret Key'
      },
      inputParams: [],
      outputParams: [
        { field: 'ErrorCode', type: 'string', description: '000000: Thành công', sample: '000000' },
        { field: 'Data[].MachineName', type: 'string', description: 'Tên thiết bị (ví dụ Cửa chính VP1)', sample: 'VP305' },
        { field: 'Data[].MachineCode', type: 'string', description: 'Mã thiết bị phần cứng', sample: 'MAC0000018' },
        { field: 'Data[].MachineBoxId', type: 'string', description: 'ID định danh thiết bị duy nhất', sample: '1708924' }
      ]
    },
    {
      id: 'syncFace',
      stt: 7,
      name: 'SyncFace',
      url: '/api/facereg/SyncFace',
      method: 'POST',
      description: 'Đồng bộ / sao chép toàn bộ dữ liệu khuôn mặt đã đăng ký từ máy nguồn sang máy đích.',
      headers: {
        'Content-Type': 'application/json',
        'AppKey': 'k77hcPwEXB4LTdJv96mz',
        'SecretKey': 'Api Secret Key'
      },
      inputParams: [
        { field: 'FromMachineBoxId', type: 'string', required: true, description: 'Mã thiết bị faceid nguồn được copy', sample: '1468063' },
        { field: 'ToMachineBoxId', type: 'string', required: true, description: 'Mã thiết bị faceid đích sẽ nhận khuôn mặt', sample: '1708924' }
      ],
      outputParams: [
        { field: 'ErrorCode', type: 'string', description: '000000: Gửi lệnh thành công', sample: '000000' },
        { field: 'Total', type: 'int', description: 'Tổng số bản ghi sẽ được copy', sample: '42' },
        { field: 'Data[0]', type: 'string', description: 'ID bản ghi của request gửi lệnh để tra cứu kết quả', sample: 'req_sync_99182' }
      ]
    },
    {
      id: 'getSyncFace',
      stt: 8,
      name: 'GetSyncFace',
      url: '/api/facereg/GetSyncFace',
      method: 'POST',
      description: 'Kiểm tra trạng thái xử lý đồng bộ khuôn mặt giữa 2 máy thông qua ID yêu cầu.',
      headers: {
        'Content-Type': 'application/json',
        'AppKey': 'k77hcPwEXB4LTdJv96mz',
        'SecretKey': 'Api Secret Key'
      },
      inputParams: [
        { field: 'IdStr', type: 'string', required: true, description: 'ID bản ghi đồng bộ trả về từ API SyncFace', sample: 'req_sync_99182' }
      ],
      outputParams: [
        { field: 'ErrorCode', type: 'string', description: '000000: Thành công', sample: '000000' },
        { field: 'Data[0].Status', type: 'int', description: '0: Chờ xử lý, 1: Đang xử lý, 2: Xử lý thành công, 3: Xử lý lỗi', sample: '2' },
        { field: 'Data[0].Total', type: 'int', description: 'Tổng số bản ghi cần đồng bộ', sample: '42' },
        { field: 'Data[0].TotalRegistered', type: 'int', description: 'Số bản ghi đã đồng bộ thành công', sample: '42' }
      ]
    },
    {
      id: 'clearAllPerson',
      stt: 6,
      name: 'ClearAllPerson',
      url: '/api/facereg/ClearAllPerson',
      method: 'POST',
      description: 'Xóa toàn bộ khuôn mặt đã đăng ký trên máy chấm công. Thiết bị sẽ tự động RESTART lại sau khi hoàn thành.',
      headers: {
        'Content-Type': 'application/json',
        'AppKey': 'k77hcPwEXB4LTdJv96mz',
        'SecretKey': 'Api Secret Key'
      },
      inputParams: [
        { field: 'MachineBoxId', type: 'string', required: true, description: 'Mã định danh thiết bị', sample: '1468063' }
      ],
      outputParams: [
        { field: 'ErrorCode', type: 'string', description: '000000: Thành công', sample: '000000' },
        { field: 'ErrorMessage', type: 'string', description: 'Thông báo kết quả', sample: 'Thành công' }
      ]
    },
    {
      id: 'checkinCallback',
      stt: 11,
      name: 'Checkin Callback Webhook',
      url: 'http(s)://<server>/callback/checkin',
      method: 'POST',
      description: 'Máy chấm công Dahahi tự động gọi đến URL này ngay tức thì khi nhân viên vừa quẹt mặt.',
      headers: {
        'Content-Type': 'application/json'
      },
      inputParams: [
        { field: 'FacePersonId', type: 'string', required: true, description: 'Mã ID người dùng khi đăng ký face', sample: '101' },
        { field: 'MachineBoxId', type: 'string', required: true, description: 'Mã thiết bị face vừa checkin', sample: '1468063' },
        { field: 'CheckinTime', type: 'string', required: true, description: 'Thời gian dd/MM/yyyy HH:mm:ss', sample: '21/10/2026 08:14:22' },
        { field: 'Temperature', type: 'float', required: false, description: 'Nhiệt độ cơ thể (nếu máy có đo thân nhiệt)', sample: '36.5' }
      ],
      outputParams: [
        { field: 'ErrorCode', type: 'string', description: 'Đối tác trả về 000000 để xác nhận đã nhận', sample: '000000' }
      ]
    },
    {
      id: 'heartbeatCallback',
      stt: 12,
      name: 'Heartbeat Callback Webhook',
      url: 'http(s)://<server>/callback/heartbeat',
      method: 'POST',
      description: 'Máy chấm công Dahahi gọi định kỳ (mỗi 1-3 phút) để thông báo máy đang online hay offline.',
      headers: {
        'Content-Type': 'application/json'
      },
      inputParams: [
        { field: 'MachineBoxId', type: 'string', required: true, description: 'Mã ID của máy chấm công', sample: '1468063' },
        { field: 'MachineTime', type: 'string', required: true, description: 'Thời gian hiện tại của máy (dd/MM/yyyy HH:mm:ss)', sample: '21/10/2026 19:55:00' }
      ],
      outputParams: [
        { field: 'ErrorCode', type: 'string', description: 'Đối tác trả về 000000 để phản hồi', sample: '000000' }
      ]
    }
  ],
  cukcukGuide: [
    'Bước 1: Đăng nhập vào trang quản trị Dahahi được cấp (ví dụ: https://congty.dahahi.vn).',
    'Bước 2: Vào menu "Cài đặt" -> "Tích hợp API". Tại đây hệ thống hiển thị "Api Secret Key". Hãy bấm sao chép khóa này.',
    'Bước 3: Vào menu "Thiết bị", tại danh sách thiết bị bạn sẽ thấy cột "Tên thiết bị". Sao chép dãy mã số ở dòng dưới cùng (đây chính là Mã thiết bị / MachineBoxId, ví dụ: 1468063).',
    'Bước 4: Mở ứng dụng Quản lý Máy Chấm Công Dahahi -> chuyển sang tab "Kết nối máy" -> điền Website Dahahi, dán Api Secret Key và Mã thiết bị (Serial) -> bấm "Kết nối".',
    'Bước 5 (Tùy chọn nhận dữ liệu tự động theo thời gian thực): Điền vào mục CallBack Api Url và Heat Beat Api Url địa chỉ máy chủ của bạn để nhận sự kiện quẹt thẻ tức thì.'
  ],
  csharpSdkMethods: [
    { name: 'GetTime', description: 'Lấy thời gian thực tế cài đặt trên phần cứng thiết bị', input: 'ip, faceId, userName, password', output: 'DateTime, ErrorCode' },
    { name: 'SetTime', description: 'Thiết lập và đồng bộ giờ hệ thống vào máy chấm công', input: 'ip, faceId, newDateTime, userName, password', output: 'bool, ErrorCode' },
    { name: 'AddPerson', description: 'Thêm mới hoặc đăng ký khuôn mặt người dùng đơn lẻ hoặc theo lô (List)', input: 'ip, faceId, regInfo (Name, Base64Image, FacePersonId, BeginTime, EndTime)', output: 'bool, ErrorCode' },
    { name: 'EditPerson', description: 'Cập nhật lại thông tin hoặc ảnh khuôn mặt người dùng trên thiết bị', input: 'ip, faceId, regInfo', output: 'bool, ErrorCode' },
    { name: 'DeletePerson', description: 'Xóa người dùng đơn lẻ hoặc theo danh sách ID', input: 'ip, faceId, facePersonId / facePersonIdList', output: 'bool, ErrorCode' },
    { name: 'GetPerson', description: 'Lấy thông tin và ảnh khuôn mặt Base64 của người dùng trên máy', input: 'ip, faceId, facePersonId', output: 'Name, Base64Image, FacePersonId' },
    { name: 'GetLogs', description: 'Lấy lịch sử checkin lưu trữ trong ROM máy kèm ảnh snapshot và thân nhiệt', input: 'ip, faceId, beginTime, endTime, pageIndex, pageSize, getPicture', output: 'List<CheckinLog>, total, errorCode' },
    { name: 'GetCenterConnection', description: 'Lấy thông tin thiết lập máy chủ trung tâm (Center IP, Port, User, Pwd)', input: 'ip, faceId', output: 'CenterUrl, CenterPort, SendSnapImage...' },
    { name: 'SetCenterConnection', description: 'Cấu hình đẩy dữ liệu về trung tâm giám sát qua TCP/IP', input: 'ip, faceId, ConnectCenter, CenterUrl, CenterPort, CenterUser, CenterPwd', output: 'bool, ErrorCode' },
    { name: 'GetSubscribe', description: 'Lấy thông tin cấu hình webhook callback hiện hành của máy', input: 'ip, faceId', output: 'SubscribeAddr, Topics, SnapUrl, VerifyUrl, HeartBeatUrl' },
    { name: 'Subscribe', description: 'Thiết lập các URL nhận sự kiện checkin, snap và heartbeat từ máy', input: 'ip, faceId, SubscribeAddr, Topics, SnapUrl, VerifyUrl, HeartBeatUrl', output: 'bool, ErrorCode' },
    { name: 'ClearLog', description: 'Xóa sạch lịch sử quẹt thẻ trong bộ nhớ máy chấm công', input: 'ip, faceId, userName, password', output: 'bool, ErrorCode' },
    { name: 'SearchPerson', description: 'Tìm người dùng theo tên trên thiết bị có kèm ảnh hay không', input: 'ip, faceId, name, pageIndex, pageSize, getPicture', output: 'List<PersonInfo>, ErrorCode' },
    { name: 'SearchPicture', description: 'Tìm kiếm người dùng có khuôn mặt tương đồng với ảnh mẫu tải lên (1:N matching)', input: 'ip, faceId, pictureBase64', output: 'Name, FacePersonId, similarity' },
    { name: 'GetSnapShot', description: 'Lấy danh sách ảnh chụp người lạ (chưa đăng ký) đi qua máy', input: 'ip, faceId, fromTime, toTime, limit', output: 'List<SnapShot>' }
  ],
  errorCodes: [
    { code: '000000', message: 'Thành công (Request executed successfully)', solution: 'Yêu cầu được thực thi chính xác.' },
    { code: 'FARE0001', message: 'Lỗi không thấy khuôn mặt trong ảnh', solution: 'Ảnh chụp bị tối, mờ, bị che khuất hoặc không có mặt người. Vui lòng chụp lại ảnh rõ nét, nhìn thẳng, không đeo kính râm hoặc khẩu trang.' },
    { code: 'FARE0006', message: 'Face persionid không hợp lệ', solution: 'ID nhân viên không được để trống hoặc chứa ký tự đặc biệt không hợp lệ.' },
    { code: 'FARE0008', message: 'Mã thiết bị không tồn tại', solution: 'Kiểm tra lại MachineBoxId xem đã nhập đúng với mã trên web Dahahi hay chưa.' },
    { code: 'FARE0009', message: 'Ảnh base64 không hợp lệ', solution: 'Định dạng base64 sai hoặc kích thước file ảnh quá lớn (> 1MB). Hệ thống đã tự động nén ảnh về <= 480px để tối ưu.' },
    { code: 'FARE0011', message: 'Mã bí mật không hợp lệ (Invalid Secret Key)', solution: 'SecretKey truyền trong Header không đúng hoặc đã bị đổi trên web Dahahi. Cần kiểm tra lại mục Cài đặt -> Tích hợp API.' },
    { code: 'FARE0012', message: 'Người dùng không tồn tại trên thiết bị', solution: 'Nhân viên này chưa từng được đăng ký hoặc đã bị xóa khỏi máy.' },
    { code: 'FARE0013', message: 'Tìm kiếm lỗi hoặc timeout', solution: 'Máy chấm công đang bận, mất kết nối mạng LAN/Internet hoặc thời gian phản hồi quá lâu.' },
    { code: 'FARE0014', message: 'Thực hiện lệnh lỗi hoặc timeout', solution: 'Lệnh không hoàn thành kịp thời gian quy định.' },
    { code: 'FARE0030', message: 'Bản ghi không tồn tại', solution: 'Không tìm thấy ID phiên đồng bộ khuôn mặt tương ứng.' },
    { code: 'MACH0023', message: 'Mã thiết bị không thuộc khách hàng quản lý', solution: 'Thiết bị này thuộc đơn vị khác hoặc chưa được gán vào tài khoản Dahahi của công ty bạn.' },
    { code: '901', message: 'Thông tin license không hợp lệ', solution: 'Áp dụng cho SDK C#: File .jdilic không khớp với mã máy hoặc đã hết hạn.' },
    { code: '460', message: 'Data out of range, Single packet data more than 1m', solution: 'Gói dữ liệu vượt quá 1MB. Cần giảm độ phân giải ảnh trước khi gửi.' },
    { code: '467', message: 'Person num is full (Bộ nhớ thiết bị đã đầy)', solution: 'Máy đã đạt số lượng người dùng tối đa (thường là 3.000 - 10.000 khuôn mặt tùy model). Cần xóa bớt người dùng cũ.' }
  ]
};
