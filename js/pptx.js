/*
  Xuất bài trình chiếu thành file .pptx thật (gói OOXML), không cần máy chủ.

  Slide tỷ lệ 16:9 (12192000 × 6858000 EMU), mỗi slide kèm ghi chú cho cô ở
  phần notes của PowerPoint — đúng nội dung hiện ở khung "Ghi chú cho cô".

  Gói gồm đủ các phần PowerPoint cần: một slide master, một slide layout
  trắng, một notes master và hai theme. Mọi khối văn bản là text box đặt tọa độ
  tuyệt đối, không dựa vào placeholder của layout, nên slide mở ra đúng như bản
  xem trước.
*/
(function () {
  'use strict';

  var X = window.ZIP.xml;

  var W = 12192000, H = 6858000;      // khổ slide 16:9
  var PAD = 685800;                    // lề trong slide (0,75 inch)
  var INNER = W - PAD * 2;

  var NS_P = 'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" ' +
    'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ' +
    'xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"';

  var CLR_MAP = '<p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" ' +
    'accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" ' +
    'accent6="accent6" hlink="hlink" folHlink="folHlink"/>';

  /* Cây hình rỗng — bắt buộc phải có ở mọi master, layout và slide. */
  function emptyTree(extra) {
    return '<p:spTree>' +
      '<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>' +
      '<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/>' +
      '<a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>' +
      (extra || '') +
      '</p:spTree>';
  }

  /* ── Khối hình trên slide ────────────────────────────────────────────── */

  function textBox(id, name, box, paragraphs, o) {
    o = o || {};
    var fill = o.fill
      ? '<a:solidFill><a:srgbClr val="' + o.fill + '"/></a:solidFill>'
      : '<a:noFill/>';
    var line = o.stroke
      ? '<a:ln w="12700"><a:solidFill><a:srgbClr val="' + o.stroke + '"/></a:solidFill>' +
        '<a:prstDash val="dash"/></a:ln>'
      : '<a:ln><a:noFill/></a:ln>';
    return '<p:sp>' +
      '<p:nvSpPr><p:cNvPr id="' + id + '" name="' + X(name) + '"/>' +
      '<p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>' +
      '<p:spPr><a:xfrm><a:off x="' + box.x + '" y="' + box.y + '"/>' +
      '<a:ext cx="' + box.cx + '" cy="' + box.cy + '"/></a:xfrm>' +
      '<a:prstGeom prst="' + (o.round ? 'roundRect' : 'rect') + '"><a:avLst/></a:prstGeom>' +
      fill + line + '</p:spPr>' +
      '<p:txBody>' +
      '<a:bodyPr wrap="square" lIns="0" tIns="0" rIns="0" bIns="0" ' +
      'anchor="' + (o.anchor || 't') + '"><a:normAutofit/></a:bodyPr>' +
      '<a:lstStyle/>' + paragraphs +
      '</p:txBody></p:sp>';
  }

  function paragraph(text, o) {
    o = o || {};
    var pPr = '<a:pPr algn="' + (o.align || 'l') + '"' +
      (o.bullet ? ' marL="285750" indent="-285750"' : '') +
      (o.spaceBefore ? '' : '') + '>' +
      (o.lineSpacing ? '<a:lnSpc><a:spcPct val="' + o.lineSpacing + '"/></a:lnSpc>' : '') +
      (o.spaceBefore ? '<a:spcBef><a:spcPts val="' + o.spaceBefore + '"/></a:spcBef>' : '') +
      (o.bullet
        ? '<a:buClr><a:srgbClr val="F8C85E"/></a:buClr>' +
          '<a:buFont typeface="Arial" pitchFamily="34" charset="0"/><a:buChar char="•"/>'
        : '<a:buNone/>') +
      '</a:pPr>';
    var rPr = '<a:rPr lang="vi-VN" sz="' + (o.size || 1600) + '"' +
      (o.bold ? ' b="1"' : '') +
      (o.spacing ? ' spc="' + o.spacing + '"' : '') +
      ' dirty="0"><a:solidFill><a:srgbClr val="' + (o.color || '263238') + '"/></a:solidFill></a:rPr>';
    return '<a:p>' + pPr + '<a:r>' + rPr + '<a:t>' + X(text) + '</a:t></a:r></a:p>';
  }

  /* ── Một slide ───────────────────────────────────────────────────────── */

  function slideXml(slide, index, total) {
    var cover = !!slide.cover;
    var ink = cover ? 'FFFFFF' : '263238';
    var kickerColor = cover ? 'FFE7EA' : '65B8E8';
    var shapes = [];
    var id = 2;

    /* Nền: slide bìa dùng dải màu chuyển như bản thiết kế. */
    var bg = cover
      ? '<p:bg><p:bgPr><a:gradFill rotWithShape="1">' +
        '<a:gsLst><a:gs pos="0"><a:srgbClr val="FF7C8A"/></a:gs>' +
        '<a:gs pos="100000"><a:srgbClr val="F8909B"/></a:gs></a:gsLst>' +
        '<a:lin ang="2700000" scaled="0"/></a:gradFill><a:effectLst/></p:bgPr></p:bg>'
      : '<p:bg><p:bgPr><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill>' +
        '<a:effectLst/></p:bgPr></p:bg>';

    /* Nhãn góc trên và số slide. */
    shapes.push(textBox(id++, 'Kicker', { x: PAD, y: 548640, cx: Math.round(INNER * 0.72), cy: 400000 },
      paragraph(slide.kicker, { size: 1200, bold: true, color: kickerColor, spacing: 300 })));
    shapes.push(textBox(id++, 'So slide', { x: PAD + Math.round(INNER * 0.76), y: 548640, cx: Math.round(INNER * 0.24), cy: 400000 },
      paragraph((index + 1) + '/' + total, { size: 1200, color: cover ? 'FFE7EA' : '8A9AA2', align: 'r' })));

    /* Tiêu đề. */
    shapes.push(textBox(id++, 'Tieu de', { x: PAD, y: 1080000, cx: INNER, cy: 1600000 },
      paragraph(slide.title, {
        size: cover ? 4000 : 3000, bold: true, color: ink, lineSpacing: '105000'
      })));

    /* Gạch đầu dòng. */
    var bullets = (slide.bullets || []).map(function (b) {
      return paragraph(b, {
        size: 1800, color: cover ? 'FFFFFF' : '42545C', bullet: true,
        lineSpacing: '110000', spaceBefore: 600
      });
    }).join('');
    if (bullets) {
      shapes.push(textBox(id++, 'Noi dung', { x: PAD, y: 2900000, cx: INNER, cy: 2600000 }, bullets));
    }

    /* Vùng đặt hình ảnh minh họa. */
    if (slide.image && !cover) {
      shapes.push(textBox(id++, 'Vung hinh anh',
        { x: PAD, y: 5600000, cx: INNER, cy: 700000 },
        paragraph('Vùng đặt hình ảnh minh họa', { size: 1200, color: '8A9AA2', align: 'ctr' }),
        { fill: 'F7FAFC', stroke: 'C9D6DD', round: true, anchor: 'ctr' }));
    }

    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<p:sld ' + NS_P + '><p:cSld>' + bg + emptyTree(shapes.join('')) + '</p:cSld>' +
      '<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>';
  }

  function notesXml(slide, index) {
    var text = 'Slide ' + (index + 1) + ' — ' + (slide.notes || '');
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<p:notes ' + NS_P + '><p:cSld>' + emptyTree(
        '<p:sp><p:nvSpPr><p:cNvPr id="2" name="Ghi chu"/>' +
        '<p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr>' +
        '<p:nvPr><p:ph type="body" idx="1"/></p:nvPr></p:nvSpPr>' +
        '<p:spPr><a:xfrm><a:off x="685800" y="4114800"/><a:ext cx="5486400" cy="4114800"/></a:xfrm>' +
        '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr>' +
        '<p:txBody><a:bodyPr/><a:lstStyle/>' +
        '<a:p><a:r><a:rPr lang="vi-VN" dirty="0"/><a:t>' + X(text) + '</a:t></a:r></a:p>' +
        '</p:txBody></p:sp>'
      ) + '</p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:notes>';
  }

  /* ── Các phần cố định của gói ────────────────────────────────────────── */

  var SLIDE_MASTER = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<p:sldMaster ' + NS_P + '><p:cSld>' +
    '<p:bg><p:bgPr><a:solidFill><a:schemeClr val="bg1"/></a:solidFill><a:effectLst/></p:bgPr></p:bg>' +
    emptyTree() + '</p:cSld>' + CLR_MAP +
    '<p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst>' +
    '</p:sldMaster>';

  var SLIDE_LAYOUT = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<p:sldLayout ' + NS_P + ' type="blank" preserve="1">' +
    '<p:cSld name="Trắng">' + emptyTree() + '</p:cSld>' +
    '<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>';

  var NOTES_MASTER = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<p:notesMaster ' + NS_P + '><p:cSld>' +
    '<p:bg><p:bgPr><a:solidFill><a:schemeClr val="bg1"/></a:solidFill><a:effectLst/></p:bgPr></p:bg>' +
    emptyTree(
      '<p:sp><p:nvSpPr><p:cNvPr id="2" name="Notes Placeholder"/>' +
      '<p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr>' +
      '<p:nvPr><p:ph type="body" idx="1"/></p:nvPr></p:nvSpPr>' +
      '<p:spPr><a:xfrm><a:off x="685800" y="4114800"/><a:ext cx="5486400" cy="4114800"/></a:xfrm>' +
      '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr>' +
      '<p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:endParaRPr lang="vi-VN"/></a:p></p:txBody></p:sp>'
    ) + '</p:cSld>' + CLR_MAP + '</p:notesMaster>';

  /* Theme tối thiểu nhưng đủ mọi phần bắt buộc của schema DrawingML. */
  function theme(name) {
    function fills() {
      return '<a:fillStyleLst>' +
        '<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>' +
        '<a:solidFill><a:schemeClr val="phClr"><a:tint val="60000"/></a:schemeClr></a:solidFill>' +
        '<a:solidFill><a:schemeClr val="phClr"><a:shade val="80000"/></a:schemeClr></a:solidFill>' +
        '</a:fillStyleLst>';
    }
    function lines() {
      return '<a:lnStyleLst>' +
        ['6350', '12700', '19050'].map(function (w) {
          return '<a:ln w="' + w + '" cap="flat" cmpd="sng" algn="ctr">' +
            '<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>' +
            '<a:prstDash val="solid"/></a:ln>';
        }).join('') +
        '</a:lnStyleLst>';
    }
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="' + X(name) + '">' +
      '<a:themeElements>' +
      '<a:clrScheme name="Tạo Giáo Án">' +
      '<a:dk1><a:srgbClr val="263238"/></a:dk1><a:lt1><a:srgbClr val="FFFFFF"/></a:lt1>' +
      '<a:dk2><a:srgbClr val="42545C"/></a:dk2><a:lt2><a:srgbClr val="FFF9F1"/></a:lt2>' +
      '<a:accent1><a:srgbClr val="FF7C8A"/></a:accent1><a:accent2><a:srgbClr val="65B8E8"/></a:accent2>' +
      '<a:accent3><a:srgbClr val="70C9A3"/></a:accent3><a:accent4><a:srgbClr val="F8C85E"/></a:accent4>' +
      '<a:accent5><a:srgbClr val="E5636F"/></a:accent5><a:accent6><a:srgbClr val="5F7079"/></a:accent6>' +
      '<a:hlink><a:srgbClr val="E5636F"/></a:hlink><a:folHlink><a:srgbClr val="8A9AA2"/></a:folHlink>' +
      '</a:clrScheme>' +
      '<a:fontScheme name="Tạo Giáo Án">' +
      '<a:majorFont><a:latin typeface="Arial"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont>' +
      '<a:minorFont><a:latin typeface="Arial"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont>' +
      '</a:fontScheme>' +
      '<a:fmtScheme name="Tạo Giáo Án">' +
      fills() + lines() +
      '<a:effectStyleLst>' +
      '<a:effectStyle><a:effectLst/></a:effectStyle>' +
      '<a:effectStyle><a:effectLst/></a:effectStyle>' +
      '<a:effectStyle><a:effectLst/></a:effectStyle>' +
      '</a:effectStyleLst>' +
      '<a:bgFillStyleLst>' +
      '<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>' +
      '<a:solidFill><a:schemeClr val="phClr"><a:tint val="95000"/></a:schemeClr></a:solidFill>' +
      '<a:solidFill><a:schemeClr val="phClr"><a:shade val="90000"/></a:schemeClr></a:solidFill>' +
      '</a:bgFillStyleLst>' +
      '</a:fmtScheme></a:themeElements></a:theme>';
  }

  function rel(id, type, target) {
    return '<Relationship Id="' + id + '" Type="http://schemas.openxmlformats.org/' + type +
      '" Target="' + target + '"/>';
  }

  function rels(inner) {
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      inner + '</Relationships>';
  }

  var OD = 'officeDocument/2006/relationships/';
  var PKG = 'package/2006/relationships/';

  /* ── Đóng gói ────────────────────────────────────────────────────────── */

  function build(slides, meta) {
    meta = meta || {};
    var n = slides.length;
    var files = [];

    /* [Content_Types].xml */
    var overrides = [
      '<Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>',
      '<Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>',
      '<Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>',
      '<Override PartName="/ppt/notesMasters/notesMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.notesMaster+xml"/>',
      '<Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>',
      '<Override PartName="/ppt/theme/theme2.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>',
      '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>',
      '<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>'
    ];
    slides.forEach(function (_, i) {
      overrides.push('<Override PartName="/ppt/slides/slide' + (i + 1) +
        '.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>');
      overrides.push('<Override PartName="/ppt/notesSlides/notesSlide' + (i + 1) +
        '.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.notesSlide+xml"/>');
    });
    files.push({
      path: '[Content_Types].xml',
      data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        overrides.join('') + '</Types>'
    });

    /* Quan hệ gốc. */
    files.push({
      path: '_rels/.rels',
      data: rels(
        rel('rId1', OD + 'officeDocument', 'ppt/presentation.xml') +
        rel('rId2', PKG + 'metadata/core-properties', 'docProps/core.xml') +
        rel('rId3', OD + 'extended-properties', 'docProps/app.xml')
      )
    });

    /* presentation.xml — rId1 master, rId2 notes master, rId3.. slide, cuối là theme. */
    var sldIds = slides.map(function (_, i) {
      return '<p:sldId id="' + (256 + i) + '" r:id="rId' + (3 + i) + '"/>';
    }).join('');
    files.push({
      path: 'ppt/presentation.xml',
      data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<p:presentation ' + NS_P + ' saveSubsetFonts="1">' +
        '<p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst>' +
        '<p:notesMasterIdLst><p:notesMasterId r:id="rId2"/></p:notesMasterIdLst>' +
        '<p:sldIdLst>' + sldIds + '</p:sldIdLst>' +
        '<p:sldSz cx="' + W + '" cy="' + H + '"/>' +
        '<p:notesSz cx="6858000" cy="9144000"/>' +
        '</p:presentation>'
    });

    var presRels = rel('rId1', OD + 'slideMaster', 'slideMasters/slideMaster1.xml') +
      rel('rId2', OD + 'notesMaster', 'notesMasters/notesMaster1.xml') +
      slides.map(function (_, i) {
        return rel('rId' + (3 + i), OD + 'slide', 'slides/slide' + (i + 1) + '.xml');
      }).join('') +
      rel('rId' + (3 + n), OD + 'theme', 'theme/theme1.xml');
    files.push({ path: 'ppt/_rels/presentation.xml.rels', data: rels(presRels) });

    /* Master, layout, notes master, theme. */
    files.push({ path: 'ppt/slideMasters/slideMaster1.xml', data: SLIDE_MASTER });
    files.push({
      path: 'ppt/slideMasters/_rels/slideMaster1.xml.rels',
      data: rels(
        rel('rId1', OD + 'slideLayout', '../slideLayouts/slideLayout1.xml') +
        rel('rId2', OD + 'theme', '../theme/theme1.xml')
      )
    });
    files.push({ path: 'ppt/slideLayouts/slideLayout1.xml', data: SLIDE_LAYOUT });
    files.push({
      path: 'ppt/slideLayouts/_rels/slideLayout1.xml.rels',
      data: rels(rel('rId1', OD + 'slideMaster', '../slideMasters/slideMaster1.xml'))
    });
    files.push({ path: 'ppt/notesMasters/notesMaster1.xml', data: NOTES_MASTER });
    files.push({
      path: 'ppt/notesMasters/_rels/notesMaster1.xml.rels',
      data: rels(rel('rId1', OD + 'theme', '../theme/theme2.xml'))
    });
    files.push({ path: 'ppt/theme/theme1.xml', data: theme('Tạo Giáo Án') });
    files.push({ path: 'ppt/theme/theme2.xml', data: theme('Tạo Giáo Án — ghi chú') });

    /* Từng slide và ghi chú của nó. */
    slides.forEach(function (slide, i) {
      var k = i + 1;
      files.push({ path: 'ppt/slides/slide' + k + '.xml', data: slideXml(slide, i, n) });
      files.push({
        path: 'ppt/slides/_rels/slide' + k + '.xml.rels',
        data: rels(
          rel('rId1', OD + 'slideLayout', '../slideLayouts/slideLayout1.xml') +
          rel('rId2', OD + 'notesSlide', '../notesSlides/notesSlide' + k + '.xml')
        )
      });
      files.push({ path: 'ppt/notesSlides/notesSlide' + k + '.xml', data: notesXml(slide, i) });
      files.push({
        path: 'ppt/notesSlides/_rels/notesSlide' + k + '.xml.rels',
        data: rels(
          rel('rId1', OD + 'notesMaster', '../notesMasters/notesMaster1.xml') +
          rel('rId2', OD + 'slide', '../slides/slide' + k + '.xml')
        )
      });
    });

    /* Thuộc tính tài liệu. */
    var now = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
    files.push({
      path: 'docProps/core.xml',
      data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" ' +
        'xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" ' +
        'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +
        '<dc:title>' + X(meta.title || 'Bài trình chiếu giáo án') + '</dc:title>' +
        '<dc:creator>' + X(meta.author || '') + '</dc:creator>' +
        '<cp:lastModifiedBy>' + X(meta.author || '') + '</cp:lastModifiedBy>' +
        '<dcterms:created xsi:type="dcterms:W3CDTF">' + now + '</dcterms:created>' +
        '<dcterms:modified xsi:type="dcterms:W3CDTF">' + now + '</dcterms:modified>' +
        '</cp:coreProperties>'
    });
    files.push({
      path: 'docProps/app.xml',
      data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" ' +
        'xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">' +
        '<Application>APP Tạo Giáo Án</Application>' +
        '<Slides>' + n + '</Slides>' +
        '</Properties>'
    });

    return window.ZIP.write(files,
      'application/vnd.openxmlformats-officedocument.presentationml.presentation');
  }

  function fileName(lesson) {
    return window.DOCX.fileName(lesson).replace(/^Giao-an/, 'Slide').replace(/\.docx$/, '.pptx');
  }

  function download(slides, lesson) {
    var name = fileName(lesson);
    window.ZIP.save(build(slides, {
      title: 'Bài trình chiếu: ' + lesson.info.activity,
      author: lesson.info.teacher
    }), name);
    return name;
  }

  window.PPTX = { build: build, download: download, fileName: fileName };
})();
