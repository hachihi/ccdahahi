/**
 * Điểm vào cho Vercel (serverless). Toàn bộ API nằm trong server/app.ts,
 * dùng chung với server.ts nên không còn hai bản code riêng.
 * Lưu ý: đuôi ".js" là bắt buộc với Vercel khi package.json có "type": "module".
 */
import { app } from '../server/app.js';

export default app;
