/*
  Đọc file .docx thật do giáo viên chọn, ngay trên máy.

  Bản thiết kế mô tả luồng: tải lên → đọc nội dung → kiểm tra ánh xạ → tạo
  slide, kèm bảng "Đoạn trong file Word / Ánh xạ thành / Độ tin cậy". Ở bản này
  bảng đó là kết quả đọc file thật, không phải danh sách viết sẵn:

    • giải nén gói .docx bằng DecompressionStream của trình duyệt,
    • đọc word/document.xml, đi theo thứ tự đoạn văn và bảng,
    • nhận ra mục I – II – III, phần thông tin đầu giáo án và bảng hai cột,
    • dựng lại một giáo án để tóm tắt thành slide.

  Đoạn nào không nhận ra thì ghi "Chưa xác định · Thấp" thay vì đoán bừa.
*/
(function () {
  'use strict';

  var W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

  /* Lấy toàn bộ chữ trong một đoạn văn hoặc ô bảng. */
  function textOf(node) {
    var runs = node.getElementsByTagNameNS(W, 't');
    var out = '';
    for (var i = 0; i < runs.length; i++) out += runs[i].textContent;
    // w:br và w:tab không có chữ nhưng vẫn là khoảng trắng.
    return out.replace(/\s+/g, ' ').trim();
  }

  /* Các đoạn văn trực tiếp trong một ô bảng. */
  function cellLines(tc) {
    var out = [];
    var ps = tc.getElementsByTagNameNS(W, 'p');
    for (var i = 0; i < ps.length; i++) {
      var t = textOf(ps[i]);
      if (t) out.push(t);
    }
    return out;
  }

  /* Bỏ dấu gạch đầu dòng mà giáo án hay dùng. */
  function stripBullet(line) {
    return line.replace(/^[-–•*]\s*/, '').trim();
  }

  function afterColon(line) {
    var i = line.indexOf(':');
    return i === -1 ? '' : line.slice(i + 1).trim();
  }

  /* ── Nhận dạng từng đoạn ─────────────────────────────────────────────── */

  var HEADINGS = [
    [/^I\s*[.．]?\s*MỤC\s*(ĐÍCH|TIÊU)/i, 'Mục tiêu', 'objectives'],
    [/^II\s*[.．]?\s*CHUẨN\s*BỊ/i, 'Chuẩn bị', 'prep'],
    [/^III\s*[.．]?\s*(TỔ\s*CHỨC|HOẠT\s*ĐỘNG|TIẾN\s*TRÌNH)/i, 'Bảng hoạt động', 'activities'],
    [/^IV\s*[.．]?/i, 'Phần bổ sung', 'extra']
  ];

  var INFO_FIELDS = [
    [/^(Giáo\s*viên|GV)\s*(soạn)?\s*:/i, 'Giáo viên', 'teacher'],
    [/^Lớp\s*:/i, 'Tên lớp', 'className'],
    [/^(Độ\s*tuổi|Nhóm\s*tuổi|Lứa\s*tuổi)\s*:/i, 'Nhóm tuổi', 'ageLabel'],
    [/^Số\s*(trẻ|lượng\s*trẻ)\s*:/i, 'Số lượng trẻ', 'size'],
    [/^Chủ\s*đề\s*nhánh\s*:/i, 'Chủ đề nhánh', 'subtheme'],
    [/^Chủ\s*đề\s*:/i, 'Chủ đề', 'theme'],
    [/^(Lĩnh\s*vực|Hoạt\s*động\s*học)\s*:/i, 'Lĩnh vực', 'domain'],
    [/^(Thời\s*gian|Thời\s*lượng)\s*:/i, 'Thời lượng', 'duration'],
    [/^(Địa\s*điểm|Nơi\s*tổ\s*chức)\s*:/i, 'Địa điểm', 'place'],
    [/^(Ngày\s*(thực\s*hiện|dạy)|Thời\s*điểm)\s*:/i, 'Ngày thực hiện', 'date'],
    [/^(Hình\s*thức)\s*(tổ\s*chức)?\s*:/i, 'Hình thức tổ chức', 'form'],
    [/^Đề\s*tài\s*:/i, 'Tên hoạt động', 'activity']
  ];

  var OBJ_SUB = [
    [/kiến\s*thức/i, 'knowledge'],
    [/kỹ\s*năng|kĩ\s*năng/i, 'skills'],
    [/thái\s*độ/i, 'attitude'],
    [/tích\s*hợp/i, 'integrated'],
    [/phân\s*hóa/i, 'differentiated']
  ];

  var PREP_SUB = [
    [/của\s*cô|của\s*giáo\s*viên/i, 'teacher'],
    [/của\s*trẻ/i, 'children'],
    [/môi\s*trường|không\s*gian|đội\s*hình/i, 'environment'],
    [/học\s*liệu\s*số|thiết\s*bị\s*số|công\s*nghệ/i, 'digital'],
    [/học\s*liệu|thiết\s*bị|đồ\s*dùng/i, 'materials'],
    [/an\s*toàn/i, 'safety'],
    [/dự\s*phòng/i, 'backup']
  ];

  function matchSub(list, line) {
    for (var i = 0; i < list.length; i++) if (list[i][0].test(line)) return list[i][1];
    return null;
  }

  /* Rút gọn đoạn văn để hiện trong bảng ánh xạ. */
  function preview(text, max) {
    max = max || 74;
    return text.length > max ? text.slice(0, max - 1).replace(/\s+\S*$/, '') + '…' : text;
  }

  /* ── Phân tích ───────────────────────────────────────────────────────── */

  function analyse(xmlText) {
    var doc = new DOMParser().parseFromString(xmlText, 'application/xml');
    if (doc.getElementsByTagName('parsererror').length) {
      throw new Error('Không đọc được word/document.xml');
    }
    var bodies = doc.getElementsByTagNameNS(W, 'body');
    if (!bodies.length) throw new Error('File .docx không có phần thân văn bản');
    var body = bodies[0];

    var rows = [];            // bảng ánh xạ hiện cho giáo viên
    var info = {};
    var objectives = { knowledge: [], skills: [], attitude: [], integrated: [], differentiated: [] };
    var prep = { teacher: [], children: [], environment: [], materials: [], digital: [], safety: [], backup: [] };
    var activities = [];
    var section = 'head';     // head | objectives | prep | activities | extra
    var objBucket = 'knowledge';
    var prepBucket = 'teacher';
    var diffGroup = null;
    var headLines = [];
    var unknown = 0;
    var tableCount = 0;

    function add(text, target, conf) {
      rows.push({ text: preview(text), target: target, conf: conf });
    }

    var children = body.childNodes;
    for (var i = 0; i < children.length; i++) {
      var node = children[i];
      if (node.nodeType !== 1) continue;
      var tag = node.localName;

      /* ── Bảng ── */
      if (tag === 'tbl') {
        tableCount++;
        var trs = [];
        var allTr = node.getElementsByTagNameNS(W, 'tr');
        for (var t = 0; t < allTr.length; t++) trs.push(allTr[t]);
        var firstCells = trs.length ? trs[0].getElementsByTagNameNS(W, 'tc') : [];
        var colCount = firstCells.length;
        var headText = colCount ? cellLines(firstCells[0]).join(' ') + ' ' + (colCount > 1 ? cellLines(firstCells[1]).join(' ') : '') : '';
        var isActivityTable = colCount >= 2 && /hoạt\s*động\s*của\s*(cô|giáo\s*viên)/i.test(headText);

        if (isActivityTable) {
          add('Bảng ' + colCount + ' cột, ' + trs.length + ' hàng', 'Bảng hoạt động', 'Cao');
          for (var r = 1; r < trs.length; r++) {
            var tcs = trs[r].getElementsByTagNameNS(W, 'tc');
            if (tcs.length < 2) continue;
            var left = cellLines(tcs[0]);
            var right = cellLines(tcs[1]);
            if (!left.length && !right.length) continue;

            /* Dòng đầu ô bên trái thường là "1. Tên hoạt động (5 phút)". */
            var name = '', time = '';
            var teacherLines = left.slice();
            var head = left[0] || '';
            var m = head.match(/^\s*(\d+)\s*[.)]?\s*(.+?)\s*(?:\(([^)]*)\))?\s*$/);
            if (m && (m[3] || left.length > 1)) {
              name = m[2];
              time = (m[3] || '').trim();
              teacherLines = left.slice(1);
            } else {
              name = 'Hoạt động ' + r;
            }
            if (!time) {
              var tm = (head + ' ' + right.join(' ')).match(/(\d+\s*[-–]?\s*\d*\s*phút)/i);
              time = tm ? tm[1] : '';
            }

            /* Dòng "Dự kiến: ..." ở cột của trẻ là phản hồi dự kiến. */
            var responses = '';
            var childLines = [];
            right.forEach(function (line) {
              if (/^(Dự\s*kiến|Phản\s*hồi)\s*:/i.test(line)) responses = afterColon(line);
              else childLines.push(line);
            });

            activities.push({
              name: name.replace(/\s*\(\s*$/, '').trim(),
              time: time || '—',
              teacher: teacherLines.length ? teacherLines.map(stripBullet) : ['—'],
              child: childLines.length ? childLines.map(stripBullet) : ['—'],
              responses: responses || '—',
              support: '—', extend: '—', safety: '—'
            });
          }
        } else if (colCount >= 2) {
          /* Bảng chữ ký ở cuối giáo án. */
          if (/Ban\s*giám\s*hiệu|Giáo\s*viên\s*soạn|Người\s*soạn|Hiệu\s*trưởng/i.test(headText)) {
            add('Bảng chữ ký ' + colCount + ' cột', 'Khu vực ký tên', 'Cao');
            continue;
          }
          /* Bảng hai cột ở đầu giáo án thường là phần thông tin. */
          var picked = 0;
          trs.forEach(function (tr) {
            var tcs = tr.getElementsByTagNameNS(W, 'tc');
            for (var c = 0; c < tcs.length; c++) {
              cellLines(tcs[c]).forEach(function (line) {
                for (var k = 0; k < INFO_FIELDS.length; k++) {
                  if (INFO_FIELDS[k][0].test(line)) {
                    if (!info[INFO_FIELDS[k][2]]) info[INFO_FIELDS[k][2]] = afterColon(line);
                    picked++;
                    return;
                  }
                }
              });
            }
          });
          add('Bảng ' + colCount + ' cột, ' + trs.length + ' hàng' +
            (section === 'head' ? ' ở đầu giáo án' : '') +
            (picked ? ' — nhận ra ' + picked + ' trường' : ''),
            picked ? 'Thông tin giáo án' : 'Chưa xác định',
            picked ? 'Cao' : 'Thấp');
          if (!picked) unknown++;
        } else {
          add('Bảng ' + colCount + ' cột, ' + trs.length + ' hàng', 'Chưa xác định', 'Thấp');
          unknown++;
        }
        continue;
      }

      if (tag !== 'p') continue;
      var line = textOf(node);
      if (!line) continue;

      /* ── Tiêu đề mục ── */
      var isHeading = false;
      for (var h = 0; h < HEADINGS.length; h++) {
        if (HEADINGS[h][0].test(line)) {
          section = HEADINGS[h][2];
          add(line, HEADINGS[h][1], 'Cao');
          isHeading = true;
          break;
        }
      }
      if (isHeading) continue;

      /* ── Trường thông tin "Nhãn: giá trị" ── */
      var matchedField = false;
      for (var f = 0; f < INFO_FIELDS.length; f++) {
        if (INFO_FIELDS[f][0].test(line)) {
          var key = INFO_FIELDS[f][2];
          if (!info[key]) info[key] = afterColon(line);
          add(line, INFO_FIELDS[f][1], 'Cao');
          matchedField = true;
          break;
        }
      }
      if (matchedField) continue;

      /* ── Phần đầu: tên trường và tên giáo án ── */
      if (section === 'head') {
        headLines.push(line);
        if (/^GIÁO\s*ÁN/i.test(line)) {
          add(line, 'Tên hoạt động', 'Cao');
          if (!info.activity) {
            var dash = line.split(/[—–-]\s*Đề\s*tài\s*:/i);
            if (dash.length > 1) info.activity = dash[1].trim();
          }
          if (!info.type) info.type = line.replace(/^GIÁO\s*ÁN\s*/i, '').split(/[—–-]/)[0].trim().toLowerCase();
          continue;
        }
        if (/(trường|mầm\s*non|MN)\b/i.test(line) && !info.school) {
          info.school = line;
          add(line, 'Tên trường', 'Cao');
          continue;
        }
        /* Dòng chứa khoảng tuổi — nhận ra cả lớp ghép. */
        var ageHits = line.match(/\d+\s*[-–]\s*\d+\s*(tuổi|tháng)/gi);
        if (ageHits) {
          if (!info.ageLabel) info.ageLabel = line;
          add(line, ageHits.length > 1 || /ghép/i.test(line) ? 'Nhóm tuổi (lớp ghép)' : 'Nhóm tuổi', 'Cao');
          continue;
        }
        add(line, 'Chưa xác định', 'Thấp');
        unknown++;
        continue;
      }

      /* ── Trong mục I ── */
      if (section === 'objectives') {
        var sub = matchSub(OBJ_SUB, line);
        if (sub && line.length < 70) {
          if (sub === 'differentiated') { objBucket = 'differentiated'; diffGroup = null; }
          else objBucket = sub;
          continue;
        }
        if (objBucket === 'differentiated') {
          if (/^Nhóm/i.test(line) && line.length < 60) {
            diffGroup = { group: line.replace(/[:：]\s*$/, ''), items: [] };
            objectives.differentiated.push(diffGroup);
          } else if (diffGroup) {
            diffGroup.items.push(stripBullet(line));
          }
        } else {
          objectives[objBucket].push(stripBullet(line));
        }
        continue;
      }

      /* ── Trong mục II ── */
      if (section === 'prep') {
        var psub = matchSub(PREP_SUB, line);
        if (psub && line.length < 70 && !/^[-–•*]/.test(line)) {
          prepBucket = psub;
          continue;
        }
        prep[prepBucket].push(stripBullet(line));
        continue;
      }

      /* ── Sau mục III: chữ ký, rút kinh nghiệm, ghi chú ── */
      if (/^(Ban\s*giám\s*hiệu|Giáo\s*viên\s*soạn|Người\s*soạn|Duyệt)/i.test(line)) {
        add(line, 'Khu vực ký tên', 'Cao');
        continue;
      }
      if (/rút\s*kinh\s*nghiệm|nhận\s*xét\s*sau\s*tiết|đánh\s*giá\s*sau/i.test(line)) {
        add(line, 'Chưa xác định', 'Thấp');
        unknown++;
        continue;
      }
      if (line.length > 12) {
        add(line, section === 'activities' ? 'Ghi chú bảng hoạt động' : 'Chưa xác định',
          section === 'activities' ? 'Trung bình' : 'Thấp');
        if (section !== 'activities') unknown++;
      }
    }

    /* Điền những trường còn thiếu bằng chính nội dung đã đọc, không bịa. */
    if (!info.school && headLines.length) info.school = headLines[0];
    if (!info.activity) {
      var titleLine = headLines.filter(function (l) { return /^GIÁO\s*ÁN/i.test(l); })[0];
      info.activity = (titleLine ? titleLine.replace(/^GIÁO\s*ÁN\s*/i, '') : headLines[1] || 'Hoạt động học').trim();
    }
    var FALLBACK = {
      school: 'Chưa đọc được tên trường', teacher: 'Chưa đọc được tên giáo viên',
      className: 'Chưa đọc được tên lớp', ageLabel: 'Chưa đọc được nhóm tuổi',
      size: '—', date: '—', theme: '—', subtheme: '—',
      domain: 'Chưa đọc được lĩnh vực', type: 'hoạt động học',
      duration: '—', place: '—', form: '—'
    };
    Object.keys(FALLBACK).forEach(function (k) {
      if (!info[k]) info[k] = FALLBACK[k];
    });

    return {
      lesson: { info: info, objectives: objectives, prep: prep, activities: activities },
      rows: rows,
      stats: {
        rows: rows.length,
        activities: activities.length,
        tables: tableCount,
        unknown: unknown,
        hasObjectives: objectives.knowledge.length + objectives.skills.length + objectives.attitude.length > 0,
        hasPrep: Object.keys(prep).some(function (k) { return prep[k].length; })
      }
    };
  }

  /*
    Đọc một File do người dùng chọn. `onStep(pct, message)` được gọi ở từng
    chặng để thanh tiến trình đi thật, không phải đếm giả.
  */
  function readFile(file, onStep) {
    var step = onStep || function () {};
    return Promise.resolve()
      .then(function () {
        if (!/\.docx$/i.test(file.name)) {
          throw new Error('Chỉ nhận file .docx. Nếu file đang là .doc, mở bằng Word rồi lưu lại thành .docx.');
        }
        if (file.size > 10 * 1024 * 1024) {
          throw new Error('File lớn hơn 10 MB.');
        }
        step(14, 'Đang đọc file từ máy...');
        return file.arrayBuffer();
      })
      .then(function (buf) {
        /* Kiểm tra chữ ký "PK" thay vì chỉ tin vào đuôi file. */
        var head = new Uint8Array(buf, 0, 2);
        if (head[0] !== 0x50 || head[1] !== 0x4B) {
          throw new Error('Nội dung không phải gói .docx (thiếu chữ ký ZIP).');
        }
        step(38, 'Kiểm tra nội dung thực tế của file...');
        var zip = window.ZIP.read(buf);
        if (!zip.has('word/document.xml')) {
          throw new Error('Gói không có word/document.xml — có thể không phải file Word.');
        }
        step(62, 'Đang giải nén và đọc nội dung .docx...');
        return zip.text('word/document.xml');
      })
      .then(function (xmlText) {
        step(86, 'Phát hiện mục I, II, III và bảng hoạt động...');
        var result = analyse(xmlText);
        result.file = {
          name: file.name,
          size: file.size,
          sizeLabel: (file.size / 1024).toFixed(0) + ' KB'
        };
        step(100, 'Đã đọc xong');
        return result;
      });
  }

  window.DOCXREAD = {
    readFile: readFile,
    analyse: analyse,
    available: function () { return window.ZIP.canInflate(); }
  };
})();
