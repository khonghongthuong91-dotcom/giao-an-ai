/*
  State và render toàn bộ 11 màn hình của APP Tạo Giáo Án.

  Cách làm: một object `state`, một hàm `render()` dựng lại HTML, và một bộ
  lắng nghe sự kiện đặt ở gốc (event delegation) — nút nào cũng khai báo
  `data-action`. Không dùng framework để app mở được bằng cách bấm đúp
  index.html.

  Quy ước với ô nhập chữ: cập nhật state nhưng KHÔNG render lại, vì render lại
  giữa lúc đang gõ sẽ làm nhảy con trỏ. Ô nào mà nội dung khác phụ thuộc vào nó
  (ô tìm kiếm ở thư viện) thì render lại rồi đặt con trỏ về cuối.
*/
(function () {
  'use strict';

  var D = window.DATA;
  var C = window.COMPOSE;

  /* ── State ───────────────────────────────────────────────────────────── */

  var params = new URLSearchParams(location.search);
  var VIEWS = ['login', 'dashboard', 'wizard', 'editor', 'library',
    'upload', 'word', 'ppt', 'materials', 'profile', 'admin'];
  var startView = params.get('screen');
  if (VIEWS.indexOf(startView) === -1) startView = 'login';

  var state = {
    view: startView,
    step: 1,

    /* Đăng nhập thật, kiểm tra ở máy chủ — xem auth.mjs và
       docs/superpowers/specs/2026-08-08-dang-nhap-that-design.md. */
    loginForm: { username: '', password: '' },
    loginError: null,
    loginBusy: false,

    /* Lựa chọn trong wizard — giá trị mặc định lấy từ bản thiết kế. */
    mixed: true,
    ages: ['Lớp ghép nhiều độ tuổi'],
    mixedAges: ['Trẻ 3–4 tuổi', 'Trẻ 4–5 tuổi'],
    domains: ['Phát triển tình cảm và kỹ năng xã hội'],
    types: ['Giáo dục cảm xúc'],
    integrations: ['Giáo dục cảm xúc', 'Quyền trẻ em', 'Năng lực số'],
    level: 'Trung bình',
    support: ['2 trẻ chậm nói'],
    detail: 'Giáo án tiêu chuẩn',
    tone: 'Gần gũi, dễ thực hiện',
    form: {
      school: 'Trường Mầm non Hoa Sen',
      teacher: 'Nguyễn Hồng Thương',
      className: 'Lớp ghép Hoa Cúc',
      size: '24',
      date: '12/09/2026',
      duration: '25–30 phút',
      theme: 'Bản thân',
      subtheme: 'Cảm xúc của tôi',
      activity: 'Khi con tức giận',
      place: 'Phòng học lớp Hoa Cúc',
      form: 'Kết hợp cả lớp và nhóm nhỏ',
      objectives: '',
      known: 'Trẻ đã gọi được tên cảm xúc vui và buồn.',
      needs: 'Một số trẻ chưa chờ được đến lượt.',
      story: '', poem: '', song: '', game: 'Đèn cảm xúc',
      materials: 'Tivi lớp, tranh biểu cảm A4',
      local: '', notes: ''
    },

    /* Giáo án đang mở. */
    lesson: D.sampleLesson(),
    lessonSource: 'sample',
    generating: false,
    /* Phiên bản do máy chủ trả về, xem versionTag(). */
    version: null,
    /* Thanh chờ AI — tiến độ ước lượng theo thời gian, xem generate(). */
    genStartedAt: 0,
    genPct: 0,
    genSec: 0,
    genStage: '',
    _genTimer: null,
    aiError: null,
    aiPreview: null,

    /* Thư viện. */
    query: '',
    libFilter: 'Tất cả',
    pinned: ['p1'],
    trashed: [],

    /* Tải Word lên. */
    upload: 'idle',
    upPct: 0,
    upStatus: '',
    upError: null,
    upResult: null,

    /* PowerPoint. */
    slideCount: 'Tự động đề xuất',
    uploadsCount: 0,

    /* Hồ sơ cá nhân. */
    profile: deepCopy(D.profileDefault),

    /* Kho học liệu. */
    matQuery: '', matAge: '', matType: '', matFavs: [], myMaterials: [],

    /* Cấu hình chương trình — văn bản pháp lý đơn vị đang áp dụng, sửa được. */
    config: D.refs.map(function (r) {
      var statusMap = { 'Đang có hiệu lực': 'Đang áp dụng', 'Chưa xác minh': 'Sắp áp dụng', 'Sắp có hiệu lực': 'Sắp áp dụng' };
      return { code: r[0], name: r[1], org: r[2], effective: r[3], status: statusMap[r[4]] || 'Đang áp dụng', checked: r[5] };
    }),

    /* Quản trị. */
    adminToggles: { ai: true, upload: true, admin: false, beta: false },

    /* Hai công tắc mà bản thiết kế để ở khung Prototype. */
    showChecks: params.get('checks') !== '0',
    showNotes: params.get('notes') !== '0',

    versions: [],
    toastMsg: null,
    focusId: null
  };

  /* ── Tiện ích ────────────────────────────────────────────────────────── */

  function esc(text) {
    return String(text == null ? '' : text)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function attr(text) { return esc(text); }

  function now() {
    var d = new Date();
    return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  }

  /* Ghi một mốc vào lịch sử phiên bản — mốc thật, theo giờ máy. */
  function stamp(label) {
    state.versions.unshift({ label: label, time: now() });
    state.versions = state.versions.slice(0, 8);
  }

  var toastTimer = null;
  function flash(msg) {
    state.toastMsg = msg;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      state.toastMsg = null;
      render();
    }, 3200);
    render();
  }

  function deepCopy(x) { return JSON.parse(JSON.stringify(x)); }

  /* Bản sao giáo án để sửa rồi gán lại — giữ cách làm của bản thiết kế. */
  function editLesson(fn, versionLabel) {
    var L = deepCopy(state.lesson);
    var next = fn(L);
    state.lesson = next || L;
    if (versionLabel) stamp(versionLabel);
  }

  /* Bông hoa làm biểu tượng của app — thay cho icon quyển sách trước đó. */
  function flowerMark(size) {
    return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" aria-hidden="true">' +
      '<g>' +
        '<ellipse cx="12" cy="5.4" rx="3.3" ry="4.8" fill="#fff"></ellipse>' +
        '<ellipse cx="12" cy="5.4" rx="3.3" ry="4.8" fill="#fff" transform="rotate(60 12 12)"></ellipse>' +
        '<ellipse cx="12" cy="5.4" rx="3.3" ry="4.8" fill="#fff" transform="rotate(120 12 12)"></ellipse>' +
        '<ellipse cx="12" cy="5.4" rx="3.3" ry="4.8" fill="#fff" transform="rotate(180 12 12)"></ellipse>' +
        '<ellipse cx="12" cy="5.4" rx="3.3" ry="4.8" fill="#fff" transform="rotate(240 12 12)"></ellipse>' +
        '<ellipse cx="12" cy="5.4" rx="3.3" ry="4.8" fill="#fff" transform="rotate(300 12 12)"></ellipse>' +
        '<circle cx="12" cy="12" r="4.4" fill="#F8C85E"></circle>' +
        '<circle cx="10.3" cy="11.2" r="0.55" fill="#6B5836"></circle>' +
        '<circle cx="13.7" cy="11.2" r="0.55" fill="#6B5836"></circle>' +
        '<path d="M10.3 13c.45.6 1.1.95 1.7.95s1.25-.35 1.7-.95" stroke="#6B5836" stroke-width="0.6" ' +
        'fill="none" stroke-linecap="round"></path>' +
      '</g></svg>';
  }

  /* Icon cho từng mục ở thanh bên — path lấy từ bản thiết kế. */
  function navIcon(key) {
    var P = {
      home: '<path d="m3 10 9-7 9 7v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><path d="M9 22V12h6v10"></path>',
      plus: '<path d="M12 5v14"></path><path d="M5 12h14"></path>',
      bookmark: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>',
      monitor: '<rect x="2" y="3" width="20" height="14" rx="2"></rect><path d="M12 17v4"></path><path d="M8 21h8"></path>',
      wordArrow: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><path d="M7 10l5-5 5 5"></path><path d="M12 5v12"></path>',
      books: '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>',
      user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle>',
      sliders: '<path d="M20 7h-9"></path><path d="M14 17H5"></path><circle cx="17" cy="17" r="3"></circle><circle cx="7" cy="7" r="3"></circle>'
    };
    return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" ' +
      'stroke-linecap="round" stroke-linejoin="round">' + (P[key] || '') + '</svg>';
  }

  /* Một hàng chip. `single` = chọn một, ngược lại là chọn nhiều. */
  function chips(key, options, single) {
    var sel = state[key];
    return '<div class="chip-row">' + options.map(function (label) {
      var on = Array.isArray(sel) ? sel.indexOf(label) !== -1 : sel === label;
      return '<button type="button" class="chip' + (on ? ' is-on' : '') + '" ' +
        'data-action="chip" data-key="' + attr(key) + '" data-value="' + attr(label) + '"' +
        (single ? ' data-single="1"' : '') +
        ' aria-pressed="' + on + '">' + esc(label) + '</button>';
    }).join('') + '</div>';
  }

  function field(label, key, o) {
    o = o || {};
    var id = 'f-' + key;
    return '<label class="label"><span class="field-label">' + esc(label) + '</span>' +
      '<input id="' + id + '" class="input" type="text" data-field="' + attr(key) + '" ' +
      'value="' + attr(state.form[key]) + '"' +
      (o.placeholder ? ' placeholder="' + attr(o.placeholder) + '"' : '') + '></label>';
  }

  function textarea(label, key, rows, placeholder) {
    return '<label class="label"><span class="field-label">' + esc(label) + '</span>' +
      '<textarea class="textarea" rows="' + rows + '" data-field="' + attr(key) + '" ' +
      'placeholder="' + attr(placeholder || '') + '">' + esc(state.form[key]) + '</textarea></label>';
  }

  /* Danh sách dòng có thể sửa trực tiếp trong trình soạn thảo. */
  function editableLines(items, path, dash) {
    return '<div class="block__lines" contenteditable="true" data-edit="lines" ' +
      'data-path="' + attr(path) + '" role="textbox" aria-multiline="true">' +
      (items.length ? items : ['']).map(function (line) {
        return '<div>' + (dash ? '– ' : '') + esc(line) + '</div>';
      }).join('') + '</div>';
  }

  /* ── Màn hình đăng nhập ──────────────────────────────────────────────── */

  function viewLogin() {
    return '<div class="login">' +
      '<div class="login__left">' +
        '<div class="brand">' +
          '<div class="brand__mark">' + flowerMark(30) + '</div>' +
          '<div><div class="brand__name">APP TẠO GIÁO ÁN</div>' +
          '<div class="brand__sub">Giáo án mầm non có AI hỗ trợ</div></div>' +
        '</div>' +
        '<div>' +
          '<h1 class="login__title">Soạn giáo án mầm non đúng bố cục, trong vài phút.</h1>' +
          '<p class="login__body">Chọn nhóm tuổi, chủ đề và nội dung tích hợp. AI dựng giáo án theo cấu trúc ' +
          'I – II – III với bảng hai cột hoạt động của cô và của trẻ. Giáo viên chỉnh sửa, tải Word hoặc ' +
          'chuyển thành PowerPoint.</p>' +
        '</div>' +
        '<div class="login__actions">' +
          '<div class="login__form">' +
            '<label class="label"><span class="field-label">Tên đăng nhập</span>' +
            '<input class="input" type="text" data-login-field="username" autocomplete="username" ' +
            'value="' + attr(state.loginForm.username) + '" placeholder="Tên đăng nhập"></label>' +
            '<label class="label"><span class="field-label">Mật khẩu</span>' +
            '<input class="input" type="password" data-login-field="password" autocomplete="current-password" ' +
            'value="' + attr(state.loginForm.password) + '" placeholder="Mật khẩu"></label>' +
            (state.loginError ? '<div class="login__error">' + esc(state.loginError) + '</div>' : '') +
            '<button type="button" class="btn btn--pink" ' +
            'style="align-self:flex-start; font-size:16px; padding:14px 26px" ' +
            (state.loginBusy ? 'disabled ' : '') +
            'data-action="login">' + (state.loginBusy ? 'Đang kiểm tra…' : 'Đăng nhập') + '</button>' +
          '</div>' +
          '<div class="login__fine">Cả trường dùng chung một tài khoản — hỏi người phụ trách để lấy mật khẩu. ' +
          'Ứng dụng không thu thập tên thật, hình ảnh hay thông tin định danh của trẻ.</div>' +
        '</div>' +
      '</div>' +
      '<div class="login__right">' +
        '<div class="eyebrow">CÓ SẴN TRONG BẢN NÀY</div>' +
        '<div class="stack-12">' +
          D.loginFeatures.map(function (f) {
            return '<div class="feature"><div class="feature__n">' + esc(f.n) + '</div>' +
              '<div><div class="feature__title">' + esc(f.title) + '</div>' +
              '<div class="feature__body">' + esc(f.body) + '</div></div></div>';
          }).join('') +
        '</div>' +
      '</div>' +
    '</div>';
  }

  /* ── Thanh bên ───────────────────────────────────────────────────────── */

  /*
    Nhãn phiên bản cạnh logo, để đối chiếu localhost với production sau mỗi lần
    deploy. Số lấy từ /api/version của CHÍNH máy chủ đang phục vụ trang này —
    không nhúng cứng vào JS, vì JS bị trình duyệt giữ trong cache thì nhãn sẽ
    báo bản cũ trong khi máy chủ đã chạy bản mới, tức là nói dối đúng lúc cần
    tin nhất.

    Rê chuột lên nhãn để xem mã commit và giờ build.
  */
  function versionTag() {
    if (!state.version) return '';
    var v = state.version;
    var tip = 'commit ' + (v.buildId || '?') + (v.builtAt ? ' · build ' + v.builtAt : '');
    return ' <span class="vtag" title="' + attr(tip) + '">v' + esc(v.version) + '</span>';
  }

  function sidebar() {
    return '<aside class="sidebar">' +
      '<div class="sidebar__brand">' +
        '<div class="sidebar__mark">' + flowerMark(23) + '</div>' +
        '<div style="min-width:0">' +
          '<div class="sidebar__nameline">' +
            '<span class="sidebar__name">APP TẠO GIÁO ÁN</span>' + versionTag() +
          '</div>' +
          '<div class="sidebar__sub">Trợ lý AI cho giáo viên mầm non</div>' +
        '</div>' +
      '</div>' +
      '<nav class="nav" aria-label="Điều hướng chính">' +
        D.nav.map(function (item) {
          var view = item[0];
          var on = state.view === view || (view === 'library' && state.view === 'editor');
          var action = view === 'wizard' ? 'start-wizard' : 'go';
          return '<button type="button" class="nav__item' + (on ? ' is-on' : '') + '" ' +
            'data-action="' + action + '" data-value="' + attr(view) + '"' +
            (on ? ' aria-current="page"' : '') + '>' + navIcon(item[2]) + '<span>' + esc(item[1]) + '</span></button>';
        }).join('') +
      '</nav>' +
      '<div class="who">' +
        '<div class="who__avatar">' + esc(D.user.initials) + '</div>' +
        '<div style="min-width:0">' +
          '<div class="who__name">' + esc(D.user.name) + '</div>' +
          '<div class="who__role">' + esc(D.user.role) + '</div>' +
        '</div>' +
      '</div>' +
      '<button type="button" class="logout" data-action="logout">Đăng xuất</button>' +
    '</aside>';
  }

  /* ── Trang chủ ───────────────────────────────────────────────────────── */

  function visibleLibrary() {
    return D.library.filter(function (p) { return state.trashed.indexOf(p.id) === -1; });
  }

  function viewDashboard() {
    var lib = visibleLibrary();
    var firstName = (D.user.name || '').trim().split(' ').slice(-1)[0];
    var activeCfg = state.config.filter(function (c) { return c.status === 'Đang áp dụng'; })[0];

    return '<div class="wrap">' +
      '<div class="dash-top">' +
        '<div>' +
          '<h1 class="h1 h1--dash" style="margin-bottom:4px">Chào cô ' + esc(firstName) + '!</h1>' +
          '<div class="dash-top__sub">Hôm nay cô muốn soạn hoạt động nào?</div>' +
        '</div>' +
        '<div class="dash-top__right">' +
          '<div class="config-pill"><span class="config-pill__dot"></span>' +
          (activeCfg ? 'Đang áp dụng: ' + esc(activeCfg.code) : 'Chưa chọn văn bản áp dụng') + '</div>' +
          '<button type="button" class="btn-cta-sm" data-action="start-wizard">Tạo giáo án mới</button>' +
        '</div>' +
      '</div>' +

      '<div class="hero">' +
        '<div class="hero__blob hero__blob--1"></div>' +
        '<div class="hero__blob hero__blob--2"></div>' +
        '<div class="hero__content">' +
          '<div class="hero__kicker">APP TẠO GIÁO ÁN</div>' +
          '<div class="hero__title">Trợ lý AI hỗ trợ giáo viên mầm non xây dựng giáo án khoa học, sáng tạo và ' +
          'phù hợp từng độ tuổi.</div>' +
          '<div class="hero__actions">' +
            '<button type="button" class="hero__btn hero__btn--solid" data-action="start-wizard">Tạo giáo án mới</button>' +
            '<button type="button" class="hero__btn hero__btn--ghost" data-action="go" data-value="library">Giáo án đã soạn</button>' +
          '</div>' +
        '</div>' +
      '</div>' +

      '<div class="quick-grid">' +
        '<button type="button" class="quick-card" data-action="start-wizard">' +
          '<div class="quick-card__icon quick-card__icon--teal">' + navIcon('plus') + '</div>' +
          '<div class="quick-card__title">Tạo giáo án mới</div>' +
          '<div class="quick-card__body">Điền 5 bước, AI soạn bản đầu tiên.</div></button>' +
        '<button type="button" class="quick-card" data-action="go" data-value="library">' +
          '<div class="quick-card__icon quick-card__icon--blue">' + navIcon('bookmark') + '</div>' +
          '<div class="quick-card__title">Giáo án đã lưu</div>' +
          '<div class="quick-card__body">Tìm, lọc, nhân bản và chỉnh sửa.</div></button>' +
        '<button type="button" class="quick-card" data-action="go" data-value="ppt">' +
          '<div class="quick-card__icon quick-card__icon--amber">' + navIcon('monitor') + '</div>' +
          '<div class="quick-card__title">Tạo PowerPoint</div>' +
          '<div class="quick-card__body">Chuyển giáo án thành slide cho trẻ.</div></button>' +
        '<button type="button" class="quick-card" data-action="go" data-value="upload">' +
          '<div class="quick-card__icon quick-card__icon--teal">' + navIcon('wordArrow') + '</div>' +
          '<div class="quick-card__title">Tải giáo án Word</div>' +
          '<div class="quick-card__body">AI phân tích và tạo slide từ .docx.</div></button>' +
      '</div>' +

      '<div class="dash-cols">' +
        '<div class="panel">' +
          '<div class="section-head"><h2 class="h2">Giáo án gần đây</h2>' +
          '<button type="button" class="btn--link" data-action="go" data-value="library">Xem tất cả</button></div>' +
          '<div class="stack-10">' +
            lib.slice(0, 5).map(function (p) {
              return '<button type="button" class="recent" data-action="go" data-value="editor">' +
                '<div style="min-width:0"><div class="recent__title">' + esc(p.title) + '</div>' +
                '<div class="recent__meta">' + esc(p.age + ' · ' + p.domain) + '</div></div>' +
                '<div class="recent__date">' + esc(p.date) + '</div></button>';
            }).join('') +
          '</div>' +
        '</div>' +
        '<div class="stats stats--2x2">' +
          '<div class="stat"><div class="stat__label">Tổng giáo án</div>' +
          '<div class="stat__value">' + lib.length + '</div></div>' +
          '<div class="stat"><div class="stat__label">Đã ghim</div>' +
          '<div class="stat__value">' + state.pinned.length + '</div></div>' +
          '<div class="stat"><div class="stat__label">Bản PowerPoint</div>' +
          '<div class="stat__value" style="color:var(--amber-ink)">' + currentSlides().length + '</div></div>' +
          '<div class="stat"><div class="stat__label">Tài liệu đã tải lên</div>' +
          '<div class="stat__value" style="color:var(--blue-ink)">' + state.uploadsCount + '</div></div>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  /* ── Wizard ──────────────────────────────────────────────────────────── */

  function viewWizard() {
    var panels = [step1, step2, step3, step4, step5];
    /* Dùng hết bề ngang như trang chủ. Các màn nhiều chữ (hồ sơ, tải Word,
       xem trước) vẫn giữ wrap--narrow vì dòng dài đọc mệt. */
    return '<div class="wrap">' +
      '<div class="wizard-head"><h1 class="h1">Tạo giáo án mới</h1>' +
      '<div class="wizard-head__count">Bước ' + state.step + ' / 5</div></div>' +
      '<div class="steps">' +
        D.stepLabels.map(function (label, i) {
          var on = state.step === i + 1;
          return '<button type="button" class="step' + (on ? ' is-on' : '') + '" ' +
            'data-action="step" data-value="' + (i + 1) + '">' +
            '<div class="step__n">BƯỚC ' + (i + 1) + '</div>' +
            '<div class="step__label">' + esc(label) + '</div></button>';
        }).join('') +
      '</div>' +
      panels[state.step - 1]() +
      '<div class="wizard-foot">' +
        '<button type="button" class="btn-step" data-action="prev-step"' +
        (state.step === 1 ? ' disabled' : '') + '>Quay lại</button>' +
        '<button type="button" class="btn-step btn-step--next" data-action="next-step">' +
        (state.step === 5 ? 'Tạo giáo án bằng AI' : 'Tiếp tục') + '</button>' +
      '</div>' +
    '</div>';
  }

  function step1() {
    var hint = state.mixed
      ? 'Lớp ghép 3–4 và 4–5 tuổi: 25–30 phút.'
      : 'Gợi ý theo độ tuổi: 3–4 tuổi 20–25 phút, 4–5 tuổi 25–30 phút, 5–6 tuổi 30–35 phút.';
    return '<div class="card">' +
      '<h2 class="h2">Thông tin cơ bản</h2>' +
      '<p class="lede">Các trường đã điền sẵn từ hồ sơ giáo viên. Chị có thể sửa lại.</p>' +
      '<div class="grid-3">' +
        field('Tên trường', 'school') +
        field('Tên giáo viên', 'teacher') +
        field('Tên lớp', 'className') +
        field('Số lượng trẻ', 'size') +
        field('Ngày thực hiện', 'date') +
        field('Thời lượng', 'duration') +
        field('Chủ đề', 'theme') +
        field('Chủ đề nhánh', 'subtheme') +
        field('Tên hoạt động', 'activity') +
        field('Địa điểm', 'place') +
        field('Hình thức tổ chức', 'form') +
        '<div class="label"><span class="field-label">Gợi ý thời lượng</span>' +
        '<div class="duration-hint">' + esc(hint) + '</div></div>' +
      '</div>' +
      '<div class="rule"></div>' +
      '<div class="field-label" style="margin-bottom:10px">Nhóm tuổi</div>' +
      chips('ages', D.options.ages) +
      (state.mixed
        ? '<div class="note-green" style="margin-top:18px">' +
          '<div class="mixed-box__title">Lớp ghép nhiều độ tuổi</div>' +
          '<div class="mixed-box__body">Chọn các nhóm tuổi có trong lớp. Giáo án sẽ có mục tiêu chung, ' +
          'mục tiêu phân hóa và nhiệm vụ khác nhau cho từng nhóm.</div>' +
          chips('mixedAges', D.options.mixedAges) + '</div>'
        : '') +
      '<div class="rule"></div>' +
      '<div class="two-col-26">' +
        '<div><div class="field-label" style="margin-bottom:10px">Lĩnh vực phát triển</div>' +
        chips('domains', D.options.domains) + '</div>' +
        '<div><div class="field-label" style="margin-bottom:10px">Loại hoạt động</div>' +
        chips('types', D.options.types) + '</div>' +
      '</div>' +
    '</div>';
  }

  function step2() {
    return '<div class="card">' +
      '<h2 class="h2">Mục tiêu bài học</h2>' +
      '<p class="lede">Chị nhập mục tiêu, hoặc để AI gợi ý rồi sửa lại.</p>' +
      '<div class="grid-2">' +
        textarea('Mục tiêu do giáo viên nhập', 'objectives', 5,
          'Ví dụ: Trẻ gọi được tên cảm xúc tức giận và thực hiện được cách hít thở để bình tĩnh.') +
        textarea('Những điều trẻ đã biết', 'known', 5, 'Trẻ đã gọi được tên cảm xúc vui, buồn.') +
      '</div>' +
      '<div class="grid-2" style="margin-top:18px">' +
        textarea('Khó khăn hoặc nhu cầu hỗ trợ', 'needs', 4, 'Một số trẻ chưa chờ được đến lượt.') +
        '<div style="display:grid;gap:10px;align-content:start">' +
          '<span class="field-label">Mức độ phát triển của lớp</span>' +
          chips('level', D.options.levels, true) +
          '<span class="field-label" style="margin-top:6px">Trẻ cần hỗ trợ đặc biệt</span>' +
          chips('support', D.options.supports) +
          '<div style="font-size:12.5px;color:var(--muted);line-height:1.5">Không cần nhập tên thật của trẻ. ' +
          'Chỉ ghi số lượng và nhu cầu hỗ trợ.</div>' +
        '</div>' +
      '</div>' +
      '<div class="note-yellow" style="margin-top:22px">' +
        '<div class="field-label" style="margin-bottom:8px">Mục tiêu do AI tạo sẽ đảm bảo</div>' +
        '<div class="guarantee">' +
          '<div>Quan sát và đánh giá được</div>' +
          '<div>Phù hợp độ tuổi, không quá tải kiến thức</div>' +
          '<div>Trẻ là chủ thể hoạt động</div>' +
          '<div>Không dùng động từ mơ hồ hoặc yêu cầu hàn lâm</div>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  function step3() {
    var n = state.integrations.length;
    var hint = n > 4
      ? 'Đã chọn ' + n + ' nội dung. AI sẽ chỉ lồng ghép 2–3 nội dung phù hợp nhất với thời lượng, ' +
        'phần còn lại chuyển thành gợi ý mở rộng.'
      : 'Đã chọn ' + n + ' nội dung. AI sẽ lồng ghép tự nhiên trong hoạt động, không thêm mục riêng cho từng nội dung.';
    return '<div class="card">' +
      '<h2 class="h2">Nội dung tích hợp</h2>' +
      '<p class="lede" style="margin-bottom:20px">Chọn nội dung muốn lồng ghép. AI sẽ chọn cách lồng ghép ' +
      'tự nhiên, không nhồi hết vào một bài dạy.</p>' +
      chips('integrations', D.options.integrations) +
      '<div style="margin-top:14px;font-size:13.5px;color:var(--muted)">' + esc(hint) + '</div>' +
      '<div class="rule rule--sm"></div>' +
      '<div class="grid-3">' +
        field('Tên truyện', 'story', { placeholder: 'Để trống nếu muốn AI gợi ý' }) +
        field('Tên bài thơ', 'poem', { placeholder: 'Để trống nếu muốn AI gợi ý' }) +
        field('Tên bài hát', 'song', { placeholder: 'Để trống nếu muốn AI gợi ý' }) +
        field('Tên trò chơi', 'game', { placeholder: 'Ví dụ: Đèn cảm xúc' }) +
        field('Học liệu và thiết bị sẵn có', 'materials', { placeholder: 'Tivi lớp, tranh biểu cảm A4...' }) +
        field('Văn hóa địa phương', 'local', { placeholder: 'Bài đồng dao địa phương...' }) +
      '</div>' +
      '<div style="margin-top:18px">' +
        textarea('Yêu cầu riêng của giáo viên', 'notes', 3,
          'Ví dụ: lớp có 3 trẻ hay giành đồ chơi, cần nhiều hoạt động nhóm nhỏ.') +
      '</div>' +
      '<div style="margin-top:18px;font-size:13px;color:var(--muted);line-height:1.55;background:var(--surface-soft);' +
      'border:1px dashed var(--line);border-radius:12px;padding:14px 16px">Nếu chị không cung cấp truyện, thơ, ' +
      'bài hát hoặc trò chơi, AI sẽ sáng tác nội dung ngắn nguyên bản phù hợp độ tuổi và ghi rõ phần nào do AI ' +
      'gợi ý. AI không chép toàn bộ tác phẩm hoặc lời bài hát còn bản quyền.</div>' +
    '</div>';
  }

  function step4() {
    return '<div class="card">' +
      '<h2 class="h2" style="margin-bottom:20px">Phương pháp và mức độ chi tiết</h2>' +
      '<div class="field-label" style="margin-bottom:10px">Kiểu giáo án</div>' +
      '<div class="detail-cards">' +
        D.options.details.map(function (pair) {
          var on = state.detail === pair[0];
          return '<button type="button" class="detail-card' + (on ? ' is-on' : '') + '" ' +
            'data-action="chip" data-key="detail" data-single="1" data-value="' + attr(pair[0]) + '" ' +
            'aria-pressed="' + on + '">' +
            '<div class="detail-card__label">' + esc(pair[0]) + '</div>' +
            '<div class="detail-card__hint">' + esc(pair[1]) + '</div></button>';
        }).join('') +
      '</div>' +
      '<div class="rule"></div>' +
      '<div class="field-label" style="margin-bottom:10px">Giọng văn</div>' +
      chips('tone', D.options.tones, true) +
    '</div>';
  }

  function step5() {
    var f = state.form;
    var rows = [
      ['Lớp và trường', f.className + ' · ' + f.school],
      ['Nhóm tuổi', state.mixed ? 'Lớp ghép: ' + state.mixedAges.join(', ') : state.ages.join(', ')],
      ['Chủ đề', f.theme + ' · ' + f.subtheme],
      ['Hoạt động', f.activity],
      ['Lĩnh vực', state.domains.join(', ')],
      ['Loại hoạt động', state.types.join(', ')],
      ['Thời lượng · số trẻ', f.duration + ' · ' + f.size + ' trẻ'],
      ['Nội dung tích hợp', state.integrations.join(', ')],
      ['Kiểu giáo án', state.detail],
      ['Giọng văn', state.tone]
    ];
    var aiOff = !state.adminToggles.ai;

    /* Thanh chờ AI. Xem generate() để hiểu vì sao tiến độ chỉ là ước lượng
       theo thời gian chứ không phải tiến độ thật. */
    function progressBar() {
      var pct = Math.round(state.genPct || 0);
      var sec = state.genSec || 0;
      var mm = Math.floor(sec / 60), ss = sec % 60;
      var clock = mm > 0 ? mm + ' phút ' + ss + ' giây' : sec + ' giây';
      return '<div class="genbar">' +
        '<div class="genbar__track">' +
          '<div class="genbar__fill" style="width:' + pct + '%"></div>' +
        '</div>' +
        '<div class="genbar__meta">' +
          '<span class="genbar__stage">' + esc(state.genStage || '') + '</span>' +
          '<span class="genbar__time">đã chờ ' + esc(clock) + '</span>' +
        '</div>' +
        '<div class="genbar__hint">Soạn một giáo án đầy đủ thường mất khoảng 2 phút. ' +
        'Chị cứ để yên trang này.</div>' +
      '</div>';
    }

    var note = state.generating
      ? 'Đang dựng mục tiêu, phần chuẩn bị và bảng hoạt động hai cột.'
      : aiOff
        ? 'Quản trị viên đang tắt tính năng gọi AI. Bật lại ở màn hình Quản trị.'
        : C.hasModel()
          ? 'AI trả kết quả theo JSON schema chặt chẽ, sau đó giao diện mới dựng thành giáo án.'
          : 'Bản chạy trên máy chưa nối mô hình ngôn ngữ. App sẽ dựng giáo án ngay từ những lựa chọn ' +
            'ở trên, theo đúng bố cục I – II – III.';

    return '<div class="card">' +
      '<h2 class="h2" style="margin-bottom:18px">Kiểm tra lại lựa chọn</h2>' +
      '<div class="summary">' +
        rows.map(function (r) {
          return '<div class="summary__row"><div class="summary__k">' + esc(r[0]) + '</div>' +
            '<div class="summary__v">' + esc(r[1] || '—') + '</div></div>';
        }).join('') +
      '</div>' +
      '<div class="generate-row">' +
        '<button type="button" class="btn-generate" data-action="generate"' +
        (state.generating || aiOff ? ' disabled' : '') + '>' +
        (state.generating ? 'ĐANG TẠO GIÁO ÁN...' : 'TẠO GIÁO ÁN BẰNG AI') + '</button>' +
        '<div class="generate-note">' + esc(note) + '</div>' +
      '</div>' +
      (state.generating ? progressBar() : '') +
      (state.aiError ? '<div class="note-red" style="margin-top:18px">' + esc(state.aiError) + '</div>' : '') +
    '</div>';
  }

  /* ── Trình soạn thảo ─────────────────────────────────────────────────── */

  function viewEditor() {
    var L = state.lesson;
    var info = L.info;
    var diff = (L.objectives.differentiated || []);
    var checks = C.checks(L);
    var warnCount = checks.filter(function (c) { return !c.ok; }).length;
    var aiOff = !state.adminToggles.ai;

    var infoRows = [
      ['Trường', info.school], ['Giáo viên', info.teacher], ['Lớp', info.className],
      ['Độ tuổi', info.ageLabel], ['Số trẻ', info.size], ['Ngày thực hiện', info.date],
      ['Chủ đề', info.theme + ' · ' + info.subtheme], ['Lĩnh vực', info.domain], ['Thời gian', info.duration]
    ];

    var source = state.lessonSource === 'model' ? 'TRÌNH SOẠN THẢO · GIÁO ÁN DO AI TẠO'
      : state.lessonSource === 'local' ? 'TRÌNH SOẠN THẢO · APP DỰNG TỪ LỰA CHỌN CỦA CHỊ'
      : state.lessonSource === 'docx' ? 'TRÌNH SOẠN THẢO · ĐỌC TỪ FILE WORD'
      : 'TRÌNH SOẠN THẢO · GIÁO ÁN MẪU';

    return '<div class="editor">' +
      '<div style="min-width:0">' +
        '<div class="editor__head">' +
          '<div>' +
            '<div class="editor__eyebrow">' + esc(source) + '</div>' +
            '<h1 class="editor__title">' + esc(info.activity) + '</h1>' +
            '<div class="editor__meta">' + esc(info.ageLabel + ' · ' + info.domain + ' · ' + info.duration) + '</div>' +
          '</div>' +
          '<div class="editor__buttons">' +
            '<button type="button" class="btn" data-action="go" data-value="word">TẢI GIÁO ÁN WORD</button>' +
            '<button type="button" class="btn btn--pink" data-action="go" data-value="ppt">CHUYỂN SANG POWERPOINT</button>' +
          '</div>' +
        '</div>' +

        '<div class="doc">' +
          '<div class="doc__info">' +
            infoRows.map(function (r) {
              return '<div class="doc__info-row"><span class="doc__info-k">' + esc(r[0]) + ':</span>' +
                '<span class="doc__info-v">' + esc(r[1]) + '</span></div>';
            }).join('') +
          '</div>' +

          '<h2 class="doc__h2">I. MỤC ĐÍCH – YÊU CẦU</h2>' +
          D.objectiveLabels.map(function (pair) {
            return '<div class="block"><div class="block__label">' + esc(pair[1]) + '</div>' +
              editableLines(L.objectives[pair[0]] || [], 'objectives.' + pair[0], true) + '</div>';
          }).join('') +

          (diff.length
            ? '<div class="note-green diff">' +
              '<div class="diff__title">Mục tiêu phân hóa theo nhóm tuổi (lớp ghép)</div>' +
              '<div class="grid-2">' +
                diff.map(function (g, gi) {
                  return '<div><div class="diff__group">' + esc(g.group) + '</div>' +
                    '<div class="diff__lines" contenteditable="true" data-edit="lines" ' +
                    'data-path="objectives.differentiated.' + gi + '.items" role="textbox" aria-multiline="true">' +
                    (g.items || []).map(function (line) { return '<div>– ' + esc(line) + '</div>'; }).join('') +
                    '</div></div>';
                }).join('') +
              '</div></div>'
            : '') +

          '<h2 class="doc__h2 doc__h2--ii">II. CHUẨN BỊ</h2>' +
          '<div class="prep">' +
            D.prepLabels.map(function (pair) {
              return '<div><div class="block__label">' + esc(pair[1]) + '</div>' +
                editableLines((L.prep && L.prep[pair[0]]) || [], 'prep.' + pair[0], true) + '</div>';
            }).join('') +
          '</div>' +

          '<h2 class="doc__h2 doc__h2--iii">III. HOẠT ĐỘNG HỌC</h2>' +
          '<div class="acts-scroll"><table class="acts">' +
            '<thead><tr>' +
              '<th class="col-teacher">Hoạt động của cô</th>' +
              '<th class="col-child">Hoạt động của trẻ</th>' +
              '<th class="col-tools" aria-label="Sắp xếp hàng"></th>' +
            '</tr></thead>' +
            '<tbody>' +
              (L.activities || []).map(function (a, i) { return activityRows(a, i); }).join('') +
            '</tbody>' +
          '</table></div>' +
          '<button type="button" class="add-row" data-action="add-row">+ Thêm hoạt động</button>' +
          '<div class="doc__foot">' + esc(D.disclaimer) + '</div>' +
        '</div>' +
      '</div>' +

      '<div class="rail">' +
        (state.showChecks
          ? '<div class="card card--tight">' +
            '<div class="rail__head"><div class="rail__title">Cảnh báo kiểm tra</div>' +
            '<div class="rail__count">' + warnCount + ' cần xem</div></div>' +
            '<div style="display:grid;gap:9px">' +
              checks.map(function (c) {
                return '<div class="check"><div class="check__dot' + (c.ok ? ' is-ok' : '') + '"></div>' +
                  '<div class="check__text">' + esc(c.text) + '</div></div>';
              }).join('') +
            '</div></div>'
          : '') +

        '<div class="card card--tight">' +
          '<div class="rail__title" style="margin-bottom:4px">Nhờ AI chỉnh sửa</div>' +
          '<div class="rail__sub">' + (aiOff
            ? 'Quản trị viên đang tắt tính năng gọi AI.'
            : 'Mọi thay đổi đều có bản xem trước trước khi thay nội dung cũ.') + '</div>' +
          '<div style="display:grid;gap:7px">' +
            D.aiActions.map(function (pair) {
              return '<button type="button" class="ai-action" data-action="ai-action" ' +
                'data-value="' + attr(pair[0]) + '"' + (aiOff ? ' disabled' : '') + '>' +
                esc(pair[0]) + '</button>';
            }).join('') +
          '</div>' +
        '</div>' +

        '<div class="card card--tight">' +
          '<div class="rail__title" style="margin-bottom:10px">Lịch sử phiên bản</div>' +
          '<div style="display:grid;gap:8px">' +
            (state.versions.length
              ? state.versions.map(function (v) {
                return '<div class="version"><div class="version__label">' + esc(v.label) + '</div>' +
                  '<div class="version__time">' + esc(v.time) + '</div></div>';
              }).join('')
              : '<div class="version__label" style="font-size:13px">Chưa có thay đổi nào trong phiên này.</div>') +
          '</div>' +
        '</div>' +
      '</div>' +

      (state.aiPreview ? previewModal() : '') +
    '</div>';
  }

  function activityRows(a, i) {
    var meta = [
      ['k-blue', 'Phản hồi dự kiến của trẻ', a.responses],
      ['k-amber', 'Khi trẻ chưa thực hiện được', a.support],
      ['k-green', 'Mở rộng khi trẻ xong sớm', a.extend],
      ['k-red', 'Lưu ý an toàn', a.safety]
    ];
    return '<tr><td class="acts__head-cell" colspan="3">' +
        '<div class="acts__head-inner">' +
          '<span class="acts__name">' + (i + 1) + '. ' + esc(a.name) + '</span>' +
          '<span class="acts__time">' + esc(a.time) + '</span>' +
        '</div></td></tr>' +
      '<tr>' +
        '<td class="acts__cell"><div class="acts__lines" contenteditable="true" data-edit="row" ' +
        'data-index="' + i + '" data-col="teacher" role="textbox" aria-multiline="true">' +
        (a.teacher || []).map(function (l) { return '<div>' + esc(l) + '</div>'; }).join('') + '</div></td>' +
        '<td class="acts__cell"><div class="acts__lines" contenteditable="true" data-edit="row" ' +
        'data-index="' + i + '" data-col="child" role="textbox" aria-multiline="true">' +
        (a.child || []).map(function (l) { return '<div>' + esc(l) + '</div>'; }).join('') + '</div></td>' +
        '<td class="acts__tools-cell"><div class="acts__tools">' +
          '<button type="button" class="icon-btn" title="Lên" data-action="row-up" data-index="' + i + '">↑</button>' +
          '<button type="button" class="icon-btn" title="Xuống" data-action="row-down" data-index="' + i + '">↓</button>' +
          '<button type="button" class="icon-btn icon-btn--danger" title="Xóa hàng" data-action="row-remove" ' +
          'data-index="' + i + '">✕</button>' +
        '</div></td>' +
      '</tr>' +
      '<tr><td class="acts__meta-cell" colspan="3"><div class="acts__meta">' +
        meta.map(function (m) {
          return '<div><b class="' + m[0] + '">' + esc(m[1]) + ':</b> ' + esc(m[2] || '—') + '</div>';
        }).join('') +
      '</div></td></tr>';
  }

  function previewModal() {
    var p = state.aiPreview;
    return '<div class="modal" role="dialog" aria-modal="true" aria-label="' + attr(p.label) + '">' +
      '<div class="modal__box">' +
        '<div class="modal__eyebrow">XEM TRƯỚC THAY ĐỔI CỦA AI</div>' +
        '<div class="modal__title">' + esc(p.label) + '</div>' +
        '<div class="modal__body">' + esc(p.text) + '</div>' +
        '<div class="modal__foot">' +
          '<button type="button" class="btn-modal" data-action="close-preview">' +
          (p.canApply ? 'Giữ nội dung cũ' : 'Đóng bản rà soát') + '</button>' +
          (p.canApply
            ? '<button type="button" class="btn-modal btn-modal--accept" data-action="accept-preview">' +
              'Áp dụng thay đổi</button>'
            : '') +
        '</div>' +
      '</div>' +
    '</div>';
  }

  /* ── Giáo án của tôi ─────────────────────────────────────────────────── */

  function filteredLibrary() {
    var q = state.query.trim().toLowerCase();
    var filter = state.libFilter;
    return visibleLibrary().filter(function (p) {
      if (q && p.title.toLowerCase().indexOf(q) === -1) return false;
      if (filter === 'Tất cả') return true;
      if (filter === 'Đã ghim') return state.pinned.indexOf(p.id) !== -1;
      return p.age.indexOf(filter.toUpperCase()) !== -1 || p.domain.indexOf(filter) !== -1;
    });
  }

  function viewLibrary() {
    var items = filteredLibrary();
    return '<div class="wrap">' +
      '<h1 class="h1">Giáo án đã lưu</h1>' +
      '<p class="lede">' + items.length + ' giáo án · ' + state.pinned.length + ' đã ghim</p>' +
      '<div class="lib-tools">' +
        '<input id="lib-search" class="lib-search" type="search" data-search="query" ' +
        'placeholder="Tìm theo tên giáo án" value="' + attr(state.query) + '">' +
        chips('libFilter', D.options.libFilters, true) +
      '</div>' +
      (items.length
        ? '<div class="lib-grid">' + items.map(function (p) {
            var pinnedOn = state.pinned.indexOf(p.id) !== -1;
            return '<div class="lib-card">' +
              '<div class="lib-card__top"><div class="lib-card__age">' + esc(p.age) + '</div>' +
              '<button type="button" class="pin" title="Ghim" data-action="pin" data-value="' + attr(p.id) + '" ' +
              'aria-pressed="' + pinnedOn + '">' + (pinnedOn ? '★' : '☆') + '</button></div>' +
              '<div class="lib-card__title">' + esc(p.title) + '</div>' +
              '<div class="lib-card__domain">' + esc(p.domain + ' · ' + p.theme) + '</div>' +
              '<div class="lib-card__date">Tạo ' + esc(p.date) + '</div>' +
              '<div class="lib-card__actions">' +
                '<button type="button" class="btn-mini" data-action="go" data-value="editor">Chỉnh sửa</button>' +
                '<button type="button" class="btn-mini" data-action="go" data-value="word">Word</button>' +
                '<button type="button" class="btn-mini btn-mini--green" data-action="go" data-value="ppt">PowerPoint</button>' +
                '<button type="button" class="btn-mini btn-mini--danger" data-action="trash" ' +
                'data-value="' + attr(p.id) + '">Thùng rác</button>' +
              '</div></div>';
          }).join('') + '</div>'
        : '<div class="empty"><div class="empty__title">Không tìm thấy giáo án phù hợp</div>' +
          '<div class="empty__body">Thử bỏ bộ lọc hoặc tạo giáo án mới.</div></div>') +
    '</div>';
  }

  /* ── Kho học liệu ────────────────────────────────────────────────────── */

  function materialTypes() {
    var out = [];
    D.materials.concat(state.myMaterials).forEach(function (h) {
      if (out.indexOf(h.loai) === -1) out.push(h.loai);
    });
    return out;
  }

  function filteredMaterials() {
    var q = state.matQuery.toLowerCase().trim();
    return D.materials.concat(state.myMaterials).filter(function (h) {
      if (q && (h.ten + ' ' + h.noiDung).toLowerCase().indexOf(q) === -1) return false;
      if (state.matAge && h.ages.indexOf(state.matAge) === -1) return false;
      if (state.matType && h.loai !== state.matType) return false;
      return true;
    });
  }

  function viewMaterials() {
    var list = filteredMaterials();
    return '<div class="wrap">' +
      '<h1 class="h1">Kho học liệu</h1>' +
      '<p class="lede">Thơ, truyện, trò chơi, hoạt động STEAM và Montessori — chèn thẳng vào giáo án đang mở.</p>' +
      '<div class="lib-tools">' +
        '<input id="mat-search" class="lib-search" type="search" data-search="matQuery" ' +
        'placeholder="Thơ, truyện, trò chơi…" value="' + attr(state.matQuery) + '">' +
        '<select class="input" style="width:auto" data-mat-age="1">' +
          '<option value="">Tất cả độ tuổi</option>' +
          D.options.mixedAges.map(function (a) {
            return '<option value="' + attr(a) + '"' + (state.matAge === a ? ' selected' : '') + '>' + esc(a) + '</option>';
          }).join('') +
        '</select>' +
        '<select class="input" style="width:auto" data-mat-type="1">' +
          '<option value="">Tất cả loại</option>' +
          materialTypes().map(function (t) {
            return '<option value="' + attr(t) + '"' + (state.matType === t ? ' selected' : '') + '>' + esc(t) + '</option>';
          }).join('') +
        '</select>' +
        '<button type="button" class="btn-use" data-action="mat-add">Thêm học liệu</button>' +
      '</div>' +
      (list.length
        ? '<div class="lib-grid">' + list.map(function (h) {
            var fav = state.matFavs.indexOf(h.id) !== -1;
            return '<div class="lib-card">' +
              '<div class="lib-card__top"><span class="status-chip status-chip--ok">' + esc(h.loai) + '</span>' +
              '<div style="display:flex;gap:5px;flex-wrap:wrap;justify-content:flex-end">' +
                h.ages.map(function (a) { return '<span class="status-chip">' + esc(a.replace('Trẻ ', '')) + '</span>'; }).join('') +
              '</div></div>' +
              '<div class="lib-card__title">' + esc(h.ten) + '</div>' +
              '<div class="lib-card__domain">' + esc(h.noiDung) + '</div>' +
              '<div class="lib-card__date">Nguồn: ' + esc(h.nguon) + '</div>' +
              '<div class="lib-card__actions">' +
                '<button type="button" class="btn-mini" data-action="mat-insert" data-value="' + attr(h.id) + '">Chèn vào giáo án</button>' +
                '<button type="button" class="btn-mini' + (fav ? ' btn-mini--green' : '') + '" ' +
                'data-action="mat-fav" data-value="' + attr(h.id) + '">' + (fav ? 'Đã lưu' : 'Lưu yêu thích') + '</button>' +
              '</div></div>';
          }).join('') + '</div>'
        : '<div class="empty"><div class="empty__title">Không tìm thấy học liệu phù hợp</div>' +
          '<div class="empty__body">Thử bỏ bộ lọc hoặc thêm học liệu của cô.</div></div>') +
    '</div>';
  }

  /* ── Hồ sơ cá nhân ───────────────────────────────────────────────────── */

  function viewProfile() {
    var p = state.profile;
    var pf = function (label, key, type) {
      return '<label class="label"><span class="field-label">' + esc(label) + '</span>' +
        '<input class="input" type="' + (type || 'text') + '" data-pfield="' + attr(key) + '" ' +
        'value="' + attr(p[key]) + '"></label>';
    };
    return '<div class="wrap wrap--narrow">' +
      '<h1 class="h1">Hồ sơ cá nhân</h1>' +
      '<p class="lede">Thông tin hiển thị trên giáo án và file xuất ra.</p>' +
      '<div class="card" style="display:flex;flex-direction:column;gap:22px;max-width:860px">' +
        '<div class="grid-2">' +
          pf('Họ tên', 'hoTen') +
          '<label class="label"><span class="field-label">Tên đăng nhập</span>' +
          '<input class="input" type="text" value="' + attr(p.username) + '" readonly ' +
          'style="background:var(--surface-soft);color:var(--muted)"></label>' +
          pf('Email', 'email', 'email') +
          pf('Trường', 'truong') +
          pf('Lớp', 'lop') +
          pf('Tỉnh/thành phố', 'tinh') +
          pf('Mẫu giáo án mặc định', 'mauMacDinh') +
          pf('Chữ ký hiển thị trên giáo án', 'chuKy') +
        '</div>' +
        '<div>' +
          '<div class="field-label" style="margin-bottom:10px">Nhóm tuổi thường dạy</div>' +
          '<div class="chip-row">' +
            D.options.mixedAges.map(function (a) {
              var on = (p.nhomTuoi || []).indexOf(a) !== -1;
              return '<button type="button" class="chip' + (on ? ' is-on' : '') + '" ' +
                'data-action="pfield-toggle-age" data-value="' + attr(a) + '">' + esc(a) + '</button>';
            }).join('') +
          '</div>' +
        '</div>' +
        '<div style="display:flex;gap:10px">' +
          '<button type="button" class="btn btn--pink" data-action="save-profile">Lưu hồ sơ</button>' +
          '<button type="button" class="btn" data-action="change-password">Đổi mật khẩu</button>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  /* ── Tải Word lên ────────────────────────────────────────────────────── */

  /* Các giá trị có thể chọn ở cột "Ánh xạ thành". Phải phủ hết mọi nhãn mà
     js/docx-read.js có thể sinh ra, nếu không thì thẻ select sẽ hiện sai. */
  var MAP_TARGETS = ['Chưa xác định', 'Tên hoạt động', 'Tên trường', 'Giáo viên', 'Tên lớp',
    'Nhóm tuổi', 'Nhóm tuổi (lớp ghép)', 'Chủ đề', 'Chủ đề nhánh', 'Lĩnh vực', 'Thời lượng',
    'Địa điểm', 'Ngày thực hiện', 'Số lượng trẻ', 'Hình thức tổ chức', 'Thông tin giáo án',
    'Mục tiêu', 'Chuẩn bị', 'Bảng hoạt động', 'Ghi chú bảng hoạt động', 'Phần bổ sung',
    'Khu vực ký tên', 'Bỏ qua'];

  function viewUpload() {
    if (!state.adminToggles.upload) {
      return '<div class="wrap wrap--narrow">' +
        '<h1 class="h1">Tải Word lên – chuyển thành PowerPoint</h1>' +
        '<p class="lede">Quản trị viên đang tắt tính năng tải Word lên. Bật lại ở màn hình Quản trị.</p></div>';
    }

    var phase = state.upload === 'idle' ? 0 : state.upload === 'working' ? 1 : 2;
    var head = '<div class="wrap wrap--narrow">' +
      '<h1 class="h1">Tải Word lên – chuyển thành PowerPoint</h1>' +
      '<p class="lede">Chỉ nhận file .docx. Hệ thống đọc nội dung, phát hiện mục I, II, III và bảng hoạt động, ' +
      'rồi cho chị sửa lại phần nhận dạng sai.</p>' +
      '<div class="up-steps">' +
        D.uploadSteps.map(function (label, i) {
          return '<div class="up-step' + (phase >= i ? ' is-on' : '') + '">' + esc(label) + '</div>';
        }).join('') +
      '</div>';

    var body;
    if (state.upload === 'idle') {
      body = '<button type="button" class="dropzone" id="dropzone" data-action="pick-file">' +
        '<div class="dropzone__title">Kéo file .docx vào đây hoặc bấm để chọn</div>' +
        '<div class="dropzone__body">Tối đa 10 MB. Hệ thống kiểm tra chữ ký gói và nội dung thực tế, ' +
        'không chỉ đuôi file.<br>Nội dung trong file được xem là tài liệu đầu vào, không phải chỉ dẫn hệ thống.</div>' +
        '</button>' +
        (state.upError ? '<div class="note-red" style="margin-top:16px">' + esc(state.upError) + '</div>' : '') +
        (window.DOCXREAD.available() ? '' :
          '<div class="note-yellow" style="margin-top:16px">Trình duyệt này chưa hỗ trợ giải nén trong trang ' +
          '(thiếu DecompressionStream), nên app chưa đọc được .docx. Mở app bằng Chrome hoặc Edge bản mới.</div>');
    } else if (state.upload === 'working') {
      body = '<div class="up-working">' +
        '<div class="up-working__row"><div class="spinner"></div>' + esc(state.upStatus) + '</div>' +
        '<div class="bar"><div class="bar__fill" style="width:' + state.upPct + '%"></div></div>' +
        '<div class="up-working__file">' + esc(state.upFileLabel || '') + '</div>' +
      '</div>';
    } else {
      body = uploadMapped();
    }

    return head + body + '</div>';
  }

  function uploadMapped() {
    var r = state.upResult;
    var undetermined = r.rows.filter(function (x) { return x.target === 'Chưa xác định'; }).length;
    var noActivities = !r.lesson.activities.length;
    /* File không phải giáo án có thể ra hàng trăm đoạn. Hiện hết thì bảng thành
       vô dụng, nên chỉ hiện phần đầu và nói rõ còn bao nhiêu. */
    var LIMIT = 40;
    var rows = r.rows.slice(0, LIMIT);
    var hidden = r.rows.length - rows.length;

    return '<div class="card" style="padding:26px 28px">' +
      '<div class="map-head"><div>' +
        '<div class="map-head__title">Bản xem trước phần nhận dạng</div>' +
        '<div class="map-head__body">Sửa lại nếu hệ thống ánh xạ chưa đúng. Không tự tạo PowerPoint khi ' +
        'còn phần chưa xác định.</div></div>' +
        '<button type="button" class="btn-use" data-action="reset-upload">Tải file khác</button>' +
      '</div>' +
      '<div style="overflow-x:auto"><table class="table table--map">' +
        '<thead><tr>' +
          '<th style="width:42%">Đoạn trong file Word</th>' +
          '<th style="width:30%">Ánh xạ thành</th>' +
          '<th>Độ tin cậy</th>' +
        '</tr></thead><tbody>' +
          rows.map(function (m, i) {
            var cls = m.conf === 'Cao' || m.conf === 'Đã sửa' ? 'status-chip--ok'
              : m.conf === 'Trung bình' ? 'status-chip--soon' : 'status-chip';
            return '<tr>' +
              '<td>' + esc(m.text) + '</td>' +
              '<td><select class="input" style="font-size:13px;padding:7px 9px" data-map-row="' + i + '">' +
                /* Nhãn lạ (nếu có) vẫn phải hiện đúng thay vì rơi về mục đầu. */
                (MAP_TARGETS.indexOf(m.target) === -1 ? [m.target] : []).concat(MAP_TARGETS).map(function (t) {
                  return '<option value="' + attr(t) + '"' + (t === m.target ? ' selected' : '') + '>' +
                    esc(t) + '</option>';
                }).join('') +
              '</select></td>' +
              '<td><span class="status-chip ' + cls + '">' + esc(m.conf) + '</span></td>' +
            '</tr>';
          }).join('') +
        '</tbody></table></div>' +

      '<div class="note-yellow" style="margin-top:18px">' +
        'Đã đọc: ' + r.stats.activities + ' hoạt động · ' + r.stats.tables + ' bảng · ' +
        (r.stats.hasObjectives ? 'có mục tiêu' : 'chưa thấy mục tiêu') + ' · ' +
        (r.stats.hasPrep ? 'có phần chuẩn bị' : 'chưa thấy phần chuẩn bị') + '.' +
        (hidden ? ' Bảng chỉ hiện ' + LIMIT + ' đoạn đầu, còn ' + hidden + ' đoạn nữa không hiện hết.' : '') +
        (undetermined && !noActivities
          ? ' Còn ' + undetermined + ' đoạn chưa xác định — chọn giá trị ở cột "Ánh xạ thành" ' +
            '(hoặc "Bỏ qua") để tiếp tục.'
          : '') +
      '</div>' +

      '<div class="rule rule--sm"></div>' +
      '<div class="field-label" style="margin-bottom:10px">Số slide</div>' +
      chips('slideCount', D.options.slideCounts, true) +
      '<button type="button" class="btn-cta" data-action="upload-to-ppt"' +
      (undetermined || noActivities ? ' disabled' : '') + '>TÓM TẮT VÀ TẠO POWERPOINT</button>' +
      (noActivities
        ? '<div class="note-red" style="margin-top:14px">Chưa tìm thấy bảng hoạt động hai cột trong file, ' +
          'nên chưa tóm tắt được thành slide. Kiểm tra lại file hoặc mở giáo án trong trình soạn thảo.</div>'
        : '') +
    '</div>';
  }

  /* ── Xem trước Word ──────────────────────────────────────────────────── */

  function viewWord() {
    var L = state.lesson, info = L.info;
    var diff = L.objectives.differentiated || [];
    var wordRows = [
      ['Giáo viên: ' + info.teacher, 'Lớp: ' + info.className],
      ['Độ tuổi: ' + info.ageLabel, 'Số trẻ: ' + info.size],
      ['Chủ đề: ' + info.theme, 'Chủ đề nhánh: ' + info.subtheme],
      ['Lĩnh vực: ' + info.domain, 'Thời gian: ' + info.duration],
      ['Địa điểm: ' + info.place, 'Ngày thực hiện: ' + info.date]
    ];

    return '<div class="wrap wrap--word">' +
      '<div class="preview-head"><div>' +
        '<h1 class="h1">Xem trước file Word</h1>' +
        '<p class="preview-head__file">' + esc(window.DOCX.fileName(L)) + '</p></div>' +
        '<div class="preview-head__buttons">' +
          '<button type="button" class="btn" data-action="go" data-value="editor">Quay lại soạn thảo</button>' +
          '<button type="button" class="btn btn--pink" data-action="download-word">TẢI GIÁO ÁN WORD</button>' +
        '</div>' +
      '</div>' +
      '<div class="word-cols">' +
        '<div class="paper-wrap"><div class="paper">' +
          '<div class="paper__school">' + esc(info.school) + '</div>' +
          '<div class="paper__title">Giáo án ' + esc(info.type) + '</div>' +
          '<div class="paper__topic">Đề tài: ' + esc(info.activity) + '</div>' +
          '<table class="paper__info">' +
            wordRows.map(function (r) {
              return '<tr><td>' + esc(r[0]) + '</td><td>' + esc(r[1]) + '</td></tr>';
            }).join('') +
          '</table>' +
          '<div class="paper__h">I. MỤC ĐÍCH – YÊU CẦU</div>' +
          D.objectiveLabels.map(function (pair) {
            var items = L.objectives[pair[0]] || [];
            if (!items.length) return '';
            return '<div class="paper__block"><div class="paper__block-label">' + esc(pair[1]) + '</div>' +
              items.map(function (line) { return '<div class="paper__line">- ' + esc(line) + '</div>'; }).join('') +
            '</div>';
          }).join('') +
          (diff.length
            ? '<div class="paper__block">' +
              '<div class="paper__block-label">5. Mục tiêu phân hóa theo nhóm tuổi</div>' +
              diff.map(function (g) {
                return '<div class="paper__line"><div class="paper__group">' + esc(g.group) + '</div>' +
                  (g.items || []).map(function (line) {
                    return '<div class="paper__line--deep">- ' + esc(line) + '</div>';
                  }).join('') + '</div>';
              }).join('') + '</div>'
            : '') +
          '<div class="paper__h">II. CHUẨN BỊ</div>' +
          D.prepLabels.map(function (pair) {
            var items = (L.prep && L.prep[pair[0]]) || [];
            if (!items.length) return '';
            return '<div class="paper__block paper__block--tight">' +
              '<div class="paper__block-label">' + esc(pair[1]) + '</div>' +
              items.map(function (line) { return '<div class="paper__line">- ' + esc(line) + '</div>'; }).join('') +
            '</div>';
          }).join('') +
          '<div class="paper__h">III. HOẠT ĐỘNG HỌC</div>' +
          '<table class="paper__table"><thead><tr>' +
            '<th>Hoạt động của cô</th><th>Hoạt động của trẻ</th>' +
          '</tr></thead><tbody>' +
            (L.activities || []).map(function (a, i) {
              return '<tr><td>' +
                '<div class="paper__act-name">' + (i + 1) + '. ' + esc(a.name) + ' (' + esc(a.time) + ')</div>' +
                (a.teacher || []).map(function (l) { return '<div>' + esc(l) + '</div>'; }).join('') +
              '</td><td>' +
                (a.child || []).map(function (l) { return '<div>' + esc(l) + '</div>'; }).join('') +
                (a.responses && a.responses !== '—'
                  ? '<div class="paper__expect">Dự kiến: ' + esc(a.responses) + '</div>' : '') +
              '</td></tr>';
            }).join('') +
          '</tbody></table>' +
          '<div class="paper__sign">' +
            '<div class="paper__sign-col">Ban giám hiệu<div class="paper__sign-gap"></div></div>' +
            '<div class="paper__sign-col">Giáo viên soạn<div class="paper__sign-gap"></div>' +
            '<div class="paper__sign-name">' + esc(info.teacher) + '</div></div>' +
          '</div>' +
          '<div class="paper__pageno">1</div>' +
        '</div></div>' +
        '<div class="word-rail">' +
          '<div class="rail__title">Định dạng Word</div>' +
          D.wordSettings.map(function (s) {
            return '<div class="word-rail__row"><div class="word-rail__k">' + esc(s.k) + '</div>' +
              '<div class="word-rail__v">' + esc(s.v) + '</div></div>';
          }).join('') +
          '<div class="word-rail__foot">Hàng tiêu đề của bảng được lặp lại khi sang trang. ' +
          'Có số trang và khu vực ký tên.</div>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  /* ── Xem trước PowerPoint ────────────────────────────────────────────── */

  function slideCap() {
    var c = state.slideCount;
    if (c === '6–8 slide') return 8;
    if (c === '9–12 slide') return 12;
    if (c === '13–15 slide') return 15;
    return null;
  }

  function currentSlides() {
    return C.slides(state.lesson, slideCap());
  }

  function viewPpt() {
    var slides = currentSlides();
    var natural = C.slides(state.lesson, null).length;
    var capped = slideCap() && natural > slideCap();

    return '<div class="wrap">' +
      '<div class="preview-head"><div>' +
        '<h1 class="h1">Xem trước PowerPoint</h1>' +
        '<p class="lede" style="margin:0">' + slides.length + ' slide · tỷ lệ 16:9 · tóm tắt từ giáo án, ' +
        'không chép nguyên văn' + (capped ? ' · đã cắt bớt từ ' + natural + ' slide' : '') + '</p></div>' +
        '<div class="preview-head__buttons">' +
          '<button type="button" class="btn" data-action="go" data-value="editor">Quay lại soạn thảo</button>' +
          '<button type="button" class="btn btn--green" data-action="download-ppt">TẢI FILE .PPTX</button>' +
        '</div>' +
      '</div>' +
      chips('slideCount', D.options.slideCounts, true) +
      '<div class="slide-grid" style="margin-top:20px">' +
        slides.map(function (s, i) {
          return '<div>' +
            '<div class="slide' + (s.cover ? ' slide--cover' : '') + '">' +
              '<div class="slide__top">' +
                '<div class="slide__kicker">' + esc(s.kicker) + '</div>' +
                '<div class="slide__n">' + (i + 1) + '/' + slides.length + '</div>' +
              '</div>' +
              '<div class="slide__title">' + esc(s.title) + '</div>' +
              '<div class="slide__bullets">' +
                (s.bullets || []).map(function (b) {
                  return '<div class="slide__bullet"><div class="slide__dot"></div><div>' + esc(b) + '</div></div>';
                }).join('') +
              '</div>' +
              (s.image && !s.cover
                ? '<div class="slide__image">Vùng đặt hình ảnh minh họa</div>' : '') +
            '</div>' +
            (state.showNotes
              ? '<div class="slide__notes"><b>Ghi chú cho cô:</b> ' + esc(s.notes) + '</div>' : '') +
          '</div>';
        }).join('') +
      '</div>' +
    '</div>';
  }

  /* ── Cấu hình chương trình ─────────────────────────────────────────────
     Gộp "Căn cứ và tham chiếu" và các công tắc tính năng của bản cũ — bản
     thiết kế mới chỉ có một màn hình quản trị: danh mục văn bản chương
     trình đơn vị đang áp dụng (sửa được trạng thái, thêm, xóa). */

  function viewAdmin() {
    return '<div class="wrap wrap--narrow">' +
      '<h1 class="h1">Cấu hình chương trình</h1>' +
      '<p class="lede">Văn bản chương trình mà đơn vị đang áp dụng. AI chỉ dẫn căn cứ pháp lý từ danh mục này, ' +
      'không tự bịa số hiệu hay điều khoản.</p>' +
      '<div class="note-yellow" style="margin-bottom:22px">' + esc(D.disclaimer) + '</div>' +
      '<div class="panel">' +
        '<div style="overflow-x:auto"><table class="table table--refs"><thead><tr>' +
          '<th style="width:26%">Văn bản / chương trình</th><th style="width:15%">Số hiệu</th>' +
          '<th style="width:15%">Cơ quan</th><th style="width:11%">Hiệu lực</th>' +
          '<th style="width:16%">Trạng thái</th><th style="width:11%">Kiểm tra gần nhất</th><th style="width:40px"></th>' +
        '</tr></thead><tbody>' +
          state.config.map(function (c, i) {
            return '<tr>' +
              '<td>' + esc(c.name) + '</td>' +
              '<td class="code">' + esc(c.code) + '</td>' +
              '<td class="issuer">' + esc(c.org) + '</td>' +
              '<td class="code">' + esc(c.effective) + '</td>' +
              '<td><select class="input" style="height:36px;padding:0 9px;font-size:12.5px" data-config-row="' + i + '">' +
                ['Đang áp dụng', 'Sắp áp dụng', 'Hết hiệu lực'].map(function (s) {
                  return '<option value="' + s + '"' + (c.status === s ? ' selected' : '') + '>' + s + '</option>';
                }).join('') +
              '</select></td>' +
              '<td class="checked">' + esc(c.checked) + '</td>' +
              '<td><button type="button" class="icon-btn icon-btn--danger" title="Xóa" ' +
              'data-action="config-del" data-value="' + i + '">✕</button></td>' +
            '</tr>';
          }).join('') +
        '</tbody></table></div>' +
        '<button type="button" class="btn-use" style="margin-top:16px" data-action="config-add">Thêm văn bản</button>' +
      '</div>' +
      '<div class="rule"></div>' +
      '<div class="panel panel--sm" style="max-width:420px">' +
        '<div class="panel__title panel__title--sm">Giới hạn và tính năng</div>' +
        '<div style="display:grid;gap:10px">' +
          D.toggles.map(function (t) {
            var on = !!state.adminToggles[t[1]];
            return '<div class="toggle-row"><div class="toggle-row__label">' + esc(t[0]) + '</div>' +
              '<button type="button" class="switch' + (on ? ' is-on' : '') + '" ' +
              'data-action="admin-toggle" data-value="' + attr(t[1]) + '" role="switch" ' +
              'aria-checked="' + on + '" aria-label="' + attr(t[0]) + '">' +
              '<div class="switch__knob"></div></button></div>';
          }).join('') +
        '</div>' +
      '</div>' +
    '</div>';
  }

  /* ── Render ──────────────────────────────────────────────────────────── */

  var SCREENS = {
    dashboard: viewDashboard, wizard: viewWizard, editor: viewEditor,
    library: viewLibrary, upload: viewUpload, word: viewWord, ppt: viewPpt,
    materials: viewMaterials, profile: viewProfile, admin: viewAdmin
  };

  function render() {
    var root = document.getElementById('app');
    var html;

    if (state.view === 'login') {
      html = viewLogin();
    } else {
      html = '<div class="shell">' + sidebar() + '<main class="main">' +
        (SCREENS[state.view] || viewDashboard)() + '</main></div>';
    }

    if (state.toastMsg) {
      html += '<div class="toast" role="status">' + esc(state.toastMsg) + '</div>';
    }

    root.innerHTML = html;

    /* Đặt lại con trỏ vào ô đang gõ (ô tìm kiếm ở thư viện). */
    if (state.focusId) {
      var el = document.getElementById(state.focusId);
      if (el) {
        el.focus();
        if (el.setSelectionRange && el.type !== 'search') {
          el.setSelectionRange(el.value.length, el.value.length);
        } else if (el.type === 'search') {
          var v = el.value;
          el.value = '';
          el.value = v;
        }
      }
      state.focusId = null;
    }
  }

  /* ── Hành động ───────────────────────────────────────────────────────── */

  function goto(view) {
    state.view = view;
    state.aiPreview = null;
    if (view !== 'upload') state.upError = null;
    render();
    window.scrollTo(0, 0);
  }

  function toggleChip(key, value, single) {
    if (single) {
      state[key] = value;
    } else {
      var list = state[key] || [];
      state[key] = list.indexOf(value) !== -1
        ? list.filter(function (x) { return x !== value; })
        : list.concat([value]);
      if (key === 'ages') state.mixed = state[key].indexOf('Lớp ghép nhiều độ tuổi') !== -1;
    }
    render();
  }

  /*
    Thanh tiến trình cho lúc chờ AI.

    Máy chủ trả kết quả một lần duy nhất, không có luồng dữ liệu chạy dần, nên
    KHÔNG có tiến độ thật để hiển thị. Thanh này chạy theo thời gian: tăng
    nhanh lúc đầu rồi chậm dần, tiệm cận 92% và DỪNG ở đó cho tới khi kết quả
    thật về mới nhảy lên 100%.

    Cố ý không bao giờ tự chạm 100%: thanh đầy mà vẫn phải chờ thì còn khó chịu
    hơn là không có thanh nào. Kèm số giây đã trôi để cô biết máy vẫn đang chạy
    chứ không treo.
  */
  var GEN_STAGES = [
    [0, 'Đang đọc lại lựa chọn của chị…'],
    [12, 'Đang dựng mục tiêu và phần chuẩn bị…'],
    [35, 'Đang viết bảng hoạt động hai cột…'],
    [75, 'Đang rà lại thời lượng và phân hóa…'],
    [110, 'Sắp xong, đang hoàn thiện…']
  ];

  function genTick() {
    var sec = (Date.now() - state.genStartedAt) / 1000;
    /* Đường cong tiệm cận: nhanh ở đầu, chậm dần về sau. tau=45 cho khoảng
       88% ở mốc 90 giây — sát với thời gian thực đo được (~2 phút). */
    state.genPct = Math.min(92, 92 * (1 - Math.exp(-sec / 45)));
    state.genSec = Math.floor(sec);
    var label = GEN_STAGES[0][1];
    for (var i = 0; i < GEN_STAGES.length; i++) {
      if (sec >= GEN_STAGES[i][0]) label = GEN_STAGES[i][1];
    }
    state.genStage = label;

    /* Sửa thẳng ba nút DOM thay vì render() cả app. Vẽ lại toàn bộ 2 lần mỗi
       giây trong 2 phút là 240 lần dựng DOM không cần thiết, và mỗi lần dựng
       lại phần tử là hiệu ứng trượt CSS bị huỷ nên thanh chạy giật. */
    var fill = document.querySelector('.genbar__fill');
    if (!fill) return;   /* cô đã chuyển sang màn khác — bỏ qua */
    fill.style.width = Math.round(state.genPct) + '%';

    var stage = document.querySelector('.genbar__stage');
    if (stage) stage.textContent = state.genStage;

    var time = document.querySelector('.genbar__time');
    if (time) {
      var s = state.genSec, mm = Math.floor(s / 60), ss = s % 60;
      time.textContent = 'đã chờ ' + (mm > 0 ? mm + ' phút ' + ss + ' giây' : s + ' giây');
    }
  }

  function generate() {
    if (state.generating) return;
    state.generating = true;
    state.aiError = null;
    state.genStartedAt = Date.now();
    state.genPct = 0;
    state.genSec = 0;
    state.genStage = GEN_STAGES[0][1];
    clearInterval(state._genTimer);
    state._genTimer = setInterval(genTick, 500);
    render();

    C.generate(state).then(function (result) {
      clearInterval(state._genTimer);
      state._genTimer = null;
      state.generating = false;
      state.lesson = result.lesson;
      state.lessonSource = result.source;
      state.aiError = result.error;
      state.versions = [];
      stamp(result.source === 'model' ? 'Bản do AI tạo lần đầu' : 'Bản do app dựng từ lựa chọn');
      state.view = 'editor';
      flash(result.source === 'model'
        ? 'Đã tạo giáo án bằng AI'
        : 'Đã dựng giáo án từ lựa chọn của chị');
      window.scrollTo(0, 0);
    });
  }

  function aiAction(label) {
    var pair = D.aiActions.filter(function (p) { return p[0] === label; })[0];
    var modalLabel = pair ? pair[1] : label;
    state.aiPreview = { key: label, label: modalLabel, text: 'Đang soạn bản xem trước...', canApply: false };
    state._pendingPatch = null;
    render();
    C.review(label, state.lesson).then(function (result) {
      /* Cô có thể đã đóng hộp thoại hoặc bấm việc khác trong lúc chờ AI trả lời. */
      if (!state.aiPreview || state.aiPreview.key !== label) return;
      state.aiPreview = { key: label, label: modalLabel, text: result.text, canApply: !!result.patch };
      state._pendingPatch = result.patch || null;
      render();
    });
  }

  function acceptPreview() {
    var patch = state._pendingPatch;
    var label = state.aiPreview ? state.aiPreview.label : '';
    state.aiPreview = null;
    state._pendingPatch = null;
    if (patch) {
      editLesson(patch, 'AI ' + label.toLowerCase());
      flash('Đã áp dụng thay đổi và lưu phiên bản mới');
    } else {
      render();
    }
  }

  /* Đọc lại các dòng trong một khối contenteditable. */
  function linesFrom(el, stripDash) {
    return el.innerText.split('\n')
      .map(function (x) { return stripDash ? x.replace(/^[–-]\s*/, '').trim() : x.trim(); })
      .filter(Boolean);
  }

  function setPath(lesson, path, value) {
    var parts = path.split('.');
    var cur = lesson;
    for (var i = 0; i < parts.length - 1; i++) cur = cur[parts[i]];
    cur[parts[parts.length - 1]] = value;
  }

  function pickFile() {
    if (!window.DOCXREAD.available()) {
      state.upError = 'Trình duyệt này chưa giải nén được .docx trong trang. Mở app bằng Chrome hoặc Edge bản mới.';
      render();
      return;
    }
    document.getElementById('docx-picker').click();
  }

  function handleFile(file) {
    if (!file) return;
    state.upload = 'working';
    state.upPct = 4;
    state.upStatus = 'Đang chuẩn bị đọc file...';
    state.upError = null;
    state.upFileLabel = file.name + ' · ' + (file.size / 1024).toFixed(0) + ' KB';
    render();

    window.DOCXREAD.readFile(file, function (pct, msg) {
      state.upPct = pct;
      state.upStatus = msg;
      render();
    }).then(function (result) {
      state.upResult = result;
      state.upload = 'mapped';
      state.upFileLabel = result.file.name + ' · ' + result.file.sizeLabel;
      state.uploadsCount += 1;
      render();
      flash('Đã đọc ' + result.file.name + ' — ' + result.stats.activities + ' hoạt động');
    }).catch(function (err) {
      state.upload = 'idle';
      state.upPct = 0;
      state.upError = 'Không đọc được file: ' + (err && err.message ? err.message : 'lỗi không rõ');
      render();
    });
  }

  var ACTIONS = {
    login: function () {
      var f = state.loginForm;
      if (!f.username.trim() || !f.password.trim()) {
        state.loginError = 'Nhập tên đăng nhập và mật khẩu.';
        render();
        return;
      }
      if (state.loginBusy) return;   /* chặn bấm hai lần khi mạng chậm */
      state.loginBusy = true;
      state.loginError = null;
      render();

      fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ username: f.username, password: f.password })
      }).then(function (res) {
        return res.json().catch(function () { return null; }).then(function (data) {
          return { ok: res.ok, data: data };
        });
      }).then(function (r) {
        state.loginBusy = false;
        if (r.ok && r.data && r.data.ok) {
          /* Không giữ lại mật khẩu trong bộ nhớ sau khi đã dùng xong. */
          state.loginForm = { username: '', password: '' };
          state.loginError = null;
          goto('dashboard');
          return;
        }
        state.loginError = (r.data && r.data.error) || 'Không đăng nhập được.';
        render();
      }).catch(function () {
        state.loginBusy = false;
        state.loginError = 'Không nối được máy chủ. Kiểm tra lại đường mạng.';
        render();
      });
    },
    logout: function () {
      /* Đưa về màn hình đăng nhập ngay, không đợi máy chủ trả lời — cô đã bấm
         thì phải thấy mình đã ra khỏi app. Cookie vẫn được xoá ở nền. */
      fetch('/api/logout', { method: 'POST' }).catch(function () {});
      state.loginForm = { username: '', password: '' };
      goto('login');
    },
    go: function (el) { goto(el.getAttribute('data-value')); },
    'start-wizard': function () { state.step = 1; goto('wizard'); },

    step: function (el) { state.step = Number(el.getAttribute('data-value')); render(); },
    'prev-step': function () { state.step = Math.max(1, state.step - 1); render(); },
    'next-step': function () {
      if (state.step === 5) generate();
      else { state.step = Math.min(5, state.step + 1); render(); }
    },
    generate: generate,

    chip: function (el) {
      toggleChip(el.getAttribute('data-key'), el.getAttribute('data-value'),
        el.hasAttribute('data-single'));
    },

    'add-row': function () {
      editLesson(function (L) {
        L.activities.push({
          name: 'Hoạt động mới', time: '3 phút',
          teacher: ['Cô ...'], child: ['Trẻ ...'],
          responses: '—', support: '—', extend: '—', safety: '—'
        });
      }, 'Thêm một hoạt động');
      render();
    },
    'row-up': function (el) { moveRow(Number(el.getAttribute('data-index')), -1); },
    'row-down': function (el) { moveRow(Number(el.getAttribute('data-index')), 1); },
    'row-remove': function (el) {
      var i = Number(el.getAttribute('data-index'));
      var name = state.lesson.activities[i] ? state.lesson.activities[i].name : '';
      editLesson(function (L) { L.activities.splice(i, 1); }, 'Xóa hoạt động');
      flash('Đã xóa hoạt động "' + name + '"');
    },

    'ai-action': function (el) { aiAction(el.getAttribute('data-value')); },
    'close-preview': function () {
      state.aiPreview = null;
      state._pendingPatch = null;
      render();
    },
    'accept-preview': acceptPreview,

    pin: function (el) {
      var id = el.getAttribute('data-value');
      state.pinned = state.pinned.indexOf(id) !== -1
        ? state.pinned.filter(function (x) { return x !== id; })
        : state.pinned.concat([id]);
      render();
    },
    trash: function (el) {
      var id = el.getAttribute('data-value');
      var item = D.library.filter(function (p) { return p.id === id; })[0];
      state.trashed = state.trashed.concat([id]);
      state.pinned = state.pinned.filter(function (x) { return x !== id; });
      flash('Đã chuyển "' + (item ? item.title : '') + '" vào thùng rác. Có thể khôi phục trong 30 ngày.');
    },

    /* Kho học liệu. */
    'mat-fav': function (el) {
      var id = el.getAttribute('data-value');
      state.matFavs = state.matFavs.indexOf(id) !== -1
        ? state.matFavs.filter(function (x) { return x !== id; })
        : state.matFavs.concat([id]);
      render();
    },
    'mat-insert': function (el) {
      var id = el.getAttribute('data-value');
      var item = D.materials.concat(state.myMaterials).filter(function (h) { return h.id === id; })[0];
      if (!item) return;
      editLesson(function (L) {
        L.prep.materials = (L.prep.materials || []).concat([
          item.loai + ': ' + item.ten + (item.nguon ? ' (' + item.nguon + ')' : '')
        ]);
      }, 'Chèn học liệu');
      flash('Đã chèn "' + item.ten + '" vào phần học liệu và thiết bị của giáo án đang mở.');
    },
    'mat-add': function () {
      var ten = prompt('Tên học liệu'); if (!ten) return;
      var loai = prompt('Loại học liệu (Thơ, Câu chuyện, Trò chơi, Câu đố...)', 'Trò chơi') || 'Khác';
      var noiDung = prompt('Mô tả ngắn') || '';
      var nguon = prompt('Nguồn hoặc tác giả (nếu có)') || 'Giáo viên cung cấp';
      state.myMaterials = state.myMaterials.concat([
        { id: 'my' + Date.now(), loai: loai, ten: ten, ages: [], noiDung: noiDung, nguon: nguon }
      ]);
      flash('Đã thêm học liệu của cô.');
    },

    /* Hồ sơ cá nhân. */
    'pfield-toggle-age': function (el) {
      var v = el.getAttribute('data-value');
      var list = state.profile.nhomTuoi || [];
      state.profile.nhomTuoi = list.indexOf(v) !== -1
        ? list.filter(function (x) { return x !== v; })
        : list.concat([v]);
      render();
    },
    'save-profile': function () { flash('Đã lưu hồ sơ.'); },
    'change-password': function () {
      flash('Đổi mật khẩu sẽ dùng hệ thống xác thực của trường. Bản dùng thử chưa bật chức năng này.');
    },

    /* Cấu hình chương trình. */
    'config-del': function (el) {
      var i = Number(el.getAttribute('data-value'));
      state.config = state.config.filter(function (_, j) { return j !== i; });
      render();
    },
    'config-add': function () {
      var ten = prompt('Tên văn bản hoặc chương trình'); if (!ten) return;
      var so = prompt('Số hiệu', '') || '';
      var org = prompt('Cơ quan ban hành', 'Bộ Giáo dục và Đào tạo') || '';
      var eff = prompt('Ngày hiệu lực', '') || '';
      state.config = state.config.concat([
        { code: so, name: ten, org: org, effective: eff, status: 'Sắp áp dụng', checked: new Date().toLocaleDateString('vi-VN') }
      ]);
      flash('Đã thêm văn bản vào cấu hình.');
    },

    'pick-file': pickFile,
    'reset-upload': function () {
      state.upload = 'idle';
      state.upPct = 0;
      state.upResult = null;
      state.upError = null;
      render();
    },
    'upload-to-ppt': function () {
      var r = state.upResult;
      if (!r) return;
      state.lesson = r.lesson;
      state.lessonSource = 'docx';
      state.versions = [];
      stamp('Đọc từ ' + r.file.name);
      state.view = 'ppt';
      flash('Đã tóm tắt ' + r.file.name + ' thành ' + currentSlides().length + ' slide');
      window.scrollTo(0, 0);
    },

    'download-word': function () {
      try {
        var name = window.DOCX.download(state.lesson);
        flash('Đã tải ' + name);
      } catch (err) {
        flash('Không tạo được file Word: ' + (err && err.message ? err.message : 'lỗi không rõ'));
      }
    },
    'download-ppt': function () {
      try {
        var name = window.PPTX.download(currentSlides(), state.lesson);
        flash('Đã tải ' + name);
      } catch (err) {
        flash('Không tạo được file PowerPoint: ' + (err && err.message ? err.message : 'lỗi không rõ'));
      }
    },

    'admin-toggle': function (el) {
      var key = el.getAttribute('data-value');
      state.adminToggles[key] = !state.adminToggles[key];
      render();
    }
  };

  function moveRow(i, delta) {
    var j = i + delta;
    if (j < 0 || j >= state.lesson.activities.length) return;
    editLesson(function (L) {
      var row = L.activities.splice(i, 1)[0];
      L.activities.splice(j, 0, row);
    }, 'Đổi thứ tự hoạt động');
    render();
  }

  /* ── Gắn sự kiện ─────────────────────────────────────────────────────── */

  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-action]');
    if (!el || el.disabled) return;
    var action = ACTIONS[el.getAttribute('data-action')];
    if (!action) return;
    e.preventDefault();
    action(el);
  });

  /* Ô nhập chữ: cập nhật state, không render lại (giữ con trỏ). */
  document.addEventListener('input', function (e) {
    var el = e.target;
    var key = el.getAttribute && el.getAttribute('data-field');
    if (key) {
      state.form[key] = el.value;
      return;
    }
    var loginKey = el.getAttribute && el.getAttribute('data-login-field');
    if (loginKey) {
      state.loginForm[loginKey] = el.value;
      return;
    }
    var pkey = el.getAttribute && el.getAttribute('data-pfield');
    if (pkey) {
      state.profile[pkey] = el.value;
      return;
    }
    var searchKey = el.getAttribute && el.getAttribute('data-search');
    if (searchKey) {
      state[searchKey] = el.value;
      state.focusId = el.id;
      render();
    }
  });

  /* Enter trong ô mật khẩu/tên đăng nhập cũng đăng nhập được. */
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && e.target.getAttribute && e.target.getAttribute('data-login-field')) {
      ACTIONS.login();
    }
  });

  /* Cột "Ánh xạ thành" ở bảng nhận dạng file Word; trạng thái văn bản ở Cấu
     hình chương trình; hai bộ lọc ở Kho học liệu. */
  document.addEventListener('change', function (e) {
    var el = e.target;
    if (!el.getAttribute) return;

    var idx = el.getAttribute('data-map-row');
    if (idx != null && state.upResult) {
      var row = state.upResult.rows[Number(idx)];
      if (row) {
        row.target = el.value;
        row.conf = el.value === 'Chưa xác định' ? 'Thấp' : 'Đã sửa';
        render();
      }
      return;
    }

    var cfgIdx = el.getAttribute('data-config-row');
    if (cfgIdx != null && state.config[Number(cfgIdx)]) {
      state.config[Number(cfgIdx)].status = el.value;
      render();
      return;
    }

    if (el.getAttribute('data-mat-age') != null) { state.matAge = el.value; render(); return; }
    if (el.getAttribute('data-mat-type') != null) { state.matType = el.value; render(); return; }
  });

  /* Sửa trực tiếp trong trình soạn thảo — đọc lại khi rời khỏi ô. */
  document.addEventListener('blur', function (e) {
    var el = e.target;
    if (!el.getAttribute) return;
    var kind = el.getAttribute('data-edit');
    if (!kind) return;

    if (kind === 'lines') {
      var path = el.getAttribute('data-path');
      var lines = linesFrom(el, true);
      editLesson(function (L) { setPath(L, path, lines); }, 'Sửa mục I / mục II');
      render();
    } else if (kind === 'row') {
      var i = Number(el.getAttribute('data-index'));
      var col = el.getAttribute('data-col');
      var rowLines = linesFrom(el, false);
      editLesson(function (L) {
        if (L.activities[i]) L.activities[i][col] = rowLines;
      }, 'Sửa bảng hoạt động');
      render();
    }
  }, true);

  /* Kéo thả file .docx vào vùng tải lên. */
  document.addEventListener('dragover', function (e) {
    if (state.view !== 'upload' || state.upload !== 'idle') return;
    var zone = e.target.closest && e.target.closest('#dropzone');
    if (!zone) return;
    e.preventDefault();
    zone.classList.add('is-drag');
  });

  document.addEventListener('dragleave', function (e) {
    var zone = e.target.closest && e.target.closest('#dropzone');
    if (zone) zone.classList.remove('is-drag');
  });

  document.addEventListener('drop', function (e) {
    if (state.view !== 'upload') return;
    var zone = e.target.closest && e.target.closest('#dropzone');
    if (!zone) return;
    e.preventDefault();
    zone.classList.remove('is-drag');
    if (e.dataTransfer.files && e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
  });

  document.getElementById('docx-picker').addEventListener('change', function (e) {
    if (e.target.files && e.target.files.length) handleFile(e.target.files[0]);
    e.target.value = '';
  });

  /* Esc đóng hộp xem trước của AI. */
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && state.aiPreview) {
      state.aiPreview = null;
      state._pendingPatch = null;
      render();
    }
  });

  /* ── Khởi động ───────────────────────────────────────────────────────── */

  /* Dò máy chủ AI cục bộ xong thì vẽ lại — để các dòng ghi chú phụ thuộc vào
     C.hasModel() (ví dụ ở bước 5 của wizard) cập nhật đúng ngay khi biết. */
  C.onAiStatusChange = render;

  /* Phiên hết hạn khi đang soạn dở: đưa về đăng nhập kèm lời nhắc rõ ràng. */
  C.onUnauthorized = function () {
    state.loginError = 'Phiên đăng nhập đã hết hạn. Chị đăng nhập lại giúp.';
    goto('login');
  };

  stamp('Mở giáo án mẫu');
  render();

  /*
    Hỏi máy chủ xem còn phiên đăng nhập không. Vẽ trước rồi mới hỏi để không có
    khoảng trắng lúc chờ mạng.

    Quan trọng: chưa đăng nhập thì ép về màn hình đăng nhập, kể cả khi URL có
    ?screen=dashboard. Trước đây tham số đó đi thẳng vào state.view nên gõ tay
    là bỏ qua được đăng nhập. Đây chỉ là lớp giao diện — chốt chặn thật nằm ở
    máy chủ, /api/generate tự kiểm tra phiên.
  */
  fetch('/api/version', { cache: 'no-store' })
    .then(function (r) { return r.json(); })
    .then(function (v) { state.version = v; render(); })
    .catch(function () { /* không lấy được thì thôi, không hiện nhãn */ });

  fetch('/api/session', { cache: 'no-store' })
    .then(function (r) { return r.json(); })
    .then(function (s) {
      if (!s.loggedIn) {
        if (state.view !== 'login') goto('login');
      } else if (state.view === 'login') {
        /* Còn phiên thì khỏi bắt đăng nhập lại. Không có ?screen thì về trang chủ. */
        goto(startView !== 'login' ? startView : 'dashboard');
      }
    })
    .catch(function () { /* mất mạng: giữ nguyên màn hình đang hiện */ });
})();
