<main id="mainContent" tabindex="-1" class="relative z-10 px-4 py-4 sm:px-6 lg:px-8">
  <div class="mx-auto max-w-4xl space-y-4">
    <section class="card rounded-3xl p-4 sm:p-5">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div class="flex items-start gap-3">
          <div class="h-12 w-12 rounded-2xl bg-white/75 border border-white/80 shadow-sm shadow-pink-200/40 overflow-hidden p-1">
            <img
              src="/logos/lingo-icon.svg?v=20260227"
              alt="Logo Lingo"
              class="h-full w-full object-contain"
              loading="eager"
              decoding="async"
            />
          </div>
          <div>
            <p class="text-xs font-semibold uppercase tracking-[.18em] text-pink-500/80">Lingo</p>
            <h1 class="text-xl sm:text-2xl font-extrabold text-[color:var(--ink)]">Chính Sách Bảo Mật</h1>
            <p class="text-sm text-[color:var(--ink2)]">Trang thông tin quyền riêng tư của Lingo.</p>
          </div>
        </div>
        <a href="/" class="btn btn-soft text-sm">Quay về trang chính</a>
      </div>
    </section>

    <section class="card rounded-3xl p-4 sm:p-6">
      <div class="privacy-policy-content">
        <h3>Chính Sách Bảo Mật - Lingo</h3>
        <p><em>Cập nhật lần cuối: 26/02/2026</em></p>

        <h4>1. Cam kết chung</h4>
        <p>
          Chào mừng bạn đến với <strong>Lingo</strong> – Ngôn ngữ tình yêu riêng. Chúng tôi hiểu rằng những kỷ niệm và thông tin của
          cặp đôi là vô cùng riêng tư. Chính sách này giải thích cách Lingo vận hành trong kiến trúc hiện tại để hai bạn có thể dùng
          chung một phòng dữ liệu và đồng bộ theo thời gian thực.
        </p>

        <h4>2. Dữ liệu chúng tôi xử lý</h4>
        <p>Lingo có thể xử lý các nhóm dữ liệu sau để ứng dụng hoạt động:</p>
        <ul>
          <li>
            <strong>Dữ liệu hồ sơ cặp đôi:</strong> tên, ngày sinh, giới tính, ảnh đại diện, ngày bắt đầu yêu, ngày đặc biệt, mốc
            tình yêu.
          </li>
          <li>
            <strong>Dữ liệu ghép cặp:</strong> mã phòng 6 ký tự, trạng thái phòng (đang chờ/đã ghép cặp), thông tin hai thành viên
            của phòng.
          </li>
          <li>
            <strong>Dữ liệu đăng nhập tối thiểu:</strong> ID tài khoản, tên hiển thị, nhà cung cấp đăng nhập (OAuth provider) và ảnh
            đại diện nếu provider trả về.
          </li>
        </ul>

        <h4>3. Cách dữ liệu được lưu trữ</h4>
        <p>
          <strong>Dữ liệu nội dung của cặp đôi</strong> (hồ sơ, sự kiện, cột mốc, cấu hình hiển thị) được lưu trong
          <strong>Supabase PostgreSQL</strong> và đồng bộ thời gian thực qua <strong>Supabase Realtime</strong>.
        </p>
        <p>
          <strong>Dữ liệu ghép cặp</strong> (mã phòng, thành viên phòng) cũng được lưu trong Supabase, cùng dự án với dữ liệu nội
          dung.
        </p>
        <p>
          Phiên bản hiện tại <strong>không yêu cầu backend server riêng</strong> do bạn tự vận hành cho các thao tác CRUD/đăng nhập
          cơ bản; ứng dụng frontend gọi trực tiếp Supabase qua SDK JavaScript.
        </p>

        <h4>4. Dịch vụ bên thứ ba</h4>
        <p>Để Lingo hoạt động, chúng tôi sử dụng các dịch vụ công cộng sau:</p>
        <ul>
          <li><strong>Supabase:</strong> Auth (đăng nhập OAuth), PostgreSQL Database, Realtime.</li>
          <li><strong>Google Fonts:</strong> hiển thị phông chữ "Be Vietnam Pro".</li>
          <li><strong>FontAwesome/CDN (nếu bật trong giao diện):</strong> hiển thị biểu tượng.</li>
          <li><strong>Hạ tầng triển khai (ví dụ Vercel):</strong> phục vụ website frontend.</li>
        </ul>
        <p>
          Các dịch vụ này có thể ghi nhận dữ liệu kỹ thuật như địa chỉ IP, user-agent, thời gian truy cập hoặc thông tin đăng nhập
          cần thiết để cung cấp dịch vụ.
        </p>

        <h4>5. Đăng nhập & phiên làm việc</h4>
        <p>
          Lingo sử dụng <strong>Supabase Auth</strong> để đăng nhập bằng các nhà cung cấp OAuth (ví dụ: Facebook, Google, GitHub,
          ... tùy cấu hình dự án Supabase).
        </p>
        <p>
          SDK Supabase có thể lưu thông tin phiên đăng nhập trên trình duyệt (ví dụ token phiên) để duy trì trạng thái đăng nhập.
          Đây là dữ liệu xác thực, không phải dữ liệu nội dung kỷ niệm của hai bạn.
        </p>

        <h4>6. Mục đích sử dụng dữ liệu</h4>
        <p>Chúng tôi chỉ sử dụng dữ liệu cho mục đích vận hành ứng dụng:</p>
        <ul>
          <li>Đăng nhập và xác thực người dùng.</li>
          <li>Tạo/ghép mã phòng 6 ký tự để kết nối 2 người.</li>
          <li>Lưu, đồng bộ và cập nhật dữ liệu tình yêu theo thời gian thực.</li>
          <li>Khôi phục trạng thái ứng dụng khi bạn quay lại sử dụng.</li>
        </ul>
        <p>Chúng tôi không bán dữ liệu cá nhân của bạn cho bên thứ ba.</p>

        <h4>7. Quyền kiểm soát của bạn</h4>
        <p>Bạn có toàn quyền quản lý dữ liệu trong phòng của mình:</p>
        <ul>
          <li><strong>Sửa đổi:</strong> Thay đổi thông tin bất cứ lúc nào trong phần Cài đặt.</li>
          <li><strong>Xuất/Nhập dữ liệu:</strong> Dùng tính năng sao lưu/khôi phục JSON trong ứng dụng.</li>
          <li><strong>Xóa dữ liệu:</strong> Dùng nút "Đặt lại dữ liệu" để ghi đè dữ liệu phòng hiện tại.</li>
          <li><strong>Đăng xuất:</strong> Ngắt phiên đăng nhập Supabase Auth khỏi ứng dụng.</li>
        </ul>

        <h4>8. Bảo mật</h4>
        <p>
          Lingo sử dụng cơ chế phân quyền dữ liệu theo phòng kết hợp xác thực Supabase và chính sách truy cập dữ liệu (RLS) để giảm
          thiểu truy cập trái phép. Tuy nhiên, không có hệ thống nào an toàn tuyệt đối.
        </p>
        <p>
          Vui lòng không chia sẻ công khai mã phòng 6 ký tự hoặc link phòng nếu bạn không muốn người khác truy cập dữ liệu của cặp
          đôi.
        </p>

        <h4>9. Liên hệ</h4>
        <p>
          Lingo là một dự án cá nhân phi lợi nhuận dành tặng các cặp đôi. Nếu có thắc mắc về quyền riêng tư hoặc bảo mật, vui lòng
          liên hệ nhà phát triển.
        </p>
      </div>
    </section>
  </div>
</main>

<style>
  .privacy-policy-content {
    color: var(--ink);
    line-height: 1.75;
    font-size: 0.96rem;
  }

  .privacy-policy-content h3 {
    margin: 0 0 0.45rem 0;
    font-size: 1.35rem;
    font-weight: 800;
    color: var(--ink);
  }

  .privacy-policy-content h4 {
    margin: 1.15rem 0 0.35rem 0;
    font-size: 1rem;
    font-weight: 800;
    color: var(--ink);
  }

  .privacy-policy-content p {
    margin: 0.35rem 0;
    color: var(--ink2);
  }

  .privacy-policy-content p strong,
  .privacy-policy-content li strong {
    color: var(--ink);
  }

  .privacy-policy-content ul {
    margin: 0.25rem 0 0.35rem 0;
    padding-left: 1.2rem;
    color: var(--ink2);
  }

  .privacy-policy-content li {
    margin: 0.2rem 0;
  }

  .privacy-policy-content em {
    color: var(--ink2);
  }
</style>
