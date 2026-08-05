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
  var VIEWS = ['login', 'dashboard', 'wizard', 'editor', 'library', 'templates',
    'upload', 'word', 'ppt', 'refs', 'admin'];
  var startView = params.get('screen');
  if (VIEWS.indexOf(startView) === -1) startView = 'login';

  var state = {
    view: startView,
    step: 1,

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

  function icon(size) {
    return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" ' +
      'stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M12 6.5C10.3 5 8 4.4 5 4.6v12.2c3-.2 5.3.4 7 1.9 1.7-1.5 4-2.1 7-1.9V4.6c-3-.2-5.3.4-7 1.9Z"></path>' +
      '<path d="M12 6.5v12.2"></path></svg>';
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
          '<div class="brand__mark">' + icon(28) + '</div>' +
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
          '<button type="button" class="btn-google" data-action="login">' +
            '<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">' +
            '<path fill="#4285F4" d="M23 12.2c0-.8-.1-1.6-.2-2.3H12v4.4h6.2a5.3 5.3 0 0 1-2.3 3.5v2.9h3.7A11 11 0 0 0 23 12.2Z"></path>' +
            '<path fill="#34A853" d="M12 23.5c3 0 5.5-1 7.3-2.7l-3.6-2.9a6.9 6.9 0 0 1-10.3-3.6H1.6v3A11.5 11.5 0 0 0 12 23.5Z"></path>' +
            '<path fill="#FBBC05" d="M5.4 14.3a6.9 6.9 0 0 1 0-4.4v-3H1.6a11.5 11.5 0 0 0 0 10.4l3.8-3Z"></path>' +
            '<path fill="#EA4335" d="M12 5.4c1.6 0 3.1.6 4.3 1.7l3.2-3.2A11.4 11.4 0 0 0 1.6 6.9l3.8 3A6.9 6.9 0 0 1 12 5.4Z"></path>' +
            '</svg>Đăng nhập bằng Google</button>' +
          '<div class="login__fine">Cần đăng nhập trước khi tạo giáo án. Ứng dụng không thu thập tên thật, ' +
          'hình ảnh hay thông tin định danh của trẻ.</div>' +
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

  function sidebar() {
    return '<aside class="sidebar">' +
      '<div class="sidebar__brand">' +
        '<div class="sidebar__mark">' + icon(21) + '</div>' +
        '<div class="sidebar__name">APP TẠO<br>GIÁO ÁN</div>' +
      '</div>' +
      '<nav class="nav" aria-label="Điều hướng chính">' +
        D.nav.map(function (item) {
          var on = state.view === item[0];
          return '<button type="button" class="nav__item' + (on ? ' is-on' : '') + '" ' +
            'data-action="go" data-value="' + attr(item[0]) + '"' +
            (on ? ' aria-current="page"' : '') + '>' + esc(item[1]) + '</button>';
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
    var stats = [
      { value: String(lib.length), label: 'Giáo án đã tạo' },
      { value: String(state.pinned.length), label: 'Đã ghim' },
      { value: String(currentSlides().length), label: 'Bài trình chiếu' },
      /* Lượt AI là số liệu của máy chủ. Bản chạy trên máy không đếm được nên
         để dấu gạch thay vì hiện một con số không có thật. */
      { value: '—', label: 'Lượt AI còn lại hôm nay', title: 'Cần máy chủ để đếm lượt gọi AI' }
    ];

    return '<div class="wrap">' +
      '<h1 class="h1 h1--dash">Hôm nay bạn muốn soạn giáo án gì?</h1>' +
      '<div class="actions-3">' +
        '<button type="button" class="action-card action-card--pink" data-action="start-wizard">' +
          '<div class="action-card__title">Tạo giáo án mới</div>' +
          '<div class="action-card__body">Wizard 5 bước, có gợi ý theo nhóm tuổi</div></button>' +
        '<button type="button" class="action-card action-card--blue" data-action="go" data-value="upload">' +
          '<div class="action-card__title">Tải Word lên</div>' +
          '<div class="action-card__body">Đọc giáo án .docx có sẵn và chuyển thành slide</div></button>' +
        '<button type="button" class="action-card action-card--green" data-action="go" data-value="ppt">' +
          '<div class="action-card__title">Chuyển sang PowerPoint</div>' +
          '<div class="action-card__body">Tóm tắt giáo án thành bài trình chiếu 16:9</div></button>' +
      '</div>' +
      '<div class="stats">' +
        stats.map(function (s) {
          return '<div class="stat"' + (s.title ? ' title="' + attr(s.title) + '"' : '') + '>' +
            '<div class="stat__value">' + esc(s.value) + '</div>' +
            '<div class="stat__label">' + esc(s.label) + '</div></div>';
        }).join('') +
      '</div>' +
      '<div class="dash-cols">' +
        '<div>' +
          '<div class="section-head"><h2 class="h2">Giáo án gần đây</h2>' +
          '<button type="button" class="btn--link" data-action="go" data-value="library">Xem tất cả</button></div>' +
          '<div class="stack-10">' +
            lib.slice(0, 4).map(function (p) {
              return '<button type="button" class="recent" data-action="go" data-value="editor">' +
                '<div style="min-width:0"><div class="recent__title">' + esc(p.title) + '</div>' +
                '<div class="recent__meta">' + esc(p.age + ' · ' + p.domain) + '</div></div>' +
                '<div class="recent__date">' + esc(p.date) + '</div></button>';
            }).join('') +
          '</div>' +
        '</div>' +
        '<div>' +
          '<h2 class="list-title">Mẫu gợi ý cho lớp ghép</h2>' +
          '<div class="stack-10">' +
            D.suggested.map(function (t) {
              return '<div class="suggest"><div class="suggest__age">' + esc(t.age) + '</div>' +
                '<div class="suggest__title">' + esc(t.title) + '</div></div>';
            }).join('') +
          '</div>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  /* ── Wizard ──────────────────────────────────────────────────────────── */

  function viewWizard() {
    var panels = [step1, step2, step3, step4, step5];
    return '<div class="wrap wrap--narrow">' +
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
      '<h1 class="h1">Giáo án của tôi</h1>' +
      '<p class="lede">' + items.length + ' giáo án · ' + state.pinned.length + ' đã ghim</p>' +
      '<div class="lib-tools">' +
        '<input id="lib-search" class="lib-search" type="search" data-search="1" ' +
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

  /* ── Thư viện mẫu ────────────────────────────────────────────────────── */

  function viewTemplates() {
    return '<div class="wrap">' +
      '<h1 class="h1">Thư viện mẫu</h1>' +
      '<p class="lede">Mẫu có nội dung đầy đủ, dùng được ngay để kiểm thử xuất Word và PowerPoint.</p>' +
      '<div class="tpl-grid">' +
        D.templates.map(function (t, i) {
          return '<div class="tpl"><div>' +
            '<div class="tpl__age">' + esc(t[0]) + '</div>' +
            '<div class="tpl__title">' + esc(t[1]) + '</div>' +
            '<div class="tpl__domain">' + esc(t[2]) + '</div></div>' +
            '<button type="button" class="btn-use" data-action="use-template" data-index="' + i + '">Dùng mẫu</button>' +
          '</div>';
        }).join('') +
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

  /* ── Căn cứ và tham chiếu ────────────────────────────────────────────── */

  function refChipClass(status) {
    if (status === 'Đang có hiệu lực') return 'status-chip--ok';
    if (status === 'Sắp có hiệu lực') return 'status-chip--soon';
    if (status === 'Chưa xác minh') return '';
    return 'status-chip--bad';
  }

  function viewRefs() {
    return '<div class="wrap">' +
      '<h1 class="h1">Căn cứ và tham chiếu</h1>' +
      '<p class="refs-lede">Danh mục văn bản được lưu trong cơ sở dữ liệu và do quản trị viên cập nhật. ' +
      'AI chỉ dẫn căn cứ pháp lý từ danh mục này, không tự bịa số hiệu hay điều khoản.</p>' +
      '<div class="note-yellow" style="margin-bottom:22px">' + esc(D.disclaimer) + '</div>' +
      '<div style="overflow-x:auto"><table class="table table--refs">' +
        '<thead><tr>' +
          '<th style="width:20%">Số hiệu</th><th>Tên văn bản</th>' +
          '<th style="width:14%">Hiệu lực</th><th style="width:16%">Trạng thái</th>' +
          '<th style="width:13%">Kiểm tra gần nhất</th>' +
        '</tr></thead><tbody>' +
          D.refs.map(function (r) {
            return '<tr>' +
              '<td class="code">' + esc(r[0]) + '</td>' +
              '<td>' + esc(r[1]) + '<div class="issuer">' + esc(r[2]) + '</div></td>' +
              '<td class="code">' + esc(r[3]) + '</td>' +
              '<td><span class="status-chip ' + refChipClass(r[4]) + '">' + esc(r[4]) + '</span></td>' +
              '<td class="checked">' + esc(r[5]) + '</td>' +
            '</tr>';
          }).join('') +
        '</tbody></table></div>' +
    '</div>';
  }

  /* ── Quản trị ────────────────────────────────────────────────────────── */

  function viewAdmin() {
    return '<div class="wrap">' +
      '<h1 class="h1">Quản trị</h1>' +
      '<p class="lede">Quyền quản trị viên. Giáo viên không sửa được văn bản pháp lý và prompt hệ thống.</p>' +
      '<div class="stats">' +
        D.adminStats.map(function (s) {
          return '<div class="stat"><div class="stat__value stat__value--sm">' + esc(s.value) + '</div>' +
            '<div class="stat__label">' + esc(s.label) + '</div></div>';
        }).join('') +
      '</div>' +
      '<div class="admin-cols">' +
        '<div class="panel">' +
          '<div class="panel__title">Người dùng</div>' +
          '<div style="overflow-x:auto"><table class="users"><thead><tr>' +
            '<th>Giáo viên</th><th>Trường</th><th>Vai trò</th><th>Lượt AI hôm nay</th>' +
          '</tr></thead><tbody>' +
            D.users.map(function (u) {
              return '<tr><td class="name">' + esc(u[0]) + '</td>' +
                '<td class="school">' + esc(u[1]) + '</td>' +
                '<td><span class="status-chip ' + (u[2] === 'Quản trị viên' ? 'status-chip--admin' : '') + '">' +
                esc(u[2]) + '</span></td>' +
                '<td class="usage">' + esc(u[3]) + '</td></tr>';
            }).join('') +
          '</tbody></table></div>' +
        '</div>' +
        '<div style="display:grid;gap:16px;align-content:start">' +
          '<div class="panel panel--sm">' +
            '<div class="panel__title panel__title--sm">Prompt hệ thống</div>' +
            '<div style="display:grid;gap:8px">' +
              D.prompts.map(function (p) {
                return '<div class="kv-row"><div>' + esc(p.name) + '</div>' +
                  '<div class="kv-row__v">' + esc(p.version) + '</div></div>';
              }).join('') +
            '</div>' +
          '</div>' +
          '<div class="panel panel--sm">' +
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
        '</div>' +
      '</div>' +
    '</div>';
  }

  /* ── Render ──────────────────────────────────────────────────────────── */

  var SCREENS = {
    dashboard: viewDashboard, wizard: viewWizard, editor: viewEditor,
    library: viewLibrary, templates: viewTemplates, upload: viewUpload,
    word: viewWord, ppt: viewPpt, refs: viewRefs, admin: viewAdmin
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

  function generate() {
    if (state.generating) return;
    state.generating = true;
    state.aiError = null;
    render();

    C.generate(state).then(function (result) {
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
    var result = C.review(label, state.lesson);
    state.aiPreview = {
      key: label,
      label: pair ? pair[1] : label,
      text: result.text,
      canApply: !!result.patch
    };
    state._pendingPatch = result.patch || null;
    render();
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
    login: function () { goto('dashboard'); },
    logout: function () { goto('login'); },
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

    'use-template': function (el) {
      var t = D.templates[Number(el.getAttribute('data-index'))];
      if (!t) return;
      /* Dùng mẫu = điền wizard theo mẫu rồi dựng giáo án, không mở giáo án của mẫu khác. */
      state.form.activity = t[1];
      state.domains = [t[2].indexOf('Phát triển') === 0 ? t[2] : 'Phát triển đa lĩnh vực'];
      if (t[2].indexOf('Phát triển') !== 0) state.types = [t[2]];
      state.mixed = t[0] === 'LỚP GHÉP';
      if (!state.mixed) {
        var age = 'Trẻ ' + t[0].toLowerCase();
        state.ages = D.options.ages.indexOf(age) !== -1 ? [age] : ['Trẻ 4–5 tuổi'];
      } else {
        state.ages = ['Lớp ghép nhiều độ tuổi'];
      }
      state.lesson = C.composeLesson(state);
      state.lessonSource = 'local';
      state.aiError = null;
      state.versions = [];
      stamp('Mở mẫu "' + t[1] + '"');
      state.view = 'editor';
      flash('Đã mở mẫu "' + t[1] + '" để chỉnh sửa');
      window.scrollTo(0, 0);
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
    if (el.getAttribute && el.getAttribute('data-search')) {
      state.query = el.value;
      state.focusId = el.id;
      render();
    }
  });

  /* Cột "Ánh xạ thành" ở bảng nhận dạng file Word. */
  document.addEventListener('change', function (e) {
    var el = e.target;
    var idx = el.getAttribute && el.getAttribute('data-map-row');
    if (idx == null || !state.upResult) return;
    var row = state.upResult.rows[Number(idx)];
    if (!row) return;
    row.target = el.value;
    row.conf = el.value === 'Chưa xác định' ? 'Thấp' : 'Đã sửa';
    render();
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

  stamp('Mở giáo án mẫu');
  render();
})();
