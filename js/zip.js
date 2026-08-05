/*
  Đọc và ghi file ZIP ngay trong trình duyệt.

  Cần đến vì .docx và .pptx đều là gói ZIP chứa các file XML. Không dùng thư
  viện ngoài để app vẫn chạy khi bấm đúp index.html và không có mạng.

    ZIP.write(entries)  → Blob    ghi gói mới, mỗi entry lưu nguyên (method 0)
    ZIP.read(arrayBuf)  → object  đọc gói có sẵn, giải nén deflate nếu cần

  Ghi ở chế độ "stored" (không nén) cho gọn phần mã. Word và PowerPoint đều mở
  bình thường; file chỉ lớn hơn bản nén, mà giáo án thì chỉ vài chục KB.
*/
(function () {
  'use strict';

  var enc = new TextEncoder();

  /* Bảng CRC32 dựng một lần. */
  var CRC_TABLE = (function () {
    var table = new Uint32Array(256);
    for (var i = 0; i < 256; i++) {
      var c = i;
      for (var k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      table[i] = c >>> 0;
    }
    return table;
  })();

  function crc32(bytes) {
    var c = 0xFFFFFFFF;
    for (var i = 0; i < bytes.length; i++) {
      c = CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
    }
    return (c ^ 0xFFFFFFFF) >>> 0;
  }

  /* Giờ và ngày theo định dạng MS-DOS mà ZIP dùng. */
  function dosStamp(d) {
    var time = ((d.getHours() & 0x1F) << 11) | ((d.getMinutes() & 0x3F) << 5) | ((d.getSeconds() / 2) & 0x1F);
    var year = Math.max(1980, d.getFullYear()) - 1980;
    var date = ((year & 0x7F) << 9) | (((d.getMonth() + 1) & 0x0F) << 5) | (d.getDate() & 0x1F);
    return { time: time, date: date };
  }

  function toBytes(data) {
    if (typeof data === 'string') return enc.encode(data);
    if (data instanceof Uint8Array) return data;
    if (data instanceof ArrayBuffer) return new Uint8Array(data);
    throw new Error('ZIP: kiểu dữ liệu không hỗ trợ');
  }

  /*
    entries: [{ path: 'word/document.xml', data: '<xml…>' | Uint8Array }]
    Trả về Blob với mimeType truyền vào (hoặc application/zip).
  */
  function write(entries, mimeType) {
    var stamp = dosStamp(new Date());
    var parts = [];        // các khối byte của phần dữ liệu
    var central = [];      // bản ghi thư mục trung tâm
    var offset = 0;

    entries.forEach(function (entry) {
      var nameBytes = enc.encode(entry.path);
      var dataBytes = toBytes(entry.data);
      var crc = crc32(dataBytes);

      var local = new Uint8Array(30 + nameBytes.length);
      var lv = new DataView(local.buffer);
      lv.setUint32(0, 0x04034b50, true);   // chữ ký local file header
      lv.setUint16(4, 20, true);           // cần version 2.0
      lv.setUint16(6, 0x0800, true);       // bit 11: tên file là UTF-8
      lv.setUint16(8, 0, true);            // method 0 = stored
      lv.setUint16(10, stamp.time, true);
      lv.setUint16(12, stamp.date, true);
      lv.setUint32(14, crc, true);
      lv.setUint32(18, dataBytes.length, true);
      lv.setUint32(22, dataBytes.length, true);
      lv.setUint16(26, nameBytes.length, true);
      lv.setUint16(28, 0, true);           // không có extra field
      local.set(nameBytes, 30);

      parts.push(local, dataBytes);

      var cd = new Uint8Array(46 + nameBytes.length);
      var cv = new DataView(cd.buffer);
      cv.setUint32(0, 0x02014b50, true);   // chữ ký central directory
      cv.setUint16(4, 20, true);           // version tạo bởi
      cv.setUint16(6, 20, true);           // version cần để mở
      cv.setUint16(8, 0x0800, true);
      cv.setUint16(10, 0, true);
      cv.setUint16(12, stamp.time, true);
      cv.setUint16(14, stamp.date, true);
      cv.setUint32(16, crc, true);
      cv.setUint32(20, dataBytes.length, true);
      cv.setUint32(24, dataBytes.length, true);
      cv.setUint16(28, nameBytes.length, true);
      cv.setUint16(30, 0, true);           // extra
      cv.setUint16(32, 0, true);           // comment
      cv.setUint16(34, 0, true);           // đĩa bắt đầu
      cv.setUint16(36, 0, true);           // thuộc tính nội bộ
      cv.setUint32(38, 0, true);           // thuộc tính ngoài
      cv.setUint32(42, offset, true);      // vị trí local header
      cd.set(nameBytes, 46);
      central.push(cd);

      offset += local.length + dataBytes.length;
    });

    var centralSize = central.reduce(function (n, c) { return n + c.length; }, 0);
    var end = new Uint8Array(22);
    var ev = new DataView(end.buffer);
    ev.setUint32(0, 0x06054b50, true);     // chữ ký end of central directory
    ev.setUint16(4, 0, true);
    ev.setUint16(6, 0, true);
    ev.setUint16(8, entries.length, true);
    ev.setUint16(10, entries.length, true);
    ev.setUint32(12, centralSize, true);
    ev.setUint32(16, offset, true);
    ev.setUint16(20, 0, true);

    return new Blob(parts.concat(central, [end]), { type: mimeType || 'application/zip' });
  }

  /* ── Đọc ─────────────────────────────────────────────────────────────── */

  function canInflate() {
    return typeof window.DecompressionStream === 'function';
  }

  function inflateRaw(bytes) {
    if (!canInflate()) {
      return Promise.reject(new Error('Trình duyệt này không giải nén được (thiếu DecompressionStream)'));
    }
    var stream = new Blob([bytes]).stream().pipeThrough(new window.DecompressionStream('deflate-raw'));
    return new Response(stream).arrayBuffer().then(function (buf) { return new Uint8Array(buf); });
  }

  /* Tìm end-of-central-directory, lùi từ cuối file vì phần chú thích có thể dài. */
  function findEocd(view, len) {
    var max = Math.min(len - 22, 0xFFFF + 22);
    for (var i = 0; i <= max; i++) {
      var at = len - 22 - i;
      if (view.getUint32(at, true) === 0x06054b50) return at;
    }
    return -1;
  }

  /*
    Đọc gói ZIP. Trả về { names: [...], get(path) → Promise<Uint8Array>,
    text(path) → Promise<string> }. Chỉ đọc phần cần dùng, không giải nén cả gói.
  */
  function read(arrayBuffer) {
    var bytes = new Uint8Array(arrayBuffer);
    var view = new DataView(arrayBuffer);
    var eocd = findEocd(view, bytes.length);
    if (eocd < 0) throw new Error('Không phải file ZIP hợp lệ (thiếu bản ghi cuối gói)');

    var count = view.getUint16(eocd + 10, true);
    var cdOffset = view.getUint32(eocd + 16, true);
    var index = {};
    var names = [];
    var dec = new TextDecoder();
    var p = cdOffset;

    for (var i = 0; i < count; i++) {
      if (view.getUint32(p, true) !== 0x02014b50) break;
      var method = view.getUint16(p + 10, true);
      var compSize = view.getUint32(p + 20, true);
      var rawSize = view.getUint32(p + 24, true);
      var nameLen = view.getUint16(p + 28, true);
      var extraLen = view.getUint16(p + 30, true);
      var commentLen = view.getUint16(p + 32, true);
      var localAt = view.getUint32(p + 42, true);
      var name = dec.decode(bytes.subarray(p + 46, p + 46 + nameLen));
      index[name] = { method: method, compSize: compSize, rawSize: rawSize, localAt: localAt };
      names.push(name);
      p += 46 + nameLen + extraLen + commentLen;
    }

    function get(path) {
      var e = index[path];
      if (!e) return Promise.reject(new Error('Trong gói không có ' + path));
      // Kích thước tên và extra ở local header có thể khác central directory.
      var nameLen = view.getUint16(e.localAt + 26, true);
      var extraLen = view.getUint16(e.localAt + 28, true);
      var start = e.localAt + 30 + nameLen + extraLen;
      var chunk = bytes.subarray(start, start + e.compSize);
      if (e.method === 0) return Promise.resolve(chunk);
      if (e.method === 8) return inflateRaw(chunk);
      return Promise.reject(new Error('Cách nén không hỗ trợ (method ' + e.method + ')'));
    }

    return {
      names: names,
      has: function (path) { return !!index[path]; },
      get: get,
      text: function (path) {
        return get(path).then(function (b) { return new TextDecoder('utf-8').decode(b); });
      }
    };
  }

  /* Escape cho nội dung XML — dùng chung cho docx.js và pptx.js. */
  function xml(text) {
    return String(text == null ? '' : text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;')
      // Ký tự điều khiển không hợp lệ trong XML 1.0 (giữ tab, LF, CR).
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
  }

  /* Tải Blob về máy. */
  function save(blob, filename) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    // Nhả URL sau khi trình duyệt kịp bắt đầu tải.
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }

  window.ZIP = {
    write: write,
    read: read,
    save: save,
    xml: xml,
    crc32: crc32,
    canInflate: canInflate
  };
})();
