import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col items-center justify-center p-6 text-center relative overflow-hidden">
      {/* Decorative background blobs */}
      <div className="absolute top-0 right-0 -mr-20 -mt-20 w-96 h-96 rounded-full bg-[#8C46FF]/10 blur-3xl opacity-50 pointer-events-none" />
      <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-96 h-96 rounded-full bg-[#8C46FF]/10 blur-3xl opacity-50 pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full bg-slate-200/50 blur-[100px] opacity-50 pointer-events-none" />

      <div className="max-w-5xl space-y-8 relative z-10">
        <div className="inline-block px-4 py-1.5 rounded-full border border-slate-200 bg-white shadow-sm text-sm font-semibold text-slate-600 mb-4 tracking-wide hover:shadow-md transition-shadow">
          ✨ Nền tảng Live Game Thế Hệ Mới
        </div>
        <h1 className="text-5xl font-extrabold tracking-tight sm:text-6xl text-[#8C46FF] drop-shadow-sm pb-2">
          Đột Phá Tương Tác TikTok Live
        </h1>
        <p className="text-xl text-slate-600 max-w-3xl mx-auto leading-relaxed">
          Biến phiên livestream của bạn thành một sân chơi bùng nổ! Thu hút hàng
          ngàn lượt tương tác tự động, giữ chân người xem bằng các tựa game được
          thiết kế khoa học và hiện đại nhất.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-6">
          <Button
            size="lg"
            className="w-full sm:w-auto h-12 px-8 text-base bg-[#8C46FF] hover:bg-[#7C36EF] text-white font-semibold shadow-lg shadow-[#8C46FF]/30 rounded-xl transition-all hover:scale-105 active:scale-95 border-0"
            onClick={() => navigate("/register")}
          >
            Bắt đầu sử dụng
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="w-full sm:w-auto h-12 px-8 text-base border-slate-200 text-slate-700 font-semibold hover:bg-slate-100 hover:text-slate-900 shadow-sm rounded-xl transition-all"
            onClick={() => navigate("/login")}
          >
            Đăng nhập hệ thống
          </Button>
        </div>
      </div>

      <div className="mt-24 grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl w-full text-left relative z-10 px-4">
        <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-xl shadow-slate-200/50 hover:shadow-2xl hover:shadow-[#8C46FF]/10 transition-all duration-300 hover:-translate-y-2 group cursor-pointer">
          <div className="w-14 h-14 bg-[#8C46FF]/10 rounded-2xl flex items-center justify-center text-[#8C46FF] text-2xl mb-6 group-hover:scale-110 group-hover:rotate-12 transition-transform duration-300">
            🚀
          </div>
          <h3 className="text-xl font-bold mb-3 text-slate-800">
            Kết Nối Tốc Độ Cao
          </h3>
          <p className="text-slate-500 leading-relaxed text-sm">
            API thời gian thực với độ trễ siêu thấp. Tự động thu thập bình luận,
            lượt thích, quà tặng mà không cần thiết lập cấu hình rườm rà.
          </p>
        </div>
        <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-xl shadow-slate-200/50 hover:shadow-2xl hover:shadow-[#8C46FF]/10 transition-all duration-300 hover:-translate-y-2 group cursor-pointer mt-4 md:mt-0">
          <div className="w-14 h-14 bg-[#8C46FF]/10 rounded-2xl flex items-center justify-center text-[#8C46FF] text-2xl mb-6 group-hover:scale-110 group-hover:-rotate-12 transition-transform duration-300">
            🎮
          </div>
          <h3 className="text-xl font-bold mb-3 text-slate-800">
            Công Nghệ Tương Tác
          </h3>
          <p className="text-slate-500 leading-relaxed text-sm">
            Hệ sinh thái game đa dạng tích hợp mượt mà. Đẩy mạnh tính cạnh tranh
            của cộng đồng xem trực tiếp trên nền tảng.
          </p>
        </div>
        <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-xl shadow-slate-200/50 hover:shadow-2xl hover:shadow-[#8C46FF]/10 transition-all duration-300 hover:-translate-y-2 group cursor-pointer mt-8 md:mt-0">
          <div className="w-14 h-14 bg-[#8C46FF]/10 rounded-2xl flex items-center justify-center text-[#8C46FF] text-2xl mb-6 group-hover:scale-110 group-hover:rotate-12 transition-transform duration-300">
            📈
          </div>
          <h3 className="text-xl font-bold mb-3 text-slate-800">
            Phân Tích Cường Độ
          </h3>
          <p className="text-slate-500 leading-relaxed text-sm">
            Thu thập thông số trực tuyến minh bạch, báo cáo lượt quà để tối ưu
            doanh thu, đẩy mạnh tỉ lệ chuyển đổi user trung thành.
          </p>
        </div>
      </div>
    </div>
  );
}
