import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

const Login: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{username?: string, password?: string}>({});
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    let errors: any = {};
    if (!username.trim()) errors.username = 'Vui lòng nhập tên đăng nhập';
    if (!password.trim()) errors.password = 'Vui lòng nhập mật khẩu';
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});
    setIsLoading(true);

    try {
      const response = await axios.post('http://localhost:3000/api/auth/login', {
        username,
        password
      });
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('user', JSON.stringify(response.data.user));
      toast.success('Đăng nhập thành công!');
      navigate('/dashboard');
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || 'Đăng nhập thất bại';
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center p-4 font-sans relative">
      <div className="w-full max-w-[420px] bg-white rounded-[24px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 overflow-hidden flex flex-col relative z-10">
        {/* Top Bar - Solid Color instead of Gradient */}
        <div className="h-1.5 w-full bg-[#8C46FF]" />
        
        {/* Back Button */}
        <div className="px-8 pt-8 pb-2">
          <button onClick={() => navigate('/')} disabled={isLoading} className="flex items-center text-sm font-medium text-slate-500 hover:text-[#8C46FF] transition-colors w-fit disabled:opacity-50">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Trang chủ
          </button>
        </div>

        {/* Header */}
        <div className="px-8 pb-6 text-center">
          <h2 className="text-3xl font-extrabold text-[#1f2937]">Đăng Nhập</h2>
          <p className="text-slate-500 mt-2.5 text-[15px]">Chào mừng trở lại với hệ thống Live Game.</p>
        </div>

        {/* Form */}
        <div className="px-8 pb-8">
          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-2 text-left">
              <Label htmlFor="username" className="text-[#374151] font-bold text-[14.5px]">Tên đăng nhập</Label>
              <input
                id="username"
                disabled={isLoading}
                className={`w-full h-12 px-4 rounded-xl border ${fieldErrors.username ? 'border-red-400 focus:ring-red-400 focus:border-red-400' : 'border-slate-200 focus:border-[#8C46FF] focus:ring-[#8C46FF]'} outline-none focus:ring-1 transition-all bg-white text-[15px] disabled:bg-slate-50 disabled:text-slate-500`}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
              {fieldErrors.username && <p className="text-red-500 text-xs font-medium">{fieldErrors.username}</p>}
            </div>

            <div className="space-y-2 text-left">
              <Label htmlFor="password" className="text-[#374151] font-bold text-[14.5px]">Mật khẩu</Label>
              <input
                id="password"
                type="password"
                disabled={isLoading}
                className={`w-full h-12 px-4 rounded-xl border ${fieldErrors.password ? 'border-red-400 focus:ring-red-400 focus:border-red-400' : 'border-slate-200 focus:border-[#8C46FF] focus:ring-[#8C46FF]'} outline-none focus:ring-1 transition-all bg-white text-[15px] disabled:bg-slate-50 disabled:text-slate-500`}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              {fieldErrors.password && <p className="text-red-500 text-xs font-medium">{fieldErrors.password}</p>}
            </div>

            <div className="pt-2">
              <button 
                type="submit" 
                disabled={isLoading}
                className="w-full h-[48px] rounded-xl bg-[#8C46FF] text-white font-bold text-[15px] border-0 hover:bg-[#7C36EF] transition-colors flex items-center justify-center shadow-md shadow-[#8c46ff]/20 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <div className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Đang xử lý...
                  </div>
                ) : (
                  'Đăng Nhập Ngay'
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="bg-[#f8fafc] border-t border-slate-100 py-6 text-center">
          <p className="text-[#64748b] text-[14px] font-medium">
            Chưa có tài khoản?{' '}
            <a href="/register" onClick={(e) => { e.preventDefault(); if(!isLoading) navigate('/register'); }} className={`text-[#8C46FF] hover:text-[#7C36EF] hover:underline ml-1 font-semibold transition-colors ${isLoading ? 'pointer-events-none opacity-50' : ''}`}>
              Đăng ký ngay
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
