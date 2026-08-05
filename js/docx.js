/*
  Xuất giáo án thành file .docx thật (gói OOXML), không cần máy chủ.

  Đúng thông số ghi ở khung "Định dạng Word" của bản thiết kế:
    khổ A4 dọc · lề trên 2 / dưới 2 / trái 3 / phải 2 cm · Times New Roman
    cỡ 14 · giãn dòng 1.15 · có số trang và khu vực ký tên.

  Bảng hoạt động hai cột có hàng tiêu đề lặp lại khi sang trang (w:tblHeader).
*/
(function () {
  'use strict';

  var X = window.ZIP.xml;

  /* 1 cm = 567 twips. A4 = 21 × 29,7 cm. */
  var PAGE = { w: 11906, h: 16838 };
  var MARGIN = { top: 1134, bottom: 1134, left: 1701, right: 1134 };
  var LINE = 276;              // 240 × 1.15
  var SIZE = 28;               // nửa point → 14pt
  var CONTENT_W = PAGE.w - MARGIN.left - MARGIN.right;

  /* ── Khối XML ────────────────────────────────────────────────────────── */

  function run(text, o) {
    o = o || {};
    var rPr = '<w:rPr>' +
      (o.bold ? '<w:b/>' : '') +
      (o.italic ? '<w:i/>' : '') +
      (o.caps ? '<w:caps/>' : '') +
      (o.size ? '<w:sz w:val="' + o.size + '"/><w:szCs w:val="' + o.size + '"/>' : '') +
      '</w:rPr>';
    return '<w:r>' + rPr + '<w:t xml:space="preserve">' + X(text) + '</w:t></w:r>';
  }

  function para(text, o) {
    o = o || {};
    var pPr = '<w:pPr>' +
      '<w:spacing w:before="' + (o.before || 0) + '" w:after="' + (o.after || 0) + '" w:line="' + LINE + '" w:lineRule="auto"/>' +
      (o.indent ? '<w:ind w:left="' + o.indent + '"/>' : '') +
      (o.align ? '<w:jc w:val="' + o.align + '"/>' : '') +
      '</w:pPr>';
    var runs = Array.isArray(text)
      ? text.map(function (r) { return run(r.text, r); }).join('')
      : run(text, o);
    return '<w:p>' + pPr + runs + '</w:p>';
  }

  function cell(width, paras, o) {
    o = o || {};
    var tcPr = '<w:tcPr><w:tcW w:w="' + width + '" w:type="dxa"/>' +
      (o.noBorders
        ? '<w:tcBorders><w:top w:val="nil"/><w:left w:val="nil"/><w:bottom w:val="nil"/><w:right w:val="nil"/></w:tcBorders>'
        : '') +
      '<w:vAlign w:val="' + (o.vAlign || 'top') + '"/></w:tcPr>';
    return '<w:tc>' + tcPr + (paras || para('')) + '</w:tc>';
  }

  function row(cells, o) {
    o = o || {};
    var trPr = '<w:trPr>' + (o.header ? '<w:tblHeader/>' : '') + '</w:trPr>';
    return '<w:tr>' + trPr + cells + '</w:tr>';
  }

  function table(rows, o) {
    o = o || {};
    var borders = o.noBorders
      ? '<w:tblBorders><w:top w:val="nil"/><w:left w:val="nil"/><w:bottom w:val="nil"/>' +
        '<w:right w:val="nil"/><w:insideH w:val="nil"/><w:insideV w:val="nil"/></w:tblBorders>'
      : '<w:tblBorders>' +
        ['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map(function (s) {
          return '<w:' + s + ' w:val="single" w:sz="6" w:space="0" w:color="000000"/>';
        }).join('') +
        '</w:tblBorders>';
    var grid = '<w:tblGrid>' + o.cols.map(function (w) {
      return '<w:gridCol w:w="' + w + '"/>';
    }).join('') + '</w:tblGrid>';
    return '<w:tbl><w:tblPr><w:tblW w:w="' + CONTENT_W + '" w:type="dxa"/>' + borders +
      '<w:tblLayout w:type="fixed"/></w:tblPr>' + grid + rows.join('') + '</w:tbl>';
  }

  /* ── Nội dung giáo án ────────────────────────────────────────────────── */

  function bodyXml(lesson) {
    var L = lesson, info = L.info, obj = L.objectives || {}, prep = L.prep || {};
    var out = [];

    /* Đầu trang: trường, tên giáo án, đề tài. */
    out.push(para(info.school, { align: 'center', bold: true, caps: true }));
    out.push(para('GIÁO ÁN ' + String(info.type || '').toUpperCase(),
      { align: 'center', bold: true, size: 32, before: 240 }));
    out.push(para('Đề tài: ' + info.activity, { align: 'center', italic: true, after: 240 }));

    /* Bảng thông tin hai cột, không viền — như phần đầu bản xem trước. */
    var half = Math.floor(CONTENT_W / 2);
    var infoPairs = [
      ['Giáo viên: ' + info.teacher, 'Lớp: ' + info.className],
      ['Độ tuổi: ' + info.ageLabel, 'Số trẻ: ' + info.size],
      ['Chủ đề: ' + info.theme, 'Chủ đề nhánh: ' + info.subtheme],
      ['Lĩnh vực: ' + info.domain, 'Thời gian: ' + info.duration],
      ['Địa điểm: ' + info.place, 'Ngày thực hiện: ' + info.date]
    ];
    out.push(table(infoPairs.map(function (pair) {
      return row(
        cell(half, para(pair[0]), { noBorders: true }) +
        cell(CONTENT_W - half, para(pair[1]), { noBorders: true })
      );
    }), { cols: [half, CONTENT_W - half], noBorders: true }));

    /* I. Mục đích – yêu cầu */
    out.push(para('I. MỤC ĐÍCH – YÊU CẦU', { bold: true, before: 240, after: 120 }));
    window.DATA.objectiveLabels.forEach(function (pair) {
      var items = obj[pair[0]] || [];
      if (!items.length) return;
      out.push(para(pair[1], { bold: true, italic: true }));
      items.forEach(function (line) { out.push(para('- ' + line, { indent: 340 })); });
    });

    var diff = obj.differentiated || [];
    if (diff.length) {
      out.push(para('5. Mục tiêu phân hóa theo nhóm tuổi', { bold: true, italic: true, before: 120 }));
      diff.forEach(function (g) {
        out.push(para(g.group, { italic: true, indent: 340 }));
        (g.items || []).forEach(function (line) { out.push(para('- ' + line, { indent: 640 })); });
      });
    }

    /* II. Chuẩn bị */
    out.push(para('II. CHUẨN BỊ', { bold: true, before: 240, after: 120 }));
    window.DATA.prepLabels.forEach(function (pair) {
      var items = prep[pair[0]] || [];
      if (!items.length) return;
      out.push(para(pair[1], { bold: true, italic: true }));
      items.forEach(function (line) { out.push(para('- ' + line, { indent: 340 })); });
    });

    /* III. Hoạt động học — bảng hai cột */
    out.push(para('III. HOẠT ĐỘNG HỌC', { bold: true, before: 240, after: 120 }));
    var colL = Math.floor(CONTENT_W / 2);
    var colR = CONTENT_W - colL;
    var rows = [row(
      cell(colL, para('Hoạt động của cô', { align: 'center', bold: true }), { vAlign: 'center' }) +
      cell(colR, para('Hoạt động của trẻ', { align: 'center', bold: true }), { vAlign: 'center' }),
      { header: true }
    )];

    (L.activities || []).forEach(function (a, i) {
      var left = para((i + 1) + '. ' + a.name + ' (' + a.time + ')', { bold: true }) +
        (a.teacher || []).map(function (line) { return para(line); }).join('');
      var right = (a.child || []).map(function (line) { return para(line); }).join('') +
        (a.responses && a.responses !== '—' ? para('Dự kiến: ' + a.responses, { italic: true }) : '');
      rows.push(row(cell(colL, left) + cell(colR, right)));
    });
    out.push(table(rows, { cols: [colL, colR] }));

    /* Khu vực ký tên */
    out.push(para('', { before: 240 }));
    out.push(table([row(
      cell(colL,
        para('Ban giám hiệu', { align: 'center', italic: true }) +
        para('') + para('') + para(''),
        { noBorders: true }) +
      cell(colR,
        para('Giáo viên soạn', { align: 'center', italic: true }) +
        para('') + para('') +
        para(info.teacher, { align: 'center', bold: true }),
        { noBorders: true })
    )], { cols: [colL, colR], noBorders: true }));

    return out.join('');
  }

  function documentXml(lesson) {
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" ' +
      'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
      '<w:body>' + bodyXml(lesson) +
      '<w:sectPr>' +
      '<w:footerReference w:type="default" r:id="rId2"/>' +
      '<w:pgSz w:w="' + PAGE.w + '" w:h="' + PAGE.h + '"/>' +
      '<w:pgMar w:top="' + MARGIN.top + '" w:right="' + MARGIN.right + '" w:bottom="' + MARGIN.bottom +
      '" w:left="' + MARGIN.left + '" w:header="708" w:footer="708" w:gutter="0"/>' +
      '<w:cols w:space="708"/><w:docGrid w:linePitch="360"/>' +
      '</w:sectPr></w:body></w:document>';
  }

  var STYLES = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
    '<w:docDefaults><w:rPrDefault><w:rPr>' +
    '<w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman" w:eastAsia="Times New Roman"/>' +
    '<w:sz w:val="' + SIZE + '"/><w:szCs w:val="' + SIZE + '"/><w:lang w:val="vi-VN"/>' +
    '</w:rPr></w:rPrDefault><w:pPrDefault><w:pPr>' +
    '<w:spacing w:after="0" w:line="' + LINE + '" w:lineRule="auto"/>' +
    '</w:pPr></w:pPrDefault></w:docDefaults>' +
    '<w:style w:type="paragraph" w:styleId="Normal" w:default="1">' +
    '<w:name w:val="Normal"/><w:qFormat/></w:style>' +
    '</w:styles>';

  /* Chân trang: số trang căn giữa. */
  var FOOTER = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
    '<w:p><w:pPr><w:jc w:val="center"/></w:pPr>' +
    '<w:r><w:fldChar w:fldCharType="begin"/></w:r>' +
    '<w:r><w:instrText xml:space="preserve"> PAGE </w:instrText></w:r>' +
    '<w:r><w:fldChar w:fldCharType="separate"/></w:r>' +
    '<w:r><w:t>1</w:t></w:r>' +
    '<w:r><w:fldChar w:fldCharType="end"/></w:r>' +
    '</w:p></w:ftr>';

  var CONTENT_TYPES = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
    '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>' +
    '<Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>' +
    '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>' +
    '<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>' +
    '</Types>';

  var ROOT_RELS = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
    '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>' +
    '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>' +
    '</Relationships>';

  var DOC_RELS = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
    '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>' +
    '</Relationships>';

  function coreXml(lesson) {
    var now = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" ' +
      'xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" ' +
      'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +
      '<dc:title>Giáo án: ' + X(lesson.info.activity) + '</dc:title>' +
      '<dc:creator>' + X(lesson.info.teacher) + '</dc:creator>' +
      '<cp:lastModifiedBy>' + X(lesson.info.teacher) + '</cp:lastModifiedBy>' +
      '<dcterms:created xsi:type="dcterms:W3CDTF">' + now + '</dcterms:created>' +
      '<dcterms:modified xsi:type="dcterms:W3CDTF">' + now + '</dcterms:modified>' +
      '</cp:coreProperties>';
  }

  var APP_XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" ' +
    'xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">' +
    '<Application>APP Tạo Giáo Án</Application></Properties>';

  /* ── Tên file ────────────────────────────────────────────────────────── */

  /* Bỏ dấu tiếng Việt để tên file dùng được ở mọi hệ thống. */
  function slug(text) {
    return String(text || '')
      .replace(/đ/g, 'd').replace(/Đ/g, 'D')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^A-Za-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase();
  }

  function fileName(lesson) {
    var parts = ['Giao-an', slug(lesson.info.activity), slug(lesson.info.ageLabel)];
    return parts.filter(Boolean).join('-') + '.docx';
  }

  /* ── Đóng gói ────────────────────────────────────────────────────────── */

  function build(lesson) {
    return window.ZIP.write([
      { path: '[Content_Types].xml', data: CONTENT_TYPES },
      { path: '_rels/.rels', data: ROOT_RELS },
      { path: 'docProps/core.xml', data: coreXml(lesson) },
      { path: 'docProps/app.xml', data: APP_XML },
      { path: 'word/document.xml', data: documentXml(lesson) },
      { path: 'word/_rels/document.xml.rels', data: DOC_RELS },
      { path: 'word/styles.xml', data: STYLES },
      { path: 'word/footer1.xml', data: FOOTER }
    ], 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  }

  function download(lesson) {
    var name = fileName(lesson);
    window.ZIP.save(build(lesson), name);
    return name;
  }

  window.DOCX = { build: build, download: download, fileName: fileName, slug: slug };
})();
